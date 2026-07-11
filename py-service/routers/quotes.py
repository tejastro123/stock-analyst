from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import yfinance as yf

import cache
from utils import safe_float, safe_int, normalize_symbol, get_ticker

router = APIRouter(prefix="/quotes", tags=["quotes"])


import base64
from pathlib import Path

def get_logo_data_url(ticker_str: str) -> str:
    ticker = ticker_str.upper().split("-")[0]
    logos_dir = Path(__file__).parent.parent.parent / "assets" / "logos"
    if logos_dir.exists():
        for ext in ["svg", "png", "ico", "jpg", "jpeg"]:
            logo_path = logos_dir / f"{ticker}.{ext}"
            if logo_path.exists():
                try:
                    with open(logo_path, "rb") as f:
                        data = f.read()
                    b64_data = base64.b64encode(data).decode("utf-8")
                    mime_map = {
                        "svg": "image/svg+xml",
                        "png": "image/png",
                        "ico": "image/x-icon",
                        "jpg": "image/jpeg",
                        "jpeg": "image/jpeg"
                    }
                    mime = mime_map.get(ext, "image/png")
                    return f"data:{mime};base64,{b64_data}"
                except Exception:
                    pass
    
    hue = sum(ord(char) for char in ticker) * 73 % 360
    svg_fallback = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="46" fill="hsl({hue}, 55%, 42%)" />
        <text x="50" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle">{ticker}</text>
    </svg>
    """.strip()
    b64_svg = base64.b64encode(svg_fallback.encode("utf-8")).decode("utf-8")
    return f"data:image/svg+xml;base64,{b64_svg}"

def _build_quote(symbol: str, market: str = "US") -> dict:
    yf_sym = normalize_symbol(symbol, market)
    ticker = yf.Ticker(yf_sym)
    info = ticker.fast_info

    price       = safe_float(getattr(info, "last_price", None))
    prev_close  = safe_float(getattr(info, "previous_close", None))
    open_price  = safe_float(getattr(info, "open", None))
    day_high    = safe_float(getattr(info, "day_high", None))
    day_low     = safe_float(getattr(info, "day_low", None))
    volume      = safe_int(getattr(info, "last_volume", None))
    market_cap  = safe_int(getattr(info, "market_cap", None))
    week52_high = safe_float(getattr(info, "year_high", None))
    week52_low  = safe_float(getattr(info, "year_low", None))

    change     = round(price - prev_close, 4) if price and prev_close else None
    change_pct = round((change / prev_close) * 100, 4) if change and prev_close else None

    return {
        "symbol":      symbol.upper(),
        "market":      market,
        "yf_symbol":   yf_sym,
        "price":       price,
        "prev_close":  prev_close,
        "open":        open_price,
        "day_high":    day_high,
        "day_low":     day_low,
        "change":      change,
        "change_pct":  change_pct,
        "volume":      volume,
        "market_cap":  market_cap,
        "week52_high": week52_high,
        "week52_low":  week52_low,
        "currency":    getattr(info, "currency", "USD"),
        "logo_url":    get_logo_data_url(symbol),
    }


# GET /quotes/{symbol}?market=US
@router.get("/{symbol}")
def get_quote(symbol: str, market: str = Query("US")):
    cache_key = f"{symbol.upper()}:{market}"
    cached = cache.get("quote", cache_key)
    if cached:
        return {**cached, "cached": True}

    try:
        data = _build_quote(symbol, market)
    except Exception as e:
        # Return a structured error instead of propagating a 502
        return {
            "symbol": symbol.upper(),
            "market": market,
            "yf_symbol": None,
            "price": None,
            "prev_close": None,
            "open": None,
            "day_high": None,
            "day_low": None,
            "change": None,
            "change_pct": None,
            "volume": None,
            "market_cap": None,
            "week52_high": None,
            "week52_low": None,
            "currency": "USD",
            "logo_url": get_logo_data_url(symbol),
            "data_available": False,
            "error": str(e),
            "cached": False,
        }

    # Don't cache responses with no price data
    if data.get("price") is not None:
        cache.set("quote", cache_key, data)
    return {**data, "cached": False}


# POST /quotes/batch  body: {"symbols": ["AAPL","TSLA"], "market": "US"}
@router.post("/batch")
def batch_quotes(body: dict):
    symbols: list[str] = body.get("symbols", [])
    market: str = body.get("market", "US")

    if not symbols:
        raise HTTPException(status_code=400, detail="symbols list required")
    if len(symbols) > 50:
        raise HTTPException(status_code=400, detail="max 50 symbols per batch")

    results = {}
    missing = []

    for sym in symbols:
        key = f"{sym.upper()}:{market}"
        cached = cache.get("quote", key)
        if cached:
            results[sym.upper()] = {**cached, "cached": True}
        else:
            missing.append(sym)

    if missing:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def fetch_one(sym):
            try:
                return sym, _build_quote(sym, market)
            except Exception as e:
                return sym, {"symbol": sym.upper(), "error": str(e)}

        with ThreadPoolExecutor(max_workers=min(len(missing), 20)) as executor:
            futures = [executor.submit(fetch_one, sym) for sym in missing]
            for fut in as_completed(futures):
                sym, data = fut.result()
                if "error" in data:
                    results[sym.upper()] = data
                else:
                    results[sym.upper()] = {**data, "cached": False}
                    cache.set("quote", f"{sym.upper()}:{market}", data)

    return {"quotes": results, "count": len(results)}

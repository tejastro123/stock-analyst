from fastapi import APIRouter, Query, HTTPException
import yfinance as yf
import pandas as pd

import cache
from utils import safe_float, safe_int, normalize_symbol

router = APIRouter(prefix="/options", tags=["options"])


def _parse_chain(df: pd.DataFrame, option_type: str) -> list[dict]:
    if df is None or df.empty:
        return []
    rows = []
    for _, r in df.iterrows():
        rows.append({
            "contractSymbol": r.get("contractSymbol"),
            "strike":         safe_float(r.get("strike")),
            "lastPrice":      safe_float(r.get("lastPrice")),
            "bid":            safe_float(r.get("bid")),
            "ask":            safe_float(r.get("ask")),
            "change":         safe_float(r.get("change")),
            "pctChange":      safe_float(r.get("percentChange")),
            "volume":         safe_int(r.get("volume")),
            "openInterest":   safe_int(r.get("openInterest")),
            "impliedVol":     safe_float(r.get("impliedVolatility")),
            "inTheMoney":     bool(r.get("inTheMoney", False)),
            "type":           option_type,
        })
    return rows


@router.get("/{symbol}")
def get_options_chain(
    symbol: str,
    market: str = Query("US"),
    expiry: str = Query(None, description="Expiry date YYYY-MM-DD, defaults to nearest"),
):
    cache_key = f"{symbol.upper()}:{market}:{expiry or 'nearest'}"
    cached = cache.get("options", cache_key)
    if cached:
        return {**cached, "cached": True}

    yf_sym = normalize_symbol(symbol, market)
    try:
        ticker = yf.Ticker(yf_sym)
        expirations = ticker.options
    except Exception as e:
        raise HTTPException(502, f"yfinance error: {str(e)}")

    if not expirations:
        raise HTTPException(404, f"No options data for {symbol}")

    # Pick expiry
    chosen = expiry if expiry in expirations else expirations[0]

    try:
        chain = ticker.option_chain(chosen)
    except Exception as e:
        raise HTTPException(502, f"Options chain fetch failed: {str(e)}")

    calls = _parse_chain(chain.calls, "call")
    puts  = _parse_chain(chain.puts,  "put")

    # Current price for moneyness context
    try:
        price = safe_float(ticker.fast_info.last_price)
    except Exception:
        price = None

    data = {
        "symbol":       symbol.upper(),
        "market":       market,
        "price":        price,
        "expiry":       chosen,
        "expirations":  list(expirations),
        "calls":        calls,
        "puts":         puts,
        "calls_count":  len(calls),
        "puts_count":   len(puts),
    }

    cache.set("options", cache_key, data)
    return {**data, "cached": False}

"""Sector ETF / index heatmap data for US and Indian markets."""
from fastapi import APIRouter, Query
import yfinance as yf
import cache
from utils import safe_float, safe_int

router = APIRouter(prefix="/sector", tags=["sector"])

SECTOR_US = {
    "Technology":       "XLK",
    "Healthcare":       "XLV",
    "Financials":       "XLF",
    "Consumer Disc.":   "XLY",
    "Consumer Staples": "XLP",
    "Energy":           "XLE",
    "Industrials":      "XLI",
    "Communication":    "XLC",
    "Materials":        "XLB",
    "Real Estate":      "XLRE",
    "Utilities":        "XLU",
}

SECTOR_INDIA = {
    "Financial Svcs.":  "^NSEBANK",
    "IT":               "^CNXIT",
    "Pharma":           "^CNXPHARMA",
    "FMCG":             "^CNXFMCG",
    "Auto":             "^CNXAUTO",
    "Metal":            "^CNXMETAL",
    "Energy":           "^CNXENERGY",
    "Realty":           "^CNXREALTY",
    "Media":            "^CNXMEDIA",
}


def _fetch_sector(sector, symbol):
    """Fetch a single sector quote."""
    try:
        ticker = yf.Ticker(symbol)
        fi = ticker.fast_info
        price      = safe_float(getattr(fi, "last_price", None))
        prev_close = safe_float(getattr(fi, "previous_close", None))
        change_pct = round(((price - prev_close) / prev_close) * 100, 2) if price and prev_close else None
        market_cap = safe_int(getattr(fi, "market_cap", None))
        return {
            "sector":     sector,
            "symbol":     symbol,
            "price":      price,
            "change_pct": change_pct,
            "market_cap": market_cap,
        }
    except Exception:
        return {"sector": sector, "symbol": symbol, "price": None, "change_pct": None, "market_cap": None}


@router.get("/heatmap")
def get_sector_heatmap(market: str = Query("US")):
    is_india = market in ("NSE", "BSE", "IN")
    sectors = SECTOR_INDIA if is_india else SECTOR_US

    cache_key = f"sector:heatmap:{market}"
    cached = cache.get("quote", cache_key)
    if cached:
        return {"sectors": cached, "market": market, "cached": True}

    from concurrent.futures import ThreadPoolExecutor, as_completed

    results = []
    max_workers = min(len(sectors), 11)
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_fetch_sector, sec, sym): sec for sec, sym in sectors.items()}
        for fut in as_completed(futures):
            results.append(fut.result())

    order = list(sectors.keys())
    results.sort(key=lambda x: order.index(x["sector"]))

    cache.set("quote", cache_key, results)
    return {"sectors": results, "market": market, "cached": False}

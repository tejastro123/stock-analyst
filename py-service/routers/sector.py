"""Sector ETF heatmap data."""
from fastapi import APIRouter
import yfinance as yf
import cache
from utils import safe_float, safe_int

router = APIRouter(prefix="/sector", tags=["sector"])

SECTOR_ETFS = {
    "Technology":            "XLK",
    "Healthcare":            "XLV",
    "Financials":            "XLF",
    "Consumer Disc.":        "XLY",
    "Consumer Staples":      "XLP",
    "Energy":                "XLE",
    "Industrials":           "XLI",
    "Communication":         "XLC",
    "Materials":             "XLB",
    "Real Estate":           "XLRE",
    "Utilities":             "XLU",
}


@router.get("/heatmap")
def get_sector_heatmap():
    cached = cache.get("quote", "sector:heatmap")
    if cached:
        return {"sectors": cached, "cached": True}

    from concurrent.futures import ThreadPoolExecutor, as_completed

    def fetch_etf(sector, etf):
        try:
            fi = yf.Ticker(etf).fast_info
            price      = safe_float(getattr(fi, "last_price", None))
            prev_close = safe_float(getattr(fi, "previous_close", None))
            change_pct = round(((price - prev_close) / prev_close) * 100, 2) if price and prev_close else None
            market_cap = safe_int(getattr(fi, "market_cap", None))
            return {
                "sector":     sector,
                "etf":        etf,
                "price":      price,
                "change_pct": change_pct,
                "market_cap": market_cap,
            }
        except Exception:
            return {"sector": sector, "etf": etf, "price": None, "change_pct": None, "market_cap": None}

    results = []
    with ThreadPoolExecutor(max_workers=min(len(SECTOR_ETFS), 11)) as pool:
        futures = {pool.submit(fetch_etf, sec, sym): sec for sec, sym in SECTOR_ETFS.items()}
        for fut in as_completed(futures):
            results.append(fut.result())

    # Sort results to keep a stable order
    order = list(SECTOR_ETFS.keys())
    results.sort(key=lambda x: order.index(x["sector"]))

    cache.set("quote", "sector:heatmap", results)
    return {"sectors": results, "cached": False}

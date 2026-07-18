"""Market metrics, Breadth, Movers, and Earnings Router."""
from fastapi import APIRouter
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor, as_completed
import cache
from routers import screener
from utils import safe_float, safe_int, normalize_symbol

router = APIRouter(prefix="/metrics", tags=["metrics"])

POPULAR_EARNINGS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "META", "NFLX", "JPM", "DIS"]


def _fetch_earnings(symbol: str):
    try:
        t = yf.Ticker(symbol)
        cal = t.calendar
        # yfinance calendar returns dict with list of dates under 'Earnings Date' or similar
        dates = []
        if isinstance(cal, dict):
            # Try different potential yfinance keys
            raw_dates = cal.get("Earnings Date") or cal.get("earningsDate") or []
            for d in raw_dates:
                dates.append(str(d))
        elif hasattr(cal, "get"):
            raw_dates = cal.get("Earnings Date") or []
            for d in raw_dates:
                dates.append(str(d))

        return {
            "symbol": symbol,
            "earnings_dates": dates,
            "eps_avg": cal.get("Earnings Average") if isinstance(cal, dict) else None,
        }
    except Exception:
        return {"symbol": symbol, "earnings_dates": [], "eps_avg": None}


@router.get("/earnings")
def get_earnings_calendar():
    cached = cache.get("fundamentals", "metrics:earnings")
    if cached:
        return {"calendar": cached, "cached": True}

    results = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(_fetch_earnings, sym) for sym in POPULAR_EARNINGS]
        for fut in as_completed(futures):
            results.append(fut.result())

    # filter out empty ones
    results = [r for r in results if r["earnings_dates"]]

    cache.set("fundamentals", "metrics:earnings", results)  # Cache in fundamentals (1h TTL)
    return {"calendar": results, "cached": False}


@router.get("/breadth")
def get_market_breadth(market: str = "US"):
    is_india = market in ("NSE", "BSE", "IN")
    cache_key = f"metrics:breadth:{market}"
    cached = cache.get("screener", cache_key)
    if cached:
        return {**cached, "cached": True}

    universe = screener.NSE_UNIVERSE if is_india else screener.US_UNIVERSE
    raw_data = []

    # Fast fetch info for breadth (last_price, previous_close, ma50, ma200)
    mkt = "NSE" if is_india else "US"

    def fetch_breadth_data(sym):
        try:
            t = yf.Ticker(normalize_symbol(sym, mkt))
            fi = t.fast_info
            info = t.info
            price = safe_float(getattr(fi, "last_price", None))
            prev_close = safe_float(getattr(fi, "previous_close", None))
            ma50 = safe_float(info.get("fiftyDayAverage"))
            ma200 = safe_float(info.get("twoHundredDayAverage"))
            change_pct = ((price - prev_close) / prev_close) * 100 if price and prev_close else 0
            return {
                "symbol": sym,
                "price": price,
                "change_pct": change_pct,
                "ma50": ma50,
                "ma200": ma200,
            }
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = [pool.submit(fetch_breadth_data, sym) for sym in universe]
        for fut in as_completed(futures):
            res = fut.result()
            if res and res["price"]:
                raw_data.append(res)

    total = len(raw_data)
    if total == 0:
        return {"error": "No breadth data available"}

    advancing = sum(1 for r in raw_data if r["change_pct"] > 0)
    declining = sum(1 for r in raw_data if r["change_pct"] < 0)
    above_ma50 = sum(1 for r in raw_data if r["ma50"] and r["price"] > r["ma50"])
    above_ma200 = sum(1 for r in raw_data if r["ma200"] and r["price"] > r["ma200"])

    out = {
        "total_tracked": total,
        "advancing_pct": round((advancing / total) * 100, 1),
        "declining_pct": round((declining / total) * 100, 1),
        "above_ma50_pct": round((above_ma50 / total) * 100, 1),
        "above_ma200_pct": round((above_ma200 / total) * 100, 1),
        "ad_ratio": round(advancing / max(declining, 1), 2),
    }

    cache.set("screener", cache_key, out)  # Cache in screener pool (5m TTL)
    return {**out, "cached": False}


@router.get("/movers")
def get_top_movers(market: str = "US"):
    is_india = market in ("NSE", "BSE", "IN")
    cache_key = f"metrics:movers:{market}"
    cached = cache.get("screener", cache_key)
    if cached:
        return {**cached, "cached": True}

    universe = screener.NSE_UNIVERSE if is_india else screener.US_UNIVERSE
    mkt = "NSE" if is_india else "US"
    raw_data = []

    def fetch_mover_data(sym):
        try:
            t = yf.Ticker(normalize_symbol(sym, mkt))
            fi = t.fast_info
            price = safe_float(getattr(fi, "last_price", None))
            prev_close = safe_float(getattr(fi, "previous_close", None))
            change_pct = round(((price - prev_close) / prev_close) * 100, 2) if price and prev_close else 0.0
            return {
                "sym": sym,
                "price": price,
                "pct": f"{'+' if change_pct >= 0 else ''}{change_pct}%",
                "change_pct": change_pct,
                "reason": "Volume Spike" if getattr(fi, "last_volume", 0) > getattr(fi, "average_volume", 1e9) else "Market Move",
                "up": change_pct >= 0
            }
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = [pool.submit(fetch_mover_data, sym) for sym in universe]
        for fut in as_completed(futures):
            res = fut.result()
            if res and res["price"]:
                raw_data.append(res)

    # Sort to find top gainers and decliners
    raw_data.sort(key=lambda x: x["change_pct"])
    top_losers = raw_data[:5]
    top_gainers = sorted(raw_data[-5:], key=lambda x: x["change_pct"], reverse=True)

    # Combine them
    movers = top_gainers + top_losers
    # Sort absolute moves
    movers.sort(key=lambda x: abs(x["change_pct"]), reverse=True)

    # Convert back to original requested properties format
    out = {
        "movers": movers[:6]
    }

    cache.set("screener", cache_key, out)  # Cache in screener pool (5m TTL)
    return {**out, "cached": False}

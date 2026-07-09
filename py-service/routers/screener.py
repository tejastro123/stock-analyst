"""
Stock Screener — 20+ filters, supports US and NSE markets.
Universe: ~120 popular US stocks + extensible to NSE.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf
import numpy as np

import cache
from utils import safe_float, safe_int, calculate_rsi

router = APIRouter(prefix="/screener", tags=["screener"])

# ── Default universe ────────────────────────────────────────────────────────
US_UNIVERSE = [
    # Mega caps
    "AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","BRK-B","LLY","V",
    "JPM","XOM","UNH","JNJ","WMT","MA","PG","HD","MRK","CVX",
    # Large caps
    "ABBV","KO","AVGO","PEP","COST","ADBE","NFLX","CRM","AMD","ORCL",
    "ACN","MCD","BAC","TMO","ABT","DHR","NKE","WFC","QCOM","TXN",
    "NEE","PM","RTX","HON","MS","GS","INTU","AMGN","SPGI","IBM",
    "NOW","ISRG","CAT","DE","AXP","BLK","BKNG","GE","TROW","MDT",
    "PLD","SYK","SCHW","ADI","GILD","ZTS","REGN","MO","TJX","CB",
    "SBUX","SO","DUK","MMM","LRCX","KLAC","MRVL","SNPS","CDNS","FTNT",
    "PANW","CRWD","DDOG","NET","ZS","SNOW","PLTR","COIN","SQ","ROKU",
    "SMCI","MSTR","RBLX","LYFT","UBER","RIVN","LCID","F","GM","INTC",
    # ETFs
    "SPY","QQQ","IWM","DIA","GLD","SLV","USO","TLT","HYG","VNQ",
]

NSE_UNIVERSE = [
    "RELIANCE","TCS","HDFCBANK","INFY","HINDUNILVR","ICICIBANK","SBIN",
    "BHARTIARTL","ITC","KOTAKBANK","LT","WIPRO","HCLTECH","BAJFINANCE",
    "ASIANPAINT","ADANIPORTS","TITAN","MARUTI","NESTLEIND","TECHM",
    "SUNPHARMA","DRREDDY","CIPLA","DIVISLAB","HEROMOTOCO","BAJAJFINSV",
    "GRASIM","ULTRACEMCO","TATASTEEL","JSWSTEEL","COALINDIA","ONGC",
    "POWERGRID","NTPC","BPCL","IOC","HINDALCO","VEDL","TATACONSUM",
    "APOLLOHOSP","MCDOWELL-N","PIDILITIND","SIEMENS","ABB","HAVELLS",
]


# ── Filter schema ───────────────────────────────────────────────────────────
class ScreenerFilters(BaseModel):
    market: str = "US"
    symbols: Optional[list[str]] = None  # custom universe

    # Price & volume
    min_price:       Optional[float] = None
    max_price:       Optional[float] = None
    min_market_cap:  Optional[float] = None   # in billions
    max_market_cap:  Optional[float] = None
    min_volume:      Optional[float] = None   # in thousands
    max_volume:      Optional[float] = None
    min_avg_volume:  Optional[float] = None

    # Valuation
    min_pe:    Optional[float] = None
    max_pe:    Optional[float] = None
    min_pb:    Optional[float] = None
    max_pb:    Optional[float] = None
    min_ps:    Optional[float] = None
    max_ps:    Optional[float] = None
    max_peg:   Optional[float] = None
    max_ev_ebitda: Optional[float] = None

    # Profitability
    min_profit_margin:   Optional[float] = None   # e.g. 0.10 = 10%
    min_gross_margin:    Optional[float] = None
    min_operating_margin: Optional[float] = None
    min_roe:             Optional[float] = None
    min_roa:             Optional[float] = None

    # Growth
    min_revenue_growth:  Optional[float] = None   # e.g. 0.10 = 10%
    min_earnings_growth: Optional[float] = None

    # Technical
    min_beta:    Optional[float] = None
    max_beta:    Optional[float] = None
    min_rsi:     Optional[float] = None
    max_rsi:     Optional[float] = None
    above_ma50:  Optional[bool]  = None
    above_ma200: Optional[bool]  = None
    pct_from_52w_high: Optional[float] = None  # e.g. -20 = within 20% of 52w high
    pct_from_52w_low:  Optional[float] = None  # e.g. 20 = at least 20% above 52w low

    # Dividends
    min_dividend_yield: Optional[float] = None   # e.g. 0.02 = 2%

    # Sector
    sector: Optional[str] = None

    # Sort
    sort_by:  str = "market_cap"
    sort_asc: bool = False

    # Limit
    limit: int = Field(default=50, le=200)


def _passes(row: dict, f: ScreenerFilters) -> bool:
    """Apply all filters to a single row."""
    def chk(val, mn, mx):
        if val is None:
            return (mn is None and mx is None)
        if mn is not None and val < mn: return False
        if mx is not None and val > mx: return False
        return True

    price = row.get("price")
    mc    = row.get("market_cap")  # raw, in dollars

    if not chk(price, f.min_price, f.max_price): return False

    if mc is not None:
        mc_b = mc / 1e9
        if not chk(mc_b, f.min_market_cap, f.max_market_cap): return False
    elif f.min_market_cap or f.max_market_cap:
        return False

    vol = row.get("volume")
    if vol is not None:
        vol_k = vol / 1e3
        if not chk(vol_k, f.min_volume, f.max_volume): return False
    elif f.min_volume:
        return False

    avg_vol = row.get("avg_volume")
    if f.min_avg_volume and (avg_vol is None or avg_vol / 1e3 < f.min_avg_volume):
        return False

    if not chk(row.get("pe_trailing"), f.min_pe, f.max_pe): return False
    if not chk(row.get("pb_ratio"),    f.min_pb, f.max_pb): return False
    if not chk(row.get("ps_ratio"),    f.min_ps, f.max_ps): return False
    if f.max_peg and row.get("peg_ratio") and row["peg_ratio"] > f.max_peg: return False
    if f.max_ev_ebitda and row.get("ev_ebitda") and row["ev_ebitda"] > f.max_ev_ebitda: return False

    if f.min_profit_margin and (row.get("profit_margin") or 0) < f.min_profit_margin: return False
    if f.min_gross_margin   and (row.get("gross_margin")  or 0) < f.min_gross_margin:  return False
    if f.min_operating_margin and (row.get("operating_margin") or 0) < f.min_operating_margin: return False
    if f.min_roe and (row.get("roe") or 0) < f.min_roe: return False
    if f.min_roa and (row.get("roa") or 0) < f.min_roa: return False

    if f.min_revenue_growth  and (row.get("revenue_growth")  or 0) < f.min_revenue_growth:  return False
    if f.min_earnings_growth and (row.get("earnings_growth") or 0) < f.min_earnings_growth: return False

    if not chk(row.get("beta"), f.min_beta, f.max_beta): return False
    if not chk(row.get("rsi"),  f.min_rsi,  f.max_rsi):  return False

    p = row.get("price")
    ma50  = row.get("ma50")
    ma200 = row.get("ma200")
    if f.above_ma50  is not None and p and ma50:
        if f.above_ma50  != (p > ma50):  return False
    if f.above_ma200 is not None and p and ma200:
        if f.above_ma200 != (p > ma200): return False

    w52h = row.get("week52_high")
    w52l = row.get("week52_low")
    if f.pct_from_52w_high is not None and p and w52h:
        pct = ((p - w52h) / w52h) * 100
        if pct < f.pct_from_52w_high: return False
    if f.pct_from_52w_low is not None and p and w52l:
        pct = ((p - w52l) / w52l) * 100
        if pct < f.pct_from_52w_low: return False

    if f.min_dividend_yield and (row.get("dividend_yield") or 0) < f.min_dividend_yield: return False

    if f.sector and row.get("sector") and f.sector.lower() not in row["sector"].lower(): return False

    return True


def _fetch_stock_data(symbol: str, market: str, include_rsi: bool = False) -> dict | None:
    """Fetch all screener fields for a symbol. RSI is optional (extra HTTP call)."""
    from utils import normalize_symbol
    yf_sym = normalize_symbol(symbol, market)
    try:
        t = yf.Ticker(yf_sym)
        info = t.info
        fi   = t.fast_info

        price       = safe_float(getattr(fi, "last_price", None))
        prev_close  = safe_float(getattr(fi, "previous_close", None))
        change_pct  = round(((price - prev_close) / prev_close) * 100, 2) if price and prev_close else None

        # RSI — only fetch if RSI filter is active (extra yfinance call)
        rsi = None
        if include_rsi:
            try:
                hist = t.history(period="2mo", interval="1d", auto_adjust=True)
                if not hist.empty:
                    closes = hist["Close"].dropna().tolist()
                    rsi = calculate_rsi(closes)
            except Exception:
                pass

        return {
            "symbol":           symbol.upper(),
            "name":             info.get("longName") or info.get("shortName") or symbol,
            "sector":           info.get("sector"),
            "industry":         info.get("industry"),
            "market":           market,
            "price":            price,
            "change_pct":       change_pct,
            "volume":           safe_int(getattr(fi, "last_volume", None)),
            "market_cap":       safe_int(info.get("marketCap")),
            "avg_volume":       safe_int(info.get("averageVolume")),
            "pe_trailing":      safe_float(info.get("trailingPE")),
            "pe_forward":       safe_float(info.get("forwardPE")),
            "pb_ratio":         safe_float(info.get("priceToBook")),
            "ps_ratio":         safe_float(info.get("priceToSalesTrailing12Months")),
            "peg_ratio":        safe_float(info.get("pegRatio")),
            "ev_ebitda":        safe_float(info.get("enterpriseToEbitda")),
            "profit_margin":    safe_float(info.get("profitMargins")),
            "gross_margin":     safe_float(info.get("grossMargins")),
            "operating_margin": safe_float(info.get("operatingMargins")),
            "roe":              safe_float(info.get("returnOnEquity")),
            "roa":              safe_float(info.get("returnOnAssets")),
            "revenue_growth":   safe_float(info.get("revenueGrowth")),
            "earnings_growth":  safe_float(info.get("earningsGrowth")),
            "beta":             safe_float(info.get("beta")),
            "dividend_yield":   safe_float(info.get("dividendYield")),
            "week52_high":      safe_float(info.get("fiftyTwoWeekHigh")),
            "week52_low":       safe_float(info.get("fiftyTwoWeekLow")),
            "ma50":             safe_float(info.get("fiftyDayAverage")),
            "ma200":            safe_float(info.get("twoHundredDayAverage")),
            "rsi":              rsi,
            "eps_trailing":     safe_float(info.get("trailingEps")),
            "eps_forward":      safe_float(info.get("forwardEps")),
        }
    except Exception:
        return None


@router.post("/run")
def run_screener(filters: ScreenerFilters):
    """Run screener against universe with given filters."""
    market   = filters.market.upper()
    universe = filters.symbols or (NSE_UNIVERSE if market == "NSE" else US_UNIVERSE)

    # Check screener cache
    import json
    cache_key = json.dumps(filters.model_dump(), sort_keys=True, default=str)
    cached = cache.get("screener", cache_key)
    if cached:
        return {**cached, "cached": True}

    # Only fetch RSI if RSI filter is actually being used
    include_rsi = (filters.min_rsi is not None or filters.max_rsi is not None)

    # Parallel fetch — 20 workers, ~6x faster than sequential
    raw: list[dict | None] = [None] * len(universe)
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {
            pool.submit(_fetch_stock_data, sym, market, include_rsi): i
            for i, sym in enumerate(universe)
        }
        for future in as_completed(futures):
            idx = futures[future]
            try:
                raw[idx] = future.result(timeout=15)
            except Exception:
                raw[idx] = None

    results = [d for d in raw if d and _passes(d, filters)]

    # Sort
    def sort_key(r):
        v = r.get(filters.sort_by)
        return (v is None, v if v is not None else 0)

    results.sort(key=sort_key, reverse=not filters.sort_asc)
    results = results[:filters.limit]

    out = {
        "results": results,
        "count":   len(results),
        "total_screened": len(universe),
        "market":  market,
        "filters": filters.model_dump(),
    }

    cache.set("screener", cache_key, out)
    return {**out, "cached": False}


@router.get("/universe")
def get_universe(market: str = "US"):
    """Return the default symbol universe for a market."""
    m = market.upper()
    if m == "NSE":
        return {"market": "NSE", "symbols": NSE_UNIVERSE, "count": len(NSE_UNIVERSE)}
    return {"market": "US", "symbols": US_UNIVERSE, "count": len(US_UNIVERSE)}

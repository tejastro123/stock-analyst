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


def _sanitize(obj):
    """Recursively convert all numpy types to native Python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return None if (np.isnan(obj) or np.isinf(obj)) else float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

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

    # New Fundamental fields
    max_debt_to_equity:  Optional[float] = None
    min_current_ratio:   Optional[float] = None
    min_quick_ratio:     Optional[float] = None
    min_eps_growth:      Optional[float] = None
    min_fcf_yield:       Optional[float] = None
    max_payout_ratio:    Optional[float] = None

    # New Technical / Momentum / Breakouts fields
    golden_cross:        Optional[bool] = None
    death_cross:         Optional[bool] = None
    macd_bullish_cross:  Optional[bool] = None
    macd_bearish_cross:  Optional[bool] = None
    volume_spike:        Optional[bool] = None
    price_breakout_52w:  Optional[bool] = None
    relative_strength:   Optional[float] = None
    above_upper_bb:      Optional[bool] = None
    below_lower_bb:      Optional[bool] = None
    min_adx:             Optional[float] = None

    # New AI / Sentiment/ Risk fields
    min_ai_sentiment:    Optional[float] = None
    max_ai_risk:         Optional[float] = None
    min_ai_prediction:   Optional[float] = None

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

    # New Fundamental filters
    if f.max_debt_to_equity is not None and row.get("debt_to_equity") is not None:
        if row["debt_to_equity"] > f.max_debt_to_equity: return False
    if f.min_current_ratio is not None and row.get("current_ratio") is not None:
        if row["current_ratio"] < f.min_current_ratio: return False
    if f.min_quick_ratio is not None and row.get("quick_ratio") is not None:
        if row["quick_ratio"] < f.min_quick_ratio: return False
    if f.min_eps_growth is not None and row.get("eps_growth") is not None:
        if row["eps_growth"] < f.min_eps_growth: return False
    if f.min_fcf_yield is not None and row.get("fcf_yield") is not None:
        if row["fcf_yield"] < f.min_fcf_yield: return False
    if f.max_payout_ratio is not None and row.get("payout_ratio") is not None:
        if row["payout_ratio"] > f.max_payout_ratio: return False

    # New Technical/Momentum filters
    if f.golden_cross is not None and row.get("golden_cross") is not None:
        if row["golden_cross"] != f.golden_cross: return False
    if f.death_cross is not None and row.get("death_cross") is not None:
        if row["death_cross"] != f.death_cross: return False
    if f.macd_bullish_cross is not None and row.get("macd_bullish_cross") is not None:
        if row["macd_bullish_cross"] != f.macd_bullish_cross: return False
    if f.macd_bearish_cross is not None and row.get("macd_bearish_cross") is not None:
        if row["macd_bearish_cross"] != f.macd_bearish_cross: return False
    if f.volume_spike is not None and row.get("volume_spike") is not None:
        if row["volume_spike"] != f.volume_spike: return False
    if f.price_breakout_52w is not None and row.get("price_breakout_52w") is not None:
        if row["price_breakout_52w"] != f.price_breakout_52w: return False
    if f.relative_strength is not None and row.get("relative_strength") is not None:
        if row["relative_strength"] < f.relative_strength: return False
    if f.above_upper_bb is not None and row.get("above_upper_bb") is not None:
        if row["above_upper_bb"] != f.above_upper_bb: return False
    if f.below_lower_bb is not None and row.get("below_lower_bb") is not None:
        if row["below_lower_bb"] != f.below_lower_bb: return False
    if f.min_adx is not None and row.get("adx") is not None:
        if row["adx"] < f.min_adx: return False

    # New AI filters
    if f.min_ai_sentiment is not None and row.get("ai_sentiment") is not None:
        if row["ai_sentiment"] < f.min_ai_sentiment: return False
    if f.max_ai_risk is not None and row.get("ai_risk") is not None:
        if row["ai_risk"] > f.max_ai_risk: return False
    if f.min_ai_prediction is not None and row.get("ai_prediction") is not None:
        if row["ai_prediction"] < f.min_ai_prediction: return False

    return True


def _fetch_stock_data(symbol: str, market: str, include_history: bool = False) -> dict | None:
    """Fetch all screener fields for a symbol. History is optional for Technical/MACD signals."""
    from utils import normalize_symbol
    yf_sym = normalize_symbol(symbol, market)
    try:
        t = yf.Ticker(yf_sym)
        info = t.info
        fi   = t.fast_info

        price       = safe_float(getattr(fi, "last_price", None))
        prev_close  = safe_float(getattr(fi, "previous_close", None))
        change_pct  = round(((price - prev_close) / prev_close) * 100, 2) if price and prev_close else None

        # History-based indicators
        rsi = None
        macd_bullish_cross = False
        macd_bearish_cross = False
        above_upper_bb = False
        below_lower_bb = False
        adx_val = None
        
        if include_history:
            try:
                hist = t.history(period="2mo", interval="1d", auto_adjust=True)
                if not hist.empty:
                    closes_list = hist["Close"].dropna().tolist()
                    highs_list = hist["High"].dropna().tolist()
                    lows_list = hist["Low"].dropna().tolist()
                    
                    rsi = calculate_rsi(closes_list)
                    
                    # Compute MACD
                    if len(closes_list) >= 26:
                        def calc_ema(data, period):
                            alpha = 2 / (period + 1)
                            res = [data[0]]
                            for val in data[1:]:
                                res.append(val * alpha + res[-1] * (1 - alpha))
                            return res
                        ema12 = calc_ema(closes_list, 12)
                        ema26 = calc_ema(closes_list, 26)
                        macd_line = [e12 - e26 for e12, e26 in zip(ema12, ema26)]
                        sig_line = calc_ema(macd_line, 9)
                        
                        # Crossover in the last 3 trading sessions
                        for idx_cross in range(-3, 0):
                            if idx_cross >= -len(macd_line) + 1:
                                pm = macd_line[idx_cross - 1]
                                ps = sig_line[idx_cross - 1]
                                cm = macd_line[idx_cross]
                                cs = sig_line[idx_cross]
                                if pm <= ps and cm > cs:
                                    macd_bullish_cross = True
                                if pm >= ps and cm < cs:
                                    macd_bearish_cross = True
                                    
                    # Compute Bollinger Bands
                    if len(closes_list) >= 20:
                        recent_closes = closes_list[-20:]
                        ma20 = np.mean(recent_closes)
                        std20 = np.std(recent_closes)
                        upper_bb = ma20 + 2.0 * std20
                        lower_bb = ma20 - 2.0 * std20
                        if price:
                            above_upper_bb = bool(price > upper_bb)
                            below_lower_bb = bool(price < lower_bb)
                            
                    # Compute ADX
                    if len(closes_list) >= 14:
                        up_moves = [highs_list[idx] - highs_list[idx-1] for idx in range(-14, 0)]
                        down_moves = [lows_list[idx-1] - lows_list[idx] for idx in range(-14, 0)]
                        pos_di = sum([max(m, 0) for m in up_moves])
                        neg_di = sum([max(m, 0) for m in down_moves])
                        total_di = pos_di + neg_di + 1e-6
                        dx = abs(pos_di - neg_di) / total_di * 100
                        adx_val = float(max(10.0, min(80.0, dx + 15.0)))
            except Exception:
                pass

        # Volumes
        volume = safe_int(getattr(fi, "last_volume", None))
        avg_vol = safe_int(info.get("averageVolume"))
        volume_spike = bool(volume > avg_vol * 2.0) if volume and avg_vol else False

        # 52-week High breakout
        w52h = safe_float(info.get("fiftyTwoWeekHigh"))
        price_breakout_52w = bool(price >= w52h * 0.98) if price and w52h else False

        # Golden cross & Death cross (50MA vs 200MA)
        ma50 = safe_float(info.get("fiftyDayAverage"))
        ma200 = safe_float(info.get("twoHundredDayAverage"))
        golden_cross = bool(ma50 > ma200) if ma50 and ma200 else False
        death_cross = bool(ma50 < ma200) if ma50 and ma200 else False

        # Relative Strength
        beta = safe_float(info.get("beta")) or 1.0
        relative_strength = safe_float(info.get("threeYearAverageReturn")) or (beta * 10.0)

        # AI sentiment
        rec = info.get("recommendationKey", "hold")
        rec_map = {"strong_buy": 90.0, "buy": 80.0, "hold": 50.0, "underperform": 30.0, "sell": 15.0}
        ai_sentiment = rec_map.get(rec.lower().replace(" ", "_"), 50.0) + (change_pct or 0.0)
        ai_sentiment = float(max(5.0, min(95.0, ai_sentiment)))

        # AI risk score
        de_ratio = safe_float(info.get("debtToEquity")) or 50.0
        ai_risk = float(max(10.0, min(95.0, (beta * 40.0) + (de_ratio / 4.0))))

        # AI prediction score
        pm_val = safe_float(info.get("profitMargins")) or 0.1
        rev_g = safe_float(info.get("revenueGrowth")) or 0.05
        ai_prediction = float(max(15.0, min(98.0, 60.0 + (pm_val * 100.0) + (rev_g * 100.0))))
        
        # Fundamentals
        fcf = safe_float(info.get("freeCashflow"))
        market_cap = safe_int(info.get("marketCap"))
        fcf_yield = float(fcf / market_cap) if fcf and market_cap else None
        payout_ratio = safe_float(info.get("payoutRatio"))

        result = {
            "symbol":           symbol.upper(),
            "name":             info.get("longName") or info.get("shortName") or symbol,
            "sector":           info.get("sector"),
            "industry":         info.get("industry"),
            "market":           market,
            "price":            price,
            "change_pct":       change_pct,
            "volume":           volume,
            "market_cap":       market_cap,
            "avg_volume":       avg_vol,
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
            "beta":             beta,
            "dividend_yield":   safe_float(info.get("dividendYield")),
            "week52_high":      w52h,
            "week52_low":       safe_float(info.get("fiftyTwoWeekLow")),
            "ma50":             ma50,
            "ma200":            ma200,
            "rsi":              rsi,
            "eps_trailing":     safe_float(info.get("trailingEps")),
            "eps_forward":      safe_float(info.get("forwardEps")),
            "debt_to_equity":   de_ratio,
            "current_ratio":    safe_float(info.get("currentRatio")),
            "quick_ratio":      safe_float(info.get("quickRatio")),
            "eps_growth":       safe_float(info.get("earningsGrowth")),
            "golden_cross":     bool(golden_cross),
            "death_cross":      bool(death_cross),
            "macd_bullish_cross": bool(macd_bullish_cross),
            "macd_bearish_cross": bool(macd_bearish_cross),
            "volume_spike":     bool(volume_spike),
            "price_breakout_52w": bool(price_breakout_52w),
            "relative_strength": relative_strength,
            "ai_sentiment":     ai_sentiment,
            "ai_risk":          ai_risk,
            "ai_prediction":    ai_prediction,
            "fcf_yield":        fcf_yield,
            "payout_ratio":     payout_ratio,
            "above_upper_bb":   bool(above_upper_bb),
            "below_lower_bb":   bool(below_lower_bb),
            "adx":              adx_val,
        }
        return _sanitize(result)
    except Exception:
        return None


@router.post("/run")
def run_screener(filters: ScreenerFilters):
    """Run screener against universe with given filters."""
    market   = filters.market.upper()
    if market in ("NSE", "BSE"):
        universe = filters.symbols or NSE_UNIVERSE
    else:
        universe = filters.symbols or US_UNIVERSE

    # Check screener cache
    import json
    cache_key = json.dumps(filters.model_dump(), sort_keys=True, default=str)
    cached = cache.get("screener", cache_key)
    if cached:
        return {**cached, "cached": True}

    # Only fetch history if history-based indicators are active
    include_history = (
        filters.min_rsi is not None or 
        filters.max_rsi is not None or 
        filters.golden_cross is not None or 
        filters.death_cross is not None or
        filters.macd_bullish_cross is not None or 
        filters.macd_bearish_cross is not None or
        filters.above_upper_bb is not None or
        filters.below_lower_bb is not None or
        filters.min_adx is not None
    )

    # Parallel fetch — 20 workers, ~6x faster than sequential
    raw: list[dict | None] = [None] * len(universe)
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {
            pool.submit(_fetch_stock_data, sym, market, include_history): i
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

    out = _sanitize({
        "results": results,
        "count":   len(results),
        "total_screened": len(universe),
        "market":  market,
        "filters": filters.model_dump(),
    })

    cache.set("screener", cache_key, out)
    return {**out, "cached": False}


@router.get("/universe")
def get_universe(market: str = "US"):
    """Return the default symbol universe for a market."""
    m = market.upper()
    if m in ("NSE", "BSE"):
        return {"market": m, "symbols": NSE_UNIVERSE, "count": len(NSE_UNIVERSE)}
    return {"market": "US", "symbols": US_UNIVERSE, "count": len(US_UNIVERSE)}

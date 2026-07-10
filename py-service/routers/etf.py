from fastapi import APIRouter, Query, HTTPException
import yfinance as yf

import cache
from utils import normalize_symbol

router = APIRouter(prefix="/etf", tags=["etf"])

# ── Curated peer groups ──────────────────────────────────────────────────────
ETF_PEER_GROUPS = [
    {"name": "Broad Market / S&P 500",  "tickers": ["SPY", "VOO", "IVV", "SPLG"]},
    {"name": "Nasdaq 100",              "tickers": ["QQQ", "QQQM", "ONEQ"]},
    {"name": "Large Cap Growth",        "tickers": ["VUG", "SCHG", "IWY", "QQQ"]},
    {"name": "Dividend Income",         "tickers": ["SCHD", "VYM", "DVY", "SDY"]},
    {"name": "Technology Sector",       "tickers": ["XLK", "VGT", "IYW", "FTEC"]},
    {"name": "Financial Sector",        "tickers": ["XLF", "VFH", "FNCL"]},
    {"name": "Healthcare Sector",       "tickers": ["XLV", "VHT", "FHLC"]},
    {"name": "Energy Sector",           "tickers": ["XLE", "VDE", "FENY"]},
    {"name": "Gold / Precious Metals",  "tickers": ["GLD", "IAU", "GLDM", "SGOL"]},
    {"name": "Broad Bond / Fixed Income","tickers": ["BND", "AGG", "LQD", "IEF"]},
]

# Hardcoded expense ratios (bps / 100 = fraction) for speed — avoids extra yfinance calls
EXPENSE_RATIOS = {
    "SPY": 0.09,  "VOO": 0.03,  "IVV": 0.03,  "SPLG": 0.02,
    "QQQ": 0.20,  "QQQM": 0.15, "ONEQ": 0.21,
    "VUG": 0.04,  "SCHG": 0.04, "IWY": 0.20,
    "SCHD": 0.06, "VYM": 0.06,  "DVY": 0.38,  "SDY": 0.35,
    "XLK": 0.09,  "VGT": 0.10,  "IYW": 0.40,  "FTEC": 0.08,
    "XLF": 0.09,  "VFH": 0.10,  "FNCL": 0.08,
    "XLV": 0.09,  "VHT": 0.10,  "FHLC": 0.08,
    "XLE": 0.09,  "VDE": 0.10,  "FENY": 0.08,
    "GLD": 0.40,  "IAU": 0.25,  "GLDM": 0.10, "SGOL": 0.17,
    "BND": 0.03,  "AGG": 0.03,  "LQD": 0.14,  "IEF": 0.15,
}


def _get_peer_group(ticker: str):
    t = ticker.upper()
    for group in ETF_PEER_GROUPS:
        if t in group["tickers"]:
            peers = sorted(
                [{"ticker": p, "expense_ratio": EXPENSE_RATIOS.get(p, 0.10)} for p in group["tickers"]],
                key=lambda x: x["expense_ratio"],
            )
            return {"group_name": group["name"], "peers": peers}
    return None


def _peer_savings(ticker: str, current_ratio: float, position: float = 100_000.0):
    t = ticker.upper()
    group = _get_peer_group(t)
    if not group:
        return None
    cheapest = group["peers"][0]
    if t == cheapest["ticker"]:
        if len(group["peers"]) > 1:
            alt = group["peers"][1]
            return {
                "cheapest": True,
                "alternative_ticker": alt["ticker"],
                "basis_point_difference": round((alt["expense_ratio"] - current_ratio) * 100, 2),
                "dollar_savings": round((alt["expense_ratio"] - current_ratio) / 100.0 * position, 2),
            }
        return {"cheapest": True, "basis_point_difference": 0.0, "dollar_savings": 0.0}

    bp_diff = (current_ratio - cheapest["expense_ratio"]) * 100
    return {
        "cheapest": False,
        "cheapest_ticker": cheapest["ticker"],
        "cheapest_ratio": cheapest["expense_ratio"],
        "basis_point_difference": round(bp_diff, 2),
        "dollar_savings": round((current_ratio - cheapest["expense_ratio"]) / 100.0 * position, 2),
    }


# GET /etf/peers/{symbol}
@router.get("/peers/{symbol}")
def etf_peers(symbol: str, market: str = Query("US")):
    sym = symbol.upper()
    cache_key = f"etf_peers:{sym}"
    cached = cache.get("etf", cache_key)
    if cached:
        return {**cached, "cached": True}

    group = _get_peer_group(sym)
    if not group:
        raise HTTPException(404, f"No peer group registered for {sym}")

    # Fetch live expense ratio for the queried ETF if possible
    live_ratio = EXPENSE_RATIOS.get(sym, 0.10)
    try:
        info = yf.Ticker(normalize_symbol(sym, market)).info or {}
        live_ratio = (
            info.get("annualReportExpenseRatio")
            or info.get("feesExpensesText")
            or EXPENSE_RATIOS.get(sym, 0.10)
        )
        if isinstance(live_ratio, str):
            live_ratio = float(live_ratio.replace("%", "").strip()) / 100
    except Exception:
        pass

    savings = _peer_savings(sym, live_ratio)

    data = {
        "symbol": sym,
        "expense_ratio": live_ratio,
        **group,
        "savings": savings,
    }

    cache.set("etf", cache_key, data, ttl=3600)
    return {**data, "cached": False}


import pandas as pd
import numpy as np

def calculate_max_drawdown(prices: pd.Series) -> float:
    if prices.empty:
        return 0.0
    roll_max = prices.cummax()
    drawdowns = (prices - roll_max) / roll_max
    return float(drawdowns.min() * -100.0)

def calculate_annualized_volatility(prices: pd.Series) -> float:
    if len(prices) < 5:
        return 0.0
    daily_returns = prices.pct_change().dropna()
    daily_vol = daily_returns.std()
    return float(daily_vol * np.sqrt(252) * 100.0)

def calculate_etf_risk_score(df: pd.DataFrame, holdings: list) -> dict:
    risk_points = 0
    bullets = []
    
    ann_vol = calculate_annualized_volatility(df["Close"])
    if ann_vol >= 30.0:
        risk_points += 40
        bullets.append(f"Annualized volatility is elevated ({ann_vol:.1f}%)")
    elif ann_vol >= 15.0:
        risk_points += 25
        bullets.append(f"Annualized volatility is moderate ({ann_vol:.1f}%)")
    else:
        risk_points += 10
        bullets.append(f"Annualized volatility is conservative ({ann_vol:.1f}%)")
        
    max_dd = calculate_max_drawdown(df["Close"])
    if max_dd >= 30.0:
        risk_points += 30
        bullets.append(f"Historical maximum drawdown is high (-{max_dd:.1f}%)")
    elif max_dd >= 15.0:
        risk_points += 20
        bullets.append(f"Historical maximum drawdown is moderate (-{max_dd:.1f}%)")
    else:
        risk_points += 10
        bullets.append(f"Historical maximum drawdown is conservative (-{max_dd:.1f}%)")
        
    sorted_holdings = sorted(holdings, key=lambda x: x.get("weight", 0.0), reverse=True)
    top_5_weight = sum(h.get("weight", 0.0) for h in sorted_holdings[:5])
    
    if len(holdings) == 0:
        risk_points += 15
        bullets.append("Holdings concentration detail is not available")
    elif top_5_weight >= 45.0:
        risk_points += 30
        bullets.append(f"High concentration in top 5 holdings ({top_5_weight:.1f}%)")
    elif top_5_weight >= 20.0:
        risk_points += 20
        bullets.append(f"Moderate concentration in top 5 holdings ({top_5_weight:.1f}%)")
    else:
        risk_points += 10
        bullets.append(f"Low concentration in top 5 holdings ({top_5_weight:.1f}%)")

    score = int(risk_points)
    if score >= 75:
        classification = "Very Aggressive"
    elif score >= 55:
        classification = "Aggressive"
    elif score >= 35:
        classification = "Moderate"
    else:
        classification = "Conservative"

    return {
        "risk_score": score,
        "classification": classification,
        "annualized_volatility": ann_vol,
        "max_drawdown": max_dd,
        "top_5_concentration": top_5_weight,
        "bullets": bullets
    }


# GET /etf/details/{symbol}  — holdings + sector weights
@router.get("/details/{symbol}")
def etf_details(symbol: str, market: str = Query("US")):
    sym = symbol.upper()
    cache_key = f"etf_details:{sym}:{market}"
    cached = cache.get("etf", cache_key)
    if cached:
        return {**cached, "cached": True}

    yf_sym = normalize_symbol(sym, market)
    try:
        ticker = yf.Ticker(yf_sym)
        info = ticker.info or {}
    except Exception as e:
        raise HTTPException(502, f"yfinance error: {str(e)}")

    holdings = []
    sector_weights = {}

    try:
        fd = ticker.funds_data
        if fd is not None:
            # Top holdings
            top_h = fd.top_holdings
            if top_h is not None and not top_h.empty:
                for idx, row in top_h.iterrows():
                    w = row.get("Holding Percent") or row.get("Value") or 0.0
                    holdings.append({
                        "symbol": row.get("Symbol") or str(idx),
                        "name":   row.get("Name") or "",
                        "weight": float(w) * 100 if float(w) < 1.0 else float(w),
                    })
            # Sector weights
            sw = fd.sector_weightings
            if sw is not None:
                for k, v in sw.items():
                    label = k.replace("_", " ").title()
                    sector_weights[label] = float(v) * 100 if float(v) < 1.0 else float(v)
    except Exception:
        pass

    expense_ratio = (
        info.get("annualReportExpenseRatio")
        or info.get("feesExpensesText")
        or EXPENSE_RATIOS.get(sym, 0.10)
    )
    if isinstance(expense_ratio, str):
        try:
            expense_ratio = float(expense_ratio.replace("%", "").strip()) / 100
        except Exception:
            expense_ratio = 0.10

    etf_yield = info.get("yield") or info.get("trailingAnnualDividendYield") or 0.0

    # Fetch history for risk score calculation
    risk_profile = None
    try:
        hist = ticker.history(period="5y", interval="1d")
        if not hist.empty:
            risk_profile = calculate_etf_risk_score(hist, holdings)
    except Exception:
        pass

    data = {
        "symbol":        sym,
        "market":        market,
        "expense_ratio": expense_ratio,
        "etf_yield":     etf_yield,
        "holdings":      holdings,
        "sector_weights": sector_weights,
        "has_data":      bool(holdings or sector_weights),
        "risk_profile":   risk_profile,
    }

    cache.set("etf", cache_key, data, ttl=3600)
    return {**data, "cached": False}

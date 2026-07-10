from fastapi import APIRouter, Query, HTTPException
import yfinance as yf
import numpy as np
import pandas as pd

import cache
from utils import normalize_symbol

router = APIRouter(prefix="/signals", tags=["signals"])


def _calculate_rsi(prices: np.ndarray, period: int = 14) -> float:
    """Wilder's RSI."""
    if len(prices) < period + 1:
        return 50.0
    deltas = np.diff(prices)
    gain = np.where(deltas > 0, deltas, 0.0)
    loss = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = np.mean(gain[:period])
    avg_loss = np.mean(loss[:period])
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gain[i]) / period
        avg_loss = (avg_loss * (period - 1) + loss[i]) / period
    rs = (avg_gain / avg_loss) if avg_loss != 0 else 100.0
    return float(100 - (100 / (1 + rs)))


def _compute_scores(df: pd.DataFrame, info: dict) -> dict:
    """Port of lib/signals.py compute_scores(). Returns tech + fundamental scores 0-100."""

    # ── TECHNICAL ──────────────────────────────────────────────
    tech_score = 0
    bullets_tech = []

    close_arr = df["Close"].values.astype(float)
    last_close = float(close_arr[-1])

    # 1. Trend — 200 DMA (25 pts) + 50 DMA (15 pts)
    dma_200 = float(df["Close"].rolling(200).mean().iloc[-1]) if len(df) >= 200 else float(df["Close"].mean())
    dma_50  = float(df["Close"].rolling(50).mean().iloc[-1])  if len(df) >= 50  else float(df["Close"].mean())

    if last_close >= dma_200:
        tech_score += 25
        bullets_tech.append("Price exceeds 200-day SMA")
        trend_bucket = "Above 200DMA"
    else:
        bullets_tech.append("Price below 200-day SMA")
        trend_bucket = "Below 200DMA"

    if last_close >= dma_50:
        tech_score += 15
        bullets_tech.append("Price exceeds 50-day SMA")
    else:
        bullets_tech.append("Price below 50-day SMA")

    # 2. Momentum RSI — 30 pts
    rsi_val = _calculate_rsi(close_arr)
    if rsi_val > 70:
        tech_score += 20
        momentum_bucket = "Elevated"
        bullets_tech.append(f"RSI elevated at {rsi_val:.1f}")
    elif rsi_val >= 45:
        tech_score += 30
        momentum_bucket = "Firm"
        bullets_tech.append(f"RSI stable at {rsi_val:.1f}")
    elif rsi_val >= 30:
        tech_score += 15
        momentum_bucket = "Modest"
        bullets_tech.append(f"RSI contracting at {rsi_val:.1f}")
    else:
        tech_score += 5
        momentum_bucket = "Subdued"
        bullets_tech.append(f"RSI low at {rsi_val:.1f}")

    # 3. 52-Week Range Position — 30 pts
    high_52 = float(df["High"].max())
    low_52  = float(df["Low"].min())
    rng_52  = high_52 - low_52
    pos_ratio = ((last_close - low_52) / rng_52) if rng_52 > 0 else 0.5

    if pos_ratio >= 0.8:
        tech_score += 30
        range_bucket = "Upper boundary"
        bullets_tech.append(f"In upper {pos_ratio*100:.1f}% of 52-week range")
    elif pos_ratio >= 0.3:
        tech_score += 15
        range_bucket = "Mid-range"
        bullets_tech.append(f"Mid-range {pos_ratio*100:.1f}% of 52-week range")
    else:
        tech_score += 5
        range_bucket = "Lower boundary"
        bullets_tech.append(f"Near lower boundary {pos_ratio*100:.1f}% of 52-week range")

    # ── FUNDAMENTAL ────────────────────────────────────────────
    fund_score = 0
    bullets_fund = []

    roe    = (info.get("returnOnEquity") or 0.0) * 100.0
    margin = (info.get("profitMargins") or 0.0) * 100.0
    de     = info.get("debtToEquity")
    pe     = info.get("trailingPE")
    beta   = info.get("beta")

    # ROE — 30 pts
    if roe >= 20.0:
        fund_score += 30; roe_bucket = "High tier"
        bullets_fund.append(f"ROE high at {roe:.1f}%")
    elif roe >= 10.0:
        fund_score += 20; roe_bucket = "Moderate tier"
        bullets_fund.append(f"ROE moderate at {roe:.1f}%")
    elif roe > 0:
        fund_score += 10; roe_bucket = "Low tier"
        bullets_fund.append(f"ROE low at {roe:.1f}%")
    else:
        roe_bucket = "Negative"
        bullets_fund.append(f"ROE negative at {roe:.1f}%")

    # Profit Margin — 30 pts
    if margin >= 15.0:
        fund_score += 30
        bullets_fund.append(f"Net margin strong at {margin:.1f}%")
    elif margin >= 5.0:
        fund_score += 20
        bullets_fund.append(f"Net margin moderate at {margin:.1f}%")
    elif margin > 0:
        fund_score += 10
        bullets_fund.append(f"Net margin thin at {margin:.1f}%")
    else:
        bullets_fund.append(f"Net margin negative at {margin:.1f}%")

    # D/E — 20 pts
    if de is None:
        fund_score += 15; de_bucket = "Neutral"
        bullets_fund.append("D/E not applicable")
    elif de < 50.0:
        fund_score += 20; de_bucket = "Low leverage"
        bullets_fund.append(f"Low leverage D/E {de:.1f}")
    elif de <= 150.0:
        fund_score += 15; de_bucket = "Moderate leverage"
        bullets_fund.append(f"Moderate leverage D/E {de:.1f}")
    else:
        fund_score += 5; de_bucket = "High leverage"
        bullets_fund.append(f"High leverage D/E {de:.1f}")

    # P/E — 20 pts
    if pe is None or pe <= 0:
        fund_score += 10; pe_bucket = "Neutral"
        bullets_fund.append("P/E not available")
    elif pe < 15.0:
        fund_score += 20; pe_bucket = "Low multiple"
        bullets_fund.append(f"Low P/E multiple {pe:.1f}")
    elif pe <= 30.0:
        fund_score += 15; pe_bucket = "Moderate multiple"
        bullets_fund.append(f"Moderate P/E {pe:.1f}")
    else:
        fund_score += 5; pe_bucket = "High multiple"
        bullets_fund.append(f"High P/E {pe:.1f}")

    # Beta bucket (no score)
    if beta is None:
        beta_bucket = "Neutral"
    elif beta > 1.2:
        beta_bucket = "Higher than market"
    elif beta >= 0.8:
        beta_bucket = "In-line with market"
    else:
        beta_bucket = "Lower than market"

    return {
        "tech_score":   int(min(tech_score, 100)),
        "fund_score":   int(min(fund_score, 100)),
        "rsi":          round(rsi_val, 2),
        "dma_50":       round(dma_50, 4),
        "dma_200":      round(dma_200, 4),
        "week52_pos_pct": round(pos_ratio * 100, 1),
        "bullets_tech": bullets_tech,
        "bullets_fund": bullets_fund,
        "buckets": {
            "Trend":       trend_bucket,
            "Momentum":    momentum_bucket,
            "52W Range":   range_bucket,
            "Profitability": roe_bucket,
            "Leverage":    de_bucket,
            "Valuation":   pe_bucket,
            "Volatility":  beta_bucket,
        },
    }


@router.get("/{symbol}")
def get_signals(symbol: str, market: str = Query("US")):
    cache_key = f"{symbol.upper()}:{market}"
    cached = cache.get("signals", cache_key)
    if cached:
        return {**cached, "cached": True}

    yf_sym = normalize_symbol(symbol, market)
    try:
        ticker = yf.Ticker(yf_sym)
        df = ticker.history(period="1y", interval="1d", auto_adjust=True)
        info = ticker.info or {}
    except Exception as e:
        raise HTTPException(502, f"yfinance error: {str(e)}")

    if df is None or df.empty or len(df) < 15:
        raise HTTPException(404, f"Insufficient data for {symbol}")

    data = {
        "symbol": symbol.upper(),
        "market": market,
        **_compute_scores(df, info),
    }

    cache.set("signals", cache_key, data)
    return {**data, "cached": False}

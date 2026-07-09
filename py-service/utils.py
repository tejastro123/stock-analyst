import yfinance as yf
import pandas as pd
import numpy as np
import requests
from typing import Any

# Monkey patch requests.Session to prevent Yahoo Finance 401 Crumb errors
_orig_session_init = requests.Session.__init__
def _patched_session_init(self, *args, **kwargs):
    _orig_session_init(self, *args, **kwargs)
    self.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
requests.Session.__init__ = _patched_session_init


def safe_float(v: Any) -> float | None:
    """Convert any value to float, return None on failure."""
    if v is None:
        return None
    try:
        f = float(v)
        return None if (np.isnan(f) or np.isinf(f)) else round(f, 6)
    except (TypeError, ValueError):
        return None


def safe_int(v: Any) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def normalize_symbol(symbol: str, market: str = "US") -> str:
    """Add exchange suffix for non-US markets."""
    symbol = symbol.upper().strip()
    if market == "NSE":
        return f"{symbol}.NS" if not symbol.endswith(".NS") else symbol
    if market == "BSE":
        return f"{symbol}.BO" if not symbol.endswith(".BO") else symbol
    return symbol


def get_ticker(symbol: str, market: str = "US") -> yf.Ticker:
    return yf.Ticker(normalize_symbol(symbol, market))


def df_to_ohlcv(df: pd.DataFrame) -> list[dict]:
    """Convert yfinance OHLCV DataFrame to list of dicts for JSON."""
    if df is None or df.empty:
        return []
    df = df.reset_index()
    records = []
    for _, row in df.iterrows():
        ts = row.get("Datetime") or row.get("Date")
        records.append({
            "time":   int(pd.Timestamp(ts).timestamp()),
            "open":   safe_float(row.get("Open")),
            "high":   safe_float(row.get("High")),
            "low":    safe_float(row.get("Low")),
            "close":  safe_float(row.get("Close")),
            "volume": safe_int(row.get("Volume")),
        })
    return records


def calculate_rsi(closes: list[float], period: int = 14) -> float | None:
    """Calculate RSI from a list of closing prices."""
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(closes)):
        delta = closes[i] - closes[i - 1]
        gains.append(max(delta, 0))
        losses.append(max(-delta, 0))
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)

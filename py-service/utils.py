import yfinance as yf
import pandas as pd
import numpy as np
import requests
from typing import Any

# Well-known symbols that are exclusively listed on US exchanges.
# Appending .NS / .BO to these will cause yfinance to return empty data.
_US_ONLY_SYMBOLS = frozenset([
    'AAPL','MSFT','NVDA','GOOGL','GOOG','AMZN','TSLA','META','BRK-B','BRK-A',
    'SPY','QQQ','DIA','IWM','GLD','SLV','USO','TLT','HYG','LQD',
    'JPM','BAC','WFC','GS','MS','C','V','MA','PYPL','AXP',
    'JNJ','PFE','MRK','ABBV','UNH','CVS','AMGN','GILD','BIIB',
    'XOM','CVX','COP','SLB','HAL','MPC','VLO','PSX',
    'WMT','COST','TGT','AMZN','HD','LOW','NKE','SBUX','MCD',
    'INTC','AMD','QCOM','TXN','AVGO','MU','AMAT','LRCX','KLAC',
    'NFLX','DIS','CMCSA','T','VZ','TMUS',
    'BA','RTX','LMT','GE','HON','MMM','CAT','DE',
    'BTC-USD','ETH-USD','SOL-USD','BNB-USD','XRP-USD','ADA-USD','DOGE-USD',
    '^GSPC','^DJI','^IXIC','^VIX','^TNX','^RUT',
])

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
    """Add exchange suffix for non-US markets.
    
    If a known US-only ticker is passed with an Indian market (NSE/BSE),
    we intentionally skip the suffix so yfinance can resolve it correctly.
    """
    symbol = symbol.upper().strip()
    if symbol.startswith("^"):
        return symbol
    # If the symbol is already carrying a suffix, respect it
    if symbol.endswith(".NS") or symbol.endswith(".BO"):
        return symbol
    # Don't append Indian suffixes to well-known US-only tickers
    if symbol in _US_ONLY_SYMBOLS:
        return symbol
    if market in ("NSE", "IN"):
        return f"{symbol}.NS"
    if market == "BSE":
        return f"{symbol}.BO"
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
    return float(round(100 - (100 / (1 + rs)), 2))

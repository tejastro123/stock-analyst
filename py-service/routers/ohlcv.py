from fastapi import APIRouter, Query, HTTPException
import yfinance as yf

import cache
from utils import normalize_symbol, df_to_ohlcv

router = APIRouter(prefix="/ohlcv", tags=["ohlcv"])

VALID_PERIODS   = {"1d","5d","1mo","3mo","6mo","1y","2y","5y","10y","ytd","max"}
VALID_INTERVALS = {"1m","2m","5m","15m","30m","60m","90m","1h","1d","5d","1wk","1mo","3mo"}

# Interval → max allowed period
INTERVAL_MAX_PERIOD = {
    "1m":  "7d",  "2m":  "60d", "5m":  "60d", "15m": "60d",
    "30m": "60d", "60m": "730d","90m": "60d",  "1h":  "730d",
    "1d":  "max", "5d":  "max", "1wk": "max",  "1mo": "max", "3mo": "max",
}


@router.get("/{symbol}")
def get_ohlcv(
    symbol: str,
    market:   str = Query("US"),
    period:   str = Query("6mo"),
    interval: str = Query("1d"),
):
    if period not in VALID_PERIODS:
        raise HTTPException(400, f"Invalid period. Valid: {VALID_PERIODS}")
    if interval not in VALID_INTERVALS:
        raise HTTPException(400, f"Invalid interval. Valid: {VALID_INTERVALS}")

    cache_key = f"{symbol.upper()}:{market}:{period}:{interval}"
    cached = cache.get("ohlcv", cache_key)
    if cached:
        return {**cached, "cached": True}

    yf_sym = normalize_symbol(symbol, market)
    try:
        ticker = yf.Ticker(yf_sym)
        df = ticker.history(period=period, interval=interval, auto_adjust=True)
    except Exception as e:
        raise HTTPException(502, f"yfinance error: {str(e)}")

    if df is None or df.empty:
        raise HTTPException(404, f"No data for {symbol}")

    candles = df_to_ohlcv(df)

    # Basic stats
    closes = [c["close"] for c in candles if c["close"] is not None]
    data = {
        "symbol":   symbol.upper(),
        "market":   market,
        "period":   period,
        "interval": interval,
        "candles":  candles,
        "count":    len(candles),
        "stats": {
            "current":  closes[-1] if closes else None,
            "high":     max(closes) if closes else None,
            "low":      min(closes) if closes else None,
            "change_pct": round(((closes[-1] - closes[0]) / closes[0]) * 100, 2) if len(closes) >= 2 else None,
        },
    }

    cache.set("ohlcv", cache_key, data)
    return {**data, "cached": False}

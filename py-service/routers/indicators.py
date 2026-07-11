import yfinance as yf
import pandas as pd
import numpy as np
from fastapi import APIRouter, Query, HTTPException
from utils import normalize_symbol
import cache

router = APIRouter(prefix="/indicators", tags=["indicators"])

def compute_sma(close: pd.Series, period: int = 20) -> pd.Series:
    return close.rolling(window=period).mean()

def compute_ema(close: pd.Series, period: int = 20) -> pd.Series:
    return close.ewm(span=period, adjust=False).mean()

def compute_wma(series: pd.Series, period: int) -> pd.Series:
    weights = np.arange(1, period + 1)
    return series.rolling(period).apply(lambda w: np.dot(w, weights) / weights.sum(), raw=True)

def compute_hma(close: pd.Series, period: int = 20) -> pd.Series:
    half_wma = compute_wma(close, int(period / 2))
    full_wma = compute_wma(close, period)
    diff = 2 * half_wma - full_wma
    return compute_wma(diff, int(np.sqrt(period)))

def compute_vwma(close: pd.Series, volume: pd.Series, period: int = 20) -> pd.Series:
    pv = close * volume
    sum_pv = pv.rolling(window=period).sum()
    sum_vol = volume.rolling(window=period).sum()
    return sum_pv / (sum_vol + 1e-10)

def compute_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    fast_ema = compute_ema(close, fast)
    slow_ema = compute_ema(close, slow)
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    rs = avg_gain / (avg_loss + 1e-10)
    return 100 - (100 / (1 + rs))

def compute_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def compute_cci(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 20) -> pd.Series:
    tp = (high + low + close) / 3.0
    sma_tp = tp.rolling(window=period).mean()
    mean_dev = tp.rolling(window=period).apply(lambda x: np.mean(np.abs(x - np.mean(x))), raw=True)
    return (tp - sma_tp) / (0.015 * mean_dev + 1e-10)

def compute_roc(close: pd.Series, period: int = 12) -> pd.Series:
    return ((close - close.shift(period)) / (close.shift(period) + 1e-10)) * 100.0

def compute_obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    obv = np.zeros(len(close))
    obv[0] = volume.iloc[0]
    for i in range(1, len(close)):
        if close.iloc[i] > close.iloc[i-1]:
            obv[i] = obv[i-1] + volume.iloc[i]
        elif close.iloc[i] < close.iloc[i-1]:
            obv[i] = obv[i-1] - volume.iloc[i]
        else:
            obv[i] = obv[i-1]
    return pd.Series(obv, index=close.index)

def compute_vwap(high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series) -> pd.Series:
    typical_price = (high + low + close) / 3.0
    pv = typical_price * volume
    return pv.cumsum() / (volume.cumsum() + 1e-10)

def compute_supertrend(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 10, multiplier: float = 3.0):
    atr = compute_atr(high, low, close, period)
    hl2 = (high + low) / 2.0
    upper_band = hl2 + multiplier * atr
    lower_band = hl2 - multiplier * atr
    
    upper_list = upper_band.tolist()
    lower_list = lower_band.tolist()
    close_list = close.tolist()
    
    supertrend = [0.0] * len(close)
    in_trend = [-1] * len(close)
    
    supertrend[0] = upper_list[0]
    
    for i in range(1, len(close)):
        curr_upper = upper_list[i]
        curr_lower = lower_list[i]
        prev_upper = upper_list[i-1]
        prev_lower = lower_list[i-1]
        prev_close = close_list[i-1]
        curr_close = close_list[i]
        
        if curr_upper < prev_upper or prev_close > prev_upper:
            upper_list[i] = curr_upper
        else:
            upper_list[i] = prev_upper
            
        if curr_lower > prev_lower or prev_close < prev_lower:
            lower_list[i] = curr_lower
        else:
            lower_list[i] = prev_lower
            
        if in_trend[i-1] == -1 and curr_close > upper_list[i]:
            in_trend[i] = 1
            supertrend[i] = lower_list[i]
        elif in_trend[i-1] == 1 and curr_close < lower_list[i]:
            in_trend[i] = -1
            supertrend[i] = upper_list[i]
        else:
            in_trend[i] = in_trend[i-1]
            if in_trend[i] == 1:
                supertrend[i] = lower_list[i]
            else:
                supertrend[i] = upper_list[i]
                
    return pd.Series(supertrend, index=close.index), pd.Series(in_trend, index=close.index)

def compute_donchian(high: pd.Series, low: pd.Series, period: int = 20):
    upper = high.rolling(window=period).max()
    lower = low.rolling(window=period).min()
    middle = (upper + lower) / 2.0
    return upper, lower, middle

def compute_keltner(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 20, atr_multiplier: float = 2.0):
    middle = compute_ema(close, period)
    atr = compute_atr(high, low, close, period)
    upper = middle + atr_multiplier * atr
    lower = middle - atr_multiplier * atr
    return upper, lower, middle

def compute_ichimoku(high: pd.Series, low: pd.Series, close: pd.Series, conversion_len: int = 9, base_len: int = 26, leading_span_b_len: int = 52, lagging_span_len: int = 26):
    tenkan = (high.rolling(window=conversion_len).max() + low.rolling(window=conversion_len).min()) / 2.0
    kijun = (high.rolling(window=base_len).max() + low.rolling(window=base_len).min()) / 2.0
    span_a = ((tenkan + kijun) / 2.0).shift(lagging_span_len)
    span_b = ((high.rolling(window=leading_span_b_len).max() + low.rolling(window=leading_span_b_len).min()) / 2.0).shift(lagging_span_len)
    chikou = close.shift(-lagging_span_len)
    return tenkan, kijun, span_a, span_b, chikou

@router.get("/{symbol}")
def get_indicators(symbol: str, market: str = Query("US")):
    cache_key = f"{symbol.upper()}:{market}"
    cached = cache.get("indicators", cache_key)
    if cached:
        return cached

    yf_sym = normalize_symbol(symbol, market)
    try:
        ticker = yf.Ticker(yf_sym)
        df = ticker.history(period="1y", interval="1d", auto_adjust=True)
    except Exception as e:
        raise HTTPException(502, f"yfinance error: {str(e)}")

    if df is None or df.empty or len(df) < 60:
        raise HTTPException(404, f"Insufficient data for {symbol} (at least 60 trading days required)")

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    close = df["Close"].astype(float)
    high = df["High"].astype(float)
    low = df["Low"].astype(float)
    vol = df["Volume"].astype(float)

    # Compute Indicators
    sma = compute_sma(close)
    ema = compute_ema(close)
    hma = compute_hma(close)
    vwma = compute_vwma(close, vol)
    macd_line, signal_line, histogram = compute_macd(close)
    rsi = compute_rsi(close)
    atr = compute_atr(high, low, close)
    cci = compute_cci(high, low, close)
    roc = compute_roc(close)
    obv = compute_obv(close, vol)
    vwap = compute_vwap(high, low, close, vol)
    st_val, st_trend = compute_supertrend(high, low, close)
    donchian_u, donchian_l, donchian_m = compute_donchian(high, low)
    keltner_u, keltner_l, keltner_m = compute_keltner(high, low, close)
    tenkan, kijun, span_a, span_b, chikou = compute_ichimoku(high, low, close)

    dates = [d.strftime("%Y-%m-%d") for d in df.index]
    
    series_data = []
    for i in range(len(df)):
        series_data.append({
            "date": dates[i],
            "close": float(close.iloc[i]),
            "sma": float(sma.iloc[i]) if not np.isnan(sma.iloc[i]) else None,
            "ema": float(ema.iloc[i]) if not np.isnan(ema.iloc[i]) else None,
            "hma": float(hma.iloc[i]) if not np.isnan(hma.iloc[i]) else None,
            "vwma": float(vwma.iloc[i]) if not np.isnan(vwma.iloc[i]) else None,
            "macd": float(macd_line.iloc[i]) if not np.isnan(macd_line.iloc[i]) else None,
            "macd_signal": float(signal_line.iloc[i]) if not np.isnan(signal_line.iloc[i]) else None,
            "rsi": float(rsi.iloc[i]) if not np.isnan(rsi.iloc[i]) else None,
            "atr": float(atr.iloc[i]) if not np.isnan(atr.iloc[i]) else None,
            "cci": float(cci.iloc[i]) if not np.isnan(cci.iloc[i]) else None,
            "roc": float(roc.iloc[i]) if not np.isnan(roc.iloc[i]) else None,
            "obv": float(obv.iloc[i]) if not np.isnan(obv.iloc[i]) else None,
            "vwap": float(vwap.iloc[i]) if not np.isnan(vwap.iloc[i]) else None,
            "supertrend": float(st_val.iloc[i]) if not np.isnan(st_val.iloc[i]) else None,
            "supertrend_trend": int(st_trend.iloc[i]) if not np.isnan(st_trend.iloc[i]) else None,
            "donchian_upper": float(donchian_u.iloc[i]) if not np.isnan(donchian_u.iloc[i]) else None,
            "donchian_lower": float(donchian_l.iloc[i]) if not np.isnan(donchian_l.iloc[i]) else None,
            "keltner_upper": float(keltner_u.iloc[i]) if not np.isnan(keltner_u.iloc[i]) else None,
            "keltner_lower": float(keltner_l.iloc[i]) if not np.isnan(keltner_l.iloc[i]) else None,
            "ichimoku_tenkan": float(tenkan.iloc[i]) if not np.isnan(tenkan.iloc[i]) else None,
            "ichimoku_kijun": float(kijun.iloc[i]) if not np.isnan(kijun.iloc[i]) else None
        })

    last_idx = -1
    current_values = {
        "price": float(close.iloc[last_idx]),
        "sma": float(sma.iloc[last_idx]) if not np.isnan(sma.iloc[last_idx]) else 0.0,
        "ema": float(ema.iloc[last_idx]) if not np.isnan(ema.iloc[last_idx]) else 0.0,
        "hma": float(hma.iloc[last_idx]) if not np.isnan(hma.iloc[last_idx]) else 0.0,
        "vwma": float(vwma.iloc[last_idx]) if not np.isnan(vwma.iloc[last_idx]) else 0.0,
        "macd": float(macd_line.iloc[last_idx]) if not np.isnan(macd_line.iloc[last_idx]) else 0.0,
        "macd_signal": float(signal_line.iloc[last_idx]) if not np.isnan(signal_line.iloc[last_idx]) else 0.0,
        "macd_hist": float(histogram.iloc[last_idx]) if not np.isnan(histogram.iloc[last_idx]) else 0.0,
        "rsi": float(rsi.iloc[last_idx]) if not np.isnan(rsi.iloc[last_idx]) else 50.0,
        "atr": float(atr.iloc[last_idx]) if not np.isnan(atr.iloc[last_idx]) else 0.0,
        "cci": float(cci.iloc[last_idx]) if not np.isnan(cci.iloc[last_idx]) else 0.0,
        "roc": float(roc.iloc[last_idx]) if not np.isnan(roc.iloc[last_idx]) else 0.0,
        "obv": float(obv.iloc[last_idx]) if not np.isnan(obv.iloc[last_idx]) else 0.0,
        "vwap": float(vwap.iloc[last_idx]) if not np.isnan(vwap.iloc[last_idx]) else 0.0,
        "supertrend": float(st_val.iloc[last_idx]) if not np.isnan(st_val.iloc[last_idx]) else 0.0,
        "supertrend_trend": "Bullish" if st_trend.iloc[last_idx] == 1 else "Bearish",
        "donchian_upper": float(donchian_u.iloc[last_idx]) if not np.isnan(donchian_u.iloc[last_idx]) else 0.0,
        "donchian_lower": float(donchian_l.iloc[last_idx]) if not np.isnan(donchian_l.iloc[last_idx]) else 0.0,
        "keltner_upper": float(keltner_u.iloc[last_idx]) if not np.isnan(keltner_u.iloc[last_idx]) else 0.0,
        "keltner_lower": float(keltner_l.iloc[last_idx]) if not np.isnan(keltner_l.iloc[last_idx]) else 0.0,
        "ichimoku_tenkan": float(tenkan.iloc[last_idx]) if not np.isnan(tenkan.iloc[last_idx]) else 0.0,
        "ichimoku_kijun": float(kijun.iloc[last_idx]) if not np.isnan(kijun.iloc[last_idx]) else 0.0
    }

    result = {
        "symbol": symbol.upper(),
        "market": market,
        "current": current_values,
        "series": series_data[-100:]
    }

    cache.set("indicators", cache_key, result)
    return result

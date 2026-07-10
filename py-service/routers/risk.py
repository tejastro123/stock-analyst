from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import yfinance as yf
import pandas as pd
import numpy as np

router = APIRouter(prefix="/risk", tags=["risk"])

class PositionInput(BaseModel):
    symbol: str
    quantity: float
    market: str = "US"

class HistoricalRiskRequest(BaseModel):
    positions: List[PositionInput]

@router.post("/historical")
def calculate_historical_risk(req: HistoricalRiskRequest):
    if not req.positions:
        return {"summary": {}, "history": []}

    symbols = [p.symbol.upper() for p in req.positions]
    quantities = {p.symbol.upper(): p.quantity for p in req.positions}

    # 1. Fetch historical prices (1 Year) one by one
    close_data = pd.DataFrame()
    for sym in symbols:
        try:
            ticker = yf.Ticker(sym)
            hist = ticker.history(period="1y", interval="1d")
            if not hist.empty:
                close_data[sym] = hist["Close"]
        except Exception as e:
            print(f"Error fetching {sym} history: {e}")

    if close_data.empty:
        raise HTTPException(status_code=404, detail="No historical data found for these symbols")

    # Fetch SPY for beta benchmark
    try:
        spy_hist = yf.Ticker("SPY").history(period="1y", interval="1d")
        spy_close = spy_hist["Close"]
    except Exception as e:
        spy_close = pd.Series()

    # Drop any missing dates
    close_data = close_data.dropna(how="all")
    
    # Align SPY close index
    if not spy_close.empty:
        # Match index timezones if one is timezone-aware and the other is not
        if close_data.index.tz is not None and spy_close.index.tz is None:
            spy_close = spy_close.tz_localize(close_data.index.tz)
        elif close_data.index.tz is None and spy_close.index.tz is not None:
            spy_close = spy_close.tz_convert(None)
        elif close_data.index.tz is not None and spy_close.index.tz is not None:
            spy_close = spy_close.tz_convert(close_data.index.tz)
            
        spy_close = spy_close.reindex(close_data.index).ffill().bfill()

    # 2. Build Daily Portfolio Value
    dates = close_data.index
    daily_val = pd.Series(0.0, index=dates)
    for sym in symbols:
        if sym in close_data.columns:
            prices = close_data[sym].ffill().bfill()
            daily_val += prices * quantities[sym]

    if daily_val.empty or daily_val.iloc[0] == 0:
        return {"summary": {}, "history": []}

    # Normalize starting value to $10,000 for relative comparison
    initial_val = daily_val.iloc[0]
    scaled_val = (daily_val / initial_val) * 10000.0

    # Daily returns
    port_returns = daily_val.pct_change().dropna()
    spy_returns = spy_close.pct_change().dropna() if not spy_close.empty else pd.Series()

    # 3. Calculate Risk Metrics
    # Rolling 30-day volatility (annualized)
    rolling_vol = port_returns.rolling(window=30).std() * np.sqrt(252) * 100.0
    rolling_vol = rolling_vol.reindex(dates).fillna(0.0)

    # Rolling 30-day Beta vs SPY
    rolling_beta = pd.Series(1.0, index=dates)
    if not spy_returns.empty and len(port_returns) > 0:
        # Align returns
        combined = pd.concat([port_returns, spy_returns], axis=1).dropna()
        combined.columns = ["port", "spy"]
        
        if len(combined) >= 30:
            cov = combined["port"].rolling(window=30).cov(combined["spy"])
            var = combined["spy"].rolling(window=30).var()
            beta = cov / (var + 1e-10)
            rolling_beta = beta.reindex(dates).ffill().fillna(1.0)

    # Max Drawdown
    running_max = scaled_val.cummax()
    drawdowns = (scaled_val - running_max) / running_max
    max_dd = float(drawdowns.min()) * 100.0

    # Sharpe Ratio
    rf_daily = 0.045 / 252
    excess = port_returns - rf_daily
    sharpe = float((excess.mean() / (port_returns.std() + 1e-10)) * np.sqrt(252)) if len(port_returns) > 0 else 0.0

    # Historical VaR (95% 1-day)
    var_95_pct = float(np.percentile(port_returns, 5)) if len(port_returns) > 0 else 0.0
    var_value_95 = float(daily_val.iloc[-1] * abs(var_95_pct))

    # Package timeseries history
    history = []
    for idx, date in enumerate(dates):
        date_str = date.strftime("%Y-%m-%d")
        history.append({
            "date": date_str,
            "value": float(scaled_val.iloc[idx]),
            "rolling_vol": float(rolling_vol.iloc[idx]),
            "rolling_beta": float(rolling_beta.iloc[idx])
        })

    return {
        "summary": {
            "initial_value": float(initial_val),
            "current_value": float(daily_val.iloc[-1]),
            "total_return": float(((daily_val.iloc[-1] - initial_val) / initial_val) * 100.0),
            "max_drawdown": max_dd,
            "sharpe_ratio": sharpe,
            "annualized_volatility": float(port_returns.std() * np.sqrt(252) * 100.0) if len(port_returns) > 0 else 0.0,
            "value_at_risk_95": var_value_95
        },
        "history": history
    }

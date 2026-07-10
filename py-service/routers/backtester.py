import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

router = APIRouter(prefix="/backtest", tags=["backtest"])

from utils import normalize_symbol

class BacktestRequest(BaseModel):
    symbol: str
    strategy: str  # 'sma' | 'rsi' | 'macd'
    start_date: str
    end_date: str
    market: Optional[str] = "NSE"
    params: Dict[str, Any] = {}

def calculate_sma_signals(df: pd.DataFrame, fast: int, slow: int) -> pd.Series:
    fast_sma = df["Close"].rolling(window=fast).mean()
    slow_sma = df["Close"].rolling(window=slow).mean()
    
    # 1 for Long, 0 for Cash
    signals = np.where(fast_sma > slow_sma, 1.0, 0.0)
    # Forward fill/shift signal to avoid lookahead bias
    return pd.Series(signals, index=df.index).shift(1).fillna(0.0)

def calculate_rsi_signals(df: pd.DataFrame, period: int, oversold: float, overbought: float) -> pd.Series:
    delta = df["Close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = gain / (loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    
    signals = np.zeros(len(df))
    position = 0.0
    for i in range(1, len(df)):
        current_rsi = rsi.iloc[i]
        if current_rsi < oversold:
            position = 1.0  # Buy/Long
        elif current_rsi > overbought:
            position = 0.0  # Sell/Cash
        signals[i] = position
        
    return pd.Series(signals, index=df.index).shift(1).fillna(0.0)

def calculate_macd_signals(df: pd.DataFrame, fast: int, slow: int, signal: int) -> pd.Series:
    exp1 = df["Close"].ewm(span=fast, adjust=False).mean()
    exp2 = df["Close"].ewm(span=slow, adjust=False).mean()
    macd = exp1 - exp2
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    
    signals = np.where(macd > signal_line, 1.0, 0.0)
    return pd.Series(signals, index=df.index).shift(1).fillna(0.0)

@router.post("/run")
def run_backtest(req: BacktestRequest):
    symbol = req.symbol.upper().strip()
    market = req.market.upper().strip() if req.market else "NSE"
    normalized_symbol = normalize_symbol(symbol, market)
    strategy = req.strategy.lower()
    
    # Fetch Data
    try:
        ticker_data = yf.download(normalized_symbol, start=req.start_date, end=req.end_date)
        if ticker_data.empty:
            raise HTTPException(status_code=404, detail=f"No market data found for symbol {normalized_symbol}")
        
        # Flatten multi-index columns if they exist (yfinance 0.2.x batch returns multi-index sometimes)
        if isinstance(ticker_data.columns, pd.MultiIndex):
            ticker_data.columns = ticker_data.columns.get_level_values(0)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch market data: {str(e)}")
    
    df = ticker_data.copy()
    
    # Calculate Strategy Signals
    if strategy == "sma":
        fast = int(req.params.get("fast_period", 50))
        slow = int(req.params.get("slow_period", 200))
        if fast >= slow:
            raise HTTPException(status_code=400, detail="Fast period must be less than slow period")
        df["Signal"] = calculate_sma_signals(df, fast, slow)
    elif strategy == "rsi":
        period = int(req.params.get("rsi_period", 14))
        oversold = float(req.params.get("oversold", 30))
        overbought = float(req.params.get("overbought", 70))
        df["Signal"] = calculate_rsi_signals(df, period, oversold, overbought)
    elif strategy == "macd":
        fast = int(req.params.get("fast_period", 12))
        slow = int(req.params.get("slow_period", 26))
        signal = int(req.params.get("signal_period", 9))
        if fast >= slow:
            raise HTTPException(status_code=400, detail="Fast period must be less than slow period")
        df["Signal"] = calculate_macd_signals(df, fast, slow, signal)
    elif strategy == "buy_hold":
        df["Signal"] = pd.Series(1.0, index=df.index)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported strategy: {strategy}")
        
    # Calculate Returns
    df["Market_Returns"] = df["Close"].pct_change()
    df["Strategy_Returns"] = df["Market_Returns"] * df["Signal"]
    
    # Cumulative returns & Equity Curve (starting at $10,000)
    initial_capital = 10000.0
    df["Equity"] = (1.0 + df["Strategy_Returns"].fillna(0.0)).cumprod() * initial_capital
    df["Market_Equity"] = (1.0 + df["Market_Returns"].fillna(0.0)).cumprod() * initial_capital
    
    # Calculate Max Drawdown
    equity = df["Equity"]
    running_max = equity.cummax()
    drawdowns = (equity - running_max) / running_max
    max_drawdown = float(drawdowns.min())
    
    # Max Drawdown Duration (consecutive days in drawdown)
    in_dd = equity < running_max
    dd_durations = []
    current_duration = 0
    for val in in_dd:
        if val:
            current_duration += 1
        else:
            if current_duration > 0:
                dd_durations.append(current_duration)
            current_duration = 0
    if current_duration > 0:
        dd_durations.append(current_duration)
    max_dd_duration = int(max(dd_durations)) if len(dd_durations) > 0 else 0

    # Calculate Sharpe & Volatility (Risk-Free = 2.0%)
    rf_daily = 0.02 / 252
    excess_returns = df["Strategy_Returns"] - rf_daily
    mean_excess = excess_returns.mean()
    std_returns = df["Strategy_Returns"].std()
    
    volatility = float(df["Strategy_Returns"].std() * np.sqrt(252))
    
    if std_returns > 0:
        sharpe_ratio = float((mean_excess / std_returns) * np.sqrt(252))
    else:
        sharpe_ratio = 0.0

    # Sortino Ratio
    downside_returns = df["Strategy_Returns"].copy()
    downside_returns[downside_returns > 0] = 0.0
    downside_std = downside_returns.std()
    if downside_std > 0:
        sortino_ratio = float((mean_excess / downside_std) * np.sqrt(252))
    else:
        sortino_ratio = 0.0

    # CAGR (Compound Annual Growth Rate)
    num_years = len(df) / 252.0
    total_return = float((equity.iloc[-1] - initial_capital) / initial_capital)
    if num_years > 0 and total_return > -1.0:
        cagr = float(((equity.iloc[-1] / initial_capital) ** (1.0 / num_years) - 1.0) * 100.0)
    else:
        cagr = total_return * 100.0

    # Calmar Ratio
    abs_max_dd = abs(max_drawdown)
    if abs_max_dd > 0:
        calmar_ratio = float((cagr / 100.0) / abs_max_dd)
    else:
        calmar_ratio = 0.0
        
    market_return = float((df["Market_Equity"].iloc[-1] - initial_capital) / initial_capital)
    
    # Extract Trades
    trades = []
    in_position = False
    entry_date = None
    entry_price = 0.0
    
    for i in range(len(df)):
        sig = df["Signal"].iloc[i]
        date_str = df.index[i].strftime("%Y-%m-%d")
        close_price = float(df["Close"].iloc[i])
        
        # Signal changes: 0 -> 1 (Buy)
        if sig == 1.0 and not in_position:
            in_position = True
            entry_date = date_str
            entry_price = close_price
            
        # Signal changes: 1 -> 0 (Sell)
        elif sig == 0.0 and in_position:
            in_position = False
            pct_return = (close_price - entry_price) / entry_price
            trades.append({
                "entry_date": entry_date,
                "exit_date": date_str,
                "entry_price": entry_price,
                "exit_price": close_price,
                "profit": float(pct_return * 100.0)
            })
            
    # Handle end of series open position
    if in_position:
        close_price = float(df["Close"].iloc[-1])
        pct_return = (close_price - entry_price) / entry_price
        trades.append({
            "entry_date": entry_date,
            "exit_date": df.index[-1].strftime("%Y-%m-%d"),
            "entry_price": entry_price,
            "exit_price": close_price,
            "profit": float(pct_return * 100.0),
            "is_open": True
        })
        
    # Win Rate and Advanced Trade Stats
    win_rate = 0.0
    profit_factor = 0.0
    avg_win = 0.0
    avg_loss = 0.0
    best_trade = 0.0
    worst_trade = 0.0
    
    if len(trades) > 0:
        profits = [t["profit"] for t in trades]
        profitable_trades = [p for p in profits if p > 0]
        losing_trades = [p for p in profits if p < 0]
        
        win_rate = float(len(profitable_trades) / len(trades))
        
        sum_gain = sum(profitable_trades)
        sum_loss = abs(sum(losing_trades))
        if sum_loss > 0:
            profit_factor = float(sum_gain / sum_loss)
        else:
            profit_factor = 999.0 if sum_gain > 0 else 1.0
            
        avg_win = float(np.mean(profitable_trades)) if len(profitable_trades) > 0 else 0.0
        avg_loss = float(np.mean(losing_trades)) if len(losing_trades) > 0 else 0.0
        best_trade = float(max(profits)) if len(profits) > 0 else 0.0
        worst_trade = float(min(profits)) if len(profits) > 0 else 0.0
        
    # Format Equity Curve for Charts
    equity_curve = []
    for i in range(len(df)):
        equity_curve.append({
            "date": df.index[i].strftime("%Y-%m-%d"),
            "strategy": float(df["Equity"].iloc[i]),
            "benchmark": float(df["Market_Equity"].iloc[i])
        })
        
    return {
        "summary": {
            "symbol": symbol,
            "strategy": strategy.upper(),
            "total_return": total_return * 100.0,
            "market_return": market_return * 100.0,
            "max_drawdown": max_drawdown * 100.0,
            "max_dd_duration": max_dd_duration,
            "sharpe_ratio": sharpe_ratio,
            "sortino_ratio": sortino_ratio,
            "calmar_ratio": calmar_ratio,
            "cagr": cagr,
            "volatility": volatility * 100.0,
            "win_rate": win_rate * 100.0,
            "trades_count": len(trades),
            "profit_factor": profit_factor,
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "best_trade": best_trade,
            "worst_trade": worst_trade
        },
        "equity_curve": equity_curve,
        "trades": trades
    }

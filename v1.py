from __future__ import annotations

import argparse
import logging
import json
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, Dict, Any, List

import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import pandas as pd
import numpy as np
import yfinance as yf


# -------------------------------------------------------
# Logging Configuration
# -------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Configuration Schema
# -------------------------------------------------------

@dataclass
class StrategyConfig:
    symbol: str = "AAPL"
    start_date: str = "2025-01-01"
    end_date: str = datetime.today().strftime("%Y-%m-%d")
    strategy_type: str = "sma_crossover"
    short_window: int = 20
    long_window: int = 50
    rsi_window: int = 14
    rsi_lower: float = 30.0
    rsi_upper: float = 70.0
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    initial_capital: float = 10000.0
    transaction_cost: float = 0.001  # 0.1% per trade
    export_path: Optional[str] = None


# -------------------------------------------------------
# Data Loader
# -------------------------------------------------------

class DataLoader:

    @staticmethod
    def fetch_data(
        symbol: str,
        start: str,
        end: str,
    ) -> pd.DataFrame:

        logger.info("Downloading %s from %s to %s...", symbol, start, end)

        try:
            data = yf.download(
                symbol,
                start=start,
                end=end,
                auto_adjust=True,
                progress=False,
            )

        except Exception as e:
            logger.exception("Download failed.")
            raise RuntimeError(f"Unable to download data: {e}")

        if data.empty:
            raise ValueError("Downloaded dataframe is empty.")

        # Clean multi-index columns if present (common in newer yfinance versions)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        # Standardize column naming to Capitalized
        data.columns = [col.capitalize() for col in data.columns]

        # Ensure Close column is present and properly mapped
        required = {"Close"}
        if not required.issubset(data.columns):
            possible_close = [c for c in data.columns if c.lower() in ("close", "adj close")]
            if possible_close:
                data = data.rename(columns={possible_close[0]: "Close"})
            else:
                raise ValueError(f"Missing required 'Close' column. Available columns: {list(data.columns)}")

        # Ensure index is DatetimeIndex
        if not isinstance(data.index, pd.DatetimeIndex):
            data.index = pd.to_datetime(data.index)

        return data


# -------------------------------------------------------
# Technical Indicators & Strategy Generators
# -------------------------------------------------------

def compute_indicators(df: pd.DataFrame, config: StrategyConfig) -> pd.DataFrame:
    """Calculates all indicators needed across all strategies."""
    df = df.copy()
    
    # 1. Moving Averages
    df["SMA_short"] = df["Close"].rolling(window=config.short_window, min_periods=1).mean()
    df["SMA_long"] = df["Close"].rolling(window=config.long_window, min_periods=1).mean()
    df["EMA_short"] = df["Close"].ewm(span=config.short_window, adjust=False).mean()
    df["EMA_long"] = df["Close"].ewm(span=config.long_window, adjust=False).mean()
    
    # 2. Wilder's RSI (Exponential Moving Average formulation)
    delta = df["Close"].diff()
    gain = delta.clip(lower=0).ewm(alpha=1/config.rsi_window, adjust=False).mean()
    loss = -delta.clip(upper=0).ewm(alpha=1/config.rsi_window, adjust=False).mean()
    rs = gain / (loss + 1e-10)
    df["RSI"] = 100 - (100 / (1 + rs))
    
    # 3. MACD (Moving Average Convergence Divergence)
    df["EMA_fast"] = df["Close"].ewm(span=config.macd_fast, adjust=False).mean()
    df["EMA_slow"] = df["Close"].ewm(span=config.macd_slow, adjust=False).mean()
    df["MACD"] = df["EMA_fast"] - df["EMA_slow"]
    df["MACD_Signal"] = df["MACD"].ewm(span=config.macd_signal, adjust=False).mean()
    df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]
    
    return df


def generate_signals(df: pd.DataFrame, config: StrategyConfig) -> pd.DataFrame:
    """Generates strategy specific Buy (1) and Sell (-1) triggers."""
    df = df.copy()
    df["Signal"] = 0
    
    if config.strategy_type == "sma_crossover":
        # Buy when short SMA crosses above long SMA
        buy = (df["SMA_short"] > df["SMA_long"]) & (df["SMA_short"].shift(1) <= df["SMA_long"].shift(1))
        # Sell when short SMA crosses below long SMA
        sell = (df["SMA_short"] < df["SMA_long"]) & (df["SMA_short"].shift(1) >= df["SMA_long"].shift(1))
        df.loc[buy, "Signal"] = 1
        df.loc[sell, "Signal"] = -1
        
    elif config.strategy_type == "ema_crossover":
        # Buy when short EMA crosses above long EMA
        buy = (df["EMA_short"] > df["EMA_long"]) & (df["EMA_short"].shift(1) <= df["EMA_long"].shift(1))
        # Sell when short EMA crosses below long EMA
        sell = (df["EMA_short"] < df["EMA_long"]) & (df["EMA_short"].shift(1) >= df["EMA_long"].shift(1))
        df.loc[buy, "Signal"] = 1
        df.loc[sell, "Signal"] = -1
        
    elif config.strategy_type == "rsi":
        # Buy when RSI crosses below oversold limit (entering oversold territory)
        buy = (df["RSI"] < config.rsi_lower) & (df["RSI"].shift(1) >= config.rsi_lower)
        # Sell when RSI crosses above overbought limit (entering overbought territory)
        sell = (df["RSI"] > config.rsi_upper) & (df["RSI"].shift(1) <= config.rsi_upper)
        df.loc[buy, "Signal"] = 1
        df.loc[sell, "Signal"] = -1
        
    elif config.strategy_type == "macd":
        # Buy when MACD line crosses above the Signal line
        buy = (df["MACD"] > df["MACD_Signal"]) & (df["MACD"].shift(1) <= df["MACD_Signal"].shift(1))
        # Sell when MACD line crosses below the Signal line
        sell = (df["MACD"] < df["MACD_Signal"]) & (df["MACD"].shift(1) >= df["MACD_Signal"].shift(1))
        df.loc[buy, "Signal"] = 1
        df.loc[sell, "Signal"] = -1
        
    else:
        raise ValueError(f"Unknown strategy type: {config.strategy_type}")
        
    return df


# -------------------------------------------------------
# Backtesting & Portfolio Engine
# -------------------------------------------------------

def run_backtest(
    df: pd.DataFrame, 
    config: StrategyConfig
) -> tuple[pd.DataFrame, list[dict[str, Any]], dict[str, Any]]:
    """Calculates position holding state, equity curve, trade logs, and metrics."""
    df = df.copy()
    
    # Initialize holding positions (0 = Out of market/Cash, 1 = Long Asset)
    positions = []
    current_position = 0
    
    for idx, row in df.iterrows():
        sig = row["Signal"]
        if sig == 1:
            current_position = 1
        elif sig == -1:
            current_position = 0
        positions.append(current_position)
        
    df["Position"] = positions
    
    # Calculate returns
    df["Market_Return"] = df["Close"].pct_change()
    
    # Strategy Return: position of day t-1 determines return on day t
    df["Strategy_Return"] = df["Position"].shift(1) * df["Market_Return"]
    df["Strategy_Return"] = df["Strategy_Return"].fillna(0.0)
    
    # Apply transaction cost upon any position changes (diff != 0)
    df["Trade_Trigger"] = df["Position"].diff().abs().fillna(0.0)
    df["Strategy_Return"] = df["Strategy_Return"] - (df["Trade_Trigger"] * config.transaction_cost)
    
    # Compute cumulative value / equity curve
    df["Strategy_Equity"] = config.initial_capital * (1.0 + df["Strategy_Return"]).cumprod()
    df["BuyHold_Equity"] = config.initial_capital * (1.0 + df["Market_Return"].fillna(0.0)).cumprod()
    
    # Track trade entry/exit details
    trades = []
    in_position = False
    entry_price = 0.0
    entry_date = None
    
    for idx, row in df.iterrows():
        pos = row["Position"]
        price = row["Close"]
        
        # Check transition states
        prev_pos = df["Position"].shift(1).loc[idx] if idx != df.index[0] else 0.0
        if pd.isna(prev_pos):
            prev_pos = 0.0
            
        if pos == 1 and prev_pos == 0:
            # Entry
            in_position = True
            entry_price = price
            entry_date = idx
        elif pos == 0 and prev_pos == 1:
            # Exit
            if in_position:
                pnl = (price - entry_price) / entry_price - (2 * config.transaction_cost)
                trades.append({
                    "entry_date": entry_date.strftime("%Y-%m-%d"),
                    "exit_date": idx.strftime("%Y-%m-%d"),
                    "entry_price": float(entry_price),
                    "exit_price": float(price),
                    "pnl": float(pnl),
                    "profitable": bool(pnl > 0)
                })
                in_position = False
                
    # Close any open trade on the final day for complete reporting
    if in_position:
        last_idx = df.index[-1]
        last_price = df.iloc[-1]["Close"]
        pnl = (last_price - entry_price) / entry_price - (2 * config.transaction_cost)
        trades.append({
            "entry_date": entry_date.strftime("%Y-%m-%d"),
            "exit_date": last_idx.strftime("%Y-%m-%d"),
            "entry_price": float(entry_price),
            "exit_price": float(last_price),
            "pnl": float(pnl),
            "profitable": bool(pnl > 0)
        })
        
    # Calculate performance analytics
    final_strat_value = df["Strategy_Equity"].iloc[-1]
    final_bh_value = df["BuyHold_Equity"].iloc[-1]
    
    strat_total_return = (final_strat_value - config.initial_capital) / config.initial_capital
    bh_total_return = (final_bh_value - config.initial_capital) / config.initial_capital
    
    # Sharpe Ratio (Assuming 0% risk free rate for simplicity)
    daily_returns = df["Strategy_Return"]
    if daily_returns.std() != 0:
        sharpe = (daily_returns.mean() / daily_returns.std()) * np.sqrt(252)
    else:
        sharpe = 0.0
        
    # Maximum Drawdown
    peak = df["Strategy_Equity"].cummax()
    drawdowns = (df["Strategy_Equity"] - peak) / peak
    max_dd = drawdowns.min()
    
    # Trade statistics
    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if t["profitable"])
    win_rate = (winning_trades / total_trades) if total_trades > 0 else 0.0
    avg_pnl = np.mean([t["pnl"] for t in trades]) if total_trades > 0 else 0.0
    
    metrics = {
        "initial_capital": config.initial_capital,
        "final_value": float(final_strat_value),
        "strategy_return": float(strat_total_return),
        "buy_hold_return": float(bh_total_return),
        "sharpe_ratio": float(sharpe),
        "max_drawdown": float(max_dd),
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "win_rate": float(win_rate),
        "avg_trade_pnl": float(avg_pnl)
    }
    
    return df, trades, metrics


# -------------------------------------------------------
# Plotter
# -------------------------------------------------------

class Plotter:

    @staticmethod
    def plot(
        data: pd.DataFrame,
        symbol: str,
        config: StrategyConfig,
        metrics: dict[str, Any],
        show_plot: bool = True
    ):
        # Configure professional clean styling
        plt.style.use('seaborn-v0_8-darkgrid' if 'seaborn-v0_8-darkgrid' in plt.style.available else 'default')
        
        fig = plt.figure(figsize=(16, 10))
        gs = gridspec.GridSpec(3, 1, height_ratios=[3, 1, 1.5], hspace=0.3)
        
        # Subplot 1: Price and Signals
        ax1 = fig.add_subplot(gs[0])
        ax1.plot(data.index, data["Close"], label="Close Price", color="#1f77b4", linewidth=2)
        
        # Overlay moving averages if applicable
        if config.strategy_type == "sma_crossover":
            ax1.plot(data.index, data["SMA_short"], label=f"{config.short_window}-day SMA", color="#ff7f0e", linestyle="--")
            ax1.plot(data.index, data["SMA_long"], label=f"{config.long_window}-day SMA", color="#2ca02c", linestyle="--")
        elif config.strategy_type == "ema_crossover":
            ax1.plot(data.index, data["EMA_short"], label=f"{config.short_window}-day EMA", color="#ff7f0e", linestyle="--")
            ax1.plot(data.index, data["EMA_long"], label=f"{config.long_window}-day EMA", color="#2ca02c", linestyle="--")
            
        # Draw Buy/Sell triggers
        buys = data[data["Signal"] == 1]
        sells = data[data["Signal"] == -1]
        
        ax1.scatter(buys.index, buys["Close"], marker="^", s=150, color="#2ca02c", label="Buy Trigger", zorder=5)
        ax1.scatter(sells.index, sells["Close"], marker="v", s=150, color="#d62728", label="Sell Trigger", zorder=5)
        
        ax1.set_title(f"{symbol} Stock Price & Strategy Signals ({config.strategy_type.upper()})", fontsize=14, fontweight="bold")
        ax1.set_ylabel("Price (USD)", fontsize=12)
        ax1.legend(loc="upper left")
        ax1.grid(True, alpha=0.3)
        
        # Subplot 2: Indicators (RSI, MACD, or Volume)
        ax2 = fig.add_subplot(gs[1], sharex=ax1)
        
        if config.strategy_type == "rsi":
            ax2.plot(data.index, data["RSI"], color="#9467bd", label="RSI")
            ax2.axhline(config.rsi_upper, color="#d62728", linestyle=":", alpha=0.7, label=f"Overbought ({config.rsi_upper})")
            ax2.axhline(config.rsi_lower, color="#2ca02c", linestyle=":", alpha=0.7, label=f"Oversold ({config.rsi_lower})")
            ax2.fill_between(data.index, config.rsi_lower, config.rsi_upper, color="#9467bd", alpha=0.1)
            ax2.set_ylabel("RSI", fontsize=12)
            ax2.set_ylim(10, 90)
            ax2.legend(loc="upper left")
            ax2.set_title("Relative Strength Index (RSI)", fontsize=11, fontweight="bold", loc="left")
            
        elif config.strategy_type == "macd":
            ax2.plot(data.index, data["MACD"], color="#1f77b4", label="MACD")
            ax2.plot(data.index, data["MACD_Signal"], color="#ff7f0e", label="Signal")
            # Draw color-coded MACD Histogram
            colors = ["#2ca02c" if val >= 0 else "#d62728" for val in data["MACD_Hist"]]
            ax2.bar(data.index, data["MACD_Hist"], color=colors, alpha=0.5, label="Histogram")
            ax2.set_ylabel("MACD", fontsize=12)
            ax2.legend(loc="upper left")
            ax2.set_title("MACD & Signal", fontsize=11, fontweight="bold", loc="left")
            
        else:
            # Volume Subplot for MAs
            if "Volume" in data.columns:
                ax2.bar(data.index, data["Volume"], color="#7f7f7f", alpha=0.5, label="Volume")
                ax2.set_ylabel("Volume", fontsize=12)
                ax2.legend(loc="upper left")
                ax2.set_title("Trading Volume", fontsize=11, fontweight="bold", loc="left")
                
        ax2.grid(True, alpha=0.3)
        
        # Subplot 3: Equity curve comparison
        ax3 = fig.add_subplot(gs[2], sharex=ax1)
        ax3.plot(data.index, data["Strategy_Equity"], label=f"Strategy (Return: {metrics['strategy_return']*100:.2f}%)", color="#2ca02c", linewidth=2.5)
        ax3.plot(data.index, data["BuyHold_Equity"], label=f"Buy & Hold (Return: {metrics['buy_hold_return']*100:.2f}%)", color="#7f7f7f", linestyle="--", linewidth=1.5)
        ax3.set_ylabel("Portfolio Value ($)", fontsize=12)
        ax3.set_xlabel("Date", fontsize=12)
        ax3.legend(loc="upper left")
        ax3.grid(True, alpha=0.3)
        ax3.set_title(f"Equity Curve (Initial: ${metrics['initial_capital']:,})", fontsize=11, fontweight="bold", loc="left")
        
        plt.tight_layout()
        
        if config.export_path:
            plot_file = f"{config.export_path}_chart.png"
            plt.savefig(plot_file, dpi=300)
            logger.info("Saved backtest chart to %s", plot_file)
            
        if show_plot:
            plt.show()
        else:
            plt.close(fig)


# -------------------------------------------------------
# Reporting & File Exports
# -------------------------------------------------------

def export_results(
    data: pd.DataFrame, 
    trades: list[dict[str, Any]], 
    metrics: dict[str, Any], 
    config: StrategyConfig
):
    """Exports timeseries results (CSV), trade log (JSON), and markdown summary."""
    if not config.export_path:
        return
        
    # 1. Export backtest dataframe
    data_file = f"{config.export_path}_data.csv"
    data.to_csv(data_file)
    logger.info("Exported backtest timeseries data to %s", data_file)
    
    # 2. Export detailed trades log
    trades_file = f"{config.export_path}_trades.json"
    with open(trades_file, "w") as f:
        json.dump(trades, f, indent=4)
    logger.info("Exported trade details log to %s", trades_file)
    
    # 3. Export detailed markdown summary report
    summary_file = f"{config.export_path}_summary.md"
    
    summary_md = f"""# Strategy Backtest Summary: {config.symbol}

- **Strategy Type**: {config.strategy_type.upper()}
- **Backtest Period**: {config.start_date} to {config.end_date}
- **Initial Capital**: ${config.initial_capital:,.2f}
- **Transaction Cost**: {config.transaction_cost * 100:.2f}% per trade

## Performance Results
- **Final Portfolio Value**: ${metrics['final_value']:,.2f}
- **Strategy Total Return**: {metrics['strategy_return'] * 100:.2f}%
- **Buy & Hold Total Return**: {metrics['buy_hold_return'] * 100:.2f}%
- **Annualized Sharpe Ratio**: {metrics['sharpe_ratio']:.4f}
- **Max Drawdown**: {metrics['max_drawdown'] * 100:.2f}%

## Trade Statistics
- **Total Trades**: {metrics['total_trades']}
- **Winning Trades**: {metrics['winning_trades']}
- **Win Rate**: {metrics['win_rate'] * 100:.2f}%
- **Average Trade P&L**: {metrics['avg_trade_pnl'] * 100:.2f}%
"""
    with open(summary_file, "w") as f:
        f.write(summary_md)
    logger.info("Exported backtest markdown report to %s", summary_file)


# -------------------------------------------------------
# CLI Argument Parser
# -------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description="Advanced Quant Strategy Backtester")

    parser.add_argument(
        "--symbol",
        default="AAPL",
        help="Stock ticker symbol (e.g. AAPL, MSFT, TSLA)"
    )

    parser.add_argument(
        "--start",
        default="2025-01-01",
        help="Start date (YYYY-MM-DD)"
    )

    parser.add_argument(
        "--end",
        default=datetime.today().strftime("%Y-%m-%d"),
        help="End date (YYYY-MM-DD)"
    )
    
    parser.add_argument(
        "--strategy",
        default="sma_crossover",
        choices=["sma_crossover", "ema_crossover", "rsi", "macd"],
        help="Trading strategy to execute"
    )

    parser.add_argument(
        "--short",
        type=int,
        default=20,
        help="Short MA window (for MA crossover strategies)"
    )

    parser.add_argument(
        "--long",
        type=int,
        default=50,
        help="Long MA window (for MA crossover strategies)"
    )
    
    parser.add_argument(
        "--rsi-window",
        type=int,
        default=14,
        help="RSI lookback window"
    )
    
    parser.add_argument(
        "--rsi-low",
        type=float,
        default=30.0,
        help="RSI oversold threshold (Buy signal)"
    )
    
    parser.add_argument(
        "--rsi-high",
        type=float,
        default=70.0,
        help="RSI overbought threshold (Sell signal)"
    )
    
    parser.add_argument(
        "--macd-fast",
        type=int,
        default=12,
        help="MACD Fast EMA period"
    )
    
    parser.add_argument(
        "--macd-slow",
        type=int,
        default=26,
        help="MACD Slow EMA period"
    )
    
    parser.add_argument(
        "--macd-signal",
        type=int,
        default=9,
        help="MACD Signal line EMA period"
    )
    
    parser.add_argument(
        "--capital",
        type=float,
        default=10000.0,
        help="Initial capital in USD"
    )
    
    parser.add_argument(
        "--fee",
        type=float,
        default=0.001,
        help="Transaction cost percentage per trade (e.g. 0.001 = 0.1%%)"
    )
    
    parser.add_argument(
        "--export",
        default=None,
        help="Export prefix path for saving results (saves CSV, JSON trades, MD summary, and chart image)"
    )
    
    parser.add_argument(
        "--no-plot",
        action="store_true",
        help="Skip showing the interactive matplotlib plot window (useful for headless/automated runs)"
    )

    return parser.parse_args()


# -------------------------------------------------------
# Main Runner
# -------------------------------------------------------

def main():
    args = parse_args()

    config = StrategyConfig(
        symbol=args.symbol,
        start_date=args.start,
        end_date=args.end,
        strategy_type=args.strategy,
        short_window=args.short,
        long_window=args.long,
        rsi_window=args.rsi_window,
        rsi_lower=args.rsi_low,
        rsi_upper=args.rsi_high,
        macd_fast=args.macd_fast,
        macd_slow=args.macd_slow,
        macd_signal=args.macd_signal,
        initial_capital=args.capital,
        transaction_cost=args.fee,
        export_path=args.export,
    )

    logger.info("Initializing Quant Strategy Backtester...")
    logger.info("Configuration: %s", json.dumps({k: v for k, v in asdict(config).items() if k != "export_path"}, indent=2))

    try:
        raw_data = DataLoader.fetch_data(
            config.symbol,
            config.start_date,
            config.end_date,
        )
    except Exception as e:
        logger.error("Error fetching data: %s", e)
        return

    logger.info("Data fetched successfully. Rows: %d", len(raw_data))

    # Warn if data volume is too low for indicators
    min_required_rows = max(config.long_window, config.rsi_window, config.macd_slow)
    if len(raw_data) < min_required_rows:
        logger.warning(
            "Data length (%d) is shorter than maximum required indicator window (%d). Indicators may contain only NaNs.",
            len(raw_data), min_required_rows
        )

    # Compute technical indicators
    df_indicators = compute_indicators(raw_data, config)
    
    # Generate trading signals
    df_signals = generate_signals(df_indicators, config)
    
    # Run backtest
    result_df, trade_log, metrics = run_backtest(df_signals, config)
    
    # Log summary performance metrics
    logger.info("=========================================")
    logger.info("          BACKTEST PERFORMANCE           ")
    logger.info("=========================================")
    logger.info("Initial Capital   : $%.2f", metrics["initial_capital"])
    logger.info("Final Value       : $%.2f", metrics["final_value"])
    logger.info("Strategy Return   : %.2f%% (vs Buy & Hold: %.2f%%)", metrics["strategy_return"] * 100, metrics["buy_hold_return"] * 100)
    logger.info("Sharpe Ratio      : %.4f", metrics["sharpe_ratio"])
    logger.info("Max Drawdown      : %.2f%%", metrics["max_drawdown"] * 100)
    logger.info("-----------------------------------------")
    logger.info("Total Trades      : %d", metrics["total_trades"])
    logger.info("Winning Trades    : %d", metrics["winning_trades"])
    logger.info("Win Rate          : %.2f%%", metrics["win_rate"] * 100)
    logger.info("Avg Trade P&L     : %.2f%%", metrics["avg_trade_pnl"] * 100)
    logger.info("=========================================")
    
    # Export results if export prefix was defined
    if config.export_path:
        export_results(result_df, trade_log, metrics, config)
        
    # Plot results
    Plotter.plot(result_df, config.symbol, config, metrics, show_plot=not args.no_plot)


if __name__ == "__main__":
    main()
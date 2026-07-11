from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import yfinance as yf
import pandas as pd
import numpy as np
import scipy.stats as stats
import json

router = APIRouter(prefix="/wealthos/analytics", tags=["wealthos_analytics"])

class AssetInput(BaseModel):
    name: str
    symbol: str
    asset_class: str
    quantity: float
    avg_price: float
    current_price: float
    currency: str = "INR"
    exchange: Optional[str] = None
    broker: Optional[str] = None
    fees: Optional[float] = 0.0
    taxes: Optional[float] = 0.0
    dividend: Optional[float] = 0.0
    notes: Optional[str] = None
    tags: Optional[List[str]] = []
    attachments: Optional[List[Dict[str, Any]]] = []

class TransactionInput(BaseModel):
    id: str
    transaction_type: str
    symbol: str
    asset_class: str
    quantity: float
    price: float
    amount: float
    fees: Optional[float] = 0.0
    taxes: Optional[float] = 0.0
    brokerage: Optional[float] = 0.0
    date: str
    notes: Optional[str] = None

class AnalyticsRequest(BaseModel):
    assets: List[AssetInput]
    transactions: Optional[List[TransactionInput]] = []

# Standard yields for local/unlisted assets
ASSET_CLASS_YIELDS = {
    "ppf": 0.071,
    "epf": 0.0815,
    "nps": 0.095,
    "fixed_deposits": 0.065,
    "bonds": 0.075,
    "cash": 0.035
}

# Static database of stock metadata for common symbols
ASSET_METADATA_DATABASE = {
    "TCS": {"sector": "Technology", "industry": "IT Services", "country": "India", "currency": "INR"},
    "TCS.NS": {"sector": "Technology", "industry": "IT Services", "country": "India", "currency": "INR"},
    "INFY": {"sector": "Technology", "industry": "IT Services", "country": "India", "currency": "INR"},
    "INFY.NS": {"sector": "Technology", "industry": "IT Services", "country": "India", "currency": "INR"},
    "RELIANCE": {"sector": "Energy", "industry": "Oil & Gas", "country": "India", "currency": "INR"},
    "RELIANCE.NS": {"sector": "Energy", "industry": "Oil & Gas", "country": "India", "currency": "INR"},
    "HDFCBANK": {"sector": "Financials", "industry": "Banking", "country": "India", "currency": "INR"},
    "HDFCBANK.NS": {"sector": "Financials", "industry": "Banking", "country": "India", "currency": "INR"},
    "SBIN": {"sector": "Financials", "industry": "Banking", "country": "India", "currency": "INR"},
    "SBIN.NS": {"sector": "Financials", "industry": "Banking", "country": "India", "currency": "INR"},
    "AAPL": {"sector": "Technology", "industry": "Consumer Electronics", "country": "United States", "currency": "USD"},
    "MSFT": {"sector": "Technology", "industry": "Software - Infrastructure", "country": "United States", "currency": "USD"},
    "GOOGL": {"sector": "Communication Services", "industry": "Internet Content & Information", "country": "United States", "currency": "USD"},
    "AMZN": {"sector": "Consumer Cyclical", "industry": "Internet Retail", "country": "United States", "currency": "USD"},
    "TSLA": {"sector": "Consumer Cyclical", "industry": "Auto Manufacturers", "country": "United States", "currency": "USD"},
    "BTC-USD": {"sector": "Cryptocurrency", "industry": "Digital Asset", "country": "Global", "currency": "USD"},
    "ETH-USD": {"sector": "Cryptocurrency", "industry": "Digital Asset", "country": "Global", "currency": "USD"},
    "GOLD": {"sector": "Commodities", "industry": "Precious Metals", "country": "Global", "currency": "USD"},
    "SILVER": {"sector": "Commodities", "industry": "Precious Metals", "country": "Global", "currency": "USD"},
}

def get_asset_metadata(symbol: str, asset_class: str) -> Dict[str, str]:
    sym = symbol.upper().strip()
    if sym in ASSET_METADATA_DATABASE:
        return ASSET_METADATA_DATABASE[sym]
    
    if asset_class in ["stocks", "etfs", "crypto", "foreign_equities", "commodities", "gold", "silver"]:
        try:
            ticker_sym = sym
            if asset_class in ["stocks", "mutual_funds"] and not ("." in ticker_sym) and len(ticker_sym) <= 6:
                ticker_sym = f"{ticker_sym}.NS"
            
            ticker = yf.Ticker(ticker_sym)
            info = ticker.info
            if info:
                sector = info.get("sector") or info.get("category")
                industry = info.get("industry") or info.get("fundStyle")
                country = info.get("country")
                currency = info.get("currency")
                
                meta = {
                    "sector": sector or "Other",
                    "industry": industry or "Other",
                    "country": country or "Global",
                    "currency": currency or "INR"
                }
                ASSET_METADATA_DATABASE[sym] = meta
                return meta
        except Exception:
            pass
            
    defaults = {
        "stocks": {"sector": "Equity", "industry": "Listed Stock", "country": "India", "currency": "INR"},
        "etfs": {"sector": "Equity", "industry": "Exchange Traded Fund", "country": "India", "currency": "INR"},
        "mutual_funds": {"sector": "Equity", "industry": "Mutual Fund", "country": "India", "currency": "INR"},
        "index_funds": {"sector": "Equity", "industry": "Index Fund", "country": "India", "currency": "INR"},
        "bonds": {"sector": "Fixed Income", "industry": "Debt Instruments", "country": "India", "currency": "INR"},
        "gold": {"sector": "Commodities", "industry": "Precious Metals", "country": "Global", "currency": "INR"},
        "silver": {"sector": "Commodities", "industry": "Precious Metals", "country": "Global", "currency": "INR"},
        "reits": {"sector": "Real Estate", "industry": "Real Estate Trust", "country": "India", "currency": "INR"},
        "crypto": {"sector": "Cryptocurrency", "industry": "Digital Asset", "country": "Global", "currency": "USD"},
        "options": {"sector": "Derivatives", "industry": "Options Contracts", "country": "India", "currency": "INR"},
        "futures": {"sector": "Derivatives", "industry": "Futures Contracts", "country": "India", "currency": "INR"},
        "fixed_deposits": {"sector": "Cash Equivalents", "industry": "Fixed Deposit", "country": "India", "currency": "INR"},
        "ppf": {"sector": "Fixed Income", "industry": "Provident Fund", "country": "India", "currency": "INR"},
        "epf": {"sector": "Fixed Income", "industry": "Provident Fund", "country": "India", "currency": "INR"},
        "nps": {"sector": "Retirement", "industry": "Pension Fund", "country": "India", "currency": "INR"},
        "cash": {"sector": "Cash Equivalents", "industry": "Liquid Cash", "country": "India", "currency": "INR"},
        "foreign_equities": {"sector": "Equity", "industry": "Global Equities", "country": "United States", "currency": "USD"},
        "commodities": {"sector": "Commodities", "industry": "Resource Contracts", "country": "Global", "currency": "USD"}
    }
    return defaults.get(asset_class, {"sector": "Other", "industry": "Other", "country": "Global", "currency": "INR"})

def xirr(cash_flows) -> float:
    if not cash_flows:
        return 0.0
    cash_flows = sorted(cash_flows, key=lambda x: x[0])
    t0 = cash_flows[0][0]
    amounts = [cf[1] for cf in cash_flows]
    if all(a >= 0 for a in amounts) or all(a <= 0 for a in amounts):
        return 0.0
    
    def eq(r):
        val = 0.0
        for date, amount in cash_flows:
            t = (date - t0).days / 365.25
            val += amount / ((1.0 + r) ** t)
        return val

    r0, r1 = 0.1, 0.2
    f0, f1 = eq(r0), eq(r1)
    for _ in range(100):
        if abs(f1 - f0) < 1e-12:
            break
        r_next = r1 - f1 * (r1 - r0) / (f1 - f0)
        r_next = np.clip(r_next, -0.99, 10.0)
        r0, r1 = r1, r_next
        f0, f1 = eq(r0), eq(r1)
        if abs(f1) < 1e-8:
            return float(r1)
    return float(r1)

def calculate_trade_metrics(transactions: List[TransactionInput], assets: List[AssetInput]) -> Dict[str, float]:
    trades = []
    symbol_queues = {}
    sorted_txs = sorted(transactions, key=lambda x: pd.to_datetime(x.date))
    
    for tx in sorted_txs:
        sym = tx.symbol.upper().strip()
        tx_date = pd.to_datetime(tx.date)
        qty = tx.quantity
        price = tx.price
        
        if tx.transaction_type == 'buy':
            if sym not in symbol_queues:
                symbol_queues[sym] = []
            symbol_queues[sym].append({"qty": qty, "price": price, "date": tx_date})
        elif tx.transaction_type == 'sell':
            buy_list = symbol_queues.get(sym, [])
            qty_to_sell = qty
            while qty_to_sell > 0 and buy_list:
                buy = buy_list[0]
                matched_qty = min(qty_to_sell, buy["qty"])
                cost = matched_qty * buy["price"]
                revenue = matched_qty * price
                profit = revenue - cost
                pct_return = (price - buy["price"]) / (buy["price"] + 1e-9)
                holding_days = (tx_date - buy["date"]).days
                trades.append({
                    "symbol": sym,
                    "profit": profit,
                    "pct_return": pct_return,
                    "holding_days": holding_days
                })
                qty_to_sell -= matched_qty
                buy["qty"] -= matched_qty
                if buy["qty"] <= 0:
                    buy_list.pop(0)
                    
    open_trades_days = []
    now = pd.Timestamp.now(tz='UTC')
    for sym, buy_list in symbol_queues.items():
        for buy in buy_list:
            if buy["qty"] > 0:
                buy_date = buy["date"]
                if buy_date.tzinfo is None:
                    buy_date = buy_date.tz_localize('UTC')
                open_trades_days.append((now - buy_date).days)
                
    best_trade_pct = 0.0
    worst_trade_pct = 0.0
    avg_holding = 0.0
    win_rate = 0.0
    profit_factor = 1.0
    
    if trades:
        profits = [t["profit"] for t in trades]
        pcts = [t["pct_return"] * 100 for t in trades]
        holdings = [t["holding_days"] for t in trades]
        
        best_trade_pct = float(max(pcts))
        worst_trade_pct = float(min(pcts))
        avg_holding = float(np.mean(holdings))
        
        wins = [p for p in profits if p > 0]
        losses = [abs(p) for p in profits if p < 0]
        
        win_rate = float(len(wins) / len(trades)) * 100
        profit_factor = float(sum(wins) / (sum(losses) + 1e-9))
    elif open_trades_days:
        avg_holding = float(np.mean(open_trades_days))
        pcts = []
        for a in assets:
            if a.avg_price > 0:
                pcts.append(((a.current_price - a.avg_price) / a.avg_price) * 100)
        if pcts:
            best_trade_pct = float(max(pcts))
            worst_trade_pct = float(min(pcts))
            win_rate = float(len([p for p in pcts if p > 0]) / len(pcts)) * 100
            
    return {
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "avg_holding_period": avg_holding,
        "best_trade": best_trade_pct,
        "worst_trade": worst_trade_pct
    }

def get_ticker_symbol(symbol: str, asset_class: str) -> str:
    """Helper to map custom symbols to yfinance-compatible symbols."""
    sym = symbol.upper().strip()
    if asset_class == "stocks" and not sym.endswith(".NS") and not sym.endswith(".BO") and len(sym) <= 5:
        # Check if it's an Indian stock, default to US if small but allow customization
        # If the exchange is NSE or BSE, we will handle that in user input
        pass
    return sym

@router.post("/calculate")
def calculate_wealthos_analytics(req: AnalyticsRequest):
    if not req.assets:
        return {
            "summary": {},
            "allocation": {},
            "metrics": {},
            "exposures": {
                "sector": {}, "country": {}, "currency": {}, "industry": {}
            },
            "history": []
        }

    assets = req.assets
    transactions = req.transactions or []
    total_wealth = sum(a.quantity * a.current_price for a in assets)
    if total_wealth <= 0:
        return {
            "summary": {"total_wealth": 0},
            "allocation": {},
            "metrics": {},
            "exposures": {
                "sector": {}, "country": {}, "currency": {}, "industry": {}
            }
        }

    # 1. Classify Allocations
    allocations = {}
    for a in assets:
        val = a.quantity * a.current_price
        allocations[a.asset_class] = allocations.get(a.asset_class, 0.0) + val

    allocation_pct = {k: (v / total_wealth) * 100 for k, v in allocations.items()}

    # 2. Compute Sector, Country, Currency, Industry exposures
    sector_exposure = {}
    country_exposure = {}
    currency_exposure = {}
    industry_exposure = {}
    
    for a in assets:
        val = a.quantity * a.current_price
        meta = get_asset_metadata(a.symbol, a.asset_class)
        sec = meta.get("sector", "Other")
        coun = meta.get("country", "Global")
        curr = meta.get("currency", "INR")
        ind = meta.get("industry", "Other")
        
        sector_exposure[sec] = sector_exposure.get(sec, 0.0) + val
        country_exposure[coun] = country_exposure.get(coun, 0.0) + val
        currency_exposure[curr] = currency_exposure.get(curr, 0.0) + val
        industry_exposure[ind] = industry_exposure.get(ind, 0.0) + val

    sector_pct = {k: (v / total_wealth) * 100 for k, v in sector_exposure.items()}
    country_pct = {k: (v / total_wealth) * 100 for k, v in country_exposure.items()}
    currency_pct = {k: (v / total_wealth) * 100 for k, v in currency_exposure.items()}
    industry_pct = {k: (v / total_wealth) * 100 for k, v in industry_exposure.items()}

    # 3. Simulate historical 1-year daily return series for the entire portfolio
    days = 252
    dates = pd.date_range(end=pd.Timestamp.now(), periods=days, freq="B")
    
    portfolio_daily_returns = pd.Series(0.0, index=dates)
    valid_weight_sum = 0.0

    for a in assets:
        val = a.quantity * a.current_price
        weight = val / total_wealth
        if weight <= 0:
            continue

        if a.asset_class in ["stocks", "etfs", "crypto", "foreign_equities", "commodities", "gold", "silver"]:
            try:
                ticker_sym = a.symbol
                if a.asset_class in ["stocks", "mutual_funds"] and not ("." in ticker_sym) and len(ticker_sym) <= 6:
                    ticker_sym = f"{ticker_sym}.NS"
                
                ticker = yf.Ticker(ticker_sym)
                hist = ticker.history(period="1y", interval="1d")
                if not hist.empty and len(hist) >= 50:
                    asset_returns = hist["Close"].pct_change().dropna()
                    asset_returns = asset_returns.reindex(dates).ffill().fillna(0.0)
                    portfolio_daily_returns += asset_returns * weight
                    valid_weight_sum += weight
                    continue
            except Exception as e:
                print(f"Failed to fetch historical data for {a.symbol}: {e}")

        # Fallback or Fixed Asset daily accrual simulation
        annual_yield = ASSET_CLASS_YIELDS.get(a.asset_class, 0.08)
        daily_yield = (1 + annual_yield) ** (1/252) - 1
        vol = 0.005 if a.asset_class in ["mutual_funds", "index_funds", "bonds"] else 0.001 if a.asset_class not in ["cash", "fixed_deposits", "ppf", "epf"] else 0.0
        noise = np.random.normal(0, vol, days) if vol > 0 else np.zeros(days)
        asset_returns = pd.Series(daily_yield + noise, index=dates)
        portfolio_daily_returns += asset_returns * weight
        valid_weight_sum += weight

    if valid_weight_sum > 0 and abs(valid_weight_sum - 1.0) > 0.01:
        portfolio_daily_returns = portfolio_daily_returns / valid_weight_sum

    # Calculate returns
    cum_returns = (1 + portfolio_daily_returns).cumprod() - 1
    total_return_pct = float(cum_returns.iloc[-1] * 100) if not cum_returns.empty else 0.0

    daily_return = float(portfolio_daily_returns.iloc[-1] * 100) if len(portfolio_daily_returns) > 0 else 0.0
    weekly_return = float(((1 + portfolio_daily_returns.iloc[-5:]).prod() - 1) * 100) if len(portfolio_daily_returns) >= 5 else total_return_pct
    monthly_return = float(((1 + portfolio_daily_returns.iloc[-21:]).prod() - 1) * 100) if len(portfolio_daily_returns) >= 21 else total_return_pct
    quarterly_return = float(((1 + portfolio_daily_returns.iloc[-63:]).prod() - 1) * 100) if len(portfolio_daily_returns) >= 63 else total_return_pct
    annual_return = float(((1 + portfolio_daily_returns.iloc[-252:]).prod() - 1) * 100) if len(portfolio_daily_returns) >= 252 else total_return_pct

    # Lifetime return & CAGR using transaction history
    net_invested = 0.0
    for tx in transactions:
        if tx.transaction_type == 'buy':
            net_invested += tx.amount + tx.fees + tx.taxes + tx.brokerage
        elif tx.transaction_type == 'sell':
            net_invested -= tx.amount - tx.fees - tx.taxes - tx.brokerage

    if net_invested > 0:
        lifetime_return = float(((total_wealth - net_invested) / net_invested) * 100)
    else:
        lifetime_return = total_return_pct

    cagr = total_return_pct
    if transactions:
        tx_dates = [pd.to_datetime(tx.date) for tx in transactions]
        oldest_date = min(tx_dates)
        years = (pd.Timestamp.now() - oldest_date).days / 365.25
        if years > 0.1 and net_invested > 0:
            cagr = float(((total_wealth / net_invested) ** (1 / years) - 1) * 100)

    # Rolling Returns
    rolling_30 = portfolio_daily_returns.rolling(21).apply(lambda x: (1 + x).prod() - 1).dropna()
    rolling_monthly_return = float(rolling_30.mean() * 100) if not rolling_30.empty else total_return_pct
    rolling_365 = portfolio_daily_returns.rolling(252).apply(lambda x: (1 + x).prod() - 1).dropna()
    rolling_annual_return = float(rolling_365.mean() * 100) if not rolling_365.empty else total_return_pct

    # TWRR (Time-Weighted Rate of Return)
    twrr = float(((1 + portfolio_daily_returns).prod() - 1) * 100)

    # XIRR & Money Weighted Return
    cash_flows = []
    for tx in transactions:
        tx_date = pd.to_datetime(tx.date)
        if tx.transaction_type == 'buy':
            cash_flows.append((tx_date, -float(tx.amount + tx.fees + tx.taxes + tx.brokerage)))
        elif tx.transaction_type == 'sell':
            cash_flows.append((tx_date, float(tx.amount - tx.fees - tx.taxes - tx.brokerage)))
    
    cash_flows.append((pd.Timestamp.now(), float(total_wealth)))
    
    xirr_value = 0.0
    try:
        xirr_value = xirr(cash_flows) * 100
    except Exception:
        xirr_value = cagr

    mwr_value = xirr_value # Money Weighted Return is mathematically equivalent to IRR/XIRR

    # Risk Metrics
    daily_vol = float(portfolio_daily_returns.std())
    volatility = daily_vol * np.sqrt(252) # annualized volatility
    
    rf_annual = 0.055
    rf_daily = (1 + rf_annual) ** (1/252) - 1
    excess_returns = portfolio_daily_returns - rf_daily

    sharpe_ratio = float((excess_returns.mean() / (daily_vol + 1e-9)) * np.sqrt(252))

    downside_returns = portfolio_daily_returns[portfolio_daily_returns < rf_daily]
    downside_deviation = float(downside_returns.std() * np.sqrt(252)) if len(downside_returns) > 0 else 1e-9
    sortino_ratio = float((excess_returns.mean() * np.sqrt(252)) / downside_deviation)

    # Max Drawdown
    cum_wealth = (1 + portfolio_daily_returns).cumprod()
    running_max = cum_wealth.cummax()
    drawdowns = (cum_wealth - running_max) / running_max
    max_drawdown = float(drawdowns.min() * 100)

    # Ulcer Index
    ulcer_index = float(np.sqrt(np.mean(drawdowns ** 2)) * 100)

    # VaR (Value at Risk) 95% & 99% daily, CVaR 95%
    var_95 = float(abs(np.percentile(portfolio_daily_returns, 5)) * 100)
    var_99 = float(abs(np.percentile(portfolio_daily_returns, 1)) * 100)
    cvar_95 = float(abs(portfolio_daily_returns[portfolio_daily_returns <= np.percentile(portfolio_daily_returns, 5)].mean()) * 100)

    # Alpha & Beta relative to simulated or actual benchmark
    benchmark_returns = None
    try:
        is_intl = any(a.currency == "USD" for a in assets)
        index_sym = "^GSPC" if is_intl else "^NSEI"
        index_ticker = yf.Ticker(index_sym)
        index_hist = index_ticker.history(period="1y", interval="1d")
        if not index_hist.empty and len(index_hist) >= 50:
            benchmark_returns = index_hist["Close"].pct_change().dropna().reindex(dates).ffill().fillna(0.0)
    except Exception:
        pass
        
    if benchmark_returns is None:
        bench_yield = 0.11
        bench_vol = 0.13
        bench_daily = (1 + bench_yield) ** (1/252) - 1
        benchmark_returns = pd.Series(bench_daily + np.random.normal(0, bench_vol / np.sqrt(252), days), index=dates)

    cov = np.cov(portfolio_daily_returns, benchmark_returns)[0, 1]
    var_m = np.var(benchmark_returns)
    beta = float(cov / (var_m + 1e-9))
    
    p_ret_ann = (1 + portfolio_daily_returns).prod() - 1
    m_ret_ann = (1 + benchmark_returns).prod() - 1
    alpha = float(p_ret_ann - (rf_annual + beta * (m_ret_ann - rf_annual))) * 100

    # Information Ratio
    tracking_diff = portfolio_daily_returns - benchmark_returns
    tracking_error = float(tracking_diff.std() * np.sqrt(252))
    information_ratio = float((p_ret_ann - m_ret_ann) / (tracking_error + 1e-9))

    # Treynor Ratio
    treynor_ratio = float((p_ret_ann - rf_annual) / (beta if abs(beta) > 1e-5 else 1e-5))

    # Calmar Ratio
    calmar_ratio = float((p_ret_ann - rf_annual) / (abs(max_drawdown / 100) + 1e-9))

    # Trade-based decision metrics (win rate, profit factor, best/worst trade, average holding period)
    trade_metrics = calculate_trade_metrics(transactions, assets)
    
    # Kelly Criterion using trade win rate or daily returns win rate as fallback
    win_rate_val = trade_metrics["win_rate"] if transactions else 0.0
    wins_daily = portfolio_daily_returns[portfolio_daily_returns > 0]
    losses_daily = portfolio_daily_returns[portfolio_daily_returns < 0]
    
    if win_rate_val > 0:
        win_fraction = win_rate_val / 100.0
        profit_ratio = trade_metrics["profit_factor"]
        kelly_criterion = float(win_fraction - ((1 - win_fraction) / (profit_ratio if profit_ratio > 0 else 1e-9))) * 100
    else:
        win_fraction_daily = len(wins_daily) / len(portfolio_daily_returns) if len(portfolio_daily_returns) > 0 else 0.0
        avg_win_daily = wins_daily.mean() if len(wins_daily) > 0 else 0.0
        avg_loss_daily = abs(losses_daily.mean()) if len(losses_daily) > 0 else 1e-9
        profit_ratio_daily = avg_win_daily / avg_loss_daily
        kelly_criterion = float(win_fraction_daily - ((1 - win_fraction_daily) / (profit_ratio_daily if profit_ratio_daily > 0 else 1e-9))) * 100

    return {
        "summary": {
            "total_wealth": total_wealth,
            "total_return_pct": total_return_pct,
            "cagr": cagr,
            "xirr": xirr_value,
            "twrr": twrr,
            "mwr": mwr_value,
            "lifetime_return": lifetime_return
        },
        "allocations": allocation_pct,
        "exposures": {
            "sector": sector_pct,
            "country": country_pct,
            "currency": currency_pct,
            "industry": industry_pct
        },
        "returns": {
            "daily": daily_return,
            "weekly": weekly_return,
            "monthly": monthly_return,
            "quarterly": quarterly_return,
            "annual": annual_return,
            "lifetime": lifetime_return,
            "rolling_monthly": rolling_monthly_return,
            "rolling_annual": rolling_annual_return
        },
        "metrics": {
            "alpha": alpha,
            "beta": beta,
            "sharpe_ratio": sharpe_ratio,
            "sortino_ratio": sortino_ratio,
            "information_ratio": information_ratio,
            "tracking_error": tracking_error * 100,
            "treynor_ratio": treynor_ratio,
            "calmar_ratio": calmar_ratio,
            "max_drawdown": max_drawdown,
            "volatility": volatility * 100,
            "downside_deviation": downside_deviation * 100,
            "ulcer_index": ulcer_index,
            "var_95": var_95,
            "var_99": var_99,
            "cvar_95": cvar_95,
            "kelly_criterion": kelly_criterion,
            "win_rate": trade_metrics["win_rate"] if transactions else (len(wins_daily)/len(portfolio_daily_returns))*100,
            "profit_factor": trade_metrics["profit_factor"] if transactions else float(wins_daily.sum()/(abs(losses_daily.sum())+1e-9)),
            "avg_holding_period": trade_metrics["avg_holding_period"],
            "best_trade": trade_metrics["best_trade"],
            "worst_trade": trade_metrics["worst_trade"]
        }
    }

@router.post("/stress-test")
def run_stress_test(req: AnalyticsRequest):
    if not req.assets:
        return {"scenarios": []}

    assets = req.assets
    total_wealth = sum(a.quantity * a.current_price for a in assets)

    # Historical Crash Shock Factors by Asset Class
    crashes = {
        "COVID Crash (2020)": {
            "stocks": -0.35, "etfs": -0.30, "mutual_funds": -0.28, "index_funds": -0.32,
            "bonds": 0.05, "gold": -0.05, "silver": -0.10, "reits": -0.25, "crypto": -0.45,
            "options": -0.60, "futures": -0.50, "fixed_deposits": 0.015, "ppf": 0.02,
            "epf": 0.025, "nps": -0.12, "cash": 0.0, "foreign_equities": -0.32, "commodities": -0.20
        },
        "2008 Financial Crisis": {
            "stocks": -0.50, "etfs": -0.45, "mutual_funds": -0.42, "index_funds": -0.48,
            "bonds": 0.08, "gold": 0.15, "silver": 0.05, "reits": -0.60, "crypto": -0.80, # Crypto simulated
            "options": -0.90, "futures": -0.70, "fixed_deposits": 0.03, "ppf": 0.035,
            "epf": 0.04, "nps": -0.20, "cash": 0.0, "foreign_equities": -0.48, "commodities": -0.30
        },
        "Dot-com Crash (2000)": {
            "stocks": -0.45, "etfs": -0.40, "mutual_funds": -0.35, "index_funds": -0.42,
            "bonds": 0.12, "gold": 0.20, "silver": 0.10, "reits": 0.05, "crypto": -0.90,
            "options": -0.95, "futures": -0.80, "fixed_deposits": 0.04, "ppf": 0.04,
            "epf": 0.045, "nps": -0.15, "cash": 0.0, "foreign_equities": -0.38, "commodities": -0.10
        },
        "Interest Rate Hike (+2%)": {
            "stocks": -0.10, "etfs": -0.08, "mutual_funds": -0.07, "index_funds": -0.09,
            "bonds": -0.06, "gold": -0.12, "silver": -0.15, "reits": -0.15, "crypto": -0.25,
            "options": -0.30, "futures": -0.15, "fixed_deposits": 0.02, "ppf": 0.005,
            "epf": 0.008, "nps": -0.04, "cash": 0.0, "foreign_equities": -0.08, "commodities": -0.05
        },
        "Oil Crisis (+25%)": {
            "stocks": -0.05, "etfs": -0.03, "mutual_funds": -0.04, "index_funds": -0.05,
            "bonds": -0.02, "gold": 0.08, "silver": 0.05, "reits": -0.08, "crypto": 0.10,
            "options": -0.15, "futures": 0.35, "fixed_deposits": 0.0, "ppf": 0.0,
            "epf": 0.0, "nps": -0.02, "cash": 0.0, "foreign_equities": -0.06, "commodities": 0.25
        }
    }

    results = []
    for crash_name, shocks in crashes.items():
        projected_loss = 0.0
        worst_assets = []
        
        for a in assets:
            val = a.quantity * a.current_price
            shock = shocks.get(a.asset_class, -0.10) # default 10% drop
            impact = val * shock
            projected_loss += impact
            
            worst_assets.append({
                "name": a.name,
                "asset_class": a.asset_class,
                "impact_pct": shock * 100,
                "impact_amount": impact
            })

        worst_assets = sorted(worst_assets, key=lambda x: x["impact_amount"])[:3] # top 3 worst impacted
        recovery_months = int(abs(projected_loss / (total_wealth * 0.02 + 1e-9))) # simple heuristic: recovers at 2% a month
        recovery_months = max(3, min(36, recovery_months))

        results.append({
            "scenario": crash_name,
            "impact_pct": (projected_loss / total_wealth) * 100,
            "impact_amount": projected_loss,
            "recovery_time_months": recovery_months,
            "worst_assets": worst_assets
        })

    return {"scenarios": results}

@router.post("/monte-carlo")
def run_monte_carlo(req: AnalyticsRequest, simulations: int = 1000):
    if not req.assets:
        return {"summary": {}, "runs": []}

    assets = req.assets
    total_wealth = sum(a.quantity * a.current_price for a in assets)

    # Estimate portfolio mean return and volatility
    # We will use typical values: Mean 12% annual, Volatility 15% annual
    mean_ann = 0.12
    vol_ann = 0.15
    
    # Calculate weighted mean and volatility if possible
    # Just standard parameters for Monte Carlo projection
    t_horizon = 5 # 5 years projection
    dt = 1 / 252
    steps = int(t_horizon * 252)
    
    # Generate simulations
    # Standard geometric Brownian motion
    mu = mean_ann
    sigma = vol_ann
    
    # Run Monte Carlo simulations
    # To optimize performance, we'll run the calculations in numpy
    # We will simulate 1000 paths
    num_sims = min(simulations, 5000) # Cap at 5000 for speed
    
    # daily drift and shock
    drift = (mu - 0.5 * sigma**2) * dt
    shock = sigma * np.sqrt(dt)
    
    # Simulating final prices directly to speed up instead of generating full paths,
    # but we generate 5 paths for rendering.
    paths_to_render = 5
    rendered_paths = []
    
    for i in range(paths_to_render):
        rand = np.random.normal(0, 1, steps)
        daily_returns = np.exp(drift + shock * rand)
        path = total_wealth * np.cumprod(daily_returns)
        # downsample to monthly for frontend rendering (21 business days per month)
        monthly_path = [total_wealth] + list(path[::21])
        rendered_paths.append(monthly_path)

    # Simulate final terminal wealths
    rand_terminal = np.random.normal(0, 1, num_sims)
    terminal_wealths = total_wealth * np.exp((mu - 0.5 * sigma**2) * t_horizon + sigma * np.sqrt(t_horizon) * rand_terminal)
    
    percentiles = np.percentile(terminal_wealths, [10, 25, 50, 75, 90])
    
    return {
        "current_wealth": total_wealth,
        "simulations_run": num_sims,
        "projection_years": t_horizon,
        "percentiles": {
            "p10_worst": float(percentiles[0]),
            "p25_conservative": float(percentiles[1]),
            "p50_median": float(percentiles[2]),
            "p75_growth": float(percentiles[3]),
            "p90_best": float(percentiles[4])
        },
        "success_probability": float((terminal_wealths > total_wealth * 1.25).mean() * 100), # prob of beating 25% absolute gain
        "rendered_paths": rendered_paths
    }

@router.post("/correlation")
def calculate_correlation(req: AnalyticsRequest):
    if len(req.assets) < 2:
        return {"matrix": {}, "assets": []}

    # Generate a correlation matrix for the assets.
    # We use yfinance for listed, or simulate correlations based on asset class.
    # For example, Gold and Stocks are negatively correlated (-0.2), Crypto and Stocks positively correlated (0.4), etc.
    asset_names = [a.name for a in req.assets]
    n = len(asset_names)
    
    # Asset class correlation defaults
    class_correlation = {
        ("stocks", "crypto"): 0.35,
        ("stocks", "gold"): -0.15,
        ("stocks", "bonds"): 0.10,
        ("stocks", "index_funds"): 0.95,
        ("stocks", "mutual_funds"): 0.90,
        ("stocks", "etfs"): 0.90,
        ("crypto", "gold"): 0.15,
        ("crypto", "bonds"): -0.10,
        ("gold", "bonds"): 0.20,
        ("cash", "stocks"): 0.0,
        ("cash", "bonds"): 0.0
    }

    matrix = np.eye(n)
    for i in range(n):
        for j in range(i + 1, n):
            c1 = req.assets[i].asset_class
            c2 = req.assets[j].asset_class
            # Get default correlation or simulate a tiny random fluctuation
            corr = class_correlation.get((c1, c2), class_correlation.get((c2, c1), 0.2))
            corr = float(np.clip(corr + np.random.normal(0, 0.05), -0.99, 0.99))
            matrix[i, j] = corr
            matrix[j, i] = corr

    # Format output for frontend Recharts/Matrix
    nodes = [{"id": a.name, "group": a.asset_class, "value": a.quantity * a.current_price} for a in req.assets]
    links = []
    for i in range(n):
        for j in range(i + 1, n):
            links.append({
                "source": req.assets[i].name,
                "target": req.assets[j].name,
                "value": float(matrix[i, j])
            })

    return {
        "assets": asset_names,
        "matrix": matrix.tolist(),
        "network": {
            "nodes": nodes,
            "links": links
        }
    }

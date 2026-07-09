import yfinance as yf
import pandas as pd
import streamlit as st
from datetime import datetime, timedelta

# Core Indices (Real indices used as baseline per compliance)
INDEX_TICKERS = {
    "^GSPC": "S&P 500",
    "^NDX": "Nasdaq 100",
    "^DJI": "Dow 30",
    "^RUT": "Russell 2000",
    "^VIX": "CBOE Volatility Index",
    "^TNX": "10-Year Treasury Yield",
    "GC=F": "Gold Futures",
    "CL=F": "Crude Oil WTI",
    "BTC-USD": "Bitcoin",
    "DX-Y.NYB": "US Dollar Index"
}

# 11 SPDR Sector ETFs
SECTOR_ETFS = {
    "XLK": "Technology",
    "XLF": "Financials",
    "XLV": "Health Care",
    "XLE": "Energy",
    "XLI": "Industrials",
    "XLY": "Consumer Discretionary",
    "XLP": "Consumer Staples",
    "XLU": "Utilities",
    "XLRE": "Real Estate",
    "XLB": "Materials",
    "XLC": "Communication Services"
}

PERIOD_MAP = {
    "1D": {"period": "1d", "interval": "5m"},
    "5D": {"period": "5d", "interval": "15m"},
    "1M": {"period": "1mo", "interval": "1h"},
    "3M": {"period": "3mo", "interval": "1d"},
    "6M": {"period": "6mo", "interval": "1d"},
    "YTD": {"period": "ytd", "interval": "1d"},
    "1Y": {"period": "1y", "interval": "1d"},
    "3Y": {"period": "3y", "interval": "1d"},
    "5Y": {"period": "5y", "interval": "1d"},
    "10Y": {"period": "10y", "interval": "1d"},
    "20Y": {"period": "20y", "interval": "1d"},
    "30Y": {"period": "30y", "interval": "1d"},
    "Max": {"period": "max", "interval": "1d"}
}

@st.cache_data(ttl=60)
def get_quote(ticker: str) -> dict:
    """Gets real-time price snapshot (last price, open, high, low, volume, % change, yesterday's close)."""
    try:
        t = yf.Ticker(ticker)
        # Try fast info lookup
        info = t.info
        
        # Calculate daily change
        last_price = info.get("regularMarketPrice") or info.get("currentPrice") or info.get("navPrice")
        prev_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
        
        if last_price is None or prev_close is None:
            # Fallback: get history of last 2 days
            hist = t.history(period="2d")
            if len(hist) >= 1:
                last_price = hist["Close"].iloc[-1]
                prev_close = hist["Close"].iloc[-2] if len(hist) > 1 else hist["Open"].iloc[0]
            else:
                raise ValueError("No historical price data available")
                
        pct_change = 0.0
        if prev_close and last_price:
            pct_change = ((last_price - prev_close) / prev_close) * 100.0

        return {
            "success": True,
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName") or ticker,
            "price": last_price,
            "prev_close": prev_close,
            "pct_change": pct_change,
            "open": info.get("regularMarketOpen") or info.get("open"),
            "high": info.get("regularMarketDayHigh") or info.get("dayHigh"),
            "low": info.get("regularMarketDayLow") or info.get("dayLow"),
            "volume": info.get("regularMarketVolume") or info.get("volume"),
            "market_cap": info.get("marketCap") or 0.0,
            "pe_ratio": info.get("trailingPE") or info.get("forwardPE"),
            "beta": info.get("beta")
        }
    except Exception as e:
        return {"success": False, "error": str(e), "ticker": ticker}

@st.cache_data(ttl=300)
def get_history(ticker: str, period: str = "3M") -> pd.DataFrame:
    """Gets historical price bars for the given period (standardized mapping)."""
    p_conf = PERIOD_MAP.get(period, PERIOD_MAP["3M"])
    t = yf.Ticker(ticker)
    df = t.history(period=p_conf["period"], interval=p_conf["interval"])
    return df

@st.cache_data(ttl=60)
def get_quotes_bulk(tickers: list) -> dict:
    """Fetches quote info for a list of tickers in parallel/bulk."""
    results = {}
    for ticker in tickers:
        results[ticker] = get_quote(ticker)
    return results

@st.cache_data(ttl=300)
def get_history_bulk(tickers: list, period: str = "3M") -> dict:
    """Fetches historical price data for a list of tickers."""
    results = {}
    for ticker in tickers:
        results[ticker] = get_history(ticker, period)
    return results

@st.cache_data(ttl=300)
def is_etf(ticker: str) -> bool:
    """Returns True if the ticker is an ETF."""
    try:
        t = yf.Ticker(ticker)
        quote_type = t.info.get("quoteType", "").upper()
        return "ETF" in quote_type
    except:
        return False

@st.cache_data(ttl=300)
def get_etf_details(ticker: str) -> dict:
    """Returns ETF specific details (holdings, expense ratio, sector weightings)."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
        
        # Fetch holdings (yfinance structure can be variable, try multiple fields)
        holdings = []
        fund_holdings = t.funds_data.top_holdings if hasattr(t, 'funds_data') and t.funds_data is not None else None
        if fund_holdings is not None:
            for idx, row in fund_holdings.iterrows():
                holdings.append({
                    "symbol": row.get("Symbol") or idx,
                    "name": row.get("Name") or "",
                    "weight": (row.get("Holding Percent") or row.get("Value") or 0.0) * 100.0 if (row.get("Holding Percent") or 0.0) < 1.0 else (row.get("Holding Percent") or row.get("Value") or 0.0)
                })
        
        # Sector weights
        sector_weights = {}
        fund_sectors = t.funds_data.sector_weightings if hasattr(t, 'funds_data') and t.funds_data is not None else None
        if fund_sectors is not None:
            for k, v in fund_sectors.items():
                sector_weights[k.replace('_', ' ').title()] = v * 100.0 if v < 1.0 else v

        return {
            "success": True,
            "expense_ratio": info.get("feesExpensesText") or info.get("annualReportExpenseRatio") or 0.0,
            "holdings": holdings,
            "sector_weights": sector_weights,
            "yield": info.get("yield") or info.get("trailingAnnualDividendYield") or 0.0
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@st.cache_data(ttl=300)
def get_stock_fundamentals(ticker: str) -> dict:
    """Returns general fundamentals for a stock (valuation, profitability, etc.)."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
        return {
            "success": True,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "business_summary": info.get("longBusinessSummary"),
            "pe_trailing": info.get("trailingPE"),
            "pe_forward": info.get("forwardPE"),
            "price_to_book": info.get("priceToBook"),
            "market_cap": info.get("marketCap", 0.0),
            "dividend_yield": (info.get("dividendYield") or 0.0) * 100.0,
            "roe": (info.get("returnOnEquity") or 0.0) * 100.0,
            "profit_margin": (info.get("profitMargins") or 0.0) * 100.0,
            "debt_to_equity": info.get("debtToEquity"),
            "beta": info.get("beta")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

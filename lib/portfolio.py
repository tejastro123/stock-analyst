import os
import json
import streamlit as st
from pathlib import Path
from .market_data import get_quote, get_stock_fundamentals, is_etf, get_etf_details

LIB_DIR = Path(__file__).parent
BASE_DIR = LIB_DIR.parent
DATA_DIR = BASE_DIR / "data"
PORTFOLIO_FILE = DATA_DIR / "portfolio.json"

DEFAULT_HOLDINGS = [
    {"ticker": "AAPL", "shares": 100.0, "cost_basis": 175.0},
    {"ticker": "MSFT", "shares": 50.0, "cost_basis": 350.0},
    {"ticker": "SPY", "shares": 80.0, "cost_basis": 450.0},
    {"ticker": "QQQ", "shares": 40.0, "cost_basis": 380.0}
]

def load_portfolio() -> list:
    """Loads holdings from data/portfolio.json, initializing default values if missing."""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not PORTFOLIO_FILE.exists():
        save_portfolio(DEFAULT_HOLDINGS)
        return DEFAULT_HOLDINGS
        
    try:
        with open(PORTFOLIO_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_HOLDINGS

def save_portfolio(holdings: list):
    """Saves the holdings list to data/portfolio.json."""
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        with open(PORTFOLIO_FILE, "w") as f:
            json.dump(holdings, f, indent=4)
        return True
    except Exception:
        return False

def calculate_portfolio_metrics(holdings: list) -> dict:
    """
    Computes real-time valuation, allocation, returns, and sector allocations.
    """
    positions = []
    total_cost = 0.0
    total_value = 0.0
    
    sector_values = {}
    
    for h in holdings:
        ticker = h["ticker"].upper()
        shares = float(h["shares"])
        cost_basis = float(h["cost_basis"])
        
        quote = get_quote(ticker)
        current_price = quote.get("price", cost_basis) if quote.get("success") else cost_basis
        
        cost_val = shares * cost_basis
        current_val = shares * current_price
        gain_loss = current_val - cost_val
        gain_loss_pct = (gain_loss / cost_val * 100.0) if cost_val > 0 else 0.0
        
        total_cost += cost_val
        total_value += current_val
        
        # Get sector information for breakdown
        sector = "Other / Unknown"
        if is_etf(ticker):
            etf_data = get_etf_details(ticker)
            if etf_data.get("success") and etf_data.get("sector_weights"):
                # Distribute value across ETF sectors
                weights = etf_data["sector_weights"]
                for sec, pct in weights.items():
                    sec_val = current_val * (pct / 100.0)
                    sector_values[sec] = sector_values.get(sec, 0.0) + sec_val
                sector = "ETF"
            else:
                sector = "ETF / Index"
        else:
            stock_data = get_stock_fundamentals(ticker)
            if stock_data.get("success") and stock_data.get("sector"):
                sector = stock_data["sector"]
                
        if sector != "ETF":
            sector_values[sector] = sector_values.get(sector, 0.0) + current_val

        positions.append({
            "ticker": ticker,
            "shares": shares,
            "cost_basis": cost_basis,
            "current_price": current_price,
            "cost_value": cost_val,
            "current_value": current_val,
            "gain_loss": gain_loss,
            "gain_loss_pct": gain_loss_pct,
            "sector": sector
        })
        
    # Calculate allocations and format sector weights
    total_return = total_value - total_cost
    total_return_pct = (total_return / total_cost * 100.0) if total_cost > 0 else 0.0
    
    for pos in positions:
        pos["allocation"] = (pos["current_value"] / total_value * 100.0) if total_value > 0 else 0.0
        
    sector_breakdown = {}
    if total_value > 0:
        for sec, val in sector_values.items():
            sector_breakdown[sec] = (val / total_value) * 100.0
            
    # Sort sector breakdown by weight descending
    sector_breakdown = dict(sorted(sector_breakdown.items(), key=lambda x: x[1], reverse=True))

    return {
        "positions": positions,
        "total_cost": total_cost,
        "total_value": total_value,
        "total_return": total_return,
        "total_return_pct": total_return_pct,
        "sector_breakdown": sector_breakdown
    }

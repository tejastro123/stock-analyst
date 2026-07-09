import streamlit as st

# Curated peer groups for cost comparison
ETF_PEER_GROUPS = [
    {"name": "Broad Market / S&P 500", "tickers": ["SPY", "VOO", "IVV", "SPLG"]},
    {"name": "Nasdaq 100", "tickers": ["QQQ", "QQQM", "ONEQ"]},
    {"name": "Large Cap Growth", "tickers": ["VUG", "SCHG", "IWY", "QQQ"]},
    {"name": "Dividend Income", "tickers": ["SCHD", "VYM", "DVY", "SDY"]},
    {"name": "Technology Sector", "tickers": ["XLK", "VGT", "IYW", "FTEC"]},
    {"name": "Financial Sector", "tickers": ["XLF", "VFH", "FNCL"]},
    {"name": "Healthcare Sector", "tickers": ["XLV", "VHT", "FHLC"]},
    {"name": "Energy Sector", "tickers": ["XLE", "VDE", "FENY"]},
    {"name": "Gold / Precious Metals", "tickers": ["GLD", "IAU", "GLDM", "SGOL"]},
    {"name": "Fixed Income / Broad Bond", "tickers": ["BND", "AGG", "LQD", "IEF"]}
]

# Standard expense ratios for top ETFs (hardcoded fallbacks for speed/reliability)
EXPENSE_RATIOS = {
    "SPY": 0.09, "VOO": 0.03, "IVV": 0.03, "SPLG": 0.02,
    "QQQ": 0.20, "QQQM": 0.15, "ONEQ": 0.21,
    "VUG": 0.04, "SCHG": 0.04, "IWY": 0.20,
    "SCHD": 0.06, "VYM": 0.06, "DVY": 0.38, "SDY": 0.35,
    "XLK": 0.09, "VGT": 0.10, "IYW": 0.40, "FTEC": 0.08,
    "XLF": 0.09, "VFH": 0.10, "FNCL": 0.08,
    "XLV": 0.09, "VHT": 0.10, "FHLC": 0.08,
    "XLE": 0.09, "VDE": 0.10, "FENY": 0.08,
    "GLD": 0.40, "IAU": 0.25, "GLDM": 0.10, "SGOL": 0.17,
    "BND": 0.03, "AGG": 0.03, "LQD": 0.14, "IEF": 0.15
}

def get_etf_peer_group(ticker: str) -> dict:
    """
    Returns the peer group info and details for the given ETF ticker.
    Returns None if no peer group is registered for the ticker.
    """
    ticker = ticker.upper()
    for group in ETF_PEER_GROUPS:
        if ticker in group["tickers"]:
            # Gather peer details
            peers = []
            for t in group["tickers"]:
                peers.append({
                    "ticker": t,
                    "expense_ratio": EXPENSE_RATIOS.get(t, 0.10) # default fallback
                })
            
            # Sort peers by expense ratio ascending
            peers = sorted(peers, key=lambda x: x["expense_ratio"])
            return {
                "group_name": group["name"],
                "peers": peers
            }
    return None

def calculate_peer_savings(ticker: str, current_expense_ratio: float, position_size: float = 100000.0) -> dict:
    """
    Calculates cost savings in basis points and dollars compared to the cheapest alternative in the peer group.
    """
    ticker = ticker.upper()
    group = get_etf_peer_group(ticker)
    if not group:
        return None
        
    cheapest_peer = group["peers"][0]
    cheapest_ticker = cheapest_peer["ticker"]
    cheapest_ratio = cheapest_peer["expense_ratio"]
    
    # Handle case where analyzed ticker is already the cheapest
    if ticker == cheapest_ticker:
        # Find next cheapest
        if len(group["peers"]) > 1:
            alternative_peer = group["peers"][1]
            alt_ticker = alternative_peer["ticker"]
            alt_ratio = alternative_peer["expense_ratio"]
            return {
                "cheapest": True,
                "alternative_ticker": alt_ticker,
                "alternative_ratio": alt_ratio,
                "basis_point_difference": (alt_ratio - current_expense_ratio) * 100,
                "dollar_savings": (alt_ratio - current_expense_ratio) / 100.0 * position_size
            }
        return {"cheapest": True, "basis_point_difference": 0.0, "dollar_savings": 0.0}

    bp_diff = (current_expense_ratio - cheapest_ratio) * 100
    dollar_savings = (current_expense_ratio - cheapest_ratio) / 100.0 * position_size
    
    return {
        "cheapest": False,
        "cheapest_ticker": cheapest_ticker,
        "cheapest_ratio": cheapest_ratio,
        "basis_point_difference": bp_diff,
        "dollar_savings": dollar_savings
    }

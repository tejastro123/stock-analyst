from .macro import get_macro_indicator

def get_fed_funds_rate() -> float:
    """Returns the latest Fed Funds Rate as a percentage."""
    df = get_macro_indicator("FEDFUNDS")
    if not df.empty:
        return float(df["Value"].iloc[-1])
    return 5.33 # Default fallback

def get_inflation_rate() -> float:
    """Returns the latest YoY CPI Inflation Rate as a percentage."""
    df = get_macro_indicator("CPIAUCSL", calculate_yoy=True)
    if not df.empty:
        return float(df["Value"].iloc[-1])
    return 3.2 # Default fallback

def get_yield_10y() -> float:
    """Returns the latest 10-Year Treasury Yield as a percentage."""
    df = get_macro_indicator("DGS10")
    if not df.empty:
        return float(df["Value"].iloc[-1])
    return 4.25 # Default fallback

def get_spread_10y_2y() -> float:
    """Returns the latest 10Y-2Y Treasury Yield Spread."""
    df = get_macro_indicator("T10Y2Y")
    if not df.empty:
        return float(df["Value"].iloc[-1])
    return -0.42 # Default fallback

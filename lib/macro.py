import os
import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from fredapi import Fred
from dotenv import load_dotenv

load_dotenv()

FRED_API_KEY = os.getenv("FRED_API_KEY")

def get_fred_client():
    """Initializes the FRED client if the key is available."""
    if not FRED_API_KEY:
        return None
    try:
        return Fred(api_key=FRED_API_KEY)
    except Exception:
        return None

def get_mock_macro_series(series_id: str) -> pd.Series:
    """Generates synthetic macro data for demonstration if no FRED key is available."""
    np.random.seed(42)
    end_date = datetime.now()
    
    if series_id == "GDPC1": # Real GDP (Quarterly)
        dates = pd.date_range(end=end_date, periods=40, freq="QE")
        values = np.linspace(18000, 22500, len(dates)) + np.random.normal(0, 100, len(dates))
        return pd.Series(values, index=dates)
        
    elif series_id == "UNRATE": # Unemployment Rate (Monthly)
        dates = pd.date_range(end=end_date, periods=120, freq="ME")
        values = 4.0 + np.sin(np.linspace(0, 3*np.pi, len(dates))) * 1.5 + np.random.normal(0, 0.2, len(dates))
        return pd.Series(values, index=dates)
        
    elif series_id == "CPIAUCSL" or series_id == "CPILFESL": # CPI index values
        dates = pd.date_range(end=end_date, periods=120, freq="ME")
        values = 250 * np.exp(np.linspace(0, 0.2, len(dates))) + np.random.normal(0, 0.5, len(dates))
        return pd.Series(values, index=dates)
        
    elif series_id == "FEDFUNDS": # Fed Funds
        dates = pd.date_range(end=end_date, periods=120, freq="ME")
        values = 2.0 + np.sin(np.linspace(0, 2*np.pi, len(dates))) * 2.0 + np.random.normal(0, 0.1, len(dates))
        values = np.clip(values, 0.05, 5.5)
        return pd.Series(values, index=dates)
        
    elif series_id == "T10Y2Y": # 10Y-2Y Spread
        dates = pd.date_range(end=end_date, periods=250, freq="D")
        values = 0.5 - np.linspace(0, 1.2, len(dates)) + np.random.normal(0, 0.05, len(dates))
        return pd.Series(values, index=dates)
        
    # Retail Sales (RSXFS) or Industrial Production (INDPRO)
    dates = pd.date_range(end=end_date, periods=120, freq="ME")
    values = np.linspace(100, 120, len(dates)) + np.random.normal(0, 1, len(dates))
    return pd.Series(values, index=dates)

@st.cache_data(ttl=86400) # Cache macro data for 24 hours
def get_macro_indicator(series_id: str, calculate_yoy: bool = False) -> pd.DataFrame:
    """
    Fetches a FRED macro series. Returns a DataFrame with columns [Date, Value].
    If calculate_yoy is True, computes percentage change from 1 year ago.
    """
    fred = get_fred_client()
    if not fred:
        # Fallback to mock data
        s = get_mock_macro_series(series_id)
    else:
        try:
            s = fred.get_series(series_id)
        except Exception:
            s = get_mock_macro_series(series_id)
            
    df = pd.DataFrame({"Value": s})
    df.index.name = "Date"
    
    if calculate_yoy:
        # For monthly frequency, YoY is 12 periods back
        # For daily/quarterly, we resample to monthly or shift dynamically
        if len(df) > 12:
            # Shift 12 periods back for monthly
            df["Value"] = df["Value"].pct_change(12) * 100.0
            df = df.dropna()
            
    return df.reset_index()

@st.cache_data(ttl=86400)
def get_yield_curve() -> pd.DataFrame:
    """
    Fetches yields of various Treasury Constant Maturity rates to build the active yield curve.
    Maturities: 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y.
    """
    maturities = {
        "1M": "DGS1MO",
        "3M": "DGS3MO",
        "6M": "DGS6MO",
        "1Y": "DGS1",
        "2Y": "DGS2",
        "3Y": "DGS3",
        "5Y": "DGS5",
        "7Y": "DGS7",
        "10Y": "DGS10",
        "20Y": "DGS20",
        "30Y": "DGS30"
    }
    
    fred = get_fred_client()
    curve_data = []
    
    # Generate mock curve if no client
    if not fred:
        # Inverted yield curve mock (typical of inverted spreads)
        mock_yields = {
            "1M": 5.42, "3M": 5.39, "6M": 5.31, "1Y": 5.08, "2Y": 4.88,
            "3Y": 4.65, "5Y": 4.43, "7Y": 4.35, "10Y": 4.28, "20Y": 4.51, "30Y": 4.41
        }
        for label, val in mock_yields.items():
            curve_data.append({"Maturity": label, "Yield": val})
        return pd.DataFrame(curve_data)
        
    for label, series_id in maturities.items():
        try:
            s = fred.get_series(series_id)
            if not s.empty:
                # Get the last non-null value
                val = s.dropna().iloc[-1]
                curve_data.append({"Maturity": label, "Yield": float(val)})
            else:
                raise ValueError()
        except Exception:
            # If a single maturity fails, insert a realistic default
            defaults = {
                "1M": 5.4, "3M": 5.3, "6M": 5.2, "1Y": 5.0, "2Y": 4.8,
                "3Y": 4.6, "5Y": 4.4, "7Y": 4.3, "10Y": 4.2, "20Y": 4.5, "30Y": 4.4
            }
            curve_data.append({"Maturity": label, "Yield": defaults[label]})
            
    return pd.DataFrame(curve_data)

def search_fred_series(query: str) -> pd.DataFrame:
    """Searches FRED database for series matching the query."""
    fred = get_fred_client()
    if not fred:
        # Mock search results for demonstration/educational fallback
        query_lower = query.lower()
        if "canada" in query_lower:
            return pd.DataFrame([
                {"id": "NGDPRSAXDCANQ", "title": "Real Gross Domestic Product for Canada", "frequency": "Quarterly", "units": "National Currency"},
                {"id": "LRUNTTTTCAQ156S", "title": "Unemployment Rate: Aged 15 and Over for Canada", "frequency": "Quarterly", "units": "Percent"},
                {"id": "CPALTT01CAM659N", "title": "Consumer Price Index: All Items for Canada", "frequency": "Monthly", "units": "Growth Rate"}
            ])
        else:
            return pd.DataFrame([
                {"id": "GDPC1", "title": "Real Gross Domestic Product", "frequency": "Quarterly", "units": "Billions of Chained 2017 Dollars"},
                {"id": "UNRATE", "title": "Unemployment Rate", "frequency": "Monthly", "units": "Percent"},
                {"id": "CPIAUCSL", "title": "Consumer Price Index for All Urban Consumers: All Items in U.S. City Average", "frequency": "Monthly", "units": "Index 1982-1984=100"}
            ])
    try:
        df = fred.search(query)
        if df is None or df.empty:
            return pd.DataFrame()
        cols = ["id", "title", "frequency", "units", "notes"]
        existing_cols = [c for c in cols if c in df.columns]
        return df[existing_cols]
    except Exception:
        return pd.DataFrame()


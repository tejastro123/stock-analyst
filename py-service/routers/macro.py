import os
import pandas as pd
import numpy as np
import time
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from fredapi import Fred
except ImportError:
    Fred = None

router = APIRouter(prefix="/macro", tags=["macro"])

FRED_API_KEY = os.getenv("FRED_API_KEY")

# Global cooldown state to disable FRED if it is failing/rate-limited
_fred_disabled_until = 0.0

def get_fred_client():
    global _fred_disabled_until
    if time.time() < _fred_disabled_until:
        return None
    if not FRED_API_KEY or Fred is None or FRED_API_KEY in ("your_actual_fred_key_here", "PLACEHOLDER", "your_fred_api_key_here"):
        return None
    try:
        return Fred(api_key=FRED_API_KEY)
    except Exception:
        return None

def disable_fred_temporary():
    global _fred_disabled_until
    # Cooldown FRED calls for 5 minutes if a call fails
    _fred_disabled_until = time.time() + 300.0

def get_mock_macro_series(series_id: str) -> pd.Series:
    np.random.seed(42)
    end_date = datetime.now()
    
    if series_id == "GDPC1":  # Real GDP (Quarterly)
        dates = pd.date_range(end=end_date, periods=40, freq="QE")
        values = np.linspace(18000, 22500, len(dates)) + np.random.normal(0, 100, len(dates))
        return pd.Series(values, index=dates)
        
    elif series_id == "UNRATE":  # Unemployment Rate (Monthly)
        dates = pd.date_range(end=end_date, periods=120, freq="ME")
        values = 4.0 + np.sin(np.linspace(0, 3 * np.pi, len(dates))) * 1.5 + np.random.normal(0, 0.2, len(dates))
        return pd.Series(values, index=dates)
        
    elif series_id in ["CPIAUCSL", "CPILFESL"]:  # CPI index values
        dates = pd.date_range(end=end_date, periods=120, freq="ME")
        values = 250 * np.exp(np.linspace(0, 0.2, len(dates))) + np.random.normal(0, 0.5, len(dates))
        return pd.Series(values, index=dates)
        
    elif series_id == "FEDFUNDS":  # Fed Funds
        dates = pd.date_range(end=end_date, periods=120, freq="ME")
        values = 2.0 + np.sin(np.linspace(0, 2 * np.pi, len(dates))) * 2.0 + np.random.normal(0, 0.1, len(dates))
        values = np.clip(values, 0.05, 5.5)
        return pd.Series(values, index=dates)
        
    elif series_id == "T10Y2Y":  # 10Y-2Y Spread
        dates = pd.date_range(end=end_date, periods=250, freq="D")
        values = 0.5 - np.linspace(0, 1.2, len(dates)) + np.random.normal(0, 0.05, len(dates))
        return pd.Series(values, index=dates)
        
    # Default
    dates = pd.date_range(end=end_date, periods=120, freq="ME")
    values = np.linspace(100, 120, len(dates)) + np.random.normal(0, 1, len(dates))
    return pd.Series(values, index=dates)

@router.get("/curve")
def get_yield_curve():
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
    
    # Inverted yield curve mock/fallback
    mock_yields = {
        "1M": 5.42, "3M": 5.39, "6M": 5.31, "1Y": 5.08, "2Y": 4.88,
        "3Y": 4.65, "5Y": 4.43, "7Y": 4.35, "10Y": 4.28, "20Y": 4.51, "30Y": 4.41
    }
    
    if not fred:
        for label, val in mock_yields.items():
            curve_data.append({"maturity": label, "yield": val})
        return curve_data
        
    results = {}
    failed = False
    
    def fetch_one(label, series_id):
        try:
            s = fred.get_series(series_id)
            if s is not None and not s.empty:
                val = s.dropna().iloc[-1]
                return label, float(val)
        except Exception:
            pass
        return label, None

    with ThreadPoolExecutor(max_workers=len(maturities)) as executor:
        futures = {executor.submit(fetch_one, label, series_id): label for label, series_id in maturities.items()}
        for fut in as_completed(futures):
            label, val = fut.result()
            if val is not None:
                results[label] = val
            else:
                failed = True

    if failed and len(results) < len(maturities):
        disable_fred_temporary()
        # Merge missing values with mock defaults
        for label in maturities.keys():
            if label not in results:
                results[label] = mock_yields[label]

    # Maintain maturities sorting
    for label in maturities.keys():
        curve_data.append({"maturity": label, "yield": results.get(label, mock_yields[label])})
        
    return curve_data

@router.get("/series/{series_id}")
def get_macro_series(series_id: str, calculate_yoy: bool = Query(False)):
    fred = get_fred_client()
    s = None
    if fred:
        try:
            s = fred.get_series(series_id)
        except Exception:
            disable_fred_temporary()
            s = None
            
    if s is None or s.empty:
        s = get_mock_macro_series(series_id)
            
    df = pd.DataFrame({"value": s})
    df.index.name = "date"
    
    if calculate_yoy:
        if len(df) > 12:
            df["value"] = df["value"].pct_change(12) * 100.0
            df = df.dropna()
            
    df = df.reset_index()
    try:
        # Safely convert to datetime
        df["date"] = pd.to_datetime(df["date"])
        df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    except Exception:
        df["date"] = df["date"].astype(str)
        
    return df.to_dict(orient="records")

@router.get("/search")
def search_fred(query: str):
    fred = get_fred_client()
    mock_results = [
        {"id": "GDPC1", "title": "Real Gross Domestic Product", "frequency": "Quarterly", "units": "Billions of Chained 2017 Dollars"},
        {"id": "UNRATE", "title": "Unemployment Rate", "frequency": "Monthly", "units": "Percent"},
        {"id": "CPIAUCSL", "title": "Consumer Price Index for All Urban Consumers: All Items in U.S. City Average", "frequency": "Monthly", "units": "Index 1982-1984=100"},
        {"id": "FEDFUNDS", "title": "Effective Federal Funds Rate", "frequency": "Monthly", "units": "Percent"},
        {"id": "T10Y2Y", "title": "10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity", "frequency": "Daily", "units": "Percent"}
    ]
    
    query_lower = (query or "").lower()
    if "canada" in query_lower:
        mock_results = [
            {"id": "NGDPRSAXDCANQ", "title": "Real Gross Domestic Product for Canada", "frequency": "Quarterly", "units": "National Currency"},
            {"id": "LRUNTTTTCAQ156S", "title": "Unemployment Rate: Aged 15 and Over for Canada", "frequency": "Quarterly", "units": "Percent"},
            {"id": "CPALTT01CAM659N", "title": "Consumer Price Index: All Items for Canada", "frequency": "Monthly", "units": "Growth Rate"}
        ]
        
    if not fred:
        return mock_results
        
    try:
        df = fred.search(query)
        if df is None or df.empty:
            return []
        df = df.head(20)
        cols = ["id", "title", "frequency", "units", "notes"]
        existing_cols = [c for c in cols if c in df.columns]
        return df[existing_cols].to_dict(orient="records")
    except Exception:
        disable_fred_temporary()
        return mock_results


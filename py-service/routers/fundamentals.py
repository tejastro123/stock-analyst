from fastapi import APIRouter, Query, HTTPException
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

import cache
from utils import safe_float, safe_int, normalize_symbol

router = APIRouter(prefix="/fundamentals", tags=["fundamentals"])


@router.get("/{symbol}")
def get_fundamentals(symbol: str, market: str = Query("US")):
    cache_key = f"{symbol.upper()}:{market}"
    cached = cache.get("fundamentals", cache_key)
    if cached:
        return {**cached, "cached": True}

    yf_sym = normalize_symbol(symbol, market)
    try:
        ticker = yf.Ticker(yf_sym)
        info = ticker.info
    except Exception as e:
        raise HTTPException(502, f"yfinance error: {str(e)}")

    if not info or "symbol" not in info:
        raise HTTPException(404, f"No data for {symbol}")

    data = {
        "symbol":            symbol.upper(),
        "market":            market,
        # Company
        "name":              info.get("longName") or info.get("shortName"),
        "sector":            info.get("sector"),
        "industry":          info.get("industry"),
        "description":       (info.get("longBusinessSummary") or "")[:500],
        "website":           info.get("website"),
        "country":           info.get("country"),
        "employees":         safe_int(info.get("fullTimeEmployees")),
        # Valuation
        "market_cap":        safe_int(info.get("marketCap")),
        "enterprise_value":  safe_int(info.get("enterpriseValue")),
        "pe_trailing":       safe_float(info.get("trailingPE")),
        "pe_forward":        safe_float(info.get("forwardPE")),
        "peg_ratio":         safe_float(info.get("pegRatio")),
        "pb_ratio":          safe_float(info.get("priceToBook")),
        "ps_ratio":          safe_float(info.get("priceToSalesTrailing12Months")),
        "ev_ebitda":         safe_float(info.get("enterpriseToEbitda")),
        "ev_revenue":        safe_float(info.get("enterpriseToRevenue")),
        # Financials
        "revenue":           safe_int(info.get("totalRevenue")),
        "revenue_growth":    safe_float(info.get("revenueGrowth")),
        "gross_margin":      safe_float(info.get("grossMargins")),
        "operating_margin":  safe_float(info.get("operatingMargins")),
        "profit_margin":     safe_float(info.get("profitMargins")),
        "ebitda":            safe_int(info.get("ebitda")),
        "net_income":        safe_int(info.get("netIncomeToCommon")),
        "eps_trailing":      safe_float(info.get("trailingEps")),
        "eps_forward":       safe_float(info.get("forwardEps")),
        # Balance Sheet
        "total_cash":        safe_int(info.get("totalCash")),
        "total_debt":        safe_int(info.get("totalDebt")),
        "debt_to_equity":    safe_float(info.get("debtToEquity")),
        "current_ratio":     safe_float(info.get("currentRatio")),
        "quick_ratio":       safe_float(info.get("quickRatio")),
        # Returns
        "roe":               safe_float(info.get("returnOnEquity")),
        "roa":               safe_float(info.get("returnOnAssets")),
        "roic":              None,  # not in yfinance info directly
        # Dividends
        "dividend_yield":    safe_float(info.get("dividendYield")),
        "dividend_rate":     safe_float(info.get("dividendRate")),
        "payout_ratio":      safe_float(info.get("payoutRatio")),
        "ex_dividend_date":  str(info.get("exDividendDate")) if info.get("exDividendDate") else None,
        # Price stats
        "beta":              safe_float(info.get("beta")),
        "week52_high":       safe_float(info.get("fiftyTwoWeekHigh")),
        "week52_low":        safe_float(info.get("fiftyTwoWeekLow")),
        "ma50":              safe_float(info.get("fiftyDayAverage")),
        "ma200":             safe_float(info.get("twoHundredDayAverage")),
        "avg_volume":        safe_int(info.get("averageVolume")),
        "avg_volume_10d":    safe_int(info.get("averageVolume10days")),
        # Shares
        "shares_outstanding": safe_int(info.get("sharesOutstanding")),
        "float_shares":       safe_int(info.get("floatShares")),
        "short_ratio":        safe_float(info.get("shortRatio")),
        "short_pct_float":    safe_float(info.get("shortPercentOfFloat")),
        # Earnings
        "earnings_growth":    safe_float(info.get("earningsGrowth")),
        "earnings_quarterly_growth": safe_float(info.get("earningsQuarterlyGrowth")),
        "next_earnings_date": None,  # from calendar
    }

    # Earnings date from calendar
    try:
        cal = ticker.calendar
        if cal is not None and "Earnings Date" in cal:
            dates = cal["Earnings Date"]
            if hasattr(dates, "__iter__"):
                data["next_earnings_date"] = str(list(dates)[0]) if dates else None
            else:
                data["next_earnings_date"] = str(dates)
    except Exception:
        pass

    cache.set("fundamentals", cache_key, data)
    return {**data, "cached": False}


@router.get("/{symbol}/copilot-data")
def get_copilot_data(symbol: str, market: str = Query("US")):
    cache_key = f"copilot:{symbol.upper()}:{market}"
    cached = cache.get("fundamentals", cache_key)
    if cached:
        return {**cached, "cached": True}

    yf_sym = normalize_symbol(symbol, market)
    try:
        ticker = yf.Ticker(yf_sym)
    except Exception as e:
        raise HTTPException(502, f"yfinance error: {str(e)}")

    def clean_df(df: pd.DataFrame) -> list[dict]:
        if df is None or df.empty:
            return []
        try:
            df = df.replace([np.inf, -np.inf], np.nan)
            df_reset = df.reset_index()
            records = df_reset.to_dict(orient="records")
            for r in records:
                for k, v in list(r.items()):
                    if pd.isna(v):
                        r[k] = None
                    elif isinstance(v, (datetime, pd.Timestamp)):
                        r[k] = v.strftime("%Y-%m-%d")
                    elif isinstance(v, (str, bytes)) == False and hasattr(v, "dtype"):
                        if np.isnan(v):
                            r[k] = None
                        else:
                            r[k] = v.item()
            return records
        except Exception:
            return []

    # Get financials, balance sheet, cashflow
    fin_summary = {}
    try:
        df_fin = ticker.financials
        fin_summary["financials"] = clean_df(df_fin.transpose()) if df_fin is not None else []
    except Exception as e:
        fin_summary["financials_error"] = str(e)

    try:
        df_bs = ticker.balance_sheet
        fin_summary["balance_sheet"] = clean_df(df_bs.transpose()) if df_bs is not None else []
    except Exception as e:
        fin_summary["balance_sheet_error"] = str(e)

    try:
        df_cf = ticker.cashflow
        fin_summary["cashflow"] = clean_df(df_cf.transpose()) if df_cf is not None else []
    except Exception as e:
        fin_summary["cashflow_error"] = str(e)

    # Get insider & institutional holdings
    holdings = {}
    try:
        df_insider = ticker.insider_transactions
        holdings["insider_transactions"] = clean_df(df_insider.head(15)) if df_insider is not None else []
    except Exception:
        holdings["insider_transactions"] = []

    try:
        df_inst = ticker.institutional_holders
        holdings["institutional_holders"] = clean_df(df_inst.head(15)) if df_inst is not None else []
    except Exception:
        holdings["institutional_holders"] = []

    try:
        df_major = ticker.major_holders
        holdings["major_holders"] = clean_df(df_major) if df_major is not None else []
    except Exception:
        holdings["major_holders"] = []

    # Get earnings history
    earnings = {}
    try:
        df_earn = ticker.earnings_history
        earnings["earnings_history"] = clean_df(df_earn.head(10)) if df_earn is not None else []
    except Exception:
        earnings["earnings_history"] = []

    # Next earnings dates
    next_earnings_date = None
    try:
        cal = ticker.calendar
        if cal is not None and "Earnings Date" in cal:
            dates = cal["Earnings Date"]
            if hasattr(dates, "__iter__"):
                next_earnings_date = str(list(dates)[0]) if dates else None
            else:
                next_earnings_date = str(dates)
    except Exception:
        pass

    data = {
        "symbol": symbol.upper(),
        "market": market,
        "financials": fin_summary,
        "holdings": holdings,
        "earnings": {
            **earnings,
            "next_earnings_date": next_earnings_date
        }
    }

    cache.set("fundamentals", cache_key, data)
    return {**data, "cached": False}

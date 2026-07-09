import numpy as np
import pandas as pd

def calculate_rsi(prices: np.ndarray, period: int = 14) -> float:
    """Calculates Wilder's Relative Strength Index (RSI)."""
    if len(prices) < period + 1:
        return 50.0 # Neutral default
        
    deltas = np.diff(prices)
    gain = np.where(deltas > 0, deltas, 0)
    loss = np.where(deltas < 0, -deltas, 0)
    
    avg_gain = np.mean(gain[:period])
    avg_loss = np.mean(loss[:period])
    
    if avg_loss == 0:
        rs = 100
    else:
        rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gain[i]) / period
        avg_loss = (avg_loss * (period - 1) + loss[i]) / period
        if avg_loss == 0:
            rs = 100
        else:
            rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
    return rsi

def compute_scores(df: pd.DataFrame, fundamentals: dict) -> dict:
    """
    Computes Technical Strength and Fundamental Quality scores (0-100 each).
    Compiles factual buckets with neutral language.
    """
    # ------------------ TECHNICAL STRENGTH ------------------
    tech_score = 0
    bullets_tech = []
    
    close_series = df["Close"].values
    last_close = close_series[-1]
    
    # 1. Trend (40 points)
    # 200 DMA
    dma_200 = df["Close"].rolling(200).mean().iloc[-1] if len(df) >= 200 else df["Close"].mean()
    # 50 DMA
    dma_50 = df["Close"].rolling(50).mean().iloc[-1] if len(df) >= 50 else df["Close"].mean()
    
    trend_bucket = "Above 200DMA" if last_close >= dma_200 else "Below 200DMA"
    if last_close >= dma_200:
        tech_score += 25
        bullets_tech.append("Price level exceeds 200-day simple moving average")
    else:
        bullets_tech.append("Price level trades below 200-day simple moving average")
        
    if last_close >= dma_50:
        tech_score += 15
        bullets_tech.append("Price level exceeds 50-day simple moving average")
    else:
        bullets_tech.append("Price level trades below 50-day simple moving average")
        
    # 2. Momentum (30 points)
    rsi_val = calculate_rsi(close_series)
    if rsi_val > 70:
        momentum_bucket = "Elevated momentum"
        tech_score += 20
        bullets_tech.append(f"RSI indicator is in elevated range ({rsi_val:.1f})")
    elif rsi_val >= 45:
        momentum_bucket = "Firm momentum"
        tech_score += 30
        bullets_tech.append(f"RSI indicates stable range dynamics ({rsi_val:.1f})")
    elif rsi_val >= 30:
        momentum_bucket = "Modest momentum"
        tech_score += 15
        bullets_tech.append(f"RSI indicates contracting momentum ({rsi_val:.1f})")
    else:
        momentum_bucket = "Subdued momentum"
        tech_score += 5
        bullets_tech.append(f"RSI in low boundary area ({rsi_val:.1f})")
        
    # 3. 52-Week Range Position (30 points)
    high_52w = df["High"].max()
    low_52w = df["Low"].min()
    rng_52w = high_52w - low_52w
    
    if rng_52w > 0:
        pos_ratio = (last_close - low_52w) / rng_52w
    else:
        pos_ratio = 0.5
        
    if pos_ratio >= 0.8:
        range_bucket = "Upper boundary"
        tech_score += 30
        bullets_tech.append(f"Trading at the upper boundary ({pos_ratio*100:.1f}%) of 52-week range")
    elif pos_ratio >= 0.3:
        range_bucket = "Mid-range"
        tech_score += 15
        bullets_tech.append(f"Trading in the mid-range ({pos_ratio*100:.1f}%) of 52-week range")
    else:
        range_bucket = "Lower boundary"
        tech_score += 5
        bullets_tech.append(f"Trading at the lower boundary ({pos_ratio*100:.1f}%) of 52-week range")

    # ------------------ FUNDAMENTAL QUALITY ------------------
    fund_score = 0
    bullets_fund = []
    
    # 1. Profitability ROE (30 points)
    roe = fundamentals.get("roe") or 0.0
    if roe >= 20.0:
        roe_bucket = "High tier"
        fund_score += 30
        bullets_fund.append(f"Return on Equity (ROE) is in the high tier ({roe:.1f}%)")
    elif roe >= 10.0:
        roe_bucket = "Moderate tier"
        fund_score += 20
        bullets_fund.append(f"Return on Equity (ROE) is in the moderate tier ({roe:.1f}%)")
    elif roe > 0:
        roe_bucket = "Low tier"
        fund_score += 10
        bullets_fund.append(f"Return on Equity (ROE) is in the low tier ({roe:.1f}%)")
    else:
        roe_bucket = "Negative tier"
        bullets_fund.append(f"Return on Equity (ROE) is negative ({roe:.1f}%)")
        
    # 2. Profit Margin (30 points)
    margin = fundamentals.get("profit_margin") or 0.0
    if margin >= 15.0:
        fund_score += 30
        bullets_fund.append(f"Net profit margins exceed 15% ({margin:.1f}%)")
    elif margin >= 5.0:
        fund_score += 20
        bullets_fund.append(f"Net profit margins are moderate ({margin:.1f}%)")
    elif margin > 0:
        fund_score += 10
        bullets_fund.append(f"Net profit margins are low ({margin:.1f}%)")
    else:
        bullets_fund.append(f"Net profit margins are negative ({margin:.1f}%)")

    # 3. Leverage D/E (20 points)
    de = fundamentals.get("debt_to_equity")
    if de is None:
        de_bucket = "Neutral leverage"
        fund_score += 15
        bullets_fund.append("Debt-to-equity is not applicable or neutral")
    elif de < 50.0:
        de_bucket = "Low leverage"
        fund_score += 20
        bullets_fund.append(f"Low leverage structure (Debt/Equity: {de:.1f})")
    elif de <= 150.0:
        de_bucket = "Moderate leverage"
        fund_score += 15
        bullets_fund.append(f"Moderate leverage structure (Debt/Equity: {de:.1f})")
    else:
        de_bucket = "High leverage"
        fund_score += 5
        bullets_fund.append(f"Elevated leverage structure (Debt/Equity: {de:.1f})")

    # 4. Valuation P/E (20 points)
    pe = fundamentals.get("pe_trailing")
    if pe is None or pe <= 0:
        pe_bucket = "Neutral multiple"
        fund_score += 10
        bullets_fund.append("P/E ratio is not available or non-positive")
    elif pe < 15.0:
        pe_bucket = "Low multiple"
        fund_score += 20
        bullets_fund.append(f"P/E ratio trades at a low multiple ({pe:.1f})")
    elif pe <= 30.0:
        pe_bucket = "Moderate multiple"
        fund_score += 15
        bullets_fund.append(f"P/E ratio trades at a moderate multiple ({pe:.1f})")
    else:
        pe_bucket = "High multiple"
        fund_score += 5
        bullets_fund.append(f"P/E ratio trades at a high multiple ({pe:.1f})")

    # Volatility / Beta
    beta = fundamentals.get("beta")
    if beta is None:
        beta_bucket = "Neutral beta"
    elif beta > 1.2:
        beta_bucket = "Higher than market"
    elif beta >= 0.8:
        beta_bucket = "In-line with market"
    else:
        beta_bucket = "Lower than market"

    return {
        "tech_score": int(tech_score),
        "bullets_tech": bullets_tech,
        "fund_score": int(fund_score),
        "bullets_fund": bullets_fund,
        "buckets": {
            "Trend": trend_bucket,
            "Momentum": momentum_bucket,
            "52-Week Range": range_bucket,
            "Profitability": roe_bucket,
            "Leverage": de_bucket,
            "Volatility": beta_bucket,
            "Valuation": pe_bucket
        }
    }

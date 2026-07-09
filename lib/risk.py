import numpy as np
import pandas as pd

def calculate_max_drawdown(prices: pd.Series) -> float:
    """Calculates the maximum peak-to-trough drawdown as a percentage."""
    if prices.empty:
        return 0.0
    roll_max = prices.cummax()
    drawdowns = (prices - roll_max) / roll_max
    return float(drawdowns.min() * -100.0)

def calculate_annualized_volatility(prices: pd.Series) -> float:
    """Calculates the annualized standard deviation of daily returns."""
    if len(prices) < 5:
        return 0.0
    daily_returns = prices.pct_change().dropna()
    daily_vol = daily_returns.std()
    return float(daily_vol * np.sqrt(252) * 100.0)

def calculate_etf_risk_score(df: pd.DataFrame, holdings: list) -> dict:
    """
    Computes a risk score from 0 (conservative) to 100 (aggressive).
    Based on:
    - Annualized Volatility (40% weight)
    - Maximum Drawdown (30% weight)
    - Concentration of top 5 holdings (30% weight)
    """
    risk_points = 0
    bullets = []
    
    # 1. Volatility (Max 40 points)
    ann_vol = calculate_annualized_volatility(df["Close"])
    if ann_vol >= 30.0:
        risk_points += 40
        bullets.append(f"Annualized volatility is elevated ({ann_vol:.1f}%)")
    elif ann_vol >= 15.0:
        risk_points += 25
        bullets.append(f"Annualized volatility is moderate ({ann_vol:.1f}%)")
    else:
        risk_points += 10
        bullets.append(f"Annualized volatility is conservative ({ann_vol:.1f}%)")
        
    # 2. Maximum Drawdown (Max 30 points)
    max_dd = calculate_max_drawdown(df["Close"])
    if max_dd >= 30.0:
        risk_points += 30
        bullets.append(f"Historical maximum drawdown is high (-{max_dd:.1f}%)")
    elif max_dd >= 15.0:
        risk_points += 20
        bullets.append(f"Historical maximum drawdown is moderate (-{max_dd:.1f}%)")
    else:
        risk_points += 10
        bullets.append(f"Historical maximum drawdown is conservative (-{max_dd:.1f}%)")
        
    # 3. Concentration (Max 30 points)
    # Sort holdings and take top 5
    sorted_holdings = sorted(holdings, key=lambda x: x.get("weight", 0.0), reverse=True)
    top_5_weight = sum(h.get("weight", 0.0) for h in sorted_holdings[:5])
    
    if len(holdings) == 0:
        # Neutral concentration if holdings list is empty
        risk_points += 15
        bullets.append("Holdings concentration detail is not available")
    elif top_5_weight >= 45.0:
        risk_points += 30
        bullets.append(f"High concentration in top 5 holdings ({top_5_weight:.1f}%)")
    elif top_5_weight >= 20.0:
        risk_points += 20
        bullets.append(f"Moderate concentration in top 5 holdings ({top_5_weight:.1f}%)")
    else:
        risk_points += 10
        bullets.append(f"Low concentration in top 5 holdings ({top_5_weight:.1f}%)")

    # Classify Risk Level
    score = int(risk_points)
    if score >= 75:
        classification = "Very Aggressive"
    elif score >= 55:
        classification = "Aggressive"
    elif score >= 35:
        classification = "Moderate"
    else:
        classification = "Conservative"

    return {
        "risk_score": score,
        "classification": classification,
        "annualized_volatility": ann_vol,
        "max_drawdown": max_dd,
        "top_5_concentration": top_5_weight,
        "bullets": bullets
    }

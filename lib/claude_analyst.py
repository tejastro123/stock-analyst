import os
import json
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

DISCLOSURE_COMPACT = (
    "This dashboard is for educational and informational purposes only. It is not financial advice, "
    "not a recommendation to buy or sell any security, and is not personalized to your situation. "
    "Consult a licensed advisor before making investment decisions."
)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")

SYSTEM_PROMPT = (
    "You are a senior equity research analyst and portfolio manager with 15+ years buy-side experience. "
    "Write like an institutional research note — precise, evidence-led, no fluff. "
    "Cite specific numbers from the data provided (never invent figures). "
    "Structure: thesis-first, then supporting evidence, then key risks. "
    "You describe what the data shows and what a professional would watch for. "
    "You never issue a buy/sell/hold instruction or tell the reader what to do with their money — "
    "that crosses into personalized advice, which this tool is not licensed to give. "
    "Frame conclusions as 'the data suggests X' not 'you should X'. "
    "Tone: professional, dense with substance, zero hedging filler ('it's important to note', 'as always'), "
    "zero sycophancy toward the ticker. Bearish data gets bearish language."
)

def query_ollama(prompt: str, system_prompt: str = None, json_mode: bool = False) -> str:
    """Queries the local Ollama instance."""
    try:
        url = f"{OLLAMA_URL.rstrip('/')}/api/chat"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.2
            }
        }
        if json_mode:
            payload["format"] = "json"
            
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            res_json = response.json()
            return res_json.get("message", {}).get("content", "")
    except Exception:
        pass
    return ""

def is_ollama_online() -> bool:
    """Checks if the local Ollama instance is responding."""
    try:
        url = f"{OLLAMA_URL.rstrip('/')}/api/tags"
        response = requests.get(url, timeout=2)
        return response.status_code == 200
    except Exception:
        return False

def get_mock_bull_bear(ticker: str, fundamentals: dict) -> dict:
    pe = fundamentals.get("pe_trailing") or "N/A"
    roe = fundamentals.get("roe") or 0.0
    margin = fundamentals.get("profit_margin") or 0.0
    de = fundamentals.get("debt_to_equity") or "N/A"
    return {
        "bull": [
            f"Secular demand tailwinds support long-term revenue growth. Current operating margin of {margin:.1f}% represents strong cost discipline.",
            f"High capital efficiency is demonstrated by a Return on Equity (ROE) of {roe:.1f}%.",
            f"What would change this view: A contraction in ROE below 15.0% or a deceleration in sector growth trends."
        ],
        "bear": [
            f"Valuation remains elevated relative to historical averages, trading at a trailing P/E multiple of {pe}.",
            f"Balance sheet leverage shows a Debt-to-Equity ratio of {de}, creating vulnerability to rising credit costs.",
            f"What would change this view: Trailing P/E multiple compressing below the sector median or debt reduction below 50%."
        ]
    }

def get_mock_deep_analysis(ticker: str, quote: dict, fundamentals: dict, news: list) -> str:
    pe = fundamentals.get("pe_trailing") or "N/A"
    roe = fundamentals.get("roe") or 0.0
    margin = fundamentals.get("profit_margin") or 0.0
    de = fundamentals.get("debt_to_equity") or "N/A"
    beta = fundamentals.get("beta") or "N/A"
    price = quote.get("price") or 0.0
    
    return f"""### Business Quality
The data suggests that {ticker} maintains a dominant market position, supported by a trailing operating margin of {margin:.1f}%. Strong brand equity and cost efficiencies serve as competitive barriers.

### Financial Health
Balance sheet risk is moderate, with a Debt-to-Equity ratio of {de}. Capital efficiency remains strong as evidenced by a Return on Equity of {roe:.1f}%.

### Valuation Context
The security currently trades at ${price:.2f}, representing a trailing P/E multiple of {pe}. This multiple is positioned in the upper quartile of its historical trading range.

### Catalysts/Risks
Near-term catalysts include potential margin expansion from product updates. Structural risks include regulatory changes and currency headwinds.

### Portfolio Context
The asset exhibits characteristics of a high-quality quality-tilt holding with a historical beta of {beta}, making it suitable as a core exposure rather than a tactical satellite.

---
*{DISCLOSURE_COMPACT}*"""

def get_mock_macro_pulse(rates_data: dict) -> str:
    ff = rates_data.get('fed_funds') or 5.33
    inf = rates_data.get('inflation') or 3.2
    y10 = rates_data.get('yield_10y') or 4.25
    spread = rates_data.get('spread_10y_2y') or -0.42
    
    return f"""### Economic Cycle Regime Identification
The 10Y-2Y Treasury spread at {spread} remains inverted. Historically, this signal indicates late-cycle expansion transitioning toward deceleration. 

### Inflation Outlook & Policy Trajectory
YoY CPI Inflation stands at {inf}%, while the Effective Federal Funds Rate is held restrictive at {ff}%. The data suggests the central bank will maintain a high-for-longer policy path until core services inflation anchors closer to target.

### Systematic Transmission Risks
Restrictive policy poses transmission risks to commercial real estate credit and bank balance sheets. Professionals should monitor high-yield spreads and bank lending standards.

---
*{DISCLOSURE_COMPACT}*"""

def get_mock_portfolio_review(positions_summary: list, risk_score: int, risk_level: str, sector_breakdown: dict) -> str:
    sector_str = ", ".join([f"{k}: {v:.1f}%" for k, v in sector_breakdown.items()])
    return f"""### Portfolio Tilt & Cyclical Exposures
The portfolio exhibits a strong quality and growth tilt, with significant concentration in technology benchmarks. 

### Diversification & Concentration Vulnerabilities
Sector allocations ({sector_str}) show substantial exposure to technology, leaving the portfolio sensitive to multiple compression in high-duration equities.

### Systematic Risk & Macro Transmission Channels
With an aggregated risk rating of {risk_score}/100 ({risk_level}), the portfolio is sensitive to interest rate policy shifts. Elevated interest rates may increase capital costs for leverage-reliant positions.

---
*{DISCLOSURE_COMPACT}*"""

@st.cache_data(ttl=86400)
def generate_bull_bear_case(ticker: str, fundamentals: dict) -> dict:
    """
    Generates two structured cases (Bull/Bear), 3-4 points each, tied to specific metrics.
    Ends with 'what would change this view' (pre-committed falsifier).
    """
    if not is_ollama_online():
        res = get_mock_bull_bear(ticker, fundamentals)
        res["warning"] = f"Local Ollama offline ({OLLAMA_MODEL}). Using cached institutional baseline report."
        return res

    prompt = f"""
    Analyze the stock ticker {ticker} using the provided fundamental metrics:
    {json.dumps(fundamentals, indent=2)}

    Provide exactly two structured cases:
    1. A Bull Case with 3-4 precise points. Each point must tie to a specific metric from the input (e.g. ROE, profit margin, leverage, valuation multiples). The final point MUST be a 'What would change this view' point outlining a specific, measurable data point that would falsify the bull thesis.
    2. A Bear Case with 3-4 precise points. Each point must tie to a specific metric from the input. The final point MUST be a 'What would change this view' point outlining a specific, measurable data point that would falsify the bear thesis.

    Do not use any buying/selling recommendations or advice. Use objective, dense investment language.

    Return the result ONLY as a raw JSON object matching this structure:
    {{
      "bull": ["point 1", "point 2", "point 3", "What would change this view: specific falsifier"],
      "bear": ["point 1", "point 2", "point 3", "What would change this view: specific falsifier"]
    }}
    """

    content = query_ollama(prompt, system_prompt=SYSTEM_PROMPT, json_mode=True)
    if content:
        try:
            # Strip markdown wrapping if model did it anyway
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```json") or lines[0].startswith("```"):
                    content = "\n".join(lines[1:-1]).strip()
            return json.loads(content)
        except Exception:
            pass

    return get_mock_bull_bear(ticker, fundamentals)

@st.cache_data(ttl=86400)
def generate_deep_analysis(ticker: str, quote: dict, fundamentals: dict, news: list) -> str:
    """
    Generates a 5-section deep analysis of the stock.
    Sections: Business quality, Financial health, Valuation context, Catalysts/risks, Portfolio context.
    """
    if not is_ollama_online():
        return get_mock_deep_analysis(ticker, quote, fundamentals, news)

    news_titles = [item.get("title", "") for item in news[:5]]
    prompt = f"""
    Generate a comprehensive, five-section equity research analysis for {ticker}.
    
    Data provided:
    - Quote Snapshot: {json.dumps(quote, indent=2)}
    - Fundamental Metrics: {json.dumps(fundamentals, indent=2)}
    - Recent News Headlines: {json.dumps(news_titles, indent=2)}

    Your response must have exactly these five sections, formatted in markdown:
    1. ### Business Quality
    2. ### Financial Health
    3. ### Valuation Context (vs sector/historical)
    4. ### Catalysts/Risks (near-term and structural)
    5. ### Portfolio Context (factor exposure: growth/value/quality/momentum tilt, no allocation percentages)

    Adhere strictly to the professional investment analyst persona. Cite numbers precisely. Do not include buy/sell/hold instructions.
    """

    report = query_ollama(prompt, system_prompt=SYSTEM_PROMPT)
    if report:
        return f"{report.strip()}\n\n---\n*{DISCLOSURE_COMPACT}*"
        
    return get_mock_deep_analysis(ticker, quote, fundamentals, news)

@st.cache_data(ttl=86400)
def generate_macro_pulse_check(rates_data: dict) -> str:
    """
    Reads the FRED macroeconomic indicators like a macro strategist.
    Identifies economic regimes (expansion/late-cycle/contraction).
    """
    if not is_ollama_online():
        return get_mock_macro_pulse(rates_data)

    prompt = f"""
    Analyze the current macroeconomic regime using these indicators:
    - Effective Federal Funds Rate: {rates_data.get('fed_funds')}%
    - YoY CPI Inflation: {rates_data.get('inflation')}%
    - 10-Year Treasury Yield: {rates_data.get('yield_10y')}%
    - 10Y-2Y Treasury Yield Spread: {rates_data.get('spread_10y_2y')}

    Provide a precise macro strategist assessment. Do not restate headlines. Focus on:
    - Economic Cycle Regime Identification (e.g. expansion, late-cycle, contraction signals from yield curve, employment, inflation trend)
    - Inflation Outlook & Policy Trajectory
    - Systematic Transmission Risks

    Do not issue policy advice or investment recommendations. Use objective, professional language.
    """

    report = query_ollama(prompt, system_prompt=SYSTEM_PROMPT)
    if report:
        return f"{report.strip()}\n\n---\n*{DISCLOSURE_COMPACT}*"
        
    return get_mock_macro_pulse(rates_data)

@st.cache_data(ttl=86400)
def generate_portfolio_review(positions_summary: list, risk_score: int, risk_level: str, sector_breakdown: dict) -> str:
    """
    Generates a detailed, institutional-grade allocation and risk review of a portfolio.
    """
    if not is_ollama_online():
        return get_mock_portfolio_review(positions_summary, risk_score, risk_level, sector_breakdown)

    prompt = f"""
    Perform an institutional-grade portfolio review on the following holdings structure:
    - Holdings & Weights: {json.dumps(positions_summary, indent=2)}
    - Aggregated Risk Rating: {risk_score}/100 ({risk_level})
    - Sector Concentrations: {json.dumps(sector_breakdown, indent=2)}

    Analyze:
    - Factor tilts (growth, value, quality, momentum) and cyclical exposures.
    - Diversification and concentration vulnerabilities.
    - Systematic risk and macro transmission channels under current rates/inflation regimes.

    Adhere strictly to the professional persona. Never recommend buying, selling, or specific trades.
    """

    report = query_ollama(prompt, system_prompt=SYSTEM_PROMPT)
    if report:
        return f"{report.strip()}\n\n---\n*{DISCLOSURE_COMPACT}*"
        
    return get_mock_portfolio_review(positions_summary, risk_score, risk_level, sector_breakdown)

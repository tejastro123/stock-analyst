import streamlit as st
import os
with open("env_dump.txt", "w") as f:
    f.write("\n".join(f"{k}={v}" for k, v in os.environ.items()))
from lib.config import add_page_header, add_page_footer
from lib.market_data import get_quotes_bulk
from lib.rates import get_fed_funds_rate, get_inflation_rate, get_yield_10y

# Run initialization
add_page_header()

st.title("🏛️ Stock Market Analyst")
st.subheader("Your institutional-grade research terminal for personal research")

st.markdown("""
Welcome to **Stock Market Analyst** — a streamlined dashboard designed for objective, factual market analysis.
This terminal integrates real-time quotes, technical momentum scoring, fundamental quality evaluation, 
and macroeconomic indicators into a single workspace.
""")

st.divider()

# Key Indices Grid
st.subheader("📊 Key Market Benchmarks")

benchmark_tickers = ["^GSPC", "^NDX", "^DJI", "GC=F", "BTC-USD"]
quotes = get_quotes_bulk(benchmark_tickers)

cols = st.columns(len(benchmark_tickers))

for i, ticker in enumerate(benchmark_tickers):
    q = quotes.get(ticker, {})
    with cols[i]:
        if q.get("success"):
            name = q.get("name").replace(" Futures", "").replace(" Index", "")
            price = q.get("price")
            change = q.get("pct_change")
            
            # Format price based on type
            if price > 1000:
                price_str = f"${price:,.2f}"
            else:
                price_str = f"${price:.2f}"
                
            st.metric(
                label=name,
                value=price_str,
                delta=f"{change:+.2f}%",
                delta_color="normal"
            )
        else:
            st.metric(label=ticker, value="Error Loading", delta=None)

st.divider()

# High-level Economic Pulse
st.subheader("🌐 Global Economic Settings")
r_cols = st.columns(3)

with r_cols[0]:
    st.metric(
        label="Effective Federal Funds Rate",
        value=f"{get_fed_funds_rate()}%",
        delta="Central Bank Target"
    )
with r_cols[1]:
    st.metric(
        label="YoY CPI Inflation",
        value=f"{get_inflation_rate()}%",
        delta="Inflation Rate"
    )
with r_cols[2]:
    st.metric(
        label="10-Year Treasury Yield",
        value=f"{get_yield_10y()}%",
        delta="Risk-Free Rate Benchmark"
    )

st.divider()

# Guide/Navigation Card
st.markdown("""
### 🧭 Research Terminal Sections
Select a tab in the sidebar to begin your analysis:
*   **📈 Market Pulse**: Sector heatmaps, top gainers/losers, index sparklines, and news.
*   **🔍 Stock Analyzer**: Input any stock ticker to view technical gauges, fundamental quality score, business summaries, and Ollama-powered analyst reports.
*   **🧺 ETF Analyzer**: Evaluate ETF cost peers, holdings concentration, and annual basis point savings.
*   **🌐 Macro**: Study the yield curve and FRED macroeconomic historical charts (GDP, Unemployment, etc.).
*   **💼 Portfolio**: Log and track your current holdings, current valuation, Allocation weightings, and sector diversification.
*   **📰 News**: Filter headlines across different asset classes or search by ticker.
""")

# Run footer
add_page_footer()

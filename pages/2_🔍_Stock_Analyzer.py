import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from lib.config import add_page_header, add_page_footer
from lib.market_data import get_quote, get_history, get_stock_fundamentals, is_etf
from lib.charts import render_price_chart
from lib.logos import get_logo_data_url
from lib.signals import compute_scores
from lib.claude_analyst import generate_bull_bear_case, generate_deep_analysis
from lib.news import get_ticker_news
from lib.tv_mcp import tv_health_check, chart_set_symbol, capture_screenshot, data_get_study_values

# Run init
add_page_header()

st.title("🔍 Stock Analyzer")

# Search and parameters
# Check session state for ticker sync
default_ticker = st.session_state.get("ticker", "AAPL")

search_cols = st.columns([0.4, 0.6])
with search_cols[0]:
    ticker = st.text_input("Enter Equity Ticker Symbol (e.g. AAPL, NVDA, TSLA):", value=default_ticker).upper().strip()
    if ticker != default_ticker:
        st.session_state["ticker"] = ticker
with search_cols[1]:
    period = st.select_slider(
        "Select Chart Timeframe:",
        options=["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "Max"],
        value="6M",
        key="stock_slider"
    )

st.divider()

if not ticker:
    st.info("Please enter a ticker symbol above to start your analysis.")
    st.stop()

# Load Data
with st.spinner(f"Loading data for {ticker}..."):
    quote = get_quote(ticker)
    
    if not quote.get("success"):
        st.error(f"Could not load data for symbol '{ticker}'. Verify it exists on Yahoo Finance.")
        st.stop()
        
    # Check if ETF
    if is_etf(ticker):
        st.warning(f"'{ticker}' is classified as an Exchange Traded Fund (ETF). Please use the dedicated ETF Analyzer page for full analysis.")
        
    df = get_history(ticker, period)
    fundamentals = get_stock_fundamentals(ticker)
    news = get_ticker_news(ticker)

# 1. Header row with 64px logo
logo_url = get_logo_data_url(ticker)
name = quote.get("name", ticker)
sector = fundamentals.get("sector") or "N/A"
industry = fundamentals.get("industry") or "N/A"

st.markdown(f"""
<div style="display: flex; align-items: center; margin-bottom: 20px; border: 1px solid #2a2e39; border-radius: 8px; padding: 15px; background: #131722;">
    <img src="{logo_url}" width="64" height="64" style="border-radius: 50%; margin-right: 20px; background: #2a2e39; padding: 4px;" />
    <div style="flex-grow: 1;">
        <h1 style="margin: 0; font-size: 26px; color: #ffffff;">{name} ({ticker})</h1>
        <p style="margin: 3px 0 0 0; color: gray; font-size: 15px;">{sector} • {industry}</p>
    </div>
</div>
""", unsafe_allow_html=True)

# Metric Tiles
metrics_cols = st.columns(4)
with metrics_cols[0]:
    st.metric(
        label="Last Traded Price",
        value=f"${quote.get('price'):.2f}",
        delta=f"{quote.get('pct_change'):+.2f}%"
    )
with metrics_cols[1]:
    cap = fundamentals.get("market_cap") or 0.0
    if cap >= 1e12:
        cap_str = f"${cap/1e12:.2f}T"
    elif cap >= 1e9:
        cap_str = f"${cap/1e9:.2f}B"
    else:
        cap_str = f"${cap/1e6:.2f}M"
    st.metric(label="Market Capitalization", value=cap_str)
    
with metrics_cols[2]:
    pe = fundamentals.get("pe_trailing")
    pe_str = f"{pe:.1f}" if pe else "N/A"
    st.metric(label="Trailing P/E Ratio", value=pe_str)
    
with metrics_cols[3]:
    beta = fundamentals.get("beta")
    beta_str = f"{beta:.2f}" if beta else "N/A"
    st.metric(label="Historical Beta (5Y)", value=beta_str)

st.divider()

# 2. Main interactive Chart
st.subheader("📊 Price Chart Analyst")
chart_view = st.segmented_control(
    "Select Chart View:",
    options=["Candlestick", "Price", "Performance", "Area"],
    default="Candlestick",
    key="chart_view_ctrl"
)

baseline_price = quote.get("prev_close") if period == "1D" else None
fig = render_price_chart(df, ticker, chart_view, baseline_price)
st.plotly_chart(fig, width='stretch')

# 🔌 TradingView Desktop Integration Controls
st.markdown("### 🔌 Live TradingView Desktop Control")
tv_health = tv_health_check()
if tv_health.get("success") and tv_health.get("cdp_connected"):
    tv_cols = st.columns(3)
    with tv_cols[0]:
        if st.button("🔄 Sync Analyzer Ticker with Chart", help="Read the active symbol on your TradingView Desktop app"):
            tv_sym = tv_health.get("chart_symbol", ticker)
            st.session_state["ticker"] = tv_sym
            st.rerun()
    with tv_cols[1]:
        if st.button("📤 Push Ticker to TradingView Chart", help=f"Set your TradingView Desktop app chart to {ticker}"):
            push_res = chart_set_symbol(ticker)
            if push_res.get("success"):
                st.success(f"Pushed {ticker} to TradingView!")
                st.rerun()
            else:
                st.error(f"Failed to push: {push_res.get('error')}")
    with tv_cols[2]:
        if st.button("📸 Capture Live Chart Snapshot", help="Take a snapshot of your live TradingView Desktop window"):
            with st.spinner("Capturing screenshot..."):
                from datetime import datetime
                snap_res = capture_screenshot(region="chart", filename=f"streamlit_{ticker}")
                if snap_res.get("success"):
                    st.session_state["tv_screenshot_path"] = snap_res.get("file_path")
                    st.session_state["tv_screenshot_time"] = datetime.now().strftime("%H:%M:%S")
                    st.success("Screenshot captured!")
                    st.rerun()
                else:
                    st.error(f"Failed to capture: {snap_res.get('error')}")
                    
    # Display screenshot if captured
    if "tv_screenshot_path" in st.session_state and st.session_state["tv_screenshot_path"]:
        st.info(f"Showing screenshot captured at {st.session_state['tv_screenshot_time']}:")
        st.image(st.session_state["tv_screenshot_path"], caption=f"TradingView Chart Screenshot for {ticker}")

    # Display indicator readings
    with st.expander("📊 View Live Indicator Values from Chart"):
        with st.spinner("Fetching indicator values..."):
            study_values = data_get_study_values()
            if study_values.get("success"):
                studies = study_values.get("studies", [])
                if studies:
                    for s in studies:
                        st.markdown(f"**{s.get('name')}**")
                        vals = s.get("values", {})
                        for k, v in vals.items():
                            st.markdown(f"* **{k}**: `{v}`")
                else:
                    st.info("No studies/indicators found on the active TradingView chart.")
            else:
                st.error(f"Could not fetch indicator values: {study_values.get('error')}")
else:
    st.info("TradingView Desktop is disconnected. Launch it via the sidebar to enable live chart controls, symbol syncing, and screenshots.")

st.divider()

# 3. Snapshot section with Gauges and At a glance
scores = compute_scores(df, fundamentals)

st.subheader("🔍 Factual Strength Assessment")
st.markdown("<p style='font-size:14px; color:gray;'>An objective, mathematical aggregation of technical and fundamental attributes.</p>", unsafe_allow_html=True)

snapshot_cols = st.columns([0.34, 0.33, 0.33])

with snapshot_cols[0]:
    st.markdown("""
    <div style="border: 1px solid #2a2e39; border-radius: 6px; padding: 12px; background: #131722; height: 100%;">
        <p style="font-weight: bold; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #2a2e39; padding-bottom: 5px;">At a Glance</p>
    """, unsafe_allow_html=True)
    
    # 7 Chips list
    buckets = scores["buckets"]
    for label, val in buckets.items():
        st.markdown(f"""
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
            <span style="color: gray;">{label}:</span>
            <span style="font-weight: bold; color: #3b82f6;">{val}</span>
        </div>
        """, unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

def draw_gauge_chart(score, label, subtitle, key=None):
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=score,
        domain={'x': [0, 1], 'y': [0, 1]},
        gauge={
            'axis': {'range': [None, 100], 'tickwidth': 1, 'tickcolor': "white"},
            'bar': {'color': "white"},
            'bgcolor': "rgba(0,0,0,0)",
            'borderwidth': 1.5,
            'bordercolor': "#2a2e39",
            'steps': [
                {'range': [0, 35], 'color': '#ef5350'},
                {'range': [35, 70], 'color': '#ffb74d'},
                {'range': [70, 100], 'color': '#26a69a'}
            ],
        }
    ))
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': "white", 'size': 11, 'family': "sans-serif"},
        height=140,
        margin=dict(l=15, r=15, t=10, b=10)
    )
    st.markdown(f"<p style='font-weight:bold; font-size:15px; margin-bottom:2px; text-align:center;'>{label}</p>", unsafe_allow_html=True)
    st.markdown(f"<p style='font-size:11px; color:gray; margin-bottom:2px; text-align:center;'>{subtitle}</p>", unsafe_allow_html=True)
    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False}, key=key)

with snapshot_cols[1]:
    st.markdown("<div style='border: 1px solid #2a2e39; border-radius: 6px; padding: 12px; background: #131722; height: 100%;'>", unsafe_allow_html=True)
    draw_gauge_chart(scores["tech_score"], "Technical Strength", "Trend, momentum, position vs averages", key="tech_gauge")
    st.markdown("<p style='font-weight:bold; font-size:13px; margin-top:10px;'>Drivers:</p>", unsafe_allow_html=True)
    for b in scores["bullets_tech"]:
        st.markdown(f"<li style='font-size:13px; color:#d1d5db;'>{b}</li>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

with snapshot_cols[2]:
    st.markdown("<div style='border: 1px solid #2a2e39; border-radius: 6px; padding: 12px; background: #131722; height: 100%;'>", unsafe_allow_html=True)
    draw_gauge_chart(scores["fund_score"], "Fundamental Quality", "Margins, returns, leverage, growth", key="fund_gauge")
    st.markdown("<p style='font-weight:bold; font-size:13px; margin-top:10px;'>Drivers:</p>", unsafe_allow_html=True)
    for b in scores["bullets_fund"]:
        st.markdown(f"<li style='font-size:13px; color:#d1d5db;'>{b}</li>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

st.divider()

# 4. Key statistics grid
st.subheader("📊 Key Financial Statistics")
stat_cols = st.columns(3)

with stat_cols[0]:
    st.markdown("**Valuation**")
    st.write(f"Trailing P/E: {fundamentals.get('pe_trailing') or 'N/A'}")
    st.write(f"Forward P/E: {fundamentals.get('pe_forward') or 'N/A'}")
    st.write(f"Price-to-Book: {fundamentals.get('price_to_book') or 'N/A'}")

with stat_cols[1]:
    st.markdown("**Profitability**")
    st.write(f"Return on Equity (ROE): {fundamentals.get('roe'):.2f}%" if fundamentals.get('roe') else "ROE: N/A")
    st.write(f"Profit Margin: {fundamentals.get('profit_margin'):.2f}%" if fundamentals.get('profit_margin') else "Margin: N/A")
    st.write(f"Dividend Yield: {fundamentals.get('dividend_yield'):.2f}%" if fundamentals.get('dividend_yield') else "Yield: N/A")

with stat_cols[2]:
    st.markdown("**Balance Sheet & Trading**")
    st.write(f"Debt-to-Equity: {fundamentals.get('debt_to_equity') or 'N/A'}")
    st.write(f"Historical Beta: {fundamentals.get('beta') or 'N/A'}")
    st.write(f"Market Cap: {cap_str}")

# Expandable Business Summary
with st.expander("📖 View Long Business Summary"):
    st.write(fundamentals.get("business_summary") or "No business summary available.")

st.divider()

# 5. AI analysis tabs
st.subheader("🤖 AI Research Assistant")
ai_tabs = st.tabs(["Bull/Bear Cases (Ollama)", "Deep Stock Report (Ollama)", "Recent News Context"])

from lib.claude_analyst import is_ollama_online

with ai_tabs[0]:
    if not is_ollama_online():
        st.warning("⚠️ Local Ollama is offline. Displaying pre-cached research notes.")
    with st.spinner("Generating bull/bear analysis..."):
        bb = generate_bull_bear_case(ticker, fundamentals)
    
    if "warning" in bb:
        st.warning(bb["warning"])
        
    bb_cols = st.columns(2)
    with bb_cols[0]:
        st.success("🟢 Bull Considerations")
        for bullet in bb.get("bull", []):
            st.markdown(f"* {bullet}")
    with bb_cols[1]:
        st.error("🔴 Bear Considerations")
        for bullet in bb.get("bear", []):
            st.markdown(f"* {bullet}")

with ai_tabs[1]:
    if not is_ollama_online():
        st.warning("⚠️ Local Ollama is offline. Displaying pre-cached research notes.")
    with st.spinner("Compiling equity research report..."):
        report = generate_deep_analysis(ticker, quote, fundamentals, news)
    st.markdown(report)

with ai_tabs[2]:
    st.markdown(f"#### Recent news coverage for {ticker}")
    if news:
        for idx, item in enumerate(news[:5]):
            st.markdown(f"""
            <div style="padding: 10px; border: 1px solid #2a2e39; border-radius: 4px; background: #131722; margin-bottom: 8px;">
                <span style="font-weight: bold; font-size: 15px;"><a href="{item['link']}" target="_blank" style="color: #3b82f6; text-decoration: none;">{item['title']}</a></span><br/>
                <span style="font-size: 11px; color: gray;">{item['publisher']} • {item['pubDate']}</span>
                <p style="font-size: 13px; margin-top: 4px; color: #d1d5db;">{item['summary']}</p>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.write("No recent news headlines found.")

add_page_footer()

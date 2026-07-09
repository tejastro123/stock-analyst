import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import os
from lib.config import add_page_header, add_page_footer
from lib.macro import get_yield_curve, get_macro_indicator, search_fred_series
from lib.rates import get_fed_funds_rate, get_inflation_rate, get_yield_10y, get_spread_10y_2y
from lib.claude_analyst import generate_macro_pulse_check, is_ollama_online

# Run init
add_page_header()

st.title("🌐 Macroeconomic Indicators")

if not os.getenv("FRED_API_KEY"):
    st.warning("⚠️ FRED API Key is missing. Add `FRED_API_KEY` to your `.env` file to load live Federal Reserve Economic Data. Currently displaying educational fallbacks.")

if not is_ollama_online():
    st.warning("⚠️ Local Ollama is offline. Add metrics to `.env` or start Ollama to generate live reports. Displaying cached analysis.")

# 1. Yield Curve Chart
st.subheader("🇺🇸 U.S. Treasury Yield Curve")
st.markdown("<p style='font-size:14px; color:gray;'>Plots yields of standard-maturity U.S. Treasury bonds. An inverted curve is a historical indicator of economic deceleration.</p>", unsafe_allow_html=True)

with st.spinner("Loading Treasury yields..."):
    df_yield = get_yield_curve()

fig_yield = go.Figure(go.Scatter(
    x=df_yield["Maturity"],
    y=df_yield["Yield"],
    mode="lines+markers",
    line=dict(color="#3b82f6", width=3),
    marker=dict(size=8, color="#ffffff", line=dict(color="#3b82f6", width=2)),
    name="Yield"
))

fig_yield.update_layout(
    template="plotly_dark",
    plot_bgcolor="#131722",
    paper_bgcolor="#131722",
    margin=dict(l=40, r=40, t=20, b=20),
    height=320,
    xaxis=dict(gridcolor="#2a2e39", title="Maturity"),
    yaxis=dict(gridcolor="#2a2e39", title="Yield (%)", side="right")
)
st.plotly_chart(fig_yield, width='stretch')

st.divider()

# 2. Historical Charts Tabs
st.subheader("📈 Macroeconomic Time Series")

macro_tabs = st.tabs(["Inflation & Policy", "Economic Activity", "Labor & Spreads", "Search FRED Database 🔍"])

with macro_tabs[0]:
    with st.spinner("Loading inflation and policy rates..."):
        df_cpi = get_macro_indicator("CPIAUCSL", calculate_yoy=True)
        df_core_cpi = get_macro_indicator("CPILFESL", calculate_yoy=True)
        df_fedfunds = get_macro_indicator("FEDFUNDS")
        
    fig_policy = go.Figure()
    fig_policy.add_trace(go.Scatter(x=df_fedfunds["Date"], y=df_fedfunds["Value"], name="Federal Funds Rate", line=dict(color="#3b82f6", width=2)))
    fig_policy.add_trace(go.Scatter(x=df_cpi["Date"], y=df_cpi["Value"], name="CPI Inflation YoY", line=dict(color="#ef5350", width=2)))
    fig_policy.add_trace(go.Scatter(x=df_core_cpi["Date"], y=df_core_cpi["Value"], name="Core CPI Inflation YoY", line=dict(color="#f43f5e", width=1.5, dash="dash")))
    
    fig_policy.update_layout(
        template="plotly_dark",
        plot_bgcolor="#131722",
        paper_bgcolor="#131722",
        height=380,
        margin=dict(l=20, r=40, t=10, b=20),
        xaxis=dict(gridcolor="#2a2e39"),
        yaxis=dict(gridcolor="#2a2e39", title="Rate (%)", side="right"),
        hovermode="x unified"
    )
    st.plotly_chart(fig_policy, width='stretch')

with macro_tabs[1]:
    with st.spinner("Loading growth indicators..."):
        df_gdp = get_macro_indicator("GDPC1")
        df_retail = get_macro_indicator("RSXFS", calculate_yoy=True)
        df_indpro = get_macro_indicator("INDPRO", calculate_yoy=True)
        
    # GDP and industrial production/retail sales
    fig_activity = go.Figure()
    fig_activity.add_trace(go.Scatter(x=df_retail["Date"], y=df_retail["Value"], name="Retail Sales YoY (%)", line=dict(color="#26a69a", width=1.5)))
    fig_activity.add_trace(go.Scatter(x=df_indpro["Date"], y=df_indpro["Value"], name="Industrial Production YoY (%)", line=dict(color="#eab308", width=1.5)))
    
    fig_activity.update_layout(
        template="plotly_dark",
        plot_bgcolor="#131722",
        paper_bgcolor="#131722",
        height=380,
        margin=dict(l=20, r=40, t=10, b=20),
        xaxis=dict(gridcolor="#2a2e39"),
        yaxis=dict(gridcolor="#2a2e39", title="YoY Change (%)", side="right"),
        hovermode="x unified"
    )
    st.plotly_chart(fig_activity, width='stretch')
    
    # Render GDP separately (due to unit difference)
    st.markdown("**Real Gross Domestic Product (GDP)**")
    fig_gdp = go.Figure(go.Scatter(x=df_gdp["Date"], y=df_gdp["Value"], name="Real GDP (Billions)", fill="tozeroy", line=dict(color="#a855f7", width=2.5)))
    fig_gdp.update_layout(
        template="plotly_dark",
        plot_bgcolor="#131722",
        paper_bgcolor="#131722",
        height=240,
        margin=dict(l=20, r=40, t=10, b=20),
        xaxis=dict(gridcolor="#2a2e39"),
        yaxis=dict(gridcolor="#2a2e39", title="Billions of $", side="right")
    )
    st.plotly_chart(fig_gdp, width='stretch')

with macro_tabs[2]:
    with st.spinner("Loading labor and spread indicators..."):
        df_unrate = get_macro_indicator("UNRATE")
        df_spread = get_macro_indicator("T10Y2Y")
        
    fig_spread = go.Figure()
    fig_spread.add_trace(go.Scatter(x=df_spread["Date"], y=df_spread["Value"], name="10Y-2Y Spread", line=dict(color="#ec4899", width=2)))
    fig_spread.add_trace(go.Scatter(x=df_unrate["Date"], y=df_unrate["Value"], name="Unemployment Rate (%)", line=dict(color="#06b6d4", width=2, dash="dot")))
    
    # Add horizontal line at 0 for spread crossing
    fig_spread.add_shape(
        type="line",
        x0=df_spread["Date"].iloc[0] if not df_spread.empty else None,
        x1=df_spread["Date"].iloc[-1] if not df_spread.empty else None,
        y0=0.0, y1=0.0,
        line=dict(color="gray", width=1, dash="dash")
    )
    
    fig_spread.update_layout(
        template="plotly_dark",
        plot_bgcolor="#131722",
        paper_bgcolor="#131722",
        height=380,
        margin=dict(l=20, r=40, t=10, b=20),
        xaxis=dict(gridcolor="#2a2e39"),
        yaxis=dict(gridcolor="#2a2e39", title="Percent (%)", side="right"),
        hovermode="x unified"
    )
    st.plotly_chart(fig_spread, width='stretch')

with macro_tabs[3]:
    st.subheader("🔍 Search Federal Reserve Database")
    st.markdown("<p style='font-size:14px; color:gray;'>Search FRED for custom economic indicators by keyword (e.g. 'Canada', 'GDP', 'Housing', 'M2').</p>", unsafe_allow_html=True)
    
    search_q = st.text_input("Enter Search Keyword:", value="Canada", key="fred_search_input").strip()
    
    if search_q:
        with st.spinner(f"Searching FRED for '{search_q}'..."):
            df_results = search_fred_series(search_q)
            
        if not df_results.empty:
            st.success(f"Found {len(df_results)} series matching '{search_q}':")
            
            # Display results table
            st.dataframe(
                df_results,
                column_config={
                    "id": st.column_config.TextColumn("Series ID", width="medium"),
                    "title": st.column_config.TextColumn("Title", width="large"),
                    "frequency": st.column_config.TextColumn("Frequency"),
                    "units": st.column_config.TextColumn("Units"),
                    "notes": st.column_config.TextColumn("Notes", width="large")
                },
                hide_index=True
            )
            
            # Allow plotting the selected series
            series_options = df_results["id"].tolist()
            selected_series = st.selectbox(
                "Select a Series ID to plot:",
                options=series_options,
                format_func=lambda x: f"{x} - {df_results[df_results['id'] == x]['title'].values[0]}"
            )
            
            if selected_series:
                with st.spinner(f"Loading data for series {selected_series}..."):
                    df_series = get_macro_indicator(selected_series)
                    
                if not df_series.empty:
                    fig_custom = go.Figure(go.Scatter(
                        x=df_series["Date"],
                        y=df_series["Value"],
                        name=selected_series,
                        line=dict(color="#3b82f6", width=2.5)
                    ))
                    fig_custom.update_layout(
                        template="plotly_dark",
                        plot_bgcolor="#131722",
                        paper_bgcolor="#131722",
                        height=350,
                        margin=dict(l=20, r=40, t=20, b=20),
                        xaxis=dict(gridcolor="#2a2e39"),
                        yaxis=dict(gridcolor="#2a2e39", title="Value", side="right"),
                        hovermode="x unified"
                    )
                    st.plotly_chart(fig_custom, width='stretch')
                else:
                    st.warning("No data found for this series.")
        else:
            st.info("No matching series found.")

st.divider()

# 3. AI Macro Pulse Check (Button Triggered)
st.subheader("🤖 AI Macro Pulse-Check")
st.markdown("<p style='font-size:14px; color:gray;'>Click the button to request the Ollama research analyst to compile a macroeconomic health summary.</p>", unsafe_allow_html=True)

if st.button("Generate Macro Pulse-Check", type="primary"):
    rates_data = {
        "fed_funds": get_fed_funds_rate(),
        "inflation": get_inflation_rate(),
        "yield_10y": get_yield_10y(),
        "spread_10y_2y": get_spread_10y_2y()
    }
    
    with st.spinner("Analyzing macroeconomic conditions with local Ollama..."):
        pulse_report = generate_macro_pulse_check(rates_data)
        
    st.markdown(pulse_report)
else:
    st.info("Analysis report is ready. Click the button above to generate.")

add_page_footer()

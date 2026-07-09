import streamlit as st

DISCLOSURE = """
This dashboard is for educational and informational purposes only. It is not financial advice, 
not a recommendation to buy or sell any security, and is not personalized to your situation. 
Consult a licensed advisor before making investment decisions.
"""

def add_page_header():
    """Sets up page configs and sidebar branding."""
    st.set_page_config(
        page_title="Stock Market Analyst",
        page_icon="🏛️",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # Custom styling for larger font size on main content
    st.markdown("""
        <style>
        .stMarkdown p, .stMarkdown li, .stText, .stDataFrame, div[data-testid="stMetricValue"] {
            font-size: 17px !important;
        }
        div[data-testid="stMetricLabel"] p {
            font-size: 13px !important;
        }
        </style>
    """, unsafe_allow_html=True)
    
    # Sidebar branding
    st.sidebar.markdown("## 🏛️ Market Analyst")
    st.sidebar.divider()

    # TradingView Desktop Connection Panel in Sidebar
    st.sidebar.markdown("### 🔌 TradingView Desktop")
    
    # Import inside the function to avoid circular imports or import issues during startup
    from lib.tv_mcp import tv_health_check, tv_launch, chart_get_state
    
    try:
        health = tv_health_check()
        if health.get("success") and health.get("cdp_connected"):
            # Try to get active symbol
            sym = health.get("chart_symbol", "Unknown")
            tf = health.get("chart_resolution", "Unknown")
            st.sidebar.success(f"🟢 Connected\n\n**Symbol:** {sym}\n\n**Timeframe:** {tf}")
            
            # Offer sync button
            if st.sidebar.button("🔄 Sync Sidebar Ticker", key="sb_sync_tv"):
                st.session_state["ticker"] = sym
                st.rerun()
        else:
            st.sidebar.warning("🔴 Disconnected (CDP Not Active)")
            if st.sidebar.button("🔌 Launch Debug Mode", key="sb_launch_tv"):
                st.sidebar.info("Launching TradingView...")
                launch_res = tv_launch(kill_existing=True)
                if launch_res.get("success"):
                    st.sidebar.success("TradingView launched! Refreshing...")
                    st.rerun()
                else:
                    st.sidebar.error(f"Failed to launch: {launch_res.get('error')}")
    except Exception as e:
        st.sidebar.error(f"Status check error: {e}")
        
    st.sidebar.divider()

def add_page_footer():
    """Appends the legal disclosure at the bottom of the page."""
    st.divider()
    st.markdown(f"<p style='font-size:12px; color:gray; text-align:center;'>{DISCLOSURE}</p>", unsafe_allow_html=True)

import streamlit as st
from lib.config import add_page_header, add_page_footer
from lib.news import get_market_news, get_ticker_news
from lib.logos import get_logo_data_url
from lib.market_data import get_quote

# Run init
add_page_header()

st.title("📰 News Center")
st.markdown("<p style='font-size:14px; color:gray;'>Aggregated institutional news coverage and equity-specific research headlines.</p>", unsafe_allow_html=True)

st.divider()

news_tabs = st.tabs(["Market Headlines", "By-Ticker Search"])

with news_tabs[0]:
    st.subheader("🌐 Global Market News")
    with st.spinner("Fetching market news RSS feed..."):
        headlines = get_market_news()
        
    if headlines:
        for idx, h in enumerate(headlines):
            st.markdown(f"""
            <div style="padding: 15px; border: 1px solid #2a2e39; border-radius: 6px; background: #131722; margin-bottom: 12px;">
                <span style="font-weight: bold; font-size: 16px;">
                    <a href="{h['link']}" target="_blank" style="color: #3b82f6; text-decoration: none;">{h['title']}</a>
                </span><br/>
                <span style="font-size: 12px; color: gray;">{h['publisher']} • {h['pubDate']}</span>
                <p style="font-size: 14px; margin-top: 6px; color: #d1d5db; line-height: 1.4;">{h['summary']}</p>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.info("No market headlines found. Check your internet connection.")

with news_tabs[1]:
    st.subheader("🔍 Search Equity News")
    
    search_ticker = st.text_input("Enter Ticker to Search News (e.g. AAPL, TSLA, MSFT):", value="AAPL").upper().strip()
    
    if search_ticker:
        with st.spinner(f"Loading news for {search_ticker}..."):
            t_news = get_ticker_news(search_ticker)
            quote = get_quote(search_ticker)
            
        if quote.get("success"):
            logo_url = get_logo_data_url(search_ticker)
            name = quote["name"]
            st.markdown(f"""
            <div style="display: flex; align-items: center; margin-bottom: 15px; border: 1px solid #2a2e39; border-radius: 6px; padding: 10px; background: #131722; width: max-content;">
                <img src="{logo_url}" width="36" height="36" style="border-radius: 50%; margin-right: 12px; background: #2a2e39; padding: 2px;" />
                <div>
                    <span style="font-weight: bold; font-size: 15px; color:#ffffff;">{name} ({search_ticker})</span><br/>
                    <span style="font-size: 12px; color:gray;">Recent coverage</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            if t_news:
                for idx, item in enumerate(t_news):
                    st.markdown(f"""
                    <div style="padding: 15px; border: 1px solid #2a2e39; border-radius: 6px; background: #131722; margin-bottom: 12px;">
                        <span style="font-weight: bold; font-size: 16px;">
                            <a href="{item['link']}" target="_blank" style="color: #3b82f6; text-decoration: none;">{item['title']}</a>
                        </span><br/>
                        <span style="font-size: 12px; color: gray;">{item['publisher']} • {item['pubDate']}</span>
                        <p style="font-size: 14px; margin-top: 6px; color: #d1d5db; line-height: 1.4;">{item['summary']}</p>
                    </div>
                    """, unsafe_allow_html=True)
            else:
                st.write(f"No specific news found for '{search_ticker}'.")
        else:
            st.error(f"Could not resolve symbol '{search_ticker}'.")
    else:
        st.info("Enter a ticker symbol in the search input above.")

add_page_footer()

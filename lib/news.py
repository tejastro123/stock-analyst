import yfinance as yf
import requests
import xml.etree.ElementTree as ET
import streamlit as st
from datetime import datetime

@st.cache_data(ttl=300)
def get_ticker_news(ticker: str) -> list:
    """Fetches ticker-specific news using yfinance."""
    try:
        t = yf.Ticker(ticker)
        raw_news = t.news
        if not raw_news:
            return []
            
        news_items = []
        for item in raw_news:
            # Map parameters safely
            news_items.append({
                "title": item.get("title", ""),
                "publisher": item.get("publisher", "Yahoo Finance"),
                "link": item.get("link", "#"),
                "pubDate": datetime.fromtimestamp(item.get("providerPublishTime", 0)).strftime("%Y-%m-%d %H:%M"),
                "summary": item.get("summary", "")
            })
        return news_items[:10]
    except Exception:
        return []

@st.cache_data(ttl=600)
def get_market_news() -> list:
    """Aggregates top market news headlines via Yahoo Finance RSS feed."""
    url = "https://finance.yahoo.com/news/rssindex"
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code != 200:
            return []
            
        root = ET.fromstring(r.content)
        items = []
        for item in root.findall(".//item")[:10]:
            title = item.find("title").text if item.find("title") is not None else "Market Update"
            link = item.find("link").text if item.find("link") is not None else "#"
            pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
            desc = item.find("description").text if item.find("description") is not None else ""
            
            # Clean up HTML tags if present in description
            if desc and "<" in desc:
                # Basic tags removal
                import re
                desc = re.sub('<[^<]+?>', '', desc)
                
            items.append({
                "title": title,
                "publisher": "Yahoo Finance",
                "link": link,
                "pubDate": pub_date,
                "summary": desc
            })
        return items
    except Exception:
        return []

from fastapi import APIRouter, HTTPException
import yfinance as yf
from utils import normalize_symbol

router = APIRouter(prefix="/news", tags=["news"])

@router.get("/{symbol}")
def get_news(symbol: str, market: str = "US"):
    yf_sym = normalize_symbol(symbol, market)
    try:
        ticker = yf.Ticker(yf_sym)
        news_items = ticker.news
        if not news_items:
            news_items = []
            
        # Standardize structure
        formatted_news = []
        for item in news_items:
            formatted_news.append({
                "uuid": item.get("uuid"),
                "title": item.get("title"),
                "publisher": item.get("publisher"),
                "link": item.get("link"),
                "time": item.get("providerPublishTime"),
                "type": item.get("type"),
                "related": item.get("relatedTickers", [])
            })
        return {"symbol": symbol.upper(), "market": market, "news": formatted_news}
    except Exception as e:
        raise HTTPException(502, f"yfinance error fetching news: {str(e)}")

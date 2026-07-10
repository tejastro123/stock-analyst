"""
QuantDesk Python Data Microservice
Port: 8000
"""
import os
from dotenv import load_dotenv
load_dotenv()

import requests
# Monkey patch requests.Session globally to spoof User-Agent and bypass Yahoo Finance Crumb errors
_orig_session_init = requests.Session.__init__
def _patched_session_init(self, *args, **kwargs):
    _orig_session_init(self, *args, **kwargs)
    self.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
requests.Session.__init__ = _patched_session_init

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import cache
from routers import quotes, ohlcv, fundamentals, options, screener, sector, market_metrics, news, macro, backtester, risk

app = FastAPI(
    title="QuantDesk Data Service",
    description="yfinance-powered market data microservice for QuantDesk terminal",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow Node backend + frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://localhost:5173",
        os.getenv("FRONTEND_URL", "http://localhost:5173"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(quotes.router)
app.include_router(ohlcv.router)
app.include_router(fundamentals.router)
app.include_router(options.router)
app.include_router(screener.router)
app.include_router(sector.router)
app.include_router(market_metrics.router)
app.include_router(news.router)
app.include_router(macro.router)
app.include_router(backtester.router)
app.include_router(risk.router)



@app.get("/")
def root():
    return {
        "service": "QuantDesk Data Microservice",
        "version": "1.0.0",
        "endpoints": {
            "quote":        "/quotes/{symbol}?market=US",
            "batch_quotes": "POST /quotes/batch",
            "ohlcv":        "/ohlcv/{symbol}?period=6mo&interval=1d",
            "fundamentals": "/fundamentals/{symbol}",
            "options":      "/options/{symbol}",
            "screener":     "POST /screener/run",
            "universe":     "/screener/universe?market=US",
            "cache_stats":  "/cache/stats",
            "docs":         "/docs",
        }
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "py-data-service", "cache": cache.stats()}


@app.get("/cache/stats")
def cache_stats():
    return cache.stats()


@app.delete("/cache")
def clear_cache(pool: str = None):
    cache.clear(pool)
    return {"cleared": pool or "all"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")

"""
In-memory TTL cache — replaces Redis for Day 2.
Uses cachetools.TTLCache per data type with appropriate TTL.
"""
from cachetools import TTLCache
import threading

# Thread-safe lock for cache operations
_lock = threading.Lock()

# TTLs (seconds)
TTL_QUOTE       = 15       # 15s  — live price
TTL_OHLCV       = 60       # 1m   — candles
TTL_FUNDAMENTALS = 3600    # 1h   — company info
TTL_OPTIONS     = 120      # 2m   — options chain
TTL_SCREENER    = 300      # 5m   — screener results
TTL_SIGNALS     = 300      # 5m   — technical/fundamental scores
TTL_ETF         = 3600     # 1h   — ETF details & peers
TTL_INDICATORS  = 300      # 5m   — indicators cache

# Cache pools (maxsize = max unique keys per pool)
_caches: dict[str, TTLCache] = {
    "quote":        TTLCache(maxsize=2000, ttl=TTL_QUOTE),
    "ohlcv":        TTLCache(maxsize=500,  ttl=TTL_OHLCV),
    "fundamentals": TTLCache(maxsize=500,  ttl=TTL_FUNDAMENTALS),
    "options":      TTLCache(maxsize=200,  ttl=TTL_OPTIONS),
    "screener":     TTLCache(maxsize=100,  ttl=TTL_SCREENER),
    "signals":      TTLCache(maxsize=500,  ttl=TTL_SIGNALS),
    "etf":          TTLCache(maxsize=300,  ttl=TTL_ETF),
    "indicators":   TTLCache(maxsize=500,  ttl=TTL_INDICATORS),
}


def get(pool: str, key: str):
    with _lock:
        return _caches[pool].get(key)


def set(pool: str, key: str, value):
    with _lock:
        _caches[pool][key] = value


def delete(pool: str, key: str):
    with _lock:
        _caches[pool].pop(key, None)


def clear(pool: str | None = None):
    with _lock:
        if pool:
            _caches[pool].clear()
        else:
            for c in _caches.values():
                c.clear()


def stats() -> dict:
    with _lock:
        return {
            name: {"size": len(c), "maxsize": c.maxsize, "ttl": c.ttl}
            for name, c in _caches.items()
        }

import time
import asyncio
import aiohttp
import statistics

# QuantDesk API Performance & Cache Load Tester
# Tests average latencies, cache validation, and concurrent processing.

API_BASE = "http://localhost:3001"
PY_BASE = "http://localhost:8000"

# Sample token from active session (or can run without auth for python service direct tests)
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjcxODBkNGNjLWQ4ZjAtNDFjYy1hODhiLTA2ZTI3Zjg2MGIxYyIsImVtYWlsIjoidGVqYXMubWVsbGltcHVkaUBnbWFpbC5jb20iLCJ1c2VybmFtZSI6InRlamFzeCIsInJvbGUiOiJ0cmFkZXIiLCJpYXQiOjE3ODM2MDc2NzcsImV4cCI6MTc4NDIxMjQ3N30.2jrIo8q2isPmKUXvPAWpXzsvQxBlGJCM2m96XhE-qLw"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

async def fetch_endpoint(session, url, headers=None, method="GET", json_data=None):
    start = time.perf_counter()
    try:
        async with session.request(method, url, headers=headers, json=json_data) as response:
            status = response.status
            data = await response.json()
            latency = (time.perf_counter() - start) * 1000  # in ms
            is_cached = data.get("cached", False) or "cached" in str(data)
            return status, latency, is_cached
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return 500, latency, False

async def run_load_test():
    print("🚀 QUANTDESK PERFORMANCE & LOAD TESTING TOOL 🚀")
    print("==================================================")
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Cold vs Hot Cache (Quotes)
        print("\n🧪 [TEST 1] Cache Performance Analysis (Quotes API)...")
        
        # Cold Request
        status, cold_lat, _ = await fetch_endpoint(session, f"{PY_BASE}/quotes/AAPL?market=US")
        print(f"  - Cold Request (Cache Miss): {cold_lat:.2f} ms [Status: {status}]")
        
        # Hot Request
        status, hot_lat, is_cached = await fetch_endpoint(session, f"{PY_BASE}/quotes/AAPL?market=US")
        print(f"  - Hot Request (Cache Hit): {hot_lat:.2f} ms [Status: {status}, Cached: {is_cached}]")
        
        speedup = cold_lat / max(hot_lat, 0.1)
        print(f"  🔥 Speedup Ratio: {speedup:.2f}x faster with in-memory TTL cache.")

        # Test 2: Concurrent Watchlist Batch Requests
        print("\n🧪 [TEST 2] Concurrency Stress Test (30 Concurrent Quote Batch requests)...")
        tasks = []
        payload = {"symbols": ["AAPL", "TSLA", "MSFT", "GOOGL", "NVDA"], "market": "US"}
        
        for _ in range(30):
            tasks.append(fetch_endpoint(
                session, 
                f"{API_BASE}/api/market/quotes/batch", 
                headers=HEADERS, 
                method="POST", 
                json_data=payload
            ))
            
        start_batch = time.perf_counter()
        results = await asyncio.gather(*tasks)
        total_time = (time.perf_counter() - start_batch) * 1000
        
        latencies = [res[1] for res in results if res[0] == 200]
        failures = sum(1 for res in results if res[0] != 200)
        
        if latencies:
            avg_lat = statistics.mean(latencies)
            p95_lat = statistics.quantiles(latencies, n=20)[18]  # 95th percentile
            print(f"  - Total execution time: {total_time:.2f} ms")
            print(f"  - Success rate: {len(latencies)}/30 requests")
            print(f"  - Avg Latency per Request: {avg_lat:.2f} ms")
            print(f"  - P95 Latency: {p95_lat:.2f} ms")
            print(f"  - Total Failures: {failures}")
        else:
            print("  ❌ All concurrent requests failed. Verify backend and py-service are running.")

        # Test 3: Analytics Endpoint Latency (Heavy Processing)
        print("\n🧪 [TEST 3] Heavy Computational Benchmark (Portfolio API)...")
        status, port_lat, _ = await fetch_endpoint(
            session,
            f"{API_BASE}/api/portfolio",
            headers=HEADERS
        )
        print(f"  - Portfolio Position & Beta Allocation: {port_lat:.2f} ms [Status: {status}]")
        
        print("\n==================================================")
        print("🎉 Benchmark complete.")

if __name__ == "__main__":
    asyncio.run(run_load_test())

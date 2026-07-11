import requests, json

# 1. Login
login = requests.post("http://localhost:3001/api/auth/login", json={
    "email": "admin@quantdesk.local", "password": "admin123"
})
token = login.json().get("accessToken")
headers = {"Authorization": f"Bearer {token}"}

# 2. Hit py-service directly (bypasses Express)
print("=== DIRECT PY-SERVICE TEST ===")
r = requests.post("http://localhost:8000/screener/run", json={
    "market": "US", "sort_by": "market_cap", "sort_asc": False, "limit": 10
})
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:500]}")

print()

# 3. Hit via Express
print("=== VIA EXPRESS TEST ===")
r2 = requests.post("http://localhost:3001/api/market/screener",
    json={"market": "US", "sort_by": "market_cap", "sort_asc": False, "limit": 10},
    headers=headers
)
print(f"Status: {r2.status_code}")
print(f"Response: {r2.text[:500]}")

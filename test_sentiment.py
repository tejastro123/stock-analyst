import requests

url = "http://localhost:3001/api/ai/news-sentiment"
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjcxODBkNGNjLWQ4ZjAtNDFjYy1hODhiLTA2ZTI3Zjg2MGIxYyIsImVtYWlsIjoidGVqYXMubWVsbGltcHVkaUBnbWFpbC5jb20iLCJ1c2VybmFtZSI6InRlamFzeCIsInJvbGUiOiJ0cmFkZXIiLCJpYXQiOjE3ODM2MDc2NzcsImV4cCI6MTc4NDIxMjQ3N30.2jrIo8q2isPmKUXvPAWpXzsvQxBlGJCM2m96XhE-qLw"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

payload = {
    "symbol": "AAPL",
    "market": "US"
}

try:
    res = requests.post(url, headers=headers, json=payload)
    print("STATUS CODE:", res.status_code)
    print("RESPONSE TEXT:", res.text)
except Exception as e:
    print("ERROR:", e)

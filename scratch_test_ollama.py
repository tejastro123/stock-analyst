import requests
import json

OLLAMA_URL = "http://localhost:11434"

print("=== CHECKING OLLAMA TAGS ===")
try:
    res = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
    print(f"Status Code: {res.status_code}")
    data = res.json()
    models = [m["name"] for m in data.get("models", [])]
    print(f"Available Models: {models}")
except Exception as e:
    print(f"Ollama is offline or unreachable: {e}")
    models = []

if models:
    model_name = models[0]
    print(f"\n=== TESTING GENERATE WITH MODEL '{model_name}' ===")
    try:
        payload = {
            "model": model_name,
            "prompt": "Say hello in exactly 3 words.",
            "stream": False
        }
        res2 = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=20)
        print(f"Status Code: {res2.status_code}")
        print(f"Response: {res2.json().get('response')}")
    except Exception as e:
        print(f"Generate failed: {e}")

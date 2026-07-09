import os
import base64
from pathlib import Path

LIB_DIR = Path(__file__).parent
BASE_DIR = LIB_DIR.parent
LOGOS_DIR = BASE_DIR / "assets" / "logos"

def get_logo_data_url(ticker: str) -> str:
    """
    Loads local logo files (SVG/PNG/ICO/JPG) and returns a base64 Data URL.
    Returns a custom SVG letter badge as a fallback if the logo is missing.
    """
    ticker = ticker.upper().split("-")[0] # Clean ticker (e.g. BRK-B -> BRK)
    
    # Check for downloaded files
    if LOGOS_DIR.exists():
        for ext in ["svg", "png", "ico", "jpg", "jpeg"]:
            logo_path = LOGOS_DIR / f"{ticker}.{ext}"
            if logo_path.exists():
                try:
                    with open(logo_path, "rb") as f:
                        data = f.read()
                    b64_data = base64.b64encode(data).decode("utf-8")
                    mime_map = {
                        "svg": "image/svg+xml",
                        "png": "image/png",
                        "ico": "image/x-icon",
                        "jpg": "image/jpeg",
                        "jpeg": "image/jpeg"
                    }
                    mime = mime_map.get(ext, "image/png")
                    return f"data:{mime};base64,{b64_data}"
                except Exception:
                    pass

    # Fallback SVG Badge using a stable color generation hash
    hue = sum(ord(char) for char in ticker) * 73 % 360
    svg_fallback = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="46" fill="hsl({hue}, 55%, 42%)" />
        <text x="50" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle">{ticker}</text>
    </svg>
    """.strip()
    
    b64_svg = base64.b64encode(svg_fallback.encode("utf-8")).decode("utf-8")
    return f"data:image/svg+xml;base64,{b64_svg}"

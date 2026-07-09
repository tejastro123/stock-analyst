import os
import requests
import json
import xml.etree.ElementTree as ET

# Ticker to company domain mapping
TICKER_DOMAINS = {
    "AAPL": "apple.com",
    "MSFT": "microsoft.com",
    "GOOGL": "google.com",
    "AMZN": "amazon.com",
    "NVDA": "nvidia.com",
    "META": "meta.com",
    "BRK-B": "berkshirehathaway.com",
    "LLY": "lilly.com",
    "TSLA": "tesla.com",
    "JPM": "jpmorganchase.com",
    "V": "visa.com",
    "UNH": "unitedhealthgroup.com",
    "MA": "mastercard.com",
    "AVGO": "broadcom.com",
    "HD": "homedepot.com",
    "PG": "pg.com",
    "COST": "costco.com",
    "AMD": "amd.com",
    "NFLX": "netflix.com",
    "DIS": "disney.com",
    "JNJ": "jnj.com",
    "MRK": "merck.com",
    "ORCL": "oracle.com",
    "CVX": "chevron.com",
    "XOM": "exxonmobil.com",
    "KO": "cocacola.com",
    "PEP": "pepsico.com",
    "BAC": "bankofamerica.com",
    "WMT": "walmart.com",
    "TMO": "thermofisher.com",
    "ADBE": "adobe.com",
    "CSCO": "cisco.com",
    "CRM": "salesforce.com",
    "NKE": "nike.com",
    "MCD": "mcdonalds.com",
    "ABT": "abbott.com",
    "INTC": "intel.com",
    "CMCSA": "comcast.com",
    "VZ": "verizon.com",
    "QCOM": "qualcomm.com",
    "TXN": "ti.com",
    "PFE": "pfizer.com",
    "AMGN": "amgen.com",
    "PM": "pmi.com",
    "HON": "honeywell.com",
    "UNP": "up.com",
    "IBM": "ibm.com",
    "GE": "ge.com",
    "SPGI": "spglobal.com",
    "INTU": "intuit.com",
    "AXP": "americanexpress.com",
    "SBUX": "starbucks.com",
    "MS": "morganstanley.com",
    "GS": "goldmansachs.com",
    "DE": "deere.com",
    "PLTR": "palantir.com",
    "CAT": "cat.com",
    "ISRG": "intuitive.com",
    "MDLZ": "mondelezinternational.com",
    "EL": "elcompanies.com",
    "BKNG": "bookingholdings.com",
    "LRCX": "lamresearch.com",
    "REGN": "regeneron.com",
    "NOW": "servicenow.com",
    "VRTX": "vrtx.com",
    "ADI": "analog.com",
    "MU": "micron.com",
    "ZTS": "zoetis.com",
    "PANW": "paloaltonetworks.com",
    "SNPS": "synopsys.com",
    "KLAC": "klac.com",
    "CDNS": "cadence.com",
    "FTNT": "fortinet.com",
    "MCHP": "microchip.com",
    "ANET": "arista.com",
    "PDD": "pddholdings.com",
    "MELI": "mercadolibre.com",
    "WDAY": "workday.com",
    "NXPI": "nxp.com",
    "ORLY": "oreilly.com",
    "CTAS": "cintas.com",
    "MAR": "marriott.com",
    "CRWD": "crowdstrike.com",
    "LULU": "lululemon.com",
    "COF": "capitalone.com",
    "ABNB": "airbnb.com",
    "MDB": "mongodb.com",
    "DDOG": "datadoghq.com",
    "TEAM": "atlassian.com",
    "SQ": "block.xyz",
    "NET": "cloudflare.com",
    "OKTA": "okta.com",
    "ZS": "zscaler.com",
    "MSTR": "microstrategy.com",
    
    # Sector ETFs (SPDR / State Street)
    "XLK": "ssga.com",
    "XLF": "ssga.com",
    "XLV": "ssga.com",
    "XLE": "ssga.com",
    "XLI": "ssga.com",
    "XLY": "ssga.com",
    "XLP": "ssga.com",
    "XLU": "ssga.com",
    "XLRE": "ssga.com",
    "XLB": "ssga.com",
    "XLC": "ssga.com",
}

# Add top holding tickers to retrieve
TOP_TICKERS = list(TICKER_DOMAINS.keys())

# Standard simple-icons slug mappings
SIMPLE_ICONS_MAPPING = {
    "AAPL": "apple",
    "MSFT": "microsoft",
    "GOOGL": "google",
    "AMZN": "amazon",
    "NVDA": "nvidia",
    "META": "meta",
    "TSLA": "tesla",
    "JPM": "jpmorganchase",
    "V": "visa",
    "MA": "mastercard",
    "AMD": "amd",
    "NFLX": "netflix",
    "DIS": "disney",
    "ORCL": "oracle",
    "KO": "cocacola",
    "PEP": "pepsico",
    "BAC": "bankofamerica",
    "WMT": "walmart",
    "ADBE": "adobe",
    "CSCO": "cisco",
    "CRM": "salesforce",
    "NKE": "nike",
    "MCD": "mcdonalds",
    "INTC": "intel",
    "VZ": "verizon",
    "QCOM": "qualcomm",
    "IBM": "ibm",
    "GE": "general-electric",
    "INTU": "intuit",
    "AXP": "american-express",
    "SBUX": "starbucks",
    "GS": "goldmansachs",
    "PLTR": "palantir",
    "CAT": "caterpillar",
    "NOW": "servicenow",
    "PANW": "paloaltonetworks",
    "CRWD": "crowdstrike",
    "ABNB": "airbnb",
    "MDB": "mongodb",
    "DDOG": "datadog",
    "TEAM": "atlassian",
    "SQ": "block",
    "NET": "cloudflare",
    "OKTA": "okta",
    "ZS": "zscaler",
}

def make_svg_dark_mode_compatible(svg_data: str) -> str:
    """Tries to parse the SVG and add fill='#ffffff' or modify existing paths to match dark mode."""
    try:
        # Quick string replacement fallback or XML parsing
        if "fill=" not in svg_data:
            svg_data = svg_data.replace("<path ", "<path fill=\"#ffffff\" ")
        else:
            # Replace dark colors with white
            svg_data = svg_data.replace('fill="#000000"', 'fill="#ffffff"')
            svg_data = svg_data.replace('fill="#000"', 'fill="#ffffff"')
        return svg_data
    except Exception:
        return svg_data

def download_logo(ticker: str, domain: str) -> bool:
    """Attempts to download ticker logo following the fallback chain."""
    os.makedirs("assets/logos", exist_ok=True)
    
    # 1. Try Simple Icons SVG
    slug = SIMPLE_ICONS_MAPPING.get(ticker)
    if slug:
        url = f"https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/{slug}.svg"
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                svg_content = make_svg_dark_mode_compatible(r.text)
                filepath = f"assets/logos/{ticker}.svg"
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(svg_content)
                print(f"[{ticker}] Downloaded from Simple Icons")
                return True
        except Exception:
            pass

    # 2. Try VectorLogo.zone SVG
    if slug:
        url = f"https://www.vectorlogo.zone/logos/{slug}/{slug}-icon.svg"
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                filepath = f"assets/logos/{ticker}.svg"
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(r.text)
                print(f"[{ticker}] Downloaded from VectorLogo.zone")
                return True
        except Exception:
            pass

    # 3. Try Domain Apple-touch-icon
    if domain:
        url = f"https://{domain}/apple-touch-icon.png"
        try:
            r = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200:
                filepath = f"assets/logos/{ticker}.png"
                with open(filepath, "wb") as f:
                    f.write(r.content)
                print(f"[{ticker}] Downloaded apple-touch-icon")
                return True
        except Exception:
            pass

    # 4. Try Google Favicon V2 (256px size)
    if domain:
        url = f"https://www.google.com/s2/favicons?domain={domain}&sz=256"
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                filepath = f"assets/logos/{ticker}.png"
                with open(filepath, "wb") as f:
                    f.write(r.content)
                print(f"[{ticker}] Downloaded from Google Favicon V2")
                return True
        except Exception:
            pass

    # 5. Try DuckDuckGo favicon fallback
    if domain:
        url = f"https://icons.duckduckgo.com/ip3/{domain}.ico"
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                filepath = f"assets/logos/{ticker}.ico"
                with open(filepath, "wb") as f:
                    f.write(r.content)
                print(f"[{ticker}] Downloaded from DuckDuckGo Favicon")
                return True
        except Exception:
            pass

    print(f"[{ticker}] Failed to download logo")
    return False

def main():
    print("Starting logo downloader for top tickers...")
    # Add a .gitkeep so assets/logos is pushed/held
    os.makedirs("assets/logos", exist_ok=True)
    with open("assets/logos/.gitkeep", "w") as f:
        f.write("")
        
    for ticker, domain in TICKER_DOMAINS.items():
        download_logo(ticker, domain)

if __name__ == "__main__":
    main()

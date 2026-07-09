import React from 'react';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

function TradingViewProfile({ symbol, market }) {
  let tvSymbol = symbol;
  if (market === "NSE" || market === "BSE" || symbol.endsWith(".NS") || symbol.endsWith(".BO")) {
    const clean = symbol.replace('.NS', '').replace('.BO', '');
    tvSymbol = `${market === "BSE" ? "BSE" : "NSE"}:${clean}`;
  } else {
    if (!symbol.includes(':')) {
      tvSymbol = symbol;
    }
  }

  const config = {
    "width": "100%",
    "height": "400",
    "colorTheme": "dark",
    "isTransparent": false,
    "symbol": tvSymbol,
    "locale": "en"
  };

  return (
    <div style={{ width: "100%", height: "400px", overflow: "hidden" }}>
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js"
        config={config}
        height="400px"
      />
    </div>
  );
}

export default TradingViewProfile;


import React from 'react';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

function TradingViewGauge({ symbol, market }) {
  let tvSymbol = symbol;
  if (market === "NSE" || market === "BSE" || symbol.endsWith(".NS") || symbol.endsWith(".BO")) {
    const clean = symbol.replace('.NS', '').replace('.BO', '');
    const resolvedMkt = (market === "BSE" || symbol.endsWith(".BO")) ? "BSE" : "NSE";
    tvSymbol = `${resolvedMkt}:${clean}`;
  } else {
    if (!symbol.includes(':')) {
      tvSymbol = symbol;
    }
  }

  const config = {
    "interval": "1D",
    "width": "100%",
    "isTransparent": false,
    "height": "400",
    "symbol": tvSymbol,
    "showIntervalTabs": true,
    "displayMode": "single",
    "locale": "en",
    "colorTheme": "dark"
  };

  return (
    <div style={{ width: "100%", height: "400px", overflow: "hidden" }}>
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js"
        config={config}
        height="400px"
      />
    </div>
  );
}

export default TradingViewGauge;


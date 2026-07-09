import React from 'react';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

function TradingViewMovers() {
  const config = {
    "colorTheme": "dark",
    "dateRange": "12M",
    "showLineCharts": false,
    "locale": "en",
    "width": "100%",
    "height": "400",
    "largeChartUrl": "",
    "isTransparent": false,
    "showSymbolLogo": false,
    "showLastTime": false,
    "groups": [
      {
        "name": "US Gainers",
        "originalName": "US Gainers",
        "id": "US_gainers"
      },
      {
        "name": "US Losers",
        "originalName": "US Losers",
        "id": "US_losers"
      },
      {
        "name": "US Most Active",
        "originalName": "US Most Active",
        "id": "US_active"
      }
    ]
  };

  return (
    <div style={{ height: "400px", width: "100%" }} id="tradingview-movers">
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js"
        config={config}
        height="400px"
      />
    </div>
  );
}

export default TradingViewMovers;


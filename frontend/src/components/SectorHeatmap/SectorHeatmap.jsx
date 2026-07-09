import React from 'react';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

function SectorHeatmap() {
  const config = {
    "exchanges": [],
    "dataSource": "SPX500",
    "grouping": "sector",
    "sizes": "market_cap",
    "hasTopBar": false,
    "isDatasetEnabled": true,
    "defaultSymbolColor": "#223344",
    "showDescription": false,
    "colorTheme": "dark",
    "scale": "one_day",
    "locale": "en",
    "symbolUrl": "",
    "width": "100%",
    "height": "400"
  };

  return (
    <div style={{ height: "400px", width: "100%" }} id="sector-heatmap">
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
        config={config}
        height="400px"
      />
    </div>
  );
}

export default SectorHeatmap;


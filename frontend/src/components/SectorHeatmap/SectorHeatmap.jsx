import React from 'react';
import useMarketStore from '../../store/marketStore';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

function SectorHeatmap() {
  const { activeMarket } = useMarketStore();
  const isInd = activeMarket === 'NSE' || activeMarket === 'BSE';

  const config = {
    "exchanges": [],
    "dataSource": isInd ? "NIFTY50" : "SPX500",
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
    <div key={activeMarket} style={{ height: "400px", width: "100%" }} id="sector-heatmap">
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
        config={config}
        height="400px"
      />
    </div>
  );
}

export default SectorHeatmap;


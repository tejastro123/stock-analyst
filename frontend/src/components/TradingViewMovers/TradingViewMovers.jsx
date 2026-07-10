import React from 'react';
import useMarketStore from '../../store/marketStore';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

const US_GROUPS = [
  { "name": "US Gainers", "originalName": "US Gainers", "id": "US_gainers" },
  { "name": "US Losers", "originalName": "US Losers", "id": "US_losers" },
  { "name": "US Most Active", "originalName": "US Most Active", "id": "US_active" }
];

const IN_GROUPS = [
  { "name": "Indian Gainers", "originalName": "Indian Gainers", "id": "india_gainers" },
  { "name": "Indian Losers", "originalName": "Indian Losers", "id": "india_losers" },
  { "name": "Indian Most Active", "originalName": "Indian Most Active", "id": "india_active" }
];

function TradingViewMovers() {
  const { activeMarket } = useMarketStore();
  const isInd = activeMarket === 'NSE' || activeMarket === 'BSE';

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
    "groups": isInd ? IN_GROUPS : US_GROUPS
  };

  return (
    <div key={activeMarket} style={{ height: "400px", width: "100%" }} id="tradingview-movers">
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js"
        config={config}
        height="400px"
      />
    </div>
  );
}

export default TradingViewMovers;


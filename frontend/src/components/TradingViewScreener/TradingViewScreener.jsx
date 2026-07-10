import React from 'react';
import useMarketStore from '../../store/marketStore';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

function TradingViewScreener() {
  const { activeMarket } = useMarketStore();
  const isInd = activeMarket === 'NSE' || activeMarket === 'BSE';

  const config = {
    "width": "100%",
    "height": "100%",
    "defaultColumn": "overview",
    "defaultScreen": "most_capitalized",
    "market": isInd ? "india" : "america",
    "showToolbar": true,
    "colorTheme": "dark",
    "locale": "en"
  };

  return (
    <div key={activeMarket} style={{ height: "100%", width: "100%" }} id="tradingview-screener-wrap">
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
        config={config}
        height="100%"
      />
    </div>
  );
}

export default TradingViewScreener;


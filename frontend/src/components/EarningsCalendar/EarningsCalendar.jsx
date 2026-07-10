import React from 'react';
import useMarketStore from '../../store/marketStore';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

function EarningsCalendar() {
  const { activeMarket } = useMarketStore();
  const isInd = activeMarket === 'NSE' || activeMarket === 'BSE';

  const config = {
    "colorTheme": "dark",
    "isTransparent": false,
    "width": "100%",
    "height": "400",
    "locale": "en",
    "importanceFilter": "0,1",
    "currencyFilter": isInd ? "INR" : "USD"
  };

  return (
    <div key={activeMarket} style={{ height: "400px", width: "100%" }} id="earnings-calendar">
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-events.js"
        config={config}
        height="400px"
      />
    </div>
  );
}

export default EarningsCalendar;


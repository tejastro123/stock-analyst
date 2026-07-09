import React from 'react';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

function TradingViewTickerTape() {
  const config = {
    "symbols": [
      {
        "proName": "FOREXCOM:SPX500",
        "title": "S&P 500 Index"
      },
      {
        "proName": "FOREXCOM:NSXUSD",
        "title": "US Tech 100"
      },
      {
        "proName": "FX_IDC:EURUSD",
        "title": "EUR/USD"
      },
      {
        "proName": "BITSTAMP:BTCUSD",
        "title": "Bitcoin"
      },
      {
        "proName": "BITSTAMP:ETHUSD",
        "title": "Ethereum"
      },
      {
        "proName": "OANDA:XAUUSD",
        "description": "Gold"
      },
      {
        "proName": "OANDA:WTICOUSD",
        "description": "Crude Oil"
      }
    ],
    "showSymbolLogo": true,
    "colorTheme": "dark",
    "isTransparent": false,
    "displayMode": "adaptive",
    "locale": "en"
  };

  return (
    <div style={{ width: "100%", height: "46px", overflow: "hidden" }}>
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
        config={config}
        height="46px"
      />
    </div>
  );
}

export default TradingViewTickerTape;


import React from 'react';
import useMarketStore from '../../store/marketStore';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

const US_SYMBOLS = [
  { "proName": "FOREXCOM:SPX500", "title": "S&P 500 Index" },
  { "proName": "FOREXCOM:NSXUSD", "title": "US Tech 100" },
  { "proName": "FX_IDC:EURUSD", "title": "EUR/USD" },
  { "proName": "BITSTAMP:BTCUSD", "title": "Bitcoin" },
  { "proName": "OANDA:XAUUSD", "title": "Gold" },
  { "proName": "OANDA:WTICOUSD", "title": "Crude Oil" }
];

const IN_SYMBOLS = [
  { "proName": "NSE:NIFTY", "title": "NIFTY 50" },
  { "proName": "BSE:SENSEX", "title": "SENSEX" },
  { "proName": "NSE:RELIANCE", "title": "RELIANCE" },
  { "proName": "NSE:TCS", "title": "TCS" },
  { "proName": "NSE:INFY", "title": "INFOSYS" },
  { "proName": "FX_IDC:USDINR", "title": "USD/INR" },
  { "proName": "OANDA:XAUUSD", "title": "Gold" }
];

function TradingViewTickerTape() {
  const { activeMarket } = useMarketStore();
  const isInd = activeMarket === 'NSE' || activeMarket === 'BSE';

  const config = {
    "symbols": isInd ? IN_SYMBOLS : US_SYMBOLS,
    "showSymbolLogo": true,
    "colorTheme": "dark",
    "isTransparent": false,
    "displayMode": "adaptive",
    "locale": "en"
  };

  return (
    <div key={activeMarket} style={{ width: "100%", height: "46px", overflow: "hidden" }}>
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
        config={config}
        height="46px"
      />
    </div>
  );
}

export default TradingViewTickerTape;


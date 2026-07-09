import React from 'react';
import TradingViewIFrameWidget from '../../components/TradingViewIFrameWidget';

function CryptoPage() {
  const config = {
    "width": "100%",
    "height": "100%",
    "defaultColumn": "overview",
    "screener_type": "crypto_mkt",
    "displayMode": "regular",
    "market": "crypto",
    "showToolbar": true,
    "colorTheme": "dark",
    "locale": "en"
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', padding: '12px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className="panel-header">
          <span className="panel-title">Crypto Market Feed</span>
          <span className="badge badge-purple font-mono">COINS</span>
        </div>
        <div className="panel-body" style={{ flexGrow: 1, padding: 0, height: 'calc(100% - 36px)' }}>
          <div style={{ height: "100%", width: "100%" }} id="crypto-screener">
            <TradingViewIFrameWidget
              scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
              config={config}
              height="100%"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CryptoPage;


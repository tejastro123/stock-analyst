import React from 'react';
import TradingViewIFrameWidget from '../../components/TradingViewIFrameWidget';

function ForexPage() {
  const ratesConfig = {
    "width": "100%",
    "height": "100%",
    "currencies": [
      "EUR", "USD", "JPY", "GBP", "CHF", "AUD", "CAD", "NZD"
    ],
    "isTransparent": false,
    "colorTheme": "dark",
    "locale": "en"
  };

  const heatmapConfig = {
    "width": "100%",
    "height": "100%",
    "currencies": [
      "EUR", "USD", "JPY", "GBP", "CHF", "AUD", "CAD"
    ],
    "isTransparent": false,
    "colorTheme": "dark",
    "locale": "en"
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', padding: '12px', boxSizing: 'border-box', gap: '12px', overflow: 'hidden' }}>
      {/* Left panel: Cross rates */}
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className="panel-header">
          <span className="panel-title">Forex Cross Rates</span>
          <span className="badge badge-amber font-mono">EXCHANGE</span>
        </div>
        <div className="panel-body" style={{ flexGrow: 1, padding: 0, height: 'calc(100% - 36px)' }}>
          <div style={{ height: "100%", width: "100%" }} id="forex-rates">
            <TradingViewIFrameWidget
              scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js"
              config={ratesConfig}
              height="100%"
            />
          </div>
        </div>
      </div>

      {/* Right panel: Heatmap */}
      <div className="panel" style={{ width: '450px', minWidth: '450px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className="panel-header">
          <span className="panel-title">Currency Performance Heatmap</span>
          <span className="badge badge-blue font-mono">STRENGTH</span>
        </div>
        <div className="panel-body" style={{ flexGrow: 1, padding: 0, height: 'calc(100% - 36px)' }}>
          <div style={{ height: "100%", width: "100%" }} id="forex-heatmap">
            <TradingViewIFrameWidget
              scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-forex-heat-map.js"
              config={heatmapConfig}
              height="100%"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForexPage;


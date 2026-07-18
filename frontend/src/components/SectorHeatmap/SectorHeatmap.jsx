import React, { useState } from 'react';
import TradingViewIFrameWidget from '../TradingViewIFrameWidget';

function SectorHeatmap() {
  const [market, setMarket] = useState('US');

  const config = {
    "exchanges": [],
    "dataSource": market === 'US' ? "SPX500" : "NIFTY50",
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
    <div>
      <div style={{ display: 'flex', gap: '4px', padding: '0 0 8px 0' }}>
        <button
          className={`btn btn-sm font-mono ${market === 'US' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: '10px', padding: '2px 8px', height: '24px' }}
          onClick={() => setMarket('US')}
        >
          🇺🇸 US
        </button>
        <button
          className={`btn btn-sm font-mono ${market === 'IN' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: '10px', padding: '2px 8px', height: '24px' }}
          onClick={() => setMarket('IN')}
        >
          🇮🇳 INDIA
        </button>
      </div>
      <div key={market} style={{ height: "400px", width: "100%" }} id="sector-heatmap">
        <TradingViewIFrameWidget
          scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
          config={config}
          height="400px"
        />
      </div>
    </div>
  );
}

export default SectorHeatmap;
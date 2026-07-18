import React, { useEffect, useState } from 'react';
import { marketApi } from '../../api';
import useMarketStore from '../../store/marketStore';
import './MarketBreadth.css';

function MarketBreadth() {
  const { activeMarket } = useMarketStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    marketApi.getBreadth(activeMarket)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeMarket]);

  if (loading) return (
    <div className="breadth-loading font-mono text-xs text-muted">
      <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />
      Calculating breadth...
    </div>
  );

  if (!data || data.error) return <div className="text-muted text-xs p-3">Breadth data unavailable</div>;

  return (
    <div className="breadth-root" id="market-breadth">
      {/* Advancing/Declining ratio gauge bar */}
      <div className="breadth-gauge-wrap">
        <div className="breadth-gauge-header text-xs font-mono">
          <span className="price-up">ADV: {data.advancing_pct}%</span>
          <span className="text-muted">A/D Ratio: {data.ad_ratio}</span>
          <span className="price-down">DECL: {data.declining_pct}%</span>
        </div>
        <div className="breadth-gauge-bar">
          <div className="breadth-gauge-fill-up" style={{ width: `${data.advancing_pct}%` }} />
          <div className="breadth-gauge-fill-down" style={{ width: `${data.declining_pct}%` }} />
        </div>
      </div>

      {/* MA Breadth metrics */}
      <div className="breadth-stats-grid">
        <div className="breadth-stat-card">
          <div className="breadth-stat-label text-muted">ST Above MA50</div>
          <div className="breadth-stat-value font-mono text-lg fw-700">
            {data.above_ma50_pct}%
          </div>
          <div className="breadth-stat-progress">
            <div className="breadth-progress-bar" style={{ width: `${data.above_ma50_pct}%`, background: '#4488ff' }} />
          </div>
        </div>

        <div className="breadth-stat-card">
          <div className="breadth-stat-label text-muted">LT Above MA200</div>
          <div className="breadth-stat-value font-mono text-lg fw-700">
            {data.above_ma200_pct}%
          </div>
          <div className="breadth-stat-progress">
            <div className="breadth-progress-bar" style={{ width: `${data.above_ma200_pct}%`, background: '#aa66ff' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketBreadth;

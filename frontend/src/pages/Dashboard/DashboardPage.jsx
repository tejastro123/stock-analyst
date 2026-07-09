import React from 'react';
import useAuthStore from '../../store/authStore';
import './Dashboard.css';

const MARKET_SUMMARY = [
  { label: 'S&P 500',   value: '5,485.21', change: '+0.31%', up: true },
  { label: 'NASDAQ',    value: '17,726.49', change: '+0.44%', up: true },
  { label: 'DOW',       value: '38,997.66', change: '+0.20%', up: true },
  { label: 'VIX',       value: '13.42',    change: '-2.18%', up: false },
  { label: 'DXY',       value: '104.31',   change: '-0.08%', up: false },
  { label: '10Y YIELD', value: '4.28%',    change: '+0.03', up: true },
  { label: 'GOLD',      value: '2,328.60', change: '+0.52%', up: true },
  { label: 'OIL',       value: '78.14',    change: '-0.64%', up: false },
];

const WATCHLIST = [
  { sym: 'AAPL',  name: 'Apple Inc.',          price: '213.42', chg: '+1.77',  pct: '+0.84%', up: true,  vol: '52.3M' },
  { sym: 'TSLA',  name: 'Tesla Inc.',           price: '189.21', chg: '+2.30',  pct: '+1.23%', up: true,  vol: '81.4M' },
  { sym: 'NVDA',  name: 'NVIDIA Corp.',         price: '121.55', chg: '-0.51',  pct: '-0.42%', up: false, vol: '203M' },
  { sym: 'GOOGL', name: 'Alphabet Inc.',        price: '178.34', chg: '-0.32',  pct: '-0.18%', up: false, vol: '21.8M' },
  { sym: 'MSFT',  name: 'Microsoft Corp.',      price: '421.65', chg: '+2.30',  pct: '+0.55%', up: true,  vol: '19.4M' },
  { sym: 'AMZN',  name: 'Amazon.com Inc.',      price: '195.12', chg: '+1.40',  pct: '+0.72%', up: true,  vol: '32.1M' },
  { sym: 'META',  name: 'Meta Platforms Inc.',  price: '497.23', chg: '-3.12',  pct: '-0.62%', up: false, vol: '14.9M' },
  { sym: 'NFLX',  name: 'Netflix Inc.',         price: '641.88', chg: '+5.44',  pct: '+0.86%', up: true,  vol: '6.2M' },
];

const TOP_MOVERS = [
  { sym: 'SMCI',   pct: '+18.4%', reason: 'Earnings Beat', up: true },
  { sym: 'MRNA',   pct: '-12.1%', reason: 'Trial Failure', up: false },
  { sym: 'PLTR',   pct: '+8.7%',  reason: 'Gov Contract',  up: true },
  { sym: 'COIN',   pct: '+6.2%',  reason: 'BTC Rally',     up: true },
  { sym: 'RIVN',   pct: '-7.3%',  reason: 'Downgrade',     up: false },
];

function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="dashboard-root" id="dashboard">
      {/* ── Market Summary Bar ── */}
      <div className="market-bar" id="market-bar">
        {MARKET_SUMMARY.map((m) => (
          <div key={m.label} className="market-bar-item">
            <div className="market-bar-label font-mono text-xs text-muted">{m.label}</div>
            <div className={`market-bar-value font-mono text-sm fw-600 ${m.up ? 'price-up' : 'price-down'}`}>
              {m.value}
            </div>
            <div className={`market-bar-change font-mono text-xs ${m.up ? 'price-up' : 'price-down'}`}>
              {m.change}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="dashboard-grid">
        {/* ── Watchlist Panel ── */}
        <div className="panel dash-watchlist" id="panel-watchlist">
          <div className="panel-header">
            <span className="panel-title">My Watchlist</span>
            <div className="flex gap-2">
              <span className="badge badge-green">LIVE</span>
              <button id="btn-add-symbol" className="btn btn-ghost btn-sm">+ ADD</button>
            </div>
          </div>
          <div className="watchlist-table-wrap">
            <table className="watchlist-table">
              <thead>
                <tr>
                  <th>SYMBOL</th>
                  <th>PRICE</th>
                  <th>CHG</th>
                  <th>CHG%</th>
                  <th>VOLUME</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {WATCHLIST.map((s) => (
                  <tr key={s.sym} className="watchlist-row" id={`row-${s.sym.toLowerCase()}`}>
                    <td>
                      <div className="wl-sym">{s.sym}</div>
                      <div className="wl-name">{s.name}</div>
                    </td>
                    <td className="font-mono fw-600">{s.price}</td>
                    <td className={`font-mono ${s.up ? 'price-up' : 'price-down'}`}>{s.chg}</td>
                    <td>
                      <span className={`badge ${s.up ? 'badge-green' : 'badge-red'}`}>{s.pct}</span>
                    </td>
                    <td className="font-mono text-secondary">{s.vol}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm">CHART</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="dash-right">
          {/* Top Movers */}
          <div className="panel" id="panel-movers">
            <div className="panel-header">
              <span className="panel-title">Top Movers</span>
              <span className="badge badge-amber">TODAY</span>
            </div>
            <div className="panel-body">
              {TOP_MOVERS.map((m) => (
                <div key={m.sym} className="mover-row">
                  <div>
                    <div className="font-mono fw-600 text-sm">{m.sym}</div>
                    <div className="text-xs text-muted">{m.reason}</div>
                  </div>
                  <span className={`badge text-base ${m.up ? 'badge-green' : 'badge-red'}`}>{m.pct}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Pulse */}
          <div className="panel" id="panel-ai-pulse">
            <div className="panel-header">
              <span className="panel-title">AI Market Pulse</span>
              <span className="badge badge-purple">MISTRAL</span>
            </div>
            <div className="panel-body">
              <div className="ai-pulse-content">
                <div className="ai-pulse-line">
                  <span className="text-accent font-mono text-xs">►</span>
                  <span className="text-sm text-secondary">
                    Markets trending bullish. Tech sector leading gains driven by AI infrastructure spending. 
                    NVDA consolidating after recent breakout.
                  </span>
                </div>
                <div className="ai-pulse-line">
                  <span className="text-green font-mono text-xs">►</span>
                  <span className="text-sm text-secondary">
                    Fed minutes indicate no rate cuts until Q4. Bond yields stable, DXY weakening slightly.
                  </span>
                </div>
                <div className="ai-pulse-line">
                  <span className="text-red font-mono text-xs">►</span>
                  <span className="text-sm text-secondary">
                    Watch MRNA — Phase 3 trial data disappointing, biotech sector under pressure.
                  </span>
                </div>
                <button id="btn-full-analysis" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>
                  FULL ANALYSIS →
                </button>
              </div>
            </div>
          </div>

          {/* Portfolio Snapshot */}
          <div className="panel" id="panel-portfolio-snap">
            <div className="panel-header">
              <span className="panel-title">Portfolio Snapshot</span>
              <button id="btn-view-portfolio" className="btn btn-ghost btn-sm">VIEW →</button>
            </div>
            <div className="panel-body">
              <div className="port-snap-total">
                <div className="text-muted text-xs font-mono">TOTAL VALUE</div>
                <div className="font-mono text-2xl fw-700 text-primary">$0.00</div>
                <div className="font-mono text-sm text-muted">— positions. Add your first trade.</div>
              </div>
              <button id="btn-add-position" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                + ADD POSITION
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

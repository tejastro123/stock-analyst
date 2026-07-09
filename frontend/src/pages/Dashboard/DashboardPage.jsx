import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { marketApi, userApi } from '../../api';
import SectorHeatmap from '../../components/SectorHeatmap/SectorHeatmap';
import MarketBreadth from '../../components/MarketBreadth/MarketBreadth';
import EarningsCalendar from '../../components/EarningsCalendar/EarningsCalendar';
import TradingViewMovers from '../../components/TradingViewMovers/TradingViewMovers';
import ReportExporter from '../../components/ReportExporter/ReportExporter';
import './Dashboard.css';

const DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'GOOGL', 'MSFT', 'AMZN', 'META'];

const MARKET_BAR_SYMBOLS = ['SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'USO', 'TLT'];

function fmt(v, type = 'num') {
  if (v === null || v === undefined) return '—';
  if (type === 'pct') return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  if (type === 'mc') {
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
    return `$${(v / 1e6).toFixed(0)}M`;
  }
  if (type === 'vol') {
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return `${v}`;
  }
  if (type === 'price') return `$${Number(v).toFixed(2)}`;
  return Number(v).toFixed(2);
}

function DashboardPage() {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState([]);
  const [marketBar, setMarketBar] = useState([]);
  const [wlLoading, setWlLoading] = useState(true);
  const [mbLoading, setMbLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch Market Bar quotes
  useEffect(() => {
    marketApi.getBatchQuotes(MARKET_BAR_SYMBOLS)
      .then(res => {
        const quotes = res.data.quotes || {};
        const formatted = MARKET_BAR_SYMBOLS.map(sym => {
          const q = quotes[sym] || {};
          return {
            label: sym,
            value: q.price ? fmt(q.price) : '—',
            change: q.change_pct ? fmt(q.change_pct, 'pct') : '—',
            up: (q.change_pct || 0) >= 0,
          };
        });
        setMarketBar(formatted);
      })
      .catch(() => {})
      .finally(() => setMbLoading(false));
  }, []);



  // Load user watchlists and fetch quote data
  const loadWatchlistData = async () => {
    setWlLoading(true);
    try {
      let syms = DEFAULT_SYMBOLS;
      try {
        const wlRes = await userApi.getWatchlists();
        const activeWl = wlRes.data[0];
        if (activeWl && activeWl.symbols && activeWl.symbols.length > 0) {
          syms = activeWl.symbols.map(s => s.symbol);
        }
      } catch (err) {
        console.warn('Watchlist fetch failed, falling back to defaults', err);
      }

      const quoteRes = await marketApi.getBatchQuotes(syms);
      const quotes = quoteRes.data.quotes || {};
      const items = syms.map(sym => {
        const q = quotes[sym.toUpperCase()] || {};
        return {
          sym: sym.toUpperCase(),
          name: q.name || sym,
          price: q.price ? fmt(q.price, 'price') : '—',
          chg: q.change ? fmt(q.change) : '—',
          pct: q.change_pct ? fmt(q.change_pct, 'pct') : '—',
          up: (q.change_pct || 0) >= 0,
          vol: q.volume ? fmt(q.volume, 'vol') : '—',
        };
      });
      setWatchlist(items);
    } catch (err) {
      console.error(err);
    } finally {
      setWlLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlistData();
  }, []);

  const handleAddSymbol = async (e) => {
    e.preventDefault();
    if (!newSymbol) return;
    try {
      const wlRes = await userApi.getWatchlists();
      let activeWl = wlRes.data[0];
      if (!activeWl) {
        const createRes = await userApi.createWatchlist('Default');
        activeWl = createRes.data;
      }
      await userApi.addSymbol(activeWl.id, newSymbol.toUpperCase(), 'US');
      setNewSymbol('');
      setShowAddForm(false);
      loadWatchlistData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add symbol');
    }
  };

  return (
    <div className="dashboard-root" id="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 4px 16px', flexShrink: 0 }}>
        <span className="font-mono text-xs fw-600 text-secondary">QUANTDESK MARKET MONITOR</span>
        <div className="flex gap-2">
          <ReportExporter pageName="dashboard" data={{ watchlist, marketBar }} label="EXPORT DASHBOARD PDF" />
          <ReportExporter pageName="combined" data={{ watchlist, marketBar }} label="EXPORT COMBINED DECK" combined={true} />
        </div>
      </div>
      {/* ── Market Summary Bar ── */}
      <div className="market-bar" id="market-bar">
        {mbLoading ? (
          <span className="font-mono text-xs text-muted" style={{ padding: 10 }}>Loading market data...</span>
        ) : (
          marketBar.map((m) => (
            <div key={m.label} className="market-bar-item">
              <div className="market-bar-label font-mono text-xs text-muted">{m.label}</div>
              <div className={`market-bar-value font-mono text-sm fw-600 ${m.up ? 'price-up' : 'price-down'}`}>
                {m.value}
              </div>
              <div className={`market-bar-change font-mono text-xs ${m.up ? 'price-up' : 'price-down'}`}>
                {m.change}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Main Grid ── */}
      <div className="dashboard-grid">
        {/* ── Left Column (Watchlist + Heatmap + Breadth) ── */}
        <div className="dash-left" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', overflowY: 'auto' }}>
          {/* Watchlist Panel */}
          <div className="panel dash-watchlist" id="panel-watchlist" style={{ flexShrink: 0, minHeight: '320px' }}>
            <div className="panel-header">
              <span className="panel-title">My Watchlist</span>
              <div className="flex gap-2">
                <span className="badge badge-green">LIVE</span>
                <button id="btn-add-symbol" className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                  {showAddForm ? 'CANCEL' : '+ ADD'}
                </button>
              </div>
            </div>

            {showAddForm && (
              <form onSubmit={handleAddSymbol} className="watchlist-add-form" style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--border-primary)' }}>
                <input
                  id="input-wl-symbol"
                  className="form-input"
                  style={{ width: 120, height: 28, fontSize: 12 }}
                  placeholder="Ticker (e.g. TSLA)"
                  value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary btn-sm">ADD</button>
              </form>
            )}

            <div className="watchlist-table-wrap">
              {wlLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
                  <span className="spinner" style={{ width: 20, height: 20 }} />
                </div>
              ) : (
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
                    {watchlist.map((s) => (
                      <tr key={s.sym} className="watchlist-row" id={`row-${s.sym.toLowerCase()}`}>
                        <td>
                          <div className="wl-sym">{s.sym}</div>
                          <div className="wl-name">{s.name}</div>
                        </td>
                        <td className="font-mono fw-600">{s.price}</td>
                        <td className={`font-mono ${s.up ? 'price-up' : 'price-down'}`}>{s.chg}</td>
                        <td>
                          <span className={`badge ${s.up ? 'badge-green' : 'badge-red'} font-mono`}>{s.pct}</span>
                        </td>
                        <td className="font-mono text-secondary">{s.vol}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate(`/charts?sym=${s.sym}`)}
                          >
                            CHART
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Sector Heatmap */}
          <div className="panel" id="panel-heatmap" style={{ flexShrink: 0 }}>
            <div className="panel-header">
              <span className="panel-title">Sector Heatmap</span>
              <span className="badge badge-amber font-mono">ETFs</span>
            </div>
            <div className="panel-body">
              <SectorHeatmap />
            </div>
          </div>

          {/* Market Breadth Panel */}
          <div className="panel" id="panel-breadth" style={{ flexShrink: 0 }}>
            <div className="panel-header">
              <span className="panel-title">Market Breadth</span>
              <span className="badge badge-blue font-mono">BREADTH</span>
            </div>
            <div className="panel-body">
              <MarketBreadth />
            </div>
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
              <TradingViewMovers />
            </div>
          </div>

          {/* Earnings Calendar */}
          <div className="panel" id="panel-earnings">
            <div className="panel-header">
              <span className="panel-title">Upcoming Earnings</span>
              <span className="badge badge-purple font-mono">CALENDAR</span>
            </div>
            <div className="panel-body">
              <EarningsCalendar />
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

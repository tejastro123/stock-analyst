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

const US_MARKET_BAR = ['SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'USO', 'TLT'];
const IN_MARKET_BAR = ['^NSEI', '^BSESN', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'SBIN'];

const US_DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'GOOGL', 'MSFT', 'AMZN', 'META'];
const IN_DEFAULT_SYMBOLS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'SBIN', 'ICICIBANK', 'LT'];

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
  const { user } = useAuthStore();
  const [watchlist, setWatchlist] = useState([]);
  const [marketBar, setMarketBar] = useState([]);
  const [wlLoading, setWlLoading] = useState(true);
  const [mbLoading, setMbLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [defaultMarket, setDefaultMarket] = useState('NSE');

  // Load User settings to set default market region
  useEffect(() => {
    userApi.getSettings()
      .then(res => {
        if (res.data?.default_market) {
          const m = res.data.default_market === 'IN' ? 'NSE' : res.data.default_market;
          setDefaultMarket(m);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Market Bar quotes dynamically based on default market
  useEffect(() => {
    const isInd = defaultMarket === 'NSE' || defaultMarket === 'BSE';
    const barSyms = isInd ? IN_MARKET_BAR : US_MARKET_BAR;
    const barMkt = isInd ? 'NSE' : 'US';

    setMbLoading(true);
    marketApi.getBatchQuotes(barSyms, barMkt)
      .then(res => {
        const quotes = res.data.quotes || {};
        const formatted = barSyms.map(sym => {
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
  }, [defaultMarket]);



  // Load user watchlists and fetch quote data dynamically per market
  const loadWatchlistData = async () => {
    setWlLoading(true);
    try {
      let watchlistSymbols = [];
      const isInd = defaultMarket === 'NSE' || defaultMarket === 'BSE';
      const fallbackSyms = isInd ? IN_DEFAULT_SYMBOLS : US_DEFAULT_SYMBOLS;
      const fallbackMkt = isInd ? 'NSE' : 'US';

      try {
        const wlRes = await userApi.getWatchlists();
        const activeWl = wlRes.data[0];
        if (activeWl && activeWl.symbols && activeWl.symbols.length > 0) {
          watchlistSymbols = activeWl.symbols;
        } else {
          watchlistSymbols = fallbackSyms.map(sym => ({ symbol: sym, market: fallbackMkt }));
        }
      } catch (err) {
        console.warn('Watchlist fetch failed, falling back to defaults', err);
        watchlistSymbols = fallbackSyms.map(sym => ({ symbol: sym, market: fallbackMkt }));
      }

      // Group symbols by market for parallel querying
      const marketGroups = {};
      watchlistSymbols.forEach(s => {
        const m = s.market || fallbackMkt;
        if (!marketGroups[m]) marketGroups[m] = [];
        marketGroups[m].push(s.symbol);
      });

      const promises = Object.keys(marketGroups).map(async (m) => {
        try {
          const res = await marketApi.getBatchQuotes(marketGroups[m], m);
          return { market: m, quotes: res.data.quotes || {} };
        } catch {
          return { market: m, quotes: {} };
        }
      });

      const results = await Promise.all(promises);
      const quotesMap = {};
      results.forEach(res => {
        Object.keys(res.quotes).forEach(sym => {
          quotesMap[`${sym.toUpperCase()}:${res.market}`] = res.quotes[sym];
        });
      });

      const items = watchlistSymbols.map(s => {
        const sym = s.symbol.toUpperCase();
        const m = s.market || fallbackMkt;
        const q = quotesMap[`${sym}:${m}`] || {};
        return {
          sym,
          market: m,
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
  }, [defaultMarket]);

  const handleAddSymbol = async (e) => {
    e.preventDefault();
    if (user?.role === 'viewer') {
      alert('Permission Denied: Viewer role cannot add symbols.');
      return;
    }
    if (!newSymbol) return;
    try {
      const wlRes = await userApi.getWatchlists();
      let activeWl = wlRes.data[0];
      if (!activeWl) {
        const createRes = await userApi.createWatchlist('Default');
        activeWl = createRes.data;
      }
      const targetMkt = defaultMarket || 'US';
      await userApi.addSymbol(activeWl.id, newSymbol.toUpperCase(), targetMkt);
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
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="market-bar-item shimmer" style={{ minWidth: '80px', height: '40px', borderRadius: '3px', opacity: 0.6 }} />
          ))
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
                {user?.role !== 'viewer' && (
                  <button id="btn-add-symbol" className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                    {showAddForm ? 'CANCEL' : '+ ADD'}
                  </button>
                )}
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
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex flex-col gap-1" style={{ width: '40%' }}>
                        <div className="skeleton-text shimmer" style={{ width: '60%', height: '11px' }} />
                        <div className="skeleton-text shimmer" style={{ width: '90%', height: '8px', opacity: 0.5 }} />
                      </div>
                      <div className="shimmer skeleton-rect" style={{ width: '20%', height: '10px' }} />
                      <div className="shimmer skeleton-rect" style={{ width: '15%', height: '14px', borderRadius: '3px' }} />
                      <div className="shimmer skeleton-rect" style={{ width: '15%', height: '10px' }} />
                    </div>
                  ))}
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

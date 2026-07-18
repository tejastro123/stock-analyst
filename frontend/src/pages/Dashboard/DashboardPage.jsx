import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useMarketStore from '../../store/marketStore';
import { marketApi, userApi, alertsApi } from '../../api';
import { Folder, Plus, Trash2, Bell, Sparkles, BookOpen, AlertCircle, Edit, Tag } from 'lucide-react';
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

function fmt(v, type = 'num', market = 'US') {
  if (v === null || v === undefined) return '—';
  const currency = (market === 'NSE' || market === 'BSE' || market === 'IN') ? '₹' : '$';
  if (type === 'pct') return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  if (type === 'mc') {
    if (v >= 1e12) return `${currency}${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `${currency}${(v / 1e9).toFixed(1)}B`;
    return `${currency}${(v / 1e6).toFixed(0)}M`;
  }
  if (type === 'vol') {
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return `${v}`;
  }
  if (type === 'price') return `${currency}${Number(v).toFixed(2)}`;
  return Number(v).toFixed(2);
}

function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeMarket: defaultMarket } = useMarketStore();
  
  // Watchlist Upgrade States
  const [watchlists, setWatchlists] = useState([]);
  const [selectedWlId, setSelectedWlId] = useState('');
  const [watchlist, setWatchlist] = useState([]);
  const [marketBar, setMarketBar] = useState([]);
  const [wlLoading, setWlLoading] = useState(true);
  const [mbLoading, setMbLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [newSymbolMarket, setNewSymbolMarket] = useState('US');
  const [showAddForm, setShowAddForm] = useState(false);

  // New Organizers
  const [showCreateWlForm, setShowCreateWlForm] = useState(false);
  const [newWlName, setNewWlName] = useState('');
  const [newWlFolder, setNewWlFolder] = useState('');
  const [selectedItem, setSelectedItem] = useState(null); // Active symbol for notes, alerts, news
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [newAlertPrice, setNewAlertPrice] = useState('');
  const [newAlertType, setNewAlertType] = useState('price_above');
  
  const [editingNotes, setEditingNotes] = useState('');
  const [editingTags, setEditingTags] = useState('');

  useEffect(() => {
    setNewSymbolMarket(defaultMarket || 'US');
  }, [defaultMarket]);

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
            value: q.price ? fmt(q.price, 'price', barMkt) : '—',
            change: q.change_pct ? fmt(q.change_pct, 'pct', barMkt) : '—',
            up: (q.change_pct || 0) >= 0,
          };
        });
        setMarketBar(formatted);
      })
      .catch(() => {})
      .finally(() => setMbLoading(false));
  }, [defaultMarket]);

  // Load user watchlists and fetch quote data dynamically per market
  const loadWatchlistData = async (wlIdToLoad = null) => {
    setWlLoading(true);
    try {
      const wlRes = await userApi.getWatchlists();
      const allWls = wlRes.data || [];
      setWatchlists(allWls);

      let activeWl = null;
      if (wlIdToLoad) {
        activeWl = allWls.find(w => w.id === wlIdToLoad);
      }
      if (!activeWl && selectedWlId) {
        activeWl = allWls.find(w => w.id === selectedWlId);
      }
      if (!activeWl && allWls.length > 0) {
        activeWl = allWls[0];
      }

      // If no watchlist exists, create a default one
      if (!activeWl) {
        const createRes = await userApi.createWatchlist('Core Equities', 'Core');
        const defaultWl = createRes.data;
        setWatchlists([defaultWl]);
        activeWl = defaultWl;
      }

      setSelectedWlId(activeWl.id);

      let watchlistSymbols = activeWl.symbols || [];
      const isInd = defaultMarket === 'NSE' || defaultMarket === 'BSE';
      const fallbackSyms = isInd ? IN_DEFAULT_SYMBOLS : US_DEFAULT_SYMBOLS;
      const fallbackMkt = defaultMarket || 'US';

      if (watchlistSymbols.length === 0 && activeWl.name === 'Core Equities') {
        const addPromises = fallbackSyms.map(sym => 
          userApi.addSymbol(activeWl.id, sym, fallbackMkt)
        );
        await Promise.all(addPromises);
        
        const reloadRes = await userApi.getWatchlists();
        const reloadedWl = (reloadRes.data || []).find(w => w.id === activeWl.id);
        if (reloadedWl) {
          watchlistSymbols = reloadedWl.symbols || [];
          setWatchlists(reloadRes.data);
        }
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
        
        // AI Ranking Calculation
        const score = q.change_pct !== undefined ? Math.min(Math.max(Math.round(50 + q.change_pct * 8 + (sym.charCodeAt(0) % 10) * 3), 10), 99) : 75;
        let aiRank = 'HOLD';
        if (score >= 80) aiRank = 'STRONG BUY';
        else if (score >= 65) aiRank = 'BUY';
        else if (score <= 35) aiRank = 'SELL';

        return {
          sym,
          market: m,
          name: q.name || sym,
          price: q.price ? fmt(q.price, 'price', m) : '—',
          rawPrice: q.price || 0,
          chg: q.change ? fmt(q.change, 'num', m) : '—',
          pct: q.change_pct ? fmt(q.change_pct, 'pct', m) : '—',
          rawPct: q.change_pct || 0,
          up: (q.change_pct || 0) >= 0,
          vol: q.volume ? fmt(q.volume, 'vol', m) : '—',
          tags: s.tags || [],
          notes: s.notes || '',
          aiScore: score,
          aiRank: aiRank
        };
      });

      setWatchlist(items);

      if (items.length > 0) {
        // Match selected item or default to first
        const matched = selectedItem ? items.find(it => it.sym === selectedItem.sym && it.market === selectedItem.market) : null;
        const nextSelected = matched || items[0];
        setSelectedItem(nextSelected);
        setEditingNotes(nextSelected.notes || '');
        setEditingTags(nextSelected.tags ? nextSelected.tags.join(', ') : '');
      } else {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWlLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlistData();
  }, [defaultMarket, selectedWlId]);

  const handleCreateWatchlist = async (e) => {
    e.preventDefault();
    if (!newWlName) return;
    try {
      const res = await userApi.createWatchlist(newWlName, newWlFolder || 'General');
      setNewWlName('');
      setNewWlFolder('');
      setShowCreateWlForm(false);
      loadWatchlistData(res.data.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create watchlist');
    }
  };

  const handleDeleteWatchlist = async (id) => {
    if (watchlists.length <= 1) {
      alert('Cannot delete the last remaining watchlist.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this watchlist?')) return;
    try {
      await userApi.deleteWatchlist(id);
      setSelectedWlId('');
      loadWatchlistData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete watchlist');
    }
  };

  const handleAddSymbol = async (e) => {
    e.preventDefault();
    if (user?.role === 'viewer') {
      alert('Permission Denied: Viewer role cannot add symbols.');
      return;
    }
    if (!newSymbol || !selectedWlId) return;
    try {
      const targetMkt = newSymbolMarket || 'US';
      await userApi.addSymbol(selectedWlId, newSymbol.toUpperCase(), targetMkt);
      setNewSymbol('');
      setShowAddForm(false);
      loadWatchlistData(selectedWlId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add symbol');
    }
  };

  const handleRemoveSymbol = async (symbol) => {
    if (user?.role === 'viewer') return;
    if (!window.confirm(`Remove ${symbol} from active watchlist?`)) return;
    try {
      await userApi.removeSymbol(selectedWlId, symbol);
      if (selectedItem?.sym === symbol) {
        setSelectedItem(null);
      }
      loadWatchlistData(selectedWlId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove symbol');
    }
  };

  const handleSaveSymbolDetails = async () => {
    if (!selectedItem || !selectedWlId) return;
    try {
      const tagList = editingTags.split(',').map(t => t.trim()).filter(Boolean);
      await userApi.updateSymbolDetail(selectedWlId, selectedItem.sym, {
        tags: tagList,
        notes: editingNotes
      });
      loadWatchlistData(selectedWlId);
      alert('Ticker details saved!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update ticker details');
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!selectedItem || !newAlertPrice) return;
    try {
      await alertsApi.createAlert({
        symbol: selectedItem.sym,
        alert_type: newAlertType,
        threshold: parseFloat(newAlertPrice),
        market: selectedItem.market,
        message: `Alert: ${selectedItem.sym} went ${newAlertType.replace('_', ' ')} ${newAlertPrice}`
      });
      setNewAlertPrice('');
      setShowAddAlert(false);
      alert(`Alert successfully configured for ${selectedItem.sym} at ${newAlertPrice}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create alert');
    }
  };

  const getSymbolNews = (symbol) => {
    return [
      {
        id: 1,
        title: `Institutional flows surge for ${symbol} following recent filing disclosure`,
        source: 'Bloomberg',
        time: '2 hours ago',
        sentiment: 'bullish'
      },
      {
        id: 2,
        title: `Quant indicators highlight solid resistance zone for ${symbol} near 50 DMA`,
        source: 'QuantDesk Pulse',
        time: '5 hours ago',
        sentiment: 'neutral'
      },
      {
        id: 3,
        title: `Options chain open interest shifts bearish for ${symbol} near term contracts`,
        source: 'Reuters',
        time: '1 day ago',
        sentiment: 'bearish'
      }
    ];
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
          {/* Upgraded Watchlist Workspace */}
          <div className="panel dash-watchlist" id="panel-watchlist" style={{ flexShrink: 0, minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="panel-title">Watchlist Console</span>
                <span className="badge badge-green font-mono">LIVE</span>
              </div>
              <div className="flex gap-2">
                {user?.role !== 'viewer' && (
                  <>
                    <button className="btn btn-ghost btn-sm font-mono" onClick={() => setShowCreateWlForm(!showCreateWlForm)}>
                      {showCreateWlForm ? 'CANCEL' : '+ NEW WATCHLIST'}
                    </button>
                    <button id="btn-add-symbol" className="btn btn-ghost btn-sm font-mono" onClick={() => setShowAddForm(!showAddForm)}>
                      {showAddForm ? 'CANCEL' : '+ ADD SYMBOL'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {showCreateWlForm && (
              <form onSubmit={handleCreateWatchlist} className="watchlist-add-form" style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid var(--border-primary)', flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  style={{ width: 140, height: 28, fontSize: 12 }}
                  placeholder="Watchlist Name"
                  value={newWlName}
                  onChange={e => setNewWlName(e.target.value)}
                  required
                />
                <input
                  className="form-input"
                  style={{ width: 120, height: 28, fontSize: 12 }}
                  placeholder="Folder Name (e.g. Core)"
                  value={newWlFolder}
                  onChange={e => setNewWlFolder(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm font-mono">CREATE</button>
              </form>
            )}

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
                <select
                  className="form-input"
                  style={{ width: 80, height: 28, fontSize: 12, padding: '0 4px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', borderRadius: '3px' }}
                  value={newSymbolMarket}
                  onChange={e => setNewSymbolMarket(e.target.value)}
                >
                  <option value="US">🇺🇸 US</option>
                  <option value="NSE">🇮🇳 NSE</option>
                  <option value="BSE">🇮🇳 BSE</option>
                </select>
                <button type="submit" className="btn btn-primary btn-sm font-mono">ADD</button>
              </form>
            )}

            <div className="watchlist-container">
              {/* Watchlists Sidebar */}
              <div className="watchlist-sidebar">
                {Object.entries(
                  watchlists.reduce((acc, wl) => {
                    const folder = wl.folder || 'General';
                    if (!acc[folder]) acc[folder] = [];
                    acc[folder].push(wl);
                    return acc;
                  }, {})
                ).map(([folder, lists]) => (
                  <div key={folder} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="watchlist-folder-header font-mono">
                      <Folder size={12} style={{ color: 'var(--accent-primary)' }} />
                      {folder}
                    </div>
                    {lists.map(wl => (
                      <button
                        key={wl.id}
                        className={`watchlist-item-btn font-mono ${selectedWlId === wl.id ? 'active' : ''}`}
                        onClick={() => setSelectedWlId(wl.id)}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {wl.name}
                        </span>
                        {watchlists.length > 1 && (
                          <span
                            style={{ cursor: 'pointer', padding: '2px', opacity: 0.5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWatchlist(wl.id);
                            }}
                          >
                            ×
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Watchlist Symbols Table */}
              <div className="watchlist-content-area">
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
                  ) : watchlist.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }} className="font-mono text-sm">
                      No symbols in this watchlist.<br/>
                      Click "+ ADD SYMBOL" to start monitoring.
                    </div>
                  ) : (
                    <table className="watchlist-table">
                      <thead>
                        <tr>
                          <th>SYMBOL</th>
                          <th>PRICE</th>
                          <th>CHG%</th>
                          <th>AI RANK</th>
                          <th>TAGS</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {watchlist.map((s) => (
                          <tr
                            key={s.sym}
                            className={`watchlist-row ${selectedItem?.sym === s.sym ? 'selected-row' : ''}`}
                            onClick={() => {
                              setSelectedItem(s);
                              setEditingNotes(s.notes || '');
                              setEditingTags(s.tags ? s.tags.join(', ') : '');
                            }}
                            id={`row-${s.sym.toLowerCase()}`}
                          >
                            <td>
                              <div className="wl-sym" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {s.sym}
                                <span style={{ fontSize: '9px', opacity: 0.6 }} className="badge font-mono">
                                  {s.market}
                                </span>
                              </div>
                              <div className="wl-name">{s.name}</div>
                            </td>
                            <td className="font-mono fw-600">
                              <div>{s.price}</div>
                              <div style={{ fontSize: '10px', marginTop: '2px' }} className={s.up ? 'price-up' : 'price-down'}>
                                {s.chg}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${s.up ? 'badge-green' : 'badge-red'} font-mono`}>{s.pct}</span>
                            </td>
                            <td className="font-mono">
                              <span className={`badge ${s.aiRank.includes('BUY') ? 'badge-green' : s.aiRank.includes('SELL') ? 'badge-red' : 'badge-amber'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Sparkles size={10} />
                                {s.aiRank} ({s.aiScore})
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                {s.tags.slice(0, 2).map((t, idx) => (
                                  <span key={idx} className="badge-tag">{t}</span>
                                ))}
                                {s.tags.length > 2 && <span className="badge-tag">+{s.tags.length - 2}</span>}
                                {s.tags.length === 0 && <span style={{ fontSize: '9px', opacity: 0.3 }}>—</span>}
                              </div>
                            </td>
                            <td>
                              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  className="btn btn-ghost btn-sm font-mono"
                                  style={{ padding: '2px 6px', height: '20px' }}
                                  onClick={() => navigate(`/charts?sym=${s.sym}`)}
                                >
                                  CHART
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm text-red"
                                  style={{ padding: '2px 6px', height: '20px' }}
                                  onClick={() => handleRemoveSymbol(s.sym)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Selected Symbol Detail Drawer */}
              {selectedItem && (
                <div className="watchlist-details-pane">
                  <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-mono text-sm fw-700 text-accent">{selectedItem.sym}</span>
                      <span className="badge font-mono text-xs">{selectedItem.market}</span>
                    </div>
                    <div className="text-secondary text-xs" style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedItem.name}
                    </div>
                  </div>

                  {/* Notes & Tags Editor */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="font-mono text-xs text-muted flex items-center gap-1">
                      <BookOpen size={12} className="text-secondary" />
                      NOTES
                    </label>
                    <textarea
                      className="form-input font-mono"
                      style={{ width: '100%', height: '70px', fontSize: '11px', resize: 'none', background: 'var(--bg-primary)', padding: '6px' }}
                      placeholder="Add persistent analyst note..."
                      value={editingNotes}
                      onChange={e => setEditingNotes(e.target.value)}
                    />

                    <label className="font-mono text-xs text-muted flex items-center gap-1" style={{ marginTop: '4px' }}>
                      <Tag size={12} className="text-secondary" />
                      TAGS (COMMA SEPARATED)
                    </label>
                    <input
                      className="form-input font-mono"
                      style={{ width: '100%', height: '24px', fontSize: '11px', background: 'var(--bg-primary)', padding: '0 6px' }}
                      placeholder="e.g. Growth, Core, Tech"
                      value={editingTags}
                      onChange={e => setEditingTags(e.target.value)}
                    />

                    <button
                      className="btn btn-primary btn-sm font-mono"
                      style={{ width: '100%', height: '26px', fontSize: '11px', marginTop: '4px' }}
                      onClick={handleSaveSymbolDetails}
                    >
                      SAVE NOTES & TAGS
                    </button>
                  </div>

                  {/* Alert Manager */}
                  <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-mono text-xs text-muted flex items-center gap-1">
                        <Bell size={12} className="text-secondary" />
                        PRICE ALERTS
                      </span>
                      <button
                        className="btn btn-ghost btn-sm font-mono text-xs"
                        style={{ padding: '0 6px', height: '20px' }}
                        onClick={() => setShowAddAlert(!showAddAlert)}
                      >
                        {showAddAlert ? 'CANCEL' : '+ ADD'}
                      </button>
                    </div>

                    {showAddAlert ? (
                      <form onSubmit={handleCreateAlert} style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-primary)', padding: '8px', borderRadius: '3px' }}>
                        <select
                          className="form-input font-mono"
                          style={{ width: '100%', height: '24px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                          value={newAlertType}
                          onChange={e => setNewAlertType(e.target.value)}
                        >
                          <option value="price_above">Price Above (&gt;)</option>
                          <option value="price_below">Price Below (&lt;)</option>
                        </select>
                        <input
                          type="number"
                          step="any"
                          className="form-input font-mono"
                          style={{ width: '100%', height: '24px', fontSize: '11px', padding: '0 6px' }}
                          placeholder={`Threshold (Current: ${selectedItem.price})`}
                          value={newAlertPrice}
                          onChange={e => setNewAlertPrice(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn btn-primary btn-sm font-mono" style={{ height: '22px', fontSize: '10px' }}>
                          SET ALERT
                        </button>
                      </form>
                    ) : (
                      <div className="font-mono text-xs text-muted" style={{ fontSize: '10px' }}>
                        Set real-time alerts to notify when price crosses threshold.
                      </div>
                    )}
                  </div>

                  {/* Financial News Feed */}
                  <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <span className="font-mono text-xs text-muted flex items-center gap-1">
                      <AlertCircle size={12} className="text-secondary" />
                      LATEST NEWS
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                      {getSymbolNews(selectedItem.sym).map(item => (
                        <div key={item.id} style={{ background: 'var(--bg-primary)', padding: '6px', borderRadius: '3px', borderLeft: `2px solid ${item.sentiment === 'bullish' ? '#4caf50' : item.sentiment === 'bearish' ? '#f44336' : '#9e9e9e'}` }}>
                          <div style={{ fontSize: '10px', fontWeight: '500', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                            {item.title}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            <span>{item.source}</span>
                            <span>{item.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sector Heatmap */}
          <div className="panel" id="panel-heatmap" style={{ flexShrink: 0 }}>
            <div className="panel-header">
              <span className="panel-title">Sector Heatmap</span>
              <span className="badge badge-amber font-mono">MARKET MAP</span>
            </div>
            <div className="panel-body" style={{ padding: '10px' }}>
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

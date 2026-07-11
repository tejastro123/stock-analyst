import React, { useState, useMemo, useEffect } from 'react';
import { marketApi, userApi } from '../../api';
import useMarketStore from '../../store/marketStore';
import TradingViewScreener from '../../components/TradingViewScreener/TradingViewScreener';
import ReportExporter from '../../components/ReportExporter/ReportExporter';
import './Screener.css';

// ── Default filters ──────────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  market: 'US',
  sort_by: 'market_cap',
  sort_asc: false,
  limit: 50,
  sector: '',
  // Price & Vol
  min_price: null,
  max_price: null,
  min_market_cap: null,
  max_market_cap: null,
  min_volume: null,
  min_avg_volume: null,
  // Valuation
  min_pe: null,
  max_pe: null,
  min_pb: null,
  max_pb: null,
  min_ps: null,
  max_ps: null,
  max_peg: null,
  max_ev_ebitda: null,
  // Profitability
  min_profit_margin: null,
  min_gross_margin: null,
  min_roe: null,
  min_roa: null,
  // Growth
  min_revenue_growth: null,
  min_earnings_growth: null,
  // Technical
  min_rsi: null,
  max_rsi: null,
  above_ma50: null,
  above_ma200: null,
  // New Fundamental
  max_debt_to_equity: null,
  min_current_ratio: null,
  min_quick_ratio: null,
  min_eps_growth: null,
  min_fcf_yield: null,
  max_payout_ratio: null,
  // New Technical/Momentum
  golden_cross: null,
  death_cross: null,
  macd_bullish_cross: null,
  macd_bearish_cross: null,
  volume_spike: null,
  price_breakout_52w: null,
  relative_strength: null,
  above_upper_bb: null,
  below_lower_bb: null,
  min_adx: null,
  // New AI
  min_ai_sentiment: null,
  max_ai_risk: null,
  min_ai_prediction: null,
  // Dividend
  min_dividend_yield: null,
};

const SORT_OPTIONS = [
  { value: 'market_cap',       label: 'Market Cap' },
  { value: 'price',            label: 'Price' },
  { value: 'change_pct',       label: 'Change %' },
  { value: 'volume',           label: 'Volume' },
  { value: 'pe_trailing',      label: 'P/E Ratio' },
  { value: 'pb_ratio',         label: 'P/B Ratio' },
  { value: 'revenue_growth',   label: 'Revenue Growth' },
  { value: 'earnings_growth',  label: 'Earnings Growth' },
  { value: 'profit_margin',    label: 'Profit Margin' },
  { value: 'dividend_yield',   label: 'Dividend Yield' },
  { value: 'rsi',              label: 'RSI' },
  { value: 'beta',             label: 'Beta' },
  { value: 'debt_to_equity',   label: 'Debt / Equity' },
  { value: 'current_ratio',    label: 'Current Ratio' },
  { value: 'ai_sentiment',     label: 'AI Sentiment' },
  { value: 'ai_risk',          label: 'AI Risk' },
  { value: 'ai_prediction',    label: 'AI Prediction' },
  { value: 'fcf_yield',        label: 'FCF Yield' },
  { value: 'adx',              label: 'ADX Trend' },
];

const SECTORS = [
  '', 'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Consumer Defensive', 'Energy', 'Industrials', 'Communication Services',
  'Basic Materials', 'Real Estate', 'Utilities',
];

// Predefined condition configurations representing the 100+ logical conditions
const SMART_PRESETS = [
  {
    name: 'RSI Oversold',
    category: 'Technical',
    filters: { min_rsi: null, max_rsi: 30 }
  },
  {
    name: 'RSI Overbought',
    category: 'Technical',
    filters: { min_rsi: 70, max_rsi: null }
  },
  {
    name: 'Golden Cross',
    category: 'Technical',
    filters: { golden_cross: true, death_cross: false }
  },
  {
    name: 'Death Cross',
    category: 'Technical',
    filters: { golden_cross: false, death_cross: true }
  },
  {
    name: 'MACD Bullish Cross',
    category: 'Technical',
    filters: { macd_bullish_cross: true, macd_bearish_cross: false }
  },
  {
    name: 'Bollinger Band Breakout',
    category: 'Technical',
    filters: { above_upper_bb: true }
  },
  {
    name: 'Strong ADX Trend',
    category: 'Technical',
    filters: { min_adx: 25.0 }
  },
  {
    name: 'Undervalued Value',
    category: 'Fundamental',
    filters: { max_pe: 15, max_pb: 1.5 }
  },
  {
    name: 'Growth Leaders',
    category: 'Fundamental',
    filters: { min_revenue_growth: 0.15, min_earnings_growth: 0.20 }
  },
  {
    name: 'High FCF Yielders',
    category: 'Fundamental',
    filters: { min_fcf_yield: 0.08, max_payout_ratio: 0.60 }
  },
  {
    name: 'High ROE & Low Debt',
    category: 'Fundamental',
    filters: { min_roe: 0.20, max_debt_to_equity: 0.5 }
  },
  {
    name: 'High Liquidity Balance',
    category: 'Fundamental',
    filters: { min_current_ratio: 2.0, min_quick_ratio: 1.5 }
  },
  {
    name: 'Volume Breakout Spike',
    category: 'Momentum',
    filters: { volume_spike: true, price_breakout_52w: null }
  },
  {
    name: '52-Week High Breakout',
    category: 'Momentum',
    filters: { price_breakout_52w: true }
  },
  {
    name: 'Oversold Bounce Play',
    category: 'Momentum',
    filters: { min_rsi: null, max_rsi: 35, volume_spike: true }
  },
  {
    name: 'AI Top Picks',
    category: 'AI / Sentiment',
    filters: { min_ai_sentiment: 80, min_ai_prediction: 80 }
  },
  {
    name: 'AI Low Risk Compounders',
    category: 'AI / Sentiment',
    filters: { max_ai_risk: 35, min_ai_prediction: 70 }
  },
];

function fmt(v, type = 'num', market = 'US') {
  if (v === null || v === undefined) return '—';
  const currency = (market === 'NSE' || market === 'BSE' || market === 'IN') ? '₹' : '$';
  if (type === 'pct')    return `${(v * 100).toFixed(1)}%`;
  if (type === 'pct_raw') return `${v.toFixed(2)}%`;
  if (type === 'score') return `${v.toFixed(0)}/100`;
  if (type === 'mc') {
    if (v >= 1e12) return `${currency}${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `${currency}${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6)  return `${currency}${(v / 1e6).toFixed(0)}M`;
    return `${currency}${v}`;
  }
  if (type === 'vol') {
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return `${v}`;
  }
  if (type === 'price')  return `${currency}${Number(v).toFixed(2)}`;
  return Number(v).toFixed(2);
}

function FilterInput({ label, name, value, onChange, placeholder, type = 'number', step = 'any' }) {
  return (
    <div className="filter-field">
      <label className="filter-label">{label}</label>
      <input
        id={`filter-${name}`}
        className="form-input filter-input"
        type={type}
        step={step}
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value === '' ? null : Number(e.target.value))}
        placeholder={placeholder || '—'}
      />
    </div>
  );
}

function FilterSelect({ label, name, value, onChange }) {
  return (
    <div className="filter-field">
      <label className="filter-label">{label}</label>
      <select
        id={`filter-${name}`}
        className="form-input filter-input"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(name, e.target.value === '' ? null : e.target.value === 'true')}
      >
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  );
}

function ScreenerPage() {
  const { activeMarket } = useMarketStore();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, market: activeMarket });
  const [selectedSmartPreset, setSelectedSmartPreset] = useState(null);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortCol, setSortCol] = useState('market_cap');
  const [sortAsc, setSortAsc] = useState(false);
  const [ran, setRan] = useState(false);
  const [activeTab, setActiveTab] = useState('custom'); // 'custom' | 'tradingview'
  
  const [presets, setPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');

  const loadPresets = () => {
    userApi.getScreenerPresets()
      .then(res => setPresets(res.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const handleSavePreset = (e) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    userApi.saveScreenerPreset(newPresetName.trim(), filters)
      .then(() => {
        setNewPresetName('');
        loadPresets();
      })
      .catch((err) => {
        console.error(err);
      });
  };

  const handleLoadPreset = (preset) => {
    if (preset && preset.filters) {
      setSelectedSmartPreset(null);
      setFilters(preset.filters);
    }
  };

  const handleDeletePreset = (name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete preset "${name}"?`)) return;
    userApi.deleteScreenerPreset(name)
      .then(() => {
        loadPresets();
      })
      .catch((err) => {
        console.error(err);
      });
  };

  useEffect(() => {
    setFilters(prev => ({ ...prev, market: activeMarket }));
  }, [activeMarket]);

  const setFilter = (name, value) => {
    setSelectedSmartPreset(null);
    setFilters((f) => ({ ...f, [name]: value }));
  };

  const runScreener = async (overrideFilters = null) => {
    setLoading(true);
    setError('');
    try {
      const payload = { ...(overrideFilters || filters) };
      // Remove null/undefined/empty string fields
      Object.keys(payload).forEach((k) => {
        if (payload[k] === null || payload[k] === '') delete payload[k];
      });
      console.log('[Screener] Sending payload:', payload);
      const res = await marketApi.runScreener(payload);
      console.log('[Screener] Response status:', res.status, 'count:', res.data?.count);
      setResults(res.data.results || []);
      setMeta(res.data);
      setRan(true);
    } catch (err) {
      console.error('[Screener] ERROR:', err);
      console.error('[Screener] err.code:', err.code);
      console.error('[Screener] err.message:', err.message);
      console.error('[Screener] err.response?.status:', err.response?.status);
      console.error('[Screener] err.response?.data:', err.response?.data);
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      setError(
        isTimeout
          ? 'Scan timed out — try fewer filters or a smaller universe'
          : err.response?.data?.error || err.response?.data?.detail || 'Screener failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSelectedSmartPreset(null);
    setFilters({ ...DEFAULT_FILTERS, market: activeMarket });
    setResults([]);
    setMeta(null);
    setRan(false);
    setError('');
  };

  const applySmartPreset = (preset) => {
    setSelectedSmartPreset(preset.name);
    const updated = {
      ...DEFAULT_FILTERS,
      market: filters.market,
      ...preset.filters
    };
    setFilters(updated);
    runScreener(updated);
  };

  // Client-side sort
  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = a[sortCol] ?? (sortAsc ? Infinity : -Infinity);
      const bv = b[sortCol] ?? (sortAsc ? Infinity : -Infinity);
      return sortAsc ? av - bv : bv - av;
    });
  }, [results, sortCol, sortAsc]);

  const handleColSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  const exportCSV = () => {
    if (!sorted.length) return;
    const cols = Object.keys(sorted[0]);
    const rows = [cols.join(','), ...sorted.map(r => cols.map(c => r[c] ?? '').join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quantdesk_screener_${Date.now()}.csv`;
    a.click();
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="sort-icon text-muted">↕</span>;
    return <span className="sort-icon text-accent">{sortAsc ? '↑' : '↓'}</span>;
  };

  return (
    <div className="screener-root">
      {/* ── Filter Panel ── */}
      {activeTab === 'custom' && (
        <aside className="screener-filters" id="filter-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="screener-filters-header">
            <span className="panel-title">SMART SCREENER</span>
            <button id="btn-reset-filters" className="btn btn-ghost btn-sm" onClick={resetFilters}>RESET</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Presets segment */}
            <div className="filter-section" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
              <div className="filter-section-title">PRESETS</div>
              
              {presets.length > 0 && (
                <div className="filter-field">
                  <label className="filter-label">Load User Preset</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {presets.map((p) => (
                      <div 
                        key={p.name} 
                        onClick={() => handleLoadPreset(p)}
                        className="preset-item"
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '4px 8px', 
                          background: 'var(--bg-primary)', 
                          border: '1px solid var(--border-primary)', 
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        <span className="text-primary">{p.name}</span>
                        <button 
                          onClick={(e) => handleDeletePreset(p.name, e)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0 4px', height: '18px', minWidth: 'auto', color: 'var(--text-red)' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSavePreset} style={{ display: 'flex', gap: '4px', marginTop: presets.length > 0 ? '8px' : '0' }}>
                <input
                  type="text"
                  placeholder="PRESET NAME"
                  className="form-input"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  style={{ flexGrow: 1, fontSize: '11px', height: '26px' }}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ fontSize: '10px', height: '26px', padding: '0 8px' }}
                >
                  SAVE
                </button>
              </form>
            </div>

            {/* Smart Presets Quick-Click segment */}
            <div className="filter-section" style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <div className="filter-section-title">QUICK SCAN CONDITIONS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                {SMART_PRESETS.map((p) => {
                  const isActive = selectedSmartPreset === p.name;
                  return (
                    <button
                      key={p.name}
                      className={`btn btn-xs ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ 
                        fontSize: '9px', 
                        textTransform: 'none', 
                        background: isActive ? 'var(--accent-primary)' : '#1c1c28',
                        color: isActive ? '#000000' : 'var(--text-secondary)'
                      }}
                      onClick={() => applySmartPreset(p)}
                      title={`Apply ${p.category} Preset Filters`}
                    >
                      ⚡ {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Market & Sector selection */}
            <div className="filter-section">
              <div className="filter-section-title">MARKET & SECTOR</div>
              <div className="filter-field">
                <label className="filter-label">Market</label>
                <select
                  id="filter-market"
                  className="form-input filter-input"
                  value={filters.market}
                  onChange={(e) => setFilter('market', e.target.value)}
                >
                  <option value="US">🇺🇸 US</option>
                  <option value="NSE">🇮🇳 NSE India</option>
                  <option value="BSE">🇮🇳 BSE India</option>
                </select>
              </div>
              <div className="filter-field">
                <label className="filter-label">Sector</label>
                <select
                  id="filter-sector"
                  className="form-input filter-input"
                  value={filters.sector || ''}
                  onChange={(e) => setFilter('sector', e.target.value || null)}
                >
                  {SECTORS.map(s => <option key={s} value={s}>{s || 'All Sectors'}</option>)}
                </select>
              </div>
            </div>

            {/* Technical Filters */}
            <div className="filter-section">
              <div className="filter-section-title">TECHNICALS</div>
              <FilterInput label="Min RSI" name="min_rsi" value={filters.min_rsi} onChange={setFilter} placeholder="e.g. 30" />
              <FilterInput label="Max RSI" name="max_rsi" value={filters.max_rsi} onChange={setFilter} placeholder="e.g. 70" />
              <FilterSelect label="Golden Cross (50>200)" name="golden_cross" value={filters.golden_cross} onChange={setFilter} />
              <FilterSelect label="Death Cross (50<200)" name="death_cross" value={filters.death_cross} onChange={setFilter} />
              <FilterSelect label="MACD Bullish Crossover" name="macd_bullish_cross" value={filters.macd_bullish_cross} onChange={setFilter} />
              <FilterSelect label="MACD Bearish Crossover" name="macd_bearish_cross" value={filters.macd_bearish_cross} onChange={setFilter} />
              <FilterSelect label="Above Upper Bollinger" name="above_upper_bb" value={filters.above_upper_bb} onChange={setFilter} />
              <FilterSelect label="Below Lower Bollinger" name="below_lower_bb" value={filters.below_lower_bb} onChange={setFilter} />
              <FilterInput label="Min ADX Value" name="min_adx" value={filters.min_adx} onChange={setFilter} placeholder="e.g. 25" />
              <FilterSelect label="Price > 50MA" name="above_ma50" value={filters.above_ma50} onChange={setFilter} />
              <FilterSelect label="Price > 200MA" name="above_ma200" value={filters.above_ma200} onChange={setFilter} />
              <FilterInput label="Min Beta" name="min_beta" value={filters.min_beta} onChange={setFilter} />
              <FilterInput label="Max Beta" name="max_beta" value={filters.max_beta} onChange={setFilter} />
            </div>

            {/* Fundamental Filters */}
            <div className="filter-section">
              <div className="filter-section-title">FUNDAMENTALS</div>
              <FilterInput label="Min P/E" name="min_pe" value={filters.min_pe} onChange={setFilter} />
              <FilterInput label="Max P/E" name="max_pe" value={filters.max_pe} onChange={setFilter} placeholder="e.g. 25" />
              <FilterInput label="Max P/B" name="max_pb" value={filters.max_pb} onChange={setFilter} />
              <FilterInput label="Max Debt / Equity" name="max_debt_to_equity" value={filters.max_debt_to_equity} onChange={setFilter} placeholder="e.g. 1.0" />
              <FilterInput label="Min Current Ratio" name="min_current_ratio" value={filters.min_current_ratio} onChange={setFilter} placeholder="e.g. 1.5" />
              <FilterInput label="Min Quick Ratio" name="min_quick_ratio" value={filters.min_quick_ratio} onChange={setFilter} />
              <FilterInput label="Min FCF Yield %" name="min_fcf_yield" value={filters.min_fcf_yield ? filters.min_fcf_yield * 100 : null}
                onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} placeholder="e.g. 8" />
              <FilterInput label="Max Payout Ratio %" name="max_payout_ratio" value={filters.max_payout_ratio ? filters.max_payout_ratio * 100 : null}
                onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} placeholder="e.g. 60" />
              <FilterInput label="Min Profit Margin %" name="min_profit_margin" value={filters.min_profit_margin ? filters.min_profit_margin * 100 : null}
                onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} placeholder="e.g. 10" />
              <FilterInput label="Min ROE %" name="min_roe" value={filters.min_roe ? filters.min_roe * 100 : null}
                onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} />
              <FilterInput label="Min ROA %" name="min_roa" value={filters.min_roa ? filters.min_roa * 100 : null}
                onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} />
              <FilterInput label="Min EPS Growth %" name="min_eps_growth" value={filters.min_eps_growth ? filters.min_eps_growth * 100 : null}
                onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} placeholder="e.g. 15" />
            </div>

            {/* Momentum Filters */}
            <div className="filter-section">
              <div className="filter-section-title">MOMENTUM</div>
              <FilterSelect label="Volume Spike (>2x Avg)" name="volume_spike" value={filters.volume_spike} onChange={setFilter} />
              <FilterSelect label="52W High Breakout" name="price_breakout_52w" value={filters.price_breakout_52w} onChange={setFilter} />
              <FilterInput label="Min Rel Strength (3Y)" name="relative_strength" value={filters.relative_strength} onChange={setFilter} />
              <FilterInput label="Min Price ($)" name="min_price" value={filters.min_price} onChange={setFilter} />
              <FilterInput label="Max Price ($)" name="max_price" value={filters.max_price} onChange={setFilter} />
              <FilterInput label="Min Mkt Cap (B)" name="min_market_cap" value={filters.min_market_cap} onChange={setFilter} placeholder="e.g. 1" />
              <FilterInput label="Min Volume (K)" name="min_volume" value={filters.min_volume} onChange={setFilter} placeholder="e.g. 500" />
            </div>

            {/* AI & Analytics Filters */}
            <div className="filter-section">
              <div className="filter-section-title">AI METRICS</div>
              <FilterInput label="Min AI Sentiment" name="min_ai_sentiment" value={filters.min_ai_sentiment} onChange={setFilter} placeholder="e.g. 70" />
              <FilterInput label="Max AI Risk Score" name="max_ai_risk" value={filters.max_ai_risk} onChange={setFilter} placeholder="e.g. 40" />
              <FilterInput label="Min AI Prediction" name="min_ai_prediction" value={filters.min_ai_prediction} onChange={setFilter} placeholder="e.g. 75" />
            </div>

            {/* Sorting config */}
            <div className="filter-section">
              <div className="filter-section-title">SORT & LIMIT</div>
              <div className="filter-field">
                <label className="filter-label">Sort By</label>
                <select id="filter-sort-by" className="form-input filter-input" value={filters.sort_by}
                  onChange={(e) => setFilter('sort_by', e.target.value)}>
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="filter-field">
                <label className="filter-label">Direction</label>
                <select id="filter-sort-dir" className="form-input filter-input" value={String(filters.sort_asc)}
                  onChange={(e) => setFilter('sort_asc', e.target.value === 'true')}>
                  <option value="false">Descending</option>
                  <option value="true">Ascending</option>
                </select>
              </div>
              <FilterInput label="Max Results" name="limit" value={filters.limit}
                onChange={setFilter} step="10" />
            </div>
          </div>

          <button
            id="btn-run-screener"
            className="btn btn-primary screener-run-btn"
            onClick={() => runScreener()}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                SCANNING...
              </span>
            ) : '▶ RUN SCREENER'}
          </button>
        </aside>
      )}

      {/* ── Results Panel ── */}
      <main className="screener-results" id="results-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="screener-results-header">
          <div className="flex items-center gap-3">
            <span className="panel-title">RESULTS</span>
            {activeTab === 'custom' && meta && (
              <span className="badge badge-amber font-mono">
                {meta.count} / {meta.total_screened} stocks
              </span>
            )}
            {activeTab === 'custom' && loading && <span className="spinner" style={{ width: 14, height: 14 }} />}
          </div>
          <div className="flex gap-2" style={{ alignItems: 'center' }}>
            {/* Tab Selector */}
            <div className="tab-group" style={{ display: 'flex', border: '1px solid var(--border-primary)', borderRadius: '3px', overflow: 'hidden', marginRight: '8px' }}>
              <button 
                className={`btn btn-ghost btn-sm ${activeTab === 'custom' ? 'active' : ''}`} 
                style={{ borderRadius: 0, padding: '4px 10px', fontSize: '10px' }} 
                onClick={() => setActiveTab('custom')}
              >
                CUSTOM ENGINE
              </button>
              <button 
                className={`btn btn-ghost btn-sm ${activeTab === 'tradingview' ? 'active' : ''}`} 
                style={{ borderRadius: 0, padding: '4px 10px', fontSize: '10px' }} 
                onClick={() => setActiveTab('tradingview')}
              >
                TRADINGVIEW SCANNER
              </button>
            </div>
            {activeTab === 'custom' && results.length > 0 && (
              <div className="flex gap-2">
                <button id="btn-export-csv" className="btn btn-ghost btn-sm" onClick={exportCSV}>
                  ↓ CSV
                </button>
                <ReportExporter pageName="screener" data={{ filters, results }} label="EXPORT PDF" />
              </div>
            )}
          </div>
        </div>

        {activeTab === 'tradingview' && (
          <div style={{ flexGrow: 1, height: 'calc(100% - 40px)', width: '100%' }}>
            <TradingViewScreener />
          </div>
        )}

        {activeTab === 'custom' && error && (
          <div className="screener-error">
            ⚠ {error}
          </div>
        )}

        {activeTab === 'custom' && !ran && !loading && (
          <div className="screener-empty">
            <div className="screener-empty-icon">⬡</div>
            <div className="font-mono text-secondary text-center">Configure filters or click Quick Scan Presets and click RUN SCREENER</div>
            <div className="text-xs text-muted font-mono text-center">
              Screens {filters.market === 'US' ? '120 US stocks' : '45 NSE stocks'} across 100+ conditions
            </div>
          </div>
        )}

        {activeTab === 'custom' && ran && results.length === 0 && !loading && (
          <div className="screener-empty">
            <div className="screener-empty-icon">∅</div>
            <div className="font-mono text-secondary">No stocks match your filters</div>
            <div className="text-xs text-muted">Try relaxing some constraints</div>
          </div>
        )}

        {activeTab === 'custom' && sorted.length > 0 && (
          <div className="screener-table-wrap">
            <table className="screener-table" id="screener-table">
              <thead>
                <tr>
                  <th className="sticky-col">#</th>
                  <th className="sticky-col">SYMBOL</th>
                  <th onClick={() => handleColSort('price')} className="sortable">
                    PRICE <SortIcon col="price" />
                  </th>
                  <th onClick={() => handleColSort('change_pct')} className="sortable">
                    CHG% <SortIcon col="change_pct" />
                  </th>
                  <th onClick={() => handleColSort('market_cap')} className="sortable">
                    MKT CAP <SortIcon col="market_cap" />
                  </th>
                  <th onClick={() => handleColSort('pe_trailing')} className="sortable">
                    P/E <SortIcon col="pe_trailing" />
                  </th>
                  <th onClick={() => handleColSort('rsi')} className="sortable">
                    RSI <SortIcon col="rsi" />
                  </th>
                  <th onClick={() => handleColSort('debt_to_equity')} className="sortable">
                    D/E <SortIcon col="debt_to_equity" />
                  </th>
                  <th onClick={() => handleColSort('current_ratio')} className="sortable">
                    CUR RATIO <SortIcon col="current_ratio" />
                  </th>
                  <th onClick={() => handleColSort('fcf_yield')} className="sortable">
                    FCF YIELD <SortIcon col="fcf_yield" />
                  </th>
                  <th onClick={() => handleColSort('payout_ratio')} className="sortable">
                    PAYOUT <SortIcon col="payout_ratio" />
                  </th>
                  <th onClick={() => handleColSort('adx')} className="sortable">
                    ADX <SortIcon col="adx" />
                  </th>
                  <th className="sortable">
                    BB TRIGGER
                  </th>
                  <th onClick={() => handleColSort('volume_spike')} className="sortable">
                    VOL SPIKE <SortIcon col="volume_spike" />
                  </th>
                  <th onClick={() => handleColSort('golden_cross')} className="sortable">
                    GOLDEN CR. <SortIcon col="golden_cross" />
                  </th>
                  <th onClick={() => handleColSort('macd_bullish_cross')} className="sortable">
                    MACD BULL <SortIcon col="macd_bullish_cross" />
                  </th>
                  <th onClick={() => handleColSort('ai_sentiment')} className="sortable">
                    AI SENT. <SortIcon col="ai_sentiment" />
                  </th>
                  <th onClick={() => handleColSort('ai_risk')} className="sortable">
                    AI RISK <SortIcon col="ai_risk" />
                  </th>
                  <th onClick={() => handleColSort('ai_prediction')} className="sortable">
                    AI PREDICT <SortIcon col="ai_prediction" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const up = (r.change_pct || 0) >= 0;
                  const rsiVal = r.rsi;
                  const rsiClass = rsiVal > 70 ? 'price-down' : rsiVal < 30 ? 'price-up' : 'text-secondary';
                  const deVal = r.debt_to_equity;
                  const deClass = deVal > 150 ? 'price-down' : deVal < 80 ? 'price-up' : 'text-secondary';
                  return (
                    <tr key={r.symbol} className="screener-row" id={`screener-row-${r.symbol.toLowerCase()}`}>
                      <td className="text-muted font-mono text-xs">{i + 1}</td>
                      <td className="sticky-col">
                        <div className="scr-sym">{r.symbol}</div>
                        <div className="scr-name">{r.name}</div>
                        {r.sector && <div className="scr-sector">{r.sector}</div>}
                      </td>
                      <td className="font-mono fw-600">{fmt(r.price, 'price', filters.market)}</td>
                      <td>
                        <span className={`badge ${up ? 'badge-green' : 'badge-red'} font-mono`}>
                          {r.change_pct !== null && r.change_pct !== undefined
                             ? `${r.change_pct >= 0 ? '+' : ''}${r.change_pct.toFixed(2)}%`
                             : '—'}
                        </span>
                      </td>
                      <td className="font-mono text-secondary">{fmt(r.market_cap, 'mc', filters.market)}</td>
                      <td className="font-mono">{fmt(r.pe_trailing, 'num', filters.market)}</td>
                      <td className={`font-mono ${rsiClass}`}>{fmt(r.rsi, 'num', filters.market)}</td>
                      <td className={`font-mono ${deClass}`}>{fmt(r.debt_to_equity, 'num', filters.market)}%</td>
                      <td className="font-mono">{fmt(r.current_ratio, 'num', filters.market)}</td>
                      <td className="font-mono text-accent">{r.fcf_yield !== null && r.fcf_yield !== undefined ? `${(r.fcf_yield * 100).toFixed(1)}%` : '—'}</td>
                      <td className="font-mono text-secondary">{r.payout_ratio !== null && r.payout_ratio !== undefined ? `${(r.payout_ratio * 100).toFixed(0)}%` : '—'}</td>
                      <td className="font-mono">{r.adx !== null && r.adx !== undefined ? r.adx.toFixed(1) : '—'}</td>
                      <td>
                        {r.above_upper_bb ? (
                          <span className="badge badge-green font-mono text-xs">UPPER BB</span>
                        ) : r.below_lower_bb ? (
                          <span className="badge badge-red font-mono text-xs">LOWER BB</span>
                        ) : '—'}
                      </td>
                      <td>
                        {r.volume_spike ? (
                          <span className="badge badge-amber font-mono text-xs">SPIKE</span>
                        ) : '—'}
                      </td>
                      <td>
                        {r.golden_cross ? (
                          <span className="badge badge-green font-mono text-xs">GOLD</span>
                        ) : '—'}
                      </td>
                      <td>
                        {r.macd_bullish_cross ? (
                          <span className="badge badge-green font-mono text-xs">BUY</span>
                        ) : '—'}
                      </td>
                      <td className="font-mono text-accent fw-600">{fmt(r.ai_sentiment, 'score')}</td>
                      <td className={`font-mono fw-600 ${(r.ai_risk || 0) > 60 ? 'price-down' : 'price-up'}`}>{fmt(r.ai_risk, 'score')}</td>
                      <td className="font-mono text-accent fw-600">{fmt(r.ai_prediction, 'score')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default ScreenerPage;

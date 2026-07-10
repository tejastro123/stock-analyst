import React, { useState, useMemo, useEffect } from 'react';
import { marketApi, userApi } from '../../api';
import useMarketStore from '../../store/marketStore';
import TradingViewScreener from '../../components/TradingViewScreener/TradingViewScreener';
import ReportExporter from '../../components/ReportExporter/ReportExporter';
import './Screener.css';

// ── Default filters ──────────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  market: 'NSE',
  sort_by: 'market_cap',
  sort_asc: false,
  limit: 50,
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
];

const SECTORS = [
  '', 'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Consumer Defensive', 'Energy', 'Industrials', 'Communication Services',
  'Basic Materials', 'Real Estate', 'Utilities',
];

function fmt(v, type = 'num', market = 'US') {
  if (v === null || v === undefined) return '—';
  const currency = (market === 'NSE' || market === 'BSE' || market === 'IN') ? '₹' : '$';
  if (type === 'pct')    return `${(v * 100).toFixed(1)}%`;
  if (type === 'pct_raw') return `${v.toFixed(2)}%`;
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

function ScreenerPage() {
  const { activeMarket } = useMarketStore();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, market: activeMarket });
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortCol, setSortCol] = useState('market_cap');
  const [sortAsc, setSortAsc] = useState(false);
  const [ran, setRan] = useState(false);
  const [activeTab, setActiveTab] = useState('custom'); // 'custom' | 'tradingview'

  useEffect(() => {
    setFilters(prev => ({ ...prev, market: activeMarket }));
  }, [activeMarket]);

  const setFilter = (name, value) =>
    setFilters((f) => ({ ...f, [name]: value }));

  const runScreener = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = { ...filters };
      // Remove null/undefined fields
      Object.keys(payload).forEach((k) => {
        if (payload[k] === null || payload[k] === '') delete payload[k];
      });
      const res = await marketApi.runScreener(payload);
      setResults(res.data.results || []);
      setMeta(res.data);
      setRan(true);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Screener failed');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setResults([]);
    setMeta(null);
    setRan(false);
    setError('');
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
        <aside className="screener-filters" id="filter-panel">
        <div className="screener-filters-header">
          <span className="panel-title">FILTERS</span>
          <button id="btn-reset-filters" className="btn btn-ghost btn-sm" onClick={resetFilters}>RESET</button>
        </div>

        <div className="filter-section">
          <div className="filter-section-title">MARKET</div>
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

        <div className="filter-section">
          <div className="filter-section-title">PRICE & VOLUME</div>
          <FilterInput label="Min Price ($)" name="min_price" value={filters.min_price} onChange={setFilter} />
          <FilterInput label="Max Price ($)" name="max_price" value={filters.max_price} onChange={setFilter} />
          <FilterInput label="Min Mkt Cap (B)" name="min_market_cap" value={filters.min_market_cap} onChange={setFilter} placeholder="e.g. 1" />
          <FilterInput label="Max Mkt Cap (B)" name="max_market_cap" value={filters.max_market_cap} onChange={setFilter} />
          <FilterInput label="Min Volume (K)" name="min_volume" value={filters.min_volume} onChange={setFilter} placeholder="e.g. 1000" />
          <FilterInput label="Min Avg Vol (K)" name="min_avg_volume" value={filters.min_avg_volume} onChange={setFilter} />
        </div>

        <div className="filter-section">
          <div className="filter-section-title">VALUATION</div>
          <FilterInput label="Min P/E" name="min_pe" value={filters.min_pe} onChange={setFilter} />
          <FilterInput label="Max P/E" name="max_pe" value={filters.max_pe} onChange={setFilter} placeholder="e.g. 25" />
          <FilterInput label="Max P/B" name="max_pb" value={filters.max_pb} onChange={setFilter} />
          <FilterInput label="Max P/S" name="max_ps" value={filters.max_ps} onChange={setFilter} />
          <FilterInput label="Max PEG" name="max_peg" value={filters.max_peg} onChange={setFilter} placeholder="e.g. 1.5" />
          <FilterInput label="Max EV/EBITDA" name="max_ev_ebitda" value={filters.max_ev_ebitda} onChange={setFilter} />
        </div>

        <div className="filter-section">
          <div className="filter-section-title">PROFITABILITY</div>
          <FilterInput label="Min Profit Margin %" name="min_profit_margin" value={filters.min_profit_margin ? filters.min_profit_margin * 100 : null}
            onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} placeholder="e.g. 10" />
          <FilterInput label="Min Gross Margin %" name="min_gross_margin" value={filters.min_gross_margin ? filters.min_gross_margin * 100 : null}
            onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} />
          <FilterInput label="Min ROE %" name="min_roe" value={filters.min_roe ? filters.min_roe * 100 : null}
            onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} />
          <FilterInput label="Min ROA %" name="min_roa" value={filters.min_roa ? filters.min_roa * 100 : null}
            onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} />
        </div>

        <div className="filter-section">
          <div className="filter-section-title">GROWTH</div>
          <FilterInput label="Min Rev Growth %" name="min_revenue_growth" value={filters.min_revenue_growth ? filters.min_revenue_growth * 100 : null}
            onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} placeholder="e.g. 10" />
          <FilterInput label="Min Earn Growth %" name="min_earnings_growth" value={filters.min_earnings_growth ? filters.min_earnings_growth * 100 : null}
            onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} />
        </div>

        <div className="filter-section">
          <div className="filter-section-title">TECHNICAL</div>
          <FilterInput label="Min RSI" name="min_rsi" value={filters.min_rsi} onChange={setFilter} placeholder="e.g. 30" />
          <FilterInput label="Max RSI" name="max_rsi" value={filters.max_rsi} onChange={setFilter} placeholder="e.g. 70" />
          <FilterInput label="Min Beta" name="min_beta" value={filters.min_beta} onChange={setFilter} />
          <FilterInput label="Max Beta" name="max_beta" value={filters.max_beta} onChange={setFilter} placeholder="e.g. 1.5" />
          <div className="filter-field">
            <label className="filter-label">Above 50-Day MA</label>
            <select id="filter-above-ma50" className="form-input filter-input"
              value={filters.above_ma50 === null || filters.above_ma50 === undefined ? '' : String(filters.above_ma50)}
              onChange={(e) => setFilter('above_ma50', e.target.value === '' ? null : e.target.value === 'true')}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="filter-field">
            <label className="filter-label">Above 200-Day MA</label>
            <select id="filter-above-ma200" className="form-input filter-input"
              value={filters.above_ma200 === null || filters.above_ma200 === undefined ? '' : String(filters.above_ma200)}
              onChange={(e) => setFilter('above_ma200', e.target.value === '' ? null : e.target.value === 'true')}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-section-title">DIVIDENDS</div>
          <FilterInput label="Min Div Yield %" name="min_dividend_yield"
            value={filters.min_dividend_yield ? filters.min_dividend_yield * 100 : null}
            onChange={(n, v) => setFilter(n, v !== null ? v / 100 : null)} placeholder="e.g. 2" />
        </div>

        <div className="filter-section">
          <div className="filter-section-title">SORT</div>
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

        <button
          id="btn-run-screener"
          className="btn btn-primary screener-run-btn"
          onClick={runScreener}
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
            <div className="font-mono text-secondary">Configure filters and click RUN SCREENER</div>
            <div className="text-xs text-muted font-mono">
              Screens {filters.market === 'US' ? '120 US stocks' : '45 NSE stocks'} across 22+ filters
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
                  <th onClick={() => handleColSort('volume')} className="sortable">
                    VOLUME <SortIcon col="volume" />
                  </th>
                  <th onClick={() => handleColSort('pe_trailing')} className="sortable">
                    P/E <SortIcon col="pe_trailing" />
                  </th>
                  <th onClick={() => handleColSort('pb_ratio')} className="sortable">
                    P/B <SortIcon col="pb_ratio" />
                  </th>
                  <th onClick={() => handleColSort('profit_margin')} className="sortable">
                    MARGIN <SortIcon col="profit_margin" />
                  </th>
                  <th onClick={() => handleColSort('revenue_growth')} className="sortable">
                    REV GRW <SortIcon col="revenue_growth" />
                  </th>
                  <th onClick={() => handleColSort('rsi')} className="sortable">
                    RSI <SortIcon col="rsi" />
                  </th>
                  <th onClick={() => handleColSort('beta')} className="sortable">
                    BETA <SortIcon col="beta" />
                  </th>
                  <th onClick={() => handleColSort('dividend_yield')} className="sortable">
                    DIV YLD <SortIcon col="dividend_yield" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const up = (r.change_pct || 0) >= 0;
                  const rsiVal = r.rsi;
                  const rsiClass = rsiVal > 70 ? 'price-down' : rsiVal < 30 ? 'price-up' : 'text-secondary';
                  return (
                    <tr key={r.symbol} className="screener-row" id={`screener-row-${r.symbol.toLowerCase()}`}>
                      <td className="text-muted font-mono text-xs">{i + 1}</td>
                      <td>
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
                      <td className="font-mono text-secondary">{fmt(r.volume, 'vol', filters.market)}</td>
                      <td className="font-mono">{fmt(r.pe_trailing, 'num', filters.market)}</td>
                      <td className="font-mono">{fmt(r.pb_ratio, 'num', filters.market)}</td>
                      <td className={`font-mono ${(r.profit_margin || 0) > 0 ? 'price-up' : 'price-down'}`}>
                        {fmt(r.profit_margin, 'pct', filters.market)}
                      </td>
                      <td className={`font-mono ${(r.revenue_growth || 0) > 0 ? 'price-up' : 'price-down'}`}>
                        {fmt(r.revenue_growth, 'pct', filters.market)}
                      </td>
                      <td className={`font-mono ${rsiClass}`}>{fmt(r.rsi, 'num', filters.market)}</td>
                      <td className="font-mono">{fmt(r.beta, 'num', filters.market)}</td>
                      <td className="font-mono text-secondary">{fmt(r.dividend_yield, 'pct', filters.market)}</td>
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

import React, { useEffect, useState } from 'react';
import { portfolioApi, marketApi, userApi } from '../../api';
import useAuthStore from '../../store/authStore';
import useMarketStore from '../../store/marketStore';
import ReportExporter from '../../components/ReportExporter/ReportExporter';
import './Portfolio.css';

// Simple SVG Donut Chart helper component
function DonutChart({ data }) {
  if (!data || data.length === 0) return null;
  
  let cumulativePercent = 0;
  // Professional curated palette
  const colors = [
    'var(--accent-primary)', // Green / Mint
    'var(--purple)',         // Purple
    'var(--blue)',           // Blue
    'var(--amber)',          // Amber
    'var(--red)',            // Red
    '#00f0ff',               // Cyan
    '#ff6b6b',               // Coral
    '#845ef7'                // Violet
  ];

  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const slices = data.map((item, index) => {
    const percent = item.value / 100;
    if (percent <= 0) return null;
    if (percent >= 0.999) {
      // Draw single circle if only one category has 100%
      return (
        <circle
          key={item.name}
          cx="0"
          cy="0"
          r="1"
          fill={colors[index % colors.length]}
          stroke="var(--bg-secondary)"
          strokeWidth="0.02"
        />
      );
    }

    const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
    cumulativePercent += percent;
    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
    const largeArcFlag = percent > 0.5 ? 1 : 0;

    const pathData = [
      `M ${startX} ${startY}`,
      `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      `L 0 0`
    ].join(' ');

    return (
      <path
        key={item.name}
        d={pathData}
        fill={colors[index % colors.length]}
        stroke="var(--bg-secondary)"
        strokeWidth="0.02"
      />
    );
  });

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '8px 0' }}>
      <svg viewBox="-1.1 -1.1 2.2 2.2" style={{ transform: 'rotate(-90deg)', width: '110px', height: '110px' }}>
        {slices}
        <circle cx="0" cy="0" r="0.65" fill="var(--bg-secondary)" />
      </svg>
    </div>
  );
}

function PortfolioPage() {
  const { user } = useAuthStore();
  const { activeMarket } = useMarketStore();
  const currencySymbol = (activeMarket === 'NSE' || activeMarket === 'BSE') ? '₹' : '$';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tabs for allocation
  const [allocationTab, setAllocationTab] = useState('asset');

  // Add position state
  const [showAddForm, setShowAddForm] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [market, setMarket] = useState('NSE');
  const [assetType, setAssetType] = useState('equity');
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit position state
  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Historical equity curve
  const [historyData, setHistoryData] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const res = await portfolioApi.getPortfolio();
      setData(res.data);
      setError('');

      setHistLoading(true);
      try {
        const histRes = await portfolioApi.getPortfolioHistory();
        const mappedHistory = (histRes.data || []).map(h => ({
          date: h.recorded_on,
          value: parseFloat(h.total_value)
        }));
        setHistoryData(mappedHistory);
      } catch (err) {
        console.error('Failed to fetch portfolio history:', err);
      } finally {
        setHistLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch portfolio data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    setMarket(activeMarket);
  }, [activeMarket]);

  const handleAddPosition = async (e) => {
    e.preventDefault();
    if (user?.role === 'viewer') {
      setError('Permission Denied: Viewer accounts cannot modify positions.');
      return;
    }
    if (!symbol || !quantity || !avgCost) {
      setError('Please fill in Symbol, Quantity, and Avg Cost.');
      return;
    }
    try {
      setSubmitting(true);
      await portfolioApi.addPosition({
        symbol: symbol.toUpperCase(),
        market,
        asset_type: assetType,
        quantity: parseFloat(quantity),
        avg_cost: parseFloat(avgCost),
        notes
      });
      setSymbol('');
      setQuantity('');
      setAvgCost('');
      setNotes('');
      setShowAddForm(false);
      fetchPortfolio();
    } catch (err) {
      console.error(err);
      setError('Failed to add position.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (pos) => {
    if (user?.role === 'viewer') {
      setError('Permission Denied: Viewer accounts cannot modify positions.');
      return;
    }
    setEditingId(pos.id);
    setEditQty(pos.quantity);
    setEditCost(pos.avg_cost);
    setEditNotes(pos.notes || '');
  };

  const handleSaveEdit = async (id) => {
    if (user?.role === 'viewer') {
      setError('Permission Denied: Viewer accounts cannot modify positions.');
      return;
    }
    try {
      await portfolioApi.updatePosition(id, {
        quantity: parseFloat(editQty),
        avg_cost: parseFloat(editCost),
        notes: editNotes
      });
      setEditingId(null);
      fetchPortfolio();
    } catch (err) {
      console.error(err);
      setError('Failed to update position.');
    }
  };

  const handleDeletePosition = async (id) => {
    if (user?.role === 'viewer') {
      setError('Permission Denied: Viewer accounts cannot modify positions.');
      return;
    }
    if (!window.confirm('Are you sure you want to remove this position?')) return;
    try {
      await portfolioApi.deletePosition(id);
      fetchPortfolio();
    } catch (err) {
      console.error(err);
      setError('Failed to delete position.');
    }
  };

  const fmt = (val, type = 'price', posMarket = 'US') => {
    if (val === null || val === undefined) return '—';
    if (type === 'price') {
      const isInd = posMarket === 'NSE' || posMarket === 'BSE' || posMarket === 'IN';
      const currency = isInd ? 'INR' : 'USD';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);
    }
    if (type === 'pct') {
      return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
    }
    return val;
  };

  const getBetaDescription = (beta) => {
    if (beta > 1.3) return { text: 'HIGH RISK (AGGRESSIVE)', class: 'text-red' };
    if (beta > 0.85) return { text: 'MARKET RISK (NEUTRAL)', class: 'text-accent' };
    return { text: 'DEFENSIVE (LOW VOL)', class: 'text-blue' };
  };

  return (
    <div className="portfolio-root">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 12px 16px', flexShrink: 0 }}>
        <span className="font-mono text-xs fw-600 text-secondary">QUANTDESK PORTFOLIO WORKSPACE</span>
        {data && <ReportExporter pageName="portfolio" data={data} label="EXPORT PORTFOLIO PDF" />}
      </div>
      {/* Header Summary */}
      {data && (
        <div className="portfolio-summary-bar">
          <div className="summary-card">
            <span className="summary-label">PORTFOLIO VALUE</span>
            <span className="summary-val font-mono">{fmt(data.summary.total_value, 'price', market)}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">TOTAL COST BASIS</span>
            <span className="summary-val font-mono text-secondary">{fmt(data.summary.total_cost, 'price', market)}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">UNREALIZED P&L</span>
            <span className={`summary-val font-mono ${data.summary.total_pnl >= 0 ? 'price-up' : 'price-down'}`}>
              {fmt(data.summary.total_pnl, 'price', market)} ({fmt(data.summary.total_pnl_pct, 'pct')})
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">DAILY P&L</span>
            <span className={`summary-val font-mono ${data.summary.daily_pnl >= 0 ? 'price-up' : 'price-down'}`}>
              {fmt(data.summary.daily_pnl, 'price', market)}
            </span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="portfolio-grid">
        {/* Left Side: Positions Table */}
        <div className="portfolio-main">
          <div className="panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-header">
              <span className="panel-title">Open Positions</span>
              {user?.role !== 'viewer' && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  {showAddForm ? 'CANCEL' : '+ ADD POSITION'}
                </button>
              )}
            </div>

            {error && <div className="portfolio-error">⚠ {error}</div>}

            {showAddForm && (
              <form onSubmit={handleAddPosition} className="portfolio-add-form font-mono text-xs">
                <div className="form-row">
                  <div className="form-field">
                    <label>Symbol</label>
                    <input className="form-input" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="e.g. AAPL" required />
                  </div>
                  <div className="form-field">
                    <label>Market</label>
                    <select className="form-input" value={market} onChange={e => setMarket(e.target.value)}>
                      <option value="US">🇺🇸 US</option>
                      <option value="NSE">🇮🇳 NSE India</option>
                      <option value="BSE">🇮🇳 BSE India</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Asset Class</label>
                    <select className="form-input" value={assetType} onChange={e => setAssetType(e.target.value)}>
                      <option value="equity">Equity</option>
                      <option value="crypto">Crypto</option>
                      <option value="forex">Forex</option>
                      <option value="option">Option</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Quantity</label>
                    <input type="number" step="any" className="form-input" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00" required />
                  </div>
                  <div className="form-field">
                    <label>Avg Buy Price</label>
                    <input type="number" step="any" className="form-input" value={avgCost} onChange={e => setAvgCost(e.target.value)} placeholder="0.00" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field" style={{ flex: 1 }}>
                    <label>Notes</label>
                    <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Buy rationale, target, options details..." />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', height: 28 }} disabled={submitting}>
                    {submitting ? 'ADDING...' : 'ADD POSITION'}
                  </button>
                </div>
              </form>
            )}

            <div className="portfolio-table-wrap">
              {loading ? (
                <div className="portfolio-loading">
                  <span className="spinner" />
                  <span className="font-mono text-xs text-muted">Calculating valuations...</span>
                </div>
              ) : data && data.positions.length === 0 ? (
                <div className="portfolio-empty font-mono">
                  <div className="icon">⬡</div>
                  <div className="text-secondary text-sm">No open positions found</div>
                  <div className="text-xs text-muted">Click "+ ADD POSITION" to build your portfolio</div>
                </div>
              ) : data && (
                <table className="portfolio-table font-mono text-xs">
                  <thead>
                    <tr>
                      <th>SYMBOL</th>
                      <th>ASSET CLASS</th>
                      <th>QTY</th>
                      <th>AVG COST</th>
                      <th>MARKET PRICE</th>
                      <th>COST BASIS</th>
                      <th>MKT VALUE</th>
                      <th>UNREALIZED P&L</th>
                      <th>DAILY P&L</th>
                      <th>SECTOR</th>
                      <th>BETA</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.positions.map((pos) => {
                      const isEditing = editingId === pos.id;
                      const up = pos.unrealized_pnl >= 0;
                      const dailyUp = pos.daily_pnl >= 0;
                      return (
                        <tr key={pos.id} className="portfolio-row">
                          <td className="fw-600 text-accent" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {pos.logo_url && (
                              <img src={pos.logo_url} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#2a2e39', padding: '1px' }} />
                            )}
                            <span>{pos.symbol}</span>
                            <span className="text-muted" style={{ fontSize: 9, marginLeft: 4 }}>
                              {pos.market === 'NSE' ? '🇮🇳' : '🇺🇸'}
                            </span>
                          </td>
                          <td className="text-secondary text-xs">{pos.asset_type.toUpperCase()}</td>
                          <td>
                            {isEditing ? (
                              <input type="number" step="any" className="form-input cell-input" value={editQty} onChange={e => setEditQty(e.target.value)} style={{ width: '60px' }} />
                            ) : pos.quantity}
                          </td>
                          <td>
                            {isEditing ? (
                              <input type="number" step="any" className="form-input cell-input" value={editCost} onChange={e => setEditCost(e.target.value)} style={{ width: '70px' }} />
                            ) : fmt(pos.avg_cost, 'price', pos.market)}
                          </td>
                          <td className="fw-600">{fmt(pos.current_price, 'price', pos.market)}</td>
                          <td className="text-secondary">{fmt(pos.cost_basis, 'price', pos.market)}</td>
                          <td className="fw-600">{fmt(pos.market_value, 'price', pos.market)}</td>
                          <td className={up ? 'price-up' : 'price-down'}>
                            {fmt(pos.unrealized_pnl, 'price', pos.market)} ({fmt(pos.unrealized_pnl_pct, 'pct')})
                          </td>
                          <td className={dailyUp ? 'price-up' : 'price-down'}>
                            {fmt(pos.daily_pnl, 'price', pos.market)}
                          </td>
                          <td className="text-muted">{pos.sector || '—'}</td>
                          <td className="text-muted font-mono">{pos.beta ? pos.beta.toFixed(2) : '1.00'}</td>
                          <td>
                            <div className="flex gap-1">
                              {user?.role === 'viewer' ? (
                                <span className="text-muted" style={{ fontSize: '10px' }}>READ-ONLY</span>
                              ) : isEditing ? (
                                <>
                                  <button className="btn btn-ghost btn-sm text-green" onClick={() => handleSaveEdit(pos.id)}>SAVE</button>
                                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>CANCEL</button>
                                </>
                              ) : (
                                <>
                                  <button className="btn btn-ghost btn-sm" onClick={() => handleStartEdit(pos)}>EDIT</button>
                                  <button className="btn btn-ghost btn-sm text-red" onClick={() => handleDeletePosition(pos.id)}>REMOVE</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Allocation & Risk Sidebar */}
        <div className="portfolio-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          {/* Allocation Panel */}
          <div className="panel" style={{ flexShrink: 0 }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="panel-title">Portfolio Allocation</span>
              <div className="tab-group">
                <button 
                  className={`tab-btn ${allocationTab === 'asset' ? 'active' : ''}`} 
                  onClick={() => setAllocationTab('asset')}
                >
                  ASSET
                </button>
                <button 
                  className={`tab-btn ${allocationTab === 'sector' ? 'active' : ''}`} 
                  onClick={() => setAllocationTab('sector')}
                >
                  SECTOR
                </button>
              </div>
            </div>

            <div className="panel-body" style={{ padding: '12px', display: 'flex', flexDirection: 'column' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><span className="spinner" /></div>
              ) : (
                (() => {
                  const currentList = allocationTab === 'asset' 
                    ? (data ? data.summary.allocation : []) 
                    : (data ? data.summary.sector_breakdown : []);

                  if (currentList.length === 0) {
                    return <div className="font-mono text-muted text-center" style={{ padding: 20 }}>No allocation data</div>;
                  }

                  return (
                    <>
                      {/* SVG Donut Chart */}
                      <DonutChart data={currentList} />

                      {/* Allocation list details */}
                      <div className="allocation-list font-mono text-xs" style={{ marginTop: 8, maxHeight: '200px', overflowY: 'auto' }}>
                        {currentList.map((item, idx) => {
                          const colors = ['var(--accent-primary)', 'var(--purple)', 'var(--blue)', 'var(--amber)', 'var(--red)', '#00f0ff', '#ff6b6b', '#845ef7'];
                          return (
                            <div key={item.name} className="allocation-item" style={{ marginBottom: '8px' }}>
                              <div className="flex justify-between" style={{ marginBottom: 2 }}>
                                <span className="fw-600" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colors[idx % colors.length] }} />
                                  {item.name}
                                </span>
                                <span className="text-secondary">{item.value.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between text-muted" style={{ fontSize: 9, paddingLeft: 14 }}>
                                <span>Market Value:</span>
                                <span>{fmt(item.amount, 'price', market)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          </div>

          {/* Risk Analytics Panel */}
          {data && (
            <div className="panel" style={{ flexShrink: 0 }}>
              <div className="panel-header">
                <span className="panel-title">Risk Analytics</span>
              </div>
              <div className="panel-body font-mono text-xs" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="risk-metric-row">
                  <span className="text-muted">PORTFOLIO BETA (β)</span>
                  <span className="fw-600">{data.summary.risk_analytics.portfolio_beta.toFixed(2)}</span>
                </div>
                <div style={{ marginTop: -8, marginBottom: 4, fontSize: 9 }}>
                  {(() => {
                    const desc = getBetaDescription(data.summary.risk_analytics.portfolio_beta);
                    return <span className={desc.class}>{desc.text}</span>;
                  })()}
                </div>

                <div className="risk-metric-row">
                  <span className="text-muted">DAILY VOLATILITY</span>
                  <span className="fw-600">{data.summary.risk_analytics.daily_volatility.toFixed(2)}%</span>
                </div>

                <div className="risk-metric-row">
                  <span className="text-muted">SHARPE RATIO</span>
                  <span className="fw-600 text-green">{data.summary.risk_analytics.sharpe_ratio.toFixed(2)}</span>
                </div>

                <div className="risk-metric-row" style={{ borderBottom: 'none' }}>
                  <span className="text-muted" title="95% Confidence 1-Day Value at Risk">VALUE AT RISK (VaR 95% 1D)</span>
                  <span className="fw-600 text-red">{fmt(data.summary.risk_analytics.value_at_risk)}</span>
                </div>
                <div className="text-muted" style={{ fontSize: 9, lineHeight: '1.2' }}>
                  At 95% confidence level, maximum expected 1-day portfolio loss is {fmt(data.summary.risk_analytics.value_at_risk)}.
                </div>
              </div>
            </div>
          )}

          {/* Historical Equity Curve */}
          {(historyData.length > 0 || histLoading) && (
            <div className="panel" style={{ flexShrink: 0 }}>
              <div className="panel-header">
                <span className="panel-title">Portfolio Equity Curve</span>
                {histLoading && <span className="font-mono text-xxs text-amber animate-pulse">COMPUTING...</span>}
              </div>
              <div className="panel-body" style={{ padding: '10px' }}>
                {historyData.length > 0 && (() => {
                  const vals = historyData.map(d => d.value);
                  const minV = Math.min(...vals);
                  const maxV = Math.max(...vals);
                  const range = (maxV - minV) || 1;
                  const W = 240, H = 90, padL = 4, padR = 4, padT = 6, padB = 20;
                  const cW = W - padL - padR;
                  const cH = H - padT - padB;
                  const pts = historyData.map((d, i) => {
                    const x = padL + (i / (historyData.length - 1)) * cW;
                    const y = padT + cH - ((d.value - minV) / range) * cH;
                    return `${x},${y}`;
                  }).join(' ');
                  const lastVal = vals[vals.length - 1];
                  const firstVal = vals[0];
                  const isUp = lastVal >= firstVal;
                  const color = isUp ? '#00ff88' : '#ff3b30';
                  // X axis labels
                  const labelCount = 4;
                  const labels = Array.from({ length: labelCount }, (_, i) => {
                    const idx = Math.round(i * (historyData.length - 1) / (labelCount - 1));
                    return { x: padL + (idx / (historyData.length - 1)) * cW, label: historyData[idx]?.date?.slice(5) || '' };
                  });
                  return (
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                          <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Fill area */}
                      <polygon
                        points={`${padL},${padT + cH} ${pts} ${padL + cW},${padT + cH}`}
                        fill="url(#eq-grad)"
                      />
                      {/* Line */}
                      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
                      {/* X labels */}
                      {labels.map((l, i) => (
                        <text key={i} x={l.x} y={H - 4} fontSize="7" fill="#4b5563" textAnchor="middle" fontFamily="monospace">{l.label}</text>
                      ))}
                      {/* Current value dot */}
                      {(() => {
                        const last = historyData[historyData.length - 1];
                        const lx = padL + cW;
                        const ly = padT + cH - ((last.value - minV) / range) * cH;
                        return <circle cx={lx} cy={ly} r="3" fill={color} />;
                      })()}
                    </svg>
                  );
                })()}
                <div className="flex justify-between font-mono" style={{ fontSize: '9px', color: '#4b5563', marginTop: '4px' }}>
                  <span>START: {currencySymbol}{historyData[0]?.value?.toFixed(0) || '—'}</span>
                  <span style={{ color: (historyData[historyData.length-1]?.value || 0) >= (historyData[0]?.value || 0) ? '#00ff88' : '#ff3b30' }}>
                    NOW: {currencySymbol}{historyData[historyData.length-1]?.value?.toFixed(0) || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PortfolioPage;

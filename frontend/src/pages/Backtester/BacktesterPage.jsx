import React, { useState, useEffect, useRef } from 'react';
import { marketApi } from '../../api';
import './Backtester.css';

// SVG Multi-Line Chart for plotting Strategy Equity vs Benchmark
function MultiSvgLineChart({ data, xKey, yKeys, strokeColors = ['#00f0ff', '#848e9c'] }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 240 });
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      setDimensions({
        width: containerRef.current.clientWidth || 600,
        height: containerRef.current.clientHeight || 240
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
        No equity curve data available
      </div>
    );
  }

  const { width, height } = dimensions;
  const padding = { top: 20, right: 30, bottom: 30, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find overall min and max across both series
  let allValues = [];
  yKeys.forEach(key => {
    allValues = allValues.concat(data.map(d => parseFloat(d[key]) || 0));
  });

  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yRange = yMax - yMin || 1.0;
  
  // Pad Y range
  const yBoundMin = yMin - yRange * 0.05;
  const yBoundMax = yMax + yRange * 0.05;
  const yBoundRange = yBoundMax - yBoundMin || 1.0;

  // Generate paths for both lines
  const paths = yKeys.map((key, kIdx) => {
    const points = data.map((d, index) => {
      const x = padding.left + (index / (data.length - 1)) * chartWidth;
      const yVal = parseFloat(d[key]) || 0;
      const y = padding.top + chartHeight - ((yVal - yBoundMin) / yBoundRange) * chartHeight;
      return { x, y, value: yVal, date: d[xKey] };
    });

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    return { key, points, pathD, color: strokeColors[kIdx] };
  });

  // Y-axis grid
  const gridLines = [];
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const yVal = yBoundMin + (i / gridCount) * yBoundRange;
    const y = padding.top + chartHeight - (i / gridCount) * chartHeight;
    gridLines.push({ y, value: yVal });
  }

  // X-axis labels
  const xLabels = [];
  const labelCount = Math.min(6, data.length);
  if (data.length > 1) {
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((i / (labelCount - 1)) * (data.length - 1));
      const p = paths[0].points[idx];
      if (p) xLabels.push(p);
    }
  }

  const handleMouseMove = (e) => {
    if (!containerRef.current || !paths[0]) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - padding.left;
    
    const pct = Math.max(0, Math.min(1, x / chartWidth));
    const closestIdx = Math.round(pct * (data.length - 1));
    if (closestIdx >= 0 && closestIdx < data.length) {
      setHoverIndex(closestIdx);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div 
      ref={containerRef} 
      className="chart-container-svg"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
    >
      <svg width={width} height={height}>
        {/* Grid lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line 
              x1={padding.left} 
              y1={line.y} 
              x2={width - padding.right} 
              y2={line.y} 
              stroke="#1f2937" 
              strokeWidth="1" 
              strokeDasharray="4,4"
            />
            <text 
              x={padding.left - 8} 
              y={line.y + 3} 
              fill="#848e9c" 
              fontSize="8" 
              fontFamily="monospace"
              textAnchor="end"
            >
              ${line.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        ))}

        {/* Draw lines */}
        {paths.map((p, idx) => (
          <path key={idx} d={p.pathD} fill="none" stroke={p.color} strokeWidth="1.5" />
        ))}

        {/* X-axis Labels */}
        {xLabels.map((p, i) => (
          <g key={i}>
            <line 
              x1={p.x} 
              y1={padding.top + chartHeight} 
              x2={p.x} 
              y2={padding.top + chartHeight + 4} 
              stroke="#1f2937" 
            />
            <text 
              x={p.x} 
              y={padding.top + chartHeight + 15} 
              fill="#848e9c" 
              fontSize="8" 
              fontFamily="monospace"
              textAnchor="middle"
            >
              {p.date}
            </text>
          </g>
        ))}

        {/* Hover cursor and details card */}
        {hoveredData && paths[0] && (
          <g>
            {/* Guide line */}
            <line 
              x1={paths[0].points[hoverIndex].x} 
              y1={padding.top} 
              x2={paths[0].points[hoverIndex].x} 
              y2={padding.top + chartHeight} 
              stroke="#4b5563" 
              strokeWidth="1" 
              strokeDasharray="2,2"
            />
            {/* Dots */}
            {paths.map((p, idx) => (
              <circle 
                key={idx}
                cx={p.points[hoverIndex].x} 
                cy={p.points[hoverIndex].y} 
                r="3" 
                fill={p.color} 
                stroke="#06060c" 
                strokeWidth="1" 
              />
            ))}
            {/* Detail tooltip box */}
            <rect 
              x={paths[0].points[hoverIndex].x > width / 2 ? paths[0].points[hoverIndex].x - 165 : paths[0].points[hoverIndex].x + 15} 
              y={padding.top + 5} 
              width="150" 
              height="45" 
              rx="3" 
              fill="#161622" 
              stroke="#1f2937"
            />
            <text 
              x={paths[0].points[hoverIndex].x > width / 2 ? paths[0].points[hoverIndex].x - 160 : paths[0].points[hoverIndex].x + 20} 
              y={padding.top + 16} 
              fill="#848e9c" 
              fontSize="8" 
              fontFamily="monospace"
            >
              Date: {hoveredData[xKey]}
            </text>
            <text 
              x={paths[0].points[hoverIndex].x > width / 2 ? paths[0].points[hoverIndex].x - 160 : paths[0].points[hoverIndex].x + 20} 
              y={padding.top + 28} 
              fill={strokeColors[0]} 
              fontSize="8" 
              fontFamily="monospace" 
              fontWeight="bold"
            >
              Strategy: ${parseFloat(hoveredData[yKeys[0]]).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </text>
            <text 
              x={paths[0].points[hoverIndex].x > width / 2 ? paths[0].points[hoverIndex].x - 160 : paths[0].points[hoverIndex].x + 20} 
              y={padding.top + 40} 
              fill={strokeColors[1]} 
              fontSize="8" 
              fontFamily="monospace" 
              fontWeight="bold"
            >
              Benchmark: ${parseFloat(hoveredData[yKeys[1]]).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function BacktesterPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [strategy, setStrategy] = useState('sma');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-01-01');
  
  // Strategy params
  const [fastPeriod, setFastPeriod] = useState(50);
  const [slowPeriod, setSlowPeriod] = useState(200);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [oversold, setOversold] = useState(30);
  const [overbought, setOverbought] = useState(70);
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  const handleRunBacktest = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Prepare parameters
    let params = {};
    if (strategy === 'sma') {
      params = { fast_period: fastPeriod, slow_period: slowPeriod };
    } else if (strategy === 'rsi') {
      params = { rsi_period: rsiPeriod, oversold, overbought };
    } else if (strategy === 'macd') {
      params = { fast_period: macdFast, slow_period: macdSlow, signal_period: macdSignal };
    }

    marketApi.runBacktest({
      symbol,
      strategy,
      start_date: startDate,
      end_date: endDate,
      params
    })
      .then(res => {
        setResults(res.data);
      })
      .catch(err => {
        setError(err.response?.data?.detail || 'Backtest execution failed: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="backtest-root">
      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
        <h1 className="font-mono text-sm fw-700 uppercase" style={{ color: '#00ff88', letterSpacing: '0.05em' }}>
          📈 Quantitative Strategy Backtester
        </h1>
        <span className="badge badge-amber font-mono">BACKTRADER ACTIVE</span>
      </div>

      <div className="backtest-layout">
        {/* Sidebar inputs */}
        <div className="backtest-sidebar">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Strategy Configuration</span>
            </div>
            <div className="panel-body font-mono text-xs flex flex-col gap-2" style={{ padding: '12px' }}>
              <form onSubmit={handleRunBacktest} className="flex flex-col gap-3">
                <div className="form-field">
                  <label className="text-muted uppercase fw-600 text-xxs">Ticker Symbol</label>
                  <input
                    className="form-input"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="text-muted uppercase fw-600 text-xxs">Strategy Model</label>
                  <select
                    className="form-input"
                    value={strategy}
                    onChange={e => setStrategy(e.target.value)}
                  >
                    <option value="sma">Simple Moving Average Crossover (SMA)</option>
                    <option value="rsi">Relative Strength Index (RSI)</option>
                    <option value="macd">MACD Signal Line Cross</option>
                  </select>
                </div>

                {/* Strategy parameters */}
                {strategy === 'sma' && (
                  <div className="flex gap-2">
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 text-xxs">Fast SMA</label>
                      <input
                        type="number"
                        className="form-input"
                        value={fastPeriod}
                        onChange={e => setFastPeriod(parseInt(e.target.value))}
                        min="2"
                        required
                      />
                    </div>
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 text-xxs">Slow SMA</label>
                      <input
                        type="number"
                        className="form-input"
                        value={slowPeriod}
                        onChange={e => setSlowPeriod(parseInt(e.target.value))}
                        min="5"
                        required
                      />
                    </div>
                  </div>
                )}

                {strategy === 'rsi' && (
                  <div className="flex flex-col gap-2">
                    <div className="form-field">
                      <label className="text-muted uppercase fw-600 text-xxs">RSI Lookback</label>
                      <input
                        type="number"
                        className="form-input"
                        value={rsiPeriod}
                        onChange={e => setRsiPeriod(parseInt(e.target.value))}
                        min="2"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="form-field flex-1">
                        <label className="text-muted uppercase fw-600 text-xxs">Oversold (Buy)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={oversold}
                          onChange={e => setOversold(parseFloat(e.target.value))}
                          min="1"
                          max="99"
                          required
                        />
                      </div>
                      <div className="form-field flex-1">
                        <label className="text-muted uppercase fw-600 text-xxs">Overbought (Sell)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={overbought}
                          onChange={e => setOverbought(parseFloat(e.target.value))}
                          min="1"
                          max="99"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {strategy === 'macd' && (
                  <div className="flex gap-2">
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 text-xxs">Fast</label>
                      <input
                        type="number"
                        className="form-input"
                        value={macdFast}
                        onChange={e => setMacdFast(parseInt(e.target.value))}
                        min="2"
                        required
                      />
                    </div>
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 text-xxs">Slow</label>
                      <input
                        type="number"
                        className="form-input"
                        value={macdSlow}
                        onChange={e => setMacdSlow(parseInt(e.target.value))}
                        min="5"
                        required
                      />
                    </div>
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 text-xxs">Signal</label>
                      <input
                        type="number"
                        className="form-input"
                        value={macdSignal}
                        onChange={e => setMacdSignal(parseInt(e.target.value))}
                        min="2"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="form-field flex-1">
                    <label className="text-muted uppercase fw-600 text-xxs">Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-field flex-1">
                    <label className="text-muted uppercase fw-600 text-xxs">End Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading ? 'CALCULATING STRATEGY...' : 'RUN BACKTEST'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Main results panel */}
        <div className="backtest-main">
          {error && <div className="panel font-mono text-red text-xs" style={{ padding: '12px' }}>⚠ {error}</div>}

          {loading ? (
            <div className="panel flex-1 flex flex-col items-center justify-center text-center font-mono" style={{ padding: '40px' }}>
              <span className="text-secondary text-sm animate-pulse">Running Historical Simulation...</span>
              <p className="text-muted text-xs" style={{ maxWidth: '350px', marginTop: '8px' }}>
                Fetching historical price data and executing trade strategy signals. This may take a few seconds.
              </p>
            </div>
          ) : !results ? (
            <div className="panel flex-1 flex flex-col items-center justify-center text-center font-mono" style={{ padding: '40px' }}>
              <div className="logo-glowing" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', boxShadow: '0 0 15px rgba(0, 255, 136, 0.2)' }}>B</div>
              <span className="text-secondary text-sm">Strategy Engine Ready</span>
              <p className="text-muted text-xs" style={{ maxWidth: '350px', marginTop: '8px' }}>
                Define your asset, trading model, backtest range, and parameters in the left panel to execute a historical simulation.
              </p>
            </div>
          ) : (
            <div className="backtest-results-grid">
              {/* Metrics block */}
              {results && (
                <div className="backtest-metrics-cards">
                  <div className="metric-card">
                    <div className="metric-card-label">Total Strategy Return</div>
                    <div className={`metric-card-value ${results.summary.total_return >= 0 ? 'price-up' : 'price-down'}`}>
                      {results.summary.total_return.toFixed(2)}%
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">Compound Annual (CAGR)</div>
                    <div className={`metric-card-value ${results.summary.cagr >= 0 ? 'price-up' : 'price-down'}`}>
                      {results.summary.cagr.toFixed(2)}%
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">Max Drawdown</div>
                    <div className="metric-card-value price-down">
                      {results.summary.max_drawdown.toFixed(2)}%
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">Sharpe Ratio</div>
                    <div className="metric-card-value text-blue">
                      {results.summary.sharpe_ratio.toFixed(2)}
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">Sortino Ratio</div>
                    <div className="metric-card-value text-green">
                      {results.summary.sortino_ratio.toFixed(2)}
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">Win Rate</div>
                    <div className="metric-card-value text-green">
                      {results.summary.win_rate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Equity chart */}
              <div className="panel">
                <div className="panel-header flex justify-between">
                  <span className="panel-title">Equity Growth Simulation ($10,000 Initial Capital)</span>
                  <div className="flex gap-3 text-xxs font-mono">
                    <span style={{ color: '#00f0ff' }}>● Strategy</span>
                    <span style={{ color: '#848e9c' }}>● Benchmark (Buy & Hold)</span>
                  </div>
                </div>
                <div className="panel-body chart-panel-body" style={{ padding: '8px' }}>
                  {results && (
                    <MultiSvgLineChart
                      data={results.equity_curve}
                      xKey="date"
                      yKeys={['strategy', 'benchmark']}
                      strokeColors={['#00f0ff', '#848e9c']}
                    />
                  )}
                </div>
              </div>

              {/* Advanced Diagnostics & Trade Log Split Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Advanced Diagnostics Panel */}
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Advanced Performance Diagnostics</span>
                  </div>
                  <div className="panel-body font-mono text-xs" style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="flex flex-col gap-2">
                      <div className="text-secondary text-xxs uppercase fw-700 mb-1" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '2px' }}>Risk/Return Indicators</div>
                      <div className="flex justify-between">
                        <span className="text-muted">CAGR:</span>
                        <span className={results.summary.cagr >= 0 ? 'price-up' : 'price-down'}>{results.summary.cagr.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Annualized Vol:</span>
                        <span>{results.summary.volatility.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Max DD Duration:</span>
                        <span className="text-amber">{results.summary.max_dd_duration} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Calmar Ratio:</span>
                        <span>{results.summary.calmar_ratio.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Buy & Hold Return:</span>
                        <span className={results.summary.market_return >= 0 ? 'price-up' : 'price-down'}>{results.summary.market_return.toFixed(2)}%</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="text-secondary text-xxs uppercase fw-700 mb-1" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '2px' }}>Trade Execution Stats</div>
                      <div className="flex justify-between">
                        <span className="text-muted">Profit Factor:</span>
                        <span className="text-white fw-700">{results.summary.profit_factor.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Avg Win Trade:</span>
                        <span className="price-up">+{results.summary.avg_win.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Avg Loss Trade:</span>
                        <span className="price-down">{results.summary.avg_loss.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Best Trade:</span>
                        <span className="price-up">+{results.summary.best_trade.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Worst Trade:</span>
                        <span className="price-down">{results.summary.worst_trade.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trades log table */}
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Completed Position History Logs</span>
                  </div>
                  <div className="panel-body trades-table-panel" style={{ padding: 0 }}>
                    {results && (
                      <table className="trades-table font-mono">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Entry Date</th>
                            <th>Exit Date</th>
                            <th>Entry Price</th>
                            <th>Exit Price</th>
                            <th style={{ textAlign: 'right' }}>PnL %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.trades.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="text-center text-muted" style={{ padding: '16px' }}>
                                No trades executed during this timeframe under strategy conditions.
                              </td>
                            </tr>
                          ) : (
                            results.trades.map((trade, idx) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{trade.entry_date}</td>
                                <td>{trade.exit_date} {trade.is_open && <span className="badge badge-amber text-xxs">OPEN</span>}</td>
                                <td>${trade.entry_price.toFixed(2)}</td>
                                <td>${trade.exit_price.toFixed(2)}</td>
                                <td className={`text-right trade-profit ${trade.profit >= 0 ? 'price-up' : 'price-down'}`}>
                                  {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}%
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BacktesterPage;

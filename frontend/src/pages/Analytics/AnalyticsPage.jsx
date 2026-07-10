import React, { useState, useEffect, useRef } from 'react';
import { portfolioApi, marketApi } from '../../api';
import './Analytics.css';

const API_BASE_URL = 'http://localhost:3001/api';

// Simple SVG Line Chart for Analytics
function AnalyticsLineChart({ data, xKey, yKey, strokeColor = '#00f0ff', valuePrefix = '$' }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 240 });

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
        No historical timeseries data available
      </div>
    );
  }

  const { width, height } = dimensions;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map(d => parseFloat(d[yKey]) || 0);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const yRange = yMax - yMin || 1.0;
  
  const yBoundMin = yMin - yRange * 0.05;
  const yBoundMax = yMax + yRange * 0.05;
  const yBoundRange = yBoundMax - yBoundMin || 1.0;

  const points = data.map((d, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - (((parseFloat(d[yKey]) || 0) - yBoundMin) / yBoundRange) * chartHeight;
    return { x, y };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  // Grid lines
  const gridLines = [];
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const yVal = yBoundMin + (i / gridCount) * yBoundRange;
    const y = padding.top + chartHeight - (i / gridCount) * chartHeight;
    gridLines.push({ y, value: yVal });
  }

  // X labels
  const xLabels = [];
  const labelCount = Math.min(5, data.length);
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.floor((i / (labelCount - 1)) * (data.length - 1));
    const p = points[idx];
    if (p && data[idx]) xLabels.push({ x: p.x, label: data[idx][xKey] });
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
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
              {valuePrefix}{line.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}

        {/* Path line */}
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" />

        {/* X labels */}
        {xLabels.map((lbl, i) => (
          <g key={i}>
            <text 
              x={lbl.x} 
              y={height - padding.bottom + 14} 
              fill="#848e9c" 
              fontSize="8" 
              fontFamily="monospace"
              textAnchor="middle"
            >
              {lbl.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function AnalyticsPage() {
  const [portfolioData, setPortfolioData] = useState(null);
  const [historicalRisk, setHistoricalRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [error, setError] = useState('');

  // AI Advisor States
  const [streaming, setStreaming] = useState(false);
  const [advisorOutput, setAdvisorOutput] = useState('');
  const [advisorError, setAdvisorError] = useState('');

  useEffect(() => {
    // 1. Fetch live portfolio summary
    portfolioApi.getPortfolio()
      .then(res => {
        setPortfolioData(res.data);
        const positions = res.data.positions || [];
        if (positions.length > 0) {
          // Format positions for the Python historical risk service
          const posInputs = positions.map(p => ({
            symbol: p.symbol,
            quantity: p.quantity,
            market: p.market || 'US'
          }));
          
          setHistLoading(true);
          marketApi.getHistoricalRisk(posInputs)
            .then(histRes => {
              setHistoricalRisk(histRes.data);
            })
            .catch(err => {
              console.error('Failed to calculate historical risk:', err);
            })
            .finally(() => {
              setHistLoading(false);
            });
        }
      })
      .catch(err => {
        setError('Failed to fetch portfolio: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleGenerateAdvisory = async () => {
    if (!portfolioData) return;
    const r = portfolioData.summary.risk_analytics;
    const totalVal = portfolioData.summary.total_value;

    setStreaming(true);
    setAdvisorOutput('');
    setAdvisorError('');
    const token = localStorage.getItem('qd_access_token');

    try {
      const response = await fetch(`${API_BASE_URL}/ai/risk-advisor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          portfolioBeta: r.portfolio_beta.toFixed(2),
          dailyVolatility: r.daily_volatility.toFixed(2),
          valueAtRisk: r.value_at_risk.toFixed(2),
          totalValue: totalVal.toFixed(2)
        })
      });

      if (!response.ok) {
        throw new Error(`Advisor service returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let textBuffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.done) {
                  done = true;
                } else if (parsed.response) {
                  textBuffer += parsed.response;
                  setAdvisorOutput(textBuffer);
                }
              } catch (e) {
                console.error('Stream parse error:', e);
              }
            }
          }
        }
      }
    } catch (err) {
      setAdvisorError(err.message);
    } finally {
      setStreaming(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-root flex items-center justify-center font-mono text-xs text-amber animate-pulse">
        LOADING LIVE PORTFOLIO RISK MATRIX...
      </div>
    );
  }

  const riskMetrics = portfolioData?.summary?.risk_analytics;
  const positions = portfolioData?.positions || [];

  return (
    <div className="analytics-root">
      {/* Title Header */}
      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
        <h1 className="font-mono text-sm fw-700 uppercase" style={{ color: '#00ff88', letterSpacing: '0.05em' }}>
          📊 Advanced Risk Analytics Dashboard
        </h1>
        <span className="badge badge-amber font-mono">PORTFOLIO EXPOSURE ACTIVE</span>
      </div>

      {positions.length === 0 ? (
        <div className="panel flex-1 flex flex-col items-center justify-center text-center font-mono text-xs py-8">
          <span className="text-amber">● No Portfolio Assets Defined</span>
          <p className="text-muted" style={{ maxWidth: '300px', marginTop: '6px' }}>
            Add stock positions in the "Portfolio" tab to run advanced parametric Value-at-Risk simulations.
          </p>
        </div>
      ) : (
        <div className="analytics-grid">
          {/* Left Column: Metrics & AI Advice */}
          <div className="flex flex-col gap-3">
            {/* Live Metrics Block */}
            <div className="risk-metrics-row">
              <div className="risk-card">
                <div className="risk-card-label">Portfolio Beta (β)</div>
                <div className="risk-card-value text-blue">
                  {riskMetrics?.portfolio_beta.toFixed(2)}
                </div>
              </div>
              <div className="risk-card">
                <div className="risk-card-label">Daily Volatility</div>
                <div className="risk-card-value text-white">
                  {riskMetrics?.daily_volatility.toFixed(2)}%
                </div>
              </div>
              <div className="risk-card">
                <div className="risk-card-label">Value at Risk (95% 1D)</div>
                <div className="risk-card-value price-down">
                  ${riskMetrics?.value_at_risk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="risk-card">
                <div className="risk-card-label">Sharpe Ratio</div>
                <div className="risk-card-value text-green">
                  {riskMetrics?.sharpe_ratio.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Historical Risk Summary (Simulation) */}
            {historicalRisk && (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">1-Year Historical Backtest Diagnostics</span>
                </div>
                <div className="panel-body font-mono text-xs" style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-muted">Total Return:</span>
                      <span className={historicalRisk.summary.total_return >= 0 ? 'price-up' : 'price-down'}>
                        {historicalRisk.summary.total_return.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Max Drawdown:</span>
                      <span className="price-down">{historicalRisk.summary.max_drawdown.toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-muted">Annualized Volatility:</span>
                      <span>{historicalRisk.summary.annualized_volatility.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Historical VaR:</span>
                      <span className="price-down">${historicalRisk.summary.value_at_risk_95.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Risk Advisor Panel */}
            <div className="panel flex-grow">
              <div className="panel-header flex justify-between items-center">
                <span className="panel-title">Mistral AI Risk & Hedging Advisor</span>
                <button 
                  className="btn btn-primary btn-xs font-mono" 
                  onClick={handleGenerateAdvisory}
                  disabled={streaming}
                >
                  {streaming ? 'ADVISING...' : 'RUN HEDGE ANALYSIS'}
                </button>
              </div>
              <div className="panel-body flex flex-col" style={{ padding: '8px', minHeight: '260px' }}>
                {advisorError && <div className="font-mono text-red text-xxs p-2">⚠ {advisorError}</div>}
                
                {!advisorOutput && !streaming ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center font-mono text-xs text-muted" style={{ padding: '24px' }}>
                    <span>● Risk Engine Idle</span>
                    <p style={{ maxWidth: '280px', marginTop: '6px' }}>
                      Click "Run Hedge Analysis" to request AI recommendations on protecting portfolio capital.
                    </p>
                  </div>
                ) : (
                  <div className="advisor-output-box font-mono whitespace-pre-wrap">
                    {advisorOutput}
                    {streaming && <span className="animate-pulse" style={{ color: '#00ff88' }}> ▌</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Historical Equity Curve and Risk Metrics Chart */}
          <div className="flex flex-col gap-3">
            {/* Chart: Historical Equity Curve */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">1-Year Portfolio Value Simulation ($10,000 Starting Principal)</span>
              </div>
              <div className="panel-body" style={{ height: '220px', padding: '8px' }}>
                {histLoading ? (
                  <div className="flex items-center justify-center h-full text-muted font-mono text-xxs animate-pulse">
                    RUNNING TIME-SERIES MODEL...
                  </div>
                ) : historicalRisk ? (
                  <AnalyticsLineChart 
                    data={historicalRisk.history}
                    xKey="date"
                    yKey="value"
                    strokeColor="#00f0ff"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted font-mono text-xxs">
                    No historical simulation data generated.
                  </div>
                )}
              </div>
            </div>

            {/* Chart: Rolling Portfolio Risk (Beta / Vol) */}
            <div className="panel">
              <div className="panel-header flex justify-between">
                <span className="panel-title">Rolling Portfolio Volatility (Annualized %)</span>
              </div>
              <div className="panel-body" style={{ height: '220px', padding: '8px' }}>
                {histLoading ? (
                  <div className="flex items-center justify-center h-full text-muted font-mono text-xxs animate-pulse">
                    CALCULATING ROLLING INDICATORS...
                  </div>
                ) : historicalRisk ? (
                  <AnalyticsLineChart 
                    data={historicalRisk.history}
                    xKey="date"
                    yKey="rolling_vol"
                    strokeColor="#ff9900"
                    valuePrefix=""
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted font-mono text-xxs">
                    No rolling risk simulation data.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsPage;

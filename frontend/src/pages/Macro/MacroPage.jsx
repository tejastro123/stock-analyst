import React, { useState, useEffect, useRef } from 'react';
import { marketApi } from '../../api';
import './Macro.css';

// SVG Line Chart Component for flexible data plotting without D3 or Recharts dependencies
function SvgLineChart({ data, xKey, yKey, title, strokeColor = '#00f0ff', fillColor = 'rgba(0, 240, 255, 0.05)' }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 260 });
  const [hoverIndex, setHoverIndex] = useState(null);
  const [mouseX, setMouseX] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      setDimensions({
        width: containerRef.current.clientWidth || 600,
        height: containerRef.current.clientHeight || 260
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
        No chart data available
      </div>
    );
  }

  const { width, height } = dimensions;
  const padding = { top: 20, right: 30, bottom: 30, left: 50 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Extract values
  const yValues = data.map(d => parseFloat(d[yKey]) || 0);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const yRange = yMax - yMin || 1.0;
  
  // Pad Y range slightly
  const yBoundMin = yMin - yRange * 0.05;
  const yBoundMax = yMax + yRange * 0.05;
  const yBoundRange = yBoundMax - yBoundMin || 1.0;

  // Generate SVG Points
  const points = data.map((d, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartWidth;
    const yVal = parseFloat(d[yKey]) || 0;
    const y = padding.top + chartHeight - ((yVal - yBoundMin) / yBoundRange) * chartHeight;
    return { x, y, value: yVal, label: d[xKey], raw: d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = points.length > 0 
    ? `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`
    : '';

  // Generate Y-axis Grid Labels
  const gridLines = [];
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const yVal = yBoundMin + (i / gridCount) * yBoundRange;
    const y = padding.top + chartHeight - (i / gridCount) * chartHeight;
    gridLines.push({ y, value: yVal });
  }

  // Generate X-axis labels
  const xLabels = [];
  const labelCount = Math.min(6, data.length);
  if (data.length > 1) {
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((i / (labelCount - 1)) * (data.length - 1));
      const p = points[idx];
      if (p) xLabels.push(p);
    }
  }

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - padding.left;
    setMouseX(e.clientX - rect.left);
    
    // Find closest index
    const pct = Math.max(0, Math.min(1, x / chartWidth));
    const rawIdx = pct * (points.length - 1);
    const closestIdx = Math.round(rawIdx);
    if (closestIdx >= 0 && closestIdx < points.length) {
      setHoverIndex(closestIdx);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div 
      ref={containerRef} 
      className="chart-container-svg"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
    >
      <svg width={width} height={height}>
        {/* Gradients */}
        <defs>
          <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0"/>
          </linearGradient>
        </defs>

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
              y={line.y + 4} 
              fill="#848e9c" 
              fontSize="9" 
              fontFamily="monospace"
              textAnchor="end"
            >
              {line.value.toFixed(2)}%
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaD} fill={`url(#grad-${title})`} />

        {/* Plot Line */}
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" />

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
              fontSize="9" 
              fontFamily="monospace"
              textAnchor="middle"
            >
              {p.label}
            </text>
          </g>
        ))}

        {/* Tooltip Overlay */}
        {hoveredPoint && (
          <g>
            {/* Vertical Guide Line */}
            <line 
              x1={hoveredPoint.x} 
              y1={padding.top} 
              x2={hoveredPoint.x} 
              y2={padding.top + chartHeight} 
              stroke="#4b5563" 
              strokeWidth="1" 
              strokeDasharray="2,2"
            />
            {/* Highlight circle */}
            <circle 
              cx={hoveredPoint.x} 
              cy={hoveredPoint.y} 
              r="4" 
              fill={strokeColor} 
              stroke="#06060c" 
              strokeWidth="1.5" 
            />
            {/* Tooltip Card */}
            <rect 
              x={hoveredPoint.x > width / 2 ? hoveredPoint.x - 125 : hoveredPoint.x + 15} 
              y={padding.top + 5} 
              width="110" 
              height="35" 
              rx="3" 
              fill="#161622" 
              stroke="#1f2937"
            />
            <text 
              x={hoveredPoint.x > width / 2 ? hoveredPoint.x - 120 : hoveredPoint.x + 20} 
              y={padding.top + 18} 
              fill="#848e9c" 
              fontSize="8" 
              fontFamily="monospace"
            >
              Date: {hoveredPoint.label}
            </text>
            <text 
              x={hoveredPoint.x > width / 2 ? hoveredPoint.x - 120 : hoveredPoint.x + 20} 
              y={padding.top + 30} 
              fill={strokeColor} 
              fontSize="9" 
              fontFamily="monospace" 
              fontWeight="bold"
            >
              Yield: {hoveredPoint.value.toFixed(2)}%
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

const DEFAULT_SERIES = [
  { id: 'FEDFUNDS', name: 'Effective Federal Funds Rate', color: '#00f0ff' },
  { id: 'UNRATE',   name: 'Unemployment Rate',            color: '#ff3b30' },
  { id: 'CPIAUCSL', name: 'YoY CPI Inflation Rate',       color: '#00ff88' },
  { id: 'GDPC1',    name: 'Real GDP Growth Index',        color: '#ffb700' },
  { id: 'T10Y2Y',   name: '10Y-2Y Treasury Spread',       color: '#bf5af2' }
];

function MacroPage() {
  const [curve, setCurve] = useState([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState(DEFAULT_SERIES[0]);
  const [seriesData, setSeriesData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 1. Fetch yield curve
    marketApi.getMacroCurve()
      .then(res => {
        setCurve(res.data);
        // If curve matches mock sentinel value (5.42 for 1M), mark as demo
        const firstYield = res.data?.[0]?.yield;
        setIsDemoMode(firstYield === 5.42);
      })
      .catch(err => console.error("Failed to load yield curve:", err));
  }, []);

  useEffect(() => {
    // 2. Fetch selected FRED series data
    setLoading(true);
    setError('');
    const calcYoY = selectedSeries.id === 'CPIAUCSL'; // Calculate inflation YoY
    marketApi.getMacroSeries(selectedSeries.id, calcYoY)
      .then(res => {
        setSeriesData(res.data);
      })
      .catch(err => {
        setError('Failed to fetch series data: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedSeries]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    marketApi.searchMacro(searchQuery)
      .then(res => {
        setSearchResults(res.data || []);
      })
      .catch(err => {
        setError('Search failed: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="macro-root">
      {/* Page Title */}
      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
        <h1 className="font-mono text-sm fw-700 uppercase" style={{ color: '#00ff88', letterSpacing: '0.05em' }}>
          🏛️ Institutional Macro Terminal & FRED Data
        </h1>
        <span className={`badge font-mono ${isDemoMode ? 'badge-amber' : 'badge-green'}`}>
          {isDemoMode ? '⚠ DEMO MODE (No FRED Key)' : 'FRED CONNECTED'}
        </span>
      </div>

      <div className="macro-layout">
        {/* Left Side: Series List & Search */}
        <div className="macro-sidebar">
          {/* Preset Series */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Core Benchmarks</span>
            </div>
            <div className="panel-body flex flex-col gap-1" style={{ padding: '8px' }}>
              {DEFAULT_SERIES.map(series => (
                <button
                  key={series.id}
                  className={`series-select-btn ${selectedSeries.id === series.id ? 'active' : ''}`}
                  onClick={() => setSelectedSeries(series)}
                >
                  <span className="series-code" style={{ color: selectedSeries.id === series.id ? series.color : undefined }}>
                    {series.id}
                  </span>
                  <span className="series-name">{series.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Series */}
          <div className="panel flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <span className="panel-title">Search FRED Database</span>
            </div>
            <div className="panel-body flex flex-col gap-2" style={{ padding: '10px', flex: 1, overflowY: 'auto' }}>
              <form onSubmit={handleSearch} className="flex gap-1">
                <input
                  className="form-input flex-1"
                  style={{ fontSize: '10px' }}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="e.g. GDP, Canada, housing..."
                />
                <button type="submit" className="btn btn-primary btn-sm font-mono">GO</button>
              </form>

              {searchResults.length > 0 && (
                <div className="search-results-list">
                  <div className="text-muted font-mono text-xxs uppercase fw-600 mb-1">Search Results</div>
                  {searchResults.map(result => (
                    <div
                      key={result.id}
                      className="search-result-item"
                      onClick={() => setSelectedSeries({ id: result.id, name: result.title, color: '#ffb700' })}
                    >
                      <span className="font-mono text-blue fw-700">{result.id}</span>
                      <p className="text-muted" style={{ margin: '2px 0 0 0' }}>{result.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Charts */}
        <div className="macro-main">
          <div className="chart-grid">
            {/* Yield Curve Panel */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">US Treasury Yield Curve (Constant Maturity Rates)</span>
              </div>
              <div className="panel-body" style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: '8px' }}>
                <div style={{ height: '220px' }}>
                  <SvgLineChart
                    data={curve}
                    xKey="maturity"
                    yKey="yield"
                    title="yield-curve"
                    strokeColor="#bf5af2"
                  />
                </div>
                {/* Curve statistics */}
                <div className="panel font-mono text-xxs" style={{ background: '#11111b' }}>
                  <div className="panel-header" style={{ padding: '4px 8px', borderBottom: '1px solid #1f2937' }}>
                    <span className="panel-title" style={{ fontSize: '9px' }}>Current Yields</span>
                  </div>
                  <div className="panel-body flex flex-col gap-1" style={{ padding: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {curve.map(c => (
                      <div key={c.maturity} className="flex justify-between">
                        <span className="text-muted">{c.maturity} Bond:</span>
                        <span className="fw-700 text-purple">{c.yield.toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Indicator Timeseries Panel */}
            <div className="panel">
              <div className="panel-header flex justify-between items-center">
                <span className="panel-title">Historical Chart: {selectedSeries.name} ({selectedSeries.id})</span>
                {loading && <span className="font-mono text-xxs text-amber animate-pulse">FETCHING...</span>}
              </div>
              <div className="panel-body" style={{ padding: '10px' }}>
                {error && <div className="font-mono text-red text-xs mb-2">⚠ {error}</div>}
                <div style={{ height: '220px' }}>
                  <SvgLineChart
                    data={seriesData}
                    xKey="date"
                    yKey="value"
                    title={selectedSeries.id}
                    strokeColor={selectedSeries.color}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MacroPage;

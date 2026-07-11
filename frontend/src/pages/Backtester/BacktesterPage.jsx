import React, { useState, useEffect, useRef, useMemo } from 'react';
import { marketApi } from '../../api';
import useMarketStore from '../../store/marketStore';
import './Backtester.css';

// ── TECHNICAL INDICATORS DICTIONARY ──────────────────────────────────────────
const INDICATORS_METADATA = {
  sma: { name: 'Simple Moving Average (SMA)', group: 'Moving Averages', overlay: true, formula: 'SMA = (P1 + P2 + ... + Pn) / n', desc: 'Smoothes price action by calculating average close over n periods.' },
  ema: { name: 'Exponential Moving Average (EMA)', group: 'Moving Averages', overlay: true, formula: 'EMA_t = Price_t * k + EMA_y * (1 - k)', desc: 'Weights recent prices more heavily, reducing lag behind trend shifts.' },
  hma: { name: 'Hull Moving Average (HMA)', group: 'Moving Averages', overlay: true, formula: 'HMA = WMA(2*WMA(n/2) - WMA(n), sqrt(n))', desc: 'An extremely fast moving average with almost zero lag and high smoothness.' },
  vwma: { name: 'Volume Weighted Moving Average (VWMA)', group: 'Moving Averages', overlay: true, formula: 'VWMA = sum(Close * Vol) / sum(Vol)', desc: 'Weights prices based on trading volume, highlighting heavy institutional activity.' },
  macd: { name: 'MACD', group: 'Oscillators', overlay: false, formula: 'MACD = EMA(12) - EMA(26); Signal = EMA(MACD, 9)', desc: 'Trend-following momentum oscillator indicating shifts in strength and direction.' },
  rsi: { name: 'Relative Strength Index (RSI)', group: 'Oscillators', overlay: false, formula: 'RSI = 100 - (100 / (1 + AvgGain / AvgLoss))', desc: 'Measures momentum speed and change to identify overbought (<70) and oversold (>30) assets.' },
  atr: { name: 'Average True Range (ATR)', group: 'Volatility', overlay: false, formula: 'ATR = rolling_mean(True Range)', desc: 'Measures market volatility by decomposing the range of an asset.' },
  cci: { name: 'Commodity Channel Index (CCI)', group: 'Oscillators', overlay: false, formula: 'CCI = (TP - SMA(TP)) / (0.015 * MeanDeviation)', desc: 'Assesses current price level relative to an average price level over a lookback.' },
  roc: { name: 'Rate of Change (ROC)', group: 'Oscillators', overlay: false, formula: 'ROC = ((Close_t - Close_y) / Close_y) * 100', desc: 'Pure momentum oscillator measuring the percentage change in price over time.' },
  obv: { name: 'On-Balance Volume (OBV)', group: 'Volume', overlay: false, formula: 'OBV = OBV_y +/- Volume', desc: 'Cumulative volume indicator that relates volume flow to price changes.' },
  vwap: { name: 'Volume Weighted Average Price (VWAP)', group: 'Moving Averages', overlay: true, formula: 'VWAP = sum(Price * Vol) / sum(Vol)', desc: 'Benchmark price reflecting the true average price of the asset over the day/period.' },
  supertrend: { name: 'SuperTrend', group: 'Trend', overlay: true, formula: 'Bands = HL2 +/- Multiplier * ATR', desc: 'Trend-following indicator plotting dynamic bands that act as trailing stop losses.' },
  donchian: { name: 'Donchian Channels', group: 'Bands & Channels', overlay: true, formula: 'Upper = Max(High, n); Lower = Min(Low, n)', desc: 'Plots the highest high and lowest low over a period to map trading ranges.' },
  keltner: { name: 'Keltner Channels', group: 'Bands & Channels', overlay: true, formula: 'Middle = EMA; Bands = Middle +/- Mult * ATR', desc: 'Volatility-based envelopes that expand and contract around an exponential average.' },
  ichimoku: { name: 'Ichimoku Cloud', group: 'Bands & Channels', overlay: true, formula: 'Tenkan = (Max_9 + Min_9)/2; Kijun = (Max_26 + Min_26)/2', desc: 'Comprehensive chart overlay defining support, resistance, trend direction, and momentum.' }
};

// ── DUAL PANE SVG CHART FOR PRICE & OSCILLATOR ───────────────────────────────
function QuantLibraryChart({ data, selectedInd, meta }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 320 });
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      setDimensions({
        width: containerRef.current.clientWidth || 600,
        height: containerRef.current.clientHeight || 320
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
        No indicator historical data loaded
      </div>
    );
  }

  const { width, height } = dimensions;
  const padding = { top: 20, right: 30, bottom: 30, left: 60 };

  const isOverlay = meta.overlay;
  const mainHeight = isOverlay ? height - padding.top - padding.bottom : (height - padding.top - padding.bottom) * 0.65;
  const oscHeight = isOverlay ? 0 : (height - padding.top - padding.bottom) * 0.28;
  const oscTop = padding.top + mainHeight + 12;

  const chartWidth = width - padding.left - padding.right;

  // 1. Min/Max for main price panel
  let mainMin = Math.min(...data.map(d => d.close));
  let mainMax = Math.max(...data.map(d => d.close));

  if (isOverlay) {
    if (selectedInd === 'supertrend') {
      const stVals = data.map(d => d.supertrend).filter(v => v !== null && !isNaN(v));
      if (stVals.length) {
        mainMin = Math.min(mainMin, ...stVals);
        mainMax = Math.max(mainMax, ...stVals);
      }
    } else if (selectedInd === 'donchian') {
      const u = data.map(d => d.donchian_upper).filter(v => v !== null);
      const l = data.map(d => d.donchian_lower).filter(v => v !== null);
      if (u.length && l.length) {
        mainMin = Math.min(mainMin, ...l);
        mainMax = Math.max(mainMax, ...u);
      }
    } else if (selectedInd === 'keltner') {
      const u = data.map(d => d.keltner_upper).filter(v => v !== null);
      const l = data.map(d => d.keltner_lower).filter(v => v !== null);
      if (u.length && l.length) {
        mainMin = Math.min(mainMin, ...l);
        mainMax = Math.max(mainMax, ...u);
      }
    } else if (selectedInd === 'ichimoku') {
      const t = data.map(d => d.ichimoku_tenkan).filter(v => v !== null);
      const k = data.map(d => d.ichimoku_kijun).filter(v => v !== null);
      if (t.length && k.length) {
        mainMin = Math.min(mainMin, ...t, ...k);
        mainMax = Math.max(mainMax, ...t, ...k);
      }
    } else {
      // standard moving average overlays (sma, ema, hma, vwap, vwma)
      const indVals = data.map(d => d[selectedInd]).filter(v => v !== null && !isNaN(v));
      if (indVals.length) {
        mainMin = Math.min(mainMin, ...indVals);
        mainMax = Math.max(mainMax, ...indVals);
      }
    }
  }

  const mainRange = mainMax - mainMin || 1.0;
  const mainBoundMin = mainMin - mainRange * 0.05;
  const mainBoundMax = mainMax + mainRange * 0.05;
  const mainBoundRange = mainBoundMax - mainBoundMin;

  // 2. Min/Max for oscillator panel
  let oscMin = 0;
  let oscMax = 100;
  let oscVals = [];

  if (!isOverlay) {
    if (selectedInd === 'macd') {
      const m = data.map(d => d.macd).filter(v => v !== null);
      const s = data.map(d => d.macd_signal).filter(v => v !== null);
      oscVals = [...m, ...s];
    } else {
      oscVals = data.map(d => d[selectedInd]).filter(v => v !== null && !isNaN(v));
    }
    if (oscVals.length) {
      oscMin = Math.min(...oscVals);
      oscMax = Math.max(...oscVals);
      const oscRange = oscMax - oscMin || 1.0;
      oscMin = oscMin - oscRange * 0.05;
      oscMax = oscMax + oscRange * 0.05;
    }
  }

  const oscBoundRange = oscMax - oscMin || 1.0;

  // Paths calculations
  const pricePoints = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartWidth,
    y: padding.top + mainHeight - ((d.close - mainBoundMin) / mainBoundRange) * mainHeight,
    value: d.close,
    date: d.date
  }));

  const pricePathD = pricePoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');

  // Overlay Indicator Paths
  let overlayPaths = [];
  if (isOverlay) {
    if (selectedInd === 'supertrend') {
      const stPoints = data.map((d, i) => ({
        x: padding.left + (i / (data.length - 1)) * chartWidth,
        y: d.supertrend ? padding.top + mainHeight - ((d.supertrend - mainBoundMin) / mainBoundRange) * mainHeight : null,
        trend: d.supertrend_trend
      })).filter(p => p.y !== null);

      // Break path by trend changes to color differently
      let currentPath = '';
      let prevTrend = null;
      stPoints.forEach((p, idx) => {
        if (p.trend !== prevTrend || idx === 0) {
          if (currentPath) {
            overlayPaths.push({ pathD: currentPath, color: prevTrend === 1 ? '#00ff88' : '#ff3b30', width: 2 });
          }
          currentPath = `M ${p.x} ${p.y}`;
          prevTrend = p.trend;
        } else {
          currentPath += ` L ${p.x} ${p.y}`;
        }
      });
      if (currentPath) {
        overlayPaths.push({ pathD: currentPath, color: prevTrend === 1 ? '#00ff88' : '#ff3b30', width: 2 });
      }
    } else if (selectedInd === 'donchian') {
      const upperPts = data.map((d, i) => ({ x: padding.left + (i / (data.length - 1)) * chartWidth, y: d.donchian_upper ? padding.top + mainHeight - ((d.donchian_upper - mainBoundMin) / mainBoundRange) * mainHeight : null })).filter(p => p.y !== null);
      const lowerPts = data.map((d, i) => ({ x: padding.left + (i / (data.length - 1)) * chartWidth, y: d.donchian_lower ? padding.top + mainHeight - ((d.donchian_lower - mainBoundMin) / mainBoundRange) * mainHeight : null })).filter(p => p.y !== null);
      overlayPaths.push({ pathD: upperPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#a0a0ff', width: 1 });
      overlayPaths.push({ pathD: lowerPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#a0a0ff', width: 1 });
    } else if (selectedInd === 'keltner') {
      const upperPts = data.map((d, i) => ({ x: padding.left + (i / (data.length - 1)) * chartWidth, y: d.keltner_upper ? padding.top + mainHeight - ((d.keltner_upper - mainBoundMin) / mainBoundRange) * mainHeight : null })).filter(p => p.y !== null);
      const lowerPts = data.map((d, i) => ({ x: padding.left + (i / (data.length - 1)) * chartWidth, y: d.keltner_lower ? padding.top + mainHeight - ((d.keltner_lower - mainBoundMin) / mainBoundRange) * mainHeight : null })).filter(p => p.y !== null);
      overlayPaths.push({ pathD: upperPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#ffd080', width: 1 });
      overlayPaths.push({ pathD: lowerPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#ffd080', width: 1 });
    } else if (selectedInd === 'ichimoku') {
      const tenkanPts = data.map((d, i) => ({ x: padding.left + (i / (data.length - 1)) * chartWidth, y: d.ichimoku_tenkan ? padding.top + mainHeight - ((d.ichimoku_tenkan - mainBoundMin) / mainBoundRange) * mainHeight : null })).filter(p => p.y !== null);
      const kijunPts = data.map((d, i) => ({ x: padding.left + (i / (data.length - 1)) * chartWidth, y: d.ichimoku_kijun ? padding.top + mainHeight - ((d.ichimoku_kijun - mainBoundMin) / mainBoundRange) * mainHeight : null })).filter(p => p.y !== null);
      overlayPaths.push({ pathD: tenkanPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#ff5599', width: 1.2 });
      overlayPaths.push({ pathD: kijunPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#33aaff', width: 1.2 });
    } else {
      // SMA, EMA, HMA, VWMA, VWAP overlays
      const indPts = data.map((d, i) => ({
        x: padding.left + (i / (data.length - 1)) * chartWidth,
        y: d[selectedInd] ? padding.top + mainHeight - ((d[selectedInd] - mainBoundMin) / mainBoundRange) * mainHeight : null
      })).filter(p => p.y !== null);
      overlayPaths.push({ pathD: indPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#ffc107', width: 1.5 });
    }
  }

  // Oscillator Panel Paths
  let oscPaths = [];
  if (!isOverlay) {
    if (selectedInd === 'macd') {
      const macdPts = data.map((d, i) => ({ x: padding.left + (i / (data.length - 1)) * chartWidth, y: d.macd ? oscTop + oscHeight - ((d.macd - oscMin) / oscBoundRange) * oscHeight : null })).filter(p => p.y !== null);
      const signalPts = data.map((d, i) => ({ x: padding.left + (i / (data.length - 1)) * chartWidth, y: d.macd_signal ? oscTop + oscHeight - ((d.macd_signal - oscMin) / oscBoundRange) * oscHeight : null })).filter(p => p.y !== null);
      oscPaths.push({ pathD: macdPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#00f0ff', width: 1.5 });
      oscPaths.push({ pathD: signalPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#ff3b30', width: 1.5 });
    } else {
      const pts = data.map((d, i) => ({
        x: padding.left + (i / (data.length - 1)) * chartWidth,
        y: d[selectedInd] ? oscTop + oscHeight - ((d[selectedInd] - oscMin) / oscBoundRange) * oscHeight : null
      })).filter(p => p.y !== null);
      oscPaths.push({ pathD: pts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), ''), color: '#ffc107', width: 1.5 });
    }
  }

  // Grid Lines Main
  const mainGridLines = [];
  for (let i = 0; i <= 3; i++) {
    const yVal = mainBoundMin + (i / 3) * mainBoundRange;
    const y = padding.top + mainHeight - (i / 3) * mainHeight;
    mainGridLines.push({ y, value: yVal });
  }

  // Grid Lines Osc
  const oscGridLines = [];
  if (!isOverlay) {
    if (selectedInd === 'rsi') {
      // Special RSI bounds
      [30, 50, 70].forEach(level => {
        const y = oscTop + oscHeight - ((level - oscMin) / oscBoundRange) * oscHeight;
        oscGridLines.push({ y, value: level, isRef: true });
      });
    } else {
      for (let i = 0; i <= 2; i++) {
        const yVal = oscMin + (i / 2) * oscBoundRange;
        const y = oscTop + oscHeight - (i / 2) * oscHeight;
        oscGridLines.push({ y, value: yVal, isRef: false });
      }
    }
  }

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - padding.left;
    const pct = Math.max(0, Math.min(1, x / chartWidth));
    const closestIdx = Math.round(pct * (data.length - 1));
    if (closestIdx >= 0 && closestIdx < data.length) {
      setHoverIndex(closestIdx);
    }
  };

  const hoveredBar = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div 
      ref={containerRef} 
      className="chart-container-svg"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
      style={{ width: '100%', height: '100%', cursor: 'crosshair', position: 'relative' }}
    >
      <svg width={width} height={height}>
        {/* Main Price Grid */}
        {mainGridLines.map((line, i) => (
          <g key={`main-grid-${i}`}>
            <line x1={padding.left} y1={line.y} x2={width - padding.right} y2={line.y} stroke="#1f2937" strokeWidth="1" strokeDasharray="3,3" />
            <text x={padding.left - 8} y={line.y + 3} fill="#848e9c" fontSize="8" fontFamily="monospace" textAnchor="end">
              ${line.value.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Draw Price Line */}
        <path d={pricePathD} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />

        {/* Draw Overlay Indicators */}
        {overlayPaths.map((p, idx) => (
          <path key={`overlay-path-${idx}`} d={p.pathD} fill="none" stroke={p.color} strokeWidth={p.width} />
        ))}

        {/* Draw Oscillator Pane if needed */}
        {!isOverlay && (
          <>
            <rect x={padding.left} y={oscTop} width={chartWidth} height={oscHeight} fill="#0d0d15" rx="3" stroke="#1f2937" />
            {oscGridLines.map((line, i) => (
              <g key={`osc-grid-${i}`}>
                <line 
                  x1={padding.left} 
                  y1={line.y} 
                  x2={width - padding.right} 
                  y2={line.y} 
                  stroke={line.isRef ? '#ff3b3060' : '#1f2937'} 
                  strokeWidth="1" 
                  strokeDasharray={line.isRef ? '1,1' : '3,3'} 
                />
                <text x={padding.left - 8} y={line.y + 3} fill="#848e9c" fontSize="8" fontFamily="monospace" textAnchor="end">
                  {line.value.toFixed(1)}
                </text>
              </g>
            ))}
            {oscPaths.map((p, idx) => (
              <path key={`osc-path-${idx}`} d={p.pathD} fill="none" stroke={p.color} strokeWidth={p.width} />
            ))}
          </>
        )}

        {/* Hover elements */}
        {hoveredBar && (
          <g>
            <line 
              x1={padding.left + (hoverIndex / (data.length - 1)) * chartWidth} 
              y1={padding.top} 
              x2={padding.left + (hoverIndex / (data.length - 1)) * chartWidth} 
              y2={height - padding.bottom} 
              stroke="#4b5563" 
              strokeWidth="1" 
              strokeDasharray="2,2" 
            />
            {/* Tooltip Box */}
            <rect 
              x={pricePoints[hoverIndex].x > width / 2 ? pricePoints[hoverIndex].x - 170 : pricePoints[hoverIndex].x + 15} 
              y={padding.top + 5} 
              width="155" 
              height={isOverlay ? 55 : 85} 
              rx="3" 
              fill="#161622" 
              stroke="#1f2937"
            />
            <text x={pricePoints[hoverIndex].x > width / 2 ? pricePoints[hoverIndex].x - 164 : pricePoints[hoverIndex].x + 21} y={padding.top + 18} fill="#848e9c" fontSize="8" fontFamily="monospace">
              Date: {hoveredBar.date}
            </text>
            <text x={pricePoints[hoverIndex].x > width / 2 ? pricePoints[hoverIndex].x - 164 : pricePoints[hoverIndex].x + 21} y={padding.top + 30} fill="#ffffff" fontSize="8" fontFamily="monospace">
              Close: ${hoveredBar.close.toFixed(2)}
            </text>
            
            {isOverlay ? (
              <text x={pricePoints[hoverIndex].x > width / 2 ? pricePoints[hoverIndex].x - 164 : pricePoints[hoverIndex].x + 21} y={padding.top + 42} fill="#ffc107" fontSize="8" fontFamily="monospace" fontWeight="bold">
                {selectedInd.toUpperCase()}: ${parseFloat(hoveredBar[selectedInd] || hoveredBar.supertrend || 0).toFixed(2)}
              </text>
            ) : (
              <>
                <text x={pricePoints[hoverIndex].x > width / 2 ? pricePoints[hoverIndex].x - 164 : pricePoints[hoverIndex].x + 21} y={padding.top + 42} fill="#ffc107" fontSize="8" fontFamily="monospace" fontWeight="bold">
                  {selectedInd.toUpperCase()}: {parseFloat(hoveredBar[selectedInd] || 0).toFixed(2)}
                </text>
                {selectedInd === 'macd' && (
                  <>
                    <text x={pricePoints[hoverIndex].x > width / 2 ? pricePoints[hoverIndex].x - 164 : pricePoints[hoverIndex].x + 21} y={padding.top + 54} fill="#00f0ff" fontSize="8" fontFamily="monospace">
                      Signal: {parseFloat(hoveredBar.macd_signal || 0).toFixed(2)}
                    </text>
                    <text x={pricePoints[hoverIndex].x > width / 2 ? pricePoints[hoverIndex].x - 164 : pricePoints[hoverIndex].x + 21} y={padding.top + 66} fill="#ff3b30" fontSize="8" fontFamily="monospace">
                      Hist: {parseFloat(hoveredBar.macd - hoveredBar.macd_signal || 0).toFixed(2)}
                    </text>
                  </>
                )}
              </>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

// ── STRATEGY SIMULATOR AND OPTIMIZER ENGINE ─────────────────────────────────
function calculateRsiJs(closes, period = 14) {
  const rsi = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i-1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function calculateEmaJs(closes, period) {
  const ema = new Array(closes.length).fill(NaN);
  if (closes.length < period) return ema;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  ema[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    ema[i] = closes[i] * k + ema[i-1] * (1 - k);
  }
  return ema;
}

function calculateMacdJs(closes, fast = 12, slow = 26, signal = 9) {
  const fastEma = calculateEmaJs(closes, fast);
  const slowEma = calculateEmaJs(closes, slow);
  const macd = new Array(closes.length).fill(NaN);
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(fastEma[i]) && !isNaN(slowEma[i])) {
      macd[i] = fastEma[i] - slowEma[i];
    }
  }
  const macdCloses = macd.map(v => isNaN(v) ? 0 : v);
  const signalLine = calculateEmaJs(macdCloses, signal);
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(macd[i])) {
      signalLine[i] = NaN;
    }
  }
  const hist = macd.map((v, i) => v - signalLine[i]);
  return { macd, signalLine, hist };
}

function runSimulationJs(bars, strategy, params, initialCapital = 10000, feeRate = 0.001, slippage = 0.0005) {
  const closes = bars.map(b => b.close);
  const n = closes.length;
  if (n < 30) return null;

  let signals = new Array(n).fill(0);
  if (strategy === 'sma') {
    const fast = params.fast_period || 50;
    const slow = params.slow_period || 200;
    const fastSma = closes.map((_, idx) => {
      if (idx < fast - 1) return NaN;
      let sum = 0;
      for (let i = idx - fast + 1; i <= idx; i++) sum += closes[i];
      return sum / fast;
    });
    const slowSma = closes.map((_, idx) => {
      if (idx < slow - 1) return NaN;
      let sum = 0;
      for (let i = idx - slow + 1; i <= idx; i++) sum += closes[i];
      return sum / slow;
    });
    for (let i = 1; i < n; i++) {
      if (!isNaN(fastSma[i-1]) && !isNaN(slowSma[i-1])) {
        signals[i] = fastSma[i-1] > slowSma[i-1] ? 1 : 0;
      }
    }
  } else if (strategy === 'rsi') {
    const period = params.rsi_period || 14;
    const oversold = params.oversold || 30;
    const overbought = params.overbought || 70;
    const rsi = calculateRsiJs(closes, period);
    let position = 0;
    for (let i = 1; i < n; i++) {
      const prevRsi = rsi[i-1];
      if (!isNaN(prevRsi)) {
        if (prevRsi < oversold) position = 1;
        else if (prevRsi > overbought) position = 0;
      }
      signals[i] = position;
    }
  } else if (strategy === 'macd') {
    const fast = params.fast_period || 12;
    const slow = params.slow_period || 26;
    const sig = params.signal_period || 9;
    const { macd, signalLine } = calculateMacdJs(closes, fast, slow, sig);
    for (let i = 1; i < n; i++) {
      if (!isNaN(macd[i-1]) && !isNaN(signalLine[i-1])) {
        signals[i] = macd[i-1] > signalLine[i-1] ? 1 : 0;
      }
    }
  } else if (strategy === 'buy_hold') {
    signals = new Array(n).fill(1);
  }

  let cash = initialCapital;
  let shares = 0;
  const equityCurve = [];
  const trades = [];
  let currentTrade = null;
  
  equityCurve.push({
    date: bars[0].date,
    strategy: initialCapital,
    benchmark: initialCapital
  });
  
  const benchmarkInitialPrice = closes[0];

  for (let i = 1; i < n; i++) {
    const prevSig = signals[i-1];
    const currSig = signals[i];
    const price = closes[i];
    const date = bars[i].date;
    
    if (currSig === 1 && prevSig === 0) {
      const executionPrice = price * (1 + slippage);
      const fee = cash * feeRate;
      const netCash = cash - fee;
      shares = netCash / executionPrice;
      cash = 0;
      currentTrade = {
        entry_date: date,
        entry_price: executionPrice,
        exit_date: null,
        exit_price: 0,
        profit: 0
      };
    } else if (currSig === 0 && prevSig === 1) {
      const executionPrice = price * (1 - slippage);
      const grossCash = shares * executionPrice;
      const fee = grossCash * feeRate;
      cash = grossCash - fee;
      shares = 0;
      if (currentTrade) {
        currentTrade.exit_date = date;
        currentTrade.exit_price = executionPrice;
        currentTrade.profit = ((executionPrice - currentTrade.entry_price) / currentTrade.entry_price) * 100;
        trades.push(currentTrade);
        currentTrade = null;
      }
    }
    
    const currentEquity = cash + shares * price;
    const benchmarkEquity = (price / benchmarkInitialPrice) * initialCapital;
    
    equityCurve.push({
      date,
      strategy: currentEquity,
      benchmark: benchmarkEquity
    });
  }

  if (currentTrade && shares > 0) {
    const lastPrice = closes[n - 1];
    currentTrade.exit_date = bars[n - 1].date;
    currentTrade.exit_price = lastPrice;
    currentTrade.profit = ((lastPrice - currentTrade.entry_price) / currentTrade.entry_price) * 100;
    currentTrade.is_open = true;
    trades.push(currentTrade);
  }

  const strategyReturns = [];
  for (let i = 1; i < n; i++) {
    const prevStrategyEquity = equityCurve[i-1].strategy;
    const currStrategyEquity = equityCurve[i].strategy;
    strategyReturns.push((currStrategyEquity - prevStrategyEquity) / prevStrategyEquity);
  }

  const totalReturn = ((equityCurve[n - 1].strategy - initialCapital) / initialCapital) * 100;
  const marketReturn = ((equityCurve[n - 1].benchmark - initialCapital) / initialCapital) * 100;

  let maxDd = 0;
  let peak = -Infinity;
  for (let i = 0; i < n; i++) {
    const val = equityCurve[i].strategy;
    if (val > peak) peak = val;
    const dd = (val - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  const maxDrawdownPct = maxDd * 100;

  const numYears = n / 252;
  const cagr = ((equityCurve[n-1].strategy / initialCapital) ** (1 / numYears) - 1) * 100;

  const meanRet = strategyReturns.reduce((a, b) => a + b, 0) / strategyReturns.length;
  const variance = strategyReturns.reduce((a, b) => a + Math.pow(b - meanRet, 2), 0) / strategyReturns.length;
  const stdDev = Math.sqrt(variance);
  const volatility = stdDev * Math.sqrt(252) * 100;

  const rfDaily = 0.02 / 252;
  const excessReturns = strategyReturns.map(r => r - rfDaily);
  const meanExcess = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const sharpe = stdDev > 0 ? (meanExcess / stdDev) * Math.sqrt(252) : 0;

  const downsideReturns = strategyReturns.map(r => r < 0 ? r : 0);
  const downsideVar = downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / downsideReturns.length;
  const downsideStd = Math.sqrt(downsideVar);
  const sortino = downsideStd > 0 ? (meanExcess / downsideStd) * Math.sqrt(252) : 0;

  const calmar = Math.abs(maxDrawdownPct) > 0 ? (cagr / 100) / Math.abs(maxDd) : 0;

  let winRate = 0;
  let profitFactor = 0;
  let avgWin = 0;
  let avgLoss = 0;
  let bestTrade = 0;
  let worstTrade = 0;

  const profits = trades.map(t => t.profit);
  if (profits.length > 0) {
    const profitable = profits.filter(p => p > 0);
    const losing = profits.filter(p => p < 0);
    winRate = (profitable.length / profits.length) * 100;
    
    const sumGain = profitable.reduce((a, b) => a + b, 0);
    const sumLoss = Math.abs(losing.reduce((a, b) => a + b, 0));
    profitFactor = sumLoss > 0 ? sumGain / sumLoss : (sumGain > 0 ? 999 : 1.0);
    
    avgWin = profitable.length > 0 ? profitable.reduce((a, b) => a + b, 0) / profitable.length : 0;
    avgLoss = losing.length > 0 ? losing.reduce((a, b) => a + b, 0) / losing.length : 0;
    bestTrade = Math.max(...profits);
    worstTrade = Math.min(...profits);
  }

  return {
    summary: {
      strategy: strategy.toUpperCase(),
      total_return: totalReturn,
      market_return: marketReturn,
      max_drawdown: maxDrawdownPct,
      sharpe_ratio: sharpe,
      sortino_ratio: sortino,
      calmar_ratio: calmar,
      cagr: cagr,
      volatility: volatility,
      win_rate: winRate,
      trades_count: trades.length,
      profit_factor: profitFactor,
      avg_win: avgWin,
      avg_loss: avgLoss,
      best_trade: bestTrade,
      worst_trade: worstTrade
    },
    equity_curve: equityCurve,
    trades
  };
}

function BacktesterPage() {
  const { activeMarket } = useMarketStore();
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'backtest'
  
  // ── General config ──
  const [symbol, setSymbol] = useState(activeMarket === 'US' ? 'AAPL' : 'RELIANCE');
  const [market, setMarket] = useState(activeMarket);
  
  useEffect(() => {
    setMarket(activeMarket);
    setSymbol(activeMarket === 'US' ? 'AAPL' : 'RELIANCE');
  }, [activeMarket]);

  // ── Tab 1: Indicator Library State ──
  const [selectedIndicator, setSelectedIndicator] = useState('rsi');
  const [indData, setIndData] = useState(null);
  const [indLoading, setIndLoading] = useState(false);
  const [indError, setIndError] = useState('');

  // ── Tab 2: Backtest State ──
  const [strategy, setStrategy] = useState('sma');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2026-01-01');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [feeRate, setFeeRate] = useState(0.001); // 0.1%
  const [slippage, setSlippage] = useState(0.0005); // 0.05%

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backtestBars, setBacktestBars] = useState([]);
  const [activeResults, setActiveResults] = useState(null);

  // ── Optimization State ──
  const [optimizationMode, setOptimizationMode] = useState(false);
  const [optTarget, setOptTarget] = useState('sharpe_ratio'); // 'sharpe_ratio' | 'cagr' | 'max_drawdown'
  const [optLeaderboard, setOptLeaderboard] = useState([]);

  // Strategy Params state
  const [fastPeriod, setFastPeriod] = useState(50);
  const [slowPeriod, setSlowPeriod] = useState(200);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [oversold, setOversold] = useState(30);
  const [overbought, setOverbought] = useState(70);
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);

  // Fetch Indicator Library Data
  const loadIndicatorsData = () => {
    setIndLoading(true);
    setIndError('');
    marketApi.getIndicators(symbol, market)
      .then(res => {
        setIndData(res.data);
      })
      .catch(err => {
        setIndError(err.response?.data?.detail || 'Failed to fetch indicator library metrics: ' + err.message);
      })
      .finally(() => {
        setIndLoading(false);
      });
  };

  useEffect(() => {
    if (activeTab === 'library') {
      loadIndicatorsData();
    }
  }, [symbol, market, activeTab]);

  // Fetch OHLCV data for backtesting
  const handleRunBacktest = (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setActiveResults(null);
    setOptLeaderboard([]);

    // Fetch historical data
    marketApi.getOHLCV(symbol, { market, period: '2y', interval: '1d' })
      .then(res => {
        // Filter bars in Date Range
        const rawBars = (res.data.candles || []).map(candle => {
          const dateStr = new Date(candle.time * 1000).toISOString().split('T')[0];
          return {
            date: dateStr,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
          };
        });
        const filtered = rawBars.filter(bar => bar.date >= startDate && bar.date <= endDate);
        
        if (filtered.length < 20) {
          throw new Error('Selected date range contains insufficient trading sessions (minimum 20 trading days required).');
        }

        setBacktestBars(filtered);

        // Run default simulation
        const currentParams = getCurrentParams();
        const simRes = runSimulationJs(filtered, strategy, currentParams, initialCapital, feeRate, slippage);
        setActiveResults(simRes);

        // Run optimization if checked
        if (optimizationMode) {
          runGridSearch(filtered, strategy, simRes);
        }
      })
      .catch(err => {
        setError(err.message || 'Data retrieval failed.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getCurrentParams = () => {
    if (strategy === 'sma') return { fast_period: fastPeriod, slow_period: slowPeriod };
    if (strategy === 'rsi') return { rsi_period: rsiPeriod, oversold, overbought };
    if (strategy === 'macd') return { fast_period: macdFast, slow_period: macdSlow, signal_period: macdSignal };
    return {};
  };

  // Run grid search parameters client side
  const runGridSearch = (bars, strat, defaultResult) => {
    let combos = [];
    if (strat === 'sma') {
      const fasts = [10, 20, 30, 50];
      const slows = [100, 150, 200];
      fasts.forEach(f => {
        slows.forEach(s => {
          if (f < s) combos.push({ fast_period: f, slow_period: s });
        });
      });
    } else if (strat === 'rsi') {
      const periods = [7, 10, 14, 21];
      const oversolds = [25, 30, 35];
      const overboughts = [65, 70, 75];
      periods.forEach(p => {
        oversolds.forEach(os => {
          overboughts.forEach(ob => {
            combos.push({ rsi_period: p, oversold: os, overbought: ob });
          });
        });
      });
    } else if (strat === 'macd') {
      const fasts = [8, 12, 16];
      const slows = [22, 26, 30];
      const signals = [7, 9, 11];
      fasts.forEach(f => {
        slows.forEach(s => {
          signals.forEach(sig => {
            if (f < s) combos.push({ fast_period: f, slow_period: s, signal_period: sig });
          });
        });
      });
    }

    const leaderboard = [];
    combos.forEach(c => {
      const sim = runSimulationJs(bars, strat, c, initialCapital, feeRate, slippage);
      if (sim) {
        leaderboard.push({
          params: c,
          metrics: sim.summary,
          result: sim
        });
      }
    });

    // Sort by target
    leaderboard.sort((a, b) => {
      if (optTarget === 'max_drawdown') {
        return b.metrics.max_drawdown - a.metrics.max_drawdown; // closer to 0 is better
      }
      return b.metrics[optTarget] - a.metrics[optTarget];
    });

    setOptLeaderboard(leaderboard.slice(0, 8)); // Top 8 optimal setups
  };

  const applyOptimalConfig = (run) => {
    setActiveResults(run.result);
    // Sync inputs
    const p = run.params;
    if (strategy === 'sma') {
      setFastPeriod(p.fast_period);
      setSlowPeriod(p.slow_period);
    } else if (strategy === 'rsi') {
      setRsiPeriod(p.rsi_period);
      setOversold(p.oversold);
      setOverbought(p.overbought);
    } else if (strategy === 'macd') {
      setMacdFast(p.fast_period);
      setMacdSlow(p.slow_period);
      setMacdSignal(p.signal_period);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const getCurrencySymbol = (mkt) => {
    return (mkt === 'NSE' || mkt === 'BSE') ? '₹' : '$';
  };

  const activeMeta = INDICATORS_METADATA[selectedIndicator] || {};

  return (
    <div className="backtest-root">
      {/* ── Top Navigation and Symbol Selector ── */}
      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="flex items-center gap-4">
          <h1 className="font-mono text-sm fw-700 uppercase" style={{ color: '#00ff88', letterSpacing: '0.05em' }}>
            ⚙️ Quant Engine
          </h1>
          <div className="flex bg-black-200 p-0.5 rounded border border-gray-800" style={{ background: '#11111b' }}>
            <button 
              className={`btn btn-sm font-mono text-xxs ${activeTab === 'library' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('library')}
            >
              INDICATOR LIBRARY
            </button>
            <button 
              className={`btn btn-sm font-mono text-xxs ${activeTab === 'backtest' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('backtest')}
            >
              STRATEGY BACKTEST & OPTIMIZE
            </button>
          </div>
        </div>

        {/* Global symbol input */}
        <div className="flex gap-2 items-center font-mono">
          <div className="form-field flex-row gap-1 items-center">
            <span className="text-muted text-xxs uppercase">Ticker:</span>
            <input
              className="form-input text-center"
              style={{ width: '80px', height: '24px', padding: '0 4px' }}
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              required
            />
          </div>
          <div className="form-field flex-row gap-1 items-center">
            <span className="text-muted text-xxs uppercase">Exchange:</span>
            <select
              className="form-input"
              style={{ height: '24px', padding: '0 4px', fontSize: '10px' }}
              value={market}
              onChange={e => setMarket(e.target.value)}
            >
              <option value="US">US Markets</option>
              <option value="NSE">NSE (India)</option>
              <option value="BSE">BSE (India)</option>
            </select>
          </div>
          {activeTab === 'library' && (
            <button className="btn btn-primary btn-sm font-mono text-xxs" style={{ height: '24px' }} onClick={loadIndicatorsData} disabled={indLoading}>
              {indLoading ? 'LOADING...' : 'RELOAD'}
            </button>
          )}
        </div>
      </div>

      {/* ── TAB 1: QUANTITATIVE INDICATOR LIBRARY ── */}
      {activeTab === 'library' && (
        <div className="backtest-layout">
          {/* Sidebar Indicator select */}
          <div className="backtest-sidebar">
            <div className="panel" style={{ height: '100%' }}>
              <div className="panel-header">
                <span className="panel-title">Indicator Vault</span>
              </div>
              <div className="panel-body font-mono text-xs flex flex-col gap-2" style={{ padding: '10px' }}>
                <span className="text-muted text-xxs uppercase">Select Indicator to plot:</span>
                
                {/* Grouped indicators list */}
                <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '420px' }}>
                  {['Moving Averages', 'Oscillators', 'Volatility', 'Volume', 'Trend', 'Bands & Channels'].map(group => {
                    const groupItems = Object.entries(INDICATORS_METADATA).filter(([_, m]) => m.group === group);
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group} className="flex flex-col gap-1">
                        <div className="text-secondary text-xxs fw-700 uppercase" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '2px' }}>{group}</div>
                        {groupItems.map(([key, meta]) => (
                          <button
                            key={key}
                            className={`tool-btn text-left p-1.5 rounded text-xxs ${selectedIndicator === key ? 'active' : ''}`}
                            onClick={() => setSelectedIndicator(key)}
                            style={{ background: selectedIndicator === key ? 'rgba(0, 255, 136, 0.08)' : 'transparent', border: selectedIndicator === key ? '1px solid #00ff88' : '1px solid transparent', display: 'flex', flexDirection: 'column' }}
                          >
                            <span className="fw-600 text-white">{meta.name}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Main indicators visualization */}
          <div className="backtest-main">
            {indError && <div className="panel font-mono text-red text-xs" style={{ padding: '12px' }}>⚠ {indError}</div>}

            {indLoading ? (
              <div className="panel flex-1 flex flex-col items-center justify-center text-center font-mono" style={{ padding: '40px' }}>
                <span className="text-secondary text-sm animate-pulse">Calculating Quantitative library...</span>
                <p className="text-muted text-xs" style={{ maxWidth: '350px', marginTop: '8px' }}>
                  Streaming yfinance OHLCV bars and calculating 16+ technical indicators.
                </p>
              </div>
            ) : !indData ? (
              <div className="panel flex-1 flex flex-col items-center justify-center text-center font-mono" style={{ padding: '40px' }}>
                <span className="text-secondary text-sm">No Indicators Loaded</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3" style={{ height: '100%' }}>
                {/* Meta details */}
                <div className="panel font-mono text-xs" style={{ padding: '12px' }}>
                  <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '6px', marginBottom: '8px' }}>
                    <span className="text-secondary fw-700 uppercase" style={{ fontSize: '11px' }}>{activeMeta.name}</span>
                    <span className="badge badge-blue">{activeMeta.group}</span>
                  </div>
                  <p className="text-muted text-xxs mb-1">{activeMeta.desc}</p>
                  <div className="flex gap-2 text-xxs" style={{ background: '#0a0a10', padding: '6px', borderRadius: '3px' }}>
                    <span className="text-secondary">FORMULA:</span>
                    <span className="text-white">{activeMeta.formula}</span>
                  </div>
                  <div className="flex justify-between mt-3 text-xxs pt-2" style={{ borderTop: '1px solid #1f2937' }}>
                    <span>LATEST VALUE ({symbol}):</span>
                    <span className="text-green fw-700">
                      {selectedIndicator === 'supertrend' ? (
                        `${indData.current.supertrend.toFixed(2)} (${indData.current.supertrend_trend})`
                      ) : (
                        indData.current[selectedIndicator]?.toFixed(2) || '0.00'
                      )}
                    </span>
                  </div>
                </div>

                {/* SVG Indicator Chart */}
                <div className="panel flex-1" style={{ minHeight: '340px' }}>
                  <div className="panel-header flex justify-between">
                    <span className="panel-title">{symbol} Technical Indicators Workspace (100 Daily Bars)</span>
                    <div className="flex gap-2 text-xxs font-mono">
                      <span style={{ color: '#ffffff' }}>● Close Price</span>
                      <span style={{ color: '#ffc107' }}>● {activeMeta.name}</span>
                    </div>
                  </div>
                  <div className="panel-body flex-1" style={{ height: '300px', padding: '8px' }}>
                    <QuantLibraryChart data={indData.series} selectedInd={selectedIndicator} meta={activeMeta} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: STRATEGY SIMULATOR AND OPTIMIZER ENGINE ── */}
      {activeTab === 'backtest' && (
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
                    <label className="text-muted uppercase fw-600 text-xxs">Strategy Model</label>
                    <select
                      className="form-input"
                      value={strategy}
                      onChange={e => setStrategy(e.target.value)}
                    >
                      <option value="sma">Simple Moving Average Crossover (SMA)</option>
                      <option value="rsi">Relative Strength Index (RSI)</option>
                      <option value="macd">MACD Signal Line Cross</option>
                      <option value="buy_hold">Passive Buy & Hold (Benchmark)</option>
                    </select>
                  </div>

                  {/* Strategy parameters inputs */}
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

                  {/* Fee & Slippage Parameters */}
                  <div className="flex gap-2" style={{ borderTop: '1px solid #1f2937', paddingTop: '8px' }}>
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 text-xxs">Fee Rate</label>
                      <input
                        type="number"
                        className="form-input"
                        step="0.0001"
                        value={feeRate}
                        onChange={e => setFeeRate(parseFloat(e.target.value))}
                        required
                      />
                    </div>
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 text-xxs">Slippage</label>
                      <input
                        type="number"
                        className="form-input"
                        step="0.0001"
                        value={slippage}
                        onChange={e => setSlippage(parseFloat(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  {/* Optimization selector */}
                  <div className="flex flex-col gap-1 border-t border-gray-800 pt-2" style={{ borderTop: '1px solid #1f2937' }}>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="check-optimize" 
                        checked={optimizationMode} 
                        onChange={e => setOptimizationMode(e.target.checked)} 
                      />
                      <label htmlFor="check-optimize" className="text-muted uppercase fw-600 text-xxs" style={{ cursor: 'pointer' }}>Enable Parameter Sweep</label>
                    </div>
                    {optimizationMode && (
                      <div className="form-field mt-1">
                        <label className="text-muted uppercase fw-600 text-xxs">Optimize Target</label>
                        <select 
                          className="form-input" 
                          value={optTarget} 
                          onChange={e => setOptTarget(e.target.value)}
                        >
                          <option value="sharpe_ratio">Sharpe Ratio</option>
                          <option value="cagr">CAGR %</option>
                          <option value="max_drawdown">Minimum Max Drawdown</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                    {loading ? 'CALCULATING STRATEGY...' : 'RUN HISTORICAL BACKTEST'}
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
            ) : !activeResults ? (
              <div className="panel flex-1 flex flex-col items-center justify-center text-center font-mono" style={{ padding: '40px' }}>
                <div className="logo-glowing" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', display: 'flex', alignItems: 'center', justify: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', boxShadow: '0 0 15px rgba(0, 255, 136, 0.2)' }}>Q</div>
                <span className="text-secondary text-sm">Backtester Ready</span>
                <p className="text-muted text-xs" style={{ maxWidth: '350px', marginTop: '8px' }}>
                  Define your asset, trading model, backtest range, and parameters in the left panel to execute a historical simulation.
                </p>
              </div>
            ) : (
              <div className="backtest-results-grid">
                {/* Metrics block */}
                <div className="backtest-metrics-cards">
                  <div className="metric-card">
                    <div className="metric-card-label">Total Strategy Return</div>
                    <div className={`metric-card-value ${activeResults.summary.total_return >= 0 ? 'price-up' : 'price-down'}`}>
                      {activeResults.summary.total_return.toFixed(2)}%
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">CAGR</div>
                    <div className={`metric-card-value ${activeResults.summary.cagr >= 0 ? 'price-up' : 'price-down'}`}>
                      {activeResults.summary.cagr.toFixed(2)}%
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">Max Drawdown</div>
                    <div className="metric-card-value price-down">
                      {activeResults.summary.max_drawdown.toFixed(2)}%
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">Sharpe Ratio</div>
                    <div className="metric-card-value text-blue">
                      {activeResults.summary.sharpe_ratio.toFixed(2)}
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">Sortino Ratio</div>
                    <div className="metric-card-value text-green">
                      {activeResults.summary.sortino_ratio.toFixed(2)}
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-card-label">Win Rate</div>
                    <div className="metric-card-value text-green">
                      {activeResults.summary.win_rate.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Optimization leaderboard if mode enabled */}
                {optimizationMode && optLeaderboard.length > 0 && (
                  <div className="panel font-mono text-xs" style={{ padding: '8px 12px', border: '1px solid #00ff8840' }}>
                    <div className="text-green fw-700 uppercase mb-2" style={{ fontSize: '9px' }}>🎯 Parameter Optimization Leaderboard (Sorted by {optTarget})</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {optLeaderboard.slice(0, 4).map((run, i) => (
                        <div 
                          key={i} 
                          onClick={() => applyOptimalConfig(run)}
                          className="opt-card p-1.5 rounded cursor-pointer transition" 
                          style={{ background: '#12121e', border: '1px solid #1f2937', cursor: 'pointer' }}
                        >
                          <div className="flex justify-between text-xxs font-bold text-white mb-1">
                            <span>#{i + 1} Optimal</span>
                            <span className="text-green">Apply</span>
                          </div>
                          <div className="text-xxs text-muted">
                            {Object.entries(run.params).map(([k, v]) => `${k.replace('_period', '')}:${v}`).join(', ')}
                          </div>
                          <div className="flex justify-between text-xxs mt-1 pt-1" style={{ borderTop: '1px solid #1f2937' }}>
                            <span>Sharpe: {run.metrics.sharpe_ratio.toFixed(2)}</span>
                            <span className={run.metrics.cagr >= 0 ? 'price-up' : 'price-down'}>CAGR: {run.metrics.cagr.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Equity chart */}
                <div className="panel">
                  <div className="panel-header flex justify-between">
                    <span className="panel-title">Equity Growth Simulation ({getCurrencySymbol(market)}10,000 Initial Capital)</span>
                    <div className="flex gap-3 text-xxs font-mono">
                      <span style={{ color: '#00f0ff' }}>● Strategy</span>
                      <span style={{ color: '#848e9c' }}>● Benchmark (Buy & Hold)</span>
                      <button onClick={handleExportPDF} className="btn btn-ghost btn-xs text-green" style={{ border: '1px solid #00ff8850', height: '18px', padding: '0 4px', fontSize: '8px' }}>PRINT REPORT</button>
                    </div>
                  </div>
                  <div className="panel-body chart-panel-body" style={{ padding: '8px' }}>
                    <MultiSvgLineChart
                      data={activeResults.equity_curve}
                      xKey="date"
                      yKeys={['strategy', 'benchmark']}
                      strokeColors={['#00f0ff', '#848e9c']}
                      currency={getCurrencySymbol(market)}
                    />
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
                          <span className={activeResults.summary.cagr >= 0 ? 'price-up' : 'price-down'}>{activeResults.summary.cagr.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Annualized Vol:</span>
                          <span>{activeResults.summary.volatility.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Calmar Ratio:</span>
                          <span>{activeResults.summary.calmar_ratio.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Buy & Hold Return:</span>
                          <span className={activeResults.summary.market_return >= 0 ? 'price-up' : 'price-down'}>{activeResults.summary.market_return.toFixed(2)}%</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="text-secondary text-xxs uppercase fw-700 mb-1" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '2px' }}>Trade Execution Stats</div>
                        <div className="flex justify-between">
                          <span className="text-muted">Profit Factor:</span>
                          <span className="text-white fw-700">{activeResults.summary.profit_factor.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Avg Win Trade:</span>
                          <span className="price-up">+{activeResults.summary.avg_win.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Avg Loss Trade:</span>
                          <span className="price-down">{activeResults.summary.avg_loss.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Best Trade:</span>
                          <span className="price-up">+{activeResults.summary.best_trade.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Worst Trade:</span>
                          <span className="price-down">{activeResults.summary.worst_trade.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trades log table */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">Completed Position History Logs ({activeResults.trades.length} Trades)</span>
                    </div>
                    <div className="panel-body trades-table-panel" style={{ padding: 0 }}>
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
                          {activeResults.trades.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="text-center text-muted" style={{ padding: '16px' }}>
                                No trades executed during this timeframe under strategy conditions.
                              </td>
                            </tr>
                          ) : (
                            activeResults.trades.map((trade, idx) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{trade.entry_date}</td>
                                <td>{trade.exit_date} {trade.is_open && <span className="badge badge-amber text-xxs">OPEN</span>}</td>
                                <td>{getCurrencySymbol(market)}{trade.entry_price.toFixed(2)}</td>
                                <td>{getCurrencySymbol(market)}{trade.exit_price.toFixed(2)}</td>
                                <td className={`text-right trade-profit ${trade.profit >= 0 ? 'price-up' : 'price-down'}`}>
                                  {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}%
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// SVG Multi-Line Chart helper
function MultiSvgLineChart({ data, xKey, yKeys, strokeColors = ['#00f0ff', '#848e9c'], currency = '$' }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 220 });
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      setDimensions({
        width: containerRef.current.clientWidth || 600,
        height: containerRef.current.clientHeight || 220
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

  let allValues = [];
  yKeys.forEach(key => {
    allValues = allValues.concat(data.map(d => parseFloat(d[key]) || 0));
  });

  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yRange = yMax - yMin || 1.0;
  
  const yBoundMin = yMin - yRange * 0.05;
  const yBoundMax = yMax + yRange * 0.05;
  const yBoundRange = yBoundMax - yBoundMin || 1.0;

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

  const gridLines = [];
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const yVal = yBoundMin + (i / gridCount) * yBoundRange;
    const y = padding.top + chartHeight - (i / gridCount) * chartHeight;
    gridLines.push({ y, value: yVal });
  }

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

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div 
      ref={containerRef} 
      className="chart-container-svg"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
      style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
    >
      <svg width={width} height={height}>
        {gridLines.map((line, i) => (
          <g key={i}>
            <line x1={padding.left} y1={line.y} x2={width - padding.right} y2={line.y} stroke="#1f2937" strokeWidth="1" strokeDasharray="4,4" />
            <text x={padding.left - 8} y={line.y + 3} fill="#848e9c" fontSize="8" fontFamily="monospace" textAnchor="end">
              {currency}{line.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        ))}

        {paths.map((p, idx) => (
          <path key={idx} d={p.pathD} fill="none" stroke={p.color} strokeWidth="1.5" />
        ))}

        {xLabels.map((p, i) => (
          <g key={i}>
            <line x1={p.x} y1={padding.top + chartHeight} x2={p.x} y2={padding.top + chartHeight + 4} stroke="#1f2937" />
            <text x={p.x} y={padding.top + chartHeight + 15} fill="#848e9c" fontSize="8" fontFamily="monospace" textAnchor="middle">
              {p.date}
            </text>
          </g>
        ))}

        {hoveredData && paths[0] && (
          <g>
            <line x1={paths[0].points[hoverIndex].x} y1={padding.top} x2={paths[0].points[hoverIndex].x} y2={padding.top + chartHeight} stroke="#4b5563" strokeWidth="1" strokeDasharray="2,2" />
            {paths.map((p, idx) => (
              <circle key={idx} cx={p.points[hoverIndex].x} cy={p.points[hoverIndex].y} r="3" fill={p.color} stroke="#06060c" strokeWidth="1" />
            ))}
            <rect 
              x={paths[0].points[hoverIndex].x > width / 2 ? paths[0].points[hoverIndex].x - 165 : paths[0].points[hoverIndex].x + 15} 
              y={padding.top + 5} 
              width="150" 
              height="45" 
              rx="3" 
              fill="#161622" 
              stroke="#1f2937"
            />
            <text x={paths[0].points[hoverIndex].x > width / 2 ? paths[0].points[hoverIndex].x - 160 : paths[0].points[hoverIndex].x + 20} y={padding.top + 16} fill="#848e9c" fontSize="8" fontFamily="monospace">
              Date: {hoveredData[xKey]}
            </text>
            <text x={paths[0].points[hoverIndex].x > width / 2 ? paths[0].points[hoverIndex].x - 160 : paths[0].points[hoverIndex].x + 20} y={padding.top + 28} fill={strokeColors[0]} fontSize="8" fontFamily="monospace" fontWeight="bold">
              Strategy: {currency}{parseFloat(hoveredData[yKeys[0]]).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </text>
            <text x={paths[0].points[hoverIndex].x > width / 2 ? paths[0].points[hoverIndex].x - 160 : paths[0].points[hoverIndex].x + 20} y={padding.top + 40} fill={strokeColors[1]} fontSize="8" fontFamily="monospace" fontWeight="bold">
              Benchmark: {currency}{parseFloat(hoveredData[yKeys[1]]).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default BacktesterPage;

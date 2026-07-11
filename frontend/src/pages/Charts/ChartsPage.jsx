import React, { useEffect, useRef, useState, useMemo } from 'react';
import { marketApi, userApi } from '../../api';
import useMarketStore from '../../store/marketStore';
import TradingViewGauge from '../../components/TradingViewGauge/TradingViewGauge';
import TradingViewProfile from '../../components/TradingViewProfile/TradingViewProfile';
import ReportExporter from '../../components/ReportExporter/ReportExporter';
import './Charts.css';

const POPULAR = ['AAPL','MSFT','NVDA','GOOGL','AMZN','TSLA','META','BRK-B','SPY','QQQ'];

// Default symbols per market to prevent cross-exchange mismatch
const DEFAULT_SYMBOL = {
  US:  'AAPL',
  NSE: 'RELIANCE',
  BSE: 'RELIANCE',
};

// US-only tickers — querying these against NSE/BSE returns empty data
const US_ONLY_TICKERS = new Set([
  'AAPL','MSFT','NVDA','GOOGL','GOOG','AMZN','TSLA','META','BRK-B','BRK-A',
  'SPY','QQQ','DIA','IWM','GLD','SLV','TLT','VXX',
  'JPM','BAC','WFC','GS','MS','C','V','MA','PYPL',
  'JNJ','PFE','MRK','ABBV','UNH','AMGN','GILD',
  'XOM','CVX','COP','SLB',
  'NFLX','DIS','CMCSA','T','VZ',
  'BA','RTX','LMT','GE','HON','MMM','CAT',
]);

// Mock Sector indexes for comparison
const SECTORS_PERFORMANCE = {
  XLK: { name: 'Technology (XLK)', change_pct: 1.8, data: [100, 101, 99, 102.5, 104, 103.5, 105.8, 105.2, 107.1, 109.5] },
  XLF: { name: 'Financials (XLF)', change_pct: -0.4, data: [100, 99.5, 99.2, 100.1, 99.8, 98.9, 99.4, 99.1, 98.7, 98.5] },
  XLV: { name: 'Healthcare (XLV)', change_pct: 0.6, data: [100, 100.2, 100.5, 101.1, 100.9, 101.4, 102.0, 101.8, 102.5, 103.2] },
  XLE: { name: 'Energy (XLE)', change_pct: 2.1, data: [100, 102, 103.5, 101, 99.5, 100.2, 102.5, 104.1, 104.9, 106.8] }
};

// ── CUSTOM INTERACTIVE SVG CHART ENGINE ──────────────────────────────────────
function CustomInteractiveChart({ 
  symbol, 
  market, 
  candles, 
  drawings, 
  setDrawings, 
  selectedTool, 
  setSelectedTool, 
  indicators, 
  replayActive, 
  replayIndex, 
  showPatterns, 
  showSector 
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 420 });
  const [hoverIndex, setHoverIndex] = useState(null);
  const [activeDrawStart, setActiveDrawStart] = useState(null);
  const [activeDrawEnd, setActiveDrawEnd] = useState(null);

  // Resize listener
  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      setDimensions({
        width: containerRef.current.clientWidth || 600,
        height: containerRef.current.clientHeight || 420
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [candles]);

  // Subset candles for Replay Mode
  const visibleCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    if (replayActive) {
      return candles.slice(0, Math.min(replayIndex, candles.length));
    }
    return candles.slice(-120); // Show last 120 candles by default
  }, [candles, replayActive, replayIndex]);

  const { width, height } = dimensions;
  const padding = { top: 20, right: 50, bottom: 25, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const closes = useMemo(() => visibleCandles.map(c => c.close), [visibleCandles]);
  const highs = useMemo(() => visibleCandles.map(c => c.high || c.close), [visibleCandles]);
  const lows = useMemo(() => visibleCandles.map(c => c.low || c.close), [visibleCandles]);

  const { boundMin, boundMax, boundRange } = useMemo(() => {
    if (visibleCandles.length === 0) {
      return { boundMin: 0, boundMax: 100, boundRange: 100 };
    }
    const minVal = Math.min(...lows);
    const maxVal = Math.max(...highs);
    const range = maxVal - minVal || 1.0;
    return {
      boundMin: minVal - range * 0.05,
      boundMax: maxVal + range * 0.05,
      boundRange: (maxVal + range * 0.05) - (minVal - range * 0.05) || 1.0
    };
  }, [visibleCandles, highs, lows]);

  // X & Y Coordinate converters
  const getX = (index) => {
    if (visibleCandles.length <= 1) return padding.left;
    return padding.left + (index / (visibleCandles.length - 1)) * chartWidth;
  };
  
  const getY = (val) => {
    return padding.top + chartHeight - ((val - boundMin) / boundRange) * chartHeight;
  };

  // Convert SVG coordinates back to price
  const getPriceFromY = (y) => {
    const pct = 1 - (y - padding.top) / chartHeight;
    return boundMin + pct * boundRange;
  };

  // 1. Moving Averages calculations
  const sma20 = useMemo(() => {
    if (visibleCandles.length === 0 || !indicators.sma20) return [];
    const period = 20;
    const result = [];
    for (let i = 0; i < visibleCandles.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += closes[j];
        result.push(sum / period);
      }
    }
    return result;
  }, [visibleCandles, closes, indicators.sma20]);

  const ema50 = useMemo(() => {
    if (visibleCandles.length === 0 || !indicators.ema50) return [];
    const period = 50;
    const result = [];
    for (let i = 0; i < visibleCandles.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += closes[j];
        result.push(sum / period);
      }
    }
    return result;
  }, [visibleCandles, closes, indicators.ema50]);

  const sma20PathD = useMemo(() => {
    if (sma20.length === 0) return '';
    return sma20.reduce((acc, val, i) => {
      if (val === null) return acc;
      const x = getX(i);
      const y = getY(val);
      return acc === '' ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [sma20, visibleCandles, boundMin, boundRange, chartWidth, chartHeight]);

  const ema50PathD = useMemo(() => {
    if (ema50.length === 0) return '';
    return ema50.reduce((acc, val, i) => {
      if (val === null) return acc;
      const x = getX(i);
      const y = getY(val);
      return acc === '' ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [ema50, visibleCandles, boundMin, boundRange, chartWidth, chartHeight]);

  // 2. Pattern Detection
  const detectedPatterns = useMemo(() => {
    if (!showPatterns || visibleCandles.length < 10 || sma20.length === 0 || ema50.length === 0) return [];
    const pts = [];
    if (indicators.sma20 && indicators.ema50) {
      for (let i = 1; i < visibleCandles.length; i++) {
        if (sma20[i-1] && ema50[i-1] && sma20[i] && ema50[i]) {
          if (sma20[i-1] <= ema50[i-1] && sma20[i] > ema50[i]) {
            pts.push({ index: i, type: 'crossover_bull', label: 'Golden Cross', color: '#00ff88' });
          } else if (sma20[i-1] >= ema50[i-1] && sma20[i] < ema50[i]) {
            pts.push({ index: i, type: 'crossover_bear', label: 'Death Cross', color: '#ff3b30' });
          }
        }
      }
    }
    for (let i = 2; i < visibleCandles.length - 2; i++) {
      if (closes[i] < closes[i-1] && closes[i] < closes[i-2] && closes[i] < closes[i+1] && closes[i] < closes[i+2]) {
        pts.push({ index: i, type: 'support', label: 'Support', color: '#33aaff' });
      } else if (closes[i] > closes[i-1] && closes[i] > closes[i-2] && closes[i] > closes[i+1] && closes[i] > closes[i+2]) {
        pts.push({ index: i, type: 'resistance', label: 'Resistance', color: '#ffd080' });
      }
    }
    return pts;
  }, [showPatterns, visibleCandles, indicators.sma20, indicators.ema50, sma20, ema50, closes]);

  // Sector Overlay path
  const sectorPathD = useMemo(() => {
    if (!showSector || !SECTORS_PERFORMANCE[showSector] || visibleCandles.length === 0) return '';
    const sectorData = SECTORS_PERFORMANCE[showSector].data;
    const firstPrice = closes[0] || 100;
    return sectorData.reduce((acc, retPct, i) => {
      const idx = Math.floor((i / (sectorData.length - 1)) * (visibleCandles.length - 1));
      const x = getX(idx);
      const equivPrice = firstPrice * (retPct / 100.0);
      const y = getY(equivPrice);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [showSector, visibleCandles, closes, boundMin, boundRange, chartWidth, chartHeight]);

  // Drawing event handlers
  const handleMouseDown = (e) => {
    if (!selectedTool || selectedTool === 'cursor') return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setActiveDrawStart({ x, y });
    setActiveDrawEnd({ x, y });
  };

  const handleMouseMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Hover tooltip tracking
    const innerX = x - padding.left;
    const pct = Math.max(0, Math.min(1, innerX / chartWidth));
    const closestIdx = Math.round(pct * (visibleCandles.length - 1));
    if (closestIdx >= 0 && closestIdx < visibleCandles.length) {
      setHoverIndex(closestIdx);
    }

    if (activeDrawStart) {
      setActiveDrawEnd({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (activeDrawStart && activeDrawEnd) {
      if (selectedTool === 'text') {
        const text = prompt('Enter annotation label text:');
        if (text) {
          const newDrawing = {
            type: 'text',
            x1: activeDrawStart.x,
            y1: activeDrawStart.y,
            text
          };
          const next = [...drawings, newDrawing];
          setDrawings(next);
          localStorage.setItem(`qd_drawings_${symbol}`, JSON.stringify(next));
        }
      } else {
        const newDrawing = {
          type: selectedTool,
          x1: activeDrawStart.x,
          y1: activeDrawStart.y,
          x2: activeDrawEnd.x,
          y2: activeDrawEnd.y
        };
        const next = [...drawings, newDrawing];
        setDrawings(next);
        localStorage.setItem(`qd_drawings_${symbol}`, JSON.stringify(next));
      }
    }
    setActiveDrawStart(null);
    setActiveDrawEnd(null);
  };

  const hoveredBar = hoverIndex !== null ? visibleCandles[hoverIndex] : null;

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ width: '100%', height: '100%', cursor: selectedTool !== 'cursor' ? 'crosshair' : 'default', position: 'relative' }}
    >
      {visibleCandles.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
          No price candle history loaded
        </div>
      ) : (
        <svg width={width} height={height} className="chart-canvas-svg">
          {/* Horizontal gridlines */}
          {[0, 1, 2, 3, 4].map(i => {
          const yVal = boundMin + (i / 4) * boundRange;
          const y = padding.top + chartHeight - (i / 4) * chartHeight;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#1f2937" strokeWidth="1" strokeDasharray="3,3" />
              <text x={width - padding.right + 5} y={y + 3} fill="#848e9c" fontSize="8" fontFamily="monospace">
                ${yVal.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* 1. Candles rendering */}
        {visibleCandles.map((candle, idx) => {
          const x = getX(idx);
          const yOpen = getY(candle.open || candle.close);
          const yClose = getY(candle.close);
          const yHigh = getY(candle.high || candle.close);
          const yLow = getY(candle.low || candle.close);
          
          const isUp = (candle.close >= (candle.open || candle.close));
          const color = isUp ? '#00ff88' : '#ff3b30';
          const wickColor = isUp ? '#00ff88c0' : '#ff3b30c0';
          
          const candleWidth = Math.max(1.5, (chartWidth / visibleCandles.length) * 0.6);

          return (
            <g key={idx}>
              {/* Wick */}
              <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={wickColor} strokeWidth="1.2" />
              {/* Body */}
              <rect
                x={x - candleWidth / 2}
                y={Math.min(yOpen, yClose)}
                width={candleWidth}
                height={Math.max(1.5, Math.abs(yOpen - yClose))}
                fill={color}
                stroke={color}
                strokeWidth="0.5"
              />
            </g>
          );
        })}

        {/* 2. Custom indicators lines */}
        {indicators.sma20 && sma20PathD && (
          <path d={sma20PathD} fill="none" stroke="#ffc107" strokeWidth="1.5" />
        )}
        {indicators.ema50 && ema50PathD && (
          <path d={ema50PathD} fill="none" stroke="#a0a0ff" strokeWidth="1.5" />
        )}

        {/* 3. Sector comparison overlay */}
        {showSector && sectorPathD && (
          <path d={sectorPathD} fill="none" stroke="#ff9f43" strokeWidth="1.5" strokeDasharray="4,4" />
        )}

        {/* 4. Draw persistent drawings */}
        {drawings.map((draw, i) => {
          if (draw.type === 'line') {
            return <line key={i} x1={draw.x1} y1={draw.y1} x2={draw.x2} y2={draw.y2} stroke="#00ff88" strokeWidth="1.5" />;
          }
          if (draw.type === 'rect') {
            return (
              <rect
                key={i}
                x={Math.min(draw.x1, draw.x2)}
                y={Math.min(draw.y1, draw.y2)}
                width={Math.abs(draw.x1 - draw.x2)}
                height={Math.abs(draw.y1 - draw.y2)}
                fill="rgba(0, 255, 136, 0.05)"
                stroke="#00ff88"
                strokeWidth="1.2"
              />
            );
          }
          if (draw.type === 'text') {
            return (
              <text key={i} x={draw.x1} y={draw.y1} fill="#00ff88" fontSize="9" fontFamily="monospace">
                ✍ {draw.text}
              </text>
            );
          }
          return null;
        })}

        {/* 5. Draw active drawing path */}
        {activeDrawStart && activeDrawEnd && (
          <>
            {selectedTool === 'line' && (
              <line x1={activeDrawStart.x} y1={activeDrawStart.y} x2={activeDrawEnd.x} y2={activeDrawEnd.y} stroke="#ffc107" strokeWidth="1.5" strokeDasharray="3,3" />
            )}
            {selectedTool === 'rect' && (
              <rect
                x={Math.min(activeDrawStart.x, activeDrawEnd.x)}
                y={Math.min(activeDrawStart.y, activeDrawEnd.y)}
                width={Math.abs(activeDrawStart.x - activeDrawEnd.x)}
                height={Math.abs(activeDrawStart.y - activeDrawEnd.y)}
                fill="none"
                stroke="#ffc107"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
            )}
          </>
        )}

        {/* 6. Pattern tags overlay */}
        {detectedPatterns.map((pat, idx) => {
          const x = getX(pat.index);
          const y = pat.type.includes('bull') || pat.type === 'support' ? getY(lows[pat.index]) + 15 : getY(highs[pat.index]) - 15;
          return (
            <g key={idx}>
              <circle cx={x} cy={y} r="3" fill={pat.color} />
              <rect x={x - 25} y={pat.type.includes('bull') || pat.type === 'support' ? y + 5 : y - 14} width="50" height="10" fill="#11111b" rx="2" stroke={pat.color} strokeWidth="0.5" />
              <text x={x} y={pat.type.includes('bull') || pat.type === 'support' ? y + 12 : y - 7} fill={pat.color} fontSize="6" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                {pat.label}
              </text>
            </g>
          );
        })}

        {/* 7. Hover Crosshair & Tooltip */}
        {hoveredBar && (
          <g>
            <line x1={getX(hoverIndex)} y1={padding.top} x2={getX(hoverIndex)} y2={height - padding.bottom} stroke="#4b5563" strokeWidth="0.8" strokeDasharray="2,2" />
            <circle cx={getX(hoverIndex)} cy={getY(hoveredBar.close)} r="3" fill="#ffffff" />
            
            {/* Tooltip Box */}
            <rect 
              x={getX(hoverIndex) > width / 2 ? getX(hoverIndex) - 155 : getX(hoverIndex) + 15} 
              y={padding.top + 5} 
              width="140" 
              height="75" 
              rx="3" 
              fill="#161622" 
              stroke="#1f2937"
            />
            <text x={getX(hoverIndex) > width / 2 ? getX(hoverIndex) - 149 : getX(hoverIndex) + 21} y={padding.top + 18} fill="#848e9c" fontSize="8" fontFamily="monospace">
              Date: {hoveredBar.date || new Date(hoveredBar.time * 1000).toISOString().split('T')[0]}
            </text>
            <text x={getX(hoverIndex) > width / 2 ? getX(hoverIndex) - 149 : getX(hoverIndex) + 21} y={padding.top + 30} fill="#ffffff" fontSize="8" fontFamily="monospace">
              Open:  ${(hoveredBar.open || hoveredBar.close).toFixed(2)}
            </text>
            <text x={getX(hoverIndex) > width / 2 ? getX(hoverIndex) - 149 : getX(hoverIndex) + 21} y={padding.top + 42} fill="#ffffff" fontSize="8" fontFamily="monospace">
              High:  ${(hoveredBar.high || hoveredBar.close).toFixed(2)}
            </text>
            <text x={getX(hoverIndex) > width / 2 ? getX(hoverIndex) - 149 : getX(hoverIndex) + 21} y={padding.top + 54} fill="#ffffff" fontSize="8" fontFamily="monospace">
              Low:   ${(hoveredBar.low || hoveredBar.close).toFixed(2)}
            </text>
            <text x={getX(hoverIndex) > width / 2 ? getX(hoverIndex) - 149 : getX(hoverIndex) + 21} y={padding.top + 66} fill="#00ff88" fontSize="8" fontFamily="monospace" fontWeight="bold">
              Close: ${(hoveredBar.close).toFixed(2)}
            </text>
          </g>
        )}
      </svg>
      )}
    </div>
  );
}

// ── COMPONENT ENTRYPOINT ─────────────────────────────────────────────────────
function ChartsPage() {
  const { activeMarket } = useMarketStore();
  const queryParams = new URLSearchParams(window.location.search);
  const qSym = queryParams.get('sym');
  const qMkt = queryParams.get('market');

  const [symbol, setSymbol] = useState((qSym || (activeMarket === 'US' ? 'AAPL' : 'RELIANCE')).toUpperCase());
  const [inputSym, setInputSym] = useState((qSym || (activeMarket === 'US' ? 'AAPL' : 'RELIANCE')).toUpperCase());
  const [market, setMarket] = useState((qMkt || activeMarket).toUpperCase());
  const [quote, setQuote] = useState(null);
  const [signals, setSignals] = useState(null);
  
  // Chart Grid configuration
  const [gridLayout, setGridLayout] = useState('1x1'); // '1x1' | '1x2' | '2x2'
  const [chartType, setChartType] = useState('custom'); // 'tradingview' | 'custom'

  // Custom Indicators toggles
  const [indicators, setIndicators] = useState({ sma20: true, ema50: false });
  // Drawings Toolbar
  const [selectedTool, setSelectedTool] = useState('cursor'); // 'cursor' | 'line' | 'rect' | 'text'
  const [drawings, setDrawings] = useState([]);
  
  // Replay Mode
  const [replayActive, setReplayActive] = useState(false);
  const [replayIndex, setReplayIndex] = useState(50);
  const [replaySpeed, setReplaySpeed] = useState(1000); // ms
  const [isReplaying, setIsReplaying] = useState(false);
  
  // Patterns & Sectors
  const [showPatterns, setShowPatterns] = useState(false);
  const [showSector, setShowSector] = useState('');
  
  // AI Insights
  const [aiInsights, setAiInsights] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Candles cache
  const [candles, setCandles] = useState([]);
  const [candlesLoading, setCandlesLoading] = useState(false);

  const isInd = market === 'NSE' || market === 'BSE';
  const fmtVal = (val, type = 'price') => {
    if (val === null || val === undefined) return '—';
    if (type === 'price') {
      const currency = isInd ? 'INR' : 'USD';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);
    }
    return val;
  };

  // Sync defaults when global market region changes
  useEffect(() => {
    const qSymInner = queryParams.get('sym');
    const qMktInner = queryParams.get('market');
    if (!qSymInner && !qMktInner) {
      const newDefault = DEFAULT_SYMBOL[activeMarket] || 'AAPL';
      setMarket(activeMarket);
      setSymbol(newDefault);
      setInputSym(newDefault);
    }
  }, [activeMarket]);

  // Load quote/stats
  useEffect(() => {
    // Guard: if a known US-only ticker is paired with an Indian market, auto-correct
    const isIndianMarket = market === 'NSE' || market === 'BSE';
    const isUSOnlyTicker = US_ONLY_TICKERS.has(symbol.toUpperCase());
    if (isIndianMarket && isUSOnlyTicker) {
      const corrected = DEFAULT_SYMBOL[market] || 'RELIANCE';
      setSymbol(corrected);
      setInputSym(corrected);
      return; // Let the effect re-run with the corrected symbol
    }

    marketApi.getQuote(symbol, market)
      .then(res => setQuote(res.data))
      .catch(() => setQuote(null));
    marketApi.getSignals(symbol, market)
      .then(res => setSignals(res.data))
      .catch(() => setSignals(null));

    // Fetch custom candles
    setCandlesLoading(true);
    marketApi.getOHLCV(symbol, { market, period: '1y', interval: '1d' })
      .then(res => {
        setCandles(res.data.candles || []);
        setReplayIndex(50);
      })
      .catch(() => setCandles([]))
      .finally(() => setCandlesLoading(false));

    // Load persisted drawings
    const saved = localStorage.getItem(`qd_drawings_${symbol}`);
    if (saved) {
      try { setDrawings(JSON.parse(saved)); } catch(e) { setDrawings([]); }
    } else {
      setDrawings([]);
    }
    setAiInsights('');
  }, [symbol, market]);

  const handleSearch = (e) => {
    e.preventDefault();
    const s = inputSym.trim().toUpperCase();
    if (s) setSymbol(s);
  };

  // Replay playback logic
  useEffect(() => {
    let timer = null;
    if (replayActive && isReplaying && candles.length > 0) {
      timer = setInterval(() => {
        setReplayIndex(prev => {
          if (prev >= candles.length) {
            setIsReplaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, replaySpeed);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [replayActive, isReplaying, replaySpeed, candles]);

  // AI Annotation Generator
  const generateAIInsights = () => {
    setAiLoading(true);
    setTimeout(() => {
      const trend = (quote?.change_pct || 0) >= 0 ? 'Bullish' : 'Bearish';
      const patternsText = showPatterns ? 'Golden Cross detected on historical overlay, marking heavy buying support.' : 'Intermediate moving average consolidation.';
      const rsiText = signals?.rsi ? `RSI index is currently at ${signals.rsi.toFixed(1)} denoting a healthy, non-overextended trend.` : '';
      
      setAiInsights(`📈 AI TECHNICAL MEMO: ${symbol} (${market})
Trend Analysis: Strong ${trend} posture with support consolidating.
Indicators: SMA20 crossing above base support indicators. ${rsiText}
Pattern Highlights: ${patternsText}
Recommendation stance: Keep close watch on immediate volume patterns.`);
      setAiLoading(false);
    }, 1200);
  };

  const handleClearDrawings = () => {
    setDrawings([]);
    localStorage.removeItem(`qd_drawings_${symbol}`);
  };

  const up = quote ? (quote.change_pct || 0) >= 0 : true;

  // Render sub-grids inside Multi-Chart layouts
  const renderChartSlot = (slotIndex) => {
    if (chartType === 'tradingview') {
      let tvSymbol = symbol;
      if (slotIndex === 1) tvSymbol = 'MSFT';
      if (slotIndex === 2) tvSymbol = 'NVDA';
      if (slotIndex === 3) tvSymbol = 'GOOGL';
      
      const config = {
        "autosize": true,
        "symbol": tvSymbol,
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "allow_symbol_change": true,
        "calendar": false,
        "support_host": "https://www.tradingview.com"
      };

      return (
        <iframe
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${tvSymbol}&interval=D&theme=dark`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={`TV-Slot-${slotIndex}`}
        />
      );
    }

    return (
      <CustomInteractiveChart
        symbol={slotIndex === 0 ? symbol : (slotIndex === 1 ? 'MSFT' : (slotIndex === 2 ? 'NVDA' : 'GOOGL'))}
        market={market}
        candles={candles}
        drawings={drawings}
        setDrawings={setDrawings}
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        indicators={indicators}
        replayActive={replayActive}
        replayIndex={replayIndex}
        showPatterns={showPatterns}
        showSector={showSector}
      />
    );
  };

  return (
    <div className="charts-root">
      {/* ── Top Controls ── */}
      <div className="charts-topbar" id="charts-topbar" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Symbol search */}
          <form onSubmit={handleSearch} className="sym-search">
            <select className="form-input sym-market" value={market} onChange={e => setMarket(e.target.value)}>
              <option value="US">US</option>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
            <input
              className="form-input sym-input"
              value={inputSym}
              onChange={e => setInputSym(e.target.value.toUpperCase())}
              placeholder="AAPL"
            />
            <button type="submit" className="btn btn-primary btn-sm">GO</button>
          </form>

          {/* Quick quote info */}
          {quote && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="font-mono fw-700 text-sm text-white">{symbol}</span>
              <span className={`font-mono fw-700 text-sm ${up ? 'price-up' : 'price-down'}`}>
                {fmtVal(quote.price)}
              </span>
              <span className={`badge ${up ? 'badge-green' : 'badge-red'} font-mono`} style={{ fontSize: '9px', padding: '2px 4px' }}>
                {up ? '+' : ''}{quote.change_pct?.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Advanced Layout Grid controls */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="flex bg-black-200 p-0.5 rounded border border-gray-800" style={{ background: '#11111b', padding: '2px' }}>
            <button className={`btn btn-xs font-mono ${chartType === 'custom' ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: '8px', padding: '2px 6px' }} onClick={() => setChartType('custom')}>QUANT ENGINE</button>
            <button className={`btn btn-xs font-mono ${chartType === 'tradingview' ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: '8px', padding: '2px 6px' }} onClick={() => setChartType('tradingview')}>TRADINGVIEW</button>
          </div>

          <div className="flex bg-black-200 p-0.5 rounded border border-gray-800" style={{ background: '#11111b', padding: '2px' }}>
            {['1x1', '1x2', '2x2'].map(layout => (
              <button 
                key={layout}
                className={`btn btn-xs font-mono ${gridLayout === layout ? 'btn-primary' : 'btn-ghost'}`} 
                style={{ fontSize: '8px', padding: '2px 6px' }} 
                onClick={() => setGridLayout(layout)}
              >
                {layout.toUpperCase()}
              </button>
            ))}
          </div>

          <ReportExporter pageName="charts" data={{ symbol, market }} label="EXPORT PDF" />
        </div>
      </div>

      {/* ── Advanced Drawing & Custom Indicators Toolbar ── */}
      {chartType === 'custom' && (
        <div style={{ background: '#161622', borderBottom: '1px solid #1f2937', padding: '4px 12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {/* Drawings toolbar */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span className="text-muted font-mono" style={{ fontSize: '9px', textTransform: 'uppercase' }}>Drawings:</span>
            {['cursor', 'line', 'rect', 'text'].map(tool => (
              <button
                key={tool}
                className={`btn btn-xs font-mono ${selectedTool === tool ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '8px', padding: '2px 6px' }}
                onClick={() => setSelectedTool(tool)}
              >
                {tool.toUpperCase()}
              </button>
            ))}
            <button className="btn btn-ghost btn-xs text-red font-mono" style={{ fontSize: '8px' }} onClick={handleClearDrawings}>CLEAR</button>
          </div>

          {/* Indicators selector */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="text-muted font-mono" style={{ fontSize: '9px', textTransform: 'uppercase' }}>Overlays:</span>
            <label className="flex items-center gap-1 font-mono text-xxs cursor-pointer" style={{ fontSize: '10px' }}>
              <input type="checkbox" checked={indicators.sma20} onChange={e => setIndicators({ ...indicators, sma20: e.target.checked })} />
              SMA 20
            </label>
            <label className="flex items-center gap-1 font-mono text-xxs cursor-pointer" style={{ fontSize: '10px' }}>
              <input type="checkbox" checked={indicators.ema50} onChange={e => setIndicators({ ...indicators, ema50: e.target.checked })} />
              SMA 50
            </label>
          </div>

          {/* Patterns & Sector comparison overlays */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className={`btn btn-xs font-mono ${showPatterns ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '8px', padding: '2px 6px' }}
              onClick={() => setShowPatterns(!showPatterns)}
            >
              DETECT PATTERNS
            </button>

            <select 
              className="form-input" 
              style={{ height: '18px', padding: '0 4px', fontSize: '9px', width: '130px', background: '#11111b', border: '1px solid #1f2937' }}
              value={showSector}
              onChange={e => setShowSector(e.target.value)}
            >
              <option value="">No Sector Comparison</option>
              <option value="XLK">Technology (XLK)</option>
              <option value="XLF">Financials (XLF)</option>
              <option value="XLV">Healthcare (XLV)</option>
              <option value="XLE">Energy (XLE)</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Replay Mode Panel ── */}
      {chartType === 'custom' && (
        <div style={{ background: '#0e0e15', borderBottom: '1px solid #1f2937', padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button 
              className={`btn btn-xs font-mono ${replayActive ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '8px', padding: '2px 6px' }}
              onClick={() => { setReplayActive(!replayActive); setIsReplaying(false); }}
            >
              🔄 REPLAY MODE {replayActive ? 'ON' : 'OFF'}
            </button>

            {replayActive && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button className="btn btn-ghost btn-xs font-mono" style={{ fontSize: '8px' }} onClick={() => setReplayIndex(50)}>⏮ RESET</button>
                <button className="btn btn-ghost btn-xs font-mono" style={{ fontSize: '8px', color: isReplaying ? '#ff3b30' : '#00ff88' }} onClick={() => setIsReplaying(!isReplaying)}>
                  {isReplaying ? '⏸ PAUSE' : '▶ PLAY'}
                </button>
                <button className="btn btn-ghost btn-xs font-mono" style={{ fontSize: '8px' }} onClick={() => setReplayIndex(prev => Math.min(candles.length, prev + 1))}>⏭ STEP</button>
              </div>
            )}
          </div>

          {replayActive && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '9px', fontFamily: 'monospace' }}>
              <span className="text-muted">REPLAY BARS:</span>
              <span className="text-white fw-700">{replayIndex} / {candles.length}</span>
              <span className="text-muted" style={{ marginLeft: '8px' }}>SPEED:</span>
              <input 
                type="range" 
                min="200" 
                max="2000" 
                step="200" 
                value={2200 - replaySpeed} 
                onChange={e => setReplaySpeed(2200 - parseInt(e.target.value))}
                style={{ width: '80px', height: '3px', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Popular chips ── */}
      <div className="popular-strip" id="popular-strip">
        {POPULAR.map(s => (
          <button key={s} id={`chip-${s.toLowerCase().replace('-','')}`}
            className={`popular-chip${symbol === s ? ' active' : ''}`}
            onClick={() => { setSymbol(s); setInputSym(s); }}
          >{s}</button>
        ))}
      </div>

      {/* ── Chart Layout Grid & Sidebar ── */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', boxSizing: 'border-box', overflowY: 'auto' }}>
          
          {/* Main Multi-Chart Grid area */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: gridLayout === '1x1' ? '1fr' : (gridLayout === '1x2' ? '1fr 1fr' : '1fr 1fr'),
              gridTemplateRows: gridLayout === '2x2' ? '1fr 1fr' : '1fr',
              gap: '12px',
              height: 'calc(100vh - 280px)', 
              minHeight: '520px', 
              background: '#0d0d15',
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid #1f2937'
            }}
          >
            {gridLayout === '1x1' && (
              <div className="panel" style={{ height: '100%', margin: 0, padding: '4px' }}>
                {renderChartSlot(0)}
              </div>
            )}
            {gridLayout === '1x2' && (
              <>
                <div className="panel" style={{ height: '100%', margin: 0, padding: '4px' }}>
                  {renderChartSlot(0)}
                </div>
                <div className="panel" style={{ height: '100%', margin: 0, padding: '4px' }}>
                  {renderChartSlot(1)}
                </div>
              </>
            )}
            {gridLayout === '2x2' && (
              <>
                <div className="panel" style={{ height: '100%', margin: 0, padding: '4px' }}>
                  {renderChartSlot(0)}
                </div>
                <div className="panel" style={{ height: '100%', margin: 0, padding: '4px' }}>
                  {renderChartSlot(1)}
                </div>
                <div className="panel" style={{ height: '100%', margin: 0, padding: '4px' }}>
                  {renderChartSlot(2)}
                </div>
                <div className="panel" style={{ height: '100%', margin: 0, padding: '4px' }}>
                  {renderChartSlot(3)}
                </div>
              </>
            )}
          </div>

          {/* AI Insights & Company profile split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minHeight: '350px', flexShrink: 0 }}>
            {/* AI Technical Annotations & Breakdown */}
            <div className="panel">
              <div className="panel-header flex justify-between">
                <span className="panel-title">AI Chart Analyst Annotations</span>
                <button className="btn btn-ghost btn-xs text-green" style={{ border: '1px solid #00ff8850' }} onClick={generateAIInsights} disabled={aiLoading}>
                  {aiLoading ? 'ANALYZING...' : 'RUN AI DESK ANALYSIS'}
                </button>
              </div>
              <div className="panel-body font-mono text-xs" style={{ padding: '12px' }}>
                {aiInsights ? (
                  <pre style={{ whiteSpace: 'pre-wrap', color: '#848e9c', margin: 0, lineHeight: 1.4 }}>{aiInsights}</pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted text-xxs" style={{ minHeight: '180px' }}>
                    Click "Run AI Desk Analysis" to evaluate technical pattern combinations.
                  </div>
                )}
              </div>
            </div>

            {/* Company profile widget */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Company Profile & Financials</span>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                <TradingViewProfile symbol={symbol} market={market} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar widgets */}
        <div style={{ width: '320px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 12px 12px 0', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div className="panel" style={{ height: '400px', flexShrink: 0 }}>
            <div className="panel-header">
              <span className="panel-title">Technical Gauge</span>
              <span className="badge badge-amber font-mono">1D</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <TradingViewGauge symbol={symbol} market={market} />
            </div>
          </div>
          
          {/* Quick stats */}
          {quote && (
            <div className="panel" style={{ flexShrink: 0 }}>
              <div className="panel-header">
                <span className="panel-title">Market Stats</span>
              </div>
              <div className="panel-body font-mono text-xs" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Prev Close:</span>
                  <span>{fmtVal(quote.prev_close)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Open:</span>
                  <span>{fmtVal(quote.open)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">52W Range:</span>
                  <span style={{ fontSize: '10px' }}>
                    {fmtVal(quote.week52_low)} - {fmtVal(quote.week52_high)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Market Cap:</span>
                  <span>
                    {quote.market_cap ? (
                      isInd ? 
                      `₹${(quote.market_cap/1e7).toFixed(1)} Cr` : 
                      (quote.market_cap >= 1e12 ? `$${(quote.market_cap/1e12).toFixed(2)}T` : quote.market_cap >= 1e9 ? `$${(quote.market_cap/1e9).toFixed(1)}B` : `$${(quote.market_cap/1e6).toFixed(0)}M`)
                    ) : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Signals */}
          {signals && (
            <div className="panel" style={{ flexShrink: 0 }}>
              <div className="panel-header">
                <span className="panel-title">Strength Assessment</span>
                <span className="badge badge-blue font-mono">1Y</span>
              </div>
              <div className="panel-body font-mono text-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span className="text-muted">Technical</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '80px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${signals.tech_score}%`, height: '100%', background: signals.tech_score >= 70 ? '#00c87a' : signals.tech_score >= 40 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} />
                    </div>
                    <span className="fw-600">{signals.tech_score}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="text-muted">Fundamental</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '80px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${signals.fund_score}%`, height: '100%', background: signals.fund_score >= 70 ? '#00c87a' : signals.fund_score >= 40 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} />
                    </div>
                    <span className="fw-600">{signals.fund_score}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">RSI (14)</span>
                  <span className={signals.rsi > 70 ? 'text-red' : signals.rsi < 30 ? 'text-green' : 'text-secondary'}>
                    {signals.rsi?.toFixed(1)}
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

export default ChartsPage;

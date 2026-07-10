import React, { useEffect, useRef, useState } from 'react';
import { marketApi, userApi } from '../../api';
import TradingViewGauge from '../../components/TradingViewGauge/TradingViewGauge';
import TradingViewProfile from '../../components/TradingViewProfile/TradingViewProfile';
import ReportExporter from '../../components/ReportExporter/ReportExporter';
import './Charts.css';

const POPULAR = ['AAPL','MSFT','NVDA','GOOGL','AMZN','TSLA','META','BRK-B','SPY','QQQ'];

import TradingViewIFrameWidget from '../../components/TradingViewIFrameWidget';

// TradingView embed widget component
function TradingViewChart({ symbol, market }) {
  // Convert symbol for TradingView format
  let tvSymbol = symbol;
  if (market === "NSE" || market === "BSE" || symbol.endsWith(".NS") || symbol.endsWith(".BO")) {
    const clean = symbol.replace('.NS', '').replace('.BO', '');
    tvSymbol = `${market === "BSE" ? "BSE" : "NSE"}:${clean}`;
  } else {
    if (!symbol.includes(':')) {
      tvSymbol = symbol;
    }
  }

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
    <div style={{ height: "100%", width: "100%" }}>
      <TradingViewIFrameWidget
        scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
        config={config}
        height="100%"
      />
    </div>
  );
}


function ChartsPage() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialSym = (queryParams.get('sym') || 'RELIANCE').toUpperCase();
  const initialMkt = (queryParams.get('market') || 'NSE').toUpperCase();

  const [symbol, setSymbol] = useState(initialSym);
  const [inputSym, setInputSym] = useState(initialSym);
  const [market, setMarket] = useState(initialMkt);
  const [quote, setQuote] = useState(null);

  // Load User settings to set default market region if not specified in URL query
  useEffect(() => {
    const qSym = queryParams.get('sym');
    const qMkt = queryParams.get('market');
    if (!qSym && !qMkt) {
      userApi.getSettings()
        .then(res => {
          if (res.data?.default_market) {
            const m = res.data.default_market === 'IN' ? 'NSE' : res.data.default_market;
            setMarket(m);
            if (m === 'NSE' || m === 'BSE') {
              setSymbol('RELIANCE');
              setInputSym('RELIANCE');
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  // Sync state if URL query changes
  useEffect(() => {
    const qSym = queryParams.get('sym');
    const qMkt = queryParams.get('market');
    if (qSym && qSym.toUpperCase() !== symbol) {
      setSymbol(qSym.toUpperCase());
      setInputSym(qSym.toUpperCase());
    }
    if (qMkt && qMkt.toUpperCase() !== market) {
      setMarket(qMkt.toUpperCase());
    }
  }, [window.location.search]);

  // Fetch quick quote strip on symbol change
  useEffect(() => {
    marketApi.getQuote(symbol, market)
      .then(res => setQuote(res.data))
      .catch(() => setQuote(null));
  }, [symbol, market]);

  const handleSearch = (e) => {
    e.preventDefault();
    const s = inputSym.trim().toUpperCase();
    if (s) setSymbol(s);
  };

  const up = quote ? (quote.change_pct || 0) >= 0 : true;

  return (
    <div className="charts-root">
      {/* ── Top Controls ── */}
      <div className="charts-topbar" id="charts-topbar">
        {/* Symbol search */}
        <form id="symbol-search-form" onSubmit={handleSearch} className="sym-search">
          <select id="select-market" className="form-input sym-market" value={market}
            onChange={e => setMarket(e.target.value)}>
            <option value="US">US</option>
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
          <input
            id="input-symbol"
            className="form-input sym-input"
            value={inputSym}
            onChange={e => setInputSym(e.target.value.toUpperCase())}
            placeholder="AAPL"
          />
          <button id="btn-go" type="submit" className="btn btn-primary btn-sm">GO</button>
        </form>

        {/* Quote info */}
        {quote && (
          <div className="charts-quote-strip" id="quote-strip">
            <span className="font-mono fw-700 text-lg">{symbol}</span>
            <span className={`font-mono fw-700 text-xl ${up ? 'price-up' : 'price-down'}`}>
              ${quote.price?.toFixed(2)}
            </span>
            <span className={`badge ${up ? 'badge-green' : 'badge-red'} font-mono`}>
              {up ? '+' : ''}{quote.change?.toFixed(2)} ({up ? '+' : ''}{quote.change_pct?.toFixed(2)}%)
            </span>
            <span className="text-muted font-mono text-xs">
              H: {quote.day_high?.toFixed(2)} · L: {quote.day_low?.toFixed(2)} · Vol: {
                quote.volume >= 1e6 ? `${(quote.volume/1e6).toFixed(1)}M` : `${(quote.volume/1e3).toFixed(0)}K`
              }
            </span>
            <span style={{ marginLeft: '12px' }}>
              <ReportExporter pageName="charts" data={{ symbol, market }} label="EXPORT PDF" />
            </span>
          </div>
        )}
      </div>

      {/* ── Popular chips ── */}
      <div className="popular-strip" id="popular-strip">
        {POPULAR.map(s => (
          <button key={s} id={`chip-${s.toLowerCase().replace('-','')}`}
            className={`popular-chip${symbol === s ? ' active' : ''}`}
            onClick={() => { setSymbol(s); setInputSym(s); }}
          >{s}</button>
        ))}
      </div>

      {/* ── Chart & Sidebar Layout ── */}
      <div className="chart-main-layout" style={{ display: 'flex', flexGrow: 1, gap: '12px', padding: '12px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div className="chart-left-column" style={{ flexGrow: 1, flexShrink: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="chart-wrap" style={{ height: 'calc(100vh - 200px)', minHeight: '650px', position: 'relative', flexShrink: 0 }}>
            <TradingViewChart symbol={symbol} market={market} />
          </div>
          <div className="panel" style={{ height: '400px', flexShrink: 0 }}>
            <div className="panel-header">
              <span className="panel-title">Company Profile & Financials</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <TradingViewProfile symbol={symbol} market={market} />
            </div>
          </div>
        </div>
        
        <div className="chart-sidebar" style={{ width: '320px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
          <div className="panel" style={{ height: '440px', flexShrink: 0 }}>
            <div className="panel-header">
              <span className="panel-title">Technical Gauge</span>
              <span className="badge badge-amber font-mono">1D</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <TradingViewGauge symbol={symbol} market={market} />
            </div>
          </div>
          
          {/* Quick info panel */}
          {quote && (
            <div className="panel" style={{ flexGrow: 1, flexShrink: 0 }}>
              <div className="panel-header">
                <span className="panel-title">Market Stats</span>
              </div>
              <div className="panel-body font-mono text-xs" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Prev Close:</span>
                  <span>${quote.prev_close?.toFixed(2) || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Open:</span>
                  <span>${quote.open?.toFixed(2) || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">52W Range:</span>
                  <span style={{ fontSize: '10px' }}>
                    ${quote.week52_low?.toFixed(2) || '—'} - ${quote.week52_high?.toFixed(2) || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Market Cap:</span>
                  <span>
                    {quote.market_cap ? (quote.market_cap >= 1e12 ? `$${(quote.market_cap/1e12).toFixed(2)}T` : quote.market_cap >= 1e9 ? `$${(quote.market_cap/1e9).toFixed(1)}B` : `$${(quote.market_cap/1e6).toFixed(0)}M`) : '—'}
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

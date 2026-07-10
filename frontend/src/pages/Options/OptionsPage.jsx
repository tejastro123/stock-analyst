import React, { useEffect, useState } from 'react';
import { marketApi, userApi } from '../../api';
import ReportExporter from '../../components/ReportExporter/ReportExporter';
import './Options.css';

// Cumulative normal distribution function helper
function cnd(x) {
  const a1 = 0.319381530;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const L = Math.abs(x);
  const k = 1.0 / (1.0 + 0.2316419 * L);
  let cndVal = 1.0 - 1.0 / Math.sqrt(2.0 * Math.PI) * Math.exp(-L * L / 2.0) * 
            (a1 * k + a2 * k * k + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));
  if (x < 0) {
    cndVal = 1.0 - cndVal;
  }
  return cndVal;
}

// Probability density function helper
function pdf(x) {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

// Calculate Black-Scholes Greeks
// S: Stock Price, K: Strike Price, T: Time to Expiry (years), r: Risk-free rate, v: Implied Volatility
function calculateGreeks(S, K, T, r, v, type) {
  if (!v || v <= 0 || !T || T <= 0 || !S || S <= 0 || !K || K <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }
  try {
    const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);

    let delta = 0;
    let theta = 0;
    if (type === 'call') {
      delta = cnd(d1);
      theta = -(S * pdf(d1) * v) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cnd(d2);
    } else {
      delta = cnd(d1) - 1.0;
      theta = -(S * pdf(d1) * v) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cnd(-d2);
    }

    const gamma = pdf(d1) / (S * v * Math.sqrt(T));
    const vega = S * Math.sqrt(T) * pdf(d1) / 100; // divided by 100 for 1% IV change
    theta = theta / 365; // Daily decay

    return {
      delta,
      gamma,
      theta,
      vega
    };
  } catch (err) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }
}

function OptionsPage() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [inputSym, setInputSym] = useState('RELIANCE');
  const [market, setMarket] = useState('NSE');
  const [expiry, setExpiry] = useState('');
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOptionsChain = async (sym, mkt, exp) => {
    if (!sym) return;
    try {
      setLoading(true);
      setError('');
      const res = await marketApi.getOptions(sym, mkt, exp);
      setData(res.data);
      if (res.data.expiry) {
        setExpiry(res.data.expiry);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to fetch options chain. Please check the symbol.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    fetchOptionsChain(symbol, market, null);
  }, [symbol, market]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputSym) {
      setSymbol(inputSym.toUpperCase());
    }
  };

  const handleExpiryChange = (e) => {
    const chosen = e.target.value;
    setExpiry(chosen);
    fetchOptionsChain(symbol, market, chosen);
  };

  // Pre-calculate greeks for calls & puts and match them by strike
  const processChainData = () => {
    if (!data) return [];
    const stockPrice = data.price;
    if (!stockPrice) return [];

    // Calculate time to expiry in years
    const expiryDate = new Date(data.expiry);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const T = Math.max(0.0001, diffTime / (1000 * 60 * 60 * 24 * 365));
    const r = 0.045; // 4.5% risk free rate

    const strikeMap = {};

    const processOpt = (opt, type) => {
      const strike = opt.strike;
      if (!strikeMap[strike]) {
        strikeMap[strike] = { strike, call: null, put: null };
      }
      
      const greeks = calculateGreeks(stockPrice, strike, T, r, opt.impliedVol, type);
      strikeMap[strike][type] = {
        ...opt,
        greeks
      };
    };

    data.calls.forEach(c => processOpt(c, 'call'));
    data.puts.forEach(p => processOpt(p, 'put'));

    // Sort strikes ascending
    return Object.values(strikeMap).sort((a, b) => a.strike - b.strike);
  };

  const rows = processChainData();

  const fmtNum = (val, dec = 2) => {
    if (val === null || val === undefined) return '—';
    return val.toFixed(dec);
  };

  const fmtInt = (val) => {
    if (val === null || val === undefined) return '—';
    return val.toLocaleString();
  };

  const fmtPct = (val) => {
    if (val === null || val === undefined) return '—';
    return `${(val * 100).toFixed(1)}%`;
  };

  return (
    <div className="options-root">
      {/* Search Header */}
      <div className="options-controls-bar">
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="panel-title">OPTIONS DECK</span>
          <input
            className="form-input"
            style={{ width: 100, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
            placeholder="SYMBOL"
            value={inputSym}
            onChange={e => setInputSym(e.target.value)}
          />
          <select className="form-input" value={market} onChange={e => setMarket(e.target.value)}>
            <option value="US">🇺🇸 US</option>
            <option value="NSE">🇮🇳 NSE India</option>
          </select>
          <button type="submit" className="btn btn-primary btn-sm">LOAD</button>
          {data && <ReportExporter pageName="options" data={{ symbol, expiry, chain: rows }} label="EXPORT PDF" />}
        </form>

        {data && (
          <div className="flex gap-4 font-mono text-xs items-center">
            <div>
              <span className="text-muted">EXPIRY:</span>
              <select className="form-input expiry-select" value={expiry} onChange={handleExpiryChange} style={{ marginLeft: 8 }}>
                {data.expirations.map(exp => (
                  <option key={exp} value={exp}>{exp}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-muted">STOCK PRICE:</span>
              <span className="text-accent fw-600" style={{ marginLeft: 6 }}>
                ${data.price ? data.price.toFixed(2) : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && <div className="options-error">⚠ {error}</div>}

      {/* Main Chain Grid */}
      <div className="options-chain-panel">
        <div className="panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <div className="options-loading">
              <span className="spinner" />
              <span className="font-mono text-xs text-muted">Calculating Black-Scholes Greeks...</span>
            </div>
          ) : !data ? (
            <div className="options-empty font-mono">
              <div className="icon font-mono">⬡</div>
              <div className="text-secondary text-sm">No options chain loaded</div>
              <div className="text-xs text-muted">Enter a symbol and click LOAD</div>
            </div>
          ) : (
            <div className="options-table-wrap">
              <table className="options-table font-mono text-xs">
                <thead>
                  {/* Category Headers */}
                  <tr className="category-header">
                    <th colSpan="8" style={{ textAlign: 'center', background: 'rgba(0,200,100,0.05)', borderRight: '2px solid var(--border-primary)' }}>CALLS</th>
                    <th style={{ textAlign: 'center', background: 'var(--bg-tertiary)', borderRight: '2px solid var(--border-primary)' }}>STRIKE</th>
                    <th colSpan="8" style={{ textAlign: 'center', background: 'rgba(255,68,102,0.05)' }}>PUTS</th>
                  </tr>
                  {/* Column Headers */}
                  <tr>
                    {/* CALLS */}
                    <th title="Delta">Δ</th>
                    <th title="Gamma">Γ</th>
                    <th title="Theta">Θ</th>
                    <th title="Vega">V</th>
                    <th>IV</th>
                    <th>BID</th>
                    <th>ASK</th>
                    <th style={{ borderRight: '2px solid var(--border-primary)' }}>LAST</th>
                    
                    {/* STRIKE */}
                    <th style={{ textAlign: 'center', borderRight: '2px solid var(--border-primary)' }}>STRIKE</th>
                    
                    {/* PUTS */}
                    <th>LAST</th>
                    <th>BID</th>
                    <th>ASK</th>
                    <th>IV</th>
                    <th title="Delta">Δ</th>
                    <th title="Gamma">Γ</th>
                    <th title="Theta">Θ</th>
                    <th title="Vega">V</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const c = row.call;
                    const p = row.put;
                    const isITMCall = c && c.inTheMoney;
                    const isITMPut = p && p.inTheMoney;

                    return (
                      <tr key={row.strike} className="options-row">
                        {/* CALLS */}
                        {c ? (
                          <>
                            <td className={`font-mono text-secondary ${isITMCall ? 'itm-highlight' : ''}`}>{fmtNum(c.greeks.delta)}</td>
                            <td className={`font-mono text-secondary ${isITMCall ? 'itm-highlight' : ''}`}>{fmtNum(c.greeks.gamma, 3)}</td>
                            <td className={`font-mono text-secondary ${isITMCall ? 'itm-highlight' : ''}`}>{fmtNum(c.greeks.theta)}</td>
                            <td className={`font-mono text-secondary ${isITMCall ? 'itm-highlight' : ''}`}>{fmtNum(c.greeks.vega)}</td>
                            <td className={`font-mono text-muted ${isITMCall ? 'itm-highlight' : ''}`}>{fmtPct(c.impliedVol)}</td>
                            <td className={`font-mono ${isITMCall ? 'itm-highlight' : ''}`}>{fmtNum(c.bid)}</td>
                            <td className={`font-mono ${isITMCall ? 'itm-highlight' : ''}`}>{fmtNum(c.ask)}</td>
                            <td className={`font-mono fw-600 text-green ${isITMCall ? 'itm-highlight' : ''}`} style={{ borderRight: '2px solid var(--border-primary)' }}>
                              {fmtNum(c.lastPrice)}
                            </td>
                          </>
                        ) : (
                          <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', borderRight: '2px solid var(--border-primary)' }}>—</td>
                        )}

                        {/* STRIKE */}
                        <td className="strike-cell fw-700" style={{ textAlign: 'center', borderRight: '2px solid var(--border-primary)' }}>
                          {row.strike.toFixed(1)}
                        </td>

                        {/* PUTS */}
                        {p ? (
                          <>
                            <td className={`font-mono fw-600 text-red ${isITMPut ? 'itm-highlight' : ''}`}>{fmtNum(p.lastPrice)}</td>
                            <td className={`font-mono ${isITMPut ? 'itm-highlight' : ''}`}>{fmtNum(p.bid)}</td>
                            <td className={`font-mono ${isITMPut ? 'itm-highlight' : ''}`}>{fmtNum(p.ask)}</td>
                            <td className={`font-mono text-muted ${isITMPut ? 'itm-highlight' : ''}`}>{fmtPct(p.impliedVol)}</td>
                            <td className={`font-mono text-secondary ${isITMPut ? 'itm-highlight' : ''}`}>{fmtNum(p.greeks.delta)}</td>
                            <td className={`font-mono text-secondary ${isITMPut ? 'itm-highlight' : ''}`}>{fmtNum(p.greeks.gamma, 3)}</td>
                            <td className={`font-mono text-secondary ${isITMPut ? 'itm-highlight' : ''}`}>{fmtNum(p.greeks.theta)}</td>
                            <td className={`font-mono text-secondary ${isITMPut ? 'itm-highlight' : ''}`}>{fmtNum(p.greeks.vega)}</td>
                          </>
                        ) : (
                          <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OptionsPage;

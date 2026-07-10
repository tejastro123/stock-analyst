import React, { useState, useEffect, useRef } from 'react';
import { reportsApi, portfolioApi } from '../../api';
import MarkdownRenderer from '../../components/MarkdownRenderer/MarkdownRenderer';
import './Research.css';

const API_BASE_URL = 'http://localhost:3001/api';

function ResearchPage() {
  const [selectedTool, setSelectedTool] = useState('copilot'); // 'copilot' | 'equity' | 'sentiment' | 'portfolio' | 'risk'
  const [ollamaStatus, setOllamaStatus] = useState({ online: false, model: 'mistral' });
  const [inputVal, setInputVal] = useState('');
  const [ticker, setTicker] = useState('AAPL');
  const [market, setMarket] = useState('US');
  const [assetType, setAssetType] = useState('stock'); // 'stock' | 'etf' | 'crypto' | 'option' | 'forex'
  const [streamedOutput, setStreamedOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const outputEndRef = useRef(null);

  const getTickerPlaceholder = () => {
    switch (assetType) {
      case 'etf': return 'e.g. SPY';
      case 'crypto': return 'e.g. BTC-USD';
      case 'option': return 'e.g. AAPL260716C00150000';
      case 'forex': return 'e.g. EURUSD=X';
      default: return 'e.g. AAPL';
    }
  };

  // Check Ollama status on load
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const token = localStorage.getItem('qd_access_token');
        const res = await fetch(`${API_BASE_URL}/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: 'ping', test: true })
        });
        if (res.status === 200) {
          setOllamaStatus({ online: true, model: 'mistral' });
        }
      } catch (err) {
        setOllamaStatus({ online: false, model: 'offline' });
      }
    };
    checkStatus();
  }, []);

  // Scroll to bottom of output during streaming
  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamedOutput]);

  const handleStreamRequest = async (endpoint, body) => {
    setStreaming(true);
    setStreamedOutput('');
    setError('');
    const token = localStorage.getItem('qd_access_token');

    try {
      const response = await fetch(`${API_BASE_URL}/ai/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
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
                  setStreamedOutput(textBuffer);
                }
              } catch (e) {
                // Ignore parsing errors for incomplete lines
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError(`Failed to retrieve AI analysis stream: ${err.message}`);
    } finally {
      setStreaming(false);
    }
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    handleStreamRequest('chat', { message: inputVal });
    setInputVal('');
  };

  const handleEquitySubmit = (e) => {
    e.preventDefault();
    if (!ticker) return;
    handleStreamRequest('analyze', { symbol: ticker.toUpperCase(), assetType, market });
  };

  const handleSentimentSubmit = (e) => {
    e.preventDefault();
    if (!ticker) return;
    handleStreamRequest('news-sentiment', { symbol: ticker.toUpperCase(), market });
  };

  const handlePortfolioSubmit = () => {
    handleStreamRequest('portfolio-review', {});
  };

  const handleRiskSubmit = async () => {
    try {
      // First fetch current portfolio details to feed metrics into prompt
      const token = localStorage.getItem('qd_access_token');
      const portRes = await fetch(`${API_BASE_URL}/portfolio`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const portData = await portRes.json();
      
      const risk = portData?.summary?.risk_analytics || { portfolio_beta: 1.0, daily_volatility: 1.0, value_at_risk: 0.0 };
      const totalVal = portData?.summary?.total_value || 0;

      handleStreamRequest('risk-advisor', {
        portfolioBeta: risk.portfolio_beta,
        dailyVolatility: risk.daily_volatility,
        valueAtRisk: risk.value_at_risk,
        totalValue: totalVal
      });
    } catch (err) {
      setError('Failed to fetch portfolio metrics for risk advisor.');
    }
  };

  const handleExportPDF = async () => {
    if (!streamedOutput) return;

    try {
      setError('');
      // Parse markdown to HTML format
      const formattedContent = streamedOutput
        .replace(/^# (.*$)/gim, '<h1 class="section-title">$1</h1>')
        .replace(/^## (.*$)/gim, '<h3>$1</h3>')
        .replace(/^### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');

      const title = selectedTool === 'equity' 
        ? `${assetType.toUpperCase()} Report: ${ticker.toUpperCase()}`
        : selectedTool === 'sentiment'
        ? `Sentiment Deck: ${ticker.toUpperCase()}`
        : selectedTool === 'portfolio'
        ? 'Portfolio Strategic Review'
        : selectedTool === 'risk'
        ? 'Quantitative Risk Analysis'
        : 'AI Copilot Research Note';

      const res = await reportsApi.exportPdf({
        title,
        subtitle: `Ollama ${ollamaStatus.model.toUpperCase()} Engine`,
        contentHtml: `<div class="section">${formattedContent}</div>`
      });

      // Check if backend returned fallback JSON or binary PDF
      if (res.data instanceof Blob && res.data.type === 'application/pdf') {
        const file = new Blob([res.data], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = fileURL;
        link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        // Parse blob response as text to see if there's an error fallback
        const text = await res.data.text();
        const parsed = JSON.parse(text);
        if (parsed.fallback) {
          setError('PDF Server fallback: opening browser print window.');
          window.print();
        }
      }
    } catch (err) {
      console.error(err);
      setError('PDF export failed. Triggering browser print layout...');
      window.print();
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(streamedOutput);
    alert('Copied to clipboard!');
  };

  return (
    <div className="research-root">
      {/* ── Left Sidebar Panel ── */}
      <div className="research-sidebar">
        <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <span className="panel-title">AI Research Deck</span>
            <span className={`badge ${ollamaStatus.online ? 'badge-green' : 'badge-red'} font-mono`}>
              {ollamaStatus.online ? 'OLLAMA ACTIVE' : 'SIMULATED'}
            </span>
          </div>

          <div className="panel-body flex flex-col gap-2" style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
            {/* Tool Selection Buttons */}
            <div className="tool-list flex flex-col gap-1">
              <button 
                className={`tool-btn ${selectedTool === 'copilot' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('copilot'); setStreamedOutput(''); }}
              >
                <span className="tool-title">💬 Market Copilot</span>
                <span className="tool-desc">Multipurpose general research assistant</span>
              </button>

              <button 
                className={`tool-btn ${selectedTool === 'equity' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('equity'); setStreamedOutput(''); }}
              >
                <span className="tool-title">📊 Asset Researcher</span>
                <span className="tool-desc">Stock, ETF, Crypto, F&O, Forex reports</span>
              </button>

              <button 
                className={`tool-btn ${selectedTool === 'sentiment' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('sentiment'); setStreamedOutput(''); }}
              >
                <span className="tool-title">📰 Sentiment Analyzer</span>
                <span className="tool-desc">Aggregated headlines sentiment score</span>
              </button>

              <button 
                className={`tool-btn ${selectedTool === 'portfolio' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('portfolio'); setStreamedOutput(''); }}
              >
                <span className="tool-title">💼 Portfolio Advisor</span>
                <span className="tool-desc">Allocation reviews and rebalancing advice</span>
              </button>

              <button 
                className={`tool-btn ${selectedTool === 'risk' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('risk'); setStreamedOutput(''); }}
              >
                <span className="tool-title">🛡️ Risk Advisor</span>
                <span className="tool-desc">VaR breakdown & concrete hedging strategy</span>
              </button>
            </div>

            <hr className="divider" />

            {/* Inputs Box based on selected tool */}
            <div className="tool-inputs font-mono text-xs">
              {selectedTool === 'copilot' && (
                <form onSubmit={handleChatSubmit} className="flex flex-col gap-2">
                  <label className="text-muted uppercase fw-600 font-mono text-xxs">Ask AI Assistant</label>
                  <textarea 
                    className="form-input" 
                    rows="3" 
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    placeholder="Enter query (e.g. explain Black-Scholes Greeks, or analyze inflation impacts)..."
                    disabled={streaming}
                    required
                  />
                  <button type="submit" className="btn btn-primary" disabled={streaming}>
                    {streaming ? 'PROCESSING...' : 'ASK COPILOT'}
                  </button>
                </form>
              )}

              {selectedTool === 'equity' && (
                <form onSubmit={handleEquitySubmit} className="flex flex-col gap-2">
                  <div className="form-field">
                    <label className="text-muted uppercase fw-600 font-mono text-xxs">Asset Class</label>
                    <select 
                      className="form-input" 
                      value={assetType} 
                      onChange={e => {
                        setAssetType(e.target.value);
                        if (e.target.value === 'etf') setTicker('SPY');
                        else if (e.target.value === 'crypto') setTicker('BTC-USD');
                        else if (e.target.value === 'option') setTicker('AAPL260716C00150000');
                        else if (e.target.value === 'forex') setTicker('EURUSD=X');
                        else setTicker('AAPL');
                      }}
                      disabled={streaming}
                    >
                      <option value="stock">📈 Stocks / Equities</option>
                      <option value="etf">📦 ETFs (Exchange Traded Funds)</option>
                      <option value="crypto">🪙 Cryptocurrencies</option>
                      <option value="option">📉 Options (F&O Contracts)</option>
                      <option value="forex">💱 Forex Currency Pairs</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 font-mono text-xxs">Symbol / Contract</label>
                      <input 
                        className="form-input" 
                        value={ticker} 
                        onChange={e => setTicker(e.target.value)} 
                        placeholder={getTickerPlaceholder()}
                        required 
                        disabled={streaming}
                      />
                    </div>
                    {(assetType === 'stock' || assetType === 'etf') && (
                      <div className="form-field" style={{ width: '80px' }}>
                        <label className="text-muted uppercase fw-600 font-mono text-xxs">Market</label>
                        <select className="form-input" value={market} onChange={e => setMarket(e.target.value)} disabled={streaming}>
                          <option value="US">🇺🇸 US</option>
                          <option value="NSE">🇮🇳 NSE</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={streaming}>
                    {streaming ? 'GENERATING REPORT...' : 'GENERATE DETAILED REPORT'}
                  </button>
                </form>
              )}

              {selectedTool === 'sentiment' && (
                <form onSubmit={handleSentimentSubmit} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 font-mono text-xxs">Ticker Symbol</label>
                      <input 
                        className="form-input" 
                        value={ticker} 
                        onChange={e => setTicker(e.target.value)} 
                        placeholder="AAPL" 
                        required 
                        disabled={streaming}
                      />
                    </div>
                    <div className="form-field" style={{ width: '80px' }}>
                      <label className="text-muted uppercase fw-600 font-mono text-xxs">Market</label>
                      <select className="form-input" value={market} onChange={e => setMarket(e.target.value)} disabled={streaming}>
                        <option value="US">🇺🇸 US</option>
                        <option value="NSE">🇮🇳 NSE</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={streaming}>
                    {streaming ? 'ANALYZING NEWS...' : 'ANALYZE SENTIMENT'}
                  </button>
                </form>
              )}

              {selectedTool === 'portfolio' && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted font-mono text-xxs uppercase">Review portfolio metrics</span>
                  <p className="text-muted text-xxs">
                    Reads open positions directly from database, evaluates asset weights, and drafts rebalancing steps.
                  </p>
                  <button onClick={handlePortfolioSubmit} className="btn btn-primary" disabled={streaming}>
                    {streaming ? 'RUNNING STRATEGIC AUDIT...' : 'START PORTFOLIO AUDIT'}
                  </button>
                </div>
              )}

              {selectedTool === 'risk' && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted font-mono text-xxs uppercase">Run tail risk advisory</span>
                  <p className="text-muted text-xxs">
                    Computes portfolio beta, daily volatility, and 95% VaR, drafting concrete hedging strategies.
                  </p>
                  <button onClick={handleRiskSubmit} className="btn btn-primary" disabled={streaming}>
                    {streaming ? 'RUNNING RISK ADVISORY...' : 'START RISK ADVISORY'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Output Terminal ── */}
      <div className="research-main">
        <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="panel-title font-mono text-xs">Research Terminal Output</span>
            <div className="flex gap-2">
              {streamedOutput && (
                <>
                  <button onClick={handleCopyToClipboard} className="btn btn-ghost btn-sm font-mono">COPY</button>
                  <button onClick={handleExportPDF} className="btn btn-ghost btn-sm font-mono text-green">EXPORT PDF</button>
                </>
              )}
            </div>
          </div>

          <div className="panel-body research-output-container font-mono text-xs">
            {error && <div className="research-error">⚠ {error}</div>}
            
            {!streamedOutput && !streaming ? (
              <div className="research-welcome">
                <div className="logo-glowing">Q</div>
                <div className="text-secondary text-sm">Ollama AI Research Workspace</div>
                <div className="text-xs text-muted" style={{ maxWidth: '400px', textAlign: 'center', marginTop: 8 }}>
                  Select an AI analytical engine from the left panel and click run to stream professional institutional investment reports.
                </div>
              </div>
            ) : (
              <div className="research-streamed-text">
                {/* Print layout headers */}
                <div className="print-only" style={{ borderBottom: '2px solid #00ff88', paddingBottom: '10px', marginBottom: '20px' }}>
                  <h1 style={{ color: '#00ff88', margin: 0 }}>QUANTDESK STRATEGIC REPORT</h1>
                  <span style={{ fontSize: '10px', color: '#848e9c' }}>Generated: {new Date().toLocaleString()}</span>
                </div>
                
                {streamedOutput ? (
                  <MarkdownRenderer content={streamedOutput} />
                ) : null}
                {streaming && <span className="stream-cursor">▋</span>}
                <div ref={outputEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResearchPage;

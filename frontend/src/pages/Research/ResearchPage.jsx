import React, { useState, useEffect, useRef } from 'react';
import { reportsApi, portfolioApi } from '../../api';
import MarkdownRenderer from '../../components/MarkdownRenderer/MarkdownRenderer';
import './Research.css';

const API_BASE_URL = 'http://localhost:3001/api';

function ResearchPage() {
  const [selectedTool, setSelectedTool] = useState('research'); // 'research' | 'technical' | 'news' | 'portfolio' | 'options' | 'copilot'
  const [ollamaStatus, setOllamaStatus] = useState({ online: false, model: 'mistral' });
  const [inputVal, setInputVal] = useState('');
  const [ticker, setTicker] = useState('AAPL');
  const [market, setMarket] = useState('US');
  const [streamedOutput, setStreamedOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const outputEndRef = useRef(null);

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
      setError(`Failed to retrieve AI agent stream: ${err.message}`);
    } finally {
      setStreaming(false);
    }
  };

  const handleResearchSubmit = (e) => {
    e.preventDefault();
    if (!ticker) return;
    handleStreamRequest('agent/research', { symbol: ticker.toUpperCase(), market });
  };

  const handleTechnicalSubmit = (e) => {
    e.preventDefault();
    if (!ticker) return;
    handleStreamRequest('agent/technical', { symbol: ticker.toUpperCase(), market });
  };

  const handleNewsSubmit = (e) => {
    e.preventDefault();
    if (!ticker) return;
    handleStreamRequest('agent/news', { symbol: ticker.toUpperCase(), market });
  };

  const handlePortfolioSubmit = (e) => {
    if (e) e.preventDefault();
    handleStreamRequest('agent/portfolio', {});
  };

  const handleOptionsSubmit = (e) => {
    e.preventDefault();
    if (!ticker) return;
    handleStreamRequest('agent/options', { symbol: ticker.toUpperCase(), market });
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    handleStreamRequest('chat', { message: inputVal });
    setInputVal('');
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

      const title = selectedTool === 'research' 
        ? `Research Agent Report: ${ticker.toUpperCase()}`
        : selectedTool === 'technical'
        ? `Technical Agent Report: ${ticker.toUpperCase()}`
        : selectedTool === 'news'
        ? `News Agent Report: ${ticker.toUpperCase()}`
        : selectedTool === 'portfolio'
        ? 'Portfolio Agent Strategic Review'
        : selectedTool === 'options'
        ? `Options Agent Derivatives Report: ${ticker.toUpperCase()}`
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
            <span className="panel-title">AI Agents Workspace</span>
            <span className={`badge ${ollamaStatus.online ? 'badge-green' : 'badge-red'} font-mono`}>
              {ollamaStatus.online ? 'OLLAMA ACTIVE' : 'SIMULATED'}
            </span>
          </div>

          <div className="panel-body flex flex-col gap-2" style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
            {/* Tool Selection Buttons */}
            <div className="tool-list flex flex-col gap-1">
              <button 
                className={`tool-btn ${selectedTool === 'research' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('research'); setStreamedOutput(''); }}
              >
                <span className="tool-title">🔍 Research Agent</span>
                <span className="tool-desc">SEC filings, Earnings, Annual & Quarterly reports</span>
              </button>

              <button 
                className={`tool-btn ${selectedTool === 'technical' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('technical'); setStreamedOutput(''); }}
              >
                <span className="tool-title">📊 Technical Agent</span>
                <span className="tool-desc">RSI, MACD, EMA, VWAP, Elliott Wave, Ichimoku, SMC</span>
              </button>

              <button 
                className={`tool-btn ${selectedTool === 'news' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('news'); setStreamedOutput(''); }}
              >
                <span className="tool-title">📰 News Agent</span>
                <span className="tool-desc">Sentiment extraction across news articles</span>
              </button>

              <button 
                className={`tool-btn ${selectedTool === 'portfolio' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('portfolio'); setStreamedOutput(''); }}
              >
                <span className="tool-title">💼 Portfolio Agent</span>
                <span className="tool-desc">Monitor rebalancing, diversification, and risk</span>
              </button>

              <button 
                className={`tool-btn ${selectedTool === 'options' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('options'); setStreamedOutput(''); }}
              >
                <span className="tool-title">📈 Options Agent</span>
                <span className="tool-desc">Greeks, IV, Max Pain, Open Interest, PCR analysis</span>
              </button>

              <button 
                className={`tool-btn ${selectedTool === 'copilot' ? 'active' : ''}`}
                onClick={() => { setSelectedTool('copilot'); setStreamedOutput(''); }}
              >
                <span className="tool-title">💬 Market Copilot</span>
                <span className="tool-desc">General multi-purpose chatbot assistant</span>
              </button>
            </div>

            <hr className="divider" />

            {/* Inputs Box based on selected tool */}
            <div className="tool-inputs font-mono text-xs">
              {selectedTool === 'research' && (
                <form onSubmit={handleResearchSubmit} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 font-mono text-xxs">Ticker Symbol</label>
                      <input 
                        className="form-input" 
                        value={ticker} 
                        onChange={e => setTicker(e.target.value)} 
                        placeholder="e.g. AAPL" 
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
                    {streaming ? 'RUNNING CORPORATE AUDIT...' : 'DEPLOY RESEARCH AGENT'}
                  </button>
                </form>
              )}

              {selectedTool === 'technical' && (
                <form onSubmit={handleTechnicalSubmit} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 font-mono text-xxs">Ticker Symbol</label>
                      <input 
                        className="form-input" 
                        value={ticker} 
                        onChange={e => setTicker(e.target.value)} 
                        placeholder="e.g. AAPL" 
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
                    {streaming ? 'ANALYZING CHARTS...' : 'DEPLOY TECHNICAL AGENT'}
                  </button>
                </form>
              )}

              {selectedTool === 'news' && (
                <form onSubmit={handleNewsSubmit} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 font-mono text-xxs">Ticker Symbol</label>
                      <input 
                        className="form-input" 
                        value={ticker} 
                        onChange={e => setTicker(e.target.value)} 
                        placeholder="e.g. AAPL" 
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
                    {streaming ? 'COMPILING HEADLINES...' : 'DEPLOY NEWS AGENT'}
                  </button>
                </form>
              )}

              {selectedTool === 'portfolio' && (
                <form onSubmit={handlePortfolioSubmit} className="flex flex-col gap-2">
                  <span className="text-muted font-mono text-xxs uppercase">Review portfolio metrics</span>
                  <p className="text-muted text-xxs">
                    Reads open positions directly from database, evaluates asset weights, and drafts rebalancing steps.
                  </p>
                  <button type="submit" className="btn btn-primary" disabled={streaming}>
                    {streaming ? 'AUDITING PORTFOLIO...' : 'DEPLOY PORTFOLIO AGENT'}
                  </button>
                </form>
              )}

              {selectedTool === 'options' && (
                <form onSubmit={handleOptionsSubmit} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="form-field flex-1">
                      <label className="text-muted uppercase fw-600 font-mono text-xxs">Underlying Ticker</label>
                      <input 
                        className="form-input" 
                        value={ticker} 
                        onChange={e => setTicker(e.target.value)} 
                        placeholder="e.g. AAPL" 
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
                    {streaming ? 'CALCULATING GREEKS...' : 'DEPLOY OPTIONS AGENT'}
                  </button>
                </form>
              )}

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
                <div className="text-secondary text-sm">QuantDesk Specialized AI Agents</div>
                <div className="text-xs text-muted" style={{ maxWidth: '450px', textAlign: 'center', marginTop: 8 }}>
                  Deploy specialized, data-aware intelligence agents from the left panel. Each agent gathers custom indicators, SEC disclosures, option chains, or news feeds to output high-fidelity analyses.
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

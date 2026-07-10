import React, { useState, useEffect } from 'react';
import { marketApi } from '../../api';
import './News.css';

const API_BASE_URL = 'http://localhost:3001/api';

function NewsPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Sentiment states
  const [streaming, setStreaming] = useState(false);
  const [sentimentOutput, setSentimentOutput] = useState('');
  const [sentimentError, setSentimentError] = useState('');

  const fetchNews = (tickerSym) => {
    setLoading(true);
    setError('');
    marketApi.getNews(tickerSym)
      .then(res => {
        setNews(res.data.news || []);
      })
      .catch(err => {
        setError('Failed to fetch news feed: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchNews(symbol);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    fetchNews(symbol.toUpperCase());
    setSentimentOutput('');
  };

  const handleAnalyzeSentiment = async () => {
    setStreaming(true);
    setSentimentOutput('');
    setSentimentError('');
    const token = localStorage.getItem('qd_access_token');

    try {
      const response = await fetch(`${API_BASE_URL}/ai/news-sentiment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ symbol: symbol.toUpperCase() })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errMsg = `Sentiment service error: ${response.status}`;
        try {
          const parsedErr = JSON.parse(errorText);
          if (parsedErr.error) errMsg = parsedErr.error;
        } catch (e) {}
        throw new Error(errMsg);
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
                  setSentimentOutput(textBuffer);
                }
              } catch (e) {
                console.error('Error parsing stream line:', e);
              }
            }
          }
        }
      }
    } catch (err) {
      setSentimentError(err.message);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="news-root">
      {/* Title banner */}
      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
        <h1 className="font-mono text-sm fw-700 uppercase" style={{ color: '#00ff88', letterSpacing: '0.05em' }}>
          📰 News Aggregator & Ollama Sentiment Analyzer
        </h1>
        
        <form onSubmit={handleSearchSubmit} className="flex gap-1">
          <input
            className="form-input font-mono text-xs"
            style={{ width: '120px', padding: '4px 8px' }}
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
          />
          <button type="submit" className="btn btn-primary btn-sm font-mono">LOAD NEWS</button>
        </form>
      </div>

      <div className="news-layout">
        {/* Left Column: News Feed */}
        <div className="panel flex flex-col">
          <div className="panel-header flex justify-between items-center">
            <span className="panel-title">Recent Headlines for {symbol.toUpperCase()}</span>
            {loading && <span className="font-mono text-xxs text-amber animate-pulse">POLLING HEADLINES...</span>}
          </div>
          <div className="panel-body news-feed" style={{ padding: '8px' }}>
            {error && <div className="font-mono text-red text-xs p-2">⚠ {error}</div>}

            {loading && [1,2,3,4,5].map(i => (
              <div key={i} className="news-article-card" style={{ gap: '8px' }}>
                <div className="news-skeleton-line" style={{ width: `${55 + i * 8}%` }} />
                <div className="news-skeleton-line" style={{ width: '38%', height: '8px', opacity: 0.5 }} />
              </div>
            ))}

            {news.length === 0 && !loading && (
              <div className="text-center text-muted font-mono text-xs py-8">
                No recent headlines found for this asset.
              </div>
            )}

            {!loading && news.map((item, idx) => (
              <div key={item.uuid || idx} className="news-article-card">
                <a 
                  className="news-article-title" 
                  href={item.link} 
                  target="_blank" 
                  rel="noreferrer"
                >
                  {item.title}
                </a>
                <div className="news-article-meta">
                  <span className="news-publisher-tag">{item.publisher}</span>
                  <span>{item.time ? new Date(item.time * 1000).toLocaleString() : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: AI Sentiment */}
        <div className="news-ai-container">
          <div className="panel flex-1 flex flex-col">
            <div className="panel-header flex justify-between items-center">
              <span className="panel-title">Ollama AI Sentiment Scoring Model</span>
              <button 
                className="btn btn-primary btn-xs font-mono" 
                onClick={handleAnalyzeSentiment}
                disabled={streaming || news.length === 0}
              >
                {streaming ? 'STREAMING SCORE...' : 'GENERATE AI SENTIMENT'}
              </button>
            </div>
            
            <div className="panel-body flex-1 flex flex-col" style={{ padding: '8px', minHeight: '340px' }}>
              {sentimentError && (
                <div className="font-mono text-red text-xs p-2 mb-2">⚠ {sentimentError}</div>
              )}

              {!sentimentOutput && !streaming ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center font-mono text-xs text-muted" style={{ padding: '24px' }}>
                  <span className="text-amber">● Sentiment Engine Idle</span>
                  <p style={{ maxWidth: '280px', marginTop: '6px' }}>
                    Click "Generate AI Sentiment" to run the Mistral model over the active news stream headlines.
                  </p>
                </div>
              ) : (
                <div className="sentiment-output-box font-mono whitespace-pre-wrap">
                  {sentimentOutput}
                  {streaming && <span className="animate-pulse" style={{ color: '#00ff88' }}> ▌</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewsPage;

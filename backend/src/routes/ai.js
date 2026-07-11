const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';
const PY_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Helper to check if Ollama is running and get available models
async function checkOllamaConnection() {
  try {
    const res = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 2000 });
    const models = (res.data.models || []).map(m => m.name.split(':')[0]);
    return { online: true, models };
  } catch (err) {
    return { online: false, models: [] };
  }
}

// Reusable streaming function
async function handleOllamaStream(res, prompt, systemPrompt = '') {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const ollamaCheck = await checkOllamaConnection();
  
  if (!ollamaCheck.online) {
    // Return a mock simulated response if Ollama is not running, ensuring smooth developer experience
    console.warn("Ollama is offline. Streaming simulated response.");
    const mockLines = generateMockResponse(prompt);
    for (const chunk of mockLines) {
      res.write(`data: ${JSON.stringify({ response: chunk, done: false })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  // Determine model to use
  let modelToUse = DEFAULT_MODEL;
  if (!ollamaCheck.models.includes(DEFAULT_MODEL) && ollamaCheck.models.length > 0) {
    modelToUse = ollamaCheck.models[0]; // fallback to first installed model
  }

  try {
    const ollamaResponse = await axios({
      method: 'post',
      url: `${OLLAMA_URL}/api/generate`,
      data: {
        model: modelToUse,
        prompt: prompt,
        system: systemPrompt,
        stream: true
      },
      responseType: 'stream',
      timeout: 30000
    });

    ollamaResponse.data.on('data', (chunk) => {
      const text = chunk.toString();
      // Ollama returns JSON lines
      const lines = text.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          res.write(`data: ${JSON.stringify({ response: parsed.response, done: parsed.done })}\n\n`);
        } catch (e) {
          // Send raw text chunk if JSON parsing fails
          res.write(`data: ${JSON.stringify({ response: text, done: false })}\n\n`);
        }
      }
    });

    ollamaResponse.data.on('end', () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    });

  } catch (err) {
    console.error("Ollama streaming error:", err.message);
    res.write(`data: ${JSON.stringify({ response: `\n⚠ Error communicating with Ollama: ${err.message}. Falling back to simulated output.\n\n`, done: false })}\n\n`);
    const mockLines = generateMockResponse(prompt);
    for (const chunk of mockLines) {
      res.write(`data: ${JSON.stringify({ response: chunk, done: false })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
}

// ── 1. General Financial Chat ──────────────────────────────────
const COMPANY_TO_TICKER = {
  nvidia: 'NVDA',
  apple: 'AAPL',
  microsoft: 'MSFT',
  google: 'GOOGL',
  alphabet: 'GOOGL',
  amazon: 'AMZN',
  meta: 'META',
  tesla: 'TSLA',
  netflix: 'NFLX',
  amd: 'AMD',
  intel: 'INTC',
  disney: 'DIS',
  coinbase: 'COIN',
  reliance: 'RELIANCE',
  tcs: 'TCS',
  infosys: 'INFY'
};

function detectStockSymbol(message) {
  const msg = message.toLowerCase().trim();
  
  for (const [name, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (msg.includes(name)) {
      return ticker;
    }
  }

  const patterns = [
    /\b(?:analyze|buy|sell|research|about|invest\s+in|opinion\s+on|status\s+of)\s+([a-z]{1,5})\b/i,
    /\b([a-z]{1,5})\b\s+(?:stock|equity|shares|ticker)\b/i,
    /\b(?:should\s+i\s+buy)\s+([a-z]{1,5})\b/i
  ];

  for (const pat of patterns) {
    const match = message.match(pat);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }

  if (/^[a-z]{1,5}$/i.test(msg) && msg !== 'stock') {
    return msg.toUpperCase();
  }

  return null;
}

// ── 1. General Financial Chat ──────────────────────────────────
router.post('/chat', authenticate, async (req, res) => {
  const { message, context = '' } = req.body;
  const systemPrompt = "You are a professional QuantDesk terminal financial assistant. Provide concise, Bloomberg-style analysis, data interpretations, or explanations.";
  
  const symbol = detectStockSymbol(message);
  if (symbol) {
    console.log(`Detected stock symbol in chat: ${symbol}`);
    try {
      const market = 'US';
      const [fundRes, quoteRes, signalRes, copilotRes, newsRes, macroFedRes, macroCpiRes, macroSpreadRes] = await Promise.all([
        axios.get(`${PY_URL}/fundamentals/${symbol}?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/quotes/${symbol}?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/signals/${symbol}?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/fundamentals/${symbol}/copilot-data?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/news/${symbol}?market=${market}`).catch(() => ({ data: { news: [] } })),
        axios.get(`${PY_URL}/macro/series/FEDFUNDS`).catch(() => ({ data: [] })),
        axios.get(`${PY_URL}/macro/series/CPIAUCSL?calculate_yoy=true`).catch(() => ({ data: [] })),
        axios.get(`${PY_URL}/macro/series/T10Y2Y`).catch(() => ({ data: [] }))
      ]);

      const fund = fundRes.data || {};
      const quote = quoteRes.data || {};
      const signals = signalRes.data || {};
      const copilotData = copilotRes.data || {};
      const news = newsRes.data || { news: [] };
      
      const fedFundsList = macroFedRes.data || [];
      const cpiList = macroCpiRes.data || [];
      const spreadList = macroSpreadRes.data || [];
      
      const fedFunds = fedFundsList.length > 0 ? fedFundsList[fedFundsList.length - 1].value : 5.33;
      const inflation = cpiList.length > 0 ? cpiList[cpiList.length - 1].value : 3.2;
      const spread = spreadList.length > 0 ? spreadList[spreadList.length - 1].value : -0.42;

      const prompt = `
Generate an extremely comprehensive, professional, institutional-grade AI Research Copilot Report for ticker ${symbol.toUpperCase()} (${market}) in markdown format.

Here is the raw data collected for ${symbol.toUpperCase()}:
1. Fundamentals & Profile:
   - Name: ${fund.name || symbol}
   - Sector/Industry: ${fund.sector || 'N/A'} / ${fund.industry || 'N/A'}
   - Market Cap: ${fund.market_cap || 'N/A'}
   - Beta: ${fund.beta || 'N/A'}
   - Dividend Yield: ${fund.dividend_yield ? (fund.dividend_yield * 100).toFixed(2) + '%' : '0.00%'}
   
2. Pricing & Market Stats:
   - Last Trade Price: $${quote.price || 'N/A'} (Prev Close: $${quote.prev_close || 'N/A'})
   - 52-Week High/Low: $${quote.week52_high || 'N/A'} / $${quote.week52_low || 'N/A'}
   - 50 DMA / 200 DMA: $${signals.dma_50 || 'N/A'} / $${signals.dma_200 || 'N/A'}
   - RSI (14): ${signals.rsi || 'N/A'}
   
3. Valuation & Growth Metrics:
   - Trailing P/E: ${fund.pe_trailing || 'N/A'} | Forward P/E: ${fund.pe_forward || 'N/A'}
   - PEG Ratio: ${fund.peg_ratio || 'N/A'}
   - Price-to-Book (P/B): ${fund.pb_ratio || 'N/A'}
   - Gross Margin: ${fund.gross_margin ? (fund.gross_margin * 100).toFixed(2) + '%' : 'N/A'}
   - Net Profit Margin: ${fund.profit_margin ? (fund.profit_margin * 100).toFixed(2) + '%' : 'N/A'}
   - Return on Equity (ROE): ${fund.roe ? (fund.roe * 100).toFixed(2) + '%' : 'N/A'}
   - Return on Assets (ROA): ${fund.roa ? (fund.roa * 100).toFixed(2) + '%' : 'N/A'}
   
4. Financial Statements (Income, Balance Sheet, Cash Flow):
   - Recent Financial Records: ${JSON.stringify(copilotData.financials?.financials || [])}
   - Recent Balance Sheet: ${JSON.stringify(copilotData.financials?.balance_sheet || [])}
   - Recent Cash Flow: ${JSON.stringify(copilotData.financials?.cashflow || [])}
   
5. Earnings & Calendar:
   - Earnings History: ${JSON.stringify(copilotData.earnings?.earnings_history || [])}
   - Next Earnings Date: ${copilotData.earnings?.next_earnings_date || 'N/A'}
   
6. Insider & Institutional Holdings:
   - Insider Transactions: ${JSON.stringify(copilotData.holdings?.insider_transactions || [])}
   - Top Institutional Holders: ${JSON.stringify(copilotData.holdings?.institutional_holders || [])}
   - Major Holders breakdown: ${JSON.stringify(copilotData.holdings?.major_holders || [])}
   
7. Technical & Fundamental Scores (from QuantDesk Screener Engine):
   - Technical Score: ${signals.tech_score || 50}/100
   - Fundamental Score: ${signals.fund_score || 50}/100
   - Trend Bucket: ${signals.buckets?.Trend || 'N/A'}
   - Momentum Bucket: ${signals.buckets?.Momentum || 'N/A'}
   - 52W Range Position: ${signals.week52_pos_pct || 50}%
   
8. News & Headlines (Latest news):
   - News Items: ${JSON.stringify((news.news || []).slice(0, 5))}
   
9. Macro Economy Indicators:
   - Federal Funds Rate: ${fedFunds}%
   - Inflation (CPI YoY): ${inflation}%
   - 10Y-2Y Spread: ${spread}

Please construct a comprehensive report covering these exact sections:
1. Executive Summary & Scorecard
   - Output the Scorecard FIRST in a clean, visual format exactly as shown below:
   
   Overall Score
   [Calculate a final overall score out of 100, e.g. 88/100]
   
   Technical
   [Technical Score out of 100, e.g. 92]
   
   Fundamental
   [Fundamental Score out of 100, e.g. 90]
   
   Valuation
   [Valuation Score out of 100, e.g. 70]
   
   Momentum
   [Momentum Score out of 100, e.g. 96]
   
   Risk
   [Risk Score out of 100, e.g. 58]
   
   News Sentiment
   [News Sentiment Score out of 100, e.g. 94]
   
   Recommendation
   [Strong Buy / Buy / Hold / Sell]
   
   Reasons
   ✓ [Reason 1]
   ✓ [Reason 2]
   ✓ [Reason 3]
   ✓ [Reason 4]
   ✓ [Reason 5]
   
   Risks
   • [Risk 1]
   • [Risk 2]
   
2. Fundamental Analysis
3. Technical Analysis
4. Financial Statements
5. Earnings
6. Insider Buying
7. Institutional Ownership
8. News Impact
9. Macro Economy
10. Risk Factors
11. Price Targets
12. Valuation

Make sure the output matches the headings above exactly.
`;

      const aiSystemPrompt = "You are a senior Wall Street equity research analyst and AI Research Copilot.";
      await handleOllamaStream(res, prompt, aiSystemPrompt);
      return;
    } catch (err) {
      console.error("Error generating Copilot report:", err);
    }
  }

  const prompt = context ? `Context data: ${context}\n\nUser Question: ${message}` : message;
  await handleOllamaStream(res, prompt, systemPrompt);
});

// ── 2. AI Stock/ETF/Crypto/Option/Forex Analysis Report ──
router.post('/analyze', authenticate, async (req, res) => {
  const { symbol, assetType = 'stock', market = 'US' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

  try {
    let prompt = '';
    let systemPrompt = 'You are a senior Wall Street financial research analyst.';

    if (assetType === 'etf') {
      const [etfRes, quoteRes] = await Promise.all([
        axios.get(`${PY_URL}/etf/details/${symbol}?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/quotes/${symbol}?market=${market}`).catch(() => ({ data: {} }))
      ]);
      const etf = etfRes.data || {};
      const quote = quoteRes.data || {};
      const risk = etf.risk_profile || {};

      const holdingsList = (etf.holdings || []).slice(0, 5).map(h => `${h.symbol || h.name} (${(h.weight || 0).toFixed(1)}%)`).join(', ');
      const sectorsList = Object.entries(etf.sector_weights || {}).slice(0, 5).map(([s, w]) => `${s} (${(w || 0).toFixed(1)}%)`).join(', ');

      prompt = `
Generate a comprehensive, professional ETF research report for ticker ${symbol.toUpperCase()} (${market}) in markdown format.
Use these parameters:
1. ETF Name: ${symbol.toUpperCase()}
2. Expense Ratio: ${etf.expense_ratio ? (etf.expense_ratio * 100).toFixed(2) + '%' : 'N/A'}
3. Last Price: $${quote.price || 'N/A'} (Prev Close: $${quote.prev_close || 'N/A'})
4. Dividend Yield: ${etf.etf_yield ? (etf.etf_yield * 100).toFixed(2) + '%' : 'N/A'}
5. Sector Allocation: ${sectorsList || 'N/A'}
6. Top Holdings: ${holdingsList || 'N/A'}
7. Risk Assessment:
   - Risk Score: ${risk.risk_score || 'N/A'}/100 (${risk.classification || 'N/A'})
   - Annualized Volatility: ${risk.annualized_volatility ? risk.annualized_volatility.toFixed(1) + '%' : 'N/A'}
   - Max Drawdown: ${risk.max_drawdown ? '-' + risk.max_drawdown.toFixed(1) + '%' : 'N/A'}
   - Top 5 Concentration: ${risk.top_5_concentration ? risk.top_5_concentration.toFixed(1) + '%' : 'N/A'}
   - Risk Highlights: ${risk.bullets ? risk.bullets.join('; ') : 'N/A'}

Your report must contain exactly:
# QUANTDESK ETF REPORT: ${symbol.toUpperCase()}
1. **Investment Objective & Tracking Index**: State what the ETF tracks and its primary objective.
2. **Key ETF Metrics**: Comments on expenses, yield, and liquidity. Include a table of the Risk Assessment parameters above.
3. **Asset & Sector Composition**: Highlight top sector allocations and stock holdings.
4. **Bull Thesis / Strengths**: Exactly 3 strong points with quantitative arguments.
5. **Bear Thesis / Risk Factors**: Exactly 3 strong risk points or tracking error challenges. Include a custom section outlining volatility and drawdown behaviors based on the Risk Highlights.
6. **Desks Rating**:
   - Short Term Suitability
   - Long Term Allocation Grade (Core Allocation / Tactical Play / Avoid)
`;
      systemPrompt = "You are a professional ETF research and portfolio strategist.";
    }
    else if (assetType === 'crypto') {
      const quoteRes = await axios.get(`${PY_URL}/quotes/${symbol}?market=${market}`).catch(() => ({ data: {} }));
      const quote = quoteRes.data || {};

      prompt = `
Generate a comprehensive, professional Cryptocurrency analysis report for coin ${symbol.toUpperCase()} in markdown format.
Use these real-time price parameters:
1. Last Trade Price: $${quote.price || 'N/A'}
2. 24h Change %: ${quote.change_pct || 'N/A'}%
3. Market Cap: $${quote.market_cap ? (quote.market_cap / 1e9).toFixed(2) + 'B' : 'N/A'}
4. 24h Trading Volume: ${quote.volume ? (quote.volume / 1e6).toFixed(1) + 'M' : 'N/A'}

Your report must contain exactly:
# QUANTDESK CRYPTOCURRENCY REPORT: ${symbol.toUpperCase()}
1. **Protocol Utility Summary**: Explanation of the token's network, utility, and layer classification.
2. **Market Dynamics**: Commentary on circulating supply, market cap rank, and liquidity.
3. **Technical Trend Analysis**: Support/Resistance levels, moving average trends, and market momentum indicators.
4. **Network Health & Security**: Consensus mechanism (PoW/PoS), hash rate or validator statistics, and decentralization rating.
5. **Bull Thesis**: Exactly 3 strong points (adoption, technological updates, network effects).
6. **Bear Thesis**: Exactly 3 key risk factors (regulatory crackdowns, protocol competitors, security vulnerabilities).
7. **Desks Outlook**: Consensus rating (Accumulate / Neutral / Reduce) and 12-Month targets.
`;
      systemPrompt = "You are an institutional digital assets and cryptocurrency research analyst.";
    }
    else if (assetType === 'option') {
      const quoteRes = await axios.get(`${PY_URL}/quotes/${symbol}?market=${market}`).catch(() => ({ data: {} }));
      const quote = quoteRes.data || {};

      prompt = `
Generate a comprehensive, professional derivatives research report for the option/futures contract ticker ${symbol.toUpperCase()} in markdown format.
Use these parameters:
1. Contract Symbol: ${symbol.toUpperCase()}
2. Last Trade Price: $${quote.price || 'N/A'}
3. Bid / Ask: $${quote.day_low || 'N/A'} / $${quote.day_high || 'N/A'}
4. Volume / Open Interest: ${quote.volume || 'N/A'}

Your report must contain exactly:
# QUANTDESK DERIVATIVES REPORT: ${symbol.toUpperCase()}
1. **Contract Identification**: Extract the underlying ticker, option type (Call/Put), strike price, and expiration date from the contract symbol.
2. **Intrinsic vs Extrinsic Value**: Calculate/comment on intrinsic vs time premium at current trade price.
3. **Option Greeks & Sensitivity Profile**: Commentary on Delta (hedging ratio), Gamma (convexity), Theta (time decay), and Vega (volatility sensitivity).
4. **Risk-Reward Payoff Boundary**: Break-even price and max risk vs max profit payoff scenario.
5. **Recommended Execution Strategies**: Suggestions on how to trade this contract (e.g. buying straight, writing against shares, or constructing spreads).
`;
      systemPrompt = "You are a professional options trader and derivatives strategist.";
    }
    else if (assetType === 'forex') {
      const quoteRes = await axios.get(`${PY_URL}/quotes/${symbol}?market=${market}`).catch(() => ({ data: {} }));
      const quote = quoteRes.data || {};

      prompt = `
Generate a comprehensive, professional Foreign Exchange (Forex) currency pair report for ${symbol.toUpperCase()} in markdown format.
Use these parameters:
1. Exchange Rate (Last Price): ${quote.price || 'N/A'}
2. Prev Close: ${quote.prev_close || 'N/A'}
3. Day Range: ${quote.day_low || 'N/A'} - ${quote.day_high || 'N/A'}

Your report must contain exactly:
# QUANTDESK FOREX REPORT: ${symbol.toUpperCase()}
1. **Macroeconomic Framework**: Commentary on interest rate differentials (Central Bank policy), inflation, and trade balances.
2. **Technical Trend & Pivot Points**: Daily support/resistance pivot ranges, RSI momentum, and moving averages.
3. **Volatility & ATR Profile**: Daily pip range analysis and currency liquidity index.
4. **Carry Trade Viability**: Interest rate spread yield outlook.
5. **Consensus Outlook**: 3-Month and 12-Month rate targets and rating (Bullish / Neutral / Bearish).
`;
      systemPrompt = "You are a professional forex macro strategist.";
    }
    else {
      const [fundRes, quoteRes, signalRes, copilotRes, newsRes, macroFedRes, macroCpiRes, macroSpreadRes] = await Promise.all([
        axios.get(`${PY_URL}/fundamentals/${symbol}?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/quotes/${symbol}?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/signals/${symbol}?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/fundamentals/${symbol}/copilot-data?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/news/${symbol}?market=${market}`).catch(() => ({ data: { news: [] } })),
        axios.get(`${PY_URL}/macro/series/FEDFUNDS`).catch(() => ({ data: [] })),
        axios.get(`${PY_URL}/macro/series/CPIAUCSL?calculate_yoy=true`).catch(() => ({ data: [] })),
        axios.get(`${PY_URL}/macro/series/T10Y2Y`).catch(() => ({ data: [] }))
      ]);

      const fund = fundRes.data || {};
      const quote = quoteRes.data || {};
      const signals = signalRes.data || {};
      const copilotData = copilotRes.data || {};
      const news = newsRes.data || { news: [] };
      
      const fedFundsList = macroFedRes.data || [];
      const cpiList = macroCpiRes.data || [];
      const spreadList = macroSpreadRes.data || [];
      
      const fedFunds = fedFundsList.length > 0 ? fedFundsList[fedFundsList.length - 1].value : 5.33;
      const inflation = cpiList.length > 0 ? cpiList[cpiList.length - 1].value : 3.2;
      const spread = spreadList.length > 0 ? spreadList[spreadList.length - 1].value : -0.42;

      const isIndian = market === 'NSE' || market === 'BSE';
      const cur = isIndian ? '₹' : '$';
      const mcap = fund.market_cap
        ? isIndian
          ? `₹${(fund.market_cap / 1e7).toFixed(1)} Cr`
          : fund.market_cap >= 1e12 ? `$${(fund.market_cap / 1e12).toFixed(2)}T` : `$${(fund.market_cap / 1e9).toFixed(2)}B`
        : 'N/A';

      prompt = `
Generate an extremely comprehensive, professional, institutional-grade AI Research Copilot Report for ticker ${symbol.toUpperCase()} (${market}) in markdown format.

Here is the raw data collected for ${symbol.toUpperCase()}:
1. Fundamentals & Profile:
   - Name: ${fund.name || symbol}
   - Sector/Industry: ${fund.sector || 'N/A'} / ${fund.industry || 'N/A'}
   - Market Cap: ${mcap}
   - Beta: ${fund.beta || 'N/A'}
   - Dividend Yield: ${fund.dividend_yield ? (fund.dividend_yield * 100).toFixed(2) + '%' : '0.00%'}
   
2. Pricing & Market Stats:
   - Last Trade Price: ${cur}${quote.price || 'N/A'} (Prev Close: ${cur}${quote.prev_close || 'N/A'})
   - 52-Week High/Low: ${cur}${quote.week52_high || 'N/A'} / ${cur}${quote.week52_low || 'N/A'}
   - 50 DMA / 200 DMA: ${cur}${signals.dma_50 || 'N/A'} / ${cur}${signals.dma_200 || 'N/A'}
   - RSI (14): ${signals.rsi || 'N/A'}
   
3. Valuation & Growth Metrics:
   - Trailing P/E: ${fund.pe_trailing || 'N/A'} | Forward P/E: ${fund.pe_forward || 'N/A'}
   - PEG Ratio: ${fund.peg_ratio || 'N/A'}
   - Price-to-Book (P/B): ${fund.pb_ratio || 'N/A'}
   - Gross Margin: ${fund.gross_margin ? (fund.gross_margin * 100).toFixed(2) + '%' : 'N/A'}
   - Net Profit Margin: ${fund.profit_margin ? (fund.profit_margin * 100).toFixed(2) + '%' : 'N/A'}
   - Return on Equity (ROE): ${fund.roe ? (fund.roe * 100).toFixed(2) + '%' : 'N/A'}
   - Return on Assets (ROA): ${fund.roa ? (fund.roa * 100).toFixed(2) + '%' : 'N/A'}
   
4. Financial Statements (Income, Balance Sheet, Cash Flow):
   - Recent Financial Records: ${JSON.stringify(copilotData.financials?.financials || [])}
   - Recent Balance Sheet: ${JSON.stringify(copilotData.financials?.balance_sheet || [])}
   - Recent Cash Flow: ${JSON.stringify(copilotData.financials?.cashflow || [])}
   
5. Earnings & Calendar:
   - Earnings History: ${JSON.stringify(copilotData.earnings?.earnings_history || [])}
   - Next Earnings Date: ${copilotData.earnings?.next_earnings_date || 'N/A'}
   
6. Insider & Institutional Holdings:
   - Insider Transactions: ${JSON.stringify(copilotData.holdings?.insider_transactions || [])}
   - Top Institutional Holders: ${JSON.stringify(copilotData.holdings?.institutional_holders || [])}
   - Major Holders breakdown: ${JSON.stringify(copilotData.holdings?.major_holders || [])}
   
7. Technical & Fundamental Scores (from QuantDesk Screener Engine):
   - Technical Score: ${signals.tech_score || 50}/100
   - Fundamental Score: ${signals.fund_score || 50}/100
   - Trend Bucket: ${signals.buckets?.Trend || 'N/A'}
   - Momentum Bucket: ${signals.buckets?.Momentum || 'N/A'}
   - 52W Range Position: ${signals.week52_pos_pct || 50}%
   
8. News & Headlines (Latest news):
   - News Items: ${JSON.stringify((news.news || []).slice(0, 5))}
   
9. Macro Economy Indicators:
   - Federal Funds Rate: ${fedFunds}%
   - Inflation (CPI YoY): ${inflation}%
   - 10Y-2Y Spread: ${spread}

Please construct a comprehensive report covering these exact sections:
1. Executive Summary & Scorecard
   - Output the Scorecard FIRST in a clean, visual format exactly as shown below:
   
   Overall Score
   [Calculate a final overall score out of 100, e.g. 88/100]
   
   Technical
   [Technical Score out of 100, e.g. 92]
   
   Fundamental
   [Fundamental Score out of 100, e.g. 90]
   
   Valuation
   [Valuation Score out of 100, e.g. 70]
   
   Momentum
   [Momentum Score out of 100, e.g. 96]
   
   Risk
   [Risk Score out of 100, e.g. 58]
   
   News Sentiment
   [News Sentiment Score out of 100, e.g. 94]
   
   Recommendation
   [Strong Buy / Buy / Hold / Sell]
   
   Reasons
   ✓ [Reason 1]
   ✓ [Reason 2]
   ✓ [Reason 3]
   ✓ [Reason 4]
   ✓ [Reason 5]
   
   Risks
   • [Risk 1]
   • [Risk 2]
   
2. Fundamental Analysis
3. Technical Analysis
4. Financial Statements
5. Earnings
6. Insider Buying
7. Institutional Ownership
8. News Impact
9. Macro Economy
10. Risk Factors
11. Price Targets
12. Valuation

Make sure the output matches the headings above exactly.
`;
      systemPrompt = isIndian
        ? "You are a senior Indian equity research analyst at a BSE/NSE-listed brokerage. Use INR (₹) for all currency values."
        : "You are a senior Wall Street equity research analyst.";
    }

    await handleOllamaStream(res, prompt, systemPrompt);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Failed to trigger stock analysis' });
  }
});

// ── 3. News Sentiment Analysis ──────────────────────────────
router.post('/news-sentiment', authenticate, async (req, res) => {
  const { symbol, market = 'US' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

  try {
    const newsRes = await axios.get(`${PY_URL}/news/${symbol}?market=${market}`);
    const newsList = (newsRes.data.news || []).slice(0, 5); // limit to top 5 articles

    if (newsList.length === 0) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ response: `No recent news articles found for ${symbol.toUpperCase()} to perform sentiment analysis.`, done: true })}\n\n`);
      res.end();
      return;
    }

    const articlesText = newsList.map((a, i) => `Article ${i+1}:\nTitle: ${a.title}\nPublisher: ${a.publisher}\nLink: ${a.link}`).join('\n\n');

    const prompt = `
Analyze the news sentiment for ticker ${symbol.toUpperCase()} based on these recent headlines:
${articlesText}

Format your response in clean markdown:
1. **News Summary**: Brief paragraph summarizing what the news is about.
2. **Sentiment Analysis per Article**: For each article, give:
   - Sentiment: (Bullish / Bearish / Neutral)
   - Impact explanation (1 sentence)
3. **Overall Sentiment Score**: Give a score from -100 (Extremely Bearish) to +100 (Extremely Bullish) and classify the consensus (e.g. Bullish, Neutral, Bearish).
`;

    await handleOllamaStream(res, prompt, "You are a professional sentiment analysis system specialized in market news.");
  } catch (err) {
    console.error('Sentiment analysis error:', err);
    res.status(500).json({ error: 'Failed to run sentiment analysis' });
  }
});

// ── 4. AI Portfolio Review & Suggestions ──────────────────────
router.post('/portfolio-review', authenticate, async (req, res) => {
  try {
    // Get user portfolio holdings
    const pResult = await pool.query('SELECT * FROM portfolios WHERE user_id = $1 ORDER BY created_at LIMIT 1', [req.user.id]);
    if (!pResult.rows[0]) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ response: "You do not have a portfolio set up yet. Add some positions to get an AI review.", done: true })}\n\n`);
      res.end();
      return;
    }

    const portfolioId = pResult.rows[0].id;
    const posResult = await pool.query('SELECT * FROM positions WHERE portfolio_id = $1 AND is_open = true', [portfolioId]);
    const positions = posResult.rows;

    if (positions.length === 0) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ response: "Your portfolio has no open positions. Add some positions to get an AI review.", done: true })}\n\n`);
      res.end();
      return;
    }

    const holdingsText = positions.map((p, idx) => `${idx+1}. Symbol: ${p.symbol} (${p.market}) | Class: ${p.asset_type} | Qty: ${p.quantity} | Avg Cost: $${p.avg_cost}`).join('\n');

    const prompt = `
Analyze the user's current portfolio holdings:
${holdingsText}

Provide a comprehensive review in markdown format:
1. **Portfolio Asset Allocation Review**: Analyze diversity across assets (Equity, Crypto, Forex, etc.). Identify concentration risk.
2. **Weighted Risk Commentary**: Give suggestions on the risk profile (aggressive vs defensive) and potential beta exposure.
3. **Actionable Suggestions (Buy/Sell/Hold)**:
   - Identify which assets might be overweighted and should be trimmed (Sell).
   - Suggest which sectors or assets could be added to optimize diversification (Buy).
   - Highlight core holdings to keep (Hold).
4. **General Market Rebalancing Advice**: Give a summary advice for current macroeconomic conditions.
`;

    await handleOllamaStream(res, prompt, "You are a professional wealth manager and risk analyst.");
  } catch (err) {
    console.error('Portfolio review error:', err);
    res.status(500).json({ error: 'Failed to run portfolio review' });
  }
});

// ── 5. AI Risk Advisor ──────────────────────────────────────
router.post('/risk-advisor', authenticate, async (req, res) => {
  const { portfolioBeta, dailyVolatility, valueAtRisk, totalValue } = req.body;

  const prompt = `
Analyze the portfolio's risk parameters:
- Total Portfolio Value: $${totalValue || 'N/A'}
- Portfolio Beta (β): ${portfolioBeta || 'N/A'}
- Daily Volatility: ${dailyVolatility || 'N/A'}%
- Value at Risk (VaR 95% 1-Day): $${valueAtRisk || 'N/A'}

Provide a detailed quantitative risk advisory report in markdown format:
1. **Risk Tolerance Analysis**: Interpret what a Beta of ${portfolioBeta} and Daily Volatility of ${dailyVolatility}% mean for the portfolio's volatility profile.
2. **Value at Risk (VaR) Breakdown**: Explain in clear terms what a 1-day VaR of $${valueAtRisk} implies under normal market conditions, and discuss what a tail risk (black swan) event would look like.
3. **Hedging Recommendations**: Provide at least 3 concrete hedging strategies (e.g. purchasing index put options, adding defensive low-beta equity sectors like Utilities/Consumer Staples, allocating to gold/cash) to mitigate these specific risks.
`;

  await handleOllamaStream(res, prompt, "You are an institutional Risk Manager.");
});

// ── 6. AI Macro Strategist Advisor ──────────────────────────
router.post('/macro-review', authenticate, async (req, res) => {
  try {
    const [fedFundsRes, cpiRes, spreadRes, curveRes] = await Promise.all([
      axios.get(`${PY_URL}/macro/series/FEDFUNDS`).catch(() => ({ data: [] })),
      axios.get(`${PY_URL}/macro/series/CPIAUCSL?calculate_yoy=true`).catch(() => ({ data: [] })),
      axios.get(`${PY_URL}/macro/series/T10Y2Y`).catch(() => ({ data: [] })),
      axios.get(`${PY_URL}/macro/curve`).catch(() => ({ data: [] }))
    ]);

    const fedFundsList = fedFundsRes.data || [];
    const cpiList = cpiRes.data || [];
    const spreadList = spreadRes.data || [];
    const curveList = curveRes.data || [];

    const fedFunds = fedFundsList.length > 0 ? fedFundsList[fedFundsList.length - 1].value : 5.33;
    const inflation = cpiList.length > 0 ? cpiList[cpiList.length - 1].value : 3.2;
    const spread = spreadList.length > 0 ? spreadList[spreadList.length - 1].value : -0.42;
    
    const yield10yObj = curveList.find(c => c.maturity === '10Y') || curveList.find(c => c.maturity === '10y') || {};
    const yield10y = yield10yObj.yield !== undefined ? yield10yObj.yield : 4.25;

    const prompt = `
Analyze the current macroeconomic regime using these indicators:
- Effective Federal Funds Rate: ${fedFunds}%
- YoY CPI Inflation: ${inflation}%
- 10-Year Treasury Yield: ${yield10y}%
- 10Y-2Y Treasury Yield Spread: ${spread}

Provide a precise macro strategist assessment in markdown format:
1. Economic Cycle Regime Identification (e.g. expansion, late-cycle, contraction signals from yield curve, employment, inflation trend)
2. Inflation Outlook & Policy Trajectory (central bank stance, interest rate path projections)
3. Systematic Transmission Risks (credit conditions, equity market effects, interest rate vulnerabilities)

Do not issue policy advice or investment recommendations. Use objective, professional language.
`;

    await handleOllamaStream(res, prompt, "You are a senior global macro hedge fund strategist and macro economist.");
  } catch (err) {
    console.error('Macro review error:', err);
    res.status(500).json({ error: 'Failed to run macro review' });
  }
});

// ── Specialized AI Agents ──────────────────────────────────

// 1. Research Agent
router.post('/agent/research', authenticate, async (req, res) => {
  const { symbol, market = 'US' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

  try {
    const [fundRes, copilotRes] = await Promise.all([
      axios.get(`${PY_URL}/fundamentals/${symbol}?market=${market}`).catch(() => ({ data: {} })),
      axios.get(`${PY_URL}/fundamentals/${symbol}/copilot-data?market=${market}`).catch(() => ({ data: {} }))
    ]);

    const fund = fundRes.data || {};
    const copilotData = copilotRes.data || {};

    const prompt = `
Act as the QuantDesk AI Research Agent. Your task is to perform an institutional-grade fundamental analysis of ${symbol.toUpperCase()} (${market}) by reviewing its SEC Filings, Earnings History, and Quarterly/Annual Reports.

Here is the raw data collected:
- Name: ${fund.name || symbol}
- Sector/Industry: ${fund.sector || 'N/A'} / ${fund.industry || 'N/A'}
- Market Cap: ${fund.market_cap || 'N/A'}
- Financial Statements: ${JSON.stringify(copilotData.financials?.financials || [])}
- Balance Sheet: ${JSON.stringify(copilotData.financials?.balance_sheet || [])}
- Cash Flow: ${JSON.stringify(copilotData.financials?.cashflow || [])}
- Earnings History: ${JSON.stringify(copilotData.earnings?.earnings_history || [])}
- Major Holders: ${JSON.stringify(copilotData.holdings?.major_holders || [])}

Provide your analysis in clean, professional markdown with exactly these three sections:
# AI RESEARCH AGENT: ${symbol.toUpperCase()}

## 1. Summary
[Provide a detailed fundamental summary of the company's financial health, revenue trends, and operational highlights.]

## 2. Risks
[List the key risks identified from the balance sheet, earnings trajectory, or market conditions. Format as a markdown list starting with •]

## 3. Opportunities
[Detail the key growth opportunities, competitive advantages, or expansion routes. Format as a markdown list starting with ✓]
`;

    await handleOllamaStream(res, prompt, "You are a professional SEC filings and corporate research analyst agent.");
  } catch (err) {
    console.error('Research agent error:', err);
    res.status(500).json({ error: 'Failed to run Research Agent' });
  }
});

// 2. Technical Agent
router.post('/agent/technical', authenticate, async (req, res) => {
  const { symbol, market = 'US' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

  try {
    const [quoteRes, signalRes] = await Promise.all([
      axios.get(`${PY_URL}/quotes/${symbol}?market=${market}`).catch(() => ({ data: {} })),
      axios.get(`${PY_URL}/signals/${symbol}?market=${market}`).catch(() => ({ data: {} }))
    ]);

    const quote = quoteRes.data || {};
    const signals = signalRes.data || {};

    const prompt = `
Act as the QuantDesk AI Technical Agent. Your objective is to perform a technical analysis of ${symbol.toUpperCase()} (${market}) using indicators: RSI, MACD, EMA, VWAP, Elliott Wave theory, Ichimoku Cloud, and Smart Money Concepts (SMC).

Here is the raw price action and indicator data:
- Last Price: $${quote.price || 'N/A'} (Prev Close: $${quote.prev_close || 'N/A'})
- 50 DMA: $${signals.dma_50 || 'N/A'} | 200 DMA: $${signals.dma_200 || 'N/A'}
- RSI (14): ${signals.rsi || 'N/A'}
- Technical Score (0-100): ${signals.tech_score || 'N/A'}
- Trend Status: ${signals.buckets?.Trend || 'N/A'}
- Momentum Status: ${signals.buckets?.Momentum || 'N/A'}

Provide your analysis in clean, professional markdown:
# AI TECHNICAL AGENT: ${symbol.toUpperCase()}

## 1. Indicator Breakdown
- **RSI (14)**: [Interpret current RSI status]
- **Moving Averages (EMA/SMA)**: [Interpret price vs EMA/SMA]
- **MACD & Momentum**: [Interpret MACD trends]
- **VWAP & Volume Profile**: [Discuss VWAP levels]
- **Advanced Theories (Elliott Wave / Ichimoku)**: [Draft a technical hypothesis using Elliott Wave structure or Ichimoku Cloud boundaries]
- **Smart Money Concepts (SMC)**: [Identify potential Order Blocks, Fair Value Gaps (FVG), or Liquidity Sweeps]

## 2. Confidence Score
[Output a final Technical Confidence Score between 0 and 100 based on the indicators above, formatted as a large bold number, e.g. **85/100**]
`;

    await handleOllamaStream(res, prompt, "You are a professional CMT (Chartered Market Technician) and algorithmic trading agent.");
  } catch (err) {
    console.error('Technical agent error:', err);
    res.status(500).json({ error: 'Failed to run Technical Agent' });
  }
});

// 3. News Agent
router.post('/agent/news', authenticate, async (req, res) => {
  const { symbol, market = 'US' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

  try {
    const newsRes = await axios.get(`${PY_URL}/news/${symbol}?market=${market}`);
    const newsList = (newsRes.data.news || []).slice(0, 15); // read up to 15 articles

    const articlesText = newsList.map((a, i) => `Article ${i+1}:\nTitle: ${a.title}\nPublisher: ${a.publisher}\nSummary: ${a.summary || ''}`).join('\n\n');

    const prompt = `
Act as the QuantDesk AI News Agent. Your objective is to ingest and analyze news articles for ${symbol.toUpperCase()} (${market}) and determine the overall market sentiment consensus.

Here are the headlines and article details:
${articlesText || 'No recent articles found.'}

Provide your analysis in clean, professional markdown:
# AI NEWS AGENT: ${symbol.toUpperCase()}

## 1. Headline Synthesis
[Summarize what the core narratives are in the media right now.]

## 2. Articles Review & Sentiment Impact
[Detail the sentiment impact of the articles.]

## 3. Consensus Outlook
Consensus: **[Bullish / Neutral / Bearish]**
Consensus Sentiment Score: **[Score between -100 and +100]**
`;

    await handleOllamaStream(res, prompt, "You are a professional sentiment analysis and news intelligence agent.");
  } catch (err) {
    console.error('News agent error:', err);
    res.status(500).json({ error: 'Failed to run News Agent' });
  }
});

// 4. Portfolio Agent
router.post('/agent/portfolio', authenticate, async (req, res) => {
  try {
    // Fetch user portfolio
    const pResult = await pool.query('SELECT * FROM portfolios WHERE user_id = $1 ORDER BY created_at LIMIT 1', [req.user.id]);
    if (!pResult.rows[0]) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ response: "You do not have a portfolio set up yet.", done: true })}\n\n`);
      res.end();
      return;
    }

    const portfolioId = pResult.rows[0].id;
    const posResult = await pool.query('SELECT * FROM positions WHERE portfolio_id = $1 AND is_open = true', [portfolioId]);
    const positions = posResult.rows;

    const holdingsText = positions.map((p, idx) => `${idx+1}. Symbol: ${p.symbol} (${p.market}) | Qty: ${p.quantity} | Avg Cost: $${p.avg_cost}`).join('\n');

    const prompt = `
Act as the QuantDesk AI Portfolio Agent. Your task is to monitor the user's active portfolio holdings and alert them on Rebalancing, Diversification, and Risk.

Here is the current portfolio layout:
${holdingsText || 'No open positions.'}

Provide your analysis in clean, professional markdown:
# AI PORTFOLIO AGENT: STRATEGIC REVIEW

## 1. Rebalancing Alerts
[Analyze current weights and flag any positions that require trimming or rebalancing.]

## 2. Diversification Audit
[Review asset class and sector concentration, highlighting gaps.]

## 3. Systematic Risk Assessment
[Analyze correlation risks, beta exposure, or macroeconomic sensitivities.]
`;

    await handleOllamaStream(res, prompt, "You are a professional portfolio manager and risk controller agent.");
  } catch (err) {
    console.error('Portfolio agent error:', err);
    res.status(500).json({ error: 'Failed to run Portfolio Agent' });
  }
});

// 5. Options Agent
router.post('/agent/options', authenticate, async (req, res) => {
  const { symbol, market = 'US' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

  try {
    const optionsRes = await axios.get(`${PY_URL}/options/${symbol}?market=${market}`);
    const chain = optionsRes.data || {};

    const prompt = `
Act as the QuantDesk AI Options & Derivatives Agent. Your objective is to analyze the options chain for ${symbol.toUpperCase()} (${market}) covering Greeks, IV, Max Pain, Open Interest, and PCR (Put-Call Ratio).

Here is the raw options statistics:
- Underlying Price: $${chain.price || 'N/A'}
- Put-Call Ratio (PCR): ${chain.pcr || 'N/A'}
- Total Call Open Interest: ${chain.total_call_oi || 'N/A'}
- Total Put Open Interest: ${chain.total_put_oi || 'N/A'}
- Nearby Calls sample: ${JSON.stringify((chain.calls || []).slice(0, 5))}
- Nearby Puts sample: ${JSON.stringify((chain.puts || []).slice(0, 5))}

Provide your derivatives assessment in clean, professional markdown:
# AI OPTIONS AGENT: ${symbol.toUpperCase()}

## 1. Greeks & Volatility (IV) Analysis
[Interpret Implied Volatility levels, skew, and average Delta/Gamma profiles.]

## 2. Max Pain & Open Interest (OI) Heatmap
[Estimate the Max Pain price point where buyers lose the most premium, and outline critical support/resistance zones based on Open Interest peaks.]

## 3. Put-Call Ratio (PCR) Diagnosis
[Interpret the PCR of ${chain.pcr || 'N/A'} and explain whether it signals a bullish hedging peak or bearish consensus.]
`;

    await handleOllamaStream(res, prompt, "You are a professional derivatives and options specialist agent.");
  } catch (err) {
    console.error('Options agent error:', err);
    res.status(500).json({ error: 'Failed to run Options Agent' });
  }
});

// ── Mock Fallback Generator ──────────────────────────────────
function generateMockResponse(prompt) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes('research agent')) {
    const symbol = (prompt.match(/fundamental\s+analysis\s+of\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'AAPL').toUpperCase();
    return [
      `# AI RESEARCH AGENT: ${symbol}\n\n`,
      `## 1. Summary\n`,
      `Based on the latest corporate disclosures, SEC Filings (Form 10-K / 10-Q) and earnings calls, **${symbol}** exhibits robust operational performance. The firm shows revenue acceleration driven by its core high-margin business segments. Net margins are steady, confirming strong pricing execution and operating leverage.\n\n`,
      `## 2. Risks\n`,
      `• **Valuation Multiple Compression**: The stock trades at an elevated PEG and forward multiple, exposing it to interest rate volatility.\n`,
      `• **Antitrust & Regulatory Scrutiny**: Heightened global regulatory constraints on its core business model could limit future margins.\n`,
      `• **Supply Chain Vulnerability**: High dependency on overseas semiconductor assembly plants represents a critical single point of failure.\n\n`,
      `## 3. Opportunities\n`,
      `✓ **AI Service Integration**: Expansion of product suites with on-device AI models drives upgrade cycles.\n`,
      `✓ **Strong Share Buybacks**: Solid cash flow generation supports massive stock repurchase authorization and dividend growth.\n`,
      `✓ **Sticky Ecosystem Moat**: High customer retention rates and cross-selling capabilities ensure stable recurring revenues.`
    ];
  }

  if (normalized.includes('technical agent')) {
    const symbol = (prompt.match(/technical\s+analysis\s+of\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'AAPL').toUpperCase();
    return [
      `# AI TECHNICAL AGENT: ${symbol}\n\n`,
      `## 1. Indicator Breakdown\n`,
      `- **RSI (14)**: Currently at **58.4**, showing healthy bullish momentum with room to run before entering overbought territory.\n`,
      `- **Moving Averages (EMA/SMA)**: The price trades comfortably above the 50-day SMA ($215.40) and 200-day SMA ($198.80), indicating a strong structural uptrend.\n`,
      `- **MACD & Momentum**: MACD line is above the signal line with positive histogram values, confirming a bullish crossover pattern.\n`,
      `- **VWAP & Volume Profile**: High volume accumulation is observed near the VWAP anchor, reinforcing key horizontal support levels.\n`,
      `- **Advanced Theories (Elliott Wave / Ichimoku)**: The chart exhibits a classic Elliott Wave Wave-3 extension, indicating continuation. The Ichimoku Kumo Cloud is thick and bullish.\n`,
      `- **Smart Money Concepts (SMC)**: Identified a bullish order block at the $212 level and an unfilled Fair Value Gap (FVG) between $210 and $212.\n\n`,
      `## 2. Confidence Score\n`,
      `Technical Confidence Score: **85/100**`
    ];
  }

  if (normalized.includes('news agent')) {
    const symbol = (prompt.match(/news\s+articles\s+for\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'AAPL').toUpperCase();
    return [
      `# AI NEWS AGENT: ${symbol}\n\n`,
      `## 1. Headline Synthesis\n`,
      `Media sentiment is highly optimistic, focusing on new product rollouts, contract wins, and favorable analyst upgrades. Negative headlines are mostly related to general macro headwinds rather than company-specific issues.\n\n`,
      `## 2. Articles Review & Sentiment Impact\n`,
      `* **Headline 1**: "Next-gen orders exceed initial targets" -> **Bullish** (direct positive revenue driver).\n`,
      `* **Headline 2**: "Regulatory policy updates in international markets" -> **Neutral** (expected corporate compliance).\n`,
      `* **Headline 3**: "Top tier research desk upgrades stock to Buy" -> **Bullish** (improves institutional sentiment).\n\n`,
      `## 3. Consensus Outlook\n`,
      `Consensus: **Bullish**  \n`,
      `Consensus Sentiment Score: **+78/100**`
    ];
  }

  if (normalized.includes('portfolio agent')) {
    return [
      `# AI PORTFOLIO AGENT: STRATEGIC REVIEW\n\n`,
      `## 1. Rebalancing Alerts\n`,
      `• **High-Beta Technology Concentration**: Tech holdings currently represent 42% of total assets. Trim 5% to limit exposure to sudden rate shifts.\n`,
      `• **Underweighted Defensive Allocation**: Allocate trimmed capital to high-yield cash equivalents or consumer staples.\n\n`,
      `## 2. Diversification Audit\n`,
      `• **Sector Breakdown**: The portfolio is heavily weighted toward Technology (45%) and Financials (30%). Energy and Industrials are severely underrepresented.\n`,
      `• **Fixed Income Exposure**: Current exposure is 0%. Add short-duration bond ETFs (e.g. SHY) to improve risk-adjusted yields.\n\n`,
      `## 3. Systematic Risk Assessment\n`,
      `• **Beta Sensitivity**: Portfolio Beta stands at **1.34**. This implies a 34% higher volatility than the S&P 500. A market correction will result in magnified drawdowns.\n`,
      `• **Macro Sensitivity**: Vulnerable to hot inflation CPI prints which may trigger multiple compression in growth holdings.`
    ];
  }

  if (normalized.includes('options & derivatives agent')) {
    const symbol = (prompt.match(/options\s+chain\s+for\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'AAPL').toUpperCase();
    return [
      `# AI OPTIONS AGENT: ${symbol}\n\n`,
      `## 1. Greeks & Volatility (IV) Analysis\n`,
      `- **Implied Volatility (IV)**: Currently at **28.5%** (in the 65th percentile). IV skew shows calls trading at a slight premium to puts, suggesting bullish speculation.\n`,
      `- **Delta Profile**: At-the-money options display a Delta of +0.52 for Calls and -0.48 for Puts, signaling balanced delta-hedging positioning.\n`,
      `- **Gamma & Theta**: Gamma peaks near the money, with Theta decay accelerating at -$0.045 per contract per day.\n\n`,
      `## 2. Max Pain & Open Interest (OI) Heatmap\n`,
      `- **Max Pain Strike**: Calculated at **$215.00**. Option writers are highly incentivized to keep prices near this magnet at expiration.\n`,
      `- **Open Interest Spikes**: Significant call open interest sits at the $220.00 strike (forming immediate resistance) and put open interest at $210.00 (serving as a solid floor).\n\n`,
      `## 3. Put-Call Ratio (PCR) Diagnosis\n`,
      `The Put-Call Ratio (PCR) by Open Interest is **0.82**. This represents a healthy, moderately bullish bias, indicating institutional call accumulation alongside standard protective put hedging.`
    ];
  }

  if (normalized.includes('macroeconomic regime') || normalized.includes('macro strategist')) {
    return [
      `# QUANTDESK MACRO STRATEGY PULSE\n\n`,
      `### 1. Economic Cycle Regime Identification\n`,
      `The 10Y-2Y Treasury spread remains inverted. Historically, this signal indicates a late-cycle expansion transitioning toward deceleration. Investors should prepare portfolios for potential growth slowdowns.\n\n`,
      `### 2. Inflation Outlook & Policy Trajectory\n`,
      `YoY CPI Inflation stands at 3.2%, while the Effective Federal Funds Rate is held restrictive at 5.33%. The data suggests the central bank will maintain a high-for-longer policy path until core services inflation anchors closer to target.\n\n`,
      `### 3. Systematic Transmission Risks\n`,
      `Restrictive policy poses transmission risks to commercial real estate credit and bank balance sheets. Professionals should monitor high-yield spreads and bank lending standards carefully.`
    ];
  }
  
  if (normalized.includes('etf report')) {
    const symbol = (prompt.match(/ticker\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'SELECTED ETF').toUpperCase();
    return [
      `# QUANTDESK ETF REPORT: ${symbol}\n\n`,
      `### 1. Investment Objective & Tracking Index\n`,
      `The ETF provides low-cost exposure to a diversified basket of global large-cap assets, matching the performance of its underlying benchmark index. `,
      `It aims to track market-weighted index returns with minimum tracking error.\n\n`,
      `### 2. Key ETF Metrics\n`,
      `- **Expense Ratio**: 0.09% (highly competitive in the global index tracker segment).\n`,
      `- **Dividend Yield**: 1.85% paid quarterly, mirroring parent equity cash distributions.\n`,
      `- **Volatility Profile**: Beta aligns closely with 1.00, demonstrating benchmark liquidity.\n\n`,
      `### 3. Asset & Sector Composition\n`,
      `- **Technology**: 29.5%\n`,
      `- **Financial Services**: 13.2%\n`,
      `- **Healthcare**: 12.0%\n`,
      `- **Top Holdings**: Core large-cap tech conglomerates occupy 18.5% of total asset allocation.\n\n`,
      `### 4. Bull Thesis / Strengths\n`,
      `1. **Extreme Diversification**: Direct exposure to 500+ premium securities mitigates individual firm risk.\n`,
      `2. **Fee Efficiency**: Exceptionally low expense ratio ensures minimal friction on long-term compound growth.\n`,
      `3. **High Liquidity**: Average daily volume supports institutional-sized block trading with negligible spreads.\n\n`,
      `### 5. Bear Thesis / Risk Factors\n`,
      `1. **Systemic Market Risk**: Zero hedging mechanisms mean full exposure to macroeconomic downturns.\n`,
      `2. **Growth Underperformance**: High concentration in passive sectors limits alpha generation during active cycles.\n`,
      `3. **Tracking Variance**: Cash drags and transaction timing can cause minor divergence from the benchmark.\n\n`,
      `### 6. Desks Rating\n`,
      `- **Short Term Suitability**: Neutral (Consolidating)\n`,
      `- **Long Term Allocation Grade**: **CORE ALLOCATION**`
    ];
  }

  if (normalized.includes('cryptocurrency report')) {
    const symbol = (prompt.match(/coin\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'COIN').toUpperCase();
    return [
      `# QUANTDESK CRYPTOCURRENCY REPORT: ${symbol}\n\n`,
      `### 1. Protocol Utility Summary\n`,
      `This token serves as the native utility asset powering a decentralized computing and settlement protocol. `,
      `It enables smart contract operations, consensus validation incentive, and gas fee execution.\n\n`,
      `### 2. Market Dynamics\n`,
      `- **Circulating Supply**: Fixed or highly structured emission rate limits runaway inflation.\n`,
      `- **Market Cap Rank**: Ranks within the top digital assets, ensuring high liquidity.\n`,
      `- **Volume Profile**: High institutional presence prevents extreme price slippage.\n\n`,
      `### 3. Technical Trend Analysis\n`,
      `- **Key Support**: Testing near-term moving average limits.\n`,
      `- **RSI Momentum**: Currently at 52 (neutral zone, indicating consolidation).\n`,
      `- **MACD Profile**: Neutral cross over, waiting for directional breakout.\n\n`,
      `### 4. Network Health & Security\n`,
      `- **Consensus Mechanism**: Proof-of-Stake (PoS) with validator participation exceeding 85%.\n`,
      `- **Decentralization Rating**: High dispersion of validator nodes minimizes central authority risk.\n\n`,
      `### 5. Bull Thesis\n`,
      `1. **Scalability Improvements**: Imminent network upgrade will triple throughput and halve gas requirements.\n`,
      `2. **Corporate Integration**: Notable payment networks are piloting settlement layers on the protocol.\n`,
      `3. **Staking Yield Yields**: Staking yield exceeding 4.2% APY attracts capital locks.\n\n`,
      `### 6. Bear Thesis\n`,
      `1. **Regulatory Ambiguity**: Dynamic regulatory classification introduces systemic compliance risks.\n`,
      `2. **Protocol Competition**: Layer-2 alternatives and competing ecosystems could capture transaction market share.\n`,
      `3. **Macro Liquidity Sensitivity**: Asset price remains highly correlated with global M2 liquidity expansions.\n\n`,
      `### 7. Desks Outlook\n`,
      `- **Consensus Rating**: **ACCUMULATE**\n`,
      `- **12-Month Target**: $${(100 + Math.random()*50).toFixed(0)}`
    ];
  }

  if (normalized.includes('derivatives report')) {
    const symbol = (prompt.match(/ticker\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'DERIVATIVE').toUpperCase();
    return [
      `# QUANTDESK DERIVATIVES REPORT: ${symbol}\n\n`,
      `### 1. Contract Identification\n`,
      `- **Underlying Ticker**: ${symbol.substring(0,4)}\n`,
      `- **Contract Classification**: Option Contract (Call Option)\n`,
      `- **Strike Price & Expiry**: $150.00 expiring in 45 Days.\n\n`,
      `### 2. Intrinsic vs Extrinsic Value\n`,
      `- **Intrinsic Premium**: Option is currently In-The-Money (ITM) by $5.00.\n`,
      `- **Extrinsic Time Premium**: Extrinsic value accounts for $2.40 of total pricing.\n\n`,
      `### 3. Option Greeks & Sensitivity Profile\n`,
      `- **Delta (Δ)**: +0.62 (Option behaves like 62 shares of underlying equity).\n`,
      `- **Gamma (Γ)**: +0.02 (Accrues delta acceleration on upward stock sweeps).\n`,
      `- **Theta (Θ)**: -$0.035 per day (Time decay acceleration begins in 15 days).\n`,
      `- **Vega (V)**: +0.12 (Highly sensitive to volatility expansions).\n\n`,
      `### 4. Risk-Reward Payoff Boundary\n`,
      `- **Break-Even Boundary**: $157.40 ($150.00 Strike + $7.40 Option Price).\n`,
      `- **Max Drawdown**: Capped at $740.00 (Total premium paid).\n`,
      `- **Max Reward Potential**: Unlimited on the upside.\n\n`,
      `### 5. Recommended Execution Strategies\n`,
      `1. **Covered Call Overlay**: Write this contract against existing stock positions to yield a immediate 4.9% cash return.\n`,
      `2. **Bull Call Spread**: Buy this contract while writing a higher strike out-of-the-money contract to reduce net debit entry.`
    ];
  }

  if (normalized.includes('forex report')) {
    const symbol = (prompt.match(/report\s+([a-zA-Z0-9\-\.\/]+)/i)?.[1] || 'CURRENCY PAIR').toUpperCase();
    return [
      `# QUANTDESK FOREX REPORT: ${symbol}\n\n`,
      `### 1. Macroeconomic Framework\n`,
      `The currency pair trades under central bank policy divergence. `,
      `Expectations of interest rate cuts by the domestic Federal Reserve have weakened the dollar yield edge, supporting foreign currency inflows.\n\n`,
      `### 2. Technical Trend & Pivot Points\n`,
      `- **Pivot Point**: Stable near current price range.\n`,
      `- **Support 1 / Resistance 1**: Critical boundaries forming near 200-day moving average zones.\n`,
      `- **Momentum RSI**: 48.2 (Indicates balanced distribution between bulls and bears).\n\n`,
      `### 3. Volatility & ATR Profile\n`,
      `- **Average True Range (14D)**: 78 Pips (indicating normal, non-stressed volatility levels).\n`,
      `- **Liquidity Index**: Excellent; tight institutional spreads persist.\n\n`,
      `### 4. Carry Trade Viability\n`,
      `A -0.75% interest spread yields a negative carry environment, making long holding structures unfavorable unless offset by capital gains momentum.\n\n`,
      `### 5. Consensus Outlook\n`,
      `- **3-Month Target**: 1.0950\n`,
      `- **12-Month Target**: 1.1200\n`,
      `- **Consensus Outlook**: **BULLISH**`
    ];
  }

  if (normalized.includes('news sentiment') || normalized.includes('headlines')) {
    const symbol = (prompt.match(/ticker\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'SYMBOL').toUpperCase();
    return [
      `# SENTIMENT REPORT: ${symbol}\n\n`,
      `### 1. News Summary\n`,
      `Recent coverage indicates stable product line expansions and constructive analyst commentary. `,
      `Markets are actively digest macroeconomic developments, keeping overall volatility in check.\n\n`,
      `### 2. Sentiment Analysis per Article\n`,
      `* **Article 1**: *Bullish* - Positive product growth reports highlight strong pricing execution.\n`,
      `* **Article 2**: *Neutral* - Standard corporate disclosures show normal organizational updates.\n`,
      `* **Article 3**: *Bullish* - Analyst upgrade cites healthy balance sheet and defensive posture.\n\n`,
      `### 3. Overall Sentiment Score\n`,
      `- **Consensus**: **BULLISH**\n`,
      `- **Sentiment Score**: **+65** (on a scale from -100 to +100)`
    ];
  }

  if (normalized.includes('investment report') || normalized.includes('copilot report') || normalized.includes('analyze')) {
    const symbol = (prompt.match(/ticker\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || prompt.match(/report\s+for\s+ticker\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'AAPL').toUpperCase();
    return [
      `# QUANTDESK AI COPILOT REPORT: ${symbol}\n\n`,
      `### 1. Executive Summary & Scorecard\n\n`,
      `Overall Score\n\n`,
      `**88/100**\n\n`,
      `Technical\n92\n\n`,
      `Fundamental\n90\n\n`,
      `Valuation\n70\n\n`,
      `Momentum\n96\n\n`,
      `Risk\n58\n\n`,
      `News Sentiment\n94\n\n`,
      `**Recommendation**\n\nStrong Buy\n\n`,
      `**Reasons**\n\n`,
      `✓ AI demand growing\n`,
      `✓ Revenue acceleration\n`,
      `✓ Positive institutional flow\n`,
      `✓ Strong chart\n`,
      `✓ Increasing earnings\n\n`,
      `**Risks**\n\n`,
      `• Expensive valuation\n`,
      `• Export restrictions\n\n`,
      `### 2. Fundamental Analysis\n`,
      `The fundamental health of ${symbol} is exceptional. The company has a Return on Equity (ROE) of 28.5% and a operating profit margin of 24.2%. Leveraged risk is low with a Debt-to-Equity ratio of 42.1%, ensuring robust stability during macroeconomic cycles.\n\n`,
      `### 3. Technical Analysis\n`,
      `${symbol} shows strong bullish technical indicators. The last price is trading comfortably above both the 50-day SMA ($215.20) and 200-day SMA ($198.45). RSI (14) is at 62.4, demonstrating high positive momentum without crossing into overbought zones.\n\n`,
      `### 4. Financial Statements\n`,
      `A review of the financial statements reveals positive long-term trends. Revenues for the trailing twelve months stand at $383B with gross profits of $169B. Total cash and cash equivalents stand at $38.4B against a total debt of $102.5B, yielding solid solvency ratios.\n\n`,
      `### 5. Earnings\n`,
      `${symbol} has a record of consistent earnings outperformance, beating EPS expectations in 3 of the last 4 quarters by an average of 4.2%. The next quarterly earnings date is estimated to be announced soon, with consensus projecting further EPS growth.\n\n`,
      `### 6. Insider Buying\n`,
      `Insider activity signals strong internal confidence. Recent SEC Form 4 filings show net insider purchases of 85,000 shares over the past 90 days, with negligible scheduled sales under pre-arranged 10b5-1 plans.\n\n`,
      `### 7. Institutional Ownership\n`,
      `Institutional ownership is highly concentrated at 74.2% of the float. The top three institutional holders are Vanguard Group, BlackRock, and Berkshire Hathaway. Net institutional flow shows a positive accumulation trend over the past 60 days.\n\n`,
      `### 8. News Impact\n`,
      `Recent news sentiment is strongly bullish (+82 score). Positive headlines highlight upgrades from major investment firms citing strong software margins, AI product integrations, and robust free cash flow yield.\n\n`,
      `### 9. Macro Economy\n`,
      `Under the current macro regime (Effective Fed Funds Rate at 5.33% and inflation YoY at 3.2%), ${symbol}'s pricing power allows it to maintain net margins. The inverted 10Y-2Y spread poses minor systematic risk to its enterprise segment, but its cash pile acts as a strong buffer.\n\n`,
      `### 10. Risk Factors\n`,
      `1. Systematic valuation compression in high-multiple tech equities due to persistent high interest rates.\n`,
      `2. Supply chain disruptions in international assembly plants.\n`,
      `3. Intense competition in the AI infrastructure and consumer software space.\n\n`,
      `### 11. Price Targets\n`,
      `- **Short Term Target (3M)**: $240.00\n`,
      `- **Medium Term Target (12M)**: $265.00\n`,
      `- **Long Term Target (3Y)**: $310.00\n\n`,
      `### 12. Valuation\n`,
      `Valuation metrics indicate a premium compared to historical medians, with a Trailing P/E of 29.5x and Forward P/E of 26.2x. However, the PEG ratio of 2.1 is justified given its dominant industry moat and operating leverage.`
    ];
  }
  
  if (normalized.includes('portfolio holdings') || normalized.includes('review')) {
    return [
      `# AI PORTFOLIO REVIEW & SUGGESTIONS\n\n`,
      `### 1. Portfolio Asset Allocation Review\n`,
      `Your portfolio shows concentration in equity holdings, providing strong growth exposure. `,
      `Diversification across other asset classes (Crypto, Forex, Options) is currently limited, exposing you to systemic equity sell-offs.\n\n`,
      `### 2. Weighted Risk Commentary\n`,
      `Your current risk exposure is balanced. The weighted portfolio beta is moderate, meaning it will generally track major index moves. `,
      `To limit downside volatility, addition of defensive holdings is highly recommended.\n\n`,
      `### 3. Actionable Suggestions\n`,
      `- **BUY**: Utilities, Consumer Staples, or Treasury ETF positions to act as a hedge during equity drawdowns.\n`,
      `- **SELL**: Consider taking partial profits on high-beta equity positions if they exceed 25% of total portfolio value.\n`,
      `- **HOLD**: Maintain core market-cap holdings to benefit from long-term equity growth trends.\n\n`,
      `### 4. General Market Rebalancing Advice\n`,
      `Under current macroeconomic interest-rate structures, we advise maintaining a 10% cash/gold buffer to capture market dip opportunities.`
    ];
  }

  if (normalized.includes('risk parameters') || normalized.includes('risk advisor')) {
    const totalValueMatch = prompt.match(/Total Portfolio Value:\s*\$?([0-9\.,]+)/i);
    const betaMatch = prompt.match(/Portfolio Beta\s*\(β\):\s*([0-9\.-]+)/i);
    const volMatch = prompt.match(/Daily Volatility:\s*([0-9\.-]+)%/i);
    const varMatch = prompt.match(/Value at Risk\s*\(VaR 95% 1-Day\):\s*\$?([0-9\.,]+)/i);

    const totalValue = totalValueMatch ? totalValueMatch[1] : 'N/A';
    const betaStr = betaMatch ? betaMatch[1] : '1.0';
    const volStr = volMatch ? volMatch[1] : '1.0';
    const varVal = varMatch ? varMatch[1] : 'N/A';

    const beta = parseFloat(betaStr) || 1.0;
    const vol = parseFloat(volStr) || 1.0;
    const annVol = (vol * Math.sqrt(252)).toFixed(2);

    let betaInterpretation = "";
    if (beta > 1.2) {
      betaInterpretation = `At β = ${beta.toFixed(2)}, your portfolio exhibits high systematic sensitivity. It is expected to outperform during market rallies but will suffer magnified losses during corrections.`;
    } else if (beta < 0.8) {
      betaInterpretation = `At β = ${beta.toFixed(2)}, your portfolio is defensively positioned, showing low systematic risk. It will offer strong capital preservation but may lag in aggressive bull markets.`;
    } else {
      betaInterpretation = `At β = ${beta.toFixed(2)}, your portfolio's systematic risk matches the broader benchmark index closely, representing a standard market-tracking volatility profile.`;
    }

    return [
      `# 🛡️ INSTITUTIONAL AI RISK ADVISORY REPORT\n\n`,
      `### 1. Systematic Risk & Volatility Analysis\n`,
      `- **Portfolio Beta (β)**: **${beta.toFixed(2)}**\n`,
      `- **Daily Volatility**: **${vol.toFixed(2)}%** (Annualized Volatility: **${annVol}%**)\n\n`,
      `${betaInterpretation} `,
      `With an annualized standard deviation of **${annVol}%**, daily portfolio fluctuations are expected to lie within a ±${vol.toFixed(2)}% boundary on approximately 68% of trading days.\n\n`,
      `### 2. Value at Risk (VaR) Diagnostics\n`,
      `- **1-Day Value at Risk (VaR 95%)**: **$${varVal}**\n`,
      `- **Total Portfolio Capitalization**: **$${totalValue}**\n\n`,
      `A 95% confidence 1-day VaR of **$${varVal}** implies that under normal market regimes, there is only a 5% statistical probability that the portfolio will experience a single-day loss greater than **$${varVal}**. `,
      `However, a "tail-risk" (black swan) event lying in the 5% outer distribution boundary could trigger drawdowns significantly exceeding this parametric threshold, requiring tactical capital buffers.\n\n`,
      `### 3. Tactical Hedging Recommendations\n`,
      `1. **Index-Based Put Option Overlay**: Buy 5% out-of-the-money put options on the primary index benchmark to set a hard floor on downside equity losses.\n`,
      `2. **Defensive Rebalancing**: Reallocate 12% to low-beta, cash-flow resilient sectors (e.g. Consumer Staples, Healthcare, or Utilities) to reduce systematic beta sensitivity.\n`,
      `3. **Liquid Capital Reserves**: Allocate 10-15% of assets into short-duration cash equivalents (Treasury Bills or Liquid Funds) to preserve liquidity and capitalize on market mispricings during distress.`
    ];
  }

  // Default Chat Response
  return [
    `Hello! I am your AI assistant running on the QuantDesk Terminal.\n\n`,
    `I can help you analyze stock fundamentals, compute options Greeks, evaluate portfolio risk parameters, `,
    `and suggest rebalancing ideas based on quantitative metrics.\n\n`,
    `Please select one of the dedicated AI tools from the menu or type a specific financial query.`
  ];
}

module.exports = router;

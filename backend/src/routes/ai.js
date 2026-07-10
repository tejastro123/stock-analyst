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
router.post('/chat', authenticate, async (req, res) => {
  const { message, context = '' } = req.body;
  const systemPrompt = "You are a professional QuantDesk terminal financial assistant. Provide concise, Bloomberg-style analysis, data interpretations, or explanations.";
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
      const [fundRes, quoteRes] = await Promise.all([
        axios.get(`${PY_URL}/fundamentals/${symbol}?market=${market}`).catch(() => ({ data: {} })),
        axios.get(`${PY_URL}/quotes/${symbol}?market=${market}`).catch(() => ({ data: {} }))
      ]);
      const fund = fundRes.data || {};
      const quote = quoteRes.data || {};

      const isIndian = market === 'NSE' || market === 'BSE';
      const cur = isIndian ? '₹' : '$';
      const mcap = fund.market_cap
        ? isIndian
          ? `₹${(fund.market_cap / 1e7).toFixed(1)} Cr`
          : fund.market_cap >= 1e12 ? `$${(fund.market_cap / 1e12).toFixed(2)}T` : `$${(fund.market_cap / 1e9).toFixed(2)}B`
        : 'N/A';

      prompt = `
Generate a comprehensive, professional investment research report for ticker ${symbol.toUpperCase()} (${market}) in markdown format.
Use these 12 fundamental and market parameters:
1. Company Name: ${fund.name || symbol}
2. Sector/Industry: ${fund.sector || 'Diversified'} / ${fund.industry || 'Index / Benchmark'}
3. Last Trade Price: ${cur}${quote.price || 'N/A'} (Prev Close: ${cur}${quote.prev_close || 'N/A'})
4. Market Cap: ${mcap}
5. Trailing P/E: ${fund.pe_trailing || 'N/A'} | Forward P/E: ${fund.pe_forward || 'N/A'}
6. PEG Ratio: ${fund.peg_ratio || 'N/A'}
7. Price-to-Book (P/B): ${fund.pb_ratio || 'N/A'}
8. Debt-to-Equity: ${fund.debt_to_equity || 'N/A'}
9. Gross Margin: ${fund.gross_margin ? (fund.gross_margin * 100).toFixed(2) + '%' : 'N/A'}
10. Profit Margin: ${fund.profit_margin ? (fund.profit_margin * 100).toFixed(2) + '%' : 'N/A'}
11. Beta: ${fund.beta || 'N/A'}
12. Dividend Yield: ${fund.dividend_yield ? (fund.dividend_yield * 100).toFixed(2) + '%' : 'N/A'}

Note: If fundamental data is unavailable (N/A), analyze the ticker contextually based on its known characteristics, sector position, and market standing. Do not call it "enigmatic" — provide substantive analysis using available knowledge.

Your report must contain exactly:
# QUANTDESK INVESTMENT REPORT: ${symbol.toUpperCase()}
1. **Executive Summary**: A concise financial outlook (3-4 sentences).
2. **Key Valuation Metrics**: Short comments on the 12 parameters above.
3. **Bull Thesis**: Exactly 3 strong points with quantitative arguments.
4. **Bear Thesis**: Exactly 3 strong risk points or challenges.
5. **Price Targets & Ratings**:
   - Short Term Target (3M)
   - Medium Term Target (12M)
   - Long Term Target (3Y)
   - Consensus Recommendation (Strong Buy / Buy / Hold / Sell / Underperform)
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

// ── Mock Fallback Generator ──────────────────────────────────
function generateMockResponse(prompt) {
  const normalized = prompt.toLowerCase();

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

  if (normalized.includes('investment report') || normalized.includes('analyze')) {
    const symbol = (prompt.match(/ticker\s+([a-zA-Z0-9\-\.]+)/i)?.[1] || 'SELECTED SYMBOL').toUpperCase();
    return [
      `# QUANTDESK INVESTMENT REPORT: ${symbol}\n\n`,
      `### 1. Executive Summary\n`,
      `${symbol} exhibits a robust market stance with stable revenue growth driven by core product demand. `,
      `However, current valuation levels reflect near-term pricing momentum, prompting a balanced assessment of its risk-reward profile. `,
      `Our outlook is moderately bullish, tempered by macroeconomic margin pressures.\n\n`,
      `### 2. Key Valuation Metrics\n`,
      `- **Trailing P/E**: Valuation is slightly above historical industry averages, indicating optimistic future growth pricing.\n`,
      `- **Gross Margin**: Strong pricing power is evident from healthy gross margin levels, shielding earnings from inflation.\n`,
      `- **Beta**: Market sensitivity is moderate, aligning closely with benchmark indexes and offering stable portfolio exposure.\n\n`,
      `### 3. Bull Thesis\n`,
      `1. **Market Dominance**: Unrivaled competitive advantage (moat) in core operational segments ensures recurring cash flows.\n`,
      `2. **Balance Sheet Strength**: Positive net-cash position with manageable long-term debt yields excellent financial flexibility.\n`,
      `3. **Margin Expansion**: Ongoing operating cost efficiencies and premiumization are expected to expand net margins by 150bps.\n\n`,
      `### 4. Bear Thesis\n`,
      `1. **Regulatory Risks**: Heightened global antitrust scrutiny may delay new product integrations and increase compliance expenditures.\n`,
      `2. **Valuation Multiple Compression**: If earnings growth slows below 8% annualized, the P/E ratio is highly susceptible to contraction.\n`,
      `3. **Macro Headwinds**: Supply chain variables and exchange-rate fluctuations present transactional margins risk.\n\n`,
      `### 5. Price Targets & Ratings\n`,
      `- **Short Term Target (3M)**: $${(100 + Math.random()*20).toFixed(2)} (Neutral Consolidation)\n`,
      `- **Medium Term Target (12M)**: $${(120 + Math.random()*30).toFixed(2)} (Moderate Upside)\n`,
      `- **Long Term Target (3Y)**: $${(160 + Math.random()*50).toFixed(2)} (Long-Term Growth)\n`,
      `- **Consensus Recommendation**: **BUY**`
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
    return [
      `# AI RISK ADVISORY REPORT\n\n`,
      `### 1. Risk Tolerance Analysis\n`,
      `Your portfolio's volatility parameters represent a classic balanced-to-growth profile. `,
      `Your beta exposure indicates performance moves in lockstep with the broad market, but during high volatility regimes, standard stock correlation increases.\n\n`,
      `### 2. Value at Risk (VaR) Breakdown\n`,
      `A 95% confidence 1-day Value at Risk (VaR) indicates that under normal trading circumstances, there is only a 5% chance of daily portfolio loss exceeding the VaR threshold. `,
      `However, tail risk events (like market panics) can exceed VaR thresholds by multiple factors, requiring strong contingency overlays.\n\n`,
      `### 3. Hedging Recommendations\n`,
      `1. **Tail-Risk Options**: Buy protective put options (5% out-of-the-money) on S&P 500 (SPY) or Nasdaq (QQQ) to cap severe downward drops.\n`,
      `2. **Beta Optimization**: Reallocate a portion of high-beta tech holdings into defensive consumer staples or health-care equities.\n`,
      `3. **Safe Haven Allocations**: Increase cash yield instruments (such as short-term T-bills) to preserve purchasing power and deploy on drawdowns.`
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

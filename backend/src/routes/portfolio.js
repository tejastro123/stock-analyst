const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const PY_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

async function fetchBatchQuotes(symbols, market = 'US') {
  if (!symbols || symbols.length === 0) return {};
  try {
    const res = await axios.post(`${PY_URL}/quotes/batch`, { symbols, market }, { timeout: 15000 });
    return res.data.quotes || {};
  } catch (err) {
    console.error(`Batch quotes fetch failed for market ${market}:`, err.message);
    return {};
  }
}

async function fetchFundamentals(symbol, market = 'US') {
  try {
    const res = await axios.get(`${PY_URL}/fundamentals/${symbol}?market=${market}`, { timeout: 15000 });
    return res.data || {};
  } catch (err) {
    console.error(`Fundamentals fetch failed for ${symbol}:`, err.message);
    return {};
  }
}

// Helper to get or create user's main portfolio
async function getOrCreatePortfolio(userId) {
  const pResult = await pool.query('SELECT * FROM portfolios WHERE user_id = $1 ORDER BY created_at LIMIT 1', [userId]);
  if (pResult.rows[0]) {
    return pResult.rows[0];
  }
  const insertResult = await pool.query(
    'INSERT INTO portfolios (user_id, name) VALUES ($1, $2) RETURNING *',
    [userId, 'Main Portfolio']
  );
  return insertResult.rows[0];
}

// GET /api/portfolio — Get portfolio summary & positions with risk & sector allocation
router.get('/', authenticate, async (req, res) => {
  try {
    const portfolio = await getOrCreatePortfolio(req.user.id);
    const posResult = await pool.query(
      'SELECT * FROM positions WHERE portfolio_id = $1 AND is_open = true ORDER BY symbol',
      [portfolio.id]
    );
    const positions = posResult.rows;

    // Group symbols by market to call batch quotes
    const usSymbols = Array.from(new Set(positions.filter(p => p.market === 'US' || !p.market).map(p => p.symbol)));
    const nseSymbols = Array.from(new Set(positions.filter(p => p.market === 'NSE').map(p => p.symbol)));

    // Fetch quotes and fundamentals in parallel
    const [usQuotes, nseQuotes] = await Promise.all([
      fetchBatchQuotes(usSymbols, 'US'),
      fetchBatchQuotes(nseSymbols, 'NSE')
    ]);

    const quotes = { ...usQuotes, ...nseQuotes };

    // Fetch fundamentals for equity positions to get sector and beta
    const equityPositions = positions.filter(p => p.asset_type === 'equity' || !p.asset_type);
    const fundamentalsList = await Promise.all(
      equityPositions.map(p => fetchFundamentals(p.symbol, p.market || 'US'))
    );

    const fundamentalsMap = {};
    fundamentalsList.forEach(f => {
      if (f && f.symbol) {
        fundamentalsMap[f.symbol.toUpperCase()] = f;
      }
    });

    let totalValue = 0;
    let totalCost = 0;
    let totalDailyPnL = 0;
    let weightedBetaSum = 0;

    const enrichedPositions = positions.map(pos => {
      const sym = pos.symbol.toUpperCase();
      const quote = quotes[sym];
      const fund = fundamentalsMap[sym] || {};

      const qty = parseFloat(pos.quantity);
      const avgCost = parseFloat(pos.avg_cost);
      
      const currentPrice = quote && quote.price ? parseFloat(quote.price) : avgCost;
      const prevClose = quote && quote.prev_close ? parseFloat(quote.prev_close) : currentPrice;

      const marketValue = qty * currentPrice;
      const costBasis = qty * avgCost;
      const unrealizedPnL = marketValue - costBasis;
      const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
      
      const dailyPnL = qty * (currentPrice - prevClose);
      const sector = fund.sector || (pos.asset_type === 'crypto' ? 'Cryptocurrency' : pos.asset_type === 'forex' ? 'Foreign Exchange' : 'Other');
      const beta = fund.beta !== null && fund.beta !== undefined ? parseFloat(fund.beta) : 1.0;

      totalValue += marketValue;
      totalCost += costBasis;
      totalDailyPnL += dailyPnL;

      return {
        id: pos.id,
        symbol: pos.symbol,
        market: pos.market || 'US',
        asset_type: pos.asset_type,
        quantity: qty,
        avg_cost: avgCost,
        current_price: currentPrice,
        market_value: marketValue,
        cost_basis: costBasis,
        unrealized_pnl: unrealizedPnL,
        unrealized_pnl_pct: unrealizedPnLPct,
        daily_pnl: dailyPnL,
        sector,
        beta,
        notes: pos.notes,
        opened_at: pos.opened_at
      };
    });

    const totalPnL = totalValue - totalCost;
    const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    // Calculate allocations
    const assetAllocation = {};
    const sectorAllocation = {};
    
    enrichedPositions.forEach(p => {
      const asset = p.asset_type || 'equity';
      assetAllocation[asset] = (assetAllocation[asset] || 0) + p.market_value;

      const sector = p.sector || 'Other';
      sectorAllocation[sector] = (sectorAllocation[sector] || 0) + p.market_value;

      weightedBetaSum += p.market_value * p.beta;
    });

    // Normalize asset allocation
    const allocationBreakdown = Object.keys(assetAllocation).map(asset => ({
      name: asset.toUpperCase(),
      value: totalValue > 0 ? (assetAllocation[asset] / totalValue) * 100 : 0,
      amount: assetAllocation[asset]
    }));

    // Normalize sector allocation
    const sectorBreakdown = Object.keys(sectorAllocation).map(sec => ({
      name: sec,
      value: totalValue > 0 ? (sectorAllocation[sec] / totalValue) * 100 : 0,
      amount: sectorAllocation[sec]
    })).sort((a, b) => b.value - a.value);

    // Risk Calculations
    const portfolioBeta = totalValue > 0 ? weightedBetaSum / totalValue : 1.0;
    
    // Parametric VaR (95% confidence level, 1-day horizon)
    // Assume S&P 500 daily volatility of ~1.0%. Portfolio volatility is Beta * S&P 500 Volatility.
    const marketDailyVol = 0.01; 
    const portfolioDailyVol = Math.max(0.005, portfolioBeta * marketDailyVol);
    const zScore95 = 1.645;
    const valueAtRisk = totalValue * zScore95 * portfolioDailyVol;

    // Sharpe Ratio Estimation
    // Annualized return = (portfolio_pnl / cost) annualized (say, if held for 1 year, or estimate based on CAPM)
    // Let's estimate Sharpe Ratio: Risk Free Rate is 4.5%. CAPM return = Rf + Beta * ERP (Equity Risk Premium = 5.5%).
    const rfAnnual = 0.045;
    const erpAnnual = 0.055;
    const expectedReturnAnnual = rfAnnual + portfolioBeta * erpAnnual;
    const portfolioAnnualVol = portfolioDailyVol * Math.sqrt(252);
    const sharpeRatio = portfolioAnnualVol > 0 ? (expectedReturnAnnual - rfAnnual) / portfolioAnnualVol : 0;

    res.json({
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        currency: portfolio.currency || 'USD'
      },
      summary: {
        total_value: totalValue,
        total_cost: totalCost,
        total_pnl: totalPnL,
        total_pnl_pct: totalPnLPct,
        daily_pnl: totalDailyPnL,
        allocation: allocationBreakdown,
        sector_breakdown: sectorBreakdown,
        risk_analytics: {
          portfolio_beta: portfolioBeta,
          daily_volatility: portfolioDailyVol * 100, // as percentage
          value_at_risk: valueAtRisk,
          sharpe_ratio: sharpeRatio
        }
      },
      positions: enrichedPositions
    });

  } catch (err) {
    console.error('Error fetching portfolio:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/portfolio/position — Add a position
router.post('/position', authenticate, async (req, res) => {
  const { symbol, market = 'US', asset_type = 'equity', quantity, avg_cost, notes } = req.body;
  if (!symbol || !quantity || !avg_cost) {
    return res.status(400).json({ error: 'Symbol, quantity, and avg_cost are required' });
  }

  try {
    const portfolio = await getOrCreatePortfolio(req.user.id);
    
    // Check if open position already exists
    const checkResult = await pool.query(
      'SELECT id, quantity, avg_cost FROM positions WHERE portfolio_id = $1 AND symbol = $2 AND market = $3 AND is_open = true',
      [portfolio.id, symbol.toUpperCase(), market]
    );

    let result;
    if (checkResult.rows[0]) {
      // Average cost calculation
      const existing = checkResult.rows[0];
      const oldQty = parseFloat(existing.quantity);
      const oldCost = parseFloat(existing.avg_cost);
      const newQty = parseFloat(quantity);
      const newCost = parseFloat(avg_cost);
      
      const totalQty = oldQty + newQty;
      const combinedAvgCost = totalQty > 0 ? ((oldQty * oldCost) + (newQty * newCost)) / totalQty : 0;

      result = await pool.query(
        `UPDATE positions 
         SET quantity = $1, avg_cost = $2, notes = COALESCE($3, notes)
         WHERE id = $4 RETURNING *`,
        [totalQty, combinedAvgCost, notes, existing.id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO positions (portfolio_id, symbol, market, asset_type, quantity, avg_cost, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [portfolio.id, symbol.toUpperCase(), market, asset_type, quantity, avg_cost, notes]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding position:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/portfolio/position/:id — Update position
router.put('/position/:id', authenticate, async (req, res) => {
  const { quantity, avg_cost, notes } = req.body;
  try {
    // Verify ownership
    const portfolio = await getOrCreatePortfolio(req.user.id);
    const posCheck = await pool.query('SELECT id FROM positions WHERE id=$1 AND portfolio_id=$2', [req.params.id, portfolio.id]);
    if (!posCheck.rows[0]) return res.status(404).json({ error: 'Position not found' });

    const result = await pool.query(
      `UPDATE positions 
       SET quantity = COALESCE($1, quantity), avg_cost = COALESCE($2, avg_cost), notes = COALESCE($3, notes)
       WHERE id = $4 RETURNING *`,
      [quantity, avg_cost, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating position:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/portfolio/position/:id — Delete position
router.delete('/position/:id', authenticate, async (req, res) => {
  try {
    // Verify ownership
    const portfolio = await getOrCreatePortfolio(req.user.id);
    const posCheck = await pool.query('SELECT id FROM positions WHERE id=$1 AND portfolio_id=$2', [req.params.id, portfolio.id]);
    if (!posCheck.rows[0]) return res.status(404).json({ error: 'Position not found' });

    await pool.query('DELETE FROM positions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Position removed successfully' });
  } catch (err) {
    console.error('Error deleting position:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

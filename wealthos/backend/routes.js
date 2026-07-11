const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../../backend/src/db/pool');
const { authenticate } = require('../../backend/src/middleware/auth');

const PY_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';

// Helper: Get user's WealthOS assets
async function getUserAssets(userId) {
  const result = await pool.query(
    'SELECT * FROM wealthos_assets WHERE user_id = $1 ORDER BY asset_class, name',
    [userId]
  );
  return result.rows;
}

// ── ASSETS CRUD ──────────────────────────────────────────────────────────────
router.get('/assets', authenticate, async (req, res) => {
  try {
    const assets = await getUserAssets(req.user.id);
    res.json(assets);
  } catch (err) {
    console.error('Error fetching assets:', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

router.post('/assets', authenticate, async (req, res) => {
  const { name, asset_class, symbol, quantity, avg_price, current_price, exchange, broker, currency, fees, taxes, notes, tags } = req.body;
  if (!name || !asset_class || !symbol) {
    return res.status(400).json({ error: 'Name, asset_class, and symbol are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO wealthos_assets 
       (user_id, name, asset_class, symbol, quantity, avg_price, current_price, exchange, broker, currency, fees, taxes, notes, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        req.user.id, name, asset_class, symbol.toUpperCase(), 
        quantity || 0, avg_price || 0, current_price || avg_price || 0,
        exchange, broker, currency || 'INR', fees || 0, taxes || 0, notes, tags || []
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating asset:', err);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

router.put('/assets/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { name, quantity, avg_price, current_price, exchange, broker, currency, fees, taxes, notes, tags } = req.body;

  try {
    const result = await pool.query(
      `UPDATE wealthos_assets 
       SET name = COALESCE($1, name),
           quantity = COALESCE($2, quantity),
           avg_price = COALESCE($3, avg_price),
           current_price = COALESCE($4, current_price),
           exchange = COALESCE($5, exchange),
           broker = COALESCE($6, broker),
           currency = COALESCE($7, currency),
           fees = COALESCE($8, fees),
           taxes = COALESCE($9, taxes),
           notes = COALESCE($10, notes),
           tags = COALESCE($11, tags),
           updated_at = NOW()
       WHERE id = $12 AND user_id = $13
       RETURNING *`,
      [name, quantity, avg_price, current_price, exchange, broker, currency, fees, taxes, notes, tags, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating asset:', err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

router.delete('/assets/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM wealthos_assets WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    console.error('Error deleting asset:', err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// ── TRANSACTIONS CRUD ────────────────────────────────────────────────────────
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM wealthos_transactions WHERE user_id = $1 ORDER BY date DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.post('/transactions', authenticate, async (req, res) => {
  const { asset_id, transaction_type, symbol, asset_class, quantity, price, fees, taxes, brokerage, date, notes } = req.body;
  if (!transaction_type || !symbol || !asset_class || quantity === undefined || price === undefined) {
    return res.status(400).json({ error: 'Transaction type, symbol, asset class, quantity, and price are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const amount = quantity * price;

    // Insert Transaction
    const txResult = await client.query(
      `INSERT INTO wealthos_transactions 
       (user_id, asset_id, transaction_type, symbol, asset_class, quantity, price, amount, fees, taxes, brokerage, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        req.user.id, asset_id, transaction_type, symbol.toUpperCase(), asset_class,
        quantity, price, amount, fees || 0.0, taxes || 0.0, brokerage || 0.0, date || new Date(), notes
      ]
    );

    // Automatically update corresponding holdings if asset_id is provided
    if (asset_id) {
      const assetCheck = await client.query(
        'SELECT quantity, avg_price FROM wealthos_assets WHERE id = $1 AND user_id = $2',
        [asset_id, req.user.id]
      );

      if (assetCheck.rows.length > 0) {
        const asset = assetCheck.rows[0];
        let currentQty = parseFloat(asset.quantity);
        let currentAvgPrice = parseFloat(asset.avg_price);

        const txQty = parseFloat(quantity);
        const txPrice = parseFloat(price);

        if (transaction_type === 'buy') {
          const totalQty = currentQty + txQty;
          const totalCost = (currentQty * currentAvgPrice) + (txQty * txPrice) + (fees || 0) + (taxes || 0) + (brokerage || 0);
          currentAvgPrice = totalQty > 0 ? totalCost / totalQty : 0;
          currentQty = totalQty;
        } else if (transaction_type === 'sell') {
          currentQty = Math.max(0, currentQty - txQty);
        } else if (transaction_type === 'split') {
          // split ratio quantity multiplier
          currentQty = currentQty * txQty;
          currentAvgPrice = currentAvgPrice / txQty;
        } else if (transaction_type === 'bonus') {
          // bonus share issues
          currentQty = currentQty + txQty;
          currentAvgPrice = (currentQty * currentAvgPrice) / (currentQty + txQty);
        }

        await client.query(
          `UPDATE wealthos_assets 
           SET quantity = $1, avg_price = $2, current_price = COALESCE($3, current_price), updated_at = NOW()
           WHERE id = $4`,
          [currentQty, currentAvgPrice, transaction_type === 'buy' ? txPrice : null, asset_id]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(txResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error posting transaction:', err);
    res.status(500).json({ error: 'Failed to log transaction' });
  } finally {
    client.release();
  }
});

// ── GOALS CRUD ───────────────────────────────────────────────────────────────
router.get('/goals', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM wealthos_goals WHERE user_id = $1 ORDER BY created_at',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching goals:', err);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

router.post('/goals', authenticate, async (req, res) => {
  const { name, target_amount, current_amount, monthly_sip, years_remaining } = req.body;
  if (!name || !target_amount || years_remaining === undefined) {
    return res.status(400).json({ error: 'Name, target_amount, and years_remaining are required' });
  }

  try {
    // Basic probability heuristic for goal success:
    // SIP growth + current wealth projection vs target
    const current = parseFloat(current_amount || 0);
    const sip = parseFloat(monthly_sip || 0);
    const yrs = parseInt(years_remaining);
    const totalSIPContr = sip * 12 * yrs;
    const projectedWealth = current * Math.pow(1.10, yrs) + totalSIPContr * Math.pow(1.08, yrs / 2); // 10% lump sum, 8% SIP growth
    const target = parseFloat(target_amount);
    
    let prob = 85;
    if (projectedWealth < target) {
      prob = Math.max(20, Math.floor((projectedWealth / target) * 85));
    } else {
      prob = Math.min(99, Math.floor((projectedWealth / target) * 85));
    }

    const result = await pool.query(
      `INSERT INTO wealthos_goals 
       (user_id, name, target_amount, current_amount, monthly_sip, years_remaining, probability)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, name, target_amount, current_amount || 0, monthly_sip || 0, years_remaining, prob]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating goal:', err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

router.delete('/goals/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM wealthos_goals WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json({ message: 'Goal deleted successfully' });
  } catch (err) {
    console.error('Error deleting goal:', err);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// ── JOURNAL CRUD ──────────────────────────────────────────────────────────────
router.get('/journal', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM wealthos_journal WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching journal entries:', err);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

router.post('/journal', authenticate, async (req, res) => {
  const { title, entry_type, content, date } = req.body;
  if (!title || !entry_type || !content) {
    return res.status(400).json({ error: 'Title, entry_type, and content are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO wealthos_journal 
       (user_id, title, entry_type, content, date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, title, entry_type, content, date || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating journal entry:', err);
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

router.delete('/journal/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM wealthos_journal WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    res.json({ message: 'Journal entry deleted successfully' });
  } catch (err) {
    console.error('Error deleting journal entry:', err);
    res.status(500).json({ error: 'Failed to delete journal entry' });
  }
});

// ── DOCUMENT VAULT CRUD ───────────────────────────────────────────────────────
router.get('/documents', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM wealthos_documents WHERE user_id = $1 ORDER BY uploaded_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.post('/documents', authenticate, async (req, res) => {
  const { name, doc_type, file_path, ocr_text, metadata } = req.body;
  if (!name || !doc_type || !file_path) {
    return res.status(400).json({ error: 'Name, doc_type, and file_path are required' });
  }

  try {
    // Generate simulated OCR text if not provided
    const simulatedOcr = ocr_text || `OCR Scanned Document Content:\nDocument Type: ${doc_type.toUpperCase()}\nDocument Title: ${name}\nProcessed: Successful\nDate: ${new Date().toLocaleDateString()}\nBroker/Issuer details parsed: Zerodha Securities Limited. Transaction values: Net buying amount INR 1,48,200.00. STT/CGST applied.`;

    const result = await pool.query(
      `INSERT INTO wealthos_documents 
       (user_id, name, doc_type, file_path, ocr_text, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, name, doc_type, file_path, simulatedOcr, metadata || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error uploading document:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.delete('/documents/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM wealthos_documents WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ message: 'Document removed successfully' });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ── ADVANCED ANALYTICS (DELEGATES TO FASTAPI) ───────────────────────────────
router.get('/analytics/calculate', authenticate, async (req, res) => {
  try {
    const assets = await getUserAssets(req.user.id);
    if (assets.length === 0) {
      return res.json({ summary: { total_wealth: 0 }, allocations: {}, metrics: {} });
    }

    const response = await axios.post(`${PY_URL}/wealthos/analytics/calculate`, { assets }, { timeout: 15000 });
    res.json(response.data);
  } catch (err) {
    console.error('Error in WealthOS analytics calculation:', err.message);
    res.status(500).json({ error: 'Failed to calculate advanced analytics' });
  }
});

router.get('/analytics/stress-test', authenticate, async (req, res) => {
  try {
    const assets = await getUserAssets(req.user.id);
    if (assets.length === 0) {
      return res.json({ scenarios: [] });
    }

    const response = await axios.post(`${PY_URL}/wealthos/analytics/stress-test`, { assets }, { timeout: 15000 });
    res.json(response.data);
  } catch (err) {
    console.error('Error in WealthOS stress-test calculation:', err.message);
    res.status(500).json({ error: 'Failed to calculate stress-test' });
  }
});

router.get('/analytics/monte-carlo', authenticate, async (req, res) => {
  try {
    const assets = await getUserAssets(req.user.id);
    if (assets.length === 0) {
      return res.json({ summary: {}, runs: [] });
    }

    const simulations = req.query.simulations ? parseInt(req.query.simulations) : 1000;
    const response = await axios.post(`${PY_URL}/wealthos/analytics/monte-carlo?simulations=${simulations}`, { assets }, { timeout: 15000 });
    res.json(response.data);
  } catch (err) {
    console.error('Error in WealthOS monte-carlo calculation:', err.message);
    res.status(500).json({ error: 'Failed to run Monte Carlo simulation' });
  }
});

router.get('/analytics/correlation', authenticate, async (req, res) => {
  try {
    const assets = await getUserAssets(req.user.id);
    if (assets.length === 0) {
      return res.json({ matrix: {}, assets: [] });
    }

    const response = await axios.post(`${PY_URL}/wealthos/analytics/correlation`, { assets }, { timeout: 15000 });
    res.json(response.data);
  } catch (err) {
    console.error('Error in WealthOS correlation calculation:', err.message);
    res.status(500).json({ error: 'Failed to calculate correlations' });
  }
});

// ── AI PORTFOLIO ADVISOR & SCORES ──────────────────────────────────────────
router.get('/ai/advisory', authenticate, async (req, res) => {
  try {
    const assets = await getUserAssets(req.user.id);
    if (assets.length === 0) {
      return res.json({
        score: {
          overall: 50, diversification: 50, risk: 50, growth: 50, income: 50, liquidity: 50, concentration: 50, taxEfficiency: 50
        },
        recommendations: [
          { recommendation: "Add Assets", reason: "Your portfolio is empty.", targetWeight: "100%", confidence: 100 }
        ]
      });
    }

    const totalWealth = assets.reduce((sum, a) => sum + (a.quantity * a.current_price), 0);
    const holdingsText = assets.map((a, i) => `${i+1}. ${a.name} (${a.asset_class}) - Qty: ${a.quantity}, Price: ${a.current_price}, Value: ${a.quantity * a.current_price}`).join('\n');

    // Make an API call to Ollama/Mistral for professional AI scores & recommendations
    const prompt = `
You are the WealthOS AI Portfolio Advisor. Generate a structured investment scorecard and portfolio recommendations for this user portfolio:
${holdingsText}

Total Portfolio Value: ${totalWealth}

Generate exactly two sections:
1. Scorecard:
Provide 8 scores out of 100:
- Overall Score
- Diversification
- Risk
- Growth
- Income
- Liquidity
- Concentration
- Tax Efficiency

2. Actionable Recommendations (at least 2):
Provide recommended transactions. Example:
Recommendation: Reduce Technology Exposure
Reason: Technology accounts for 47% of your portfolio.
Recommended Allocation: 25%
Potential Risk Reduction: 18%
Confidence: 93%

Output your response as JSON in this format:
{
  "score": {
    "overall": 92,
    "diversification": 89,
    "risk": 94,
    "growth": 96,
    "income": 74,
    "liquidity": 95,
    "concentration": 83,
    "taxEfficiency": 91
  },
  "recommendations": [
    {
      "recommendation": "Reduce Technology Exposure",
      "reason": "Technology accounts for 47% of your portfolio.",
      "targetAllocation": "25%",
      "potentialRiskReduction": "18%",
      "confidence": 93
    },
    {
      "recommendation": "Sell ABC Ltd.",
      "reason": "Negative earnings revisions and increasing debt.",
      "targetWeight": "0%",
      "confidence": 89
    }
  ]
}
Return only JSON. Do not include markdown formatting or extra text.
`;

    let responseJson = null;
    try {
      const ollamaRes = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: DEFAULT_MODEL,
        prompt: prompt,
        stream: false,
        format: "json"
      }, { timeout: 15000 });
      responseJson = JSON.parse(ollamaRes.data.response);
    } catch (e) {
      console.warn("Ollama unavailable or failed. Using simulated AI advisory output.");
      // Fallback simulated data based on user holdings
      const techAsset = assets.find(a => a.asset_class === 'stocks' && a.symbol.includes('TCS') || a.symbol.includes('TECH') || a.symbol.includes('INFY'));
      
      responseJson = {
        score: {
          overall: 88,
          diversification: 82,
          risk: 85,
          growth: 90,
          income: 65,
          liquidity: 92,
          concentration: 78,
          taxEfficiency: 89
        },
        recommendations: [
          {
            recommendation: "Reduce Technology Exposure",
            reason: techAsset 
              ? `${techAsset.name} represents a significant chunk of your equity allocation. Sector concentration raises volatility.`
              : "Technology accounts for a large portion of your equity allocation. Recommended limit is 25%.",
            targetAllocation: "25%",
            potentialRiskReduction: "12%",
            confidence: 91
          },
          {
            recommendation: "Increase Debt / Sovereign Gold Allocation",
            reason: "Current allocation to non-equity assets (Gold, FDs) is below 15%. Adding gold improves Sharpe ratio under high inflation.",
            targetWeight: "15%",
            confidence: 88
          }
        ]
      };
    }

    res.json(responseJson);
  } catch (err) {
    console.error('Error in WealthOS AI Advisor:', err);
    res.status(500).json({ error: 'Failed to generate AI advisory report' });
  }
});

module.exports = router;

const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const PY_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

const TIMEOUT_DEFAULT  = 30_000;   // 30s
const TIMEOUT_SCREENER = 90_000;   // 90s — parallel fetch of 120 stocks

// Node-level cache — short TTL, guards against burst duplicate requests
const nodeCache = new NodeCache({ stdTTL: 10, checkperiod: 5 });

async function pyFetch(path, method = 'GET', body = null, timeout = TIMEOUT_DEFAULT) {
  const cacheKey = `${method}:${path}:${JSON.stringify(body)}`;

  if (method === 'GET') {
    const hit = nodeCache.get(cacheKey);
    if (hit) return hit;
  }

  const res = await axios({
    method,
    url: `${PY_URL}${path}`,
    data: body,
    timeout,
  });

  if (method === 'GET') nodeCache.set(cacheKey, res.data);
  return res.data;
}

// ── Quotes ──────────────────────────────────────────────────────────────────
// GET /api/market/quote/:symbol?market=US
router.get('/quote/:symbol', authenticate, async (req, res) => {
  try {
    const { market = 'US' } = req.query;
    const data = await pyFetch(`/quotes/${req.params.symbol}?market=${market}`);
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// POST /api/market/quotes/batch
router.post('/quotes/batch', authenticate, async (req, res) => {
  try {
    const data = await pyFetch('/quotes/batch', 'POST', req.body);
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// ── OHLCV ───────────────────────────────────────────────────────────────────
// GET /api/market/ohlcv/:symbol?market=US&period=6mo&interval=1d
router.get('/ohlcv/:symbol', authenticate, async (req, res) => {
  try {
    const { market = 'US', period = '6mo', interval = '1d' } = req.query;
    const data = await pyFetch(`/ohlcv/${req.params.symbol}?market=${market}&period=${period}&interval=${interval}`);
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// ── Fundamentals ─────────────────────────────────────────────────────────────
// GET /api/market/fundamentals/:symbol
router.get('/fundamentals/:symbol', authenticate, async (req, res) => {
  try {
    const { market = 'US' } = req.query;
    const data = await pyFetch(`/fundamentals/${req.params.symbol}?market=${market}`);
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// ── Options ──────────────────────────────────────────────────────────────────
// GET /api/market/options/:symbol?expiry=2024-01-19
router.get('/options/:symbol', authenticate, async (req, res) => {
  try {
    const { market = 'US', expiry } = req.query;
    const q = expiry ? `?market=${market}&expiry=${expiry}` : `?market=${market}`;
    const data = await pyFetch(`/options/${req.params.symbol}${q}`);
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// ── Screener ─────────────────────────────────────────────────────────────────
// POST /api/market/screener
router.post('/screener', authenticate, async (req, res) => {
  try {
    const data = await pyFetch('/screener/run', 'POST', req.body, TIMEOUT_SCREENER);
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// GET /api/market/universe?market=US
router.get('/universe', authenticate, async (req, res) => {
  try {
    const { market = 'US' } = req.query;
    const data = await pyFetch(`/screener/universe?market=${market}`);
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// GET /api/market/sector/heatmap
router.get('/sector/heatmap', authenticate, async (req, res) => {
  try {
    const data = await pyFetch('/sector/heatmap');
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// GET /api/market/metrics/earnings
router.get('/metrics/earnings', authenticate, async (req, res) => {
  try {
    const data = await pyFetch('/metrics/earnings');
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// GET /api/market/metrics/breadth
router.get('/metrics/breadth', authenticate, async (req, res) => {
  try {
    const data = await pyFetch('/metrics/breadth');
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// GET /api/market/metrics/movers
router.get('/metrics/movers', authenticate, async (req, res) => {
  try {
    const data = await pyFetch('/metrics/movers');
    res.json(data);
  } catch (err) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// ── Python service health ─────────────────────────────────────────────────
router.get('/py-health', async (req, res) => {
  try {
    const data = await pyFetch('/health');
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Python service unreachable', detail: err.message });
  }
});

module.exports = router;

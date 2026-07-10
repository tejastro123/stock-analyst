const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/users/watchlists
router.get('/watchlists', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.id, w.name, w.is_default,
              json_agg(json_build_object('symbol', ws.symbol, 'market', ws.market, 'added_at', ws.added_at)
                ORDER BY ws.added_at) FILTER (WHERE ws.id IS NOT NULL) AS symbols
       FROM watchlists w
       LEFT JOIN watchlist_symbols ws ON ws.watchlist_id = w.id
       WHERE w.user_id = $1
       GROUP BY w.id ORDER BY w.is_default DESC, w.created_at`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/watchlists
router.post('/watchlists', authenticate, authorize('trader', 'admin'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = await pool.query(
      `INSERT INTO watchlists (user_id, name) VALUES ($1, $2) RETURNING *`,
      [req.user.id, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/watchlists/:id/symbols
router.post('/watchlists/:id/symbols', authenticate, authorize('trader', 'admin'), async (req, res) => {
  const { symbol, market = 'US' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  try {
    // Verify ownership
    const wl = await pool.query('SELECT id FROM watchlists WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!wl.rows[0]) return res.status(404).json({ error: 'Watchlist not found' });

    const result = await pool.query(
      `INSERT INTO watchlist_symbols (watchlist_id, symbol, market) VALUES ($1, $2, $3)
       ON CONFLICT (watchlist_id, symbol) DO NOTHING RETURNING *`,
      [req.params.id, symbol.toUpperCase(), market]
    );
    res.status(201).json(result.rows[0] || { message: 'Already exists' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/watchlists/:id/symbols/:symbol
router.delete('/watchlists/:id/symbols/:symbol', authenticate, authorize('trader', 'admin'), async (req, res) => {
  try {
    const wl = await pool.query('SELECT id FROM watchlists WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!wl.rows[0]) return res.status(404).json({ error: 'Watchlist not found' });

    await pool.query(
      `DELETE FROM watchlist_symbols WHERE watchlist_id=$1 AND symbol=$2`,
      [req.params.id, req.params.symbol.toUpperCase()]
    );
    res.json({ message: 'Removed' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/settings
router.get('/settings', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_settings WHERE user_id=$1', [req.user.id]);
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/settings
router.patch('/settings', authenticate, authorize('trader', 'admin'), async (req, res) => {
  const { theme, default_market, currency, timezone, layout_config } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO user_settings (user_id, theme, default_market, currency, timezone, layout_config)
       VALUES ($6, $1, $2, $3, $4, COALESCE($5::jsonb, '{}'::jsonb))
       ON CONFLICT (user_id) DO UPDATE SET
         theme = COALESCE(EXCLUDED.theme, user_settings.theme),
         default_market = COALESCE(EXCLUDED.default_market, user_settings.default_market),
         currency = COALESCE(EXCLUDED.currency, user_settings.currency),
         timezone = COALESCE(EXCLUDED.timezone, user_settings.timezone),
         layout_config = COALESCE(EXCLUDED.layout_config, user_settings.layout_config),
         updated_at = NOW()
       RETURNING *`,
      [theme, default_market, currency, timezone, layout_config ? JSON.stringify(layout_config) : null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Settings upsert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

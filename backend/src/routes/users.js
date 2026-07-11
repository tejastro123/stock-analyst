const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/users/watchlists
router.get('/watchlists', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.id, w.name, w.is_default, w.folder,
              json_agg(json_build_object('symbol', ws.symbol, 'market', ws.market, 'added_at', ws.added_at, 'tags', ws.tags, 'notes', ws.notes)
                ORDER BY ws.added_at) FILTER (WHERE ws.id IS NOT NULL) AS symbols
       FROM watchlists w
       LEFT JOIN watchlist_symbols ws ON ws.watchlist_id = w.id
       WHERE w.user_id = $1
       GROUP BY w.id, w.folder ORDER BY w.is_default DESC, w.created_at`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/watchlists
router.post('/watchlists', authenticate, authorize('trader', 'admin'), async (req, res) => {
  const { name, folder = null } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = await pool.query(
      `INSERT INTO watchlists (user_id, name, folder) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, name, folder]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/watchlists/:id
router.patch('/watchlists/:id', authenticate, authorize('trader', 'admin'), async (req, res) => {
  const { name, folder } = req.body;
  try {
    const result = await pool.query(
      `UPDATE watchlists 
       SET name = COALESCE($3, name),
           folder = COALESCE($4, folder)
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id, name, folder]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Watchlist not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/watchlists/:id
router.delete('/watchlists/:id', authenticate, authorize('trader', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM watchlists WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Watchlist not found' });
    res.json({ message: 'Watchlist deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/watchlists/:id/symbols
router.post('/watchlists/:id/symbols', authenticate, authorize('trader', 'admin'), async (req, res) => {
  const { symbol, market = 'US' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  try {
    const wl = await pool.query('SELECT id FROM watchlists WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!wl.rows[0]) return res.status(404).json({ error: 'Watchlist not found' });

    const result = await pool.query(
      `INSERT INTO watchlist_symbols (watchlist_id, symbol, market, tags, notes) 
       VALUES ($1, $2, $3, '[]'::jsonb, '')
       ON CONFLICT (watchlist_id, symbol) DO NOTHING RETURNING *`,
      [req.params.id, symbol.toUpperCase(), market]
    );
    res.status(201).json(result.rows[0] || { message: 'Already exists' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/watchlists/:id/symbols/:symbol
router.put('/watchlists/:id/symbols/:symbol', authenticate, authorize('trader', 'admin'), async (req, res) => {
  const { tags, notes } = req.body;
  try {
    const wl = await pool.query('SELECT id FROM watchlists WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!wl.rows[0]) return res.status(404).json({ error: 'Watchlist not found' });

    const result = await pool.query(
      `UPDATE watchlist_symbols 
       SET tags = COALESCE($3::jsonb, tags),
           notes = COALESCE($4, notes)
       WHERE watchlist_id = $1 AND symbol = $2
       RETURNING *`,
      [req.params.id, req.params.symbol.toUpperCase(), tags ? JSON.stringify(tags) : null, notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
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
    console.error(err);
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

// GET /api/users/screener-presets
router.get('/screener-presets', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM screener_presets WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/screener-presets
router.post('/screener-presets', authenticate, authorize('trader', 'admin'), async (req, res) => {
  const { name, filters } = req.body;
  if (!name || !filters) return res.status(400).json({ error: 'Name and filters required' });
  try {
    const result = await pool.query(
      `INSERT INTO screener_presets (user_id, name, filters)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id, name) DO UPDATE SET
         filters = EXCLUDED.filters,
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, name, JSON.stringify(filters)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Screener preset save error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/screener-presets/:name
router.delete('/screener-presets/:name', authenticate, authorize('trader', 'admin'), async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM screener_presets WHERE user_id = $1 AND name = $2`,
      [req.user.id, req.params.name]
    );
    res.json({ message: 'Preset deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Route: GET /api/users/list
router.get('/list', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, username, role, full_name, avatar_url, is_active, last_login, created_at FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to retrieve user list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Route: PATCH /api/users/:id/role
router.patch('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'trader', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot modify your own role' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, role`,
      [role, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update user role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Route: PATCH /api/users/:id/status
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  const { is_active } = req.body;
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'Status is_active must be boolean' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot disable your own account' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, is_active`,
      [is_active, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!is_active) {
      await pool.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [req.params.id]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update user status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Route: POST /api/users/create
const bcrypt = require('bcryptjs');
router.post('/create', authenticate, authorize('admin'), async (req, res) => {
  const { email, username, password, role, full_name } = req.body;
  if (!email || !username || !password || !role) {
    return res.status(400).json({ error: 'Email, username, password, and role are required' });
  }
  if (!['admin', 'trader', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const exists = await pool.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2',
      [email, username]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username already taken' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash, role, full_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, username, role, full_name, created_at`,
      [email, username, password_hash, role, full_name || null]
    );
    const user = result.rows[0];

    // Seed defaults
    await pool.query(
      `INSERT INTO watchlists (user_id, name, is_default) VALUES ($1, 'My Watchlist', true)`,
      [user.id]
    );
    await pool.query(
      `INSERT INTO portfolios (user_id, name) VALUES ($1, 'Main Portfolio')`,
      [user.id]
    );
    await pool.query(
      `INSERT INTO user_settings (user_id) VALUES ($1)`,
      [user.id]
    );

    res.status(201).json(user);
  } catch (err) {
    console.error('Failed to admin-create user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

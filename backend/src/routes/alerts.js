const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/alerts - List all alerts for the user
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to get alerts:', err);
    res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

// POST /api/alerts - Create an alert
router.post('/', authenticate, authorize('trader', 'admin'), async (req, res) => {
  const { symbol, alert_type, threshold, message, market } = req.body;
  
  if (!symbol || !alert_type) {
    return res.status(400).json({ error: 'Symbol and alert type are required' });
  }

  // Validate alert type
  const validTypes = ['price_above', 'price_below', 'volume_spike', 'rsi_overbought', 'rsi_oversold', 'macd_cross'];
  if (!validTypes.includes(alert_type)) {
    return res.status(400).json({ error: 'Invalid alert type' });
  }

  try {
    let resolvedMarket = market;
    if (!resolvedMarket) {
      const userSettings = await pool.query('SELECT default_market FROM user_settings WHERE user_id = $1', [req.user.id]);
      resolvedMarket = userSettings.rows.length > 0 ? userSettings.rows[0].default_market : 'NSE';
    }

    const result = await pool.query(
      `INSERT INTO alerts (user_id, symbol, alert_type, threshold, message, is_active, triggered, market)
       VALUES ($1, $2, $3, $4, $5, true, false, $6)
       RETURNING *`,
      [req.user.id, symbol.toUpperCase(), alert_type, threshold || null, message || '', resolvedMarket]
    );
    res.status(210).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to create alert:', err);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// POST /api/alerts/:id/toggle - Enable/Disable an alert
router.post('/:id/toggle', authenticate, authorize('trader', 'admin'), async (req, res) => {
  try {
    const check = await pool.query('SELECT * FROM alerts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const newStatus = !check.rows[0].is_active;
    const result = await pool.query(
      'UPDATE alerts SET is_active = $1, triggered = false WHERE id = $2 RETURNING *',
      [newStatus, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to toggle alert:', err);
    res.status(500).json({ error: 'Failed to update alert status' });
  }
});

// DELETE /api/alerts/:id - Delete an alert
router.delete('/:id', authenticate, authorize('trader', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM alerts WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ success: true, message: 'Alert deleted successfully' });
  } catch (err) {
    console.error('Failed to delete alert:', err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

module.exports = router;

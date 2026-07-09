const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const Joi = require('joi');

const pool = require('../db/pool');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

// ── Schemas ─────────────────────────────────────────────────────────────────
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).required(),
  full_name: Joi.string().max(255).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', validate(registerSchema), async (req, res) => {
  const { email, username, password, full_name } = req.body;
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
      `INSERT INTO users (email, username, password_hash, full_name)
       VALUES ($1, $2, $3, $4) RETURNING id, email, username, role, full_name, created_at`,
      [email, username, password_hash, full_name || null]
    );
    const user = result.rows[0];

    // Create default watchlist + portfolio + settings
    const wl = await pool.query(
      `INSERT INTO watchlists (user_id, name, is_default) VALUES ($1, $2, true) RETURNING id`,
      [user.id, 'My Watchlist']
    );
    await pool.query(
      `INSERT INTO portfolios (user_id, name) VALUES ($1, 'Main Portfolio')`,
      [user.id]
    );
    await pool.query(
      `INSERT INTO user_settings (user_id) VALUES ($1)`,
      [user.id]
    );

    const tokenPayload = { id: user.id, email: user.email, username: user.username, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Store hashed refresh token
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    res.status(201).json({ accessToken, refreshToken, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT id, email, username, password_hash, role, full_name, is_active FROM users WHERE email=$1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

    const tokenPayload = { id: user.id, email: user.email, username: user.username, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const { password_hash, ...safeUser } = user;
    res.json({ accessToken, refreshToken, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const stored = await pool.query(
      `SELECT id, revoked, expires_at FROM refresh_tokens WHERE token_hash=$1 AND user_id=$2`,
      [tokenHash, payload.id]
    );

    if (stored.rows.length === 0 || stored.rows[0].revoked) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    if (new Date(stored.rows[0].expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const userResult = await pool.query(
      `SELECT id, email, username, role, is_active FROM users WHERE id=$1`,
      [payload.id]
    );
    if (!userResult.rows[0]?.is_active) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    const user = userResult.rows[0];
    const newAccessToken = signAccessToken({ id: user.id, email: user.email, username: user.username, role: user.role });
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  try {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await pool.query(
        `UPDATE refresh_tokens SET revoked=true WHERE token_hash=$1`,
        [tokenHash]
      );
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.username, u.role, u.full_name, u.avatar_url, u.created_at, u.last_login,
              s.theme, s.default_market, s.currency, s.timezone
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.id=$1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const pool = require('./db/pool');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const marketRoutes = require('./routes/market');
const portfolioRoutes = require('./routes/portfolio');
const aiRoutes = require('./routes/ai');
const reportsRoutes = require('./routes/reports');
const alertsRoutes = require('./routes/alerts');
const { initAlertEngine } = require('./services/alertEngine');

// ── Boot-time schema guard ───────────────────────────────────────────────────
// Ensures critical tables exist even if user skipped npm run db:migrate
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme         VARCHAR(20) DEFAULT 'dark',
        default_market VARCHAR(10) DEFAULT 'IN',
        currency      VARCHAR(10) DEFAULT 'INR',
        timezone      VARCHAR(50) DEFAULT 'IST',
        layout_config JSONB DEFAULT '{}',
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
      -- Migrate default constraints for existing tables
      ALTER TABLE user_settings ALTER COLUMN default_market SET DEFAULT 'IN';
      ALTER TABLE user_settings ALTER COLUMN currency SET DEFAULT 'INR';
      ALTER TABLE user_settings ALTER COLUMN timezone SET DEFAULT 'IST';
      -- Migrate existing records
      UPDATE user_settings SET default_market = 'IN' WHERE default_market = 'US';
      UPDATE user_settings SET currency = 'INR' WHERE currency = 'USD';
      UPDATE user_settings SET timezone = 'IST' WHERE timezone = 'UTC' OR timezone = 'EST';
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS trigger_price DECIMAL(18,6);
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS market VARCHAR(10) DEFAULT 'NSE';

      CREATE TABLE IF NOT EXISTS screener_presets (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       VARCHAR(100) NOT NULL,
        filters    JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_screener_presets_user ON screener_presets(user_id);

      CREATE TABLE IF NOT EXISTS portfolio_history (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        recorded_on  DATE NOT NULL DEFAULT CURRENT_DATE,
        total_value  DECIMAL(18, 6) NOT NULL,
        cash_balance DECIMAL(18, 6) DEFAULT 0.0,
        equity_value DECIMAL(18, 6) DEFAULT 0.0,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(portfolio_id, recorded_on)
      );
      CREATE INDEX IF NOT EXISTS idx_portfolio_history_portfolio ON portfolio_history(portfolio_id);
    `);
  } catch (err) {
    console.warn('⚠ Schema ensure warning (non-fatal):', err.message);
  } finally {
    client.release();
  }
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // disable CSP helper if it conflicts with locally-loaded resources
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Electron, or curl)
    if (!origin || origin === 'null' || origin.startsWith('file://') || origin.startsWith('http://localhost') || origin.startsWith('vscode-webview://')) {
      callback(null, true);
    } else {
      callback(null, false); // Block other origins safely
    }
  },
  credentials: true,
}));

// ── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts.' },
});

app.use(limiter);

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/alerts', alertsRoutes);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── WebSocket & Start ────────────────────────────────────────────────────────
initAlertEngine(server);

(async () => {
  await ensureSchema();
  server.listen(PORT, () => {
    console.log(`\n🚀 QuantDesk API running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
    console.log(`👤 Users: http://localhost:${PORT}/api/users\n`);
  });
})();

module.exports = server;

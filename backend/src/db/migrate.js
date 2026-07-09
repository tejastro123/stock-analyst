require('dotenv').config();
const pool = require('./pool');

const schema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS & AUTH
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) DEFAULT 'trader' CHECK (role IN ('admin', 'trader', 'viewer')),
  full_name     VARCHAR(255),
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked    BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- =====================
-- WATCHLISTS
-- =====================
CREATE TABLE IF NOT EXISTS watchlists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist_symbols (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol       VARCHAR(20) NOT NULL,
  market       VARCHAR(10) DEFAULT 'US',
  added_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON watchlists(user_id);

-- =====================
-- PORTFOLIO
-- =====================
CREATE TABLE IF NOT EXISTS portfolios (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL DEFAULT 'Main Portfolio',
  currency   VARCHAR(10) DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id   UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol         VARCHAR(20) NOT NULL,
  market         VARCHAR(10) DEFAULT 'US',
  asset_type     VARCHAR(20) DEFAULT 'equity' CHECK (asset_type IN ('equity', 'option', 'crypto', 'forex', 'futures')),
  quantity       DECIMAL(18, 6) NOT NULL,
  avg_cost       DECIMAL(18, 6) NOT NULL,
  opened_at      TIMESTAMPTZ DEFAULT NOW(),
  closed_at      TIMESTAMPTZ,
  is_open        BOOLEAN DEFAULT true,
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);

-- =====================
-- ALERTS
-- =====================
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol      VARCHAR(20) NOT NULL,
  alert_type  VARCHAR(30) NOT NULL CHECK (alert_type IN ('price_above', 'price_below', 'volume_spike', 'rsi_overbought', 'rsi_oversold', 'macd_cross')),
  threshold   DECIMAL(18, 6),
  message     TEXT,
  is_active   BOOLEAN DEFAULT true,
  triggered   BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);

-- =====================
-- USER SETTINGS
-- =====================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme         VARCHAR(20) DEFAULT 'bloomberg-dark',
  default_market VARCHAR(10) DEFAULT 'US',
  currency      VARCHAR(10) DEFAULT 'USD',
  timezone      VARCHAR(50) DEFAULT 'America/New_York',
  layout_config JSONB DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- MARKET DATA CACHE (TimescaleDB-ready, plain PG for now)
-- =====================
CREATE TABLE IF NOT EXISTS price_cache (
  symbol     VARCHAR(20) NOT NULL,
  market     VARCHAR(10) DEFAULT 'US',
  price      DECIMAL(18, 6),
  change_pct DECIMAL(8, 4),
  volume     BIGINT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (symbol, market)
);

-- =====================
-- AUDIT LOG
-- =====================
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id),
  action     VARCHAR(100) NOT NULL,
  resource   VARCHAR(100),
  metadata   JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations...');
    await client.query(schema);
    console.log('✅ Database schema created successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));

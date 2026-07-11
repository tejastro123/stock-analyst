const pool = require('./pool');

async function ensureEnterpriseSchema() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Enterprise & Family schema migrations...');

    // 1. Family Groups
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_groups (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Family Members
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_members (
        family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role            VARCHAR(20) DEFAULT 'member' CHECK (role IN ('head', 'member')),
        PRIMARY KEY (family_group_id, user_id)
      );
    `);

    // 3. Advisor Clients
    await client.query(`
      CREATE TABLE IF NOT EXISTS advisor_clients (
        advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status     VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (advisor_id, client_id)
      );
    `);

    // 4. Shared Resources
    await client.query(`
      CREATE TABLE IF NOT EXISTS shared_resources (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resource_type       VARCHAR(20) NOT NULL CHECK (resource_type IN ('watchlist', 'portfolio', 'report')),
        resource_id         UUID NOT NULL,
        shared_by           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shared_to_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
        shared_to_family_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
        permission          VARCHAR(10) DEFAULT 'read' CHECK (permission IN ('read', 'write')),
        created_at          TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. Encrypted Credentials
    await client.query(`
      CREATE TABLE IF NOT EXISTS encrypted_credentials (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service_name  VARCHAR(50) NOT NULL,
        encrypted_data TEXT NOT NULL,
        iv            VARCHAR(32) NOT NULL,
        auth_tag      VARCHAR(32) NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 6. Exchange Rates
    await client.query(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        from_currency VARCHAR(10) NOT NULL,
        to_currency   VARCHAR(10) NOT NULL,
        rate          DECIMAL(18, 6) NOT NULL,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (from_currency, to_currency)
      );
    `);

    // 7. API Keys
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash     VARCHAR(64) NOT NULL UNIQUE,
        key_prefix   VARCHAR(8) NOT NULL,
        name         VARCHAR(100) NOT NULL,
        permissions  JSONB DEFAULT '["read"]'::jsonb,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        expires_at   TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ
      );
    `);

    // 8. Webhook Subscriptions
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url          TEXT NOT NULL,
        secret_token VARCHAR(255) NOT NULL,
        event_types  TEXT[] NOT NULL,
        is_active    BOOLEAN DEFAULT true,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 9. Scheduled Reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_reports (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_type     VARCHAR(20) NOT NULL CHECK (report_type IN ('portfolio', 'watchlist', 'market')),
        format          VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'excel')),
        frequency       VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
        email_recipient VARCHAR(255) NOT NULL,
        next_run        TIMESTAMPTZ NOT NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed mock exchange rates if empty
    const countRes = await client.query('SELECT COUNT(*) FROM exchange_rates');
    if (parseInt(countRes.rows[0].count) === 0) {
      console.log('🌱 Seeding exchange rates (USD, INR, EUR)...');
      await client.query(`
        INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
        ('USD', 'INR', 83.50),
        ('INR', 'USD', 0.012),
        ('USD', 'EUR', 0.92),
        ('EUR', 'USD', 1.09),
        ('EUR', 'INR', 90.76),
        ('INR', 'EUR', 0.011),
        ('USD', 'USD', 1.00),
        ('INR', 'INR', 1.00),
        ('EUR', 'EUR', 1.00)
      `);
    }

    console.log('✅ Enterprise & Family schema migrated.');
  } catch (err) {
    console.error('❌ Enterprise & Family migration failed:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { ensureEnterpriseSchema };

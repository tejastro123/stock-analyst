const pool = require('../../backend/src/db/pool');

async function ensureWealthOSSchema() {
  const client = await pool.connect();
  try {
    console.log('🔄 Creating WealthOS database tables...');
    
    // 1. Assets Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wealthos_assets (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name          VARCHAR(100) NOT NULL,
        asset_class   VARCHAR(50) NOT NULL CHECK (asset_class IN (
          'stocks', 'etfs', 'mutual_funds', 'index_funds', 'bonds', 'gold', 'silver', 
          'reits', 'crypto', 'options', 'futures', 'fixed_deposits', 'ppf', 'epf', 
          'nps', 'cash', 'foreign_equities', 'commodities'
        )),
        symbol        VARCHAR(50) NOT NULL,
        quantity      DECIMAL(18, 6) NOT NULL DEFAULT 0.0,
        avg_price     DECIMAL(18, 6) NOT NULL DEFAULT 0.0,
        current_price DECIMAL(18, 6) NOT NULL DEFAULT 0.0,
        exchange      VARCHAR(50),
        broker        VARCHAR(50),
        currency      VARCHAR(10) DEFAULT 'INR',
        fees          DECIMAL(18, 6) DEFAULT 0.0,
        taxes         DECIMAL(18, 6) DEFAULT 0.0,
        dividend      DECIMAL(18, 6) DEFAULT 0.0,
        notes         TEXT,
        tags          TEXT[] DEFAULT '{}',
        attachments   JSONB DEFAULT '[]',
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wealthos_assets_user ON wealthos_assets(user_id);
    `);

    // 2. Transactions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wealthos_transactions (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        asset_id         UUID REFERENCES wealthos_assets(id) ON DELETE SET NULL,
        transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
          'buy', 'sell', 'split', 'bonus', 'dividend', 'rights_issue', 'ipo', 
          'transfer', 'gift', 'inheritance', 'corporate_action', 'interest', 
          'fees', 'taxes', 'brokerage'
        )),
        symbol           VARCHAR(50) NOT NULL,
        asset_class      VARCHAR(50) NOT NULL,
        quantity         DECIMAL(18, 6) NOT NULL DEFAULT 0.0,
        price            DECIMAL(18, 6) NOT NULL DEFAULT 0.0,
        amount           DECIMAL(18, 6) NOT NULL DEFAULT 0.0,
        fees             DECIMAL(18, 6) DEFAULT 0.0,
        taxes            DECIMAL(18, 6) DEFAULT 0.0,
        brokerage        DECIMAL(18, 6) DEFAULT 0.0,
        date             TIMESTAMPTZ DEFAULT NOW(),
        notes            TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_wealthos_txs_user ON wealthos_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_wealthos_txs_asset ON wealthos_transactions(asset_id);
    `);

    // 3. Goals Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wealthos_goals (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        target_amount   DECIMAL(18, 2) NOT NULL,
        current_amount  DECIMAL(18, 2) NOT NULL DEFAULT 0.0,
        monthly_sip     DECIMAL(18, 2) NOT NULL DEFAULT 0.0,
        years_remaining INT NOT NULL,
        probability     DECIMAL(5, 2) DEFAULT 80.0,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wealthos_goals_user ON wealthos_goals(user_id);
    `);

    // 4. Portfolio Journal Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wealthos_journal (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title        VARCHAR(200) NOT NULL,
        entry_type   VARCHAR(50) NOT NULL CHECK (entry_type IN (
          'buy_rationale', 'sell_rationale', 'thesis', 'post_trade', 'lesson'
        )),
        content      TEXT NOT NULL,
        date         DATE DEFAULT CURRENT_DATE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wealthos_journal_user ON wealthos_journal(user_id);
    `);

    // 5. Document Vault Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wealthos_documents (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        VARCHAR(255) NOT NULL,
        doc_type    VARCHAR(50) NOT NULL CHECK (doc_type IN (
          'contract_note', 'tax_doc', 'broker_statement', 'dividend_statement', 
          'annual_report', 'research_note'
        )),
        file_path   TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ DEFAULT NOW(),
        ocr_text    TEXT,
        metadata    JSONB DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_wealthos_docs_user ON wealthos_documents(user_id);
    `);

    console.log('✅ WealthOS database tables initialized.');

    // ── Seeding Code ──
    const userResult = await client.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
    if (userResult.rows.length > 0) {
      const adminId = userResult.rows[0].id;
      
      // Check if assets already exist for admin
      const assetCountResult = await client.query("SELECT COUNT(*) FROM wealthos_assets WHERE user_id = $1", [adminId]);
      const assetCount = parseInt(assetCountResult.rows[0].count);

      if (assetCount === 0) {
        console.log('🌱 Seeding sample WealthOS data for admin...');

        // 1. Seed Assets
        const assetsToSeed = [
          { name: 'Tata Consultancy Services', asset_class: 'stocks', symbol: 'TCS', quantity: 20, avg_price: 3300, current_price: 3450, exchange: 'NSE', broker: 'Zerodha' },
          { name: 'Reliance Industries', asset_class: 'stocks', symbol: 'RELIANCE', quantity: 25, avg_price: 2450, current_price: 2600, exchange: 'NSE', broker: 'Groww' },
          { name: 'Nippon India ETF Gold BeES', asset_class: 'gold', symbol: 'GOLDBEES', quantity: 150, avg_price: 52, current_price: 61, exchange: 'NSE', broker: 'Zerodha' },
          { name: 'Parag Parikh Flexi Cap Fund', asset_class: 'mutual_funds', symbol: 'PPFAS', quantity: 1500, avg_price: 45, current_price: 55, broker: 'Kuvera' },
          { name: 'SBI Fixed Deposit', asset_class: 'fixed_deposits', symbol: 'FD_SBI', quantity: 1, avg_price: 300000, current_price: 318000, broker: 'SBI' },
          { name: 'Public Provident Fund', asset_class: 'ppf', symbol: 'PPF_GOV', quantity: 1, avg_price: 150000, current_price: 161000 },
          { name: 'Employees Provident Fund', asset_class: 'epf', symbol: 'EPF_MEM', quantity: 1, avg_price: 250000, current_price: 272000 },
          { name: 'NPS Tier 1 Scheme E', asset_class: 'nps', symbol: 'NPS_T1', quantity: 1, avg_price: 100000, current_price: 114000 },
          { name: 'Bitcoin', asset_class: 'crypto', symbol: 'BTC', quantity: 0.05, avg_price: 3500000, current_price: 4750000, broker: 'CoinDCX' }
        ];

        for (const a of assetsToSeed) {
          const res = await client.query(
            `INSERT INTO wealthos_assets 
             (user_id, name, asset_class, symbol, quantity, avg_price, current_price, exchange, broker, currency)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'INR')
             RETURNING id`,
            [adminId, a.name, a.asset_class, a.symbol, a.quantity, a.avg_price, a.current_price, a.exchange || null, a.broker || null]
          );

          // Seed a BUY transaction for each asset
          if (res.rows.length > 0) {
            const assetId = res.rows[0].id;
            await client.query(
              `INSERT INTO wealthos_transactions 
               (user_id, asset_id, transaction_type, symbol, asset_class, quantity, price, amount, date, notes)
               VALUES ($1, $2, 'buy', $3, $4, $5, $6, $7, NOW() - INTERVAL '6 months', 'Initial position seeding')`,
              [adminId, assetId, a.symbol, a.asset_class, a.quantity, a.avg_price, a.quantity * a.avg_price]
            );
          }
        }

        // 2. Seed Goals
        const goalsToSeed = [
          { name: 'Retirement Corpus', target_amount: 50000000, current_amount: 1700000, monthly_sip: 25000, years_remaining: 15, probability: 82 },
          { name: 'Child Higher Education', target_amount: 8000000, current_amount: 500000, monthly_sip: 12000, years_remaining: 8, probability: 74 },
          { name: 'Buy Luxury SUV', target_amount: 3000000, current_amount: 400000, monthly_sip: 10000, years_remaining: 5, probability: 68 }
        ];

        for (const g of goalsToSeed) {
          await client.query(
            `INSERT INTO wealthos_goals 
             (user_id, name, target_amount, current_amount, monthly_sip, years_remaining, probability)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [adminId, g.name, g.target_amount, g.current_amount, g.monthly_sip, g.years_remaining, g.probability]
          );
        }

        // 3. Seed Journal Entries
        await client.query(
          `INSERT INTO wealthos_journal 
           (user_id, title, entry_type, content, date)
           VALUES 
           ($1, 'Initiated Gold ETF Hedge Position', 'buy_rationale', 'US inflation expectations and macro risks are rising. Adding Gold BeES to hedge domestic equity volatility. Target allocation 10%.', CURRENT_DATE - 3),
           ($1, 'Lessons from recent midcap drawdown', 'lesson', 'Trimmed excess speculative microcap exposure. Lesson: Always prioritize liquid fixed income buffer (PPF/EPF/FD) representing at least 25% of total wealth.', CURRENT_DATE - 15)`,
          [adminId]
        );

        // 4. Seed Documents
        await client.query(
          `INSERT INTO wealthos_documents 
           (user_id, name, doc_type, file_path, ocr_text)
           VALUES 
           ($1, 'Zerodha Contract Note Jun 2026', 'contract_note', 'zerodha_contract_note.pdf', 'OCR Scanned Contract Note:\nBroker: Zerodha Securities Ltd\nClient Code: AZ103\nTrade Date: 2026-06-15\nNet Buy: 20 TCS @ 3300.00\nCharges: STT INR 66.00, Brokerage INR 0.00, GST INR 14.22\nNet Payable Amount: INR 66,080.22.'),
           ($1, 'SBI FD Certificate 2026', 'broker_statement', 'sbi_fd_cert.pdf', 'STATE BANK OF INDIA\nTerm Deposit Receipt\nPrincipal: INR 3,00,000\nInterest Rate: 6.5% p.a.\nMaturity Date: 2027-06-20\nMaturity Value: INR 3,20,135\nTax Status: Taxable at Slab Rate.')`,
          [adminId]
        );

        console.log('✅ WealthOS sample data seeded successfully for admin user.');
      }
    }
  } catch (err) {
    console.error('❌ WealthOS schema creation/seeding failed:', err.message);
  } finally {
    client.release();
  }
}

module.exports = {
  ensureWealthOSSchema
};

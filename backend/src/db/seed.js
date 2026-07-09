require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');

    // Admin user
    const hash = await bcrypt.hash('admin123', 12);
    const result = await client.query(
      `INSERT INTO users (email, username, password_hash, role, full_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      ['admin@quantdesk.local', 'admin', hash, 'admin', 'QuantDesk Admin']
    );

    if (result.rows.length > 0) {
      const adminId = result.rows[0].id;

      // Default watchlist
      const wl = await client.query(
        `INSERT INTO watchlists (user_id, name, is_default) VALUES ($1, $2, true) RETURNING id`,
        [adminId, 'My Watchlist']
      );

      // Seed symbols
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'META', 'NFLX'];
      for (const sym of symbols) {
        await client.query(
          `INSERT INTO watchlist_symbols (watchlist_id, symbol) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [wl.rows[0].id, sym]
        );
      }

      // Default portfolio
      const port = await client.query(
        `INSERT INTO portfolios (user_id, name) VALUES ($1, $2) RETURNING id`,
        [adminId, 'Main Portfolio']
      );

      // Default settings
      await client.query(
        `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [adminId]
      );

      console.log(`✅ Admin user created: admin@quantdesk.local / admin123`);
      console.log(`✅ Watchlist seeded with ${symbols.length} symbols`);
    } else {
      console.log('ℹ️  Admin user already exists, skipping seed.');
    }
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));

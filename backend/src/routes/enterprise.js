const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const cryptoUtils = require('../utils/crypto');
const fxService = require('../services/fxService');
const { triggerWebhook } = require('../services/webhookService');

// ==========================================
// 1. MULTI-USER ACCESS & ROLE MANAGEMENT
// ==========================================

// Get all users in the system (Admins and Advisors can see, others see error)
router.get('/users', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'trader') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await pool.query(
      'SELECT id, username, email, role, full_name, is_active FROM users ORDER BY username'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update role / status (Admin only)
router.patch('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  const { role, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users 
       SET role = COALESCE($1, role),
           is_active = COALESCE($2, is_active),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, username, email, role, is_active`,
      [role, is_active, req.params.id]
    );
    
    // Log audit log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource, metadata)
       VALUES ($1, 'UPDATE_USER_ROLE_OR_STATUS', $2, $3)`,
      [req.user.id, `user:${req.params.id}`, { role, is_active }]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. FAMILY PORTFOLIO AGGREGATION
// ==========================================

// Create a family group
router.post('/family', authenticate, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Family group name is required' });
  
  try {
    const groupRes = await pool.query(
      'INSERT INTO family_groups (name) VALUES ($1) RETURNING *',
      [name]
    );
    const group = groupRes.rows[0];
    
    // Add creator as Head
    await pool.query(
      'INSERT INTO family_members (family_group_id, user_id, role) VALUES ($1, $2, $3)',
      [group.id, req.user.id, 'head']
    );

    // Audit Log
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource, metadata)
       VALUES ($1, 'CREATE_FAMILY_GROUP', $2, $3)`,
      [req.user.id, `family:${group.id}`, { name }]
    );

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List user's family groups
router.get('/family', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fg.id, fg.name, fg.created_at,
              json_agg(json_build_object('user_id', u.id, 'username', u.username, 'email', u.email, 'role', fm.role)) AS members
       FROM family_groups fg
       JOIN family_members fm ON fm.family_group_id = fg.id
       JOIN users u ON u.id = fm.user_id
       WHERE fg.id IN (SELECT family_group_id FROM family_members WHERE user_id = $1)
       GROUP BY fg.id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add member to family
router.post('/family/:id/members', authenticate, async (req, res) => {
  const { userId, role = 'member' } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    // Check if requester is head of this family
    const checkRes = await pool.query(
      'SELECT role FROM family_members WHERE family_group_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (checkRes.rows.length === 0 || checkRes.rows[0].role !== 'head') {
      return res.status(403).json({ error: 'Only family heads can invite members' });
    }

    await pool.query(
      `INSERT INTO family_members (family_group_id, user_id, role) 
       VALUES ($1, $2, $3)
       ON CONFLICT (family_group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, userId, role]
    );

    res.json({ success: true, message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get aggregated family portfolio values with FX conversion
router.get('/family/:id/portfolio', authenticate, async (req, res) => {
  const targetCurrency = (req.query.currency || 'USD').toUpperCase();
  try {
    // Check membership
    const checkRes = await pool.query(
      'SELECT 1 FROM family_members WHERE family_group_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (checkRes.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to family group' });
    }

    // Get family members
    const membersRes = await pool.query(
      'SELECT user_id FROM family_members WHERE family_group_id = $1',
      [req.params.id]
    );
    const memberIds = membersRes.rows.map(m => m.user_id);

    // Get portfolios & positions of family members
    const posRes = await pool.query(
      `SELECT p.user_id, u.username, p.name as portfolio_name, p.currency as base_currency,
              pos.symbol, pos.quantity, pos.avg_cost, pos.asset_type
       FROM portfolios p
       JOIN positions pos ON pos.portfolio_id = p.id
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ANY($1) AND pos.is_open = true`,
      [memberIds]
    );

    // Dynamic conversion
    const aggregatedPositions = [];
    let grandTotal = 0;

    for (const pos of posRes.rows) {
      const quantity = parseFloat(pos.quantity);
      const avgCost = parseFloat(pos.avg_cost);
      const costBasis = quantity * avgCost;
      
      // Convert to target currency
      const costBasisTarget = await fxService.convert(costBasis, pos.base_currency, targetCurrency);
      
      aggregatedPositions.push({
        ...pos,
        cost_basis_local: costBasis,
        cost_basis_target: costBasisTarget,
        target_currency: targetCurrency
      });
      grandTotal += costBasisTarget;
    }

    res.json({
      family_id: req.params.id,
      positions: aggregatedPositions,
      total_value: grandTotal,
      currency: targetCurrency
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. ADVISOR & CLIENT WORKSPACES
// ==========================================

// Advisor requests to link client, or registers client relationship
router.post('/advisor/clients', authenticate, async (req, res) => {
  const { clientEmail } = req.body;
  if (!clientEmail) return res.status(400).json({ error: 'Client email required' });

  try {
    const clientRes = await pool.query('SELECT id FROM users WHERE email = $1', [clientEmail]);
    if (clientRes.rows.length === 0) return res.status(404).json({ error: 'Client user not found' });
    const clientId = clientRes.rows[0].id;

    await pool.query(
      `INSERT INTO advisor_clients (advisor_id, client_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT DO NOTHING`,
      [req.user.id, clientId]
    );

    res.status(201).json({ success: true, message: 'Link request sent to client' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List clients for advisor
router.get('/advisor/clients', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ac.client_id, ac.status, ac.created_at, u.username, u.email, u.full_name
       FROM advisor_clients ac
       JOIN users u ON u.id = ac.client_id
       WHERE ac.advisor_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client approves advisor relationship
router.patch('/advisor/clients/approve', authenticate, async (req, res) => {
  const { advisorId, approve } = req.body;
  try {
    const status = approve ? 'active' : 'inactive';
    await pool.query(
      `UPDATE advisor_clients 
       SET status = $1 
       WHERE advisor_id = $2 AND client_id = $3`,
      [status, advisorId, req.user.id]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource, metadata)
       VALUES ($1, 'APPROVE_ADVISOR', $2, $3)`,
      [req.user.id, `advisor:${advisorId}`, { status }]
    );

    res.json({ success: true, message: `Relationship marked as ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Advisor views client's portfolio workspace
router.get('/advisor/client-portfolio/:clientId', authenticate, async (req, res) => {
  try {
    // Check if advisor has active access to this client
    const checkRes = await pool.query(
      "SELECT 1 FROM advisor_clients WHERE advisor_id = $1 AND client_id = $2 AND status = 'active'",
      [req.user.id, req.params.clientId]
    );
    if (checkRes.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have active advisor access to this client.' });
    }

    const portfolioRes = await pool.query(
      `SELECT p.id as portfolio_id, p.name, p.currency, 
              json_agg(pos.*) FILTER (WHERE pos.id IS NOT NULL) as positions
       FROM portfolios p
       LEFT JOIN positions pos ON pos.portfolio_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id`,
      [req.params.clientId]
    );
    
    res.json(portfolioRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. SHARED WATCHLISTS & REPORTS
// ==========================================

router.post('/shared', authenticate, async (req, res) => {
  const { resourceType, resourceId, shareWithEmail, permission = 'read' } = req.body;
  if (!resourceType || !resourceId || !shareWithEmail) {
    return res.status(400).json({ error: 'Missing share details' });
  }

  try {
    const targetRes = await pool.query('SELECT id FROM users WHERE email = $1', [shareWithEmail]);
    if (targetRes.rows.length === 0) return res.status(404).json({ error: 'User to share with not found' });
    const targetUserId = targetRes.rows[0].id;

    // Verify ownership of the shared resource
    if (resourceType === 'watchlist') {
      const wl = await pool.query('SELECT 1 FROM watchlists WHERE id = $1 AND user_id = $2', [resourceId, req.user.id]);
      if (wl.rows.length === 0) return res.status(403).json({ error: 'Resource owner mismatch' });
    }

    const share = await pool.query(
      `INSERT INTO shared_resources (resource_type, resource_id, shared_by, shared_to_user_id, permission)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [resourceType, resourceId, req.user.id, targetUserId, permission]
    );

    res.status(201).json(share.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/shared/received', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sr.id as share_id, sr.resource_type, sr.resource_id, sr.permission,
              u.username as shared_by_user,
              w.name as watchlist_name
       FROM shared_resources sr
       JOIN users u ON u.id = sr.shared_by
       LEFT JOIN watchlists w ON w.id = sr.resource_id AND sr.resource_type = 'watchlist'
       WHERE sr.shared_to_user_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. AUDIT LOGS
// ==========================================

router.get('/audit-logs', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(
        `SELECT al.id, al.action, al.resource, al.metadata, al.created_at, u.username
         FROM audit_log al
         LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.created_at DESC LIMIT 100`
      );
    } else {
      result = await pool.query(
        `SELECT id, action, resource, metadata, created_at
         FROM audit_log
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 100`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/audit-logs', authenticate, async (req, res) => {
  const { action, resource, metadata } = req.body;
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource, metadata)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, action || 'CLIENT_ACTION', resource || 'ui', JSON.stringify(metadata || {})]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. END-TO-END ENCRYPTED CREDENTIALS
// ==========================================

router.post('/credentials', authenticate, async (req, res) => {
  const { serviceName, secretData } = req.body;
  if (!serviceName || !secretData) {
    return res.status(400).json({ error: 'Service name and credentials secret data required' });
  }

  try {
    const encrypted = cryptoUtils.encrypt(secretData);
    
    const result = await pool.query(
      `INSERT INTO encrypted_credentials (user_id, service_name, encrypted_data, iv, auth_tag)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, service_name, created_at`,
      [req.user.id, serviceName, encrypted.encryptedData, encrypted.iv, encrypted.authTag]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource, metadata)
       VALUES ($1, 'STORE_CREDENTIALS', $2, '{}')`,
      [req.user.id, `credential:${serviceName}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/credentials', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, service_name, created_at FROM encrypted_credentials WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to fetch decrypted credentials securely
router.get('/credentials/decrypt/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM encrypted_credentials WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Credentials not found' });
    
    const row = result.rows[0];
    const decrypted = cryptoUtils.decrypt(row.encrypted_data, row.iv, row.auth_tag);
    
    res.json({
      id: row.id,
      service_name: row.service_name,
      secret_data: decrypted
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decrypt credentials: ' + err.message });
  }
});

// ==========================================
// 7. PUBLIC API & WEBHOOK INTEGRATIONS
// ==========================================

router.post('/api-keys', authenticate, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'API key description/name required' });

  try {
    const rawKey = 'qd_live_' + crypto.randomBytes(24).toString('hex');
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const result = await pool.query(
      `INSERT INTO api_keys (user_id, key_hash, key_prefix, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, key_prefix, name, created_at`,
      [req.user.id, keyHash, keyPrefix, name]
    );

    res.status(201).json({
      ...result.rows[0],
      api_key: rawKey // ONLY shown once
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api-keys', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, key_prefix, name, created_at, expires_at, last_used_at FROM api_keys WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api-keys/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhooks', authenticate, async (req, res) => {
  const { url, eventTypes } = req.body;
  if (!url || !eventTypes || eventTypes.length === 0) {
    return res.status(400).json({ error: 'URL and eventTypes array are required' });
  }

  try {
    const secretToken = 'whsec_' + crypto.randomBytes(16).toString('hex');
    const result = await pool.query(
      `INSERT INTO webhook_subscriptions (user_id, url, secret_token, event_types)
       VALUES ($1, $2, $3, $4)
       RETURNING id, url, event_types, secret_token, created_at`,
      [req.user.id, url, secretToken, eventTypes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/webhooks', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, url, event_types, is_active, created_at FROM webhook_subscriptions WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/webhooks/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM webhook_subscriptions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Webhook subscription deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. SCHEDULED PDF/EXCEL REPORTING
// ==========================================

router.post('/reports/schedule', authenticate, async (req, res) => {
  const { reportType, format, frequency, emailRecipient } = req.body;
  if (!reportType || !format || !frequency || !emailRecipient) {
    return res.status(400).json({ error: 'Missing schedule criteria' });
  }

  try {
    // Schedule next run: now + 5 seconds for instant testing, then interval
    const nextRun = new Date(Date.now() + 5000); 

    const result = await pool.query(
      `INSERT INTO scheduled_reports (user_id, report_type, format, frequency, email_recipient, next_run)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, reportType, format, frequency, emailRecipient, nextRun]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports/schedule', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM scheduled_reports WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/reports/schedule/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM scheduled_reports WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Scheduled report deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 9. BROKER CSV IMPORTERS
// ==========================================

router.post('/import', authenticate, async (req, res) => {
  const { broker, csvData } = req.body;
  if (!broker || !csvData) {
    return res.status(400).json({ error: 'Broker and raw CSV content are required' });
  }

  try {
    const lines = csvData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV file contains no records' });

    let parsedTrades = [];

    // Parse Zerodha format: symbol, quantity, price, action
    // Parse Robinhood format: Asset Name, Quantity, Price, TransType
    // Parse Interactive Brokers format: Sym, Qty, Cost, Action
    if (broker.toLowerCase() === 'zerodha') {
      const headers = lines[0].toLowerCase().split(',');
      const symbolIdx = headers.indexOf('symbol');
      const qtyIdx = headers.indexOf('quantity');
      const priceIdx = headers.indexOf('price');
      const actionIdx = headers.indexOf('action'); // buy or sell

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 4) {
          parsedTrades.push({
            symbol: parts[symbolIdx]?.toUpperCase() || 'UNKNOWN',
            quantity: parseFloat(parts[qtyIdx]) || 0,
            price: parseFloat(parts[priceIdx]) || 0,
            action: parts[actionIdx]?.toLowerCase() || 'buy'
          });
        }
      }
    } else if (broker.toLowerCase() === 'robinhood' || broker.toLowerCase() === 'coinbase') {
      // General standard headers: symbol, quantity, price, side
      const headers = lines[0].toLowerCase().split(',');
      const symbolIdx = Math.max(headers.indexOf('symbol'), headers.indexOf('ticker'), headers.indexOf('asset name'));
      const qtyIdx = Math.max(headers.indexOf('quantity'), headers.indexOf('qty'), headers.indexOf('shares'));
      const priceIdx = Math.max(headers.indexOf('price'), headers.indexOf('avg price'), headers.indexOf('cost'));
      const actionIdx = Math.max(headers.indexOf('side'), headers.indexOf('action'), headers.indexOf('type'), headers.indexOf('transtype'));

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 3) {
          const actionText = parts[actionIdx]?.toLowerCase() || 'buy';
          parsedTrades.push({
            symbol: parts[symbolIdx]?.toUpperCase() || 'UNKNOWN',
            quantity: parseFloat(parts[qtyIdx]) || 0,
            price: parseFloat(parts[priceIdx]) || 0,
            action: (actionText.includes('sell') || actionText.includes('out')) ? 'sell' : 'buy'
          });
        }
      }
    } else {
      // Generic parser: ticker, qty, price, buy/sell
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 3) {
          parsedTrades.push({
            symbol: parts[0]?.toUpperCase() || 'UNKNOWN',
            quantity: parseFloat(parts[1]) || 0,
            price: parseFloat(parts[2]) || 0,
            action: (parts[3] || 'buy').toLowerCase().trim() === 'sell' ? 'sell' : 'buy'
          });
        }
      }
    }

    if (parsedTrades.length === 0) {
      return res.status(400).json({ error: 'Could not parse trades. Check CSV headers.' });
    }

    // Insert trades into positions table or portfolios
    // Get the user's main portfolio
    const portRes = await pool.query('SELECT id FROM portfolios WHERE user_id = $1 LIMIT 1', [req.user.id]);
    let portfolioId;
    if (portRes.rows.length === 0) {
      const newPort = await pool.query(
        "INSERT INTO portfolios (user_id, name) VALUES ($1, 'Imported Portfolio') RETURNING id",
        [req.user.id]
      );
      portfolioId = newPort.rows[0].id;
    } else {
      portfolioId = portRes.rows[0].id;
    }

    for (const trade of parsedTrades) {
      if (trade.action === 'buy') {
        await pool.query(
          `INSERT INTO positions (portfolio_id, symbol, quantity, avg_cost, asset_type, is_open)
           VALUES ($1, $2, $3, $4, 'equity', true)
           ON CONFLICT DO NOTHING`,
          [portfolioId, trade.symbol, trade.quantity, trade.price]
        );
      }
    }

    // Trigger webhook and audit
    await triggerWebhook(req.user.id, 'portfolio.updated', { portfolio_id: portfolioId, broker, imported_trades: parsedTrades.length });
    
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource, metadata)
       VALUES ($1, 'PORTFOLIO_IMPORT', $2, $3)`,
      [req.user.id, `portfolio:${portfolioId}`, { broker, count: parsedTrades.length }]
    );

    res.json({
      success: true,
      message: `Successfully imported ${parsedTrades.length} trades from ${broker}.`,
      trades: parsedTrades
    });

  } catch (err) {
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

module.exports = router;

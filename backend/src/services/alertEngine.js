const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'quantdesk_dev_jwt_secret_change_in_prod_32chars';
const PY_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Store connected clients: userId -> Set of WebSocket instances
const clients = new Map();

function initAlertEngine(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;

    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const token = parameters.token;

    if (!token) {
      ws.close(4001, 'Unauthorized: Missing token');
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;

      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId).add(ws);

      console.log(`🔌 WebSocket connected for user ${userId}`);

      ws.on('close', () => {
        const userConnections = clients.get(userId);
        if (userConnections) {
          userConnections.delete(ws);
          if (userConnections.size === 0) {
            clients.delete(userId);
          }
        }
        console.log(`🔌 WebSocket disconnected for user ${userId}`);
      });

      // Send initial welcome message
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to QuantDesk Alert Engine' }));

    } catch (err) {
      console.error('WebSocket auth failed:', err.message);
      ws.close(4002, 'Unauthorized: Invalid token');
    }
  });

  // Start the polling loop (every 10 seconds)
  setInterval(evaluateAlerts, 10000);
  console.log('🛡️ Alert Engine initialized.');
}

async function evaluateAlerts() {
  try {
    // 1. Fetch active, non-triggered alerts
    const alertsResult = await pool.query(
      'SELECT * FROM alerts WHERE is_active = true AND triggered = false'
    );
    const activeAlerts = alertsResult.rows;

    if (activeAlerts.length === 0) return;

    // 2. Group alerts by market
    const marketGroups = {};
    activeAlerts.forEach((alert) => {
      const m = alert.market || 'US';
      if (!marketGroups[m]) marketGroups[m] = new Set();
      marketGroups[m].add(alert.symbol);
    });

    // 3. Fetch current quotes from Python service in parallel per market
    const marketPromises = Object.keys(marketGroups).map(async (m) => {
      const symbols = Array.from(marketGroups[m]);
      try {
        const res = await axios.post(`${PY_URL}/quotes/batch`, { symbols, market: m }, { timeout: 5000 });
        return { market: m, quotes: res.data.quotes || {} };
      } catch (err) {
        console.error(`AlertEngine: Failed to fetch quotes for market ${m}:`, err.message);
        return { market: m, quotes: {} };
      }
    });

    const marketResults = await Promise.all(marketPromises);

    // Map quotes using unique composite key "SYMBOL:MARKET"
    const quotesMap = {};
    marketResults.forEach((res) => {
      Object.keys(res.quotes).forEach((sym) => {
        quotesMap[`${sym.toUpperCase()}:${res.market}`] = res.quotes[sym];
      });
    });

    // 4. Evaluate alerts
    for (const alert of activeAlerts) {
      const m = alert.market || 'US';
      const key = `${alert.symbol.toUpperCase()}:${m}`;
      const quote = quotesMap[key];
      if (!quote || !quote.success) continue;

      const currentPrice = quote.price;
      let isTriggered = false;

      if (alert.alert_type === 'price_above' && currentPrice >= parseFloat(alert.threshold)) {
        isTriggered = true;
      } else if (alert.alert_type === 'price_below' && currentPrice <= parseFloat(alert.threshold)) {
        isTriggered = true;
      }

      if (isTriggered) {
        await triggerAlert(alert, currentPrice);
      }
    }
  } catch (err) {
    console.error('AlertEngine evaluation error:', err.message);
  }
}

async function triggerAlert(alert, currentPrice) {
  try {
    const now = new Date();
    // 1. Update database status
    await pool.query(
      'UPDATE alerts SET triggered = true, triggered_at = $1, is_active = false WHERE id = $2',
      [now, alert.id]
    );

    console.log(`🔔 Alert triggered: ${alert.symbol} ${alert.alert_type} at ${currentPrice} (Threshold: ${alert.threshold})`);

    // 2. Send WebSocket notification to connected user clients
    const userConnections = clients.get(alert.user_id);
    if (userConnections && userConnections.size > 0) {
      const notification = JSON.stringify({
        type: 'ALERT_TRIGGERED',
        alert: {
          id: alert.id,
          symbol: alert.symbol,
          alert_type: alert.alert_type,
          threshold: alert.threshold,
          message: alert.message || `${alert.symbol} has crossed your threshold of ${alert.threshold}`,
          triggered_at: now.toISOString(),
          trigger_price: currentPrice
        }
      });

      for (const ws of userConnections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(notification);
        }
      }
    }
  } catch (err) {
    console.error(`Failed to trigger alert ${alert.id}:`, err.message);
  }
}

module.exports = { initAlertEngine };

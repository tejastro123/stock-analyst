const axios = require('axios');
const crypto = require('crypto');
const pool = require('../db/pool');

async function triggerWebhook(userId, eventType, payload) {
  try {
    const res = await pool.query(
      'SELECT id, url, secret_token, event_types FROM webhook_subscriptions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    
    const subscriptions = res.rows.filter(sub => {
      // Postgres array or standard list
      return sub.event_types && (sub.event_types.includes(eventType) || sub.event_types.includes('*'));
    });
    
    if (subscriptions.length === 0) return;
    
    const timestamp = Date.now();
    const eventId = crypto.randomUUID();
    const requestBody = JSON.stringify({
      id: eventId,
      event: eventType,
      timestamp,
      data: payload
    });
    
    for (const sub of subscriptions) {
      // Generate HMAC signature: signature = hex(hmac_sha256(secret, timestamp + '.' + body))
      const hmac = crypto.createHmac('sha256', sub.secret_token || 'default_secret');
      hmac.update(`${timestamp}.${requestBody}`);
      const signature = hmac.digest('hex');
      
      // Fire-and-forget or async request
      axios.post(sub.url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'X-QuantDesk-Signature': signature,
          'X-QuantDesk-Timestamp': timestamp.toString(),
          'X-QuantDesk-Event-Id': eventId
        },
        timeout: 5000
      }).then(() => {
        // Log success in audit_log or console
        pool.query(
          `INSERT INTO audit_log (user_id, action, resource, metadata) 
           VALUES ($1, 'WEBHOOK_DELIVERED', $2, $3)`,
          [userId, 'webhook', { subscription_id: sub.id, url: sub.url, event: eventType, success: true }]
        ).catch(() => {});
      }).catch(err => {
        console.error(`Webhook delivery to ${sub.url} failed:`, err.message);
        pool.query(
          `INSERT INTO audit_log (user_id, action, resource, metadata) 
           VALUES ($1, 'WEBHOOK_FAILED', $2, $3)`,
          [userId, 'webhook', { subscription_id: sub.id, url: sub.url, event: eventType, error: err.message }]
        ).catch(() => {});
      });
    }
  } catch (err) {
    console.error('Failed to trigger webhooks:', err.message);
  }
}

module.exports = {
  triggerWebhook
};

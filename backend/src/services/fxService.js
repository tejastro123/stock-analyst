const pool = require('../db/pool');

const STATIC_FALLBACK_RATES = {
  'USD_INR': 83.50,
  'INR_USD': 0.012,
  'USD_EUR': 0.92,
  'EUR_USD': 1.09,
  'EUR_INR': 90.76,
  'INR_EUR': 0.011,
  'USD_USD': 1.0,
  'INR_IN': 1.0,
  'INR_INR': 1.0,
  'EUR_EUR': 1.0
};

async function getRate(from, to) {
  const cleanFrom = (from || 'USD').toUpperCase();
  const cleanTo = (to || 'USD').toUpperCase();
  
  if (cleanFrom === cleanTo) return 1.0;
  
  try {
    const res = await pool.query(
      'SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = $2',
      [cleanFrom, cleanTo]
    );
    if (res.rows.length > 0) {
      return parseFloat(res.rows[0].rate);
    }
  } catch (err) {
    console.error('Error fetching exchange rate from DB:', err.message);
  }
  
  // Fallback to static rates
  const key = `${cleanFrom}_${cleanTo}`;
  return STATIC_FALLBACK_RATES[key] || 1.0;
}

async function convert(amount, from, to) {
  if (amount === undefined || amount === null) return 0;
  const rate = await getRate(from, to);
  return amount * rate;
}

module.exports = {
  getRate,
  convert
};

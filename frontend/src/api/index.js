import api from './client';

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
};

export const userApi = {
  getWatchlists: () => api.get('/users/watchlists'),
  createWatchlist: (name) => api.post('/users/watchlists', { name }),
  addSymbol: (wlId, symbol, market) => api.post(`/users/watchlists/${wlId}/symbols`, { symbol, market }),
  removeSymbol: (wlId, symbol) => api.delete(`/users/watchlists/${wlId}/symbols/${symbol}`),
  getSettings: () => api.get('/users/settings'),
  updateSettings: (data) => api.patch('/users/settings', data),
  getScreenerPresets: () => api.get('/users/screener-presets'),
  saveScreenerPreset: (name, filters) => api.post('/users/screener-presets', { name, filters }),
  deleteScreenerPreset: (name) => api.delete(`/users/screener-presets/${name}`),
};

export const marketApi = {
  // Quotes
  getQuote: (symbol, market = 'US') =>
    api.get(`/market/quote/${symbol}?market=${market}`),
  getBatchQuotes: (symbols, market = 'US') =>
    api.post('/market/quotes/batch', { symbols, market }),

  // OHLCV
  getOHLCV: (symbol, { market = 'US', period = '6mo', interval = '1d' } = {}) =>
    api.get(`/market/ohlcv/${symbol}?market=${market}&period=${period}&interval=${interval}`),

  // Fundamentals
  getFundamentals: (symbol, market = 'US') =>
    api.get(`/market/fundamentals/${symbol}?market=${market}`),

  // Options
  getOptions: (symbol, market = 'US', expiry = null) => {
    const q = expiry ? `?market=${market}&expiry=${expiry}` : `?market=${market}`;
    return api.get(`/market/options/${symbol}${q}`);
  },

  // Screener
  runScreener: (filters) => api.post('/market/screener', filters),
  getUniverse: (market = 'US') => api.get(`/market/universe?market=${market}`),

  // Sector heatmap
  getSectorHeatmap: () => api.get('/market/sector/heatmap'),

  // Market Metrics & Breadth
  getEarnings: () => api.get('/market/metrics/earnings'),
  getBreadth: () => api.get('/market/metrics/breadth'),
  getMovers: () => api.get('/market/metrics/movers'),

  // Health
  pyHealth: () => api.get('/market/py-health'),

  // Backtest
  runBacktest: (data) => api.post('/market/backtest', data),

  // Macro
  getMacroCurve: () => api.get('/market/macro/curve'),
  getMacroSeries: (seriesId, calculateYoY = false) => api.get(`/market/macro/series/${seriesId}?calculate_yoy=${calculateYoY}`),
  searchMacro: (query) => api.get(`/market/macro/search?query=${encodeURIComponent(query)}`),
  getNews: (symbol, market = 'US') => api.get(`/market/news/${symbol}?market=${market}`),
  getHistoricalRisk: (positions) => api.post('/market/risk/historical', { positions }),

  // Signals — technical & fundamental scores
  getSignals: (symbol, market = 'US') => api.get(`/market/signals/${symbol}?market=${market}`),

  // ETF
  getEtfPeers: (symbol, market = 'US') => api.get(`/market/etf/peers/${symbol}?market=${market}`),
  getEtfDetails: (symbol, market = 'US') => api.get(`/market/etf/details/${symbol}?market=${market}`),
};

export const portfolioApi = {
  getPortfolio: () => api.get('/portfolio'),
  addPosition: (data) => api.post('/portfolio/position', data),
  updatePosition: (id, data) => api.put(`/portfolio/position/${id}`, data),
  deletePosition: (id) => api.delete(`/portfolio/position/${id}`),
  getPortfolioHistory: () => api.get('/portfolio/history'),
};

export const alertsApi = {
  getAlerts: () => api.get('/alerts'),
  createAlert: (data) => api.post('/alerts', data),
  toggleAlert: (id) => api.post(`/alerts/${id}/toggle`),
  deleteAlert: (id) => api.delete(`/alerts/${id}`),
};

export const reportsApi = {
  exportPdf: (data) => api.post('/reports/pdf', data, { responseType: 'blob' }),
};



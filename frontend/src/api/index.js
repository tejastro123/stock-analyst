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
  createWatchlist: (name, folder = null) => api.post('/users/watchlists', { name, folder }),
  updateWatchlist: (wlId, data) => api.patch(`/users/watchlists/${wlId}`, data),
  deleteWatchlist: (wlId) => api.delete(`/users/watchlists/${wlId}`),
  addSymbol: (wlId, symbol, market) => api.post(`/users/watchlists/${wlId}/symbols`, { symbol, market }),
  updateSymbolDetail: (wlId, symbol, data) => api.put(`/users/watchlists/${wlId}/symbols/${symbol}`, data),
  removeSymbol: (wlId, symbol) => api.delete(`/users/watchlists/${wlId}/symbols/${symbol}`),
  getSettings: () => api.get('/users/settings'),
  updateSettings: (data) => api.patch('/users/settings', data),
  getScreenerPresets: () => api.get('/users/screener-presets'),
  saveScreenerPreset: (name, filters) => api.post('/users/screener-presets', { name, filters }),
  deleteScreenerPreset: (name) => api.delete(`/users/screener-presets/${name}`),
  getUsersList: () => api.get('/users/list'),
  updateUserRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  updateUserStatus: (id, is_active) => api.patch(`/users/${id}/status`, { is_active }),
  adminCreateUser: (data) => api.post('/users/create', data),
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


  // Screener
  runScreener: (filters) => api.post('/market/screener', filters),
  getUniverse: (market = 'US') => api.get(`/market/universe?market=${market}`),

  // Sector heatmap
  getSectorHeatmap: (market = 'US') => api.get(`/market/sector/heatmap?market=${market}`),

  // Market Metrics & Breadth
  getEarnings: () => api.get('/market/metrics/earnings'),
  getBreadth: () => api.get('/market/metrics/breadth'),
  getMovers: () => api.get('/market/metrics/movers'),

  // Health
  pyHealth: () => api.get('/market/py-health'),

  // Backtest
  runBacktest: (data) => api.post('/market/backtest', data),

  getNews: (symbol, market = 'US') => api.get(`/market/news/${symbol}?market=${market}`),
  getHistoricalRisk: (positions) => api.post('/market/risk/historical', { positions }),

  // Signals — technical & fundamental scores
  getSignals: (symbol, market = 'US') => api.get(`/market/signals/${symbol}?market=${market}`),

  // ETF
  getEtfPeers: (symbol, market = 'US') => api.get(`/market/etf/peers/${symbol}?market=${market}`),
  getEtfDetails: (symbol, market = 'US') => api.get(`/market/etf/details/${symbol}?market=${market}`),

  // Indicators
  getIndicators: (symbol, market = 'US') => api.get(`/market/indicators/${symbol}?market=${market}`),
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

export const wealthosApi = {
  getAssets: () => api.get('/wealthos/assets'),
  createAsset: (data) => api.post('/wealthos/assets', data),
  updateAsset: (id, data) => api.put(`/wealthos/assets/${id}`, data),
  deleteAsset: (id) => api.delete(`/wealthos/assets/${id}`),
  
  getTransactions: () => api.get('/wealthos/transactions'),
  createTransaction: (data) => api.post('/wealthos/transactions', data),
  
  getGoals: () => api.get('/wealthos/goals'),
  createGoal: (data) => api.post('/wealthos/goals', data),
  updateGoal: (id, data) => api.put(`/wealthos/goals/${id}`, data),
  deleteGoal: (id) => api.delete(`/wealthos/goals/${id}`),
  
  getJournal: () => api.get('/wealthos/journal'),
  createJournal: (data) => api.post('/wealthos/journal', data),
  updateJournal: (id, data) => api.patch(`/wealthos/journal/${id}`, data),
  deleteJournal: (id) => api.delete(`/wealthos/journal/${id}`),
  
  getDocs: () => api.get('/wealthos/documents'),
  createDoc: (data) => api.post('/wealthos/documents', data),
  deleteDoc: (id) => api.delete(`/wealthos/documents/${id}`),

  getAnalytics: () => api.get('/wealthos/analytics/calculate'),
  getStressTests: () => api.get('/wealthos/analytics/stress-test'),
  getMonteCarlo: (sims) => api.get(`/wealthos/analytics/monte-carlo?simulations=${sims}`),
  getCorrelation: () => api.get('/wealthos/analytics/correlation'),
  getAIAdvisory: () => api.get('/wealthos/ai/advisory'),
  getResearch: (symbol) => api.get(`/wealthos/research/${symbol}`),
  getAlerts: () => api.get('/wealthos/alerts'),
  createAlert: (data) => api.post('/wealthos/alerts', data),
  toggleAlert: (id) => api.post(`/wealthos/alerts/${id}/toggle`),
  deleteAlert: (id) => api.delete(`/wealthos/alerts/${id}`)
};

export const enterpriseApi = {
  getUsers: () => api.get('/enterprise/users'),
  updateUser: (id, data) => api.patch(`/enterprise/users/${id}`, data),
  
  createFamily: (name) => api.post('/enterprise/family', { name }),
  getFamily: () => api.get('/enterprise/family'),
  addFamilyMember: (familyId, data) => api.post(`/enterprise/family/${familyId}/members`, data),
  getFamilyPortfolio: (familyId, currency = 'USD') => api.get(`/enterprise/family/${familyId}/portfolio?currency=${currency}`),

  requestAdvisorClient: (clientEmail) => api.post('/enterprise/advisor/clients', { clientEmail }),
  getAdvisorClients: () => api.get('/enterprise/advisor/clients'),
  approveAdvisorClient: (advisorId, approve) => api.patch('/enterprise/advisor/clients/approve', { advisorId, approve }),
  getClientPortfolio: (clientId) => api.get(`/enterprise/advisor/client-portfolio/${clientId}`),

  shareResource: (data) => api.post('/enterprise/shared', data),
  getSharedReceived: () => api.get('/enterprise/shared/received'),

  getAuditLogs: () => api.get('/enterprise/audit-logs'),
  logAuditAction: (data) => api.post('/enterprise/audit-logs', data),

  storeCredentials: (serviceName, secretData) => api.post('/enterprise/credentials', { serviceName, secretData }),
  getCredentials: () => api.get('/enterprise/credentials'),
  decryptCredentials: (id) => api.get(`/enterprise/credentials/decrypt/${id}`),

  createApiKey: (name) => api.post('/enterprise/api-keys', { name }),
  getApiKeys: () => api.get('/enterprise/api-keys'),
  deleteApiKey: (id) => api.delete(`/enterprise/api-keys/${id}`),

  createWebhook: (url, eventTypes) => api.post('/enterprise/webhooks', { url, eventTypes }),
  getWebhooks: () => api.get('/enterprise/webhooks'),
  deleteWebhook: (id) => api.delete(`/enterprise/webhooks/${id}`),

  scheduleReport: (data) => api.post('/enterprise/reports/schedule', data),
  getScheduledReports: () => api.get('/enterprise/reports/schedule'),
  deleteScheduledReport: (id) => api.delete(`/enterprise/reports/schedule/${id}`),

  importBrokerCsv: (broker, csvData) => api.post('/enterprise/import', { broker, csvData })
};





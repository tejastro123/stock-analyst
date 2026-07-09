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
};

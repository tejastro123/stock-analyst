import axios from 'axios';

const isElectron = navigator.userAgent.toLowerCase().includes('electron') || window.location.protocol === 'file:';
const baseURL = isElectron ? 'http://localhost:3001/api' : '/api';

const api = axios.create({
  baseURL,
  timeout: 45000,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qd_access_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('qd_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
          localStorage.setItem('qd_access_token', res.data.accessToken);
          original.headers['Authorization'] = `Bearer ${res.data.accessToken}`;
          return api(original);
        } catch {
          localStorage.clear();
          // Redirect using hash router if in Electron, else standard path
          if (isElectron) {
            window.location.hash = '#/login';
          } else {
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;

import axios from 'axios';
import { Capacitor } from '@capacitor/core';

// Platform detection
const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
const isCapacitor = typeof window !== 'undefined' && Capacitor.isNativePlatform();

// In Electron or Capacitor the app is not served from the same origin as the API,
// so we must use an absolute URL. VITE_API_URL should be set to your deployed
// backend (e.g. https://api.quantdesk.com) for production builds, or your LAN
// IP (e.g. http://192.168.1.x:3001/api) for local mobile testing.
const baseURL = (isElectron || isCapacitor)
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3001/api')
  : '/api';


const api = axios.create({
  baseURL,
  timeout: 120000,  // 2 min — screener scans 120+ stocks in parallel (90s backend timeout + buffer)
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qd_access_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Offline Sync Queue Helper
const OFFLINE_QUEUE_KEY = 'qd_offline_queue';

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function syncOfflineRequests() {
  if (!navigator.onLine) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;
  
  console.log(`Syncing ${queue.length} offline actions...`);
  const remaining = [];
  
  for (const action of queue) {
    try {
      await api({
        url: action.url,
        method: action.method,
        data: action.data,
        headers: {
          ...action.headers,
          // Re-attach dynamic access token during sync
          Authorization: `Bearer ${localStorage.getItem('qd_access_token')}`
        }
      });
      console.log(`Successfully synced offline action: ${action.method} ${action.url}`);
    } catch (err) {
      console.error(`Failed to sync offline action ${action.method} ${action.url}:`, err.message);
      if (!err.response || err.response.status >= 500) {
        remaining.push(action);
      }
    }
  }
  
  saveOfflineQueue(remaining);
  window.dispatchEvent(new CustomEvent('qd_offline_sync_complete'));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineRequests);
}

// Auto-refresh on 401 & Offline-First sync queue interceptor
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    
    // Offline-first interceptor
    const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error';
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(original?.method?.toLowerCase());
    
    if (isNetworkError && isMutation) {
      const queue = getOfflineQueue();
      queue.push({
        url: original.url,
        method: original.method,
        data: original.data,
        headers: {
          ...original.headers,
          Authorization: undefined // Set dynamic on replay
        },
        timestamp: Date.now()
      });
      saveOfflineQueue(queue);
      
      window.dispatchEvent(new CustomEvent('qd_offline_action_queued', { 
        detail: { url: original.url, method: original.method } 
      }));
      
      return Promise.resolve({
        data: { _queued: true, message: 'Offline. Request queued for synchronization.' },
        status: 202,
        statusText: 'Accepted (Queued)'
      });
    }

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
          if (isElectron || isCapacitor) {
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

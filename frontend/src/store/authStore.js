import { create } from 'zustand';
import { authApi } from '../api';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  init: async () => {
    const token = localStorage.getItem('qd_access_token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const res = await authApi.me();
      set({ user: res.data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('qd_access_token');
      localStorage.removeItem('qd_refresh_token');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem('qd_access_token', accessToken);
    localStorage.setItem('qd_refresh_token', refreshToken);
    set({ user, isAuthenticated: true });
    return user;
  },

  register: async (data) => {
    const res = await authApi.register(data);
    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem('qd_access_token', accessToken);
    localStorage.setItem('qd_refresh_token', refreshToken);
    set({ user, isAuthenticated: true });
    return user;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('qd_refresh_token');
    try { await authApi.logout(refreshToken); } catch {}
    localStorage.removeItem('qd_access_token');
    localStorage.removeItem('qd_refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));

export default useAuthStore;

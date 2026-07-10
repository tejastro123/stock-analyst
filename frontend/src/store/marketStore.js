import { create } from 'zustand';

const useMarketStore = create((set) => ({
  activeMarket: localStorage.getItem('qd_active_market') || 'NSE',
  setActiveMarket: (market) => {
    localStorage.setItem('qd_active_market', market);
    set({ activeMarket: market });
  }
}));

export default useMarketStore;

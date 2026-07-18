import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { userApi } from '../../api';
import TradingViewTickerTape from '../TradingViewTickerTape/TradingViewTickerTape';
import useMarketStore from '../../store/marketStore';
import ErrorBoundary from '../ErrorBoundary';
import './Terminal.css';

const NAV_ITEMS = [
  { path: '/dashboard',  label: 'DASH',      title: 'Dashboard' },
  { path: '/screener',   label: 'SCRN',      title: 'Screener' },
  { path: '/portfolio',  label: 'PORT',      title: 'Portfolio' },
  { path: '/charts',     label: 'CHRT',      title: 'Charts' },
  { path: '/wealthos',   label: 'WTH',       title: 'WealthOS' },
  { path: '/enterprise', label: 'ENTP',      title: 'Enterprise' },
  { path: '/news',       label: 'NEWS',      title: 'News' },
  { path: '/alerts',     label: 'ALRT',      title: 'Alerts' },
  { path: '/research',   label: 'RSCH',      title: 'Research' },
  { path: '/analytics',  label: 'RISK',      title: 'Analytics' },
  { path: '/backtester', label: 'BKTS',      title: 'Backtester' },
  { path: '/settings',   label: 'SETT',      title: 'Settings' },
];


const playAlertSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playBeep = (delay, freq) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.3);
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + 0.35);
    };
    playBeep(0, 880);
    playBeep(0.15, 1109);
  } catch (e) {
    console.warn('Audio Context failed to play alert sound:', e);
  }
};

function TerminalLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { activeMarket, setActiveMarket } = useMarketStore();
  const navigate = useNavigate();
  const now = new Date();

  const [theme, setTheme] = React.useState(document.documentElement.getAttribute('data-theme') || 'dark');
  const [activeToasts, setActiveToasts] = useState([]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    userApi.updateSettings({ theme: nextTheme }).catch(() => {});
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    // Load and apply theme and default market settings on mount
    userApi.getSettings()
      .then(res => {
        if (res.data?.theme) {
          document.documentElement.setAttribute('data-theme', res.data.theme);
          setTheme(res.data.theme);
        }
        if (res.data?.default_market && !localStorage.getItem('qd_active_market')) {
          const m = res.data.default_market === 'IN' ? 'NSE' : res.data.default_market;
          setActiveMarket(m);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    let socket = null;
    let reconnectTimer = null;
    let retryCount = 0;
    let isDestroyed = false;
    const MAX_RETRIES = 5;

    const connectGlobalSocket = () => {
      const token = localStorage.getItem('qd_access_token');
      if (!token) return;

      // Close any stale socket before creating a new one
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.onclose = null; // Prevent triggering reconnect from old socket
        socket.close();
      }

      // Don't reconnect when the tab is in the background to save resources
      if (document.visibilityState === 'hidden') {
        reconnectTimer = setTimeout(connectGlobalSocket, 5000);
        return;
      }

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${wsProto}//${host}/ws?token=${token}`;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        retryCount = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ALERT_TRIGGERED') {
            playAlertSound();
            const toastId = Date.now();
            const newToast = {
              id: toastId,
              symbol: data.alert.symbol,
              message: data.alert.message || `${data.alert.symbol} crossed threshold of ${data.alert.threshold}`,
              threshold: data.alert.threshold,
              trigger_price: data.alert.trigger_price,
              alert_type: data.alert.alert_type,
            };
            setActiveToasts(prev => [...prev, newToast]);

            // Auto dismiss toast after 8 seconds
            setTimeout(() => {
              setActiveToasts(prev => prev.filter(t => t.id !== toastId));
            }, 8000);

            if (Notification.permission === 'granted') {
              new Notification(`🔔 QuantDesk Triggered: ${data.alert.symbol}`, {
                body: data.alert.message || `${data.alert.symbol} crossed threshold of ${data.alert.threshold}`
              });
            }
          }
        } catch (err) {
          console.error('Failed to parse global alert message:', err);
        }
      };

      socket.onclose = () => {
        if (isDestroyed) return;
        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          retryCount += 1;
          reconnectTimer = setTimeout(connectGlobalSocket, delay);
        }
      };

      socket.onerror = (err) => {
        console.error('Global Alert WebSocket error:', err);
      };
    };

    // Re-connect when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!socket || socket.readyState === WebSocket.CLOSED)) {
        retryCount = 0;
        connectGlobalSocket();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    connectGlobalSocket();

    return () => {
      isDestroyed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (socket) socket.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return (
    <div className="terminal-root">
      {/* ── Top Bar ── */}
      <header className="terminal-topbar" id="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">
            <span className="topbar-logo-q">Q</span>
            <span className="topbar-logo-text">UANTDESK</span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="topbar-clock font-mono text-xs text-secondary">
            {now.toLocaleTimeString('en-US', { hour12: false })} ET
          </div>
          <div className="topbar-market-selector" style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid var(--border-primary)', paddingLeft: '12px' }}>
            <span className="font-mono text-xs text-muted" style={{ fontSize: '10px' }}>REGION:</span>
            <select 
              value={activeMarket} 
              onChange={(e) => setActiveMarket(e.target.value)}
              className="form-input" 
              style={{ 
                height: '22px', 
                padding: '0 4px', 
                fontSize: '10px', 
                width: '80px', 
                background: 'var(--bg-primary)', 
                border: '1px solid var(--border-primary)', 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              <option value="NSE">🇮🇳 NSE</option>
              <option value="BSE">🇮🇳 BSE</option>
              <option value="US">🇺🇸 US</option>
            </select>
          </div>
          <div className="topbar-market-status">
            <span className="status-dot status-dot--open pulse" />
            <span className="font-mono text-xs text-green">MARKET OPEN</span>
          </div>
          <div className="topbar-user" id="topbar-user">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase() || 'U'}</div>
            <div className="user-info">
              <div className="font-mono text-xs fw-600">{user?.username || 'user'}</div>
              <div className="text-xs text-muted">
                {user?.role === 'viewer' ? (
                  <span className="badge badge-amber font-mono" style={{ fontSize: '9px', padding: '1px 4px', display: 'inline-block', lineHeight: 1 }}>READ-ONLY</span>
                ) : (
                  user?.role || 'trader'
                )}
              </div>
            </div>
            <button 
              id="btn-theme-toggle" 
              className="btn btn-ghost btn-sm font-mono" 
              onClick={toggleTheme}
              style={{ marginRight: '8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {theme === 'dark' ? '☀️ LIGHT' : '🌙 DARK'}
            </button>
            <button id="btn-logout" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              EXIT
            </button>
          </div>
        </div>
      </header>

      {/* ── TradingView Real-Time Ticker Tape ── */}
      <div style={{ borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
        <TradingViewTickerTape />
      </div>

      <div className="terminal-body">
        {/* ── Left Sidebar Navigation ── */}
        <nav className="terminal-sidebar" id="sidebar">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              id={`nav-${item.label.toLowerCase()}`}
              className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
              title={item.title}
            >
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ── Main Content ── */}
        <main className="terminal-main" id="main-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* ── Status Bar ── */}
      <footer className="terminal-statusbar" id="statusbar">
        <div className="statusbar-left font-mono text-xs">
          <span className="text-accent">■</span>
          <span className="text-muted">QuantDesk v1.0</span>
          <span className="statusbar-sep">│</span>
          <span className="text-muted">PostgreSQL</span>
          <span className="status-dot status-dot--open" style={{ width: 6, height: 6 }} />
          <span className="statusbar-sep">│</span>
          <span className="text-muted">Ollama</span>
          <span className="status-dot status-dot--open" style={{ width: 6, height: 6 }} />
        </div>
        <div className="statusbar-right font-mono text-xs text-muted">
          US/NSE/BSE · USD · New York
        </div>
      </footer>
      {/* ── Live Alert Toasts Overlay ── */}
    </div>
  );
}

export default TerminalLayout;

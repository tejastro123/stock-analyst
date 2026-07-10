import React, { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { userApi } from '../../api';
import TradingViewTickerTape from '../TradingViewTickerTape/TradingViewTickerTape';
import ErrorBoundary from '../ErrorBoundary';
import './Terminal.css';

const NAV_ITEMS = [
  { path: '/dashboard',  label: 'DASH',      title: 'Dashboard' },
  { path: '/screener',   label: 'SCRN',      title: 'Screener' },
  { path: '/portfolio',  label: 'PORT',      title: 'Portfolio' },
  { path: '/options',    label: 'OPT',       title: 'Options' },
  { path: '/charts',     label: 'CHRT',      title: 'Charts' },
  { path: '/crypto',     label: 'CRYP',      title: 'Crypto' },
  { path: '/forex',      label: 'FX',        title: 'Forex' },
  { path: '/macro',      label: 'MCRO',      title: 'Macro' },
  { path: '/news',       label: 'NEWS',      title: 'News' },
  { path: '/alerts',     label: 'ALRT',      title: 'Alerts' },
  { path: '/research',   label: 'RSCH',      title: 'Research' },
  { path: '/analytics',  label: 'RISK',      title: 'Analytics' },
  { path: '/backtester', label: 'BKTS',      title: 'Backtester' },
  { path: '/settings',   label: 'SETT',      title: 'Settings' },
];

function TerminalLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const now = new Date();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    // Load and apply theme setting on mount
    userApi.getSettings()
      .then(res => {
        if (res.data?.theme) {
          document.documentElement.setAttribute('data-theme', res.data.theme);
        }
      })
      .catch(() => {});
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
    </div>
  );
}

export default TerminalLayout;

import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
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

  return (
    <div className="terminal-root">
      {/* ── Top Bar ── */}
      <header className="terminal-topbar" id="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">
            <span className="topbar-logo-q">Q</span>
            <span className="topbar-logo-text">UANTDESK</span>
          </div>
          <div className="topbar-ticker-strip" id="ticker-strip">
            <span className="ticker-item"><span className="ticker-sym">AAPL</span><span className="price-up">213.42 ▲0.84%</span></span>
            <span className="ticker-item"><span className="ticker-sym">TSLA</span><span className="price-up">189.21 ▲1.23%</span></span>
            <span className="ticker-item"><span className="ticker-sym">NVDA</span><span className="price-down">121.55 ▼0.42%</span></span>
            <span className="ticker-item"><span className="ticker-sym">SPY</span><span className="price-up">545.88 ▲0.31%</span></span>
            <span className="ticker-item"><span className="ticker-sym">BTC-USD</span><span className="price-up">67,440 ▲2.14%</span></span>
            <span className="ticker-item"><span className="ticker-sym">GOOGL</span><span className="price-down">178.34 ▼0.18%</span></span>
            <span className="ticker-item"><span className="ticker-sym">MSFT</span><span className="price-up">421.65 ▲0.55%</span></span>
            <span className="ticker-item"><span className="ticker-sym">AMZN</span><span className="price-up">195.12 ▲0.72%</span></span>
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
              <div className="text-xs text-muted">{user?.role || 'trader'}</div>
            </div>
            <button id="btn-logout" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              EXIT
            </button>
          </div>
        </div>
      </header>

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
          <Outlet />
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

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

import LoginPage from './pages/Auth/LoginPage';
import TerminalLayout from './components/Terminal/TerminalLayout';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ScreenerPage from './pages/Screener/ScreenerPage';
import ChartsPage from './pages/Charts/ChartsPage';
import CryptoPage from './pages/Crypto/CryptoPage';
import ForexPage from './pages/Forex/ForexPage';
import PortfolioPage from './pages/Portfolio/PortfolioPage';
import OptionsPage from './pages/Options/OptionsPage';
import PlaceholderPage from './components/PlaceholderPage';
import ResearchPage from './pages/Research/ResearchPage';

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <span className="font-mono text-muted text-sm">Initializing QuantDesk...</span>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Prevent authenticated users from visiting /login
function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return null; // wait for init
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

        {/* Terminal — all protected */}
        <Route path="/" element={
          <PrivateRoute>
            <TerminalLayout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="screener"   element={<ScreenerPage />} />
          <Route path="portfolio"  element={<PortfolioPage />} />
          <Route path="options"    element={<OptionsPage />} />
          <Route path="charts"     element={<ChartsPage />} />
          <Route path="crypto"     element={<CryptoPage />} />
          <Route path="forex"      element={<ForexPage />} />
          <Route path="macro"      element={<PlaceholderPage title="Global Macro & FRED"     code="MCRO" />} />
          <Route path="news"       element={<PlaceholderPage title="News & Sentiment"        code="NEWS" />} />
          <Route path="alerts"     element={<PlaceholderPage title="Alert Engine"            code="ALRT" />} />
          <Route path="research"   element={<ResearchPage />} />
          <Route path="analytics"  element={<PlaceholderPage title="Risk Analytics"          code="RISK" />} />
          <Route path="backtester" element={<PlaceholderPage title="Strategy Backtester"     code="BKTS" />} />
          <Route path="settings"   element={<PlaceholderPage title="Settings"                code="SETT" />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

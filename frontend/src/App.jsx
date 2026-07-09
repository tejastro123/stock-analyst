import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

import LoginPage from './pages/Auth/LoginPage';
import TerminalLayout from './components/Terminal/TerminalLayout';
import DashboardPage from './pages/Dashboard/DashboardPage';
import PlaceholderPage from './components/PlaceholderPage';

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

function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Terminal — all protected */}
        <Route path="/" element={
          <PrivateRoute>
            <TerminalLayout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="screener"   element={<PlaceholderPage title="Stock Screener"         code="SCRN" />} />
          <Route path="portfolio"  element={<PlaceholderPage title="Portfolio Tracker"       code="PORT" />} />
          <Route path="options"    element={<PlaceholderPage title="Options Chain & Greeks"  code="OPT" />} />
          <Route path="charts"     element={<PlaceholderPage title="Advanced Charts"         code="CHRT" />} />
          <Route path="crypto"     element={<PlaceholderPage title="Crypto Dashboard"        code="CRYP" />} />
          <Route path="forex"      element={<PlaceholderPage title="Forex Markets"           code="FX" />} />
          <Route path="macro"      element={<PlaceholderPage title="Global Macro & FRED"     code="MCRO" />} />
          <Route path="news"       element={<PlaceholderPage title="News & Sentiment"        code="NEWS" />} />
          <Route path="alerts"     element={<PlaceholderPage title="Alert Engine"            code="ALRT" />} />
          <Route path="research"   element={<PlaceholderPage title="AI Research Reports"     code="RSCH" />} />
          <Route path="analytics"  element={<PlaceholderPage title="Risk Analytics"          code="RISK" />} />
          <Route path="backtester" element={<PlaceholderPage title="Strategy Backtester"     code="BKTS" />} />
          <Route path="settings"   element={<PlaceholderPage title="Settings"                code="SETT" />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
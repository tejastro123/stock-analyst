import React, { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import { ToastProvider } from './components/Toast/Toast';

import LoginPage from './pages/Auth/LoginPage';
import TerminalLayout from './components/Terminal/TerminalLayout';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ScreenerPage from './pages/Screener/ScreenerPage';
import ChartsPage from './pages/Charts/ChartsPage';
import PortfolioPage from './pages/Portfolio/PortfolioPage';
import PlaceholderPage from './components/PlaceholderPage';
import ResearchPage from './pages/Research/ResearchPage';

import AlertsPage from './pages/Alerts/AlertsPage';
import BacktesterPage from './pages/Backtester/BacktesterPage';
import NewsPage from './pages/News/NewsPage';
import AnalyticsPage from './pages/Analytics/AnalyticsPage';
import SettingsPage from './pages/Settings/SettingsPage';
import WealthOSPage from './pages/WealthOS/WealthOSPage';
import EnterprisePage from './pages/Enterprise/EnterprisePage';



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

  const isElectron = navigator.userAgent.toLowerCase().includes('electron');
  const Router = isElectron ? HashRouter : BrowserRouter;

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
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
          <Route path="wealthos"   element={<WealthOSPage />} />
          <Route path="enterprise" element={<EnterprisePage />} />
          <Route path="charts"     element={<ChartsPage />} />
          <Route path="news"       element={<NewsPage />} />
          <Route path="alerts"     element={<AlertsPage />} />
          <Route path="research"   element={<ResearchPage />} />
          <Route path="analytics"  element={<AnalyticsPage />} />
          <Route path="backtester" element={<BacktesterPage />} />
          <Route path="settings"   element={<SettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </ToastProvider>
    </Router>
  );
}

export default App;

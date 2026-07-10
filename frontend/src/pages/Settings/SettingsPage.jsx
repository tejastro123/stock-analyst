import React, { useState, useEffect } from 'react';
import { userApi } from '../../api';
import useAuthStore from '../../store/authStore';
import { useToast } from '../../components/Toast/Toast';
import './Settings.css';

function SettingsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'developer' | 'account'
  
  // Settings Form States
  const [theme, setTheme] = useState('dark');
  const [defaultMarket, setDefaultMarket] = useState('US');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [layoutConfig, setLayoutConfig] = useState({});

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch initial settings
    userApi.getSettings()
      .then(res => {
        const data = res.data;
        if (data) {
          if (data.theme) {
            setTheme(data.theme);
            document.documentElement.setAttribute('data-theme', data.theme);
          }
          if (data.default_market) setDefaultMarket(data.default_market === 'IN' ? 'NSE' : data.default_market);
          if (data.currency) setCurrency(data.currency);
          if (data.timezone) setTimezone(data.timezone);
          if (data.layout_config) setLayoutConfig(data.layout_config);
        }
      })
      .catch(err => console.error('Failed to load settings:', err));
  }, []);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    if (user?.role === 'viewer') {
      toast.error('Permission Denied: Viewer role is read-only.');
      return;
    }
    setLoading(true);

    userApi.updateSettings({
      theme,
      default_market: defaultMarket,
      currency,
      timezone,
      layout_config: layoutConfig
    })
      .then(() => {
        toast.success('Settings saved successfully!');
      })
      .catch(err => {
        toast.error('Failed to save settings: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="settings-root">
      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
        <h1 className="font-mono text-sm fw-700 uppercase" style={{ color: '#00ff88', letterSpacing: '0.05em' }}>
          ⚙️ QuantDesk Terminal Settings
        </h1>
        <span className="badge badge-green font-mono">SYSTEM NORMAL</span>
      </div>

      <div className="settings-layout">
        {/* Navigation Sidebar */}
        <div className="settings-nav">
          <button 
            className={`settings-nav-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            💻 GENERAL PREFERENCES
          </button>
          <button 
            className={`settings-nav-btn ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            👤 USER ACCOUNT
          </button>
          <button 
            className={`settings-nav-btn ${activeTab === 'developer' ? 'active' : ''}`}
            onClick={() => setActiveTab('developer')}
          >
            🛠 DEVELOPER & API KEYS
          </button>
        </div>

        {/* Content Area */}
        <div className="settings-content">
          {/* Inline messages removed — using global toast */}

          {activeTab === 'general' && (
            <div className="panel flex-1">
              <div className="panel-header">
                <span className="panel-title">General Preferences</span>
              </div>
              <div className="panel-body font-mono text-xs" style={{ padding: '16px' }}>
                <form onSubmit={handleSaveSettings} className="flex flex-col gap-4" style={{ maxWidth: '480px' }}>
                  <div className="form-field">
                    <label className="text-muted uppercase fw-600 text-xxs">Color Theme</label>
                    <select className="form-input" value={theme} onChange={e => {
                      const t = e.target.value;
                      setTheme(t);
                      document.documentElement.setAttribute('data-theme', t);
                    }}>
                      <option value="dark">Monochromatic Obsidian (Dark)</option>
                      <option value="cyberpunk">Cyberpunk Neon</option>
                      <option value="light">Bloomberg Classic (Light)</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="text-muted uppercase fw-600 text-xxs">Default Exchange Region</label>
                    <select className="form-input" value={defaultMarket} onChange={e => setDefaultMarket(e.target.value)}>
                      <option value="US">US Markets (NASDAQ, NYSE)</option>
                      <option value="EU">European Markets (LSE, Euronext)</option>
                      <option value="NSE">Indian Markets - NSE</option>
                      <option value="BSE">Indian Markets - BSE</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="text-muted uppercase fw-600 text-xxs">Base Trading Currency</label>
                    <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="text-muted uppercase fw-600 text-xxs">Market Timezone</label>
                    <select className="form-input" value={timezone} onChange={e => setTimezone(e.target.value)}>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="EST">EST (Eastern Standard Time - NY)</option>
                      <option value="GMT">GMT (London Time)</option>
                      <option value="IST">IST (Indian Standard Time - Mumbai)</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary font-mono btn-md mt-2" disabled={loading || user?.role === 'viewer'}>
                    {user?.role === 'viewer' ? 'READ-ONLY MODE' : (loading ? 'SAVING PREFERENCES...' : 'SAVE CHANGES')}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="panel flex-1">
              <div className="panel-header">
                <span className="panel-title">User Account Information</span>
              </div>
              <div className="panel-body font-mono text-xs flex flex-col gap-3" style={{ padding: '16px', maxWidth: '480px' }}>
                <div className="flex justify-between" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '6px' }}>
                  <span className="text-muted">Username:</span>
                  <span className="text-white fw-700">{user?.username || '—'}</span>
                </div>
                <div className="flex justify-between" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '6px' }}>
                  <span className="text-muted">Email Address:</span>
                  <span className="text-white">{user?.email || '—'}</span>
                </div>
                <div className="flex justify-between" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '6px' }}>
                  <span className="text-muted">Account Tier:</span>
                  <span className="badge badge-green text-xxs fw-700">PRO INSTITUTIONAL</span>
                </div>
                <div className="flex justify-between" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '6px' }}>
                  <span className="text-muted">Session Status:</span>
                  <span className="text-green">Authenticated (JWT)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'developer' && (
            <div className="panel flex-1">
              <div className="panel-header">
                <span className="panel-title">Developer Integrations & API Connections</span>
              </div>
              <div className="panel-body font-mono text-xs flex flex-col gap-4" style={{ padding: '16px' }}>
                <div>
                  <div className="text-secondary fw-700 text-xxs mb-1">DATA FLOW MICROSERVICES</div>
                  <div className="flex flex-col gap-2 p-3" style={{ background: '#11111b', borderRadius: '4px', border: '1px solid #1f2937' }}>
                    <div className="flex justify-between">
                      <span className="text-muted">Python FastAPI URL:</span>
                      <span className="text-blue">http://localhost:8000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Node.js Express API:</span>
                      <span className="text-blue">http://localhost:3001</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-secondary fw-700 text-xxs mb-1">FRED DATABASE (FEDERAL RESERVE BANK OF ST. LOUIS)</div>
                  <div className="p-3" style={{ background: '#11111b', borderRadius: '4px', border: '1px solid #1f2937' }}>
                    <p className="text-muted" style={{ margin: '0 0 8px 0', fontSize: '10px' }}>
                      To pull actual yields and core economic benchmarks directly from FRED, ensure you define your API Key in your workspace's root `.env` file:
                    </p>
                    <pre style={{ margin: 0, background: '#06060c', padding: '6px', borderRadius: '2px', color: '#00ff88', fontSize: '10px' }}>
                      FRED_API_KEY=your_actual_fred_key_here
                    </pre>
                  </div>
                </div>

                <div>
                  <div className="text-secondary fw-700 text-xxs mb-1">LOCAL AI SERVICES (OLLAMA MISTRAL MODEL)</div>
                  <div className="p-3" style={{ background: '#11111b', borderRadius: '4px', border: '1px solid #1f2937' }}>
                    <p className="text-muted" style={{ margin: '0 0 8px 0', fontSize: '10px' }}>
                      QuantDesk leverages local Mistral/Llama inference models for advanced portfolio reviews, sentiment analysis, and research report generations.
                    </p>
                    <div className="flex justify-between">
                      <span className="text-muted">Ollama Server Host:</span>
                      <span>http://localhost:11434</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;

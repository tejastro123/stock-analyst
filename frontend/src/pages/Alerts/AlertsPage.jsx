import React, { useState, useEffect, useRef } from 'react';
import { alertsApi, userApi } from '../../api';
import useAuthStore from '../../store/authStore';
import useMarketStore from '../../store/marketStore';
import './Alerts.css';

function AlertsPage() {
  const { user } = useAuthStore();
  const { activeMarket } = useMarketStore();
  const [alerts, setAlerts] = useState([]);
  const [symbol, setSymbol] = useState('');
  const [alertType, setAlertType] = useState('price_above');
  const [threshold, setThreshold] = useState('');
  const [message, setMessage] = useState('');
  const [market, setMarket] = useState(activeMarket);
  const [currencySymbol, setCurrencySymbol] = useState(activeMarket === 'US' ? '$' : '₹');
  
  // Real-time notifications
  const [notifications, setNotifications] = useState([]);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef(null);

  // Helper to format currency
  const formatCurrency = (val, mkt) => {
    const isIndian = mkt === 'NSE' || mkt === 'BSE';
    const sym = isIndian ? '₹' : '$';
    return `${sym}${parseFloat(val).toFixed(2)}`;
  };

  // 1. Fetch current alerts list
  const fetchAlerts = () => {
    alertsApi.getAlerts()
      .then(res => setAlerts(res.data))
      .catch(err => console.error('Failed to fetch alerts:', err));
  };

  const reconnectTimer = useRef(null);
  const retryCount = useRef(0);
  const MAX_RETRIES = 5;

  const connectWebSocket = () => {
    const token = localStorage.getItem('qd_access_token');
    if (!token) return;

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//localhost:3001/ws?token=${token}`;

    setWsStatus('CONNECTING');
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setWsStatus('CONNECTED');
      retryCount.current = 0;
      console.log('🔌 WebSocket connection established.');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received socket event:', data);
        if (data.type === 'ALERT_TRIGGERED') {
          setNotifications(prev => [data.alert, ...prev]);
          fetchAlerts();
          if (Notification.permission === 'granted') {
            new Notification(`🔔 QuantDesk Triggered: ${data.alert.symbol}`, {
              body: data.alert.message || `${data.alert.symbol} crossed ${data.alert.threshold}`
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setWsStatus('DISCONNECTED');
      console.log('🔌 WebSocket connection closed.');
      if (retryCount.current < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        retryCount.current += 1;
        console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${retryCount.current}/${MAX_RETRIES})...`);
        reconnectTimer.current = setTimeout(connectWebSocket, delay);
      } else {
        console.warn('🚫 Max WS reconnect attempts reached. Staying offline.');
      }
    };

    ws.onerror = () => {
      setWsStatus('ERROR');
    };
  };

  useEffect(() => {
    fetchAlerts();
    connectWebSocket();

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      retryCount.current = MAX_RETRIES;
      clearTimeout(reconnectTimer.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    setMarket(activeMarket);
    setCurrencySymbol(activeMarket === 'US' ? '$' : '₹');
    setSymbol(activeMarket === 'US' ? 'AAPL' : 'RELIANCE');
  }, [activeMarket]);

  const handleCreateAlert = (e) => {
    e.preventDefault();
    if (user?.role === 'viewer') {
      setError('Permission Denied: Viewer accounts cannot create alerts.');
      return;
    }
    if (!symbol || !threshold) return;

    setLoading(true);
    setError('');

    alertsApi.createAlert({
      symbol: symbol.toUpperCase(),
      alert_type: alertType,
      threshold: parseFloat(threshold),
      message: message || `${symbol.toUpperCase()} has crossed your target limit of ${threshold}`,
      market: market
    })
      .then(() => {
        setSymbol('');
        setThreshold('');
        setMessage('');
        fetchAlerts();
      })
      .catch(err => {
        setError('Failed to create alert: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleToggleAlert = (id) => {
    if (user?.role === 'viewer') {
      setError('Permission Denied: Viewer accounts cannot toggle alerts.');
      return;
    }
    alertsApi.toggleAlert(id)
      .then(() => fetchAlerts())
      .catch(err => console.error('Failed to toggle alert:', err));
  };

  const handleDeleteAlert = (id) => {
    if (user?.role === 'viewer') {
      setError('Permission Denied: Viewer accounts cannot delete alerts.');
      return;
    }
    alertsApi.deleteAlert(id)
      .then(() => fetchAlerts())
      .catch(err => console.error('Failed to delete alert:', err));
  };

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div className="alerts-root">
      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
        <h1 className="font-mono text-sm fw-700 uppercase" style={{ color: '#00ff88', letterSpacing: '0.05em' }}>
          🛡️ Real-Time Signal Alert Engine
        </h1>
        <div className="flex gap-2 items-center">
          <span className="font-mono text-xxs text-muted">SOCKET STATUS:</span>
          {wsStatus === 'CONNECTED' ? (
            <span className="badge badge-green font-mono text-xxs">ONLINE</span>
          ) : wsStatus === 'CONNECTING' ? (
            <span className="badge badge-amber font-mono text-xxs animate-pulse">CONNECTING...</span>
          ) : (
            <span className="badge badge-red font-mono text-xxs">OFFLINE</span>
          )}
        </div>
      </div>

      {/* Push alert banner if any notification triggered just now */}
      {notifications.length > 0 && (
        <div className="notifications-box flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="fw-700 text-green font-mono text-xs">🔔 PUSH ALERT RECEIVED:</span>
            <button 
              className="text-muted font-mono hover:text-white" 
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px' }}
              onClick={() => setNotifications([])}
            >
              CLEAR CONSOLE
            </button>
          </div>
          {notifications.slice(0, 3).map((n, i) => (
            <div key={i} className="font-mono text-xxs text-secondary" style={{ borderLeft: '2px solid #00ff88', paddingLeft: '8px', margin: '4px 0' }}>
              [{new Date(n.triggered_at).toLocaleTimeString()}] Ticker <span className="text-white fw-700">{n.symbol} ({n.market || 'US'})</span> triggered at <span className="text-green">{formatCurrency(n.trigger_price, n.market)}</span> (Threshold: {formatCurrency(n.threshold, n.market)}) — {n.message}
            </div>
          ))}
        </div>
      )}

      <div className="alerts-layout">
        {/* Left column - forms */}
        <div className="alerts-sidebar">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Create New Trigger</span>
            </div>
            <div className="panel-body font-mono text-xs" style={{ padding: '12px' }}>
              <form onSubmit={handleCreateAlert} className="flex flex-col gap-3">
                {error && <div className="text-red text-xxs">⚠ {error}</div>}

                <div className="form-field">
                  <label className="text-muted uppercase fw-600 text-xxs">Ticker Symbol</label>
                  <input
                    className="form-input"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. RELIANCE / AAPL"
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="text-muted uppercase fw-600 text-xxs">Market Exchange</label>
                  <select
                    className="form-input"
                    value={market}
                    onChange={e => setMarket(e.target.value)}
                  >
                    <option value="NSE">NSE (India)</option>
                    <option value="BSE">BSE (India)</option>
                    <option value="US">US Market</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="text-muted uppercase fw-600 text-xxs">Condition Trigger</label>
                  <select
                    className="form-input"
                    value={alertType}
                    onChange={e => setAlertType(e.target.value)}
                  >
                    <option value="price_above">Price Crosses Above</option>
                    <option value="price_below">Price Crosses Below</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="text-muted uppercase fw-600 text-xxs">Threshold Target Price ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    placeholder="150.00"
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="text-muted uppercase fw-600 text-xxs">Push Message (Optional)</label>
                  <textarea
                    className="form-input"
                    style={{ height: '60px', resize: 'none' }}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Alert message details..."
                  />
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={loading || user?.role === 'viewer'}>
                  {user?.role === 'viewer' ? 'READ-ONLY MODE' : (loading ? 'CREATING...' : 'ACTIVATE TARGET TRIGGER')}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right column - tables */}
        <div className="alerts-main">
          {/* Active Triggers */}
          <div className="panel flex-1">
            <div className="panel-header">
              <span className="panel-title">Active Price Targets & Signals ({activeAlerts.length})</span>
            </div>
            <div className="panel-body flex flex-col gap-2" style={{ padding: '10px', maxHeight: '300px', overflowY: 'auto' }}>
              {activeAlerts.length === 0 ? (
                <div className="text-muted font-mono text-xs text-center py-6">
                  No active signals monitored. Use the form to set a price target.
                </div>
              ) : (
                activeAlerts.map(alert => (
                  <div key={alert.id} className="alert-item-card active">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-2 items-center">
                        <span className="fw-700 text-white text-sm">{alert.symbol}</span>
                        <span className="badge badge-secondary text-xxs font-mono">{alert.market || 'US'}</span>
                        <span className={`badge ${alert.alert_type === 'price_above' ? 'badge-green' : 'badge-red'} text-xxs`}>
                          {alert.alert_type === 'price_above' ? 'CROSSES ABOVE' : 'CROSSES BELOW'}
                        </span>
                        <span className="text-green fw-700">{formatCurrency(alert.threshold, alert.market)}</span>
                      </div>
                      <span className="text-muted text-xxs">{alert.message}</span>
                    </div>

                    {user?.role !== 'viewer' && (
                      <div className="flex gap-2 items-center">
                        <button 
                          onClick={() => handleToggleAlert(alert.id)}
                          className={`btn ${alert.is_active ? 'btn-secondary' : 'btn-primary'} btn-xs font-mono`}
                        >
                          {alert.is_active ? 'PAUSE' : 'RESUME'}
                        </button>
                        <button 
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="btn btn-red btn-xs font-mono"
                          style={{ background: '#ff3b30', border: '1px solid #ff3b30' }}
                        >
                          DELETE
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Triggered logs */}
          <div className="panel flex-1">
            <div className="panel-header">
              <span className="panel-title">Historic Trigger Logs ({triggeredAlerts.length})</span>
            </div>
            <div className="panel-body flex flex-col gap-2" style={{ padding: '10px', maxHeight: '300px', overflowY: 'auto' }}>
              {triggeredAlerts.length === 0 ? (
                <div className="text-muted font-mono text-xs text-center py-6">
                  No historic alert logs.
                </div>
              ) : (
                triggeredAlerts.map(alert => (
                  <div key={alert.id} className="alert-item-card triggered">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-2 items-center">
                        <span className="fw-700 text-white text-sm">{alert.symbol}</span>
                        <span className="badge badge-secondary text-xxs font-mono">{alert.market || 'US'}</span>
                        <span className="badge badge-amber text-xxs">TRIGGERED</span>
                        <span className="text-muted text-xxs">Limit: {formatCurrency(alert.threshold, alert.market)}</span>
                      </div>
                      <span className="text-secondary text-xxs">{alert.message}</span>
                    </div>

                    <div className="flex flex-col items-end gap-1 font-mono text-xxs">
                      <span className="text-muted">Triggered at:</span>
                      <span className="text-white">{alert.triggered_at ? new Date(alert.triggered_at).toLocaleString() : '—'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlertsPage;

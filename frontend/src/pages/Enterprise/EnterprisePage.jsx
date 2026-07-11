import React, { useState, useEffect } from 'react';
import { enterpriseApi } from '../../api';
import useAuthStore from '../../store/authStore';

function EnterprisePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('family');

  // Multi-user & RBAC
  const [users, setUsers] = useState([]);
  const [rbacError, setRbacError] = useState('');

  // Family Portfolios
  const [families, setFamilies] = useState([]);
  const [familyName, setFamilyName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [familyPortfolio, setFamilyPortfolio] = useState(null);
  const [fxCurrency, setFxCurrency] = useState('USD');

  // Advisor & Clients
  const [clients, setClients] = useState([]);
  const [clientEmailInput, setClientEmailInput] = useState('');
  const [impersonatedClient, setImpersonatedClient] = useState(null);
  const [clientPortfolioData, setClientPortfolioData] = useState([]);

  // Shared watchlists
  const [sharedReceived, setSharedReceived] = useState([]);
  const [shareForm, setShareForm] = useState({ resourceType: 'watchlist', resourceId: '', shareWithEmail: '', permission: 'read' });

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);

  // Encrypted Credentials
  const [credentials, setCredentials] = useState([]);
  const [credForm, setCredForm] = useState({ serviceName: 'broker_api', secretData: '' });
  const [decryptedValue, setDecryptedValue] = useState(null);

  // API keys & Webhooks
  const [apiKeys, setApiKeys] = useState([]);
  const [newApiKeyRaw, setNewApiKeyRaw] = useState('');
  const [apiKeyName, setApiKeyName] = useState('');
  const [webhooks, setWebhooks] = useState([]);
  const [webhookForm, setWebhookForm] = useState({ url: '', eventTypes: ['portfolio.updated'] });

  // Scheduled reports
  const [reports, setReports] = useState([]);
  const [reportForm, setReportForm] = useState({ reportType: 'portfolio', format: 'pdf', frequency: 'daily', emailRecipient: user?.email || '' });

  // Broker Importers
  const [selectedBroker, setSelectedBroker] = useState('zerodha');
  const [csvRawText, setCsvRawText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [importPreview, setImportPreview] = useState([]);

  // Offline status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Load baseline data
  useEffect(() => {
    fetchFamilyGroups();
    fetchAdvisorClients();
    fetchSharedResources();
    fetchAuditLogs();
    fetchCredentials();
    fetchApiKeys();
    fetchWebhooks();
    fetchScheduledReports();
    if (user?.role === 'admin') {
      fetchUsersList();
    }

    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      updateOfflineQueueCount();
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('qd_offline_action_queued', updateOfflineQueueCount);
    window.addEventListener('qd_offline_sync_complete', updateOfflineQueueCount);

    updateOfflineQueueCount();

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('qd_offline_action_queued', updateOfflineQueueCount);
      window.removeEventListener('qd_offline_sync_complete', updateOfflineQueueCount);
    };
  }, [user]);

  const updateOfflineQueueCount = () => {
    try {
      const q = JSON.parse(localStorage.getItem('qd_offline_queue')) || [];
      setOfflineQueueCount(q.length);
    } catch {
      setOfflineQueueCount(0);
    }
  };

  // 1. RBAC fetch
  const fetchUsersList = async () => {
    try {
      const res = await enterpriseApi.getUsers();
      setUsers(res.data);
    } catch (err) {
      setRbacError('Failed to fetch user list. Admin access required.');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await enterpriseApi.updateUser(userId, { role: newRole });
      fetchUsersList();
      fetchAuditLogs();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      await enterpriseApi.updateUser(userId, { is_active: !currentStatus });
      fetchUsersList();
      fetchAuditLogs();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle status');
    }
  };

  // 2. Family Groups
  const fetchFamilyGroups = async () => {
    try {
      const res = await enterpriseApi.getFamily();
      setFamilies(res.data);
      if (res.data.length > 0 && !selectedFamilyId) {
        setSelectedFamilyId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFamily = async (e) => {
    e.preventDefault();
    if (!familyName) return;
    try {
      await enterpriseApi.createFamily(familyName);
      setFamilyName('');
      fetchFamilyGroups();
      fetchAuditLogs();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create family');
    }
  };

  const handleAddFamilyMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail || !selectedFamilyId) return;
    try {
      // Find user id by email from our fetched users if available
      const targetUser = users.find(u => u.email === newMemberEmail);
      if (!targetUser) {
        alert('Could not resolve user from active users list. Make sure the user is registered.');
        return;
      }
      await enterpriseApi.addFamilyMember(selectedFamilyId, { userId: targetUser.id, role: 'member' });
      setNewMemberEmail('');
      fetchFamilyGroups();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member');
    }
  };

  // Aggregate Family Portfolio
  useEffect(() => {
    if (selectedFamilyId) {
      fetchFamilyPortfolioAggregate();
    }
  }, [selectedFamilyId, fxCurrency]);

  const fetchFamilyPortfolioAggregate = async () => {
    try {
      const res = await enterpriseApi.getFamilyPortfolio(selectedFamilyId, fxCurrency);
      setFamilyPortfolio(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Advisor Workspace
  const fetchAdvisorClients = async () => {
    try {
      const res = await enterpriseApi.getAdvisorClients();
      setClients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestClient = async (e) => {
    e.preventDefault();
    if (!clientEmailInput) return;
    try {
      await enterpriseApi.requestAdvisorClient(clientEmailInput);
      setClientEmailInput('');
      fetchAdvisorClients();
    } catch (err) {
      alert(err.response?.data?.error || 'Client request failed');
    }
  };

  const handleImpersonateClient = async (client) => {
    try {
      const res = await enterpriseApi.getClientPortfolio(client.client_id);
      setImpersonatedClient(client);
      setClientPortfolioData(res.data);
    } catch (err) {
      alert('Impersonation failed: ' + (err.response?.data?.error || err.message));
    }
  };

  // 4. Shared Resources
  const fetchSharedResources = async () => {
    try {
      const res = await enterpriseApi.getSharedReceived();
      setSharedReceived(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareResource = async (e) => {
    e.preventDefault();
    if (!shareForm.resourceId || !shareForm.shareWithEmail) return;
    try {
      await enterpriseApi.shareResource(shareForm);
      alert('Asset shared successfully!');
      setShareForm({ resourceType: 'watchlist', resourceId: '', shareWithEmail: '', permission: 'read' });
      fetchSharedResources();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to share asset');
    }
  };

  // 5. Audit Logs
  const fetchAuditLogs = async () => {
    try {
      const res = await enterpriseApi.getAuditLogs();
      setAuditLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // 6. Encrypted Credentials
  const fetchCredentials = async () => {
    try {
      const res = await enterpriseApi.getCredentials();
      setCredentials(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStoreCredentials = async (e) => {
    e.preventDefault();
    if (!credForm.secretData) return;
    try {
      await enterpriseApi.storeCredentials(credForm.serviceName, credForm.secretData);
      setCredForm({ serviceName: 'broker_api', secretData: '' });
      fetchCredentials();
      fetchAuditLogs();
      alert('API credentials encrypted and stored!');
    } catch (err) {
      alert(err.response?.data?.error || 'Store failed');
    }
  };

  const handleDecryptCredentials = async (id) => {
    try {
      const res = await enterpriseApi.decryptCredentials(id);
      setDecryptedValue(res.data.secret_data);
    } catch (err) {
      alert('Decryption failed');
    }
  };

  // 7. API Keys & Webhooks
  const fetchApiKeys = async () => {
    try {
      const res = await enterpriseApi.getApiKeys();
      setApiKeys(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateApiKey = async (e) => {
    e.preventDefault();
    if (!apiKeyName) return;
    try {
      const res = await enterpriseApi.createApiKey(apiKeyName);
      setNewApiKeyRaw(res.data.api_key);
      setApiKeyName('');
      fetchApiKeys();
      fetchAuditLogs();
    } catch (err) {
      alert('Failed to generate key');
    }
  };

  const handleRevokeApiKey = async (id) => {
    try {
      await enterpriseApi.deleteApiKey(id);
      fetchApiKeys();
    } catch (err) {
      alert('Failed to revoke');
    }
  };

  const fetchWebhooks = async () => {
    try {
      const res = await enterpriseApi.getWebhooks();
      setWebhooks(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterWebhook = async (e) => {
    e.preventDefault();
    if (!webhookForm.url) return;
    try {
      await enterpriseApi.createWebhook(webhookForm.url, webhookForm.eventTypes);
      setWebhookForm({ url: '', eventTypes: ['portfolio.updated'] });
      fetchWebhooks();
    } catch (err) {
      alert('Webhook setup failed');
    }
  };

  const handleDeleteWebhook = async (id) => {
    try {
      await enterpriseApi.deleteWebhook(id);
      fetchWebhooks();
    } catch (err) {
      alert('Delete failed');
    }
  };

  // 8. Scheduled Reports
  const fetchScheduledReports = async () => {
    try {
      const res = await enterpriseApi.getScheduledReports();
      setReports(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScheduleReport = async (e) => {
    e.preventDefault();
    try {
      await enterpriseApi.scheduleReport(reportForm);
      fetchScheduledReports();
      fetchAuditLogs();
      alert('Report scheduled successfully!');
    } catch (err) {
      alert('Schedule failed');
    }
  };

  const handleDeleteReport = async (id) => {
    try {
      await enterpriseApi.deleteScheduledReport(id);
      fetchScheduledReports();
    } catch (err) {
      alert('Delete failed');
    }
  };

  // 9. Broker Importers
  const handleCsvFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setCsvRawText(text);
      previewCsvData(text);
    };
    reader.readAsText(file);
  };

  const previewCsvData = (text) => {
    const rows = text.split('\n').map(r => r.trim()).filter(r => r.length > 0);
    if (rows.length < 2) {
      setImportPreview([]);
      return;
    }
    // Parse headers and first 3 rows for preview
    const list = [];
    const headers = rows[0].split(',');
    for (let i = 1; i < Math.min(rows.length, 5); i++) {
      const cells = rows[i].split(',');
      list.push(cells);
    }
    setImportPreview({ headers, data: list });
  };

  const handleBrokerImport = async (e) => {
    e.preventDefault();
    if (!csvRawText) return;
    setImportStatus('Uploading trade data...');
    try {
      const res = await enterpriseApi.importBrokerCsv(selectedBroker, csvRawText);
      setImportStatus(res.data.message);
      setCsvRawText('');
      setImportPreview([]);
      fetchAuditLogs();
    } catch (err) {
      setImportStatus('Import failed: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ padding: '20px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
      {/* Page Title & Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-accent)' }}>🏛️ ENTERPRISE HUB</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bloomberg-Grade Family & Institutional Workspaces</span>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          {/* Offline Sync State Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#161622', padding: '5px 10px', borderRadius: '4px', border: '1px solid var(--border-primary)', fontSize: '11px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#00ff88' : '#ff3b30', display: 'inline-block' }} />
            <span>{isOnline ? 'ONLINE' : 'OFFLINE MODE'}</span>
            {offlineQueueCount > 0 && (
              <span className="badge badge-amber font-mono" style={{ padding: '1px 5px', fontSize: '9px', marginLeft: '5px' }}>
                {offlineQueueCount} SYNCING...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', background: '#161622', padding: '2px', borderRadius: '4px', marginBottom: '20px' }}>
        <button className={`btn btn-sm ${activeTab === 'family' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('family')}>FAMILY AGGREGATION</button>
        <button className={`btn btn-sm ${activeTab === 'advisor' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('advisor')}>ADVISOR WORKSPACE</button>
        <button className={`btn btn-sm ${activeTab === 'sharing' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('sharing')}>RESOURCE SHARING</button>
        <button className={`btn btn-sm ${activeTab === 'encryption' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('encryption')}>ENCRYPTION & VAULT</button>
        <button className={`btn btn-sm ${activeTab === 'api' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('api')}>API KEY & WEBHOOKS</button>
        <button className={`btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('reports')}>REPORTS SCHEDULER</button>
        <button className={`btn btn-sm ${activeTab === 'importer' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('importer')}>BROKER IMPORT</button>
        {user?.role === 'admin' && (
          <button className={`btn btn-sm ${activeTab === 'rbac' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('rbac')} style={{ color: '#00f0ff' }}>USER RBAC ADMIN</button>
        )}
        <button className={`btn btn-sm ${activeTab === 'logs' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('logs')}>AUDIT LOGS</button>
      </div>

      {/* Grid Layouts inside tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        
        {/* ===================== TAB: FAMILY ===================== */}
        {activeTab === 'family' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Family Groups</h3>
              <form onSubmit={handleCreateFamily} style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input type="text" className="form-input" placeholder="New family group name" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
                  <button type="submit" className="btn btn-primary btn-sm">CREATE</button>
                </div>
              </form>

              {families.map(fam => (
                <div key={fam.id} onClick={() => setSelectedFamilyId(fam.id)} style={{ padding: '10px', background: selectedFamilyId === fam.id ? '#1e1e2f' : '#11111b', border: selectedFamilyId === fam.id ? '1px solid #00ff88' : '1px solid var(--border-primary)', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 'bold' }}>{fam.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fam.members?.length || 0} Members</div>
                </div>
              ))}

              {selectedFamilyId && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-primary)', paddingTop: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>Invite Member</h4>
                  <form onSubmit={handleAddFamilyMember}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input type="email" className="form-input" placeholder="Member email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} />
                      <button type="submit" className="btn btn-primary btn-sm">ADD</button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: 'var(--text-accent)' }}>Aggregated Family Portfolio</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TARGET CURRENCY:</span>
                  <select value={fxCurrency} onChange={(e) => setFxCurrency(e.target.value)} className="form-input" style={{ width: '80px', height: '24px', padding: '0 5px' }}>
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              {familyPortfolio ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ background: '#161622', padding: '15px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TOTAL AGGREGATED VALUATION</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00ff88', marginTop: '5px' }}>
                        {fxCurrency === 'INR' ? '₹' : fxCurrency === 'EUR' ? '€' : '$'}
                        {familyPortfolio.total_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ background: '#161622', padding: '15px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TARGET CONVERSION RATE</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '5px' }}>
                        Auto-adjusted using live FX metrics
                      </div>
                    </div>
                  </div>

                  <table className="table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Portfolio</th>
                        <th>Symbol</th>
                        <th>Type</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Cost (Local)</th>
                        <th className="text-right">Total Basis ({fxCurrency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {familyPortfolio.positions?.map((pos, idx) => (
                        <tr key={idx}>
                          <td>{pos.username}</td>
                          <td>{pos.portfolio_name}</td>
                          <td style={{ fontWeight: 'bold', color: '#00f0ff' }}>{pos.symbol}</td>
                          <td>{pos.asset_type}</td>
                          <td className="text-right">{parseFloat(pos.quantity).toFixed(2)}</td>
                          <td className="text-right">{parseFloat(pos.avg_cost).toFixed(2)} {pos.base_currency}</td>
                          <td className="text-right" style={{ color: '#00ff88', fontWeight: 'bold' }}>
                            {pos.cost_basis_target?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      {(!familyPortfolio.positions || familyPortfolio.positions.length === 0) && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                            No active holdings found in family portfolios.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Select or create a family group to load aggregation matrix.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: ADVISOR WORKSPACE ===================== */}
        {activeTab === 'advisor' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Advisor Console</h3>
              <form onSubmit={handleRequestClient} style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>LINK NEW CLIENT:</div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input type="email" className="form-input" placeholder="Client registered email" value={clientEmailInput} onChange={(e) => setClientEmailInput(e.target.value)} />
                  <button type="submit" className="btn btn-primary btn-sm">LINK</button>
                </div>
              </form>

              <h4 style={{ margin: '0 0 10px 0' }}>Linked Clients</h4>
              {clients.map(client => (
                <div key={client.client_id} style={{ padding: '10px', background: '#161622', border: '1px solid var(--border-primary)', borderRadius: '4px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>{client.username}</span>
                    <span className={`badge ${client.status === 'active' ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '9px' }}>
                      {client.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{client.email}</div>
                  {client.status === 'active' && (
                    <button className="btn btn-ghost btn-xs font-mono" style={{ width: '100%', marginTop: '8px', background: '#1e1e2f', color: '#00ff88' }} onClick={() => handleImpersonateClient(client)}>
                      IMPERSONATE WORKSPACE
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Client Portfolio Workspace</h3>
              {impersonatedClient ? (
                <div>
                  <div style={{ background: '#161622', padding: '10px 15px', borderRadius: '4px', border: '1px solid #00f0ff', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CURRENT WORKSPACE: </span>
                      <strong style={{ color: '#00f0ff' }}>{impersonatedClient.full_name || impersonatedClient.username} ({impersonatedClient.email})</strong>
                    </div>
                    <button className="btn btn-ghost btn-xs" style={{ border: '1px solid #ff3b30', color: '#ff3b30' }} onClick={() => setImpersonatedClient(null)}>
                      CLOSE WORKSPACE
                    </button>
                  </div>

                  {clientPortfolioData.map((port, idx) => (
                    <div key={idx} style={{ marginBottom: '20px', background: '#11111b', padding: '15px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-accent)' }}>{port.name} ({port.currency})</h4>
                      <table className="table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Asset Type</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Avg Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {port.positions?.map((pos, pIdx) => (
                            <tr key={pIdx}>
                              <td style={{ fontWeight: 'bold' }}>{pos.symbol}</td>
                              <td>{pos.asset_type}</td>
                              <td className="text-right">{parseFloat(pos.quantity).toFixed(4)}</td>
                              <td className="text-right">{parseFloat(pos.avg_cost).toFixed(2)}</td>
                            </tr>
                          ))}
                          {(!port.positions || port.positions.length === 0) && (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No positions found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                  Select an active client from the left pane to impersonate and manage their workspace layout.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: SHARING ===================== */}
        {activeTab === 'sharing' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Share Watchlist</h3>
              <form onSubmit={handleShareResource}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Select Type:</label>
                  <select className="form-input" value={shareForm.resourceType} onChange={(e) => setShareForm({ ...shareForm, resourceType: e.target.value })}>
                    <option value="watchlist">Watchlist</option>
                  </select>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Resource UUID:</label>
                  <input type="text" className="form-input" placeholder="Watchlist UUID ID" value={shareForm.resourceId} onChange={(e) => setShareForm({ ...shareForm, resourceId: e.target.value })} required />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Share with Email:</label>
                  <input type="email" className="form-input" placeholder="Recipient's registered email" value={shareForm.shareWithEmail} onChange={(e) => setShareForm({ ...shareForm, shareWithEmail: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '10px' }}>SHARE ACCESS</button>
              </form>
            </div>

            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Shared Resources Received</h3>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Shared By</th>
                    <th>Type</th>
                    <th>Watchlist Name</th>
                    <th>ID / Link</th>
                    <th>Permission</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedReceived.map((share, idx) => (
                    <tr key={idx}>
                      <td>{share.shared_by_user}</td>
                      <td><span className="badge badge-blue">{share.resource_type.toUpperCase()}</span></td>
                      <td style={{ fontWeight: 'bold' }}>{share.watchlist_name || 'N/A'}</td>
                      <td style={{ fontSize: '10px' }}>{share.resource_id}</td>
                      <td>
                        <span className={`badge ${share.permission === 'write' ? 'badge-green' : 'badge-amber'}`}>
                          {share.permission.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sharedReceived.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                        No shared resources received yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB: ENCRYPTION ===================== */}
        {activeTab === 'encryption' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Encrypt Broker Credentials</h3>
              <form onSubmit={handleStoreCredentials}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Service Name:</label>
                  <select className="form-input" value={credForm.serviceName} onChange={(e) => setCredForm({ ...credForm, serviceName: e.target.value })}>
                    <option value="zerodha_api">Zerodha API Secrets</option>
                    <option value="interactive_brokers">Interactive Brokers Creds</option>
                    <option value="coinbase_api">Coinbase API Keys</option>
                    <option value="binance_api">Binance API Keys</option>
                  </select>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Secret Keys / JSON Payload:</label>
                  <textarea className="form-input" rows="5" placeholder="Paste sensitive API tokens, client secrets, or private keys here. They will be encrypted before sending to DB." value={credForm.secretData} onChange={(e) => setCredForm({ ...credForm, secretData: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '10px' }}>ENCRYPT & STORE IN VAULT</button>
              </form>
            </div>

            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Decryption Vault</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '15px' }}>
                QuantDesk uses military-grade AES-256-GCM encryption on the backend. Only authenticated sessions can request temporary decryption.
              </div>

              <table className="table" style={{ width: '100%', marginBottom: '20px' }}>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Created At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 'bold' }}>{c.service_name.toUpperCase()}</td>
                      <td>{new Date(c.created_at).toLocaleString()}</td>
                      <td>
                        <button className="btn btn-ghost btn-xs" style={{ background: '#161622', color: '#00f0ff' }} onClick={() => handleDecryptCredentials(c.id)}>
                          DECRYPT & VIEW
                        </button>
                      </td>
                    </tr>
                  ))}
                  {credentials.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                        No encrypted secrets stored in your vault.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {decryptedValue && (
                <div style={{ background: '#161622', border: '1px solid #ff3b30', borderRadius: '4px', padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 'bold', color: '#ff3b30' }}>🔓 DECRYPTED VAULT VALUE</span>
                    <button className="btn btn-ghost btn-xs" onClick={() => setDecryptedValue(null)}>CLOSE</button>
                  </div>
                  <pre style={{ margin: 0, padding: '10px', background: '#000', borderRadius: '3px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', color: '#00ff88' }}>
                    {decryptedValue}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: API & WEBHOOKS ===================== */}
        {activeTab === 'api' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Public API Keys</h3>
              <form onSubmit={handleGenerateApiKey} style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input type="text" className="form-input" placeholder="Key name (e.g. My Prop Bot)" value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} required />
                  <button type="submit" className="btn btn-primary btn-sm">GENERATE</button>
                </div>
              </form>

              {newApiKeyRaw && (
                <div style={{ background: '#161622', border: '1px solid #00ff88', padding: '12px', borderRadius: '4px', marginBottom: '20px' }}>
                  <div style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '11px' }}>⚠️ COPY KEY NOW - IT WILL NOT BE SHOWN AGAIN:</div>
                  <div style={{ background: '#000', padding: '8px', fontSize: '12px', color: '#fff', wordBreak: 'break-all', marginTop: '6px', borderRadius: '3px' }}>
                    {newApiKeyRaw}
                  </div>
                </div>
              )}

              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map(k => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 'bold' }}>{k.name}</td>
                      <td><code>{k.key_prefix}...</code></td>
                      <td>{new Date(k.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-ghost btn-xs" style={{ color: '#ff3b30' }} onClick={() => handleRevokeApiKey(k.id)}>
                          REVOKE
                        </button>
                      </td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No active API keys.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Webhook Subscriptions</h3>
              <form onSubmit={handleRegisterWebhook} style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Target Delivery URL:</label>
                  <input type="url" className="form-input" placeholder="https://yourserver.com/webhooks" value={webhookForm.url} onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })} required />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>EVENT TRIGGERS:</span>
                  <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={webhookForm.eventTypes.includes('portfolio.updated')} onChange={(e) => {
                        const nextEvents = e.target.checked 
                          ? [...webhookForm.eventTypes, 'portfolio.updated']
                          : webhookForm.eventTypes.filter(ev => ev !== 'portfolio.updated');
                        setWebhookForm({ ...webhookForm, eventTypes: nextEvents });
                      }} />
                      Portfolio Update
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={webhookForm.eventTypes.includes('alert.triggered')} onChange={(e) => {
                        const nextEvents = e.target.checked 
                          ? [...webhookForm.eventTypes, 'alert.triggered']
                          : webhookForm.eventTypes.filter(ev => ev !== 'alert.triggered');
                        setWebhookForm({ ...webhookForm, eventTypes: nextEvents });
                      }} />
                      Alert Triggered
                    </label>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }}>REGISTER WEBHOOK</button>
              </form>

              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Events</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map(wh => (
                    <tr key={wh.id}>
                      <td style={{ fontSize: '11px', wordBreak: 'break-all' }}>{wh.url}</td>
                      <td>
                        {wh.event_types?.map(e => <span key={e} className="badge badge-blue" style={{ marginRight: '2px', fontSize: '8px' }}>{e}</span>)}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs" style={{ color: '#ff3b30' }} onClick={() => handleDeleteWebhook(wh.id)}>
                          REMOVE
                        </button>
                      </td>
                    </tr>
                  ))}
                  {webhooks.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No webhooks configured.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB: REPORT SCHEDULER ===================== */}
        {activeTab === 'reports' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Schedule Report</h3>
              <form onSubmit={handleScheduleReport}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Report Type:</label>
                  <select className="form-input" value={reportForm.reportType} onChange={(e) => setReportForm({ ...reportForm, reportType: e.target.value })}>
                    <option value="portfolio">Portfolio Holdings Report</option>
                    <option value="watchlist">Watchlist Performance Report</option>
                  </select>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Export Format:</label>
                  <select className="form-input" value={reportForm.format} onChange={(e) => setReportForm({ ...reportForm, format: e.target.value })}>
                    <option value="pdf">PDF Document</option>
                    <option value="excel">Excel Sheet (CSV)</option>
                  </select>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Frequency:</label>
                  <select className="form-input" value={reportForm.frequency} onChange={(e) => setReportForm({ ...reportForm, frequency: e.target.value })}>
                    <option value="daily">Daily close</option>
                    <option value="weekly">Weekly close (Friday)</option>
                    <option value="monthly">Monthly recap</option>
                  </select>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Send to Email:</label>
                  <input type="email" className="form-input" value={reportForm.emailRecipient} onChange={(e) => setReportForm({ ...reportForm, emailRecipient: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '10px' }}>SCHEDULE AUTOMATED TASK</button>
              </form>
            </div>

            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Active Schedules</h3>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Report Type</th>
                    <th>Format</th>
                    <th>Frequency</th>
                    <th>Recipient</th>
                    <th>Next Run</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(rep => (
                    <tr key={rep.id}>
                      <td style={{ fontWeight: 'bold' }}>{rep.report_type.toUpperCase()}</td>
                      <td><span className={`badge ${rep.format === 'pdf' ? 'badge-blue' : 'badge-green'}`}>{rep.format.toUpperCase()}</span></td>
                      <td>{rep.frequency.toUpperCase()}</td>
                      <td>{rep.email_recipient}</td>
                      <td style={{ fontSize: '10px' }}>{new Date(rep.next_run).toLocaleString()}</td>
                      <td>
                        <button className="btn btn-ghost btn-xs" style={{ color: '#ff3b30' }} onClick={() => handleDeleteReport(rep.id)}>
                          REMOVE
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        No reports scheduled.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB: BROKER IMPORTER ===================== */}
        {activeTab === 'importer' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Import Portfolio CSV</h3>
              <form onSubmit={handleBrokerImport}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Source Broker / Platform:</label>
                  <select className="form-input" value={selectedBroker} onChange={(e) => setSelectedBroker(e.target.value)}>
                    <option value="zerodha">Zerodha (India)</option>
                    <option value="robinhood">Robinhood (US)</option>
                    <option value="coinbase">Coinbase / Crypto Exchange</option>
                    <option value="generic">Generic CSV Format</option>
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Upload CSV File:</label>
                  <input type="file" accept=".csv" className="form-input" onChange={handleCsvFileSelected} style={{ paddingTop: '3px' }} />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Or Paste Raw CSV Text:</label>
                  <textarea className="form-input" rows="8" placeholder="symbol,quantity,price,action&#10;TCS,10,3200,buy&#10;AAPL,15,175,buy" value={csvRawText} onChange={(e) => {
                    setCsvRawText(e.target.value);
                    previewCsvData(e.target.value);
                  }} />
                </div>

                <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }}>EXECUTE CSV PORTFOLIO IMPORT</button>
              </form>

              {importStatus && (
                <div style={{ marginTop: '15px', background: '#161622', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)', fontSize: '11px' }}>
                  <strong>STATUS:</strong> {importStatus}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '15px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>CSV Trade Parser Preview</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Preview columns resolved from your CSV file before processing trade injection.
              </div>

              {importPreview && importPreview.headers ? (
                <div>
                  <div style={{ fontSize: '11px', color: '#00ff88', marginBottom: '8px' }}>✓ Headers parsed: {importPreview.headers.join(' | ')}</div>
                  <table className="table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        {importPreview.headers.map((h, idx) => <th key={idx}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.data.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => <td key={cIdx}>{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  Upload a CSV file or paste trades list to view parsed grid preview.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: AUDIT LOGS ===================== */}
        {activeTab === 'logs' && (
          <div className="card" style={{ padding: '15px' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Institutional Audit Trails</h3>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  {user?.role === 'admin' && <th>User</th>}
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Metadata</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    {user?.role === 'admin' && <td style={{ fontWeight: 'bold', color: '#00f0ff' }}>{log.username}</td>}
                    <td><code>{log.action}</code></td>
                    <td>{log.resource || 'N/A'}</td>
                    <td style={{ fontSize: '10px' }}><code>{JSON.stringify(log.metadata)}</code></td>
                    <td style={{ fontSize: '10px' }}>{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No audit trails registered.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================== TAB: RBAC ADMIN ===================== */}
        {activeTab === 'rbac' && user?.role === 'admin' && (
          <div className="card" style={{ padding: '15px' }}>
            <h3 style={{ marginTop: 0, color: '#00f0ff' }}>User Directory Access Control</h3>
            {rbacError && <div style={{ color: '#ff3b30', marginBottom: '10px' }}>{rbacError}</div>}
            
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Status</th>
                  <th>Modify Role</th>
                  <th>Modify Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 'bold' }}>{u.username}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-red' : u.role === 'trader' ? 'badge-green' : 'badge-amber'}`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                        {u.is_active ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    <td>
                      <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} disabled={u.id === user.id} className="form-input" style={{ width: '120px', height: '24px', padding: '0 5px' }}>
                        <option value="admin">Admin</option>
                        <option value="trader">Trader</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td>
                      <button className={`btn ${u.is_active ? 'btn-ghost' : 'btn-primary'} btn-xs`} style={{ color: u.is_active ? '#ff3b30' : '#00ff88', border: u.is_active ? '1px solid #ff3b30' : '1px solid #00ff88' }} onClick={() => handleStatusToggle(u.id, u.is_active)} disabled={u.id === user.id}>
                        {u.is_active ? 'DISABLE' : 'ENABLE'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}

export default EnterprisePage;

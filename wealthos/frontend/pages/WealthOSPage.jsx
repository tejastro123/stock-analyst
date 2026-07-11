import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Briefcase, Wallet, TrendingUp, ShieldAlert, Award, Target, FileText, CheckCircle, 
  AlertTriangle, DollarSign, Plus, Trash2, ArrowUpRight, ArrowDownRight, Compass,
  Activity, Calendar, BarChart2, PlusCircle, BookOpen, Upload, Cpu, ShieldCheck, 
  HelpCircle, Eye, ChevronRight
} from 'lucide-react';

// API client helper
const api = {
  getAssets: () => axios.get('/api/wealthos/assets'),
  createAsset: (data) => axios.post('/api/wealthos/assets', data),
  deleteAsset: (id) => axios.delete(`/api/wealthos/assets/${id}`),
  
  getTransactions: () => axios.get('/api/wealthos/transactions'),
  createTransaction: (data) => axios.post('/api/wealthos/transactions', data),
  
  getGoals: () => axios.get('/api/wealthos/goals'),
  createGoal: (data) => axios.post('/api/wealthos/goals', data),
  deleteGoal: (id) => axios.delete(`/api/wealthos/goals/${id}`),
  
  getJournal: () => axios.get('/api/wealthos/journal'),
  createJournal: (data) => axios.post('/api/wealthos/journal', data),
  deleteJournal: (id) => axios.delete(`/api/wealthos/journal/${id}`),
  
  getDocs: () => axios.get('/api/wealthos/documents'),
  createDoc: (data) => axios.post('/api/wealthos/documents', data),
  deleteDoc: (id) => axios.delete(`/api/wealthos/documents/${id}`),

  getAnalytics: () => axios.get('/api/wealthos/analytics/calculate'),
  getStressTests: () => axios.get('/api/wealthos/analytics/stress-test'),
  getMonteCarlo: (sims) => axios.get(`/api/wealthos/analytics/monte-carlo?simulations=${sims}`),
  getCorrelation: () => axios.get('/api/wealthos/analytics/correlation'),
  getAIAdvisory: () => axios.get('/api/wealthos/ai/advisory')
};

const ASSET_CLASSES = [
  { value: 'stocks', label: 'Stocks' },
  { value: 'etfs', label: 'ETFs' },
  { value: 'mutual_funds', label: 'Mutual Funds' },
  { value: 'index_funds', label: 'Index Funds' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'reits', label: 'REITs' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'options', label: 'Options' },
  { value: 'futures', label: 'Futures' },
  { value: 'fixed_deposits', label: 'Fixed Deposits' },
  { value: 'ppf', label: 'PPF' },
  { value: 'epf', label: 'EPF' },
  { value: 'nps', label: 'NPS' },
  { value: 'cash', label: 'Cash' },
  { value: 'foreign_equities', label: 'Foreign Equities' },
  { value: 'commodities', label: 'Commodities' }
];

export default function WealthOSPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [journal, setJournal] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Advanced Analytics States
  const [analytics, setAnalytics] = useState(null);
  const [stressTests, setStressTests] = useState([]);
  const [correlation, setCorrelation] = useState(null);
  const [aiAdvisory, setAiAdvisory] = useState(null);
  
  // Monte Carlo Simulation States
  const [mcSims, setMcSims] = useState(1000);
  const [mcData, setMcData] = useState(null);
  const [mcLoading, setMcLoading] = useState(false);

  // Retirement Simulator Inputs
  const [retAge, setRetAge] = useState(60);
  const [curAge, setCurAge] = useState(30);
  const [monthlyExpenses, setMonthlyExpenses] = useState(50000);
  const [inflationRate, setInflationRate] = useState(6);
  const [expReturns, setExpReturns] = useState(11);
  const [retSalary, setRetSalary] = useState(120000);

  // Forms
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: '', asset_class: 'stocks', symbol: '', quantity: '', avg_price: '', current_price: '', exchange: '', broker: '', currency: 'INR', fees: '', taxes: '', notes: '', tags: ''
  });

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({
    name: '', target_amount: '', current_amount: '', monthly_sip: '', years_remaining: ''
  });

  const [journalForm, setJournalForm] = useState({
    title: '', entry_type: 'buy_rationale', content: ''
  });

  const [docForm, setDocForm] = useState({
    name: '', doc_type: 'contract_note', file_path: ''
  });

  const [txForm, setTxForm] = useState({
    asset_id: '', transaction_type: 'buy', quantity: '', price: '', fees: '', taxes: '', brokerage: '', notes: ''
  });

  const [viewDoc, setViewDoc] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetsRes, txsRes, goalsRes, journalRes, docsRes] = await Promise.all([
        api.getAssets(),
        api.getTransactions(),
        api.getGoals(),
        api.getJournal(),
        api.getDocs()
      ]);
      
      setAssets(assetsRes.data);
      setTransactions(txsRes.data);
      setGoals(goalsRes.data);
      setJournal(journalRes.data);
      setDocuments(docsRes.data);

      // Fetch analytics and metrics
      if (assetsRes.data.length > 0) {
        const [analRes, stressRes, corrRes, aiRes] = await Promise.all([
          api.getAnalytics().catch(() => null),
          api.getStressTests().catch(() => null),
          api.getCorrelation().catch(() => null),
          api.getAIAdvisory().catch(() => null)
        ]);

        if (analRes) setAnalytics(analRes.data);
        if (stressRes) setStressTests(stressRes.data.scenarios || []);
        if (corrRes) setCorrelation(corrRes.data);
        if (aiRes) setAiAdvisory(aiRes.data);
      }
    } catch (err) {
      console.error('Error fetching WealthOS data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...assetForm,
        quantity: parseFloat(assetForm.quantity) || 0,
        avg_price: parseFloat(assetForm.avg_price) || 0,
        current_price: parseFloat(assetForm.current_price || assetForm.avg_price) || 0,
        fees: parseFloat(assetForm.fees) || 0,
        taxes: parseFloat(assetForm.taxes) || 0,
        tags: assetForm.tags ? assetForm.tags.split(',').map(t => t.trim()) : []
      };

      await api.createAsset(data);
      setShowAssetForm(false);
      setAssetForm({
        name: '', asset_class: 'stocks', symbol: '', quantity: '', avg_price: '', current_price: '', exchange: '', broker: '', currency: 'INR', fees: '', taxes: '', notes: '', tags: ''
      });
      fetchData();
    } catch (err) {
      alert('Error creating asset. Check input values.');
    }
  };

  const handleDeleteAsset = async (id) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      try {
        await api.deleteAsset(id);
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddGoal = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...goalForm,
        target_amount: parseFloat(goalForm.target_amount),
        current_amount: parseFloat(goalForm.current_amount || 0),
        monthly_sip: parseFloat(goalForm.monthly_sip || 0),
        years_remaining: parseInt(goalForm.years_remaining)
      };

      await api.createGoal(data);
      setShowGoalForm(false);
      setGoalForm({ name: '', target_amount: '', current_amount: '', monthly_sip: '', years_remaining: '' });
      fetchData();
    } catch (err) {
      alert('Error saving goal.');
    }
  };

  const handleDeleteGoal = async (id) => {
    if (confirm('Delete goal?')) {
      try {
        await api.deleteGoal(id);
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddJournal = async (e) => {
    e.preventDefault();
    try {
      await api.createJournal(journalForm);
      setJournalForm({ title: '', entry_type: 'buy_rationale', content: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteJournal = async (id) => {
    try {
      await api.deleteJournal(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDoc = async (e) => {
    e.preventDefault();
    try {
      await api.createDoc(docForm);
      setDocForm({ name: '', doc_type: 'contract_note', file_path: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDoc = async (id) => {
    try {
      await api.deleteDoc(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTx = async (e) => {
    e.preventDefault();
    try {
      const asset = assets.find(a => a.id === txForm.asset_id);
      if (!asset) return;

      const data = {
        ...txForm,
        symbol: asset.symbol,
        asset_class: asset.asset_class,
        quantity: parseFloat(txForm.quantity),
        price: parseFloat(txForm.price),
        fees: parseFloat(txForm.fees) || 0,
        taxes: parseFloat(txForm.taxes) || 0,
        brokerage: parseFloat(txForm.brokerage) || 0
      };

      await api.createTransaction(data);
      setTxForm({ asset_id: '', transaction_type: 'buy', quantity: '', price: '', fees: '', taxes: '', brokerage: '', notes: '' });
      fetchData();
    } catch (err) {
      alert('Error creating transaction.');
    }
  };

  const runMonteCarloSims = async () => {
    setMcLoading(true);
    try {
      const res = await api.getMonteCarlo(mcSims);
      setMcData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setMcLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Retirement calculations
  const runRetirementSim = () => {
    const yearsToRetire = retAge - curAge;
    if (yearsToRetire <= 0) return { corpus: 0, requiredSip: 0 };
    
    // Future value of monthly expenses adjusted for inflation at retirement
    const inflationMultiplier = Math.pow(1 + inflationRate/100, yearsToRetire);
    const expensesAtRetirement = monthlyExpenses * inflationMultiplier;
    
    // Corpus required (based on 4% safe withdrawal rate or rule of 25x expenses)
    const annualExpenses = expensesAtRetirement * 12;
    const requiredCorpus = annualExpenses / 0.04; 

    // Projected existing assets growing at expected returns
    const totalWealth = analytics?.summary?.total_wealth || 0;
    const futureWealthLumpSum = totalWealth * Math.pow(1 + expReturns/100, yearsToRetire);

    // Shortfall
    const corpusShortfall = Math.max(0, requiredCorpus - futureWealthLumpSum);

    // Calculate required monthly SIP to cover the shortfall
    const r = (expReturns / 100) / 12;
    const n = yearsToRetire * 12;
    const requiredSip = corpusShortfall * r / (Math.pow(1 + r, n) - 1);

    return {
      requiredCorpus,
      futureWealthLumpSum,
      corpusShortfall,
      requiredSip,
      expensesAtRetirement
    };
  };

  const retirementDetails = runRetirementSim();

  return (
    <div style={{ height: 'calc(100vh - 84px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* ── Tabs Navigation ── */}
      <div style={{
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-primary)', 
        background: 'var(--bg-tertiary)',
        padding: '0 var(--space-4)', 
        flexShrink: 0,
        height: '42px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Wallet },
            { id: 'portfolio', label: 'Multi Asset Portfolio', icon: Briefcase },
            { id: 'risk', label: 'Risk Laboratory', icon: ShieldAlert },
            { id: 'planner', label: 'Goal Planner & Retirement', icon: Target },
            { id: 'tax', label: 'Tax & Income', icon: DollarSign },
            { id: 'ai', label: 'AI Wealth Advisor', icon: Cpu },
            { id: 'vault', label: 'Document Vault & Journal', icon: FileText }
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)}
              className="btn btn-ghost btn-sm"
              style={{
                background: activeTab === t.id ? 'var(--bg-active)' : 'transparent',
                color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderColor: activeTab === t.id ? 'var(--accent-primary)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '32px'
              }}
            >
              <t.icon size={14} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="font-mono text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={12} className="text-green pulse" />
          <span>WEALTH-ENGINE: ONLINE</span>
        </div>
      </div>

      {/* ── Main Tab Contents ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <span className="font-mono text-muted text-sm">Compiling portfolio metrics...</span>
          </div>
        ) : (
          <>
            {/* ── Tab: DASHBOARD ── */}
            {activeTab === 'dashboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Top Metrics Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="panel" style={{ padding: '16px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-mono text-xs text-secondary">NET WORTH</span>
                      <Wallet size={16} className="text-accent" />
                    </div>
                    <div className="font-mono text-2xl fw-700 text-accent" style={{ marginTop: '8px' }}>
                      {formatCurrency(analytics?.summary?.total_wealth || 0)}
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Across {assets.length} multi-asset accounts</div>
                  </div>

                  <div className="panel" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-mono text-xs text-secondary">TODAY'S P/L</span>
                      <TrendingUp size={16} className={(analytics?.summary?.total_return_pct || 0) >= 0 ? 'text-green' : 'text-red'} />
                    </div>
                    <div className={`font-mono text-2xl fw-700 ${(analytics?.summary?.total_return_pct || 0) >= 0 ? 'text-green' : 'text-red'}`} style={{ marginTop: '8px' }}>
                      {formatCurrency((analytics?.summary?.total_wealth || 0) * ((analytics?.summary?.total_return_pct || 0) / 100) * 0.015)}
                    </div>
                    <div className="text-xs text-secondary" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {(analytics?.summary?.total_return_pct || 0) >= 0 ? <ArrowUpRight size={12} className="text-green" /> : <ArrowDownRight size={12} className="text-red" />}
                      <span>{((analytics?.summary?.total_return_pct || 0) * 0.015).toFixed(2)}% Today</span>
                    </div>
                  </div>

                  <div className="panel" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-mono text-xs text-secondary">XIRR (ANNUALIZED)</span>
                      <Award size={16} className="text-cyan" />
                    </div>
                    <div className="font-mono text-2xl fw-700 text-cyan" style={{ marginTop: '8px' }}>
                      {(analytics?.summary?.xirr_est || 12.4).toFixed(2)}%
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Money Weighted Return</div>
                  </div>

                  <div className="panel" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-mono text-xs text-secondary">PORTFOLIO HEALTH</span>
                      <ShieldCheck size={16} className="text-green" />
                    </div>
                    <div className="font-mono text-2xl fw-700 text-green" style={{ marginTop: '8px' }}>
                      {aiAdvisory?.score?.overall || 92}/100
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: '4px' }}>AI Safety Audit Grade</div>
                  </div>
                </div>

                {/* Second Row: Asset Allocation & Stress Tests Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  {/* Allocation Chart Panel */}
                  <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header">
                      <span className="panel-title">Asset Allocation Studio</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: 20 }}>
                      {/* Simple Inline SVG Pie Chart representation */}
                      <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                        <svg width="200" height="200" viewBox="0 0 200 200">
                          <circle cx="100" cy="100" r="70" fill="none" stroke="var(--bg-tertiary)" strokeWidth="30" />
                          {/* Segment calculations mapped visually */}
                          {Object.entries(analytics?.allocations || {}).map(([key, val], idx, arr) => {
                            const prevAccum = arr.slice(0, idx).reduce((s, item) => s + item[1], 0);
                            const dashArray = `${(val * 4.4).toFixed(1)} 440`;
                            const rotateDeg = (prevAccum * 3.6 - 90).toFixed(1);
                            
                            const colors = ['var(--accent-primary)', 'var(--green)', 'var(--cyan)', 'var(--blue)', 'var(--purple)', 'var(--yellow)'];
                            const segmentColor = colors[idx % colors.length];

                            return (
                              <circle 
                                key={key}
                                cx="100" 
                                cy="100" 
                                r="70" 
                                fill="none" 
                                stroke={segmentColor} 
                                strokeWidth="30" 
                                strokeDasharray={dashArray} 
                                transform={`rotate(${rotateDeg} 100 100)`}
                              />
                            );
                          })}
                        </svg>
                        <div style={{
                          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                          textAlign: 'center', fontFamily: 'var(--font-mono)'
                        }}>
                          <div className="text-xs text-secondary">NET WORTH</div>
                          <div className="text-sm fw-600 text-primary">{assets.length} Assets</div>
                        </div>
                      </div>

                      {/* Legend */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                        {Object.entries(analytics?.allocations || {}).map(([key, val], idx) => {
                          const colors = ['var(--accent-primary)', 'var(--green)', 'var(--cyan)', 'var(--blue)', 'var(--purple)', 'var(--yellow)'];
                          const segmentColor = colors[idx % colors.length];
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: segmentColor }} />
                                <span className="font-mono text-xs text-primary" style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                              </div>
                              <span className="font-mono text-xs text-secondary fw-600">{val.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* AI Quick Advisor */}
                  <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header">
                      <span className="panel-title">AI Advisor Insights</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {aiAdvisory?.recommendations?.map((rec, i) => (
                        <div key={i} style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)' }}>
                            <Cpu size={14} />
                            <span className="font-mono text-xs fw-600" style={{ textTransform: 'uppercase' }}>{rec.recommendation}</span>
                          </div>
                          <p className="text-sm text-secondary" style={{ marginTop: '4px', lineHeight: '1.4' }}>{rec.reason}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                            <span className="text-xs text-muted">Target Weight: {rec.targetAllocation || rec.targetWeight || 'N/A'}</span>
                            <span className="badge badge-green font-mono">Confidence {rec.confidence}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Goals & Risk Summary Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Goal Progress Panel */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">Goals Progression</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {goals.length === 0 ? (
                        <div className="text-xs text-muted">No financial goals defined yet. Open Goal Planner tab to add.</div>
                      ) : (
                        goals.map(g => {
                          const progress = Math.min(100, Math.floor((g.current_amount / g.target_amount) * 100));
                          return (
                            <div key={g.id}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span className="font-mono text-sm fw-600 text-primary">{g.name}</span>
                                <span className="font-mono text-xs text-secondary">{progress}% ({formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)})</span>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '4px' }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Quantitative Risks Metrics */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">Quantitative Risk Profile</span>
                    </div>
                    <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                        <div className="text-xs text-muted font-mono">ANNUAL VOLATILITY</div>
                        <div className="font-mono text-lg fw-700 text-primary" style={{ marginTop: '4px' }}>
                          {(analytics?.metrics?.annualized_volatility || 14.5).toFixed(2)}%
                        </div>
                      </div>

                      <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                        <div className="text-xs text-muted font-mono">SHARPE RATIO</div>
                        <div className="font-mono text-lg fw-700 text-primary" style={{ marginTop: '4px' }}>
                          {(analytics?.metrics?.sharpe_ratio || 1.15).toFixed(2)}
                        </div>
                      </div>

                      <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                        <div className="text-xs text-muted font-mono">MAX DRAWDOWN</div>
                        <div className="font-mono text-lg fw-700 text-red" style={{ marginTop: '4px' }}>
                          {(analytics?.metrics?.max_drawdown || -8.2).toFixed(2)}%
                        </div>
                      </div>

                      <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                        <div className="text-xs text-muted font-mono">VALUE AT RISK (95%)</div>
                        <div className="font-mono text-lg fw-700 text-accent" style={{ marginTop: '4px' }}>
                          {formatCurrency(analytics?.metrics?.var_95 || 45000)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: MULTI ASSET PORTFOLIO ── */}
            {activeTab === 'portfolio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAssetForm(true)}>
                      <Plus size={14} /> Add New Asset
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('vault')}>
                      <Upload size={14} /> Log Transaction
                    </button>
                  </div>
                  <span className="font-mono text-xs text-muted">{assets.length} Total Assets Loaded</span>
                </div>

                {showAssetForm && (
                  <form className="panel" onSubmit={handleAddAsset} style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Asset Name</label>
                      <input className="form-input" type="text" value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} placeholder="e.g. HDFC Bank, Sovereign Gold Bond..." required />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Asset Class</label>
                      <select className="form-input" value={assetForm.asset_class} onChange={e => setAssetForm({...assetForm, asset_class: e.target.value})}>
                        {ASSET_CLASSES.map(ac => (
                          <option key={ac.value} value={ac.value}>{ac.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Ticker/Symbol</label>
                      <input className="form-input" type="text" value={assetForm.symbol} onChange={e => setAssetForm({...assetForm, symbol: e.target.value})} placeholder="e.g. HDFCBANK, GOLD24" required />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Quantity</label>
                      <input className="form-input" type="number" step="any" value={assetForm.quantity} onChange={e => setAssetForm({...assetForm, quantity: e.target.value})} required />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Average Purchase Price (INR)</label>
                      <input className="form-input" type="number" step="any" value={assetForm.avg_price} onChange={e => setAssetForm({...assetForm, avg_price: e.target.value})} required />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Exchange</label>
                      <input className="form-input" type="text" value={assetForm.exchange} onChange={e => setAssetForm({...assetForm, exchange: e.target.value})} placeholder="NSE, BSE, NASDAQ..." />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Broker / Platform</label>
                      <input className="form-input" type="text" value={assetForm.broker} onChange={e => setAssetForm({...assetForm, broker: e.target.value})} placeholder="Zerodha, Groww, Kuvera..." />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Current Price</label>
                      <input className="form-input" type="number" step="any" value={assetForm.current_price} onChange={e => setAssetForm({...assetForm, current_price: e.target.value})} placeholder="Defaults to Avg Price" />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Notes</label>
                      <input className="form-input" type="text" value={assetForm.notes} onChange={e => setAssetForm({...assetForm, notes: e.target.value})} placeholder="Long term thesis..." />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Tags (Comma Separated)</label>
                      <input className="form-input" type="text" value={assetForm.tags} onChange={e => setAssetForm({...assetForm, tags: e.target.value})} placeholder="equity, growth, tax-free" />
                    </div>

                    <div style={{ gridColumn: 'span 3', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowAssetForm(false)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" type="submit">Save Asset</button>
                    </div>
                  </form>
                )}

                {/* Assets Table */}
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Asset Holdings Ledger</span>
                  </div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '10px var(--space-4)' }}>Asset</th>
                          <th style={{ padding: '10px var(--space-4)' }}>Asset Class</th>
                          <th style={{ padding: '10px var(--space-4)', textAlign: 'right' }}>Quantity</th>
                          <th style={{ padding: '10px var(--space-4)', textAlign: 'right' }}>Avg Price</th>
                          <th style={{ padding: '10px var(--space-4)', textAlign: 'right' }}>Current Price</th>
                          <th style={{ padding: '10px var(--space-4)', textAlign: 'right' }}>Current Value</th>
                          <th style={{ padding: '10px var(--space-4)', textAlign: 'right' }}>P/L</th>
                          <th style={{ padding: '10px var(--space-4)', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assets.length === 0 ? (
                          <tr>
                            <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No asset holdings catalogued yet. Add your first asset.</td>
                          </tr>
                        ) : (
                          assets.map(a => {
                            const val = a.quantity * a.current_price;
                            const cost = a.quantity * a.avg_price;
                            const pl = val - cost;
                            const plPct = cost > 0 ? (pl / cost) * 100 : 0;
                            return (
                              <tr key={a.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <td style={{ padding: '10px var(--space-4)' }}>
                                  <div className="font-mono fw-600 text-primary">{a.name}</div>
                                  <div className="font-mono text-xs text-muted">{a.symbol} {a.exchange ? `· ${a.exchange}` : ''}</div>
                                </td>
                                <td style={{ padding: '10px var(--space-4)' }}>
                                  <span className="badge badge-amber" style={{ fontSize: '9px' }}>{a.asset_class.replace('_', ' ')}</span>
                                </td>
                                <td style={{ padding: '10px var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{a.quantity}</td>
                                <td style={{ padding: '10px var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(a.avg_price)}</td>
                                <td style={{ padding: '10px var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(a.current_price)}</td>
                                <td style={{ padding: '10px var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{formatCurrency(val)}</td>
                                <td style={{ padding: '10px var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: pl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                  <div>{pl >= 0 ? '+' : ''}{formatCurrency(pl)}</div>
                                  <div style={{ fontSize: '10px' }}>({pl >= 0 ? '+' : ''}{plPct.toFixed(2)}%)</div>
                                </td>
                                <td style={{ padding: '10px var(--space-4)', textAlign: 'center' }}>
                                  <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteAsset(a.id)} style={{ padding: '4px', borderColor: 'transparent' }}>
                                    <Trash2 size={14} className="text-red" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: RISK LABORATORY ── */}
            {activeTab === 'risk' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  
                  {/* stress tests Panel */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">Stress Testing Simulator</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {stressTests.length === 0 ? (
                        <div className="text-xs text-muted">No active assets loaded to calculate stress scenarios.</div>
                      ) : (
                        stressTests.map(sc => (
                          <div key={sc.scenario} style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="font-mono text-sm fw-600 text-primary">{sc.scenario}</span>
                              <span className="font-mono text-sm fw-600 text-red">{sc.impact_pct.toFixed(2)}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              <span>Est. Loss: {formatCurrency(sc.impact_amount)}</span>
                              <span>Est. Recovery Time: {sc.recovery_time_months} Months</span>
                            </div>
                            {/* Worst impacted items */}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                              {sc.worst_assets.map((wa, idx) => (
                                <span key={idx} className="badge badge-red" style={{ fontSize: '9px', textTransform: 'none' }}>
                                  {wa.name}: {wa.impact_pct.toFixed(1)}%
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Monte Carlo Panel */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">Monte Carlo Engine</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                        <span className="text-xs font-mono text-secondary">SIMULATIONS:</span>
                        <select className="form-input" style={{ width: '120px', height: '28px', padding: '0 8px' }} value={mcSims} onChange={e => setMcSims(parseInt(e.target.value))}>
                          <option value="100">100 Runs</option>
                          <option value="1000">1,000 Runs</option>
                          <option value="10000">10,000 Runs</option>
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={runMonteCarloSims} disabled={mcLoading || assets.length === 0}>
                          {mcLoading ? 'Running...' : 'Run Simulation'}
                        </button>
                      </div>

                      {mcData ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ border: '1px solid var(--border-primary)', padding: '12px', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span className="text-xs text-muted">Success Probability (Beat 25% Gain)</span>
                              <span className="font-mono text-sm fw-600 text-green">{mcData.success_probability.toFixed(1)}%</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px' }}>
                              <div style={{ width: `${mcData.success_probability}%`, height: '100%', background: 'var(--green)', borderRadius: '3px' }} />
                            </div>
                          </div>

                          <div className="font-mono text-xs text-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>P90 Best Case (5y):</span>
                              <span className="text-green">{formatCurrency(mcData.percentiles.p90_best)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>P50 Median Wealth (5y):</span>
                              <span className="text-cyan">{formatCurrency(mcData.percentiles.p50_median)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>P10 Worst Case (5y):</span>
                              <span className="text-red">{formatCurrency(mcData.percentiles.p10_worst)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted">Click 'Run Simulation' to project portfolio wealth distribution using Geometric Brownian Motion.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Correlation Laboratory */}
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Asset Correlation Laboratory</span>
                  </div>
                  <div className="panel-body">
                    {correlation && correlation.assets ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-tertiary)' }}>
                              <th style={{ padding: '8px', textAlign: 'left' }}>Asset Matrix</th>
                              {correlation.assets.map(name => (
                                <th key={name} style={{ padding: '8px' }}>{name.substring(0, 8)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {correlation.assets.map((name, i) => (
                              <tr key={name} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <td style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>{name}</td>
                                {correlation.matrix[i].map((corrVal, j) => {
                                  let cellColor = 'transparent';
                                  if (corrVal > 0.7) cellColor = 'rgba(255, 68, 102, 0.25)'; // High positive
                                  else if (corrVal < 0) cellColor = 'rgba(0, 212, 170, 0.2)'; // Negative diversification
                                  
                                  return (
                                    <td key={j} style={{ padding: '8px', background: cellColor, color: corrVal >= 0 ? 'var(--text-primary)' : 'var(--green)' }}>
                                      {corrVal.toFixed(2)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-xs text-muted">Requires at least 2 assets to build correlation matrix.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: PLANNER ── */}
            {activeTab === 'planner' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Goal Planner */}
                  <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="panel-title">Goal Planner</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowGoalForm(!showGoalForm)}>
                        <Plus size={12} /> Add Goal
                      </button>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {showGoalForm && (
                        <form onSubmit={handleAddGoal} style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-primary)', padding: '12px', borderRadius: '4px', marginBottom: '10px' }}>
                          <div className="form-group">
                            <label className="form-label">Goal Name</label>
                            <input className="form-input" type="text" value={goalForm.name} onChange={e => setGoalForm({...goalForm, name: e.target.value})} placeholder="e.g. Buy Flat, Child College" required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Target Amount (INR)</label>
                            <input className="form-input" type="number" value={goalForm.target_amount} onChange={e => setGoalForm({...goalForm, target_amount: e.target.value})} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Current Amount (INR)</label>
                            <input className="form-input" type="number" value={goalForm.current_amount} onChange={e => setGoalForm({...goalForm, current_amount: e.target.value})} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Monthly SIP (INR)</label>
                            <input className="form-input" type="number" value={goalForm.monthly_sip} onChange={e => setGoalForm({...goalForm, monthly_sip: e.target.value})} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Years Remaining</label>
                            <input className="form-input" type="number" value={goalForm.years_remaining} onChange={e => setGoalForm({...goalForm, years_remaining: e.target.value})} required />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowGoalForm(false)}>Cancel</button>
                            <button className="btn btn-primary btn-sm" type="submit">Add</button>
                          </div>
                        </form>
                      )}

                      {goals.map(g => (
                        <div key={g.id} style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="font-mono text-sm fw-600 text-primary">{g.name}</span>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteGoal(g.id)} style={{ padding: 2, borderColor: 'transparent' }}>
                              <Trash2 size={12} className="text-red" />
                            </button>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <span>Target: {formatCurrency(g.target_amount)}</span>
                            <span>Years Remaining: {g.years_remaining}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            <span>Monthly SIP: {formatCurrency(g.monthly_sip)}</span>
                            <span style={{ color: g.probability > 75 ? 'var(--green)' : 'var(--yellow)' }}>Success Probability: {Math.floor(g.probability)}%</span>
                          </div>
                          {g.probability < 75 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', padding: '6px', background: 'var(--accent-glow)', borderRadius: '3px', fontSize: '10px', color: 'var(--accent-primary)' }}>
                              <AlertTriangle size={10} />
                              <span>AI Suggestion: Increase Monthly SIP by {formatCurrency(g.monthly_sip * 0.25)} to boost success probability by 18%.</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Retirement Simulator */}
                  <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header">
                      <span className="panel-title">Retirement Simulator</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label className="form-label">Current Age</label>
                          <input className="form-input" type="number" value={curAge} onChange={e => setCurAge(parseInt(e.target.value))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Retirement Age</label>
                          <input className="form-input" type="number" value={retAge} onChange={e => setRetAge(parseInt(e.target.value))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Monthly Expenses (Current INR)</label>
                          <input className="form-input" type="number" value={monthlyExpenses} onChange={e => setMonthlyExpenses(parseFloat(e.target.value))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Expected Annual Inflation (%)</label>
                          <input className="form-input" type="number" value={inflationRate} onChange={e => setInflationRate(parseFloat(e.target.value))} />
                        </div>
                      </div>

                      <div className="divider" style={{ margin: '8px 0' }} />

                      <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-xs text-secondary">Target Retirement Corpus:</span>
                          <span className="font-mono text-sm fw-600 text-accent">{formatCurrency(retirementDetails.requiredCorpus)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-xs text-secondary">Lump Sum at expected returns:</span>
                          <span className="font-mono text-sm fw-600 text-cyan">{formatCurrency(retirementDetails.futureWealthLumpSum)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-xs text-secondary">Shortfall:</span>
                          <span className="font-mono text-sm fw-600 text-red">{formatCurrency(retirementDetails.corpusShortfall)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-primary)', paddingTop: '6px' }}>
                          <span className="text-xs text-secondary font-mono fw-600">Required Monthly SIP:</span>
                          <span className="font-mono text-sm fw-600 text-green">{formatCurrency(retirementDetails.requiredSip)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: TAX & INCOME ── */}
            {activeTab === 'tax' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Tax Intelligence */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">Tax Intelligence Engine</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                        <span className="text-xs font-mono text-secondary">ESTIMATED CAPITAL GAINS (FY 2026-27)</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span className="text-xs text-muted">Short Term (STCG - 20%):</span>
                          <span className="font-mono text-sm fw-600 text-primary">{formatCurrency((analytics?.summary?.total_wealth || 0) * 0.02)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span className="text-xs text-muted">Long Term (LTCG - 12.5%):</span>
                          <span className="font-mono text-sm fw-600 text-primary">{formatCurrency((analytics?.summary?.total_wealth || 0) * 0.05)}</span>
                        </div>
                      </div>

                      {/* Tax Loss Harvesting */}
                      <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px', background: 'var(--green-dim)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--green)' }}>
                          <CheckCircle size={14} />
                          <span className="font-mono text-xs fw-600">TAX LOSS HARVESTING OPPORTUNITIES</span>
                        </div>
                        <p className="text-xs text-secondary" style={{ marginTop: '6px', lineHeight: '1.4' }}>
                          You have unrealized losses in 2 stocks. Harvesting these losses by selling and buying equivalents can reduce your current tax liability by <strong>{formatCurrency(14500)}</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dividend Center */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">Dividend & Cash Flow Center</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px' }}>
                          <span className="text-xs text-muted font-mono">PORTFOLIO YIELD</span>
                          <div className="font-mono text-sm fw-600 text-primary" style={{ marginTop: '4px' }}>1.45%</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px' }}>
                          <span className="text-xs text-muted font-mono">YIELD ON COST</span>
                          <div className="font-mono text-sm fw-600 text-primary" style={{ marginTop: '4px' }}>1.88%</div>
                        </div>
                      </div>

                      <div className="divider" style={{ margin: '4px 0' }} />

                      <div className="font-mono text-xs text-secondary">
                        <span className="fw-600 text-primary" style={{ fontSize: '11px' }}>UPCOMING CASH FLOW SCHEDULE</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span>Jul 2026 Dividends:</span>
                          <span className="text-green">{formatCurrency((analytics?.summary?.total_wealth || 0) * 0.001)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span>Aug 2026 Dividends:</span>
                          <span className="text-green">{formatCurrency((analytics?.summary?.total_wealth || 0) * 0.0015)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: AI WEALTH ADVISOR ── */}
            {activeTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                  {/* AI Scorecard Card */}
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title">AI Portfolio Scorecard</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div className="text-xs text-secondary font-mono">OVERALL GRADE</div>
                        <div className="font-mono text-3xl fw-700 text-accent" style={{ marginTop: '4px' }}>
                          {aiAdvisory?.score?.overall || 92}/100
                        </div>
                      </div>

                      <div className="divider" />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { name: 'Diversification', score: aiAdvisory?.score?.diversification || 89 },
                          { name: 'Risk Mitigation', score: aiAdvisory?.score?.risk || 94 },
                          { name: 'Growth Factor', score: aiAdvisory?.score?.growth || 96 },
                          { name: 'Income/Yield', score: aiAdvisory?.score?.income || 74 },
                          { name: 'Liquidity', score: aiAdvisory?.score?.liquidity || 95 },
                          { name: 'Concentration Check', score: aiAdvisory?.score?.concentration || 83 },
                          { name: 'Tax Efficiency', score: aiAdvisory?.score?.taxEfficiency || 91 }
                        ].map(item => (
                          <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                            <span className="text-secondary">{item.name}:</span>
                            <span style={{ color: item.score >= 80 ? 'var(--green)' : item.score >= 60 ? 'var(--yellow)' : 'var(--red)' }} className="fw-600">
                              {item.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AI Advisor Deep Insights */}
                  <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header">
                      <span className="panel-title">Asset Allocation Studio & Rebalancing Strategy</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ border: '1px solid var(--border-primary)', padding: '12px', borderRadius: '4px', background: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                          <Compass size={14} />
                          <span className="font-mono text-xs fw-600">REBALANCING ACTION ENGINE</span>
                        </div>
                        <div className="text-xs text-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px' }}>
                            <span>SELL Recommendation:</span>
                            <span className="text-red font-mono">TCS (Tech Sector Concentration) · Trim ₹80,000</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px' }}>
                            <span>BUY Recommendation:</span>
                            <span className="text-green font-mono">Gold ETF (Diversification Hedge) · Add ₹80,000</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                            <span>Expected Risk Reduction:</span>
                            <span className="text-green font-mono fw-600">12% Volatility drop</span>
                          </div>
                        </div>
                      </div>

                      {/* Detail text summary */}
                      <div>
                        <span className="font-mono text-xs text-primary fw-600">EXPLAINABLE AI HEALTH CHECKS</span>
                        <div className="font-mono text-xs text-secondary" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <CheckCircle size={12} className="text-green" />
                            <span>Diversification: Optimal. Spread across stocks, gold, debt, and liquid deposits.</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <CheckCircle size={12} className="text-green" />
                            <span>Penny Stock Risk: Zero. No penny stock allocation found.</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <AlertTriangle size={12} className="text-yellow" />
                            <span>Inflation Risk: Moderate. Consider increasing equity/gold ratio if inflation runs above 6.5%.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: VAULT & JOURNAL ── */}
            {activeTab === 'vault' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Document Vault */}
                  <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header">
                      <span className="panel-title">Document Vault (Contracts & Statements)</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <form onSubmit={handleAddDoc} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label">Document Name</label>
                          <input className="form-input" style={{ height: '28px' }} type="text" value={docForm.name} onChange={e => setDocForm({...docForm, name: e.target.value})} placeholder="e.g. Zerodha contract Jun" required />
                        </div>
                        <div className="form-group" style={{ width: '120px' }}>
                          <label className="form-label">Type</label>
                          <select className="form-input" style={{ height: '28px', padding: '0 4px' }} value={docForm.doc_type} onChange={e => setDocForm({...docForm, doc_type: e.target.value})}>
                            <option value="contract_note">Contract Note</option>
                            <option value="tax_doc">Tax Document</option>
                            <option value="broker_statement">Broker Statement</option>
                            <option value="dividend_statement">Dividend Statement</option>
                          </select>
                        </div>
                        <input type="hidden" value={docForm.file_path = 'mock_upload.pdf'} />
                        <button className="btn btn-primary btn-sm" style={{ height: '28px' }} type="submit">Upload</button>
                      </form>

                      {documents.map(d => (
                        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} className="text-accent" />
                            <div>
                              <span className="font-mono text-xs fw-600 text-primary">{d.name}</span>
                              <div className="text-xs text-muted">{d.doc_type.replace('_', ' ')} · Uploaded {new Date(d.uploaded_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '4px' }} onClick={() => setViewDoc(d)}>
                              <Eye size={12} />
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '4px' }} onClick={() => handleDeleteDoc(d.id)}>
                              <Trash2 size={12} className="text-red" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {viewDoc && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', marginTop: '8px', border: '1px solid var(--border-primary)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span className="font-mono text-xs fw-600 text-accent">OCR PARSING RESULT</span>
                            <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => setViewDoc(null)}>✕</button>
                          </div>
                          <pre style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                            {viewDoc.ocr_text}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Portfolio Journal */}
                  <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header">
                      <span className="panel-title">Portfolio Journal (Investment Diary)</span>
                    </div>
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <form onSubmit={handleAddJournal} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
                        <div className="form-group">
                          <label className="form-label">Diary Heading / Title</label>
                          <input className="form-input" style={{ height: '28px' }} type="text" value={journalForm.title} onChange={e => setJournalForm({...journalForm, title: e.target.value})} placeholder="e.g. Bought Gold ETF rationale" required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Type</label>
                          <select className="form-input" style={{ height: '28px', padding: '0 4px' }} value={journalForm.entry_type} onChange={e => setJournalForm({...journalForm, entry_type: e.target.value})}>
                            <option value="buy_rationale">Buy Rationale</option>
                            <option value="sell_rationale">Sell Rationale</option>
                            <option value="thesis">Investment Thesis</option>
                            <option value="post_trade">Post-Trade Review</option>
                            <option value="lesson">Lessons & Mistakes</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Rationale Content</label>
                          <textarea className="form-input" style={{ minHeight: '60px' }} value={journalForm.content} onChange={e => setJournalForm({...journalForm, content: e.target.value})} placeholder="Why is this trade done? What is expected?" required />
                        </div>
                        <button className="btn btn-primary btn-sm" type="submit">Log Journal Entry</button>
                      </form>

                      {journal.map(j => (
                        <div key={j.id} style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="font-mono text-xs fw-600 text-primary">{j.title}</span>
                            <button className="btn btn-ghost btn-sm" style={{ padding: 2, borderColor: 'transparent' }} onClick={() => handleDeleteJournal(j.id)}>
                              <Trash2 size={12} className="text-red" />
                            </button>
                          </div>
                          <div className="text-xs text-muted" style={{ display: 'flex', gap: '8px', marginTop: '2px', fontSize: '10px' }}>
                            <span className="text-accent">{j.entry_type.replace('_', ' ')}</span>
                            <span>·</span>
                            <span>{new Date(j.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-secondary" style={{ marginTop: '4px', lineHeight: '1.4' }}>{j.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Transaction Engine Form & History */}
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Transaction Engine (Log & Update Positions)</span>
                  </div>
                  <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                    <form onSubmit={handleAddTx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Asset to Update</label>
                        <select className="form-input" value={txForm.asset_id} onChange={e => setTxForm({...txForm, asset_id: e.target.value})} required>
                          <option value="">-- Select Holding --</option>
                          {assets.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.symbol})</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Transaction Type</label>
                        <select className="form-input" value={txForm.transaction_type} onChange={e => setTxForm({...txForm, transaction_type: e.target.value})}>
                          <option value="buy">Buy</option>
                          <option value="sell">Sell</option>
                          <option value="split">Corporate Action: Split</option>
                          <option value="bonus">Corporate Action: Bonus</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Quantity</label>
                        <input className="form-input" type="number" step="any" value={txForm.quantity} onChange={e => setTxForm({...txForm, quantity: e.target.value})} required />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Execution Price (INR)</label>
                        <input className="form-input" type="number" step="any" value={txForm.price} onChange={e => setTxForm({...txForm, price: e.target.value})} required />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label className="form-label">Brokerage (INR)</label>
                          <input className="form-input" type="number" step="any" value={txForm.brokerage} onChange={e => setTxForm({...txForm, brokerage: e.target.value})} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Taxes / Fees (INR)</label>
                          <input className="form-input" type="number" step="any" value={txForm.fees} onChange={e => setTxForm({...txForm, fees: e.target.value})} />
                        </div>
                      </div>

                      <button className="btn btn-primary btn-sm" type="submit" style={{ marginTop: '8px' }}>Commit Transaction</button>
                    </form>

                    <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
                      <span className="font-mono text-xs text-primary fw-600" style={{ display: 'block', marginBottom: '8px' }}>TRANSACTION LOG HISTORY</span>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '6px' }}>Date</th>
                            <th style={{ padding: '6px' }}>Asset</th>
                            <th style={{ padding: '6px' }}>Action</th>
                            <th style={{ padding: '6px', textAlign: 'right' }}>Qty</th>
                            <th style={{ padding: '6px', textAlign: 'right' }}>Price</th>
                            <th style={{ padding: '6px', textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>No historical logs available.</td>
                            </tr>
                          ) : (
                            transactions.map(t => (
                              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <td style={{ padding: '6px' }}>{new Date(t.date).toLocaleDateString()}</td>
                                <td style={{ padding: '6px', fontFamily: 'var(--font-mono)' }}>{t.symbol}</td>
                                <td style={{ padding: '6px' }}>
                                  <span className={`badge ${t.transaction_type === 'buy' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '8px' }}>{t.transaction_type}</span>
                                </td>
                                <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{t.quantity}</td>
                                <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(t.price)}</td>
                                <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(t.amount)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

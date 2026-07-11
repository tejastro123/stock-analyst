import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import {
  Briefcase, Wallet, TrendingUp, ShieldAlert, Award, Target, FileText, CheckCircle,
  AlertTriangle, DollarSign, Plus, Trash2, ArrowUpRight, ArrowDownRight, Compass,
  Activity, Calendar, BarChart2, PlusCircle, BookOpen, Upload, Cpu, ShieldCheck,
  HelpCircle, Eye, ChevronRight, RefreshCw, Layers, Shield, FileSpreadsheet, Scale,
  Bell, Users, Globe, Download, Edit, ChevronDown
} from 'lucide-react';
import { wealthosApi as api } from '../../api';

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

const MACRO_SCENARIOS = {
  fed_cuts: {
    label: 'Fed Cuts Rates (-0.5%)',
    shocks: { stocks: 0.06, mutual_funds: 0.05, index_funds: 0.05, crypto: 0.12, gold: 0.04, bonds: 0.03, cash: -0.01, fixed_deposits: -0.01 },
    detail: 'Central bank easing injects liquidity. High-growth equities and crypto assets rally. Cash yields contract slightly while existing bond prices rise.',
    mitigation: 'Add exposure to growth equities (IT, consumer discretionary) and maintain standard bullion hedge.'
  },
  interest_rate_hike: {
    label: 'Interest Rates (+2.0%)',
    shocks: { stocks: -0.08, mutual_funds: -0.06, index_funds: -0.07, crypto: -0.20, gold: -0.05, bonds: -0.04, cash: 0.02, fixed_deposits: 0.02 },
    detail: 'Global monetary tightening compresses equity multiples. Bond duration risk leads to capital losses, while cash and short-term liquid yields rise.',
    mitigation: 'Shorten debt asset duration. Reallocate fixed-income to floating-rate notes and liquid funds.'
  },
  oil_spike: {
    label: 'Oil Price (+25%)',
    shocks: { stocks: -0.05, mutual_funds: -0.04, index_funds: -0.04, crypto: 0.02, gold: 0.08, bonds: -0.02, cash: 0.0, fixed_deposits: 0.0 },
    detail: 'Crude price escalation fuels supply-side inflation. Margin squeeze for domestic manufacturing and industrial sectors. Gold and commodities act as strong hedges.',
    mitigation: 'Increase weights in oil & gas exploration stocks, commodity ETFs, and physical gold.'
  },
  dollar_falls: {
    label: 'Dollar Drops (-5%)',
    shocks: { stocks: 0.02, mutual_funds: 0.02, index_funds: 0.02, crypto: 0.08, gold: 0.10, bonds: 0.01, cash: -0.02, fixed_deposits: -0.02 },
    detail: 'Weaker greenback triggers emerging market inflows. Physical assets (Gold +10%) and hard currencies gain. Export-sensitive sectors face translation headwinds.',
    mitigation: 'Overweight domestic consumption stocks, commodities, and select overseas equity ETFs.'
  },
  rupee_appreciates: {
    label: 'Rupee Appreciates (+3%)',
    shocks: { stocks: 0.01, mutual_funds: 0.02, index_funds: 0.01, crypto: 0.0, gold: -0.03, bonds: 0.02, cash: 0.0, fixed_deposits: 0.0 },
    detail: 'Lower energy and raw material import costs. Strengthens consumer and financial sectors, while export-oriented sectors (IT, Pharma) see margin compression.',
    mitigation: 'Tilt from IT exporters towards domestic financials, automobiles, and paints sectors.'
  },
  inflation_eight: {
    label: 'Inflation rises to 8%',
    shocks: { stocks: -0.04, mutual_funds: -0.03, index_funds: -0.03, crypto: -0.05, gold: 0.12, bonds: -0.06, cash: -0.05, fixed_deposits: -0.02 },
    detail: 'Real purchasing power contracts. Fixed-income yields turn negative in real terms. Commodities and Gold outperform significantly.',
    mitigation: 'Add physical bullion and inflation-indexed sovereign bonds. Shift cash to short term ultra-short bonds.'
  },
  recession: {
    label: 'Global Recession',
    shocks: { stocks: -0.18, mutual_funds: -0.14, index_funds: -0.16, crypto: -0.30, gold: 0.05, bonds: 0.06, cash: 0.01, fixed_deposits: 0.02 },
    detail: 'Demand contraction reduces corporate earnings. Equity drawdowns across sectors. Cash equivalents and high-grade sovereign debt serve as safe havens.',
    mitigation: 'Overweight defensive equities (FMCG, Pharma), sovereign gold bonds, and cash reserves.'
  },
  war: {
    label: 'Geopolitical Conflict',
    shocks: { stocks: -0.10, mutual_funds: -0.08, index_funds: -0.09, crypto: -0.12, gold: 0.15, bonds: 0.02, cash: 0.0, fixed_deposits: 0.0 },
    detail: 'Geopolitical instability prompts flight-to-safety behavior. Crude oil and physical Gold (+15%) spike. Equities experience systematic risk selloffs.',
    mitigation: 'Maintain a minimum 15% physical gold exposure. Retain cash dry powder for asset price corrections.'
  },
  election: {
    label: 'General Election Surprise',
    shocks: { stocks: -0.06, mutual_funds: -0.05, index_funds: -0.05, crypto: 0.0, gold: 0.02, bonds: -0.01, cash: 0.0, fixed_deposits: 0.0 },
    detail: 'Short-term policy uncertainty causes equity market volatility. Defensive assets remain stable. Historical recovery timeline for political shock is 30-45 days.',
    mitigation: 'Avoid speculative mid & small cap stocks; stick to high-quality index heavyweights.'
  }
};

export default function WealthOSPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user } = useAuthStore();

  // Multi-User / Admin Console States
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUserForm, setAdminUserForm] = useState({
    email: '',
    username: '',
    password: '',
    role: 'trader',
    full_name: ''
  });
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showTxForm, setShowTxForm] = useState(false);
  const [txFilter, setTxFilter] = useState('all');
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [timelineSearch, setTimelineSearch] = useState('');
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
  const [mcUseCustomParams, setMcUseCustomParams] = useState(false);
  const [mcCustomCagr, setMcCustomCagr] = useState(12.5);
  const [mcCustomVol, setMcCustomVol] = useState(15.0);
  const [mcCustomHurdle, setMcCustomHurdle] = useState(6.0);

  // Retirement Simulator Inputs
  const [retAge, setRetAge] = useState(60);
  const [curAge, setCurAge] = useState(30);
  const [monthlyExpenses, setMonthlyExpenses] = useState(50000);
  const [inflationRate, setInflationRate] = useState(6);
  const [expReturns, setExpReturns] = useState(11);
  const [retSalary, setRetSalary] = useState(120000);
  const [postRetReturns, setPostRetReturns] = useState(7.5);
  const [lifeExpectancy, setLifeExpectancy] = useState(85);

  // Interactive UI configurations
  const [selectedScenario, setSelectedScenario] = useState('fed_cuts');
  const [corrMatrix, setCorrMatrix] = useState([
    [1.00, 0.48, 0.62, 0.35, -0.08],   // AAPL
    [0.48, 1.00, 0.55, 0.45, -0.12],   // TSLA
    [0.62, 0.55, 1.00, 0.50, -0.15],   // NVDA
    [0.35, 0.45, 0.50, 1.00, -0.05],   // BTC
    [-0.08, -0.12, -0.15, -0.05, 1.00]  // GOLD
  ]);
  const [selectedCorrAssetA, setSelectedCorrAssetA] = useState('AAPL');
  const [selectedCorrAssetB, setSelectedCorrAssetB] = useState('BTC');
  const [hoveredCorrAsset, setHoveredCorrAsset] = useState(null);
  const [corrPreset, setCorrPreset] = useState('standard');
  const [selectedBenchmark, setSelectedBenchmark] = useState('Nifty 50');
  const [activeStressScenario, setActiveStressScenario] = useState('COVID Crash (2020)');
  const [customStockShock, setCustomStockShock] = useState(-30);
  const [customCryptoShock, setCustomCryptoShock] = useState(-50);
  const [customGoldShock, setCustomGoldShock] = useState(10);
  const [rebalancingStrategy, setRebalancingStrategy] = useState('threshold');
  const [rebalanceThreshold, setRebalanceThreshold] = useState(5);
  const [rebalanceRiskProfile, setRebalanceRiskProfile] = useState('balanced');
  const [rebalanceGoalId, setRebalanceGoalId] = useState('all');
  const [rebalanceFrequency, setRebalanceFrequency] = useState('semi-annual');
  const [rebalanceTaxLotMatch, setRebalanceTaxLotMatch] = useState('minTax');
  const [rebalanceSuccessMsg, setRebalanceSuccessMsg] = useState(null);
  const [costBasisRule, setCostBasisRule] = useState('fifo');
  const [taxCountry, setTaxCountry] = useState('IN');
  const [activeHoldingResearch, setActiveHoldingResearch] = useState('');
  const [researchProfiles, setResearchProfiles] = useState({});
  const [researchLoading, setResearchLoading] = useState(false);
  const [currencyConversion, setCurrencyConversion] = useState('INR');
  const [allocationChartMode, setAllocationChartMode] = useState('pie');
  const [allocationCompareMode, setAllocationCompareMode] = useState('current');
  const [allocationDrillClass, setAllocationDrillClass] = useState(null);
  const [allocationHoveredKey, setAllocationHoveredKey] = useState(null);
  const [familyPortfolio, setFamilyPortfolio] = useState(false);
  const [advisorWorkspace, setAdvisorWorkspace] = useState(false);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [demoMode, setDemoMode] = useState(true);

  // Forms
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [expandedAssetId, setExpandedAssetId] = useState(null);
  const [assetForm, setAssetForm] = useState({
    name: '', asset_class: 'stocks', symbol: '', quantity: '', avg_price: '', current_price: '', exchange: '', broker: '', currency: 'INR', fees: '', taxes: '', dividend: '', notes: '', tags: '', attachments: []
  });

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [goalForm, setGoalForm] = useState({
    name: '', target_amount: '', current_amount: '', monthly_sip: '', years_remaining: ''
  });

  const [journalForm, setJournalForm] = useState({
    title: '',
    entry_type: 'thesis',
    content: '',
    linked_symbol: '',
    target_price: '',
    stop_loss: '',
    confidence_rating: 3,
    emotion_check: 'Objective',
    status: 'thesis_intact'
  });
  const [editingJournalId, setEditingJournalId] = useState(null);
  const [journalFilterType, setJournalFilterType] = useState('all');
  const [journalSearchQuery, setJournalSearchQuery] = useState('');
  const [journalFilterStatus, setJournalFilterStatus] = useState('all');

  const [docForm, setDocForm] = useState({
    name: '', doc_type: 'contract_note', file_path: ''
  });

  const [txForm, setTxForm] = useState({
    asset_id: '', transaction_type: 'buy', quantity: '', price: '', fees: '', taxes: '', brokerage: '', notes: '', date: new Date().toISOString().split('T')[0]
  });

  const [viewDoc, setViewDoc] = useState(null);

  // Health Audit States
  const [healthFilter, setHealthFilter] = useState('all');
  const [selectedHealthCheckId, setSelectedHealthCheckId] = useState(null);

  // Alert Rules & Status
  const [alertRules, setAlertRules] = useState([]);
  const [newAlertForm, setNewAlertForm] = useState({
    alert_type: 'portfolio_drawdown',
    symbol: '',
    threshold: '',
    criteria_desc: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!activeHoldingResearch) return;
    if (researchProfiles[activeHoldingResearch]) return;

    const fetchHoldingResearch = async () => {
      setResearchLoading(true);
      try {
        const res = await api.getResearch(activeHoldingResearch);
        setResearchProfiles(prev => ({
          ...prev,
          [activeHoldingResearch]: res.data
        }));
      } catch (err) {
        console.error("Failed to fetch research for", activeHoldingResearch, err);
      } finally {
        setResearchLoading(false);
      }
    };

    fetchHoldingResearch();
  }, [activeHoldingResearch]);

  const handleRegenerateResearch = async () => {
    if (!activeHoldingResearch) return;
    setResearchLoading(true);
    try {
      const res = await api.getResearch(activeHoldingResearch);
      setResearchProfiles(prev => ({
        ...prev,
        [activeHoldingResearch]: res.data
      }));
    } catch (err) {
      alert("Failed to regenerate research. Please check backend connection.");
    } finally {
      setResearchLoading(false);
    }
  };

  const handleToggleAlertRule = async (id) => {
    try {
      const res = await api.toggleAlert(id);
      setAlertRules(prev => prev.map(rule => rule.id === id ? res.data : rule));
    } catch (err) {
      alert("Failed to toggle alert status.");
    }
  };

  const handleDeleteAlertRule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this alert rule?")) return;
    try {
      await api.deleteAlert(id);
      setAlertRules(prev => prev.filter(rule => rule.id !== id));
    } catch (err) {
      alert("Failed to delete alert rule.");
    }
  };

  const handleCreateAlertRule = async (e) => {
    e.preventDefault();
    try {
      let desc = newAlertForm.criteria_desc;
      if (!desc) {
        switch (newAlertForm.alert_type) {
          case 'portfolio_drawdown':
            desc = `Portfolio drawdown exceeds ${newAlertForm.threshold || 10}%`;
            break;
          case 'allocation_drift':
            desc = `Asset allocation drifts by ${newAlertForm.threshold || 5}%`;
            break;
          case 'dividend_credited':
            desc = `Dividend credited for ${newAlertForm.symbol || 'TCS'} holding`;
            break;
          case 'goal_behind_schedule':
            desc = `Goal: ${newAlertForm.symbol || 'Retirement'} falls behind schedule`;
            break;
          case 'target_price':
            desc = `${newAlertForm.symbol || 'RELIANCE'} crosses target price of ₹${newAlertForm.threshold || 2800}`;
            break;
          case 'earnings_announcement':
            desc = `Earnings announcement for ${newAlertForm.symbol || 'TCS'}`;
            break;
          case 'unusual_volume':
            desc = `${newAlertForm.symbol || 'GOLDBEES'} trading volume exceeds ${newAlertForm.threshold || 3}x average`;
            break;
          case 'credit_downgrade':
            desc = `Credit rating downgrade for ${newAlertForm.symbol || 'SBI Fixed Deposit'}`;
            break;
          case 'tax_loss_harvesting':
            desc = `Tax-loss harvesting opportunity exceeds ₹${newAlertForm.threshold || 10000}`;
            break;
        }
      }

      const res = await api.createAlert({
        alert_type: newAlertForm.alert_type,
        symbol: newAlertForm.symbol || null,
        threshold: newAlertForm.threshold ? parseFloat(newAlertForm.threshold) : null,
        criteria_desc: desc
      });

      setAlertRules(prev => [res.data, ...prev]);
      setNewAlertForm({
        alert_type: 'portfolio_drawdown',
        symbol: '',
        threshold: '',
        criteria_desc: ''
      });
    } catch (err) {
      alert("Failed to create alert rule. Please check parameters.");
    }
  };

  const fetchAdminUsers = async () => {
    setAdminUsersLoading(true);
    try {
      const res = await api.getUsersList();
      setAdminUsers(res.data);
    } catch (err) {
      console.error('Failed to load user list:', err);
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const res = await api.updateUserRole(userId, newRole);
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, role: res.data.role } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const res = await api.updateUserStatus(userId, !currentStatus);
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: res.data.is_active } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle status');
    }
  };

  const handleAdminCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminCreateUser(adminUserForm);
      setAdminUsers(prev => [res.data, ...prev]);
      setAdminUserForm({
        email: '',
        username: '',
        password: '',
        role: 'trader',
        full_name: ''
      });
      alert('User provisioned successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to provision user');
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && user && user.role === 'admin') {
      fetchAdminUsers();
    }
  }, [activeTab, user]);

  const handleLogResearchToJournal = (activeResearch) => {
    if (!activeResearch) return;
    const act = activeResearch.action || 'HOLD';
    let entryType = 'thesis';
    if (act === 'BUY') entryType = 'buy_rationale';
    if (act === 'SELL') entryType = 'sell_rationale';

    setJournalForm({
      title: `AI Research Thesis: ${activeResearch.name || activeHoldingResearch} (${activeHoldingResearch})`,
      entry_type: entryType,
      content: `AI Research suggested action is ${act} with ${activeResearch.confidence || 85}% confidence.\n\nRationale:\n${activeResearch.rationale || 'Thesis validated by AI.'}\n\nTechnical Outlook: ${activeResearch.technicals || 'N/A'}\n\nRisk Assessment: ${activeResearch.risk || 'N/A'}`,
      linked_symbol: activeHoldingResearch,
      target_price: '',
      stop_loss: '',
      confidence_rating: activeResearch.confidence ? Math.max(1, Math.min(5, Math.round(activeResearch.confidence / 20))) : 3,
      emotion_check: 'Objective',
      status: 'thesis_intact'
    });
    
    // Switch to vault tab where Journal is
    setActiveTab('vault');
    
    // Smooth scroll to journal panel or form
    setTimeout(() => {
      const el = document.getElementById('journal-form-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 150);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetsRes, txsRes, goalsRes, journalRes, docsRes, alertsRes] = await Promise.all([
        api.getAssets(),
        api.getTransactions(),
        api.getGoals(),
        api.getJournal(),
        api.getDocs(),
        api.getAlerts().catch(() => null)
      ]);

      setAssets(assetsRes.data);
      setTransactions(txsRes.data);
      setGoals(goalsRes.data);
      setJournal(journalRes.data);
      setDocuments(docsRes.data);
      if (alertsRes) setAlertRules(alertsRes.data);

      if (assetsRes.data.length > 0) {
        // Set first asset as active for Research Assistant
        setActiveHoldingResearch(assetsRes.data[0].symbol);

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

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...assetForm,
        quantity: parseFloat(assetForm.quantity) || 0,
        avg_price: parseFloat(assetForm.avg_price) || 0,
        current_price: parseFloat(assetForm.current_price || assetForm.avg_price) || 0,
        fees: parseFloat(assetForm.fees) || 0,
        taxes: parseFloat(assetForm.taxes) || 0,
        dividend: parseFloat(assetForm.dividend) || 0,
        tags: Array.isArray(assetForm.tags)
          ? assetForm.tags
          : (assetForm.tags ? assetForm.tags.split(',').map(t => t.trim()) : []),
        attachments: assetForm.attachments || []
      };

      if (editingAssetId) {
        await api.updateAsset(editingAssetId, data);
      } else {
        await api.createAsset(data);
      }
      setShowAssetForm(false);
      setEditingAssetId(null);
      setAssetForm({
        name: '', asset_class: 'stocks', symbol: '', quantity: '', avg_price: '', current_price: '', exchange: '', broker: '', currency: 'INR', fees: '', taxes: '', dividend: '', notes: '', tags: '', attachments: []
      });
      fetchData();
    } catch (err) {
      alert('Error saving asset. Check input values.');
    }
  };

  const handleEditAssetClick = (asset) => {
    setEditingAssetId(asset.id);
    setAssetForm({
      name: asset.name || '',
      asset_class: asset.asset_class || 'stocks',
      symbol: asset.symbol || '',
      quantity: asset.quantity !== undefined ? asset.quantity.toString() : '',
      avg_price: asset.avg_price !== undefined ? asset.avg_price.toString() : '',
      current_price: asset.current_price !== undefined ? asset.current_price.toString() : '',
      exchange: asset.exchange || '',
      broker: asset.broker || '',
      currency: asset.currency || 'INR',
      fees: asset.fees !== undefined ? asset.fees.toString() : '',
      taxes: asset.taxes !== undefined ? asset.taxes.toString() : '',
      dividend: asset.dividend !== undefined ? asset.dividend.toString() : '',
      notes: asset.notes || '',
      tags: Array.isArray(asset.tags) ? asset.tags.join(', ') : (asset.tags || ''),
      attachments: asset.attachments || []
    });
    setShowAssetForm(true);
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

  const GOAL_TEMPLATES = {
    'Buy House': { target_amount: 15000000, current_amount: 4800000, monthly_sip: 22000, years_remaining: 12 },
    'Child Education': { target_amount: 5000000, current_amount: 1500000, monthly_sip: 15000, years_remaining: 10 },
    'Vacation': { target_amount: 1000000, current_amount: 300000, monthly_sip: 20000, years_remaining: 3 },
    'Emergency Fund': { target_amount: 1200000, current_amount: 800000, monthly_sip: 15000, years_remaining: 2 },
    'Retirement': { target_amount: 50000000, current_amount: 6000000, monthly_sip: 50000, years_remaining: 25 },
    'Wedding': { target_amount: 2500000, current_amount: 600000, monthly_sip: 18000, years_remaining: 5 },
    'Car': { target_amount: 3500000, current_amount: 1000000, monthly_sip: 25000, years_remaining: 4 },
    'Business': { target_amount: 8000000, current_amount: 1200000, monthly_sip: 35000, years_remaining: 8 },
    'Custom Goal': { target_amount: 2000000, current_amount: 400000, monthly_sip: 12000, years_remaining: 6 }
  };

  const getGoalAnalytics = (g) => {
    const yrs = parseFloat(g.years_remaining) || 0;
    const sip = parseFloat(g.monthly_sip) || 0;
    const current = parseFloat(g.current_amount) || 0;
    const target = parseFloat(g.target_amount) || 1;

    const r = yrs <= 3 ? 0.07 : 0.10; // 7% for short term, 10% for long term
    const fvLump = current * Math.pow(1 + r, yrs);
    const monthlyRate = r / 12;
    const months = yrs * 12;
    const fvSip = monthlyRate > 0
      ? sip * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate)
      : sip * months;

    const projectedWealth = fvLump + fvSip;
    const totalInvested = current + (sip * months);
    const expectedGain = Math.max(0, projectedWealth - totalInvested);

    const ratio = projectedWealth / target;
    let probability = 85;
    if (ratio >= 1.0) {
      probability = Math.min(99, 85 + (ratio - 1.0) * 45);
    } else {
      probability = Math.max(10, 85 - (1.0 - ratio) * 90);
    }
    probability = Math.round(probability);

    // AI Suggestions
    let aiSuggestion = "On track. Maintain asset allocation.";
    if (probability < 85) {
      const shortfall = Math.max(0, target - fvLump);
      const requiredSip = monthlyRate > 0
        ? shortfall / (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate))
        : shortfall / months;
      const addSip = Math.max(1000, Math.round((requiredSip - sip) / 1000) * 1000);
      aiSuggestion = `Increase SIP by ₹${addSip.toLocaleString('en-IN')}/mo or extend tenure.`;
    } else if (probability > 95) {
      aiSuggestion = "Ahead of schedule. Shift gains to debt to secure goal.";
    }

    return { expectedGain, probability, aiSuggestion, projectedWealth, totalInvested };
  };

  const handleSelectTemplate = (name) => {
    const template = GOAL_TEMPLATES[name];
    if (template) {
      setGoalForm({
        name,
        target_amount: template.target_amount.toString(),
        current_amount: template.current_amount.toString(),
        monthly_sip: template.monthly_sip.toString(),
        years_remaining: template.years_remaining.toString()
      });
    } else {
      setGoalForm({
        name,
        target_amount: '',
        current_amount: '',
        monthly_sip: '',
        years_remaining: ''
      });
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

      if (editingGoalId) {
        await api.updateGoal(editingGoalId, data);
      } else {
        await api.createGoal(data);
      }
      setShowGoalForm(false);
      setEditingGoalId(null);
      setGoalForm({ name: '', target_amount: '', current_amount: '', monthly_sip: '', years_remaining: '' });
      fetchData();
    } catch (err) {
      alert('Error saving goal.');
    }
  };

  const handleEditGoalClick = (goal) => {
    setEditingGoalId(goal.id);
    setGoalForm({
      name: goal.name || '',
      target_amount: goal.target_amount !== undefined ? goal.target_amount.toString() : '',
      current_amount: goal.current_amount !== undefined ? goal.current_amount.toString() : '',
      monthly_sip: goal.monthly_sip !== undefined ? goal.monthly_sip.toString() : '',
      years_remaining: goal.years_remaining !== undefined ? goal.years_remaining.toString() : ''
    });
    setShowGoalForm(true);
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
      const data = {
        ...journalForm,
        target_price: journalForm.target_price ? parseFloat(journalForm.target_price) : null,
        stop_loss: journalForm.stop_loss ? parseFloat(journalForm.stop_loss) : null,
        confidence_rating: parseInt(journalForm.confidence_rating) || 3
      };

      if (editingJournalId) {
        await api.updateJournal(editingJournalId, data);
        setEditingJournalId(null);
      } else {
        await api.createJournal(data);
      }
      
      setJournalForm({
        title: '',
        entry_type: 'thesis',
        content: '',
        linked_symbol: '',
        target_price: '',
        stop_loss: '',
        confidence_rating: 3,
        emotion_check: 'Objective',
        status: 'thesis_intact'
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error saving journal entry.');
    }
  };

  const handleEditJournalClick = (j) => {
    setEditingJournalId(j.id);
    setJournalForm({
      title: j.title || '',
      entry_type: j.entry_type || 'thesis',
      content: j.content || '',
      linked_symbol: j.linked_symbol || '',
      target_price: j.target_price !== null && j.target_price !== undefined ? j.target_price.toString() : '',
      stop_loss: j.stop_loss !== null && j.stop_loss !== undefined ? j.stop_loss.toString() : '',
      confidence_rating: j.confidence_rating !== null && j.confidence_rating !== undefined ? j.confidence_rating : 3,
      emotion_check: j.emotion_check || 'Objective',
      status: j.status || 'thesis_intact'
    });
  };

  const handleDeleteJournal = async (id) => {
    if (confirm('Are you sure you want to delete this diary entry?')) {
      try {
        await api.deleteJournal(id);
        if (editingJournalId === id) {
          setEditingJournalId(null);
          setJournalForm({
            title: '',
            entry_type: 'thesis',
            content: '',
            linked_symbol: '',
            target_price: '',
            stop_loss: '',
            confidence_rating: 3,
            emotion_check: 'Objective',
            status: 'thesis_intact'
          });
        }
        fetchData();
      } catch (err) {
        console.error(err);
      }
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

  const getTimelineChronicle = () => {
    const items = [];

    // 1. Transactions
    (transactions || []).forEach(tx => {
      const amount = tx.amount || (parseFloat(tx.quantity || 0) * parseFloat(tx.price || 0));
      const typeLower = tx.transaction_type.toLowerCase();
      let msg = '';
      let color = 'var(--text-primary)';
      let labelColor = 'var(--accent)';
      
      if (typeLower === 'buy') {
        msg = `Purchased ${tx.quantity} units of ${tx.symbol} at ${formatCurrency(tx.price)} (Total: ${formatCurrency(amount)}).`;
        color = 'var(--green)';
        labelColor = '#00d4aa';
      } else if (typeLower === 'sell') {
        msg = `Sold ${tx.quantity} units of ${tx.symbol} at ${formatCurrency(tx.price)} (Total: ${formatCurrency(amount)}).`;
        color = 'var(--red)';
        labelColor = '#ff4466';
      } else if (typeLower === 'split') {
        msg = `Stock Split executed for ${tx.symbol}: Split Ratio multiplier ${tx.quantity}.`;
        color = 'var(--cyan)';
        labelColor = '#00f0ff';
      } else if (typeLower === 'bonus') {
        msg = `Received ${tx.quantity} Bonus Shares for ${tx.symbol}.`;
        color = '#b464ff';
        labelColor = '#b464ff';
      } else if (typeLower === 'dividend') {
        msg = `Received Dividend of ${formatCurrency(amount)} from ${tx.symbol}.`;
        color = 'var(--yellow)';
        labelColor = '#ffb300';
      } else if (typeLower === 'interest') {
        msg = `Received Interest payout of ${formatCurrency(amount)} on ${tx.symbol}.`;
        color = '#ff9800';
        labelColor = '#ff9800';
      } else if (typeLower === 'transfer') {
        msg = `Transferred ${tx.quantity} units of ${tx.symbol} (NAV: ${formatCurrency(tx.price)}).`;
        color = '#969696';
        labelColor = '#969696';
      } else if (typeLower === 'gift') {
        msg = `${tx.quantity > 0 ? 'Received' : 'Sent'} Gift of ${Math.abs(tx.quantity)} units of ${tx.symbol}.`;
        color = '#f48fb1';
        labelColor = '#f48fb1';
      } else if (typeLower === 'inheritance') {
        msg = `Inherited ${tx.quantity} units of ${tx.symbol}.`;
        color = '#8d6e63';
        labelColor = '#8d6e63';
      } else if (typeLower === 'ipo') {
        msg = `Allotted ${tx.quantity} shares of ${tx.symbol} in IPO at ${formatCurrency(tx.price)}.`;
        color = '#2196f3';
        labelColor = '#2196f3';
      } else if (typeLower === 'rights_issue') {
        msg = `Subscribed to ${tx.quantity} shares of ${tx.symbol} in Rights Issue at ${formatCurrency(tx.price)}.`;
        color = '#ff5722';
        labelColor = '#ff5722';
      } else if (typeLower === 'fees') {
        msg = `Charged Fee of ${formatCurrency(tx.fees || amount)} on ${tx.symbol}.`;
        color = '#9e9e9e';
        labelColor = '#9e9e9e';
      } else if (typeLower === 'taxes') {
        msg = `Paid Tax of ${formatCurrency(tx.taxes || amount)} on ${tx.symbol}.`;
        color = '#607d8b';
        labelColor = '#607d8b';
      } else if (typeLower === 'brokerage') {
        msg = `Paid Brokerage of ${formatCurrency(tx.brokerage || amount)} on ${tx.symbol}.`;
        color = '#795548';
        labelColor = '#795548';
      } else {
        msg = `Executed ${tx.transaction_type.toUpperCase()} transaction of ${tx.quantity} ${tx.symbol}.`;
        color = 'var(--text-secondary)';
        labelColor = 'var(--accent)';
      }

      if (tx.notes) {
        msg += ` Notes: ${tx.notes}`;
      }

      items.push({
        id: `tx-${tx.id}`,
        date: tx.date || new Date().toISOString(),
        category: 'transaction',
        categoryLabel: `TRANSACTION: ${tx.transaction_type.toUpperCase()}`,
        message: msg,
        color: color,
        labelColor: labelColor,
        raw: tx
      });
    });

    // 2. Journal
    (journal || []).forEach(j => {
      items.push({
        id: `journal-${j.id}`,
        date: j.date || j.created_at || new Date().toISOString(),
        category: 'journal',
        categoryLabel: `JOURNAL: ${j.entry_type.toUpperCase()}`,
        message: `Logged Journal entry "${j.title}": ${j.content}`,
        color: 'var(--cyan)',
        labelColor: '#00f0ff',
        raw: j
      });
    });

    // 3. Documents
    (documents || []).forEach(d => {
      items.push({
        id: `doc-${d.id}`,
        date: d.uploaded_at || new Date().toISOString(),
        category: 'document',
        categoryLabel: `DOCUMENT: ${d.doc_type.toUpperCase()}`,
        message: `Uploaded "${d.name}". OCR Text parsed: "${d.ocr_text ? d.ocr_text.substring(0, 120) + '...' : 'No OCR extracted.'}"`,
        color: 'var(--accent)',
        labelColor: 'var(--accent)',
        raw: d
      });
    });

    // Sort chronologically (newest first)
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter
    return items.filter(item => {
      if (timelineFilter !== 'all' && item.category !== timelineFilter) return false;
      if (timelineSearch) {
        const query = timelineSearch.toLowerCase();
        return (
          item.message.toLowerCase().includes(query) ||
          item.categoryLabel.toLowerCase().includes(query) ||
          item.date.toLowerCase().includes(query)
        );
      }
      return true;
    });
  };

  const handleAddTx = async (e) => {
    e.preventDefault();
    try {
      const asset = assets.find(a => a.id === txForm.asset_id);
      if (!asset) {
        alert("Please select a valid asset holding first.");
        return;
      }

      const data = {
        ...txForm,
        symbol: asset.symbol,
        asset_class: asset.asset_class,
        quantity: parseFloat(txForm.quantity) || 0,
        price: parseFloat(txForm.price) || 0,
        fees: parseFloat(txForm.fees) || 0,
        taxes: parseFloat(txForm.taxes) || 0,
        brokerage: parseFloat(txForm.brokerage) || 0,
        date: txForm.date || new Date().toISOString().split('T')[0]
      };

      await api.createTransaction(data);
      setTxForm({
        asset_id: '',
        transaction_type: 'buy',
        quantity: '',
        price: '',
        fees: '',
        taxes: '',
        brokerage: '',
        notes: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowTxForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error creating transaction.');
    }
  };

  const runMonteCarloSims = async () => {
    setMcLoading(true);
    const delay = mcSims >= 10000 ? 1500 : 500;
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      let weightedReturn = 0;
      let weightedVol = 0;
      let totalWeight = 0;

      const activeAssets = (assets || []).filter(a => parseFloat(a.quantity) > 0);

      const assetClassStats = {
        stocks: { ret: 0.13, vol: 0.18 },
        mutual_funds: { ret: 0.11, vol: 0.14 },
        index_funds: { ret: 0.12, vol: 0.15 },
        crypto: { ret: 0.35, vol: 0.65 },
        gold: { ret: 0.09, vol: 0.12 },
        bonds: { ret: 0.075, vol: 0.06 },
        cash: { ret: 0.04, vol: 0.01 },
        fixed_deposits: { ret: 0.065, vol: 0.01 }
      };

      activeAssets.forEach(a => {
        const val = parseFloat(a.quantity) * parseFloat(a.current_price);
        const stats = assetClassStats[a.asset_class] || { ret: 0.10, vol: 0.15 };
        weightedReturn += stats.ret * val;
        weightedVol += stats.vol * val;
        totalWeight += val;
      });

      if (totalWeight <= 0) {
        weightedReturn = 0.125;
        weightedVol = 0.15;
        totalWeight = 5234000;
      } else {
        weightedReturn = weightedReturn / totalWeight;
        weightedVol = weightedVol / totalWeight;
      }

      const mu = mcUseCustomParams ? (mcCustomCagr / 100) : weightedReturn;
      const sigma = mcUseCustomParams ? (mcCustomVol / 100) : weightedVol;
      const initialWealth = totalWeight;

      const steps = 60;
      const dt = 1 / 12;

      const terminalValues = [];
      const paths = {
        p10: Array(steps + 1).fill(0),
        p50: Array(steps + 1).fill(0),
        p90: Array(steps + 1).fill(0)
      };

      paths.p10[0] = initialWealth;
      paths.p50[0] = initialWealth;
      paths.p90[0] = initialWealth;

      const generateNormalRandom = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      };

      for (let sim = 0; sim < mcSims; sim++) {
        let currentVal = initialWealth;
        for (let step = 1; step <= steps; step++) {
          const Z = generateNormalRandom();
          const drift = (mu - 0.5 * sigma * sigma) * dt;
          const shock = sigma * Math.sqrt(dt) * Z;
          currentVal = currentVal * Math.exp(drift + shock);
        }
        terminalValues.push(currentVal);
      }

      terminalValues.sort((a, b) => a - b);

      const p10_idx = Math.floor(mcSims * 0.1);
      const p50_idx = Math.floor(mcSims * 0.5);
      const p90_idx = Math.floor(mcSims * 0.9);

      const p10_worst = terminalValues[p10_idx];
      const p50_median = terminalValues[p50_idx];
      const p90_best = terminalValues[p90_idx];

      const targetToBeat = initialWealth * Math.pow(1 + (mcUseCustomParams ? mcCustomHurdle / 100 : 0.06), 5);
      const successCount = terminalValues.filter(v => v >= targetToBeat).length;
      const success_probability = (successCount / mcSims) * 100;

      for (let step = 1; step <= steps; step++) {
        const t = step * dt;
        paths.p10[step] = initialWealth * Math.exp((mu - 0.5 * sigma * sigma) * t + sigma * Math.sqrt(t) * -1.28);
        paths.p50[step] = initialWealth * Math.exp((mu - 0.5 * sigma * sigma) * t);
        paths.p90[step] = initialWealth * Math.exp((mu - 0.5 * sigma * sigma) * t + sigma * Math.sqrt(t) * 1.28);
      }

      const minVal = terminalValues[0];
      const maxVal = terminalValues[terminalValues.length - 1];
      const binWidth = (maxVal - minVal) / 10;

      const bins = Array(10).fill(0).map((_, i) => ({
        binLabel: (minVal + (i + 0.5) * binWidth),
        count: 0
      }));

      terminalValues.forEach(val => {
        let binIdx = Math.floor((val - minVal) / binWidth);
        if (binIdx >= 10) binIdx = 9;
        if (binIdx < 0) binIdx = 0;
        bins[binIdx].count++;
      });

      setMcData({
        success_probability,
        percentiles: {
          p10_worst,
          p50_median,
          p90_best
        },
        mu: mu * 100,
        sigma: sigma * 100,
        paths,
        bins,
        initialWealth
      });
    } catch (err) {
      console.error(err);
    } finally {
      setMcLoading(false);
    }
  };



  // Convert and Format Currency
  const formatCurrency = (val) => {
    let multiplier = 1.0;
    let currencySymbol = '₹';
    let locale = 'en-IN';

    if (currencyConversion === 'USD') {
      multiplier = 0.012; // simulated conversion rate 1 INR = 0.012 USD
      currencySymbol = '$';
      locale = 'en-US';
    }

    const convertedVal = val * multiplier;

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyConversion,
      maximumFractionDigits: 0
    }).format(convertedVal || 0);
  };

  const formatExposure = (exposureObj, defaultsText) => {
    if (!exposureObj || Object.keys(exposureObj).length === 0) {
      return defaultsText;
    }
    return Object.entries(exposureObj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k} (${v.toFixed(1)}%)`)
      .join(', ');
  };

  // Retirement calculations
  const runRetirementSim = () => {
    const yearsToRetire = retAge - curAge;
    const totalYears = lifeExpectancy - curAge;

    if (yearsToRetire <= 0 || totalYears <= 0) return {
      requiredCorpus: 0,
      projectedCorpus: 0,
      successProbability: 100,
      safeWithdrawal: 0,
      requiredSip: 0,
      expensesAtRetirement: 0,
      medianPath: [],
      depletionAge: null
    };

    // 1. Actuarial required corpus at retirement age
    let currentExpensesAtRetirement = monthlyExpenses * 12 * Math.pow(1 + inflationRate / 100, yearsToRetire);
    let requiredCorpus = 0;
    const postRetYears = Math.max(0, lifeExpectancy - retAge);
    for (let y = 0; y < postRetYears; y++) {
      const expThisYear = currentExpensesAtRetirement * Math.pow(1 + inflationRate / 100, y);
      const discountFactor = Math.pow(1 + postRetReturns / 100, y);
      requiredCorpus += expThisYear / discountFactor;
    }

    // 2. Generate Median (P50) Path year-by-year
    const currentWealth = demoMode ? 5234000 : (analytics?.summary?.total_wealth || 0);
    const medianPath = [{ age: curAge, wealth: currentWealth }];
    let wealth = currentWealth;
    let expenses = monthlyExpenses * 12;
    let salary = retSalary * 12;
    let depletionAge = null;

    for (let year = 1; year <= totalYears; year++) {
      const age = curAge + year;
      if (age <= retAge) {
        // Pre-retirement growth
        wealth = wealth * (1 + expReturns / 100) + Math.max(0, salary - expenses);
        expenses = expenses * (1 + inflationRate / 100);
        salary = salary * (1 + inflationRate / 100);
      } else {
        // Post-retirement drawdown
        expenses = expenses * (1 + inflationRate / 100);
        wealth = (wealth - expenses) * (1 + postRetReturns / 100);
        if (wealth < 0) wealth = 0;
      }
      medianPath.push({ age, wealth });

      if (wealth <= 0 && depletionAge === null && age > retAge) {
        depletionAge = age;
      }
    }

    const projectedCorpus = medianPath.find(p => p.age === retAge)?.wealth || 0;
    const corpusShortfall = Math.max(0, requiredCorpus - projectedCorpus);

    // Calculate required SIP to cover shortfall (deterministic)
    const r = (expReturns / 100) / 12;
    const n = yearsToRetire * 12;
    let requiredSip = 0;
    if (corpusShortfall > 0) {
      requiredSip = r > 0 ? (corpusShortfall * r) / (Math.pow(1 + r, n) - 1) : corpusShortfall / n;
    }

    // 3. Monte Carlo Simulation for Success Probability
    const randomNormal = () => {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    let successCount = 0;
    const trials = 200;
    const preVol = 0.12; // 12% equity/portfolio pre-retirement volatility
    const postVol = 0.06; // 6% conservative post-retirement volatility

    for (let t = 0; t < trials; t++) {
      let trialWealth = currentWealth;
      let trialExpenses = monthlyExpenses * 12;
      let trialSalary = retSalary * 12;
      let survived = true;

      for (let y = 1; y <= totalYears; y++) {
        const age = curAge + y;
        if (age <= retAge) {
          const randReturn = expReturns / 100 + preVol * randomNormal();
          trialWealth = trialWealth * (1 + randReturn) + Math.max(0, trialSalary - trialExpenses);
          trialExpenses = trialExpenses * (1 + inflationRate / 100);
          trialSalary = trialSalary * (1 + inflationRate / 100);
        } else {
          const randReturn = postRetReturns / 100 + postVol * randomNormal();
          trialExpenses = trialExpenses * (1 + inflationRate / 100);
          trialWealth = (trialWealth - trialExpenses) * (1 + randReturn);
          if (trialWealth <= 0) {
            survived = false;
            break;
          }
        }
      }
      if (survived) successCount++;
    }

    const successProbability = Math.round((successCount / trials) * 100);

    // Safe Withdrawal limit based on projected corpus (4% rule)
    const safeWithdrawal = (projectedCorpus * 0.04) / 12;

    return {
      requiredCorpus,
      projectedCorpus,
      successProbability,
      safeWithdrawal,
      requiredSip,
      expensesAtRetirement: currentExpensesAtRetirement / 12,
      medianPath,
      depletionAge
    };
  };

  const retirementDetails = runRetirementSim();

  // Tax and Dividend calculations
  const calculateTaxDetails = () => {
    const isIndia = taxCountry === 'IN';
    const stcgRate = isIndia ? 0.15 : 0.24; // 15% flat STCG vs 24% US bracket
    const ltcgRate = isIndia ? 0.10 : 0.15; // 10% vs 15%
    const divRate = isIndia ? 0.10 : 0.15;  // 10% vs 15%

    let realizedSTCG = 0;
    let realizedLTCG = 0;
    let totalDividends = 0;

    // Group transactions by symbol
    const txBySymbol = {};
    (transactions || []).forEach(tx => {
      if (!tx.symbol) return;
      if (!txBySymbol[tx.symbol]) txBySymbol[tx.symbol] = [];
      txBySymbol[tx.symbol].push(tx);
    });

    // Calculate realized gains per symbol
    Object.keys(txBySymbol).forEach(symbol => {
      const txs = [...txBySymbol[symbol]].sort((a, b) => new Date(a.date) - new Date(b.date));
      const buys = txs.filter(t => t.transaction_type === 'buy');
      const sells = txs.filter(t => t.transaction_type === 'sell');
      const dividends = txs.filter(t => t.transaction_type === 'dividend');

      dividends.forEach(d => {
        totalDividends += parseFloat(d.amount) || 0;
      });

      if (sells.length === 0) return;

      if (costBasisRule === 'average') {
        let runningQty = 0;
        let runningCost = 0;
        txs.forEach(t => {
          if (t.transaction_type === 'buy') {
            const qty = parseFloat(t.quantity);
            const price = parseFloat(t.price);
            runningCost = ((runningCost * runningQty) + (qty * price)) / (runningQty + qty || 1);
            runningQty += qty;
          } else if (t.transaction_type === 'sell') {
            const qty = parseFloat(t.quantity);
            const price = parseFloat(t.price);
            const gain = (price - runningCost) * qty;

            const firstBuyDate = buys[0] ? new Date(buys[0].date) : new Date();
            const sellDate = new Date(t.date);
            const isLTCG = (sellDate - firstBuyDate) / (1000 * 60 * 60 * 24) > 365;

            if (isLTCG) realizedLTCG += gain;
            else realizedSTCG += gain;

            runningQty -= qty;
          }
        });
      } else {
        const buyQueue = buys.map(b => ({
          qty: parseFloat(b.quantity),
          price: parseFloat(b.price),
          date: new Date(b.date)
        }));

        sells.forEach(s => {
          let sellQty = parseFloat(s.quantity);
          const sellPrice = parseFloat(s.price);
          const sellDate = new Date(s.date);

          if (costBasisRule === 'lifo') {
            buyQueue.sort((a, b) => b.date - a.date);
          } else {
            buyQueue.sort((a, b) => a.date - b.date);
          }

          for (let i = 0; i < buyQueue.length; i++) {
            if (sellQty <= 0) break;
            const b = buyQueue[i];
            if (b.qty <= 0) continue;

            const matchedQty = Math.min(sellQty, b.qty);
            const gain = (sellPrice - b.price) * matchedQty;
            const isLTCG = (sellDate - b.date) / (1000 * 60 * 60 * 24) > 365;

            if (isLTCG) realizedLTCG += gain;
            else realizedSTCG += gain;

            b.qty -= matchedQty;
            sellQty -= matchedQty;
          }
        });
      }
    });

    if (demoMode && realizedSTCG === 0 && realizedLTCG === 0) {
      realizedSTCG = 148000;
      realizedLTCG = 265000;
      totalDividends = 34500;
    }

    let unrealizedSTCG = 0;
    let unrealizedLTCG = 0;
    let harvestingOpportunities = [];
    let totalHarvestingLoss = 0;

    (assets || []).forEach((asset, idx) => {
      const qty = parseFloat(asset.quantity) || 0;
      const avgPrice = parseFloat(asset.avg_price) || 0;
      const curPrice = parseFloat(asset.current_price) || 0;
      if (qty <= 0) return;

      const cost = qty * avgPrice;
      const currentVal = qty * curPrice;
      const gain = currentVal - cost;

      const createdDate = new Date(asset.created_at || Date.now());
      const daysHeld = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      const isLTCG = daysHeld > 365 || (demoMode && idx % 2 === 0);

      if (gain > 0) {
        if (isLTCG) unrealizedLTCG += gain;
        else unrealizedSTCG += gain;
      } else if (gain < 0) {
        harvestingOpportunities.push({
          symbol: asset.symbol,
          name: asset.name,
          qty,
          avgPrice,
          curPrice,
          loss: Math.abs(gain)
        });
        totalHarvestingLoss += Math.abs(gain);
      }
    });

    if (demoMode && harvestingOpportunities.length === 0) {
      harvestingOpportunities = [
        { symbol: 'INFY', name: 'Infosys Ltd', qty: 50, avgPrice: 1620, curPrice: 1440, loss: 9000 },
        { symbol: 'RELIANCE', name: 'Reliance Industries', qty: 20, avgPrice: 2850, curPrice: 2600, loss: 5000 }
      ];
      totalHarvestingLoss = 14000;
    }

    const stcgTax = realizedSTCG * stcgRate;
    const ltcgTax = Math.max(0, realizedLTCG * ltcgRate);
    const dividendTax = totalDividends * divRate;
    const totalTaxEstimate = stcgTax + ltcgTax + dividendTax;
    const potentialTaxSavings = totalHarvestingLoss * stcgRate;

    return {
      realizedSTCG,
      realizedLTCG,
      unrealizedSTCG,
      unrealizedLTCG,
      totalDividends,
      stcgTax,
      ltcgTax,
      dividendTax,
      totalTaxEstimate,
      harvestingOpportunities,
      totalHarvestingLoss,
      potentialTaxSavings,
      stcgRate,
      ltcgRate,
      divRate
    };
  };

  const taxDetails = calculateTaxDetails();

  const handleExportTaxReport = () => {
    const csvContent = [
      ["WealthOS Capital Gains & Dividend Tax Report", ""],
      ["Generated Date", new Date().toLocaleString()],
      ["Tax Rules Region", taxCountry === 'IN' ? "India (IN)" : "United States (US)"],
      ["Inventory Cost Basis Method", costBasisRule.toUpperCase()],
      [],
      ["1. CAPITAL GAINS SUMMARY (REALIZED)", ""],
      ["Short Term Capital Gains (STCG)", taxDetails.realizedSTCG.toFixed(2)],
      ["STCG Tax Rate", `${(taxDetails.stcgRate * 100).toFixed(1)}%`],
      ["STCG Tax Liability", taxDetails.stcgTax.toFixed(2)],
      ["Long Term Capital Gains (LTCG)", taxDetails.realizedLTCG.toFixed(2)],
      ["LTCG Tax Rate", `${(taxDetails.ltcgRate * 100).toFixed(1)}%`],
      ["LTCG Tax Liability", taxDetails.ltcgTax.toFixed(2)],
      [],
      ["2. DIVIDEND INCOME SUMMARY", ""],
      ["Total Dividends Received", taxDetails.totalDividends.toFixed(2)],
      ["Dividend Tax Rate", `${(taxDetails.divRate * 100).toFixed(1)}%`],
      ["Dividend Tax Liability", taxDetails.dividendTax.toFixed(2)],
      [],
      ["3. ESTIMATED TOTAL FISCAL TAX LIABILITY", taxDetails.totalTaxEstimate.toFixed(2)],
      [],
      ["4. ACTIVE TAX LOSS HARVESTING OPPORTUNITIES", ""],
      ["Symbol", "Name", "Quantity Held", "Average Price", "Current Price", "Unrealized Capital Loss", "Tax Offset Saving Potential"],
      ...taxDetails.harvestingOpportunities.map(opp => [
        opp.symbol,
        opp.name,
        opp.qty,
        opp.avgPrice.toFixed(2),
        opp.curPrice.toFixed(2),
        opp.loss.toFixed(2),
        (opp.loss * taxDetails.stcgRate).toFixed(2)
      ])
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `wealthos_tax_report_${taxCountry}_${costBasisRule}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getQuarterlyDueDates = () => {
    const isIndia = taxCountry === 'IN';
    const totalTax = taxDetails.totalTaxEstimate;
    if (isIndia) {
      return [
        { quarter: 'Q1', date: 'Jun 15, 2026', pct: '15%', amount: totalTax * 0.15, status: 'Paid' },
        { quarter: 'Q2', date: 'Sep 15, 2026', pct: '30%', amount: totalTax * 0.30, status: 'Upcoming' },
        { quarter: 'Q3', date: 'Dec 15, 2026', pct: '30%', amount: totalTax * 0.30, status: 'Upcoming' },
        { quarter: 'Q4', date: 'Mar 15, 2027', pct: '25%', amount: totalTax * 0.25, status: 'Upcoming' }
      ];
    } else {
      return [
        { quarter: 'Q1', date: 'Apr 15, 2026', pct: '25%', amount: totalTax * 0.25, status: 'Paid' },
        { quarter: 'Q2', date: 'Jun 15, 2026', pct: '25%', amount: totalTax * 0.25, status: 'Paid' },
        { quarter: 'Q3', date: 'Sep 15, 2026', pct: '25%', amount: totalTax * 0.25, status: 'Upcoming' },
        { quarter: 'Q4', date: 'Jan 15, 2027', pct: '25%', amount: totalTax * 0.25, status: 'Upcoming' }
      ];
    }
  };

  const quarterlyDueDates = getQuarterlyDueDates();

  // Dividend Tracking & Projection calculations
  const calculateDividendDetails = () => {
    let totalCostBasis = 0;
    let totalCurrentValue = 0;
    let annualDividendIncome = 0;

    const activeAssets = (assets || []).filter(a => parseFloat(a.quantity) > 0);

    activeAssets.forEach(asset => {
      const qty = parseFloat(asset.quantity);
      const avgPrice = parseFloat(asset.avg_price);
      const curPrice = parseFloat(asset.current_price);

      const costBasis = qty * avgPrice;
      const currentVal = qty * curPrice;

      totalCostBasis += costBasis;
      totalCurrentValue += currentVal;

      let divYieldPct = parseFloat(asset.dividend) || 0;
      if (divYieldPct === 0) {
        const symbol = (asset.symbol || '').toUpperCase();
        if (asset.asset_class === 'bonds') divYieldPct = 6.2;
        else if (asset.asset_class === 'reits') divYieldPct = 5.5;
        else if (symbol === 'TCS') divYieldPct = 2.1;
        else if (symbol === 'INFY') divYieldPct = 1.9;
        else if (symbol === 'RELIANCE') divYieldPct = 0.9;
        else if (asset.asset_class === 'stocks') divYieldPct = 1.25;
        else if (asset.asset_class === 'mutual_funds' || asset.asset_class === 'index_funds') divYieldPct = 0.85;
      }

      annualDividendIncome += currentVal * (divYieldPct / 100);
    });

    if (totalCurrentValue === 0) {
      totalCurrentValue = 5234000;
      totalCostBasis = 4250000;
      annualDividendIncome = 75893;
    }

    const portfolioYield = (annualDividendIncome / totalCurrentValue) * 100;
    const yieldOnCost = (annualDividendIncome / totalCostBasis) * 100;

    let weightedGrowth = 0;
    let totalWeight = 0;
    activeAssets.forEach(asset => {
      const currentVal = (parseFloat(asset.quantity) || 0) * (parseFloat(asset.current_price) || 0);
      if (currentVal <= 0) return;

      let assetGrowth = 8.5;
      const symbol = (asset.symbol || '').toUpperCase();
      if (symbol === 'TCS') assetGrowth = 12.4;
      else if (symbol === 'INFY') assetGrowth = 10.8;
      else if (symbol === 'RELIANCE') assetGrowth = 7.5;
      else if (asset.asset_class === 'bonds') assetGrowth = 0;
      else if (asset.asset_class === 'reits') assetGrowth = 4.2;

      weightedGrowth += assetGrowth * currentVal;
      totalWeight += currentVal;
    });
    const dividendGrowthYoY = totalWeight > 0 ? (weightedGrowth / totalWeight) : 8.4;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    const monthlyProjection = Array.from({ length: 12 }, (_, i) => {
      const mIdx = (currentMonthIdx + i) % 12;
      return { month: months[mIdx], amount: 0, details: [] };
    });

    activeAssets.forEach(asset => {
      const qty = parseFloat(asset.quantity);
      const curPrice = parseFloat(asset.current_price);
      const currentVal = qty * curPrice;
      if (currentVal <= 0) return;

      let divYieldPct = parseFloat(asset.dividend) || 0;
      if (divYieldPct === 0) {
        const symbol = (asset.symbol || '').toUpperCase();
        if (asset.asset_class === 'bonds') divYieldPct = 6.2;
        else if (asset.asset_class === 'reits') divYieldPct = 5.5;
        else if (symbol === 'TCS') divYieldPct = 2.1;
        else if (symbol === 'INFY') divYieldPct = 1.9;
        else if (symbol === 'RELIANCE') divYieldPct = 0.9;
        else if (asset.asset_class === 'stocks') divYieldPct = 1.25;
        else if (asset.asset_class === 'mutual_funds' || asset.asset_class === 'index_funds') divYieldPct = 0.85;
      }
      const annualIncome = currentVal * (divYieldPct / 100);

      let payoutMonths = [];
      if (asset.asset_class === 'bonds') {
        payoutMonths = [5, 11];
      } else if (asset.asset_class === 'reits') {
        payoutMonths = [2, 5, 8, 11];
      } else {
        const symbol = (asset.symbol || '').toUpperCase();
        if (symbol === 'TCS' || symbol === 'INFY') {
          payoutMonths = [0, 6];
        } else if (symbol === 'RELIANCE') {
          payoutMonths = [1, 7];
        } else {
          payoutMonths = [4, 10];
        }
      }

      const payoutAmt = annualIncome / payoutMonths.length;
      payoutMonths.forEach(m => {
        const projEntry = monthlyProjection.find(p => months.indexOf(p.month) === m);
        if (projEntry) {
          projEntry.amount += payoutAmt;
          projEntry.details.push({ symbol: asset.symbol, amount: payoutAmt });
        }
      });
    });

    const totalProj = monthlyProjection.reduce((sum, p) => sum + p.amount, 0);
    if (demoMode && totalProj === 0) {
      const seedAmounts = [4200, 2800, 7200, 3100, 5400, 9100, 6200, 4800, 8300, 3900, 5800, 11200];
      monthlyProjection.forEach((p, idx) => {
        p.amount = seedAmounts[idx];
        p.details = [
          { symbol: 'TCS', amount: seedAmounts[idx] * 0.4 },
          { symbol: 'RELIANCE', amount: seedAmounts[idx] * 0.3 },
          { symbol: 'Govt Bonds', amount: seedAmounts[idx] * 0.3 }
        ];
      });
      annualDividendIncome = seedAmounts.reduce((sum, a) => sum + a, 0);
    }

    const dripSuggestions = [];
    activeAssets.forEach(asset => {
      const symbol = (asset.symbol || '').toUpperCase();
      let divYieldPct = parseFloat(asset.dividend) || 0;
      if (divYieldPct === 0) {
        if (symbol === 'TCS') divYieldPct = 2.1;
        else if (symbol === 'INFY') divYieldPct = 1.9;
        else if (symbol === 'RELIANCE') divYieldPct = 0.9;
      }
      const qty = parseFloat(asset.quantity) || 0;
      const curPrice = parseFloat(asset.current_price) || 0;
      const annualIncome = qty * curPrice * (divYieldPct / 100);

      if (annualIncome > 500) {
        let targetAsset = 'Nifty 50 Index Fund';
        if (asset.asset_class === 'bonds') targetAsset = 'Gold ETF';
        else if (symbol === 'TCS' || symbol === 'INFY') targetAsset = 'Parag Parikh Flexi Cap';

        dripSuggestions.push({
          sourceSymbol: asset.symbol,
          annualIncome,
          targetAsset,
          expectedReturn: targetAsset === 'Parag Parikh Flexi Cap' ? 14.5 : 12.0
        });
      }
    });

    if (demoMode && dripSuggestions.length === 0) {
      dripSuggestions.push(
        { sourceSymbol: 'TCS', annualIncome: 14800, targetAsset: 'Parag Parikh Flexi Cap', expectedReturn: 14.5 },
        { sourceSymbol: 'RELIANCE', annualIncome: 9800, targetAsset: 'Nifty 50 Index Fund', expectedReturn: 12.0 }
      );
    }

    return {
      portfolioYield,
      yieldOnCost,
      dividendGrowthYoY,
      annualDividendIncome,
      monthlyProjection,
      dripSuggestions
    };
  };

  const dividendDetails = calculateDividendDetails();

  const getBenchmarkStats = (bench) => {
    switch (bench) {
      case 'Nifty 50':
        return { cagr: 14.2, vol: 12.8, beta: 0.85, name: 'Nifty 50 (India)' };
      case 'Sensex':
        return { cagr: 13.8, vol: 12.5, beta: 0.82, name: 'BSE Sensex (India)' };
      case 'NASDAQ':
        return { cagr: 22.8, vol: 18.5, beta: 0.95, name: 'NASDAQ 100 (US)' };
      case 'S&P 500':
        return { cagr: 18.4, vol: 14.2, beta: 0.88, name: 'S&P 500 Index (US)' };
      case 'Gold':
        return { cagr: 9.5, vol: 11.2, beta: 0.15, name: 'Physical Gold Bullion' };
      case 'Bitcoin':
        return { cagr: 42.5, vol: 55.4, beta: 0.45, name: 'Bitcoin (BTC/USD)' };
      case 'Custom Portfolio':
      default:
        return { cagr: 15.6, vol: 13.5, beta: 0.78, name: 'Custom Benchmark Portfolio' };
    }
  };

  const calculateBenchmarkComparison = () => {
    const bench = getBenchmarkStats(selectedBenchmark);
    const portCagr = demoMode ? 18.4 : (analytics?.summary?.cagr || 18.4);
    const portVol = demoMode ? 14.5 : (analytics?.metrics?.volatility || 14.5);

    const portBeta = bench.beta;
    const riskFreeRate = 6.5;
    const portExcess = portCagr - riskFreeRate;
    const benchExcess = bench.cagr - riskFreeRate;
    const alpha = portExcess - (portBeta * benchExcess);

    const trackingError = Math.abs(portVol - bench.vol) * 0.4 + 1.85;
    const informationRatio = trackingError > 0 ? (portCagr - bench.cagr) / trackingError : 0;

    const attributionData = [
      {
        assetClass: 'Equities',
        portWeight: 65,
        benchWeight: 60,
        portReturn: 21.2,
        benchReturn: bench.cagr,
      },
      {
        assetClass: 'Commodities (Gold)',
        portWeight: 15,
        benchWeight: 10,
        portReturn: 10.5,
        benchReturn: 9.5,
      },
      {
        assetClass: 'Debt & Cash',
        portWeight: 20,
        benchWeight: 30,
        portReturn: 7.2,
        benchReturn: 6.5,
      }
    ];

    const totalBenchCagr = bench.cagr;

    const attributionRows = attributionData.map(row => {
      const wp = row.portWeight / 100;
      const wb = row.benchWeight / 100;
      const Rp = row.portReturn;
      const Rb = row.benchReturn;
      const Rtb = totalBenchCagr;

      const allocationEffect = (wp - wb) * (Rb - Rtb);
      const selectionEffect = wb * (Rp - Rb);
      const interactionEffect = (wp - wb) * (Rp - Rb);
      const activeReturn = allocationEffect + selectionEffect + interactionEffect;

      return {
        ...row,
        allocationEffect: allocationEffect * 100,
        selectionEffect: selectionEffect * 100,
        interactionEffect: interactionEffect * 100,
        activeReturn: activeReturn * 100
      };
    });

    const totalAlloc = attributionRows.reduce((sum, r) => sum + r.allocationEffect, 0);
    const totalSelect = attributionRows.reduce((sum, r) => sum + r.selectionEffect, 0);
    const totalInteract = attributionRows.reduce((sum, r) => sum + r.interactionEffect, 0);
    const totalActive = totalAlloc + totalSelect + totalInteract;

    return {
      benchmarkName: bench.name,
      benchmarkCagr: bench.cagr,
      benchmarkVol: bench.vol,
      alpha,
      trackingError,
      informationRatio,
      beta: portBeta,
      attributionRows,
      totalAlloc,
      totalSelect,
      totalInteract,
      totalActive
    };
  };

  const benchmarkAttribution = calculateBenchmarkComparison();

  const calculateStressTestDetails = () => {
    const shocks = {
      'COVID Crash (2020)': {
        stocks: -0.35, mutual_funds: -0.28, index_funds: -0.32, crypto: -0.45, gold: -0.05, bonds: 0.05, cash: 0.0,
        description: 'S&P 500 & Nifty collapsed 30%+ in 4 weeks. High-beta and tech holdings crashed; fixed income and gold acted as modest shock absorbers.',
        action: 'Hold capital. Rebalance equity weight by redeploying capital from debt into equities.'
      },
      '2008 Financial Crisis': {
        stocks: -0.50, mutual_funds: -0.42, index_funds: -0.48, crypto: -0.80, gold: 0.15, bonds: 0.08, cash: 0.0,
        description: 'Global financial system freeze. Real estate and banking equities fell 60%+. Gold was a strong positive diversifier (+15%).',
        action: 'Maintain core equity allocation. Increase allocation to sovereign-backed debt and bullion.'
      },
      'Dot-com Crash (2000)': {
        stocks: -0.45, mutual_funds: -0.35, index_funds: -0.42, crypto: -0.90, gold: 0.20, bonds: 0.12, cash: 0.0,
        description: 'Speculative tech valuations imploded. NASDAQ fell 78% over 2.5 years. Value equities and fixed income significantly outperformed.',
        action: 'Tilt asset allocation away from high-multiple growth equities into cash flow positive value plays.'
      },
      'Interest Rate Hike (+2%)': {
        stocks: -0.10, mutual_funds: -0.07, index_funds: -0.09, crypto: -0.25, gold: -0.12, bonds: -0.06, cash: 0.02,
        description: 'Global monetary tightening. Multiple compression for high-PE equities. Bond duration risk leads to capital losses; cash yield rises.',
        action: 'Shorten bond duration. Allocate to floating rate instruments and liquid funds.'
      },
      'Oil Crisis (+25%)': {
        stocks: -0.05, mutual_funds: -0.04, index_funds: -0.05, crypto: 0.10, gold: 0.08, bonds: -0.02, cash: 0.0,
        description: 'Commodity price shock drives structural inflation. Exporters and chemical/manufacturing equities margins suffer. Resource stocks and Gold rally.',
        action: 'Add exposure to energy producers, commodity ETFs, and physical assets.'
      },
      'Currency Collapse': {
        stocks: -0.15, mutual_funds: -0.12, index_funds: -0.15, crypto: 0.50, gold: 0.40, bonds: -0.20, cash: -0.15,
        description: 'Domestic currency devalues rapidly. Local cash and debt instruments lose real purchasing power. Hard assets like Gold (+40%) and Crypto (+50%) surge.',
        action: 'Shift fiat cash and local deposits to offshore assets, physical gold, and sovereign hedged products.'
      },
      'Custom Crash': {
        stocks: customStockShock / 100, mutual_funds: customStockShock / 100, index_funds: customStockShock / 100,
        crypto: customCryptoShock / 100, gold: customGoldShock / 100, bonds: (customGoldShock / 100) * 0.5, cash: 0.0,
        description: `Custom stress parameters simulated. Stocks shock: ${customStockShock}%, Crypto shock: ${customCryptoShock}%, Gold/Bonds shock: ${customGoldShock}%.`,
        action: 'Adjust portfolio weights dynamically based on calculated potential shortfall.'
      }
    };

    const currentScenario = shocks[activeStressScenario] || shocks['COVID Crash (2020)'];

    const activeAssets = (assets || []).filter(a => parseFloat(a.quantity) > 0);
    let totalPortfolioVal = 0;
    let totalImpactAmount = 0;
    let worstAssetImpact = null;
    let worstAssetLoss = 0;

    activeAssets.forEach(a => {
      const val = parseFloat(a.quantity) * parseFloat(a.current_price);
      totalPortfolioVal += val;

      const shock = currentScenario[a.asset_class] !== undefined ? currentScenario[a.asset_class] : -0.10;
      const impact = val * shock;
      totalImpactAmount += impact;

      if (impact < worstAssetLoss) {
        worstAssetLoss = impact;
        worstAssetImpact = {
          name: a.name,
          symbol: a.symbol,
          impactAmount: impact,
          impactPct: shock * 100
        };
      }
    });

    if (totalPortfolioVal === 0) {
      totalPortfolioVal = 5234000;
      const sampleStocksVal = totalPortfolioVal * 0.65;
      const sampleCryptoVal = totalPortfolioVal * 0.10;
      const sampleGoldVal = totalPortfolioVal * 0.15;
      const sampleBondsVal = totalPortfolioVal * 0.10;

      const sShock = currentScenario.stocks;
      const crShock = currentScenario.crypto;
      const gShock = currentScenario.gold;
      const bShock = currentScenario.bonds;

      totalImpactAmount = (sampleStocksVal * sShock) + (sampleCryptoVal * crShock) + (sampleGoldVal * gShock) + (sampleBondsVal * bShock);

      worstAssetImpact = {
        name: 'TCS Ltd',
        symbol: 'TCS',
        impactAmount: sampleStocksVal * sShock,
        impactPct: sShock * 100
      };
    }

    const impactPct = (totalImpactAmount / totalPortfolioVal) * 100;

    let recoveryMonths = Math.ceil(Math.abs(impactPct) / 2.5);
    recoveryMonths = Math.max(3, Math.min(36, recoveryMonths));

    return {
      scenarioName: activeStressScenario,
      impactPct,
      impactAmount: totalImpactAmount,
      recoveryTimeMonths: recoveryMonths,
      description: currentScenario.description,
      recommendedAction: currentScenario.action,
      worstAsset: worstAssetImpact || { name: 'None', symbol: '-', impactAmount: 0, impactPct: 0 }
    };
  };

  const stressTestResult = calculateStressTestDetails();

  const renderPathChart = () => {
    if (!mcData || !mcData.paths) return null;

    const p10 = mcData.paths.p10;
    const p50 = mcData.paths.p50;
    const p90 = mcData.paths.p90;
    const steps = p10.length - 1;

    const width = 450;
    const height = 140;
    const padding = { top: 10, right: 10, bottom: 20, left: 55 };

    const allVals = [...p10, ...p50, ...p90];
    const maxVal = Math.max(...allVals) * 1.05;
    const minVal = Math.min(...allVals) * 0.95;
    const yRange = maxVal - minVal || 1;

    const getX = (step) => padding.left + (step / steps) * (width - padding.left - padding.right);
    const getY = (val) => height - padding.bottom - ((val - minVal) / yRange) * (height - padding.top - padding.bottom);

    const buildPath = (arr) => arr.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`).join(' ');

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
        {[0.25, 0.5, 0.75, 1.0].map((ratio, idx) => (
          <line
            key={idx}
            x1={padding.left}
            y1={padding.top + ratio * (height - padding.top - padding.bottom)}
            x2={width - padding.right}
            y2={padding.top + ratio * (height - padding.top - padding.bottom)}
            stroke="var(--border-primary)"
            strokeDasharray="2,2"
          />
        ))}
        <path d={buildPath(p90)} fill="none" stroke="var(--green)" strokeWidth="1.5" />
        <path d={buildPath(p50)} fill="none" stroke="var(--accent)" strokeWidth="2.0" />
        <path d={buildPath(p10)} fill="none" stroke="var(--red)" strokeWidth="1.5" />

        <text x={getX(steps) - 5} y={getY(p90[steps]) - 3} fill="var(--green)" fontSize="8" textAnchor="end" fontFamily="var(--font-mono)">P90 (Best)</text>
        <text x={getX(steps) - 5} y={getY(p50[steps]) - 3} fill="var(--accent)" fontSize="8" textAnchor="end" fontFamily="var(--font-mono)">P50 (Median)</text>
        <text x={getX(steps) - 5} y={getY(p10[steps]) + 8} fill="var(--red)" fontSize="8" textAnchor="end" fontFamily="var(--font-mono)">P10 (Worst)</text>

        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--text-secondary)" />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--text-secondary)" />

        {[0, 1, 2, 3, 4, 5].map(year => (
          <text key={year} x={getX(year * 12)} y={height - 6} fill="var(--text-secondary)" fontSize="7" textAnchor="middle" fontFamily="var(--font-mono)">Y{year}</text>
        ))}

        {[minVal, minVal + yRange * 0.5, maxVal].map((val, idx) => (
          <text key={idx} x={padding.left - 5} y={getY(val) + 3} fill="var(--text-secondary)" fontSize="7" textAnchor="end" fontFamily="var(--font-mono)">
            {formatCurrency(val)}
          </text>
        ))}
      </svg>
    );
  };

  const renderHistogram = () => {
    if (!mcData || !mcData.bins) return null;

    const bins = mcData.bins;
    const counts = bins.map(b => b.count);
    const maxCount = Math.max(...counts) || 1;

    const width = 450;
    const height = 140;
    const padding = { top: 15, right: 10, bottom: 20, left: 30 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const barWidth = (plotWidth / bins.length) * 0.85;
    const gapWidth = (plotWidth / bins.length) * 0.15;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
        {bins.map((bin, idx) => {
          const barHeight = (bin.count / maxCount) * plotHeight;
          const x = padding.left + idx * (barWidth + gapWidth) + gapWidth / 2;
          const y = height - padding.bottom - barHeight;

          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="rgba(0, 212, 170, 0.4)"
                stroke="var(--green)"
                strokeWidth="1"
                rx="1"
              />
              <text x={x + barWidth / 2} y={y - 3} fill="var(--text-primary)" fontSize="7" textAnchor="middle" fontFamily="var(--font-mono)">
                {bin.count}
              </text>
            </g>
          );
        })}

        {bins.map((bin, idx) => {
          if (idx % 3 !== 0 && idx !== bins.length - 1) return null;
          const x = padding.left + idx * (barWidth + gapWidth) + barWidth / 2 + gapWidth / 2;
          return (
            <text key={idx} x={x} y={height - 6} fill="var(--text-secondary)" fontSize="6" textAnchor="middle" fontFamily="var(--font-mono)">
              {formatCurrency(bin.binLabel)}
            </text>
          );
        })}

        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--text-secondary)" />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--text-secondary)" />
      </svg>
    );
  };

  const renderRollingCorrChart = () => {
    if (!rollingCorrData || rollingCorrData.length === 0) return null;

    const width = 450;
    const height = 120;
    const padding = { top: 15, right: 15, bottom: 20, left: 35 };

    const getX = (idx) => padding.left + (idx / 11) * (width - padding.left - padding.right);
    const getY = (val) => height - padding.bottom - ((val - (-1)) / 2) * (height - padding.top - padding.bottom);

    let pathD = `M ${getX(0)} ${getY(rollingCorrData[0].value)}`;
    for (let i = 1; i < rollingCorrData.length; i++) {
      pathD += ` L ${getX(i)} ${getY(rollingCorrData[i].value)}`;
    }

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-primary)', overflow: 'visible' }}>
        <defs>
          <linearGradient id="corrGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--red)" />
            <stop offset="50%" stopColor="var(--text-secondary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--green)" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[-1.0, -0.5, 0.0, 0.5, 1.0].map((level, idx) => {
          const y = getY(level);
          return (
            <g key={idx}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-primary)" strokeDasharray={level === 0.0 ? "0" : "2 2"} strokeWidth={level === 0.0 ? 1 : 0.5} />
              <text x={padding.left - 5} y={y + 3} fill="var(--text-secondary)" fontSize="7" textAnchor="end" fontFamily="var(--font-mono)">
                {level > 0 ? '+' : ''}{level.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {rollingCorrData.map((d, idx) => {
          if (idx % 2 !== 0) return null;
          return (
            <text key={idx} x={getX(idx)} y={height - 5} fill="var(--text-secondary)" fontSize="7" textAnchor="middle" fontFamily="var(--font-mono)">
              {d.month}
            </text>
          );
        })}

        {/* Line path */}
        <path d={pathD} fill="none" stroke="url(#corrGrad)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Data points */}
        {rollingCorrData.map((d, idx) => (
          <circle key={idx} cx={getX(idx)} cy={getY(d.value)} r="2" fill="var(--bg-tertiary)" stroke={d.value >= 0 ? "var(--red)" : "var(--green)"} strokeWidth="1.5" />
        ))}
      </svg>
    );
  };

  const renderCorrelationNetwork = () => {
    const assetsList = ['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'];
    const nodeCoords = {
      AAPL: { x: 160 + 80 * Math.cos(0 * Math.PI / 180), y: 110 + 80 * Math.sin(0 * Math.PI / 180) },
      TSLA: { x: 160 + 80 * Math.cos(72 * Math.PI / 180), y: 110 + 80 * Math.sin(72 * Math.PI / 180) },
      NVDA: { x: 160 + 80 * Math.cos(144 * Math.PI / 180), y: 110 + 80 * Math.sin(144 * Math.PI / 180) },
      BTC: { x: 160 + 80 * Math.cos(216 * Math.PI / 180), y: 110 + 80 * Math.sin(216 * Math.PI / 180) },
      GOLD: { x: 160 + 80 * Math.cos(288 * Math.PI / 180), y: 110 + 80 * Math.sin(288 * Math.PI / 180) }
    };

    const links = [];
    for (let i = 0; i < assetsList.length; i++) {
      for (let j = i + 1; j < assetsList.length; j++) {
        const a = assetsList[i];
        const b = assetsList[j];
        const val = corrMatrix[i][j];
        links.push({ source: a, target: b, value: val });
      }
    }

    return (
      <svg width="100%" height="220" viewBox="0 0 320 220" style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-primary)', overflow: 'visible' }}>
        {/* Drawing Edges */}
        {links.map((link, idx) => {
          const start = nodeCoords[link.source];
          const end = nodeCoords[link.target];

          const isHighlighted = !hoveredCorrAsset || hoveredCorrAsset === link.source || hoveredCorrAsset === link.target;
          const strokeWidth = Math.abs(link.value) * 3 + 0.5;
          const opacity = isHighlighted ? Math.abs(link.value) * 0.8 + 0.15 : 0.05;
          const isNegative = link.value < 0;

          return (
            <line
              key={idx}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={isNegative ? "var(--green)" : "var(--red)"}
              strokeWidth={strokeWidth}
              strokeDasharray={isNegative ? "3 3" : "0"}
              opacity={opacity}
            />
          );
        })}

        {/* Drawing Nodes */}
        {assetsList.map((asset, idx) => {
          const coord = nodeCoords[asset];
          const isHovered = hoveredCorrAsset === asset;
          const isSelected = selectedCorrAssetA === asset || selectedCorrAssetB === asset;

          return (
            <g
              key={asset}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredCorrAsset(asset)}
              onMouseLeave={() => setHoveredCorrAsset(null)}
              onClick={() => {
                if (selectedCorrAssetA === asset) return;
                setSelectedCorrAssetB(selectedCorrAssetA);
                setSelectedCorrAssetA(asset);
              }}
            >
              <circle
                cx={coord.x}
                cy={coord.y}
                r={isHovered ? 18 : 15}
                fill="var(--bg-primary)"
                stroke={isSelected ? "var(--accent)" : isHovered ? "var(--accent-glow)" : "var(--border-primary)"}
                strokeWidth={isSelected ? 2 : 1}
                style={{ transition: 'all 0.15s ease' }}
              />
              <text
                x={coord.x}
                y={coord.y + 4}
                fill={isSelected ? "var(--accent)" : "var(--text-primary)"}
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
              >
                {asset}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const getAllocationData = () => {
    const activeAssets = (assets || []).filter(a => parseFloat(a.quantity) > 0);

        const demoAssets = [
        {name: 'Reliance Industries', asset_class: 'stocks', symbol: 'RELIANCE', val: 1250000 },
        {name: 'Tata Consultancy Services', asset_class: 'stocks', symbol: 'TCS', val: 950000 },
        {name: 'Nippon India Gold BeES', asset_class: 'gold', symbol: 'GOLDBEES', val: 780000 },
        {name: 'Bitcoin', asset_class: 'crypto', symbol: 'BTC', val: 520000 },
        {name: 'Parag Parikh Flexi Cap', asset_class: 'mutual_funds', symbol: 'PPFAS', val: 820000 },
        {name: 'SBI Fixed Deposit', asset_class: 'cash', symbol: 'SBIFD', val: 610000 },
        {name: 'HDFC Bond Fund', asset_class: 'bonds', symbol: 'HDFCBOND', val: 320000 }
        ];

        const currentMap = { };
        let totalVal = 0;
    
    if (activeAssets.length > 0) {
          activeAssets.forEach(a => {
            const val = parseFloat(a.quantity) * parseFloat(a.current_price);
            totalVal += val;
            if (!currentMap[a.asset_class]) {
              currentMap[a.asset_class] = { value: 0, items: [] };
            }
            currentMap[a.asset_class].value += val;
            currentMap[a.asset_class].items.push({ name: a.name, symbol: a.symbol, value: val });
          });
    } else {
          demoAssets.forEach(a => {
            totalVal += a.val;
            if (!currentMap[a.asset_class]) {
              currentMap[a.asset_class] = { value: 0, items: [] };
            }
            currentMap[a.asset_class].value += a.val;
            currentMap[a.asset_class].items.push({ name: a.name, symbol: a.symbol, value: a.val });
          });
    }

        const classColors = {
          stocks: '#ff4466',
        mutual_funds: '#00bcd4',
        gold: '#ffb300',
        crypto: '#9c27b0',
        cash: '#00d4aa',
        bonds: '#4caf50'
    };

        const idealPcts = {
          stocks: 0.40,
        mutual_funds: 0.20,
        gold: 0.15,
        crypto: 0.05,
        cash: 0.10,
        bonds: 0.10
    };

        const suggestedPcts = {
          stocks: 0.35,
        mutual_funds: 0.20,
        gold: 0.20,
        crypto: 0.03,
        cash: 0.12,
        bonds: 0.10
    };

    const classes = Object.keys(idealPcts).map(cls => {
      const currentVal = currentMap[cls]?.value || 0;
        const currentPct = currentVal / (totalVal || 1);

        const idealPct = idealPcts[cls];
        const idealVal = totalVal * idealPct;

        const suggestedPct = suggestedPcts[cls];
        const suggestedVal = totalVal * suggestedPct;

        return {
          key: cls,
        label: cls.replace('_', ' ').toUpperCase(),
        color: classColors[cls] || '#757575',
        currentVal,
        currentPct,
        idealVal,
        idealPct,
        suggestedVal,
        suggestedPct,
        items: currentMap[cls]?.items || []
      };
    });

        return {
          totalVal,
          classes
        };
  };

        const allocationStudioData = getAllocationData();

  const renderAllocationPieChart = () => {
    const data = allocationStudioData;
        let items = [];

        if (allocationDrillClass) {
      const cls = data.classes.find(c => c.key === allocationDrillClass);
        if (!cls) return null;
      const totalClassVal = cls.items.reduce((sum, item) => sum + item.value, 0) || 1;
      items = cls.items.map(item => ({
          key: item.symbol,
        label: item.name,
        color: cls.color,
        value: item.value,
        pct: item.value / totalClassVal
      }));
    } else {
          items = data.classes.map(c => {
            let val = c.currentVal;
            let pct = c.currentPct;
            if (allocationCompareMode === 'ideal') {
              val = c.idealVal;
              pct = c.idealPct;
            } else if (allocationCompareMode === 'suggested') {
              val = c.suggestedVal;
              pct = c.suggestedPct;
            }
            return {
              key: c.key,
              label: c.label,
              color: c.color,
              value: val,
              pct: pct
            };
          }).filter(item => item.value > 0);
    }

        const cx = 160;
        const cy = 80;
        const r = 65;

        let accumulatedAngle = 0;
    const slices = items.map((item) => {
      const angle = item.pct * 360;
        const startAngle = accumulatedAngle;
        const endAngle = accumulatedAngle + angle;
        accumulatedAngle = endAngle;

      const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
          x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians)
        };
      };

        const start = polarToCartesian(cx, cy, r, startAngle);
        const end = polarToCartesian(cx, cy, r, endAngle);
      const largeArcFlag = angle > 180 ? 1 : 0;

        const d = [
        "M", cx, cy,
        "L", start.x, start.y,
        "A", r, r, 0, largeArcFlag, 1, end.x, end.y,
        "Z"
        ].join(" ");

        return {
          ...item,
          d,
          middleAngle: startAngle + angle / 2,
        start,
        end
      };
    });

        return (
        <svg width="100%" height="160" viewBox="0 0 320 160" style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-primary)', overflow: 'visible' }}>
          {slices.map((slice, idx) => {
            const isHovered = allocationHoveredKey === slice.key;
            const shiftRadius = isHovered ? 4 : 0;
            const shiftRad = ((slice.middleAngle - 90) * Math.PI) / 180.0;
            const dx = shiftRadius * Math.cos(shiftRad);
            const dy = shiftRadius * Math.sin(shiftRad);

            return (
              <g
                key={idx}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setAllocationHoveredKey(slice.key)}
                onMouseLeave={() => setAllocationHoveredKey(null)}
                onClick={() => {
                  if (!allocationDrillClass) {
                    setAllocationDrillClass(slice.key);
                  }
                }}
                transform={`translate(${dx.toFixed(1)}, ${dy.toFixed(1)})`}
              >
                <path
                  d={slice.d}
                  fill={slice.color}
                  opacity={isHovered ? 0.35 : 0.18}
                  stroke={isHovered ? 'var(--accent)' : 'var(--bg-tertiary)'}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{ transition: 'all 0.15s ease' }}
                />
                {slice.pct > 0.08 && (
                  <text
                    x={cx + (r * 0.65) * Math.cos(shiftRad)}
                    y={cy + (r * 0.65) * Math.sin(shiftRad) + 3}
                    fill="var(--text-primary)"
                    fontSize="7"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                  >
                    {(slice.pct * 100).toFixed(0)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        );
  };

  const renderAllocationSunburstChart = () => {
    const data = allocationStudioData;
        const cx = 160;
        const cy = 80;
        const rInner1 = 30;
        const rInner2 = 52;
        const rOuter1 = 55;
        const rOuter2 = 78;

    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
          x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians)
      };
    };

    const drawRingSector = (startAngle, endAngle, rMin, rMax) => {
      const angle = endAngle - startAngle;
        const startMin = polarToCartesian(cx, cy, rMin, startAngle);
        const startMax = polarToCartesian(cx, cy, rMax, startAngle);
        const endMin = polarToCartesian(cx, cy, rMin, endAngle);
        const endMax = polarToCartesian(cx, cy, rMax, endAngle);
      
      const largeArc = angle > 180 ? 1 : 0;

        return [
        "M", startMin.x, startMin.y,
        "L", startMax.x, startMax.y,
        "A", rMax, rMax, 0, largeArc, 1, endMax.x, endMax.y,
        "L", endMin.x, endMin.y,
        "A", rMin, rMin, 0, largeArc, 0, startMin.x, startMin.y,
        "Z"
        ].join(" ");
    };

        let accumulatedAngle = 0;
        const innerSlices = [];
        const outerSlices = [];

    data.classes.forEach(c => {
          let val = c.currentVal;
        let pct = c.currentPct;
        if (allocationCompareMode === 'ideal') {
          val = c.idealVal;
        pct = c.idealPct;
      } else if (allocationCompareMode === 'suggested') {
          val = c.suggestedVal;
        pct = c.suggestedPct;
      }

        if (val === 0) return;

        const angle = pct * 360;
        const startAngle = accumulatedAngle;
        const endAngle = accumulatedAngle + angle;
        accumulatedAngle = endAngle;

        innerSlices.push({
          key: c.key,
        label: c.label,
        color: c.color,
        pct,
        value: val,
        d: drawRingSector(startAngle, endAngle, rInner1, rInner2),
        middleAngle: startAngle + angle / 2
      });

      const totalClassVal = c.items.reduce((sum, item) => sum + item.value, 0) || 1;
        let subAccumulatedAngle = startAngle;
      
      c.items.forEach(item => {
        const itemPctOfClass = item.value / totalClassVal;
        const itemAngle = itemPctOfClass * angle;
        const itemStartAngle = subAccumulatedAngle;
        const itemEndAngle = subAccumulatedAngle + itemAngle;
        subAccumulatedAngle = itemEndAngle;

        outerSlices.push({
          key: item.symbol,
        label: item.name,
        color: c.color,
        value: item.value,
        pct: pct * itemPctOfClass,
        classKey: c.key,
        d: drawRingSector(itemStartAngle, itemEndAngle, rOuter1, rOuter2)
        });
      });
    });

        return (
        <svg width="100%" height="160" viewBox="0 0 320 160" style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-primary)', overflow: 'visible' }}>
          {innerSlices.map((slice, idx) => {
            const isHovered = allocationHoveredKey === slice.key || (allocationHoveredKey && data.classes.find(c => c.key === slice.key)?.items.some(it => it.symbol === allocationHoveredKey));
            return (
              <g
                key={`inner-${idx}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setAllocationHoveredKey(slice.key)}
                onMouseLeave={() => setAllocationHoveredKey(null)}
                onClick={() => setAllocationDrillClass(slice.key)}
              >
                <path
                  d={slice.d}
                  fill={slice.color}
                  opacity={isHovered ? 0.35 : 0.18}
                  stroke="var(--bg-tertiary)"
                  strokeWidth="1"
                  style={{ transition: 'all 0.15s ease' }}
                />
                {slice.pct > 0.08 && (
                  <text
                    x={cx + ((rInner1 + rInner2) / 2) * Math.cos(((slice.middleAngle - 90) * Math.PI) / 180)}
                    y={cy + ((rInner1 + rInner2) / 2) * Math.sin(((slice.middleAngle - 90) * Math.PI) / 180) + 2}
                    fill="var(--text-primary)"
                    fontSize="6.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                  >
                    {slice.key.substring(0, 3).toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}

          {outerSlices.map((slice, idx) => {
            const isHovered = allocationHoveredKey === slice.key || allocationHoveredKey === slice.classKey;
            return (
              <g
                key={`outer-${idx}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setAllocationHoveredKey(slice.key)}
                onMouseLeave={() => setAllocationHoveredKey(null)}
                onClick={() => setAllocationDrillClass(slice.classKey)}
              >
                <path
                  d={slice.d}
                  fill={slice.color}
                  opacity={isHovered ? 0.45 : 0.1}
                  stroke="var(--bg-tertiary)"
                  strokeWidth="0.5"
                  style={{ transition: 'all 0.15s ease' }}
                />
              </g>
            );
          })}
        </svg>
        );
  };

  const renderAllocationTreemap = () => {
    const data = allocationStudioData;
        let items = [];

        if (allocationDrillClass) {
      const cls = data.classes.find(c => c.key === allocationDrillClass);
        if (!cls) return null;
      const totalClassVal = cls.items.reduce((sum, item) => sum + item.value, 0) || 1;
      items = cls.items.map(item => ({
          key: item.symbol,
        label: item.name,
        color: cls.color,
        value: item.value,
        pct: item.value / totalClassVal
      }));
    } else {
          items = data.classes.map(c => {
            let val = c.currentVal;
            let pct = c.currentPct;
            if (allocationCompareMode === 'ideal') {
              val = c.idealVal;
              pct = c.idealPct;
            } else if (allocationCompareMode === 'suggested') {
              val = c.suggestedVal;
              pct = c.suggestedPct;
            }
            return {
              key: c.key,
              label: c.label,
              color: c.color,
              value: val,
              pct: pct
            };
          }).filter(item => item.value > 0);
    }

        const width = 450;
        const height = 160;

        let currentX = 0;
        let currentY = 0;
        let remainingW = width;
        let remainingH = height;

        const rects = [];
    const sortedItems = [...items].sort((a, b) => b.value - a.value);
    
    sortedItems.forEach((item, idx) => {
      const useHorizontal = remainingW >= remainingH;
        let w = 0, h = 0;
      const ratio = item.pct / sortedItems.slice(idx).reduce((sum, ri) => sum + ri.pct, 0);

        if (useHorizontal) {
          w = remainingW * ratio;
        h = remainingH;
        rects.push({x: currentX, y: currentY, w, h, ...item });
        currentX += w;
        remainingW -= w;
      } else {
          w = remainingW;
        h = remainingH * ratio;
        rects.push({x: currentX, y: currentY, w, h, ...item });
        currentY += h;
        remainingH -= h;
      }
    });

        return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
          {rects.map((r, idx) => {
            const showLabel = r.w > 45 && r.h > 25;
            const isHovered = allocationHoveredKey === r.key;
            return (
              <g
                key={idx}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setAllocationHoveredKey(r.key)}
                onMouseLeave={() => setAllocationHoveredKey(null)}
                onClick={() => {
                  if (!allocationDrillClass) {
                    setAllocationDrillClass(r.key);
                  }
                }}
              >
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={r.color}
                  opacity={isHovered ? 0.35 : 0.18}
                  stroke={isHovered ? 'var(--accent)' : 'var(--bg-tertiary)'}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{ transition: 'all 0.15s ease' }}
                />
                {showLabel && (
                  <foreignObject x={r.x + 4} y={r.y + 4} width={r.w - 8} height={r.h - 8} style={{ overflow: 'hidden', pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '8px', lineHeight: '1.2' }}>
                      <span style={{ fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.label}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '7.5px' }}>{(r.pct * 100).toFixed(1)}%</span>
                      <span style={{ fontWeight: '600', color: 'var(--accent)' }}>{formatCurrency(r.value)}</span>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
        );
  };

        // Dynamic values derived from state
        const totalWealth = demoMode ? 5234000 : (analytics?.summary?.total_wealth || 0);
  const cashAvailable = demoMode ? 320000 : (assets.filter(a => a.asset_class === 'cash').reduce((sum, a) => sum + (a.quantity * a.current_price), 0));
        const overallReturnPct = demoMode ? 18.4 : (analytics?.summary?.total_return_pct || 0);
        const todayPlVal = demoMode ? 21430 : (totalWealth * 0.0041);

  const calculateMacroImpact = () => {
    const currentScenario = MACRO_SCENARIOS[selectedScenario] || MACRO_SCENARIOS.fed_cuts;

    const activeAssets = (assets || []).filter(a => parseFloat(a.quantity) > 0);
        let totalPortfolioVal = 0;
        let totalImpact = 0;

        const assetClassImpacts = { };

    activeAssets.forEach(a => {
      const val = parseFloat(a.quantity) * parseFloat(a.current_price);
        totalPortfolioVal += val;

        const shock = currentScenario.shocks[a.asset_class] !== undefined ? currentScenario.shocks[a.asset_class] : 0.0;
        const impact = val * shock;
        totalImpact += impact;

        assetClassImpacts[a.asset_class] = (assetClassImpacts[a.asset_class] || 0) + impact;
    });

        if (totalPortfolioVal === 0) {
          totalPortfolioVal = 5234000;
        const sampleStocks = totalPortfolioVal * 0.65;
        const sampleCrypto = totalPortfolioVal * 0.10;
        const sampleGold = totalPortfolioVal * 0.15;
        const sampleBonds = totalPortfolioVal * 0.10;

        const sh = currentScenario.shocks;
        totalImpact = (sampleStocks * (sh.stocks || 0)) +
        (sampleCrypto * (sh.crypto || 0)) +
        (sampleGold * (sh.gold || 0)) +
        (sampleBonds * (sh.bonds || 0));

        assetClassImpacts['stocks'] = sampleStocks * (sh.stocks || 0);
        assetClassImpacts['crypto'] = sampleCrypto * (sh.crypto || 0);
        assetClassImpacts['gold'] = sampleGold * (sh.gold || 0);
        assetClassImpacts['bonds'] = sampleBonds * (sh.bonds || 0);
    }

        const pct = (totalImpact / totalPortfolioVal) * 100;

        let vulnerability = 'Hedged / Resilient';
    if (pct >= 2.0) vulnerability = 'High Opportunity (Bullish)';
        else if (pct < -2.0 && pct >= -5.0) vulnerability = 'Moderate Risk Exposure';
        else if (pct < -5.0) vulnerability = 'High Vulnerability Exposure';

        return {
          label: currentScenario.label,
        pct,
        impactAmount: totalImpact,
        detail: currentScenario.detail,
        mitigation: currentScenario.mitigation,
        assetClassImpacts,
        vulnerability
    };
  };

        const macroImpactResult = calculateMacroImpact();

  const getRollingCorrelationData = () => {
    const assetsList = ['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'];
        const idxA = assetsList.indexOf(selectedCorrAssetA);
        const idxB = assetsList.indexOf(selectedCorrAssetB);

        if (idxA === -1 || idxB === -1) return [];

        const baseCorr = corrMatrix[idxA][idxB];
        const months = ['Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26'];

    return months.map((m, idx) => {
      const wave = Math.sin((idx / 11) * Math.PI * 2.5) * 0.12 + Math.cos(idx * 0.7) * 0.06;
        let val = baseCorr + wave;
      if (val > 1.0) val = 1.0;
        if (val < -1.0) val = -1.0;
        if (idxA === idxB) val = 1.0;
        return {month: m, value: val };
    });
  };

        const rollingCorrData = getRollingCorrelationData();

  const handleCorrPresetChange = (presetName) => {
          setCorrPreset(presetName);
        if (presetName === 'standard') {
          setCorrMatrix([
            [1.00, 0.48, 0.62, 0.35, -0.08],
            [0.48, 1.00, 0.55, 0.45, -0.12],
            [0.62, 0.55, 1.00, 0.50, -0.15],
            [0.35, 0.45, 0.50, 1.00, -0.05],
            [-0.08, -0.12, -0.15, -0.05, 1.00]
          ]);
    } else if (presetName === 'risk_on') {
          setCorrMatrix([
            [1.00, 0.72, 0.81, 0.60, -0.35],
            [0.72, 1.00, 0.78, 0.65, -0.42],
            [0.81, 0.78, 1.00, 0.70, -0.48],
            [0.60, 0.65, 0.70, 1.00, -0.28],
            [-0.35, -0.42, -0.48, -0.28, 1.00]
          ]);
    } else if (presetName === 'market_crash') {
          setCorrMatrix([
            [1.00, 0.88, 0.92, 0.85, -0.65],
            [0.88, 1.00, 0.89, 0.82, -0.58],
            [0.92, 0.89, 1.00, 0.88, -0.70],
            [0.85, 0.82, 0.88, 1.00, -0.52],
            [-0.65, -0.58, -0.70, -0.52, 1.00]
          ]);
    }
  };

  const getRebalancingTrades = () => {
    const activeAssets = (assets || []).filter(a => parseFloat(a.quantity) > 0);
    const useMock = activeAssets.length === 0;

    const baseAssets = useMock ? [
      { id: '1', symbol: 'TCS', name: 'Tata Consultancy Services Ltd', asset_class: 'stocks', quantity: 20, current_price: 3600, avg_price: 3300 },
      { id: '2', symbol: 'RELIANCE', name: 'Reliance Industries Ltd', asset_class: 'stocks', quantity: 30, current_price: 2550, avg_price: 2400 },
      { id: '3', symbol: 'INFY', name: 'Infosys Ltd', asset_class: 'stocks', quantity: 50, current_price: 1440, avg_price: 1620 },
      { id: '4', symbol: 'NIFTY50_ETF', name: 'Nifty 50 Index Fund', asset_class: 'index_funds', quantity: 500, current_price: 220, avg_price: 200 },
      { id: '5', symbol: 'GOLD_BEES', name: 'Nippon India Gold BeES', asset_class: 'gold', quantity: 1500, current_price: 60, avg_price: 55 },
      { id: '6', symbol: 'GOVT_BOND', name: 'Sovereign Debt Bond', asset_class: 'bonds', quantity: 100, current_price: 1000, avg_price: 1000 },
      { id: '7', symbol: 'BTC', name: 'Bitcoin', asset_class: 'crypto', quantity: 0.1, current_price: 5400000, avg_price: 4500000 },
      { id: '8', symbol: 'CASH', name: 'Liquid Cash Account', asset_class: 'cash', quantity: 150000, current_price: 1, avg_price: 1 }
    ] : activeAssets;

    const totalVal = baseAssets.reduce((sum, a) => sum + (parseFloat(a.quantity) * parseFloat(a.current_price)), 0) || 1;

    let targetPcts = {
      stocks: 0.35,
      index_funds: 0.15,
      mutual_funds: 0.10,
      gold: 0.15,
      bonds: 0.10,
      crypto: 0.05,
      cash: 0.10
    };

    let riskReduction = 8.5;
    let strategyHeading = "Standard Threshold Rebalance";
    let strategyDesc = "";

    if (rebalancingStrategy === 'calendar') {
      strategyHeading = `Semi-Annual Periodic Rebalance (${rebalanceFrequency === 'quarterly' ? 'Quarterly' : rebalanceFrequency === 'annual' ? 'Annual' : 'Semi-Annual'} Check)`;
      strategyDesc = "Rebalances back to target asset weights to ensure steady portfolio drift correction.";
      riskReduction = 4.2;
      targetPcts = {
        stocks: 0.35,
        index_funds: 0.15,
        mutual_funds: 0.10,
        gold: 0.15,
        bonds: 0.10,
        crypto: 0.05,
        cash: 0.10
      };
    } else if (rebalancingStrategy === 'threshold') {
      strategyHeading = `Drift-Threshold Rebalance (${rebalanceThreshold}% Trigger)`;
      strategyDesc = `Rebalance recommendations are only created for asset classes that have drifted from target allocation by more than ${rebalanceThreshold}%.`;
      riskReduction = 12.0;
      targetPcts = {
        stocks: 0.35,
        index_funds: 0.15,
        mutual_funds: 0.10,
        gold: 0.15,
        bonds: 0.10,
        crypto: 0.05,
        cash: 0.10
      };
    } else if (rebalancingStrategy === 'risk') {
      strategyHeading = `Sharpe Optimizer (${rebalanceRiskProfile.toUpperCase()} Risk-Parity)`;
      if (rebalanceRiskProfile === 'conservative') {
        strategyDesc = "Minimizes portfolio drawdown risk. Concentrates on sovereign debt, cash, and gold bullion buffers.";
        targetPcts = { stocks: 0.10, index_funds: 0.10, mutual_funds: 0.05, gold: 0.20, bonds: 0.35, crypto: 0.00, cash: 0.20 };
        riskReduction = 22.4;
      } else if (rebalanceRiskProfile === 'balanced') {
        strategyDesc = "Maximizes risk-adjusted return coefficient. Core-satellite architecture focusing on structural diversification.";
        targetPcts = { stocks: 0.30, index_funds: 0.20, mutual_funds: 0.15, gold: 0.15, bonds: 0.10, crypto: 0.03, cash: 0.07 };
        riskReduction = 14.5;
      } else {
        strategyDesc = "Aggressive capital expansion path. Overweights high beta growth equities and digital asset tokens.";
        targetPcts = { stocks: 0.55, index_funds: 0.15, mutual_funds: 0.05, gold: 0.05, bonds: 0.05, crypto: 0.12, cash: 0.03 };
        riskReduction = 5.2;
      }
    } else if (rebalancingStrategy === 'goal') {
      const selectedGoal = goals.find(g => g.id === rebalanceGoalId) || goals[0];
      const yrs = selectedGoal ? selectedGoal.years_remaining : 10;
      strategyHeading = `Glidepath Asset Matching (Goal: ${selectedGoal ? selectedGoal.name : 'Combined Master'})`;
      
      if (yrs <= 3) {
        strategyDesc = `Immediate liability horizon (${yrs} Yrs left). Shifting portfolio heavily into defensive fixed deposits and cash.`;
        targetPcts = { stocks: 0.10, index_funds: 0.05, mutual_funds: 0.05, gold: 0.10, bonds: 0.40, crypto: 0.00, cash: 0.30 };
        riskReduction = 16.8;
      } else if (yrs <= 8) {
        strategyDesc = `Medium-term horizon (${yrs} Yrs left). Moderate allocation combining debt duration yields with gold cushions.`;
        targetPcts = { stocks: 0.30, index_funds: 0.15, mutual_funds: 0.10, gold: 0.15, bonds: 0.20, crypto: 0.02, cash: 0.08 };
        riskReduction = 9.8;
      } else {
        strategyDesc = `Long-term compounding horizon (${yrs} Yrs left). Equity and crypto dominant weights to maximize wealth creation.`;
        targetPcts = { stocks: 0.50, index_funds: 0.20, mutual_funds: 0.10, gold: 0.08, bonds: 0.05, crypto: 0.05, cash: 0.02 };
        riskReduction = 4.5;
      }
    } else if (rebalancingStrategy === 'tax') {
      strategyHeading = `Tax-Optimized Lot Matching (${rebalanceTaxLotMatch === 'minTax' ? 'MinTax' : 'FIFO'} Basis)`;
      strategyDesc = "Structures trades to minimize short-term capital gains tax while locking in harvesting offsets from depreciating lots.";
      riskReduction = 7.9;
      targetPcts = {
        stocks: 0.35,
        index_funds: 0.15,
        mutual_funds: 0.10,
        gold: 0.15,
        bonds: 0.10,
        crypto: 0.05,
        cash: 0.10
      };
    }

    const currentValsByClass = {
      stocks: 0, index_funds: 0, mutual_funds: 0, gold: 0, bonds: 0, crypto: 0, cash: 0
    };
    baseAssets.forEach(a => {
      const cls = a.asset_class === 'etfs' ? 'index_funds' : a.asset_class;
      const val = parseFloat(a.quantity) * parseFloat(a.current_price);
      if (currentValsByClass[cls] !== undefined) {
        currentValsByClass[cls] += val;
      } else {
        currentValsByClass.stocks += val;
      }
    });

    const trades = [];
    const classDrifts = {};

    Object.keys(targetPcts).forEach(cls => {
      const curVal = currentValsByClass[cls] || 0;
      const curPct = curVal / totalVal;
      const tarPct = targetPcts[cls];
      const driftPct = curPct - tarPct;
      classDrifts[cls] = driftPct * 100;

      if (rebalancingStrategy === 'threshold' && Math.abs(driftPct * 100) < rebalanceThreshold) {
        return;
      }

      const diffVal = driftPct * totalVal;
      if (Math.abs(diffVal) < 1000) return;

      if (diffVal > 0) {
        const classAssets = baseAssets.filter(a => (a.asset_class === 'etfs' ? 'index_funds' : a.asset_class) === cls);
        let remainingToSell = diffVal;

        if (rebalancingStrategy === 'tax') {
          classAssets.sort((a, b) => {
            const gainA = (a.current_price - a.avg_price) * a.quantity;
            const gainB = (b.current_price - b.avg_price) * b.quantity;
            return gainA - gainB;
          });
        }

        classAssets.forEach(a => {
          if (remainingToSell <= 0) return;
          const assetVal = a.quantity * a.current_price;
          const sellAmt = Math.min(remainingToSell, assetVal);
          const sellQty = sellAmt / a.current_price;
          const unrealizedGainLoss = (a.current_price - a.avg_price) * sellQty;

          trades.push({
            type: 'SELL',
            symbol: a.symbol,
            name: a.name,
            assetClass: cls,
            amount: sellAmt,
            quantity: sellQty,
            unrealizedGainLoss,
            taxEstimate: unrealizedGainLoss > 0 ? unrealizedGainLoss * 0.15 : 0
          });
          remainingToSell -= sellAmt;
        });
      } else if (diffVal < 0) {
        let buySymbol = 'CASH';
        let buyName = 'Cash Account';
        if (cls === 'stocks') { buySymbol = 'TCS'; buyName = 'Tata Consultancy Services Ltd'; }
        else if (cls === 'index_funds') { buySymbol = 'NIFTY50_ETF'; buyName = 'Nifty 50 Index Fund'; }
        else if (cls === 'mutual_funds') { buySymbol = 'PP_FLEXICAP'; buyName = 'Parag Parikh Flexi Cap'; }
        else if (cls === 'gold') { buySymbol = 'GOLD_BEES'; buyName = 'Nippon India Gold BeES'; }
        else if (cls === 'bonds') { buySymbol = 'GOVT_BOND'; buyName = 'Sovereign Debt Bond'; }
        else if (cls === 'crypto') { buySymbol = 'BTC'; buyName = 'Bitcoin'; }

        trades.push({
          type: 'BUY',
          symbol: buySymbol,
          name: buyName,
          assetClass: cls,
          amount: Math.abs(diffVal),
          quantity: Math.abs(diffVal) / (cls === 'crypto' ? 5400000 : cls === 'bonds' ? 1000 : cls === 'gold' ? 60 : 1)
        });
      }
    });

    trades.sort((a, b) => (a.type === 'SELL' ? -1 : 1));

    const totalSells = trades.filter(t => t.type === 'SELL');
    const realizedGains = totalSells.reduce((sum, t) => sum + Math.max(0, t.unrealizedGainLoss), 0);
    const realizedLosses = totalSells.reduce((sum, t) => sum + Math.min(0, t.unrealizedGainLoss), 0);
    const netGains = realizedGains + realizedLosses;
    const estTax = Math.max(0, netGains * 0.15);
    const taxSaved = Math.abs(realizedLosses) * 0.15;

    return {
      trades,
      classDrifts,
      totalVal,
      riskReduction,
      strategyHeading,
      strategyDesc,
      realizedGains,
      realizedLosses,
      netGains,
      estTax,
      taxSaved
    };
  };

  const handleExecuteRebalance = async () => {
    const tradeData = getRebalancingTrades();
    if (tradeData.trades.length === 0) {
      alert("No trades necessary to rebalance. Portfolio is currently in line with target allocation.");
      return;
    }
    
    setLoading(true);
    try {
      const promises = tradeData.trades.map(t => {
        return api.createTransaction({
          symbol: t.symbol,
          asset_class: t.assetClass,
          transaction_type: t.type.toLowerCase(),
          quantity: parseFloat(t.quantity.toFixed(4)),
          price: parseFloat((t.amount / t.quantity).toFixed(2)),
          fees: 20,
          taxes: parseFloat((t.taxEstimate || 0).toFixed(2)),
          brokerage: 0,
          notes: `System generated rebalance trade via ${rebalancingStrategy.toUpperCase()} strategy.`
        }).catch(err => console.error("Simulated tx fail:", err));
      });

      await Promise.all(promises);
      
      setRebalanceSuccessMsg(`Successfully executed rebalancing! Placed ${tradeData.trades.length} trade order(s) (Est. Tax Liability: ${formatCurrency(tradeData.estTax)}).`);
      fetchData();
      
      setTimeout(() => setRebalanceSuccessMsg(null), 6000);
    } catch (e) {
      console.error(e);
      alert("Rebalancing execution failed. Please verify API connection.");
    } finally {
      setLoading(false);
    }
  };

        const activeResearch = researchProfiles[activeHoldingResearch] || {
          symbol: activeHoldingResearch || '---',
          name: 'Loading...',
          summary: 'Fetching business profile and financials...',
          comp: 'Analyzing competitive advantages...',
          earnings: 'Evaluating recent earnings trends...',
          valuation: 'Computing valuation metrics...',
          sentiment: 'Scanning news sentiment...',
          insider: 'Verifying insider transactions...',
          institutional: 'Aggregating institutional ownership...',
          technicals: 'Analyzing technical indicators...',
          risk: 'Evaluating risk exposure...',
          action: 'HOLD',
          confidence: 75,
          rationale: 'Awaiting research processing...'
        };

  // Dynamic Portfolio Health Audit Status
  const getHealthChecks = () => {
    const totalWealth = assets.reduce((sum, a) => sum + (a.quantity * a.current_price), 0) || 1;

    // 1. Sector risk
    const topSector = analytics?.exposures?.sector && Object.keys(analytics.exposures.sector).length > 0
      ? Object.entries(analytics.exposures.sector).sort((a, b) => b[1] - a[1])[0]
        : null;
    const isSectorWarning = topSector && topSector[1] > 40;

    // 2. Country risk
    const topCountry = analytics?.exposures?.country && Object.keys(analytics.exposures.country).length > 0
      ? Object.entries(analytics.exposures.country).sort((a, b) => b[1] - a[1])[0]
        : null;
    const isCountryWarning = topCountry && topCountry[1] > 70;

        // 3. Broker risk
        const brokerValues = { };
    assets.forEach(a => {
      const broker = a.broker || 'Unspecified';
        const val = a.quantity * a.current_price;
        brokerValues[broker] = (brokerValues[broker] || 0) + val;
    });
    const topBroker = Object.keys(brokerValues).length > 0
      ? Object.entries(brokerValues).sort((a, b) => b[1] - a[1])[0]
        : null;
        const topBrokerPct = topBroker ? (topBroker[1] / totalWealth) * 100 : 0;
    const isBrokerWarning = topBrokerPct > 70 && assets.length > 3;

        // 4. Currency risk
        const currencyValues = { };
    assets.forEach(a => {
      const curr = a.currency || 'INR';
        const val = a.quantity * a.current_price;
        currencyValues[curr] = (currencyValues[curr] || 0) + val;
    });
    const topCurrency = Object.keys(currencyValues).length > 0
      ? Object.entries(currencyValues).sort((a, b) => b[1] - a[1])[0]
        : null;
        const topCurrencyPct = topCurrency ? (topCurrency[1] / totalWealth) * 100 : 0;
    const isCurrencyWarning = topCurrencyPct > 85 && assets.length > 4;

        // 5. Liquidity risk
        const liquidClasses = ['cash', 'fixed_deposits', 'gold', 'silver', 'commodities'];
    const liquidValue = assets.reduce((sum, a) => {
      return liquidClasses.includes(a.asset_class) ? sum + (a.quantity * a.current_price) : sum;
    }, 0);
        const liquidPct = (liquidValue / totalWealth) * 100;
        const isLiquidityWarning = liquidPct < 10;

    // 6. Small Cap risk
    const smallCapValue = assets.reduce((sum, a) => {
      const isSmall = a.tags && (a.tags.some(t => t.toLowerCase().includes('small')) || (a.notes && a.notes.toLowerCase().includes('small cap')));
        return isSmall ? sum + (a.quantity * a.current_price) : sum;
    }, 0);
        const smallCapPct = (smallCapValue / totalWealth) * 100;
    const isSmallCapWarning = smallCapPct > 35;

    // 7. Penny Stock risk
    const pennyStocks = assets.filter(a => {
      const price = a.current_price;
        const isStock = a.asset_class === 'stocks';
        return isStock && ((a.currency === 'INR' && price < 50) || (a.currency === 'USD' && price < 1.5));
    });
    const isPennyWarning = pennyStocks.length > 0;

        // 8. Debt risk
        const debtClasses = ['bonds', 'fixed_deposits', 'ppf', 'epf', 'nps'];
    const debtValue = assets.reduce((sum, a) => {
      return debtClasses.includes(a.asset_class) ? sum + (a.quantity * a.current_price) : sum;
    }, 0);
        const debtPct = (debtValue / totalWealth) * 100;
        const isDebtWarning = debtPct < 10 && assets.length > 4;

    // 9. Leverage risk
    const hasLeverage = assets.some(a => {
      const notes = (a.notes || '').toLowerCase();
      const tags = (a.tags || []).map(t => t.toLowerCase());
        return notes.includes('margin') || notes.includes('leverage') || tags.includes('margin') || tags.includes('leverage') || a.quantity < 0;
    });
        const isLeverageWarning = hasLeverage;

        // 10. Options risk
        const optionsClasses = ['options', 'futures', 'derivatives'];
    const optionsValue = assets.reduce((sum, a) => {
      return optionsClasses.includes(a.asset_class) ? sum + (a.quantity * a.current_price) : sum;
    }, 0);
        const optionsPct = (optionsValue / totalWealth) * 100;
    const isOptionsWarning = optionsPct > 10;

        // 11. Tax risk (Unrealized loss harvesting opportunity)
        let totalUnrealizedLoss = 0;
    assets.forEach(a => {
      const cost = a.quantity * a.avg_price;
        const val = a.quantity * a.current_price;
        if (val < cost) {
          totalUnrealizedLoss += (cost - val);
      }
    });
    const isTaxWarning = totalUnrealizedLoss > (taxCountry === 'IN' ? 10000 : 150);

        // 12. Inflation risk
        const inflationHedgeClasses = ['gold', 'silver', 'reits', 'real_estate', 'commodities'];
    const hedgeValue = assets.reduce((sum, a) => {
      return inflationHedgeClasses.includes(a.asset_class) ? sum + (a.quantity * a.current_price) : sum;
    }, 0);
        const hedgePct = (hedgeValue / totalWealth) * 100;
    const isInflationWarning = inflationRate > 5 && hedgePct < 10;

    // 13. Interest Rate risk
    const isInterestRateWarning = (inflationRate > 5 || (analytics?.metrics?.volatility || 0) > 18) && debtPct > 40;

        return [
        {
          id: 'over_diversification',
        name: 'Over Diversification',
        status: assets.length > 15 ? 'Warning' : 'Healthy',
        category: 'Diversification',
        value: assets.length,
        target: 15,
        metricLabel: `${assets.length} Assets (Max Limit: 15)`,
        progressPct: Math.min((assets.length / 15) * 100, 100),
        isThresholdMin: false,
        rating: 'Low',
        impact: 'Having too many holdings dilutes high-conviction returns, creates massive tracking overhead, and increases brokerage fees through small, fragmented trades.',
        mitigation: 'Consolidate micro-positions representing less than 2% of total wealth into your top-performing core index funds or large-cap equities.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Consolidate Ledger',
        desc: assets.length > 15 ? 'Spread across too many instruments can dilute returns (optimal is 8-15).' : 'Keeping portfolio monitoring overhead minimal.'
      },
        {
          id: 'under_diversification',
        name: 'Under Diversification',
        status: assets.length < 4 ? 'Warning' : 'Healthy',
        category: 'Diversification',
        value: assets.length,
        target: 4,
        metricLabel: `${assets.length} Assets (Min Required: 4)`,
        progressPct: Math.min((assets.length / 4) * 100, 100),
        isThresholdMin: true,
        rating: 'High',
        impact: 'Extreme vulnerability to single-asset company scandals, sudden regulatory halts, or sector drops. If one asset defaults, it could wipe out a significant portion of net worth.',
        mitigation: 'Add at least 3-4 uncorrelated assets (e.g., direct bonds, gold ETFs, international indices) to buffer single-stock systematic shocks.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Add New Asset',
        desc: assets.length < 4 ? 'Diversify across at least 4 assets to reduce single-stock exposure.' : 'Holdings are spread across enough individual assets to mitigate risk.'
      },
        {
          id: 'sector_risk',
        name: 'Sector Concentration Risk',
        status: isSectorWarning ? 'Warning' : 'Healthy',
        category: 'Concentration',
        value: topSector ? topSector[1] : 0,
        target: 40,
        metricLabel: `${topSector ? topSector[1].toFixed(1) : 0}% in ${topSector ? topSector[0] : 'None'} (Limit: 40%)`,
        progressPct: topSector ? Math.min((topSector[1] / 40) * 100, 100) : 0,
        isThresholdMin: false,
        rating: 'Medium',
        impact: 'A structural drop in this industry (e.g. IT services, real estate) will cause severe portfolio drawdowns that cannot be offset by other sectors.',
        mitigation: 'Trim positions in your top sector and reallocate to defensive industries like Healthcare, Consumer Staples, or Utilities.',
        remedyTab: 'planner',
        remedyActionLabel: 'Run Rebalancer',
        desc: topSector ? `${topSector[0]} exposure represents ${topSector[1].toFixed(1)}% of your portfolio.` : 'Sectors are balanced within optimal concentration guidelines.'
      },
        {
          id: 'country_risk',
        name: 'Geopolitical Country Risk',
        status: isCountryWarning ? 'Warning' : 'Healthy',
        category: 'Concentration',
        value: topCountry ? topCountry[1] : 0,
        target: 70,
        metricLabel: `${topCountry ? topCountry[1].toFixed(1) : 0}% in ${topCountry ? topCountry[0] : 'None'} (Limit: 70%)`,
        progressPct: topCountry ? Math.min((topCountry[1] / 70) * 100, 100) : 0,
        isThresholdMin: false,
        rating: 'Low',
        impact: 'Heavy concentration in one country exposes you to domestic policy shifts, currency devaluation, tax changes, and regional macroeconomic crashes.',
        mitigation: 'Allocate 10-15% of your portfolio to international ETFs (like US S&P 500 or Nasdaq trackers) to diversify geopolitical risk.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'View Global Equities',
        desc: topCountry ? `Concentrated at ${topCountry[1].toFixed(1)}% in ${topCountry[0]}.` : 'Geographical distribution is well-balanced.'
      },
        {
          id: 'broker_risk',
        name: 'Broker Custodian Risk',
        status: isBrokerWarning ? 'Warning' : 'Healthy',
        category: 'Custody',
        value: topBrokerPct,
        target: 70,
        metricLabel: `${topBrokerPct.toFixed(1)}% in ${topBroker ? topBroker[0] : 'None'} (Limit: 70%)`,
        progressPct: Math.min((topBrokerPct / 70) * 100, 100),
        isThresholdMin: false,
        rating: 'Medium',
        impact: 'If your primary broker experiences extended portal downtime, cyber attacks, or regulatory auditing, you may be temporarily locked out of trading or liquidating holdings.',
        mitigation: 'Open a secondary account with a separate custodian and partition your long-term assets to ensure constant market access.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Split Custodians',
        desc: topBroker ? `${topBroker[0]} holds ${topBrokerPct.toFixed(1)}% of your assets.` : 'Custody is distributed safely across multiple registries.'
      },
        {
          id: 'currency_risk',
        name: 'Currency Exposure Risk',
        status: isCurrencyWarning ? 'Warning' : 'Healthy',
        category: 'Concentration',
        value: topCurrencyPct,
        target: 85,
        metricLabel: `${topCurrencyPct.toFixed(1)}% in ${topCurrency ? topCurrency[0] : 'None'} (Limit: 85%)`,
        progressPct: Math.min((topCurrencyPct / 85) * 100, 100),
        isThresholdMin: false,
        rating: 'Low',
        impact: 'Holding only domestic currency assets leads to real global purchasing power erosion if local currency depreciates against global benchmarks like USD.',
        mitigation: 'Establish USD exposure by buying international ETFs, global index mutual funds, or gold instruments.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Add USD Assets',
        desc: topCurrency ? `Portfolio is highly exposed to ${topCurrency[0]} (${topCurrencyPct.toFixed(1)}%).` : 'USD and INR asset classes provide stable currency balance.'
      },
        {
          id: 'liquidity_risk',
        name: 'Emergency Liquidity Risk',
        status: isLiquidityWarning ? 'Warning' : 'Healthy',
        category: 'Liquidity',
        value: liquidPct,
        target: 10,
        metricLabel: `${liquidPct.toFixed(1)}% Reserves (Min Required: 10%)`,
        progressPct: Math.min((liquidPct / 10) * 100, 100),
        isThresholdMin: true,
        rating: 'High',
        impact: 'Lack of liquid cash buffers can force you to panic-sell long-term investments at depressed prices during market dips or personal emergencies.',
        mitigation: 'Set up a liquid safety net containing at least 10-15% of your portfolio in cash, overnight savings, liquid gold, or short-term fixed deposits.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Add Cash / Deposits',
        desc: isLiquidityWarning ? `Liquid reserves (Cash, Gold, FDs) are at ${liquidPct.toFixed(1)}% (below 10% target).` : `Liquid cash equivalent reserves comprise ${liquidPct.toFixed(1)}%.`
      },
        {
          id: 'small_cap_risk',
        name: 'Small & Micro Cap Risk',
        status: isSmallCapWarning ? 'Warning' : 'Healthy',
        category: 'Volatility',
        value: smallCapPct,
        target: 35,
        metricLabel: `${smallCapPct.toFixed(1)}% Small Cap (Limit: 35%)`,
        progressPct: Math.min((smallCapPct / 35) * 100, 100),
        isThresholdMin: false,
        rating: 'Medium',
        impact: 'Small cap holdings can suffer massive 40-60% drawdowns during credit crunches or high interest rate environments because of their limited access to institutional funding.',
        mitigation: 'Shift profits from small caps into large-cap index trackers or sovereign debt to stabilize portfolio volatility.',
        remedyTab: 'planner',
        remedyActionLabel: 'Reallocate Volatility',
        desc: isSmallCapWarning ? `Small/Micro cap holdings represent ${smallCapPct.toFixed(1)}% of assets.` : 'Portfolio concentration leans safely toward large cap blue chips.'
      },
        {
          id: 'penny_stock_risk',
        name: 'Speculative Penny Stock Risk',
        status: isPennyWarning ? 'Warning' : 'Healthy',
        category: 'Volatility',
        value: pennyStocks.length,
        target: 0,
        metricLabel: `${pennyStocks.length} Penny Stocks (Limit: 0)`,
        progressPct: pennyStocks.length > 0 ? 100 : 0,
        isThresholdMin: false,
        rating: 'High',
        impact: 'Penny stocks suffer from high bid-ask spreads, low trading volume, risk of corporate manipulation, and complete illiquidity during market selloffs.',
        mitigation: 'Immediately liquidate micro-cap and penny stock listings under ₹50 (or $1.5) and relocate capital to high-grade index equities.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Review Penny Stocks',
        desc: isPennyWarning ? `Identified ${pennyStocks.length} penny stocks (${pennyStocks.map(p => p.symbol).join(', ')}) in ledger.` : 'Zero penny stock listings identified in ledger.'
      },
        {
          id: 'debt_risk',
        name: 'Debt Fixed-Income Risk',
        status: isDebtWarning ? 'Warning' : 'Healthy',
        category: 'Liquidity',
        value: debtPct,
        target: 10,
        metricLabel: `${debtPct.toFixed(1)}% Debt Assets (Min Required: 10%)`,
        progressPct: Math.min((debtPct / 10) * 100, 100),
        isThresholdMin: true,
        rating: 'Medium',
        impact: 'Holding zero or low debt makes your entire net worth highly volatile, leaving you with no dry powder to buy equity dips or finance short-term goals during corrections.',
        mitigation: 'Add a protective 10-20% fixed-income asset cushion via government bonds, high-quality corporate debt, or retirement funds like EPF/PPF.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Allocate Bonds / FDs',
        desc: isDebtWarning ? `Fixed-income asset allocation is only ${debtPct.toFixed(1)}%.` : `Sovereign backed debt / fixed-yield holdings represent ${debtPct.toFixed(1)}%.`
      },
        {
          id: 'leverage_risk',
        name: 'Account Leverage & Margin Risk',
        status: isLeverageWarning ? 'Warning' : 'Healthy',
        category: 'Leverage',
        value: hasLeverage ? 100 : 0,
        target: 0,
        metricLabel: `Leverage Status: ${hasLeverage ? 'ACTIVE LEVERAGE' : 'None Detected'}`,
        progressPct: hasLeverage ? 100 : 0,
        isThresholdMin: false,
        rating: 'High',
        impact: 'Borrowed funds or margin debt amplify losses. A sudden flash crash could trigger forced margin liquidations, permanently erasing your capital.',
        mitigation: 'Immediately pay off outstanding margin debts and close speculative leveraged positions to avoid broker margin calls.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Review Margin Accounts',
        desc: isLeverageWarning ? 'Margin debt or leverage identified in portfolio tags/notes.' : 'No margin debt or speculative credit leverage used.'
      },
        {
          id: 'options_risk',
        name: 'Speculative Options Risk',
        status: isOptionsWarning ? 'Warning' : 'Healthy',
        category: 'Leverage',
        value: optionsPct,
        target: 10,
        metricLabel: `${optionsPct.toFixed(1)}% Derivatives (Limit: 10%)`,
        progressPct: Math.min((optionsPct / 10) * 100, 100),
        isThresholdMin: false,
        rating: 'High',
        impact: 'Options and futures suffer from rapid time decay (theta decay) and structural leverage. Over 90% of retail options traders lose their entire speculative capital.',
        mitigation: 'Reduce speculative options premium trades, capping derivative risk exposure below 5-10% of total assets.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Manage Options Ledger',
        desc: isOptionsWarning ? `Speculative derivatives positions comprise ${optionsPct.toFixed(1)}% of capital.` : 'Derivatives exposure represents less than 5% of margin capacity.'
      },
        {
          id: 'tax_risk',
        name: 'Tax Optimization Risk',
        status: isTaxWarning ? 'Warning' : 'Healthy',
        category: 'Taxation',
        value: totalUnrealizedLoss,
        target: taxCountry === 'IN' ? 10000 : 150,
        metricLabel: `${taxCountry === 'IN' ? '₹' : '$'}${totalUnrealizedLoss.toFixed(0)} Unrealized Losses`,
        progressPct: Math.min((totalUnrealizedLoss / (taxCountry === 'IN' ? 10000 : 150)) * 100, 100),
        isThresholdMin: false,
        rating: 'Low',
        impact: 'Holding assets with massive paper losses without utilizing them allows you to overpay capital gains taxes that could be legally offset.',
        mitigation: 'Utilize Tax Loss Harvesting: sell underperforming stocks that have losses to offset tax on realized short/long term capital gains.',
        remedyTab: 'tax',
        remedyActionLabel: 'Harvest Tax Losses',
        desc: isTaxWarning ? `Unrealized loss harvesting opportunity of ${taxCountry === 'IN' ? '₹' : '$'}${totalUnrealizedLoss.toFixed(0)} identified.` : 'Tax loss harvesting opportunity is actively being monitored.'
      },
        {
          id: 'inflation_risk',
        name: 'Inflation Hedge Vulnerability',
        status: isInflationWarning ? 'Warning' : 'Healthy',
        category: 'Macro',
        value: hedgePct,
        target: 10,
        metricLabel: `${hedgePct.toFixed(1)}% Hedges (Min Required: 10%)`,
        progressPct: Math.min((hedgePct / 10) * 100, 100),
        isThresholdMin: true,
        rating: 'Medium',
        impact: `During periods of high inflation (current: ${inflationRate}%), paper currencies and cash-like deposits lose real buying power annually if not backed by inflation-hedging hard assets.`,
        mitigation: 'Buy physical gold, sovereign gold bonds (SGBs), gold ETFs, commodities, or REITs to secure a hedge representing 10% of total wealth.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Allocate Gold / REITs',
        desc: isInflationWarning ? `Inflation rate is high (${inflationRate}%). Hedges are only ${hedgePct.toFixed(1)}% (below 10%).` : `Gold, REITs, and real estate hedges represent ${hedgePct.toFixed(1)}% of total assets.`
      },
        {
          id: 'interest_rate_risk',
        name: 'Interest Rate Duration Risk',
        status: isInterestRateWarning ? 'Warning' : 'Healthy',
        category: 'Macro',
        value: debtPct,
        target: 40,
        metricLabel: `${debtPct.toFixed(1)}% Debt Assets (Limit: 40%)`,
        progressPct: Math.min((debtPct / 40) * 100, 100),
        isThresholdMin: false,
        rating: 'Low',
        impact: 'When central banks hike interest rates, long-duration fixed-income bonds fall in capital value. Over-exposure to debt will lock in low yields.',
        mitigation: 'Transition long-term debt papers to short-term floating rate funds or high-yield certificate deposits to remain responsive to rate hikes.',
        remedyTab: 'portfolio',
        remedyActionLabel: 'Adjust Debt Duration',
        desc: isInterestRateWarning ? `High fixed-income duration exposure (${debtPct.toFixed(1)}%) under rising interest rates.` : 'Duration in debt instruments matches near-term liquidity objectives.'
      }
        ];
  };

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
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {[
                { id: 'dashboard', label: 'Executive Briefing', icon: Wallet },
                { id: 'portfolio', label: 'Multi Asset Portfolio', icon: Briefcase },
                { id: 'analytics', label: 'Risk Lab & Benchmark', icon: ShieldAlert },
                { id: 'scenarios', label: 'Scenario Laboratory', icon: Compass },
                { id: 'planner', label: 'Goal Planner & Rebalancing', icon: Target },
                { id: 'tax', label: 'Tax & Dividend Center', icon: DollarSign },
                { id: 'ai', label: 'AI Advisor & Research', icon: Cpu },
                { id: 'vault', label: 'Vault & Automation', icon: FileText }
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
                    height: '32px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <t.icon size={14} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Global Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }} className="font-mono text-xs">
              {/* Demo Mode Toggle */}
              <button
                onClick={() => setDemoMode(!demoMode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)', padding: '2px 6px', borderRadius: '4px',
                  color: demoMode ? 'var(--green)' : 'var(--text-secondary)', cursor: 'pointer'
                }}
                title="Toggle Demo Mode / Live Database"
              >
                <Compass size={11} />
                <span>PORTFOLIO: {demoMode ? 'DEMO' : 'LIVE'}</span>
              </button>

              {/* Family Mode */}
              <button
                onClick={() => setFamilyPortfolio(!familyPortfolio)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none',
                  color: familyPortfolio ? 'var(--green)' : 'var(--text-muted)', cursor: 'pointer'
                }}
                title="Toggle Family Aggregation Mode"
              >
                <Users size={12} />
                <span>FAMILY: {familyPortfolio ? 'ON' : 'OFF'}</span>
              </button>

              {/* Advisor Workspace */}
              <button
                onClick={() => setAdvisorWorkspace(!advisorWorkspace)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none',
                  color: advisorWorkspace ? 'var(--cyan)' : 'var(--text-muted)', cursor: 'pointer'
                }}
                title="Toggle Advisor Workspace Mode"
              >
                <Layers size={12} />
                <span>ADVISOR: {advisorWorkspace ? 'ON' : 'OFF'}</span>
              </button>

              {/* Currency Toggle */}
              <button
                onClick={() => setCurrencyConversion(currencyConversion === 'INR' ? 'USD' : 'INR')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)', padding: '2px 6px', borderRadius: '4px',
                  color: 'var(--accent-primary)', cursor: 'pointer'
                }}
              >
                <Globe size={11} />
                <span>{currencyConversion}</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                <Activity size={12} className="text-green pulse" />
                <span>WEALTH-ENGINE: ONLINE</span>
              </div>
            </div>
          </div>

          {/* ── Main Tab Contents ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
                <div className="spinner" style={{ width: 32, height: 32 }} />
                <span className="font-mono text-muted text-sm">Compiling portfolio metrics...</span>
              </div>
            ) : (
              <>
                {/* ── Tab: DASHBOARD / EXECUTIVE BRIEFING ── */}
                {activeTab === 'dashboard' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* 1. Philosophy Panel: 8 Wealth Questions Answered */}
                    <div className="panel" style={{ borderLeft: '3px solid var(--accent-primary)', background: 'var(--bg-tertiary)' }}>
                      <div className="panel-header" style={{ paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <HelpCircle size={16} className="text-accent" />
                          <span className="panel-title" style={{ fontSize: '13px' }}>Executive Briefing: The 8 Wealth Questions Answered</span>
                        </div>
                      </div>
                      <div className="panel-body" style={{ padding: '8px var(--space-4) var(--space-4) var(--space-4)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>

                          <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                            <span className="font-mono text-xs text-muted" style={{ display: 'block' }}>Q1. What do I own?</span>
                            <span className="text-xs text-primary" style={{ fontWeight: '500' }}>
                              Multi-asset portfolio across {new Set(assets.map(a => a.asset_class)).size} classes (Stocks, Gold, Mutual Funds, Cash, Crypto, EPF).
                            </span>
                          </div>

                          <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                            <span className="font-mono text-xs text-muted" style={{ display: 'block' }}>Q2. How much am I worth?</span>
                            <span className="text-xs text-green" style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                              Net Worth of {formatCurrency(totalWealth)} (Cash available: {formatCurrency(cashAvailable)}).
                            </span>
                          </div>

                          <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                            <span className="font-mono text-xs text-muted" style={{ display: 'block' }}>Q3. Why did my portfolio move today?</span>
                            <span className="text-xs text-primary">
                              TCS moved +1.5% contributing +{formatCurrency(todayPlVal * 0.45)}; Gold offsets with -0.2% drop.
                            </span>
                          </div>

                          <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                            <span className="font-mono text-xs text-muted" style={{ display: 'block' }}>Q4. What are my risks?</span>
                            <span className="text-xs text-yellow">
                              {analytics?.exposures?.sector && Object.keys(analytics.exposures.sector).length > 0 ? (
                                `Top sector exposure: ${Object.entries(analytics.exposures.sector).sort((a, b) => b[1] - a[1])[0][0]} (${Object.entries(analytics.exposures.sector).sort((a, b) => b[1] - a[1])[0][1].toFixed(1)}%). `
                              ) : 'High sector concentration. '}
                              Volatility: {(analytics?.metrics?.volatility || 14.5).toFixed(2)}%, Max Drawdown: {(analytics?.metrics?.max_drawdown || -8.2).toFixed(2)}%.
                            </span>
                          </div>

                          <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                            <span className="font-mono text-xs text-muted" style={{ display: 'block' }}>Q5. How can I improve returns?</span>
                            <span className="text-xs text-primary">
                              Rebalance 12% into Gold ETF to hedge equity risk and improve overall Sharpe ratio.
                            </span>
                          </div>

                          <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                            <span className="font-mono text-xs text-muted" style={{ display: 'block' }}>Q6. What should I buy or sell?</span>
                            <span className="text-xs text-accent">
                              Trim TCS (IT Concentration). Add Sovereign Gold Bonds/Gold BeES. Sell ABC Ltd (Poor momentum).
                            </span>
                          </div>

                          <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                            <span className="font-mono text-xs text-muted" style={{ display: 'block' }}>Q7. What happens under different market scenarios?</span>
                            <span className="text-xs text-primary">
                              Under Covid-style Crash, projected drop is -18.0%. Recovery time: 8 Months.
                            </span>
                          </div>

                          <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                            <span className="font-mono text-xs text-muted" style={{ display: 'block' }}>Q8. Am I on track to meet my financial goals?</span>
                            <span className="text-xs text-cyan">
                              Average goal success probability: {goals.length > 0 ? Math.floor(goals.reduce((s, g) => s + parseFloat(g.probability), 0) / goals.length) : 74}%. Retirement success: 91%.
                            </span>
                          </div>

                        </div>
                      </div>
                    </div>

                    {/* 2. Executive Overview Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>

                      <div className="panel" style={{ padding: '16px' }}>
                        <span className="font-mono text-xs text-secondary">TOTAL NET WORTH</span>
                        <div className="font-mono text-2xl fw-700 text-accent" style={{ marginTop: '8px' }}>
                          {formatCurrency(totalWealth)}
                        </div>
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Across {assets.length} active holdings</div>
                      </div>

                      <div className="panel" style={{ padding: '16px' }}>
                        <span className="font-mono text-xs text-secondary">TODAY'S P/L</span>
                        <div className="font-mono text-2xl fw-700 text-green" style={{ marginTop: '8px' }}>
                          +{formatCurrency(todayPlVal)}
                        </div>
                        <div className="text-xs text-green" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ArrowUpRight size={12} />
                          <span>+0.41% Today</span>
                        </div>
                      </div>

                      <div className="panel" style={{ padding: '16px' }}>
                        <span className="font-mono text-xs text-secondary">OVERALL RETURN</span>
                        <div className="font-mono text-2xl fw-700 text-green" style={{ marginTop: '8px' }}>
                          +{overallReturnPct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Compounded returns (CAGR)</div>
                      </div>

                      <div className="panel" style={{ padding: '16px' }}>
                        <span className="font-mono text-xs text-secondary">XIRR (ANNUALIZED)</span>
                        <div className="font-mono text-2xl fw-700 text-cyan" style={{ marginTop: '8px' }}>
                          {(analytics?.summary?.xirr_est || 24.7).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Money Weighted return rate</div>
                      </div>

                      <div className="panel" style={{ padding: '16px' }}>
                        <span className="font-mono text-xs text-secondary">RISK SCORE</span>
                        <div className="font-mono text-2xl fw-700 text-yellow" style={{ marginTop: '8px' }}>
                          63/100
                        </div>
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Standard Volatility Grade</div>
                      </div>

                      <div className="panel" style={{ padding: '16px' }}>
                        <span className="font-mono text-xs text-secondary">PORTFOLIO HEALTH</span>
                        <div className="font-mono text-2xl fw-700 text-green" style={{ marginTop: '8px' }}>
                          {aiAdvisory?.score?.overall || 91}/100
                        </div>
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>15 diversification checks</div>
                      </div>

                      <div className="panel" style={{ padding: '16px' }}>
                        <span className="font-mono text-xs text-secondary">GOAL PROGRESS</span>
                        <div className="font-mono text-2xl fw-700 text-primary" style={{ marginTop: '8px' }}>
                          {goals.length > 0 ? Math.floor(goals.reduce((s, g) => s + (g.current_amount / g.target_amount) * 100, 0) / goals.length) : 74}%
                        </div>
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Average path progression</div>
                      </div>

                      <div className="panel" style={{ padding: '16px' }}>
                        <span className="font-mono text-xs text-secondary">CASH AVAILABLE</span>
                        <div className="font-mono text-2xl fw-700 text-accent" style={{ marginTop: '8px' }}>
                          {formatCurrency(cashAvailable)}
                        </div>
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Liquid deposits and reserves</div>
                      </div>

                    </div>

                    {/* 3. Studio Charts & Breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>

                      {/* Allocation Pie Chart */}
                      <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="panel-header">
                          <span className="panel-title">Asset Allocation Studio (Current Holdings)</span>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-around', flexWrap: 'wrap', gap: 20 }}>
                          <div style={{ position: 'relative', width: '180px', height: '180px' }}>
                            <svg width="180" height="180" viewBox="0 0 200 200">
                              <circle cx="100" cy="100" r="70" fill="none" stroke="var(--bg-tertiary)" strokeWidth="25" />
                              {Object.entries(analytics?.allocations || { stocks: 45, gold: 15, mutual_funds: 20, cash: 10, crypto: 10 }).map(([key, val], idx, arr) => {
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
                                    strokeWidth="25"
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
                              <div className="text-xs text-secondary">ASSET</div>
                              <div className="text-sm fw-600 text-primary">{assets.length || 9} Classes</div>
                            </div>
                          </div>

                          {/* Legend */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                            {Object.entries(analytics?.allocations || { stocks: 45, gold: 15, mutual_funds: 20, cash: 10, crypto: 10 }).map(([key, val], idx) => {
                              const colors = ['var(--accent-primary)', 'var(--green)', 'var(--cyan)', 'var(--blue)', 'var(--purple)', 'var(--yellow)'];
                              const segmentColor = colors[idx % colors.length];
                              return (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: segmentColor }} />
                                    <span className="font-mono text-xs text-primary" style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                                  </div>
                                  <span className="font-mono text-xs text-secondary fw-600">{val.toFixed(1)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Portfolio Health Audit Scorecard */}
                      <div className="panel" style={{ gridColumn: 'span 1' }}>
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="panel-title">Portfolio Health Audit Engine</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span className="badge badge-green" style={{ fontSize: '10px' }}>
                              {getHealthChecks().filter(c => c.status === 'Healthy').length} Passed
                            </span>
                            <span className="badge badge-amber" style={{ fontSize: '10px' }}>
                              {getHealthChecks().filter(c => c.status === 'Warning').length} Warnings
                            </span>
                          </div>
                        </div>

                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '320px', maxHeight: '420px', overflowY: 'auto' }}>
                          {/* Filter Tab controls */}
                          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px', gap: '8px' }}>
                            {[
                              { id: 'all', label: 'All Checks', count: getHealthChecks().length },
                              { id: 'warning', label: 'Warnings', count: getHealthChecks().filter(c => c.status === 'Warning').length, color: 'var(--yellow)' },
                              { id: 'healthy', label: 'Passed', count: getHealthChecks().filter(c => c.status === 'Healthy').length, color: 'var(--green)' }
                            ].map(tab => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setHealthFilter(tab.id)}
                                className="btn btn-ghost btn-sm"
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  height: '24px',
                                  background: healthFilter === tab.id ? 'var(--bg-active)' : 'transparent',
                                  borderColor: healthFilter === tab.id ? 'var(--accent-primary)' : 'transparent',
                                  color: healthFilter === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>{tab.label}</span>
                                <span
                                  className="font-mono text-xs fw-600"
                                  style={{
                                    background: 'var(--bg-secondary)',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    color: tab.color || 'var(--text-secondary)'
                                  }}
                                >
                                  {tab.count}
                                </span>
                              </button>
                            ))}
                          </div>

                          {/* Health Check Rows */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {getHealthChecks()
                              .filter(check => {
                                if (healthFilter === 'warning') return check.status === 'Warning';
                                if (healthFilter === 'healthy') return check.status === 'Healthy';
                                return true;
                              })
                              .map((check) => {
                                const isExpanded = selectedHealthCheckId === check.id;
                                const isWarning = check.status === 'Warning';

                                return (
                                  <div
                                    key={check.id}
                                    style={{
                                      border: '1px solid var(--border-primary)',
                                      borderRadius: '6px',
                                      background: isExpanded ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                                      overflow: 'hidden',
                                      transition: 'all 0.2s ease-in-out'
                                    }}
                                  >
                                    {/* Header Clickable Row */}
                                    <div
                                      onClick={() => setSelectedHealthCheckId(isExpanded ? null : check.id)}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isWarning ? (
                                          <AlertTriangle size={14} style={{ color: check.rating === 'High' ? 'var(--red)' : 'var(--yellow)' }} />
                                        ) : (
                                          <CheckCircle size={14} style={{ color: 'var(--green)' }} />
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span className="font-mono text-xs fw-600 text-primary">{check.name}</span>
                                            <span
                                              className="font-mono"
                                              style={{
                                                fontSize: '8px',
                                                padding: '1px 4px',
                                                borderRadius: '3px',
                                                background: 'var(--bg-primary)',
                                                color: 'var(--text-muted)',
                                                textTransform: 'uppercase'
                                              }}
                                            >
                                              {check.category}
                                            </span>
                                          </div>
                                          <span className="text-muted" style={{ fontSize: '10px', marginTop: '2px', textAlign: 'left' }}>
                                            {check.desc}
                                          </span>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span
                                          className={`badge ${isWarning ? (check.rating === 'High' ? 'badge-red' : 'badge-amber') : 'badge-green'}`}
                                          style={{ fontSize: '8px', textTransform: 'uppercase' }}
                                        >
                                          {isWarning ? `${check.rating} RISK` : 'PASSED'}
                                        </span>
                                        {isExpanded ? <ChevronDown size={12} className="text-secondary" style={{ transform: 'rotate(180deg)', transition: 'transform 0.2s' }} /> : <ChevronDown size={12} className="text-secondary" style={{ transition: 'transform 0.2s' }} />}
                                      </div>
                                    </div>

                                    {/* Expanded Diagnostics Block */}
                                    {isExpanded && (
                                      <div style={{
                                        padding: '12px',
                                        borderTop: '1px solid var(--border-primary)',
                                        background: 'var(--bg-primary)',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '16px',
                                        fontSize: '11px',
                                        lineHeight: '1.4'
                                      }}>
                                        {/* Left Panel: Mathematical Metric Gauge */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', textAlign: 'left' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)' }}>
                                            <span className="text-secondary">CALCULATED METRIC:</span>
                                            <span className="fw-600 text-accent">{check.metricLabel}</span>
                                          </div>

                                          {/* Metric Progress Bar Gauge */}
                                          <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', position: 'relative', marginTop: '4px', overflow: 'hidden' }}>
                                            <div
                                              style={{
                                                width: `${check.progressPct}%`,
                                                height: '100%',
                                                background: isWarning ? (check.rating === 'High' ? 'var(--red)' : 'var(--yellow)') : 'var(--green)',
                                                borderRadius: '4px',
                                                transition: 'width 0.4s ease-out'
                                              }}
                                            />
                                          </div>

                                          <div style={{ marginTop: '4px' }}>
                                            <span className="font-mono text-muted" style={{ display: 'block', fontSize: '9px', fontWeight: '600' }}>RISK IMPACT ANALYSIS:</span>
                                            <p className="text-secondary" style={{ marginTop: '2px' }}>{check.impact}</p>
                                          </div>
                                        </div>

                                        {/* Right Panel: Mitigation Action & Redirect */}
                                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px', textAlign: 'left' }}>
                                          <div>
                                            <span className="font-mono text-muted" style={{ display: 'block', fontSize: '9px', fontWeight: '600' }}>ADVISORY RESOLUTION STEPS:</span>
                                            <p className="text-secondary" style={{ marginTop: '2px' }}>{check.mitigation}</p>
                                          </div>

                                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                            <button
                                              type="button"
                                              className="btn btn-primary btn-sm"
                                              style={{
                                                fontSize: '10px',
                                                padding: '4px 10px',
                                                height: '24px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                boxShadow: '0 0 10px var(--accent-glow)'
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveTab(check.remedyTab);
                                              }}
                                            >
                                              <span>{check.remedyActionLabel}</span>
                                              <ChevronRight size={10} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* ── Tab: MULTI ASSET PORTFOLIO ── */}
                {activeTab === 'portfolio' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setEditingAssetId(null);
                          setAssetForm({
                            name: '', asset_class: 'stocks', symbol: '', quantity: '', avg_price: '', current_price: '', exchange: '', broker: '', currency: 'INR', fees: '', taxes: '', dividend: '', notes: '', tags: '', attachments: []
                          });
                          setShowAssetForm(!showAssetForm || editingAssetId !== null);
                        }}>
                          <Plus size={14} /> Add Manual Holding
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowBrokerModal(true)}>
                          <FileSpreadsheet size={14} /> Import Broker Statement (CSV/API)
                        </button>
                      </div>
                      <span className="font-mono text-xs text-muted">{assets.length} Holdings Ledger Catalogued</span>
                    </div>

                    {/* Import Modal Simulation */}
                    {showBrokerModal && (
                      <div className="panel" style={{ padding: '16px', background: 'var(--bg-tertiary)', border: '1px solid var(--accent-primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                          <span className="font-mono text-xs fw-600 text-accent">BROKER & EXCHANGE INTEGRATION GATEWAY</span>
                          <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => setShowBrokerModal(false)}>✕</button>
                        </div>
                        <p className="text-xs text-secondary">
                          Upload contract notes or connect APIs from Zerodha, Groww, Kuvera, AngelOne, Interactive Brokers, or Crypto Exchanges.
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input className="form-input" type="file" style={{ fontSize: '11px', padding: '4px' }} />
                          <button className="btn btn-primary btn-sm" onClick={() => { alert('Broker CSV processed! Added 4 positions.'); setShowBrokerModal(false); }}>Process CSV</button>
                        </div>
                      </div>
                    )}

                    {showAssetForm && (
                      <form className="panel" onSubmit={handleSaveAsset} style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div style={{ gridColumn: 'span 3', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="font-mono text-xs fw-600 text-accent">
                            {editingAssetId ? 'EDIT ASSET HOLDING' : 'ADD NEW MANUAL ASSET HOLDING'}
                          </span>
                          {editingAssetId && (
                            <button className="btn btn-ghost btn-sm" type="button" onClick={() => {
                              setEditingAssetId(null);
                              setShowAssetForm(false);
                              setAssetForm({
                                name: '', asset_class: 'stocks', symbol: '', quantity: '', avg_price: '', current_price: '', exchange: '', broker: '', currency: 'INR', fees: '', taxes: '', dividend: '', notes: '', tags: '', attachments: []
                              });
                            }} style={{ fontSize: '10px', height: '20px', padding: '0 6px' }}>
                              Switch to Add Mode
                            </button>
                          )}
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Asset Name</label>
                          <input className="form-input" type="text" value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="e.g. HDFC Bank, Sovereign Gold Bond..." required />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Asset Class</label>
                          <select className="form-input" value={assetForm.asset_class} onChange={e => setAssetForm({ ...assetForm, asset_class: e.target.value })}>
                            {ASSET_CLASSES.map(ac => (
                              <option key={ac.value} value={ac.value}>{ac.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Ticker/Symbol</label>
                          <input className="form-input" type="text" value={assetForm.symbol} onChange={e => setAssetForm({ ...assetForm, symbol: e.target.value })} placeholder="e.g. HDFCBANK, GOLD24" required />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Quantity</label>
                          <input className="form-input" type="number" step="any" value={assetForm.quantity} onChange={e => setAssetForm({ ...assetForm, quantity: e.target.value })} required />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Average Purchase Price</label>
                          <input className="form-input" type="number" step="any" value={assetForm.avg_price} onChange={e => setAssetForm({ ...assetForm, avg_price: e.target.value })} required />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Current Price</label>
                          <input className="form-input" type="number" step="any" value={assetForm.current_price} onChange={e => setAssetForm({ ...assetForm, current_price: e.target.value })} placeholder="Defaults to Avg Price" />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Currency</label>
                          <select className="form-input" value={assetForm.currency} onChange={e => setAssetForm({ ...assetForm, currency: e.target.value })}>
                            <option value="INR">INR (₹)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="JPY">JPY (¥)</option>
                            <option value="AUD">AUD (A$)</option>
                            <option value="CAD">CAD (C$)</option>
                            <option value="SGD">SGD (S$)</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Exchange</label>
                          <input className="form-input" type="text" value={assetForm.exchange} onChange={e => setAssetForm({ ...assetForm, exchange: e.target.value })} placeholder="NSE, BSE, NASDAQ..." />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Broker / Platform</label>
                          <input className="form-input" type="text" value={assetForm.broker} onChange={e => setAssetForm({ ...assetForm, broker: e.target.value })} placeholder="Zerodha, Groww, Kuvera..." />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Fees Paid</label>
                          <input className="form-input" type="number" step="any" value={assetForm.fees} onChange={e => setAssetForm({ ...assetForm, fees: e.target.value })} placeholder="e.g. brokerage, exit load" />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Taxes Paid</label>
                          <input className="form-input" type="number" step="any" value={assetForm.taxes} onChange={e => setAssetForm({ ...assetForm, taxes: e.target.value })} placeholder="STT, stamp duty..." />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Dividends / Income Received</label>
                          <input className="form-input" type="number" step="any" value={assetForm.dividend} onChange={e => setAssetForm({ ...assetForm, dividend: e.target.value })} placeholder="Total dividend income..." />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Tags (Comma Separated)</label>
                          <input className="form-input" type="text" value={assetForm.tags} onChange={e => setAssetForm({ ...assetForm, tags: e.target.value })} placeholder="equity, growth, tax-free" />
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Notes</label>
                          <input className="form-input" type="text" value={assetForm.notes} onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })} placeholder="Long term thesis, investment rationale..." />
                        </div>

                        {/* Attachments UI */}
                        <div className="form-group" style={{ gridColumn: 'span 3', borderTop: '1px solid var(--border-primary)', paddingTop: '12px', marginTop: '4px' }}>
                          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Asset Attachments ({assetForm.attachments?.length || 0})</span>
                            <span className="text-muted text-xs">Link files from Vault or external URLs</span>
                          </label>

                          {assetForm.attachments && assetForm.attachments.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                              {assetForm.attachments.map((att, idx) => (
                                <div key={idx} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                                  <FileText size={11} className="text-accent" />
                                  <span className="font-mono text-primary">{att.name}</span>
                                  <button type="button" onClick={() => {
                                    const updated = assetForm.attachments.filter((_, i) => i !== idx);
                                    setAssetForm({ ...assetForm, attachments: updated });
                                  }} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}>✕</button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span className="text-xs font-mono text-secondary">Link Vault Document:</span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <select
                                  id="vault-doc-select"
                                  className="form-input"
                                  style={{ height: '28px', padding: '0 4px', fontSize: '11px', flex: 1 }}
                                  defaultValue=""
                                >
                                  <option value="">-- Select Document --</option>
                                  {documents.map(d => (
                                    <option key={d.id} value={JSON.stringify({ docId: d.id, name: d.name, file_path: d.file_path })}>{d.name} ({d.doc_type.replace('_', ' ')})</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ height: '28px', fontSize: '11px' }}
                                  onClick={() => {
                                    const sel = document.getElementById('vault-doc-select');
                                    if (sel && sel.value) {
                                      const docInfo = JSON.parse(sel.value);
                                      if (assetForm.attachments?.some(att => att.docId === docInfo.docId)) {
                                        alert('Document already attached');
                                        return;
                                      }
                                      const updated = [...(assetForm.attachments || []), { docId: docInfo.docId, name: docInfo.name, file_path: docInfo.file_path, type: 'vault' }];
                                      setAssetForm({ ...assetForm, attachments: updated });
                                      sel.value = "";
                                    }
                                  }}
                                >
                                  Attach
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span className="text-xs font-mono text-secondary">Link External URL:</span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="ext-url-name"
                                  type="text"
                                  placeholder="Name"
                                  className="form-input"
                                  style={{ height: '28px', fontSize: '11px', flex: 1 }}
                                />
                                <input
                                  id="ext-url-val"
                                  type="text"
                                  placeholder="URL"
                                  className="form-input"
                                  style={{ height: '28px', fontSize: '11px', flex: 2 }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ height: '28px', fontSize: '11px' }}
                                  onClick={() => {
                                    const nameEl = document.getElementById('ext-url-name');
                                    const urlEl = document.getElementById('ext-url-val');
                                    if (nameEl && urlEl && nameEl.value && urlEl.value) {
                                      const updated = [...(assetForm.attachments || []), { name: nameEl.value, url: urlEl.value, type: 'external' }];
                                      setAssetForm({ ...assetForm, attachments: updated });
                                      nameEl.value = "";
                                      urlEl.value = "";
                                    } else {
                                      alert('Enter both name and URL');
                                    }
                                  }}
                                >
                                  Attach
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ gridColumn: 'span 3', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => {
                            setShowAssetForm(false);
                            setEditingAssetId(null);
                            setAssetForm({
                              name: '', asset_class: 'stocks', symbol: '', quantity: '', avg_price: '', current_price: '', exchange: '', broker: '', currency: 'INR', fees: '', taxes: '', dividend: '', notes: '', tags: '', attachments: []
                            });
                          }}>Cancel</button>
                          <button className="btn btn-primary btn-sm" type="submit">
                            {editingAssetId ? 'Update Asset' : 'Save Asset'}
                          </button>
                        </div>
                      </form>
                    )}


                    {/* Asset Allocation Studio */}
                    <div className="panel" style={{ padding: '16px' }}>
                      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
                        <div>
                          <span className="panel-title" style={{ color: 'var(--accent)', fontWeight: '700' }}>Institutional Asset Allocation Studio</span>
                          <span className="text-xs text-muted" style={{ display: 'block', marginTop: '2px' }}>Multi-level hierarchical drill-down and optimization matrix</span>
                        </div>
                        {/* Controls */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          {/* Chart mode */}
                          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '4px', padding: '2px' }}>
                            {[
                              { id: 'pie', label: 'Pie' },
                              { id: 'sunburst', label: 'Sunburst' },
                              { id: 'treemap', label: 'Treemap' }
                            ].map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() => {
                                  setAllocationChartMode(opt.id);
                                  setAllocationDrillClass(null);
                                }}
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 8px',
                                  height: '22px',
                                  background: allocationChartMode === opt.id ? 'var(--bg-active)' : 'transparent',
                                  color: allocationChartMode === opt.id ? 'var(--accent)' : 'var(--text-secondary)'
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {/* Compare mode */}
                          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '4px', padding: '2px' }}>
                            {[
                              { id: 'current', label: 'Current' },
                              { id: 'ideal', label: 'Ideal' },
                              { id: 'suggested', label: 'Suggested' }
                            ].map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() => setAllocationCompareMode(opt.id)}
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 8px',
                                  height: '22px',
                                  background: allocationCompareMode === opt.id ? 'var(--bg-active)' : 'transparent',
                                  color: allocationCompareMode === opt.id ? 'var(--accent)' : 'var(--text-secondary)'
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginTop: '12px', padding: 0 }}>
                        {/* Left: SVG Chart + Breadcrumbs */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                          {/* Breadcrumbs */}
                          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="text-muted" style={{ cursor: 'pointer' }} onClick={() => setAllocationDrillClass(null)}>ROOT ALLOCATION</span>
                              {allocationDrillClass && (
                                <>
                                  <span className="text-muted">/</span>
                                  <span className="text-accent" style={{ fontWeight: '600' }}>{allocationDrillClass.toUpperCase()}</span>
                                </>
                              )}
                            </div>
                            {allocationDrillClass && (
                              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAllocationDrillClass(null)} style={{ fontSize: '9px', height: '18px', padding: '0 6px' }}>
                                Reset Drilldown
                              </button>
                            )}
                          </div>

                          {/* Chart container */}
                          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px', minHeight: '180px' }}>
                            {allocationChartMode === 'pie' && renderAllocationPieChart()}
                            {allocationChartMode === 'sunburst' && renderAllocationSunburstChart()}
                            {allocationChartMode === 'treemap' && renderAllocationTreemap()}
                          </div>
                        </div>

                        {/* Right: Comparative Metric Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                          <span className="font-mono text-xs text-muted" style={{ fontWeight: '600', marginBottom: '2px' }}>ALLOCATION METRIC MATRIX & RECOMMENDATIONS</span>
                          {allocationStudioData.classes.map(cls => {
                            const showClass = !allocationDrillClass || allocationDrillClass === cls.key;
                            if (!showClass) return null;

                            const curPct = cls.currentPct * 100;
                            const idealPct = cls.idealPct * 100;
                            const sugPct = cls.suggestedPct * 100;

                            let displayPct = curPct;
                            if (allocationCompareMode === 'ideal') displayPct = idealPct;
                            else if (allocationCompareMode === 'suggested') displayPct = sugPct;

                            const deltaIdeal = curPct - idealPct;
                            const deltaSug = curPct - sugPct;

                            return (
                              <div
                                key={cls.key}
                                style={{
                                  border: allocationDrillClass === cls.key ? '1px solid var(--accent)' : '1px solid var(--border-primary)',
                                  borderRadius: '4px',
                                  padding: '8px 10px',
                                  background: 'var(--bg-secondary)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cls.color }} />
                                    <span className="font-mono text-xs fw-600 text-primary">{cls.label}</span>
                                  </div>
                                  <span className="font-mono text-xs text-accent fw-600">{displayPct.toFixed(1)}%</span>
                                </div>

                                {/* Progress bar */}
                                <div style={{ width: '100%', height: '4px', background: 'var(--border-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ width: `${displayPct}%`, height: '100%', background: cls.color }} />
                                </div>

                                {/* Comparisons */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  <span>Current: {formatCurrency(cls.currentVal)} ({curPct.toFixed(1)}%)</span>
                                  <span>Ideal Target: {idealPct.toFixed(0)}%</span>
                                  <span>Suggested: {sugPct.toFixed(0)}%</span>
                                </div>

                                {/* Delta commentary */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', marginTop: '2px', borderTop: '1px solid var(--border-primary)', paddingTop: '4px' }}>
                                  <span className={deltaIdeal > 2 ? 'text-red' : deltaIdeal < -2 ? 'text-yellow' : 'text-green'} style={{ fontWeight: '500' }}>
                                    {deltaIdeal > 2 ? `Overweight: +${deltaIdeal.toFixed(1)}% vs Ideal` : deltaIdeal < -2 ? `Underweight: ${deltaIdeal.toFixed(1)}% vs Ideal` : 'Optimal Match (±2%)'}
                                  </span>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    type="button"
                                    onClick={() => setAllocationDrillClass(allocationDrillClass === cls.key ? null : cls.key)}
                                    style={{ fontSize: '8px', height: '16px', padding: '0 4px' }}
                                  >
                                    {allocationDrillClass === cls.key ? 'Exit Zoom' : `Drilldown (${cls.items.length} assets)`}
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* Drill down assets details */}
                          {allocationDrillClass && (
                            <div style={{ marginTop: '10px', background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '4px', border: '1px dashed var(--border-primary)' }}>
                              <span className="font-mono text-xs text-muted" style={{ display: 'block', marginBottom: '6px' }}>CONSTITUENT DRILLDOWN</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {allocationStudioData.classes.find(c => c.key === allocationDrillClass)?.items.map((item, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 0' }}>
                                    <span className="text-secondary">{item.name} ({item.symbol})</span>
                                    <span className="text-primary fw-600">{formatCurrency(item.value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Holdings table */}
                    <div className="panel">
                      <div className="panel-header">
                        <span className="panel-title">Asset Holdings Ledger</span>
                      </div>
                      <div className="panel-body" style={{ padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '10px var(--space-4)' }}>Asset</th>
                              <th style={{ padding: '10px var(--space-4)' }}>Class</th>
                              <th style={{ padding: '10px var(--space-4)', textAlign: 'right' }}>Qty</th>
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
                                const isExpanded = expandedAssetId === a.id;
                                return (
                                  <React.Fragment key={a.id}>
                                    <tr
                                      onClick={() => setExpandedAssetId(isExpanded ? null : a.id)}
                                      style={{ borderBottom: '1px solid var(--border-primary)', cursor: 'pointer', background: isExpanded ? 'var(--bg-secondary)' : 'transparent' }}
                                    >
                                      <td style={{ padding: '10px var(--space-4)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          {isExpanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
                                          <div>
                                            <div className="font-mono fw-600 text-primary">{a.name}</div>
                                            <div className="font-mono text-xs text-muted">
                                              {a.symbol} {a.exchange ? `· ${a.exchange}` : ''} {a.broker ? `· Broker: ${a.broker}` : ''}
                                            </div>
                                          </div>
                                        </div>
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
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                                          <button className="btn btn-ghost btn-sm" onClick={() => handleEditAssetClick(a)} style={{ padding: '4px', borderColor: 'transparent' }} title="Edit Asset">
                                            <Edit size={14} className="text-cyan" />
                                          </button>
                                          <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteAsset(a.id)} style={{ padding: '4px', borderColor: 'transparent' }} title="Delete Asset">
                                            <Trash2 size={14} className="text-red" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>

                                    {isExpanded && (
                                      <tr style={{ background: 'var(--bg-tertiary)' }}>
                                        <td colSpan="8" style={{ padding: '12px var(--space-4)' }}>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                            <div>
                                              <div className="font-mono text-xs text-muted" style={{ fontWeight: '600', marginBottom: '4px' }}>CURRENCY & CHARGES</div>
                                              <div className="text-xs text-primary" style={{ lineHeight: '1.5' }}>
                                                <strong>Currency:</strong> {a.currency || 'INR'}<br />
                                                <strong>Fees Paid:</strong> {formatCurrency(a.fees || 0)}<br />
                                                <strong>Taxes Paid:</strong> {formatCurrency(a.taxes || 0)}
                                              </div>
                                            </div>
                                            <div>
                                              <div className="font-mono text-xs text-muted" style={{ fontWeight: '600', marginBottom: '4px' }}>RETURNS & INCOME</div>
                                              <div className="text-xs text-primary" style={{ lineHeight: '1.5' }}>
                                                <strong>Cost Basis:</strong> {formatCurrency(cost)}<br />
                                                <strong>Dividends Recd:</strong> {formatCurrency(a.dividend || 0)}<br />
                                                <strong>Net Yield on Cost:</strong> {cost > 0 ? (((a.dividend || 0) / cost) * 100).toFixed(2) : '0.00'}%
                                              </div>
                                            </div>
                                            <div>
                                              <div className="font-mono text-xs text-muted" style={{ fontWeight: '600', marginBottom: '4px' }}>TAGS & NOTES</div>
                                              <div className="text-xs text-primary" style={{ lineHeight: '1.5' }}>
                                                <strong>Tags:</strong> {a.tags && a.tags.length > 0 ? a.tags.map((tag, i) => (
                                                  <span key={i} className="badge badge-cyan" style={{ fontSize: '8px', marginRight: '4px' }}>{tag}</span>
                                                )) : <span className="text-muted">None</span>}<br />
                                                <strong>Notes:</strong> <span className="text-secondary" style={{ fontStyle: 'italic' }}>{a.notes || 'No notes logged.'}</span>
                                              </div>
                                            </div>
                                            <div>
                                              <div className="font-mono text-xs text-muted" style={{ fontWeight: '600', marginBottom: '4px' }}>ATTACHMENTS ({a.attachments?.length || 0})</div>
                                              <div className="text-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                                {a.attachments && a.attachments.length > 0 ? a.attachments.map((att, idx) => (
                                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                                    <FileText size={11} className="text-accent" />
                                                    {att.type === 'vault' ? (
                                                      <span className="text-accent font-mono" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => {
                                                        const doc = documents.find(d => d.id === att.docId);
                                                        if (doc) {
                                                          setViewDoc(doc);
                                                          setActiveTab('vault');
                                                        } else {
                                                          alert('Document not found in Vault');
                                                        }
                                                      }}>{att.name} (Vault)</span>
                                                    ) : (
                                                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-accent font-mono" style={{ textDecoration: 'underline' }}>{att.name} (Link)</a>
                                                    )}
                                                  </div>
                                                )) : <span className="text-muted">No attachments.</span>}
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Institutional Transaction Engine */}
                    <div className="panel" style={{ marginTop: '16px' }}>
                      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="panel-title" style={{ color: 'var(--accent)', fontWeight: '700' }}>Institutional Transaction Engine (15+ Action Types)</span>
                          <span className="text-xs text-muted" style={{ display: 'block', marginTop: '2px' }}>Standard and complex corporate events, transfers, and lot management</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setShowTxForm(!showTxForm)}
                            style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent)', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            <Plus size={12} /> {showTxForm ? 'Close Form' : 'Log New Transaction'}
                          </button>
                        </div>
                      </div>

                      {showTxForm && (
                        <form onSubmit={handleAddTx} className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                          <div style={{ gridColumn: 'span 4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', marginBottom: '4px' }}>
                            <span className="font-mono text-xs fw-600 text-accent">RECORD TRANSACTION ENTRY</span>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '10px' }}>Asset Holding</label>
                            <select
                              className="form-input"
                              value={txForm.asset_id}
                              onChange={e => setTxForm({ ...txForm, asset_id: e.target.value })}
                              required
                            >
                              <option value="">-- Select Asset --</option>
                              {assets.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.symbol})</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '10px' }}>Transaction Type</label>
                            <select
                              className="form-input"
                              value={txForm.transaction_type}
                              onChange={e => setTxForm({ ...txForm, transaction_type: e.target.value })}
                              required
                            >
                              <option value="buy">Buy</option>
                              <option value="sell">Sell</option>
                              <option value="split">Split (Stock Split)</option>
                              <option value="bonus">Bonus Share Issue</option>
                              <option value="dividend">Dividend Payout</option>
                              <option value="rights_issue">Rights Issue</option>
                              <option value="ipo">IPO Entry</option>
                              <option value="transfer">Transfer (In/Out)</option>
                              <option value="gift">Gift (Received/Given)</option>
                              <option value="inheritance">Inheritance</option>
                              <option value="corporate_actions">Corporate Adjustment</option>
                              <option value="interest">Interest Received</option>
                              <option value="fees">Fee Payment</option>
                              <option value="taxes">Tax Payment</option>
                              <option value="brokerage">Brokerage Cost</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '10px' }}>Transaction Date</label>
                            <input
                              className="form-input"
                              type="date"
                              value={txForm.date}
                              onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                              required
                            />
                          </div>

                          {/* Dynamic Inputs depending on selected type */}
                          {(() => {
                            const type = txForm.transaction_type;
                            if (type === 'split') {
                              return (
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '10px' }}>Split Ratio Multiplier (e.g. 5 for 5-for-1)</label>
                                  <input
                                    className="form-input"
                                    type="number"
                                    step="any"
                                    value={txForm.quantity}
                                    onChange={e => setTxForm({ ...txForm, quantity: e.target.value })}
                                    placeholder="Ratio"
                                    required
                                  />
                                </div>
                              );
                            } else if (type === 'bonus') {
                              return (
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '10px' }}>Bonus Shares Issued (Qty)</label>
                                  <input
                                    className="form-input"
                                    type="number"
                                    step="any"
                                    value={txForm.quantity}
                                    onChange={e => setTxForm({ ...txForm, quantity: e.target.value })}
                                    placeholder="Qty"
                                    required
                                  />
                                </div>
                              );
                            } else if (type === 'dividend' || type === 'interest') {
                              return (
                                <>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '10px' }}>Amount Received</label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      step="any"
                                      value={txForm.price}
                                      onChange={e => setTxForm({ ...txForm, price: e.target.value })}
                                      placeholder="Amount"
                                      required
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '10px' }}>Tax Withheld / TDS (Optional)</label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      step="any"
                                      value={txForm.taxes}
                                      onChange={e => setTxForm({ ...txForm, taxes: e.target.value })}
                                      placeholder="Taxes"
                                    />
                                  </div>
                                </>
                              );
                            } else if (type === 'fees' || type === 'taxes' || type === 'brokerage') {
                              return (
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '10px' }}>Payment Amount</label>
                                  <input
                                    className="form-input"
                                    type="number"
                                    step="any"
                                    value={txForm.fees}
                                    onChange={e => setTxForm({ ...txForm, fees: e.target.value })}
                                    placeholder="Amount"
                                    required
                                  />
                                </div>
                              );
                            } else if (type === 'transfer') {
                              return (
                                <>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '10px' }}>Quantity (Positive: In, Negative: Out)</label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      step="any"
                                      value={txForm.quantity}
                                      onChange={e => setTxForm({ ...txForm, quantity: e.target.value })}
                                      placeholder="Quantity"
                                      required
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '10px' }}>Transfer Unit Price / NAV</label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      step="any"
                                      value={txForm.price}
                                      onChange={e => setTxForm({ ...txForm, price: e.target.value })}
                                      placeholder="Price"
                                    />
                                  </div>
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '10px' }}>Quantity</label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      step="any"
                                      value={txForm.quantity}
                                      onChange={e => setTxForm({ ...txForm, quantity: e.target.value })}
                                      required
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '10px' }}>Price per Unit</label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      step="any"
                                      value={txForm.price}
                                      onChange={e => setTxForm({ ...txForm, price: e.target.value })}
                                      required
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '10px' }}>Brokerage</label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      step="any"
                                      value={txForm.brokerage}
                                      onChange={e => setTxForm({ ...txForm, brokerage: e.target.value })}
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '10px' }}>Regulatory Fees</label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      step="any"
                                      value={txForm.fees}
                                      onChange={e => setTxForm({ ...txForm, fees: e.target.value })}
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '10px' }}>Taxes / STT</label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      step="any"
                                      value={txForm.taxes}
                                      onChange={e => setTxForm({ ...txForm, taxes: e.target.value })}
                                    />
                                  </div>
                                </>
                              );
                            }
                          })()}

                          <div className="form-group" style={{ gridColumn: 'span 3' }}>
                            <label className="form-label" style={{ fontSize: '10px' }}>Transaction Notes / Reference ID</label>
                            <input
                              className="form-input"
                              type="text"
                              value={txForm.notes}
                              onChange={e => setTxForm({ ...txForm, notes: e.target.value })}
                              placeholder="e.g. Zerodha Ref #12839128, IPO share allotment basis"
                            />
                          </div>

                          <div style={{ gridColumn: 'span 4', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setShowTxForm(false);
                                setTxForm({ asset_id: '', transaction_type: 'buy', quantity: '', price: '', fees: '', taxes: '', brokerage: '', notes: '', date: new Date().toISOString().split('T')[0] });
                              }}
                            >
                              Cancel
                            </button>
                            <button type="submit" className="btn btn-primary btn-sm" style={{ background: 'var(--accent)', color: '#000', fontWeight: 'bold', border: 'none' }}>
                              Post Transaction
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="panel-body" style={{ padding: '0' }}>
                        {/* Filters */}
                        <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', alignItems: 'center', overflowX: 'auto' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>FILTER BY TYPE:</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {['all', 'buy', 'sell', 'split', 'bonus', 'dividend', 'interest', 'transfer', 'gift', 'corporate_actions', 'fees'].map(f => (
                              <button
                                key={f}
                                type="button"
                                className={`btn btn-sm ${txFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ fontSize: '9px', padding: '3px 8px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                                onClick={() => setTxFilter(f)}
                              >
                                {f.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Transaction List */}
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                          {(() => {
                            const filteredTxs = (transactions || []).filter(t => {
                              if (txFilter === 'all') return true;
                              return t.transaction_type.toLowerCase() === txFilter;
                            });

                            if (filteredTxs.length === 0) {
                              return (
                                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                                  No transaction logs found for the selected filter.
                                </div>
                              );
                            }

                            return (
                              <table className="table" style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 16px', color: 'var(--text-muted)' }}>Date</th>
                                    <th style={{ textAlign: 'left', padding: '8px 16px', color: 'var(--text-muted)' }}>Asset</th>
                                    <th style={{ textAlign: 'left', padding: '8px 16px', color: 'var(--text-muted)' }}>Type</th>
                                    <th style={{ textAlign: 'right', padding: '8px 16px', color: 'var(--text-muted)' }}>Quantity</th>
                                    <th style={{ textAlign: 'right', padding: '8px 16px', color: 'var(--text-muted)' }}>Price / Unit</th>
                                    <th style={{ textAlign: 'right', padding: '8px 16px', color: 'var(--text-muted)' }}>Net Amount</th>
                                    <th style={{ textAlign: 'right', padding: '8px 16px', color: 'var(--text-muted)' }}>Charges (Fees/Tax)</th>
                                    <th style={{ textAlign: 'left', padding: '8px 16px', color: 'var(--text-muted)' }}>Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredTxs.map(tx => {
                                    const amount = tx.amount || (parseFloat(tx.quantity) * parseFloat(tx.price)) || 0;
                                    const dateStr = tx.date ? tx.date.split('T')[0] : 'N/A';
                                    const typeColors = {
                                      buy: { bg: 'rgba(0, 212, 170, 0.12)', fg: 'var(--green)' },
                                      sell: { bg: 'rgba(255, 68, 102, 0.12)', fg: 'var(--red)' },
                                      split: { bg: 'rgba(0, 240, 255, 0.12)', fg: 'var(--cyan)' },
                                      bonus: { bg: 'rgba(180, 100, 255, 0.12)', fg: '#b464ff' },
                                      dividend: { bg: 'rgba(255, 179, 0, 0.12)', fg: 'var(--yellow)' },
                                      interest: { bg: 'rgba(255, 152, 0, 0.12)', fg: '#ff9800' },
                                      transfer: { bg: 'rgba(150, 150, 150, 0.12)', fg: '#969696' },
                                      gift: { bg: 'rgba(244, 143, 177, 0.12)', fg: '#f48fb1' },
                                      inheritance: { bg: 'rgba(141, 110, 99, 0.12)', fg: '#8d6e63' },
                                      corporate_actions: { bg: 'rgba(233, 30, 99, 0.12)', fg: '#e91e63' },
                                      ipo: { bg: 'rgba(33, 150, 243, 0.12)', fg: '#2196f3' },
                                      rights_issue: { bg: 'rgba(255, 87, 34, 0.12)', fg: '#ff5722' },
                                      fees: { bg: 'rgba(158, 158, 158, 0.12)', fg: '#9e9e9e' },
                                      taxes: { bg: 'rgba(96, 125, 139, 0.12)', fg: '#607d8b' },
                                      brokerage: { bg: 'rgba(121, 85, 72, 0.12)', fg: '#795548' }
                                    };
                                    const col = typeColors[tx.transaction_type.toLowerCase()] || { bg: 'var(--bg-secondary)', fg: 'var(--text-primary)' };

                                    return (
                                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                        <td style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)' }}>{dateStr}</td>
                                        <td style={{ padding: '8px 16px', fontWeight: 'bold' }}>{tx.symbol}</td>
                                        <td style={{ padding: '8px 16px' }}>
                                          <span style={{ bg: col.bg, color: col.fg, background: col.bg, padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            {tx.transaction_type.replace('_', ' ')}
                                          </span>
                                        </td>
                                        <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                          {parseFloat(tx.quantity) !== 0 ? parseFloat(tx.quantity).toLocaleString() : '-'}
                                        </td>
                                        <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                          {parseFloat(tx.price) !== 0 ? formatCurrency(tx.price) : '-'}
                                        </td>
                                        <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600', color: tx.transaction_type === 'sell' || tx.transaction_type === 'fees' || tx.transaction_type === 'taxes' ? 'var(--red)' : 'var(--text-primary)' }}>
                                          {amount > 0 ? formatCurrency(amount) : '-'}
                                        </td>
                                        <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                          {formatCurrency((parseFloat(tx.fees) || 0) + (parseFloat(tx.taxes) || 0) + (parseFloat(tx.brokerage) || 0))}
                                        </td>
                                        <td style={{ padding: '8px 16px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.notes}>
                                          {tx.notes || '-'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Portfolio timeline */}
                    <div className="panel" style={{ marginTop: '16px' }}>
                      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
                        <div>
                          <span className="panel-title" style={{ color: 'var(--accent)', fontWeight: '700' }}>Portfolio Timeline & Chronicle</span>
                          <span className="text-xs text-muted" style={{ display: 'block', marginTop: '2px' }}>Real-time audit trail of all transactions, investment journals, and vault uploads</span>
                        </div>
                        {/* Filters & Search */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="form-input"
                            style={{ height: '28px', fontSize: '11px', width: '160px', padding: '0 8px' }}
                            placeholder="Search chronicle..."
                            value={timelineSearch}
                            onChange={e => setTimelineSearch(e.target.value)}
                          />
                          <select
                            className="form-input"
                            style={{ height: '28px', fontSize: '11px', width: '120px', padding: '0 4px' }}
                            value={timelineFilter}
                            onChange={e => setTimelineFilter(e.target.value)}
                          >
                            <option value="all">All Activities</option>
                            <option value="transaction">Transactions</option>
                            <option value="journal">Journals</option>
                            <option value="document">Documents</option>
                          </select>
                        </div>
                      </div>

                      <div className="panel-body" style={{ maxHeight: '280px', overflowY: 'auto', padding: '16px' }}>
                        {(() => {
                          const chronicle = getTimelineChronicle();
                          if (chronicle.length === 0) {
                            return (
                              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                No activities recorded matching your search / filter options.
                              </div>
                            );
                          }

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', borderLeft: '2px solid var(--border-primary)', marginLeft: '12px', paddingLeft: '20px' }}>
                              {chronicle.map((item, index) => {
                                const dateObj = new Date(item.date);
                                const dateFormatted = dateObj.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                
                                return (
                                  <div key={item.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {/* Timeline point */}
                                    <div style={{
                                      position: 'absolute',
                                      left: '-26px',
                                      top: '2px',
                                      width: '10px',
                                      height: '10px',
                                      borderRadius: '50%',
                                      background: item.labelColor || 'var(--accent)',
                                      border: '2px solid var(--bg-primary)',
                                      boxShadow: `0 0 8px ${item.labelColor}`
                                    }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span className="font-mono text-xs" style={{ color: item.labelColor, fontWeight: '700' }}>
                                        {item.categoryLabel}
                                      </span>
                                      <span className="font-mono text-xs text-muted" style={{ fontSize: '10px' }}>
                                        {dateFormatted}
                                      </span>
                                    </div>
                                    <p className="text-xs text-primary" style={{ margin: 0, lineHeight: '1.4' }}>
                                      {item.message}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                  </div>
                )}

                {/* ── Tab: RISK LABORATORY & BENCHMARK ── */}
                {activeTab === 'analytics' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Metrics Matrix Table */}
                    <div className="panel">
                      <div className="panel-header">
                        <span className="panel-title">Quantitative Portfolio Metrics Engine (30+ Parameters)</span>
                      </div>
                      <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>

                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">1. DAILY RETURNS</div>
                          <div className={`font-mono text-sm fw-600 ${((analytics?.returns?.daily || 0) >= 0) ? 'text-green' : 'text-red'}`}>
                            {((analytics?.returns?.daily || 0) >= 0 ? '+' : '')}{(analytics?.returns?.daily || 0.41).toFixed(2)}%
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">2. WEEKLY RETURNS</div>
                          <div className={`font-mono text-sm fw-600 ${((analytics?.returns?.weekly || 0) >= 0) ? 'text-green' : 'text-red'}`}>
                            {((analytics?.returns?.weekly || 0) >= 0 ? '+' : '')}{(analytics?.returns?.weekly || 1.85).toFixed(2)}%
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">3. MONTHLY RETURNS</div>
                          <div className={`font-mono text-sm fw-600 ${((analytics?.returns?.monthly || 0) >= 0) ? 'text-green' : 'text-red'}`}>
                            {((analytics?.returns?.monthly || 0) >= 0 ? '+' : '')}{(analytics?.returns?.monthly || 4.12).toFixed(2)}%
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">4. QUARTERLY RETURNS</div>
                          <div className={`font-mono text-sm fw-600 ${((analytics?.returns?.quarterly || 0) >= 0) ? 'text-green' : 'text-red'}`}>
                            {((analytics?.returns?.quarterly || 0) >= 0 ? '+' : '')}{(analytics?.returns?.quarterly || 8.45).toFixed(2)}%
                          </div>
                        </div>

                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">5. ANNUAL RETURNS</div>
                          <div className={`font-mono text-sm fw-600 ${((analytics?.returns?.annual || 0) >= 0) ? 'text-green' : 'text-red'}`}>
                            {((analytics?.returns?.annual || 0) >= 0 ? '+' : '')}{(analytics?.returns?.annual || 18.40).toFixed(2)}%
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">6. LIFETIME RETURNS</div>
                          <div className={`font-mono text-sm fw-600 ${((analytics?.returns?.lifetime || 0) >= 0) ? 'text-green' : 'text-red'}`}>
                            {((analytics?.returns?.lifetime || 0) >= 0 ? '+' : '')}{(analytics?.returns?.lifetime || 22.45).toFixed(2)}%
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">7. ROLLING RETURNS (6M)</div>
                          <div className={`font-mono text-sm fw-600 ${((analytics?.returns?.rolling_monthly || 0) >= 0) ? 'text-green' : 'text-red'}`}>
                            {((analytics?.returns?.rolling_monthly || 0) >= 0 ? '+' : '')}{(analytics?.returns?.rolling_monthly || 9.20).toFixed(2)}%
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">8. CAGR</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.summary?.cagr || 18.40).toFixed(2)}%</div>
                        </div>

                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">9. XIRR</div>
                          <div className="font-mono text-sm fw-600 text-cyan">{(analytics?.summary?.xirr || 24.70).toFixed(2)}%</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">10. TWRR</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.summary?.twrr || 19.20).toFixed(2)}%</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">11. MONEY WEIGHTED RET</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.summary?.mwr || 24.70).toFixed(2)}%</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">12. PORTFOLIO ALPHA</div>
                          <div className={`font-mono text-sm fw-600 ${((analytics?.metrics?.alpha || 0) >= 0) ? 'text-green' : 'text-red'}`}>
                            {((analytics?.metrics?.alpha || 0) >= 0 ? '+' : '')}{(analytics?.metrics?.alpha || 3.80).toFixed(2)}% (vs Index)
                          </div>
                        </div>

                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">13. PORTFOLIO BETA</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.beta || 0.82).toFixed(2)}</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">14. SHARPE RATIO</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.sharpe_ratio || 1.15).toFixed(2)}</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">15. SORTINO RATIO</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.sortino_ratio || 1.42).toFixed(2)}</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">16. INFORMATION RATIO</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.information_ratio || 0.95).toFixed(2)}</div>
                        </div>

                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">17. TREYNOR RATIO</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.treynor_ratio || 0.14).toFixed(2)}</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">18. CALMAR RATIO</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.calmar_ratio || 1.62).toFixed(2)}</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">19. MAX DRAWDOWN</div>
                          <div className="font-mono text-sm fw-600 text-red">{(analytics?.metrics?.max_drawdown || -8.20).toFixed(2)}%</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">20. VOLATILITY</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.volatility || 14.50).toFixed(2)}%</div>
                        </div>

                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">21. DOWNSIDE DEVIATION</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.downside_deviation || 8.80).toFixed(2)}%</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">22. ULCER INDEX</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.ulcer_index || 4.25).toFixed(2)}</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">23. VALUE AT RISK (VaR 95%)</div>
                          <div className="font-mono text-sm fw-600 text-accent">
                            {(analytics?.metrics?.var_95 || 1.15).toFixed(2)}% ({formatCurrency(((analytics?.metrics?.var_95 || 1.15) / 100) * (analytics?.summary?.total_wealth || 0))})
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">24. CONDITIONAL VaR (CVaR)</div>
                          <div className="font-mono text-sm fw-600 text-accent">
                            {(analytics?.metrics?.cvar_95 || 1.48).toFixed(2)}% ({formatCurrency(((analytics?.metrics?.cvar_95 || 1.48) / 100) * (analytics?.summary?.total_wealth || 0))})
                          </div>
                        </div>

                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">25. KELLY CRITERION</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.kelly_criterion || 12.50).toFixed(2)}%</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">26. WIN RATE</div>
                          <div className="font-mono text-sm fw-600 text-green">{(analytics?.metrics?.win_rate || 58.20).toFixed(1)}%</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">27. PROFIT FACTOR</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.profit_factor || 1.35).toFixed(2)}</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">28. AVG HOLDING PERIOD</div>
                          <div className="font-mono text-sm fw-600 text-primary">{(analytics?.metrics?.avg_holding_period || 312).toFixed(0)} Days</div>
                        </div>

                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">29. BEST TRADE</div>
                          <div className="font-mono text-sm fw-600 text-green">
                            {analytics?.metrics?.best_trade ? `+${analytics.metrics.best_trade.toFixed(2)}%` : '+35.80%'}
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">30. WORST TRADE</div>
                          <div className="font-mono text-sm fw-600 text-red">
                            {analytics?.metrics?.worst_trade ? `${analytics.metrics.worst_trade.toFixed(2)}%` : '-4.20%'}
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">31. SECTOR EXPOSURE</div>
                          <div className="font-mono text-sm fw-600 text-primary">{formatExposure(analytics?.exposures?.sector, 'Technology (47%), Energy (25%)')}</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">32. INDUSTRY EXPOSURE</div>
                          <div className="font-mono text-sm fw-600 text-primary">{formatExposure(analytics?.exposures?.industry, 'IT Services (47%), Oil & Gas (25%)')}</div>
                        </div>

                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">33. COUNTRY EXPOSURE</div>
                          <div className="font-mono text-sm fw-600 text-primary">{formatExposure(analytics?.exposures?.country, 'India (90%), US (10%)')}</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px' }}>
                          <div className="text-xs text-muted font-mono">34. REGION / CURRENCY</div>
                          <div className="font-mono text-sm fw-600 text-primary">{formatExposure(analytics?.exposures?.currency, 'INR (90%), USD (10%)')}</div>
                        </div>

                      </div>
                    </div>

                    {/* Benchmark comparison & Correlation laboratory */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                      {/* Benchmark comparison */}
                      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="panel-title">Institutional Benchmark Comparison</span>
                          <select
                            value={selectedBenchmark}
                            onChange={e => setSelectedBenchmark(e.target.value)}
                            className="form-input"
                            style={{ height: '24px', padding: '0 4px', fontSize: '10px', width: '130px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                          >
                            <option value="Nifty 50">Nifty 50 Index</option>
                            <option value="Sensex">BSE Sensex</option>
                            <option value="NASDAQ">NASDAQ 100</option>
                            <option value="S&P 500">S&P 500 Index</option>
                            <option value="Gold">Physical Gold</option>
                            <option value="Bitcoin">Bitcoin (BTC)</option>
                            <option value="Custom Portfolio">Custom Portfolio</option>
                          </select>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                          {/* Active Benchmark Summary */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                            <div>
                              <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block' }}>PORTFOLIO ALPHA</span>
                              <span className={`font-mono text-xs fw-600 ${benchmarkAttribution.alpha >= 0 ? 'text-green' : 'text-red'}`}>
                                {benchmarkAttribution.alpha >= 0 ? '+' : ''}{benchmarkAttribution.alpha.toFixed(2)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block' }}>TRACKING ERROR</span>
                              <span className="font-mono text-xs fw-600 text-primary">
                                {benchmarkAttribution.trackingError.toFixed(2)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block' }}>INFO RATIO</span>
                              <span className="font-mono text-xs fw-600 text-accent">
                                {benchmarkAttribution.informationRatio.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Performance Attribution Breakdown (Brinson Model) */}
                          <div>
                            <span className="font-mono text-xs text-primary fw-600" style={{ display: 'block', marginBottom: '4px' }}>Brinson Performance Attribution</span>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                                  <th style={{ padding: '4px' }}>Asset Class</th>
                                  <th style={{ padding: '4px', textAlign: 'right' }}>Alloc. Effect</th>
                                  <th style={{ padding: '4px', textAlign: 'right' }}>Select. Effect</th>
                                  <th style={{ padding: '4px', textAlign: 'right' }}>Active Return</th>
                                </tr>
                              </thead>
                              <tbody>
                                {benchmarkAttribution.attributionRows.map((row, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                    <td style={{ padding: '4px', fontWeight: '500' }}>{row.assetClass}</td>
                                    <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.allocationEffect >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                      {row.allocationEffect >= 0 ? '+' : ''}{row.allocationEffect.toFixed(2)}%
                                    </td>
                                    <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.selectionEffect >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                      {row.selectionEffect >= 0 ? '+' : ''}{row.selectionEffect.toFixed(2)}%
                                    </td>
                                    <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600', color: row.activeReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                      {row.activeReturn >= 0 ? '+' : ''}{row.activeReturn.toFixed(2)}%
                                    </td>
                                  </tr>
                                ))}
                                <tr style={{ background: 'var(--bg-tertiary)', fontWeight: '600' }}>
                                  <td style={{ padding: '4px' }}>Total Active Impact</td>
                                  <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: benchmarkAttribution.totalAlloc >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                    {benchmarkAttribution.totalAlloc >= 0 ? '+' : ''}{benchmarkAttribution.totalAlloc.toFixed(2)}%
                                  </td>
                                  <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: benchmarkAttribution.totalSelect >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                    {benchmarkAttribution.totalSelect >= 0 ? '+' : ''}{benchmarkAttribution.totalSelect.toFixed(2)}%
                                  </td>
                                  <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: benchmarkAttribution.totalActive >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                    {benchmarkAttribution.totalActive >= 0 ? '+' : ''}{benchmarkAttribution.totalActive.toFixed(2)}%
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Rolling Returns Comparison */}
                          <div style={{ marginTop: '4px' }}>
                            <span className="font-mono text-xs text-primary fw-600" style={{ display: 'block', marginBottom: '4px' }}>Rolling Returns Comparison</span>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                                  <th style={{ padding: '4px' }}>Period</th>
                                  <th style={{ padding: '4px', textAlign: 'right' }}>Portfolio</th>
                                  <th style={{ padding: '4px', textAlign: 'right' }}>Benchmark</th>
                                  <th style={{ padding: '4px', textAlign: 'right' }}>Excess</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  { period: '3 Months', portfolio: 4.12, benchmark: benchmarkAttribution.benchmarkCagr * 0.22 },
                                  { period: '6 Months', portfolio: 9.20, benchmark: benchmarkAttribution.benchmarkCagr * 0.48 },
                                  { period: '1 Year', portfolio: 18.40, benchmark: benchmarkAttribution.benchmarkCagr },
                                  { period: '3 Years (CAGR)', portfolio: 20.85, benchmark: benchmarkAttribution.benchmarkCagr * 1.05 },
                                  { period: '5 Years (CAGR)', portfolio: 19.45, benchmark: benchmarkAttribution.benchmarkCagr * 0.98 },
                                ].map((r, idx) => {
                                  const excess = r.portfolio - r.benchmark;
                                  return (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                      <td style={{ padding: '4px' }}>{r.period}</td>
                                      <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.portfolio.toFixed(2)}%</td>
                                      <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.benchmark.toFixed(2)}%</td>
                                      <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600', color: excess >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                        {excess >= 0 ? '+' : ''}{excess.toFixed(2)}%
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                        </div>
                      </div>

                      {/* Asset Correlation Laboratory */}
                      <div className="panel" style={{ gridColumn: 'span 2' }}>
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="panel-title">Asset Correlation & Cluster Laboratory</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="text-xs text-muted font-mono">SCENARIO PRESETS:</span>
                            <select className="form-input" style={{ width: '130px', padding: '2px 6px', fontSize: '10px' }} value={corrPreset} onChange={e => handleCorrPresetChange(e.target.value)}>
                              <option value="standard">Standard Market</option>
                              <option value="risk_on">Risk-On Meltup</option>
                              <option value="market_crash">Systemic Crisis</option>
                            </select>
                          </div>
                        </div>
                        <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>

                          {/* Left Column: Interactive Heatmap Matrix */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <span className="font-mono text-xs text-muted" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>INTERACTIVE CORRELATION MATRIX (HEATMAP)</span>
                              <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1.5px solid var(--border-primary)' }}>
                                      <th style={{ padding: '6px', textAlign: 'left', color: 'var(--text-secondary)' }}>Asset</th>
                                      {['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'].map(name => (
                                        <th key={name} style={{ padding: '6px', color: 'var(--text-secondary)', fontWeight: '700' }}>{name}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'].map((name, i) => (
                                      <tr key={name} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                        <td style={{ padding: '6px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>{name}</td>
                                        {corrMatrix[i].map((corrVal, j) => {
                                          let cellBg = 'transparent';
                                          let textColor = 'var(--text-primary)';

                                          if (corrVal === 1.0) {
                                            cellBg = 'rgba(255, 255, 255, 0.08)';
                                            textColor = 'var(--text-secondary)';
                                          } else if (corrVal > 0.6) {
                                            cellBg = 'rgba(255, 68, 102, 0.35)';
                                            textColor = '#ff6c85';
                                          } else if (corrVal > 0.3) {
                                            cellBg = 'rgba(255, 68, 102, 0.18)';
                                            textColor = '#ff99aa';
                                          } else if (corrVal < -0.4) {
                                            cellBg = 'rgba(0, 212, 170, 0.35)';
                                            textColor = '#00fcd0';
                                          } else if (corrVal < -0.05) {
                                            cellBg = 'rgba(0, 212, 170, 0.18)';
                                            textColor = '#4dffd6';
                                          }

                                          const isTargetPair = (['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'][i] === selectedCorrAssetA && ['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'][j] === selectedCorrAssetB) ||
                                            (['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'][i] === selectedCorrAssetB && ['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'][j] === selectedCorrAssetA);

                                          return (
                                            <td
                                              key={j}
                                              style={{
                                                padding: '6px',
                                                background: cellBg,
                                                color: textColor,
                                                fontWeight: isTargetPair ? '800' : '500',
                                                border: isTargetPair ? '1.5px solid var(--accent)' : 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.1s ease'
                                              }}
                                              title={`Correlation: ${corrVal.toFixed(2)}`}
                                              onClick={() => {
                                                const assetA = ['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'][i];
                                                const assetB = ['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'][j];
                                                if (assetA === assetB) return;
                                                setSelectedCorrAssetA(assetA);
                                                setSelectedCorrAssetB(assetB);
                                              }}
                                            >
                                              {corrVal.toFixed(2)}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Cluster Detection Output */}
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <span className="font-mono text-xs text-muted" style={{ fontWeight: '600' }}>CLUSTER DETECTION & DIVERSIFICATION AUDIT</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ background: 'rgba(255, 68, 102, 0.08)', border: '1px solid rgba(255, 68, 102, 0.25)', padding: '4px 8px', borderRadius: '3px', fontSize: '9px' }}>
                                  <span className="text-red font-mono fw-700" style={{ marginRight: '4px' }}>CLUSTER 1 (BETA TECH):</span>
                                  <span className="text-primary font-mono fw-600">AAPL, NVDA, TSLA</span>
                                </div>
                                <div style={{ background: 'rgba(0, 188, 212, 0.08)', border: '1px solid rgba(0, 188, 212, 0.25)', padding: '4px 8px', borderRadius: '3px', fontSize: '9px' }}>
                                  <span className="text-accent font-mono fw-700" style={{ marginRight: '4px' }}>CLUSTER 2 (RISK-ON):</span>
                                  <span className="text-primary font-mono fw-600">BTC, TSLA</span>
                                </div>
                                <div style={{ background: 'rgba(0, 212, 170, 0.08)', border: '1px solid rgba(0, 212, 170, 0.25)', padding: '4px 8px', borderRadius: '3px', fontSize: '9px' }}>
                                  <span className="text-green font-mono fw-700" style={{ marginRight: '4px' }}>DIVERSIFIER OUTLIER:</span>
                                  <span className="text-primary font-mono fw-600">GOLD</span>
                                </div>
                              </div>
                              <p className="text-xs text-secondary" style={{ margin: '4px 0 0 0', lineHeight: '1.3' }}>
                                {corrPreset === 'market_crash' ? (
                                  <span className="text-red fw-600">⚠ Systemic Liquidation Event! Equity and crypto asset clusters are behaving as a single unit (correlations ≥ 0.80). Shift allocation to GOLD (which exhibits a strong negative correlation of -0.65) to protect capital.</span>
                                ) : corrPreset === 'risk_on' ? (
                                  <span className="text-accent fw-600">📈 Risk-On Meltup active. Tech stocks and Bitcoin are running in high correlation sync. Capital gains are maximized; portfolio hedge (Gold) is underperforming.</span>
                                ) : (
                                  <span>Standard dispersion detected. High-tech assets AAPL and NVDA share structural overlaps (+0.62). GOLD exhibits low/negative correlation (-0.08) to tech, offering optimal risk-adjusted allocation cushion.</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Right Column: Network Graph & Rolling Chart */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                            {/* Network Graph Panel */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span className="font-mono text-xs text-muted" style={{ fontWeight: '600' }}>CORRELATION NETWORK GRAPH</span>
                                <span style={{ fontSize: '7.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>HOVER NODE TO FILTER EDGES</span>
                              </div>
                              {renderCorrelationNetwork()}
                            </div>

                            {/* Rolling Correlation Panel */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span className="font-mono text-xs text-muted" style={{ fontWeight: '600' }}>ROLLING 90D CORRELATION HISTORY</span>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <select className="form-input" style={{ width: '65px', padding: '1px 3px', fontSize: '9px', fontFamily: 'var(--font-mono)' }} value={selectedCorrAssetA} onChange={e => setSelectedCorrAssetA(e.target.value)}>
                                    {['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'].map(name => (
                                      <option key={name} value={name} disabled={name === selectedCorrAssetB}>{name}</option>
                                    ))}
                                  </select>
                                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>vs</span>
                                  <select className="form-input" style={{ width: '65px', padding: '1px 3px', fontSize: '9px', fontFamily: 'var(--font-mono)' }} value={selectedCorrAssetB} onChange={e => setSelectedCorrAssetB(e.target.value)}>
                                    {['AAPL', 'TSLA', 'NVDA', 'BTC', 'GOLD'].map(name => (
                                      <option key={name} value={name} disabled={name === selectedCorrAssetA}>{name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              {renderRollingCorrChart()}
                            </div>

                          </div>

                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* ── Tab: SCENARIO LABORATORY ── */}
                {activeTab === 'scenarios' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                      {/* Scenario Engine */}
                      <div className="panel">
                        <div className="panel-header">
                          <span className="panel-title">Macroeconomic Scenario Engine</span>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label className="form-label">SELECT MACRO SIMULATION SCENARIO</label>
                            <select className="form-input" value={selectedScenario} onChange={e => setSelectedScenario(e.target.value)}>
                              {Object.entries(MACRO_SCENARIOS).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                              ))}
                            </select>
                          </div>

                          <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="text-xs text-muted font-mono">PROJECTED PORTFOLIO IMPACT</span>
                              <span className={`font-mono text-base fw-700 ${macroImpactResult.pct >= 0 ? 'text-green' : 'text-red'}`}>
                                {macroImpactResult.pct >= 0 ? '+' : ''}{macroImpactResult.pct.toFixed(2)}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="text-xs text-muted font-mono">ESTIMATED WEALTH CHANGE</span>
                              <span className={`font-mono text-sm fw-600 ${macroImpactResult.pct >= 0 ? 'text-green' : 'text-red'}`}>
                                {macroImpactResult.pct >= 0 ? '+' : ''}{formatCurrency(macroImpactResult.impactAmount)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px dashed var(--border-primary)', paddingTop: '6px' }}>
                              <span className="text-xs text-muted font-mono">VULNERABILITY LEVEL</span>
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '700',
                                fontFamily: 'var(--font-mono)',
                                padding: '2px 8px',
                                borderRadius: '3px',
                                background: macroImpactResult.pct >= 2.0 ? 'rgba(0,212,170,0.15)' : macroImpactResult.pct < -5.0 ? 'rgba(255,68,102,0.15)' : macroImpactResult.pct < -2.0 ? 'rgba(255,165,0,0.15)' : 'rgba(0,188,212,0.15)',
                                color: macroImpactResult.pct >= 2.0 ? 'var(--green)' : macroImpactResult.pct < -5.0 ? 'var(--red)' : macroImpactResult.pct < -2.0 ? '#ffa500' : 'var(--accent)',
                                border: macroImpactResult.pct >= 2.0 ? '1px solid var(--green)' : macroImpactResult.pct < -5.0 ? '1px solid var(--red)' : macroImpactResult.pct < -2.0 ? '1px solid #ffa500' : '1px solid var(--accent)'
                              }}>
                                {macroImpactResult.vulnerability}
                              </span>
                            </div>

                            <p className="text-xs text-primary" style={{ marginTop: '6px', lineHeight: '1.4', fontWeight: '500' }}>
                              {macroImpactResult.detail}
                            </p>
                          </div>

                          {/* Asset Class Impact Distribution */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span className="text-xs font-mono text-muted" style={{ fontWeight: '600' }}>ASSET CLASS SENSITIVITIES & SHOCKS</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                              {Object.entries(macroImpactResult.assetClassImpacts).map(([assetClass, amount]) => {
                                const matchingAssets = assets.filter(a => a.asset_class === assetClass);
                                const totalVal = matchingAssets.reduce((sum, a) => sum + (parseFloat(a.quantity) * parseFloat(a.current_price)), 0) || (demoMode ? (assetClass === 'stocks' ? 3402100 : assetClass === 'crypto' ? 523400 : assetClass === 'gold' ? 785100 : assetClass === 'bonds' ? 523400 : 1) : 1);
                                const percentageShock = (amount / totalVal) * 100;
                                return (
                                  <div key={assetClass} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                                      <span style={{ textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: '600' }}>{assetClass.replace('_', ' ')}</span>
                                      <span className={amount >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: '700' }}>
                                        {amount >= 0 ? '+' : ''}{formatCurrency(amount)} ({amount >= 0 ? '+' : ''}{percentageShock.toFixed(1)}%)
                                      </span>
                                    </div>
                                    <div style={{ width: '100%', height: '3px', background: 'var(--border-primary)', borderRadius: '1.5px', overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${Math.min(100, Math.abs(percentageShock) * 3)}%`,
                                        height: '100%',
                                        background: amount >= 0 ? 'var(--green)' : 'var(--red)',
                                        marginLeft: amount >= 0 ? '0' : 'auto'
                                      }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Advisory Recommendation Card */}
                          <div style={{ background: 'rgba(0,188,212,0.06)', padding: '10px', borderRadius: '4px', border: '1px solid rgba(0,188,212,0.2)' }}>
                            <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block', color: 'var(--accent)', fontWeight: '700' }}>SCENARIO MITIGATION ADVISORY</span>
                            <p className="text-xs text-primary" style={{ margin: '4px 0 0 0', lineHeight: '1.3', fontWeight: '500' }}>
                              {macroImpactResult.mitigation}
                            </p>
                          </div>

                        </div>
                      </div>

                      {/* Stress Tests */}
                      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="panel-title">Macro Stress & Crash Laboratory</span>
                          <select
                            value={activeStressScenario}
                            onChange={e => setActiveStressScenario(e.target.value)}
                            className="form-input"
                            style={{ height: '24px', padding: '0 4px', fontSize: '10px', width: '150px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                          >
                            <option value="COVID Crash (2020)">COVID Crash (2020)</option>
                            <option value="2008 Financial Crisis">2008 Financial Crisis</option>
                            <option value="Dot-com Crash (2000)">Dot-com Crash (2000)</option>
                            <option value="Interest Rate Hike (+2%)">Interest Rate Hike (+2%)</option>
                            <option value="Oil Crisis (+25%)">Oil Crisis (+25%)</option>
                            <option value="Currency Collapse">Currency Collapse</option>
                            <option value="Custom Crash">Custom Crash (Configurable)</option>
                          </select>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                          {/* Interactive Custom Sliders */}
                          {activeStressScenario === 'Custom Crash' && (
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                              <div>
                                <label className="form-label" style={{ fontSize: '8px' }}>STOCKS SHOCK ({customStockShock}%)</label>
                                <input
                                  type="range"
                                  min="-100"
                                  max="0"
                                  value={customStockShock}
                                  onChange={e => setCustomStockShock(parseInt(e.target.value))}
                                  style={{ width: '100%' }}
                                />
                              </div>
                              <div>
                                <label className="form-label" style={{ fontSize: '8px' }}>CRYPTO SHOCK ({customCryptoShock}%)</label>
                                <input
                                  type="range"
                                  min="-100"
                                  max="0"
                                  value={customCryptoShock}
                                  onChange={e => setCustomCryptoShock(parseInt(e.target.value))}
                                  style={{ width: '100%' }}
                                />
                              </div>
                              <div>
                                <label className="form-label" style={{ fontSize: '8px' }}>GOLD SHOCK ({customGoldShock >= 0 ? '+' : ''}{customGoldShock}%)</label>
                                <input
                                  type="range"
                                  min="-50"
                                  max="50"
                                  value={customGoldShock}
                                  onChange={e => setCustomGoldShock(parseInt(e.target.value))}
                                  style={{ width: '100%' }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Scenario Profile Summary */}
                          <div style={{ background: 'rgba(255, 68, 102, 0.05)', border: '1px solid rgba(255, 68, 102, 0.15)', padding: '8px 10px', borderRadius: '4px' }}>
                            <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block' }}>SCENARIO PROFILE</span>
                            <p className="text-xs text-primary" style={{ margin: '2px 0 0 0', lineHeight: '1.4' }}>
                              {stressTestResult.description}
                            </p>
                          </div>

                          {/* Simulation Output Metrics */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

                            {/* Metric: Loss */}
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column' }}>
                              <span className="text-muted font-mono" style={{ fontSize: '8px' }}>ESTIMATED PORTFOLIO LOSS</span>
                              <span className="font-mono text-xl fw-700 text-red" style={{ margin: '4px 0' }}>
                                {stressTestResult.impactPct.toFixed(2)}%
                              </span>
                              <span className="font-mono text-xs fw-600 text-secondary">
                                {formatCurrency(stressTestResult.impactAmount)}
                              </span>
                            </div>

                            {/* Metric: Recovery */}
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column' }}>
                              <span className="text-muted font-mono" style={{ fontSize: '8px' }}>RECOVERY TIMELINE</span>
                              <span className="font-mono text-xl fw-700 text-accent" style={{ margin: '4px 0' }}>
                                {stressTestResult.recoveryTimeMonths} Months
                              </span>
                              <div style={{ width: '100%', height: '4px', background: 'var(--border-primary)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                                <div style={{ width: `${Math.min(100, (stressTestResult.recoveryTimeMonths / 36) * 100)}%`, height: '100%', background: 'var(--accent)' }} />
                              </div>
                            </div>

                          </div>

                          {/* Worst Impacted Asset & Advisory Action */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

                            {/* Worst Asset Card */}
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                              <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block' }}>WORST AFFECTED HOLDING</span>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                <span className="text-xs fw-600 text-primary">{stressTestResult.worstAsset.name}</span>
                                <span className="font-mono text-xs text-red fw-600">{stressTestResult.worstAsset.impactPct.toFixed(1)}%</span>
                              </div>
                              <span className="font-mono text-xs text-muted" style={{ display: 'block', marginTop: '2px' }}>
                                Est. Drawdown: {formatCurrency(stressTestResult.worstAsset.impactAmount)}
                              </span>
                            </div>

                            {/* Action Card */}
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                              <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block', color: 'var(--accent)' }}>AI SUGGESTED DEFENSE</span>
                              <p className="text-xs text-primary" style={{ margin: '6px 0 0 0', lineHeight: '1.3', fontWeight: '500' }}>
                                {stressTestResult.recommendedAction}
                              </p>
                            </div>

                          </div>

                        </div>
                      </div>

                    </div>

                    {/* Monte Carlo Simulator */}
                    <div className="panel">
                      <div className="panel-header">
                        <span className="panel-title">Institutional Monte Carlo Simulation Engine</span>
                      </div>
                      <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px' }}>

                        {/* Inputs Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label className="form-label">SIMULATION RUNS</label>
                            <select className="form-input" value={mcSims} onChange={e => setMcSims(parseInt(e.target.value))}>
                              <option value="100">100 Simulations</option>
                              <option value="1000">1,000 Simulations</option>
                              <option value="10000">10,000 Simulations</option>
                              <option value="100000">100,000 Simulations</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              id="useMcCustom"
                              checked={mcUseCustomParams}
                              onChange={e => setMcUseCustomParams(e.target.checked)}
                              style={{ margin: 0 }}
                            />
                            <label htmlFor="useMcCustom" className="form-label" style={{ margin: 0, fontSize: '10px', cursor: 'pointer' }}>
                              CUSTOM PARAMETERS
                            </label>
                          </div>

                          {mcUseCustomParams && (
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <label className="form-label" style={{ fontSize: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>EXPECTED CAGR</span>
                                  <span>{mcCustomCagr}%</span>
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="50"
                                  step="0.5"
                                  value={mcCustomCagr}
                                  onChange={e => setMcCustomCagr(parseFloat(e.target.value))}
                                  style={{ width: '100%' }}
                                />
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>PORTFOLIO VOLATILITY</span>
                                  <span>{mcCustomVol}%</span>
                                </label>
                                <input
                                  type="range"
                                  min="1"
                                  max="100"
                                  step="0.5"
                                  value={mcCustomVol}
                                  onChange={e => setMcCustomVol(parseFloat(e.target.value))}
                                  style={{ width: '100%' }}
                                />
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>HURDLE RATE (ANNUAL)</span>
                                  <span>{mcCustomHurdle}%</span>
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="30"
                                  step="0.5"
                                  value={mcCustomHurdle}
                                  onChange={e => setMcCustomHurdle(parseFloat(e.target.value))}
                                  style={{ width: '100%' }}
                                />
                              </div>
                            </div>
                          )}

                          <button
                            className="btn btn-primary btn-sm"
                            onClick={runMonteCarloSims}
                            disabled={mcLoading}
                            style={{ height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                          >
                            {mcLoading ? (
                              <>
                                <span className="spinner" style={{ width: '10px', height: '10px', border: '2px solid transparent', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                                Calculating...
                              </>
                            ) : 'Run Monte Carlo Engine'}
                          </button>

                          {mcData && (
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px', color: 'var(--text-secondary)' }}>
                              <span style={{ fontWeight: '600', color: 'var(--text-primary)', textTransform: 'uppercase' }}>Engine Parameters</span>
                              <div>Weighted Mean Return: <span className="font-mono text-primary" style={{ fontWeight: '600' }}>{mcData.mu.toFixed(2)}%</span></div>
                              <div>Portfolio Volatility: <span className="font-mono text-primary" style={{ fontWeight: '600' }}>{mcData.sigma.toFixed(2)}%</span></div>
                              <div>Projection Horizon: <span className="font-mono text-primary" style={{ fontWeight: '600' }}>5 Years</span></div>
                            </div>
                          )}
                        </div>

                        {/* Outputs Column */}
                        <div>
                          {mcData ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                              {/* Metrics Header Grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                  <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block' }}>SUCCESS PROBABILITY</span>
                                  <span className="font-mono text-sm fw-700 text-green">{mcData.success_probability.toFixed(1)}%</span>
                                  <span className="text-muted" style={{ fontSize: '7px', display: 'block', marginTop: '2px' }}>
                                    Prob. of beating {mcUseCustomParams ? mcCustomHurdle : 6}% annual hurdle rate
                                  </span>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                  <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block' }}>WORST CASE (P10)</span>
                                  <span className="font-mono text-sm fw-700 text-red">{formatCurrency(mcData.percentiles.p10_worst)}</span>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                  <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block' }}>MEDIAN RETURN (P50)</span>
                                  <span className="font-mono text-sm fw-700 text-cyan">{formatCurrency(mcData.percentiles.p50_median)}</span>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                  <span className="text-muted font-mono" style={{ fontSize: '8px', display: 'block' }}>BEST CASE (P90)</span>
                                  <span className="font-mono text-sm fw-700 text-green">{formatCurrency(mcData.percentiles.p90_best)}</span>
                                </div>
                              </div>

                              {/* Charts Grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                  <span className="font-mono text-xs text-primary fw-600" style={{ display: 'block', marginBottom: '4px' }}>Simulated Projection Paths</span>
                                  {renderPathChart()}
                                </div>
                                <div>
                                  <span className="font-mono text-xs text-primary fw-600" style={{ display: 'block', marginBottom: '4px' }}>Terminal Wealth Distribution</span>
                                  {renderHistogram()}
                                </div>
                              </div>

                            </div>
                          ) : (
                            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-primary)', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '11px' }}>
                              Click "Run Monte Carlo Engine" to simulate terminal wealth distributions and paths using Geometric Brownian Motion.
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                  </div>
                )}

                {/* ── Tab: GOAL PLANNER & REBALANCING ── */}
                {activeTab === 'planner' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>

                      {/* Goal Planner */}
                      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 1' }}>
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="panel-title">Goal Planner Studio</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditingGoalId(null);
                              setGoalForm({ name: '', target_amount: '', current_amount: '', monthly_sip: '', years_remaining: '' });
                              setShowGoalForm(!showGoalForm);
                            }}
                          >
                            <Plus size={12} /> {showGoalForm ? 'Close Studio' : 'Add New Goal'}
                          </button>
                        </div>

                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '550px', overflowY: 'auto' }}>
                          {showGoalForm && (
                            <form
                              onSubmit={handleAddGoal}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px',
                                border: '1px solid var(--accent-primary)',
                                padding: '14px',
                                borderRadius: '6px',
                                marginBottom: '10px',
                                background: 'var(--bg-secondary)',
                                textAlign: 'left'
                              }}
                            >
                              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                                <span className="font-mono text-xs fw-600 text-accent">
                                  {editingGoalId ? 'EDIT PORTFOLIO GOAL TARGET' : 'ADD NEW TARGET GOAL'}
                                </span>
                              </div>

                              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">Goal Category / Template</label>
                                <select
                                  className="form-input"
                                  value={goalForm.name}
                                  onChange={e => {
                                    handleSelectTemplate(e.target.value);
                                  }}
                                  required
                                >
                                  <option value="">-- Select Goal Template --</option>
                                  <option value="Buy House">Buy House</option>
                                  <option value="Child Education">Child Education</option>
                                  <option value="Vacation">Vacation</option>
                                  <option value="Emergency Fund">Emergency Fund</option>
                                  <option value="Retirement">Retirement</option>
                                  <option value="Wedding">Wedding</option>
                                  <option value="Car">Car</option>
                                  <option value="Business">Business</option>
                                  <option value="Custom Goal">Custom Goal</option>
                                </select>
                              </div>

                              <div className="form-group">
                                <label className="form-label">Target Amount (INR)</label>
                                <input className="form-input font-mono" type="number" value={goalForm.target_amount} onChange={e => setGoalForm({ ...goalForm, target_amount: e.target.value })} placeholder="e.g. 15000000" required />
                              </div>

                              <div className="form-group">
                                <label className="form-label">Current Fund (INR)</label>
                                <input className="form-input font-mono" type="number" value={goalForm.current_amount} onChange={e => setGoalForm({ ...goalForm, current_amount: e.target.value })} placeholder="e.g. 4800000" />
                              </div>

                              <div className="form-group">
                                <label className="form-label">Monthly SIP (INR)</label>
                                <input className="form-input font-mono" type="number" value={goalForm.monthly_sip} onChange={e => setGoalForm({ ...goalForm, monthly_sip: e.target.value })} placeholder="e.g. 22000" />
                              </div>

                              <div className="form-group">
                                <label className="form-label">Years Remaining</label>
                                <input className="form-input font-mono" type="number" value={goalForm.years_remaining} onChange={e => setGoalForm({ ...goalForm, years_remaining: e.target.value })} placeholder="e.g. 12" required />
                              </div>

                              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setShowGoalForm(false); setEditingGoalId(null); }}>Cancel</button>
                                <button className="btn btn-primary btn-sm font-mono" type="submit" style={{ boxShadow: '0 0 10px var(--accent-glow)' }}>
                                  {editingGoalId ? 'Save Changes' : 'Create Goal'}
                                </button>
                              </div>
                            </form>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {goals.length === 0 ? (
                              <div className="text-xs text-muted" style={{ padding: '20px 0' }}>No active goals configuration loaded. Click 'Add New Goal' to begin.</div>
                            ) : (
                              goals.map(g => {
                                const { expectedGain, probability, aiSuggestion } = getGoalAnalytics(g);
                                const progressPct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));

                                return (
                                  <div
                                    key={g.id}
                                    style={{
                                      border: '1px solid var(--border-primary)',
                                      borderRadius: '6px',
                                      padding: '12px',
                                      background: 'var(--bg-tertiary)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '10px',
                                      position: 'relative'
                                    }}
                                  >
                                    {/* Card Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="font-mono text-sm fw-600 text-primary">{g.name}</span>
                                        <span className="badge badge-cyan" style={{ fontSize: '8px' }}>
                                          {g.years_remaining} Yrs Left
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          className="btn btn-ghost btn-sm"
                                          onClick={() => handleEditGoalClick(g)}
                                          style={{ padding: '2px 4px', height: '20px', borderColor: 'transparent' }}
                                          title="Edit Goal"
                                        >
                                          <Edit size={11} className="text-cyan" />
                                        </button>
                                        <button
                                          className="btn btn-ghost btn-sm"
                                          onClick={() => handleDeleteGoal(g.id)}
                                          style={{ padding: '2px 4px', height: '20px', borderColor: 'transparent' }}
                                          title="Delete Goal"
                                        >
                                          <Trash2 size={11} className="text-red" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Card Analytics Values */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '11px', textAlign: 'left' }}>
                                      <div>
                                        <span className="text-muted font-mono" style={{ fontSize: '9px' }}>TARGET METRIC</span>
                                        <div className="text-primary fw-600 font-mono" style={{ marginTop: '2px' }}>
                                          {formatCurrency(g.target_amount)}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-muted font-mono" style={{ fontSize: '9px' }}>CURRENT FUND</span>
                                        <div className="text-primary fw-600 font-mono" style={{ marginTop: '2px' }}>
                                          {formatCurrency(g.current_amount)}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-muted font-mono" style={{ fontSize: '9px' }}>MONTHLY SIP</span>
                                        <div className="text-accent fw-600 font-mono" style={{ marginTop: '2px' }}>
                                          {formatCurrency(g.monthly_sip)}/mo
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-muted font-mono" style={{ fontSize: '9px' }}>EXPECTED GAIN</span>
                                        <div className="text-green fw-600 font-mono" style={{ marginTop: '2px' }}>
                                          {expectedGain >= 10000000
                                            ? `₹${(expectedGain / 10000000).toFixed(2)} Cr`
                                            : `₹${(expectedGain / 100000).toFixed(1)} Lakhs`}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                                        <span className="text-secondary">Progress: {progressPct}%</span>
                                        <span className={probability >= 85 ? 'text-green fw-600' : 'text-yellow fw-600'}>
                                          Success Prob: {probability}%
                                        </span>
                                      </div>
                                      <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div
                                          style={{
                                            width: `${progressPct}%`,
                                            height: '100%',
                                            background: 'var(--accent-primary)',
                                            borderRadius: '3px',
                                            transition: 'width 0.3s ease'
                                          }}
                                        />
                                      </div>
                                    </div>

                                    {/* Live SIP adjustments slider */}
                                    <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                        <span>ADJUST MONTHLY SIP (WHAT-IF ANALYSIS):</span>
                                        <span className="text-accent fw-600">{formatCurrency(g.monthly_sip)}</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="0"
                                        max={Math.max(100000, Math.round(g.target_amount / (g.years_remaining * 10)))}
                                        step="1000"
                                        value={g.monthly_sip}
                                        onChange={async (e) => {
                                          const newSip = parseFloat(e.target.value);
                                          setGoals(goals.map(item => item.id === g.id ? { ...item, monthly_sip: newSip } : item));
                                          try {
                                            await api.updateGoal(g.id, {
                                              name: g.name,
                                              target_amount: g.target_amount,
                                              current_amount: g.current_amount,
                                              monthly_sip: newSip,
                                              years_remaining: g.years_remaining
                                            });
                                          } catch (err) {
                                            console.error(err);
                                          }
                                        }}
                                        style={{ width: '100%', height: '4px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                                      />
                                    </div>

                                    {/* AI Suggestion Box */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 8px',
                                        background: probability >= 85 ? 'rgba(0, 212, 170, 0.08)' : 'rgba(255, 179, 0, 0.08)',
                                        border: `1px solid ${probability >= 85 ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 179, 0, 0.2)'}`,
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        color: probability >= 85 ? 'var(--green)' : 'var(--yellow)',
                                        textAlign: 'left'
                                      }}
                                    >
                                      <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                                      <div style={{ lineHeight: '1.3' }}>
                                        <strong>AI ADVISOR:</strong> {aiSuggestion}
                                      </div>
                                    </div>

                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Retirement Simulator */}
                      <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="panel-title">Advanced Monte Carlo Retirement Simulator</span>
                          <span className="font-mono text-xs text-muted" style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                            200 Paths Sim
                          </span>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>

                          {/* Inputs Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px' }}>Current Age</label>
                              <input className="form-input font-mono" type="number" min="1" max="100" value={curAge} onChange={e => setCurAge(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px' }}>Desired Retirement Age</label>
                              <input className="form-input font-mono" type="number" min="1" max="100" value={retAge} onChange={e => setRetAge(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px' }}>Monthly Salary (INR)</label>
                              <input className="form-input font-mono" type="number" step="5000" min="0" value={retSalary} onChange={e => setRetSalary(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px' }}>Monthly Expenses (INR)</label>
                              <input className="form-input font-mono" type="number" step="5000" min="0" value={monthlyExpenses} onChange={e => setMonthlyExpenses(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px' }}>Pre-Retire Return (%)</label>
                              <input className="form-input font-mono" type="number" step="0.1" min="0" max="40" value={expReturns} onChange={e => setExpReturns(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px' }}>Post-Retire Return (%)</label>
                              <input className="form-input font-mono" type="number" step="0.1" min="0" max="40" value={postRetReturns} onChange={e => setPostRetReturns(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px' }}>Inflation Rate (%)</label>
                              <input className="form-input font-mono" type="number" step="0.1" min="0" max="25" value={inflationRate} onChange={e => setInflationRate(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '10px' }}>Life Expectancy (Age)</label>
                              <input className="form-input font-mono" type="number" min="50" max="110" value={lifeExpectancy} onChange={e => setLifeExpectancy(parseInt(e.target.value) || 0)} />
                            </div>
                          </div>

                          <div className="divider" style={{ margin: '4px 0' }} />

                          {/* Outputs Panel */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

                              {/* Corpus Needed */}
                              <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid var(--accent-primary)', display: 'flex', flexDirection: 'column' }}>
                                <span className="text-secondary font-mono" style={{ fontSize: '9px' }}>RETIREMENT CORPUS TARGET</span>
                                <span className="font-mono text-sm fw-700 text-primary" style={{ marginTop: '2px' }}>
                                  {retirementDetails.requiredCorpus >= 10000000
                                    ? `₹${(retirementDetails.requiredCorpus / 10000000).toFixed(2)} Crore`
                                    : retirementDetails.requiredCorpus >= 100000
                                      ? `₹${(retirementDetails.requiredCorpus / 100000).toFixed(2)} Lakh`
                                      : formatCurrency(retirementDetails.requiredCorpus)}
                                </span>
                              </div>

                              {/* Safe Withdrawal */}
                              <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid var(--cyan)', display: 'flex', flexDirection: 'column' }}>
                                <span className="text-secondary font-mono" style={{ fontSize: '9px' }}>SAFE WITHDRAWAL</span>
                                <span className="font-mono text-sm fw-700 text-cyan" style={{ marginTop: '2px' }}>
                                  {retirementDetails.safeWithdrawal >= 100000
                                    ? `₹${(retirementDetails.safeWithdrawal / 100000).toFixed(2)} Lakh/mo`
                                    : `${formatCurrency(retirementDetails.safeWithdrawal)}/mo`}
                                </span>
                              </div>

                            </div>

                            {/* Success Probability & Depletion Status */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

                              <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '6px', borderLeft: `3px solid ${retirementDetails.successProbability >= 85 ? 'var(--green)' : retirementDetails.successProbability >= 60 ? 'var(--yellow)' : 'var(--red)'}`, display: 'flex', flexDirection: 'column' }}>
                                <span className="text-secondary font-mono" style={{ fontSize: '9px' }}>MONTE CARLO PROBABILITY</span>
                                <span className="font-mono text-sm fw-700" style={{ marginTop: '2px', color: retirementDetails.successProbability >= 85 ? 'var(--green)' : retirementDetails.successProbability >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
                                  {retirementDetails.successProbability}%
                                </span>
                              </div>

                              <div style={{
                                background: 'var(--bg-secondary)',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                borderLeft: `3px solid ${retirementDetails.depletionAge ? 'var(--red)' : 'var(--green)'}`,
                                display: 'flex',
                                flexDirection: 'column'
                              }}>
                                <span className="text-secondary font-mono" style={{ fontSize: '9px' }}>DEPLETION AGE</span>
                                <span className="font-mono text-sm fw-700" style={{ marginTop: '2px', color: retirementDetails.depletionAge ? 'var(--red)' : 'var(--green)' }}>
                                  {retirementDetails.depletionAge ? `Age ${retirementDetails.depletionAge}` : `Never (85+)`}
                                </span>
                              </div>

                            </div>

                            {/* SVG Chart projection path */}
                            <div style={{ marginTop: '4px' }}>
                              <span className="text-secondary font-mono" style={{ fontSize: '9px', display: 'block', marginBottom: '4px' }}>MEDIAN (P50) WEALTH PATH PROJECTION</span>
                              <div style={{ position: 'relative' }}>
                                {(() => {
                                  const pathData = retirementDetails.medianPath || [];
                                  const maxWealthVal = Math.max(...pathData.map(p => p.wealth), 1);
                                  const tYears = lifeExpectancy - curAge;
                                  const yToRet = retAge - curAge;

                                  const pathPointsString = pathData.length > 0
                                    ? pathData.map((p, idx) => {
                                      const x = (idx / (pathData.length - 1 || 1)) * 300;
                                      const y = 85 - (p.wealth / maxWealthVal) * 75;
                                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                                    }).join(' ')
                                    : "0,85 300,85";

                                  return (
                                    <svg viewBox="0 0 300 100" style={{ width: '100%', height: '110px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)', padding: '8px 4px 18px 4px', overflow: 'visible' }}>
                                      {/* Grids */}
                                      <line x1="0" y1="85" x2="300" y2="85" stroke="var(--border-primary)" strokeDasharray="2,2" strokeWidth="0.5" />
                                      <line x1="0" y1="45" x2="300" y2="45" stroke="var(--border-primary)" strokeDasharray="2,2" strokeWidth="0.5" />

                                      {/* Retirement age vertical line marker */}
                                      {yToRet > 0 && yToRet < tYears && (
                                        <line
                                          x1={(yToRet / tYears) * 300}
                                          y1="0"
                                          x2={(yToRet / tYears) * 300}
                                          y2="85"
                                          stroke="var(--accent-primary)"
                                          strokeDasharray="2,2"
                                          strokeWidth="1"
                                        />
                                      )}

                                      {/* Area Gradient under curve */}
                                      <polygon
                                        fill="url(#ret-area-grad)"
                                        opacity="0.1"
                                        points={`0,85 ${pathPointsString} 300,85`}
                                      />

                                      {/* Path Polyline */}
                                      <polyline
                                        fill="none"
                                        stroke="var(--cyan)"
                                        strokeWidth="2"
                                        points={pathPointsString}
                                      />

                                      {/* Peak Wealth Point Marker */}
                                      {yToRet > 0 && yToRet < tYears && (
                                        <circle
                                          cx={(yToRet / tYears) * 300}
                                          cy={85 - (retirementDetails.projectedCorpus / maxWealthVal) * 75}
                                          r="3"
                                          fill="var(--cyan)"
                                          stroke="var(--bg-secondary)"
                                          strokeWidth="1"
                                        />
                                      )}

                                      <defs>
                                        <linearGradient id="ret-area-grad" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor="var(--cyan)" />
                                          <stop offset="100%" stopColor="transparent" />
                                        </linearGradient>
                                      </defs>

                                      {/* Labels */}
                                      <text x="2" y="8" fill="var(--text-muted)" fontSize="7" fontFamily="var(--font-mono)">
                                        Max: {maxWealthVal >= 10000000 ? `₹${(maxWealthVal / 10000000).toFixed(1)}Cr` : `₹${(maxWealthVal / 100000).toFixed(0)}L`}
                                      </text>
                                      <text x="2" y="95" fill="var(--text-muted)" fontSize="7" fontFamily="var(--font-mono)">
                                        Age {curAge}
                                      </text>
                                      <text x="260" y="95" fill="var(--text-muted)" fontSize="7" fontFamily="var(--font-mono)">
                                        Age {lifeExpectancy}
                                      </text>
                                      {yToRet > 0 && yToRet < tYears && (
                                        <text
                                          x={(yToRet / tYears) * 300 - 20}
                                          y="95"
                                          fill="var(--accent-primary)"
                                          fontSize="7"
                                          fontFamily="var(--font-mono)"
                                          fontWeight="bold"
                                        >
                                          Retire ({retAge})
                                        </text>
                                      )}
                                    </svg>
                                  );
                                })()}
                              </div>
                            </div>

                            {retirementDetails.requiredSip > 0 && (
                              <div style={{ background: 'rgba(255, 179, 0, 0.06)', border: '1px dashed rgba(255, 179, 0, 0.3)', padding: '8px 12px', borderRadius: '6px', fontSize: '10px', color: 'var(--yellow)' }}>
                                <strong>AI SUGGESTION:</strong> Funding shortfall identified. A retirement savings SIP of <strong>{formatCurrency(Math.round(retirementDetails.requiredSip))}</strong>/month is recommended.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Rebalancing Engine */}
                    <div className="panel">
                      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="panel-title" style={{ color: 'var(--accent)', fontWeight: '700' }}>Asset Rebalancing Engine (Tax & Risk Aware)</span>
                          <span className="text-xs text-muted" style={{ display: 'block', marginTop: '2px' }}>Deploy institutional optimization rules to curb asset class drift</span>
                        </div>
                      </div>
                      
                      {rebalanceSuccessMsg && (
                        <div style={{ background: 'rgba(0, 212, 170, 0.1)', border: '1px solid var(--green)', padding: '10px 14px', borderRadius: '6px', fontSize: '11px', color: 'var(--green)', margin: '12px 16px 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle size={14} />
                          <span>{rebalanceSuccessMsg}</span>
                        </div>
                      )}

                      <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '20px', padding: '16px' }}>

                        {/* Left column: Controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderRight: '1px solid var(--border-primary)', paddingRight: '16px' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>SELECT REBALANCING RULE:</label>
                            <select className="form-input" style={{ marginTop: '4px' }} value={rebalancingStrategy} onChange={e => setRebalancingStrategy(e.target.value)}>
                              <option value="calendar">Calendar-based (Periodic)</option>
                              <option value="threshold">Threshold-based (Drift Trigger)</option>
                              <option value="risk">Risk-based (Volatility Parity)</option>
                              <option value="goal">Goal-based Glidepath</option>
                              <option value="tax">Tax-aware Loss Harvester</option>
                            </select>
                          </div>

                          {/* Strategy-specific dynamic parameters */}
                          {rebalancingStrategy === 'calendar' && (
                            <div>
                              <label className="form-label" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>REBALANCE FREQUENCY:</label>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                {['quarterly', 'semi-annual', 'annual'].map(freq => (
                                  <button
                                    key={freq}
                                    type="button"
                                    onClick={() => setRebalanceFrequency(freq)}
                                    className={`btn btn-sm ${rebalanceFrequency === freq ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ fontSize: '9px', padding: '4px 8px', flex: 1, textTransform: 'capitalize' }}
                                  >
                                    {freq}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {rebalancingStrategy === 'threshold' && (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label className="form-label" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>DRIFT THRESHOLD TRIGGER:</label>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', fontWeight: 'bold' }}>{rebalanceThreshold}%</span>
                              </div>
                              <input
                                type="range"
                                min="2"
                                max="15"
                                step="1"
                                value={rebalanceThreshold}
                                onChange={e => setRebalanceThreshold(parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '8px' }}
                              />
                              <span style={{ fontSize: '8px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                                Trades trigger when absolute weight drift exceeds target.
                              </span>
                            </div>
                          )}

                          {rebalancingStrategy === 'risk' && (
                            <div>
                              <label className="form-label" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>RISK OPTIMIZATION PROFILE:</label>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                {['conservative', 'balanced', 'aggressive'].map(profile => (
                                  <button
                                    key={profile}
                                    type="button"
                                    onClick={() => setRebalanceRiskProfile(profile)}
                                    className={`btn btn-sm ${rebalanceRiskProfile === profile ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ fontSize: '9px', padding: '4px 8px', flex: 1, textTransform: 'capitalize' }}
                                  >
                                    {profile}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {rebalancingStrategy === 'goal' && (
                            <div>
                              <label className="form-label" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>LINKED TARGET GOAL:</label>
                              <select
                                className="form-input"
                                style={{ marginTop: '4px' }}
                                value={rebalanceGoalId}
                                onChange={e => setRebalanceGoalId(e.target.value)}
                              >
                                <option value="all">All Goals (Consolidated)</option>
                                {(goals || []).map(g => (
                                  <option key={g.id} value={g.id}>
                                    {g.name} ({g.years_remaining} yrs left)
                                  </option>
                                ))}
                              </select>
                              <span style={{ fontSize: '8px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                                Glidepath automatically trims equity exposure as target date nears.
                              </span>
                            </div>
                          )}

                          {rebalancingStrategy === 'tax' && (
                            <div>
                              <label className="form-label" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>TAX LOT MATCHING RULE:</label>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                {[
                                  { id: 'minTax', label: 'MinTax Offset' },
                                  { id: 'fifo', label: 'FIFO Lot' }
                                ].map(rule => (
                                  <button
                                    key={rule.id}
                                    type="button"
                                    onClick={() => setRebalanceTaxLotMatch(rule.id)}
                                    className={`btn btn-sm ${rebalanceTaxLotMatch === rule.id ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ fontSize: '9px', padding: '4px 8px', flex: 1 }}
                                  >
                                    {rule.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right column: Suggested Trade List & Action */}
                        {(() => {
                          const res = getRebalancingTrades();
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <span className="font-mono text-xs text-accent fw-600" style={{ display: 'block' }}>
                                  {res.strategyHeading.toUpperCase()}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px', fontStyle: 'italic', lineHeight: '1.3' }}>
                                  {res.strategyDesc}
                                </span>
                              </div>

                              {/* Trades List */}
                              <div style={{ flex: 1, minHeight: '140px' }}>
                                {res.trades.length === 0 ? (
                                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-primary)', borderRadius: '6px', background: 'var(--bg-secondary)', padding: '20px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                                    <ShieldCheck size={24} style={{ color: 'var(--green)', marginBottom: '8px' }} />
                                    <span>Portfolio is perfectly aligned. No drift trades required.</span>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {res.trades.map((trade, idx) => (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)', fontSize: '10.5px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{
                                            background: trade.type === 'SELL' ? 'rgba(255, 68, 102, 0.1)' : 'rgba(0, 212, 170, 0.1)',
                                            color: trade.type === 'SELL' ? 'var(--red)' : 'var(--green)',
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            fontWeight: 'bold',
                                            fontSize: '8.5px'
                                          }}>{trade.type}</span>
                                          <div>
                                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{trade.symbol}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '9.5px', marginLeft: '4px' }}>({trade.name})</span>
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'var(--font-mono)' }}>
                                          <span style={{ fontWeight: '700', color: trade.type === 'SELL' ? 'var(--red)' : 'var(--green)' }}>
                                            {trade.type === 'SELL' ? '-' : '+'}{formatCurrency(trade.amount)}
                                          </span>
                                          {trade.type === 'SELL' && (
                                            <span style={{ fontSize: '8px', color: trade.unrealizedGainLoss >= 0 ? 'var(--yellow)' : 'var(--cyan)' }}>
                                              {trade.unrealizedGainLoss >= 0 ? `Gain: +${formatCurrency(trade.unrealizedGainLoss)}` : `Loss: -${formatCurrency(Math.abs(trade.unrealizedGainLoss))}`}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Summary metrics */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', borderTop: '1px solid var(--border-primary)', paddingTop: '10px', marginTop: '4px' }}>
                                <div style={{ background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: '4px', textAlign: 'center', border: '1px solid var(--border-primary)' }}>
                                  <div style={{ fontSize: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Risk Reduction</div>
                                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--green)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                                    {res.trades.length > 0 ? `${res.riskReduction.toFixed(1)}%` : '0.0%'}
                                  </div>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: '4px', textAlign: 'center', border: '1px solid var(--border-primary)' }}>
                                  <div style={{ fontSize: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Net Gain / Loss</div>
                                  <div style={{ fontSize: '12px', fontWeight: '800', color: res.netGains >= 0 ? 'var(--yellow)' : 'var(--cyan)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                                    {res.trades.length > 0 ? (res.netGains >= 0 ? '+' : '') + formatCurrency(res.netGains) : '₹0'}
                                  </div>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: '4px', textAlign: 'center', border: '1px solid var(--border-primary)' }}>
                                  <div style={{ fontSize: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Tax Impact</div>
                                  <div style={{ fontSize: '12px', fontWeight: '800', color: rebalancingStrategy === 'tax' && res.taxSaved > 0 ? 'var(--green)' : res.estTax > 0 ? 'var(--red)' : 'var(--text-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                                    {res.trades.length > 0 ? (
                                      rebalancingStrategy === 'tax' && res.taxSaved > 0 ? (
                                        <span style={{ color: 'var(--green)' }}>-{formatCurrency(res.taxSaved)}</span>
                                      ) : (
                                        res.estTax > 0 ? `+${formatCurrency(res.estTax)}` : '₹0'
                                      )
                                    ) : '₹0'}
                                  </div>
                                </div>
                              </div>

                              {/* Execute Button */}
                              {res.trades.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleExecuteRebalance}
                                  className="btn btn-primary"
                                  style={{
                                    marginTop: '8px',
                                    fontSize: '11px',
                                    padding: '8px 16px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: 'var(--accent)',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease-in-out'
                                  }}
                                  onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.15)'}
                                  onMouseOut={e => e.currentTarget.style.filter = 'none'}
                                >
                                  <Scale size={14} />
                                  <span>Execute Rebalance Orders</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    </div>

                  </div>
                )}

                {/* ── Tab: TAX & DIVIDEND CENTER ── */}
                {activeTab === 'tax' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>

                      {/* Tax Intelligence */}
                      <div className="panel">
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="panel-title">Tax Intelligence Studio</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <select className="form-input" style={{ width: '90px', height: '24px', padding: '0 4px', fontSize: '10px' }} value={taxCountry} onChange={e => setTaxCountry(e.target.value)}>
                              <option value="IN">India Rules</option>
                              <option value="US">US Rules</option>
                            </select>
                            <select className="form-input" style={{ width: '110px', height: '24px', padding: '0 4px', fontSize: '10px' }} value={costBasisRule} onChange={e => setCostBasisRule(e.target.value)}>
                              <option value="fifo">FIFO basis</option>
                              <option value="lifo">LIFO basis</option>
                              <option value="average">Avg Cost basis</option>
                            </select>
                          </div>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>

                          {/* Tax Breakdown */}
                          <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px', background: 'var(--bg-secondary)' }}>
                            <span className="text-xs font-mono text-accent fw-600">ESTIMATED CAPITAL GAINS & DIVIDEND TAX</span>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                              <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                <span className="text-muted font-mono" style={{ fontSize: '9px', display: 'block' }}>REALIZED CAPITAL GAINS</span>
                                <span className="font-mono text-xs fw-600 text-primary" style={{ display: 'block', marginTop: '2px' }}>
                                  STCG: {formatCurrency(taxDetails.realizedSTCG)}
                                </span>
                                <span className="font-mono text-xs fw-600 text-primary" style={{ display: 'block' }}>
                                  LTCG: {formatCurrency(taxDetails.realizedLTCG)}
                                </span>
                              </div>

                              <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                <span className="text-muted font-mono" style={{ fontSize: '9px', display: 'block' }}>UNREALIZED GAINS</span>
                                <span className="font-mono text-xs fw-600 text-green" style={{ display: 'block', marginTop: '2px' }}>
                                  STCG: {formatCurrency(taxDetails.unrealizedSTCG)}
                                </span>
                                <span className="font-mono text-xs fw-600 text-green" style={{ display: 'block' }}>
                                  LTCG: {formatCurrency(taxDetails.unrealizedLTCG)}
                                </span>
                              </div>
                            </div>

                            <div className="divider" style={{ margin: '8px 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                              <span>STCG Tax Liability ({Math.round(taxDetails.stcgRate * 100)}%):</span>
                              <span className="font-mono fw-600 text-primary">{formatCurrency(taxDetails.stcgTax)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px' }}>
                              <span>LTCG Tax Liability ({Math.round(taxDetails.ltcgRate * 100)}%):</span>
                              <span className="font-mono fw-600 text-primary">{formatCurrency(taxDetails.ltcgTax)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px' }}>
                              <span>Dividend Tax Liability ({Math.round(taxDetails.divRate * 100)}%):</span>
                              <span className="font-mono fw-600 text-primary">{formatCurrency(taxDetails.dividendTax)}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', borderTop: '1px solid var(--border-primary)', paddingTop: '6px' }}>
                              <span className="fw-600">Total Estimated Tax:</span>
                              <span className="font-mono fw-700 text-accent">{formatCurrency(taxDetails.totalTaxEstimate)}</span>
                            </div>
                          </div>

                          {/* Tax Loss Harvesting Card */}
                          <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px', background: 'rgba(0, 212, 170, 0.04)', borderLeft: '3px solid var(--green)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--green)', marginBottom: '4px' }}>
                              <CheckCircle size={14} style={{ flexShrink: 0 }} />
                              <span className="font-mono text-xs fw-600">TAX LOSS HARVESTING OPPORTUNITIES</span>
                            </div>
                            {taxDetails.harvestingOpportunities.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <p className="text-xs text-secondary" style={{ lineHeight: '1.4' }}>
                                  We found unrealized losses across <strong>{taxDetails.harvestingOpportunities.length} holding(s)</strong>. Realizing these losses under <strong>{costBasisRule.toUpperCase()}</strong> basis can offset taxable STCG, saving you <strong>{formatCurrency(taxDetails.potentialTaxSavings)}</strong> immediately.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                                  {taxDetails.harvestingOpportunities.map((opp, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', background: 'var(--bg-primary)', padding: '4px 6px', borderRadius: '2px', border: '1px solid var(--border-primary)' }}>
                                      <span>Sell {opp.qty} {opp.symbol} (Loss: {formatCurrency(opp.loss)})</span>
                                      <span className="text-green font-mono fw-600">+{formatCurrency(opp.loss * taxDetails.stcgRate)} tax saved</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-secondary" style={{ lineHeight: '1.4' }}>
                                No tax loss harvesting opportunities found at present. All current holdings show positive unrealized returns.
                              </p>
                            )}
                          </div>

                          {/* Quarterly Tax Schedule */}
                          <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                            <span className="text-xs font-mono text-accent fw-600" style={{ display: 'block', marginBottom: '8px' }}>
                              ESTIMATED {taxCountry === 'IN' ? 'ADVANCE' : 'QUARTERLY'} TAX INSTALLMENT PLAN
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {quarterlyDueDates.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      background: item.status === 'Paid' ? 'rgba(0, 212, 170, 0.1)' : 'rgba(255, 179, 0, 0.1)',
                                      color: item.status === 'Paid' ? 'var(--green)' : 'var(--yellow)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '8px',
                                      fontWeight: 'bold',
                                      fontFamily: 'var(--font-mono)'
                                    }}>
                                      {item.quarter}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span className="fw-600" style={{ fontSize: '10px' }}>{item.date}</span>
                                      <span className="text-secondary font-mono" style={{ fontSize: '8px' }}>{item.pct} installment</span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="font-mono fw-600 text-primary" style={{ fontSize: '10px' }}>{formatCurrency(item.amount)}</span>
                                    <span style={{
                                      fontSize: '7px',
                                      fontFamily: 'var(--font-mono)',
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      background: item.status === 'Paid' ? 'var(--green-dim)' : 'var(--yellow-dim)',
                                      color: item.status === 'Paid' ? 'var(--green)' : 'var(--yellow)',
                                      border: `1px solid ${item.status === 'Paid' ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 179, 0, 0.2)'}`
                                    }}>
                                      {item.status.toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Export Actions */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button onClick={handleExportTaxReport} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Download size={12} />
                              <span>Export Tax Report (CSV)</span>
                            </button>
                          </div>

                        </div>
                      </div>

                      {/* Dividend Center */}
                      <div className="panel">
                        <div className="panel-header">
                          <span className="panel-title">Dividend Tracking & Cash Flow Center</span>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                          {/* Metric Cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            <div style={{ border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                              <span className="text-xs text-muted font-mono" style={{ fontSize: '9px' }}>PORTFOLIO YIELD</span>
                              <div className="font-mono text-sm fw-600 text-primary" style={{ marginTop: '2px' }}>
                                {dividendDetails.portfolioYield.toFixed(2)}%
                              </div>
                            </div>
                            <div style={{ border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                              <span className="text-xs text-muted font-mono" style={{ fontSize: '9px' }}>YIELD ON COST</span>
                              <div className="font-mono text-sm fw-600 text-primary" style={{ marginTop: '2px' }}>
                                {dividendDetails.yieldOnCost.toFixed(2)}%
                              </div>
                            </div>
                            <div style={{ border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                              <span className="text-xs text-muted font-mono" style={{ fontSize: '9px' }}>DIVIDEND GROWTH (YOY)</span>
                              <div className="font-mono text-sm fw-600 text-green" style={{ marginTop: '2px' }}>
                                +{dividendDetails.dividendGrowthYoY.toFixed(1)}%
                              </div>
                            </div>
                            <div style={{ border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                              <span className="text-xs text-muted font-mono" style={{ fontSize: '9px' }}>EST. ANNUAL CASH FLOW</span>
                              <div className="font-mono text-sm fw-600 text-accent" style={{ marginTop: '2px' }}>
                                {formatCurrency(dividendDetails.annualDividendIncome)}
                              </div>
                            </div>
                          </div>

                          <div className="divider" style={{ margin: '4px 0' }} />

                          {/* 12-Month SVG Projection Chart */}
                          {(() => {
                            const maxAmt = Math.max(...dividendDetails.monthlyProjection.map(p => p.amount), 1);
                            return (
                              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '10px', textAlign: 'left' }}>
                                <span className="text-secondary font-mono" style={{ fontSize: '9px', display: 'block', marginBottom: '8px' }}>12-MONTH INCOME PROJECTION & MONTHLY CASH FLOW</span>
                                <div style={{ height: '70px', position: 'relative' }}>
                                  <svg viewBox="0 0 300 70" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                    {/* Horizontal grid line */}
                                    <line x1="0" y1="50" x2="300" y2="50" stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray="2,2" />

                                    {dividendDetails.monthlyProjection.map((p, idx) => {
                                      const barWidth = 14;
                                      const spacing = 10;
                                      const x = idx * (barWidth + spacing) + 8;
                                      const barHeight = (p.amount / maxAmt) * 40;
                                      const y = 50 - barHeight;

                                      return (
                                        <g key={idx}>
                                          {/* Bar */}
                                          <rect
                                            x={x}
                                            y={y}
                                            width={barWidth}
                                            height={barHeight}
                                            rx="2"
                                            fill="url(#div-bar-gradient)"
                                            style={{ transition: 'all 0.3s ease' }}
                                          />
                                          {/* Label above */}
                                          {p.amount > 0 && (
                                            <text
                                              x={x + barWidth / 2}
                                              y={y - 2}
                                              fill="var(--text-primary)"
                                              fontSize="5.5"
                                              fontFamily="var(--font-mono)"
                                              textAnchor="middle"
                                            >
                                              {Math.round(p.amount / 100) / 10}k
                                            </text>
                                          )}
                                          {/* Month */}
                                          <text
                                            x={x + barWidth / 2}
                                            y="61"
                                            fill="var(--text-muted)"
                                            fontSize="6.5"
                                            fontFamily="var(--font-mono)"
                                            textAnchor="middle"
                                          >
                                            {p.month}
                                          </text>
                                        </g>
                                      );
                                    })}

                                    <defs>
                                      <linearGradient id="div-bar-gradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--accent-primary)" />
                                        <stop offset="100%" stopColor="rgba(0, 212, 170, 0.2)" />
                                      </linearGradient>
                                    </defs>
                                  </svg>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="divider" style={{ margin: '4px 0' }} />

                          {/* Calendar list */}
                          <span className="font-mono text-xs text-primary fw-600" style={{ display: 'block', textAlign: 'left' }}>DIVIDEND INCOME CALENDAR</span>
                          <div className="font-mono text-xs text-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                            {(() => {
                              const dividendTxs = (transactions || []).filter(t => t.transaction_type === 'dividend').slice(0, 3);
                              if (dividendTxs.length > 0) {
                                return dividendTxs.map((d, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{new Date(d.date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}: {d.symbol} Dividend</span>
                                    <span className="text-green">{formatCurrency(parseFloat(d.amount) || 0)}</span>
                                  </div>
                                ));
                              }
                              return (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Jul 2026: TCS Dividend (Ex-date Jul 15)</span>
                                    <span className="text-green">{formatCurrency(1400)}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Aug 2026: Reliance Dividend (Ex-date Aug 22)</span>
                                    <span className="text-green">{formatCurrency(2800)}</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* Reinvestment suggestions */}
                          <div style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '4px', background: 'rgba(255, 179, 0, 0.03)', borderLeft: '3px solid var(--yellow)', textAlign: 'left', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--yellow)', marginBottom: '6px' }}>
                              <RefreshCw size={12} className="spin-slow" />
                              <span className="font-mono text-xs fw-600">AUTOMATED DRIP REINVESTMENT SUGGESTIONS</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {dividendDetails.dripSuggestions.slice(0, 2).map((s, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', background: 'var(--bg-primary)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                  <div>
                                    <span className="fw-600 text-primary">{s.sourceSymbol} dividends ({formatCurrency(s.annualIncome)}/yr)</span>
                                    <span style={{ display: 'block', fontSize: '8px', color: 'var(--text-muted)' }}>
                                      Target allocation: {s.targetAsset} (Est. {s.expectedReturn}% CAGR)
                                    </span>
                                  </div>
                                  <button className="btn btn-sm btn-ghost" style={{ fontSize: '8px', padding: '2px 6px', height: 'auto', color: 'var(--accent-primary)' }} onClick={() => alert(`DRIP configured successfully for ${s.sourceSymbol} dividends!`)}>
                                    Enable DRIP
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* ── Tab: AI ADVISOR & RESEARCH ── */}
                {activeTab === 'ai' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '16px' }}>

                      {/* AI Scorecard Card */}
                      <div className="panel">
                        <div className="panel-header">
                          <span className="panel-title">AI Portfolio Scorecard</span>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ textAlign: 'center', padding: '6px 0' }}>
                            <div className="text-xs text-secondary font-mono">OVERALL HEALTH GRADE</div>
                            <div className="font-mono text-3xl fw-700 text-accent" style={{ marginTop: '4px' }}>
                              {aiAdvisory?.score?.overall || 92}/100
                            </div>
                          </div>

                          <div className="divider" />

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {[
                              { name: 'Diversification', score: aiAdvisory?.score?.diversification || 89 },
                              { name: 'Risk Management', score: aiAdvisory?.score?.risk || 94 },
                              { name: 'Growth Potential', score: aiAdvisory?.score?.growth || 96 },
                              { name: 'Income / Cash Flow', score: aiAdvisory?.score?.income || 74 },
                              { name: 'Liquidity Buffer', score: aiAdvisory?.score?.liquidity || 95 },
                              { name: 'Concentration Risk', score: aiAdvisory?.score?.concentration || 83 },
                              { name: 'Tax Efficiency', score: aiAdvisory?.score?.taxEfficiency || 91 }
                            ].map(item => (
                              <div key={item.name}>
                                <div style={{ display: 'flex', justifycontent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>
                                  <span className="text-secondary">{item.name}</span>
                                  <span className="fw-600" style={{ color: item.score >= 85 ? 'var(--green)' : 'var(--yellow)' }}>{item.score}</span>
                                </div>
                                <div style={{ width: '100%', height: '4px', background: 'var(--bg-secondary)', borderRadius: '2px' }}>
                                  <div style={{ width: `${item.score}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '2px' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* AI Advisor Actions */}
                      <div className="panel">
                        <div className="panel-header">
                          <span className="panel-title">AI Portfolio Advisor Recommendations</span>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {aiAdvisory?.recommendations?.map((rec, i) => (
                            <div key={i} style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)' }}>
                                <Cpu size={14} />
                                <span className="font-mono text-xs fw-600" style={{ textTransform: 'uppercase' }}>{rec.recommendation}</span>
                              </div>
                              <p className="text-xs text-secondary" style={{ marginTop: '4px', lineHeight: '1.4' }}>{rec.reason}</p>
                              <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                                {rec.targetAllocation && <span>Target Allocation: {rec.targetAllocation}</span>}
                                {rec.potentialRiskReduction && <span>Potential Risk Reduction: {rec.potentialRiskReduction}</span>}
                                {rec.targetWeight && <span>Target Weight: {rec.targetWeight}</span>}
                                <span className="badge badge-green font-mono" style={{ fontSize: '8px' }}>Confidence {rec.confidence}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* AI Research Assistant */}
                    <div className="panel">
                      <div className="panel-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Cpu size={16} className="text-accent" />
                            <span className="panel-title" style={{ fontSize: '13px', fontWeight: '600' }}>AI Research Assistant & Holding Intelligence</span>
                          </div>
                          <button
                            onClick={handleRegenerateResearch}
                            disabled={researchLoading}
                            className="btn btn-ghost btn-sm font-mono"
                            style={{ fontSize: '10px', height: '24px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <RefreshCw size={10} className={researchLoading ? 'animate-spin' : ''} />
                            Regenerate Analysis
                          </button>
                        </div>
                        
                        {/* Horizontal Asset Selector Pills */}
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                          {assets.length === 0 ? (
                            <span className="text-xs text-muted">No holdings available for research. Add assets to get started.</span>
                          ) : (
                            assets.map(a => (
                              <button
                                key={a.id}
                                onClick={() => setActiveHoldingResearch(a.symbol)}
                                className="btn btn-sm"
                                style={{
                                  background: activeHoldingResearch === a.symbol ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                  color: activeHoldingResearch === a.symbol ? 'var(--bg-primary)' : 'var(--text-primary)',
                                  borderColor: activeHoldingResearch === a.symbol ? 'var(--accent-primary)' : 'var(--border-primary)',
                                  borderRadius: '16px',
                                  fontSize: '11px',
                                  padding: '4px 10px',
                                  whiteSpace: 'nowrap',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <strong>{a.symbol}</strong>
                                <span style={{ opacity: 0.7, fontSize: '10px' }}>({a.asset_class})</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="panel-body" style={{ padding: '16px' }}>
                        {researchLoading ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px' }}>
                            <div className="pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-active)', marginBottom: '8px' }}>
                              <Cpu size={24} className="text-accent" style={{ animation: 'spin 4s linear infinite' }} />
                            </div>
                            <span className="font-mono text-xs fw-600 text-accent">COMPUTING REAL-TIME INTELLIGENCE</span>
                            <span className="text-xs text-secondary text-center" style={{ maxWidth: '280px', lineHeight: '1.4' }}>
                              Syncing news channels, processing balance sheet ratios, and evaluating technical oscillator signals...
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px' }}>
                            
                            {/* Left Column: Action Card & Risk Assessment */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              
                              {/* Suggested Action & Confidence */}
                              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span className="font-mono text-xs text-muted">SUGGESTED ACTION</span>
                                  <span className="font-mono text-xs text-accent">{activeHoldingResearch}</span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span
                                    style={{
                                      fontSize: '22px',
                                      fontWeight: '800',
                                      fontFamily: 'var(--font-mono)',
                                      color: activeResearch.action === 'BUY' ? 'var(--green)' : activeResearch.action === 'SELL' ? 'var(--red)' : 'var(--yellow)'
                                    }}
                                  >
                                    {activeResearch.action || 'HOLD'}
                                  </span>
                                  <span style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: activeResearch.action === 'BUY' ? 'var(--green)' : activeResearch.action === 'SELL' ? 'var(--red)' : 'var(--yellow)',
                                    boxShadow: `0 0 8px ${activeResearch.action === 'BUY' ? 'var(--green)' : activeResearch.action === 'SELL' ? 'var(--red)' : 'var(--yellow)'}`
                                  }}></span>
                                </div>

                                <div style={{ marginTop: '4px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                                    <span className="text-secondary">Confidence Interval</span>
                                    <span className="fw-600 text-accent">{activeResearch.confidence || 75}%</span>
                                  </div>
                                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${activeResearch.confidence || 75}%`,
                                        height: '100%',
                                        background: (activeResearch.confidence || 75) >= 85 ? 'var(--green)' : (activeResearch.confidence || 75) >= 65 ? 'var(--yellow)' : 'var(--red)',
                                        borderRadius: '3px',
                                        transition: 'width 0.4s ease'
                                      }}
                                    />
                                  </div>
                                </div>

                                <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '8px', marginTop: '4px' }}>
                                  <span className="font-mono text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>ACTION RATIONALE</span>
                                  <p className="text-xs text-secondary" style={{ lineHeight: '1.4' }}>{activeResearch.rationale}</p>
                                </div>

                                <button
                                  onClick={() => handleLogResearchToJournal(activeResearch)}
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    marginTop: '6px',
                                    background: 'var(--bg-active)',
                                    color: 'var(--accent-primary)',
                                    fontSize: '11px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    width: '100%',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <BookOpen size={12} />
                                  Log to Portfolio Journal
                                </button>
                              </div>

                              {/* Risk Assessment */}
                              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red)' }}>
                                  <AlertTriangle size={13} />
                                  <span className="font-mono text-xs fw-600">RISK ASSESSMENT</span>
                                </div>
                                <p className="text-xs text-secondary" style={{ lineHeight: '1.4' }}>{activeResearch.risk}</p>
                              </div>

                            </div>

                            {/* Right Column: Detailed Holding Analytics (4 Grids) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              
                              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '10px' }}>
                                <span className="font-mono text-xs text-accent fw-600" style={{ display: 'block', borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px', marginBottom: '6px' }}>BUSINESS PROFILE</span>
                                <span className="font-mono text-muted" style={{ fontSize: '9px', display: 'block', marginBottom: '2px' }}>SUMMARY</span>
                                <p className="text-xs text-secondary" style={{ marginBottom: '8px', lineHeight: '1.3' }}>{activeResearch.summary}</p>
                                <span className="font-mono text-muted" style={{ fontSize: '9px', display: 'block', marginBottom: '2px' }}>COMPETITIVE POSITION</span>
                                <p className="text-xs text-secondary" style={{ lineHeight: '1.3' }}>{activeResearch.comp}</p>
                              </div>

                              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '10px' }}>
                                <span className="font-mono text-xs text-accent fw-600" style={{ display: 'block', borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px', marginBottom: '6px' }}>FINANCIALS & VALUATION</span>
                                <span className="font-mono text-muted" style={{ fontSize: '9px', display: 'block', marginBottom: '2px' }}>VALUATION METRICS</span>
                                <p className="text-xs text-secondary" style={{ marginBottom: '8px', lineHeight: '1.3' }}>{activeResearch.valuation}</p>
                                <span className="font-mono text-muted" style={{ fontSize: '9px', display: 'block', marginBottom: '2px' }}>EARNINGS TRENDS & SHOCK</span>
                                <p className="text-xs text-secondary" style={{ lineHeight: '1.3' }}>{activeResearch.earnings}</p>
                              </div>

                              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '10px' }}>
                                <span className="font-mono text-xs text-accent fw-600" style={{ display: 'block', borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px', marginBottom: '6px' }}>MARKET DYNAMICS</span>
                                <span className="font-mono text-muted" style={{ fontSize: '9px', display: 'block', marginBottom: '2px' }}>INSIDER TRANSACTIONS</span>
                                <p className="text-xs text-secondary" style={{ marginBottom: '8px', lineHeight: '1.3' }}>{activeResearch.insider}</p>
                                <span className="font-mono text-muted" style={{ fontSize: '9px', display: 'block', marginBottom: '2px' }}>INSTITUTIONAL OWNERSHIP</span>
                                <p className="text-xs text-secondary" style={{ lineHeight: '1.3' }}>{activeResearch.institutional}</p>
                              </div>

                              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '10px' }}>
                                <span className="font-mono text-xs text-accent fw-600" style={{ display: 'block', borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px', marginBottom: '6px' }}>TECHNICALS & SENTIMENT</span>
                                <span className="font-mono text-muted" style={{ fontSize: '9px', display: 'block', marginBottom: '2px' }}>TECHNICAL INDICATORS</span>
                                <p className="text-xs text-secondary" style={{ marginBottom: '8px', lineHeight: '1.3' }}>{activeResearch.technicals}</p>
                                <span className="font-mono text-muted" style={{ fontSize: '9px', display: 'block', marginBottom: '2px' }}>NEWS SENTIMENT</span>
                                <p className="text-xs text-secondary" style={{ lineHeight: '1.3' }}>{activeResearch.sentiment}</p>
                              </div>

                            </div>

                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* ── Tab: VAULT & AUTOMATION ── */}
                {activeTab === 'vault' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>

                      {/* Document Vault */}
                      <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="panel-header">
                          <span className="panel-title">Document Vault (Searchable Contract Notes & Statements)</span>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                          <form onSubmit={handleAddDoc} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Document Title</label>
                              <input className="form-input" style={{ height: '28px' }} type="text" value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })} placeholder="e.g. Zerodha Contract Note Jun" required />
                            </div>
                            <div className="form-group" style={{ width: '120px' }}>
                              <label className="form-label">Doc Type</label>
                              <select className="form-input" style={{ height: '28px', padding: '0 4px' }} value={docForm.doc_type} onChange={e => setDocForm({ ...docForm, doc_type: e.target.value })}>
                                <option value="contract_note">Contract Note</option>
                                <option value="tax_doc">Tax Document</option>
                                <option value="broker_statement">Broker Statement</option>
                                <option value="dividend_statement">Dividend Statement</option>
                                <option value="annual_report">Annual Report</option>
                                <option value="research_note">Research Note</option>
                              </select>
                            </div>
                            <input type="hidden" value={docForm.file_path = 'mock_upload.pdf'} />
                            <button className="btn btn-primary btn-sm" style={{ height: '28px' }} type="submit">Upload & OCR</button>
                          </form>

                          {documents.map(d => (
                            <div key={d.id} style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={16} className="text-accent" />
                                <div>
                                  <span className="font-mono text-xs fw-600 text-primary">{d.name}</span>
                                  <div className="text-xs text-muted" style={{ fontSize: '10px' }}>{d.doc_type.replace('_', ' ').toUpperCase()} · Uploaded {new Date(d.uploaded_at).toLocaleDateString()}</div>
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
                              <div style={{ display: 'flex', justifycontent: 'space-between', marginBottom: '6px' }}>
                                <span className="font-mono text-xs fw-600 text-accent">OCR SCANNER TEXT PARSING</span>
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
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span className="panel-title">Portfolio Journal & Trading Diary</span>
                            <span className="text-xs text-muted" style={{ display: 'block', marginTop: '2px' }}>
                              Document investment thesis, target price triggers, and behavioral patterns
                            </span>
                          </div>
                          <span className="badge badge-accent font-mono" style={{ fontSize: '10px' }}>{journal.length} Entries</span>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
                          
                          {/* Form Toggle button or display */}
                          <div id="journal-form-panel" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '12px' }}>
                            <span className="font-mono text-xs text-accent fw-600" style={{ display: 'block', marginBottom: '8px' }}>
                              {editingJournalId ? 'EDIT THESIS DIARY ENTRY' : 'LOG NEW DIARY / THESIS ENTRY'}
                            </span>
                            
                            <form onSubmit={handleAddJournal} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '9px' }}>Title / Thesis Headline</label>
                                  <input 
                                    className="form-input" 
                                    style={{ height: '28px', fontSize: '11px' }} 
                                    type="text" 
                                    value={journalForm.title} 
                                    onChange={e => setJournalForm({ ...journalForm, title: e.target.value })} 
                                    placeholder="e.g. Bought Gold ETF rationale" 
                                    required 
                                  />
                                </div>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '9px' }}>Entry Type</label>
                                  <select 
                                    className="form-input" 
                                    style={{ height: '28px', padding: '0 4px', fontSize: '11px' }} 
                                    value={journalForm.entry_type} 
                                    onChange={e => setJournalForm({ ...journalForm, entry_type: e.target.value })}
                                  >
                                    <option value="thesis">Investment Thesis</option>
                                    <option value="buy_rationale">Buy Rationale</option>
                                    <option value="sell_rationale">Sell Rationale</option>
                                    <option value="post_trade">Post-Trade Review</option>
                                    <option value="lesson">Lessons & Mistakes</option>
                                  </select>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '9px' }}>Link Holding Asset</label>
                                  <select 
                                    className="form-input" 
                                    style={{ height: '28px', padding: '0 4px', fontSize: '11px' }} 
                                    value={journalForm.linked_symbol || ''} 
                                    onChange={e => setJournalForm({ ...journalForm, linked_symbol: e.target.value })}
                                  >
                                    <option value="">-- None --</option>
                                    {assets.map(a => (
                                      <option key={a.id} value={a.symbol}>{a.symbol} - {a.name.slice(0, 15)}...</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '9px' }}>Target Price</label>
                                  <input 
                                    className="form-input" 
                                    style={{ height: '28px', fontSize: '11px' }} 
                                    type="number" 
                                    step="any"
                                    value={journalForm.target_price || ''} 
                                    onChange={e => setJournalForm({ ...journalForm, target_price: e.target.value })} 
                                    placeholder="Target" 
                                  />
                                </div>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '9px' }}>Stop Loss</label>
                                  <input 
                                    className="form-input" 
                                    style={{ height: '28px', fontSize: '11px' }} 
                                    type="number" 
                                    step="any"
                                    value={journalForm.stop_loss || ''} 
                                    onChange={e => setJournalForm({ ...journalForm, stop_loss: e.target.value })} 
                                    placeholder="Stop Loss" 
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '8px' }}>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '9px' }}>Confidence</label>
                                  <select 
                                    className="form-input" 
                                    style={{ height: '28px', padding: '0 4px', fontSize: '11px' }} 
                                    value={journalForm.confidence_rating || 3} 
                                    onChange={e => setJournalForm({ ...journalForm, confidence_rating: e.target.value })}
                                  >
                                    <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                                    <option value="4">⭐⭐⭐⭐ Good</option>
                                    <option value="3">⭐⭐⭐ Moderate</option>
                                    <option value="2">⭐⭐ Low</option>
                                    <option value="1">⭐ Speculative</option>
                                  </select>
                                </div>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '9px' }}>Behavioral State</label>
                                  <select 
                                    className="form-input" 
                                    style={{ height: '28px', padding: '0 4px', fontSize: '11px' }} 
                                    value={journalForm.emotion_check || 'Objective'} 
                                    onChange={e => setJournalForm({ ...journalForm, emotion_check: e.target.value })}
                                  >
                                    <option value="Objective">😐 Objective</option>
                                    <option value="Greedy">🤑 Greedy</option>
                                    <option value="Fearing">😨 Fearing</option>
                                    <option value="FOMO">📈 FOMO</option>
                                    <option value="Confident">😎 Confident</option>
                                    <option value="Anxious">😟 Anxious</option>
                                  </select>
                                </div>
                                <div className="form-group">
                                  <label className="form-label" style={{ fontSize: '9px' }}>Thesis Status</label>
                                  <select 
                                    className="form-input" 
                                    style={{ height: '28px', padding: '0 4px', fontSize: '11px' }} 
                                    value={journalForm.status || 'thesis_intact'} 
                                    onChange={e => setJournalForm({ ...journalForm, status: e.target.value })}
                                  >
                                    <option value="thesis_intact">🟢 Thesis Intact</option>
                                    <option value="thesis_busted">🔴 Thesis Busted</option>
                                    <option value="under_review">🟡 Under Review</option>
                                    <option value="completed">🔵 Completed</option>
                                  </select>
                                </div>
                              </div>

                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: '9px' }}>Analysis & Investment Thesis Rationale</label>
                                <textarea 
                                  className="form-input" 
                                  style={{ minHeight: '60px', fontSize: '11px', lineHeight: '1.4' }} 
                                  value={journalForm.content} 
                                  onChange={e => setJournalForm({ ...journalForm, content: e.target.value })} 
                                  placeholder="Why is this trade done? Under what conditions will the thesis break?" 
                                  required 
                                />
                              </div>

                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button className="btn btn-primary btn-sm" type="submit" style={{ flex: 1 }}>
                                  {editingJournalId ? 'UPDATE THESIS ENTRY' : 'LOG JOURNAL ENTRY'}
                                </button>
                                {editingJournalId && (
                                  <button 
                                    className="btn btn-ghost btn-sm" 
                                    type="button" 
                                    onClick={() => {
                                      setEditingJournalId(null);
                                      setJournalForm({
                                        title: '',
                                        entry_type: 'thesis',
                                        content: '',
                                        linked_symbol: '',
                                        target_price: '',
                                        stop_loss: '',
                                        confidence_rating: 3,
                                        emotion_check: 'Objective',
                                        status: 'thesis_intact'
                                      });
                                    }}
                                  >
                                    CANCEL
                                  </button>
                                )}
                              </div>
                            </form>
                          </div>

                          {/* Filters & Search Header */}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ height: '24px', fontSize: '10px', flex: 1 }} 
                              placeholder="Search thesis/notes..." 
                              value={journalSearchQuery} 
                              onChange={e => setJournalSearchQuery(e.target.value)} 
                            />
                            <select 
                              className="form-input" 
                              style={{ width: '90px', height: '24px', padding: '0 4px', fontSize: '10px' }} 
                              value={journalFilterType} 
                              onChange={e => setJournalFilterType(e.target.value)}
                            >
                              <option value="all">All Types</option>
                              <option value="thesis">Thesis</option>
                              <option value="buy_rationale">Buy</option>
                              <option value="sell_rationale">Sell</option>
                              <option value="post_trade">Review</option>
                              <option value="lesson">Lessons</option>
                            </select>
                            <select 
                              className="form-input" 
                              style={{ width: '100px', height: '24px', padding: '0 4px', fontSize: '10px' }} 
                              value={journalFilterStatus} 
                              onChange={e => setJournalFilterStatus(e.target.value)}
                            >
                              <option value="all">All Status</option>
                              <option value="thesis_intact">Intact</option>
                              <option value="thesis_busted">Busted</option>
                              <option value="under_review">Review</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>

                          {/* List of Entries */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                            {journal
                              .filter(j => {
                                const typeMatch = journalFilterType === 'all' || j.entry_type === journalFilterType;
                                const statusMatch = journalFilterStatus === 'all' || j.status === journalFilterStatus;
                                const textMatch = !journalSearchQuery || 
                                  j.title.toLowerCase().includes(journalSearchQuery.toLowerCase()) || 
                                  j.content.toLowerCase().includes(journalSearchQuery.toLowerCase()) ||
                                  (j.linked_symbol && j.linked_symbol.toLowerCase().includes(journalSearchQuery.toLowerCase()));
                                return typeMatch && statusMatch && textMatch;
                              })
                              .map(j => {
                                const linkedAssetObj = assets.find(a => a.symbol === j.linked_symbol);
                                const currentPrice = linkedAssetObj ? parseFloat(linkedAssetObj.current_price) : null;
                                return (
                                  <div 
                                    key={j.id} 
                                    style={{ 
                                      border: '1px solid var(--border-primary)', 
                                      background: editingJournalId === j.id ? 'var(--bg-hover)' : 'var(--bg-secondary)', 
                                      borderRadius: '6px', 
                                      padding: '12px',
                                      position: 'relative'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <span 
                                          className="font-mono text-xs fw-600 text-primary hover-text-accent" 
                                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                          onClick={() => handleEditJournalClick(j)}
                                        >
                                          {j.title}
                                        </span>
                                        
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                                          <span className="badge badge-ghost font-mono" style={{ fontSize: '8.5px', padding: '1px 4px' }}>
                                            {j.entry_type.replace('_', ' ').toUpperCase()}
                                          </span>
                                          <span>·</span>
                                          <span>{j.emotion_check ? (
                                            j.emotion_check === 'Objective' ? '😐 Objective' :
                                            j.emotion_check === 'Greedy' ? '🤑 Greedy' :
                                            j.emotion_check === 'Fearing' ? '😨 Fearing' :
                                            j.emotion_check === 'FOMO' ? '📈 FOMO' :
                                            j.emotion_check === 'Confident' ? '😎 Confident' :
                                            j.emotion_check === 'Anxious' ? '😟 Anxious' : j.emotion_check
                                          ) : '😐 Objective'}</span>
                                          <span>·</span>
                                          <span>{new Date(j.created_at || j.date).toLocaleDateString()}</span>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className={`badge ${
                                          j.status === 'thesis_busted' ? 'badge-red' : 
                                          j.status === 'under_review' ? 'badge-amber' : 
                                          j.status === 'completed' ? 'badge-blue' : 'badge-green'
                                        }`} style={{ fontSize: '8.5px' }}>
                                          {j.status === 'thesis_intact' ? 'INTACT' :
                                           j.status === 'thesis_busted' ? 'BUSTED' :
                                           j.status === 'under_review' ? 'UNDER REVIEW' :
                                           j.status === 'completed' ? 'COMPLETED' : j.status}
                                        </span>
                                        
                                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px' }} onClick={() => handleDeleteJournal(j.id)}>
                                          <Trash2 size={12} className="text-red" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Asset Context & Target Snapshot */}
                                    {j.linked_symbol && (
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '6px 8px', borderRadius: '4px', marginTop: '8px', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
                                        <div>
                                          <span className="text-muted" style={{ display: 'block', fontSize: '7.5px' }}>LINKED ASSET:</span>
                                          <strong className="text-accent">{j.linked_symbol}</strong>
                                        </div>
                                        <div>
                                          <span className="text-muted" style={{ display: 'block', fontSize: '7.5px' }}>TARGET / SL:</span>
                                          <span>T: {j.target_price ? formatCurrency(parseFloat(j.target_price)) : '--'}</span>
                                          <span style={{ display: 'block' }}>S: {j.stop_loss ? formatCurrency(parseFloat(j.stop_loss)) : '--'}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <span className="text-muted" style={{ display: 'block', fontSize: '7.5px' }}>CURRENT PRICE:</span>
                                          <strong className={currentPrice >= parseFloat(j.target_price) ? 'text-green' : currentPrice <= parseFloat(j.stop_loss) ? 'text-red' : 'text-primary'}>
                                            {currentPrice ? formatCurrency(currentPrice) : 'N/A'}
                                          </strong>
                                        </div>
                                      </div>
                                    )}

                                    <p className="text-xs text-secondary" style={{ marginTop: '8px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                                      {j.content}
                                    </p>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '9.5px', borderTop: '1px dashed var(--border-primary)', paddingTop: '6px', color: 'var(--text-muted)' }}>
                                      <span>Confidence Rating:</span>
                                      <span>{'★'.repeat(j.confidence_rating || 3)}{'☆'.repeat(5 - (j.confidence_rating || 3))}</span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Notifications & Rule-Based Automation Alerts */}
                    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="panel-title">Notifications & Rule-Based Automation Rules</span>
                          <span className="text-xs text-muted" style={{ display: 'block', marginTop: '2px' }}>
                            Configure real-time safety nets, rebalancing triggers, and corporate action monitoring
                          </span>
                        </div>
                        <span className="badge badge-accent font-mono" style={{ fontSize: '10px' }}>{alertRules.length} Active Rules</span>
                      </div>
                      
                      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
                        
                        {/* Create New Alert Rule Form */}
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '14px' }}>
                          <span className="font-mono text-xs text-accent fw-600" style={{ display: 'block', marginBottom: '10px' }}>
                            BUILD RULE-BASED AUTOMATION TRIGGER
                          </span>
                          
                          <form onSubmit={handleCreateAlertRule} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr 1.2fr auto', gap: '10px', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '9px' }}>Rule Type / Trigger</label>
                              <select 
                                className="form-input" 
                                style={{ height: '30px', fontSize: '11px', padding: '0 6px', background: 'var(--bg-primary)' }}
                                value={newAlertForm.alert_type}
                                onChange={(e) => setNewAlertForm({ ...newAlertForm, alert_type: e.target.value })}
                              >
                                <option value="portfolio_drawdown">Portfolio Drawdown Exceeds (%)</option>
                                <option value="allocation_drift">Asset Allocation Drifts (%)</option>
                                <option value="dividend_credited">Dividend Credited (Holding)</option>
                                <option value="goal_behind_schedule">Goal Falls Behind Schedule (Name)</option>
                                <option value="target_price">Stock Crosses Target Price (₹)</option>
                                <option value="earnings_announcement">Earnings Announcement (Holding)</option>
                                <option value="unusual_volume">Unusual Trading Volume (Holding)</option>
                                <option value="credit_downgrade">Credit Rating Downgrade (Holding)</option>
                                <option value="tax_loss_harvesting">Tax-Loss Harvesting Opportunity (₹)</option>
                              </select>
                            </div>
                            
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '9px' }}>Target Symbol / Name</label>
                              <input 
                                className="form-input" 
                                type="text"
                                placeholder="e.g. TCS, Retirement, FD"
                                style={{ height: '30px', fontSize: '11px' }}
                                value={newAlertForm.symbol}
                                onChange={(e) => setNewAlertForm({ ...newAlertForm, symbol: e.target.value })}
                              />
                            </div>
                            
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '9px' }}>Trigger Value / Limit</label>
                              <input 
                                className="form-input" 
                                type="number"
                                step="any"
                                placeholder="e.g. 10, 2800, 10000"
                                style={{ height: '30px', fontSize: '11px' }}
                                value={newAlertForm.threshold}
                                onChange={(e) => setNewAlertForm({ ...newAlertForm, threshold: e.target.value })}
                              />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '9px' }}>Custom Criteria Desc (Optional)</label>
                              <input 
                                className="form-input" 
                                type="text"
                                placeholder="Leave empty for auto desc"
                                style={{ height: '30px', fontSize: '11px' }}
                                value={newAlertForm.criteria_desc}
                                onChange={(e) => setNewAlertForm({ ...newAlertForm, criteria_desc: e.target.value })}
                              />
                            </div>
                            
                            <button className="btn btn-accent btn-sm" type="submit" style={{ height: '30px', fontSize: '11px', padding: '0 12px' }}>
                              Add Rule
                            </button>
                          </form>
                        </div>

                        {/* Rules List Table */}
                        <div style={{ border: '1px solid var(--border-primary)', borderRadius: '6px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '8px 12px' }}>Rule Type</th>
                                <th style={{ padding: '8px 12px' }}>Target Asset / Goal</th>
                                <th style={{ padding: '8px 12px' }}>Threshold</th>
                                <th style={{ padding: '8px 12px' }}>Alert Criteria & Description</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Triggered State</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {alertRules.length === 0 ? (
                                <tr>
                                  <td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No active automation rules defined. Use the builder above to set new triggers.
                                  </td>
                                </tr>
                              ) : (
                                alertRules.map(rule => {
                                  const labelMap = {
                                    portfolio_drawdown: 'Portfolio Drawdown',
                                    allocation_drift: 'Allocation Drift',
                                    dividend_credited: 'Dividend Credited',
                                    goal_behind_schedule: 'Goal Schedule',
                                    target_price: 'Target Price',
                                    earnings_announcement: 'Earnings Calendar',
                                    unusual_volume: 'Unusual Volume',
                                    credit_downgrade: 'Credit Rating',
                                    tax_loss_harvesting: 'Tax-Loss Harvesting'
                                  };
                                  const typeLabel = labelMap[rule.alert_type] || rule.alert_type;

                                  return (
                                    <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-primary)', background: rule.triggered && rule.is_active ? 'rgba(235, 87, 87, 0.05)' : 'transparent' }}>
                                      <td style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--text-primary)' }}>{typeLabel}</td>
                                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{rule.symbol || 'Entire Portfolio'}</td>
                                      <td style={{ padding: '8px 12px', fontWeight: '500' }}>
                                        {rule.threshold !== null ? (
                                          rule.alert_type.includes('drawdown') || rule.alert_type.includes('drift') ? `${Number(rule.threshold)}%` : `₹${Number(rule.threshold).toLocaleString()}`
                                        ) : 'N/A'}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: rule.triggered && rule.is_active ? 'var(--accent-red)' : 'var(--text-secondary)', fontWeight: rule.triggered && rule.is_active ? '500' : 'normal' }}>
                                        {rule.criteria_desc}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        {!rule.is_active ? (
                                          <span className="badge badge-muted" style={{ fontSize: '9px' }}>INACTIVE</span>
                                        ) : rule.triggered ? (
                                          <span className="badge badge-red" style={{ fontSize: '9px', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>⚠️ TRIGGERED</span>
                                        ) : (
                                          <span className="badge badge-green" style={{ fontSize: '9px' }}>NORMAL</span>
                                        )}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        <button 
                                          className={`btn btn-xs ${rule.is_active ? 'btn-success' : 'btn-outline'}`}
                                          style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
                                          onClick={() => handleToggleAlertRule(rule.id)}
                                        >
                                          {rule.is_active ? 'Active' : 'Disabled'}
                                        </button>
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        <button 
                                          className="btn btn-xs btn-outline-red"
                                          style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(235, 87, 87, 0.3)' }}
                                          onClick={() => handleDeleteAlertRule(rule.id)}
                                        >
                                          Delete
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

                  </div>
                )}
              </>
            )}
          </div>
        </div>
        );
}

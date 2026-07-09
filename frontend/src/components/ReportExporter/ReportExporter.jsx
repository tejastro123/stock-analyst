import React, { useState } from 'react';
import { reportsApi, portfolioApi, marketApi } from '../../api';

function ReportExporter({ pageName, data, label = "EXPORT PDF", combined = false }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateDashboardHtml = (watchlistData, marketBarData) => {
    let mbRows = (marketBarData || []).map(m => `
      <div class="summary-card">
        <div class="summary-label">${m.label}</div>
        <div class="summary-value ${m.up ? 'price-up' : 'price-down'}">${m.value} (${m.change})</div>
      </div>
    `).join('');

    let wlRows = (watchlistData || []).map(s => `
      <tr>
        <td class="bold">${s.sym}</td>
        <td>${s.name}</td>
        <td class="text-right font-mono">${s.price}</td>
        <td class="text-right font-mono ${s.up ? 'price-up' : 'price-down'}">${s.chg}</td>
        <td class="text-right font-mono ${s.up ? 'price-up' : 'price-down'}">${s.pct}</td>
        <td class="text-right font-mono">${s.vol}</td>
      </tr>
    `).join('');

    return `
      <div class="section">
        <div class="section-title">Market Indexes Summary</div>
        <div class="summary-grid">
          ${mbRows || '<div>No market index data.</div>'}
        </div>
      </div>
      <div class="section">
        <div class="section-title">My Monitor Watchlist</div>
        <table>
          <thead>
            <tr>
              <th>SYMBOL</th>
              <th>NAME</th>
              <th class="text-right">PRICE</th>
              <th class="text-right">CHANGE</th>
              <th class="text-right">CHANGE %</th>
              <th class="text-right">VOLUME</th>
            </tr>
          </thead>
          <tbody>
            ${wlRows || '<tr><td colspan="6">No symbols in watchlist.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  };

  const generatePortfolioHtml = (portfolioData) => {
    const summary = portfolioData?.summary || {};
    const risk = summary?.risk_analytics || {};
    const positions = portfolioData?.positions || [];

    const riskMetrics = `
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">TOTAL VALUE</div>
          <div class="summary-value">$${Number(summary.total_value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">UNREALIZED P&L</div>
          <div class="summary-value ${summary.unrealized_pl >= 0 ? 'price-up' : 'price-down'}">$${Number(summary.unrealized_pl || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">PORTFOLIO BETA (β)</div>
          <div class="summary-value">${Number(risk.portfolio_beta || 1).toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">1-DAY VALUE AT RISK (VaR 95%)</div>
          <div class="summary-value">$${Number(risk.value_at_risk || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
      </div>
    `;

    const posRows = positions.map(p => `
      <tr>
        <td class="bold">${p.symbol}</td>
        <td>${p.asset_type}</td>
        <td class="text-right font-mono">${p.quantity}</td>
        <td class="text-right font-mono">$${Number(p.avg_cost).toFixed(2)}</td>
        <td class="text-right font-mono">$${Number(p.current_price || p.avg_cost).toFixed(2)}</td>
        <td class="text-right font-mono">$${Number(p.market_value || (p.quantity * p.avg_cost)).toFixed(2)}</td>
        <td class="text-right font-mono ${p.unrealized_pl >= 0 ? 'price-up' : 'price-down'}">$${Number(p.unrealized_pl || 0).toFixed(2)} (${Number(p.unrealized_pl_pct || 0).toFixed(2)}%)</td>
      </tr>
    `).join('');

    return `
      <div class="section">
        <div class="section-title">Portfolio Risk & Summary Metrics</div>
        ${riskMetrics}
      </div>
      <div class="section">
        <div class="section-title">Asset Holdings & Performance</div>
        <table>
          <thead>
            <tr>
              <th>SYMBOL</th>
              <th>ASSET CLASS</th>
              <th class="text-right">QUANTITY</th>
              <th class="text-right">AVG COST</th>
              <th class="text-right">LAST PRICE</th>
              <th class="text-right">MARKET VALUE</th>
              <th class="text-right">UNREALIZED P&L</th>
            </tr>
          </thead>
          <tbody>
            ${posRows || '<tr><td colspan="7">No open positions.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  };

  const generateScreenerHtml = (screenerData) => {
    const filters = screenerData?.filters || {};
    const results = screenerData?.results || [];

    const filterText = Object.entries(filters)
      .map(([k, v]) => `<strong>${k.toUpperCase()}:</strong> ${v}`)
      .join(' | ') || 'None';

    const resultRows = results.map(r => `
      <tr>
        <td class="bold">${r.symbol}</td>
        <td>${r.name || '—'}</td>
        <td class="text-right font-mono">$${Number(r.price).toFixed(2)}</td>
        <td class="text-right font-mono ${r.change_pct >= 0 ? 'price-up' : 'price-down'}">${Number(r.change_pct).toFixed(2)}%</td>
        <td class="text-right font-mono">${r.pe_ratio ? Number(r.pe_ratio).toFixed(1) : '—'}</td>
        <td class="text-right font-mono">${r.market_cap ? (r.market_cap / 1e9).toFixed(1) + 'B' : '—'}</td>
        <td class="text-right font-mono">${r.volume ? (r.volume / 1e6).toFixed(1) + 'M' : '—'}</td>
      </tr>
    `).join('');

    return `
      <div class="section">
        <div class="section-title">Screener Criteria</div>
        <div class="summary-card" style="font-size: 10px;">
          ${filterText}
        </div>
      </div>
      <div class="section">
        <div class="section-title">Screening Results (${results.length} stocks matched)</div>
        <table>
          <thead>
            <tr>
              <th>SYMBOL</th>
              <th>COMPANY NAME</th>
              <th class="text-right">PRICE</th>
              <th class="text-right">CHG%</th>
              <th class="text-right">P/E</th>
              <th class="text-right">MARKET CAP</th>
              <th class="text-right">VOLUME</th>
            </tr>
          </thead>
          <tbody>
            ${resultRows || '<tr><td colspan="7">No matching results found.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  };

  const generateOptionsHtml = (optionsData) => {
    const symbol = optionsData?.symbol || 'N/A';
    const expiry = optionsData?.expiry || 'N/A';
    const chain = optionsData?.chain || [];

    const rows = chain.map(c => `
      <tr>
        <td class="font-mono price-up">${Number(c.calls?.delta || 0).toFixed(2)}</td>
        <td class="font-mono text-right">$${Number(c.calls?.lastPrice || 0).toFixed(2)}</td>
        <td class="bold text-center" style="background: #161622;">${c.strike}</td>
        <td class="font-mono text-right">$${Number(c.puts?.lastPrice || 0).toFixed(2)}</td>
        <td class="font-mono price-down text-right">${Number(c.puts?.delta || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <div class="section">
        <div class="section-title">Option Chain Parameters</div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">UNDERLYING SYMBOL</div>
            <div class="summary-value">${symbol.toUpperCase()}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">EXPIRATION DATE</div>
            <div class="summary-value">${expiry}</div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Calls vs Puts (Greeks Delta Profile)</div>
        <table>
          <thead>
            <tr>
              <th>CALL DELTA</th>
              <th class="text-right">CALL LAST</th>
              <th class="text-center">STRIKE</th>
              <th class="text-right">PUT LAST</th>
              <th class="text-right">PUT DELTA</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5">No options chain contracts.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  };

  const generateChartsHtml = (chartsData) => {
    const symbol = chartsData?.symbol || 'N/A';
    const fund = chartsData?.fundamentals || {};

    return `
      <div class="section">
        <div class="section-title">Asset Valuation Summary: ${symbol.toUpperCase()}</div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">MARKET CAP</div>
            <div class="summary-value">$${fund.market_cap ? (fund.market_cap / 1e9).toFixed(2) + 'B' : 'N/A'}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">TRAILING P/E</div>
            <div class="summary-value">${fund.pe_trailing || 'N/A'}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">FORWARD P/E</div>
            <div class="summary-value">${fund.pe_forward || 'N/A'}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">BETA (β)</div>
            <div class="summary-value">${fund.beta || 'N/A'}</div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Detailed Fundamental Parameters</div>
        <table>
          <thead>
            <tr>
              <th>PARAMETER</th>
              <th>VALUE</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Sector / Industry</td><td>${fund.sector || 'N/A'} / ${fund.industry || 'N/A'}</td></tr>
            <tr><td>Gross Margin</td><td>${fund.gross_margin ? (fund.gross_margin * 100).toFixed(2) + '%' : 'N/A'}</td></tr>
            <tr><td>Operating Margin</td><td>${fund.operating_margin ? (fund.operating_margin * 100).toFixed(2) + '%' : 'N/A'}</td></tr>
            <tr><td>Profit Margin</td><td>${fund.profit_margin ? (fund.profit_margin * 100).toFixed(2) + '%' : 'N/A'}</td></tr>
            <tr><td>PEG Ratio</td><td>${fund.peg_ratio || 'N/A'}</td></tr>
            <tr><td>Price to Book (P/B)</td><td>${fund.pb_ratio || 'N/A'}</td></tr>
            <tr><td>Debt to Equity</td><td>${fund.debt_to_equity || 'N/A'}</td></tr>
            <tr><td>Dividend Yield</td><td>${fund.dividend_yield ? (fund.dividend_yield * 100).toFixed(2) + '%' : 'N/A'}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  };

  const handleExport = async () => {
    setLoading(true);
    setError('');
    try {
      let title = `QuantDesk Report: ${pageName.toUpperCase()}`;
      let subtitle = 'Institutional Trading Desk Analytics';
      let contentHtml = '';

      if (combined) {
        title = "QuantDesk Executive Brief";
        subtitle = "Combined Risk, Allocation, and Monitor Report";
        
        // Fetch portfolio data
        const pRes = await portfolioApi.getPortfolio();
        const portfolioHtml = generatePortfolioHtml(pRes.data);

        // Build mock/current watchlists
        const wlRes = data?.watchlist || [];
        const mbRes = data?.marketBar || [];
        const dashHtml = generateDashboardHtml(wlRes, mbRes);

        contentHtml = `
          <div class="section">${portfolioHtml}</div>
          <div style="page-break-after: always;"></div>
          <div class="section">${dashHtml}</div>
        `;
      } else {
        switch (pageName) {
          case 'dashboard':
            contentHtml = generateDashboardHtml(data?.watchlist, data?.marketBar);
            break;
          case 'portfolio':
            contentHtml = generatePortfolioHtml(data);
            break;
          case 'screener':
            contentHtml = generateScreenerHtml(data);
            break;
          case 'options':
            contentHtml = generateOptionsHtml(data);
            break;
          case 'charts': {
            const fundRes = await marketApi.getFundamentals(data.symbol, data.market);
            contentHtml = generateChartsHtml({ symbol: data.symbol, fundamentals: fundRes.data });
            break;
          }
          default:
            contentHtml = `<div>Feature Report for page: ${pageName}</div>`;
        }
      }

      const res = await reportsApi.exportPdf({ title, subtitle, contentHtml });

      if (res.data instanceof Blob && res.data.type === 'application/pdf') {
        const file = new Blob([res.data], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = fileURL;
        link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const text = await res.data.text();
        const parsed = JSON.parse(text);
        if (parsed.fallback) {
          alert('PDF engine offline. Triggering browser print layout...');
          window.print();
        }
      }
    } catch (err) {
      console.error(err);
      setError('PDF engine failed. Falling back to browser print...');
      window.print();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button 
        onClick={handleExport} 
        className="btn btn-ghost btn-sm font-mono text-green" 
        style={{ height: '24px', padding: '0 8px', fontSize: '10px' }}
        disabled={loading}
      >
        {loading ? 'GENERATING PDF...' : label}
      </button>
      {error && <span style={{ color: 'var(--red)', fontSize: '9px', marginLeft: '6px' }}>{error}</span>}
    </div>
  );
}

export default ReportExporter;

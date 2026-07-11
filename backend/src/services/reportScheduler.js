const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');
const fxService = require('./fxService');

// Make sure output folder exists
const REPORTS_DIR = path.join(__dirname, '../../generated_reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Generate next run date
function calculateNextRun(frequency, currentRun = new Date()) {
  const date = new Date(currentRun);
  if (frequency === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (frequency === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  }
  return date;
}

// Simple CSV builder
function generateExcelCsv(headers, rows) {
  const headerLine = headers.join(',');
  const rowLines = rows.map(r => 
    r.map(val => {
      const stringVal = String(val === null || val === undefined ? '' : val);
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    }).join(',')
  );
  return [headerLine, ...rowLines].join('\n');
}

// Main scheduler worker
async function processScheduledReports() {
  let client;
  try {
    client = await pool.connect();
    // Fetch pending jobs
    const jobsRes = await client.query(
      'SELECT * FROM scheduled_reports WHERE next_run <= NOW()'
    );
    
    for (const job of jobsRes.rows) {
      console.log(`Processing scheduled report job: ${job.id} for user ${job.user_id}`);
      
      // 1. Gather data
      const userRes = await client.query('SELECT username, email FROM users WHERE id = $1', [job.user_id]);
      const user = userRes.rows[0] || { username: 'unknown', email: job.email_recipient };
      
      let fileContent = '';
      let filename = `report_${job.report_type}_${job.format}_${Date.now()}`;
      let contentType = '';
      
      if (job.report_type === 'portfolio') {
        const portRes = await client.query('SELECT * FROM portfolios WHERE user_id = $1', [job.user_id]);
        const portfolios = portRes.rows;
        
        if (job.format === 'excel') {
          // Generate CSV/Excel format
          const headers = ['Portfolio ID', 'Name', 'Currency', 'Symbol', 'Quantity', 'Avg Cost', 'Asset Type'];
          const rows = [];
          for (const port of portfolios) {
            const posRes = await client.query('SELECT * FROM positions WHERE portfolio_id = $1', [port.id]);
            for (const pos of posRes.rows) {
              rows.push([port.id, port.name, port.currency, pos.symbol, pos.quantity, pos.avg_cost, pos.asset_type]);
            }
          }
          fileContent = generateExcelCsv(headers, rows);
          filename += '.csv';
          contentType = 'text/csv';
        } else {
          // Generate simple HTML template for PDF/printing
          let portListHtml = '';
          for (const port of portfolios) {
            const posRes = await client.query('SELECT * FROM positions WHERE portfolio_id = $1', [port.id]);
            let rowsHtml = '';
            for (const pos of posRes.rows) {
              rowsHtml += `
                <tr>
                  <td>${pos.symbol}</td>
                  <td>${pos.asset_type}</td>
                  <td>${pos.quantity}</td>
                  <td>${pos.avg_cost}</td>
                  <td>${(parseFloat(pos.quantity) * parseFloat(pos.avg_cost)).toFixed(2)}</td>
                </tr>
              `;
            }
            portListHtml += `
              <h3>${port.name} (${port.currency})</h3>
              <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Avg Cost</th>
                    <th>Total Basis</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="5">No positions</td></tr>'}
                </tbody>
              </table>
            `;
          }
          
          fileContent = `
            <html>
              <body style="font-family: monospace; background: #000; color: #fff; padding: 20px;">
                <h2>QuantDesk Scheduled Portfolio Report</h2>
                <p>User: ${user.username}</p>
                <p>Date: ${new Date().toLocaleString()}</p>
                <hr/>
                ${portListHtml}
              </body>
            </html>
          `;
          filename += '.html'; // We save as HTML which can be converted to PDF
          contentType = 'text/html';
        }
      } else {
        // Fallback or watchlist report
        const wlRes = await client.query('SELECT * FROM watchlists WHERE user_id = $1', [job.user_id]);
        if (job.format === 'excel') {
          const headers = ['Watchlist ID', 'Watchlist Name', 'Symbol', 'Market'];
          const rows = [];
          for (const wl of wlRes.rows) {
            const wlSyms = await client.query('SELECT * FROM watchlist_symbols WHERE watchlist_id = $1', [wl.id]);
            for (const sym of wlSyms.rows) {
              rows.push([wl.id, wl.name, sym.symbol, sym.market]);
            }
          }
          fileContent = generateExcelCsv(headers, rows);
          filename += '.csv';
          contentType = 'text/csv';
        } else {
          let wlListHtml = '';
          for (const wl of wlRes.rows) {
            const wlSyms = await client.query('SELECT * FROM watchlist_symbols WHERE watchlist_id = $1', [wl.id]);
            const symsList = wlSyms.rows.map(s => s.symbol).join(', ') || 'None';
            wlListHtml += `<li><strong>${wl.name}</strong>: ${symsList}</li>`;
          }
          fileContent = `
            <html>
              <body style="font-family: monospace; background: #000; color: #fff; padding: 20px;">
                <h2>QuantDesk Scheduled Watchlist Report</h2>
                <p>User: ${user.username}</p>
                <hr/>
                <ul>${wlListHtml}</ul>
              </body>
            </html>
          `;
          filename += '.html';
          contentType = 'text/html';
        }
      }
      
      const filePath = path.join(REPORTS_DIR, filename);
      fs.writeFileSync(filePath, fileContent);
      console.log(`Saved generated report to: ${filePath}`);
      
      // Update schedule
      const nextRun = calculateNextRun(job.frequency);
      await client.query(
        'UPDATE scheduled_reports SET next_run = $1 WHERE id = $2',
        [nextRun, job.id]
      );
      
      // Log audit entry
      await client.query(
        `INSERT INTO audit_log (user_id, action, resource, metadata)
         VALUES ($1, 'REPORT_GENERATED', 'report', $2)`,
        [
          job.user_id,
          {
            job_id: job.id,
            report_type: job.report_type,
            format: job.format,
            email_sent_to: job.email_recipient,
            file_name: filename,
            file_path: filePath
          }
        ]
      );
    }
  } catch (err) {
    console.error('Error processing scheduled reports:', err.message);
  } finally {
    if (client) client.release();
  }
}

function startReportScheduler(intervalMs = 60000) {
  console.log(`⏱️ Report scheduler started with polling interval: ${intervalMs}ms`);
  setInterval(processScheduledReports, intervalMs);
  // Run once immediately
  setTimeout(processScheduledReports, 2000);
}

module.exports = {
  startReportScheduler
};

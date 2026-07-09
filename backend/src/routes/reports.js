const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.warn("Puppeteer not loaded. Backend PDF printing will fall back to client print.");
}

function renderPdfHtml(title, subtitle, contentHtml) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
          body {
            font-family: 'JetBrains+Mono', monospace;
            background-color: #0d0d17;
            color: #d1d4dc;
            padding: 30px;
            margin: 0;
            font-size: 11px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
          }
          .header {
            border-bottom: 2px solid #00ff88;
            padding-bottom: 12px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            color: #00ff88;
            letter-spacing: 0.05em;
          }
          .subtitle {
            font-size: 10px;
            color: #848e9c;
            margin-top: 4px;
          }
          .timestamp {
            font-size: 9px;
            color: #848e9c;
            text-align: right;
          }
          .section {
            margin-bottom: 24px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 700;
            color: #00f0ff;
            border-bottom: 1px solid #1f2937;
            padding-bottom: 4px;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          th {
            background-color: #161622;
            color: #848e9c;
            text-align: left;
            padding: 6px 8px;
            font-weight: 600;
            border-bottom: 1px solid #1f2937;
          }
          td {
            padding: 6px 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .price-up { color: #00ff88 !important; }
          .price-down { color: #ff3b30 !important; }
          .text-right { text-align: right; }
          .bold { font-weight: 700; }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #1f2937;
            padding-top: 12px;
            font-size: 8px;
            color: #475569;
            text-align: center;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
          }
          .summary-card {
            background: #161622;
            border: 1px solid #1f2937;
            padding: 12px;
            border-radius: 4px;
          }
          .summary-label {
            font-size: 8px;
            color: #848e9c;
          }
          .summary-value {
            font-size: 14px;
            font-weight: 700;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${title}</div>
            <div class="subtitle">${subtitle}</div>
          </div>
          <div class="timestamp">
            QUANTDESK TERMINAL REPORT<br>
            GENERATED: ${new Date().toLocaleString()}
          </div>
        </div>
        ${contentHtml}
        <div class="footer">
          CONFIDENTIAL // FOR PROFESSIONAL USE ONLY // QUANTDESK RESEARCH DECK
        </div>
      </body>
    </html>
  `;
}

router.post('/pdf', authenticate, async (req, res) => {
  const { title, subtitle, contentHtml } = req.body;
  if (!title || !contentHtml) {
    return res.status(400).json({ error: 'Title and contentHtml are required' });
  }

  if (!puppeteer) {
    return res.json({
      success: false,
      fallback: true,
      error: 'Puppeteer is not installed in the server environment. Please use browser print fallback.'
    });
  }

  const html = renderPdfHtml(title, subtitle || 'Market Research Deck', contentHtml);

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quantdesk_${title.toLowerCase().replace(/\s+/g, '_')}.pdf"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Puppeteer generation error:', err);
    res.json({
      success: false,
      fallback: true,
      error: `Puppeteer failed to launch: ${err.message}. Please use browser print fallback.`
    });
  }
});

module.exports = router;

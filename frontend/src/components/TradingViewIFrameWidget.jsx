import React from 'react';

/**
 * Sandboxed TradingView widget wrapper that loads the widget inside an iframe.
 * This completely isolates the script execution context, preventing querySelector
 * errors and memory leaks when React pages unmount.
 */
function TradingViewIFrameWidget({ scriptSrc, config, height = '100%', width = '100%' }) {
  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: transparent;
          }
          .tradingview-widget-container {
            width: 100%;
            height: 100%;
          }
          .tradingview-widget-container__widget {
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <div class="tradingview-widget-container">
          <div class="tradingview-widget-container__widget"></div>
          <script type="text/javascript" src="${scriptSrc}" async>
            ${JSON.stringify(config)}
          </script>
        </div>
      </body>
    </html>
  `;

  return (
    <iframe
      srcDoc={srcDoc}
      style={{ width, height, border: 'none', background: 'transparent', display: 'block' }}
      title="TradingView Embedded Widget"
    />
  );
}

export default TradingViewIFrameWidget;

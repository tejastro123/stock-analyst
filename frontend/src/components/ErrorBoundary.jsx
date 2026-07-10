import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[QuantDesk ErrorBoundary]', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '32px',
          fontFamily: 'JetBrains Mono, monospace',
          background: '#06060c',
          color: '#d1d5db',
          gap: '16px'
        }}>
          <div style={{ fontSize: '11px', color: '#ff3b30', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
            ⚠ SYSTEM FAULT — COMPONENT CRASH
          </div>
          <div style={{
            background: '#11111b',
            border: '1px solid #ff3b30',
            borderRadius: '4px',
            padding: '16px',
            maxWidth: '600px',
            width: '100%'
          }}>
            <div style={{ fontSize: '10px', color: '#ff3b30', marginBottom: '8px', fontWeight: 700 }}>
              {this.state.error?.name}: {this.state.error?.message}
            </div>
            {this.state.info?.componentStack && (
              <pre style={{
                fontSize: '8px',
                color: '#848e9c',
                overflowX: 'auto',
                maxHeight: '200px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {this.state.info.componentStack.trim()}
              </pre>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '6px 16px',
                background: 'transparent',
                border: '1px solid #00ff88',
                color: '#00ff88',
                fontFamily: 'inherit',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 700,
                letterSpacing: '0.05em'
              }}
            >
              RETRY MODULE
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                padding: '6px 16px',
                background: 'transparent',
                border: '1px solid #1f2937',
                color: '#848e9c',
                fontFamily: 'inherit',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              RETURN TO DASHBOARD
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

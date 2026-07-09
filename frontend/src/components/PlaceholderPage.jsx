import React from 'react';

function PlaceholderPage({ title, code }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 16,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
    }}>
      <div style={{
        fontSize: 48,
        fontWeight: 700,
        color: 'var(--border-accent)',
        letterSpacing: '0.1em',
      }}>{code}</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{title}</div>
      <div style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        border: '1px dashed var(--border-accent)',
        padding: '8px 16px',
        borderRadius: 4,
      }}>
        Coming Day 2–7
      </div>
    </div>
  );
}

export default PlaceholderPage;

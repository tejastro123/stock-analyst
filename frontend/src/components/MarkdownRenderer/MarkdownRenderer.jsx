import React from 'react';

// Lightweight markdown renderer — no external dependency.
// Supports: # headings, **bold**, *italic*, `code`, - lists, blank line paragraphs.
function parseInline(text) {
  // Split on bold, italic, inline code
  const parts = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('`'))      parts.push(<code key={m.index} style={{ background: '#1a1a2a', padding: '1px 5px', borderRadius: 2, color: '#00f0ff', fontSize: '10px' }}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('**')) parts.push(<strong key={m.index} style={{ color: '#e2e8f0', fontWeight: 700 }}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('*'))  parts.push(<em key={m.index} style={{ color: '#a0aec0', fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MarkdownRenderer({ content, style }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let listItems = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${key++}`} style={{ paddingLeft: 18, margin: '6px 0', listStyle: 'disc' }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ marginBottom: 3, lineHeight: 1.6 }}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // H1
    if (/^# /.test(line)) {
      flushList();
      elements.push(<h1 key={key++} style={{ color: '#00ff88', fontSize: 14, fontWeight: 700, margin: '16px 0 8px', borderBottom: '1px solid #1f2937', paddingBottom: 4, letterSpacing: '0.04em' }}>{line.slice(2)}</h1>);
    }
    // H2
    else if (/^## /.test(line)) {
      flushList();
      elements.push(<h2 key={key++} style={{ color: '#00f0ff', fontSize: 12, fontWeight: 700, margin: '14px 0 6px', letterSpacing: '0.03em' }}>{line.slice(3)}</h2>);
    }
    // H3
    else if (/^### /.test(line)) {
      flushList();
      elements.push(<h3 key={key++} style={{ color: '#bf5af2', fontSize: 11, fontWeight: 700, margin: '12px 0 5px' }}>{line.slice(4)}</h3>);
    }
    // H4
    else if (/^#### /.test(line)) {
      flushList();
      elements.push(<h4 key={key++} style={{ color: '#ffb700', fontSize: 10, fontWeight: 700, margin: '10px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{line.slice(5)}</h4>);
    }
    // Unordered list
    else if (/^[*\-] /.test(line)) {
      listItems.push(line.slice(2));
    }
    // Numbered list
    else if (/^\d+\. /.test(line)) {
      listItems.push(line.replace(/^\d+\. /, ''));
    }
    // Horizontal rule
    else if (/^---/.test(line)) {
      flushList();
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid #1f2937', margin: '12px 0' }} />);
    }
    // Blank line
    else if (line.trim() === '') {
      flushList();
    }
    // Normal paragraph
    else {
      flushList();
      elements.push(
        <p key={key++} style={{ margin: '4px 0', lineHeight: 1.7, color: '#c9d1da' }}>
          {parseInline(line)}
        </p>
      );
    }
  }
  flushList();

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, ...style }}>
      {elements}
    </div>
  );
}

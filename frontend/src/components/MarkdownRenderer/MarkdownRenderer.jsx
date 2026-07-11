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
  let tableRows = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${key++}`} style={{ paddingLeft: 0, listStyle: 'none', margin: '8px 0' }}>
          {listItems.map((item, i) => {
            let sym = item.symbol;
            if (sym === '-' || sym === '*') sym = '•';
            const isCheck = sym === '✓' || sym === '✔';
            const color = isCheck ? '#00ff88' : (sym === '•' ? '#848e9c' : '#ffb700');
            return (
              <li key={i} style={{ marginBottom: 5, lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color, flexShrink: 0, fontWeight: '700' }}>{sym}</span>
                <span style={{ color: '#c9d1da' }}>{parseInline(item.text)}</span>
              </li>
            );
          })}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      const parsedRows = tableRows.map(row => {
        const parts = row.split('|').map(p => p.trim());
        if (parts[0] === '') parts.shift();
        if (parts[parts.length - 1] === '') parts.pop();
        return parts;
      });

      const isDivider = (row) => row.every(cell => /^:?-+:?$/.test(cell));
      const cleanRows = parsedRows.filter(row => !isDivider(row));

      if (cleanRows.length > 0) {
        const headers = cleanRows[0];
        const bodyRows = cleanRows.slice(1);

        elements.push(
          <div key={`table-wrapper-${key++}`} style={{ overflowX: 'auto', margin: '12px 0 16px 0', border: '1px solid #1f2937', borderRadius: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#111827', borderBottom: '1px solid #1f2937' }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', fontWeight: 600, color: '#00f0ff' }}>
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIndex) => (
                  <tr key={rowIndex} style={{ 
                    borderBottom: rowIndex === bodyRows.length - 1 ? 'none' : '1px solid #1f2937', 
                    background: rowIndex % 2 === 0 ? 'transparent' : 'rgba(31, 41, 55, 0.2)' 
                  }}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} style={{ padding: '8px 12px', color: '#c9d1da' }}>
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

    // Check Setext H1 (underlined with ===)
    if (line.trim() !== '' && /^={3,}$/.test(nextLine)) {
      flushTable();
      flushList();
      elements.push(<h1 key={key++} style={{ color: '#00ff88', fontSize: 14, fontWeight: 700, margin: '16px 0 8px', borderBottom: '1px solid #1f2937', paddingBottom: 4, letterSpacing: '0.04em' }}>{line}</h1>);
      i++; // Skip the === line
      continue;
    }

    // Check Setext H2 (underlined with ---)
    if (line.trim() !== '' && /^-{3,}$/.test(nextLine)) {
      flushTable();
      flushList();
      elements.push(<h2 key={key++} style={{ color: '#00f0ff', fontSize: 12, fontWeight: 700, margin: '14px 0 6px', letterSpacing: '0.03em' }}>{line}</h2>);
      i++; // Skip the --- line
      continue;
    }

    // Table Row
    if (/^\|.*\|$/.test(line)) {
      flushList();
      tableRows.push(line);
    }
    // ATX H1 (# Heading)
    else if (/^# /.test(line)) {
      flushTable();
      flushList();
      elements.push(<h1 key={key++} style={{ color: '#00ff88', fontSize: 14, fontWeight: 700, margin: '16px 0 8px', borderBottom: '1px solid #1f2937', paddingBottom: 4, letterSpacing: '0.04em' }}>{line.slice(2)}</h1>);
    }
    // ATX H2 (## Heading)
    else if (/^## /.test(line)) {
      flushTable();
      flushList();
      elements.push(<h2 key={key++} style={{ color: '#00f0ff', fontSize: 12, fontWeight: 700, margin: '14px 0 6px', letterSpacing: '0.03em' }}>{line.slice(3)}</h2>);
    }
    // ATX H3 (### Heading)
    else if (/^### /.test(line)) {
      flushTable();
      flushList();
      elements.push(<h3 key={key++} style={{ color: '#bf5af2', fontSize: 11, fontWeight: 700, margin: '12px 0 5px' }}>{line.slice(4)}</h3>);
    }
    // ATX H4 (#### Heading)
    else if (/^#### /.test(line)) {
      flushTable();
      flushList();
      elements.push(<h4 key={key++} style={{ color: '#ffb700', fontSize: 10, fontWeight: 700, margin: '10px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{line.slice(5)}</h4>);
    }
    // Unordered list (bullet on own line lookahead)
    else if ((/^[*\-\u2022\u2713\u2714]$/.test(line.trim()) || /^\d+\.$/.test(line.trim())) && nextLine !== '') {
      const trimmedLine = line.trim();
      const isNextLineBlockStart = 
        /^#/.test(nextLine) || 
        /^\|/.test(nextLine) || 
        /^---/.test(nextLine) || 
        /^[*\-\u2022\u2713\u2714]\s+/.test(nextLine) || 
        /^\d+\.\s+/.test(nextLine) ||
        /^[*\-\u2022\u2713\u2714]$/.test(nextLine) ||
        /^\d+\.$/.test(nextLine);
        
      if (!isNextLineBlockStart) {
        flushTable();
        const symbol = trimmedLine;
        listItems.push({ symbol, text: nextLine });
        i++; // Consume next line
      } else {
        flushTable();
        flushList();
        elements.push(
          <p key={key++} style={{ margin: '4px 0', lineHeight: 1.7, color: '#c9d1da' }}>
            {parseInline(line)}
          </p>
        );
      }
    }
    // Unordered list
    else if (/^([*\-\u2022\u2713\u2714])\s+/.test(line)) {
      flushTable();
      const match = line.match(/^([*\-\u2022\u2713\u2714])\s+/);
      const symbol = match[1];
      const text = line.slice(match[0].length);
      listItems.push({ symbol, text });
    }
    // Numbered list
    else if (/^\d+\.\s+/.test(line)) {
      flushTable();
      const match = line.match(/^(\d+)\.\s+/);
      const symbol = match[1] + '.';
      const text = line.slice(match[0].length);
      listItems.push({ symbol, text });
    }
    // Horizontal rule
    else if (/^---/.test(line)) {
      flushTable();
      flushList();
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid #1f2937', margin: '12px 0' }} />);
    }
    // Blank line
    else if (line.trim() === '') {
      flushTable();
      flushList();
    }
    // Normal paragraph
    else {
      flushTable();
      flushList();
      elements.push(
        <p key={key++} style={{ margin: '4px 0', lineHeight: 1.7, color: '#c9d1da' }}>
          {parseInline(line)}
        </p>
      );
    }
  }
  flushTable();
  flushList();

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, ...style }}>
      {elements}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';

const HEADING_RE = /^###\s*(.+)$/gm;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cleanLabel = (line, labels) => {
  const t = line.replace(/^[-•*]\s*/, '').trim();
  for (const label of labels) {
    const re = new RegExp(`^${label}\\s*[:：]?\\s*`, 'i');
    if (re.test(t)) return t.replace(re, '').trim();
  }
  return t;
};

function parseVocabulary(text, fallbackLines = []) {
  if (text) {
    const matches = [...text.matchAll(HEADING_RE)];
    if (matches.length > 0) {
      return matches.map((match, idx) => {
        const start = match.index + match[0].length;
        const end = matches[idx + 1]?.index ?? text.length;
        const lines = text.slice(start, end).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const meaningLine = lines.find(l => /쉬운 뜻|뜻|meaning/i.test(l)) || lines[0] || '';
        const roleLine = lines.find(l => /자료 속 역할|역할|role/i.test(l)) || lines[1] || '';
        return {
          term: match[1].replace(/^\d+\.\s*/, '').trim(),
          meaning: cleanLabel(meaningLine, ['쉬운 뜻', '뜻', 'Meaning']),
          role: cleanLabel(roleLine, ['자료 속 역할', '역할', 'Role in the source', 'Role']),
        };
      }).filter(item => item.term);
    }
  }
  return (fallbackLines || [])
    .map(line => {
      const [term, ...rest] = line.split(/[:：]/);
      return {
        term: (term || '').replace(/^[-•*]\s*/, '').trim(),
        meaning: rest.join(':').trim(),
        role: '',
      };
    })
    .filter(item => item.term);
}

function splitTextWithVocab(text, terms) {
  if (!text || terms.length === 0) return [{ type: 'text', content: text || '' }];
  const pattern = new RegExp(`(${terms.map(t => escapeRegex(t.term)).join('|')})`, 'g');
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    const termIdx = terms.findIndex(t => t.term === match[1]);
    segments.push({ type: 'vocab', content: match[1], termIndex: termIdx >= 0 ? termIdx : 0 });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ type: 'text', content: text.slice(lastIndex) });
  return segments;
}

export default function InlineVocabularyText({ text, vocabularyText, fallbackLines = [], isMobile, emptyText }) {
  const [openTerm, setOpenTerm] = useState(null);
  const containerRef = useRef(null);

  const terms = parseVocabulary(vocabularyText, fallbackLines);
  const segments = splitTextWithVocab(text, terms);
  const hasVocab = terms.length > 0 && segments.some(s => s.type === 'vocab');

  useEffect(() => {
    if (!openTerm) return;
    const close = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpenTerm(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openTerm]);

  if (!text) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-sub)', lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
        {emptyText}
      </p>
    );
  }

  const handleTermClick = (e, term) => {
    e.stopPropagation();
    setOpenTerm(prev => prev?.term === term.term ? null : term);
  };

  return (
    <div ref={containerRef}>
      {hasVocab && (
        <p style={{ margin: '0 0 8px', fontSize: isMobile ? 11 : 12, color: 'var(--color-text-sub)', lineHeight: 1.5 }}>
          밑줄 친 낱말을 누르면 뜻을 볼 수 있어요.
        </p>
      )}
      <div style={{
        color: 'var(--color-text)',
        background: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: isMobile ? '12px 13px' : '14px 15px',
        lineHeight: 1.85,
        fontSize: isMobile ? 14 : 15,
        whiteSpace: 'pre-wrap',
        wordBreak: 'keep-all',
        overflowWrap: 'anywhere',
      }}>
        {segments.map((seg, idx) => {
          if (seg.type === 'text') return <span key={idx}>{seg.content}</span>;
          const term = terms[seg.termIndex];
          const isOpen = openTerm?.term === term.term;
          return (
            <span
              key={idx}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={(e) => handleTermClick(e, term)}
              onKeyDown={(e) => e.key === 'Enter' && handleTermClick(e, term)}
              style={{
                fontWeight: 900,
                textDecoration: 'underline',
                textDecorationColor: 'var(--color-accent-teal)',
                textDecorationThickness: '2px',
                color: isOpen ? 'var(--color-primary)' : 'var(--color-primary-dark)',
                cursor: 'pointer',
                background: isOpen ? 'rgba(var(--color-accent-teal-rgb),0.12)' : 'transparent',
                borderRadius: 3,
                padding: '0 1px',
                transition: 'all 0.15s',
              }}
            >
              {seg.content}
            </span>
          );
        })}
      </div>

      {openTerm && (
        <div style={{
          marginTop: 8,
          background: 'var(--color-surface)',
          border: `1.5px solid var(--color-accent-teal)`,
          borderRadius: 10,
          padding: isMobile ? '10px 12px' : '11px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}>
          <span style={{ fontWeight: 900, fontSize: isMobile ? 14 : 15, color: 'var(--color-primary-dark)' }}>
            {openTerm.term}
          </span>
          {openTerm.meaning && (
            <div style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 900, color: 'var(--color-accent-teal)' }}>쉬운 뜻</span>
              <span style={{ fontSize: isMobile ? 13 : 14, color: 'var(--color-text)', lineHeight: 1.65 }}>{openTerm.meaning}</span>
            </div>
          )}
          {openTerm.role && (
            <div style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 900, color: 'var(--color-accent-teal)' }}>자료 속 역할</span>
              <span style={{ fontSize: isMobile ? 13 : 14, color: 'var(--color-text)', lineHeight: 1.65 }}>{openTerm.role}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

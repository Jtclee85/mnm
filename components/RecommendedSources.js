import { useState } from 'react';
import { RECOMMENDED_SOURCES } from '../lib/recommendedSources';

export default function RecommendedSources({ isMobile }) {
  return (
    <aside style={isMobile ? styles.wrapMobile : styles.wrap} aria-label="추천 원본자료 목록">
      <p style={styles.heading}>이런 자료를 찾아봐요</p>
      <div style={styles.list}>
        {RECOMMENDED_SOURCES.map(source => (
          <SourceBanner key={source.id} source={source} isMobile={isMobile} />
        ))}
      </div>
    </aside>
  );
}

function SourceBanner({ source, isMobile }) {
  const [active, setActive] = useState(false);

  return (
    <div style={styles.cardWrap}>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...styles.card, ...(active ? styles.cardActive : {}) }}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        aria-describedby={!isMobile ? `tip-${source.id}` : undefined}
        aria-label={`${source.name}, ${source.org}. ${source.tip}. 새 탭에서 열립니다.`}
      >
        <span style={styles.badge} aria-hidden="true">{source.name.slice(0, 1)}</span>
        <span style={styles.textCol}>
          <span style={styles.name}>{source.name}</span>
          <span style={styles.org}>{source.org}</span>
          {isMobile && <span style={styles.tipInline}>{source.tip}</span>}
        </span>
      </a>

      {!isMobile && (
        <div
          id={`tip-${source.id}`}
          role="tooltip"
          style={{ ...styles.tip, ...(active ? styles.tipVisible : styles.tipHidden) }}
        >
          <span style={styles.tipArrow} aria-hidden="true" />
          {source.tip}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap:       { width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  wrapMobile: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 },
  heading:    { fontSize: 13, fontWeight: 800, color: '#334155', margin: '0 0 2px 2px' },
  list:       { display: 'flex', flexDirection: 'column', gap: 10 },

  cardWrap: { position: 'relative' },
  card: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14,
    padding: '12px 14px', minHeight: 60, boxSizing: 'border-box',
    textDecoration: 'none', color: 'inherit', outline: 'none',
    boxShadow: '0 4px 14px rgba(15,23,42,0.05)', transition: 'all 0.15s ease',
  },
  cardActive: {
    border: '1px solid #bfdbfe', boxShadow: '0 8px 20px rgba(37,99,235,0.14)', transform: 'translateY(-1px)',
  },
  badge: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: '#eff6ff', border: '1.5px solid #bfdbfe', color: '#1d4ed8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 15,
  },
  textCol: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  name: { fontSize: 14, fontWeight: 800, color: '#111827', lineHeight: 1.3 },
  org:  { fontSize: 12, color: '#64748b', fontWeight: 600 },
  tipInline: { fontSize: 12, color: '#64748b', lineHeight: 1.45, marginTop: 2 },

  tip: {
    position: 'absolute', left: 'calc(100% + 12px)', top: '50%',
    background: '#1e3a8a', color: '#fff', borderRadius: 12,
    padding: '10px 14px', fontSize: 13, lineHeight: 1.5, width: 200, boxSizing: 'border-box',
    boxShadow: '0 8px 20px rgba(30,58,138,0.25)', zIndex: 50, pointerEvents: 'none',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
  },
  tipHidden:  { opacity: 0, visibility: 'hidden', transform: 'translateY(-50%) translateX(-6px)' },
  tipVisible: { opacity: 1, visibility: 'visible', transform: 'translateY(-50%) translateX(0)' },
  tipArrow: {
    position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
    width: 0, height: 0,
    borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
    borderRight: '6px solid #1e3a8a',
  },
};

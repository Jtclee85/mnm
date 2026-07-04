import { useState, useEffect } from 'react';

const STORAGE_KEY = 'mnmResearchCompassCollapsed';

// 조사 중 항상 참고하는 짧은 체크리스트 — 정답을 주는 게 아니라
// "자료를 넣기 전에 이것만 확인해요"를 매번 떠올리게 하는 상시 참고용.
const CHECKLIST = [
  { q: '어디에서 가져온 자료인가요?', a: '박물관, 국가유산청, 공공기관 자료인지 확인해요.' },
  { q: '누가 만든 자료인가요?', a: '기관, 연구자, 박물관처럼 만든 사람이 분명한지 봐요.' },
  { q: '언제 만들어졌거나 고쳐졌나요?', a: '너무 오래된 설명이라면 다른 자료도 함께 확인해요.' },
  { q: '자료 속 중요한 말은 무엇인가요?', a: '이름, 시대, 장소, 쓰임, 특징을 찾아요.' },
  { q: '내 생각을 뒷받침할 근거가 있나요?', a: '자료에 나온 말을 바탕으로 생각해요.' },
];

function readStoredCollapsed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

const MOTION_CSS = `
  @keyframes rc-pop-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes rc-slide-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rc-anim { animation: rc-pop-in 180ms ease; }
  .rc-anim-mobile { animation: rc-slide-up 180ms ease; }
  @media (prefers-reduced-motion: reduce) {
    .rc-anim, .rc-anim-mobile { animation: none !important; }
  }
`;

// expandSignal이 바뀔 때(튜토리얼을 막 끝냈을 때) 한 번 자동으로 펼친다.
export default function ResearchCompass({ isMobile, onReopenTutorial, expandSignal }) {
  // SSR에서는 항상 접힌 상태로 시작 — hydration mismatch 방지, 클라이언트에서만 localStorage를 읽는다.
  const [collapsed, setCollapsed] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(readStoredCollapsed());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!expandSignal) return;
    setCollapsed(false);
    try { localStorage.setItem(STORAGE_KEY, 'false'); } catch {}
  }, [expandSignal]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch {}
  }, [collapsed, hydrated]);

  useEffect(() => {
    if (collapsed) return;
    const handler = (e) => { if (e.key === 'Escape') setCollapsed(true); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [collapsed]);

  const panelBody = (
    <>
      <div style={s.header}>
        <div>
          <div style={s.headerTitle}>🧭 자료 조사 나침반</div>
          <div style={s.headerSub}>자료를 넣기 전에 이것만 확인해요.</div>
        </div>
        <button onClick={() => setCollapsed(true)} aria-label="자료 조사 나침반 접기" style={s.closeBtn}>✕</button>
      </div>
      <div style={s.list}>
        {CHECKLIST.map(({ q, a }) => (
          <div key={q} style={s.item}>
            <p style={s.itemQ}>✅ {q}</p>
            <p style={s.itemA}>{a}</p>
          </div>
        ))}
      </div>
      {onReopenTutorial && (
        <button
          data-testid="reopen-tutorial-button"
          onClick={onReopenTutorial}
          style={s.reopenBtn}
        >
          🧭 조사 퀘스트 다시 보기
        </button>
      )}
    </>
  );

  return (
    <>
      <style>{MOTION_CSS}</style>

      {collapsed ? (
        <button
          type="button"
          data-testid="research-compass-toggle"
          aria-label="자료 조사 나침반 열기"
          onClick={() => setCollapsed(false)}
          style={{ ...s.collapsedBtn, ...(isMobile ? s.collapsedBtnMobile : {}) }}
        >
          <span style={{ fontSize: 17 }}>🧭</span>
          {!isMobile && <span style={s.collapsedLabel}>자료</span>}
        </button>
      ) : isMobile ? (
        <>
          <div onClick={() => setCollapsed(true)} aria-hidden="true" style={s.overlay} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="자료 조사 나침반"
            className="rc-anim-mobile"
            style={s.sheet}
          >
            {panelBody}
          </div>
        </>
      ) : (
        <div
          role="region"
          aria-label="자료 조사 나침반"
          className="rc-anim"
          style={s.panel}
        >
          {panelBody}
        </div>
      )}
    </>
  );
}

const s = {
  collapsedBtn: {
    position: 'fixed', right: 16, top: 100, zIndex: 930,
    display: 'flex', alignItems: 'center', gap: 6,
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.4)',
    background: 'var(--color-surface)', color: 'var(--color-primary-dark)',
    borderRadius: 999, padding: '9px 12px', cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(var(--color-text-rgb),0.12)',
    fontWeight: 800, fontSize: 12,
  },
  // 모바일에서 결과 캔버스가 전체 화면으로 열리면 헤더(닫기 버튼 등)가 우상단을 차지하므로,
  // 그 아래로 내려 겹치지 않게 한다.
  collapsedBtnMobile: { right: 10, top: 64, padding: '8px 10px' },
  collapsedLabel: { whiteSpace: 'nowrap' },

  panel: {
    position: 'fixed', right: 16, top: 100, zIndex: 931,
    width: 300, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 18, boxShadow: '0 16px 40px rgba(var(--color-text-rgb),0.16)',
    padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12,
  },

  overlay: { position: 'fixed', inset: 0, zIndex: 928, background: 'rgba(0,0,0,0.3)' },
  sheet: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 931,
    maxHeight: '75vh', overflowY: 'auto',
    background: 'var(--color-surface)', borderRadius: '18px 18px 0 0',
    boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
    padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12,
  },

  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headerTitle: { fontSize: 14, fontWeight: 900, color: 'var(--color-primary-dark)' },
  headerSub: { fontSize: 11.5, color: 'var(--color-text-sub)', marginTop: 2, lineHeight: 1.5 },
  closeBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    width: 26, height: 26, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  item: {
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
    borderRadius: 10, padding: '8px 11px',
  },
  itemQ: { margin: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.5 },
  itemA: { margin: '3px 0 0', fontSize: 11.5, color: 'var(--color-text-sub)', lineHeight: 1.5 },
  reopenBtn: {
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)', background: 'rgba(var(--color-accent-teal-rgb),0.08)',
    color: 'var(--color-primary-dark)', fontWeight: 800, fontSize: 12,
    padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
  },
};

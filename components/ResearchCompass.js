// 자료 조사 나침반 — 랜딩 화면(자료 검색·입력 단계)에서 조사자료 입력 폼 옆에
// 고정 컬럼으로 배치되는 체크리스트. 정답을 주는 게 아니라
// "자료를 넣기 전에 이것만 확인해요"를 매번 떠올리게 하는 상시 참고용.
const CHECKLIST = [
  { q: '어디에서 가져온 자료인가요?', a: '박물관, 국가유산청, 공공기관 자료인지 확인해요.' },
  { q: '누가 만든 자료인가요?', a: '기관, 연구자, 박물관처럼 만든 사람이 분명한지 봐요.' },
  { q: '언제 만들어졌거나 고쳐졌나요?', a: '너무 오래된 설명이라면 다른 자료도 함께 확인해요.' },
  { q: '자료 속 중요한 말은 무엇인가요?', a: '이름, 시대, 장소, 쓰임, 특징을 찾아요.' },
  { q: '내 생각을 뒷받침할 근거가 있나요?', a: '자료에 나온 말을 바탕으로 생각해요.' },
];

export default function ResearchCompass({ isMobile, onReopenTutorial }) {
  return (
    <aside
      data-testid="research-compass"
      role="complementary"
      aria-label="자료 조사 나침반"
      style={{ ...s.panel, ...(isMobile ? s.panelMobile : {}) }}
    >
      <div style={s.header}>
        <div style={s.headerTitle}>🧭 자료 조사 나침반</div>
        <div style={s.headerSub}>자료를 넣기 전에 이것만 확인해요.</div>
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
          🧭 자료 조사 주의점 다시 보기
        </button>
      )}
    </aside>
  );
}

const s = {
  // RecommendedSources(300px)와 같은 폭으로 좌우 대칭을 맞춘다.
  panel: {
    width: 300, flexShrink: 0, alignSelf: 'flex-start',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 18, boxShadow: '0 2px 8px rgba(var(--color-text-rgb),0.08)',
    padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12,
    boxSizing: 'border-box',
  },
  panelMobile: { width: '100%', alignSelf: 'stretch' },

  header: { display: 'flex', flexDirection: 'column', gap: 2 },
  headerTitle: { fontSize: 14, fontWeight: 900, color: 'var(--color-primary-dark)' },
  headerSub: { fontSize: 11.5, color: 'var(--color-text-sub)', lineHeight: 1.5 },
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

import { useEffect } from 'react';

// 첫 접속 튜토리얼 — '역사 자료 찾는 법'을 5단계 퀘스트로 짧게 안내한다.
// 완성된 정답을 주는 게 아니라, 조사 습관(자료 고르기 → 검색어 만들기 →
// 핵심 정보 찾기 → 출처 남기기 → 뭐냐면으로 탐구 시작)을 짧게 체험하게 한다.
export const TUTORIAL_QUESTS = [
  {
    icon: '🏛️',
    keyword: '믿을 수 있는 곳',
    title: 'Quest 1. 믿을 수 있는 자료 찾기',
    body: '역사 자료는 아무 글이나 쓰지 않아요.\n박물관, 국가유산청, 공공기관, 학교에서 안내한 자료를 먼저 확인해요.',
    visual: { title: '먼저 보기 좋은 곳', content: '박물관 · 국가유산청 · 공공기관 · 학교 안내자료' },
    mission: '미션: 자료를 찾으면 사이트 이름을 먼저 확인해 보세요.',
  },
  {
    icon: '🔍',
    keyword: '검색어 만들기',
    title: 'Quest 2. 좋은 검색어 만들기',
    body: '검색어는 짧고 정확할수록 좋아요.\n유물 이름, 장소, 시대, 궁금한 말을 함께 넣어 보세요.',
    visual: { title: '이름 + 궁금한 말', content: '예: 성덕대왕신종 + 특징' },
    examples: ['성덕대왕신종 특징', '경복궁 근정전 쓰임', '고인돌 만든 까닭', '청동기 시대 생활 모습'],
    mission: '미션: 조사하려는 대상의 이름과 궁금한 말을 함께 써 보세요.',
  },
  {
    icon: '🧷',
    keyword: '중요한 말 표시',
    title: 'Quest 3. 자료에서 핵심 정보 찾기',
    body: '자료를 읽을 때는 중요한 정보를 표시해요.\n이름, 시대, 장소, 쓰임, 특징, 까닭을 찾아보세요.',
    checks: ['이름', '시대', '장소', '쓰임', '특징', '까닭'],
    mission: '미션: 자료에서 가장 중요한 낱말 2개를 찾아보세요.',
  },
  {
    icon: '🧩',
    keyword: '근거 붙이기',
    title: 'Quest 4. 출처와 근거 남기기',
    body: '내 생각을 쓸 때는 자료에 나온 말을 함께 남겨야 해요.\n그래야 내 생각이 더 믿을 수 있어요.',
    frames: ['자료에는 “__________”라고 나와 있다.', '그래서 나는 __________라고 생각한다.'],
    mission: '미션: 내 생각을 뒷받침할 자료 속 말을 하나 찾아보세요.',
  },
  {
    icon: '🚀',
    keyword: '탐구 시작',
    title: 'Quest 5. 뭐냐면으로 탐구 시작하기',
    body: '찾은 자료를 뭐냐면에 넣으면 쉬운 설명으로 바꿔 볼 수 있어요.\n그다음 탐구 질문을 고르고, 발표나 글쓰기로 이어 갈 수 있어요.',
    visual: { title: '뭐냐면 탐구 순서', content: '원본자료 넣기 → 쉬운 설명 보기 → 질문 고르기 → 발표·글쓰기' },
    mission: '미션: 이제 조사 주제와 원본자료를 넣고 분석을 시작해 보세요.',
    isLast: true,
  },
];

const MOTION_CSS = `
  /* 데스크톱: 기본 transform이 translate(-50%,-50%) 센터링이므로
     애니메이션 키프레임에도 센터링을 포함해야 도중에 위치가 튀지 않는다. */
  @keyframes rtq-pop-in {
    from { opacity: 0; transform: translate(-50%, calc(-50% + 8px)); }
    to   { opacity: 1; transform: translate(-50%, -50%); }
  }
  @keyframes rtq-slide-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rtq-anim { animation: rtq-pop-in 180ms ease; }
  .rtq-anim-mobile { animation: rtq-slide-up 180ms ease; }
  @media (prefers-reduced-motion: reduce) {
    .rtq-anim, .rtq-anim-mobile { animation: none !important; }
  }
`;

export default function ResearchTutorialQuest({ isOpen, step, onNext, onPrev, onSkip, onDontShowAgain, onComplete, onClose, isMobile }) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quest = TUTORIAL_QUESTS[step];
  const total = TUTORIAL_QUESTS.length;

  return (
    <>
      <style>{MOTION_CSS}</style>
      <div style={s.overlay} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rtq-title"
        className={isMobile ? 'rtq-anim-mobile' : 'rtq-anim'}
        style={{ ...s.dialog, ...(isMobile ? s.dialogMobile : {}) }}
      >
        <div style={s.header}>
          <div>
            <div id="rtq-title" style={s.headerTitle}>🧭 자료를 조사할 때 주의점 알아보기</div>
            <div style={s.headerSub}>좋은 자료를 고르면, 좋은 탐구가 시작돼요.</div>
          </div>
          <button onClick={onClose} aria-label="튜토리얼 닫기" style={s.closeBtn}>✕</button>
        </div>

        {/* 단계 표시 — 숫자 chip으로 현재 위치가 한눈에 보이게 */}
        <div style={s.steps} aria-label={`5단계 중 ${step + 1}단계`}>
          {TUTORIAL_QUESTS.map((_, idx) => (
            <span
              key={idx}
              style={{
                ...s.stepChip,
                ...(idx === step ? s.stepChipActive : {}),
                ...(idx < step ? s.stepChipDone : {}),
              }}
            >
              {idx + 1}
            </span>
          ))}
          <span style={s.stepLabel}>Step {step + 1} / {total}</span>
        </div>

        <div style={s.body}>
          <div style={s.questHead}>
            <span style={s.questIcon} aria-hidden="true">{quest.icon}</span>
            <div style={s.questHeadText}>
              <span style={s.keywordBadge}>{quest.keyword}</span>
              <h3 style={s.questTitle}>{quest.title}</h3>
            </div>
          </div>
          <p style={s.questBody}>{quest.body}</p>

          {quest.visual && (
            <div style={s.visualCard}>
              <p style={s.visualTitle}>{quest.visual.title}</p>
              <p style={s.visualContent}>{quest.visual.content}</p>
            </div>
          )}

          {quest.examples && (
            <div style={s.exampleBox}>
              {quest.examples.map(ex => (
                <span key={ex} style={s.examplePill}>{ex}</span>
              ))}
            </div>
          )}

          {quest.checks && (
            <div style={s.checkRow}>
              {quest.checks.map(c => (
                <span key={c} style={s.checkPill}>{c}</span>
              ))}
            </div>
          )}

          {quest.frames && (
            <div style={s.frameBox}>
              {quest.frames.map(f => <p key={f} style={s.frameLine}>{f}</p>)}
            </div>
          )}

          <p style={s.missionBox}>{quest.mission}</p>
        </div>

        <div style={s.footer}>
          <button onClick={onSkip} style={s.skipBtn}>건너뛰기</button>
          <div style={s.footerRight}>
            {step > 0 && (
              <button onClick={onPrev} style={s.secondaryBtn}>이전</button>
            )}
            {quest.isLast ? (
              <button onClick={onComplete} style={s.primaryBtn}>조사 시작하기</button>
            ) : (
              <button onClick={onNext} style={s.primaryBtn}>다음</button>
            )}
          </div>
        </div>

        <button onClick={onDontShowAgain} style={s.dontShowBtn}>
          다시 보지 않기
        </button>
      </div>
    </>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1200,
    background: 'rgba(var(--color-text-rgb),0.45)',
  },
  dialog: {
    position: 'fixed', zIndex: 1201,
    top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: 'min(600px, calc(100vw - 24px))', maxHeight: '85vh', overflowY: 'auto',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 20, boxShadow: '0 24px 60px rgba(var(--color-text-rgb),0.3)',
    padding: '22px 26px 18px', display: 'flex', flexDirection: 'column', gap: 14,
  },
  dialogMobile: {
    top: 'auto', bottom: 0, left: 0, right: 0, transform: 'none',
    width: '100%', maxHeight: '88vh', borderRadius: '20px 20px 0 0',
    padding: '18px 20px 16px',
  },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headerTitle: { fontSize: 17, fontWeight: 900, color: 'var(--color-primary-dark)' },
  headerSub: { fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sub)', marginTop: 3 },
  closeBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    width: 30, height: 30, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
  },

  steps: { display: 'flex', alignItems: 'center', gap: 6 },
  stepChip: {
    width: 24, height: 24, borderRadius: '50%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
    color: 'var(--color-text-sub)', fontSize: 11.5, fontWeight: 800,
  },
  stepChipActive: {
    background: 'var(--color-primary)', border: '1px solid var(--color-primary)',
    color: 'var(--color-surface)',
  },
  stepChipDone: {
    background: 'rgba(var(--color-accent-teal-rgb),0.15)',
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
    color: 'var(--color-primary-dark)',
  },
  stepLabel: { marginLeft: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-sub)' },

  body: { display: 'flex', flexDirection: 'column', gap: 12 },
  questHead: { display: 'flex', alignItems: 'center', gap: 12 },
  questIcon: { fontSize: 38, lineHeight: 1, flexShrink: 0 },
  questHeadText: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  keywordBadge: {
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
    background: 'rgba(var(--color-accent-teal-rgb),0.1)',
    color: 'var(--color-primary-dark)', borderRadius: 999,
    padding: '2px 10px', fontSize: 12, fontWeight: 800,
  },
  questTitle: { margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--color-text)' },
  questBody: { margin: 0, fontSize: 14.5, lineHeight: 1.75, color: 'var(--color-text-sub)', whiteSpace: 'pre-line' },

  visualCard: {
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
    borderRadius: 12, padding: '11px 14px',
    display: 'flex', flexDirection: 'column', gap: 3,
  },
  visualTitle: { margin: 0, fontSize: 12.5, fontWeight: 900, color: 'var(--color-primary-dark)' },
  visualContent: { margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.6 },

  exampleBox: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  examplePill: {
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)', background: 'rgba(var(--color-accent-teal-rgb),0.08)',
    color: 'var(--color-primary-dark)', borderRadius: 999, padding: '5px 11px', fontSize: 12.5, fontWeight: 800,
  },
  checkRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  checkPill: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)',
    color: 'var(--color-text)', borderRadius: 8, padding: '5px 11px', fontSize: 13, fontWeight: 700,
  },
  frameBox: {
    background: 'var(--color-surface-alt)', border: '1px dashed var(--color-border)',
    borderRadius: 10, padding: '10px 14px',
  },
  frameLine: { margin: '2px 0', fontSize: 13.5, color: 'var(--color-text-sub)', fontStyle: 'italic', lineHeight: 1.65 },
  missionBox: {
    margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)',
    background: 'color-mix(in srgb, var(--color-gold) 18%, var(--color-surface))',
    border: '1px solid rgba(var(--color-gold-rgb),0.55)', borderRadius: 10, padding: '10px 14px', lineHeight: 1.6,
  },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  footerRight: { display: 'flex', gap: 8 },
  skipBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    fontWeight: 700, fontSize: 13, padding: '10px 15px', borderRadius: 12, cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 800, fontSize: 13, padding: '10px 15px', borderRadius: 12, cursor: 'pointer',
  },
  primaryBtn: {
    border: 'none', background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, fontSize: 13, padding: '10px 18px', borderRadius: 12, cursor: 'pointer',
  },
  dontShowBtn: {
    alignSelf: 'center', border: 'none', background: 'transparent', color: 'var(--color-text-sub)',
    fontSize: 12, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 5,
  },
};

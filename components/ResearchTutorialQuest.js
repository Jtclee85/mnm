import { useEffect } from 'react';

// 첫 접속 튜토리얼 — '역사 자료 찾는 법'을 5단계 퀘스트로 짧게 안내한다.
// 완성된 정답을 주는 게 아니라, 조사 습관(검색어 만들기 → 자료 고르기 →
// 핵심 정보 찾기 → 출처 남기기 → 뭐냐면으로 탐구 시작)을 짧게 체험하게 한다.
export const TUTORIAL_QUESTS = [
  {
    title: 'Quest 1. 믿을 수 있는 자료 찾기',
    body: '역사 자료는 아무 글이나 쓰지 않아요.\n박물관, 국가유산청, 공공기관, 학교에서 안내한 자료를 먼저 확인해요.',
    mission: '미션: 자료를 찾으면 사이트 이름을 먼저 확인해 보세요.',
  },
  {
    title: 'Quest 2. 좋은 검색어 만들기',
    body: '검색어는 짧고 정확할수록 좋아요.\n유물 이름, 장소, 시대, 궁금한 말을 함께 넣어 보세요.',
    examples: ['성덕대왕신종 특징', '경복궁 근정전 쓰임', '고인돌 만든 까닭', '청동기 시대 생활 모습'],
    mission: '미션: 조사하려는 대상의 이름과 궁금한 말을 함께 써 보세요.',
  },
  {
    title: 'Quest 3. 자료에서 핵심 정보 찾기',
    body: '자료를 읽을 때는 중요한 정보를 표시해요.\n이름, 시대, 장소, 쓰임, 특징, 까닭을 찾아보세요.',
    checks: ['이름', '시대', '장소', '쓰임', '특징', '까닭'],
    mission: '미션: 자료에서 가장 중요한 낱말 2개를 찾아보세요.',
  },
  {
    title: 'Quest 4. 출처와 근거 남기기',
    body: '내 생각을 쓸 때는 자료에 나온 말을 함께 남겨야 해요.\n그래야 내 생각이 더 믿을 수 있어요.',
    frames: ['자료에는 “__________”라고 나와 있다.', '그래서 나는 __________라고 생각한다.'],
    mission: '미션: 내 생각을 뒷받침할 자료 속 말을 하나 찾아보세요.',
  },
  {
    title: 'Quest 5. 뭐냐면으로 탐구 시작하기',
    body: '찾은 자료를 뭐냐면에 넣으면 쉬운 설명으로 바꿔 볼 수 있어요.\n그다음 탐구 질문을 고르고, 발표나 글쓰기로 이어 갈 수 있어요.',
    mission: '미션: 이제 조사 주제와 원본자료를 넣고 분석을 시작해 보세요.',
    isLast: true,
  },
];

const MOTION_CSS = `
  @keyframes rtq-pop-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rtq-anim { animation: rtq-pop-in 180ms ease; }
  @media (prefers-reduced-motion: reduce) {
    .rtq-anim { animation: none !important; }
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
        className="rtq-anim"
        style={{ ...s.dialog, ...(isMobile ? s.dialogMobile : {}) }}
      >
        <div style={s.header}>
          <div>
            <div id="rtq-title" style={s.headerTitle}>🧭 자료를 조사할 때 주의점 알아보기</div>
            <div style={s.stepLabel}>Step {step + 1} / {total}</div>
          </div>
          <button onClick={onClose} aria-label="튜토리얼 닫기" style={s.closeBtn}>✕</button>
        </div>

        <div style={s.dots}>
          {TUTORIAL_QUESTS.map((_, idx) => (
            <span key={idx} style={{ ...s.dot, ...(idx === step ? s.dotActive : {}) }} />
          ))}
        </div>

        <div style={s.body}>
          <h3 style={s.questTitle}>{quest.title}</h3>
          <p style={s.questBody}>{quest.body}</p>

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
    width: 'min(440px, calc(100vw - 32px))', maxHeight: '85vh', overflowY: 'auto',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 20, boxShadow: '0 24px 60px rgba(var(--color-text-rgb),0.3)',
    padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12,
  },
  dialogMobile: {
    top: 'auto', bottom: 0, left: 0, right: 0, transform: 'none',
    width: '100%', maxHeight: '88vh', borderRadius: '20px 20px 0 0',
  },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headerTitle: { fontSize: 15, fontWeight: 900, color: 'var(--color-primary-dark)' },
  stepLabel: { fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-sub)', marginTop: 2 },
  closeBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    width: 28, height: 28, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
  },
  dots: { display: 'flex', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--color-border)' },
  dotActive: { background: 'var(--color-primary)' },
  body: { display: 'flex', flexDirection: 'column', gap: 10 },
  questTitle: { margin: 0, fontSize: 16.5, fontWeight: 900, color: 'var(--color-text)' },
  questBody: { margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--color-text-sub)', whiteSpace: 'pre-line' },
  exampleBox: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  examplePill: {
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)', background: 'rgba(var(--color-accent-teal-rgb),0.08)',
    color: 'var(--color-primary-dark)', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 800,
  },
  checkRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  checkPill: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)',
    color: 'var(--color-text)', borderRadius: 8, padding: '4px 10px', fontSize: 12.5, fontWeight: 700,
  },
  frameBox: {
    background: 'var(--color-surface-alt)', border: '1px dashed var(--color-border)',
    borderRadius: 10, padding: '9px 12px',
  },
  frameLine: { margin: '2px 0', fontSize: 13, color: 'var(--color-text-sub)', fontStyle: 'italic', lineHeight: 1.6 },
  missionBox: {
    margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)',
    background: 'color-mix(in srgb, var(--color-gold) 18%, var(--color-surface))',
    border: '1px solid rgba(var(--color-gold-rgb),0.55)', borderRadius: 10, padding: '9px 12px', lineHeight: 1.6,
  },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  footerRight: { display: 'flex', gap: 8 },
  skipBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    fontWeight: 700, fontSize: 12.5, padding: '9px 14px', borderRadius: 12, cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 800, fontSize: 12.5, padding: '9px 14px', borderRadius: 12, cursor: 'pointer',
  },
  primaryBtn: {
    border: 'none', background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, fontSize: 12.5, padding: '9px 16px', borderRadius: 12, cursor: 'pointer',
  },
  dontShowBtn: {
    alignSelf: 'center', border: 'none', background: 'transparent', color: 'var(--color-text-sub)',
    fontSize: 11.5, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 4,
  },
};

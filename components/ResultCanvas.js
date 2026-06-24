import { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import SectionCard from './SectionCard';
import BulletList from './BulletList';
import QuizCard from './QuizCard';
import ReflectionCard from './ReflectionCard';
import WritingOutlineCard from './WritingOutlineCard';
import { copyText } from '../lib/parseResponse';
import { REFLECTION_FIELDS } from '../lib/reflectionFields';

export const TAB_OPTIONS = [
  { value: 'understand',   label: '이해',   icon: '🧒' },
  { value: 'inquiry',      label: '탐구',   icon: '🔍' },
  { value: 'presentation', label: '발표',   icon: '🎤' },
  { value: 'writing',      label: '글쓰기', icon: '✏️' },
];

const TOOL_CONFIG = [
  { key: 'quiz',       label: '💡 퀴즈',      tip: '학습 내용으로 퀴즈를\n만들어 풀어볼 수 있어요.' },
  { key: 'evaluation', label: '🌟 나 어땠어?', tip: '지금까지 공부과정과\n조사활동을 돌아봐요.' },
  { key: 'teacher',    label: '✍️ 교과평어',  tip: '교과 세부능력 특기사항\n예시문을 만들어 줘요.' },
];

export default function ResultCanvas({
  activeMode, onTabClick, onClose,
  analysisByMode, loadingMode,
  toolResults, quizKey, parsedQuiz, quizResult, setQuizResult,
  onQuiz, onEvaluation, onTeacherComment,
  isBusy, loadingTool,
  notes, updateNote, saveStatus, handleShare,
  isMobile, onQuestionAsk,
}) {
  const [hoveredTool, setHoveredTool] = useState(null);
  const canvasRef    = useRef(null);
  const canvasBodyRef = useRef(null);
  const quizCardRef   = useRef(null);
  const evalCardRef   = useRef(null);
  const teacherCardRef = useRef(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = isMobile ? 'translateY(16px)' : 'translateX(24px)';
    const id = requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollCanvasTo = (ref) => {
    setTimeout(() => {
      if (!ref.current || !canvasBodyRef.current) return;
      const container = canvasBodyRef.current;
      const elTop = ref.current.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      container.scrollTop += elTop - containerTop - 16;
    }, 150);
  };

  useEffect(() => { if (toolResults.quiz)       scrollCanvasTo(quizCardRef);    }, [toolResults.quiz]);
  useEffect(() => { if (toolResults.evaluation)  scrollCanvasTo(evalCardRef);    }, [toolResults.evaluation]);
  useEffect(() => { if (toolResults.teacher)     scrollCanvasTo(teacherCardRef); }, [toolResults.teacher]);

  const result = analysisByMode[activeMode] || {};
  const isTabLoading = loadingMode === activeMode;

  const renderModeContent = () => {
    if (isTabLoading) {
      return (
        <div style={s.loadingState}>
          <div style={s.loadingSpinner} />
          <p style={s.loadingText}>분석 중이야, 잠깐만 기다려 줘!</p>
        </div>
      );
    }

    if (activeMode === 'understand') return (
      <>
        <SectionCard
          title="쉬운 설명" icon="🧒" isMobile={isMobile}
          actions={result.easy ? (
            <button style={s.smallBtn} onClick={async () => {
              try { await copyText(result.easy); alert('쉬운 설명을 복사했어요.'); }
              catch { alert('복사에 실패했어요.'); }
            }}>복사</button>
          ) : null}
        >
          {result.easy
            ? <div style={s.md}><ReactMarkdown>{result.easy}</ReactMarkdown></div>
            : <p style={s.empty}>분석하면 여기에 쉬운 설명이 나타납니다.</p>}
        </SectionCard>
        <SectionCard title="어려운 낱말 풀이" icon="📚" isMobile={isMobile}>
          <BulletList items={result.vocabularyLines} isMobile={isMobile} />
        </SectionCard>
        <SectionCard title="핵심 내용 3줄" icon="📝" isMobile={isMobile}>
          <BulletList items={result.summaryLines} isMobile={isMobile} />
        </SectionCard>
        <SectionCard title="내가 다시 말해보기" icon="🗣️" isMobile={isMobile}>
          <BulletList items={result.reteachLines} isMobile={isMobile} />
        </SectionCard>
        <ReflectionCard fields={REFLECTION_FIELDS.understand} notes={notes}
          onUpdate={updateNote} saveStatus={saveStatus} onShare={handleShare} isMobile={isMobile} />
      </>
    );

    if (activeMode === 'inquiry') return (
      <>
        <SectionCard title="핵심 개념" icon="🧠" isMobile={isMobile}>
          <BulletList items={result.keywordLines} isMobile={isMobile} />
        </SectionCard>
        <SectionCard title="탐구 질문" icon="❓" isMobile={isMobile}>
          <BulletList items={result.questionLines} isMobile={isMobile} />
          {result.questionLines?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {result.questionLines.map((q, idx) => (
                <button key={`${q}-${idx}`} style={s.qBtn} onClick={() => onQuestionAsk(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
        </SectionCard>
        <ReflectionCard fields={REFLECTION_FIELDS.inquiry} notes={notes}
          onUpdate={updateNote} saveStatus={saveStatus} onShare={handleShare} isMobile={isMobile} />
        <SectionCard title="추천 검색어" icon="🔎" isMobile={isMobile}>
          <BulletList items={result.searchLines} isMobile={isMobile} />
        </SectionCard>
        <SectionCard title="더 조사할 거리" icon="🧭" isMobile={isMobile}>
          <BulletList items={result.furtherLines} isMobile={isMobile} />
        </SectionCard>
      </>
    );

    if (activeMode === 'presentation') return (
      <>
        <SectionCard title="발표 제목" icon="🏷️" isMobile={isMobile}>
          {result.presentationTitle
            ? <div style={s.bigTitle}>{result.presentationTitle}</div>
            : <p style={s.empty}>분석하면 여기에 발표 제목이 나타납니다.</p>}
        </SectionCard>
        <SectionCard title="발표용 3문장" icon="🎤" isMobile={isMobile}>
          <BulletList items={result.presentationScriptLines} isMobile={isMobile} />
        </SectionCard>
        <SectionCard title="발표 순서" icon="📍" isMobile={isMobile}>
          <BulletList items={result.presentationOrderLines} isMobile={isMobile} />
        </SectionCard>
        <SectionCard title="예상 질문" icon="🙋" isMobile={isMobile}>
          <BulletList items={result.expectedQuestionLines} isMobile={isMobile} />
        </SectionCard>
        <ReflectionCard fields={REFLECTION_FIELDS.presentation} notes={notes}
          onUpdate={updateNote} saveStatus={saveStatus} onShare={handleShare} isMobile={isMobile} />
      </>
    );

    if (activeMode === 'writing') return (
      <>
        <SectionCard
          title="설명문 개요 (처음-가운데-끝)" icon="✏️" isMobile={isMobile}
          actions={result.writingOutline ? (
            <button style={s.smallBtn} onClick={async () => {
              try { await copyText(result.writingOutline); alert('개요를 복사했어요.'); }
              catch { alert('복사에 실패했어요.'); }
            }}>복사</button>
          ) : null}
        >
          <WritingOutlineCard outline={result.writingOutline} isMobile={isMobile} />
        </SectionCard>
        <SectionCard title="핵심 내용 3줄" icon="📝" isMobile={isMobile}>
          <BulletList items={result.summaryLines} isMobile={isMobile} />
        </SectionCard>
        <SectionCard title="어려운 낱말 풀이" icon="📚" isMobile={isMobile}>
          <BulletList items={result.vocabularyLines} isMobile={isMobile} />
        </SectionCard>
        <ReflectionCard fields={REFLECTION_FIELDS.writing} notes={notes}
          onUpdate={updateNote} saveStatus={saveStatus} onShare={handleShare} isMobile={isMobile} />
      </>
    );

    return null;
  };

  const toolHandlers = { quiz: onQuiz, evaluation: onEvaluation, teacher: onTeacherComment };

  return (
    <div ref={canvasRef} style={isMobile ? s.canvasMobile : s.canvas}>
      <style>{`@keyframes cv-spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={s.header}>
        <span style={s.headerTitle}>📊 분석 결과</span>

        <div style={s.toolBar}>
          {TOOL_CONFIG.map(({ key, label, tip }) => (
            <div key={key} style={{ position: 'relative', zIndex: hoveredTool === key ? 10 : 1 }}>
              <button
                style={{ ...s.toolBtn, position: 'relative', overflow: 'hidden' }}
                onClick={toolHandlers[key]}
                disabled={isBusy}
                onMouseEnter={() => setHoveredTool(key)}
                onMouseLeave={() => setHoveredTool(null)}
              >
                {loadingTool === key && <span className="tool-fill-bar" />}
                {label}
              </button>
              {hoveredTool === key && (
                <div style={s.tip}>
                  <div style={s.tipArrow} />
                  {tip}
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={onClose} style={s.closeBtn} title="닫기">✕</button>
      </div>

      {/* ── Tabs ── */}
      <div style={s.tabBar}>
        {TAB_OPTIONS.map(({ value, label, icon }) => (
          <button
            key={value}
            style={{ ...s.tab, ...(activeMode === value ? s.tabActive : {}) }}
            onClick={() => onTabClick(value)}
            disabled={loadingMode !== null && loadingMode !== value}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            {label}
            {loadingMode === value && <span style={s.tabSpinner} />}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div ref={canvasBodyRef} style={s.body}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {renderModeContent()}

          {toolResults.quiz && (
            <div ref={quizCardRef}>
              <SectionCard title="퀴즈" icon="🎯" isMobile={isMobile}>
                <QuizCard key={quizKey} quizData={parsedQuiz} onReset={onQuiz}
                  isMobile={isMobile} onResult={setQuizResult} />
              </SectionCard>
            </div>
          )}

          {toolResults.evaluation && (
            <div ref={evalCardRef}>
              <SectionCard title="학습 평가" icon="🌟" isMobile={isMobile}>
                <div style={s.md}><ReactMarkdown>{toolResults.evaluation}</ReactMarkdown></div>
              </SectionCard>
            </div>
          )}

          {toolResults.teacher && (
            <div ref={teacherCardRef}>
              <SectionCard
                title="교과평어 예시" icon="🧾" isMobile={isMobile}
                actions={
                  <button style={s.smallBtn} onClick={async () => {
                    try { await copyText(toolResults.teacher); alert('교과평어를 복사했어요.'); }
                    catch { alert('복사에 실패했어요.'); }
                  }}>복사</button>
                }
              >
                <div style={s.md}><ReactMarkdown>{toolResults.teacher}</ReactMarkdown></div>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  canvas: {
    display: 'flex', flexDirection: 'column',
    background: '#ffffff', border: '1px solid #e5e7eb',
    borderRadius: 20, boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
    overflow: 'hidden',
    height: 'calc(100vh - 48px)', position: 'sticky', top: 24, alignSelf: 'start',
  },
  canvasMobile: {
    position: 'fixed', inset: 0, zIndex: 200, borderRadius: 0,
    display: 'flex', flexDirection: 'column',
    background: '#ffffff', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 14px', borderBottom: '1px solid #eef2f7',
    background: '#fcfcff', flexShrink: 0,
  },
  headerTitle: { fontWeight: 800, fontSize: 14, color: '#111827', flex: 1 },
  toolBar: { display: 'flex', gap: 5, alignItems: 'center' },
  toolBtn: {
    border: '1px solid #dbeafe', background: '#f8fbff', color: '#1e3a8a',
    padding: '5px 8px', borderRadius: 9, cursor: 'pointer',
    fontWeight: 800, fontSize: 11, whiteSpace: 'nowrap',
  },
  tip: {
    position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
    transform: 'translateX(-50%)',
    background: '#1e3a8a', color: '#fff', borderRadius: 10,
    padding: '7px 10px', fontSize: 11, lineHeight: 1.6,
    zIndex: 100, whiteSpace: 'pre-line', textAlign: 'center',
    boxShadow: '0 4px 14px rgba(30,58,138,0.25)', minWidth: 130,
  },
  tipArrow: {
    position: 'absolute', top: -6, left: 'calc(50% - 6px)',
    width: 0, height: 0,
    borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
    borderBottom: '6px solid #1e3a8a',
  },
  closeBtn: {
    border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280',
    borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
    fontWeight: 700, fontSize: 13, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  },
  tabBar: {
    display: 'flex', borderBottom: '1px solid #e5e7eb',
    background: '#f8fafc', flexShrink: 0,
  },
  tab: {
    flex: 1, border: 'none', background: 'transparent',
    color: '#6b7280', fontWeight: 700, fontSize: 12,
    padding: '9px 4px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderBottom: '2px solid transparent', transition: 'all 0.15s ease',
  },
  tabActive: { color: '#2563eb', borderBottom: '2px solid #2563eb', background: '#fff' },
  tabSpinner: {
    display: 'inline-block', width: 9, height: 9,
    border: '2px solid #e5e7eb', borderTop: '2px solid #7c3aed',
    borderRadius: '50%', animation: 'cv-spin 0.8s linear infinite',
    marginLeft: 3, verticalAlign: 'middle',
  },
  body: { flex: 1, overflowY: 'auto', padding: 18 },
  loadingState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '60px 20px', gap: 16,
  },
  loadingSpinner: {
    width: 36, height: 36,
    border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb',
    borderRadius: '50%', animation: 'cv-spin 1s linear infinite',
  },
  loadingText: { color: '#6b7280', fontSize: 14, fontWeight: 600, margin: 0 },
  empty: { margin: 0, color: '#9ca3af', fontSize: 14, lineHeight: 1.6 },
  md: { color: '#1f2937', lineHeight: 1.8, fontSize: 15 },
  smallBtn: {
    border: '1px solid #d1d5db', background: '#fff', color: '#374151',
    fontWeight: 700, padding: '7px 11px', borderRadius: 9, cursor: 'pointer', fontSize: 13,
  },
  bigTitle: {
    fontSize: 19, fontWeight: 900, color: '#5b21b6', background: '#f5f3ff',
    border: '1px solid #ddd6fe', borderRadius: 14, padding: '15px 17px', lineHeight: 1.6,
  },
  qBtn: {
    border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8',
    padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
    fontWeight: 700, textAlign: 'left', fontSize: 14,
  },
};

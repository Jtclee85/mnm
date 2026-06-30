import { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import SectionCard from './SectionCard';
import BulletList from './BulletList';
import QuizCard from './QuizCard';
import ReflectionCard from './ReflectionCard';
import WritingOutlineCard from './WritingOutlineCard';
import WritingChecklist from './WritingChecklist';
import WritingSectionBlocks from './WritingSectionBlocks';
import PresentationBlocks from './PresentationBlocks';
import VocabularyToggle from './VocabularyToggle';
import InquiryQuestionButtons from './InquiryQuestionButtons';
import { copyText } from '../lib/parseResponse';
import { getReflectionFields } from '../lib/reflectionFields';
import { getUiText, LANGUAGE_OPTIONS } from '../lib/i18n';

export const TAB_OPTIONS = [
  { value: 'understand',   labelKey: 'modeUnderstand',   icon: '🧒' },
  { value: 'inquiry',      labelKey: 'modeInquiry',      icon: '🔍' },
  { value: 'presentation', labelKey: 'modePresentation', icon: '🎤' },
  { value: 'writing',      labelKey: 'modeWriting',      icon: '✏️' },
];

const TOOL_CONFIG = [
  { key: 'quiz',       labelKey: 'quizTool',       tipKey: 'quizTip' },
  { key: 'evaluation', labelKey: 'evaluationTool', tipKey: 'evaluationTip' },
  { key: 'teacher',    labelKey: 'teacherTool',    tipKey: 'teacherTip' },
];

export default function ResultCanvas({
  activeMode, onTabClick, onClose,
  analysisByMode, loadingMode,
  toolResults, quizKey, parsedQuiz, quizResult, setQuizResult,
  onQuiz, onEvaluation, onTeacherComment,
  isBusy, loadingTool,
  notes, updateNote, saveStatus, handleShare,
  isMobile, onQuestionAsk, t = getUiText('ko'),
  language, onLanguageChange,
}) {
  const REFLECTION_FIELDS = getReflectionFields(t);
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

  // 탭 전환 후 hidden-overflow인 canvas 컨테이너의 scrollLeft가 포커스 이동에 의해
  // 튀는 현상을 막는다. 탭 전환마다 수평 스크롤 위치를 강제로 0으로 고정한다.
  useEffect(() => { if (canvasRef.current) canvasRef.current.scrollLeft = 0; }, [activeMode]);

  const result = analysisByMode[activeMode] || {};
  const isTabLoading = loadingMode === activeMode;

  const renderModeContent = () => {
    if (isTabLoading) {
      return (
        <div style={s.loadingState}>
          <div style={s.loadingSpinner} />
          <p style={s.loadingText}>{t.loadingResult}</p>
        </div>
      );
    }

    if (activeMode === 'understand') return (
      <>
        <SectionCard
          title={t.understandSentenceTitle} icon="🧒" isMobile={isMobile}
        >
          {result.understandingSentence
            ? <div style={s.bigTitle}>{result.understandingSentence}</div>
            : <p style={s.empty}>{t.understandSentenceEmpty}</p>}
        </SectionCard>
        <SectionCard
          title={t.understandEasyFullTitle} icon="📖" isMobile={isMobile}
          actions={result.easy ? (
            <button data-testid="copy-easy-button" style={s.smallBtn} onClick={async () => {
              try { await copyText(result.easy); alert(t.easyCopied); }
              catch { alert(t.copyFailed); }
            }}>{t.copy}</button>
          ) : null}
        >
          {result.easy
            ? <div style={s.easyRewrite}>{result.easy}</div>
            : <p style={s.empty}>{t.understandEasyFullEmpty}</p>}
        </SectionCard>
        <SectionCard title={t.understandVocabularyRoleTitle} icon="📚" isMobile={isMobile}>
          <VocabularyToggle
            text={result.understandingVocabulary}
            fallbackLines={result.vocabularyLines}
            isMobile={isMobile}
            emptyText={t.understandVocabularyEmpty}
          />
        </SectionCard>
        <SectionCard title={t.understandReadingTitle} icon="🧩" isMobile={isMobile}>
          <PresentationBlocks
            text={result.understandingReading}
            fallbackLines={result.summaryLines}
            isMobile={isMobile}
            emptyText={t.understandReadingEmpty}
          />
        </SectionCard>
        <SectionCard title={t.understandChecklistTitle} icon="📋" isMobile={isMobile}>
          <WritingChecklist items={result.understandingChecklistLines} isMobile={isMobile} emptyText={t.understandChecklistEmpty} />
        </SectionCard>
        <SectionCard title={t.understandMisconceptionsTitle} icon="🧭" isMobile={isMobile}>
          <BulletList items={result.understandingMisconceptionLines} isMobile={isMobile} emptyText={t.understandMisconceptionsEmpty} />
        </SectionCard>
        <SectionCard title={t.understandCheckTitle} icon="✅" isMobile={isMobile}>
          <BulletList items={result.understandingCheckLines?.length > 0 ? result.understandingCheckLines : result.reteachLines} isMobile={isMobile} emptyText={t.understandCheckEmpty} />
        </SectionCard>
        {(result.understandingSentence || result.easy) && (
          <p style={s.coachHint}>{t.understandChatHint}</p>
        )}
        <ReflectionCard fields={REFLECTION_FIELDS.understand} notes={notes} t={t}
          onUpdate={updateNote} saveStatus={saveStatus} onShare={handleShare} isMobile={isMobile} />
      </>
    );

    if (activeMode === 'inquiry') return (
      <>
        <SectionCard title={t.inquiryQuestionsTitle} icon="❓" isMobile={isMobile}>
          <p style={s.sectionLead}>{t.inquiryQuestionsLead}</p>
          <InquiryQuestionButtons
            text={result.inquiryQuestions}
            fallbackLines={result.questionLines}
            onQuestionAsk={onQuestionAsk}
            isMobile={isMobile}
            emptyText={t.inquiryQuestionsEmpty}
          />
        </SectionCard>
        <SectionCard title={t.inquiryQuestionGuideTitle} icon="💡" isMobile={isMobile}>
          <BulletList
            items={result.inquiryQuestionGuideLines?.length > 0 ? result.inquiryQuestionGuideLines : t.inquiryQuestionGuideItems}
            isMobile={isMobile}
            emptyText={t.inquiryQuestionGuideEmpty}
          />
        </SectionCard>
        {(result.inquiryQuestions || result.questionLines?.length > 0) && (
          <p style={s.coachHint}>{t.inquiryChatHint}</p>
        )}
        <ReflectionCard fields={REFLECTION_FIELDS.inquiry} notes={notes} t={t}
          onUpdate={updateNote} saveStatus={saveStatus} onShare={handleShare} isMobile={isMobile} />
      </>
    );

    if (activeMode === 'presentation') return (
      <>
        <SectionCard title={t.presentationMessagesTitle} icon="💡" isMobile={isMobile}>
          <PresentationBlocks
            text={result.presentationMessages || result.presentationTitle}
            isMobile={isMobile}
            emptyText={t.presentationMessagesEmpty}
          />
        </SectionCard>
        <SectionCard title={t.presentationAudienceTitle} icon="🎤" isMobile={isMobile}>
          <BulletList items={result.presentationAudienceLines} isMobile={isMobile} emptyText={t.presentationAudienceEmpty} />
        </SectionCard>
        <SectionCard title={t.presentationFlowTitle} icon="📍" isMobile={isMobile}>
          <PresentationBlocks
            text={result.presentationFlow}
            fallbackLines={result.presentationOrderLines}
            isMobile={isMobile}
            emptyText={t.presentationFlowEmpty}
          />
        </SectionCard>
        <SectionCard title={t.presentationEvidenceTitle} icon="🗂️" isMobile={isMobile}>
          <BulletList items={result.presentationEvidenceLines} isMobile={isMobile} emptyText={t.presentationEvidenceEmpty} />
        </SectionCard>
        <SectionCard title={t.presentationQuestionsTitle} icon="🙋" isMobile={isMobile}>
          <PresentationBlocks
            text={result.presentationQuestions}
            fallbackLines={result.expectedQuestionLines}
            isMobile={isMobile}
            emptyText={t.presentationQuestionsEmpty}
          />
        </SectionCard>
        <SectionCard title={t.presentationVisualPlanTitle} icon="🖼️" isMobile={isMobile}>
          <PresentationBlocks
            text={result.presentationVisualPlan}
            isMobile={isMobile}
            emptyText={t.presentationVisualPlanEmpty}
          />
        </SectionCard>
        <SectionCard title={t.presentationTemplatesTitle} icon="🗣️" isMobile={isMobile}>
          <BulletList items={result.presentationTemplateLines?.length > 0 ? result.presentationTemplateLines : result.presentationScriptLines} isMobile={isMobile} emptyText={t.presentationTemplatesEmpty} />
        </SectionCard>
        <SectionCard title={t.presentationChecklistTitle} icon="✅" isMobile={isMobile}>
          <WritingChecklist items={result.presentationChecklistLines} isMobile={isMobile} emptyText={t.presentationChecklistEmpty} />
        </SectionCard>
        {(result.presentationMessages || result.presentationFlow || result.presentationEvidenceLines?.length > 0) && (
          <p style={s.coachHint}>{t.presentationChatHint}</p>
        )}
        <ReflectionCard fields={REFLECTION_FIELDS.presentation} notes={notes} t={t}
          onUpdate={updateNote} saveStatus={saveStatus} onShare={handleShare} isMobile={isMobile} />
      </>
    );

    if (activeMode === 'writing') return (
      <>
        <SectionCard title={t.writingTopicSentencesTitle} icon="💡" isMobile={isMobile}>
          <WritingSectionBlocks
            text={result.writingTopicSentences}
            kind="topic"
            isMobile={isMobile}
            emptyText={t.writingEmpty}
          />
        </SectionCard>
        <SectionCard title={t.writingSupportTitle} icon="🧭" isMobile={isMobile}>
          <WritingSectionBlocks
            text={result.writingSupportDirections}
            fallbackText={result.writingTopicSentences}
            kind="support"
            isMobile={isMobile}
            emptyText={t.writingSupportEmpty}
          />
        </SectionCard>
        <SectionCard title={t.writingEvidenceTitle} icon="🗂️" isMobile={isMobile}>
          <BulletList items={result.writingEvidenceLines} isMobile={isMobile} emptyText={t.writingEvidenceEmpty} />
        </SectionCard>
        <SectionCard title={t.writingTemplatesTitle} icon="✍️" isMobile={isMobile}>
          <BulletList items={result.writingTemplateLines} isMobile={isMobile} emptyText={t.writingTemplatesEmpty} />
        </SectionCard>
        <SectionCard
          title={t.writingOutlineTitle} icon="✏️" isMobile={isMobile}
          actions={result.writingOutline ? (
            <button data-testid="copy-outline-button" style={s.smallBtn} onClick={async () => {
              try { await copyText(result.writingOutline); alert(t.outlineCopied); }
              catch { alert(t.copyFailed); }
            }}>{t.copy}</button>
          ) : null}
        >
          <WritingOutlineCard outline={result.writingOutline} isMobile={isMobile} t={t} />
        </SectionCard>
        <SectionCard title={t.writingChecklistTitle} icon="✅" isMobile={isMobile}>
          <WritingChecklist items={result.writingChecklistLines} isMobile={isMobile} emptyText={t.writingChecklistEmpty} />
        </SectionCard>
        {(result.writingTopicSentences || result.writingSupportDirections || result.writingOutline || result.writingEvidenceLines?.length > 0) && (
          <p style={s.writingChatHint}>{t.writingChatHint}</p>
        )}
        <ReflectionCard fields={REFLECTION_FIELDS.writing} notes={notes} t={t}
          onUpdate={updateNote} saveStatus={saveStatus} onShare={handleShare} isMobile={isMobile} />
      </>
    );

    return null;
  };

  const toolHandlers = { quiz: onQuiz, evaluation: onEvaluation, teacher: onTeacherComment };

  return (
    <div ref={canvasRef} data-testid="result-canvas" style={isMobile ? s.canvasMobile : s.canvas}>
      <style>{`@keyframes cv-spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={s.header}>
        <span style={s.headerTitle}>{t.resultTitle}</span>

        {onLanguageChange && (
          <select
            aria-label="language"
            style={s.headerLanguageSelect}
            value={language}
            onChange={e => onLanguageChange(e.target.value)}
          >
            {LANGUAGE_OPTIONS.map(option => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
        )}

        <div style={s.toolBar}>
          {TOOL_CONFIG.map(({ key, labelKey, tipKey }) => (
            <div key={key} style={{ position: 'relative', zIndex: hoveredTool === key ? 10 : 1 }}>
              <button
                data-testid={`tool-${key}`}
                style={{ ...s.toolBtn, position: 'relative', overflow: 'hidden' }}
                onClick={toolHandlers[key]}
                disabled={isBusy}
                onMouseEnter={() => setHoveredTool(key)}
                onMouseLeave={() => setHoveredTool(null)}
              >
                {loadingTool === key && <span className="tool-fill-bar" />}
                {t[labelKey]}
              </button>
              {hoveredTool === key && (
                <div style={s.tip}>
                  <div style={s.tipArrow} />
                  {t[tipKey]}
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={onClose} style={s.closeBtn} title={t.close}>✕</button>
      </div>

      {/* ── Tabs ── */}
      <div style={s.tabBar}>
        {TAB_OPTIONS.map(({ value, labelKey, icon }) => (
          <button
            key={value}
            data-testid={`mode-tab-${value}`}
            role="tab"
            aria-selected={activeMode === value}
            style={{ ...s.tab, ...(activeMode === value ? s.tabActive : {}) }}
            onClick={() => onTabClick(value)}
            disabled={loadingMode !== null && loadingMode !== value}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            {t[labelKey]}
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
              <SectionCard title={t.quizTitle} icon="🎯" isMobile={isMobile}>
                <QuizCard key={quizKey} quizData={parsedQuiz} onReset={onQuiz}
                  isMobile={isMobile} onResult={setQuizResult} t={t} />
              </SectionCard>
            </div>
          )}

          {toolResults.evaluation && (
            <div ref={evalCardRef}>
              <SectionCard title={t.evaluationTitle} icon="🌟" isMobile={isMobile}>
                <div style={s.md}><ReactMarkdown>{toolResults.evaluation}</ReactMarkdown></div>
              </SectionCard>
            </div>
          )}

          {toolResults.teacher && (
            <div ref={teacherCardRef}>
              <SectionCard
                title={t.teacherTitle} icon="🧾" isMobile={isMobile}
                actions={
                  <button style={s.smallBtn} onClick={async () => {
                    try { await copyText(toolResults.teacher); alert(t.teacherCopied); }
                    catch { alert(t.copyFailed); }
                  }}>{t.copy}</button>
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
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 20, boxShadow: '0 2px 8px rgba(var(--color-text-rgb),0.08)',
    overflow: 'hidden',
    height: 'calc(100vh - 48px)', position: 'sticky', top: 24, alignSelf: 'start',
  },
  canvasMobile: {
    position: 'fixed', inset: 0, zIndex: 200, borderRadius: 0,
    display: 'flex', flexDirection: 'column',
    background: 'var(--color-surface)', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 14px', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-alt)', flexShrink: 0,
  },
  headerTitle: { fontWeight: 800, fontSize: 14, color: 'var(--color-text)', flex: 1 },
  headerLanguageSelect: {
    border: '1px solid rgba(var(--color-primary-rgb),0.25)', background: 'var(--color-surface)', color: 'var(--color-primary-dark)',
    borderRadius: 9, padding: '5px 6px', fontSize: 12, fontWeight: 800,
    outline: 'none', cursor: 'pointer', width: 100, flexShrink: 0,
  },
  toolBar: { display: 'flex', gap: 5, alignItems: 'center' },
  toolBtn: {
    border: '1px solid rgba(var(--color-primary-rgb),0.25)', background: 'var(--color-surface)', color: 'var(--color-primary-dark)',
    padding: '5px 8px', borderRadius: 9, cursor: 'pointer',
    fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap',
  },
  tip: {
    position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--color-primary-dark)', color: 'var(--color-surface)', borderRadius: 10,
    padding: '7px 10px', fontSize: 11, lineHeight: 1.6,
    zIndex: 100, whiteSpace: 'pre-line', textAlign: 'center',
    boxShadow: '0 4px 14px rgba(var(--color-primary-dark-rgb),0.25)', minWidth: 130,
  },
  tipArrow: {
    position: 'absolute', top: -6, left: 'calc(50% - 6px)',
    width: 0, height: 0,
    borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
    borderBottom: '6px solid var(--color-primary-dark)',
  },
  closeBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
    fontWeight: 700, fontSize: 13, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  },
  tabBar: {
    display: 'flex', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg)', flexShrink: 0,
  },
  tab: {
    flex: 1, border: 'none', background: 'transparent',
    color: 'var(--color-text-sub)', fontWeight: 700, fontSize: 12,
    padding: '9px 4px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderBottom: '2px solid transparent', transition: 'all 0.15s ease',
  },
  tabActive: { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)', background: 'var(--color-surface)' },
  tabSpinner: {
    display: 'inline-block', width: 9, height: 9,
    border: '2px solid var(--color-border)', borderTop: '2px solid var(--color-primary-dark)',
    borderRadius: '50%', animation: 'cv-spin 0.8s linear infinite',
    marginLeft: 3, verticalAlign: 'middle',
  },
  body: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 18 },
  loadingState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '60px 20px', gap: 16,
  },
  loadingSpinner: {
    width: 36, height: 36,
    border: '4px solid var(--color-border)', borderTop: '4px solid var(--color-primary)',
    borderRadius: '50%', animation: 'cv-spin 1s linear infinite',
  },
  loadingText: { color: 'var(--color-text-sub)', fontSize: 14, fontWeight: 600, margin: 0 },
  empty: { margin: 0, color: 'var(--color-text-sub)', fontSize: 14, lineHeight: 1.6 },
  md: { color: 'var(--color-text)', lineHeight: 1.8, fontSize: 15 },
  smallBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, padding: '7px 11px', borderRadius: 9, cursor: 'pointer', fontSize: 12,
  },
  bigTitle: {
    fontSize: 19, fontWeight: 900, color: 'var(--color-text)',
    background: 'color-mix(in srgb, var(--color-gold) 22%, var(--color-surface))',
    border: '1px solid rgba(var(--color-gold-rgb),0.6)', borderRadius: 14, padding: '15px 17px', lineHeight: 1.6,
  },
  easyRewrite: {
    color: 'var(--color-text)',
    background: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '14px 15px',
    lineHeight: 1.85,
    fontSize: 15,
    whiteSpace: 'pre-wrap',
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere',
  },
  sectionLead: {
    margin: '0 0 12px',
    color: 'var(--color-text-sub)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  qBtn: {
    border: '1px solid rgba(var(--color-primary-rgb),0.3)', background: 'rgba(var(--color-primary-rgb),0.06)', color: 'var(--color-primary-dark)',
    padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
    fontWeight: 700, textAlign: 'left', fontSize: 12,
  },
  writingChatHint: {
    margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-sub)',
    background: 'var(--color-surface-alt)', border: '1px dashed var(--color-border)',
    borderRadius: 12, padding: '10px 14px',
  },
  coachHint: {
    margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-sub)',
    background: 'var(--color-surface-alt)', border: '1px dashed var(--color-border)',
    borderRadius: 12, padding: '10px 14px',
  },
};

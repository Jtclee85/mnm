import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Image from 'next/image';

import titleLogo from '../public/title-mnm.png';
import SectionCard from '../components/SectionCard';
import ResultCanvas from '../components/ResultCanvas';
import RecommendedSources from '../components/RecommendedSources';
import SignTextReader from '../components/SignTextReader';
import ThinkingWorksheetDrawer from '../components/ThinkingWorksheetDrawer';
import FloatingChatbot from '../components/FloatingChatbot';
import EasyExplanationPanel from '../components/EasyExplanationPanel';
import ResearchCompass from '../components/ResearchCompass';
import ResearchTutorialQuest, { TUTORIAL_QUESTS } from '../components/ResearchTutorialQuest';

import { createSystemMessage, createChatSystemMessage, createEvaluationSystemMessage } from '../lib/systemPrompt';
import { parseSectionedResponse, parseQuizBlock, extractTagBlock, copyText } from '../lib/parseResponse';
import { useStudentNotes } from '../lib/useStudentNotes';
import { useSessionSave } from '../lib/useSessionSave';
import { migrateLegacyWorksheetFields, getLegacyEvidenceFields } from '../lib/modeWorksheetFields';
import { buildModeInputs, truncateForShare } from '../lib/shareArtifact';
import { encodeShareData } from '../lib/shareUtils';
import { LANGUAGE_OPTIONS, getLanguageReminder, getUiText } from '../lib/i18n';
import { withSubjectParticle } from '../lib/koreanParticles';

/** =========================
 *  메인
 *  ========================= */

const TUTORIAL_SEEN_KEY = 'mnmHistoryResearchTutorialSeen';

export default function Home() {
  const [topic,       setTopic]       = useState('');
  const [sourceText,  setSourceText]  = useState('');
  const gradeLevel = 'high';
  const [language,    setLanguage]    = useState('ko');
  const t = getUiText(language);
  const isRtl = language === 'ar';

  // 캔버스 / 탭 상태
  const [canvasOpen,  setCanvasOpen]  = useState(false);
  const [activeMode,  setActiveMode]  = useState('understand');
  const [loadingMode, setLoadingMode] = useState(null);   // 분석 중인 탭

  // 모드별 분리 저장 (공유 필드 덮어쓰기 버그 해소)
  const [analysisByMode, setAnalysisByMode] = useState(INIT_BY_MODE());

  // 도구 결과 (탭과 무관)
  const [toolResults, setToolResults] = useState(EMPTY_TOOLS);
  const [quizKey,    setQuizKey]    = useState(0);
  const [quizResult, setQuizResult] = useState(null);

  // 로딩 플래그 (도구용)
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [loadingTool,  setLoadingTool]  = useState(null);

  const [isMobile, setIsMobile] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState('source');

  // 좌측 패널 제목용 — "가장 최근 분석을 실행한" 조사주제 (입력 중인 topic과는 별개)
  const [lastAnalyzedTopic, setLastAnalyzedTopic] = useState('');

  const { notes, updateNote, saveStatus } = useStudentNotes(topic);
  const { savedTopics, triggerSave, saveNow, loadSession, deleteSession } = useSessionSave();

  // 3차 구조 개편 — 옛 별도 '생각 워크시트' 데이터를 각 모드 안 입력 필드로 1회성 복사.
  // 옛 데이터는 지우지 않고 그대로 둔 채, 새 필드가 비어 있을 때만 채운다.
  useEffect(() => {
    migrateLegacyWorksheetFields(notes, updateNote);
  }, [notes, updateNote]);

  const [conversation, setConversation] = useState([makeInitialMessage(getUiText('ko'))]);
  const [chatInput,    setChatInput]    = useState('');
  // 우하단 플로팅 챗봇 팝업 열림 상태 — 기존 왼쪽 패널 '대화' 탭을 대체
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);

  // 5차 — '조사 시작 전 퀘스트' 첫 접속 튜토리얼 + '자료 조사 나침반' 상태.
  // SSR에서는 항상 닫힌 상태로 시작해 hydration mismatch를 막고, 클라이언트
  // 마운트 이후에만 localStorage를 읽어 첫 접속 여부를 판단한다.
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [compassExpandSignal, setCompassExpandSignal] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(TUTORIAL_SEEN_KEY) !== 'true') setTutorialOpen(true);
    } catch {
      setTutorialOpen(true);
    }
  }, []);

  const markTutorialSeen = () => {
    try { localStorage.setItem(TUTORIAL_SEEN_KEY, 'true'); } catch {}
  };

  const handleTutorialNext = () => setTutorialStep(s => Math.min(s + 1, TUTORIAL_QUESTS.length - 1));
  const handleTutorialPrev = () => setTutorialStep(s => Math.max(s - 1, 0));

  // 건너뛰기: 이번 방문에서만 닫는다 — seen을 저장하지 않으므로 다음 접속에 다시 보인다.
  const handleTutorialSkip = () => {
    setTutorialOpen(false);
    setTutorialStep(0);
  };

  // 다시 보지 않기 / 완료: seen을 저장해 다음 접속부터 자동으로 뜨지 않게 하고,
  // 나침반을 한 번 자동으로 펼쳐 보여 준다.
  const finishTutorial = () => {
    markTutorialSeen();
    setTutorialOpen(false);
    setTutorialStep(0);
    setCompassExpandSignal(v => v + 1);
  };

  const isBusy = loadingMode !== null || isAnalyzing;

  // ── 반응형 ──
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 900);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // ── 자동 세션 저장 ──
  useEffect(() => {
    if (!topic.trim()) return;
    triggerSave({ topic, sourceText, gradeLevel, language, activeMode, conversation, notes, analysisByMode, toolResults });
  }, [topic, sourceText, gradeLevel, language, activeMode, conversation, notes, analysisByMode, toolResults, triggerSave]);

  // ── 이전 조사 불러오기 ──
  const handleLoadSession = (savedTopic) => {
    if (topic.trim()) saveNow({ topic, sourceText, gradeLevel, language, activeMode, conversation, notes, analysisByMode, toolResults });

    const session = loadSession(savedTopic);
    if (!session) return;

    setTopic(session.topic ?? '');
    setSourceText(session.sourceText ?? '');
    setLanguage(session.language ?? 'ko');
    setActiveMode(session.activeMode ?? 'understand');
    setConversation(cleanConversation(session.conversation));
    setAnalysisByMode(session.analysisByMode ?? INIT_BY_MODE());
    setToolResults(session.toolResults ?? EMPTY_TOOLS);
    setQuizResult(null);
    setQuizKey(k => k + 1);

    const anyResult = session.analysisByMode &&
      Object.values(session.analysisByMode).some(r =>
        r?.easy || r?.understandingSentence || r?.summaryLines?.length || r?.keywordLines?.length ||
        r?.inquiryQuestions ||
        r?.presentationTitle || r?.presentationMessages || r?.writingOutline
      );
    setCanvasOpen(!!anyResult);
    // 이미 분석된 세션을 불러온 경우에도 '쉬운설명'을 우선으로 보여준다.
    setLeftPanelTab(anyResult ? 'easy' : 'source');
    setLastAnalyzedTopic(anyResult ? (session.topic ?? '') : '');
  };

  const resetWorkspace = () => {
    setTopic('');
    setSourceText('');
    setActiveMode('understand');
    setAnalysisByMode(INIT_BY_MODE());
    setToolResults(EMPTY_TOOLS);
    setQuizResult(null);
    setQuizKey(k => k + 1);
    setConversation([makeInitialMessage(getUiText(language))]);
    setCanvasOpen(false);
    setLeftPanelTab('source');
    setLastAnalyzedTopic('');
  };

  const handleDeleteSession = (savedTopic) => {
    if (!window.confirm(`"${savedTopic}" 조사 기록을 삭제할까요?`)) return;

    deleteSession(savedTopic);

    if (savedTopic === topic) {
      resetWorkspace();
    }
  };

  // ── 안내판 사진에서 추출한 텍스트를 조사자료 입력창에 삽입 ──
  // 기존 입력 내용이 있으면 보존하고 줄바꿈으로 이어 붙인다.
  const handleSignTextExtracted = (extractedText) => {
    setSourceText(prev => {
      const trimmedPrev = prev.trim();
      return trimmedPrev ? `${prev}\n\n${extractedText}` : extractedText;
    });
  };

  // ── 처음으로 돌아가기 ──
  const handleGoHome = () => {
    if (topic.trim()) saveNow({ topic, sourceText, gradeLevel, language, activeMode, conversation, notes, analysisByMode, toolResults });

    resetWorkspace();
  };

  const buildLanguageReminder = () => getLanguageReminder(language);

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    const nextText = getUiText(nextLanguage);
    setAnalysisByMode(INIT_BY_MODE());
    setToolResults(EMPTY_TOOLS);
    setQuizResult(null);
    setQuizKey(k => k + 1);
    setConversation([makeInitialMessage(nextText)]);
    setCanvasOpen(false);
    setLeftPanelTab('source');
    setLastAnalyzedTopic('');
  };

  // ── SSE 스트리밍 ──
  const requestStream = async (messageHistory, { onChunk, onDone, onError }) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });

      if (!res.ok) {
        let errMsg = t.processFailed;
        try { const body = await res.json(); if (body.error) errMsg = body.error; } catch {}
        onError?.(errMsg);
        return;
      }

      if (!res.body) throw new Error(t.processFailed);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer   = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (part.startsWith('data: ')) {
            try {
              const data = JSON.parse(part.substring(6));
              fullText += data;
              onChunk?.(data, fullText);
            } catch {}
          }
        }
      }

      if (buffer.startsWith('data: ')) {
        try { const data = JSON.parse(buffer.substring(6)); fullText += data; onChunk?.(data, fullText); } catch {}
      }
      onDone?.(fullText);
    } catch (error) {
      console.error(error);
      onError?.(error);
    }
  };

  const streamOnce = (messages) =>
    new Promise((resolve, reject) => {
      requestStream(messages, { onDone: resolve, onError: reject });
    });

  // ── 시스템 프롬프트 빌더 ──
  const buildBaseSystem = (mode = activeMode) =>
    createSystemMessage({ topic, sourceText, gradeLevel, learningMode: mode, language });

  const buildChatSystem = () =>
    createChatSystemMessage({ topic, sourceText, gradeLevel, language });

  const buildEvaluationSystem = () => {
    const excludePatterns = [
      /^조사주제는\s+'.+'\s*이?야[\.\s]*자료를\s*분석해줘/,
      /^(나 어땠어\?|교과평어 만들기|퀴즈풀기|전체 요약)$/
    ];
    const followUpQuestions = conversation
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.trim())
      .filter(content => !excludePatterns.some(re => re.test(content)));
    return createEvaluationSystemMessage({ topic, gradeLevel, quizResult, followUpQuestions, studentNotes: notes, language });
  };

  // ── 모드별 분석 (공통) ──
  const analyzeForMode = async (mode) => {
    setLoadingMode(mode);

    const sysMsg = createSystemMessage({ topic: topic.trim(), sourceText: sourceText.trim(), gradeLevel, learningMode: mode, language });

    let success = false;
    await new Promise(resolve => {
      requestStream(
        [sysMsg, { role: 'user', content: '원본 자료를 분석해서 모드에 맞는 학습 결과를 만들어 줘.' }],
        {
          onDone: (fullText) => {
            setAnalysisByMode(prev => ({ ...prev, [mode]: parseSectionedResponse(fullText) }));
            success = true;
            resolve();
          },
          onError: (msg) => {
            console.error(`[analyzeForMode:${mode}]`, msg);
            resolve();
          }
        }
      );
    });

    setLoadingMode(null);
    return success;
  };

  // ── 분석 시작 ──
  const handleAnalyze = async () => {
    const trimmedTopic  = topic.trim();
    const trimmedSource = sourceText.trim();

    if (!trimmedTopic)              { alert(t.missingTopic); return; }
    if (trimmedSource.length < 50)  { alert(t.shortSource); return; }

    setLastAnalyzedTopic(trimmedTopic);
    // 자료 분석 이후에는 왼쪽 패널에 '쉬운설명'을 우선으로 보여준다.
    setLeftPanelTab('easy');

    const thinkingMsg = trimmedSource.length > 3000
      ? t.longThinking
      : t.thinking;

    setConversation([{ role: 'assistant', content: thinkingMsg }]);

    // 이전 결과 초기화 후 캔버스 열기
    setAnalysisByMode(INIT_BY_MODE());
    setToolResults(EMPTY_TOOLS);
    setActiveMode('understand');
    setCanvasOpen(true);

    const ok = await analyzeForMode('understand');

    setConversation(prev => {
      const updated = [...prev];
      const last = updated.length - 1;
      if (updated[last]?.role === 'assistant') {
        updated[last] = {
          ...updated[last],
          content: ok
            ? t.initialMessage
            : t.analysisFailed
        };
      }
      return updated;
    });
  };

  // ── 탭 클릭 ──
  const hasModeResult = (mode) => {
    const r = analysisByMode[mode];
    return !!(r?.easy || r?.understandingSentence || r?.summaryLines?.length || r?.keywordLines?.length ||
      r?.inquiryQuestions ||
      r?.presentationTitle || r?.presentationMessages || r?.writingOutline);
  };

  const handleTabClick = async (mode) => {
    setActiveMode(mode);
    if (!hasModeResult(mode) && loadingMode === null && !isAnalyzing) {
      await analyzeForMode(mode);
    }
  };

  // ── 도구 공통 핸들러 ──
  const handleSpecialRequest = async ({ promptText, withHistory = false, onDone, toolKey, buildSystem, retryTag }) => {
    if (!sourceText.trim()) { alert(t.missingAnalysis); return; }

    setIsAnalyzing(true);
    setLoadingTool(toolKey ?? null);

    const systemMsg = buildSystem ? buildSystem() : buildBaseSystem();
    const userMsg   = { role: 'user', content: `${promptText}${buildLanguageReminder()}` };
    const messages  = withHistory ? [systemMsg, ...conversation, userMsg] : [systemMsg, userMsg];

    try {
      let fullText = await streamOnce(messages);
      if (retryTag && !extractTagBlock(fullText, retryTag)) {
        fullText = await streamOnce(messages);
      }
      onDone(parseSectionedResponse(fullText));
    } catch (errorMsg) {
      alert(typeof errorMsg === 'string' ? errorMsg : t.processFailed);
    }

    setIsAnalyzing(false);
    setLoadingTool(null);
  };

  const handleQuiz = () =>
    handleSpecialRequest({
      promptText: '퀴즈풀기', toolKey: 'quiz', retryTag: 'quiz',
      onDone: (parsed) => {
        setToolResults(prev => ({ ...prev, quiz: parsed.quiz || t.quizFailed }));
        setQuizKey(prev => prev + 1);
        setQuizResult(null);
      }
    });

  const handleEvaluation = async () => {
    if (!sourceText.trim()) { alert(t.missingAnalysis); return; }
    setIsAnalyzing(true);
    setLoadingTool('evaluation');

    const systemMsg  = buildEvaluationSystem();
    const chatHistory = conversation[0]?.role === 'assistant' ? conversation.slice(1) : conversation;
    const messages   = [systemMsg, ...chatHistory, { role: 'user', content: `나 어땠어?${buildLanguageReminder()}` }];

    try {
      let fullText = await streamOnce(messages);
      if (!fullText.trim()) fullText = await streamOnce(messages);
      setToolResults(prev => ({ ...prev, evaluation: fullText.trim() || t.evaluationFailed }));
    } catch (errorMsg) {
      alert(typeof errorMsg === 'string' ? errorMsg : t.processFailed);
    }

    setIsAnalyzing(false);
    setLoadingTool(null);
  };

  const handleTeacherComment = () =>
    handleSpecialRequest({
      promptText: '교과평어 만들기', toolKey: 'teacher', withHistory: true,
      onDone: (parsed) => {
        setToolResults(prev => ({ ...prev, teacher: parsed.teacher || t.teacherFailed }));
      }
    });

  const checkChatRelevance = async (userText) => {
    try {
      const res = await fetch('/api/relevance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          sourceText: sourceText.slice(0, 6000),
          userText,
          language,
          conversation: conversation.slice(-6),
        }),
      });

      const data = await res.json().catch(() => ({}));
      return {
        relevant: res.ok && data.relevant === true,
        redirect: data.redirect || t.irrelevantRedirect,
      };
    } catch (error) {
      console.error('Relevance check failed:', error);
      return {
        relevant: false,
        redirect: t.relevanceFailed,
      };
    }
  };

  // ── 후속 질문 채팅 ──
  const handleFollowUpChat = async (customPrompt) => {
    const userText = (customPrompt ?? chatInput).trim();
    if (!userText || isBusy) return;

    const userMessage          = { role: 'user',      content: userText };
    const assistantPlaceholder = { role: 'assistant', content: '' };

    setChatInput('');
    setIsChatLoading(true);

    const relevance = await checkChatRelevance(userText);
    if (!relevance.relevant) {
      setConversation(prev => [
        ...prev,
        userMessage,
        { role: 'assistant', content: relevance.redirect },
      ]);
      setIsChatLoading(false);
      return;
    }

    setConversation(prev => [...prev, userMessage, assistantPlaceholder]);

    await requestStream([buildChatSystem(), ...conversation, userMessage], {
      onChunk: (data) => {
        setConversation(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], content: updated[lastIdx].content + data };
          }
          return updated;
        });
      },
      onDone: () => {},
      onError: (msg) => {
        setConversation(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], content: msg || t.chatFailed };
          }
          return updated;
        });
      }
    });

    setIsChatLoading(false);
  };

  const [isChatLoading, setIsChatLoading] = useState(false);

  // ── 3차 구조 개편: 탐구모드 '이 질문으로 챗봇에게 물어보기' 버튼 ──
  // 질문을 고르자마자 자동으로 챗봇에 보내지 않는다. 학생이 먼저 자기 생각을 쓴 뒤
  // 이 버튼을 눌러야 챗봇 팝업이 열리고, 질문은 입력창에 채워지기만 한다(자동 전송 아님).
  const handleAskChatbotWithQuestion = (q) => {
    if (!q) return;
    setChatInput(q);
    setIsChatPopupOpen(true);
  };

  // ── 공유 URL 생성 ──
  // 4차 구조 개편: 공유 페이지는 이제 AI 결과가 아니라 학생이 각 모드 안에서
  // 직접 쓴 산출물(modeInputs) 중심으로 보여준다. 원본자료/쉬운설명은 보조 자료로만
  // 짧게 포함한다. notes 전체(legacyWorksheet)도 함께 보내 옛 형식 링크와의
  // 호환(3차 이전 생각 워크시트 데이터 포함)을 유지한다.
  const handleShare = () => {
    const u = analysisByMode.understand || {};
    const shareData = {
      topic: lastAnalyzedTopic || topic || t.untitled,
      sourceText: truncateForShare(sourceText, 500),
      easyExplanationSummary: {
        oneSentence: u.understandingSentence || '',
        easyFullText: truncateForShare(u.easy, 400),
      },
      modeInputs: buildModeInputs(notes),
      legacyEvidence: getLegacyEvidenceFields(notes),
      legacyWorksheet: notes,
      sharedAt: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    };
    return `${window.location.origin}/share?d=${encodeShareData(shareData)}`;
  };

  // ── 퀴즈 파싱 (quiz 텍스트 변경 시만) ──
  const parsedQuiz = useMemo(() => parseQuizBlock(toolResults.quiz), [toolResults.quiz]);

  // ── 내보내기 텍스트 ──
  const buildExportText = () => {
    const u = analysisByMode.understand    || {};
    const i = analysisByMode.inquiry       || {};
    const p = analysisByMode.presentation  || {};
    const w = analysisByMode.writing       || {};
    return [
      `${t.topicLabel}: ${topic}`, '',
      `[${t.understandSentenceTitle}]`, u.understandingSentence || u.easy || '', '',
      `[${t.understandEasyFullTitle}]`, u.easy || '', '',
      `[${t.understandVocabularyRoleTitle}]`, u.understandingVocabulary || (u.vocabularyLines || []).join('\n'), '',
      `[${t.understandReadingTitle}]`, u.understandingReading || (u.summaryLines || []).join('\n'), '',
      `[${t.understandMisconceptionsTitle}]`, ...(u.understandingMisconceptionLines || []), '',
      `[${t.understandCheckTitle}]`, ...(u.understandingCheckLines?.length > 0 ? u.understandingCheckLines : (u.reteachLines || [])), '',
      `[${t.inquiryQuestionsTitle}]`, i.inquiryQuestions || (i.questionLines || []).join('\n'), '',
      `[${t.presentationMessagesTitle}]`, p.presentationMessages || p.presentationTitle || '',  '',
      `[${t.presentationAudienceTitle}]`, ...(p.presentationAudienceLines || []), '',
      `[${t.presentationFlowTitle}]`, p.presentationFlow || '', '',
      `[${t.presentationEvidenceTitle}]`, ...(p.presentationEvidenceLines || []), '',
      `[${t.presentationQuestionsTitle}]`, p.presentationQuestions || (p.expectedQuestionLines || []).join('\n'), '',
      `[${t.presentationVisualPlanTitle}]`, p.presentationVisualPlan || '', '',
      `[${t.presentationTemplatesTitle}]`, ...(p.presentationTemplateLines?.length > 0 ? p.presentationTemplateLines : (p.presentationScriptLines || [])), '',
      `[${t.presentationChecklistTitle}]`, ...(p.presentationChecklistLines || []), '',
      `[${t.writingTopicSentencesTitle}]`, w.writingTopicSentences || '', '',
      `[${t.writingSupportTitle}]`, w.writingSupportDirections || '', '',
      `[${t.writingEvidenceTitle}]`, ...(w.writingEvidenceLines || []), '',
      `[${t.writingTemplatesTitle}]`, ...(w.writingTemplateLines || []), '',
      `[${t.writingOutlineTitle}]`,       w.writingOutline     || '', '',
      `[${t.writingChecklistTitle}]`, ...(w.writingChecklistLines || [])
    ].join('\n');
  };

  // 재오픈 버튼 표시 여부
  const hasAnyResult = Object.values(analysisByMode).some(r =>
    r?.easy || r?.understandingSentence || r?.summaryLines?.length || r?.keywordLines?.length ||
    r?.inquiryQuestions ||
    r?.presentationTitle || r?.presentationMessages || r?.writingOutline
  );

  // 아직 분석을 시작하지 않은 진짜 첫 랜딩 상태 — 추천 원본자료 사이드바를 보여줄 시점
  const showLanding = !canvasOpen && !hasAnyResult;

  // 좌측 패널 제목 — 가장 최근 분석한 조사주제 기준 (입력 중인 topic이 바뀌어도 즉시 따라가지 않음)
  const leftPanelTitle = (language === 'ko' && lastAnalyzedTopic)
    ? `${withSubjectParticle(lastAnalyzedTopic)} 뭐냐면...`
    : t.mainCardTitle;

  // 1차 구조 개편: 왼쪽 '대화' 탭은 제거하고 우하단 플로팅 챗봇으로 이동했다.
  // 2차 구조 개편: '조사 원본자료' / '쉬운설명' 2탭으로 재구성 — 대화 탭은 다시 만들지 않는다.
  const renderLeftPanelTabs = () => (
    <div style={styles.leftPanelTabs}>
      <button
        style={{ ...styles.leftPanelTab, ...(leftPanelTab === 'source' ? styles.leftPanelTabActive : {}) }}
        onClick={() => setLeftPanelTab('source')}
      >
        {t.sourceTab}
      </button>
      <button
        style={{ ...styles.leftPanelTab, ...(leftPanelTab === 'easy' ? styles.leftPanelTabActive : {}) }}
        onClick={() => setLeftPanelTab('easy')}
      >
        {t.easyTab}
      </button>
    </div>
  );

  const renderSavedTopicChips = () => (
    savedTopics.length > 0 ? (
      <div style={styles.chipsWrap}>
        <span style={{ fontSize: 13, flexShrink: 0 }}>📂</span>
        {savedTopics.map(({ topic: t }) => (
          <span key={t} style={{ ...styles.savedTopicItem, ...(t === topic ? styles.savedTopicItemActive : {}) }}>
            <button
              style={{ ...styles.chip, ...(t === topic ? styles.chipActive : {}) }}
              onClick={() => handleLoadSession(t)}
              title={`"${t}" ${getUiText(language).loadTitle}`}
            >
              {t}
            </button>
            <button
              type="button"
              aria-label={`${t} 조사 기록 삭제`}
              title={`${t} 조사 기록 삭제`}
              style={{ ...styles.deleteChipBtn, ...(t === topic ? styles.deleteChipBtnActive : {}) }}
              onClick={() => handleDeleteSession(t)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    ) : null
  );

  const renderHeaderActions = () => (
    <div style={styles.headerActions}>
      <button style={styles.goHomeBtn} onClick={handleGoHome}>
        {t.goHome}
      </button>
    </div>
  );

  // ── 레이아웃 ──
  const layoutStyle = (canvasOpen && !isMobile)
    ? styles.splitLayout
    : styles.centeredLayout;

  // 첫 화면(랜딩)에서만 메인 입력 카드 맨 위에 얹는 로고+설명 — 독립 상단 히어로 영역 대체
  const cardLogoSlot = showLanding ? (
    <div>
      <h1 style={{ margin: 0, lineHeight: 0 }}>
        <Image
          src={titleLogo}
          alt="뭐냐면"
          priority
          style={{ width: '100%', maxWidth: isMobile ? 200 : 240, height: 'auto', margin: '0 auto', display: 'block' }}
        />
      </h1>
      <p style={{ margin: '10px 0 0', fontSize: isMobile ? 14 : 15, fontWeight: 700, color: 'var(--color-text)' }}>
        {t.bannerSubtitle}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: isMobile ? 12 : 13, color: 'var(--color-text-sub)' }}>
        {t.bannerDescription}
      </p>
    </div>
  ) : null;

  const leftColEl = (
    <div style={styles.leftCol} data-testid="left-panel">

              {/* 기본 설정 카드 */}
              {leftPanelTab === 'source' && (
              <SectionCard
                title={leftPanelTitle} icon="" isMobile={isMobile}
                actions={renderHeaderActions()}
                topSlot={cardLogoSlot}
              >
                {renderSavedTopicChips()}
                {!showLanding && renderLeftPanelTabs()}

                {/* 조사 주제 + 언어 선택 */}
                <div style={isMobile ? styles.topicRowMobile : styles.topicRow}>
                  <div style={styles.topicCol}>
                    <label style={styles.label}>{t.topicLabel}</label>
                    <input
                      data-testid="topic-input"
                      aria-label={t.topicLabel}
                      style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }}
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      placeholder={t.topicPlaceholder}
                    />
                  </div>
                  <div style={styles.languageInlineCol}>
                    <label style={styles.label}>language</label>
                    <select
                      style={{ ...styles.languageBarSelect, width: '100%', ...(isMobile ? styles.inputMobile : {}) }}
                      value={language}
                      onChange={e => handleLanguageChange(e.target.value)}
                    >
                      {LANGUAGE_OPTIONS.map(option => (
                        <option key={option.code} value={option.code}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 조사자료 */}
                <div style={styles.formGroup}>
                  <div style={styles.sourceLabelRow}>
                    <label style={styles.label}>{t.sourceLabel}</label>
                    <SignTextReader isMobile={isMobile} onExtracted={handleSignTextExtracted} t={t} />
                  </div>
                  <textarea
                    data-testid="source-textarea"
                    aria-label={t.sourceLabel}
                    style={{ ...styles.textarea, ...(isMobile ? styles.textareaMobile : {}) }}
                    value={sourceText}
                    onChange={e => setSourceText(e.target.value)}
                    placeholder={t.sourcePlaceholder}
                  />
                </div>

                {/* 버튼 행 */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    data-testid="analyze-button"
                    style={{ ...styles.primaryBtn, ...(isMobile ? styles.primaryBtnMobile : {}), position: 'relative', overflow: 'hidden' }}
                    onClick={handleAnalyze}
                    disabled={isBusy}
                  >
                    {loadingMode === 'understand' && <span className="tool-fill-bar-light" />}
                    {loadingMode !== null ? t.analyzing : t.analyze}
                  </button>

                  {/* 캔버스 재오픈 버튼 */}
                  {!canvasOpen && hasAnyResult && (
                    <button
                      style={{ ...styles.reopenBtn, ...(isMobile ? styles.primaryBtnMobile : {}) }}
                      onClick={() => setCanvasOpen(true)}
                    >
                      {t.reopenResults}
                    </button>
                  )}
                </div>
              </SectionCard>
              )}

              {/* 쉬운설명 — 오른쪽에서 탐구/발표/글쓰기 활동을 하는 동안 참고하는 패널 */}
              {leftPanelTab === 'easy' && (
              <SectionCard
                title={leftPanelTitle} icon="" isMobile={isMobile}
                actions={renderHeaderActions()}
              >
                {renderSavedTopicChips()}
                {renderLeftPanelTabs()}
                <EasyExplanationPanel
                  result={analysisByMode.understand}
                  isMobile={isMobile}
                  t={t}
                  isLoading={loadingMode === 'understand'}
                />
              </SectionCard>
              )}

              {/* 생각 워크시트 — 오른쪽 분석 결과를 가리지 않도록 왼쪽 패널(조사자료) 자리에 임베드 */}
              {leftPanelTab === 'worksheet' && (
                <div data-testid="worksheet-panel-section">
                  {renderSavedTopicChips()}
                  {renderLeftPanelTabs()}
                  <ThinkingWorksheetDrawer
                    variant="panel"
                    isOpen={true}
                    onClose={() => setLeftPanelTab('source')}
                    topic={lastAnalyzedTopic}
                    activeMode={activeMode}
                    notes={notes}
                    updateNote={updateNote}
                    saveStatus={saveStatus}
                    onShare={handleShare}
                    isMobile={isMobile}
                  />
                </div>
              )}
            </div>
  );

  const resultCanvasEl = canvasOpen && (
    <ResultCanvas
      activeMode={activeMode}
      onTabClick={handleTabClick}
      onClose={() => setCanvasOpen(false)}
      analysisByMode={analysisByMode}
      loadingMode={loadingMode}
      toolResults={toolResults}
      quizKey={quizKey}
      parsedQuiz={parsedQuiz}
      quizResult={quizResult}
      setQuizResult={setQuizResult}
      onQuiz={handleQuiz}
      onEvaluation={handleEvaluation}
      onTeacherComment={handleTeacherComment}
      isBusy={isBusy}
      loadingTool={loadingTool}
      notes={notes}
      updateNote={updateNote}
      saveStatus={saveStatus}
      handleShare={handleShare}
      isMobile={isMobile}
      onAskChatbotWithQuestion={handleAskChatbotWithQuestion}
      t={t}
      language={language}
      onLanguageChange={handleLanguageChange}
      topic={lastAnalyzedTopic}
      onOpenWorksheet={() => setLeftPanelTab('worksheet')}
      isWorksheetActive={leftPanelTab === 'worksheet'}
    />
  );

  return (
    <>
      <Head>
        <title>{t.appTitle}</title>
        <meta name="description" content={t.appDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        lang={language}
        style={{ ...styles.page, ...(isRtl ? styles.pageRtl : {}), ...(isMobile ? styles.pageMobile : {}) }}
      >
        <div style={styles.container}>
          {showLanding ? (
            <div style={isMobile ? styles.landingStackMobile : styles.landingRow}>
              <RecommendedSources isMobile={isMobile} />
              <div style={styles.landingFormCol}>
                {leftColEl}
              </div>
            </div>
          ) : (
            <div style={layoutStyle} data-testid="layout-grid">
              {leftColEl}
              {resultCanvasEl}
            </div>
          )}
        </div>

        {/* 우하단 플로팅 챗봇 — 조사를 시작한 뒤부터 접근 가능 (랜딩 화면에서는 물어볼 맥락이 없음) */}
        {!showLanding && (
          <FloatingChatbot
            isOpen={isChatPopupOpen}
            onOpen={() => setIsChatPopupOpen(true)}
            onClose={() => setIsChatPopupOpen(false)}
            conversation={conversation}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSend={handleFollowUpChat}
            isChatLoading={isChatLoading}
            isMobile={isMobile}
            topic={lastAnalyzedTopic || topic}
            t={t}
          />
        )}

        {/* 5차 — 자료 조사 나침반: 자료 검색·입력 단계(랜딩 화면)에서만 필요하므로
            분석 이후에는 띄우지 않는다. */}
        {showLanding && (
          <ResearchCompass
            isMobile={isMobile}
            onReopenTutorial={() => { setTutorialStep(0); setTutorialOpen(true); }}
            expandSignal={compassExpandSignal}
          />
        )}

        {/* 5차 — 조사 시작 전 퀘스트: 첫 접속 시에만 자동으로 뜨는 튜토리얼 */}
        <ResearchTutorialQuest
          isOpen={tutorialOpen}
          step={tutorialStep}
          onNext={handleTutorialNext}
          onPrev={handleTutorialPrev}
          onSkip={handleTutorialSkip}
          onDontShowAgain={finishTutorial}
          onComplete={finishTutorial}
          onClose={handleTutorialSkip}
          isMobile={isMobile}
        />
      </div>
    </>
  );
}

// ── 유틸 ──
function cleanConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return [makeInitialMessage(getUiText('ko'))];

  const cleaned = messages.filter(msg => {
    const content = msg?.content || '';
    if (content.includes('나는 조사자료를 쉽게 바꿔 주는 사회과 학습 도우미')) return false;
    if (content.includes('지금 선택한 모드에 맞게 결과를 정리했어')) return false;
    if (content.includes('이해 탭에 결과를 정리했어')) return false;
    if (/^조사주제는\s+'.+'\s*이?야[\.\s]*자료를\s*분석해줘/.test(content)) return false;
    return true;
  });

  return cleaned.length > 0 ? cleaned : [makeInitialMessage(getUiText('ko'))];
}

// ── 상수 ──
const makeInitialMessage = (t) => ({
  role: 'assistant',
  content: t.initialMessage
});

const EMPTY_MODE_RESULT = {
  easy: '', summaryLines: [], keywordLines: [], vocabularyLines: [],
  questionLines: [], searchLines: [], reteachLines: [], furtherLines: [],
  understandingSentence: '', understandingVocabulary: '', understandingReading: '',
  understandingChecklistLines: [], understandingMisconceptionLines: [],
  understandingCheckLines: [], inquiryQuestions: '', inquiryRefine: '',
  inquiryClues: '', inquiryCompare: '', inquiryEvidenceInference: '',
  inquirySearches: '', inquiryCard: '',
  presentationTitle: '', presentationScriptLines: [], presentationOrderLines: [],
  presentationMessages: '', presentationAudienceLines: [], presentationFlow: '',
  presentationEvidenceLines: [], presentationQuestions: '', presentationVisualPlan: '',
  presentationTemplateLines: [], presentationChecklistLines: [],
  expectedQuestionLines: [], writingOutline: '', writingTopicSentences: '',
  writingSupportDirections: '', writingEvidenceLines: [], writingTemplateLines: [],
  writingChecklistLines: []
};

const EMPTY_TOOLS = { quiz: '', evaluation: '', teacher: '' };

const INIT_BY_MODE = () => ({
  understand:   { ...EMPTY_MODE_RESULT },
  inquiry:      { ...EMPTY_MODE_RESULT },
  presentation: { ...EMPTY_MODE_RESULT },
  writing:      { ...EMPTY_MODE_RESULT }
});

/** =========================
 *  스타일
 *  ========================= */
const styles = {
  page:      { minHeight: '100vh', background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface-alt) 45%, var(--color-bg) 100%)', padding: '24px 16px 48px' },
  pageRtl:   { textAlign: 'right' },
  pageMobile: { padding: '16px 10px 32px' },
  container: { maxWidth: 1680, margin: '0 auto' },
  languageBarSelect: {
    minWidth: 180, border: '1px solid var(--color-border)', borderRadius: 12,
    padding: '10px 12px', fontSize: 12, outline: 'none', background: 'var(--color-surface)', boxSizing: 'border-box',
  },

  centeredLayout: { maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 },
  splitLayout:    { display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 20, alignItems: 'start' },

  // 랜딩 화면 전용 — 추천 원본자료 사이드바 + 자료입력 폼
  landingRow:         { display: 'flex', gap: 28, alignItems: 'stretch', justifyContent: 'center', flexWrap: 'wrap' },
  landingStackMobile: { display: 'flex', flexDirection: 'column', gap: 18 },
  landingFormCol:     { flex: '0 1 860px', minWidth: 0 },

  leftCol: { display: 'flex', flexDirection: 'column', gap: 18 },
  leftPanelTabs: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    borderRadius: 12, padding: 4, marginBottom: 18,
  },
  leftPanelTab: {
    border: 'none', background: 'transparent', color: 'var(--color-text-sub)',
    borderRadius: 8, padding: '9px 12px', cursor: 'pointer',
    fontWeight: 800, fontSize: 12,
  },
  leftPanelTabActive: {
    background: 'var(--color-surface)', color: 'var(--color-primary-dark)',
    boxShadow: '0 1px 4px rgba(var(--color-text-rgb),0.10)',
  },

  formGroup: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  label:     { fontWeight: 700, color: 'var(--color-text)', fontSize: 14 },
  sourceLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },

  // 조사 주제 입력칸 + 언어 선택 — 같은 줄에 나란히 배치
  topicRow:          { display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'flex-end', marginBottom: 16 },
  topicRowMobile:    { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 },
  topicCol:          { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 },
  languageInlineCol: { display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: 160 },

  input: {
    width: '100%', border: '1px solid var(--color-border)', borderRadius: 12,
    padding: '12px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box'
  },
  inputMobile: { fontSize: 16, padding: '12px' },
  select: {
    width: '100%', border: '1px solid var(--color-border)', borderRadius: 12,
    padding: '12px 14px', fontSize: 15, outline: 'none', background: 'var(--color-surface)', boxSizing: 'border-box'
  },
  textarea: {
    width: '100%', minHeight: 200, border: '1px solid var(--color-border)', borderRadius: 14,
    padding: '14px 16px', fontSize: 15, lineHeight: 1.7, resize: 'vertical',
    outline: 'none', boxSizing: 'border-box'
  },
  textareaMobile: { minHeight: 160, fontSize: 16, padding: '12px' },

  primaryBtn: {
    border: 'none', background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, padding: '12px 20px', borderRadius: 12,
    cursor: 'pointer', boxShadow: '0 10px 24px rgba(var(--color-primary-rgb),0.22)', fontSize: 12,
  },
  primaryBtnMobile: { width: '100%', fontSize: 12, padding: '13px 14px' },

  reopenBtn: {
    border: '2px solid var(--color-primary)', background: 'rgba(var(--color-primary-rgb),0.08)', color: 'var(--color-primary-dark)',
    fontWeight: 800, padding: '12px 20px', borderRadius: 12,
    cursor: 'pointer', fontSize: 12,
  },

  chipsWrap: {
    display: 'flex', alignItems: 'center', gap: 5,
    flexWrap: 'wrap',
    width: '100%', marginBottom: 12,
  },
  savedTopicItem: {
    display: 'inline-flex', alignItems: 'center',
    border: '1.5px solid rgba(var(--color-primary-rgb),0.3)',
    background: 'rgba(var(--color-primary-rgb),0.08)',
    borderRadius: 20, overflow: 'hidden', flexShrink: 0,
  },
  savedTopicItemActive: {
    border: '1.5px solid var(--color-primary)',
    background: 'var(--color-primary)',
  },
  chip: {
    border: 'none', background: 'transparent', color: 'var(--color-primary-dark)',
    fontSize: 12, fontWeight: 800, padding: '5px 9px 5px 12px', borderRadius: 0,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s'
  },
  chipActive: { color: 'var(--color-surface)' },
  deleteChipBtn: {
    width: 24, alignSelf: 'stretch', border: 'none',
    borderLeft: '1px solid rgba(var(--color-primary-rgb),0.22)',
    background: 'rgba(var(--color-surface-rgb),0.45)', color: 'var(--color-text-sub)',
    fontSize: 15, fontWeight: 900, lineHeight: 1, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  deleteChipBtnActive: {
    borderLeft: '1px solid rgba(255,255,255,0.35)',
    background: 'rgba(255,255,255,0.16)', color: 'var(--color-surface)',
  },

  headerActions: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  goHomeBtn: {
    border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 20,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
  },
};

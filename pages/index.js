import { useState, useRef, useEffect, useMemo } from 'react';
import Head from 'next/head';

import Banner from '../components/Banner';
import SectionCard from '../components/SectionCard';
import ChatBubble from '../components/ChatBubble';
import ResultCanvas from '../components/ResultCanvas';
import RecommendedSources from '../components/RecommendedSources';

import { createSystemMessage, createChatSystemMessage, createEvaluationSystemMessage } from '../lib/systemPrompt';
import { parseSectionedResponse, parseQuizBlock, extractTagBlock, copyText } from '../lib/parseResponse';
import { useStudentNotes } from '../lib/useStudentNotes';
import { useSessionSave } from '../lib/useSessionSave';
import { encodeShareData } from '../lib/shareUtils';
import { LANGUAGE_OPTIONS, getLanguageReminder, getUiText } from '../lib/i18n';

/** =========================
 *  메인
 *  ========================= */

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

  const { notes, updateNote, saveStatus } = useStudentNotes(topic);
  const { savedTopics, triggerSave, saveNow, loadSession } = useSessionSave();

  const [conversation, setConversation] = useState([makeInitialMessage(getUiText('ko'))]);
  const [chatInput,    setChatInput]    = useState('');

  const chatBoxRef    = useRef(null);
  const chatInputRef  = useRef(null);
  const chatSectionRef = useRef(null);

  const isBusy = loadingMode !== null || isAnalyzing;

  // ── 반응형 ──
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 900);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // ── 채팅 스크롤 ──
  useEffect(() => {
    const el = chatBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation]);

  // ── 채팅 입력 포커스 ──
  useEffect(() => {
    if (!isBusy && chatInputRef.current) {
      try { chatInputRef.current.focus({ preventScroll: true }); }
      catch { chatInputRef.current.focus(); }
    }
  }, [isBusy]);

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
        r?.easy || r?.summaryLines?.length || r?.keywordLines?.length ||
        r?.presentationTitle || r?.writingOutline
      );
    setCanvasOpen(!!anyResult);
    setLeftPanelTab(anyResult ? 'chat' : 'source');
  };

  // ── 처음으로 돌아가기 ──
  const handleGoHome = () => {
    if (topic.trim()) saveNow({ topic, sourceText, gradeLevel, language, activeMode, conversation, notes, analysisByMode, toolResults });

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

    setLeftPanelTab('chat');

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
    return !!(r?.easy || r?.summaryLines?.length || r?.keywordLines?.length ||
      r?.presentationTitle || r?.writingOutline);
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

  // ── 탐구 탭 질문 버튼 클릭 → 채팅으로 ──
  const handleQuestionAsk = (q) => {
    setLeftPanelTab('chat');
    handleFollowUpChat(q);
    setTimeout(() => {
      if (!chatSectionRef.current) return;
      const top = chatSectionRef.current.getBoundingClientRect().top + window.pageYOffset - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 150);
  };

  // ── 공유 URL 생성 ──
  const handleShare = () => {
    const shareData = {
      topic: topic || t.untitled,
      notes,
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
      `[${t.easyTitle}]`,        u.easy || '',        '',
      `[${t.summaryTitle}]`,    ...(u.summaryLines   || []), '',
      `[${t.keywordsTitle}]`,        ...(i.keywordLines   || []), '',
      `[${t.vocabularyTitle}]`, ...(u.vocabularyLines || []), '',
      `[${t.questionsTitle}]`,        ...(i.questionLines  || []), '',
      `[${t.searchesTitle}]`,      ...(i.searchLines    || []), '',
      `[${t.presentationTitle}]`,         p.presentationTitle  || '',  '',
      `[${t.presentationScriptTitle}]`,     ...(p.presentationScriptLines || []), '',
      `[${t.writingOutlineTitle}]`,       w.writingOutline     || ''
    ].join('\n');
  };

  // 재오픈 버튼 표시 여부
  const hasAnyResult = Object.values(analysisByMode).some(r =>
    r?.easy || r?.summaryLines?.length || r?.keywordLines?.length ||
    r?.presentationTitle || r?.writingOutline
  );

  // 아직 분석을 시작하지 않은 진짜 첫 랜딩 상태 — 추천 원본자료 사이드바를 보여줄 시점
  const showLanding = !canvasOpen && !hasAnyResult;

  const renderLeftPanelTabs = () => (
    <div style={styles.leftPanelTabs}>
      <button
        style={{ ...styles.leftPanelTab, ...(leftPanelTab === 'source' ? styles.leftPanelTabActive : {}) }}
        onClick={() => setLeftPanelTab('source')}
      >
        {t.sourceTab}
      </button>
      <button
        style={{ ...styles.leftPanelTab, ...(leftPanelTab === 'chat' ? styles.leftPanelTabActive : {}) }}
        onClick={() => setLeftPanelTab('chat')}
      >
        {t.chatTab}
      </button>
    </div>
  );

  const renderSavedTopicChips = () => (
    savedTopics.length > 0 ? (
      <div style={styles.chipsWrap}>
        <span style={{ fontSize: 13, flexShrink: 0 }}>📂</span>
        {savedTopics.map(({ topic: t }) => (
          <button
            key={t}
            style={{ ...styles.chip, ...(t === topic ? styles.chipActive : {}) }}
            onClick={() => handleLoadSession(t)}
            title={`"${t}" ${getUiText(language).loadTitle}`}
          >
            {t}
          </button>
        ))}
      </div>
    ) : null
  );

  const renderHeaderActions = () => (
    <div style={styles.headerActions}>
      {renderSavedTopicChips()}
      <button style={styles.goHomeBtn} onClick={handleGoHome}>
        {t.goHome}
      </button>
    </div>
  );

  // ── 레이아웃 ──
  const layoutStyle = (canvasOpen && !isMobile)
    ? styles.splitLayout
    : styles.centeredLayout;

  const leftColEl = (
    <div style={styles.leftCol}>

              {/* 기본 설정 카드 */}
              {leftPanelTab === 'source' && (
              <SectionCard
                title={t.mainCardTitle} icon="" isMobile={isMobile}
                actions={renderHeaderActions()}
              >
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
                  <label style={styles.label}>{t.sourceLabel}</label>
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

              {/* 후속 질문 채팅 */}
              {leftPanelTab === 'chat' && (
              <div ref={chatSectionRef}>
                <SectionCard
                  title={t.mainCardTitle} icon="" isMobile={isMobile}
                  actions={renderHeaderActions()}
                >
                  {renderLeftPanelTabs()}

                  <div ref={chatBoxRef} style={{ ...styles.chatBox, ...(isMobile ? styles.chatBoxMobile : {}) }}>
                    {conversation.map((msg, idx) => (
                      <ChatBubble
                        key={`${msg.role}-${idx}-${msg.content.slice(0, 10)}`}
                        role={msg.role}
                        content={msg.content}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <textarea
                      ref={chatInputRef}
                      style={{ ...styles.chatTextarea, ...(isMobile ? styles.chatTextareaMobile : {}) }}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder={t.chatPlaceholder}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFollowUpChat(); }
                      }}
                      disabled={isChatLoading}
                    />
                    <button
                      style={{ ...styles.primaryBtn, ...(isMobile ? styles.primaryBtnMobile : {}) }}
                      onClick={() => handleFollowUpChat()}
                      disabled={isChatLoading}
                    >
                      {isChatLoading ? t.sending : t.sendQuestion}
                    </button>
                  </div>
                </SectionCard>
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
      onQuestionAsk={handleQuestionAsk}
      t={t}
      language={language}
      onLanguageChange={handleLanguageChange}
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
            <>
              <Banner t={t} />
              <div style={isMobile ? styles.landingStackMobile : styles.landingRow}>
                <RecommendedSources isMobile={isMobile} />
                <div style={styles.landingFormCol}>
                  {leftColEl}
                </div>
              </div>
            </>
          ) : (
            <div style={layoutStyle}>
              {leftColEl}
              {resultCanvasEl}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── 유틸 ──
function hasBatchim(str) {
  if (!str) return false;
  const last = str.trim().slice(-1);
  const code = last.charCodeAt(0);
  return code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0;
}

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
  presentationTitle: '', presentationScriptLines: [], presentationOrderLines: [],
  expectedQuestionLines: [], writingOutline: ''
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
  page:      { minHeight: '100vh', background: 'linear-gradient(180deg,#f8fafc 0%,#eef2ff 45%,#f8fafc 100%)', padding: '24px 16px 48px' },
  pageRtl:   { textAlign: 'right' },
  pageMobile: { padding: '16px 10px 32px' },
  container: { maxWidth: 1680, margin: '0 auto' },
  languageBarSelect: {
    minWidth: 180, border: '1px solid #cbd5e1', borderRadius: 12,
    padding: '10px 12px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box',
  },

  centeredLayout: { maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 },
  splitLayout:    { display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 20, alignItems: 'start' },

  // 랜딩 화면 전용 — 추천 원본자료 사이드바 + 자료입력 폼
  landingRow:         { display: 'flex', gap: 28, alignItems: 'flex-start', justifyContent: 'center' },
  landingStackMobile: { display: 'flex', flexDirection: 'column', gap: 18 },
  landingFormCol:     { flex: '0 1 860px', minWidth: 0 },

  leftCol: { display: 'flex', flexDirection: 'column', gap: 18 },
  leftPanelTabs: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
    background: '#f1f5f9', border: '1px solid #e2e8f0',
    borderRadius: 12, padding: 4, marginBottom: 18,
  },
  leftPanelTab: {
    border: 'none', background: 'transparent', color: '#64748b',
    borderRadius: 8, padding: '9px 12px', cursor: 'pointer',
    fontWeight: 800, fontSize: 14,
  },
  leftPanelTabActive: {
    background: '#ffffff', color: '#1d4ed8',
    boxShadow: '0 1px 4px rgba(15,23,42,0.10)',
  },

  formGroup: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  label:     { fontWeight: 700, color: '#374151', fontSize: 14 },

  // 조사 주제 입력칸 + 언어 선택 — 같은 줄에 나란히 배치
  topicRow:          { display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'flex-end', marginBottom: 16 },
  topicRowMobile:    { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 },
  topicCol:          { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 },
  languageInlineCol: { display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: 160 },

  input: {
    width: '100%', border: '1px solid #cbd5e1', borderRadius: 12,
    padding: '12px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box'
  },
  inputMobile: { fontSize: 16, padding: '12px' },
  select: {
    width: '100%', border: '1px solid #cbd5e1', borderRadius: 12,
    padding: '12px 14px', fontSize: 15, outline: 'none', background: '#fff', boxSizing: 'border-box'
  },
  textarea: {
    width: '100%', minHeight: 200, border: '1px solid #cbd5e1', borderRadius: 14,
    padding: '14px 16px', fontSize: 15, lineHeight: 1.7, resize: 'vertical',
    outline: 'none', boxSizing: 'border-box'
  },
  textareaMobile: { minHeight: 160, fontSize: 16, padding: '12px' },

  primaryBtn: {
    border: 'none', background: 'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)',
    color: '#fff', fontWeight: 800, padding: '12px 20px', borderRadius: 12,
    cursor: 'pointer', boxShadow: '0 10px 24px rgba(37,99,235,0.22)', fontSize: 15,
  },
  primaryBtnMobile: { width: '100%', fontSize: 15, padding: '13px 14px' },

  reopenBtn: {
    border: '2px solid #2563eb', background: '#eff6ff', color: '#1d4ed8',
    fontWeight: 800, padding: '12px 20px', borderRadius: 12,
    cursor: 'pointer', fontSize: 14,
  },

  chatBox:       { height: 460, overflowY: 'auto', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 16, padding: 14, marginBottom: 12 },
  chatBoxMobile: { height: 340, padding: 10, marginBottom: 10 },
  chatTextarea:       { width: '100%', minHeight: 90, maxHeight: 200, border: '1px solid #cbd5e1', borderRadius: 14, padding: '12px 14px', fontSize: 15, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  chatTextareaMobile: { minHeight: 80, fontSize: 16, padding: '12px' },

  chipsWrap: {
    display: 'flex', alignItems: 'center', gap: 5,
    flexWrap: 'nowrap', overflowX: 'auto',
    width: '100%', maxWidth: 520, paddingBottom: 2,
  },
  chip: {
    border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8',
    fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 20,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s'
  },
  chipActive: { background: '#2563eb', border: '1.5px solid #2563eb', color: '#fff' },

  headerActions: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  goHomeBtn: {
    border: '1.5px solid #cbd5e1', background: '#fff', color: '#475569',
    fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 20,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
  },
};

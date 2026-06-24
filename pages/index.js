import { useState, useRef, useEffect, useMemo } from 'react';
import Head from 'next/head';

import Banner from '../components/Banner';
import SectionCard from '../components/SectionCard';
import ChatBubble from '../components/ChatBubble';
import ResultCanvas from '../components/ResultCanvas';

import { createSystemMessage, createChatSystemMessage, createEvaluationSystemMessage } from '../lib/systemPrompt';
import { parseSectionedResponse, parseQuizBlock, extractTagBlock, copyText } from '../lib/parseResponse';
import { useStudentNotes } from '../lib/useStudentNotes';
import { useSessionSave } from '../lib/useSessionSave';
import { encodeShareData } from '../lib/shareUtils';

/** =========================
 *  메인
 *  ========================= */

export default function Home() {
  const [topic,       setTopic]       = useState('');
  const [sourceText,  setSourceText]  = useState('');
  const [gradeLevel,  setGradeLevel]  = useState('high');

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

  const [conversation, setConversation] = useState([INIT_MSG]);
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
    triggerSave({ topic, sourceText, gradeLevel, activeMode, conversation, notes, analysisByMode, toolResults });
  }, [topic, sourceText, gradeLevel, activeMode, conversation, notes, analysisByMode, toolResults, triggerSave]);

  // ── 이전 조사 불러오기 ──
  const handleLoadSession = (savedTopic) => {
    if (topic.trim()) saveNow({ topic, sourceText, gradeLevel, activeMode, conversation, notes, analysisByMode, toolResults });

    const session = loadSession(savedTopic);
    if (!session) return;

    setTopic(session.topic ?? '');
    setSourceText(session.sourceText ?? '');
    setGradeLevel(session.gradeLevel ?? 'high');
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

  // ── SSE 스트리밍 ──
  const requestStream = async (messageHistory, { onChunk, onDone, onError }) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });

      if (!res.ok) {
        let errMsg = '오류가 발생했습니다. 다시 시도해 주세요.';
        try { const body = await res.json(); if (body.error) errMsg = body.error; } catch {}
        onError?.(errMsg);
        return;
      }

      if (!res.body) throw new Error('서버 응답에 문제가 있습니다.');

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
    createSystemMessage({ topic, sourceText, gradeLevel, learningMode: mode });

  const buildChatSystem = () =>
    createChatSystemMessage({ topic, sourceText, gradeLevel });

  const buildEvaluationSystem = () => {
    const excludePatterns = [
      /^조사주제는\s+'.+'\s*이?야[\.\s]*자료를\s*분석해줘/,
      /^(나 어땠어\?|교과평어 만들기|퀴즈풀기|전체 요약)$/
    ];
    const followUpQuestions = conversation
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.trim())
      .filter(content => !excludePatterns.some(re => re.test(content)));
    return createEvaluationSystemMessage({ topic, gradeLevel, quizResult, followUpQuestions, studentNotes: notes });
  };

  // ── 모드별 분석 (공통) ──
  const analyzeForMode = async (mode) => {
    setLoadingMode(mode);

    const sysMsg = createSystemMessage({ topic: topic.trim(), sourceText: sourceText.trim(), gradeLevel, learningMode: mode });

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

    if (!trimmedTopic)              { alert('조사 주제를 먼저 입력해 주세요.'); return; }
    if (trimmedSource.length < 50)  { alert('조사자료를 조금 더 길게 넣어 주세요.'); return; }

    setLeftPanelTab('chat');

    const thinkingMsg = trimmedSource.length > 3000
      ? '자료가 너무 길어서 조금 오래 생각하는 중입니다. 잠시만 기다려 줘!'
      : '분석 중이야, 잠깐만 기다려 줘!';

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
            ? INIT_MSG.content
            : '앗, 분석 중 문제가 생겼어. 다시 한 번 눌러 줘!'
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
    if (!sourceText.trim()) { alert('먼저 자료를 분석해 주세요.'); return; }

    setIsAnalyzing(true);
    setLoadingTool(toolKey ?? null);

    const systemMsg = buildSystem ? buildSystem() : buildBaseSystem();
    const userMsg   = { role: 'user', content: promptText };
    const messages  = withHistory ? [systemMsg, ...conversation, userMsg] : [systemMsg, userMsg];

    try {
      let fullText = await streamOnce(messages);
      if (retryTag && !extractTagBlock(fullText, retryTag)) {
        fullText = await streamOnce(messages);
      }
      onDone(parseSectionedResponse(fullText));
    } catch (errorMsg) {
      alert(typeof errorMsg === 'string' ? errorMsg : '처리 중 오류가 발생했습니다.');
    }

    setIsAnalyzing(false);
    setLoadingTool(null);
  };

  const handleQuiz = () =>
    handleSpecialRequest({
      promptText: '퀴즈풀기', toolKey: 'quiz', retryTag: 'quiz',
      onDone: (parsed) => {
        setToolResults(prev => ({ ...prev, quiz: parsed.quiz || '퀴즈를 만들지 못했어요.' }));
        setQuizKey(prev => prev + 1);
        setQuizResult(null);
      }
    });

  const handleEvaluation = async () => {
    if (!sourceText.trim()) { alert('먼저 자료를 분석해 주세요.'); return; }
    setIsAnalyzing(true);
    setLoadingTool('evaluation');

    const systemMsg  = buildEvaluationSystem();
    const chatHistory = conversation[0]?.role === 'assistant' ? conversation.slice(1) : conversation;
    const messages   = [systemMsg, ...chatHistory, { role: 'user', content: '나 어땠어?' }];

    try {
      let fullText = await streamOnce(messages);
      if (!fullText.trim()) fullText = await streamOnce(messages);
      setToolResults(prev => ({ ...prev, evaluation: fullText.trim() || '평가 결과를 만들지 못했어요.' }));
    } catch (errorMsg) {
      alert(typeof errorMsg === 'string' ? errorMsg : '처리 중 오류가 발생했습니다.');
    }

    setIsAnalyzing(false);
    setLoadingTool(null);
  };

  const handleTeacherComment = () =>
    handleSpecialRequest({
      promptText: '교과평어 만들기', toolKey: 'teacher', withHistory: true,
      onDone: (parsed) => {
        setToolResults(prev => ({ ...prev, teacher: parsed.teacher || '교과평어를 만들지 못했어요.' }));
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
          conversation: conversation.slice(-6),
        }),
      });

      const data = await res.json().catch(() => ({}));
      return {
        relevant: res.ok && data.relevant === true,
        redirect: data.redirect || '그 질문은 지금 조사 주제와는 조금 멀어 보여. 오른쪽 결과에서 궁금한 낱말이나 사건을 골라 물어봐!',
      };
    } catch (error) {
      console.error('Relevance check failed:', error);
      return {
        relevant: false,
        redirect: '질문을 확인하는 중 문제가 생겼어. 조사 주제와 관련된 질문으로 다시 물어봐 줘.',
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
            updated[lastIdx] = { ...updated[lastIdx], content: msg || '앗, 답변을 가져오는 중 문제가 생겼어요.' };
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
      topic: topic || '(제목 없음)',
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
      `조사 주제: ${topic}`, '',
      '[쉬운 설명]',        u.easy || '',        '',
      '[핵심 내용 3줄]',    ...(u.summaryLines   || []), '',
      '[핵심 개념]',        ...(i.keywordLines   || []), '',
      '[어려운 낱말 풀이]', ...(u.vocabularyLines || []), '',
      '[탐구 질문]',        ...(i.questionLines  || []), '',
      '[추천 검색어]',      ...(i.searchLines    || []), '',
      '[발표 제목]',         p.presentationTitle  || '',  '',
      '[발표용 3문장]',     ...(p.presentationScriptLines || []), '',
      '[설명문 개요]',       w.writingOutline     || ''
    ].join('\n');
  };

  // 재오픈 버튼 표시 여부
  const hasAnyResult = Object.values(analysisByMode).some(r =>
    r?.easy || r?.summaryLines?.length || r?.keywordLines?.length ||
    r?.presentationTitle || r?.writingOutline
  );

  const renderLeftPanelTabs = () => (
    <div style={styles.leftPanelTabs}>
      <button
        style={{ ...styles.leftPanelTab, ...(leftPanelTab === 'source' ? styles.leftPanelTabActive : {}) }}
        onClick={() => setLeftPanelTab('source')}
      >
        조사자료
      </button>
      <button
        style={{ ...styles.leftPanelTab, ...(leftPanelTab === 'chat' ? styles.leftPanelTabActive : {}) }}
        onClick={() => setLeftPanelTab('chat')}
      >
        대화
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
            title={`"${t}" 불러오기`}
          >
            {t}
          </button>
        ))}
      </div>
    ) : null
  );

  // ── 레이아웃 ──
  const layoutStyle = (canvasOpen && !isMobile)
    ? styles.splitLayout
    : styles.centeredLayout;

  return (
    <>
      <Head>
        <title>뭐냐면 - 조사자료 난이도 조절 웹앱</title>
        <meta name="description" content="전시물, 안내문, 조사자료를 초등학생 눈높이에 맞게 쉽게 바꾸고 탐구를 확장하는 AI 웹앱" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
        <div style={styles.container}>
          {!canvasOpen && !hasAnyResult && <Banner />}

          <div style={layoutStyle}>
            {/* ══ 왼쪽: 입력 + 채팅 ══ */}
            <div style={styles.leftCol}>

              {/* 기본 설정 카드 */}
              {leftPanelTab === 'source' && (
              <SectionCard
                title="무얼 조사했냐면..." icon="" isMobile={isMobile}
                actions={renderSavedTopicChips()}
              >
                {renderLeftPanelTabs()}

                {/* 조사 주제 */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>조사 주제</label>
                  <input
                    style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }}
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="예: 세종대왕, 불국사, 독도, 신석기 시대"
                  />
                </div>

                {/* 학습 수준 */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>학습 수준</label>
                  <select
                    style={{ ...styles.select, ...(isMobile ? styles.inputMobile : {}) }}
                    value={gradeLevel}
                    onChange={e => setGradeLevel(e.target.value)}
                  >
                    <option value="low">초등 저학년</option>
                    <option value="high">초등 고학년</option>
                    <option value="발표">발표 준비용</option>
                  </select>
                </div>

                {/* 조사자료 */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>조사자료 입력</label>
                  <textarea
                    style={{ ...styles.textarea, ...(isMobile ? styles.textareaMobile : {}) }}
                    value={sourceText}
                    onChange={e => setSourceText(e.target.value)}
                    placeholder="박물관 안내문, 전시 설명문, 조사자료를 여기에 붙여넣어 주세요."
                  />
                </div>

                {/* 버튼 행 */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    style={{ ...styles.primaryBtn, ...(isMobile ? styles.primaryBtnMobile : {}), position: 'relative', overflow: 'hidden' }}
                    onClick={handleAnalyze}
                    disabled={isBusy}
                  >
                    {loadingMode === 'understand' && <span className="tool-fill-bar-light" />}
                    {loadingMode !== null ? '분석 중...' : '분석 시작'}
                  </button>

                  {/* 캔버스 재오픈 버튼 */}
                  {!canvasOpen && hasAnyResult && (
                    <button
                      style={{ ...styles.reopenBtn, ...(isMobile ? styles.primaryBtnMobile : {}) }}
                      onClick={() => setCanvasOpen(true)}
                    >
                      📊 결과 보기 ▶
                    </button>
                  )}
                </div>
              </SectionCard>
              )}

              {/* 후속 질문 채팅 */}
              {leftPanelTab === 'chat' && (
              <div ref={chatSectionRef}>
                <SectionCard
                  title="무얼 조사했냐면..." icon="" isMobile={isMobile}
                  actions={renderSavedTopicChips()}
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
                      placeholder="분석 결과를 보고 더 궁금한 점을 물어보세요."
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
                      {isChatLoading ? '답변 중...' : '질문 보내기'}
                    </button>
                  </div>
                </SectionCard>
              </div>
              )}
            </div>

            {/* ══ 오른쪽: 결과 캔버스 ══ */}
            {canvasOpen && (
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
              />
            )}
          </div>
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
  if (!Array.isArray(messages) || messages.length === 0) return [INIT_MSG];

  const cleaned = messages.filter(msg => {
    const content = msg?.content || '';
    if (content.includes('나는 조사자료를 쉽게 바꿔 주는 사회과 학습 도우미')) return false;
    if (content.includes('지금 선택한 모드에 맞게 결과를 정리했어')) return false;
    if (content.includes('이해 탭에 결과를 정리했어')) return false;
    if (/^조사주제는\s+'.+'\s*이?야[\.\s]*자료를\s*분석해줘/.test(content)) return false;
    return true;
  });

  return cleaned.length > 0 ? cleaned : [INIT_MSG];
}

// ── 상수 ──
const INIT_MSG = {
  role: 'assistant',
  content: '조사자료를 정리했어! 오른쪽 창을 보며 공부해보자. 궁금한 게 있으면 얼마든지 물어봐!'
};

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
  pageMobile: { padding: '16px 10px 32px' },
  container: { maxWidth: 1440, margin: '0 auto' },

  centeredLayout: { maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 },
  splitLayout:    { display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 20, alignItems: 'start' },

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
};

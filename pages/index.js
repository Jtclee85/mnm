import { useState, useRef, useEffect, useMemo } from 'react';
import Head from 'next/head';
import ReactMarkdown from 'react-markdown';

import Banner from '../components/Banner';
import SectionCard from '../components/SectionCard';
import BulletList from '../components/BulletList';
import ChatBubble from '../components/ChatBubble';
import QuizCard from '../components/QuizCard';
import ModeBadge from '../components/ModeBadge';
import ReflectionCard from '../components/ReflectionCard';
import WritingOutlineCard from '../components/WritingOutlineCard';

import { createSystemMessage, createChatSystemMessage, createEvaluationSystemMessage } from '../lib/systemPrompt';
import { parseSectionedResponse, parseQuizBlock, extractTagBlock, copyText, modeMap } from '../lib/parseResponse';
import { useStudentNotes } from '../lib/useStudentNotes';
import { useSessionSave } from '../lib/useSessionSave';
import { REFLECTION_FIELDS } from '../lib/reflectionFields';
import { encodeShareData } from '../lib/shareUtils';

/** =========================
 *  메인
 *  ========================= */

export default function Home() {
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [gradeLevel, setGradeLevel] = useState('high');
  const [learningMode, setLearningMode] = useState('understand');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [loadingTool, setLoadingTool] = useState(null);
  const [hoveredTool, setHoveredTool] = useState(null);
  const [quizResult, setQuizResult] = useState(null); // 'correct' | 'incorrect' | null
  const [isMobile, setIsMobile] = useState(false);

  const [analysisResult, setAnalysisResult] = useState(EMPTY_ANALYSIS);

  const [quizKey, setQuizKey] = useState(0);

  const { notes, updateNote, saveStatus } = useStudentNotes(topic);
  const { savedTopics, triggerSave, saveNow, loadSession, deleteSession } = useSessionSave();

  const [conversation, setConversation] = useState([INIT_MSG]);

  // 전체 세션(조사자료·채팅·성찰·분석결과) 자동저장
  useEffect(() => {
    if (!topic.trim()) return;
    triggerSave({ topic, sourceText, gradeLevel, learningMode, conversation, notes, analysisResult });
  }, [topic, sourceText, gradeLevel, learningMode, conversation, notes, analysisResult, triggerSave]);

  // 이전 조사 불러오기
  const handleLoadSession = (savedTopic) => {
    // 현재 세션 즉시 저장 후 교체
    if (topic.trim()) saveNow({ topic, sourceText, gradeLevel, learningMode, conversation, notes, analysisResult });

    const session = loadSession(savedTopic);
    if (!session) return;

    setTopic(session.topic ?? '');
    setSourceText(session.sourceText ?? '');
    setGradeLevel(session.gradeLevel ?? 'high');
    setLearningMode(session.learningMode ?? 'understand');
    setConversation(session.conversation?.length > 0 ? session.conversation : [INIT_MSG]);
    setAnalysisResult(session.analysisResult ?? EMPTY_ANALYSIS);
    setQuizResult(null);
    setQuizKey(k => k + 1);
    // notes는 useStudentNotes가 topic 변경 시 자동으로 localStorage에서 읽어옴
  };

  const [chatInput, setChatInput] = useState('');
  const chatBoxRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatSectionRef = useRef(null);
  const quizRef = useRef(null);
  const evaluationRef = useRef(null);
  const teacherRef = useRef(null);

  const [hoveredMode, setHoveredMode] = useState(null);
  const [changeTip, setChangeTip] = useState(false);
  const tipTimerRef = useRef(null);
  const showModeTip = hoveredMode !== null || changeTip;
  const tipMode = hoveredMode || learningMode;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // conversation이 바뀔 때마다 채팅박스 내부를 즉시 맨 아래로 스크롤
  // requestAnimationFrame + smooth 조합은 스트리밍 chunk가 빠르게 들어올 때 서로 충돌해
  // 실제로 스크롤되지 않는 문제가 있어 scrollTop 직접 할당으로 교체
  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation]);

  useEffect(() => {
    if (!isChatLoading && chatInputRef.current) {
      try {
        chatInputRef.current.focus({ preventScroll: true });
      } catch {
        chatInputRef.current.focus();
      }
    }
  }, [isChatLoading]);

  // 모드 변경 시 말풍선 4초 표시
  useEffect(() => {
    setChangeTip(true);
    clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => setChangeTip(false), 4000);
    return () => clearTimeout(tipTimerRef.current);
  }, [learningMode]);

  // 퀴즈/평가/교과평어 카드 생성 시 해당 카드로 부드럽게 스크롤
  // scrollIntoView의 smooth가 브라우저마다 무시되는 경우가 있어 window.scrollTo로 직접 처리
  const smoothScrollTo = (ref) => {
    const timer = setTimeout(() => {
      if (!ref.current) return;
      const top = ref.current.getBoundingClientRect().top + window.pageYOffset - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    if (analysisResult.quiz) return smoothScrollTo(quizRef);
  }, [analysisResult.quiz]);

  useEffect(() => {
    if (analysisResult.evaluation) return smoothScrollTo(evaluationRef);
  }, [analysisResult.evaluation]);

  useEffect(() => {
    if (analysisResult.teacher) return smoothScrollTo(teacherRef);
  }, [analysisResult.teacher]);

  // SSE 스트리밍 — 청크 경계에서 끊길 경우를 대비해 버퍼로 누적 후 파싱
  const requestStream = async (messageHistory, { onChunk, onDone, onError }) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });

      if (!res.ok) {
        let errMsg = '오류가 발생했습니다. 다시 시도해 주세요.';
        try {
          const body = await res.json();
          if (body.error) errMsg = body.error;
        } catch {}
        onError?.(errMsg);
        return;
      }

      if (!res.body) throw new Error('서버 응답에 문제가 있습니다.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // 마지막 미완성 조각은 다음 루프로 이월

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            try {
              const data = JSON.parse(part.substring(6));
              fullText += data;
              onChunk?.(data, fullText);
            } catch {
              // 불완전한 JSON 청크는 건너뜀
            }
          }
        }
      }

      // 스트림 종료 후 버퍼 잔여분 처리
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.substring(6));
          fullText += data;
          onChunk?.(data, fullText);
        } catch {
          // 무시
        }
      }

      onDone?.(fullText);
    } catch (error) {
      console.error(error);
      onError?.(error);
    }
  };

  const buildBaseSystem = () =>
    createSystemMessage({ topic, sourceText, gradeLevel, learningMode });

  const buildChatSystem = () =>
    createChatSystemMessage({ topic, sourceText, gradeLevel });

  const buildEvaluationSystem = () => {
    // 분석 요청·버튼 명령을 제외한 실제 추가 질문만 추출
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

  // 성찰 내용 공유 URL 생성 (ReflectionCard의 onShare prop으로 전달)
  const handleShare = () => {
    const shareData = {
      topic: topic || '(제목 없음)',
      notes,
      sharedAt: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    };
    return `${window.location.origin}/share?d=${encodeShareData(shareData)}`;
  };

  const handleAnalyze = async () => {
    const trimmedTopic = topic.trim();
    const trimmedSource = sourceText.trim();

    if (!trimmedTopic) { alert('조사 주제를 먼저 입력해 주세요.'); return; }
    if (trimmedSource.length < 50) { alert('조사자료를 조금 더 길게 넣어 주세요.'); return; }

    setIsAnalyzing(true);

    const thinkingMsg = trimmedSource.length > 3000
      ? '자료가 너무 길어서 조금 오래 생각하는 중입니다. 잠시만 기다려 줘!'
      : '분석 중이야, 잠깐만 기다려 줘!';

    setConversation((prev) => [
      ...prev,
      { role: 'user', content: `조사주제는 '${trimmedTopic}'${hasBatchim(trimmedTopic) ? '이야' : '야'}. 자료를 분석해줘` },
      { role: 'assistant', content: thinkingMsg }
    ]);

    await requestStream(
      [buildBaseSystem(), { role: 'user', content: '원본 자료를 분석해서 모드에 맞는 학습 결과를 만들어 줘.' }],
      {
        onDone: (fullText) => {
          setAnalysisResult(parseSectionedResponse(fullText));
          setConversation((prev) => {
            const updated = [...prev];
            const last = updated.length - 1;
            if (updated[last]?.role === 'assistant') {
              updated[last] = { ...updated[last], content: '좋아! 지금 선택한 모드에 맞게 결과를 정리했어. 아래 카드들을 보면서 공부해 보자.' };
            }
            return updated;
          });
        },
        onError: (msg) => {
          setConversation((prev) => {
            const updated = [...prev];
            const last = updated.length - 1;
            if (updated[last]?.role === 'assistant') {
              updated[last] = { ...updated[last], content: msg || '자료 분석 중 오류가 발생했습니다.' };
            }
            return updated;
          });
        }
      }
    );

    setIsAnalyzing(false);
  };

  // requestStream을 Promise로 감싸는 헬퍼 — retry 로직에서 사용
  const streamOnce = (messages) =>
    new Promise((resolve, reject) => {
      requestStream(messages, { onDone: resolve, onError: reject });
    });

  // 퀴즈/요약/교과평어에 공통으로 쓰이는 단일 핸들러
  // retryTag 지정 시 해당 태그 미검출이면 1회 자동 재시도
  const handleSpecialRequest = async ({ promptText, withHistory = false, onDone, toolKey, buildSystem, retryTag }) => {
    if (!sourceText.trim()) { alert('먼저 자료를 분석해 주세요.'); return; }

    setIsAnalyzing(true);
    setLoadingTool(toolKey ?? null);

    const systemMsg = buildSystem ? buildSystem() : buildBaseSystem();
    const userMsg = { role: 'user', content: promptText };
    const messages = withHistory
      ? [systemMsg, ...conversation, userMsg]
      : [systemMsg, userMsg];

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
      promptText: '퀴즈풀기',
      toolKey: 'quiz',
      retryTag: 'quiz',
      onDone: (parsed) => {
        setAnalysisResult((prev) => ({ ...prev, quiz: parsed.quiz || '퀴즈를 만들지 못했어요.' }));
        setQuizKey((prev) => prev + 1);
        setQuizResult(null); // 새 퀴즈 생성 시 이전 결과 초기화
      }
    });

  const handleFullSummary = () =>
    handleSpecialRequest({
      promptText: '전체 요약',
      toolKey: 'summary',
      withHistory: true,
      onDone: (parsed) => {
        setAnalysisResult((prev) => ({
          ...prev,
          summaryLines: parsed.summaryLines.length > 0 ? parsed.summaryLines : prev.summaryLines
        }));
      }
    });

  const handleEvaluation = async () => {
    if (!sourceText.trim()) { alert('먼저 자료를 분석해 주세요.'); return; }

    setIsAnalyzing(true);
    setLoadingTool('evaluation');

    const systemMsg = buildEvaluationSystem();
    // conversation[0]은 항상 assistant 인사말 → OpenAI 표준(system→user→...)에 맞게 제거
    const chatHistory = conversation[0]?.role === 'assistant' ? conversation.slice(1) : conversation;
    const messages = [systemMsg, ...chatHistory, { role: 'user', content: '나 어땠어?' }];

    try {
      let fullText = await streamOnce(messages);
      if (!fullText.trim()) {
        fullText = await streamOnce(messages); // 응답이 비었으면 1회 재시도
      }
      setAnalysisResult((prev) => ({
        ...prev,
        evaluation: fullText.trim() || '평가 결과를 만들지 못했어요.'
      }));
    } catch (errorMsg) {
      alert(typeof errorMsg === 'string' ? errorMsg : '처리 중 오류가 발생했습니다.');
    }

    setIsAnalyzing(false);
    setLoadingTool(null);
  };

  const handleTeacherComment = () =>
    handleSpecialRequest({
      promptText: '교과평어 만들기',
      toolKey: 'teacher',
      withHistory: true,
      onDone: (parsed) => {
        setAnalysisResult((prev) => ({
          ...prev,
          teacher: parsed.teacher || '교과평어를 만들지 못했어요.'
        }));
      }
    });

  const handleFollowUpChat = async (customPrompt) => {
    const userText = (customPrompt ?? chatInput).trim();
    if (!userText || isChatLoading) return;

    const userMessage = { role: 'user', content: userText };
    const assistantPlaceholder = { role: 'assistant', content: '' };

    setChatInput('');
    setIsChatLoading(true);
    setConversation((prev) => [...prev, userMessage, assistantPlaceholder]);

    await requestStream([buildChatSystem(), ...conversation, userMessage], {
      onChunk: (data) => {
        setConversation((prev) => {
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
        setConversation((prev) => {
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

  const buildExportText = () => [
    `조사 주제: ${topic}`,
    `모드: ${modeMap[learningMode]}`,
    '',
    '[쉬운 설명]', analysisResult.easy || '',
    '',
    '[핵심 내용 3줄]', ...(analysisResult.summaryLines || []),
    '',
    '[핵심 개념]', ...(analysisResult.keywordLines || []),
    '',
    '[어려운 낱말 풀이]', ...(analysisResult.vocabularyLines || []),
    '',
    '[탐구 질문]', ...(analysisResult.questionLines || []),
    '',
    '[추천 검색어]', ...(analysisResult.searchLines || []),
    '',
    '[발표 제목]', analysisResult.presentationTitle || '',
    '',
    '[발표용 3문장]', ...(analysisResult.presentationScriptLines || []),
    '',
    '[설명문 개요]', analysisResult.writingOutline || ''
  ].join('\n');

  // analysisResult.quiz가 바뀔 때만 파싱·셔플 — 렌더마다 실행되면 hoveredTool 변경 시마다 리셋됨
  const parsedQuiz = useMemo(
    () => parseQuizBlock(analysisResult.quiz),
    [analysisResult.quiz]
  );

  const renderModeResultCards = () => {
    if (learningMode === 'understand') {
      return (
        <>
          <SectionCard
            title="쉬운 설명"
            icon="🧒"
            isMobile={isMobile}
            actions={
              analysisResult.easy ? (
                <button
                  style={{ ...styles.smallButton, ...(isMobile ? styles.smallButtonMobile : {}) }}
                  onClick={async () => {
                    try { await copyText(analysisResult.easy); alert('쉬운 설명을 복사했어요.'); }
                    catch { alert('복사에 실패했어요.'); }
                  }}
                >
                  복사
                </button>
              ) : null
            }
          >
            {analysisResult.easy ? (
              <div style={{ ...styles.markdownBody, ...(isMobile ? styles.markdownBodyMobile : {}) }}>
                <ReactMarkdown>{analysisResult.easy}</ReactMarkdown>
              </div>
            ) : (
              <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.7, ...(isMobile ? { fontSize: 14 } : {}) }}>
                자료를 분석하면 여기에 쉬운 설명이 나타납니다.
              </p>
            )}
          </SectionCard>

          <SectionCard title="어려운 낱말 풀이" icon="📚" isMobile={isMobile}>
            <BulletList items={analysisResult.vocabularyLines} isMobile={isMobile} />
          </SectionCard>

          <SectionCard title="핵심 내용 3줄" icon="📝" isMobile={isMobile}>
            <BulletList items={analysisResult.summaryLines} isMobile={isMobile} />
          </SectionCard>

          <SectionCard title="내가 다시 말해보기" icon="🗣️" isMobile={isMobile}>
            <BulletList items={analysisResult.reteachLines} isMobile={isMobile} />
          </SectionCard>

          <ReflectionCard
            fields={REFLECTION_FIELDS.understand}
            notes={notes}
            onUpdate={updateNote}
            saveStatus={saveStatus}
            onShare={handleShare}
            isMobile={isMobile}
          />
        </>
      );
    }

    if (learningMode === 'inquiry') {
      return (
        <>
          <SectionCard title="핵심 개념" icon="🧠" isMobile={isMobile}>
            <BulletList items={analysisResult.keywordLines} isMobile={isMobile} />
          </SectionCard>

          <SectionCard title="탐구 질문" icon="❓" isMobile={isMobile}>
            <BulletList items={analysisResult.questionLines} isMobile={isMobile} />
            {analysisResult.questionLines?.length > 0 && (
              <div style={{ ...styles.buttonWrap, ...(isMobile ? styles.buttonWrapMobile : {}) }}>
                {analysisResult.questionLines.map((q, idx) => (
                  <button
                    key={`${q}-${idx}`}
                    style={{ ...styles.questionButton, ...(isMobile ? styles.questionButtonMobile : {}) }}
                    onClick={() => {
                      handleFollowUpChat(q);
                      setTimeout(() => {
                        if (!chatSectionRef.current) return;
                        const top = chatSectionRef.current.getBoundingClientRect().top + window.pageYOffset - 16;
                        window.scrollTo({ top, behavior: 'smooth' });
                      }, 150);
                    }}
                    disabled={isChatLoading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <ReflectionCard
            fields={REFLECTION_FIELDS.inquiry}
            notes={notes}
            onUpdate={updateNote}
            saveStatus={saveStatus}
            onShare={handleShare}
            isMobile={isMobile}
          />

          <SectionCard title="추천 검색어" icon="🔎" isMobile={isMobile}>
            <BulletList items={analysisResult.searchLines} isMobile={isMobile} />
          </SectionCard>

          <SectionCard title="더 조사할 거리" icon="🧭" isMobile={isMobile}>
            <BulletList items={analysisResult.furtherLines} isMobile={isMobile} />
          </SectionCard>
        </>
      );
    }

    if (learningMode === 'presentation') {
      return (
        <>
          <SectionCard title="발표 제목" icon="🏷️" isMobile={isMobile}>
            {analysisResult.presentationTitle ? (
              <div style={{ ...styles.bigTitleBox, ...(isMobile ? styles.bigTitleBoxMobile : {}) }}>
                {analysisResult.presentationTitle}
              </div>
            ) : (
              <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.7, ...(isMobile ? { fontSize: 14 } : {}) }}>
                자료를 분석하면 여기에 발표 제목이 나타납니다.
              </p>
            )}
          </SectionCard>

          <SectionCard title="발표용 3문장" icon="🎤" isMobile={isMobile}>
            <BulletList items={analysisResult.presentationScriptLines} isMobile={isMobile} />
          </SectionCard>

          <SectionCard title="발표 순서" icon="📍" isMobile={isMobile}>
            <BulletList items={analysisResult.presentationOrderLines} isMobile={isMobile} />
          </SectionCard>

          <SectionCard title="예상 질문" icon="🙋" isMobile={isMobile}>
            <BulletList items={analysisResult.expectedQuestionLines} isMobile={isMobile} />
          </SectionCard>

          <ReflectionCard
            fields={REFLECTION_FIELDS.presentation}
            notes={notes}
            onUpdate={updateNote}
            saveStatus={saveStatus}
            onShare={handleShare}
            isMobile={isMobile}
          />
        </>
      );
    }

    if (learningMode === 'writing') {
      return (
        <>
          <SectionCard
            title="설명문 개요 (처음-가운데-끝)"
            icon="✏️"
            isMobile={isMobile}
            actions={
              analysisResult.writingOutline ? (
                <button
                  style={{ ...styles.smallButton, ...(isMobile ? styles.smallButtonMobile : {}) }}
                  onClick={async () => {
                    try { await copyText(analysisResult.writingOutline); alert('개요를 복사했어요.'); }
                    catch { alert('복사에 실패했어요.'); }
                  }}
                >
                  복사
                </button>
              ) : null
            }
          >
            <WritingOutlineCard outline={analysisResult.writingOutline} isMobile={isMobile} />
          </SectionCard>

          <SectionCard title="핵심 내용 3줄" icon="📝" isMobile={isMobile}>
            <BulletList items={analysisResult.summaryLines} isMobile={isMobile} />
          </SectionCard>

          <SectionCard title="어려운 낱말 풀이" icon="📚" isMobile={isMobile}>
            <BulletList items={analysisResult.vocabularyLines} isMobile={isMobile} />
          </SectionCard>

          <ReflectionCard
            fields={REFLECTION_FIELDS.writing}
            notes={notes}
            onUpdate={updateNote}
            saveStatus={saveStatus}
            onShare={handleShare}
            isMobile={isMobile}
          />
        </>
      );
    }

    return null;
  };

  return (
    <>
      <Head>
        <title>뭐냐면 - 조사자료 난이도 조절 웹앱</title>
        <meta name="description" content="전시물, 안내문, 조사자료를 초등학생 눈높이에 맞게 쉽게 바꾸고 탐구를 확장하는 AI 웹앱" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
        <div style={styles.container}>
          <Banner />

<div style={{ textAlign: 'center', marginBottom: isMobile ? 14 : 18 }}>
            <ModeBadge learningMode={learningMode} />
          </div>

          <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
            <div style={{ ...styles.leftColumn, ...(isMobile ? styles.leftColumnMobile : {}) }}>
              <SectionCard
                title="기본 설정"
                icon="🛠️"
                isMobile={isMobile}
                actions={
                  savedTopics.length > 0 ? (
                    <div style={styles.topicChipsWrap}>
                      <span style={styles.topicChipsLabel}>📂</span>
                      {savedTopics.slice(0, 6).map(({ topic: t }) => (
                        <button
                          key={t}
                          style={{
                            ...styles.topicChip,
                            ...(t === topic ? styles.topicChipActive : {})
                          }}
                          onClick={() => handleLoadSession(t)}
                          title={`"${t}" 불러오기`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : null
                }
              >
                <div style={styles.formGroup}>
                  <label style={{ ...styles.label, ...(isMobile ? styles.labelMobile : {}) }}>조사 주제</label>
                  <input
                    style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예: 세종대왕, 불국사, 독도, 신석기 시대"
                  />
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr',
                  gap: 12,
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ ...styles.label, ...(isMobile ? styles.labelMobile : {}) }}>학습 수준</label>
                    <select
                      style={{ ...styles.select, ...(isMobile ? styles.selectMobile : {}) }}
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.target.value)}
                    >
                      <option value="low">초등 저학년</option>
                      <option value="high">초등 고학년</option>
                      <option value="발표">발표 준비용</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ ...styles.label, ...(isMobile ? styles.labelMobile : {}) }}>학습 모드</label>
                    <div style={{ ...styles.modeButtonGroup, ...(isMobile ? styles.modeButtonGroupMobile : {}) }}>
                      {modeOptions.map(({ value, label, icon }) => (
                        <div
                          key={value}
                          style={{ flex: 1, position: 'relative', zIndex: hoveredMode === value ? 10 : 1 }}
                        >
                          <button
                            type="button"
                            style={{
                              ...styles.modeButton,
                              ...(learningMode === value ? styles.modeButtonActive : {}),
                              ...(isMobile ? styles.modeButtonMobile : {})
                            }}
                            onClick={() => setLearningMode(value)}
                            onMouseEnter={() => setHoveredMode(value)}
                            onMouseLeave={() => setHoveredMode(null)}
                          >
                            <span style={{ fontSize: isMobile ? 14 : 16 }}>{icon}</span>
                            {label}
                          </button>
                          {(hoveredMode === value || (changeTip && learningMode === value)) && (
                            <div style={styles.modeTipBubble}>
                              <div style={styles.modeTipArrow} />
                              {modeTips[value]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={{ ...styles.label, ...(isMobile ? styles.labelMobile : {}) }}>조사자료 입력</label>
                  <textarea
                    style={{ ...styles.textarea, ...(isMobile ? styles.textareaMobile : {}) }}
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder="박물관 안내문, 전시 설명문, 조사자료를 여기에 붙여넣어 주세요."
                  />
                </div>

                <div style={{ ...styles.primaryButtonRow, ...(isMobile ? styles.primaryButtonRowMobile : {}) }}>
                  <button
                    style={{ ...styles.primaryButton, ...(isMobile ? styles.primaryButtonMobile : {}), position: 'relative', overflow: 'hidden' }}
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing && <span className="tool-fill-bar-light" />}
                    {isAnalyzing ? '분석 중...' : '자료 분석 시작'}
                  </button>

                </div>
              </SectionCard>

              {renderModeResultCards()}

            </div>

            <div style={{ ...styles.rightColumn, ...(isMobile ? styles.rightColumnMobile : {}) }}>
              <div ref={chatSectionRef}>
              <SectionCard title="후속 질문 대화창" icon="💬" isMobile={isMobile}>
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

                <div style={styles.chatInputArea}>
                  <textarea
                    ref={chatInputRef}
                    style={{ ...styles.chatTextarea, ...(isMobile ? styles.chatTextareaMobile : {}) }}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="분석 결과를 보고 더 궁금한 점을 물어보세요."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleFollowUpChat();
                      }
                    }}
                    disabled={isChatLoading}
                  />
                  <button
                    style={{ ...styles.primaryButton, ...(isMobile ? styles.primaryButtonMobile : {}) }}
                    onClick={() => handleFollowUpChat()}
                    disabled={isChatLoading}
                  >
                    {isChatLoading ? '답변 중...' : '질문 보내기'}
                  </button>
                </div>

                <div style={{ ...styles.toolGrid, ...(isMobile ? styles.toolGridMobile : {}), marginTop: 10 }}>
                  {[
                    { key: 'quiz',       label: '💡 퀴즈',    handler: handleQuiz },
                    { key: 'evaluation', label: '🌟 나 어땠어?', handler: handleEvaluation },
                    { key: 'teacher',    label: '✍️ 교과평어', handler: handleTeacherComment },
                  ].map(({ key, label, handler }) => (
                    <div key={key} style={{ position: 'relative', zIndex: hoveredTool === key ? 10 : 1 }}>
                      <button
                        style={{ ...styles.toolButton, ...(isMobile ? styles.toolButtonMobile : {}), position: 'relative', overflow: 'hidden', width: '100%' }}
                        onClick={handler}
                        disabled={isAnalyzing}
                        onMouseEnter={() => setHoveredTool(key)}
                        onMouseLeave={() => setHoveredTool(null)}
                      >
                        {loadingTool === key && <span className="tool-fill-bar" />}
                        {label}
                      </button>
                      {hoveredTool === key && (
                        <div style={styles.toolTipBubble}>
                          <div style={styles.toolTipArrow} />
                          {toolTips[key]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
              </div>

              {analysisResult.quiz && (
                <div ref={quizRef}>
                  <SectionCard title="퀴즈" icon="🎯" isMobile={isMobile}>
                    <QuizCard key={quizKey} quizData={parsedQuiz} onReset={handleQuiz} isMobile={isMobile} onResult={setQuizResult} />
                  </SectionCard>
                </div>
              )}

              {analysisResult.evaluation && (
                <div ref={evaluationRef}>
                  <SectionCard title="학습 평가" icon="🌟" isMobile={isMobile}>
                    <div style={{ ...styles.markdownBody, ...(isMobile ? styles.markdownBodyMobile : {}) }}>
                      <ReactMarkdown>{analysisResult.evaluation}</ReactMarkdown>
                    </div>
                  </SectionCard>
                </div>
              )}

              {analysisResult.teacher && (
                <div ref={teacherRef}>
                  <SectionCard
                    title="교과평어 예시"
                    icon="🧾"
                    isMobile={isMobile}
                    actions={
                      <button
                        style={{ ...styles.smallButton, ...(isMobile ? styles.smallButtonMobile : {}) }}
                        onClick={async () => {
                          try { await copyText(analysisResult.teacher); alert('교과평어를 복사했어요.'); }
                          catch { alert('복사에 실패했어요.'); }
                        }}
                      >
                        복사
                      </button>
                    }
                  >
                    <div style={{ ...styles.markdownBody, ...(isMobile ? styles.markdownBodyMobile : {}) }}>
                      <ReactMarkdown>{analysisResult.teacher}</ReactMarkdown>
                    </div>
                  </SectionCard>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// 한글 마지막 글자의 받침 유무 판별
// 유니코드 한글 완성형(AC00-D7A3): (코드 - AC00) % 28 === 0 이면 받침 없음
function hasBatchim(str) {
  if (!str) return false;
  const last = str.trim().slice(-1);
  const code = last.charCodeAt(0);
  return code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0;
}

// 초기 대화 메시지 — 세션 불러오기 시에도 재사용
const INIT_MSG = {
  role: 'assistant',
  content: '안녕? 나는 조사자료를 쉽게 바꿔 주는 사회과 학습 도우미 [뭐냐면]이야. 먼저 조사 주제와 자료를 넣고, "자료 분석 시작" 버튼을 눌러 줘!'
};

const EMPTY_ANALYSIS = {
  easy: '', summaryLines: [], keywordLines: [], vocabularyLines: [],
  questionLines: [], searchLines: [], reteachLines: [], furtherLines: [],
  presentationTitle: '', presentationScriptLines: [], presentationOrderLines: [],
  expectedQuestionLines: [], teacher: '', quiz: '', evaluation: '',
  writingOutline: ''
};

const toolTips = {
  quiz:       '학습 내용으로 퀴즈를\n만들어 풀어볼 수 있어요.',
  evaluation: '지금까지 공부과정과\n조사활동을 돌아봐요.',
  teacher:    '교과 세부능력 특기사항\n예시문을 만들어 줘요.'
};

const modeOptions = [
  { value: 'understand',   label: '이해 모드',  icon: '🧒' },
  { value: 'inquiry',      label: '탐구 모드',  icon: '🔍' },
  { value: 'presentation', label: '발표 준비',  icon: '🎤' },
  { value: 'writing',      label: '글쓰기',     icon: '✏️' }
];

const modeTips = {
  understand: '어려운 설명을 먼저 쉽게 이해할 때 써요.\n쉬운 설명, 낱말 풀이, 핵심 내용 중심으로 정리해요.\n처음 자료를 읽을 때 가장 먼저 사용하면 좋아요.',
  inquiry: '이해한 내용을 바탕으로 더 조사할 때 써요.\n질문, 검색어, 더 조사할 거리를 보여줘요.\n탐구 주제 확장에 가장 잘 맞아요.',
  presentation: '조사한 내용을 친구들 앞에서 발표할 때 써요.\n발표 제목, 발표용 3문장, 발표 순서를 정리해요.\n발표문 초안 만들기에 좋아요.',
  writing: '조사한 내용을 바탕으로 설명문을 쓸 때 써요.\n처음-가운데-끝 개요를 만들어 줘요.\n글쓰기 전 계획 세우기에 가장 잘 맞아요.'
};

/** =========================
 *  스타일
 *  ========================= */

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%)',
    padding: '24px 16px 48px'
  },
  pageMobile: { padding: '16px 10px 32px' },
  container: { maxWidth: 1280, margin: '0 auto' },
grid: { display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: 20 },
  gridMobile: { gridTemplateColumns: '1fr', gap: 14 },
  leftColumn: { display: 'flex', flexDirection: 'column', gap: 18 },
  leftColumnMobile: { gap: 14 },
  rightColumn: { display: 'flex', flexDirection: 'column', gap: 18 },
  rightColumnMobile: { gap: 14 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formRowMobile: { gridTemplateColumns: '1fr', gap: 0 },
  label: { fontWeight: 700, color: '#374151', fontSize: 14 },
  labelMobile: { fontSize: 13 },
  input: {
    width: '100%', border: '1px solid #cbd5e1', borderRadius: 12,
    padding: '12px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box'
  },
  inputMobile: { fontSize: 16, padding: '12px' },
  select: {
    width: '100%', border: '1px solid #cbd5e1', borderRadius: 12,
    padding: '12px 14px', fontSize: 15, outline: 'none', background: '#fff', boxSizing: 'border-box'
  },
  selectMobile: { fontSize: 16, padding: '12px' },
  textarea: {
    width: '100%', minHeight: 220, border: '1px solid #cbd5e1', borderRadius: 14,
    padding: '14px 16px', fontSize: 15, lineHeight: 1.7, resize: 'vertical',
    outline: 'none', boxSizing: 'border-box'
  },
  textareaMobile: { minHeight: 180, fontSize: 16, padding: '12px' },
  primaryButtonRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  primaryButtonRowMobile: { flexDirection: 'column', gap: 10 },
  primaryButton: {
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    color: '#fff', fontWeight: 800, padding: '12px 18px', borderRadius: 12,
    cursor: 'pointer', boxShadow: '0 10px 24px rgba(37,99,235,0.22)'
  },
  primaryButtonMobile: { width: '100%', fontSize: 15, padding: '13px 14px' },
  secondaryButton: {
    border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
    fontWeight: 700, padding: '12px 18px', borderRadius: 12, cursor: 'pointer'
  },
  secondaryButtonMobile: { width: '100%', fontSize: 15, padding: '13px 14px' },
  smallButton: {
    border: '1px solid #d1d5db', background: '#fff', color: '#374151',
    fontWeight: 700, padding: '8px 12px', borderRadius: 10, cursor: 'pointer'
  },
  smallButtonMobile: { fontSize: 12, padding: '7px 10px' },
  markdownBody: { color: '#1f2937', lineHeight: 1.8, fontSize: 15 },
  markdownBodyMobile: { fontSize: 14, lineHeight: 1.7 },
  buttonWrap: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  buttonWrapMobile: { flexDirection: 'column', gap: 8 },
  questionButton: {
    border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8',
    padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, textAlign: 'left'
  },
  questionButtonMobile: { width: '100%', fontSize: 14, padding: '11px 12px' },
  toolGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  toolGridMobile: { gridTemplateColumns: '1fr 1fr 1fr', gap: 6 },
  toolButton: {
    border: '1px solid #dbeafe', background: '#f8fbff', color: '#1e3a8a',
    padding: '9px 6px', borderRadius: 10, cursor: 'pointer', fontWeight: 800,
    fontSize: 12, textAlign: 'center'
  },
  toolButtonMobile: { fontSize: 11, padding: '7px 4px' },
  toolTipBubble: {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: '#1e3a8a',
    color: '#fff',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 11,
    lineHeight: 1.6,
    zIndex: 100,
    whiteSpace: 'pre-line',
    textAlign: 'center',
    boxShadow: '0 4px 14px rgba(30,58,138,0.25)'
  },
  toolTipArrow: {
    position: 'absolute',
    bottom: -6,
    left: 'calc(50% - 6px)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid #1e3a8a'
  },
  chatBox: {
    height: 520, overflowY: 'auto', background: '#f8fafc',
    border: '1px solid #e5e7eb', borderRadius: 16, padding: 14, marginBottom: 12
  },
  chatBoxMobile: { height: 360, padding: 10, marginBottom: 10 },
  chatInputArea: { display: 'flex', flexDirection: 'column', gap: 10 },
  chatTextarea: {
    width: '100%', minHeight: 90, maxHeight: 220, border: '1px solid #cbd5e1',
    borderRadius: 14, padding: '12px 14px', fontSize: 15, lineHeight: 1.6,
    resize: 'vertical', outline: 'none', boxSizing: 'border-box'
  },
  chatTextareaMobile: { minHeight: 84, fontSize: 16, padding: '12px' },
  guideList: { margin: 0, paddingLeft: 20, color: '#374151', lineHeight: 1.9 },
  guideListMobile: { paddingLeft: 18, fontSize: 14, lineHeight: 1.7 },
  bigTitleBox: {
    fontSize: 20, fontWeight: 900, color: '#5b21b6', background: '#f5f3ff',
    border: '1px solid #ddd6fe', borderRadius: 14, padding: '16px 18px', lineHeight: 1.6
  },
  bigTitleBoxMobile: { fontSize: 17, padding: '13px 14px' },
  modeButtonGroup: {
    display: 'flex',
    gap: 8
  },
  modeButtonGroupMobile: { gap: 6 },
  modeButton: {
    width: '100%',
    border: '1.5px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    borderRadius: 10,
    padding: '7px 4px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    lineHeight: 1.2,
    transition: 'all 0.15s ease'
  },
  modeButtonActive: {
    border: '2px solid #2563eb',
    background: '#eff6ff',
    color: '#1d4ed8',
    boxShadow: '0 3px 8px rgba(37,99,235,0.15)'
  },
  modeButtonMobile: {
    fontSize: 11,
    padding: '6px 4px',
    gap: 2
  },
  modeTipBubble: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: '#1e3a8a',
    color: '#fff',
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 11,
    lineHeight: 1.6,
    zIndex: 100,
    whiteSpace: 'pre-line',
    boxShadow: '0 6px 18px rgba(30,58,138,0.25)'
  },
  modeTipArrow: {
    position: 'absolute',
    top: -7,
    left: 'calc(50% - 7px)',
    width: 0,
    height: 0,
    borderLeft: '7px solid transparent',
    borderRight: '7px solid transparent',
    borderBottom: '7px solid #1e3a8a'
  },
  topicChipsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'nowrap',
    overflowX: 'auto',
    maxWidth: 320
  },
  topicChipsLabel: {
    fontSize: 13,
    flexShrink: 0
  },
  topicChip: {
    border: '1.5px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: 800,
    padding: '5px 12px',
    borderRadius: 20,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'all 0.15s'
  },
  topicChipActive: {
    background: '#2563eb',
    border: '1.5px solid #2563eb',
    color: '#fff'
  }
};


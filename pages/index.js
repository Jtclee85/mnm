import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import ReactMarkdown from 'react-markdown';

import Banner from '../components/Banner';
import SectionCard from '../components/SectionCard';
import BulletList from '../components/BulletList';
import ChatBubble from '../components/ChatBubble';
import QuizCard from '../components/QuizCard';
import ModeBadge from '../components/ModeBadge';

import { createSystemMessage } from '../lib/systemPrompt';
import { parseSectionedResponse, parseQuizBlock, copyText, modeMap } from '../lib/parseResponse';

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
  const [isMobile, setIsMobile] = useState(false);

  const [analysisResult, setAnalysisResult] = useState({
    easy: '',
    summaryLines: [],
    keywordLines: [],
    vocabularyLines: [],
    questionLines: [],
    searchLines: [],
    reteachLines: [],
    furtherLines: [],
    presentationTitle: '',
    presentationScriptLines: [],
    presentationOrderLines: [],
    expectedQuestionLines: [],
    teacher: '',
    quiz: '',
    evaluation: ''
  });

  const [quizKey, setQuizKey] = useState(0);

  const [conversation, setConversation] = useState([
    {
      role: 'assistant',
      content:
        '안녕? 나는 조사자료를 쉽게 바꿔 주는 사회과 학습 도우미 [뭐냐면]이야. 먼저 조사 주제와 자료를 넣고, "자료 분석 시작" 버튼을 눌러 줘!'
    }
  ]);

  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollChatToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      chatBottomRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    });
  };

  useEffect(() => { scrollChatToBottom(true); }, [conversation]);

  useEffect(() => {
    if (!isChatLoading && chatInputRef.current) {
      try {
        chatInputRef.current.focus({ preventScroll: true });
      } catch {
        chatInputRef.current.focus();
      }
    }
  }, [isChatLoading]);

  // SSE 스트리밍 — 청크 경계에서 끊길 경우를 대비해 버퍼로 누적 후 파싱
  const requestStream = async (messageHistory, { onChunk, onDone, onError }) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });

      if (!res.ok || !res.body) throw new Error('서버 응답에 문제가 있습니다.');

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

  const handleAnalyze = async () => {
    const trimmedTopic = topic.trim();
    const trimmedSource = sourceText.trim();

    if (!trimmedTopic) { alert('조사 주제를 먼저 입력해 주세요.'); return; }
    if (trimmedSource.length < 50) { alert('조사자료를 조금 더 길게 넣어 주세요.'); return; }

    setIsAnalyzing(true);

    await requestStream(
      [buildBaseSystem(), { role: 'user', content: '원본 자료를 분석해서 모드에 맞는 학습 결과를 만들어 줘.' }],
      {
        onDone: (fullText) => {
          setAnalysisResult(parseSectionedResponse(fullText));
          setConversation((prev) => [
            ...prev,
            { role: 'user', content: `조사 주제는 "${trimmedTopic}"이고, 자료 분석을 시작했어.` },
            { role: 'assistant', content: '좋아! 지금 선택한 모드에 맞게 결과를 정리했어. 아래 카드들을 보면서 공부해 보자.' }
          ]);
          scrollChatToBottom(true);
        },
        onError: () => alert('자료 분석 중 오류가 발생했습니다.')
      }
    );

    setIsAnalyzing(false);
  };

  // 퀴즈/요약/평가/교과평어에 공통으로 쓰이는 단일 핸들러
  const handleSpecialRequest = async ({ promptText, withHistory = false, onDone }) => {
    if (!sourceText.trim()) { alert('먼저 자료를 분석해 주세요.'); return; }

    setIsAnalyzing(true);
    const systemMsg = buildBaseSystem();
    const userMsg = { role: 'user', content: promptText };
    const messages = withHistory
      ? [systemMsg, ...conversation, userMsg]
      : [systemMsg, userMsg];

    await requestStream(messages, {
      onDone: (fullText) => onDone(parseSectionedResponse(fullText)),
      onError: () => alert('처리 중 오류가 발생했습니다.')
    });

    setIsAnalyzing(false);
  };

  const handleQuiz = () =>
    handleSpecialRequest({
      promptText: '퀴즈풀기',
      onDone: (parsed) => {
        setAnalysisResult((prev) => ({ ...prev, quiz: parsed.quiz || '퀴즈를 만들지 못했어요.' }));
        setQuizKey((prev) => prev + 1);
      }
    });

  const handleFullSummary = () =>
    handleSpecialRequest({
      promptText: '전체 요약',
      withHistory: true,
      onDone: (parsed) => {
        setAnalysisResult((prev) => ({
          ...prev,
          summaryLines: parsed.summaryLines.length > 0 ? parsed.summaryLines : prev.summaryLines
        }));
      }
    });

  const handleEvaluation = () =>
    handleSpecialRequest({
      promptText: '나 어땠어?',
      withHistory: true,
      onDone: (parsed) => {
        setAnalysisResult((prev) => ({
          ...prev,
          evaluation: parsed.evaluation || '평가 결과를 만들지 못했어요.'
        }));
      }
    });

  const handleTeacherComment = () =>
    handleSpecialRequest({
      promptText: '교과평어 만들기',
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
    scrollChatToBottom(false);

    await requestStream([buildBaseSystem(), ...conversation, userMessage], {
      onChunk: (data) => {
        setConversation((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], content: updated[lastIdx].content + data };
          }
          return updated;
        });
        scrollChatToBottom(false);
      },
      onDone: () => scrollChatToBottom(true),
      onError: () => {
        setConversation((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], content: '앗, 답변을 가져오는 중 문제가 생겼어요.' };
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
    '[발표용 3문장]', ...(analysisResult.presentationScriptLines || [])
  ].join('\n');

  const parsedQuiz = parseQuizBlock(analysisResult.quiz);

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
                    onClick={() => handleFollowUpChat(q)}
                    disabled={isChatLoading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

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

          <div style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
            <div style={{ ...styles.heroBadge, ...(isMobile ? styles.heroBadgeMobile : {}) }}>
              사회과 조사학습 AI 코스웨어
            </div>
            <h1 style={{ ...styles.heroTitle, ...(isMobile ? styles.heroTitleMobile : {}) }}>
              뭐냐면
            </h1>
            <p style={{ ...styles.heroSubtitle, ...(isMobile ? styles.heroSubtitleMobile : {}) }}>
              어려운 전시 설명, 안내문, 조사자료를
              <br />
              학생이 이해할 수 있는 말로 다시 바꿔 주는 웹앱
            </p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: isMobile ? 14 : 18 }}>
            <ModeBadge learningMode={learningMode} />
          </div>

          <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
            <div style={{ ...styles.leftColumn, ...(isMobile ? styles.leftColumnMobile : {}) }}>
              <SectionCard title="기본 설정" icon="🛠️" isMobile={isMobile}>
                <div style={styles.formGroup}>
                  <label style={{ ...styles.label, ...(isMobile ? styles.labelMobile : {}) }}>조사 주제</label>
                  <input
                    style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예: 세종대왕, 불국사, 독도, 신석기 시대"
                  />
                </div>

                <div style={{ ...styles.formRow, ...(isMobile ? styles.formRowMobile : {}) }}>
                  <div style={styles.formGroup}>
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

                  <div style={styles.formGroup}>
                    <label style={{ ...styles.label, ...(isMobile ? styles.labelMobile : {}) }}>학습 모드</label>
                    <select
                      style={{ ...styles.select, ...(isMobile ? styles.selectMobile : {}) }}
                      value={learningMode}
                      onChange={(e) => setLearningMode(e.target.value)}
                    >
                      <option value="understand">이해 모드</option>
                      <option value="inquiry">탐구 모드</option>
                      <option value="presentation">발표 준비 모드</option>
                    </select>
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
                    style={{ ...styles.primaryButton, ...(isMobile ? styles.primaryButtonMobile : {}) }}
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? '분석 중...' : '자료 분석 시작'}
                  </button>

                  <button
                    style={{ ...styles.secondaryButton, ...(isMobile ? styles.secondaryButtonMobile : {}) }}
                    onClick={async () => {
                      try { await copyText(buildExportText()); alert('결과를 복사했어요.'); }
                      catch { alert('복사에 실패했어요.'); }
                    }}
                  >
                    결과 복사
                  </button>
                </div>
              </SectionCard>

              {renderModeResultCards()}

              <SectionCard title="학습 확장 도구" icon="🚀" isMobile={isMobile}>
                <div style={{ ...styles.toolGrid, ...(isMobile ? styles.toolGridMobile : {}) }}>
                  <button style={{ ...styles.toolButton, ...(isMobile ? styles.toolButtonMobile : {}) }} onClick={handleQuiz} disabled={isAnalyzing}>💡 퀴즈 만들기</button>
                  <button style={{ ...styles.toolButton, ...(isMobile ? styles.toolButtonMobile : {}) }} onClick={handleFullSummary} disabled={isAnalyzing}>📜 전체 요약</button>
                  <button style={{ ...styles.toolButton, ...(isMobile ? styles.toolButtonMobile : {}) }} onClick={handleEvaluation} disabled={isAnalyzing}>💯 나 어땠어?</button>
                  <button style={{ ...styles.toolButton, ...(isMobile ? styles.toolButtonMobile : {}) }} onClick={handleTeacherComment} disabled={isAnalyzing}>✍️ 교과평어 만들기</button>
                </div>
              </SectionCard>

              {analysisResult.quiz && (
                <SectionCard title="퀴즈" icon="🎯" isMobile={isMobile}>
                  <QuizCard key={quizKey} quizData={parsedQuiz} onReset={handleQuiz} isMobile={isMobile} />
                </SectionCard>
              )}

              {analysisResult.evaluation && (
                <SectionCard title="학습 평가" icon="🌟" isMobile={isMobile}>
                  <div style={{ ...styles.markdownBody, ...(isMobile ? styles.markdownBodyMobile : {}) }}>
                    <ReactMarkdown>{analysisResult.evaluation}</ReactMarkdown>
                  </div>
                </SectionCard>
              )}

              {analysisResult.teacher && (
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
              )}
            </div>

            <div style={{ ...styles.rightColumn, ...(isMobile ? styles.rightColumnMobile : {}) }}>
              <SectionCard title="후속 질문 대화창" icon="💬" isMobile={isMobile}>
                <div style={{ ...styles.chatBox, ...(isMobile ? styles.chatBoxMobile : {}) }}>
                  {conversation.map((msg, idx) => (
                    <ChatBubble
                      key={`${msg.role}-${idx}-${msg.content.slice(0, 10)}`}
                      role={msg.role}
                      content={msg.content}
                      isMobile={isMobile}
                    />
                  ))}
                  <div ref={chatBottomRef} />
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
              </SectionCard>

              <SectionCard title="모드별 안내" icon="📌" isMobile={isMobile}>
                {learningMode === 'understand' && (
                  <ul style={{ ...styles.guideList, ...(isMobile ? styles.guideListMobile : {}) }}>
                    <li>어려운 설명을 먼저 쉽게 이해할 때 쓰는 모드예요.</li>
                    <li>쉬운 설명, 낱말 풀이, 핵심 내용 중심으로 정리해 줘요.</li>
                    <li>처음 자료를 읽을 때 가장 먼저 사용하면 좋아요.</li>
                  </ul>
                )}
                {learningMode === 'inquiry' && (
                  <ul style={{ ...styles.guideList, ...(isMobile ? styles.guideListMobile : {}) }}>
                    <li>이해한 내용을 바탕으로 더 조사할 때 쓰는 모드예요.</li>
                    <li>질문, 검색어, 더 조사할 거리 중심으로 보여줘요.</li>
                    <li>탐구 주제 확장에 가장 잘 맞아요.</li>
                  </ul>
                )}
                {learningMode === 'presentation' && (
                  <ul style={{ ...styles.guideList, ...(isMobile ? styles.guideListMobile : {}) }}>
                    <li>조사한 내용을 친구들 앞에서 발표할 때 쓰는 모드예요.</li>
                    <li>발표 제목, 발표용 3문장, 발표 순서를 중심으로 정리해 줘요.</li>
                    <li>발표문 초안 만들기에 좋아요.</li>
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

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
  hero: { textAlign: 'center', margin: '8px 0 24px' },
  heroMobile: { margin: '4px 0 16px' },
  heroBadge: {
    display: 'inline-block',
    background: '#dbeafe',
    color: '#1d4ed8',
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 12
  },
  heroBadgeMobile: { fontSize: 12, padding: '6px 10px', marginBottom: 10 },
  heroTitle: { fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: '0 0 8px', color: '#111827', fontWeight: 900 },
  heroTitleMobile: { fontSize: '2rem', margin: '0 0 6px' },
  heroSubtitle: { margin: 0, color: '#4b5563', lineHeight: 1.7, fontSize: 'clamp(1rem, 2vw, 1.15rem)' },
  heroSubtitleMobile: { fontSize: 14, lineHeight: 1.6 },
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
  toolGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  toolGridMobile: { gridTemplateColumns: '1fr' },
  toolButton: {
    border: '1px solid #dbeafe', background: '#f8fbff', color: '#1e3a8a',
    padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 800
  },
  toolButtonMobile: { width: '100%', fontSize: 14, padding: '12px' },
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
  bigTitleBoxMobile: { fontSize: 17, padding: '13px 14px' }
};

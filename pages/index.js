import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import ReactMarkdown from 'react-markdown';
import Banner from '../components/Banner';

/** =========================
 *  유틸
 *  ========================= */

const extractTagBlock = (text, tag) => {
  if (!text) return '';
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
};

const extractMultiTagBlocks = (text, tag) => {
  if (!text) return [];
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  return results;
};

const splitLines = (text) => {
  if (!text) return [];
  return text
    .split(/\r?\n|•|·|-/g)
    .map((line) => line.trim())
    .filter(Boolean);
};

const parseSectionedResponse = (rawText) => {
  const easy = extractTagBlock(rawText, 'easy');
  const summary = extractTagBlock(rawText, 'summary');
  const keywords = extractTagBlock(rawText, 'keywords');
  const vocabulary = extractTagBlock(rawText, 'vocabulary');
  const questions = extractTagBlock(rawText, 'questions');
  const searches = extractTagBlock(rawText, 'searches');
  const teacher = extractTagBlock(rawText, 'teacher');
  const quiz = extractTagBlock(rawText, 'quiz');
  const evaluation = extractTagBlock(rawText, 'evaluation');

  return {
    easy,
    summaryLines: splitLines(summary),
    keywordLines: splitLines(keywords),
    vocabularyLines: splitLines(vocabulary),
    questionLines: splitLines(questions),
    searchLines: splitLines(searches),
    teacher,
    quiz,
    evaluation
  };
};

const copyText = async (text) => {
  await navigator.clipboard.writeText(text);
};

const gradeLevelMap = {
  low: '초등 저학년',
  high: '초등 고학년',
  발표: '발표 준비용'
};

const modeMap = {
  understand: '이해 모드',
  inquiry: '탐구 모드',
  presentation: '발표 준비 모드'
};

/** =========================
 *  시스템 프롬프트
 *  ========================= */

const createSystemMessage = ({
  topic,
  sourceText,
  gradeLevel,
  learningMode
}) => ({
  role: 'system',
  content: `
너는 '뭐냐면'이라는 이름의 초등 사회과 조사학습 도우미 AI다.

[조사 주제]
${topic}

[학습 대상]
${gradeLevelMap[gradeLevel] || '초등학생'}

[학습 모드]
${modeMap[learningMode] || '이해 모드'}

[원본 자료]
${sourceText}
[/원본 자료]

너의 가장 중요한 역할은 학생이 가져온 어려운 전시물 설명, 안내문, 조사자료를
초등학생 눈높이에 맞게 다시 이해할 수 있도록 바꾸어 주는 것이다.

반드시 아래 규칙을 지켜라.

[공통 규칙]
1. 원본 자료를 최우선으로 활용하되, 이해를 돕기 위해 필요한 범위에서만 배경지식을 덧붙여라.
2. 초등학생이 이해할 수 있는 쉬운 단어를 사용하라.
3. 어려운 표현은 풀어서 설명하라.
4. 설명은 친절하고 짧은 문장 위주로 써라.
5. 사실과 다른 내용을 지어내지 마라.
6. 결과는 반드시 아래 태그 형식으로 출력하라. 태그 바깥에는 아무 말도 쓰지 마라.

[학습 모드별 강조]
- 이해 모드: 쉬운 설명, 핵심 개념, 어려운 낱말 풀이를 가장 충실하게 작성
- 탐구 모드: 탐구 질문과 추천 검색어를 더 풍부하게 작성
- 발표 준비 모드: 발표하기 좋은 문장, 핵심 요약, 발표에 쓸 표현을 더 분명하게 작성

[출력 형식]
<easy>
원본 자료를 쉬운 말로 4~8문장 정도로 설명
</easy>

<summary>
핵심 내용 3줄
한 줄에 1개씩
</summary>

<keywords>
핵심 개념 3~5개
한 줄에 1개씩
</keywords>

<vocabulary>
어려운 낱말 풀이 3~5개
형식: 낱말: 뜻
한 줄에 1개씩
</vocabulary>

<questions>
탐구 질문 3개
한 줄에 1개씩
</questions>

<searches>
추천 검색어 3~5개
기본 검색어, 심화 검색어, 비교 검색어가 섞이도록 작성
한 줄에 1개씩
</searches>

특수 요청이 있을 때는 아래처럼 추가 태그를 사용하라.

1. 사용자가 "퀴즈풀기"를 요청하면:
<quiz>
객관식 또는 OX 퀴즈 1개와 정답 확인용 설명
</quiz>

2. 사용자가 "전체 요약"을 요청하면:
<summary>
지금까지의 활동 전체를 3줄로 요약
</summary>

3. 사용자가 "나 어땠어?"를 요청하면:
<evaluation>
최고야!, 정말 잘했어!, 좀 더 관심을 가져보자! 중 하나와 이유
</evaluation>

4. 사용자가 "교과평어 만들기"를 요청하면:
<teacher>
교과 세부능력 및 특기사항 예시문을 "~~함.", "~~였음." 형식의 개조식으로 작성
</teacher>
`
});

/** =========================
 *  컴포넌트
 *  ========================= */

function SectionCard({ title, icon, children, actions }) {
  return (
    <div style={styles.sectionCard}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitle}>
          <span style={{ marginRight: 8 }}>{icon}</span>
          {title}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

function BulletList({ items }) {
  if (!items || items.length === 0) {
    return <p style={styles.emptyText}>아직 생성된 내용이 없습니다.</p>;
  }

  return (
    <ul style={styles.bulletList}>
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`} style={styles.bulletItem}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function ChatBubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 10
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          background: isUser ? '#2563eb' : '#ffffff',
          color: isUser ? '#ffffff' : '#1f2937',
          border: `1px solid ${isUser ? '#2563eb' : '#d1d5db'}`,
          borderRadius: 16,
          padding: '12px 14px',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          boxShadow: isUser
            ? '0 6px 18px rgba(37,99,235,0.16)'
            : '0 6px 18px rgba(0,0,0,0.06)'
        }}
      >
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

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

  const [analysisResult, setAnalysisResult] = useState({
    easy: '',
    summaryLines: [],
    keywordLines: [],
    vocabularyLines: [],
    questionLines: [],
    searchLines: [],
    teacher: '',
    quiz: '',
    evaluation: ''
  });

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
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    if (!isChatLoading) {
      chatInputRef.current?.focus();
    }
  }, [isChatLoading]);

  const requestStream = async (messageHistory, { onChunk, onDone, onError }) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });

      if (!res.ok || !res.body) {
        throw new Error('서버 응답에 문제가 있습니다.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            fullText += data;
            onChunk?.(data, fullText);
          }
        }
      }

      onDone?.(fullText);
    } catch (error) {
      console.error(error);
      onError?.(error);
    }
  };

  const buildBaseSystem = () =>
    createSystemMessage({
      topic,
      sourceText,
      gradeLevel,
      learningMode
    });

  const handleAnalyze = async () => {
    const trimmedTopic = topic.trim();
    const trimmedSource = sourceText.trim();

    if (!trimmedTopic) {
      alert('조사 주제를 먼저 입력해 주세요.');
      return;
    }

    if (trimmedSource.length < 50) {
      alert('조사자료를 조금 더 길게 넣어 주세요.');
      return;
    }

    setIsAnalyzing(true);

    const systemMsg = buildBaseSystem();
    const userMsg = {
      role: 'user',
      content: '원본 자료를 분석해서 쉬운 설명, 핵심 개념, 어려운 낱말, 탐구 질문, 추천 검색어를 만들어 줘.'
    };

    await requestStream([systemMsg, userMsg], {
      onDone: (fullText) => {
        const parsed = parseSectionedResponse(fullText);
        setAnalysisResult(parsed);

        setConversation((prev) => [
          ...prev,
          {
            role: 'user',
            content: `조사 주제는 "${trimmedTopic}"이고, 자료 분석을 시작했어.`
          },
          {
            role: 'assistant',
            content:
              '좋아! 자료를 분석해서 아래에 정리했어. 궁금한 점이 있으면 아래 대화창에서 이어서 물어봐도 돼.'
          }
        ]);
      },
      onError: () => {
        alert('자료 분석 중 오류가 발생했습니다.');
      }
    });

    setIsAnalyzing(false);
  };

  const handleFollowUpChat = async (customPrompt) => {
    const userText = (customPrompt ?? chatInput).trim();
    if (!userText || isChatLoading) return;

    const userMessage = { role: 'user', content: userText };
    const systemMsg = buildBaseSystem();

    setConversation((prev) => [...prev, userMessage, { role: 'assistant', content: '' }]);
    setChatInput('');
    setIsChatLoading(true);

    let targetIndex = -1;
    setConversation((prev) => {
      const updated = [...prev, userMessage, { role: 'assistant', content: '' }];
      targetIndex = updated.length - 1;
      return updated;
    });

    await requestStream([systemMsg, ...conversation, userMessage], {
      onChunk: (data) => {
        setConversation((prev) => {
          const updated = [...prev];
          if (updated[targetIndex]) {
            updated[targetIndex].content += data;
          }
          return updated;
        });
      },
      onDone: () => {},
      onError: () => {
        setConversation((prev) => {
          const updated = [...prev];
          if (updated[targetIndex]) {
            updated[targetIndex].content = '앗, 답변을 가져오는 중 문제가 생겼어요.';
          }
          return updated;
        });
      }
    });

    setIsChatLoading(false);
  };

  const handleQuiz = async () => {
    if (!sourceText.trim()) {
      alert('먼저 자료를 분석해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    const systemMsg = buildBaseSystem();
    const userMsg = {
      role: 'user',
      content: '퀴즈풀기'
    };

    await requestStream([systemMsg, userMsg], {
      onDone: (fullText) => {
        const parsed = parseSectionedResponse(fullText);
        setAnalysisResult((prev) => ({
          ...prev,
          quiz: parsed.quiz || '퀴즈를 만들지 못했어요.'
        }));
      },
      onError: () => {
        alert('퀴즈 생성 중 오류가 발생했습니다.');
      }
    });

    setIsAnalyzing(false);
  };

  const handleFullSummary = async () => {
    if (!sourceText.trim()) {
      alert('먼저 자료를 분석해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    const systemMsg = buildBaseSystem();
    const userMsg = {
      role: 'user',
      content: '전체 요약'
    };

    await requestStream([systemMsg, ...conversation, userMsg], {
      onDone: (fullText) => {
        const parsed = parseSectionedResponse(fullText);
        setAnalysisResult((prev) => ({
          ...prev,
          summaryLines:
            parsed.summaryLines.length > 0
              ? parsed.summaryLines
              : prev.summaryLines
        }));
      },
      onError: () => {
        alert('전체 요약 생성 중 오류가 발생했습니다.');
      }
    });

    setIsAnalyzing(false);
  };

  const handleEvaluation = async () => {
    if (!sourceText.trim()) {
      alert('먼저 자료를 분석해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    const systemMsg = buildBaseSystem();
    const userMsg = {
      role: 'user',
      content: '나 어땠어?'
    };

    await requestStream([systemMsg, ...conversation, userMsg], {
      onDone: (fullText) => {
        const parsed = parseSectionedResponse(fullText);
        setAnalysisResult((prev) => ({
          ...prev,
          evaluation: parsed.evaluation || '평가 결과를 만들지 못했어요.'
        }));
      },
      onError: () => {
        alert('학습 평가 생성 중 오류가 발생했습니다.');
      }
    });

    setIsAnalyzing(false);
  };

  const handleTeacherComment = async () => {
    if (!sourceText.trim()) {
      alert('먼저 자료를 분석해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    const systemMsg = buildBaseSystem();
    const userMsg = {
      role: 'user',
      content: '교과평어 만들기'
    };

    await requestStream([systemMsg, ...conversation, userMsg], {
      onDone: (fullText) => {
        const parsed = parseSectionedResponse(fullText);
        setAnalysisResult((prev) => ({
          ...prev,
          teacher: parsed.teacher || '교과평어를 만들지 못했어요.'
        }));
      },
      onError: () => {
        alert('교과평어 생성 중 오류가 발생했습니다.');
      }
    });

    setIsAnalyzing(false);
  };

  const buildExportText = () => {
    return [
      `조사 주제: ${topic}`,
      '',
      '[쉬운 설명]',
      analysisResult.easy || '',
      '',
      '[핵심 내용 3줄]',
      ...(analysisResult.summaryLines || []),
      '',
      '[핵심 개념]',
      ...(analysisResult.keywordLines || []),
      '',
      '[어려운 낱말 풀이]',
      ...(analysisResult.vocabularyLines || []),
      '',
      '[탐구 질문]',
      ...(analysisResult.questionLines || []),
      '',
      '[추천 검색어]',
      ...(analysisResult.searchLines || [])
    ].join('\n');
  };

  return (
    <>
      <Head>
        <title>뭐냐면 - 조사자료 난이도 조절 웹앱</title>
        <meta
          name="description"
          content="전시물, 안내문, 조사자료를 초등학생 눈높이에 맞게 쉽게 바꾸고 탐구를 확장하는 AI 웹앱"
        />
        <meta
          property="og:title"
          content="뭐냐면 - 조사자료 난이도 조절 웹앱"
        />
        <meta
          property="og:description"
          content="사회과 조사학습과 박물관 학습을 위한 쉬운 설명, 핵심 개념, 탐구 질문, 추천 검색어 생성"
        />
        <meta
          property="og:image"
          content="https://mnm-kappa.vercel.app/preview.png"
        />
        <meta property="og:url" content="https://mnm-kappa.vercel.app" />
      </Head>

      <div style={styles.page}>
        <div style={styles.container}>
          <Banner />

          <div style={styles.hero}>
            <div style={styles.heroBadge}>사회과 조사학습 AI 코스웨어</div>
            <h1 style={styles.heroTitle}>뭐냐면</h1>
            <p style={styles.heroSubtitle}>
              어려운 전시 설명, 안내문, 조사자료를
              <br />
              학생이 이해할 수 있는 말로 다시 바꿔 주는 웹앱
            </p>
          </div>

          <div style={styles.grid}>
            <div style={styles.leftColumn}>
              <SectionCard title="기본 설정" icon="🛠️">
                <div style={styles.formGroup}>
                  <label style={styles.label}>조사 주제</label>
                  <input
                    style={styles.input}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예: 세종대왕, 불국사, 독도, 신석기 시대"
                  />
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>학습 수준</label>
                    <select
                      style={styles.select}
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.target.value)}
                    >
                      <option value="low">초등 저학년</option>
                      <option value="high">초등 고학년</option>
                      <option value="발표">발표 준비용</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>학습 모드</label>
                    <select
                      style={styles.select}
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
                  <label style={styles.label}>조사자료 입력</label>
                  <textarea
                    style={styles.textarea}
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder="박물관 안내문, 전시 설명, 인터넷 조사자료를 여기에 붙여넣어 주세요."
                  />
                </div>

                <div style={styles.primaryButtonRow}>
                  <button
                    style={styles.primaryButton}
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? '분석 중...' : '자료 분석 시작'}
                  </button>

                  <button
                    style={styles.secondaryButton}
                    onClick={async () => {
                      try {
                        await copyText(buildExportText());
                        alert('결과를 복사했어요.');
                      } catch (e) {
                        alert('복사에 실패했어요.');
                      }
                    }}
                  >
                    결과 복사
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title="쉬운 설명"
                icon="🧒"
                actions={
                  analysisResult.easy ? (
                    <button
                      style={styles.smallButton}
                      onClick={async () => {
                        try {
                          await copyText(analysisResult.easy);
                          alert('쉬운 설명을 복사했어요.');
                        } catch (e) {
                          alert('복사에 실패했어요.');
                        }
                      }}
                    >
                      복사
                    </button>
                  ) : null
                }
              >
                {analysisResult.easy ? (
                  <div style={styles.markdownBody}>
                    <ReactMarkdown>{analysisResult.easy}</ReactMarkdown>
                  </div>
                ) : (
                  <p style={styles.emptyText}>
                    자료를 분석하면 여기에 쉬운 설명이 나타납니다.
                  </p>
                )}
              </SectionCard>

              <SectionCard title="핵심 내용 3줄" icon="📝">
                <BulletList items={analysisResult.summaryLines} />
              </SectionCard>

              <SectionCard title="핵심 개념" icon="🧠">
                <BulletList items={analysisResult.keywordLines} />
              </SectionCard>

              <SectionCard title="어려운 낱말 풀이" icon="📚">
                <BulletList items={analysisResult.vocabularyLines} />
              </SectionCard>

              <SectionCard title="탐구 질문" icon="❓">
                <BulletList items={analysisResult.questionLines} />
                {analysisResult.questionLines?.length > 0 && (
                  <div style={styles.buttonWrap}>
                    {analysisResult.questionLines.map((q, idx) => (
                      <button
                        key={`${q}-${idx}`}
                        style={styles.questionButton}
                        onClick={() => handleFollowUpChat(q)}
                        disabled={isChatLoading}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="추천 검색어" icon="🔎">
                <BulletList items={analysisResult.searchLines} />
              </SectionCard>

              <SectionCard title="학습 확장 도구" icon="🚀">
                <div style={styles.toolGrid}>
                  <button
                    style={styles.toolButton}
                    onClick={handleQuiz}
                    disabled={isAnalyzing}
                  >
                    💡 퀴즈 만들기
                  </button>
                  <button
                    style={styles.toolButton}
                    onClick={handleFullSummary}
                    disabled={isAnalyzing}
                  >
                    📜 전체 요약
                  </button>
                  <button
                    style={styles.toolButton}
                    onClick={handleEvaluation}
                    disabled={isAnalyzing}
                  >
                    💯 나 어땠어?
                  </button>
                  <button
                    style={styles.toolButton}
                    onClick={handleTeacherComment}
                    disabled={isAnalyzing}
                  >
                    ✍️ 교과평어 만들기
                  </button>
                </div>
              </SectionCard>

              {analysisResult.quiz ? (
                <SectionCard title="퀴즈" icon="🎯">
                  <div style={styles.markdownBody}>
                    <ReactMarkdown>{analysisResult.quiz}</ReactMarkdown>
                  </div>
                </SectionCard>
              ) : null}

              {analysisResult.evaluation ? (
                <SectionCard title="학습 평가" icon="🌟">
                  <div style={styles.markdownBody}>
                    <ReactMarkdown>{analysisResult.evaluation}</ReactMarkdown>
                  </div>
                </SectionCard>
              ) : null}

              {analysisResult.teacher ? (
                <SectionCard
                  title="교과평어 예시"
                  icon="🧾"
                  actions={
                    <button
                      style={styles.smallButton}
                      onClick={async () => {
                        try {
                          await copyText(analysisResult.teacher);
                          alert('교과평어를 복사했어요.');
                        } catch (e) {
                          alert('복사에 실패했어요.');
                        }
                      }}
                    >
                      복사
                    </button>
                  }
                >
                  <div style={styles.markdownBody}>
                    <ReactMarkdown>{analysisResult.teacher}</ReactMarkdown>
                  </div>
                </SectionCard>
              ) : null}
            </div>

            <div style={styles.rightColumn}>
              <SectionCard title="후속 질문 대화창" icon="💬">
                <div style={styles.chatBox}>
                  {conversation.map((msg, idx) => (
                    <ChatBubble
                      key={`${msg.role}-${idx}-${msg.content.slice(0, 10)}`}
                      role={msg.role}
                      content={msg.content}
                    />
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                <div style={styles.chatInputArea}>
                  <textarea
                    ref={chatInputRef}
                    style={styles.chatTextarea}
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
                    style={styles.primaryButton}
                    onClick={() => handleFollowUpChat()}
                    disabled={isChatLoading}
                  >
                    {isChatLoading ? '답변 중...' : '질문 보내기'}
                  </button>
                </div>
              </SectionCard>

              <SectionCard title="활용 안내" icon="📌">
                <ul style={styles.guideList}>
                  <li>박물관 안내판, 전시 설명문, 조사자료를 붙여넣어 보세요.</li>
                  <li>먼저 쉬운 설명을 읽고, 핵심 개념과 낱말 풀이를 확인하세요.</li>
                  <li>탐구 질문 버튼을 눌러 후속 질문을 이어갈 수 있어요.</li>
                  <li>추천 검색어를 이용해 조사 범위를 넓혀 보세요.</li>
                  <li>교과평어 만들기 기능은 교사 참고용으로 활용할 수 있어요.</li>
                </ul>
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
    background:
      'linear-gradient(180deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%)',
    padding: '24px 16px 48px'
  },
  container: {
    maxWidth: 1280,
    margin: '0 auto'
  },
  hero: {
    textAlign: 'center',
    margin: '8px 0 24px'
  },
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
  heroTitle: {
    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
    margin: '0 0 8px',
    color: '#111827',
    fontWeight: 900
  },
  heroSubtitle: {
    margin: 0,
    color: '#4b5563',
    lineHeight: 1.7,
    fontSize: 'clamp(1rem, 2vw, 1.15rem)'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 0.9fr',
    gap: 20
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18
  },
  sectionCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
    overflow: 'hidden'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 18px',
    borderBottom: '1px solid #eef2f7',
    background: '#fcfcff'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#111827'
  },
  sectionBody: {
    padding: 18
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12
  },
  label: {
    fontWeight: 700,
    color: '#374151',
    fontSize: 14
  },
  input: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 15,
    outline: 'none'
  },
  select: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 15,
    outline: 'none',
    background: '#fff'
  },
  textarea: {
    width: '100%',
    minHeight: 220,
    border: '1px solid #cbd5e1',
    borderRadius: 14,
    padding: '14px 16px',
    fontSize: 15,
    lineHeight: 1.7,
    resize: 'vertical',
    outline: 'none'
  },
  primaryButtonRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap'
  },
  primaryButton: {
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    color: '#fff',
    fontWeight: 800,
    padding: '12px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(37,99,235,0.22)'
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontWeight: 700,
    padding: '12px 18px',
    borderRadius: 12,
    cursor: 'pointer'
  },
  smallButton: {
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    fontWeight: 700,
    padding: '8px 12px',
    borderRadius: 10,
    cursor: 'pointer'
  },
  markdownBody: {
    color: '#1f2937',
    lineHeight: 1.8,
    fontSize: 15
  },
  bulletList: {
    margin: 0,
    paddingLeft: 20,
    color: '#1f2937',
    lineHeight: 1.8
  },
  bulletItem: {
    marginBottom: 6
  },
  emptyText: {
    margin: 0,
    color: '#6b7280',
    lineHeight: 1.7
  },
  buttonWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14
  },
  questionButton: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '10px 12px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    textAlign: 'left'
  },
  toolGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10
  },
  toolButton: {
    border: '1px solid #dbeafe',
    background: '#f8fbff',
    color: '#1e3a8a',
    padding: '12px 14px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 800
  },
  chatBox: {
    height: 520,
    overflowY: 'auto',
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12
  },
  chatInputArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  chatTextarea: {
    width: '100%',
    minHeight: 90,
    maxHeight: 220,
    border: '1px solid #cbd5e1',
    borderRadius: 14,
    padding: '12px 14px',
    fontSize: 15,
    lineHeight: 1.6,
    resize: 'vertical',
    outline: 'none'
  },
  guideList: {
    margin: 0,
    paddingLeft: 20,
    color: '#374151',
    lineHeight: 1.9
  }
};

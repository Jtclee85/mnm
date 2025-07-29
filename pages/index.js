import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';
import Banner from '../components/Banner';

// [본문 요약 파싱 및 추천질문 구문 파싱 유틸]
const cleanContent = (text) => {
  if (!text) return '';
  const textWithoutRec = text.replace(/\[추천질문\].*?(\n|$)/g, '').trim();
  const summaryMatch = textWithoutRec.match(/<summary>([\s\S]*?)<\/summary>/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }
  return textWithoutRec;
};

const parseRecommendedQuestions = (content) => {
  // [추천질문] 태그 뒤의 줄을 각각 추출하여 배열로 만듦
  // 여러 블록이 있을 수 있으므로 모두 추출
  const regex = /\[추천질문\]([^\[\]]+)/g;
  let match, questions = [];
  while ((match = regex.exec(content)) !== null) {
    // 줄바꿈 기준 분리, 앞뒤 공백 및 불필요한 줄 제거
    const lines = match[1]
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .filter(l => l.length > 1); // 너무 짧은건 제거(옵션)
    questions.push(...lines);
  }
  // 혹시 ;, ·, • 등 기타 구분자 있는 경우도 추가 분리
  if (questions.length === 1 && /[·•;|]/.test(questions[0])) {
    return questions[0].split(/[·•;|]/).map(l => l.trim()).filter(Boolean);
  }
  return questions;
};

export default function Home() {
  const [conversationPhase, setConversationPhase] = useState('asking_topic');
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');

  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕? 나는 사회 조사학습을 도와주는 챗봇 [뭐냐면]이야. 오늘은 어떤 주제에 대해 조사해볼까?' }
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const [userEmoji, setUserEmoji] = useState('👤');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const createSystemMessage = (source) => ({
    role: 'system',
    content: `
너는 '뭐냐면'이라는 이름의 AI 챗봇이야. 너는 지금 초등 저학년 학생과 대화하고 있어.
너의 핵심 임무는 사용자가 제공한 아래의 [원본 자료]를 바탕으로, 사회과(역사, 지리, 일반사회 등) 개념을 쉽고 재미있게 설명해주는 것이야.

[원본 자료]
${source}
[/원본 자료]

**[꼭 지켜야 할 규칙]**
- **가장 중요한 규칙: 답변은 사용자가 제공한 [원본 자료]를 최우선으로 하되, 아이들의 이해를 돕기 위해 필요한 경우 너의 일반 지식을 활용하여 배경지식이나 쉬운 예시를 덧붙여 설명할 수 있어. 하지만 [원본 자료]와 전혀 관련 없는 이야기는 하지 마.**
- **말투:** 초등 저학년 학생이 이해할 수 있도록 쉬운 단어와 친절한 설명을 사용해야 해.
- **답변 형식:** 어려운 소제목 대신, '🗺️ 지도 이야기', '🏛️ 제도 이야기'처럼 내용과 관련된 재미있는 짧은 제목을 이모티콘과 함께 붙여줘.
- **추천 질문 생성:** 설명이 끝난 후, 다음 규칙에 따라 세 가지 수준의 추천 질문을 생성해야 해. 각 질문은 사용자가 더 깊이 탐구하도록 유도해야 하며, **반드시 [추천질문] 태그로 감싸서, 답변의 맨 마지막에 한 줄에 하나씩 제시해야 해.** 이 외의 다른 안내 문구는 절대 붙이지 마.

**[특별 기능 설명]**
사용자가 요청하면, 아래 규칙에 따라 행동해 줘.

1.  **'퀴즈풀기' 요청:** [원본 자료]와 대화 내용을 바탕으로 재미있는 퀴즈 1개를 내고, 친구의 다음 답변을 채점하고 설명해 줘.
2.  **'전체 요약' 요청:** 지금까지의 대화 전체 내용을 [조사 주제] 중심으로 요약해 줘.
3.  **'말풍선 3줄요약' 요청:** 특정 메시지 내용을 받으면, 그 내용을 3줄의 개조식으로 요약해.
4.  **'나 어땠어?' 요청:** 대화 내용을 바탕으로 학습 태도를 '최고야!', '정말 잘했어!', '좀 더 관심을 가져보자!' 중 하나로 평가하고 칭찬해 줘.
5.  **'교과평어 만들기' 요청:** 대화 내용 전체를 바탕으로, 학생의 탐구 과정, 질문 수준, 이해도, 태도 등을 종합하여 선생님께 제출할 수 있는 정성적인 '교과 세부능력 및 특기사항' 예시문을 '~~함.', '~~였음.'과 같이 간결한 개조식으로 작성해 줘.
      `
  });

  const processStreamedResponse = async (messageHistory, metadata = {}) => {
    setIsLoading(true);
    let messageIndex = -1;
    setMessages(prev => {
      const newMessages = [...prev, { role: 'assistant', content: '', metadata }];
      messageIndex = newMessages.length - 1;
      return newMessages;
    });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });
      if (!res.ok) { throw new Error(res.statusText); }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            setMessages(prev => {
              const newMessages = [...prev];
              newMessages[messageIndex].content += data;
              return newMessages;
            });
          }
        }
      }
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[messageIndex].content = "앗, 답변을 가져오는 데 문제가 생겼어요.";
        return newMessages;
      });
    } finally {
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content.includes('[추천질문]')) {
          const questions = parseRecommendedQuestions(lastMessage.content);
          if (questions.length > 0) {
            const updatedLastMessage = { ...lastMessage, metadata: { ...lastMessage.metadata, recommendedQuestions: questions } };
            return [...prev.slice(0, -1), updatedLastMessage];
          }
        }
        return prev;
      });
      setIsLoading(false);
    }
  };

  const fetchFullResponse = async (messageHistory) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });
      if (!res.ok) throw new Error(res.statusText);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            fullText += JSON.parse(line.substring(6));
          }
        }
      }
      return fullText;
    } catch (error) {
      console.error("전체 답변 요청 오류:", error);
      return "오류";
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input || isLoading) return;
    const userInput = input.trim();
    const userMsgForDisplay = { role: 'user', content: userInput };

    if (conversationPhase === 'asking_topic') {
      setMessages(prev => [...prev, userMsgForDisplay]);
      setInput('');
      setIsLoading(true);

      const topicExtractionPrompt = {
        role: 'system',
        content: `너는 사용자의 문장에서 '초등 사회과 조사학습'에 적합한 주제어만 추출하는 AI야.
- 주제어는 반드시 역사, 지리, 사회, 문화, 유물, 인물, 사건 등과 관련이 있어야 해.
- 만약 사용자의 문장에서 위 기준에 맞는 적절한 주제어를 찾았다면, 다른 말 없이 그 주제어만 정확히 출력해.
- 만약 사용자의 문장에 주제어가 없거나, 주제어가 있더라도 K-POP, 아이돌, 게임, 만화 등 사회과 학습과 관련 없는 내용이라면, '없음'이라고만 답해.
예시: "세종대왕에 대해 알려줘" -> "세종대왕"
예시: "블랙핑크가 누구야?" -> "없음"`
      };
      const extractedTopic = await fetchFullResponse([topicExtractionPrompt, { role: 'user', content: userInput }]);

      if (extractedTopic && !extractedTopic.includes('없음')) {
        setTopic(extractedTopic);

        const recommendation = `좋은 주제네! '${extractedTopic}'에 대해 알아보자.\n\n먼저, [Google에서 '${extractedTopic}' 검색해보기](https://www.google.com/search?q=${encodeURIComponent(extractedTopic)})를 눌러서 어떤 자료가 있는지 살펴보는 거야.\n\n**💡 좋은 자료를 고르는 팁!**\n* 주소가 **go.kr** (정부 기관)이나 **or.kr** (공공기관)로 끝나는 사이트가 좋아.\n* **네이버 지식백과**, **위키백과** 같은 유명한 백과사전도 믿을 만해!\n\n마음에 드는 자료를 찾으면, 그 내용을 복사해서 여기에 붙여넣어 줄래? 내가 쉽고 재미있게 설명해 줄게!`;

        setMessages(prev => [...prev, { role: 'assistant', content: recommendation }]);
        setConversationPhase('asking_source');

      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '미안하지만 조사하기에 적절한 주제가 아닌 거 같아. 다시 한번 알려줄래?'}]);
      }
      setIsLoading(false);
      return;
    }

    if (conversationPhase === 'asking_source') {
      setMessages(prev => [...prev, userMsgForDisplay]);
      setInput('');
      if (userInput.length < 50) {
        setMessages(prev => [...prev, { role: 'assistant', content: '앗, 그건 설명할 자료라기엔 너무 짧은 것 같아. 조사한 내용을 여기에 길게 붙여넣어 줄래?'}]);
        return;
      }
      setSourceText(userInput);
      const firstPrompt = { role: 'user', content: `이 자료에 대해 설명해줘: ${userInput}` };
      const systemMsg = createSystemMessage(userInput);
      processStreamedResponse([systemMsg, ...messages, userMsgForDisplay, firstPrompt]);
      setConversationPhase('chatting');
      return;
    }

        if (conversationPhase === 'chatting') {
        const newMsg = { role: 'user', content: userInput };
        setMessages(prev => [...prev, newMsg]);
        setInput('');
        setIsLoading(true); // AI가 응답 준비를 시작했음을 사용자에게 알립니다.

        // --- 1단계: 퀴즈 답변 상황인지 확인 (가장 먼저 처리) ---
        const lastAssistantMessage = messages[messages.length - 1];
        if (lastAssistantMessage?.role === 'assistant' && lastAssistantMessage?.metadata?.type === 'quiz') {
            const systemMsg = createSystemMessage(sourceText);
            // 퀴즈 답변이므로 관련성 검사 없이 바로 AI에게 채점을 요청합니다.
            await processStreamedResponse([systemMsg, ...messages, newMsg]);
            return;
        }

        // --- 2단계: 간단한 키워드로 관련성 확인 ---
        const lastMessageContent = lastAssistantMessage?.content || '';
        const userKeywords = userInput.replace(/[?.,!]/g, '').replace(/(은|는|이|가|에|의|께|서|랑|이랑|을|를|와|과|야|이야)\s/g, ' ').replace(/\s(뭐야|뭔데|알려줘|궁금해)/g, '').trim().split(' ');
        
        // 이전 챗봇 답변에 사용자 질문의 키워드가 하나라도 있으면 관련성이 높다고 판단합니다.
        const isHeuristicallyRelevant = userKeywords.some(keyword => lastMessageContent.includes(keyword));

        if (isHeuristicallyRelevant) {
            // 관련성이 높다고 판단되면, AI에게 바로 답변 생성을 요청합니다.
            const systemMsg = createSystemMessage(sourceText);
            await processStreamedResponse([systemMsg, ...messages, newMsg]);
            return;
        }

        // --- 3단계: AI에게 넓은 맥락의 관련성 확인 (최종 단계) ---
        const sourceSummary = sourceText.length > 300 ? sourceText.substring(0, 300) + "..." : sourceText;
        const relevanceCheckPrompt = {
            role: 'system',
            content: `너는 사용자의 질문이 **최초의 조사 주제**와 관련 있는지 판단하는 AI야. 대화가 다른 길로 새지 않도록 막는 것이 너의 가장 중요한 임무다.

- **최초 조사 주제**: '${topic}'
- **사용자가 제공한 원본 자료**: "${sourceSummary}"

사용자의 마지막 질문이 아래 기준에 부합하는지 판단해.
1. 질문이 **'${topic}'** 또는 **원본 자료의 내용**과 직접적으로 관련이 있는가?
2. 질문이 원본 자료에 나오진 않지만, **'${topic}'**을 이해하는 데 관련있는 단어, 배경지식, 인물, 장소, 관련 사건에 대한 것인가? (예: '불상'을 조사할 때 '조계사'를 묻는 것)

위 기준에 하나라도 해당하면 **'관련있음'**이라고만 답해.
만약 질문이 K-POP, 아이돌, 게임, 개인적인 친구 이야기, 욕설, 유행하는 meme 등 **'${topic}'**과 명백히 관련 없는 주제라면 **'관련없음'**이라고만 답해. 다른 설명은 절대 추가하지 마.`
        };

        const isRelevantResponse = await fetchFullResponse([relevanceCheckPrompt, newMsg]);

        if (isRelevantResponse.includes('관련없음')) {
            const irrelevantAnswer = {
                role: 'assistant',
                content: '미안하지만 그건 지금 우리가 이야기하는 사회 주제랑은 조금 다른 이야기 같아. 조사하고 있는 주제에 대해 더 궁금한 점을 물어봐 줄래?'
            };
            // setMessages를 한 번 더 호출하는 대신, 기존 메시지 배열을 직접 수정하여 상태를 업데이트합니다.
            setMessages(prev => [...prev, irrelevantAnswer]);
            setIsLoading(false);
        } else {
            // AI가 관련있다고 판단했으므로, 답변 생성을 요청합니다.
            const systemMsg = createSystemMessage(sourceText);
            await processStreamedResponse([systemMsg, ...messages, newMsg]);
        }
        return; // 모든 처리가 끝났으므로 함수를 종료합니다.
    }
  };

  const handleSpecialRequest = (userAction, prompt, metadata) => {
    if (isLoading) return;
    const userActionMsg = { role: 'user', content: userAction };
    setMessages(prev => [...prev, userActionMsg]);
    const newMsg = { role: 'user', content: prompt };
    const systemMsg = createSystemMessage(sourceText);
    processStreamedResponse([systemMsg, ...messages, userActionMsg, newMsg], metadata);
  };

  const handleRequestQuiz = () => handleSpecialRequest("💡 퀴즈 풀기", "지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.", { type: 'quiz' });
  const handleRequestFullSummary = () => handleSpecialRequest("📜 전체 요약", `지금까지 나눈 대화의 주제인 '${topic}'에 대해 전체 내용을 요약해 줘.`, { type: 'summary' });
  const handleRequestEvaluation = () => handleSpecialRequest("💯 나 어땠어?", "지금까지 나와의 대화, 질문 수준을 바탕으로 나의 학습 태도와 이해도를 '나 어땠어?' 기준에 맞춰 평가해 줘.", { type: 'evaluation' });
  const handleRequestTeacherComment = () => handleSpecialRequest("✍️ 내가 어땠는지 선생님께 알리기", "지금까지의 활동을 바탕으로 선생님께 보여드릴 '교과평어'를 만들어 줘.", { type: 'teacher_comment' });
  const handleBubbleSummary = (contentToSummarize) => handleSpecialRequest("💬 이 내용 3줄요약", `다음 내용을 3줄의 개조식으로 요약해줘: "${contentToSummarize}"`, { type: 'summary' });

  const handleRecommendedQuestionClick = (question) => {
    if (isLoading) return;
    const newMsg = { role: 'user', content: question };
    const systemMsg = createSystemMessage(sourceText);
    setMessages(prev => [...prev, newMsg]);
    processStreamedResponse([systemMsg, ...messages, newMsg]);
  };

  const handleCopy = async (text) => {
    const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
    const textToCopy = summaryMatch ? summaryMatch[1].trim() : text.trim();

    try {
      await navigator.clipboard.writeText(textToCopy);
      setMessages(prev => [...prev, { role: 'assistant', content: '클립보드에 복사되었습니다. 패들릿이나 띵커벨에 붙여넣어 보세요!'}]);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: '앗, 복사에 실패했어. 다시 시도해 줄래?'}]);
    }
  };

  // 전체 요약(3줄 개조식) 렌더링: summary 타입 메시지라면 자동 3줄로 쪼개서 불릿 출력
  const renderSummaryBulletList = (content) => {
    let pureText = content.replace(/<summary>([\s\S]*?)<\/summary>/g, "$1").trim();
    // 마침표/줄바꿈/불릿 등으로 최대 3줄로 자름
    let lines = pureText
      .replace(/^[•·]/gm, '')   // 기존 불릿 제거
      .split(/\r?\n|[•·]/g)
      .map(l => l.trim())
      .filter(Boolean);

    // . , ; 등으로 더 분리
    if (lines.length < 3) {
      lines = pureText
        .split(/[.;\n]/g)
        .map(l => l.trim())
        .filter(Boolean);
    }
    // 3줄 이상 나오면 3줄만
    lines = lines.slice(0, 3);

    // 혹시 1줄만 너무 길면 30~40자씩 잘라서라도 3줄 만듦
    if (lines.length === 1 && lines[0].length > 80) {
      const s = lines[0];
      lines = [s.slice(0, 40), s.slice(40, 80), s.slice(80)];
      lines = lines.filter(Boolean);
    }

    // 불릿 붙여서 리턴
    return (
      <ul style={{paddingLeft: '1.2em', margin:0}}>
        {lines.map((line, i) => <li key={i} style={{marginBottom:'0.2em'}}>{line}</li>)}
      </ul>
    );
  };

  const renderedMessages = messages.map((m, i) => {
    const content = m.content;
    const isUser = m.role === 'user';
    const speakerName = isUser ? '나' : '뭐냐면';
    const isNameVisible = i > 0;

    const profilePic = isUser ? (
      <div className="profile-pic">👤</div>
    ) : (
      <div className="profile-pic">
        <img src="/monyamyeon-logo.png" alt="뭐냐면 로고" />
      </div>
    );

    // summary 타입이면 3줄 불릿화
    const isSummary = m.metadata?.type === 'summary';

    return (
      <div key={i}>
        <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
          {!isUser && profilePic}
          <div className="message-content-container">
            {isNameVisible && <p className={`speaker-name ${isUser ? 'user-name' : 'assistant-name'}`}>{speakerName}</p>}
            <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
              {isSummary
                ? renderSummaryBulletList(content)
                : <ReactMarkdown
                    components={{
                      a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                      summary: ({children}) => <>{children}</>,
                    }}
                  >
                    {cleanContent(content)}
                  </ReactMarkdown>
              }
              {m.role === 'assistant' && !isLoading && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {cleanContent(m.content).length >= 300 && !m.metadata?.type && (
                       <button onClick={() => handleBubbleSummary(content)} className="btn btn-tertiary" style={{fontSize:'0.9rem'}}>💬 이 내용 3줄요약</button>
                  )}
                  {(m.metadata?.type === 'summary' || m.metadata?.type === 'teacher_comment') && (
                    <button onClick={() => handleCopy(content)} className="btn btn-tertiary">📋 복사하기</button>
                  )}
                  {m.metadata?.type === 'evaluation' && (
                    <button onClick={handleRequestTeacherComment} className="btn btn-tertiary">✍️ 내가 어땠는지 선생님께 알리기</button>
                  )}
                </div>
              )}
            </div>
          </div>
          {isUser && profilePic}
        </div>
        {/* 추천질문(버튼) */}
        {!isUser && !isLoading && m.metadata?.recommendedQuestions?.length > 0 && (
          <div style={{alignSelf: 'flex-start', marginTop: '13px', marginLeft: '54px', maxWidth: '85%'}}>
            {m.metadata.recommendedQuestions.map((q, index) => (
              <button key={index} onClick={() => handleRecommendedQuestionClick(q)} className="btn btn-tertiary"
                style={{margin: '4px', width: '100%', textAlign: 'left', justifyContent: 'flex-start'}}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  });

  return (
    <>
      <Head>
        <title>뭐냐면 - 조사학습 AI 챗봇</title>
        <meta name="description" content="처음 만나는 조사학습 AI 챗봇, 뭐냐면!" />
        <meta property="og:title" content="뭐냐면 - 사회 조사자료를 쉽고 재미있게 알려주는 AI 챗봇" />
        <meta property="og:description" content="사회 조사자료를 쉽고 재미있게 알려주주는 AI 챗봇, 뭐냐면!" />
        <meta property="og:image" content="https://mnm-kappa.vercel.app/preview.png" />
        <meta property="og:url" content="https://mnm-kappa.vercel.app" />
      </Head>

      <div style={{ maxWidth: 700, margin: '2rem auto', padding: 20 }}>
        <Banner />
        <div style={{
          display: 'flex', flexDirection: 'column',
          border: '1px solid #ddd', padding: '20px', height: '60vh',
          overflowY: 'auto', borderRadius: '8px', backgroundColor: '#EAE7DC'
        }}>
          {renderedMessages}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
          <textarea
            ref={inputRef}
            style={{
              padding: 10, minHeight: '60px', maxHeight: '200px',
              resize: 'vertical', overflowY: 'auto', fontSize: '1rem',
              lineHeight: '1.5', marginBottom: '0.5rem', border: '1px solid #ccc', borderRadius: '8px'
            }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              conversationPhase === 'asking_topic' ? "오늘은 어떤 주제에 대해 알아볼까?" :
              "추천받은 사이트에서 찾은 내용을 여기에 붙여넣어 줘!"
            }
            disabled={isLoading}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={sendMessage}
              disabled={isLoading}
              className="btn btn-primary"
            >
              보내기 📨
            </button>
            {conversationPhase === 'chatting' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                 <button onClick={handleRequestQuiz} disabled={isLoading} className="btn btn-tertiary">💡 퀴즈 풀기</button>
                 <button onClick={handleRequestFullSummary} disabled={isLoading} className="btn btn-tertiary">📜 전체 요약</button>
                 <button onClick={handleRequestEvaluation} disabled={isLoading} className="btn btn-tertiary">💯 나 어땠어?</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

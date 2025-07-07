


import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';
import Banner from '../components/Banner';

// 요약 및 추천질문 태그 제거 함수
const cleanContent = (text) => {
  // summary 태그 내용만 남기기 (복사 등에 사용)
  const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }
  // 추천질문 모두 제거
  return text.replace(/\[추천질문\].*?(\n|$)/g, '').trim();
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
  const [recommendedQuestions, setRecommendedQuestions] = useState([]);
  const [lastRecMessageIndex, setLastRecMessageIndex] = useState(-1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, recommendedQuestions]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  // [프롬프트 개선] - 한 질문당 한 태그, 줄바꿈, 개조식 요약
  const createSystemMessage = (source) => ({
    role: 'system',
    content: `
너는 '뭐냐면'이라는 이름의 AI 챗봇이야. 너는 지금 초등 저학년 학생과 대화하고 있어.
너의 핵심 임무는 사용자가 제공한 아래의 [원본 자료]를 바탕으로, 사회과(역사, 지리, 일반사회 등) 개념을 쉽고 재미있게 설명해주는 것이야.

[원본 자료]
${source}
[/원본 자료]

**[꼭 지켜야 할 규칙]**
- 답변은 [원본 자료]를 우선, 필요시 쉬운 예시나 배경 설명만 간략하게 추가해.
- 쉬운 단어, 친근한 말투를 써.
- 제목은 '🗺️ 지도 이야기', '🏛️ 제도 이야기'처럼 짧게, 재미있게 달아.
- **추천질문 생성:** 설명이 끝난 후, 반드시 아래 예시처럼 한 질문마다 [추천질문] 태그를 붙이고 줄바꿈해서 3개를 출력해.  
예시:
[추천질문]○○○란 무엇일까?
[추천질문]○○○는 왜 생겼을까?
[추천질문]○○○의 의미는 무엇일까?
절대로 한 태그에 여러 질문을 넣지 말고, 한 질문에 한 번씩만 [추천질문]을 붙여.  
쉼표, 엔터, 슬래시 없이 꼭 한 줄에 하나씩!
- [특별 기능] 요청 시, 규칙대로 행동해.

**[특별 기능 설명]**
1. '퀴즈풀기' 요청: 지금까지 대화를 바탕으로 퀴즈 1개 내고 채점, 해설.
2. '3줄요약' 요청: [원본 자료]의 핵심을 3줄의 개조식(-로 시작)으로 이어지는 요약글로 출력.  
반드시 <summary>와 </summary>로 감싸고, 절대 번호나 항목을 나누지 마.
3. '나 어땠어?' 요청: 학습 태도 평가. 기준에 따라 '최고야!', '잘했어!', '좀 더 관심을 가져보자!' 중 하나만 줘.
4. '교과평어 만들기' 요청: 2~3문장 개조식 평가. '~~함.', '~~였음.' 등 긍정적으로 <summary>로만 감싸서 출력.
`
  });

  // 답변 받아서 추천질문 분리
  const processStreamedResponse = async (messageHistory, metadata = {}) => {
    setIsLoading(true);
    setRecommendedQuestions([]);
    setLastRecMessageIndex(-1);
    setMessages(prev => [...prev, { role: 'assistant', content: '', metadata }]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });
      if (!res.ok) throw new Error(res.statusText);
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
              const lastMessage = prev[prev.length - 1];
              const updatedLastMessage = { ...lastMessage, content: lastMessage.content + data, metadata: lastMessage.metadata };
              return [...prev.slice(0, -1), updatedLastMessage];
            });
          }
        }
      }
    } catch (error) {
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        const updatedLastMessage = { ...lastMessage, content: "앗, 답변을 가져오는 데 문제가 생겼어요." };
        return [...prev.slice(0, -1), updatedLastMessage];
      });
    } finally {
      // 마지막 assistant 메시지에서 추천질문 추출(여러개면 분리)
      setMessages(prev => {
        const lastIdx = prev.length - 1;
        const lastMessage = prev[lastIdx];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content.includes('[추천질문]')) {
          const regex = /\[추천질문\](.*?)(?=\[추천질문\]|$)/gs;
          const questions = [];
          let match;
          while ((match = regex.exec(lastMessage.content)) !== null) {
            const questionText = match[1].replace(/\n/g, ' ').trim();
            if (questionText) questions.push(questionText);
          }
          if (questions.length > 0) {
            setRecommendedQuestions(questions);
            setLastRecMessageIndex(lastIdx);
          }
        }
        return prev;
      });
      setIsLoading(false);
    }
  };

  // 한 assistant 말풍선에 300자 넘으면 3줄요약 버튼
  const handleSummaryForMessage = (msg, idx) => {
    if (isLoading) return;
    // 해당 말풍선 내용으로 3줄 개조식 요약 요청
    handleSpecialRequest("📜 3줄요약", `<summary>\n- ${cleanContent(msg.content).replace(/\n/g, '\n- ')}\n</summary>`, { type: 'summary' });
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

  // 메시지 보내기
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
        content: `너는 사용자의 문장에서 핵심 주제어(고유명사, 인물, 사건 등)만 추출하는 AI야. 다른 말 없이, 핵심 주제어만 정확히 출력해. 만약 주제어가 없으면 '없음'이라고 답해.`
      };
      const extractedTopic = await fetchFullResponse([topicExtractionPrompt, { role: 'user', content: userInput }]);

      if (extractedTopic && !extractedTopic.includes('없음')) {
        setTopic(extractedTopic);
        const recommendation = `좋은 주제네! '${extractedTopic}'에 대해 알아보자.\n\n먼저, [Google에서 '${extractedTopic}' 검색해보기](https://www.google.com/search?q=${encodeURIComponent(extractedTopic)})를 눌러서 어떤 자료가 있는지 살펴보는 거야.\n\n**💡 좋은 자료를 고르는 팁!**\n* 주소가 **go.kr** (정부 기관)이나 **or.kr** (공공기관)로 끝나는 사이트가 좋아.\n* **네이버 지식백과**, **위키백과** 같은 유명한 백과사전도 믿을 만해!\n\n마음에 드는 자료를 찾으면, 그 내용을 복사해서 여기에 붙여넣어 줄래? 내가 쉽고 재미있게 설명해 줄게!`;
        setMessages(prev => [...prev, { role: 'assistant', content: recommendation }]);
        setConversationPhase('asking_source');
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '미안하지만 어떤 주제인지 잘 모르겠어. 다시 한번 알려줄래?'}]);
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
      const systemMsg = createSystemMessage(sourceText);
      setMessages(prev => [...prev, newMsg]);
      setInput('');
      processStreamedResponse([systemMsg, ...messages, newMsg]);
    }
  };

  // 퀴즈, 3줄요약, 평가, 평어 기능
  const handleSpecialRequest = (userAction, prompt, metadata) => {
    if (isLoading) return;
    const userActionMsg = { role: 'user', content: userAction };
    setMessages(prev => [...prev, userActionMsg]);
    const newMsg = { role: 'user', content: prompt };
    const systemMsg = createSystemMessage(sourceText);
    processStreamedResponse([systemMsg, ...messages, userActionMsg, newMsg], metadata);
  };
  const handleRequestQuiz = () => handleSpecialRequest("💡 퀴즈 풀기", "지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.", { type: 'quiz' });
  const handleRequestThreeLineSummary = () => handleSpecialRequest("📜 3줄요약", "내가 처음에 제공한 [원본 자료]의 가장 중요한 특징을 3줄의 개조식으로 요약해 줘. 반드시 <summary>로 감싸.", { type: 'summary' });
  const handleRequestEvaluation = () => handleSpecialRequest("💯 나 어땠어?", "지금까지 나와의 대화, 질문 수준을 바탕으로 나의 학습 태도와 이해도를 '나 어땠어?' 기준에 맞춰 평가해 줘.", { type: 'evaluation' });
  const handleRequestTeacherComment = () => handleSpecialRequest("✍️ 내가 어땠는지 선생님께 알리기", "지금까지의 활동을 바탕으로 선생님께 보여드릴 '교과평어'를 만들어 줘.", { type: 'teacher_comment' });

  const handleRecommendedQuestionClick = (question) => {
    if (isLoading) return;
    const newMsg = { role: 'user', content: question };
    setMessages(prev => [...prev, newMsg]);
    const systemMsg = createSystemMessage(sourceText);
    processStreamedResponse([systemMsg, ...messages, newMsg]);
  };

  const handleCopy = async (text) => {
    const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
    const textToCopy = summaryMatch ? summaryMatch[1].trim() : text.trim();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setMessages(prev => [...prev, { role: 'assistant', content: '클립보드에 복사되었습니다. 패들릿이나 띵커벨에 붙여넣어 보세요!'}]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '앗, 복사에 실패했어. 다시 시도해 줄래?'}]);
    }
  };

  // 메시지 렌더링 (3줄요약 버튼: assistant 말풍선 300자 이상)
  const renderedMessages = messages.map((m, i) => {
    const content = m.content;
    const isUser = m.role === 'user';
    const speakerName = isUser ? '나' : '뭐냐면';
    const isNameVisible = i > 0;
    const isAssistant = m.role === 'assistant';
    const profilePic = isUser ? (
      <div className="profile-pic">{userEmoji}</div>
    ) : (
      <div className="profile-pic">
        <img src="/monyamyeon-logo.png" alt="뭐냐면 로고" />
      </div>
    );

    return (
      <div key={i} className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
        {!isUser && profilePic}
        <div className="message-content-container">
          {isNameVisible && <p className={`speaker-name ${isUser ? 'user-name' : 'assistant-name'}`}>{speakerName}</p>}
          <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
            <ReactMarkdown
              components={{
                a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                summary: ({children}) => <>{children}</>,
              }}
            >
              {cleanContent(content)}
            </ReactMarkdown>
            {/* 3줄요약 버튼: assistant 말풍선에서만, 300자 이상 */}
            {isAssistant && !isLoading && cleanContent(content).length >= 300 && (
              <div style={{marginTop: 7}}>
                <button onClick={() => handleSummaryForMessage(m, i)} className="btn btn-tertiary" style={{fontSize:'0.98rem'}}>📜 이 내용 3줄요약</button>
              </div>
            )}
            {/* 평가/복사 등 기타 버튼 */}
            {isAssistant && !isLoading && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
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
        {/* 추천질문 버튼: assistant 말풍선 바로 아래, 가장 최근 메시지에만 */}
        {!isUser && !isLoading && recommendedQuestions.length > 0 && lastRecMessageIndex === i && (
          <div style={{alignSelf: 'flex-start', marginTop: '13px', marginLeft: '54px', maxWidth: '85%'}}>
            {recommendedQuestions.map((q, index) => (
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

  // 입력
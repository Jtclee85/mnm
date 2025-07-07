import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';
import Banner from '../components/Banner';

// summary 태그를 추출(3줄요약 복사 등), 추천질문은 버튼화 위해 별도로 다룸
const cleanContent = (text) => {
  const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }
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
    1.  **사실/개념 질문:** "그래서 OOO가 뭐야?" 와 같이 기본적인 내용을 묻는 질문.
    2.  **원인/분석 질문:** "왜 OOO는 그렇게 했을까?" 와 같이 이유나 과정을 묻는 질문.
    3.  **가치/평가 질문:** "OOO는 잘한 일일까?" 와 같이 생각이나 평가를 묻는 질문.

**[특별 기능 설명]**
사용자가 요청하면, 아래 규칙에 따라 행동해 줘. 모든 답변은 [원본 자료]와 대화 내용을 기반으로 해.

1.  **'퀴즈풀기' 요청:** 지금까지 나눈 대화를 바탕으로 재미있는 퀴즈 1개를 내고, 친구의 다음 답변을 채점하고 설명해 줘.
2.  3줄요약 요청: 조사 대상의 핵심 내용을 반드시 3줄, 각 줄마다 -로 시작하는 개조식 한 줄로 요약해줘. 자연스러운 문단이나 번호는 절대 사용하지 마. 반드시 <summary>와 </summary>로 감싸줘.
3.  **'나 어땠어?' 요청:** 대화 내용을 바탕으로 학습 태도를 평가한다. 평가 기준을 절대 너그럽게 해석하지 말고, 아래 조건에 따라 엄격하게 판단해야 해.
    - **'최고야!':** 배경, 가치, 인과관계, 다른 사건과의 비교 등 깊이 있는 탐구 질문을 2회 이상 했을 경우에만 이 평가를 내린다.
    - **'잘했어!':** 단어의 뜻이나 사실 관계 확인 등 단순한 질문을 주로 했지만, 꾸준히 대화에 참여했을 경우 이 평가를 내린다.
    - **'좀 더 관심을 가져보자!':** 질문이 거의 없거나 대화 참여가 저조했을 경우, 이 평가를 내리고 "다음에는 '왜 이런 일이 일어났을까?' 또는 '그래서 어떻게 됐을까?' 하고 물어보면 내용을 더 깊이 이해할 수 있을 거야!" 와 같이 구체적인 조언을 해준다.
4.  **'교과평어 만들기' 요청:** 대화 내용 전체를 바탕으로, 학생의 탐구 과정, 질문 수준, 이해도, 태도 등을 종합하여 선생님께 제출할 수 있는 정성적인 '교과 세부능력 및 특기사항' 예시문을 2~3문장으로 작성해 줘. **반드시 '~~함.', '~~였음.'과 같이 간결한 개조식으로 서술해야 해.** 학생의 장점이 잘 드러나도록 긍정적으로 서술해. **다른 말 없이, 순수한 평가 내용만 <summary> 태그로 감싸서 출력해.**
    `
  });

  // 핵심: assistant 메시지마다 추천질문 추출 후 metadata로 저장
  const processStreamedResponse = async (messageHistory, metadata = {}) => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', metadata }]);
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
              const lastMessage = prev[prev.length - 1];
              const updatedLastMessage = { ...lastMessage, content: lastMessage.content + data, metadata: lastMessage.metadata };
              return [...prev.slice(0, -1), updatedLastMessage];
            });
          }
        }
      }
    } catch (error) {
      console.error("스트리밍 오류:", error);
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        const updatedLastMessage = { ...lastMessage, content: "앗, 답변을 가져오는 데 문제가 생겼어요." };
        return [...prev.slice(0, -1), updatedLastMessage];
      });
    } finally {
      setMessages(prev => {
        // 마지막 assistant 메시지에서 추천질문 추출(여러개면 분리)
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
          // 추천질문을 metadata로 저장
          const updatedLastMessage = { ...lastMessage, metadata: { ...lastMessage.metadata, recommendedQuestions: questions } };
          return [...prev.slice(0, -1), updatedLastMessage];
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

  const handleSpecialRequest = (userAction, prompt, metadata) => {
    if (isLoading) return;
    const userActionMsg = { role: 'user', content: userAction };
    setMessages(prev => [...prev, userActionMsg]);
    const newMsg = { role: 'user', content: prompt };
    const systemMsg = createSystemMessage(sourceText);
    processStreamedResponse([systemMsg, ...messages, userActionMsg, newMsg], metadata);
  };

  const handleRequestQuiz = () => handleSpecialRequest("💡 퀴즈 풀기", "지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.", { type: 'quiz' });
  const handleRequestThreeLineSummary = () => handleSpecialRequest("📜 3줄요약", "내가 처음에 제공한 [원본 자료]의 가장 중요한 특징을 3줄 요약해 줘.", { type: 'summary' });
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
      console.error('클립보드 복사 실패:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: '앗, 복사에 실패했어. 다시 시도해 줄래?'}]);
    }
  };

  // ⭐⭐ 핵심: 각 assistant 메시지 아래에서 추천질문 표시 ⭐⭐
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

return (
  <div key={i} className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
    {!isUser && profilePic}
    <div className="message-content-container">
      {isNameVisible && <p ...>{speakerName}</p>}
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        <ReactMarkdown ...>{cleanContent(content)}</ReactMarkdown>
        {/* 기타 버튼 */}
        {m.role === 'assistant' && ...}
        {/* ⭐ 추천질문 버튼: 말풍선 내부 하단에! */}
        {!isUser && m.metadata?.recommendedQuestions && m.metadata.recommendedQuestions.length > 0 && (
          <div style={{ marginTop: '16px', width: '100%' }}>
            {m.metadata.recommendedQuestions.map((q, idx) => (
              <button key={idx} onClick={() => handleRecommendedQuestionClick(q)} className="btn btn-tertiary"
                style={{ margin: '4px 0', width: '100%', textAlign: 'left', justifyContent: 'flex-start' }}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
        {isUser && profilePic}
        {/* 각 assistant 답변별 추천질문 버튼(있을 때만) */}
        {!isUser && m.metadata?.recommendedQuestions && m.metadata.recommendedQuestions.length > 0 && (
          <div style={{alignSelf: 'flex-start', marginTop: '13px', marginLeft: '54px', maxWidth: '85%'}}>
            {m.metadata.recommendedQuestions.map((q, idx) => (
              <button key={idx} onClick={() => handleRecommendedQuestionClick(q)} className="btn btn-tertiary"
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
        <title>뭐냐면 - 사회과 AI 챗봇</title>
        <meta name="description" content="초등학생을 위한 사회과 자료를 친절하게 쉽게 설명해주는 AI 챗봇, 뭐냐면!" />
        <meta property="og:title" content="뭐냐면 - 사회과 자료를 쉽게 풀어주는 AI 챗봇" />
        <meta property="og:description" content="초등학생을 위한 사회과 자료를 친절하게 쉽게 설명해주는 AI 챗봇, 뭐냐면!" />
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
          {/* 버튼 구조 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={sendMessage}
              disabled={isLoading}
              className="btn btn-primary"
            >
              보내기 📨
            </button>
            {conversationPhase === 'chatting' && messages.length > 2 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                 <button onClick={handleRequestQuiz} disabled={isLoading} className="btn btn-tertiary">💡 퀴즈 풀기</button>
                 <button onClick={handleRequestThreeLineSummary} disabled={isLoading} className="btn btn-tertiary">📜 3줄요약</button>
                 <button onClick={handleRequestEvaluation} disabled={isLoading} className="btn btn-tertiary">💯 나 어땠어?</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

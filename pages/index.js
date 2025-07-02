import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';

const cleanContent = (text) => {
  return text.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
};

export default function Home() {
  // ✨ [수정됨] 대화 단계 및 사용자 정보 상태 추가
  const [conversationPhase, setConversationPhase] = useState('asking_name'); // asking_name, asking_level, chatting
  const [userName, setUserName] = useState('');
  const [userLevel, setUserLevel] = useState('');

  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕, 친구! 나는 역사 이야기를 재미있게 들려주는 [뭐냐면]이야. 만나서 반가워! 네 이름은 뭐니?' }
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showExtraFeatures, setShowExtraFeatures] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const speakText = (text) => {
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const childlikeVoice = voices.find(voice =>
      voice.lang === 'ko-KR' && (voice.name.includes('Google') || voice.name.includes('Microsoft'))
    );
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.pitch = 1.2;
    utterance.rate = 1.0;
    if (childlikeVoice) utterance.voice = childlikeVoice;
    window.speechSynthesis.speak(utterance);
  };
  
  const processStreamedResponse = async (messageHistory) => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
              const updatedLastMessage = { ...lastMessage, content: lastMessage.content + data };
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
      setIsLoading(false);
    }
  };

  // ✨ [수정됨] 대화 단계를 관리하는 핵심 함수
  const sendMessage = async () => {
    if (!input || isLoading) return;

    if (conversationPhase === 'asking_name') {
      const name = input.trim();
      setUserName(name);
      setMessages(prev => [...prev, { role: 'user', content: name }]);
      setInput('');
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: `만나서 반가워, ${name}! 나는 네 나이에 맞춰서 더 재미있게 설명해 줄 수 있어. 혹시 몇 학년이야? 아래에서 골라줄래?` }]);
        setConversationPhase('asking_level');
      }, 500);
      return;
    }

    if (conversationPhase === 'chatting') {
      const newMsg = { role: 'user', content: input };
      const updatedMessages = [...messages, newMsg];
      
      const systemMsg = createSystemMessage(userName, userLevel);
      setMessages(updatedMessages);
      setInput('');
      processStreamedResponse([systemMsg, ...updatedMessages]);
    }
  };
  
  // ✨ [추가됨] 학년 선택 처리 함수
  const handleLevelSelect = (level) => {
    setUserLevel(level);
    setMessages(prev => [...prev, { role: 'user', content: level }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: `알려줘서 고마워! 그럼 지금부터 ${userName} (${level}) 친구를 위한 맞춤 역사 여행을 시작해 볼게. 궁금한 걸 알려주면, 내가 아는 모든 걸 쉽고 재미있게 설명해 줄게!` }]);
      setConversationPhase('chatting');
    }, 500);
  };
  
  // ✨ [추가됨] 동적 시스템 프롬프트 생성 함수
  const createSystemMessage = (name, level) => {
    const levelDescription = {
      '유치원생': "유치원생도 이해할 수 있도록 아주 아주 쉬운 단어와 짧은 문장",
      '초등 저학년': "초등 저학년 학생이 이해할 수 있도록 쉬운 단어와 친절한 설명",
      '초등 고학년': "초등 고학년 학생의 지적 호기심을 채워줄 수 있도록 조금 더 상세한 정보와 배경 설명"
    };

    return {
      role: 'system',
      content: `
너는 '뭐냐면'이라는 이름의 AI 챗봇이야. 너는 지금 '${name}'이라는 이름의 '${level}' 친구와 대화하고 있어.
역사 이야기를 재미있게 들려주는 역할을 해.

**[꼭 지켜야 할 규칙]**
- **말투:** ${levelDescription[level] || '초등학생 눈높이'}에 맞춰 친절하고 다정한 말투를 사용해.
- **답변 형식:** 어려운 소제목 대신, '👑 왕관 이야기', '⚔️ 칼 이야기'처럼 내용과 관련된 재미있는 이모티콘과 함께 짧은 제목을 붙여줘.
- **질문 유도:** 설명이 끝나면, 아이들이 더 궁금해할 만한 질문을 "혹시 이런 것도 궁금해?" 하고 물어봐 줘.
- **추가 정보:** 설명의 마지막에는, "[Google에서 '핵심주제' 더 찾아보기](https://www.google.com/search?q=핵심주제)" 링크를 달아서 더 찾아볼 수 있게 도와줘.

**[특별 기능 설명]**
사용자가 요청하면, 아래 규칙에 따라 행동해 줘.

1.  **'퀴즈풀기' 요청:** 지금까지 나눈 대화를 바탕으로 재미있는 퀴즈 1개를 내고, 친구의 다음 답변을 채점하고 설명해 줘.
2.  **'3줄요약' 요청:** 대화 초반의 '조사 대상'에 대한 핵심 특징 3가지를 15자 내외의 짧은 구절로 요약해 줘.
3.  **'나 어땠어?' 요청:** 대화 내용을 바탕으로 학습 태도를 '최고야!', '정말 잘했어!', '조금만 더 힘내자!' 중 하나로 평가하고 칭찬해 줘.
      `
    };
  };

  const handleSpecialRequest = (prompt, userMessage) => {
    if (isLoading) return;
    setMessages(prev => [...prev, { role: 'assistant', content: userMessage }]);
    const newMsg = { role: 'user', content: prompt };
    const systemMsg = createSystemMessage(userName, userLevel);
    processStreamedResponse([systemMsg, ...messages, newMsg]);
  };
  
  const handleRequestQuiz = () => handleSpecialRequest("지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.", "좋아! 그럼 지금까지 배운 내용으로 퀴즈를 내볼게.");
  const handleRequestThreeLineSummary = () => handleSpecialRequest("지금까지의 대화 내용을 바탕으로, 보고서에 쓸 3줄 요약을 만들어 줘.", "알았어. 지금까지 나눈 이야기를 딱 3가지로 요약해 줄게!");
  const handleRequestEvaluation = () => handleSpecialRequest("지금까지 나와의 대화, 질문 수준을 바탕으로 나의 학습 태도와 이해도를 '나 어땠어?' 기준에 맞춰 평가해 줘.", "응. 지금까지 네가 얼마나 잘했는지 알려줄게!");

  const renderedMessages = messages.map((m, i) => {
    const content = m.content;
    const messageBoxStyle = {
      backgroundColor: m.role === 'user' ? '#e6f3ff' : '#f7f7f8',
      padding: '10px 15px', borderRadius: '15px', maxWidth: '80%',
      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
      whiteSpace: 'pre-wrap', fontSize: '1rem', lineHeight: '1.6',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    };
    return (
      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: messageBoxStyle.alignSelf }}>
        <div style={messageBoxStyle}>
          <ReactMarkdown
            components={{
              a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />
            }}
          >
            {cleanContent(content)}
          </ReactMarkdown>
          {m.role === 'assistant' && !isLoading && <button
            onClick={() => speakText(content)}
            style={{
              marginTop: 10, fontSize: '1rem', padding: '6px 14px', borderRadius: '4px',
              background: '#fffbe8', border: '1px solid #fdd835', color: '#333',
              fontFamily: 'Segoe UI, sans-serif', fontWeight: 'bold', cursor: 'pointer'
            }}
          >🔊</button>
          }
        </div>
      </div>
    );
  });

  // ✨ [추가됨] 입력창 UI를 대화 단계에 따라 다르게 보여주는 로직
  const renderInputField = () => {
    if (conversationPhase === 'asking_level') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: 10 }}>
          <button onClick={() => handleLevelSelect('유치원생')} style={{padding: '10px', fontSize: '1rem'}}>유치원생</button>
          <button onClick={() => handleLevelSelect('초등 저학년')} style={{padding: '10px', fontSize: '1rem'}}>초등 저학년</button>
          <button onClick={() => handleLevelSelect('초등 고학년')} style={{padding: '10px', fontSize: '1rem'}}>초등 고학년</button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
        <textarea
          ref={inputRef}
          style={{
            padding: 10, minHeight: '60px', maxHeight: '200px',
            resize: 'vertical', overflowY: 'auto', fontSize: '1rem',
            lineHeight: '1.5', marginBottom: '0.5rem', fontFamily: 'Segoe UI, sans-serif'
          }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={conversationPhase === 'asking_name' ? "너의 이름은 뭐니?" : "메시지를 입력하거나 퀴즈의 정답을 입력하세요..."}
          disabled={isLoading}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={sendMessage}
            disabled={isLoading}
            style={{
              flex: 1, padding: '10px', fontSize: '1rem', borderRadius: '6px',
              backgroundColor: isLoading ? '#e0e0e0' : '#FDD835', fontWeight: 'bold',
              color: 'black', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'Segoe UI, sans-serif'
            }}
          >
            보내기
          </button>
          {conversationPhase === 'chatting' && messages.length > 6 && (
            <button
              onClick={() => setShowExtraFeatures(!showExtraFeatures)}
              disabled={isLoading}
              style={{
                padding: '10px', fontSize: '1rem', borderRadius: '6px',
                backgroundColor: isLoading ? '#e0e0e0' : '#6c757d', fontWeight: 'bold',
                color: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'Segoe UI, sans-serif'
              }}
            >
              {showExtraFeatures ? '기능 숨기기 ▲' : '더 많은 기능 보기 📚'}
            </button>
          )}
        </div>
        {showExtraFeatures && conversationPhase === 'chatting' && messages.length > 6 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
             <button onClick={handleRequestQuiz} disabled={isLoading} style={{padding: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px'}}>퀴즈 풀기</button>
             <button onClick={handleRequestThreeLineSummary} disabled={isLoading} style={{padding: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px'}}>3줄요약</button>
             <button onClick={handleRequestEvaluation} disabled={isLoading} style={{padding: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px'}}>나 어땠어?</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>뭐냐면 - 초등 역사 유적·사건 자료를 쉽게 풀어주는 AI 챗봇</title>
        <meta name="description" content="초등학생을 위한 역사·유적·사건을 친절하게 쉽게 설명해주는 AI 챗봇, 뭐냐면!" />
        <meta property="og:title" content="뭐냐면 - 초등 역사 유적·사건 자료를 쉽게 풀어주는 AI 챗봇" />
        <meta property="og:description" content="초등학생을 위한 역사·유적·사건을 친절하게 쉽게 설명해주는 AI 챗봇, 뭐냐면!" />
        <meta property="og:image" content="https://mnm-kappa.vercel.app/preview.png" />
        <meta property="og:url" content="https://mnm-kappa.vercel.app" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="뭐냐면 - 초등 역사 유적·사건 자료를 쉽게 풀어주는 AI 챗봇" />
        <meta name="twitter:description" content="초등학생을 위한 역사·유적·사건을 친절하게 쉽게 설명해주는 AI 챗봇, 뭐냐면!" />
        <meta name="twitter:image" content="https://mnm-kappa.vercel.app/preview.png" />
      </Head>

      <div style={{ maxWidth: 700, margin: '2rem auto', padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>뭐냐면</h1>
          <p style={{ fontSize: '1rem', color: '#666', margin: 0 }}>
            초등 역사 유적·사건·인물 자료를 쉽게 풀어주는 AI 챗봇
          </p>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
          border: '1px solid #ccc', padding: 10, height: '60vh',
          overflowY: 'auto', borderRadius: '8px', backgroundColor: '#fff'
        }}>
          {renderedMessages}
          <div ref={bottomRef} />
        </div>
        {renderInputField()}
      </div>
    </>
  );
}

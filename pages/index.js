import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';

const cleanContent = (text) => {
  return text.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
};

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요. 역사적 인물, 사건, 유적을 쉽게 풀어 설명해주는 [뭐냐면]입니다. 조사한 자료를 붙여넣기 해주시면 친절하고 쉽게 설명해드릴게요.' }
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
    utterance.pitch = 1.0;
    utterance.rate = 1.1;
    if (childlikeVoice) utterance.voice = childlikeVoice;
    window.speechSynthesis.speak(utterance);
  };
  
  // ✨ [수정됨] 3줄 요약 규칙 강화 및 마무리 질문 제거
  const systemMsg = {
    role: 'system',
    content: `
당신은 '뭐냐면'이라는 이름의 AI 챗봇입니다. 초등학생을 위해 역사 개념을 쉽고 명확하게 설명합니다. 다음 규칙을 반드시 지켜야 합니다.
- 설명은 초등학생 눈높이에서 친절하고 부드러운 말투를 사용합니다.
- 답변을 제공할 때는, 핵심 내용을 중심으로 소제목(###)을 붙여 항목화하고, 소제목 바로 다음 줄에 공백 없이 본문 내용을 이어서 설명합니다.
- 관련 없는 질문에는 "나는 역사에 대해서만 도와줄 수 있어."라고 대답합니다.
- 답변의 마지막에는, "이런 점도 궁금하지 않니?" 라는 문구와 함께, 학생이 추가적으로 할 법한 심화 질문 2개를 > (인용 블록) 형식으로 제시합니다.
- 설명의 마지막에는, 사용자가 더 깊이 탐색할 수 있도록 "[Google에서 '핵심주제' 더 찾아보기](https://www.google.com/search?q=핵심주제)" 형식의 링크를 항상 포함합니다.

※ 특별 기능 - '퀴즈풀기', '3줄요약', '나 어땠어?':
사용자가 아래 기능 중 하나를 요청하면, 그에 맞는 답변을 생성합니다.

1. '퀴즈풀기' 요청 시:
   - 대화 내용을 바탕으로 객관식 퀴즈 1개를 출제하고, 사용자의 다음 답변을 채점한 후 해설을 제공합니다. (문제, 보기 4개, 정답, 해설 포함)

2. '3줄요약' 요청 시:
   - 지금까지의 대화 내용을 바탕으로, 학교 보고서에 사용할 수 있도록 핵심 내용만 간추려 **각 줄이 15자 내외의 짧은 핵심 구절로 구성된, 총 3줄의 개조식 요약**을 생성합니다.

3. '나 어땠어?' 요청 시:
   - 지금까지의 대화 내용, 질문의 수준, 퀴즈 결과(있을 경우)를 종합적으로 분석하여 사용자의 학습 태도와 이해도를 평가합니다.
   - 평가는 '잘함', '보통', '노력요함' 3단계로 내리며, 아래 기준을 엄격하게 적용합니다.
     - 잘함: 역사적 배경이나 가치 등 탐구적 질문이 3회 이상인 경우.
     - 보통: 단어 뜻, 사실 확인 등 단순 질문 위주인 경우.
     - 노력요함: 질문이 거의 없거나, 대화에 소극적인 경우.
   - 평가 결과와 함께 칭찬이나 격려가 담긴 짧은 코멘트를 덧붙여줍니다.
    `
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

  const sendMessage = async () => {
    if (!input || isLoading) return;
    const newMsg = { role: 'user', content: input };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInput('');
    processStreamedResponse([systemMsg, ...updatedMessages]);
  };
  
  const handleSpecialRequest = (prompt, userMessage) => {
    if (isLoading) return;
    setMessages(prev => [...prev, { role: 'assistant', content: userMessage }]);
    const newMsg = { role: 'user', content: prompt };
    processStreamedResponse([systemMsg, ...messages, newMsg]);
  };
  
  const handleRequestQuiz = () => handleSpecialRequest("지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.", "좋아! 그럼 지금까지 배운 내용으로 퀴즈를 내볼게.");
  const handleRequestThreeLineSummary = () => handleSpecialRequest("지금까지의 대화 내용을 바탕으로, 보고서에 쓸 3줄 요약을 만들어 줘.", "알았어. 지금까지 나눈 대화를 3줄로 요약해 줄게!");
  const handleRequestEvaluation = () => handleSpecialRequest("지금까지 나와의 대화, 질문 수준을 바탕으로 나의 학습 태도와 이해도를 '나 어땠어?' 기준에 맞춰 평가해 줘.", "응. 지금까지의 대화 내용을 바탕으로 너의 학습 과정을 평가해 줄게.");


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
            placeholder="메시지를 입력하거나 퀴즈의 정답을 입력하세요..."
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
            {messages.length > 6 && (
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
          {showExtraFeatures && messages.length > 6 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
               <button onClick={handleRequestQuiz} disabled={isLoading} style={{padding: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px'}}>퀴즈 풀기</button>
               <button onClick={handleRequestThreeLineSummary} disabled={isLoading} style={{padding: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px'}}>3줄요약</button>
               <button onClick={handleRequestEvaluation} disabled={isLoading} style={{padding: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '5px'}}>나 어땠어?</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

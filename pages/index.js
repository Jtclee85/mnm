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
  
  // ✨ [추가됨] '더 많은 기능' 메뉴 표시 여부 상태
  const [showExtraFeatures, setShowExtraFeatures] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const inputRef = useRef(null);

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
  
  // ✨ [수정됨] 새로운 기능 규칙이 추가된 시스템 프롬프트
  const systemMsg = {
    role: 'system',
    content: `당신은 '뭐냐면'이라는 이름의 AI 챗봇입니다. 초등학생을 위해 역사 개념을 쉽고 명확하게 설명합니다. 다음 규칙을 반드시 지켜야 합니다.
- 설명은 초등학생 눈높이에서 친절하고 부드러운 말투를 사용합니다.
- 답변을 제공할 때는, 핵심 내용을 중심으로 소제목(###)을 붙여 항목화하고, 각 항목은 2~3문장으로 간결하게 설명하여 가독성을 높입니다.
- 관련 없는 질문에는 "나는 역사에 대해서만 도와줄 수 있어."라고 대답합니다.
- 대화의 끝 부분에는 '더 궁금한 게 있니? 아니면 이제 그만할까?'를 물어봅니다.

- **답변의 마지막에는, "이런 점도 궁금하지 않니?" 라는 문구와 함께, 학생이 추가적으로 할 법한 심화 질문 2개를 > (인용 블록) 형식으로 제시합니다. 예시: > 반가사유상의 치마에 대해 좀 더 알려줘.**
- 설명의 마지막에는, 사용자가 더 깊이 탐색할 수 있도록 "[Google에서 '핵심주제' 더 찾아보기](https://www.google.com/search?q=핵심주제)" 형식의 링크를 항상 포함합니다. 여기서 '핵심주제'는 해당 답변의 가장 중요한 키워드로 대체해야 합니다.

※ 특별 기능 1 - 학습 평가 및 보고서 생성:
학생이 '그만할게요' 등 대화 종료를 표현하면, 다음 기준에 따라 평가하고 보고서를 작성합니다.
1. 평가 (엄격하게 적용): '잘함'(탐구 질문 3개 이상), '보통'(단순 질문 1-2개), '노력 요함'(질문 거의 없음).
2. 보고서 작성 (간결한 개조식): 조사 대상 정보, 학생 이해도 요약, 격려 멘트 포함.

※ 특별 기능 2 - 학습 퀴즈 생성:
사용자가 "퀴즈를 만들어 줘" 또는 이와 유사한 요청을 하면, 다음의 체계적인 순서에 따라 퀴즈 1개를 생성하고 채점한다.
1. 출제: 대화 내용 기반으로 객관식 퀴즈 1개를 만든다.
2. 정답 결정: 먼저 정답이 될 보기와 그에 대한 명확한 해설을 내부적으로 결정한다.
3. 오답 생성: 결정된 정답과 관련 있는 그럴듯한 오답 보기 3개를 만든다.
4. 최종 출력: 위 내용을 바탕으로 문제, 4개의 보기(①, ②, ③, ④)를 사용자에게 보여준다.
5. 채점: 사용자의 다음 답변을 받으면, 이전에 결정했던 정답과 비교하여 채점하고 해설을 제공한다. 이 과정에서 절대 정답을 혼동해서는 안 된다.

※ 특별 기능 3 - 대화 내용 요약:
사용자가 "지금까지 대화 내용 요약해 줘" 요청을 하면, 현재까지의 대화 전체를 바탕으로 핵심 주제와 주요 설명 내용을 3~4문장으로 간결하게 요약해서 보여준다.

※ 특별 기능 4 - 보고서용 자료 만들기:
사용자가 "보고서용 자료 만들어 줘" 요청을 하면, 지금까지의 대화 내용을 바탕으로 학교 과제 보고서에 사용하기 좋도록 다음 구조에 맞춰 개조식으로 정리하여 제공한다.
- 주제: [핵심 주제]
- 핵심 내용:
  - [내용 1]
  - [내용 2]
  - [내용 3]
- 보충 설명: [추가적으로 알게 된 사실이나 중요한 포인트]
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
  
  // ✨ [추가됨] 각 기능 버튼에 연결될 요청 함수들
  const handleSpecialRequest = (prompt, userMessage) => {
    if (isLoading) return;
    setMessages(prev => [...prev, { role: 'assistant', content: userMessage }]);
    const newMsg = { role: 'user', content: prompt };
    processStreamedResponse([systemMsg, ...messages, newMsg]);
  };
  
  const handleRequestQuiz = () => handleSpecialRequest("지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.", "좋아! 그럼 지금까지 배운 내용으로 퀴즈를 내볼게.");
  const handleRequestSummary = () => handleSpecialRequest("지금까지의 대화 내용을 초등학생이 이해하기 쉽게 3~4문장으로 요약해 줘.", "알았어. 지금까지 나눈 대화를 요약해 줄게!");
  const handleRequestReport = () => handleSpecialRequest("지금까지의 대화 내용을 바탕으로, 학교에 제출할 보고서 형식에 맞게 개조식으로 요약해 줘.", "응. 지금까지 대화한 내용으로 보고서를 쓰기 좋게 정리해 줄게.");


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
          <ReactMarkdown>{cleanContent(content)}</ReactMarkdown>
          {m.role === 'assistant' && !isLoading && <button
            onClick={() => speakText(content)}
            style={{
              marginTop: 10, fontSize: '1rem', padding: '6px 14px', borderRadius: '4px',
              background: '#fffbe8', border: '1px solid #fdd835', color: '#333',
              fontFamily: 'Segoe UI, sans-serif', fontWeight: 'bold', cursor: 'pointer'
            }}
          >🔊 읽어주기</button>
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
          {/* ✨ [수정됨] 버튼 영역 전체 구조 변경 */}
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
               <button onClick={handleRequestSummary} disabled={isLoading} style={{padding: '8px', cursor: isLoading ? 'not-allowed' : 'pointer'}}>대화 요약</button>
               <button onClick={handleRequestQuiz} disabled={isLoading} style={{padding: '8px', cursor: isLoading ? 'not-allowed' : 'pointer'}}>퀴즈 풀기</button>
               <button onClick={handleRequestReport} disabled={isLoading} style={{padding: '8px', cursor: isLoading ? 'not-allowed' : 'pointer'}}>보고서 요약</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

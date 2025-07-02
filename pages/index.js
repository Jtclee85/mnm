import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';

// 줄바꿈 등 불필요한 공백 제거 함수
const cleanContent = (text) => {
  return text.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
};

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요. 역사적 인물, 사건, 유적을 쉽게 풀어 설명해주는 [뭐냐면]입니다. 조사한 자료를 붙여넣기 해주시면 친절하고 쉽게 설명해드릴게요.' }
  ]);
  const [input, setInput] = useState('');
  const bottom = useRef();
  const [isLoading, setIsLoading] = useState(false); // 스트리밍 중인지 확인하는 상태

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
  
  const systemMsg = {
    role: 'system',
    content: `
당신은 '뭐냐면'이라는 이름의 AI 챗봇입니다. 초등학생을 위해 역사 개념을 쉽고 명확하게 설명합니다. 다음 규칙을 반드시 지켜야 합니다.
- 설명은 초등학생 눈높이에서 친절하고 부드러운 말투를 사용합니다.
- 단락을 나눠 간결하게 설명하고, 어려운 한자어는 쉽게 풀이합니다.
- 관련 없는 질문에는 "나는 역사에 대해서만 도와줄 수 있어."라고 대답합니다.
- 대화의 끝에는 '더 궁금한 게 있니? 아니면 이제 그만할까?'를 물어봅니다.

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
    `
  };

  // ✨ [수정됨] 스트리밍 데이터 처리를 위한 단일 API 호출 함수
  const processStreamedResponse = async (messageHistory) => {
    setIsLoading(true);

    // 먼저 비어있는 assistant 메시지 추가
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });

      if (!res.ok) {
        throw new Error(res.statusText);
      }

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

  const handleRequestQuiz = async () => {
    if (isLoading) return;
    const quizPrompt = "지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.";
    
    const newMsg = { role: 'user', content: quizPrompt };
    const updatedMessages = [...messages, newMsg];
    
    // 퀴즈 요청 메시지는 화면에 표시하지 않음
    setMessages(prev => [...prev, {role: 'assistant', content: "좋아! 퀴즈를 하나 내볼게. 잘 맞춰봐!"}]);
    
    processStreamedResponse([systemMsg, ...updatedMessages]);
  };

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
              marginTop: 5, fontSize: '1rem', padding: '6px 14px', borderRadius: '4px',
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
        {/* ... (기존 메타 태그들은 그대로 유지) ... */}
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
          <div ref={bottom} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
          <textarea
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
                flex: 1, padding: '10px', fontSize: '1rem',
                borderRadius: '6px', backgroundColor: isLoading ? '#e0e0e0' : '#FDD835',
                fontWeight: 'bold', color: 'black', border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'Segoe UI, sans-serif'
              }}
            >
              보내기
            </button>
            <button
              onClick={handleRequestQuiz}
              disabled={isLoading || messages.length <= 3}
              style={{
                padding: '10px', fontSize: '1rem', borderRadius: '6px',
                backgroundColor: (isLoading || messages.length <= 3) ? '#e0e0e0' : '#4CAF50',
                fontWeight: 'bold', color: 'white', border: 'none',
                cursor: (isLoading || messages.length <= 3) ? 'not-allowed' : 'pointer',
                fontFamily: 'Segoe UI, sans-serif'
              }}
            >퀴즈 풀기</button>
          </div>
        </div>
      </div>
    </>
  );
}

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const cleanContent = (text) => {
  return text.replace(/\n{3,}/g, '\n'); // 2개 이상의 줄바꿈 → 1개로
};

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요. 역사적 인물, 사건, 유적을 쉽게 풀어 설명해주는 [뭐냐면]입니다. 조사한 자료를 붙여넣기 해주시면 친절하고 쉽게 설명해드릴게요.' }
  ]);
  const [input, setInput] = useState('');
  const bottom = useRef();
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [loadingInterval, setLoadingInterval] = useState(null);
  const [typedText, setTypedText] = useState('');
  const loadingMessages = ['그게 뭐냐면...', '생각중이니 잠깐만요...'];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typedText]);

  const typeEffect = (text) => {
    let i = 0;
    const speed = 50;
    const type = () => {
      if (i <= text.length) {
        setTypedText(text.slice(0, i));
        i++;
        setTimeout(type, speed);
      }
    };
    type();
  };

  const speakText = (text) => {
    const voices = window.speechSynthesis.getVoices();
    const childlikeVoice = voices.find(voice =>
      voice.lang === 'ko-KR' && (voice.name.includes('Google') || voice.name.includes('Microsoft'))
    );
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.pitch = 1.5;
    utterance.rate = 1.1;
    if (childlikeVoice) {
      utterance.voice = childlikeVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async () => {
    if (!input) return;
    const newMsg = { role: 'user', content: input };
    const systemMsg = {
      role: 'system',
      content: `
당신은 '뭐냐면'이라는 이름의 AI 챗봇입니다.
역사에 대해 잘 모르는 초등학생을 위해 복잡한 개념, 유적, 사건을 쉽고 명확하게 설명하는 역할을 합니다.

다음 조건을 반드시 지켜야 합니다:
- 설명은 초등학생이 이해할 수 있도록 쉽고 구체적으로 합니다.
- 학생들이 알기 쉽게 역사적 용어에 나오는 한자어를 쉽게 풀이해서 알려줍니다.
- 너무 많은 정보를 한 번에 제공하지 않고, 핵심 중심으로 간결하게 말합니다.
- 주제와 중심 내용에 따라 단락을 나누어서 설명합니다.
- 질문과 관련 없는 내용은 답하지 않으며, 역사 외 분야의 질문은 “나는 역사에 대해서만 도와줄 수 있어.”라고 대답합니다.
- 친절하고 부드러운 말투를 사용합니다.
- 불확실하거나 모르는 정보는 추측하지 말고 '잘 모르겠습니다. 관련 자료를 직접 검색해서 찾아보세요' 라고 답해줍니다.
- 공식 문서, 논문, 뉴스 등 출처가 명확한 정보만 제공합니다.
- 창작된 내용이나 근거 없는 정보는 절대 포함하지 않습니다.
- 초등학생에게 낯선 용어나 개념은 먼저 간단하게 정의해준 후 설명합니다.
- 단계적으로 분절하여 논리적으로 설명합니다.
- 이해하기 쉽게 단어를 바꾸고, 어려운 개념에 대해서는 부연설명하는 내용을 넣어서 설명합니다.
- 해당 국가유산에 대해 학생이 질문하지 않은 다른 정보도 웹 검색을 통해 더해서 설명해 줍니다.
- 학생이 입력한 문화유산에 대해 웹페이지에서 추가적인 자료를 찾아 덧붙여 소개한다.
- 조사한 내용을 발표자료로 만들 수 있도록 요약본을 제공할 지 물어본다.
- 대화의 끝 부분에 '더 궁금한 게 있니? 아니면 이제 그만할까?'를 물어본다.

※ 특별 기능 - 학습 평가 및 보고서 생성:

학생이 '그만할게요', '이제 끝', '감사합니다' 등 대화를 종료하는 표현을 사용하면, 지금까지의 대화를 바탕으로 다음 기준에 따라 평가하고 보고서를 작성합니다.

1. 평가 (세 단계 중 하나만 선택, 아래 기준을 엄격하게 적용):
- 잘함: 조사 대상의 역사적 배경이나 가치에 대해 스스로 질문하거나, 관련 사건과의 연결성을 묻는 등 탐구적 질문이 3개 이상 있는 경우에만 해당.
- 보통: 질문이 주로 단어의 뜻, 건물 구조, 연도 등 기본 정보 확인에 머무른 경우. 탐구적 질문이 없거나 1~2개 이하.
- 노력 요함: 질문이 거의 없거나, 단순한 감탄이나 확인만 있는 경우. 모호한 경우에도 이 범주로 판단.

2. 보고서 작성 (간결한 개조식, 최대 6줄 내외):
- 조사 대상의 기본 정보
- 역사적 배경 및 가치
- 질문 내용을 통한 학생의 이해도 요약
- 특별히 흥미를 보인 부분이나 인상 깊은 대화 요소
- 종합적 평어 및 격려 멘트
      `
    };

    const updated = [systemMsg, ...messages, newMsg];

    const initialText = loadingMessages[loadingMessageIndex % loadingMessages.length];
    setLoadingMessageIndex(prev => prev + 1);
    setTypedText('');
    setMessages([...messages, newMsg, { role: 'assistant', content: '' }]);
    setInput('');
    typeEffect(initialText);

    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => {
        const nextIndex = (prev + 1) % loadingMessages.length;
        typeEffect(loadingMessages[nextIndex]);
        return nextIndex;
      });
    }, 1000);
    setLoadingInterval(interval);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: updated })
    });
    const data = await res.json();


    clearInterval(interval);
    setMessages(prevMessages => [
      ...prevMessages.slice(0, -1),
      { role: 'assistant', content: data.text }
    ]);
    setTypedText('');
  };

  const renderedMessages = messages.map((m, i) => {
    const isLast = i === messages.length - 1;
    const isTyping = isLast && m.role === 'assistant' && m.content === '';
    const content = isTyping ? typedText : m.content;

    const messageBoxStyle = {
      backgroundColor: m.role === 'user' ? '#e6f3ff' : '#f7f7f8',
      padding: '10px 15px',
      borderRadius: '15px',
      maxWidth: '80%',
      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
      whiteSpace: 'pre-wrap',
      fontSize: '1rem',
      lineHeight: '1.6',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    };

    return (
      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: messageBoxStyle.alignSelf }}>
        <div style={messageBoxStyle}>
          {m.role === 'assistant' && !isTyping ? (
            <>
              <ReactMarkdown>{cleanContent(content)}</ReactMarkdown>
              <button onClick={() => speakText(content)} style={{ marginTop: 5 }}>🔊 </button>
            </>
          ) : (
            <p style={{ fontStyle: isTyping ? 'italic' : 'normal', minHeight: '1.5em' }}>{content}</p>
          )}
        </div>
      </div>
    );
  });

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>뭐냐면</h1>
        <p style={{ fontSize: '1rem', color: '#666', margin: 0 }}>초등 역사 유적·사건·인물 자료를 쉽게 풀어주는 AI 챗봇</p>
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
            padding: 10,
            minHeight: '60px',
            maxHeight: '200px',
            resize: 'vertical',
            overflowY: 'auto',
            fontSize: '1rem',
            lineHeight: '1.5',
            marginBottom: '0.5rem',
          fontFamily: 'Segoe UI, sans-serif' 
          }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="메시지를 입력하세요... (Shift + Enter로 줄바꿈)"
        />
        <button
          onClick={sendMessage}
          style={{
            padding: '10px',
            fontSize: '1rem',
            borderRadius: '6px',
            backgroundColor: '#FDD835',
            fontWeight: 'bold',
            color: 'black',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Segoe UI, sans-serif',

          }}
        >보내기</button>
      </div>
    </div>
  );
}
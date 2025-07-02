import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';

const cleanContent = (text) => {
  return text.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
};

const extractNameFromInput = (text) => {
  const patterns = ["내 이름은", "이라고 해", "이라고 합니다", "이라고 해요", "입니다", "이에요", "이야", "난", "나는"];
  let name = text;
  for (const pattern of patterns) {
    name = name.replace(pattern, "");
  }
  return name.trim();
};

const getKoreanNameWithPostposition = (name) => {
  const lastChar = name.charCodeAt(name.length - 1);
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) {
    return name;
  }
  const hasJongseong = (lastChar - 0xAC00) % 28 !== 0;
  return name + (hasJongseong ? '아' : '야');
};


export default function Home() {
  const [conversationPhase, setConversationPhase] = useState('asking_name');
  const [userName, setUserName] = useState('');
  const [sourceText, setSourceText] = useState('');

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
  
  // ✨ [수정됨] 의도 분석 규칙이 포함된 고도화된 시스템 프롬프트
  const createSystemMessage = (name, source, phase) => {
    const friendlyName = getKoreanNameWithPostposition(name);
    
    let phaseInstruction = '';
    if (phase === 'asking_source') {
      phaseInstruction = `
현재 대화 단계는 '원본 자료 입력' 단계야. 사용자가 입력한 텍스트의 의도를 다음 세 가지 중 하나로 분류하고, 그에 맞는 답변을 해야 해.
- **의도 1: '자료 붙여넣기'**: 사용자가 조사한 내용을 길게 붙여넣은 경우. (글자 수가 많고 여러 문단으로 구성)
  - **답변:** "좋아, 자료를 잘 받았어! 이 내용은 말이야..." 라고 시작하며, [원본 자료]에 대한 설명을 시작해.
- **의도 2: '직접 질문'**: 사용자가 자료를 붙여넣는 대신, "이순신은 누구야?" 처럼 직접 질문을 하는 경우.
  - **답변:** "좋은 질문이네! 그 내용에 대해 더 정확하게 설명해주려면, 먼저 백과사전이나 믿을 만한 곳에서 찾은 자료를 여기에 붙여넣어 줄래?" 라고 답하며 자료 입력을 유도해야 해.
- **의도 3: '일반 대화'**: "안녕?" 또는 의미 없는 짧은 텍스트를 입력한 경우.
  - **답변:** "앗, 지금은 대화하는 대신 조사한 자료를 붙여넣어 줘야 해." 라고 답하며 자료 입력을 다시 요청해야 해.
너는 이 세 가지 의도 중 하나로 판단해서, 그에 맞는 답변만 생성해야 한다.
      `;
    } else { // chatting phase
      phaseInstruction = `
너의 핵심 임무는 사용자가 제공한 아래의 [원본 자료]를 바탕으로, 역사 이야기를 쉽고 재미있게 설명해주는 것이야.

[원본 자료]
${source}
[/원본 자료]

**[꼭 지켜야 할 규칙]**
- **가장 중요한 규칙: 모든 답변은 반드시 사용자가 제공한 [원본 자료] 내용에만 근거해야 해. [원본 자료]에 없는 내용은 절대 지어내거나 추측해서 말하면 안 돼.**
`;
    }

    return {
      role: 'system',
      content: `
너는 '뭐냐면'이라는 이름의 AI 챗봇이야. 너는 지금 '${name}'이라는 이름의 초등 저학년 친구와 대화하고 있어. 사용자를 부를 때는 반드시 '${friendlyName}'라고 불러야 해.
${phaseInstruction}
**[공통 규칙]**
- **말투:** 초등 저학년 학생이 이해할 수 있도록 쉬운 단어와 친절한 설명을 사용해야 해.
- **답변 형식:** 어려운 소제목 대신, '👑 왕관 이야기', '⚔️ 칼 이야기'처럼 내용과 관련된 재미있는 이모티콘과 함께 짧은 제목을 붙여줘.
- **질문 유도:** 설명이 끝나면, 아이들이 더 궁금해할 만한 질문을 "혹시 이런 것도 궁금해?" 하고 물어봐 줘.
- **추가 정보:** 설명의 마지막에는, "[Google에서 '핵심주제' 더 찾아보기](https://www.google.com/search?q=핵심주제)" 링크를 달아서 더 찾아볼 수 있게 도와줘.

**[특별 기능 설명]**
사용자가 요청하면, 아래 규칙에 따라 행동해 줘.

1.  **'퀴즈풀기' 요청:** 지금까지 나눈 대화를 바탕으로 재미있는 퀴즈 1개를 내고, 친구의 다음 답변을 채점하고 설명해 줘.
2.  **'3줄요약' 요청:** 대화 초반에 제시된 '조사 대상' 자체의 가장 중요한 특징 3가지를 15자 내외의 짧은 구절로 요약해 줘.
3.  **'나 어땠어?' 요청:** 대화 내용을 바탕으로 학습 태도를 '최고야!', '정말 잘했어!', '조금만 더 힘내자!' 중 하나로 평가하고 칭찬해 줘.
      `
    };
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
    const userInput = input.trim();
    const newMsg = { role: 'user', content: userInput };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInput('');

    // 1단계: 이름 받기
    if (conversationPhase === 'asking_name') {
      const name = extractNameFromInput(userInput);
      if (!name) {
          setMessages(prev => [...prev.slice(0,-1), { role: 'assistant', content: '이름을 알려주지 않으면 다음으로 넘어갈 수 없어. 다시 한번 알려줄래?'}]);
          return;
      }
      setUserName(name);
      setTimeout(() => {
        const friendlyName = getKoreanNameWithPostposition(name);
        setMessages(prev => [...prev, { role: 'assistant', content: `만나서 반가워, ${friendlyName}! 이제 네가 조사한 역사 자료의 원본 내용을 여기에 붙여넣어 줄래? 내가 쉽고 재미있게 설명해 줄게.` }]);
        setConversationPhase('asking_source');
      }, 500);
      return;
    }

    // 2단계: 원본 자료 받기 (AI가 의도 분석 후 첫 설명 시작)
    if (conversationPhase === 'asking_source') {
      const systemMsg = createSystemMessage(userName, "", 'asking_source');
      processStreamedResponse([systemMsg, newMsg]);
      // 사용자의 첫 자료 입력 후에는 대화 단계로 전환
      setSourceText(userInput); 
      setConversationPhase('chatting');
      return;
    }
    
    // 3단계: 자유 대화
    if (conversationPhase === 'chatting') {
      const systemMsg = createSystemMessage(userName, sourceText);
      processStreamedResponse([systemMsg, ...updatedMessages]);
    }
  };
  
  const handleSpecialRequest = (prompt, userMessage) => {
    if (isLoading) return;
    setMessages(prev => [...prev, { role: 'assistant', content: userMessage }]);
    const newMsg = { role: 'user', content: prompt };
    const systemMsg = createSystemMessage(userName, sourceText, 'chatting');
    processStreamedResponse([systemMsg, ...messages, newMsg]);
  };
  
  const handleRequestQuiz = () => handleSpecialRequest("지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.", "좋아! 그럼 지금까지 배운 내용으로 퀴즈를 내볼게.");
  const handleRequestThreeLineSummary = () => handleSpecialRequest("내가 처음에 제공한 [원본 자료]의 가장 중요한 특징 3가지를 15자 내외의 짧은 구절로 요약해 줘.", "알았어. 처음에 네가 알려준 자료를 딱 3가지로 요약해 줄게!");
  const handleRequestEvaluation = () => handleSpecialRequest("지금까지 나와의 대화, 질문 수준을 바탕으로 나의 학습 태도와 이해도를 '나 어땠어?' 기준에 맞춰 평가해 줘.", "응. 지금까지 네가 얼마나 잘했는지 알려줄게!");


  const renderedMessages = messages.map((m, i) => {
    // ... 이전과 동일
  });

  return (
    <>
      <Head>
        {/* ... 이전과 동일 ... */}
      </Head>

      <div style={{ maxWidth: 700, margin: '2rem auto', padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>
        {/* ... 이전과 동일 ... */}
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
            placeholder={
              conversationPhase === 'asking_name' ? "너의 이름은 뭐니?" :
              conversationPhase === 'asking_source' ? "여기에 조사한 내용을 붙여넣어 줘!" :
              "이 내용에 대해 더 물어볼까?"
            }
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
            {conversationPhase === 'chatting' && messages.length > 4 && (
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
          {showExtraFeatures && conversationPhase === 'chatting' && messages.length > 4 && (
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

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';
import Banner from '../components/Banner';

const cleanContent = (text) => {
  const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }
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
  if (!name) return '';
  const lastChar = name.charCodeAt(name.length - 1);
  if (lastChar < 0xAC00 || lastChar > 0xD7A3) {
    return name;
  }
  const hasJongseong = (lastChar - 0xAC00) % 28 !== 0;
  return name + (hasJongseong ? '아' : '야');
};

const commonSurnames = "김이박최정강조윤장임한오서신권황안송유홍전고문양손배조백허남심노하곽성차주우구신임나지엄원천방공현";

const getGivenName = (name) => {
    if (!name || typeof name !== 'string') return '';
    if (name.length === 3 && commonSurnames.includes(name.charAt(0))) {
        return name.substring(1);
    }
    return name;
};

const zodiacEmojis = ['🐭', '🐮', '🐯', '🐰', '🐲', '🐍', '🐴', '🐑', '🐵', '🐔', '🐶', '🐷'];


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
  const [userEmoji, setUserEmoji] = useState('');

  useEffect(() => {
    setUserEmoji(zodiacEmojis[Math.floor(Math.random() * zodiacEmojis.length)]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const createSystemMessage = (name, source) => {
    const friendlyName = getKoreanNameWithPostposition(getGivenName(name));
    return {
      role: 'system',
      content: `
너는 '뭐냐면'이라는 이름의 AI 챗봇이야. 너는 지금 '${name}'이라는 이름의 초등 저학년 친구와 대화하고 있어. 대화상대의 나이는 대략 8세~10세 사이야. 사용자를 부를 때는 반드시 '${friendlyName}'라고 불러야 해.
너의 핵심 임무는 사용자가 제공한 아래의 [원본 자료]를 바탕으로, 역사 이야기를 쉽고 재미있게 설명해주는 것이야.

[원본 자료]
${source}
[/원본 자료]

**[꼭 지켜야 할 규칙]**
- **가장 중요한 규칙: 답변은 사용자가 제공한 [원본 자료]를 최우선으로 하되, 아이들의 이해를 돕기 위해 필요한 경우 너의 일반 지식을 활용하여 배경지식이나 쉬운 예시를 덧붙여 설명할 수 있어. 하지만 [원본 자료]와 전혀 관련 없는 이야기는 하지 마.**
- **말투:** 초등 저학년 학생이 이해할 수 있도록 쉬운 단어와 친절한 설명을 사용해야 해.
- **답변 형식:** 어려운 소제목 대신, '~~이야기', '~~은 뭘까?'처럼 내용과 관련된 재미있는 짧은 제목을 이모티콘과 함께 붙여줘.
- **질문 유도:** 설명이 끝나면, 아이들이 더 궁금해할 만한 질문을 "혹시 이런 것도 궁금해?" 하고 물어봐 줘.
- **추가 정보:** 설명의 마지막에는, "[Google에서 '핵심주제' 더 찾아보기](https://www.google.com/search?q=핵심주제)" 링크를 달아서 더 찾아볼 수 있게 도와줘.

**[답변 내용 및 문체, 단어에 대한 규칙]**
- 학생들이 알기 쉽게 역사적 용어에 나오는 한자어를 쉽게 풀이해서 알려줍니다.
- 너무 많은 정보를 한 번에 제공하지 않고, 핵심 중심으로 간결하게 말합니다.
- 주제와 중심 내용에 따라 단락을 나누어서 설명합니다.
- 창작된 내용이나 근거 없는 정보는 절대 포함하지 않습니다.
- 초등학생에게 낯선 용어나 개념은 먼저 간단하게 정의해준 후 설명합니다.
- 단계적으로 분절하여 논리적으로 설명합니다.
- 이해하기 쉽게 단어를 바꾸고, 어려운 개념에 대해서는 부연설명하는 내용을 넣어서 설명합니다.

**[특별 기능 설명]**
사용자가 요청하면, 아래 규칙에 따라 행동해 줘. 모든 답변은 [원본 자료]와 대화 내용을 기반으로 해.

1.  **'퀴즈풀기' 요청:** 지금까지 나눈 대화를 바탕으로 재미있는 퀴즈 1개를 내고, 친구의 다음 답변을 채점하고 설명해 줘.
2.  **'3줄요약' 요청:** 대화 초반에 제시된 '조사 대상' 자체의 핵심 내용을 하나의 문단으로 자연스럽게 이어지는 3줄 정도 길이의 요약글로 생성해 줘. 절대로 번호를 붙이거나 항목을 나누지 마. **순수한 요약 내용은 반드시 <summary>와 </summary> 태그로 감싸야 해.**
3.  **'나 어땠어?' 요청:** 대화 내용을 바탕으로 학습 태도를 평가한다. 평가 기준을 절대 너그럽게 해석하지 말고, 아래 조건에 따라 엄격하게 판단해야 해.
    - **'최고야!':** 역사적 배경, 가치, 인과관계, 다른 사건과의 비교 등 깊이 있는 탐구 질문을 2회 이상 했을 경우에만 이 평가를 내린다.
    - **'잘했어!':** 단어의 뜻이나 사실 관계 확인 등 단순한 질문을 주로 했지만, 꾸준히 대화에 참여했을 경우 이 평가를 내린다.
    - **'좀 더 관심을 가져보자!':** 질문이 거의 없거나 대화 참여가 저조했을 경우, 이 평가를 내리고 "다음에는 '왜 이런 일이 일어났을까?' 또는 '그래서 어떻게 됐을까?' 하고 물어보면 역사를 더 깊이 이해할 수 있을 거야!" 와 같이 구체적인 조언을 해준다.
4.  **'교과평어 만들기' 요청:** 대화 내용 전체를 바탕으로, 학생의 탐구 과정, 질문 수준, 이해도, 태도 등을 종합하여 선생님께 제출할 수 있는 정성적인 '교과 세부능력 및 특기사항' 예시문을 2~3문장으로 작성해 줘. **반드시 '~~함.', '~~였음.'과 같이 간결한 개조식으로 서술해야 해.** 학생의 장점이 잘 드러나도록 긍정적으로 서술해. **다른 말 없이, 순수한 평가 내용만 <summary> 태그로 감싸서 출력해.**
      `
    };
  };

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
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input || isLoading) return;
    const userInput = input.trim();
    
    if (conversationPhase === 'asking_name') {
      const name = extractNameFromInput(userInput);
      if (!name) {
          setMessages(prev => [...prev, { role: 'user', content: userInput }, { role: 'assistant', content: '이름을 알려주지 않으면 다음으로 넘어갈 수 없어. 다시 한번 알려줄래?'}]);
          setInput('');
          return;
      }
      setUserName(name);
      setMessages(prev => [...prev, { role: 'user', content: userInput }]);
      setInput('');
      setTimeout(() => {
        const friendlyName = getKoreanNameWithPostposition(getGivenName(name));
        setMessages(prev => [...prev, { role: 'assistant', content: `만나서 반가워, ${friendlyName}! 이제 네가 조사한 역사 자료의 원본 내용을 여기에 붙여넣어 줄래? 내가 쉽고 재미있게 설명해 줄게.` }]);
        setConversationPhase('asking_source');
      }, 500);
      return;
    }

    if (conversationPhase === 'asking_source') {
      if (userInput.length < 30) {
        setMessages(prev => [...prev, { role: 'user', content: userInput }, { role: 'assistant', content: '앗, 그건 설명할 자료가 아닌 것 같아. 조사한 내용을 여기에 길게 붙여넣어 줄래?'}]);
        setInput('');
        return;
      }
      setSourceText(userInput);
      const userMsg = { role: 'user', content: `이 자료에 대해 설명해줘: ${userInput}` };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput('');
      const systemMsg = createSystemMessage(userName, userInput);
      processStreamedResponse([systemMsg, userMsg]);
      setConversationPhase('chatting');
      return;
    }
    
    if (conversationPhase === 'chatting') {
      const newMsg = { role: 'user', content: input };
      const updatedMessages = [...messages, newMsg];
      const systemMsg = createSystemMessage(userName, sourceText);
      setMessages(updatedMessages);
      setInput('');
      processStreamedResponse([systemMsg, ...updatedMessages]);
    }
  };
  
  const handleSpecialRequest = (userAction, prompt, metadata) => {
    if (isLoading) return;
    const userActionMsg = { role: 'user', content: userAction };
    setMessages(prev => [...prev, userActionMsg]);
    
    const newMsg = { role: 'user', content: prompt };
    const systemMsg = createSystemMessage(userName, sourceText);
    processStreamedResponse([systemMsg, ...messages, userActionMsg, newMsg], metadata);
  };
  
  const handleRequestQuiz = () => handleSpecialRequest("💡 퀴즈 풀기", "지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.", { type: 'quiz' });
  const handleRequestThreeLineSummary = () => handleSpecialRequest("📜 3줄요약", "내가 처음에 제공한 [원본 자료]의 가장 중요한 특징 3가지를 25자 내외의 구절로 요약해 줘.", { type: 'summary' });
  const handleRequestEvaluation = () => handleSpecialRequest("💯 나 어땠어?", "지금까지 나와의 대화, 질문 수준을 바탕으로 나의 학습 태도와 이해도를 '나 어땠어?' 기준에 맞춰 평가해 줘.", { type: 'evaluation' });
  const handleRequestTeacherComment = () => handleSpecialRequest("✍️ 선생님께 알리기", "지금까지의 활동을 바탕으로 선생님께 보여드릴 '교과평어'를 만들어 줘.", { type: 'teacher_comment' });

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

  const renderedMessages = messages.map((m, i) => {
    const content = m.content;
    const isUser = m.role === 'user';
    const speakerName = isUser ? userName : '뭐냐면';
    const isNameVisible = conversationPhase === 'chatting' && i > 2;

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
            {m.role === 'assistant' && !isLoading && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {(m.metadata?.type === 'summary' || m.metadata?.type === 'teacher_comment') && (
                  <button onClick={() => handleCopy(content)} className="btn btn-tertiary">📋 복사하기</button>
                )}
                {m.metadata?.type === 'evaluation' && (
                  // ✨ [수정됨] 버튼 텍스트 변경
                  <button onClick={handleRequestTeacherComment} className="btn btn-tertiary">✍️ 내가 어땠는지 선생님께 알리기</button>
                )}
              </div>
            )}
          </div>
        </div>
        {isUser && profilePic}
      </div>
    );
  });

  return (
    <>
      <Head>
        <title>뭐냐면 - 역사 AI 챗봇</title>
        <meta name="description" content="초등학생을 위한 역사·유적·사건을 친절하게 쉽게 설명해주는 AI 챗봇, 뭐냐면!" />
        <meta property="og:title" content="뭐냐면 - 초등 역사 유적·사건 자료를 쉽게 풀어주는 AI 챗봇" />
        <meta property="og:description" content="초등학생을 위한 역사·유적·사건을 친절하게 쉽게 설명해주는 AI 챗봇, 뭐냐면!" />
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
              className="btn btn-primary"
            >
              보내기 📨
            </button>
            {conversationPhase === 'chatting' && messages.length > 4 && (
              <button
                onClick={() => setShowExtraFeatures(!showExtraFeatures)}
                disabled={isLoading}
                className="btn btn-secondary"
              >
                {showExtraFeatures ? '기능 숨기기 ▲' : '더 많은 기능 보기 📚'}
              </button>
            )}
          </div>
          {showExtraFeatures && conversationPhase === 'chatting' && messages.length > 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
               <button onClick={handleRequestQuiz} disabled={isLoading} className="btn btn-tertiary">💡 퀴즈 풀기</button>
               <button onClick={handleRequestThreeLineSummary} disabled={isLoading} className="btn btn-tertiary">📜 3줄요약</button>
               <button onClick={handleRequestEvaluation} disabled={isLoading} className="btn btn-tertiary">💯 나 어땠어?</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

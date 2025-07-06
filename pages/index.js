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
  const [showExtraFeatures, setShowExtraFeatures] = useState(false);
  const inputRef = useRef(null);
  const [userEmoji, setUserEmoji] = useState('👤');
  
  // ✨ [추가됨] 추천 질문을 저장할 상태 변수
  const [recommendedQuestions, setRecommendedQuestions] = useState([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // ✨ [수정됨] 추천 질문 생성 규칙이 포함된 시스템 프롬프트
  const createSystemMessage = (source) => {
    return {
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
- **추가 정보:** 설명의 마지막에는, "[Google에서 '${topic}' 더 찾아보기](https://www.google.com/search?q=${topic})" 링크를 달아서 더 찾아볼 수 있게 도와줘.
- **추천 질문 생성:** 설명이 끝난 후, 다음 규칙에 따라 세 가지 수준의 추천 질문을 생성해야 해. 각 질문은 사용자가 더 깊이 탐구하도록 유도해야 하며, 반드시 [추천질문] 태그로 감싸서 한 줄에 하나씩 제시해야 해.
    1.  **사실/개념 질문:** "그래서 OOO가 뭐야?" 와 같이 기본적인 내용을 묻는 질문.
    2.  **원인/분석 질문:** "왜 OOO는 그렇게 했을까?" 와 같이 이유나 과정을 묻는 질문.
    3.  **가치/평가 질문:** "OOO는 잘한 일일까?" 와 같이 생각이나 평가를 묻는 질문.
    예시:
    [추천질문]OOO란 무엇인가요?
    [추천질문]OOO는 왜 만들어졌나요?
    [추천질문]OOO의 가장 중요한 점은 무엇이라고 생각해?

**[특별 기능 설명]**
사용자가 요청하면, 아래 규칙에 따라 행동해 줘. 모든 답변은 [원본 자료]와 대화 내용을 기반으로 해.

1.  **'퀴즈풀기' 요청:** 지금까지 나눈 대화를 바탕으로 재미있는 퀴즈 1개를 내고, 친구의 다음 답변을 채점하고 설명해 줘.
2.  **'3줄요약' 요청:** 대화 초반에 제시된 '조사 대상' 자체의 핵심 내용을 하나의 문단으로 자연스럽게 이어지는 3줄 정도 길이의 요약글로 생성해 줘. 절대로 번호를 붙이거나 항목을 나누지 마. **순수한 요약 내용은 반드시 <summary>와 </summary> 태그로 감싸야 해.**
3.  **'나 어땠어?' 요청:** 대화 내용을 바탕으로 학습 태도를 평가한다. 평가 기준을 절대 너그럽게 해석하지 말고, 아래 조건에 따라 엄격하게 판단해야 해.
    - **'최고야!':** 배경, 가치, 인과관계, 다른 사건과의 비교 등 깊이 있는 탐구 질문을 2회 이상 했을 경우에만 이 평가를 내린다.
    - **'잘했어!':** 단어의 뜻이나 사실 관계 확인 등 단순한 질문을 주로 했지만, 꾸준히 대화에 참여했을 경우 이 평가를 내린다.
    - **'좀 더 관심을 가져보자!':** 질문이 거의 없거나 대화 참여가 저조했을 경우, 이 평가를 내리고 "다음에는 '왜 이런 일이 일어났을까?' 또는 '그래서 어떻게 됐을까?' 하고 물어보면 내용을 더 깊이 이해할 수 있을 거야!" 와 같이 구체적인 조언을 해준다.
4.  **'교과평어 만들기' 요청:** 대화 내용 전체를 바탕으로, 학생의 탐구 과정, 질문 수준, 이해도, 태도 등을 종합하여 선생님께 제출할 수 있는 정성적인 '교과 세부능력 및 특기사항' 예시문을 2~3문장으로 작성해 줘. **반드시 '~~함.', '~~였음.'과 같이 간결한 개조식으로 서술해야 해.** 학생의 장점이 잘 드러나도록 긍정적으로 서술해. **다른 말 없이, 순수한 평가 내용만 <summary> 태그로 감싸서 출력해.**
      `
    };
  };

  // ✨ [수정됨] 스트리밍 데이터에서 추천 질문을 분리하는 로직 추가
  const processStreamedResponse = async (messageHistory, metadata = {}) => {
    setIsLoading(true);
    setRecommendedQuestions([]); // 새 답변 생성 시 이전 추천 질문 초기화
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
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        for (const line of lines.slice(0, -1)) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            
            // 추천 질문인지 확인
            if(data.includes('[추천질문]')){
              const questions = data.split('\n').filter(q => q.startsWith('[추천질문]')).map(q => q.replace('[추천질문]', '').trim());
              setRecommendedQuestions(prev => [...prev, ...questions]);
              continue; // 추천 질문은 채팅창에 표시하지 않음
            }

            setMessages(prev => {
              const lastMessage = prev[prev.length - 1];
              const updatedLastMessage = { ...lastMessage, content: lastMessage.content + data, metadata: lastMessage.metadata };
              return [...prev.slice(0, -1), updatedLastMessage];
            });
          }
        }
        buffer = lines[lines.length - 1];
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

  const fetchFullResponse = async (messageHistory) => {
    // ... 이전과 동일
  };

  const sendMessage = async () => {
    // ... 이전과 동일
  };
  
  const handleSpecialRequest = (userAction, prompt, metadata) => {
    // ... 이전과 동일
  };
  
  const handleRequestQuiz = () => handleSpecialRequest("💡 퀴즈 풀기", "지금까지 대화한 내용을 바탕으로, 학습 퀴즈 1개를 내주고 나의 다음 답변을 채점해줘.", { type: 'quiz' });
  const handleRequestThreeLineSummary = () => handleSpecialRequest("📜 3줄요약", "내가 처음에 제공한 [원본 자료]의 가장 중요한 특징을 3줄 요약해 줘.", { type: 'summary' });
  const handleRequestEvaluation = () => handleSpecialRequest("💯 나 어땠어?", "지금까지 나와의 대화, 질문 수준을 바탕으로 나의 학습 태도와 이해도를 '나 어땠어?' 기준에 맞춰 평가해 줘.", { type: 'evaluation' });
  const handleRequestTeacherComment = () => handleSpecialRequest("✍️ 선생님께 알리기", "지금까지의 활동을 바탕으로 선생님께 보여드릴 '교과평어'를 만들어 줘.", { type: 'teacher_comment' });

  // ✨ [추가됨] 추천 질문 버튼 클릭 시 실행될 함수
  const handleRecommendedQuestionClick = (question) => {
    if (isLoading) return;
    const newMsg = { role: 'user', content: question };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    const systemMsg = createSystemMessage(sourceText);
    processStreamedResponse([systemMsg, ...updatedMessages]);
  };
  
  const handleCopy = async (text) => {
    // ... 이전과 동일
  };

  const renderedMessages = messages.map((m, i) => {
    // ... 이전과 동일
  });

  return (
    <>
      <Head>
        {/* ... 이전과 동일 ... */}
      </Head>

      <div style={{ maxWidth: 700, margin: '2rem auto', padding: 20 }}>
        <Banner />
        
        <div style={{
          display: 'flex', flexDirection: 'column',
          border: '1px solid #ddd', padding: '20px', height: '60vh',
          overflowY: 'auto', borderRadius: '8px', backgroundColor: '#EAE7DC'
        }}>
          {renderedMessages}
          {/* ✨ [추가됨] 추천 질문 버튼 렌더링 로직 */}
          {!isLoading && recommendedQuestions.length > 0 && (
            <div style={{alignSelf: 'flex-start', marginTop: '10px'}}>
              {recommendedQuestions.map((q, index) => (
                <button key={index} onClick={() => handleRecommendedQuestionClick(q)} className="btn btn-tertiary" style={{margin: '5px'}}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
          <textarea
            ref={inputRef}
            // ... 이전과 동일 ...
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={sendMessage}
              disabled={isLoading}
              className="btn btn-primary"
            >
              보내기 📨
            </button>
            {conversationPhase === 'chatting' && messages.length > 2 && (
              <button
                onClick={() => setShowExtraFeatures(!showExtraFeatures)}
                disabled={isLoading}
                className="btn btn-secondary"
              >
                {showExtraFeatures ? '기능 숨기기 ▲' : '더 많은 기능 보기 📚'}
              </button>
            )}
          </div>
          {showExtraFeatures && conversationPhase === 'chatting' && messages.length > 2 && (
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

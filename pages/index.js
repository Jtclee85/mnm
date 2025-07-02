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
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [loadingInterval, setLoadingInterval] = useState(null);
  const [typedText, setTypedText] = useState('');
  const loadingMessages = ['그게 뭐냐면...', '생각중이니 잠깐만요...'];

  // ✨ [수정됨] 퀴즈 상태에 '정답확인' 여부 추가
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizData, setQuizData] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizFeedbackGiven, setQuizFeedbackGiven] = useState(false); // 피드백 제공 여부 상태


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
사용자가 "퀴즈를 만들어 줘"라고 요청하면, **반드시 아래의 JSON 형식에 맞춰 퀴즈 데이터를 생성**합니다. 다른 설명 없이 오직 JSON 데이터만 출력해야 합니다.
[
  {
    "question": "첫 번째 문제 내용",
    "choices": ["① 보기 1", "② 보기 2", "③ 보기 3", "④ 보기 4"],
    "answer": "①",
    "explanation": "이것이 정답인 이유에 대한 친절한 해설"
  },
  {
    "question": "두 번째 문제 내용",
    "choices": ["① 보기 1", "② 보기 2", "③ 보기 3", "④ 보기 4"],
    "answer": "②",
    "explanation": "두 번째 문제에 대한 친절한 해설"
  },
  {
    "question": "세 번째 문제 내용",
    "choices": ["① 보기 1", "② 보기 2", "③ 보기 3", "④ 보기 4"],
    "answer": "③",
    "explanation": "세 번째 문제에 대한 친절한 해설"
  }
]
    `
  };

  const startLoadingAnimation = () => {
    setIsLoading(true);
    const initialText = loadingMessages[0];
    typeEffect(initialText);
    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => {
        const nextIndex = (prev + 1) % loadingMessages.length;
        typeEffect(loadingMessages[nextIndex]);
        return nextIndex;
      });
    }, 1000);
    setLoadingInterval(interval);
  };

  const stopLoadingAnimation = () => {
    if (loadingInterval) clearInterval(loadingInterval);
    setLoadingInterval(null);
    setIsLoading(false);
    setTypedText('');
  };

  const sendChatMessage = async () => {
    if (!input || isLoading) return;
    
    const newMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    startLoadingAnimation();
    
    const updatedHistory = [systemMsg, ...messages, newMsg];
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: updatedHistory })
    });
    const data = await res.json();
    
    setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
    stopLoadingAnimation();
  };

 // ✨ [수정됨] GPT 응답에서 JSON만 정확히 추출하도록 개선된 퀴즈 요청 함수
  const handleRequestQuiz = async () => {
  const quizPrompt = "지금까지 대화한 내용을 바탕으로, 정해진 JSON 형식에 맞춰 객관식 퀴즈 3개를 만들어 줘.";
  setMessages(prev => [...prev, {role: 'assistant', content: "좋아! 그럼 지금까지 배운 내용으로 퀴즈를 내볼게."}]);

  startLoadingAnimation();
  const updatedHistory = [systemMsg, ...messages, { role: 'user', content: quizPrompt }];
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: updatedHistory })
  });
  const data = await res.json();
  stopLoadingAnimation();

  try {
    const jsonMatch = data.text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON format");
    }

    const quizJson = JSON.parse(jsonMatch[0]);
    setQuizData(quizJson);
    setIsQuizMode(true);
    setCurrentQuestionIndex(0);
    setQuizFeedbackGiven(false);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: `[퀴즈 1번]\n${quizJson[0].question}\n${quizJson[0].choices.join('\n')}` }
    ]);
  } catch (e) {
    console.error("퀴즈 데이터 파싱 오류:", e);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: "앗, 퀴즈를 만드는 데 문제가 생겼어. 다시 시도해 줄래?" }
    ]);
  }
};
  const handleQuizAnswer = () => {
    if (!input || isLoading) return;

    const userAnswer = input.trim();
    const currentQuiz = quizData[currentQuestionIndex];
    
    const answerNumber = currentQuiz.answer.match(/\d+/)[0];
    const isCorrect = (userAnswer === answerNumber || userAnswer === currentQuiz.answer);

    let feedback = '';
    if (isCorrect) {
      feedback = `딩동댕! 정답이야. \n\n[해설] ${currentQuiz.explanation}`;
    } else {
      feedback = `아쉽지만 틀렸어. 정답은 ${currentQuiz.answer}이야.\n\n[해설] ${currentQuiz.explanation}`;
    }
    
    setMessages(prev => [...prev, { role: 'user', content: userAnswer }, { role: 'assistant', content: feedback }]);
    setInput('');
    setQuizFeedbackGiven(true); // ✨ [추가됨] 피드백이 제공되었음을 표시
  };

  // ✨ [추가됨] 다음 문제로 넘어가거나 퀴즈를 종료하는 함수
const handleNextQuizStep = () => {
  setQuizFeedbackGiven(false); // 피드백 상태 초기화
  const nextQuestionIndex = currentQuestionIndex + 1;

  if (nextQuestionIndex < quizData.length) {
    const nextQuiz = quizData[nextQuestionIndex];
    setCurrentQuestionIndex(nextQuestionIndex);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: `[퀴즈 ${nextQuestionIndex + 1}번]\n${nextQuiz.question}\n${nextQuiz.choices.join('\n')}` }
    ]);
  } else {
    // 퀴즈 종료
    setIsQuizMode(false);
    setQuizData([]);
    setCurrentQuestionIndex(0);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: "퀴즈를 모두 풀었어! 정말 대단하다! 더 궁금한 게 있니?" }
    ]);
  }
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
          {m.role === 'assistant' && !isQuizMode && <button
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
  
  const loadingDisplay = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{
        backgroundColor: '#f7f7f8', padding: '10px 15px', borderRadius: '15px',
        maxWidth: '80%', alignSelf: 'flex-start', whiteSpace: 'pre-wrap', fontSize: '1rem',
        lineHeight: '1.6', boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        <p style={{ fontStyle: 'italic', minHeight: '1.5em', color: '#888' }}>{typedText}</p>
      </div>
    </div>
  );

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
          {isLoading && loadingDisplay}
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
                if (isQuizMode && !quizFeedbackGiven) {
                  handleQuizAnswer();
                } else if (!isQuizMode) {
                  sendChatMessage();
                }
              }
            }}
            placeholder={isQuizMode ? "정답 번호를 입력하세요... (예: 1)" : "메시지를 입력하세요... (Shift + Enter로 줄바꿈)"}
            disabled={isLoading || (isQuizMode && quizFeedbackGiven)}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* ✨ [수정됨] 퀴즈 모드 상태에 따라 버튼을 다르게 보여줌 */}
            {isQuizMode && quizFeedbackGiven ? (
              <button onClick={handleNextQuizStep} style={{ flex: 1, padding: '10px', fontSize: '1rem', borderRadius: '6px', backgroundColor: '#FDD835', fontWeight: 'bold', color: 'black', border: 'none', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif' }}>
                {currentQuestionIndex < quizData.length -1 ? '다음 문제' : '퀴즈 종료'}
              </button>
            ) : (
              <button
                onClick={isQuizMode ? handleQuizAnswer : sendChatMessage}
                disabled={isLoading}
                style={{
                  flex: 1, padding: '10px', fontSize: '1rem',
                  borderRadius: '6px', backgroundColor: isLoading ? '#e0e0e0' : '#FDD835',
                  fontWeight: 'bold', color: 'black', border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'Segoe UI, sans-serif'
                }}
              >
                {isQuizMode ? '정답 확인' : '보내기'}
              </button>
            )}
            
            <button
              onClick={handleRequestQuiz}
              disabled={isLoading || isQuizMode || messages.length <= 3}
              style={{
                padding: '10px', fontSize: '1rem', borderRadius: '6px',
                backgroundColor: (isLoading || isQuizMode || messages.length <= 3) ? '#e0e0e0' : '#4CAF50',
                fontWeight: 'bold', color: 'white', border: 'none',
                cursor: (isLoading || isQuizMode || messages.length <= 3) ? 'not-allowed' : 'pointer',
                fontFamily: 'Segoe UI, sans-serif'
              }}
            >퀴즈 풀기</button>
          </div>
        </div>
      </div>
    </>
  );
}

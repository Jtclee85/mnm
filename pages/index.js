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
  
  // ✨ [수정됨] 답변 형식 규칙이 추가된 시스템 프롬프트
  const systemMsg = {
    role: 'system',
    content: `
당신은 '뭐냐면'이라는 이름의 AI 챗봇입니다. 초등학생을 위해 역사 개념을 쉽고 명확하게 설명합니다. 다음 규칙을 반드시 지켜야 합니다.
- 설명은 초등학생 눈높이에서 친절하고 부드러운 말투를 사용합니다.
- **답변을 제공할 때는, 핵심 내용을 중심으로 소제목(###)을 붙여 항목화하고, 각 항목은 2~3문장으로 간결하게 설명하여 가독성을 높입니다.**
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

  const processStreamedResponse = async (messageHistory) => {
    setIsLoading(true);
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

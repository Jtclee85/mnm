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
  
  const systemMsg = {
    role: 'system',
    content: `
당신은 '뭐냐면'이라는 이름의 AI 챗봇입니다. 초등학생을 위해 역사 개념을 쉽고 명확하게 설명합니다. 다음 규칙을 반드시 지켜야 합니다.
- 설명은 초등학생 눈높이에서 친절하고 부드러운 말투를 사용합니다.
- 답변을 제공할 때는, 핵심 내용을 중심으로 소제목(###)을 붙여 항목화하고, 각 항목은 2~3문장으로 간결하게 설명하여 가독성을 높입니다.
- 단락을 나눠 간결하게 설명하고, 어려운 한자어는 쉽게 풀이합니다.
- 관련 없는 질문에는 "나는 역사에 대해서만 도와줄 수 있어."라고 대답합니다.
- 대화의 끝에는 '더 궁금한 게 있니? 아니면 이제 그만할까?'를 물어봅니다.

※ 특별 기능 1 - 학습 평가 및 보고서 생성:
학생이 '그만할게요' 등 대화 종료를 표현하면, 다음 기준에 따라 평가하고 보고서를 작성합니다.
1. 평가 (엄격하게 적용): '잘함'(탐구 질문 3개 이상), '보통'(단순 질문 1-2개), '노력 요함'(질문 거의 없음).
2. 보고서 작성 (간결한 개조식): 조사 대상 정보, 학생 이해도 요약, 격려 멘트

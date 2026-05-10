export const REFLECTION_FIELDS = {
  understand: [
    {
      key: 'understand_summary',
      label: '내가 이해한 내용을 한 문장으로 정리해보기',
      placeholder: '가장 중요하다고 생각한 내용을 나만의 말로 한 문장으로 써 보세요.'
    },
    {
      key: 'understand_newLearning',
      label: '원래 자료와 비교했을 때 새롭게 알게 된 점',
      placeholder: '쉬운 설명을 읽고 "아, 이건 몰랐는데!" 싶었던 것이 있나요?'
    },
    {
      key: 'understand_questions',
      label: '아직 궁금한 점',
      placeholder: '아직 이해가 안 되거나 더 알고 싶은 점을 써 보세요. 이 질문이 탐구의 출발점이 될 거예요!'
    }
  ],
  inquiry: [
    {
      key: 'inquiry_thought',
      label: '내 생각 쓰기',
      placeholder: '탐구 질문 중 하나를 골라 내 생각을 자유롭게 써 보세요.'
    },
    {
      key: 'inquiry_debate',
      label: '친구와 토론해보고 싶은 점',
      placeholder: '친구와 함께 이야기하면 재미있을 것 같은 질문이나 주제를 써 보세요.'
    },
    {
      key: 'inquiry_research',
      label: '추가로 조사하고 싶은 내용',
      placeholder: '더 깊이 알아보고 싶은 내용이나 찾아보고 싶은 자료를 써 보세요.'
    }
  ],
  presentation: [
    {
      key: 'presentation_revision',
      label: '발표 후 내가 보완하고 싶은 점',
      placeholder: '발표를 마친 후 "다음엔 이렇게 하면 더 좋겠다"는 점을 써 보세요.'
    },
    {
      key: 'presentation_message',
      label: '청중에게 꼭 전달하고 싶은 핵심 메시지',
      placeholder: '내 발표를 들은 친구가 반드시 기억해갔으면 하는 딱 한 가지를 써 보세요.'
    }
  ]
};

// 공유 페이지와 평가 프롬프트에서 사용하는 단축 레이블
export const REFLECTION_LABELS = {
  understand_summary:    '내가 이해한 내용',
  understand_newLearning:'새롭게 알게 된 점',
  understand_questions:  '아직 궁금한 점',
  inquiry_thought:       '내 생각',
  inquiry_debate:        '친구와 토론해보고 싶은 점',
  inquiry_research:      '추가로 조사하고 싶은 내용',
  presentation_revision: '발표 후 보완하고 싶은 점',
  presentation_message:  '청중에게 전달하고 싶은 핵심 메시지'
};

export const MODES = [
  { key: 'understand',    label: '이해 모드',  icon: '🧒' },
  { key: 'inquiry',       label: '탐구 모드',  icon: '🔍' },
  { key: 'presentation',  label: '발표 모드',  icon: '🎤' }
];

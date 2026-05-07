import { useState } from 'react';

export default function QuizCard({ quizData, onReset, isMobile }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  if (!quizData) {
    return (
      <p style={{ ...styles.emptyText, ...(isMobile ? styles.emptyTextMobile : {}) }}>
        퀴즈가 아직 없습니다.
      </p>
    );
  }

  const correctIndex = Math.max(0, Number(quizData.answer) - 1);
  const isCorrect = selected === correctIndex;

  return (
    <div>
      <div style={{ ...styles.quizQuestion, ...(isMobile ? styles.quizQuestionMobile : {}) }}>
        {quizData.question || '문제가 없습니다.'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {(quizData.options || []).map((option, idx) => {
          const isSelected = selected === idx;
          const isAnswer = submitted && idx === correctIndex;
          const isWrongSelected = submitted && isSelected && idx !== correctIndex;

          let background = '#ffffff';
          let border = '#cbd5e1';
          let color = '#1f2937';

          if (!submitted && isSelected) { background = '#eff6ff'; border = '#60a5fa'; color = '#1d4ed8'; }
          if (isAnswer) { background = '#ecfdf5'; border = '#22c55e'; color = '#166534'; }
          if (isWrongSelected) { background = '#fef2f2'; border = '#ef4444'; color = '#991b1b'; }

          return (
            <button
              key={`${option}-${idx}`}
              type="button"
              disabled={submitted}
              onClick={() => setSelected(idx)}
              style={{
                ...styles.quizOptionButton,
                ...(isMobile ? styles.quizOptionButtonMobile : {}),
                background,
                borderColor: border,
                color,
                cursor: submitted ? 'default' : 'pointer'
              }}
            >
              <span style={{ fontWeight: 800, marginRight: 8 }}>{idx + 1}.</span>
              {option}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        {!submitted ? (
          <button
            type="button"
            style={{ ...styles.primaryButton, ...(isMobile ? styles.primaryButtonMobile : {}) }}
            disabled={selected === null}
            onClick={() => setSubmitted(true)}
          >
            정답 확인
          </button>
        ) : (
          <button
            type="button"
            style={{ ...styles.secondaryButton, ...(isMobile ? styles.secondaryButtonMobile : {}) }}
            onClick={onReset}
          >
            새 퀴즈 만들기
          </button>
        )}
      </div>

      {submitted && (
        <div
          style={{
            marginTop: 16,
            padding: isMobile ? 12 : 14,
            borderRadius: 12,
            background: isCorrect ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${isCorrect ? '#22c55e' : '#ef4444'}`,
            color: isCorrect ? '#166534' : '#991b1b',
            fontSize: isMobile ? 14 : 15
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            {isCorrect ? '정답이야! 잘했어 👏' : '아쉽지만 다시 보자!'}
          </div>
          <div style={{ lineHeight: 1.7 }}>
            정답은 <strong>{correctIndex + 1}번</strong>이야.
            {quizData.explanation ? ` ${quizData.explanation}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  emptyText: { margin: 0, color: '#6b7280', lineHeight: 1.7 },
  emptyTextMobile: { fontSize: 14 },
  quizQuestion: { fontSize: 17, fontWeight: 800, color: '#111827', lineHeight: 1.7 },
  quizQuestionMobile: { fontSize: 15 },
  quizOptionButton: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 15,
    transition: 'all 0.2s ease'
  },
  quizOptionButtonMobile: { fontSize: 14, padding: '11px 12px' },
  primaryButton: {
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    color: '#fff',
    fontWeight: 800,
    padding: '12px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(37,99,235,0.22)'
  },
  primaryButtonMobile: { width: '100%', fontSize: 15, padding: '13px 14px' },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontWeight: 700,
    padding: '12px 18px',
    borderRadius: 12,
    cursor: 'pointer'
  },
  secondaryButtonMobile: { width: '100%', fontSize: 15, padding: '13px 14px' }
};

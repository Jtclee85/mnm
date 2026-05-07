const modeConfig = {
  understand: { label: '이해 모드', color: '#1d4ed8', bg: '#dbeafe' },
  inquiry: { label: '탐구 모드', color: '#047857', bg: '#d1fae5' },
  presentation: { label: '발표 준비 모드', color: '#7c3aed', bg: '#ede9fe' }
};

export default function ModeBadge({ learningMode }) {
  const item = modeConfig[learningMode] || modeConfig.understand;
  return (
    <div
      style={{
        display: 'inline-block',
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 800,
        color: item.color,
        background: item.bg
      }}
    >
      현재 결과 화면: {item.label}
    </div>
  );
}

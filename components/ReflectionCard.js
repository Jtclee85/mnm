/**
 * ReflectionCard — "✍️ 내가 생각해보기" 학생 입력 카드
 *
 * AI 결과 카드(흰 배경, 실선)와 시각적으로 구분되도록
 * 따뜻한 노란 배경 + 점선 테두리로 디자인
 */

import { useState } from 'react';

export default function ReflectionCard({ fields, notes, onUpdate, saveStatus, onShare, isMobile }) {
  const [copied, setCopied] = useState(false);

  const handleShareClick = async () => {
    if (!onShare) return;
    const url = onShare();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div style={{ ...s.card, ...(isMobile ? s.cardMobile : {}) }}>
      <div style={{ ...s.header, ...(isMobile ? s.headerMobile : {}) }}>
        <div style={s.headerLeft}>
          <span style={s.pencil}>✍️</span>
          <span style={{ ...s.title, ...(isMobile ? s.titleMobile : {}) }}>
            내가 생각해보기
          </span>
        </div>
        <div style={s.headerRight}>
          {onShare && (
            <button
              onClick={handleShareClick}
              style={{ ...s.shareBtn, ...(copied ? s.shareBtnCopied : {}) }}
              title="성찰 내용 공유 링크 복사"
            >
              {copied ? '✓ 링크 복사됨!' : '🔗 공유하기'}
            </button>
          )}
          <SaveBadge status={saveStatus} isMobile={isMobile} />
        </div>
      </div>

      <div style={{ ...s.body, ...(isMobile ? s.bodyMobile : {}) }}>
        {fields.map(({ key, label, placeholder }, idx) => (
          <div
            key={key}
            style={{ ...s.fieldGroup, ...(idx === fields.length - 1 ? { marginBottom: 0 } : {}) }}
          >
            <label style={{ ...s.label, ...(isMobile ? s.labelMobile : {}) }}>
              {label}
            </label>
            <textarea
              style={{ ...s.textarea, ...(isMobile ? s.textareaMobile : {}) }}
              value={notes[key] || ''}
              onChange={e => onUpdate(key, e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveBadge({ status, isMobile }) {
  const cfg = {
    idle:   { text: '자동으로 저장됩니다.', color: '#6b7280', bg: 'transparent', border: 'none' },
    saving: { text: '자동저장 중...',       color: '#92400e', bg: '#fef3c7',     border: '1px solid #fde68a' },
    saved:  { text: '✓ 자동 저장됨',       color: '#065f46', bg: '#d1fae5',     border: '1px solid #6ee7b7' },
  }[status] ?? { text: '자동으로 저장됩니다.', color: '#6b7280', bg: 'transparent', border: 'none' };

  return (
    <div style={{
      fontSize: isMobile ? 10 : 11,
      fontWeight: 700,
      color: cfg.color,
      background: cfg.bg,
      border: cfg.border,
      padding: cfg.bg === 'transparent' ? '3px 0' : '3px 9px',
      borderRadius: 20,
      transition: 'all 0.25s',
      whiteSpace: 'nowrap'
    }}>
      {cfg.text}
    </div>
  );
}

const s = {
  card: {
    background: '#fffdf5',
    border: '2px dashed #f59e0b',
    borderRadius: 20,
    overflow: 'hidden'
  },
  cardMobile: { borderRadius: 16 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    background: '#fef9ee',
    borderBottom: '1px dashed #fde68a'
  },
  headerMobile: { padding: '11px 14px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  pencil: { fontSize: 18 },
  title: { fontSize: 16, fontWeight: 800, color: '#92400e' },
  titleMobile: { fontSize: 15 },
  shareBtn: {
    border: '1.5px solid #d97706',
    background: '#fef3c7',
    color: '#92400e',
    fontWeight: 800,
    fontSize: 13,
    padding: '6px 14px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap'
  },
  shareBtnCopied: {
    background: '#d1fae5',
    border: '1.5px solid #059669',
    color: '#065f46'
  },
  body: { padding: 18 },
  bodyMobile: { padding: 14 },
  fieldGroup: { marginBottom: 16 },
  label: {
    display: 'block',
    fontWeight: 700,
    fontSize: 14,
    color: '#78350f',
    marginBottom: 6,
    lineHeight: 1.5
  },
  labelMobile: { fontSize: 13 },
  textarea: {
    width: '100%',
    minHeight: 80,
    border: '1.5px solid #fde68a',
    borderRadius: 12,
    padding: '11px 14px',
    fontSize: 15,
    lineHeight: 1.7,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#ffffff',
    color: '#1f2937',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s'
  },
  textareaMobile: { minHeight: 72, fontSize: 14, padding: '10px 12px' }
};

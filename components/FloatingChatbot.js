import { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';

const POPUP_CSS = `
  @keyframes chatbot-pop-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes chatbot-slide-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .chatbot-fab:hover { background: var(--color-primary-dark); transform: translateY(-1px); }
  @media (prefers-reduced-motion: reduce) {
    .chatbot-anim { animation: none !important; transition: none !important; }
    .chatbot-fab:hover { transform: none !important; }
  }
`;

/**
 * 우하단 플로팅 챗봇 버튼 + 팝업.
 * 기존 왼쪽 패널 '대화' 탭에 있던 채팅 상태/전송 로직(conversation, chatInput,
 * onSend 등)은 pages/index.js가 그대로 들고 있고, 이 컴포넌트는 그 위에 UI만 얹는다.
 */
export default function FloatingChatbot({
  isOpen, onOpen, onClose,
  conversation, chatInput, setChatInput, onSend,
  isChatLoading, isMobile, topic, t,
}) {
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation, isOpen]);

  useEffect(() => {
    if (isOpen && !isChatLoading && inputRef.current) {
      try { inputRef.current.focus({ preventScroll: true }); }
      catch { inputRef.current.focus(); }
    }
  }, [isOpen, isChatLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    onSend();
  };

  const popupBody = (
    <>
      <div style={s.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.headerTitle}>{t.chatbotTitle}</div>
          {topic && (
            <div style={s.headerTopic}>{topic}</div>
          )}
        </div>
        <button onClick={onClose} aria-label={t.close} style={s.closeBtn}>✕</button>
      </div>

      <div ref={bodyRef} style={{ ...s.body, ...(isMobile ? s.bodyMobile : {}) }}>
        {conversation.map((msg, idx) => (
          <ChatBubble
            key={`${msg.role}-${idx}-${msg.content.slice(0, 10)}`}
            role={msg.role}
            content={msg.content}
            isMobile={isMobile}
          />
        ))}
      </div>

      <div style={s.inputRow}>
        <textarea
          ref={inputRef}
          data-testid="chatbot-input"
          style={{ ...s.textarea, ...(isMobile ? s.textareaMobile : {}) }}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder={t.chatPlaceholder}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          }}
          disabled={isChatLoading}
        />
        <button
          data-testid="chatbot-send-button"
          style={s.sendBtn}
          onClick={handleSubmit}
          disabled={isChatLoading}
        >
          {isChatLoading ? t.sending : t.sendQuestion}
        </button>
      </div>
    </>
  );

  return (
    <>
      <style>{POPUP_CSS}</style>

      {/* 모바일에서 팝업이 열려 있을 때는 바텀시트가 버튼 자리를 덮으므로,
          팝업 헤더의 닫기 버튼과 겹치지 않게 플로팅 버튼을 숨긴다. */}
      {!(isMobile && isOpen) && (
        <button
          type="button"
          data-testid="chatbot-toggle-button"
          aria-label={t.chatbotButtonLabel}
          aria-expanded={isOpen}
          onClick={() => (isOpen ? onClose() : onOpen())}
          className="chatbot-anim chatbot-fab"
          style={{ ...s.fab, ...(isMobile ? s.fabMobile : {}) }}
        >
          <span style={{ fontSize: 20 }}>💬</span>
          {!isMobile && <span style={s.fabLabel}>{t.chatbotButtonLabel}</span>}
        </button>
      )}

      {isOpen && !isMobile && (
        <div
          role="dialog"
          aria-label={t.chatbotTitle}
          data-testid="chatbot-popup"
          className="chatbot-anim"
          style={s.popupDesktop}
        >
          {popupBody}
        </div>
      )}

      {isOpen && isMobile && (
        <>
          <div
            onClick={onClose}
            aria-hidden="true"
            style={s.overlay}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.chatbotTitle}
            data-testid="chatbot-popup"
            className="chatbot-anim"
            style={s.popupMobile}
          >
            {popupBody}
          </div>
        </>
      )}
    </>
  );
}

const s = {
  fab: {
    position: 'fixed', right: 20, bottom: 20, zIndex: 950,
    display: 'flex', alignItems: 'center', gap: 8,
    border: 'none', borderRadius: 999,
    background: 'var(--color-primary)', color: 'var(--color-surface)',
    padding: '13px 18px', cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(var(--color-primary-rgb),0.35)',
    fontWeight: 800, fontSize: 13, transition: 'background 0.15s, transform 0.15s',
  },
  fabMobile: { right: 14, bottom: 14, padding: '13px 15px' },
  fabLabel: { whiteSpace: 'nowrap' },

  overlay: {
    position: 'fixed', inset: 0, zIndex: 945, background: 'rgba(0,0,0,0.3)',
  },

  popupDesktop: {
    position: 'fixed', right: 20, bottom: 84, zIndex: 951,
    width: 360, height: 480, maxHeight: 'calc(100vh - 120px)',
    display: 'flex', flexDirection: 'column',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 18, boxShadow: '0 12px 36px rgba(0,0,0,0.18)', overflow: 'hidden',
    opacity: 1, transform: 'translateY(0) scale(1)',
    animation: 'chatbot-pop-in 180ms ease',
  },
  popupMobile: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 946,
    height: '78vh',
    display: 'flex', flexDirection: 'column',
    background: 'var(--color-surface)',
    borderRadius: '18px 18px 0 0',
    boxShadow: '0 -8px 32px rgba(0,0,0,0.2)', overflow: 'hidden',
    animation: 'chatbot-slide-up 180ms ease',
  },

  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 14px', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-alt)', flexShrink: 0,
  },
  headerTitle: { fontWeight: 900, fontSize: 14, color: 'var(--color-text)' },
  headerTopic: {
    fontSize: 11, color: 'var(--color-text-sub)', marginTop: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  closeBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    borderRadius: 8, width: 28, height: 28, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, padding: 0,
  },

  body: { flex: 1, overflowY: 'auto', padding: 14, background: 'var(--color-bg)' },
  bodyMobile: { padding: 10 },

  inputRow: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: 12, borderTop: '1px solid var(--color-border)', flexShrink: 0,
    background: 'var(--color-surface)',
  },
  textarea: {
    width: '100%', minHeight: 56, maxHeight: 120, border: '1px solid var(--color-border)',
    borderRadius: 12, padding: '10px 12px', fontSize: 14, lineHeight: 1.6,
    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', color: 'var(--color-text)', background: 'var(--color-surface)',
  },
  textareaMobile: { minHeight: 48, fontSize: 16, padding: '10px 12px' },
  sendBtn: {
    border: 'none', background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, padding: '10px 16px', borderRadius: 12,
    cursor: 'pointer', fontSize: 13,
  },
};

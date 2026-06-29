import { useState, useEffect } from 'react';

const STORAGE_KEY = 'mwoyamyeon_help_panel_open';
const HELP_DOC_URL = '/student_instruction.html';

function readStoredOpen() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export default function HelpPanel({ isMobile }) {
  const [open, setOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // 최초 방문이면 펼침, 이전 방문 기록이 있으면 그 상태로 복원
  useEffect(() => {
    setOpen(readStoredOpen());
  }, []);

  // ESC로 전체보기 모달 닫기
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const toggleOpen = () => {
    setOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  };

  return (
    <div style={{ ...styles.wrap, ...(isMobile ? styles.wrapMobile : {}) }}>
      {open ? (
        <div style={{ ...styles.panel, ...(isMobile ? styles.panelMobile : {}) }}>
          <div style={styles.headerBar}>
            <span style={styles.headerTitle}>🔎 역사 자료 찾는 법</span>
            <div style={styles.headerActions}>
              <button style={styles.fullViewBtn} onClick={() => setModalOpen(true)}>
                전체 보기
              </button>
              <button
                style={styles.collapseBtn}
                onClick={toggleOpen}
                aria-label="역사 자료 찾는 법 패널 접기"
                title="패널 접기"
              >
                ✕
              </button>
            </div>
          </div>
          <div style={styles.iframeWrap}>
            <iframe
              src={HELP_DOC_URL}
              title="역사 자료 찾는 법"
              loading="lazy"
              style={styles.iframe}
            />
          </div>
        </div>
      ) : (
        <button
          style={{ ...styles.collapsedTab, ...(isMobile ? styles.collapsedTabMobile : {}) }}
          onClick={toggleOpen}
          aria-label="역사 자료 찾는 법 패널 펼치기"
          title="역사 자료 찾는 법"
        >
          <span style={isMobile ? undefined : styles.collapsedTabText}>🔎 자료 찾는 법</span>
        </button>
      )}

      {modalOpen && (
        <div style={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeaderBar}>
              <span style={styles.headerTitle}>🔎 역사 자료 찾는 법</span>
              <button
                style={styles.collapseBtn}
                onClick={() => setModalOpen(false)}
                aria-label="전체 보기 닫기"
                title="닫기"
              >
                ✕
              </button>
            </div>
            <iframe
              src={HELP_DOC_URL}
              title="역사 자료 찾는 법 (전체 보기)"
              style={styles.modalIframe}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap:       { flexShrink: 0, display: 'flex' },
  wrapMobile: { width: '100%', marginTop: 4 },

  panel: {
    width: 360, height: '100%', minHeight: 480,
    display: 'flex', flexDirection: 'column',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20,
    boxShadow: '0 10px 30px rgba(var(--color-text-rgb),0.06)', overflow: 'hidden',
  },
  panelMobile: { width: '100%', height: 420, minHeight: 0 },

  headerBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-alt)',
  },
  modalHeaderBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-alt)',
  },
  headerTitle: { fontSize: 14, fontWeight: 800, color: 'var(--color-text)' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },

  fullViewBtn: {
    border: '1.5px solid rgba(var(--color-primary-rgb),0.3)', background: 'rgba(var(--color-primary-rgb),0.08)', color: 'var(--color-primary-dark)',
    fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 20,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  collapseBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    width: 26, height: 26, borderRadius: 8, fontSize: 12, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  },

  iframeWrap: { flex: '1 1 auto', minHeight: 0, overflow: 'hidden' },
  iframe: { width: '100%', height: '100%', border: 'none', display: 'block' },

  collapsedTab: {
    width: 44, height: '100%', minHeight: 480,
    background: 'rgba(var(--color-primary-rgb),0.08)', border: '1.5px solid rgba(var(--color-primary-rgb),0.3)', borderRadius: 16,
    color: 'var(--color-primary-dark)', fontWeight: 800, fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  collapsedTabMobile: {
    width: '100%', height: 'auto', minHeight: 0, padding: '10px 14px',
  },
  collapsedTabText: {
    writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: 1,
  },

  modalOverlay: {
    position: 'fixed', inset: 0, zIndex: 300,
    background: 'rgba(var(--color-text-rgb),0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalBox: {
    width: 'min(900px, 100%)', height: 'min(85vh, 880px)',
    background: 'var(--color-surface)', borderRadius: 20, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(var(--color-text-rgb),0.3)',
  },
  modalIframe: { width: '100%', height: '100%', border: 'none', flex: '1 1 auto', display: 'block' },
};

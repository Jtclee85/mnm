export default function SectionCard({ title, icon, children, actions, isMobile }) {
  return (
    <div style={{ ...styles.sectionCard, ...(isMobile ? styles.sectionCardMobile : {}) }}>
      <div style={{ ...styles.sectionHeader, ...(isMobile ? styles.sectionHeaderMobile : {}) }}>
        <div style={{ ...styles.sectionTitle, ...(isMobile ? styles.sectionTitleMobile : {}) }}>
          <span style={{ marginRight: 8 }}>{icon}</span>
          {title}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      <div style={{ ...styles.sectionBody, ...(isMobile ? styles.sectionBodyMobile : {}) }}>
        {children}
      </div>
    </div>
  );
}

const styles = {
  sectionCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
    overflow: 'hidden'
  },
  sectionCardMobile: { borderRadius: 16 },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 18px',
    borderBottom: '1px solid #eef2f7',
    background: '#fcfcff'
  },
  sectionHeaderMobile: { padding: '13px 14px' },
  sectionTitle: { fontSize: 18, fontWeight: 800, color: '#111827' },
  sectionTitleMobile: { fontSize: 16 },
  sectionBody: { padding: 18 },
  sectionBodyMobile: { padding: 14 }
};

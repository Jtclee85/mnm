export default function BulletList({ items, isMobile }) {
  if (!items || items.length === 0) {
    return (
      <p style={{ ...styles.emptyText, ...(isMobile ? styles.emptyTextMobile : {}) }}>
        아직 생성된 내용이 없습니다.
      </p>
    );
  }

  return (
    <ul style={{ ...styles.bulletList, ...(isMobile ? styles.bulletListMobile : {}) }}>
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`} style={{ ...styles.bulletItem, ...(isMobile ? styles.bulletItemMobile : {}) }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

const styles = {
  bulletList: { margin: 0, paddingLeft: 20, color: '#1f2937', lineHeight: 1.8 },
  bulletListMobile: { paddingLeft: 18, fontSize: 14, lineHeight: 1.7 },
  bulletItem: { marginBottom: 6 },
  bulletItemMobile: { marginBottom: 5 },
  emptyText: { margin: 0, color: '#6b7280', lineHeight: 1.7 },
  emptyTextMobile: { fontSize: 14 }
};

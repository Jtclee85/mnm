import { getUiText } from '../lib/i18n';

const SECTIONS = [
  {
    key: '처음',
    icon: '1',
    label: '처음',
    bg: '#f0fdf4',
    border: '#86efac',
    titleColor: '#15803d',
    numBg: '#16a34a'
  },
  {
    key: '가운데',
    icon: '2',
    label: '가운데',
    bg: '#eff6ff',
    border: '#93c5fd',
    titleColor: '#1d4ed8',
    numBg: '#2563eb'
  },
  {
    key: '끝',
    icon: '3',
    label: '끝',
    bg: '#fdf4ff',
    border: '#d8b4fe',
    titleColor: '#7e22ce',
    numBg: '#9333ea'
  }
];

function parseOutlineSections(text) {
  if (!text) return [];
  const result = [];
  for (const section of SECTIONS) {
    const regex = new RegExp(
      `\\[${section.key}\\]([\\s\\S]*?)(?=\\[처음\\]|\\[가운데\\]|\\[끝\\]|$)`
    );
    const match = text.match(regex);
    if (match) {
      const lines = match[1]
        .split(/\r?\n/)
        .map(l => l.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
      result.push({ ...section, lines });
    }
  }
  return result;
}

export default function WritingOutlineCard({ outline, isMobile, t = getUiText('ko') }) {
  if (!outline) {
    return (
      <p style={{ margin: 0, color: '#6b7280', lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
        {t.writingEmpty}
      </p>
    );
  }

  const sections = parseOutlineSections(outline);

  if (sections.length === 0) {
    return (
      <div style={{ color: '#374151', lineHeight: 1.8, fontSize: isMobile ? 14 : 15, whiteSpace: 'pre-line' }}>
        {outline}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
      {sections.map(({ key, icon, label, bg, border, titleColor, numBg, lines }) => {
        const translatedLabel = key === '처음' ? t.writingFirst : key === '가운데' ? t.writingMiddle : key === '끝' ? t.writingEnd : label;
        return (
        <div
          key={key}
          style={{
            background: bg,
            border: `1.5px solid ${border}`,
            borderRadius: 14,
            padding: isMobile ? '12px 14px' : '14px 16px'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10
          }}>
            <span style={{
              width: isMobile ? 22 : 24,
              height: isMobile ? 22 : 24,
              borderRadius: '50%',
              background: numBg,
              color: '#fff',
              fontWeight: 900,
              fontSize: isMobile ? 12 : 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {icon}
            </span>
            <span style={{
              fontWeight: 800,
              fontSize: isMobile ? 14 : 15,
              color: titleColor
            }}>
              {translatedLabel}
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lines.map((line, i) => (
              <li key={i} style={{
                color: '#374151',
                lineHeight: 1.75,
                fontSize: isMobile ? 13 : 14
              }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      );})}
    </div>
  );
}

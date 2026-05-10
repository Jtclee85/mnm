import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { decodeShareData } from '../lib/shareUtils';
import { REFLECTION_FIELDS, MODES } from '../lib/reflectionFields';

export default function SharePage() {
  const router = useRouter();
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const { d } = router.query;
    if (!d) return;
    const decoded = decodeShareData(d);
    if (decoded) {
      setShareData(decoded);
    } else {
      setError(true);
    }
  }, [router.query]);

  return (
    <>
      <Head>
        <title>학생 성찰 공유 — 뭐냐면</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: #fff !important; }
          }
        `}</style>
      </Head>

      <div style={s.page}>
        {/* 헤더 */}
        <div style={s.header}>
          <div style={s.headerInner}>
            <span style={s.logo}>🧒 뭐냐면</span>
            <span style={s.badge}>학생 성찰 공유</span>
          </div>
        </div>

        <div style={s.container}>
          {!router.isReady || (!shareData && !error) ? (
            <p style={s.loading}>불러오는 중...</p>
          ) : error ? (
            <ErrorView />
          ) : (
            <ShareContent data={shareData} />
          )}
        </div>
      </div>
    </>
  );
}

function ShareContent({ data }) {
  const { topic, notes = {}, sharedAt } = data;

  // 작성된 필드가 있는 모드만 추림
  const activeModes = MODES.filter(({ key }) =>
    REFLECTION_FIELDS[key].some(f => notes[f.key]?.trim())
  );

  return (
    <>
      {/* 주제 정보 */}
      <div style={s.topInfo}>
        <div style={s.topLeft}>
          <div style={s.topicLabel}>조사 주제</div>
          <div style={s.topicValue}>{topic || '(제목 없음)'}</div>
        </div>
        {sharedAt && (
          <div style={s.dateText}>작성일 {sharedAt}</div>
        )}
      </div>

      {activeModes.length === 0 ? (
        <div style={s.emptyNote}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 15 }}>
            작성된 성찰 내용이 없습니다.
          </p>
        </div>
      ) : (
        activeModes.map(({ key, label, icon }) => (
          <ModeSection
            key={key}
            modeKey={key}
            modeLabel={label}
            modeIcon={icon}
            notes={notes}
          />
        ))
      )}

      {/* 버튼 영역 */}
      <div style={s.btnRow} className="no-print">
        <button style={s.printBtn} onClick={() => window.print()}>
          🖨 인쇄하기
        </button>
        <button style={s.backBtn} onClick={() => window.close()}>
          ✕ 닫기
        </button>
      </div>

      <p style={{ ...s.notice, }} className="no-print">
        이 페이지는 학생의 성찰 내용을 공유하기 위한 읽기 전용 페이지입니다.
      </p>
    </>
  );
}

function ModeSection({ modeKey, modeLabel, modeIcon, notes }) {
  const fields = REFLECTION_FIELDS[modeKey];
  const filledFields = fields.filter(f => notes[f.key]?.trim());
  if (filledFields.length === 0) return null;

  return (
    <div style={s.modeCard}>
      <div style={s.modeHeader}>
        <span style={s.modeIcon}>{modeIcon}</span>
        <span style={s.modeLabel}>{modeLabel} 성찰</span>
      </div>
      <div style={s.modeBody}>
        {filledFields.map(({ key, label }) => (
          <div key={key} style={s.fieldRow}>
            <div style={s.fieldLabel}>{label}</div>
            <div style={s.fieldValue}>{notes[key]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorView() {
  return (
    <div style={s.errorBox}>
      <p style={{ margin: 0, fontSize: 16, color: '#b91c1c', fontWeight: 700 }}>
        😅 링크를 읽을 수 없어요.
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6b7280' }}>
        공유 링크가 올바른지 확인해 주세요.
      </p>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#fafaf8',
    paddingBottom: 48
  },
  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '14px 20px',
    marginBottom: 28
  },
  headerInner: {
    maxWidth: 720,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  logo: {
    fontSize: 20,
    fontWeight: 900,
    color: '#1d4ed8'
  },
  badge: {
    background: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fde68a',
    borderRadius: 20,
    padding: '3px 12px',
    fontSize: 12,
    fontWeight: 700
  },
  container: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '0 16px'
  },
  loading: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 15,
    marginTop: 60
  },
  topInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    padding: '0 2px'
  },
  topLeft: {},
  topicLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#9ca3af',
    letterSpacing: '0.05em',
    marginBottom: 4
  },
  topicValue: {
    fontSize: 22,
    fontWeight: 900,
    color: '#111827'
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: 600
  },
  modeCard: {
    background: '#fffdf5',
    border: '2px solid #fde68a',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16
  },
  modeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 18px',
    background: '#fef9ee',
    borderBottom: '1px solid #fde68a'
  },
  modeIcon: { fontSize: 18 },
  modeLabel: {
    fontSize: 15,
    fontWeight: 800,
    color: '#92400e'
  },
  modeBody: {
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14
  },
  fieldRow: {},
  fieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#b45309',
    marginBottom: 5
  },
  fieldValue: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 1.75,
    background: '#fff',
    border: '1px solid #fde68a',
    borderRadius: 10,
    padding: '10px 14px',
    whiteSpace: 'pre-wrap'
  },
  emptyNote: {
    padding: '40px 0',
    textAlign: 'center'
  },
  btnRow: {
    display: 'flex',
    gap: 10,
    marginTop: 24,
    marginBottom: 12
  },
  printBtn: {
    border: '1.5px solid #d97706',
    background: '#fef3c7',
    color: '#92400e',
    fontWeight: 800,
    fontSize: 14,
    padding: '10px 20px',
    borderRadius: 12,
    cursor: 'pointer'
  },
  backBtn: {
    border: '1.5px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    fontWeight: 700,
    fontSize: 14,
    padding: '10px 20px',
    borderRadius: 12,
    cursor: 'pointer'
  },
  notice: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8
  },
  errorBox: {
    marginTop: 60,
    textAlign: 'center',
    padding: '32px',
    background: '#fff',
    border: '1px solid #fca5a5',
    borderRadius: 16
  }
};

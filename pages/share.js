import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { decodeShareData } from '../lib/shareUtils';
import { REFLECTION_FIELDS, MODES } from '../lib/reflectionFields';
import { WS_ACTIVITIES_META, WS_ACTIVITY_FIELDS } from '../components/ThinkingWorksheetDrawer';

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
            body { background: var(--color-surface) !important; }
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

      <WorksheetSection notes={notes} />

      {activeModes.length > 0 && (
        <>
          <div style={s.sectionDivider}>기존 성찰 메모</div>
          {activeModes.map(({ key, label, icon }) => (
            <ModeSection
              key={key}
              modeKey={key}
              modeLabel={label}
              modeIcon={icon}
              notes={notes}
            />
          ))}
        </>
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

function WorksheetSection({ notes = {} }) {
  const filledActivities = WS_ACTIVITIES_META
    .map(({ id, label, icon }) => {
      const fields = WS_ACTIVITY_FIELDS[id] || [];
      const filledFields = fields.filter(f => notes[f.key]?.trim());
      return { id, label, icon, filledFields };
    })
    .filter(a => a.filledFields.length > 0);

  if (filledActivities.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={s.wsHeader}>
        <span style={{ fontSize: 20 }}>✏️</span>
        <span style={s.wsTitle}>생각 워크시트</span>
      </div>
      {filledActivities.map(({ id, label, icon, filledFields }) => (
        <div key={id} style={s.wsCard}>
          <div style={s.wsCardHeader}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={s.wsCardLabel}>{label}</span>
          </div>
          <div style={s.modeBody}>
            {filledFields.map(({ key, label: fieldLabel }) => (
              <div key={key} style={s.fieldRow}>
                <div style={s.fieldLabel}>{fieldLabel}</div>
                <div style={s.fieldValue}>{notes[key]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorView() {
  // 오류 상태(빨강)는 의미 전달용이라 그대로 유지
  return (
    <div style={s.errorBox}>
      <p style={{ margin: 0, fontSize: 16, color: '#b91c1c', fontWeight: 700 }}>
        😅 링크를 읽을 수 없어요.
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-sub)' }}>
        공유 링크가 올바른지 확인해 주세요.
      </p>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--color-bg)',
    paddingBottom: 48
  },
  header: {
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
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
    color: 'var(--color-primary-dark)'
  },
  badge: {
    background: 'color-mix(in srgb, var(--color-gold) 30%, var(--color-surface))',
    color: 'var(--color-text)',
    border: '1px solid rgba(var(--color-gold-rgb),0.6)',
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
    color: 'var(--color-text-sub)',
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
    color: 'var(--color-text-sub)',
    letterSpacing: '0.05em',
    marginBottom: 4
  },
  topicValue: {
    fontSize: 22,
    fontWeight: 900,
    color: 'var(--color-text)'
  },
  dateText: {
    fontSize: 12,
    color: 'var(--color-text-sub)',
    fontWeight: 600
  },
  modeCard: {
    background: 'color-mix(in srgb, var(--color-gold) 6%, var(--color-surface))',
    border: '2px solid rgba(var(--color-gold-rgb),0.6)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16
  },
  modeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 18px',
    background: 'color-mix(in srgb, var(--color-gold) 14%, var(--color-surface))',
    borderBottom: '1px solid rgba(var(--color-gold-rgb),0.6)'
  },
  modeIcon: { fontSize: 18 },
  modeLabel: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--color-text)'
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
    color: 'var(--color-text-sub)',
    marginBottom: 5
  },
  fieldValue: {
    fontSize: 15,
    color: 'var(--color-text)',
    lineHeight: 1.75,
    background: 'var(--color-surface)',
    border: '1px solid rgba(var(--color-gold-rgb),0.6)',
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
    border: '1.5px solid color-mix(in srgb, var(--color-gold) 70%, var(--color-text))',
    background: 'color-mix(in srgb, var(--color-gold) 30%, var(--color-surface))',
    color: 'var(--color-text)',
    fontWeight: 800,
    fontSize: 14,
    padding: '10px 20px',
    borderRadius: 12,
    cursor: 'pointer'
  },
  backBtn: {
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontWeight: 700,
    fontSize: 14,
    padding: '10px 20px',
    borderRadius: 12,
    cursor: 'pointer'
  },
  notice: {
    fontSize: 11,
    color: 'var(--color-text-sub)',
    textAlign: 'center',
    marginTop: 8
  },
  sectionDivider: {
    fontSize: 11, fontWeight: 700, color: 'var(--color-text-sub)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    padding: '4px 2px', marginBottom: 12, marginTop: 8,
    borderTop: '1px solid var(--color-border)', paddingTop: 16,
  },
  wsHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginBottom: 14, padding: '0 2px',
  },
  wsTitle: {
    fontSize: 18, fontWeight: 900, color: 'var(--color-text)',
  },
  wsCard: {
    background: 'var(--color-surface)',
    border: '2px solid rgba(var(--color-primary-rgb),0.25)',
    borderRadius: 16, overflow: 'hidden', marginBottom: 14,
  },
  wsCardHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 18px',
    background: 'rgba(var(--color-primary-rgb),0.06)',
    borderBottom: '1px solid rgba(var(--color-primary-rgb),0.15)',
  },
  wsCardLabel: {
    fontSize: 15, fontWeight: 800, color: 'var(--color-primary-dark)',
  },
  // 오류 상태(빨강)는 의미 전달용이라 그대로 유지
  errorBox: {
    marginTop: 60,
    textAlign: 'center',
    padding: '32px',
    background: 'var(--color-surface)',
    border: '1px solid #fca5a5',
    borderRadius: 16
  }
};

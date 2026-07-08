import { useEffect, useState } from 'react';

// 분석 완료 후 좌측 패널 하단에 보여주는 관련 YouTube 영상 추천.
// 보조 기능이므로 실패하면 조용히 섹션을 숨긴다 (alert·큰 오류 표시 금지).
// 데모 모드에서는 API를 호출하지 않고 snapshot의 예시 영상만 사용한다.

const CACHE_PREFIX = 'mnm-recommended-videos:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

function readCache(topic) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${topic}`);
    if (!raw) return null;
    const { videos, savedAt } = JSON.parse(raw);
    if (!Array.isArray(videos) || Date.now() - savedAt > CACHE_TTL_MS) return null;
    return videos;
  } catch {
    return null;
  }
}

function writeCache(topic, videos) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${topic}`, JSON.stringify({ videos, savedAt: Date.now() }));
  } catch {}
}

export default function RecommendedVideos({ topic, sourceText, enabled, demoMode, demoVideos, t, isMobile }) {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const trimmedTopic = (topic || '').trim();

  useEffect(() => {
    if (!enabled || !trimmedTopic) return;

    if (demoMode) {
      setVideos(Array.isArray(demoVideos) ? demoVideos.filter(v => v?.title && v?.url) : []);
      return;
    }

    const cached = readCache(trimmedTopic);
    if (cached) {
      setVideos(cached);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch('/api/recommended-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: trimmedTopic,
        sourceText: (sourceText || '').slice(0, 500),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const list = Array.isArray(data?.videos) ? data.videos : [];
        setVideos(list);
        if (list.length > 0) writeCache(trimmedTopic, list);
      })
      .catch(error => {
        console.warn('[recommended-videos] 불러오기 실패 (섹션 숨김):', error);
        if (!cancelled) setVideos([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
    // sourceText는 보조 힌트일 뿐이라 topic이 같으면 다시 부르지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, trimmedTopic, demoMode]);

  if (!enabled || !trimmedTopic) return null;
  if (!isLoading && videos.length === 0) return null;

  const title = t?.recommendedVideosTitle || '함께 보면 좋은 영상';
  const subtitle = t?.recommendedVideosSubtitle || '조사 주제와 관련된 영상을 골라봤어요.';
  const openLabel = t?.recommendedVideosOpen || 'YouTube에서 보기';
  const loadingLabel = t?.recommendedVideosLoading || '관련 영상을 찾고 있어요...';

  return (
    <aside data-testid="recommended-videos" style={styles.wrap} aria-label={title}>
      <p style={styles.heading}>🎬 {title}</p>
      <p style={styles.subheading}>{subtitle}</p>

      {isLoading ? (
        <div style={styles.list} aria-label={loadingLabel}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ ...styles.card, ...styles.skeletonCard }}>
              <div style={{ ...styles.thumbWrap, ...styles.skeletonBlock }} />
              <div style={styles.textCol}>
                <div style={{ ...styles.skeletonBlock, height: 14, width: '80%' }} />
                <div style={{ ...styles.skeletonBlock, height: 12, width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.list}>
          {videos.map((video, idx) => (
            <a
              key={video.videoId || video.url || idx}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}
              aria-label={`${video.title}, ${video.channelTitle}. 새 탭에서 YouTube가 열립니다.`}
            >
              <span style={{ ...styles.thumbWrap, ...(isMobile ? styles.thumbWrapMobile : {}) }}>
                {video.thumbnailUrl ? (
                  // YouTube 썸네일은 외부 호스트라 next/image 대신 img를 쓴다
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.thumbnailUrl} alt={`${video.title} 썸네일`} style={styles.thumb} loading="lazy" />
                ) : (
                  <span style={styles.thumbPlaceholder} aria-hidden="true">🎬</span>
                )}
              </span>
              <span style={styles.textCol}>
                <span style={styles.title}>{video.title}</span>
                <span style={styles.channel}>{video.channelTitle}</span>
                {video.reason && <span style={styles.reasonBadge}>{video.reason}</span>}
                <span style={styles.openLink}>{openLabel} ↗</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </aside>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 },
  heading: { fontSize: 13, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 0 2px' },
  subheading: { fontSize: 12, color: 'var(--color-text-sub)', margin: '0 0 2px 2px' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },

  card: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14,
    padding: 10, boxSizing: 'border-box',
    textDecoration: 'none', color: 'inherit',
    boxShadow: '0 2px 8px rgba(var(--color-text-rgb),0.08)',
  },
  cardMobile: { flexDirection: 'column', alignItems: 'stretch' },

  thumbWrap: {
    width: 120, height: 68, flexShrink: 0, borderRadius: 10, overflow: 'hidden',
    background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  thumbWrapMobile: { width: '100%', height: 'auto', aspectRatio: '16 / 9' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbPlaceholder: { fontSize: 24 },

  textCol: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 },
  title: {
    fontSize: 13, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.4,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  channel: {
    fontSize: 12, color: 'var(--color-text-sub)', fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  reasonBadge: {
    alignSelf: 'flex-start', fontSize: 11, fontWeight: 700,
    color: 'var(--color-text)', lineHeight: 1.4,
    background: 'color-mix(in srgb, var(--color-accent-teal) 14%, var(--color-surface))',
    border: '1px solid color-mix(in srgb, var(--color-accent-teal) 50%, var(--color-border))',
    borderRadius: 8, padding: '2px 8px',
  },
  openLink: { fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginTop: 1 },

  skeletonCard: { pointerEvents: 'none' },
  skeletonBlock: { background: 'var(--color-border)', borderRadius: 8, opacity: 0.5 },
};

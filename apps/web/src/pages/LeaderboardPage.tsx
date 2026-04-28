import { useTranslation } from 'react-i18next';
import { Spinner } from '../components/common/Spinner';
import { useEntLeaderboard } from '../api/hooks/useTests';
import { formatDuration } from '../lib/formatDuration';
import type { EntLeaderboardRow } from '../api/types';

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function TrophyIcon({ rank }: { rank: number }) {
  const colors: Record<number, string> = { 1: '#f59e0b', 2: '#94a3b8', 3: '#d97706' };
  const color = colors[rank] ?? 'var(--text-muted)';
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill={color} stroke="none">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM5 5H3v2a4 4 0 0 0 4 4M19 5h2v2a4 4 0 0 1-4 4" />
    </svg>
  );
}

function MedalBadge({ rank }: { rank: number }) {
  const labels: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  return (
    <span className="lb-rank-badge" style={{ fontSize: 18 }} aria-label={`Место ${rank}`}>
      {labels[rank] ?? rank}
    </span>
  );
}

function TopThreePodium({ rows }: { rows: EntLeaderboardRow[] }) {
  const { t } = useTranslation();
  const top3 = rows.slice(0, 3);
  if (top3.length < 3) return null;

  const podiumOrder = [top3[1], top3[0], top3[2]];
  const heights = ['80px', '110px', '60px'];
  const podiumRank = [2, 1, 3];

  return (
    <div className="lb-podium">
      {podiumOrder.map((row, i) => {
        const raw = Math.round(row.rawScore);
        const subjects = row.profileSubjects ?? [];
        return (
          <div key={row.userId} className={`lb-podium-item lb-podium-item--${podiumRank[i]}`}>
            <div className="lb-podium-avatar">
              {row.displayName[0]?.toUpperCase() ?? 'M'}
            </div>
            <div className="lb-podium-name">
              {row.userId === rows[0]?.userId ? t('leaderboard.youLabel', { name: row.displayName }) : row.displayName}
            </div>
            {subjects.length > 0 && (
              <div className="lb-podium-subjects">
                {subjects.slice(0, 2).map((s) => (
                  <span key={s} className="lb-subject-chip">{s}</span>
                ))}
              </div>
            )}
            <div className="lb-podium-score">{raw}</div>
            <div className="lb-podium-bar" style={{ height: heights[i] }} />
            <div className="lb-podium-label">
              <MedalBadge rank={podiumRank[i]} />
              <span>#{podiumRank[i]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeaderboardRow({
  row,
  isMe,
  locale,
}: {
  row: EntLeaderboardRow;
  isMe: boolean;
  locale: string;
}) {
  const { t } = useTranslation();
  const raw = Math.round(row.rawScore);
  const pct = Math.round(row.score);
  const duration = formatDuration(row.durationSecs, t('leaderboard.noValue'));
  const subjects = row.profileSubjects ?? [];

  return (
    <div className={`lb-row${isMe ? ' lb-row--me' : ''}`}>
      <div className="lb-row-rank">
        {row.rank <= 3 ? (
          <TrophyIcon rank={row.rank} />
        ) : (
          <span className="lb-row-rank-num">#{row.rank}</span>
        )}
      </div>
      <div className="lb-row-user">
        <span className="lb-row-avatar">{row.displayName[0]?.toUpperCase() ?? 'M'}</span>
        <div className="lb-row-info">
          <strong>{isMe ? t('leaderboard.youLabel', { name: row.displayName }) : row.displayName}</strong>
          {subjects.length > 0 && (
            <span className="lb-row-subjects">
              {subjects.slice(0, 2).join(' + ')}
            </span>
          )}
          {row.telegramUsername && <span>@{row.telegramUsername}</span>}
        </div>
      </div>
      <div className="lb-row-score">
        <strong className="lb-row-score-num">{raw}</strong>
        <span className="lb-row-score-pct">{pct}%</span>
      </div>
      <div className="lb-row-meta">
        <span>{duration}</span>
        <span>{formatDate(row.finishedAt, locale, t('leaderboard.noValue'))}</span>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, error } = useEntLeaderboard(50);
  const locale = i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-US' : 'ru-RU';
  const rows = data?.items ?? [];
  const myUserId = data?.me?.userId ?? null;

  const myEntry = data?.me;
  const topScore = rows[0] ?? null;

  if (isLoading) return <Spinner fullScreen />;

  const myRaw = myEntry ? Math.round(myEntry.rawScore) : null;
  const myPct = myEntry ? Math.round(myEntry.score) : null;

  return (
    <div className="page lb-page">
      <header className="lb-header">
        <div className="lb-header-top">
          <div>
            <p className="lb-kicker">{t('leaderboard.kicker')}</p>
            <h1 className="lb-title">{t('leaderboard.title')}</h1>
          </div>
          {topScore && (
            <div className="lb-best-badge">
              <span className="lb-best-label">{t('leaderboard.record')}</span>
              <strong>{Math.round(topScore.rawScore)}</strong>
            </div>
          )}
        </div>

        {myEntry && (
          <div className="lb-me-card">
            <div className="lb-me-left">
              <span className="lb-me-rank">#{myEntry.rank}</span>
              <div className="lb-me-info">
                <strong>{t('leaderboard.yourResult')}</strong>
                <span>{myEntry.displayName}</span>
              </div>
            </div>
            <div className="lb-me-score">
              <span className="lb-me-score-num">{myRaw}</span>
              <span className="lb-me-score-pct">{myPct}%</span>
            </div>
          </div>
        )}
      </header>

      {error ? (
        <div className="surface lb-state">
          <strong>{t('leaderboard.error')}</strong>
        </div>
      ) : rows.length === 0 ? (
        <div className="surface lb-state">
          <strong>{t('leaderboard.emptyTitle')}</strong>
          <span>{t('leaderboard.emptyText')}</span>
        </div>
      ) : (
        <>
          {rows.length >= 3 && <TopThreePodium rows={rows} />}

          <section className="lb-board" aria-label={t('leaderboard.listAria')}>
            <div className="lb-board-head">
              <span>{t('leaderboard.topCount', { count: rows.length })}</span>
            </div>
            <div className="lb-list">
              {rows.map((row) => (
                <LeaderboardRow
                  key={row.userId}
                  row={row}
                  isMe={row.userId === myUserId}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
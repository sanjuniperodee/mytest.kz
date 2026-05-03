import { useTranslation } from 'react-i18next';
import { Spinner } from '../components/common/Spinner';
import { useEntLeaderboard } from '../api/hooks/useTests';
import type { EntLeaderboardRow } from '../api/types';

const ENT_MAX_SCORE = 140;

function TrophyIcon({ rank, size = 20 }: { rank: number; size?: number }) {
  const colors: Record<number, string> = { 1: '#f59e0b', 2: '#94a3b8', 3: '#d97706' };
  const color = colors[rank] ?? 'currentColor';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M5 5H3v2a4 4 0 0 0 4 4" />
      <path d="M19 5h2v2a4 4 0 0 1-4 4" />
    </svg>
  );
}

function MedalBadge({ rank }: { rank: number }) {
  const labels: Record<number, string> = { 1: '1', 2: '2', 3: '3' };
  return (
    <span className={`lb-rank-badge lb-rank-badge--${rank}`} aria-label={`#${rank}`}>
      {rank <= 3 ? (
        <>
          <TrophyIcon rank={rank} size={14} />
          <span>{labels[rank]}</span>
        </>
      ) : labels[rank] ?? rank}
    </span>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[1][0]] : [parts[0]?.[0]];
  return letters.join('').toUpperCase() || 'M';
}

function LeaderboardAvatar({
  row,
  className,
}: {
  row: Pick<EntLeaderboardRow, 'displayName' | 'avatarUrl'>;
  className: string;
}) {
  return (
    <span className={`${className}${row.avatarUrl ? ' lb-avatar--image' : ''}`}>
      {row.avatarUrl ? (
        <img src={row.avatarUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        getInitials(row.displayName)
      )}
    </span>
  );
}

function getScorePercent(row: EntLeaderboardRow) {
  const max = row.maxScore || ENT_MAX_SCORE;
  return Math.min(100, Math.max(0, Math.round((row.rawScore / max) * 100)));
}

function getScoreTone(row: EntLeaderboardRow) {
  const pct = getScorePercent(row);
  if (pct >= 80) return 'high';
  if (pct >= 60) return 'mid';
  return 'base';
}

function TopThreePodium({ rows, myUserId }: { rows: EntLeaderboardRow[]; myUserId: string | null }) {
  const { t } = useTranslation();
  const top3 = rows.slice(0, 3);
  if (top3.length < 3) return null;

  const podiumOrder = [top3[1], top3[0], top3[2]];
  const podiumRank = [2, 1, 3];

  return (
    <div className="lb-podium">
      {podiumOrder.map((row, i) => {
        const raw = Math.round(row.rawScore);
        const subjects = row.profileSubjects ?? [];
        return (
          <div key={row.userId} className={`lb-podium-item lb-podium-item--${podiumRank[i]}`}>
            <div className="lb-podium-rank">
              <MedalBadge rank={podiumRank[i]} />
            </div>
            <LeaderboardAvatar row={row} className="lb-podium-avatar" />
            <div className="lb-podium-name">
              {row.userId === myUserId ? t('leaderboard.youLabel', { name: row.displayName }) : row.displayName}
            </div>
            {subjects.length > 0 && (
              <div className="lb-podium-subjects">
                {subjects.slice(0, 2).map((s) => (
                  <span key={s} className="lb-subject-chip">{s}</span>
                ))}
              </div>
            )}
            <div className="lb-podium-score">
              <strong>{raw}</strong>
              <span>{t('leaderboard.maxScore', { value: row.maxScore || ENT_MAX_SCORE })}</span>
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
}: {
  row: EntLeaderboardRow;
  isMe: boolean;
}) {
  const { t } = useTranslation();
  const raw = Math.round(row.rawScore);
  const subjects = row.profileSubjects ?? [];
  const pct = getScorePercent(row);
  const tone = getScoreTone(row);

  return (
    <div className={`lb-row lb-row--${tone}${isMe ? ' lb-row--me' : ''}`}>
      <div className="lb-row-rank">
        {row.rank <= 3 ? (
          <MedalBadge rank={row.rank} />
        ) : (
          <span className="lb-row-rank-num">#{row.rank}</span>
        )}
      </div>
      <div className="lb-row-user">
        <LeaderboardAvatar row={row} className="lb-row-avatar" />
        <div className="lb-row-info">
          <strong>{isMe ? t('leaderboard.youLabel', { name: row.displayName }) : row.displayName}</strong>
          {subjects.length > 0 && (
            <span className="lb-row-subjects">
              {subjects.slice(0, 2).join(' + ')}
            </span>
          )}
        </div>
      </div>
      <div className="lb-row-score">
        <strong className="lb-row-score-num">{raw}</strong>
        <span className="lb-row-score-max">{t('leaderboard.maxScore', { value: row.maxScore || ENT_MAX_SCORE })}</span>
      </div>
      <div className="lb-row-progress" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useEntLeaderboard(10);
  const rows = data?.items ?? [];
  const myUserId = data?.me?.userId ?? null;

  const myEntry = data?.me;
  const topScore = rows[0] ?? null;

  if (isLoading) return <Spinner fullScreen />;

  const myRaw = myEntry ? Math.round(myEntry.rawScore) : null;
  const topRaw = topScore ? Math.round(topScore.rawScore) : null;

  return (
    <div className="page lb-page">
      <header className="lb-header">
        <div className="lb-hero">
          <div className="lb-hero-copy">
            <p className="lb-kicker">{t('leaderboard.kicker')}</p>
            <h1 className="lb-title">{t('leaderboard.title')}</h1>
            <p className="lb-subtitle">{t('leaderboard.subtitle')}</p>
          </div>
          <div className="lb-hero-stats" aria-label={t('leaderboard.listAria')}>
            <div className="lb-stat-card lb-stat-card--record">
              <span>{t('leaderboard.record')}</span>
              <strong>{topRaw ?? t('leaderboard.noValue')}</strong>
              <small>{t('leaderboard.maxScore', { value: topScore?.maxScore || ENT_MAX_SCORE })}</small>
            </div>
            <div className="lb-stat-card">
              <span>{t('leaderboard.participants')}</span>
              <strong>{rows.length}</strong>
              <small>{t('leaderboard.kicker')}</small>
            </div>
          </div>
        </div>

        <div className={`lb-me-card${myEntry ? '' : ' lb-me-card--empty'}`}>
          {myEntry ? (
            <>
              <div className="lb-me-left">
                <span className="lb-me-rank">#{myEntry.rank}</span>
                <div className="lb-me-info">
                  <strong>{t('leaderboard.yourResult')}</strong>
                  <span>{myEntry.displayName}</span>
                </div>
              </div>
              <div className="lb-me-score">
                <span className="lb-me-score-num">{myRaw}</span>
                <span className="lb-me-score-pct">{t('leaderboard.maxScore', { value: myEntry.maxScore || ENT_MAX_SCORE })}</span>
              </div>
            </>
          ) : (
            <>
              <div className="lb-me-left">
                <span className="lb-me-rank">{t('leaderboard.noRank')}</span>
                <div className="lb-me-info">
                  <strong>{t('leaderboard.yourResult')}</strong>
                  <span>{t('leaderboard.noRankHint')}</span>
                </div>
              </div>
            </>
          )}
        </div>
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
          {rows.length >= 3 && <TopThreePodium rows={rows} myUserId={myUserId} />}

          <section className="lb-board" aria-label={t('leaderboard.listAria')}>
            <div className="lb-board-head">
              <span>{t('leaderboard.topCount', { count: rows.length })}</span>
              <span>{t('leaderboard.maxScore', { value: ENT_MAX_SCORE })}</span>
            </div>
            <div className="lb-list">
              {rows.map((row) => (
                <LeaderboardRow
                  key={row.userId}
                  row={row}
                  isMe={row.userId === myUserId}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

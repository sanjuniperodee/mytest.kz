import { useMemo } from 'react';
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

function rankClass(rank: number) {
  if (rank === 1) return 'leaderboard-rank leaderboard-rank--gold';
  if (rank === 2) return 'leaderboard-rank leaderboard-rank--silver';
  if (rank === 3) return 'leaderboard-rank leaderboard-rank--bronze';
  return 'leaderboard-rank';
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
  const percent = Number.isFinite(row.score) ? Math.round(row.score) : 0;

  return (
    <div className={`leaderboard-row${isMe ? ' leaderboard-row--me' : ''}`}>
      <div className={rankClass(row.rank)}>{row.rank}</div>
      <div className="leaderboard-student">
        <strong>{isMe ? t('leaderboard.youName', { name: row.displayName }) : row.displayName}</strong>
        {row.telegramUsername ? <span>@{row.telegramUsername}</span> : null}
      </div>
      <div className="leaderboard-score">
        <strong>{t('leaderboard.points', { raw: row.rawScore, max: row.maxScore })}</strong>
        <span>{t('leaderboard.percent', { value: percent })}</span>
      </div>
      <div className="leaderboard-meta">
        <span>{formatDuration(row.durationSecs, t('leaderboard.noValue'))}</span>
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

  const topScore = useMemo(() => rows[0] ?? null, [rows]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <div className="page leaderboard-page">
      <header className="page-hero leaderboard-hero">
        <div className="page-header">
          <p className="leaderboard-kicker">{t('leaderboard.kicker')}</p>
          <h1 className="page-title">{t('leaderboard.title')}</h1>
          <p className="page-subtitle">{t('leaderboard.subtitle')}</p>
        </div>

        <div className="leaderboard-summary-grid">
          <section className="leaderboard-summary-card">
            <span>{t('leaderboard.myPlace')}</span>
            {data?.me ? (
              <>
                <strong>#{data.me.rank}</strong>
                <small>{t('leaderboard.points', { raw: data.me.rawScore, max: data.me.maxScore })}</small>
              </>
            ) : (
              <>
                <strong>{t('leaderboard.noRank')}</strong>
                <small>{t('leaderboard.noRankHint')}</small>
              </>
            )}
          </section>
          <section className="leaderboard-summary-card">
            <span>{t('leaderboard.bestResult')}</span>
            {topScore ? (
              <>
                <strong>{t('leaderboard.points', { raw: topScore.rawScore, max: topScore.maxScore })}</strong>
                <small>{topScore.displayName}</small>
              </>
            ) : (
              <>
                <strong>{t('leaderboard.noValue')}</strong>
                <small>{t('leaderboard.emptyShort')}</small>
              </>
            )}
          </section>
        </div>
      </header>

      {error ? (
        <div className="surface leaderboard-state">{t('leaderboard.error')}</div>
      ) : rows.length === 0 ? (
        <div className="surface leaderboard-state">
          <strong>{t('leaderboard.emptyTitle')}</strong>
          <span>{t('leaderboard.emptyText')}</span>
        </div>
      ) : (
        <section className="surface leaderboard-board" aria-label={t('leaderboard.listAria')}>
          <div className="leaderboard-board-head">
            <h2 className="section-title">{t('leaderboard.topTitle')}</h2>
            <span>{t('leaderboard.topCount', { count: rows.length })}</span>
          </div>
          <div className="leaderboard-list">
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
      )}
    </div>
  );
}

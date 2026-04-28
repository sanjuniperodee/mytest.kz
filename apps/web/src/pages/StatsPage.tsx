import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../components/common/Spinner';
import { useUserStats } from '../api/hooks/useProfile';
import { useMistakesSummary, useSessions } from '../api/hooks/useTests';
import type { TestSession, UserExamStats } from '../api/types';
import { EXAM_GRADIENTS, ExamTileIcon } from '../lib/examVisuals';
import { localizedText } from '../lib/localizedText';

type StatusFilter = 'all' | 'in_progress' | 'completed' | 'timed_out';

function scoreTone(pct: number): string {
  if (pct >= 80) return 'var(--success-light)';
  if (pct >= 50) return 'var(--warning-light)';
  return 'var(--error-light)';
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

import { formatDuration } from '../lib/formatDuration';

function getSessionScore(session: TestSession, fallback: string) {
  const raw = toNumber(session.rawScore);
  const max = toNumber(session.maxScore);
  const correct = toNumber(session.correctCount);
  if (raw != null && max != null && max > 0) {
    return {
      label: `${Math.round(raw)}/${Math.round(max)}`,
      pct: (raw / max) * 100,
    };
  }
  if (correct != null && session.totalQuestions > 0) {
    return {
      label: `${Math.round(correct)}/${session.totalQuestions}`,
      pct: (correct / session.totalQuestions) * 100,
    };
  }
  const pct = toNumber(session.score);
  if (pct != null) return { label: `${Math.round(pct)}%`, pct };
  return { label: fallback, pct: 0 };
}

function isFullEnt(session: TestSession) {
  return session.examType?.slug === 'ent' && session.metadata?.entScope === 'full';
}

function sessionSort(a: TestSession, b: TestSession) {
  if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
  if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
  const aDate = new Date(a.finishedAt ?? a.startedAt).getTime();
  const bDate = new Date(b.finishedAt ?? b.startedAt).getTime();
  return bDate - aDate;
}

export function StatsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useUserStats();
  const { data: mistakesSummary } = useMistakesSummary();
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const exams = stats?.byExamType ?? [];

  useEffect(() => {
    if (!activeExamId && exams.length > 0) {
      setActiveExamId(exams[0].examTypeId);
    }
  }, [activeExamId, exams]);

  const activeExam = exams.find((exam) => exam.examTypeId === activeExamId) ?? exams[0] ?? null;
  const activeMistakes = mistakesSummary?.openByExam.find(
    (row) => row.examTypeId === activeExam?.examTypeId,
  )?.count ?? 0;
  const sessionsQuery = useSessions(1, {
    limit: 100,
    examTypeId: activeExam?.examTypeId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    enabled: !!activeExam?.examTypeId,
  });

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-GB' : 'ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    [i18n.language],
  );

  const sessions = useMemo(
    () => [...(sessionsQuery.data?.items ?? [])].sort(sessionSort),
    [sessionsQuery.data?.items],
  );

  const examTitle = (exam: UserExamStats) =>
    localizedText(exam.examType?.name, i18n.language) ||
    t(`profile.examNames.${exam.examSlug}`, { defaultValue: exam.examSlug.toUpperCase() });

  const bestValue = activeExam?.bestRawScore != null && activeExam.bestMaxScore != null
    ? t('stats.points', { raw: activeExam.bestRawScore, max: activeExam.bestMaxScore })
    : activeExam?.bestScore != null
      ? t('stats.percent', { value: Math.round(activeExam.bestScore) })
      : t('stats.emptyValue');

  const avgValue = activeExam?.averageScore != null
    ? t('stats.percent', { value: Math.round(activeExam.averageScore) })
    : t('stats.emptyValue');

  if (statsLoading) return <Spinner fullScreen />;

  return (
    <div className="page stats-page">
      <header className="stats-header">
        <div>
          <h1 className="page-title">{t('stats.title')}</h1>
          <p className="page-subtitle">{t('stats.subtitle')}</p>
        </div>
      </header>

      {exams.length === 0 ? (
        <section className="surface stats-empty">
          <strong>{t('stats.noExamsTitle')}</strong>
          <span>{t('stats.noExamsText')}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/app')}>
            {t('profile.startPractice')}
          </button>
        </section>
      ) : (
        <>
          <nav className="stats-tabs" aria-label={t('stats.tabsAria')}>
            {exams.map((exam) => {
              const active = exam.examTypeId === activeExam?.examTypeId;
              const grad = EXAM_GRADIENTS[exam.examSlug] || 'linear-gradient(135deg, var(--accent), var(--accent-hover))';
              return (
                <button
                  key={exam.examTypeId}
                  type="button"
                  className={`stats-tab${active ? ' active' : ''}`}
                  onClick={() => {
                    setActiveExamId(exam.examTypeId);
                    setStatusFilter('all');
                  }}
                >
                  <span className="stats-tab-dot" style={{ background: grad }} aria-hidden />
                  <span>{examTitle(exam)}</span>
                  <small>{exam.totalSessionsCount ?? exam.testsCount + exam.inProgressCount}</small>
                </button>
              );
            })}
          </nav>

          {activeExam && (
            <>
              <section className="surface stats-overview">
                <div className="stats-overview-title">
                  <ExamTileIcon
                    slug={activeExam.examSlug}
                    wrapperClassName="stats-overview-icon"
                    rasterWrapperClassName="stats-overview-icon--raster"
                  />
                  <div>
                    <span>{t('stats.currentExam')}</span>
                    <strong>{examTitle(activeExam)}</strong>
                  </div>
                </div>
                <div className="stats-metric-grid">
                  <div className="stats-metric">
                    <span>{t('stats.totalAttempts')}</span>
                    <strong>{activeExam.totalSessionsCount ?? activeExam.testsCount + activeExam.inProgressCount}</strong>
                  </div>
                  <div className="stats-metric">
                    <span>{t('stats.completed')}</span>
                    <strong>{activeExam.testsCount}</strong>
                  </div>
                  <div className="stats-metric">
                    <span>{t('stats.best')}</span>
                    <strong>{bestValue}</strong>
                  </div>
                  <div className="stats-metric">
                    <span>{t('stats.average')}</span>
                    <strong>{avgValue}</strong>
                  </div>
                  <div className="stats-metric">
                    <span>{t('stats.avgDuration')}</span>
                    <strong>{formatDuration(activeExam.averageDurationSecs, t('stats.emptyValue'))}</strong>
                  </div>
                  <div className="stats-metric">
                    <span>{t('stats.openMistakes')}</span>
                    <strong>{activeMistakes}</strong>
                  </div>
                </div>
              </section>

              <section className="surface stats-history">
                <div className="stats-history-head">
                  <div>
                    <h2 className="section-title">{t('stats.historyTitle')}</h2>
                    <p>{t('stats.historySubtitle')}</p>
                  </div>
                  <div className="stats-filter" role="tablist" aria-label={t('stats.statusFilterAria')}>
                    {(['all', 'in_progress', 'completed', 'timed_out'] as StatusFilter[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={statusFilter === status ? 'active' : ''}
                        onClick={() => setStatusFilter(status)}
                      >
                        {t(`stats.statusFilter.${status}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {sessionsQuery.isLoading ? (
                  <div className="stats-history-loading">{t('stats.loading')}</div>
                ) : sessions.length === 0 ? (
                  <div className="stats-history-empty">{t('stats.noSessions')}</div>
                ) : (
                  <div className="stats-session-list">
                    {sessions.map((session) => {
                      const score = getSessionScore(session, t('stats.emptyValue'));
                      const title = localizedText(session.examType?.name, i18n.language) || examTitle(activeExam);
                      const isActive = session.status === 'in_progress';
                      const date = dateFmt.format(new Date(session.finishedAt ?? session.startedAt));
                      return (
                        <button
                          key={session.id}
                          type="button"
                          className="stats-session-row"
                          onClick={() =>
                            navigate(isActive ? `/test/${session.id}` : `/test/${session.id}/review`, {
                              state: { from: '/stats' },
                            })
                          }
                        >
                          <ExamTileIcon
                            slug={session.examType?.slug ?? activeExam.examSlug}
                            wrapperClassName="stats-session-icon"
                            rasterWrapperClassName="stats-session-icon--raster"
                          />
                          <div className="stats-session-main">
                            <strong>{title}</strong>
                            <span>
                              {date}
                              {session.totalQuestions > 0 ? ` · ${t('profile.questionsShort', { count: session.totalQuestions })}` : ''}
                            </span>
                            <div className="stats-session-tags">
                              <span className={`stats-status stats-status--${session.status}`}>
                                {t(`stats.status.${session.status}`)}
                              </span>
                              {isFullEnt(session) ? <span className="stats-status stats-status--full">{t('stats.fullEnt')}</span> : null}
                              {session.metadata?.kind === 'remediation' ? <span className="stats-status">{t('mistakes.reviewBadge')}</span> : null}
                            </div>
                          </div>
                          <div className="stats-session-result">
                            <strong style={{ color: scoreTone(score.pct) }}>{score.label}</strong>
                            <span>{isActive ? t('stats.continue') : t('stats.review')}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

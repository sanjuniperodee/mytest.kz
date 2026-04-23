import { useMemo, useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useProfile, useUserStats } from '../api/hooks/useProfile';
import { useSessions, useMistakesSummary } from '../api/hooks/useTests';
import { useExamTypes } from '../api/hooks/useExams';
import { Spinner } from '../components/common/Spinner';
import { localizedText } from '../lib/localizedText';
import { EXAM_GRADIENTS, ExamTileIcon } from '../lib/examVisuals';

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" aria-hidden>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  );
}

function IconMistakes() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="profile-chevron" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function MiniScoreRing({ value, size = 48 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const dash = (pct / 100) * c;
  const color = pct >= 80 ? 'var(--success-light)' : pct >= 50 ? 'var(--warning-light)' : 'var(--error-light)';
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="profile-mini-ring" aria-hidden>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
      </g>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="profile-mini-ring-text">
        {Math.round(pct)}
      </text>
    </svg>
  );
}

function scoreTone(pct: number): string {
  if (pct >= 80) return 'var(--success-light)';
  if (pct >= 50) return 'var(--warning-light)';
  return 'var(--error-light)';
}

function coerceNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDurationSecs(secs: number, t: TFunction) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0 && s > 0) return t('profile.durationMinSec', { m, s });
  if (m > 0) return t('profile.durationMin', { m });
  return t('profile.durationSec', { s });
}

function formatCountdown(targetIso: string | null | undefined, nowMs: number): string | null {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = Math.max(0, target - nowMs);
  const totalSec = Math.floor(diff / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function ProfileExamTrend({ scores, label }: { scores: number[]; label: string }) {
  if (scores.length < 2) return null;
  const maxH = 28;
  return (
    <div className="profile-exam-trend" role="img" aria-label={label}>
      {scores.map((s, i) => (
        <div key={`${i}-${s}`} className="profile-exam-trend-bar-wrap">
          <div
            className="profile-exam-trend-bar"
            style={{
              height: `${Math.max(3, (s / 100) * maxH)}px`,
              background: scoreTone(s),
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: stats, isLoading: statsLoading } = useUserStats();
  const { data: examTypes } = useExamTypes();
  const { data: sessionsData } = useSessions(1);
  const { data: mistakesSummary } = useMistakesSummary();
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-GB' : 'ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    [i18n.language],
  );

  const getExamLabel = useCallback(
    (slug: string) => t(`profile.examNames.${slug}`, { defaultValue: slug.toUpperCase() }),
    [t],
  );

  if (profileLoading || statsLoading) return <Spinner fullScreen />;

  const sessions = sessionsData?.items || [];
  const sessionsTotal = sessionsData?.total ?? sessions.length;
  const avgScore = stats?.averageScore ? Math.round(stats.averageScore) : 0;
  const bestScores = (stats?.byExamType ?? [])
    .map((e) => e.bestScore)
    .filter((x): x is number => x != null);
  const bestScorePct = bestScores.length ? Math.round(Math.max(...bestScores)) : 0;
  const examsWithPoints = (stats?.byExamType ?? []).filter(
    (e) =>
      e.bestScore != null &&
      Math.round(e.bestScore) === bestScorePct &&
      e.bestRawScore != null &&
      e.bestMaxScore != null &&
      e.bestMaxScore > 0,
  );
  const globalBestPoints =
    examsWithPoints.length > 0
      ? examsWithPoints.reduce((a, b) =>
          (b.bestRawScore ?? 0) > (a.bestRawScore ?? 0) ? b : a,
        )
      : null;
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
    || (profile?.telegramUsername ? `@${profile.telegramUsername}` : null)
    || t('profile.guestName');

  const openPremium = () => navigate('/paywall');
  const entExam = examTypes?.find((exam) => exam.slug === 'ent');
  const entAccess = profile?.accessByExam?.find((x) => x.examSlug === 'ent');
  const entTrial = profile?.trialStatus?.ent;
  const hasPremium =
    profile?.hasActiveSubscription === true ||
    (entAccess?.hasPaidTier === true && (entAccess?.hasAccess ?? false));
  const dailyBlocked = entAccess?.reasonCode === 'DAILY_LIMIT_REACHED';
  const dailyCountdown = formatCountdown(entAccess?.nextAllowedAt, nowMs);
  const entTotalRemainingFromAccess =
    entAccess?.total.remaining != null ? Math.max(0, entAccess.total.remaining) : null;
  const entTotalRemaining = Math.max(
    0,
    entTotalRemainingFromAccess ?? entTrial?.totalRemaining ?? entTrial?.remaining ?? 0,
  );
  const entFreeRemaining = Math.max(
    0,
    entTrial?.freeRemaining ?? entTrial?.remaining ?? 0,
  );
  const entPaidTrialRemaining = Math.max(0, entTrial?.paidTrialRemaining ?? 0);
  const trialExhausted = !hasPremium && !dailyBlocked && entTotalRemaining <= 0;
  const trialSubtitle = hasPremium
    ? t('profile.trialCtaPremium')
    : dailyBlocked
      ? t('profile.dailyLimitReached', { countdown: dailyCountdown ?? '--:--:--' })
    : entTotalRemaining > 0
      ? entPaidTrialRemaining > 0 && entFreeRemaining > 0
        ? t('profile.trialCtaMixed', {
            total: entTotalRemaining,
            free: entFreeRemaining,
            paid: entPaidTrialRemaining,
          })
        : entPaidTrialRemaining > 0
          ? t('profile.trialCtaPaidTrialOnly', { count: entPaidTrialRemaining })
          : t('profile.trialCtaRemaining', { count: entTotalRemaining })
      : t('profile.trialCtaExhausted');
  const trialActionLabel = hasPremium
    ? t('profile.trialPremiumAction')
    : dailyBlocked
      ? t('profile.trialOpenPlans')
      : trialExhausted
      ? t('profile.trialOpenPlans')
      : t('profile.trialStart');

  return (
    <div className="page profile-page">
      <header className="profile-hero surface">
        <div className="profile-hero-glow" aria-hidden />
        <div className="profile-hero-main">
          <div
            className="avatar avatar-lg profile-hero-avatar"
            style={{
              background: 'linear-gradient(145deg, var(--accent-light), var(--accent-hover))',
              boxShadow: '0 8px 28px var(--accent-glow)',
            }}
          >
            <span className="avatar-ring" />
            {(displayName[0] || 'B').toUpperCase()}
          </div>
          <div className="profile-hero-copy">
            <p className="profile-hero-kicker">{t('profile.title')}</p>
            <h1 className="profile-hero-name">{displayName}</h1>
            {profile?.telegramUsername && !displayName.startsWith('@') && (
              <span className="profile-hero-handle">@{profile.telegramUsername}</span>
            )}
            <div className="profile-hero-chips">
              {profile?.hasActiveSubscription ? (
                <span className="badge badge-success profile-premium-badge">
                  <StarIcon /> {t('profile.premium')}
                </span>
              ) : (
                <button type="button" onClick={openPremium} className="btn btn-primary btn-xs profile-premium-cta">
                  <StarIcon /> {t('profile.getPremium')}
                </button>
              )}
            </div>
          </div>
        </div>
        <nav className="profile-quick-nav" aria-label={t('profile.quickNavAria')}>
          <Link to="/app" className="profile-quick-btn">
            <IconHome />
            <span>{t('profile.toHome')}</span>
          </Link>
          <Link to="/mistakes" className="profile-quick-btn profile-quick-btn-mistakes">
            <IconMistakes />
            <span>{t('mistakes.navShort')}</span>
            {(mistakesSummary?.openTotal ?? 0) > 0 && (
              <span className="profile-quick-badge">{mistakesSummary!.openTotal}</span>
            )}
          </Link>
          <Link to="/settings" className="profile-quick-btn">
            <IconSettings />
            <span>{t('profile.settings')}</span>
          </Link>
        </nav>
        <button
          type="button"
          className="profile-trial-cta"
          onClick={() => {
            if (trialExhausted) {
              navigate('/paywall');
              return;
            }
            if (dailyBlocked) {
              navigate('/paywall?reason=daily_limit');
              return;
            }
            if (entExam) {
              navigate(`/exam/${entExam.id}`);
              return;
            }
            navigate('/app');
          }}
        >
          <div>
            <strong>{t('profile.trialCtaTitle')}</strong>
            <span>{trialSubtitle}</span>
          </div>
          <span className="profile-trial-pill">
            {trialActionLabel}
          </span>
        </button>
      </header>

      <section className="profile-section">
        <h2 className="section-title">{t('profile.overview')}</h2>
        <div className="profile-overview-card surface">
          <div className="profile-overview-ring">
            <MiniScoreRing value={avgScore} />
            <div>
              <div className="profile-overview-ring-label">{t('profile.avgScore')}</div>
              <div className="profile-overview-ring-hint">{t('profile.avgScoreHint')}</div>
            </div>
          </div>
          <div className="profile-overview-grid">
            <div className="profile-metric">
              <span className="profile-metric-value" style={{ color: 'var(--accent-light)' }}>{stats?.totalTests ?? 0}</span>
              <span className="profile-metric-label">{t('profile.totalTests')}</span>
            </div>
            <div className="profile-metric">
              <span className="profile-metric-value" style={{ color: 'var(--success-light)' }}>{stats?.completedTests ?? 0}</span>
              <span className="profile-metric-label">{t('profile.completed')}</span>
            </div>
            <div className="profile-metric">
              <span
                className="profile-metric-value"
                style={{
                  color:
                    (stats?.inProgressSessionsCount ?? 0) > 0
                      ? 'var(--warning-light)'
                      : 'var(--text-muted)',
                }}
              >
                {stats?.inProgressSessionsCount ?? 0}
              </span>
              <span className="profile-metric-label">{t('profile.inProgressCount')}</span>
            </div>
            <div className="profile-metric">
              <span
                className="profile-metric-value"
                style={{ color: bestScorePct ? scoreTone(bestScorePct) : 'var(--text-muted)' }}
              >
                {globalBestPoints
                  ? t('profile.bestScorePoints', {
                      raw: globalBestPoints.bestRawScore,
                      max: globalBestPoints.bestMaxScore,
                    })
                  : bestScorePct
                    ? `${bestScorePct}%`
                    : '—'}
              </span>
              <span className="profile-metric-label">{t('profile.bestScore')}</span>
            </div>
          </div>
        </div>
      </section>

      {stats?.byExamType && stats.byExamType.length > 0 && (
        <section className="profile-section">
          <h2 className="section-title">{t('profile.byExam')}</h2>
          <div className="profile-exam-list stagger-list">
            {stats.byExamType.map((ex) => {
              const title =
                localizedText(ex.examType?.name, i18n.language) || getExamLabel(ex.examSlug);
              const hasFinished = ex.testsCount > 0 && ex.averageScore != null;
              const pct = hasFinished ? Math.round(ex.averageScore!) : null;
              const grad = EXAM_GRADIENTS[ex.examSlug] || 'linear-gradient(135deg, var(--accent), var(--accent-hover))';
              return (
                <div key={ex.examTypeId} className="profile-exam-card surface">
                  <div className="profile-exam-accent" style={{ background: grad }} aria-hidden />
                  <ExamTileIcon
                    slug={ex.examSlug}
                    wrapperClassName="profile-exam-icon"
                    rasterWrapperClassName="profile-exam-icon--raster"
                  />
                  <div className="profile-exam-body">
                    <div className="profile-exam-title-row">
                      <span className="profile-exam-title">{title}</span>
                      <span
                        className="profile-exam-pct"
                        style={{ color: pct != null ? scoreTone(pct) : 'var(--text-muted)' }}
                      >
                        {pct != null ? `${pct}%` : '—'}
                      </span>
                    </div>
                    {hasFinished && pct != null ? (
                      <div className="progress-bar progress-bar-lg profile-exam-bar">
                        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: scoreTone(pct) }} />
                      </div>
                    ) : (
                      <p className="profile-exam-nofinish">{t('profile.noFinishedTests')}</p>
                    )}
                    <div className="profile-exam-meta">
                      <span>{t('profile.testsCount', { count: ex.testsCount })}</span>
                      {ex.bestRawScore != null && ex.bestMaxScore != null && ex.bestMaxScore > 0 ? (
                        <span>
                          {t('profile.bestLabelPoints', {
                            raw: ex.bestRawScore,
                            max: ex.bestMaxScore,
                          })}
                        </span>
                      ) : (
                        ex.bestScore != null && (
                          <span>{t('profile.bestLabel', { value: Math.round(ex.bestScore) })}</span>
                        )
                      )}
                      {ex.worstScore != null && ex.testsCount > 1 && (
                        <span>{t('profile.worstLabel', { value: Math.round(ex.worstScore) })}</span>
                      )}
                      {ex.inProgressCount > 0 && (
                        <span className="profile-exam-inprogress">
                          <span className="dot dot-warning" style={{ width: 6, height: 6 }} />
                          {t('profile.inProgressExam', { count: ex.inProgressCount })}
                        </span>
                      )}
                    </div>
                    {(ex.averageCorrectPercent != null ||
                      ex.averageDurationSecs != null ||
                      ex.lastFinishedAt != null ||
                      ex.firstFinishedAt != null) && (
                      <div className="profile-exam-detail-grid">
                        {ex.averageCorrectPercent != null && (
                          <div className="profile-exam-stat">
                            <span className="profile-exam-stat-label">{t('profile.avgAccuracy')}</span>
                            <span className="profile-exam-stat-value">{Math.round(ex.averageCorrectPercent)}%</span>
                          </div>
                        )}
                        {ex.averageDurationSecs != null && (
                          <div className="profile-exam-stat">
                            <span className="profile-exam-stat-label">{t('profile.avgDuration')}</span>
                            <span className="profile-exam-stat-value">
                              {formatDurationSecs(ex.averageDurationSecs, t)}
                            </span>
                          </div>
                        )}
                        {ex.lastFinishedAt && (
                          <div className="profile-exam-stat">
                            <span className="profile-exam-stat-label">{t('profile.lastAttempt')}</span>
                            <span className="profile-exam-stat-value">
                              {dateFmt.format(new Date(ex.lastFinishedAt))}
                            </span>
                          </div>
                        )}
                        {ex.firstFinishedAt && ex.testsCount > 1 && (
                          <div className="profile-exam-stat">
                            <span className="profile-exam-stat-label">{t('profile.firstAttempt')}</span>
                            <span className="profile-exam-stat-value">
                              {dateFmt.format(new Date(ex.firstFinishedAt))}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <ProfileExamTrend scores={ex.recentScores} label={t('profile.trendAria')} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="profile-section">
        <div className="profile-section-head">
          <h2 className="section-title profile-section-title-plain">{t('profile.recentSessions')}</h2>
          {sessionsTotal > 0 && (
            <span className="profile-count-pill">{sessionsTotal}</span>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="profile-empty surface">
            <div className="profile-empty-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 3h7l5 5v13H7z" />
                <path d="M14 3v5h5M9 13h6M9 17h6" />
              </svg>
            </div>
            <p className="profile-empty-text">{t('profile.noTests')}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/app')}>
              {t('profile.startPractice')}
            </button>
          </div>
        ) : (
          <>
            <div className="profile-session-list stagger-list">
              {sessions.map((session) => {
                const slug = session.examType?.slug || '';
                const date = dateFmt.format(new Date(session.startedAt));
                const isInProgress = session.status === 'in_progress';
                const pctFallback = Math.round(coerceNumber(session.score) ?? 0);
                const rawPts = coerceNumber(session.rawScore);
                const maxPts = coerceNumber(session.maxScore);
                const hasPoints = rawPts != null && maxPts != null && maxPts > 0;
                const correctN = session.correctCount;
                const hasCorrectRatio =
                  !hasPoints &&
                  correctN != null &&
                  session.totalQuestions > 0 &&
                  (session.status === 'completed' || session.status === 'timed_out');
                const tonePct = hasPoints
                  ? (rawPts! / maxPts!) * 100
                  : hasCorrectRatio
                    ? (correctN! / session.totalQuestions) * 100
                    : pctFallback;
                const title =
                  localizedText(session.examType?.name, i18n.language) ||
                  getExamLabel(slug) ||
                  t('profile.testFallback');

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        isInProgress ? `/test/${session.id}` : `/test/${session.id}/review`,
                        { state: { from: '/profile' } },
                      )
                    }
                    className="profile-session-card"
                  >
                    <ExamTileIcon
                      slug={slug}
                      wrapperClassName="profile-session-icon"
                      rasterWrapperClassName="profile-session-icon--raster"
                    />
                    <div className="profile-session-info">
                      <span className="profile-session-title truncate">{title}</span>
                      <span className="profile-session-meta">
                        {date}
                        {session.totalQuestions > 0 && (
                          <>
                            <span className="profile-session-dot" aria-hidden>·</span>
                            {t('profile.questionsShort', { count: session.totalQuestions })}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="profile-session-right">
                      {isInProgress ? (
                        <span className="badge badge-warning profile-session-badge">
                          <span className="dot dot-warning" style={{ width: 6, height: 6 }} />
                          {t('home.inProgress')}
                        </span>
                      ) : hasPoints ? (
                        <span className="profile-session-score" style={{ color: scoreTone(tonePct) }}>
                          {t('profile.bestScorePoints', {
                            raw: Math.round(rawPts!),
                            max: Math.round(maxPts!),
                          })}
                        </span>
                      ) : hasCorrectRatio ? (
                        <span className="profile-session-score" style={{ color: scoreTone(tonePct) }}>
                          {t('profile.bestScorePoints', {
                            raw: correctN!,
                            max: session.totalQuestions,
                          })}
                        </span>
                      ) : pctFallback > 0 || session.status === 'completed' || session.status === 'timed_out' ? (
                        <span className="profile-session-score" style={{ color: scoreTone(pctFallback) }}>
                          {pctFallback}%
                        </span>
                      ) : (
                        <span className="profile-session-score profile-session-score-muted">—</span>
                      )}
                      <IconChevron />
                    </div>
                  </button>
                );
              })}
            </div>
            {sessionsTotal > sessions.length && (
              <p className="profile-showing-hint">
                {t('profile.showingOf', { shown: sessions.length, total: sessionsTotal })}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

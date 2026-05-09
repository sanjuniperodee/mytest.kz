import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useExamTypes } from '../api/hooks/useExams';
import { useSessions, useMistakesSummary } from '../api/hooks/useTests';
import { useAuth } from '../api/hooks/useAuth';
import { useProfile } from '../api/hooks/useProfile';
import { Spinner } from '../components/common/Spinner';
import { localizedText } from '../lib/localizedText';
import { ExamTileIcon } from '../lib/examVisuals';
import { formatCountdown } from '../lib/entitlements';
import { ChevronRightIcon } from '../components/common/AppIcons';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: examTypes, isLoading } = useExamTypes();
  const { data: sessionsData } = useSessions(1);
  const { data: mistakesSummary } = useMistakesSummary();
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const inProgressSessions = sessionsData?.items.filter((s) => s.status === 'in_progress');

  if (isLoading) return <Spinner fullScreen />;

  const firstName = user?.firstName || '';
  const entExam = examTypes?.find((exam) => exam.slug === 'ent');
  const entAccess = profile?.accessByExam?.find((x) => x.examSlug === 'ent');
  const entTrial = profile?.trialStatus?.ent;
  const hasPremium =
    profile?.hasActiveSubscription === true ||
    (entAccess?.hasPaidTier === true && (entAccess?.hasAccess ?? false));
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
  const dailyBlocked = entAccess?.reasonCode === 'DAILY_LIMIT_REACHED';
  const trialExhausted = !hasPremium && !dailyBlocked && entTotalRemaining <= 0;
  const trialSubtitle = hasPremium
    ? t('home.trialCtaPremium')
    : dailyBlocked
      ? t('home.dailyLimitReached', { countdown: dailyCountdown ?? '--:--:--' })
    : entTotalRemaining > 0
      ? entPaidTrialRemaining > 0 && entFreeRemaining > 0
        ? t('home.trialCtaMixed', {
            total: entTotalRemaining,
            free: entFreeRemaining,
            paid: entPaidTrialRemaining,
          })
        : entPaidTrialRemaining > 0
          ? t('home.trialCtaPaidTrialOnly', { count: entPaidTrialRemaining })
          : t('home.trialCtaRemaining', { count: entTotalRemaining })
      : t('home.trialCtaExhausted');
  const trialActionLabel = hasPremium
    ? t('home.trialPremiumAction')
    : dailyBlocked
      ? t('home.trialOpenPlans')
      : trialExhausted
      ? t('home.trialOpenPlans')
      : t('home.trialStart');
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return t('home.greetingNight');
    if (h < 12) return t('home.greetingMorning');
    if (h < 18) return t('home.greetingDay');
    return t('home.greetingEvening');
  })();

  return (
    <div className="page home-page">
      {/* Hero greeting */}
      <div className="page-hero" style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: 11, color: 'var(--accent-light)', marginBottom: 8,
          textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700,
        }}>
          {t('app.name')}
        </p>
        <h1 className="page-title">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="page-subtitle">{t('home.subtitle')}</p>
      </div>

      <button
        type="button"
        className="surface"
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
        style={{
          width: '100%',
          textAlign: 'left',
          marginBottom: 14,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          border: '1px solid rgba(99, 102, 241, 0.3)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.1))',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
            {t('home.trialCtaTitle')}
          </div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--text-muted)' }}>
            {trialSubtitle}
          </div>
        </div>
        <span className="badge badge-accent" style={{ whiteSpace: 'nowrap' }}>
          {trialActionLabel}
        </span>
      </button>

      {(mistakesSummary?.openTotal ?? 0) > 0 && (
        <button
          type="button"
          className="mistakes-home-banner surface"
          onClick={() => navigate('/mistakes')}
        >
          <span className="mistakes-home-banner-icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </span>
          <div className="mistakes-home-banner-text">
            <span className="mistakes-home-banner-title">{t('mistakes.homeBannerTitle')}</span>
            <span className="mistakes-home-banner-sub">
              {t('mistakes.homeBannerSub', { count: mistakesSummary!.openTotal })}
            </span>
          </div>
          <span className="mistakes-home-banner-arrow" aria-hidden>→</span>
        </button>
      )}

      {/* In-progress sessions */}
      {inProgressSessions && inProgressSessions.length > 0 && (
        <div className="section">
          <div className="section-title">
            <span className="dot dot-warning" style={{ animation: 'pulse 2s infinite' }} />
            {t('home.continueTest')}
          </div>
          <div className="stagger-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inProgressSessions.map((session) => {
              const answered = session.answers?.filter((a) => a.selectedIds.length > 0).length || 0;
              const progress = session.totalQuestions > 0 ? (answered / session.totalQuestions) * 100 : 0;

              return (
                <button
                  key={session.id}
                  onClick={() => navigate(`/test/${session.id}`)}
                  className="continue-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, position: 'relative' }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                      {localizedText(session.examType?.name, i18n.language) || 'Test'}
                    </span>
                    <span className="badge badge-warning" style={{ fontSize: 11 }}>
                      <span className="dot dot-warning" style={{ width: 6, height: 6 }} />
                      {t('home.inProgress')}
                    </span>
                  </div>
                  <div className="progress-bar" style={{ marginBottom: 10 }}>
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {answered}/{session.totalQuestions} {t('test.answered').toLowerCase()}
                    </span>
                    <span style={{
                      fontSize: 12, color: 'var(--accent-light)', fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {t('home.continueTest')}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 6 6 6-6 6" /></svg>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Exam types */}
      <div className="section">
        <div className="section-title">{t('home.chooseExam')}</div>
        <div className="exam-list home-exam-grid stagger-list">
          {examTypes?.map((exam) => {
            return (
              <button
                key={exam.id}
                onClick={() => navigate(`/exam/${exam.id}`)}
                className="exam-row"
              >
                <ExamTileIcon
                  slug={exam.slug}
                  wrapperClassName="exam-row-icon"
                  rasterWrapperClassName="exam-row-icon--raster"
                />
                <div className="exam-row-main">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, color: 'var(--text-primary)' }}>
                    {localizedText(exam.name, i18n.language)}
                  </div>
                  {exam.description != null && localizedText(exam.description, i18n.language) && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }} className="truncate">
                      {localizedText(exam.description, i18n.language)}
                    </div>
                  )}
                </div>
                <ChevronRightIcon />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

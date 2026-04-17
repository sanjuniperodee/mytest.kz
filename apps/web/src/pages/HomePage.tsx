import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useExamTypes } from '../api/hooks/useExams';
import { useSessions, useMistakesSummary } from '../api/hooks/useTests';
import { useAuth } from '../api/hooks/useAuth';
import { useProfile } from '../api/hooks/useProfile';
import { Spinner } from '../components/common/Spinner';
import { localizedText } from '../lib/localizedText';

const EXAM_COLORS: Record<string, string> = {
  ent: '#6366f1',
  nuet: '#8b5cf6',
  nis: '#10b981',
  ktl: '#f59e0b',
  physmath: '#3b82f6',
};

const EXAM_GRADIENTS: Record<string, string> = {
  ent: 'linear-gradient(135deg, #6366f1, #4f46e5)',
  nuet: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  nis: 'linear-gradient(135deg, #10b981, #059669)',
  ktl: 'linear-gradient(135deg, #f59e0b, #d97706)',
  physmath: 'linear-gradient(135deg, #3b82f6, #2563eb)',
};

/** Raster badges from `public/assets/images/exams/` */
const EXAM_ICON_SRC: Record<string, string> = {
  ent: '/assets/images/exams/ENT.png',
  nis: '/assets/images/exams/NIS.png',
  ktl: '/assets/images/exams/KTL.png',
};

function ExamIcon({ slug }: { slug: string }) {
  const props = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };
  switch (slug) {
    case 'ent':
      return <svg {...props}><path d="M3 8.5 12 4l9 4.5L12 13 3 8.5Z" /><path d="M7 11.2V15c0 1.1 2.2 2 5 2s5-.9 5-2v-3.8" /></svg>;
    case 'nuet':
      return <svg {...props}><path d="M2 10h20M4 10V7l8-4 8 4v3M6 10v8M10 10v8M14 10v8M18 10v8M3 18h18" /></svg>;
    case 'nis':
      return <svg {...props}><path d="M9.5 3.5A3.5 3.5 0 0 0 6 7c0 2 1.6 3.6 3.6 3.6h.5V14a2 2 0 1 0 3.8 0v-3.4h.5A3.6 3.6 0 0 0 18 7a3.5 3.5 0 0 0-3.5-3.5c-1.2 0-2.3.6-3 1.5-.7-.9-1.8-1.5-3-1.5Z" /><path d="M9 18h6M10 21h4" /></svg>;
    case 'ktl':
      return <svg {...props}><path d="m4 18 8-13 8 13H4Z" /><path d="M8 12h8" /></svg>;
    case 'physmath':
      return <svg {...props}><circle cx="12" cy="12" r="2.2" /><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6.2 6.2l2.2 2.2M15.6 15.6l2.2 2.2M17.8 6.2l-2.2 2.2M8.4 15.6l-2.2 2.2" /></svg>;
    default:
      return <svg {...props}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>;
  }
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4 }}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: examTypes, isLoading } = useExamTypes();
  const { data: sessionsData } = useSessions(1);
  const { data: mistakesSummary } = useMistakesSummary();

  const inProgressSessions = sessionsData?.items.filter((s) => s.status === 'in_progress');

  if (isLoading) return <Spinner fullScreen />;

  const firstName = user?.firstName || '';
  const entExam = examTypes?.find((exam) => exam.slug === 'ent');
  const entTrial = profile?.trialStatus?.ent;
  const hasPremium = profile?.hasActiveSubscription === true;
  const trialSubtitle = hasPremium
    ? t('home.trialCtaPremium')
    : entTrial
      ? (entTrial.exhausted
          ? t('home.trialCtaExhausted')
          : t('home.trialCtaRemaining', { count: entTrial.remaining }))
      : t('home.trialCtaSub');
  const trialActionLabel = hasPremium
    ? t('home.trialPremiumAction')
    : entTrial?.exhausted
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
          if (!hasPremium && entTrial?.exhausted) {
            navigate('/paywall');
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
            const color = EXAM_COLORS[exam.slug] || '#6366f1';
            const gradient = EXAM_GRADIENTS[exam.slug] || `linear-gradient(135deg, ${color}, ${color})`;
            return (
              <button
                key={exam.id}
                onClick={() => navigate(`/exam/${exam.id}`)}
                className="exam-row"
              >
                <div
                  className={
                    EXAM_ICON_SRC[exam.slug]
                      ? 'exam-row-icon exam-row-icon--raster'
                      : 'exam-row-icon'
                  }
                  style={
                    EXAM_ICON_SRC[exam.slug]
                      ? undefined
                      : { background: gradient, color: '#fff' }
                  }
                >
                  {EXAM_ICON_SRC[exam.slug] ? (
                    <img
                      src={EXAM_ICON_SRC[exam.slug]}
                      alt=""
                      className="exam-row-icon-img"
                      decoding="async"
                    />
                  ) : (
                    <ExamIcon slug={exam.slug} />
                  )}
                </div>
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
                <ChevronRight />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

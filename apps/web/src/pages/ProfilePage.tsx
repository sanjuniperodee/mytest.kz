import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProfile, useUserStats } from '../api/hooks/useProfile';
import { useMistakesSummary } from '../api/hooks/useTests';
import { useExamTypes } from '../api/hooks/useExams';
import { Spinner } from '../components/common/Spinner';

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" aria-hidden>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function HubIcon({ type }: { type: 'home' | 'stats' | 'mistakes' | 'leaderboard' | 'settings' | 'plans' }) {
  const common = { width: 21, height: 21, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (type === 'stats') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M4 19V5M4 19h16" />
        <path d="M8 15v-4M13 15V8M18 15v-6" />
      </svg>
    );
  }
  if (type === 'mistakes') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M12 8v4m0 4h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (type === 'leaderboard') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M5 5H3v2a4 4 0 0 0 4 4M19 5h2v2a4 4 0 0 1-4 4" />
      </svg>
    );
  }
  if (type === 'settings') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
      </svg>
    );
  }
  if (type === 'plans') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
    </svg>
  );
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

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: stats } = useUserStats();
  const { data: mistakesSummary } = useMistakesSummary();
  const { data: examTypes } = useExamTypes();
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const displayName = useMemo(
    () =>
      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
      (profile?.telegramUsername ? `@${profile.telegramUsername}` : null) ||
      t('profile.guestName'),
    [profile?.firstName, profile?.lastName, profile?.telegramUsername, t],
  );

  if (profileLoading) return <Spinner fullScreen />;

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
  const entFreeRemaining = Math.max(0, entTrial?.freeRemaining ?? entTrial?.remaining ?? 0);
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
    : dailyBlocked || trialExhausted
      ? t('profile.trialOpenPlans')
      : t('profile.trialStart');

  const startEnt = () => {
    if (trialExhausted) {
      navigate('/paywall');
      return;
    }
    if (dailyBlocked) {
      navigate('/paywall?reason=daily_limit');
      return;
    }
    navigate(entExam ? `/exam/${entExam.id}` : '/app');
  };

  const hubItems = [
    { to: '/app', icon: 'home' as const, title: t('profile.toHome'), sub: t('home.subtitle') },
    {
      to: '/stats',
      icon: 'stats' as const,
      title: t('profile.statsCtaTitle'),
      sub: t('profile.statsCtaSub'),
      badge: stats?.totalTests ? String(stats.totalTests) : undefined,
    },
    {
      to: '/mistakes',
      icon: 'mistakes' as const,
      title: t('mistakes.navShort'),
      sub: t('mistakes.homeBannerTitle'),
      badge: mistakesSummary?.openTotal ? String(mistakesSummary.openTotal) : undefined,
    },
    { to: '/leaderboard', icon: 'leaderboard' as const, title: t('nav.leaderboard'), sub: t('leaderboard.kicker') },
    { to: '/paywall', icon: 'plans' as const, title: t('nav.subscriptions'), sub: t('profile.getPremium') },
    { to: '/settings', icon: 'settings' as const, title: t('profile.settings'), sub: t('settings.language') },
  ];

  return (
    <div className="page profile-page profile-page--hub">
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
            {(displayName[0] || 'M').toUpperCase()}
          </div>
          <div className="profile-hero-copy">
            <p className="profile-hero-kicker">{t('profile.title')}</p>
            <h1 className="profile-hero-name">{displayName}</h1>
            {profile?.telegramUsername && !displayName.startsWith('@') && (
              <span className="profile-hero-handle">@{profile.telegramUsername}</span>
            )}
            <div className="profile-hero-chips">
              {hasPremium ? (
                <span className="badge badge-success profile-premium-badge">
                  <StarIcon /> {t('profile.premium')}
                </span>
              ) : (
                <Link to="/paywall" className="btn btn-primary btn-xs profile-premium-cta">
                  <StarIcon /> {t('profile.getPremium')}
                </Link>
              )}
            </div>
          </div>
        </div>

        <button type="button" className="profile-trial-cta" onClick={startEnt}>
          <div>
            <strong>{t('profile.trialCtaTitle')}</strong>
            <span>{trialSubtitle}</span>
          </div>
          <span className="profile-trial-pill">{trialActionLabel}</span>
        </button>
      </header>

      <Link to="/stats" className="profile-stats-cta surface">
        <div>
          <span>{t('profile.statsCtaTitle')}</span>
          <strong>{t('profile.statsCtaSub')}</strong>
        </div>
        <span className="profile-trial-pill">{t('profile.statsCtaAction')}</span>
      </Link>

      <section className="profile-section">
        <h2 className="section-title profile-section-title-plain">{t('profile.quickNavAria')}</h2>
        <div className="profile-hub-grid">
          {hubItems.map((item) => (
            <Link key={item.to} to={item.to} className="profile-hub-card surface">
              <span className="profile-hub-icon">
                <HubIcon type={item.icon} />
              </span>
              <span className="profile-hub-title">{item.title}</span>
              <span className="profile-hub-sub">{item.sub}</span>
              {item.badge ? <span className="profile-hub-badge">{item.badge}</span> : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="profile-account surface">
        <h2>{t('profile.account')}</h2>
        <div className="profile-account-row">
          <span>Telegram</span>
          <strong>{profile?.telegramUsername ? `@${profile.telegramUsername}` : '—'}</strong>
        </div>
        <div className="profile-account-row">
          <span>{t('settings.language')}</span>
          <strong>{profile?.preferredLanguage?.toUpperCase() ?? '—'}</strong>
        </div>
        <div className="profile-account-row">
          <span>{t('profile.timezone')}</span>
          <strong>{profile?.timezone ?? 'Asia/Almaty'}</strong>
        </div>
      </section>
    </div>
  );
}

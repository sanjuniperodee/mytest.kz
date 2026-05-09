import { useMemo, useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProfile, useUpdateProfile, useUserStats } from '../api/hooks/useProfile';
import { useAuth } from '../api/hooks/useAuth';
import { useMistakesSummary } from '../api/hooks/useTests';
import { useExamTypes } from '../api/hooks/useExams';
import { Spinner } from '../components/common/Spinner';
import { StarIcon, HomeIcon, StatsIcon, MistakesIcon, LeaderboardIcon, SettingsIcon, PlansIcon } from '../components/common/AppIcons';
import { formatCountdown } from '../lib/entitlements';

function getInitials(name: string) {
  const parts = name.trim().replace(/^@/, '').split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[1][0]] : [parts[0]?.[0]];
  return letters.join('').toUpperCase() || 'M';
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_failed'));
    img.src = src;
  });
}

async function resizeProfilePhoto(file: File) {
  const source = await fileToDataUrl(file);
  const img = await loadImage(source);
  const size = 320;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_failed');

  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.84);
}

function CameraIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 4l1.4 2H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.1l1.4-2h5z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: stats } = useUserStats();
  const { data: mistakesSummary } = useMistakesSummary();
  const { data: examTypes } = useExamTypes();
  const [nowMs, setNowMs] = useState(Date.now());
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isPhotoSaving, setIsPhotoSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleProfilePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoError(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setPhotoError(t('profile.photoInvalid'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError(t('profile.photoTooLarge'));
      return;
    }
    try {
      setIsPhotoSaving(true);
      const avatarUrl = await resizeProfilePhoto(file);
      await updateProfile.mutateAsync({ avatarUrl });
      await refreshUser();
    } catch {
      setPhotoError(t('profile.photoError'));
    } finally {
      setIsPhotoSaving(false);
    }
  };

  const handleProfilePhotoRemove = async () => {
    setPhotoError(null);
    try {
      setIsPhotoSaving(true);
      await updateProfile.mutateAsync({ avatarUrl: null });
      await refreshUser();
    } catch {
      setPhotoError(t('profile.photoError'));
    } finally {
      setIsPhotoSaving(false);
    }
  };

  const hubItems = [
    { to: '/app', Icon: HomeIcon, title: t('profile.toHome'), sub: t('home.subtitle') },
    {
      to: '/stats',
      Icon: StatsIcon,
      title: t('profile.statsCtaTitle'),
      sub: t('profile.statsCtaSub'),
      badge: stats?.totalTests ? String(stats.totalTests) : undefined,
    },
    {
      to: '/mistakes',
      Icon: MistakesIcon,
      title: t('mistakes.navShort'),
      sub: t('mistakes.homeBannerTitle'),
      badge: mistakesSummary?.openTotal ? String(mistakesSummary.openTotal) : undefined,
    },
    { to: '/leaderboard', Icon: LeaderboardIcon, title: t('nav.leaderboard'), sub: t('leaderboard.kicker') },
    { to: '/paywall', Icon: PlansIcon, title: t('nav.subscriptions'), sub: t('profile.getPremium') },
    { to: '/settings', Icon: SettingsIcon, title: t('profile.settings'), sub: t('settings.language') },
  ];

  return (
    <div className="page profile-page profile-page--hub">
      <header className="profile-hero surface">
        <div className="profile-hero-glow" aria-hidden />
        <div className="profile-hero-main">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleProfilePhotoChange}
            hidden
          />
          <button
            type="button"
            className="profile-avatar-button"
            disabled={isPhotoSaving || updateProfile.isPending}
            onClick={() => photoInputRef.current?.click()}
            aria-label={t('profile.photoUpload')}
          >
            <span
              className="avatar avatar-lg profile-hero-avatar"
              style={{
                background: 'linear-gradient(145deg, var(--accent-light), var(--accent-hover))',
                boxShadow: '0 8px 28px var(--accent-glow)',
              }}
            >
              <span className="avatar-ring" />
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" />
              ) : (
                getInitials(displayName)
              )}
            </span>
            <span className="profile-avatar-camera">
              <CameraIcon />
            </span>
          </button>
          <div className="profile-hero-copy">
            <p className="profile-hero-kicker">{t('profile.title')}</p>
            <h1 className="profile-hero-name">{displayName}</h1>
            {profile?.telegramUsername && !displayName.startsWith('@') && (
              <span className="profile-hero-handle">@{profile.telegramUsername}</span>
            )}
            <div className="profile-hero-chips">
              {profile?.avatarUrl ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs profile-photo-action"
                  disabled={isPhotoSaving || updateProfile.isPending}
                  onClick={handleProfilePhotoRemove}
                >
                  {t('profile.photoRemove')}
                </button>
              ) : null}
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
            {photoError ? <small className="profile-photo-error">{photoError}</small> : null}
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
                <item.Icon />
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

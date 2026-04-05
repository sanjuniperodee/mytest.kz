import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../api/hooks/useAuth';
import { useTelegram } from '../lib/telegram';

export function ChannelGatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { webApp, isTelegram } = useTelegram();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const channelLink = 'https://t.me/bilimilimland';

  const handleSubscribe = () => {
    if (isTelegram && webApp) webApp.openTelegramLink(channelLink);
    else window.open(channelLink, '_blank');
  };

  const handleCheck = async () => {
    setChecking(true); setError('');
    try {
      const updatedUser = await refreshUser();
      if (updatedUser?.isChannelMember) navigate('/', { replace: true });
      else setError(t('auth.subscribeRequired'));
    } catch { setError(t('common.error')); }
    finally { setChecking(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20, textAlign: 'center' }}>
      <div className="surface animate-fadeIn" style={{ maxWidth: 340, padding: 24 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 'var(--r-2xl)',
          background: 'var(--accent-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', color: 'var(--accent-light)',
        }}>
          <ChannelIcon />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
          {t('channel.title')}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6, fontSize: 14 }}>
          {t('channel.description')}
        </p>

        <button className="btn btn-primary" onClick={handleSubscribe} style={{ marginBottom: 10 }}>
          {t('channel.subscribe')}
        </button>
        <button className="btn btn-secondary" onClick={handleCheck} disabled={checking}>
          {checking ? t('common.loading') : t('channel.checkSubscription')}
        </button>

        {error && (
          <p style={{
            color: 'var(--error)', marginTop: 16, fontSize: 13,
            padding: '8px 12px', background: 'var(--error-surface)', borderRadius: 'var(--r-sm)',
          }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function ChannelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 15.5V8.7A2.7 2.7 0 0 1 6.7 6h4.8l6-2v16l-6-2H6.7A2.7 2.7 0 0 1 4 15.5Z" />
      <path d="M17.5 9.5a4 4 0 0 1 0 5M20 8a6.5 6.5 0 0 1 0 8" />
    </svg>
  );
}

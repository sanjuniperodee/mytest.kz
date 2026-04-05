import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../api/hooks/useAuth';
import { useTelegram } from '../lib/telegram';
import { AdvancedSEO } from '../components/seo/AdvancedSEO';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login, requestCode, loginWithCode, user } = useAuth();
  const { isTelegram, webApp } = useTelegram();

  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'username' | 'code'>('username');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const htmlLang = i18n.language === 'kk' ? 'kk' : i18n.language === 'en' ? 'en' : 'ru';

  if (user) { navigate('/app', { replace: true }); return null; }

  if (isTelegram && webApp?.initData) {
    const handleTelegramLogin = async () => {
      setLoading(true);
      try { await login(webApp.initData); navigate('/app', { replace: true }); }
      catch { setError(t('common.error')); }
      finally { setLoading(false); }
    };
    return (
      <>
        <AdvancedSEO
          title={t('auth.seoTitle')}
          description={t('auth.seoDescription')}
          canonicalPath="/login"
          noindex
          htmlLang={htmlLang}
          includeHreflang={false}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
          <Logo title={t('app.name')} />
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{t('home.subtitle')}</p>
          <button className="btn btn-primary" onClick={handleTelegramLogin} disabled={loading} style={{ maxWidth: 320 }}>
            {loading ? t('common.loading') : t('auth.telegramLogin')}
          </button>
          {error && <ErrorMsg text={error} />}
        </div>
      </>
    );
  }

  const handleRequestCode = async () => {
    setError(''); setLoading(true);
    try { await requestCode(username); setStep('code'); }
    catch (err: any) { setError(err.response?.data?.message || t('common.error')); }
    finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    setError(''); setLoading(true);
    try { await loginWithCode(username, code); navigate('/app', { replace: true }); }
    catch (err: any) { setError(err.response?.data?.message || t('auth.invalidCode')); }
    finally { setLoading(false); }
  };

  return (
    <>
      <AdvancedSEO
        title={t('auth.seoTitle')}
        description={t('auth.seoDescription')}
        canonicalPath="/login"
        noindex
        htmlLang={htmlLang}
        includeHreflang={false}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <Logo title={t('app.name')} />

        <div style={{ width: '100%', maxWidth: 380 }} className="animate-fadeIn">
          {step === 'username' ? (
            <>
              <div className="surface" style={{ borderRadius: 'var(--r-xl)', padding: 24, marginBottom: 24 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                  {t('auth.webLogin')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Step num={1} text={<>Напишите <a href="https://t.me/bilimhan_bot" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>/start</a> боту <a href="https://t.me/bilimhan_bot" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>@bilimhan_bot</a></>} />
                  <Step num={2} text="Введите свой @username ниже" />
                  <Step num={3} text="Получите код подтверждения" />
                </div>
              </div>

              <input
                className="input"
                type="text"
                placeholder="@username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && username.trim() && handleRequestCode()}
                style={{ marginBottom: 12 }}
              />
              <button className="btn btn-primary" onClick={handleRequestCode} disabled={loading || !username.trim()}>
                {loading ? t('common.loading') : t('auth.sendCode')}
              </button>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 'var(--r-full)',
                  background: 'var(--accent-surface)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--accent-light)',
                }}>
                  <MailIcon />
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  {t('auth.codeSent')}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  @{username.replace('@', '')}
                </p>
              </div>

              <input
                className="input"
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && handleVerifyCode()}
                maxLength={6}
                inputMode="numeric"
                autoFocus
                style={{ textAlign: 'center', letterSpacing: 12, fontSize: 28, fontWeight: 700, marginBottom: 12 }}
              />
              <button className="btn btn-primary" onClick={handleVerifyCode} disabled={loading || code.length !== 6} style={{ marginBottom: 8 }}>
                {loading ? t('common.loading') : t('auth.verify')}
              </button>
              <button className="btn btn-ghost" onClick={() => { setStep('username'); setCode(''); setError(''); }}>
                {t('common.back')}
              </button>
            </>
          )}

          {error && <ErrorMsg text={error} />}
        </div>
      </div>
    </>
  );
}

function Logo({ title }: { title: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 'var(--r-xl)',
        background: 'linear-gradient(135deg, var(--accent), #4f46e5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px', color: '#fff', boxShadow: 'var(--shadow-glow)',
      }}>
        <BookIcon />
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: 'var(--text-primary)' }}>
        {title}
      </h1>
    </div>
  );
}

function Step({ num, text }: { num: number; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{
        width: 24, height: 24, borderRadius: 'var(--r-full)',
        background: 'var(--accent-surface)', color: 'var(--accent-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>
        {num}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '24px' }}>{text}</span>
    </div>
  );
}

function ErrorMsg({ text }: { text: string }) {
  return (
    <p style={{
      color: 'var(--error)', textAlign: 'center', marginTop: 16,
      fontSize: 13, padding: '8px 12px', background: 'var(--error-surface)',
      borderRadius: 'var(--r-sm)',
    }}>
      {text}
    </p>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="m4 8 8 6 8-6" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
      <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 11h6" />
    </svg>
  );
}

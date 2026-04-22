import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeKzPhone, maskPhoneDigits } from '@bilimland/shared';
import { useAuth } from '../api/hooks/useAuth';
import { useTelegram } from '../lib/telegram';
import { AdvancedSEO } from '../components/seo/AdvancedSEO';

/** Deep link: Telegram sends /start automatically — user does not type the command. */
const BOT_DEEP_LINK = 'https://t.me/bilimhan_bot?start=web';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login, requestCode, loginWithCode, user, isLoading: authLoading } = useAuth();
  const { isTelegram, webApp } = useTelegram();

  const [phone, setPhone] = useState('');
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [telegramAutoError, setTelegramAutoError] = useState('');
  const [telegramAutoLoading, setTelegramAutoLoading] = useState(false);
  const telegramAttemptedRef = useRef(false);

  const htmlLang = i18n.language === 'kk' ? 'kk' : i18n.language === 'en' ? 'en' : 'ru';

  if (user) { navigate('/app', { replace: true }); return null; }

  const mapTelegramAuthError = (msg: string | undefined): string => {
    if (msg === 'PHONE_REQUIRED_IN_BOT') return t('auth.telegramPhoneRequired');
    return t('common.error');
  };

  const extractBackendMessage = (err: unknown): string | undefined => {
    if (!err || typeof err !== 'object' || !('response' in err)) return undefined;
    const maybeResp = (err as { response?: { data?: { message?: unknown } } }).response;
    const raw = maybeResp?.data?.message;
    if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : undefined;
    return typeof raw === 'string' ? raw : undefined;
  };

  const tryTelegramLogin = async (initData: string) => {
    setTelegramAutoError('');
    setTelegramAutoLoading(true);
    try {
      await login(initData);
      navigate('/app', { replace: true });
    } catch (err) {
      setTelegramAutoError(mapTelegramAuthError(extractBackendMessage(err)));
    } finally {
      setTelegramAutoLoading(false);
    }
  };

  useEffect(() => {
    if (!isTelegram || !webApp?.initData) return;
    if (authLoading || telegramAttemptedRef.current) return;
    telegramAttemptedRef.current = true;
    void tryTelegramLogin(webApp.initData);
  }, [isTelegram, webApp?.initData, authLoading]);

  if (isTelegram && webApp?.initData) {
    const isBusy = authLoading || telegramAutoLoading;
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
        <div className="login-page">
          <aside className="login-page-aside" aria-hidden>
            <p className="login-page-aside-kicker">{t('app.name')}</p>
            <h2 className="login-page-aside-title">{t('home.subtitle')}</h2>
          </aside>
          <div className="login-page-panel">
            <Logo title={t('app.name')} />
            <p className="login-page-panel-hint">{t('auth.telegramAutoLogin')}</p>
            {isBusy ? (
              <button className="btn btn-primary login-page-submit" disabled>
                {t('common.loading')}
              </button>
            ) : (
              <>
                <a
                  className="btn btn-primary login-page-submit"
                  href={BOT_DEEP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 8 }}
                >
                  {t('auth.authOpenBot')}
                </a>
                <button
                  className="btn btn-ghost login-page-submit"
                  onClick={() => {
                    telegramAttemptedRef.current = false;
                    void tryTelegramLogin(webApp.initData);
                  }}
                >
                  {t('auth.telegramRetry')}
                </button>
              </>
            )}
            {telegramAutoError && <ErrorMsg text={telegramAutoError} />}
          </div>
        </div>
      </>
    );
  }

  const handleRequestCode = async () => {
    const n = normalizeKzPhone(phone);
    if (!n) {
      setError(t('auth.phoneInvalid'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestCode(phone);
      setPhoneE164(n);
      setStep('code');
    }
    catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        && err.response && typeof err.response === 'object' && 'data' in err.response
        && err.response.data && typeof err.response.data === 'object' && 'message' in err.response.data
        ? String((err.response.data as { message?: string }).message)
        : t('common.error');
      setError(msg);
    }
    finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    const n = phoneE164 ?? normalizeKzPhone(phone);
    if (!n) {
      setError(t('auth.phoneInvalid'));
      return;
    }
    setError('');
    setLoading(true);
    try { await loginWithCode(phone, code); navigate('/app', { replace: true }); }
    catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        && (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(typeof msg === 'string' ? msg : t('auth.invalidCode'));
    }
    finally { setLoading(false); }
  };

  const goToCodeStep = () => {
    const n = normalizeKzPhone(phone);
    if (!n) {
      setError(t('auth.phoneInvalid'));
      return;
    }
    setPhoneE164(n);
    setStep('code');
    setError('');
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
      <div className="login-page">
        <aside className="login-page-aside" aria-hidden>
          <p className="login-page-aside-kicker">{t('app.name')}</p>
          <h2 className="login-page-aside-title">{t('home.subtitle')}</h2>
        </aside>
        <div className="login-page-panel animate-fadeIn">
          <Logo title={t('app.name')} />

          <div className="login-page-form">
          {step === 'phone' ? (
            <>
              <div className="surface" style={{ borderRadius: 'var(--r-xl)', padding: 24, marginBottom: 24 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                  {t('auth.webLogin')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Step num={1} text={t('auth.authStep1')} />
                  <a
                    className="btn btn-primary"
                    href={BOT_DEEP_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
                  >
                    {t('auth.authOpenBot')}
                  </a>
                  <Step num={2} text={t('auth.authStep2')} />
                  <Step num={3} text={t('auth.authStep3')} />
                </div>
              </div>

              <input
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t('auth.phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !!normalizeKzPhone(phone) && handleRequestCode()}
                style={{ marginBottom: 12 }}
              />
              <button className="btn btn-primary" onClick={handleRequestCode} disabled={loading || !normalizeKzPhone(phone)}>
                {loading ? t('common.loading') : t('auth.sendCode')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={goToCodeStep} style={{ marginTop: 8, width: '100%' }}>
                {t('auth.authAlreadyHaveCode')}
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
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {t('auth.codeSentFor')}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {phoneE164 ? maskPhoneDigits(phoneE164) : '—'}
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
              <button className="btn btn-ghost" onClick={() => { setStep('phone'); setCode(''); setPhoneE164(null); setError(''); }}>
                {t('common.back')}
              </button>
            </>
          )}

          {error && <ErrorMsg text={error} />}
          </div>
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

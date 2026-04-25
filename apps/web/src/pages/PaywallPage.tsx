import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBillingPlans } from '../api/hooks/useBilling';
import { useProfile } from '../api/hooks/useProfile';
import type { BillingPlan } from '../api/types';
import { Spinner } from '../components/common/Spinner';
import { openWhatsAppWithText } from '../lib/whatsapp';

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

export function PaywallPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: plans, isLoading } = useBillingPlans();
  const { data: profile } = useProfile();
  const [nowMs, setNowMs] = useState(Date.now());
  const [planForWhatsapp, setPlanForWhatsapp] = useState<BillingPlan | null>(null);
  const [invoicePhone, setInvoicePhone] = useState('');
  const [invoiceError, setInvoiceError] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!planForWhatsapp) return;
    const t = window.setTimeout(() => invoiceInputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPlanForWhatsapp(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [planForWhatsapp]);

  const buildWhatsappMessage = (plan: BillingPlan, invoice: string) => {
    const priceStr = new Intl.NumberFormat(
      i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-US' : 'ru-RU',
    ).format(plan.priceKzt);
    let message = t('paywall.whatsappIntro', {
      planName: plan.name,
      price: priceStr,
    });
    const phone = profile?.phone?.trim();
    if (phone) {
      message += `\n\n${t('paywall.whatsappLinePhone', { phone })}`;
    }
    const rawUser = profile?.telegramUsername?.trim();
    if (rawUser) {
      const username = rawUser.replace(/^@/, '');
      message += `\n${t('paywall.whatsappLineTelegram', { username })}`;
    }
    message += `\n\n${t('paywall.whatsappLineInvoice', { phone: invoice })}`;
    return message;
  };

  const openInvoiceModal = (plan: BillingPlan) => {
    setPlanForWhatsapp(plan);
    setInvoicePhone((profile?.phone ?? '').trim());
    setInvoiceError(false);
  };

  const confirmWhatsapp = () => {
    if (!planForWhatsapp) return;
    const trimmed = invoicePhone.trim();
    if (!trimmed) {
      setInvoiceError(true);
      return;
    }
    setInvoiceError(false);
    openWhatsAppWithText(buildWhatsappMessage(planForWhatsapp, trimmed));
    setPlanForWhatsapp(null);
  };

  const paymentStatus = searchParams.get('payment');
  const entAccess = profile?.accessByExam?.find((x) => x.examSlug === 'ent');
  const hasPremium =
    profile?.hasActiveSubscription === true ||
    (entAccess?.hasPaidTier === true && (entAccess?.hasAccess ?? false));
  const dailyBlocked = entAccess?.reasonCode === 'DAILY_LIMIT_REACHED';
  const dailyCountdown = formatCountdown(entAccess?.nextAllowedAt, nowMs);
  const entTrial = profile?.trialStatus?.ent;
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

  if (isLoading) return <Spinner fullScreen />;

  return (
    <div className="page paywall-page">
      <button className="back-btn" onClick={() => navigate('/app')}>
        {t('common.back')}
      </button>

      <div className="surface paywall-hero">
        <p className="paywall-kicker">{t('paywall.kicker')}</p>
        <h1 className="paywall-title">{t('paywall.title')}</h1>
        <p className="paywall-subtitle">
          {hasPremium
            ? t('paywall.active')
            : dailyBlocked
              ? t('paywall.dailyLimitReached', {
                  countdown: dailyCountdown ?? '--:--:--',
                })
            : entTotalRemaining <= 0
              ? t('paywall.exhausted')
              : entPaidTrialRemaining > 0 && entFreeRemaining > 0
                ? t('paywall.remainingMixed', {
                    total: entTotalRemaining,
                    free: entFreeRemaining,
                    paid: entPaidTrialRemaining,
                  })
                : entPaidTrialRemaining > 0
                  ? t('paywall.remainingPaidOnly', { count: entPaidTrialRemaining })
                  : t('paywall.remaining', { count: entTotalRemaining })}
        </p>
        {paymentStatus === 'success' && (
          <p className="paywall-status paywall-status-success">{t('paywall.statusSuccess')}</p>
        )}
        {paymentStatus === 'failed' && (
          <p className="paywall-status paywall-status-fail">{t('paywall.statusFail')}</p>
        )}
        {hasPremium && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/app')}>
            {t('paywall.activeButton')}
          </button>
        )}
      </div>

      {!hasPremium && (
        <div className="paywall-grid stagger-list">
          {plans?.map((plan) => (
            <article key={plan.id} className="surface paywall-card">
              <div className="paywall-card-head">
                <h3>{plan.name}</h3>
                {plan.highlight ? <span>{plan.highlight}</span> : null}
              </div>
              <p className="paywall-card-description">{plan.description}</p>
              <p className="paywall-card-price">
                {plan.originalPriceKzt ? (
                  <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: 8, fontSize: '0.85em' }}>
                    {new Intl.NumberFormat('ru-RU').format(plan.originalPriceKzt)} ₸
                  </span>
                ) : null}
                {new Intl.NumberFormat('ru-RU').format(plan.priceKzt)} ₸
                <small> / {plan.durationDays} дн.</small>
              </p>
              <ul className="paywall-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button type="button" className="btn btn-primary" onClick={() => openInvoiceModal(plan)}>
                {t('paywall.payButton')}
              </button>
            </article>
          ))}
        </div>
      )}

      {planForWhatsapp ? (
        <>
          <button
            type="button"
            className="paywall-invoice-modal-backdrop"
            aria-label={t('common.cancel')}
            onClick={() => setPlanForWhatsapp(null)}
          />
          <div
            className="paywall-invoice-modal surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="paywall-invoice-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="paywall-invoice-title" className="paywall-invoice-modal-title">
              {t('paywall.invoiceModalTitle')}
            </h2>
            <p className="paywall-invoice-modal-desc">{t('paywall.invoiceModalDescription')}</p>
            <label className="input-label" htmlFor="paywall-invoice-phone">
              {t('paywall.invoiceModalLabel')}
            </label>
            <input
              id="paywall-invoice-phone"
              ref={invoiceInputRef}
              className="input"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={invoicePhone}
              onChange={(e) => {
                setInvoicePhone(e.target.value);
                if (invoiceError) setInvoiceError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmWhatsapp();
                }
              }}
              placeholder={t('paywall.invoiceModalPlaceholder')}
              aria-invalid={invoiceError}
            />
            {invoiceError ? (
              <p className="paywall-invoice-modal-error" role="alert">
                {t('paywall.invoiceModalError')}
              </p>
            ) : null}
            <div className="paywall-invoice-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPlanForWhatsapp(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmWhatsapp}>
                {t('paywall.invoiceModalOpen')}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

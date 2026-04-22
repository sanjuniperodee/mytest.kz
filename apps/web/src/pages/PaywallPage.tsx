import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBillingPlans } from '../api/hooks/useBilling';
import { useProfile } from '../api/hooks/useProfile';
import { Spinner } from '../components/common/Spinner';

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: plans, isLoading } = useBillingPlans();
  const { data: profile } = useProfile();
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const WA_NUMBER = '77775932124';
                  const message = `Здравствуйте! Хочу приобрести тариф "${plan.name}" за ${plan.priceKzt}₸`;
                  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
                }}
              >
                {t('paywall.payButton')}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBillingPlans, useCreateCheckout } from '../api/hooks/useBilling';
import { useProfile } from '../api/hooks/useProfile';
import { Spinner } from '../components/common/Spinner';

export function PaywallPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: plans, isLoading } = useBillingPlans();
  const { data: profile } = useProfile();
  const checkout = useCreateCheckout();
  const paymentStatus = searchParams.get('payment');
  const hasPremium = profile?.hasActiveSubscription === true;

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
            : profile?.trialStatus?.ent?.exhausted
            ? t('paywall.exhausted')
            : t('paywall.remaining', { count: profile?.trialStatus?.ent?.remaining ?? 0 })}
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
                disabled={checkout.isPending}
                onClick={async () => {
                  const data = await checkout.mutateAsync(plan.id);
                  window.location.href = data.checkoutUrl;
                }}
              >
                {checkout.isPending ? t('common.loading') : t('paywall.payButton')}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

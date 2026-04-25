import { useTranslation } from 'react-i18next';
import { AdmissionChanceWidget } from '../admission/AdmissionChanceWidget';

export function GrantEstimator() {
  const { t } = useTranslation();

  return (
    <section id="grant" className="lv2-section lv2-section--rule" aria-labelledby="lv2-grant-heading">
      <div className="lv2-wrap">
        <header className="lv2-section__head">
          <p className="lv2-kicker">{t('landing.sectionGrant')}</p>
          <h2 id="lv2-grant-heading" className="lv2-heading lv2-heading--section">
            {t('landing.grantTitle')}
          </h2>
          <p className="lv2-lead">{t('landing.grantLead')}</p>
        </header>
        <div className="lv2-widget-shell">
          <AdmissionChanceWidget variant="landing" />
        </div>
      </div>
    </section>
  );
}

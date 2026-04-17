import { useTranslation } from 'react-i18next';
import { AdmissionChanceWidget } from '../admission/AdmissionChanceWidget';

export function GrantEstimator() {
  const { t } = useTranslation();

  return (
    <section id="grant" className="ld-section ld-section-grant" aria-labelledby="ld-grant-title">
      <div className="ld-max">
        <p className="ld-eyebrow">{t('landing.sectionGrant')}</p>
        <h2 id="ld-grant-title" className="ld-grant-title">
          {t('landing.grantTitle')}
        </h2>
        <p className="ld-grant-lead">{t('landing.grantLead')}</p>
        <AdmissionChanceWidget variant="landing" />
      </div>
    </section>
  );
}

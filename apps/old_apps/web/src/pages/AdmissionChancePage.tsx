import { useTranslation } from 'react-i18next';
import { AdmissionChanceWidget } from '../components/admission/AdmissionChanceWidget';

export function AdmissionChancePage() {
  const { t } = useTranslation();

  return (
    <div className="page admission-chance-page">
      <header className="page-hero" style={{ marginBottom: 18 }}>
        <h1 className="page-title">{t('chance.pageTitle')}</h1>
        <p className="page-subtitle">{t('chance.pageLead')}</p>
      </header>
      <AdmissionChanceWidget variant="platform" />
    </div>
  );
}

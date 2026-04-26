import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../api/hooks/useAuth';
import { api } from '../../api/client';
import { AdvancedSEO } from '../../components/seo/AdvancedSEO';
import { buildLandingJsonLd, type FaqItem, type Step } from '../../components/seo/buildLandingJsonLd';
import { getSiteUrl } from '../../lib/siteUrl';
import { getWhatsAppUrl } from '../../lib/whatsapp';
import { WhatsAppFab } from '../../components/common/WhatsAppFab';
import { Spinner } from '../../components/common/Spinner';
import { LandingV3 } from '../../components/landing/LandingV3';

type LandingRuntimeSettings = {
  whatsappUrl: string;
};

export function LandingPageV3() {
  const { t, i18n } = useTranslation();
  const { user, isLoading } = useAuth();
  const [runtimeSettings, setRuntimeSettings] = useState<LandingRuntimeSettings | null>(null);
  const [runtimeSettingsLoaded, setRuntimeSettingsLoaded] = useState(false);

  const steps = useMemo(
    () => t('landingV3.pipelineSteps', { returnObjects: true }) as Step[],
    [t, i18n.language],
  );
  const faqForLd = useMemo(
    () => t('landingV3.faqItems', { returnObjects: true }) as FaqItem[],
    [t, i18n.language],
  );
  const jsonLd = useMemo(
    () =>
      buildLandingJsonLd(t, getSiteUrl(), steps, faqForLd, {
        keyPrefix: 'landingV3',
        pagePath: '/v3',
      }),
    [t, steps, faqForLd],
  );

  const htmlLang = i18n.language === 'kk' ? 'kk' : i18n.language === 'en' ? 'en' : 'ru';
  const waUrl = getWhatsAppUrl();
  const fallbackWhatsapp = t('landing.contactWhatsappHref');
  const whatsappHref = runtimeSettingsLoaded
    ? runtimeSettings?.whatsappUrl || fallbackWhatsapp
    : waUrl || fallbackWhatsapp;

  useEffect(() => {
    let cancelled = false;
    api
      .get<LandingRuntimeSettings>('/public/landing-settings')
      .then(({ data }) => {
        if (!cancelled) setRuntimeSettings(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRuntimeSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <Spinner fullScreen />;
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <>
      <AdvancedSEO
        title={t('landingV3.seoTitle')}
        description={t('landingV3.seoDescription')}
        keywords={t('landing.seoKeywords')}
        canonicalPath="/v3"
        jsonLd={jsonLd}
        htmlLang={htmlLang}
      />
      <LandingV3 whatsappHref={whatsappHref} />
      <WhatsAppFab layout="landing" />
    </>
  );
}

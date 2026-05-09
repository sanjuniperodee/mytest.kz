import type { TFunction } from 'i18next';

export type Step = { title: string; body: string };
export type FaqItem = { question: string; answer: string };

/** SEO text for this landing variant. If omitted, uses main `landing.*` keys. */
export type LandingJsonLdSeo = {
  pageTitle: string;
  pageDescription: string;
  howToName: string;
  howToDescription: string;
};

export type BuildLandingJsonLdOptions = {
  /** Path e.g. `/` or `/v3` (default `/`). */
  pagePath?: string;
  /** Per-page title/description/HowTo (e.g. /v3). Defaults: main `landing.*` SEO. */
  seo?: LandingJsonLdSeo;
};

export function buildLandingJsonLd(
  t: TFunction,
  siteUrl: string,
  steps: Step[],
  faq: FaqItem[],
  options?: BuildLandingJsonLdOptions,
): Record<string, unknown> {
  const pagePath = options?.pagePath ?? '/';
  const pathOnly = pagePath === '/' ? '' : (pagePath.startsWith('/') ? pagePath : `/${pagePath}`);
  const pageUrl = pathOnly ? `${siteUrl}${pathOnly}` : `${siteUrl}/`;
  const pageId = `${pageUrl}#webpage`;

  const orgId = `${siteUrl}/#organization`;
  const webId = `${siteUrl}/#website`;

  const pageTitle = options?.seo?.pageTitle ?? t('landing.seoTitle');
  const pageDescription = options?.seo?.pageDescription ?? t('landing.seoDescription');
  const howToName = options?.seo?.howToName ?? t('landing.seoHowToName');
  const howToDescription = options?.seo?.howToDescription ?? t('landing.seoHowToDescription');

  const orgDescription = t('landing.seoDescription');
  const leadUrl = `${siteUrl}/#lead`;
  const loginUrl = `${siteUrl}/login`;

  const organization = {
    '@type': 'Organization',
    '@id': orgId,
    name: 'MyTest',
    url: siteUrl,
    description: orgDescription,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/og-cover.svg`,
    },
    sameAs: ['https://t.me/bilimilimland'],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        telephone: '+7-777-593-2124',
        email: 'mytest.info.kz@gmail.com',
        areaServed: 'KZ',
        availableLanguage: ['Russian', 'Kazakh', 'English'],
      },
    ],
    knowsAbout: [
      'ЕНТ онлайн',
      'ҰБТ онлайн',
      'пробный ЕНТ',
      'подготовка к ЕНТ',
      'ENT grant score',
      'ҰБТ грант',
      'разбор ошибок',
    ],
    areaServed: { '@type': 'Country', name: 'Kazakhstan' },
    addressCountry: 'KZ',
  };

  const website = {
    '@type': 'WebSite',
    '@id': webId,
    url: siteUrl,
    name: 'MyTest',
    inLanguage: ['ru-KZ', 'kk-KZ', 'en'],
    publisher: { '@id': orgId },
    potentialAction: {
      '@type': 'RegisterAction',
      name: t('landing.footerCta'),
      target: loginUrl,
    },
  };

  const software = {
    '@type': 'SoftwareApplication',
    name: 'MyTest',
    url: siteUrl,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript. Modern browser.',
    isAccessibleForFree: true,
    publisher: { '@id': orgId },
    offers: {
      '@type': 'OfferCatalog',
      name: 'MyTest plans',
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'Free trial attempts',
          price: '0',
          priceCurrency: 'KZT',
          availability: 'https://schema.org/InStock',
          url: loginUrl,
        },
        {
          '@type': 'Offer',
          name: 'Monthly exam prep access',
          priceCurrency: 'KZT',
          availability: 'https://schema.org/InStock',
          url: loginUrl,
        },
      ],
    },
  };

  const service = {
    '@type': 'Service',
    '@id': `${siteUrl}/#exam-prep-service`,
    name: pageTitle,
    description: pageDescription,
    serviceType: 'Online exam preparation',
    provider: { '@id': orgId },
    areaServed: { '@type': 'Country', name: 'Kazakhstan' },
    audience: {
      '@type': 'EducationalAudience',
      educationalRole: 'student',
    },
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: pageUrl,
      availableLanguage: ['ru-KZ', 'kk-KZ', 'en'],
    },
    potentialAction: [
      {
        '@type': 'RegisterAction',
        name: t('landing.footerCta'),
        target: loginUrl,
      },
      {
        '@type': 'ContactAction',
        name: t('landing.leadSection'),
        target: leadUrl,
      },
    ],
  };

  const webPage = {
    '@type': 'WebPage',
    '@id': pageId,
    url: pageUrl,
    name: pageTitle,
    description: pageDescription,
    isPartOf: { '@id': webId },
    about: { '@id': orgId },
    inLanguage: ['ru-KZ', 'kk-KZ', 'en'],
    mainEntity: { '@id': `${siteUrl}/#exam-prep-service` },
    potentialAction: [
      {
        '@type': 'RegisterAction',
        name: t('landing.footerCta'),
        target: loginUrl,
      },
      {
        '@type': 'ContactAction',
        name: t('landing.leadSection'),
        target: leadUrl,
      },
    ],
  };

  const howTo = {
    '@type': 'HowTo',
    name: howToName,
    description: howToDescription,
    totalTime: 'PT10M',
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.title,
      text: s.body,
    })),
  };

  const faqPage = {
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [organization, website, software, service, webPage, howTo, faqPage],
  };
}

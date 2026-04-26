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
      '@type': 'Offer',
      name: 'Free trial attempts',
      price: '0',
      priceCurrency: 'KZT',
    },
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
    '@graph': [organization, website, software, webPage, howTo, faqPage],
  };
}

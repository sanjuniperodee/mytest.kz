import type { TFunction } from 'i18next';

export type Step = { title: string; body: string };
export type FaqItem = { question: string; answer: string };

export function buildLandingJsonLd(
  t: TFunction,
  siteUrl: string,
  steps: Step[],
  faq: FaqItem[],
): Record<string, unknown> {
  const orgId = `${siteUrl}/#organization`;
  const webId = `${siteUrl}/#website`;
  const pageId = `${siteUrl}/#webpage`;

  const organization = {
    '@type': 'Organization',
    '@id': orgId,
    name: 'MyTest',
    url: siteUrl,
    logo: `${siteUrl}/og-cover.svg`,
    description: t('landing.seoDescription'),
    sameAs: ['https://t.me/bilimilimland'],
  };

  const website = {
    '@type': 'WebSite',
    '@id': webId,
    url: siteUrl,
    name: 'MyTest',
    inLanguage: ['ru-KZ', 'kk-KZ', 'en'],
    publisher: { '@id': orgId },
    potentialAction: {
      '@type': 'ReadAction',
      target: [`${siteUrl}/login`],
    },
  };

  const software = {
    '@type': 'SoftwareApplication',
    name: 'MyTest',
    url: siteUrl,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript. Modern browser.',
    publisher: { '@id': orgId },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'KZT',
    },
  };

  const webPage = {
    '@type': 'WebPage',
    '@id': pageId,
    url: `${siteUrl}/`,
    name: t('landing.seoTitle'),
    description: t('landing.seoDescription'),
    isPartOf: { '@id': webId },
    about: { '@id': orgId },
    inLanguage: ['ru-KZ', 'kk-KZ', 'en'],
  };

  const howTo = {
    '@type': 'HowTo',
    name: t('landing.seoHowToName'),
    description: t('landing.seoHowToDescription'),
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

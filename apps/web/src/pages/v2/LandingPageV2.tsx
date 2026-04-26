import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../api/hooks/useAuth';
import { api } from '../../api/client';
import { Spinner } from '../../components/common/Spinner';
import { AdvancedSEO } from '../../components/seo/AdvancedSEO';
import { buildLandingJsonLd, type FaqItem } from '../../components/seo/buildLandingJsonLd';
import { getSiteUrl } from '../../lib/siteUrl';
import { getWhatsAppUrl } from '../../lib/whatsapp';
import { WhatsAppFab } from '../../components/common/WhatsAppFab';
import { resolveMediaUrl } from '../../lib/resolveMediaUrl';
import { getEffectiveTheme, setThemePreference } from '../../lib/theme';
import { useBillingPlans } from '../../api/hooks/useBilling';
import { AdmissionChanceWidget } from '../../components/admission/AdmissionChanceWidget';
import '../landing.css';
import './landing-v2.css';

type Step = { title: string; body: string };
type ValueProp = { title: string; body: string };
type PlatformFeature = { icon: 'progress' | 'mistakes' | 'topics' | 'thresholds'; title: string; body: string };
type DirectionShare = { label: string; pct: number };
type Testimonial = { quote: string; author: string };
type TrialFeature = { title: string; body: string };
type PricingTier = { id: string; name: string; price: string; period: string; badge?: string; features: string[] };
type TestTypeCard = { title: string; items: string[]; cta: string };
type Stat = { value: string; label: string };

type HeroSlide = {
  title?: string;
  subtitle?: string;
  desktopImageUrl: string;
  tabletImageUrl: string;
  mobileImageUrl: string;
  buttonLabel?: string;
  buttonHref?: string;
  showButton?: boolean;
  isActive?: boolean;
};

type LandingRuntimeSettings = {
  instructionVideoUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
  heroSlides?: HeroSlide[];
};

function shouldShowHeroCta(slide: HeroSlide): boolean {
  if (slide.showButton === false) return false;
  return Boolean(slide.buttonLabel?.trim() && slide.buttonHref?.trim());
}

function formatLandingPriceKzt(amount: number, language: string): string {
  const locale = language === 'en' ? 'en-US' : 'ru-RU';
  return `${new Intl.NumberFormat(locale).format(amount)} ₸`;
}

function toYoutubeEmbedUrl(rawUrl: string): string | null {
  const value = rawUrl.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) return value;
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isExternalHref(href: string | undefined): boolean {
  if (!href) return false;
  return /^https?:\/\//i.test(href);
}

function PlatformIcon({ name }: { name: PlatformFeature['icon'] }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 } as const;
  switch (name) {
    case 'progress':
      return (
        <svg {...common}>
          <path d="M4 19V5M8 19V11M12 19V8M16 19v-5M20 19V4" strokeLinecap="round" />
        </svg>
      );
    case 'mistakes':
      return (
        <svg {...common}>
          <path d="M12 3a6 6 0 0 1 6 6c0 4-6 12-6 12S6 13 6 9a6 6 0 0 1 6-6Z" />
          <path d="M12 10v3M12 16h.01" strokeLinecap="round" />
        </svg>
      );
    case 'topics':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
          <circle cx="18" cy="12" r="2" />
        </svg>
      );
    case 'thresholds':
      return (
        <svg {...common}>
          <path d="M4 20V4M4 20h16" strokeLinecap="round" />
          <path d="m7 16 4-5 4 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

const NAV_HREF: { key: string; id: string }[] = [
  { key: 'navLinkValue', id: 'value' },
  { key: 'navLinkStats', id: 'stats' },
  { key: 'navLinkFeatures', id: 'features' },
  { key: 'navLinkHow', id: 'how' },
  { key: 'navLinkGrant', id: 'grant' },
  { key: 'navLinkVideo', id: 'video' },
  { key: 'navLinkCatalog', id: 'catalog' },
  { key: 'navLinkPricing', id: 'pricing' },
  { key: 'navLinkFaq', id: 'faq' },
  { key: 'navLinkContact', id: 'lead' },
];

export function LandingPageV2() {
  const { t, i18n } = useTranslation();
  const { user, isLoading } = useAuth();
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadMessage, setLeadMessage] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadResult, setLeadResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [runtimeSettings, setRuntimeSettings] = useState<LandingRuntimeSettings | null>(null);
  const [runtimeSettingsLoaded, setRuntimeSettingsLoaded] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [landingTheme, setLandingTheme] = useState<'light' | 'dark'>(() => getEffectiveTheme());

  const t2 = (key: string) => t(`landingV2.${key}`);

  const valueProps = useMemo(
    () => t('landingV2.valueProps', { returnObjects: true }) as ValueProp[],
    [t, i18n.language],
  );
  const stats = useMemo(() => t('landingV2.stats', { returnObjects: true }) as Stat[], [t, i18n.language]);
  const features = useMemo(
    () => t('landingV2.features', { returnObjects: true }) as PlatformFeature[],
    [t, i18n.language],
  );
  const steps = useMemo(() => t('landingV2.steps', { returnObjects: true }) as Step[], [t, i18n.language]);
  const testTypes = useMemo(
    () => t('landingV2.testTypes', { returnObjects: true }) as TestTypeCard[],
    [t, i18n.language],
  );
  const directionShares = useMemo(
    () => t('landingV2.directionShares', { returnObjects: true }) as DirectionShare[],
    [t, i18n.language],
  );
  const testimonials = useMemo(
    () => t('landingV2.testimonials', { returnObjects: true }) as Testimonial[],
    [t, i18n.language],
  );
  const trialFeatures = useMemo(
    () => t('landingV2.trialFeatures', { returnObjects: true }) as TrialFeature[],
    [t, i18n.language],
  );
  const pricingTiers = useMemo(
    () => t('landingV2.pricingTiers', { returnObjects: true }) as PricingTier[],
    [t, i18n.language],
  );
  const { data: billingPlans } = useBillingPlans();
  const displayPricingTiers = useMemo(() => {
    if (!billingPlans?.length) return pricingTiers;
    return pricingTiers.map((tier) => {
      const plan = billingPlans.find((p) => p.id === tier.id);
      if (!plan) return tier;
      return { ...tier, price: formatLandingPriceKzt(plan.priceKzt, i18n.language) };
    });
  }, [billingPlans, pricingTiers, i18n.language]);

  const faqForLd = useMemo(
    () => t('landingV2.seoFaq', { returnObjects: true }) as FaqItem[],
    [t, i18n.language],
  );
  const jsonLd = useMemo(
    () =>
      buildLandingJsonLd(t, getSiteUrl(), steps, faqForLd, {
        pagePath: '/v2',
        seo: {
          pageTitle: t('landingV2.seoTitle', { defaultValue: t('landing.seoTitle') }),
          pageDescription: t('landingV2.seoDescription', { defaultValue: t('landing.seoDescription') }),
          howToName: t('landing.seoHowToName'),
          howToDescription: t('landing.seoHowToDescription'),
        },
      }),
    [t, steps, faqForLd],
  );

  const htmlLang = i18n.language === 'kk' ? 'kk' : i18n.language === 'en' ? 'en' : 'ru';
  const langs = ['ru', 'kk', 'en'] as const;
  const defaultHeroSlides = useMemo(
    () => (t('landing.heroSlides', { returnObjects: true }) as HeroSlide[]) || [],
    [t, i18n.language],
  );
  const instructionVideoUrl =
    runtimeSettings?.instructionVideoUrl || t('landingV2.instructionVideoUrl');
  const instructionVideoEmbedUrl = toYoutubeEmbedUrl(instructionVideoUrl);
  const instagramHref = runtimeSettings?.instagramUrl || t('landingV2.contactInstagramHref');
  const tiktokHref = runtimeSettings?.tiktokUrl || t('landingV2.contactTiktokHref');
  const fallbackWhatsapp = t('landingV2.contactWhatsappHref');
  const waUrl = getWhatsAppUrl();
  const whatsappHref = runtimeSettingsLoaded ? runtimeSettings?.whatsappUrl || fallbackWhatsapp : waUrl || fallbackWhatsapp;
  const heroSlides = (runtimeSettingsLoaded ? runtimeSettings?.heroSlides || [] : defaultHeroSlides).filter(
    (slide) => slide.isActive !== false,
  );
  const faqItems = useMemo(() => t('landingV2.seoFaq', { returnObjects: true }) as FaqItem[], [t, i18n.language]);

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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', landingTheme);
  }, [landingTheme]);

  useEffect(() => {
    if (heroSlides.length <= 1 || isCarouselPaused) return;
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [heroSlides, isCarouselPaused]);

  useEffect(() => {
    if (heroSlides.length === 0) {
      setHeroIndex(0);
      return;
    }
    if (heroIndex >= heroSlides.length) setHeroIndex(0);
  }, [heroSlides, heroIndex]);

  if (isLoading) {
    return <Spinner fullScreen />;
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  const handleLeadSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (leadLoading) return;
    setLeadLoading(true);
    setLeadResult('idle');
    try {
      await api.post('/leads', {
        name: leadName.trim(),
        phone: leadPhone.trim(),
        message: leadMessage.trim() || undefined,
        source: 'landing-v2',
      });
      setLeadName('');
      setLeadPhone('');
      setLeadMessage('');
      setLeadResult('success');
    } catch {
      setLeadResult('error');
    } finally {
      setLeadLoading(false);
    }
  };

  return (
    <>
      <AdvancedSEO
        title={t2('seoTitle')}
        description={t2('seoDescription')}
        keywords={t2('seoKeywords')}
        canonicalPath="/v2"
        htmlLang={htmlLang}
        i18nLanguage={i18n.language}
        jsonLd={jsonLd}
        ogImageAlt={t2('seoOgImageAlt')}
      />
      <div
        className={`landing-root lv2-root ${landingTheme === 'light' ? 'is-light' : ''}`}
        data-landing="v2"
      >
        <div className="lv2-ambient" aria-hidden />
        <div className="lv2-mesh" aria-hidden />

        <header className="lv2-topbar" role="banner">
          <div className="lv2-slab lv2-slab--bar">
            <div className="lv2-topbar__inner">
              <Link to="/" className="lv2-brand" aria-label={t('app.name')}>
                <span className="lv2-brand__mark" aria-hidden>
                  M
                </span>
                <span className="lv2-brand__name">
                  My<span>Test</span>
                </span>
                <span className="lv2-brand__tag">/ v2</span>
              </Link>

              <nav className="lv2-nav" aria-label={t2('navAria')}>
                {NAV_HREF.map((item) => (
                  <a key={item.id} className="lv2-nav__link" href={`#${item.id}`}>
                    {t2(item.key)}
                  </a>
                ))}
              </nav>

              <div className="lv2-topbar__actions">
                <button
                  type="button"
                  className="lv2-ghost"
                  onClick={() => {
                    const next = landingTheme === 'dark' ? 'light' : 'dark';
                    setLandingTheme(next);
                    setThemePreference(next);
                  }}
                  aria-label={t2('themeToggleAria')}
                >
                  {landingTheme === 'dark' ? t2('themeLight') : t2('themeDark')}
                </button>
                <div className="lv2-lang" role="group" aria-label={t2('langLabel')}>
                  {langs.map((lng) => (
                    <button
                      key={lng}
                      type="button"
                      className={i18n.language === lng ? 'is-active' : ''}
                      onClick={() => {
                        i18n.changeLanguage(lng);
                        localStorage.setItem('language', lng);
                      }}
                    >
                      {lng.toUpperCase()}
                    </button>
                  ))}
                </div>
                <Link to="/login" className="lv2-ghost lv2-ghost--login">
                  {t2('ctaLogin')}
                </Link>
                <Link to="/login" className="lv2-btn lv2-btn--primary">
                  {t2('ctaPrimary')}
                </Link>
              </div>
            </div>
          </div>
        </header>

        {heroSlides.length > 0 ? (
          <section className="lv2-hero" aria-label={t2('heroCarouselAria')}>
            <div className="lv2-hero__shell">
              {heroSlides.map((slide, idx) => {
                const titleText = slide.title?.trim() ?? '';
                const subtitleText = slide.subtitle?.trim() ?? '';
                const showOverlay = Boolean(titleText || subtitleText || shouldShowHeroCta(slide));
                return (
                  <article
                    key={`v2-hero-${idx}`}
                    className={`lv2-hero__slide ${idx === heroIndex ? 'is-active' : ''}`}
                    aria-hidden={idx !== heroIndex}
                  >
                    <picture>
                      <source media="(max-width: 767px)" srcSet={resolveMediaUrl(slide.mobileImageUrl)} />
                      <source media="(max-width: 1199px)" srcSet={resolveMediaUrl(slide.tabletImageUrl)} />
                      <img
                        src={resolveMediaUrl(slide.desktopImageUrl)}
                        alt={titleText || t2('heroBadge')}
                        loading={idx === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    </picture>
                    <div className="lv2-hero__veil" aria-hidden />
                    {showOverlay ? (
                      <div className="lv2-hero__content">
                        {titleText ? <h1 className="lv2-hero__title">{titleText}</h1> : null}
                        {subtitleText ? <p className="lv2-hero__sub">{subtitleText}</p> : null}
                        {shouldShowHeroCta(slide) ? (
                          isExternalHref(slide.buttonHref) ? (
                            <a
                              href={slide.buttonHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="lv2-btn lv2-btn--primary lv2-btn--lg"
                            >
                              {slide.buttonLabel!.trim()}
                            </a>
                          ) : (
                            <Link to={slide.buttonHref!.trim()} className="lv2-btn lv2-btn--primary lv2-btn--lg">
                              {slide.buttonLabel!.trim()}
                            </Link>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {heroSlides.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="lv2-hero__arrow lv2-hero__arrow--prev"
                    aria-label={t2('heroCarouselPrev')}
                    onClick={() => setHeroIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
                    onMouseEnter={() => setIsCarouselPaused(true)}
                    onMouseLeave={() => setIsCarouselPaused(false)}
                  />
                  <button
                    type="button"
                    className="lv2-hero__arrow lv2-hero__arrow--next"
                    aria-label={t2('heroCarouselNext')}
                    onClick={() => setHeroIndex((prev) => (prev + 1) % heroSlides.length)}
                    onMouseEnter={() => setIsCarouselPaused(true)}
                    onMouseLeave={() => setIsCarouselPaused(false)}
                  />
                </>
              ) : null}

              {heroSlides.length > 1 ? (
                <div
                  className="lv2-hero__dots"
                  role="tablist"
                  aria-label={t2('heroCarouselDotsAria')}
                  onMouseEnter={() => setIsCarouselPaused(true)}
                  onMouseLeave={() => setIsCarouselPaused(false)}
                >
                  {heroSlides.map((_, idx) => (
                    <button
                      key={`v2-dot-${idx}`}
                      type="button"
                      className={idx === heroIndex ? 'is-active' : ''}
                      onClick={() => setHeroIndex(idx)}
                      aria-label={`${t2('heroCarouselDot')} ${idx + 1}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <p className="lv2-hero__badge">{t2('heroBadge')}</p>
          </section>
        ) : null}

        <section className="lv2-section" id="value" aria-labelledby="lv2-value-h">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('valueKicker')}</p>
            <h2 className="lv2-h2" id="lv2-value-h">
              {t2('valueTitle')}
            </h2>
            <p className="lv2-lead">{t2('valueLead')}</p>
            <ul className="lv2-pill3">
              {valueProps.map((v) => (
                <li key={v.title} className="lv2-pill3__item">
                  <h3 className="lv2-pill3__title">{v.title}</h3>
                  <p className="lv2-pill3__body">{v.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lv2-section" id="stats" aria-labelledby="lv2-stats-h">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('sectionStats')}</p>
            <h2 className="lv2-sr" id="lv2-stats-h">
              {t2('sectionStats')}
            </h2>
            <div className="lv2-metricrow">
              {stats.map((s) => (
                <div key={s.label} className="lv2-metric">
                  <p className="lv2-metric__val">{s.value}</p>
                  <p className="lv2-metric__lbl">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lv2-section" id="features" aria-labelledby="lv2-features-h">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('featureKicker')}</p>
            <h2 className="lv2-h2" id="lv2-features-h">
              {t2('featureTitle')}
            </h2>
            <p className="lv2-lead lv2-lead--tight">{t2('featureLead')}</p>
            <div className="lv2-fgrid">
              {features.map((f) => (
                <article key={f.title} className="lv2-fcard">
                  <div className="lv2-fcard__ic" aria-hidden>
                    <PlatformIcon name={f.icon} />
                  </div>
                  <h3 className="lv2-fcard__t">{f.title}</h3>
                  <p className="lv2-fcard__b">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lv2-section lv2-section--tight" id="how">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('sectionHow')}</p>
            <h2 className="lv2-h2">{t2('howTitle')}</h2>
            <p className="lv2-lead lv2-lead--tight">{t2('howLead')}</p>
            <ol className="lv2-track">
              {steps.map((s, i) => (
                <li key={s.title} className="lv2-track__step">
                  <span className="lv2-track__n">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="lv2-track__t">{s.title}</h3>
                    <p className="lv2-track__b">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lv2-section" id="grant" aria-labelledby="lv2-grant-h">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('sectionGrant')}</p>
            <h2 className="lv2-h2" id="lv2-grant-h">
              {t2('grantTitle')}
            </h2>
            <p className="lv2-lead lv2-lead--tight">{t2('grantLead')}</p>
            <div className="lv2-grantbox">
              <AdmissionChanceWidget variant="landing" />
            </div>
          </div>
        </section>

        <section className="lv2-section" id="video" aria-labelledby="lv2-vid-h">
          <div className="lv2-slab lv2-slab--split">
            <div>
              <p className="lv2-eyebrow">{t2('sectionVideo')}</p>
              <h2 className="lv2-h2" id="lv2-vid-h">
                {t2('videoTitle')}
              </h2>
              <p className="lv2-lead lv2-lead--tight">{t2('videoLead')}</p>
            </div>
            <div className="lv2-vid">
              {instructionVideoEmbedUrl ? (
                <iframe
                  src={instructionVideoEmbedUrl}
                  title={t2('instructionVideoTitle')}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <a
                  href={instructionVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lv2-btn lv2-btn--soft"
                >
                  {t2('instructionOpenVideo')}
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="lv2-section" id="catalog" aria-labelledby="lv2-cat-h">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('sectionCatalog')}</p>
            <h2 className="lv2-h2" id="lv2-cat-h">
              {t2('catalogTitle')}
            </h2>
            <div className="lv2-examrow">
              {testTypes.map((card) => (
                <article key={card.title} className="lv2-exam">
                  <h3 className="lv2-exam__t">{card.title}</h3>
                  <ul className="lv2-exam__ul">
                    {card.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link to="/login" className="lv2-btn lv2-btn--soft">
                    {card.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lv2-section" id="directions" aria-labelledby="lv2-dir-h">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('sectionDirections')}</p>
            <h2 className="lv2-h2" id="lv2-dir-h">
              {t2('directionsTitle')}
            </h2>
            <p className="lv2-lead lv2-lead--tight">{t2('directionsLead')}</p>
            <ul className="lv2-bars">
              {directionShares.map((row) => (
                <li key={row.label} className="lv2-bars__row">
                  <div className="lv2-bars__head">
                    <span>{row.label}</span>
                    <span className="lv2-bars__pct">{row.pct}%</span>
                  </div>
                  <div className="lv2-bars__tr" aria-hidden>
                    <div className="lv2-bars__fill" style={{ width: `${Math.min(100, row.pct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lv2-section" id="reviews" aria-labelledby="lv2-rev-h">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('sectionReviews')}</p>
            <h2 className="lv2-h2" id="lv2-rev-h">
              {t2('reviewsTitle')}
            </h2>
            <div className="lv2-quotes">
              {testimonials.map((item) => (
                <blockquote key={item.author} className="lv2-quote">
                  <p>«{item.quote}»</p>
                  <footer>— {item.author}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section className="lv2-section lv2-section--accent" id="pricing" aria-labelledby="lv2-price-h">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('sectionTrial')}</p>
            <h2 className="lv2-h2" id="lv2-price-h">
              {t2('trialTitle')}
            </h2>
            <p className="lv2-lead">{t2('trialLead')}</p>
            <ul className="lv2-bullets">
              {trialFeatures.map((f) => (
                <li key={f.title}>
                  <strong>{f.title}</strong> — {f.body}
                </li>
              ))}
            </ul>
            <p className="lv2-slab__midtitle">{t2('pricingTitle')}</p>
            <div className="lv2-prices">
              {displayPricingTiers.map((tier) => (
                <article key={tier.id} className={`lv2-price ${tier.badge ? 'is-hot' : ''}`}>
                  <div className="lv2-price__head">
                    <h3>{tier.name}</h3>
                    {tier.badge ? <span className="lv2-price__badge">{tier.badge}</span> : null}
                  </div>
                  <p className="lv2-price__amt">
                    {tier.price} <small>{tier.period}</small>
                  </p>
                  <ul>
                    {tier.features.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className="lv2-fineprint">{t2('pricingFootnote')}</p>
            <div className="lv2-cta">
              <Link to="/login" className="lv2-btn lv2-btn--primary lv2-btn--lg">
                {t2('ctaPrimary')}
              </Link>
            </div>
          </div>
        </section>

        <section className="lv2-section" id="about">
          <div className="lv2-slab lv2-slab--about">
            <p className="lv2-eyebrow">{t2('sectionAbout')}</p>
            <h2 className="lv2-h2">{t2('aboutTitle')}</h2>
            <p className="lv2-prose">{t2('aboutOneLiner')}</p>
            <p className="lv2-inlinequote">{t2('quoteLine')}</p>
          </div>
        </section>

        <section className="lv2-section" id="faq" aria-labelledby="lv2-faq-h">
          <div className="lv2-slab">
            <p className="lv2-eyebrow">{t2('sectionFaq')}</p>
            <h2 className="lv2-h2" id="lv2-faq-h">
              {t2('faqTitle')}
            </h2>
            <p className="lv2-lead lv2-lead--tight">{t2('faqLead')}</p>
            <div className="lv2-faq">
              {faqItems.map((f, i) => {
                const open = faqOpen === i;
                const panelId = `lv2-faq-panel-${i}`;
                return (
                  <div key={f.question} className={`lv2-faq__item ${open ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="lv2-faq__q"
                      id={`lv2-faq-q-${i}`}
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setFaqOpen((prev) => (prev === i ? null : i))}
                    >
                      {f.question}
                    </button>
                    <div
                      id={panelId}
                      role="region"
                      className="lv2-faq__a"
                      aria-labelledby={`lv2-faq-q-${i}`}
                      hidden={!open}
                    >
                      {f.answer}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lv2-section" id="lead">
          <div className="lv2-slab lv2-slab--lead">
            <div>
              <p className="lv2-eyebrow">{t2('sectionLead')}</p>
              <h2 className="lv2-h2">{t2('leadTitle')}</h2>
              <p className="lv2-lead lv2-lead--tight">{t2('leadSubtitle')}</p>
            </div>
            <form className="lv2-form" onSubmit={handleLeadSubmit}>
              <label>
                <span>{t2('leadNameLabel')}</span>
                <input
                  type="text"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder={t2('leadNamePlaceholder')}
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                <span>{t2('leadPhoneLabel')}</span>
                <input
                  type="tel"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder={t2('leadPhonePlaceholder')}
                  autoComplete="tel"
                  minLength={5}
                  maxLength={30}
                  required
                />
              </label>
              <label>
                <span>{t2('leadMessageLabel')}</span>
                <textarea
                  value={leadMessage}
                  onChange={(e) => setLeadMessage(e.target.value)}
                  placeholder={t2('leadMessagePlaceholder')}
                  maxLength={1000}
                  rows={4}
                />
              </label>
              <button type="submit" className="lv2-btn lv2-btn--primary" disabled={leadLoading}>
                {leadLoading ? t2('leadSubmitting') : t2('leadSubmit')}
              </button>
              {leadResult === 'success' ? <p className="lv2-form__ok">{t2('leadSuccess')}</p> : null}
              {leadResult === 'error' ? <p className="lv2-form__err">{t2('leadError')}</p> : null}
            </form>
          </div>
        </section>

        <footer className="lv2-foot">
          <div className="lv2-slab lv2-slab--foot">
            <div>
              <p className="lv2-foot__strong">
                <strong>{t('app.name')}</strong> — {t2('footerTagline')}
              </p>
              <ul className="lv2-foot__social" aria-label={t2('footerSocialsAria')}>
                <li>
                  <a href={instagramHref} target="_blank" rel="noopener noreferrer">
                    {t2('contactInstagramLabel')}
                  </a>
                </li>
                <li>
                  <a href={tiktokHref} target="_blank" rel="noopener noreferrer">
                    {t2('contactTiktokLabel')}
                  </a>
                </li>
              </ul>
              <p className="lv2-foot__contact-title">{t2('footerContactTitle')}</p>
              <ul className="lv2-foot__contact" aria-label={t2('footerContactAria')}>
                <li>
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    {t2('contactWhatsappLabel')}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${t2('contactEmail')}`}>{t2('contactEmail')}</a>
                </li>
                <li>
                  <a href={t2('contactSiteHref')} target="_blank" rel="noopener noreferrer">
                    {t2('contactSiteLabel')}
                  </a>
                </li>
                <li>
                  <a href="/">{t2('footerClassicLanding')}</a>
                </li>
              </ul>
            </div>
            <div className="lv2-foot__end">
              <a href={whatsappHref} className="lv2-btn lv2-btn--soft" target="_blank" rel="noopener noreferrer">
                {t2('whatsappCta')}
              </a>
              <Link to="/login" className="lv2-btn lv2-btn--primary">
                {t2('footerCta')}
              </Link>
            </div>
          </div>
          <p className="lv2-foot__copy">{t2('footerRights')}</p>
        </footer>

        <WhatsAppFab layout="landing" />
      </div>
    </>
  );
}

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../api/hooks/useAuth';
import { api } from '../api/client';
import { Spinner } from '../components/common/Spinner';
import { AdvancedSEO } from '../components/seo/AdvancedSEO';
import { buildLandingJsonLd, type FaqItem } from '../components/seo/buildLandingJsonLd';
import { getSiteUrl } from '../lib/siteUrl';
import { getWhatsAppUrl } from '../lib/whatsapp';
import { WhatsAppFab } from '../components/common/WhatsAppFab';
import { resolveMediaUrl } from '../lib/resolveMediaUrl';
import { getEffectiveTheme, setThemePreference } from '../lib/theme';
import { useBillingPlans } from '../api/hooks/useBilling';
import { LandingStatsStrip } from '../components/landing/LandingStatsStrip';
import { GrantEstimator } from '../components/landing/GrantEstimator';
import './landing.css';

type Benefit = { tag: string; title: string; body: string };
type Step = { title: string; body: string };
type AboutFact = { title: string; body: string };
type PlatformFeature = { icon: 'progress' | 'mistakes' | 'topics' | 'thresholds'; title: string; body: string };
type DirectionShare = { label: string; pct: number };
type Testimonial = { quote: string; author: string };
type TrialFeature = { title: string; body: string };
type PricingTier = {
  id: string;
  name: string;
  price: string;
  period: string;
  badge?: string;
  features: string[];
};
type TestTypeCard = { title: string; items: string[]; cta: string };
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

const FALLBACK_SLIDE: HeroSlide = {
  desktopImageUrl:
    'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1800&q=80',
  tabletImageUrl:
    'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=80',
  mobileImageUrl:
    'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=800&q=80',
  showButton: false,
};

function shouldShowHeroCta(slide: HeroSlide): boolean {
  if (slide.showButton === false) return false;
  return Boolean(slide.buttonLabel?.trim() && slide.buttonHref?.trim());
}

function resolveCarouselSlides(
  runtimeLoaded: boolean,
  runtime: { heroSlides?: HeroSlide[] } | null,
  defaults: HeroSlide[],
): HeroSlide[] {
  const fromApi = runtimeLoaded && runtime?.heroSlides && runtime.heroSlides.length > 0 ? runtime.heroSlides : null;
  const base = fromApi ?? defaults;
  const active = base.filter(
    (s) => s.isActive !== false && (s.desktopImageUrl?.trim() || s.mobileImageUrl?.trim()),
  );
  if (active.length > 0) return active;
  const anyUrl = base.filter((s) => s.desktopImageUrl?.trim() || s.mobileImageUrl?.trim());
  if (anyUrl.length > 0) return anyUrl;
  return [FALLBACK_SLIDE];
}

type LandingRuntimeSettings = {
  instructionVideoUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
  heroSlides?: HeroSlide[];
};

function formatLandingPriceKzt(amount: number, language: string): string {
  const locale = language === 'en' ? 'en-US' : 'ru-RU';
  return `${new Intl.NumberFormat(locale).format(amount)} ₸`;
}

export function LandingPage() {
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
  const [landingTheme, setLandingTheme] = useState<'light' | 'dark'>(() =>
    getEffectiveTheme() === 'dark' ? 'dark' : 'light',
  );
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  const benefits = useMemo(
    () => t('landing.benefits', { returnObjects: true }) as Benefit[],
    [t, i18n.language],
  );
  const steps = useMemo(
    () => t('landing.steps', { returnObjects: true }) as Step[],
    [t, i18n.language],
  );
  const aboutFacts = useMemo(
    () => t('landing.aboutFacts', { returnObjects: true }) as AboutFact[],
    [t, i18n.language],
  );
  const trialFeatures = useMemo(
    () => t('landing.trialFeatures', { returnObjects: true }) as TrialFeature[],
    [t, i18n.language],
  );
  const { data: billingPlans } = useBillingPlans();
  const pricingTiers = useMemo(
    () => t('landing.pricingTiers', { returnObjects: true }) as PricingTier[],
    [t, i18n.language],
  );
  const displayPricingTiers = useMemo(() => {
    if (!billingPlans?.length) return pricingTiers;
    return pricingTiers.map((tier) => {
      const plan = billingPlans.find((p) => p.id === tier.id);
      if (!plan) return tier;
      return { ...tier, price: formatLandingPriceKzt(plan.priceKzt, i18n.language) };
    });
  }, [billingPlans, pricingTiers, i18n.language]);
  const testTypes = useMemo(
    () => t('landing.testTypes', { returnObjects: true }) as TestTypeCard[],
    [t, i18n.language],
  );
  const platformFeatures = useMemo(
    () => t('landing.platformFeatures', { returnObjects: true }) as PlatformFeature[],
    [t, i18n.language],
  );
  const directionShares = useMemo(
    () => t('landing.directionShares', { returnObjects: true }) as DirectionShare[],
    [t, i18n.language],
  );
  const testimonials = useMemo(
    () => t('landing.testimonials', { returnObjects: true }) as Testimonial[],
    [t, i18n.language],
  );

  const seoFaq = useMemo(
    () => t('landing.seoFaq', { returnObjects: true }) as FaqItem[],
    [t, i18n.language],
  );

  const jsonLd = useMemo(
    () => buildLandingJsonLd(t, getSiteUrl(), steps, seoFaq),
    [t, steps, seoFaq],
  );

  const htmlLang = i18n.language === 'kk' ? 'kk' : i18n.language === 'en' ? 'en' : 'ru';
  const langs = ['ru', 'kk', 'en'] as const;
  const marquee = `${t('landing.marqueeLine')} · `;
  const waUrl = getWhatsAppUrl();
  const fallbackWhatsAppHref = t('landing.contactWhatsappHref');
  const fallbackInstagramHref = t('landing.contactInstagramHref');
  const fallbackTiktokHref = t('landing.contactTiktokHref');
  const defaultHeroSlides = useMemo(
    () => (t('landing.heroSlides', { returnObjects: true }) as HeroSlide[]) || [],
    [t, i18n.language],
  );
  const instructionVideoUrl = runtimeSettings?.instructionVideoUrl || t('landing.instructionVideoUrl');
  const instructionVideoEmbedUrl = toYoutubeEmbedUrl(instructionVideoUrl);
  const instagramHref = runtimeSettings?.instagramUrl || fallbackInstagramHref;
  const tiktokHref = runtimeSettings?.tiktokUrl || fallbackTiktokHref;
  const whatsappHref = runtimeSettingsLoaded
    ? runtimeSettings?.whatsappUrl || fallbackWhatsAppHref
    : waUrl || fallbackWhatsAppHref;

  const carouselSlides = useMemo(
    () => resolveCarouselSlides(runtimeSettingsLoaded, runtimeSettings, defaultHeroSlides),
    [runtimeSettingsLoaded, runtimeSettings, defaultHeroSlides],
  );

  const progressPct = carouselSlides.length ? ((heroIndex + 1) / carouselSlides.length) * 100 : 0;

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
    document.documentElement.setAttribute('data-theme', landingTheme === 'dark' ? 'dark' : 'light');
  }, [landingTheme]);

  useEffect(() => {
    if (carouselSlides.length <= 1 || isCarouselPaused) return;
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % carouselSlides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [carouselSlides, isCarouselPaused]);

  useEffect(() => {
    if (carouselSlides.length === 0) {
      setHeroIndex(0);
      return;
    }
    if (heroIndex >= carouselSlides.length) {
      setHeroIndex(0);
    }
  }, [carouselSlides, heroIndex]);

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
        source: 'landing',
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

  const focusPlanId = 'month';

  return (
    <>
      <AdvancedSEO
        title={t('landing.seoTitle')}
        description={t('landing.seoDescription')}
        keywords={t('landing.seoKeywords')}
        canonicalPath="/"
        htmlLang={htmlLang}
        jsonLd={jsonLd}
        ogImageAlt={t('landing.seoOgImageAlt')}
      />
      <div className={`landing-root lv2 ${landingTheme === 'dark' ? 'is-dark' : ''}`}>
        <header className="lv2-bar">
          <div className="lv2-bar__inner">
            <Link to="/" className="lv2-mark">
              <span className="lv2-mark__sigil" aria-hidden />
              <span className="lv2-mark__word">MyTest</span>
            </Link>
            <nav className="lv2-nav" aria-label={t('landing.navAnchorsAria')}>
              <a href="#grant">{t('landing.navGrant')}</a>
              <a href="#benefits">{t('landing.navBenefits')}</a>
              <a href="#path">{t('landing.navHow')}</a>
              <a href="#catalog">{t('landing.navFormats')}</a>
              <a href="#pricing">{t('landing.navPricing')}</a>
            </nav>
            <div className="lv2-bar__tools">
              <button
                type="button"
                className="lv2-ghost"
                onClick={() => {
                  const next = landingTheme === 'dark' ? 'light' : 'dark';
                  setLandingTheme(next);
                  setThemePreference(next);
                }}
                aria-label={t('landing.themeToggleAria')}
              >
                {landingTheme === 'dark' ? t('landing.themeLight') : t('landing.themeDark')}
              </button>
              <div className="lv2-lang" role="group" aria-label={t('landing.langLabel')}>
                {langs.map((lng) => (
                  <button
                    key={lng}
                    type="button"
                    className={i18n.language === lng ? 'is-on' : ''}
                    onClick={() => {
                      i18n.changeLanguage(lng);
                      localStorage.setItem('language', lng);
                    }}
                  >
                    {lng.toUpperCase()}
                  </button>
                ))}
              </div>
              <Link to="/login" className="lv2-btn lv2-btn--solid">
                {t('landing.ctaTrial')}
              </Link>
            </div>
          </div>
        </header>

        <section className="lv2-hero" aria-label={t('landing.heroCarouselAria')}>
          <div className="lv2-hero__stage">
            {carouselSlides.map((slide, idx) => {
              const titleText = slide.title?.trim() ?? '';
              const subtitleText = slide.subtitle?.trim() ?? '';
              const showOverlay = Boolean(titleText || subtitleText || shouldShowHeroCta(slide));
              const slideAlt = titleText || subtitleText || t('landing.heroCarouselAria');
              return (
                <article
                  key={`hero-${idx}`}
                  className={`lv2-hero__slide ${idx === heroIndex ? 'is-on' : ''}`}
                  aria-hidden={idx !== heroIndex}
                >
                  <picture>
                    <source media="(max-width: 767px)" srcSet={resolveMediaUrl(slide.mobileImageUrl)} />
                    <source media="(max-width: 1199px)" srcSet={resolveMediaUrl(slide.tabletImageUrl)} />
                    <img
                      src={resolveMediaUrl(slide.desktopImageUrl)}
                      alt={slideAlt}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                    />
                  </picture>
                  {showOverlay ? (
                    <>
                      <div className="lv2-hero__veil" aria-hidden />
                      <div className="lv2-hero__caption">
                        <div className="lv2-hero__caption-inner">
                          {titleText ? <p className="lv2-hero__slide-title">{titleText}</p> : null}
                          {subtitleText ? <p className="lv2-hero__slide-sub">{subtitleText}</p> : null}
                          {shouldShowHeroCta(slide) ? (
                            isExternalHref(slide.buttonHref) ? (
                              <a
                                href={slide.buttonHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="lv2-btn lv2-btn--solid lv2-btn--lg"
                              >
                                {slide.buttonLabel!.trim()}
                              </a>
                            ) : (
                              <Link to={slide.buttonHref!.trim()} className="lv2-btn lv2-btn--solid lv2-btn--lg">
                                {slide.buttonLabel!.trim()}
                              </Link>
                            )
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : null}
                </article>
              );
            })}
            {carouselSlides.length > 1 ? (
              <>
                <button
                  type="button"
                  className="lv2-hero__arrow lv2-hero__arrow--prev"
                  aria-label={t('landing.heroCarouselPrev')}
                  onClick={() => setHeroIndex((p) => (p - 1 + carouselSlides.length) % carouselSlides.length)}
                  onMouseEnter={() => setIsCarouselPaused(true)}
                  onMouseLeave={() => setIsCarouselPaused(false)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="lv2-hero__arrow lv2-hero__arrow--next"
                  aria-label={t('landing.heroCarouselNext')}
                  onClick={() => setHeroIndex((p) => (p + 1) % carouselSlides.length)}
                  onMouseEnter={() => setIsCarouselPaused(true)}
                  onMouseLeave={() => setIsCarouselPaused(false)}
                >
                  ›
                </button>
              </>
            ) : null}
            <div className="lv2-hero__progress" aria-hidden>
              <div className="lv2-hero__progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </section>

        <section className="lv2-intro" aria-labelledby="lv2-page-title">
          <div className="lv2-wrap">
            <div className="lv2-intro__grid">
              <div>
                <p className="lv2-kicker">{t('landing.heroKicker')}</p>
                <h1 id="lv2-page-title" className="lv2-display">
                  {t('landing.heroTitle')}
                  <br />
                  {t('landing.heroTitleEm')}
                </h1>
                <p className="lv2-intro__lede">{t('landing.heroLead')}</p>
                <div className="lv2-intro__actions">
                  <Link to="/login" className="lv2-btn lv2-btn--solid lv2-btn--lg">
                    {t('landing.ctaTrial')}
                  </Link>
                  <a href="#grant" className="lv2-btn lv2-btn--line lv2-btn--lg">
                    {t('landing.ctaGrant')}
                  </a>
                </div>
              </div>
              <aside className="lv2-aside" aria-label={t('landing.ticketAria')}>
                <p className="lv2-aside__label">{t('landing.ticketLabel')}</p>
                <ul className="lv2-aside__list">
                  <li>
                    <span>{t('landing.ticketRow1L')}</span>
                    <span className="lv2-aside__meta">{t('landing.ticketRow1R')}</span>
                  </li>
                  <li>
                    <span>{t('landing.ticketRow2L')}</span>
                    <span className="lv2-aside__meta">{t('landing.ticketRow2R')}</span>
                  </li>
                  <li>
                    <span>{t('landing.ticketRow3L')}</span>
                    <span className="lv2-aside__meta">{t('landing.ticketRow3R')}</span>
                  </li>
                </ul>
                <p className="lv2-aside__note">{t('landing.ticketFoot')}</p>
              </aside>
            </div>
            <nav className="lv2-jump" aria-label={t('landing.heroQuickNavAria')}>
              <a href="#grant">{t('landing.sectionGrant')}</a>
              <a href="#benefits">{t('landing.sectionBenefits')}</a>
              <a href="#path">{t('landing.sectionHow')}</a>
              <a href="#catalog">{t('landing.sectionTestTypes')}</a>
              <a href="#pricing">{t('landing.navPricing')}</a>
              <a href="#contact">{t('landing.leadSection')}</a>
            </nav>
          </div>
        </section>

        <div className="lv2-wrap">
          <LandingStatsStrip />
        </div>

        <section id="benefits" className="lv2-section lv2-section--rule">
          <div className="lv2-wrap">
            <header className="lv2-section__head">
              <p className="lv2-kicker">{t('landing.sectionBenefits')}</p>
              <h2 className="lv2-heading--section">{t('landing.benefitsHeadline')}</h2>
              <p className="lv2-lead">{t('landing.benefitsLead')}</p>
            </header>
            <ul className="lv2-listing">
              {benefits.map((b) => (
                <li key={b.title} className="lv2-listing__item">
                  <span className="lv2-listing__tag">{b.tag}</span>
                  <div className="lv2-listing__main">
                    <h3 className="lv2-listing__title">{b.title}</h3>
                    <p className="lv2-listing__body">{b.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="path" className="lv2-section lv2-section--rule">
          <div className="lv2-wrap">
            <header className="lv2-section__head">
              <p className="lv2-kicker">{t('landing.sectionHow')}</p>
              <h2 className="lv2-heading--section">{t('landing.howHeadline')}</h2>
              <p className="lv2-lead">{t('landing.howLead')}</p>
            </header>
            <div className="lv2-path">
              {steps.map((step, i) => (
                <div key={step.title} className="lv2-path__step">
                  <span className="lv2-path__num" aria-hidden>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="lv2-path__title">{step.title}</h3>
                    <p className="lv2-path__text">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="catalog" className="lv2-section lv2-section--rule">
          <div className="lv2-wrap">
            <header className="lv2-section__head">
              <p className="lv2-kicker">{t('landing.sectionTestTypes')}</p>
              <h2 className="lv2-heading--section">{t('landing.testTypesTitle')}</h2>
              <p className="lv2-lead">{t('landing.testTypesLead')}</p>
            </header>
            <div className="lv2-row">
              {testTypes.map((card) => (
                <article key={card.title} className="lv2-panel">
                  <h3>{card.title}</h3>
                  <ul>
                    {card.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link to="/login" className="lv2-btn lv2-btn--solid">
                    {card.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="lv2-pull">
          <div className="lv2-wrap">
            <blockquote>
              <p className="lv2-pull__k">{t('landing.quoteKicker')}</p>
              <p className="lv2-pull__q">{t('landing.stripeQuote')}</p>
            </blockquote>
          </div>
        </div>

        <section id="platform" className="lv2-section lv2-section--rule">
          <div className="lv2-wrap">
            <header className="lv2-section__head">
              <p className="lv2-kicker">{t('landing.sectionPlatform')}</p>
              <h2 className="lv2-heading--section">{t('landing.platformHeading')}</h2>
              <p className="lv2-lead">{t('landing.platformLead')}</p>
            </header>
            <div className="lv2-grid-2">
              {platformFeatures.map((f) => (
                <div key={f.title} className="lv2-cell">
                  <div className="lv2-cell__icon" aria-hidden>
                    <PlatformIcon name={f.icon} />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <GrantEstimator />

        <section id="instruction" className="lv2-section lv2-section--rule">
          <div className="lv2-wrap">
            <header className="lv2-section__head">
              <p className="lv2-kicker">{t('landing.sectionInstruction')}</p>
              <h2 className="lv2-heading--section">{t('landing.instructionTitle')}</h2>
              <p className="lv2-lead">{t('landing.instructionLead')}</p>
            </header>
            <div className="lv2-split">
              <p className="lv2-video-tip">{t('landing.instructionTip')}</p>
              <div className="lv2-video">
                {instructionVideoEmbedUrl ? (
                  <iframe
                    src={instructionVideoEmbedUrl}
                    title={t('landing.instructionVideoTitle')}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <a href={instructionVideoUrl} target="_blank" rel="noopener noreferrer" className="lv2-btn lv2-btn--line">
                    {t('landing.instructionOpenVideo')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="lv2-ticker" aria-hidden>
          <div className="lv2-ticker__inner">
            <span>{marquee}</span>
            <span>{marquee}</span>
          </div>
        </div>

        <section id="about" className="lv2-section lv2-section--rule">
          <div className="lv2-wrap">
            <header className="lv2-section__head">
              <p className="lv2-kicker">{t('landing.sectionAbout')}</p>
              <h2 className="lv2-heading--section">{t('landing.aboutHeadline')}</h2>
            </header>
            <div className="lv2-about">
              <div className="lv2-about__text">
                <p>{t('landing.aboutLead')}</p>
                <p>{t('landing.aboutBody')}</p>
                <p>{t('landing.aboutClosing')}</p>
              </div>
              <div className="lv2-facts">
                {aboutFacts.map((fact) => (
                  <article key={fact.title} className="lv2-fact">
                    <h4>{fact.title}</h4>
                    <p>{fact.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="directions" className="lv2-section lv2-section--rule" aria-labelledby="lv2-dir-h">
          <div className="lv2-wrap lv2-split">
            <header className="lv2-section__head">
              <p className="lv2-kicker" id="lv2-dir-h">
                {t('landing.sectionDirections')}
              </p>
              <h2 className="lv2-heading--section">{t('landing.directionsHeadline')}</h2>
              <p className="lv2-lead">{t('landing.directionsLead')}</p>
            </header>
            <ul className="lv2-meter">
              {directionShares.map((row) => (
                <li key={row.label}>
                  <div className="lv2-meter__row">
                    <span>{row.label}</span>
                    <span className="lv2-meter__pct">{row.pct}%</span>
                  </div>
                  <div className="lv2-meter__bar" aria-hidden>
                    <div className="lv2-meter__fill" style={{ width: `${Math.min(100, row.pct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="reviews" className="lv2-section lv2-section--rule" aria-labelledby="lv2-rev-h">
          <div className="lv2-wrap">
            <header className="lv2-section__head">
              <p className="lv2-kicker" id="lv2-rev-h">
                {t('landing.sectionTestimonials')}
              </p>
              <h2 className="lv2-heading--section">{t('landing.testimonialsHeadline')}</h2>
            </header>
            <div className="lv2-voices">
              {testimonials.map((item) => (
                <blockquote key={item.author}>
                  <p>«{item.quote}»</p>
                  <footer>— {item.author}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="lv2-section lv2-section--rule">
          <div className="lv2-wrap">
            <header className="lv2-section__head">
              <p className="lv2-kicker">{t('landing.sectionTrial')}</p>
              <h2 className="lv2-heading--section">{t('landing.trialSectionHeadline')}</h2>
              <p className="lv2-lead">{t('landing.trialSectionLead')}</p>
            </header>
            <div className="lv2-price-layout">
              <div className="lv2-price-aside">
                <h3>{t('landing.trialTitle')}</h3>
                <p className="lv2-lead">{t('landing.trialLead')}</p>
                <ul className="lv2-check">
                  {trialFeatures.map((f) => (
                    <li key={f.title}>
                      <strong>{f.title}</strong>
                      <span>{f.body}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="lv2-plans">
                  {displayPricingTiers.map((tier) => (
                    <div
                      key={tier.id}
                      className={`lv2-plan${tier.id === focusPlanId ? ' lv2-plan--focus' : ''}`}
                    >
                      <div className="lv2-plan__head">
                        <h4>{tier.name}</h4>
                        {tier.badge ? <span className="lv2-plan__badge">{tier.badge}</span> : null}
                      </div>
                      <p className="lv2-plan__price">
                        {tier.price} <small>{tier.period}</small>
                      </p>
                      <ul>
                        {tier.features.map((feat) => (
                          <li key={feat}>{feat}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="lv2-plan-note">{t('landing.pricingFootnote')}</p>
                  <div className="lv2-plan-cta">
                    <Link to="/login" className="lv2-btn lv2-btn--solid lv2-btn--lg">
                      {t('landing.ctaTrial')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="lv2-section lv2-section--rule">
          <div className="lv2-wrap">
            <header className="lv2-section__head">
              <p className="lv2-kicker">{t('landing.leadSection')}</p>
              <h2 className="lv2-heading--section">{t('landing.leadTitle')}</h2>
              <p className="lv2-lead">{t('landing.leadSubtitle')}</p>
            </header>
            <div className="lv2-form-grid">
              <p className="lv2-form-hint">{t('landing.leadHint')}</p>
              <form className="lv2-form" onSubmit={handleLeadSubmit}>
                <div className="lv2-field">
                  <label>
                    <span>{t('landing.leadNameLabel')}</span>
                    <input
                      type="text"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder={t('landing.leadNamePlaceholder')}
                      autoComplete="name"
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  </label>
                </div>
                <div className="lv2-field">
                  <label>
                    <span>{t('landing.leadPhoneLabel')}</span>
                    <input
                      type="tel"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder={t('landing.leadPhonePlaceholder')}
                      autoComplete="tel"
                      minLength={5}
                      maxLength={30}
                      required
                    />
                  </label>
                </div>
                <div className="lv2-field">
                  <label>
                    <span>{t('landing.leadMessageLabel')}</span>
                    <textarea
                      value={leadMessage}
                      onChange={(e) => setLeadMessage(e.target.value)}
                      placeholder={t('landing.leadMessagePlaceholder')}
                      maxLength={1000}
                      rows={4}
                    />
                  </label>
                </div>
                <button type="submit" className="lv2-btn lv2-btn--solid lv2-btn--lg" disabled={leadLoading}>
                  {leadLoading ? t('landing.leadSubmitting') : t('landing.leadSubmit')}
                </button>
                {leadResult === 'success' ? (
                  <p className="lv2-form-msg lv2-form-msg--ok">{t('landing.leadSuccess')}</p>
                ) : null}
                {leadResult === 'error' ? (
                  <p className="lv2-form-msg lv2-form-msg--err">{t('landing.leadError')}</p>
                ) : null}
              </form>
            </div>
          </div>
        </section>

        <footer className="lv2-foot">
          <div className="lv2-wrap">
            <div className="lv2-foot__grid">
              <div>
                <p className="lv2-foot__tag">
                  <strong>{t('app.name')}</strong> — {t('landing.footerTagline')}
                </p>
                <ul aria-label={t('landing.footerSocialsAria')}>
                  <li>
                    <a href={instagramHref} target="_blank" rel="noopener noreferrer">
                      {t('landing.contactInstagramLabel')}
                    </a>
                  </li>
                  <li>
                    <a href={tiktokHref} target="_blank" rel="noopener noreferrer">
                      {t('landing.contactTiktokLabel')}
                    </a>
                  </li>
                </ul>
                <div aria-label={t('landing.footerContactAria')}>
                  <p className="lv2-kicker" style={{ marginBottom: 8 }}>
                    {t('landing.footerContactTitle')}
                  </p>
                  <ul>
                    <li>
                      <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                        {t('landing.contactWhatsappLabel')}
                      </a>
                    </li>
                    <li>
                      <a href={`mailto:${t('landing.contactEmail')}`}>{t('landing.contactEmail')}</a>
                    </li>
                    <li>
                      <a href={t('landing.contactSiteHref')} target="_blank" rel="noopener noreferrer">
                        {t('landing.contactSiteLabel')}
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="lv2-foot__cta">
                <a href={whatsappHref} className="lv2-btn lv2-btn--line" target="_blank" rel="noopener noreferrer">
                  {t('landing.whatsappCta')}
                </a>
                <Link to="/login" className="lv2-btn lv2-btn--solid">
                  {t('landing.ctaTrial')}
                </Link>
              </div>
            </div>
            <p className="lv2-foot__legal">{t('landing.footerRights')}</p>
          </div>
        </footer>

        <WhatsAppFab layout="landing" />
      </div>
    </>
  );
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
  const c = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const;
  switch (name) {
    case 'progress':
      return (
        <svg {...c}>
          <path d="M4 19V5M8 19V11M12 19V8M16 19v-5M20 19V4" strokeLinecap="round" />
        </svg>
      );
    case 'mistakes':
      return (
        <svg {...c}>
          <path d="M12 3a6 6 0 0 1 6 6c0 4-6 12-6 12S6 13 6 9a6 6 0 0 1 6-6Z" />
          <path d="M12 10v3M12 16h.01" strokeLinecap="round" />
        </svg>
      );
    case 'topics':
      return (
        <svg {...c}>
          <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
          <circle cx="18" cy="12" r="2" />
        </svg>
      );
    case 'thresholds':
      return (
        <svg {...c}>
          <path d="M4 20V4M4 20h16" strokeLinecap="round" />
          <path d="m7 16 4-5 4 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

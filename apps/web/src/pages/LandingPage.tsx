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

function shouldShowHeroCta(slide: HeroSlide): boolean {
  if (slide.showButton === false) return false;
  return Boolean(slide.buttonLabel?.trim() && slide.buttonHref?.trim());
}

type LandingRuntimeSettings = {
  instructionVideoUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
  heroSlides?: HeroSlide[];
};

const STEP_ICONS = [
  <IconLogin key="i0" />,
  <IconLayers key="i1" />,
  <IconTarget key="i2" />,
];

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
  const [landingTheme, setLandingTheme] = useState<'light' | 'dark'>(() => getEffectiveTheme());
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
  const heroSlides = (runtimeSettingsLoaded ? runtimeSettings?.heroSlides || [] : defaultHeroSlides).filter(
    (slide) => slide.isActive !== false,
  );

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
    if (heroIndex >= heroSlides.length) {
      setHeroIndex(0);
    }
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
      <div className={`landing-root ${landingTheme === 'light' ? 'is-light' : ''}`}>
        <div className="ld-aurora" aria-hidden />
        <div className="ld-grid" aria-hidden />
        <div className="ld-noise" aria-hidden />

        <header className="ld-nav">
          <div className="ld-max ld-nav-inner">
            <div className="ld-logo" aria-label={t('app.name')}>
              <span className="ld-logo-mark">M</span>
              <span className="ld-logo-text">
                My<span>Test</span>
              </span>
            </div>
            <div className="ld-nav-actions">
              <button
                type="button"
                className="ld-theme-toggle"
                onClick={() => {
                  const next = landingTheme === 'dark' ? 'light' : 'dark';
                  setLandingTheme(next);
                  setThemePreference(next);
                }}
                aria-label={t('landing.themeToggleAria')}
              >
                {landingTheme === 'dark' ? t('landing.themeLight') : t('landing.themeDark')}
              </button>
              <div className="ld-lang" role="group" aria-label={t('landing.langLabel')}>
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
              <Link to="/login" className="ld-btn ld-btn-primary">
                {t('landing.ctaTrial')}
              </Link>
            </div>
          </div>
        </header>

        {heroSlides.length > 0 ? (
          <section className="ld-hero-carousel" aria-label={t('landing.heroCarouselAria')}>
            <div className="ld-max">
              <div className="ld-carousel-shell">
                {heroSlides.map((slide, idx) => {
                  const titleText = slide.title?.trim() ?? '';
                  const subtitleText = slide.subtitle?.trim() ?? '';
                  const showOverlay = Boolean(titleText || subtitleText || shouldShowHeroCta(slide));
                  return (
                    <article
                      key={`hero-slide-${idx}`}
                      className={`ld-carousel-slide ${idx === heroIndex ? 'is-active' : ''}`}
                      aria-hidden={idx !== heroIndex}
                    >
                      <picture>
                        <source media="(max-width: 767px)" srcSet={resolveMediaUrl(slide.mobileImageUrl)} />
                        <source media="(max-width: 1199px)" srcSet={resolveMediaUrl(slide.tabletImageUrl)} />
                        <img
                          src={resolveMediaUrl(slide.desktopImageUrl)}
                          alt={titleText}
                          loading={idx === 0 ? 'eager' : 'lazy'}
                        />
                      </picture>
                      {showOverlay ? (
                        <div className="ld-carousel-overlay">
                          {titleText ? <h1 className="ld-carousel-title">{titleText}</h1> : null}
                          {subtitleText ? <p className="ld-carousel-subtitle">{subtitleText}</p> : null}
                          {shouldShowHeroCta(slide) ? (
                            isExternalHref(slide.buttonHref) ? (
                              <a
                                href={slide.buttonHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ld-btn ld-btn-primary ld-btn-lg"
                              >
                                {slide.buttonLabel!.trim()}
                              </a>
                            ) : (
                              <Link to={slide.buttonHref!.trim()} className="ld-btn ld-btn-primary ld-btn-lg">
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
                      className="ld-carousel-nav is-prev"
                      aria-label={t('landing.heroCarouselPrev')}
                      onClick={() => setHeroIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
                      onMouseEnter={() => setIsCarouselPaused(true)}
                      onMouseLeave={() => setIsCarouselPaused(false)}
                    >
                      <span aria-hidden>‹</span>
                    </button>
                    <button
                      type="button"
                      className="ld-carousel-nav is-next"
                      aria-label={t('landing.heroCarouselNext')}
                      onClick={() => setHeroIndex((prev) => (prev + 1) % heroSlides.length)}
                      onMouseEnter={() => setIsCarouselPaused(true)}
                      onMouseLeave={() => setIsCarouselPaused(false)}
                    >
                      <span aria-hidden>›</span>
                    </button>
                  </>
                ) : null}
                {heroSlides.length > 1 ? (
                  <div
                    className="ld-carousel-dots"
                    role="tablist"
                    aria-label={t('landing.heroCarouselDotsAria')}
                    onMouseEnter={() => setIsCarouselPaused(true)}
                    onMouseLeave={() => setIsCarouselPaused(false)}
                  >
                    {heroSlides.map((_, idx) => (
                      <button
                        key={`hero-slide-dot-${idx}`}
                        type="button"
                        className={idx === heroIndex ? 'is-active' : ''}
                        onClick={() => setHeroIndex(idx)}
                        aria-label={`${t('landing.heroCarouselDot')} ${idx + 1}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="ld-hero-meta" aria-label={t('landing.heroQuickNavAria')}>
          <div className="ld-max">
            <div className="ld-hero-pills">
              <a href="#grant" className="ld-hero-pill">
                {t('landing.sectionGrant')}
              </a>
              <a href="#test-types" className="ld-hero-pill">
                {t('landing.sectionTestTypes')}
              </a>
              <a href="#instruction" className="ld-hero-pill">
                {t('landing.sectionInstruction')}
              </a>
              <a href="#lead" className="ld-hero-pill">
                {t('landing.leadSection')}
              </a>
            </div>
          </div>
        </section>

        <LandingStatsStrip />
        <GrantEstimator />

        <section className="ld-section ld-section-instruction" id="instruction">
          <div className="ld-max">
            <p className="ld-eyebrow">{t('landing.sectionInstruction')}</p>
            <div className="ld-instruction-wrap">
              <div>
                <h2 className="ld-trial-title">{t('landing.instructionTitle')}</h2>
                <p className="ld-trial-lead">{t('landing.instructionLead')}</p>
              </div>
              <div className="ld-instruction-video">
                {instructionVideoEmbedUrl ? (
                  <iframe
                    src={instructionVideoEmbedUrl}
                    title={t('landing.instructionVideoTitle')}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <a href={instructionVideoUrl} target="_blank" rel="noopener noreferrer" className="ld-btn ld-btn-glass">
                    {t('landing.instructionOpenVideo')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="ld-marquee-outer" aria-hidden>
          <div className="ld-marquee-track">
            <span>{marquee}</span>
            <span>{marquee}</span>
          </div>
        </div>

        <section id="benefits" className="ld-section">
          <div className="ld-max">
            <p className="ld-eyebrow">{t('landing.sectionBenefits')}</p>
            <div className="ld-bento">
              {benefits.map((b, i) => (
                <article key={b.title} className={`ld-tile ld-tile-${i}`}>
                  <span className="ld-tile-tag">{b.tag}</span>
                  <h3 className="ld-tile-title">{b.title}</h3>
                  <p className="ld-tile-body">{b.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="test-types" className="ld-section ld-section-test-types">
          <div className="ld-max">
            <p className="ld-eyebrow">{t('landing.sectionTestTypes')}</p>
            <h2 className="ld-trial-title">{t('landing.testTypesTitle')}</h2>
            <div className="ld-test-types-grid">
              {testTypes.map((card) => (
                <article key={card.title} className="ld-test-type-card">
                  <h3>{card.title}</h3>
                  <ul>
                    {card.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link to="/login" className="ld-btn ld-btn-primary">
                    {card.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ld-pullquote">
          <div className="ld-max">
            <div className="ld-quote-card">
              <blockquote className="ld-quote-text">{t('landing.stripeQuote')}</blockquote>
            </div>
          </div>
        </section>

        <section id="how" className="ld-section ld-section-how">
          <div className="ld-max">
            <p className="ld-eyebrow">{t('landing.sectionHow')}</p>
            <div className="ld-steps">
              {steps.map((step, i) => (
                <div key={step.title} className="ld-step-card">
                  <div className="ld-step-icon" aria-hidden>
                    {STEP_ICONS[i] ?? <IconTarget />}
                  </div>
                  <span className="ld-step-num">{String(i + 1).padStart(2, '0')}</span>
                  <h4 className="ld-step-title">{step.title}</h4>
                  <p className="ld-step-body">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="ld-section ld-about">
          <div className="ld-max">
            <p className="ld-eyebrow">{t('landing.sectionAbout')}</p>
            <p className="ld-about-lead">{t('landing.aboutLead')}</p>
            <p className="ld-about-body">{t('landing.aboutBody')}</p>
            <p className="ld-about-body ld-about-body-secondary">{t('landing.aboutClosing')}</p>
            <div className="ld-about-facts">
              {aboutFacts.map((fact) => (
                <article key={fact.title} className="ld-about-fact">
                  <h4>{fact.title}</h4>
                  <p>{fact.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="platform" className="ld-section ld-section-platform">
          <div className="ld-max">
            <p className="ld-eyebrow">{t('landing.sectionPlatform')}</p>
            <h2 className="ld-platform-heading">{t('landing.platformHeading')}</h2>
            <p className="ld-platform-lead">{t('landing.platformLead')}</p>
            <div className="ld-platform-grid">
              {platformFeatures.map((feature) => (
                <article key={feature.title} className="ld-platform-card">
                  <div className="ld-platform-icon" aria-hidden>
                    <PlatformIcon name={feature.icon} />
                  </div>
                  <h3 className="ld-platform-title">{feature.title}</h3>
                  <p className="ld-platform-body">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="directions" className="ld-section ld-section-directions" aria-labelledby="ld-directions-title">
          <div className="ld-max">
            <p className="ld-eyebrow" id="ld-directions-title">
              {t('landing.sectionDirections')}
            </p>
            <p className="ld-directions-lead">{t('landing.directionsLead')}</p>
            <ul className="ld-directions-list">
              {directionShares.map((row) => (
                <li key={row.label} className="ld-directions-row">
                  <div className="ld-directions-row-head">
                    <span className="ld-directions-label">{row.label}</span>
                    <span className="ld-directions-pct">{row.pct}%</span>
                  </div>
                  <div className="ld-directions-track" aria-hidden>
                    <div className="ld-directions-fill" style={{ width: `${Math.min(100, row.pct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="reviews" className="ld-section ld-section-testimonials" aria-labelledby="ld-reviews-title">
          <div className="ld-max">
            <p className="ld-eyebrow" id="ld-reviews-title">
              {t('landing.sectionTestimonials')}
            </p>
            <div className="ld-testimonials-grid">
              {testimonials.map((item) => (
                <blockquote key={item.author} className="ld-testimonial">
                  <p className="ld-testimonial-quote">«{item.quote}»</p>
                  <footer className="ld-testimonial-author">— {item.author}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section className="ld-section ld-section-trial">
          <div className="ld-max">
            <p className="ld-eyebrow">{t('landing.sectionTrial')}</p>
            <div className="ld-trial-wrap">
              <div>
                <h2 className="ld-trial-title">{t('landing.trialTitle')}</h2>
                <p className="ld-trial-lead">{t('landing.trialLead')}</p>
                <div className="ld-trial-grid">
                  {trialFeatures.map((feature) => (
                    <article key={feature.title} className="ld-trial-item">
                      <h4>{feature.title}</h4>
                      <p>{feature.body}</p>
                    </article>
                  ))}
                </div>
              </div>
              <aside className="ld-pricing-preview">
                <p className="ld-pricing-title">{t('landing.pricingTitle')}</p>
                <div className="ld-pricing-list">
                  {displayPricingTiers.map((tier) => (
                    <article key={tier.id} className="ld-pricing-card">
                      <div className="ld-pricing-card-head">
                        <h4>{tier.name}</h4>
                        {tier.badge ? <span>{tier.badge}</span> : null}
                      </div>
                      <p className="ld-pricing-price">
                        {tier.price} <small>{tier.period}</small>
                      </p>
                      <ul>
                        {tier.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
                <p className="ld-pricing-footnote">{t('landing.pricingFootnote')}</p>
                <Link to="/login" className="ld-btn ld-btn-primary ld-btn-lg">
                  {t('landing.ctaTrial')}
                </Link>
              </aside>
            </div>
          </div>
        </section>

        <section className="ld-section ld-section-lead" id="lead">
          <div className="ld-max">
            <p className="ld-eyebrow">{t('landing.leadSection')}</p>
            <div className="ld-lead-wrap">
              <div>
                <h2 className="ld-trial-title">{t('landing.leadTitle')}</h2>
                <p className="ld-trial-lead">{t('landing.leadSubtitle')}</p>
              </div>
              <form className="ld-lead-form" onSubmit={handleLeadSubmit}>
                <label className="ld-lead-field">
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
                <label className="ld-lead-field">
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
                <label className="ld-lead-field">
                  <span>{t('landing.leadMessageLabel')}</span>
                  <textarea
                    value={leadMessage}
                    onChange={(e) => setLeadMessage(e.target.value)}
                    placeholder={t('landing.leadMessagePlaceholder')}
                    maxLength={1000}
                    rows={4}
                  />
                </label>
                <button type="submit" className="ld-btn ld-btn-primary ld-btn-lg" disabled={leadLoading}>
                  {leadLoading ? t('landing.leadSubmitting') : t('landing.leadSubmit')}
                </button>
                {leadResult === 'success' ? (
                  <p className="ld-lead-status ld-lead-status-success">{t('landing.leadSuccess')}</p>
                ) : null}
                {leadResult === 'error' ? (
                  <p className="ld-lead-status ld-lead-status-error">{t('landing.leadError')}</p>
                ) : null}
              </form>
            </div>
          </div>
        </section>

        <footer className="ld-footer">
          <div className="ld-max ld-footer-inner">
            <div className="ld-footer-brand">
              <p className="ld-footer-copy">
                <strong>{t('app.name')}</strong> — {t('landing.footerTagline')}
              </p>
              <ul className="ld-footer-socials" aria-label={t('landing.footerSocialsAria')}>
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
              <div className="ld-footer-contact" aria-label={t('landing.footerContactAria')}>
                <p className="ld-footer-contact-title">{t('landing.footerContactTitle')}</p>
                <ul className="ld-footer-contact-list">
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
            <div className="ld-footer-actions">
              <a href={whatsappHref} className="ld-btn ld-btn-glass" target="_blank" rel="noopener noreferrer">
                {t('landing.whatsappCta')}
              </a>
              <Link to="/login" className="ld-btn ld-btn-primary">
                {t('landing.ctaTrial')}
              </Link>
            </div>
          </div>
          <div className="ld-max">
            <p className="ld-footer-rights">{t('landing.footerRights')}</p>
          </div>
        </footer>

        {whatsappHref ? (
          <a
            href={whatsappHref}
            className="ld-wa-fab"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('landing.whatsappFabAria')}
          >
            <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
              />
            </svg>
          </a>
        ) : null}
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

function IconLogin() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function PlatformIcon({ name }: { name: PlatformFeature['icon'] }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 } as const;
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
      return <IconTarget />;
  }
}

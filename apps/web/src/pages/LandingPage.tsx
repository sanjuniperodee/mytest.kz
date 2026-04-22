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
type PricingTier = { name: string; price: string; period: string; badge?: string; features: string[] };
type TestTypeCard = { title: string; items: string[]; cta: string };
type HeroSlide = {
  title: string;
  subtitle?: string;
  desktopImageUrl: string;
  tabletImageUrl: string;
  mobileImageUrl: string;
  buttonLabel?: string;
};
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
  const pricingTiers = useMemo(
    () => t('landing.pricingTiers', { returnObjects: true }) as PricingTier[],
    [t, i18n.language],
  );
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
  const heroSlides = runtimeSettingsLoaded ? runtimeSettings?.heroSlides || [] : defaultHeroSlides;

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
    if (heroSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [heroSlides]);

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
                {heroSlides.map((slide, idx) => (
                  <article
                    key={`${slide.title}-${idx}`}
                    className={`ld-carousel-slide ${idx === heroIndex ? 'is-active' : ''}`}
                    aria-hidden={idx !== heroIndex}
                  >
                    <picture>
                      <source media="(max-width: 767px)" srcSet={resolveMediaUrl(slide.mobileImageUrl)} />
                      <source media="(max-width: 1199px)" srcSet={resolveMediaUrl(slide.tabletImageUrl)} />
                      <img
                        src={resolveMediaUrl(slide.desktopImageUrl)}
                        alt={slide.title}
                        loading={idx === 0 ? 'eager' : 'lazy'}
                      />
                    </picture>
                    <div className="ld-carousel-overlay">
                      <h1 className="ld-carousel-title">{slide.title}</h1>
                      {slide.subtitle ? <p className="ld-carousel-subtitle">{slide.subtitle}</p> : null}
                      <Link to="/login" className="ld-btn ld-btn-primary ld-btn-lg">
                        {slide.buttonLabel || t('landing.ctaTrial')}
                      </Link>
                    </div>
                  </article>
                ))}
                {heroSlides.length > 1 ? (
                  <div className="ld-carousel-dots" role="tablist" aria-label={t('landing.heroCarouselDotsAria')}>
                    {heroSlides.map((slide, idx) => (
                      <button
                        key={`${slide.title}-dot-${idx}`}
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
                  {pricingTiers.map((tier) => (
                    <article key={tier.name} className="ld-pricing-card">
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

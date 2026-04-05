import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../api/hooks/useAuth';
import { Spinner } from '../components/common/Spinner';
import { AdvancedSEO } from '../components/seo/AdvancedSEO';
import { buildLandingJsonLd, type FaqItem } from '../components/seo/buildLandingJsonLd';
import { getSiteUrl } from '../lib/siteUrl';
import { getWhatsAppUrl } from '../lib/whatsapp';
import { LandingStatsStrip } from '../components/landing/LandingStatsStrip';
import { GrantEstimator } from '../components/landing/GrantEstimator';
import './landing.css';

type Benefit = { tag: string; title: string; body: string };
type Step = { title: string; body: string };

const STEP_ICONS = [
  <IconLogin key="i0" />,
  <IconLayers key="i1" />,
  <IconTarget key="i2" />,
];

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const { user, isLoading } = useAuth();

  const benefits = useMemo(
    () => t('landing.benefits', { returnObjects: true }) as Benefit[],
    [t, i18n.language],
  );
  const steps = useMemo(
    () => t('landing.steps', { returnObjects: true }) as Step[],
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

  if (isLoading) {
    return <Spinner fullScreen />;
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  const langs = ['ru', 'kk', 'en'] as const;
  const marquee = `${t('landing.marqueeLine')} · `;
  const waUrl = getWhatsAppUrl();

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
      <div className="landing-root">
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
                {t('landing.ctaLogin')}
              </Link>
            </div>
          </div>
        </header>

        <section className="ld-hero" aria-labelledby="ld-hero-title">
          <div className="ld-max ld-hero-grid">
            <div className="ld-hero-copy">
              <span className="ld-chip">{t('landing.heroBadge')}</span>
              <p className="ld-kicker">{t('landing.heroKicker')}</p>
              <h1 id="ld-hero-title" className="ld-headline">
                <span className="ld-headline-a">{t('landing.heroTitle')}</span>{' '}
                <span className="ld-headline-b">{t('landing.heroTitleEm')}</span>
              </h1>
              <p className="ld-lead">{t('landing.heroLead')}</p>
              <div className="ld-hero-btns">
                <Link to="/login" className="ld-btn ld-btn-primary ld-btn-lg">
                  {t('landing.ctaLogin')}
                </Link>
                <a href="#grant" className="ld-btn ld-btn-glass">
                  {t('landing.ctaGrant')}
                </a>
                <a href="#how" className="ld-btn ld-btn-glass">
                  {t('landing.ctaScroll')}
                </a>
              </div>
            </div>

            <aside className="ld-glass" aria-label={t('landing.ticketAria')}>
              <div className="ld-glass-glow" aria-hidden />
              <p className="ld-glass-label">{t('landing.ticketLabel')}</p>
              <ul className="ld-glass-rows">
                <li>
                  <span>{t('landing.ticketRow1L')}</span>
                  <span className="ld-muted">{t('landing.ticketRow1R')}</span>
                </li>
                <li>
                  <span>{t('landing.ticketRow2L')}</span>
                  <span className="ld-muted">{t('landing.ticketRow2R')}</span>
                </li>
                <li>
                  <span>{t('landing.ticketRow3L')}</span>
                  <span className="ld-muted">{t('landing.ticketRow3R')}</span>
                </li>
              </ul>
              <p className="ld-glass-foot">{t('landing.ticketFoot')}</p>
            </aside>
          </div>
        </section>

        <LandingStatsStrip />
        <GrantEstimator />

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
          </div>
        </section>

        <footer className="ld-footer">
          <div className="ld-max ld-footer-inner">
            <p className="ld-footer-copy">
              <strong>{t('app.name')}</strong> — {t('landing.footerTagline')}
            </p>
            <div className="ld-footer-actions">
              {waUrl ? (
                <a
                  href={waUrl}
                  className="ld-btn ld-btn-glass"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('landing.whatsappCta')}
                </a>
              ) : null}
              <Link to="/login" className="ld-btn ld-btn-primary">
                {t('landing.footerCta')}
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
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

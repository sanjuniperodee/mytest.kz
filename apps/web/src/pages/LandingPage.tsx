import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../api/hooks/useAuth';
import { Spinner } from '../components/common/Spinner';
import { AdvancedSEO } from '../components/seo/AdvancedSEO';
import { buildLandingJsonLd, type FaqItem } from '../components/seo/buildLandingJsonLd';
import { getSiteUrl } from '../lib/siteUrl';
import './landing.css';

type Benefit = { tag: string; title: string; body: string };
type Step = { title: string; body: string };

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
      <div className="landing-inner">
        <header className="landing-top">
          <div className="landing-mark" aria-label={t('app.name')}>
            Bilim<span>Land</span>
          </div>
          <div className="landing-top-actions">
            <div className="landing-lang" role="group" aria-label={t('landing.langLabel')}>
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
            <Link to="/login" className="landing-btn-solid">
              {t('landing.ctaLogin')}
            </Link>
          </div>
        </header>

        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div>
            <p className="landing-kicker">{t('landing.heroKicker')}</p>
            <h1 id="landing-hero-title">
              {t('landing.heroTitle')}{' '}
              <em>{t('landing.heroTitleEm')}</em>
            </h1>
            <p className="landing-lead">{t('landing.heroLead')}</p>
            <div className="landing-hero-cta">
              <Link to="/login" className="landing-btn-solid" style={{ textDecoration: 'none', display: 'inline-flex' }}>
                {t('landing.ctaLogin')}
              </Link>
              <a href="#how" className="landing-scroll-hint">
                {t('landing.ctaScroll')} ↓
              </a>
            </div>
          </div>

          <aside className="landing-ticket" aria-label={t('landing.ticketAria')}>
            <p className="landing-ticket-label">{t('landing.ticketLabel')}</p>
            <div className="landing-ticket-lines">
              <div>
                <span>{t('landing.ticketRow1L')}</span>
                <span>{t('landing.ticketRow1R')}</span>
              </div>
              <div>
                <span>{t('landing.ticketRow2L')}</span>
                <span>{t('landing.ticketRow2R')}</span>
              </div>
              <div>
                <span>{t('landing.ticketRow3L')}</span>
                <span>{t('landing.ticketRow3R')}</span>
              </div>
            </div>
            <p className="landing-ticket-foot">{t('landing.ticketFoot')}</p>
          </aside>
        </section>
      </div>

      <div className="landing-stripe">
        <div className="landing-stripe-inner">
          <p>{t('landing.stripeQuote')}</p>
        </div>
      </div>

      <div className="landing-inner">
        <section id="benefits" aria-labelledby="benefits-title">
          <h2 id="benefits-title" className="landing-section-title">
            {t('landing.sectionBenefits')}
          </h2>
          <div className="landing-benefits">
            {benefits.slice(0, 3).map((b) => (
              <article key={b.title} className="landing-card">
                <p className="landing-card-tag">{b.tag}</p>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </article>
            ))}
            {benefits[3] && (
              <article className="landing-card landing-card-wide">
                <div>
                  <p className="landing-card-tag">{benefits[3].tag}</p>
                  <h3>{benefits[3].title}</h3>
                </div>
                <p>{benefits[3].body}</p>
              </article>
            )}
          </div>
        </section>

        <section id="how" className="landing-how" aria-labelledby="how-title">
          <h2 id="how-title" className="landing-section-title">
            {t('landing.sectionHow')}
          </h2>
          <div className="landing-steps">
            {steps.map((step, i) => (
              <div key={step.title} className="landing-step">
                <span className="landing-step-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="about" className="landing-about" aria-labelledby="about-title">
          <h2 id="about-title" className="landing-section-title">
            {t('landing.sectionAbout')}
          </h2>
          <p className="landing-about-lead">{t('landing.aboutLead')}</p>
          <p className="landing-about-body">{t('landing.aboutBody')}</p>
        </section>

        <footer className="landing-footer">
          <p className="landing-footer-copy">
            <strong>{t('app.name')}</strong> — {t('landing.footerTagline')}
          </p>
          <Link to="/login" className="landing-btn-solid" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            {t('landing.footerCta')}
          </Link>
        </footer>
      </div>
    </div>
    </>
  );
}

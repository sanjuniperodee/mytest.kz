import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function OfferPage() {
  const { t } = useTranslation();

  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/paywall">← {t('legal.backToPaywall')}</Link>
      </nav>

      <h1>{t('offer.title')}</h1>
      <p className="legal-date">{t('offer.date')}</p>

      <section>
        <h2>{t('offer.s1title')}</h2>
        <p>{t('offer.s1text')}</p>
      </section>

      <section>
        <h2>{t('offer.s2title')}</h2>
        <p>{t('offer.s2text')}</p>
      </section>

      <section>
        <h2>{t('offer.s3title')}</h2>
        <p>{t('offer.s3text')}</p>
      </section>

      <section>
        <h2>{t('offer.s4title')}</h2>
        <p>{t('offer.s4text')}</p>
      </section>

      <section>
        <h2>{t('offer.s5title')}</h2>
        <p>{t('offer.s5text')}</p>
      </section>

      <section>
        <h2>{t('offer.s6title')}</h2>
        <p>{t('offer.s6text')}</p>
      </section>

      <section>
        <h2>{t('offer.s7title')}</h2>
        <p>{t('offer.s7text')}</p>
      </section>
    </div>
  );
}

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/paywall">← {t('legal.backToPaywall')}</Link>
      </nav>

      <h1>{t('privacy.title')}</h1>

      <section>
        <h2>{t('privacy.s1title')}</h2>
        <p>{t('privacy.s1text')}</p>
      </section>

      <section>
        <h2>{t('privacy.s2title')}</h2>
        <p>{t('privacy.s2text')}</p>
      </section>

      <section>
        <h2>{t('privacy.s3title')}</h2>
        <p>{t('privacy.s3text')}</p>
      </section>

      <section>
        <h2>{t('privacy.s4title')}</h2>
        <p>{t('privacy.s4text')}</p>
      </section>

      <section>
        <h2>{t('privacy.s5title')}</h2>
        <p>{t('privacy.s5text')}</p>
      </section>

      <section>
        <h2>{t('privacy.s6title')}</h2>
        <p>{t('privacy.s6text')}</p>
      </section>
    </div>
  );
}

export function ContactsPage() {
  const { t } = useTranslation();

  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/paywall">← {t('legal.backToPaywall')}</Link>
      </nav>

      <h1>{t('contacts.title')}</h1>

      <section>
        <h2>{t('contacts.company')}</h2>
        <p>{t('contacts.companyText')}</p>
      </section>

      <section>
        <h2>{t('contacts.requisites')}</h2>
        <p>{t('contacts.requisitesText')}</p>
      </section>

      <section>
        <h2>{t('contacts.bank')}</h2>
        <p>{t('contacts.bankText')}</p>
      </section>

      <section>
        <h2>{t('contacts.contacts')}</h2>
        <p>{t('contacts.contactsText')}</p>
      </section>

      <section>
        <h2>{t('contacts.paymentInfo')}</h2>
        <p>{t('contacts.paymentInfoText')}</p>
      </section>
    </div>
  );
}
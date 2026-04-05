import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const MIN = 0;
const MAX = 140;

export function GrantEstimator() {
  const { t } = useTranslation();
  const [s1, setS1] = useState(65);
  const [s2, setS2] = useState(65);

  const sum = s1 + s2;

  const tier = useMemo(() => {
    if (sum >= 220) return 'Strong' as const;
    if (sum >= 170) return 'Mid' as const;
    return 'Grow' as const;
  }, [sum]);

  return (
    <section id="grant" className="ld-section ld-section-grant" aria-labelledby="ld-grant-title">
      <div className="ld-max">
        <p className="ld-eyebrow">{t('landing.sectionGrant')}</p>
        <h2 id="ld-grant-title" className="ld-grant-title">
          {t('landing.grantTitle')}
        </h2>
        <p className="ld-grant-lead">{t('landing.grantLead')}</p>

        <div className="ld-grant-panel">
          <div className="ld-grant-row">
            <label className="ld-grant-label" htmlFor="ld-grant-s1">
              {t('landing.grantSubject1')}
            </label>
            <div className="ld-grant-slider-wrap">
              <input
                id="ld-grant-s1"
                type="range"
                min={MIN}
                max={MAX}
                value={s1}
                onChange={(e) => setS1(Number(e.target.value))}
                className="ld-grant-range"
              />
              <span className="ld-grant-num">{s1}</span>
            </div>
          </div>
          <div className="ld-grant-row">
            <label className="ld-grant-label" htmlFor="ld-grant-s2">
              {t('landing.grantSubject2')}
            </label>
            <div className="ld-grant-slider-wrap">
              <input
                id="ld-grant-s2"
                type="range"
                min={MIN}
                max={MAX}
                value={s2}
                onChange={(e) => setS2(Number(e.target.value))}
                className="ld-grant-range"
              />
              <span className="ld-grant-num">{s2}</span>
            </div>
          </div>

          <div className="ld-grant-result">
            <p className="ld-grant-sum-line">
              <span className="ld-grant-sum-label">{t('landing.grantSum')}</span>
              <span className="ld-grant-sum-value">{sum}</span>
            </p>
            <p className="ld-grant-tier">{t(`landing.grantTier${tier}`)}</p>
            <p className="ld-grant-disclaimer">{t('landing.grantDisclaimer')}</p>
            <Link to="/login" className="ld-btn ld-btn-primary ld-grant-cta">
              {t('landing.grantCtaLogin')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

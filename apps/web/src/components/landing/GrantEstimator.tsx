import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ENT_MAX,
  ENT_THRESHOLD_2026,
  ENT_TOTAL_MAX,
  grantTierHint,
  passesThresholds,
  totalEntScore,
  type EntScores,
} from '../../lib/entGrantModel';

const initialScores: EntScores = {
  mathLit: 5,
  readingLit: 5,
  history: 10,
  profile1: 25,
  profile2: 25,
};

type Tier = ReturnType<typeof grantTierHint>;

export function GrantEstimator() {
  const { t } = useTranslation();
  const [scores, setScores] = useState<EntScores>(initialScores);

  const total = useMemo(() => totalEntScore(scores), [scores]);
  const passed = useMemo(() => passesThresholds(scores), [scores]);
  const tier: Tier = useMemo(() => grantTierHint(total, passed), [total, passed]);

  const set =
    (key: keyof EntScores) => (v: number) =>
      setScores((s) => ({ ...s, [key]: v }));

  return (
    <section id="grant" className="ld-section ld-section-grant" aria-labelledby="ld-grant-title">
      <div className="ld-max">
        <p className="ld-eyebrow">{t('landing.sectionGrant')}</p>
        <h2 id="ld-grant-title" className="ld-grant-title">
          {t('landing.grantTitle')}
        </h2>
        <p className="ld-grant-lead">{t('landing.grantLead')}</p>

        <div className="ld-grant-panel">
          <EntRow
            id="ld-g-math"
            label={t('landing.grantMath')}
            value={scores.mathLit}
            onChange={set('mathLit')}
            max={ENT_MAX.mathLit}
            threshold={ENT_THRESHOLD_2026.mathLit}
          />
          <EntRow
            id="ld-g-read"
            label={t('landing.grantReading')}
            value={scores.readingLit}
            onChange={set('readingLit')}
            max={ENT_MAX.readingLit}
            threshold={ENT_THRESHOLD_2026.readingLit}
          />
          <EntRow
            id="ld-g-hist"
            label={t('landing.grantHistory')}
            value={scores.history}
            onChange={set('history')}
            max={ENT_MAX.history}
            threshold={ENT_THRESHOLD_2026.history}
          />
          <EntRow
            id="ld-g-p1"
            label={t('landing.grantProfile1')}
            value={scores.profile1}
            onChange={set('profile1')}
            max={ENT_MAX.profile1}
            threshold={ENT_THRESHOLD_2026.profile1}
          />
          <EntRow
            id="ld-g-p2"
            label={t('landing.grantProfile2')}
            value={scores.profile2}
            onChange={set('profile2')}
            max={ENT_MAX.profile2}
            threshold={ENT_THRESHOLD_2026.profile2}
          />

          <div className="ld-grant-result">
            <p className="ld-grant-sum-line">
              <span className="ld-grant-sum-label">{t('landing.grantSum')}</span>
              <span className="ld-grant-sum-value">
                {total}
                <span className="ld-grant-sum-max">
                  {' '}
                  / {ENT_TOTAL_MAX}
                </span>
              </span>
            </p>
            <p className={`ld-grant-pass ${passed ? 'is-ok' : 'is-warn'}`}>
              {passed ? t('landing.grantThresholdsOk') : t('landing.grantThresholdsFail')}
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

function EntRow({
  id,
  label,
  value,
  onChange,
  max,
  threshold,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  max: number;
  threshold: number;
}) {
  const ok = value >= threshold;
  return (
    <div className={`ld-grant-row ${ok ? '' : 'ld-grant-row-warn'}`}>
      <label className="ld-grant-label" htmlFor={id}>
        {label}
      </label>
      <div className="ld-grant-slider-wrap">
        <input
          id={id}
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="ld-grant-range"
        />
        <span className="ld-grant-num">
          {value}
          <span className="ld-grant-num-max">/{max}</span>
        </span>
      </div>
    </div>
  );
}

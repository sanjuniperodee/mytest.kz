import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type Stat = { value: string; label: string };

export function LandingStatsStrip() {
  const { t, i18n } = useTranslation();
  const stats = useMemo(
    () => t('landing.stats', { returnObjects: true }) as Stat[],
    [t, i18n.language],
  );

  return (
    <div className="lv2-stats" aria-labelledby="lv2-stats-heading">
      <p className="lv2-stats__label" id="lv2-stats-heading">
        {t('landing.sectionStats')}
      </p>
      <ul className="lv2-stats__list">
        {stats.map((s) => (
          <li key={s.label} className="lv2-stats__item">
            <span className="lv2-stats__value">{s.value}</span>
            <span className="lv2-stats__meta">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

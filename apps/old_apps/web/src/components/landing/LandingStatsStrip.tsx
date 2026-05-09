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
    <section className="ld-section ld-section-stats" aria-labelledby="ld-stats-title">
      <div className="ld-max">
        <p className="ld-eyebrow" id="ld-stats-title">
          {t('landing.sectionStats')}
        </p>
        <div className="ld-stats-grid">
          {stats.map((s) => (
            <div key={s.label} className="ld-stat-card">
              <p className="ld-stat-value">{s.value}</p>
              <p className="ld-stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

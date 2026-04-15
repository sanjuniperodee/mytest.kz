import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ENT_MAX,
  ENT_THRESHOLD_2026,
  ENT_TOTAL_MAX,
  grantTierHint,
  passesThresholds,
  totalEntScore,
  type EntScores,
} from '@bilimland/shared';
import {
  fetchAdmissionCompare,
  fetchAdmissionCutoffs,
  fetchAdmissionCycles,
  fetchAdmissionUniversities,
} from '../../api/admission';

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
  const [cycleSlug, setCycleSlug] = useState('');
  const [universityCode, setUniversityCode] = useState<number | ''>('');
  const [programId, setProgramId] = useState('');
  const [quotaType, setQuotaType] = useState<'GRANT' | 'RURAL'>('GRANT');

  const total = useMemo(() => totalEntScore(scores), [scores]);
  const passed = useMemo(() => passesThresholds(scores), [scores]);
  const tier: Tier = useMemo(() => grantTierHint(total, passed), [total, passed]);

  const set =
    (key: keyof EntScores) => (v: number) =>
      setScores((s) => ({ ...s, [key]: v }));

  const cyclesQ = useQuery({
    queryKey: ['admission', 'cycles'],
    queryFn: fetchAdmissionCycles,
    staleTime: 60_000,
  });
  const unisQ = useQuery({
    queryKey: ['admission', 'universities'],
    queryFn: fetchAdmissionUniversities,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!cycleSlug && cyclesQ.data?.length) {
      const sorted = [...cyclesQ.data].sort((a, b) => b.sortOrder - a.sortOrder);
      setCycleSlug(sorted[0].slug);
    }
  }, [cycleSlug, cyclesQ.data]);

  const cutoffsQ = useQuery({
    queryKey: ['admission', 'cutoffs', cycleSlug, universityCode],
    queryFn: () =>
      fetchAdmissionCutoffs({
        cycleSlug,
        universityCode: Number(universityCode),
      }),
    enabled: Boolean(cycleSlug && universityCode !== ''),
    staleTime: 60_000,
  });

  const programOptions = useMemo(() => {
    const rows = cutoffsQ.data;
    if (!rows?.length) return [];
    const m = new Map<string, string>();
    for (const c of rows) {
      if (c.quotaType !== quotaType) continue;
      const label = `${c.programCode} — ${c.programName}`;
      m.set(c.programId, label);
    }
    return [...m.entries()].map(([id, label]) => ({ id, label }));
  }, [cutoffsQ.data, quotaType]);

  useEffect(() => {
    if (programId && !programOptions.some((p) => p.id === programId)) {
      setProgramId('');
    }
  }, [programOptions, programId]);

  const compareQ = useQuery({
    queryKey: [
      'admission',
      'compare',
      cycleSlug,
      universityCode,
      programId,
      quotaType,
      scores.mathLit,
      scores.readingLit,
      scores.history,
      scores.profile1,
      scores.profile2,
    ],
    queryFn: () =>
      fetchAdmissionCompare({
        cycleSlug,
        universityCode: Number(universityCode),
        programId,
        quotaType,
        mathLit: scores.mathLit,
        readingLit: scores.readingLit,
        history: scores.history,
        profile1: scores.profile1,
        profile2: scores.profile2,
      }),
    enabled: Boolean(cycleSlug && universityCode !== '' && programId),
    staleTime: 10_000,
  });

  const admissionError = cyclesQ.isError || unisQ.isError;

  return (
    <section id="grant" className="ld-section ld-section-grant" aria-labelledby="ld-grant-title">
      <div className="ld-max">
        <p className="ld-eyebrow">{t('landing.sectionGrant')}</p>
        <h2 id="ld-grant-title" className="ld-grant-title">
          {t('landing.grantTitle')}
        </h2>
        <p className="ld-grant-lead">{t('landing.grantLead')}</p>

        {!admissionError && cyclesQ.isSuccess && !(cyclesQ.data?.length) ? (
          <p className="ld-grant-api-note">{t('landing.grantNoSeed')}</p>
        ) : null}

        {!admissionError && (cyclesQ.data?.length ?? 0) > 0 ? (
          <div className="ld-grant-selects" data-testid="grant-admission-selects">
            <div className="ld-grant-select-row">
              <label className="ld-grant-select-label" htmlFor="ld-g-cycle">
                {t('landing.grantCycle')}
              </label>
              <select
                id="ld-g-cycle"
                className="ld-grant-select"
                value={cycleSlug}
                onChange={(e) => setCycleSlug(e.target.value)}
                data-testid="grant-cycle"
              >
                {(cyclesQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.slug}
                  </option>
                ))}
              </select>
            </div>
            <div className="ld-grant-select-row">
              <label className="ld-grant-select-label" htmlFor="ld-g-uni">
                {t('landing.grantUniversity')}
              </label>
              <select
                id="ld-g-uni"
                className="ld-grant-select"
                value={universityCode === '' ? '' : String(universityCode)}
                onChange={(e) => setUniversityCode(e.target.value ? Number(e.target.value) : '')}
                data-testid="grant-university"
              >
                <option value="">{t('landing.grantPick')}</option>
                {unisQ.data?.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.shortName || u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="ld-grant-select-row">
              <label className="ld-grant-select-label" htmlFor="ld-g-quota">
                {t('landing.grantQuota')}
              </label>
              <select
                id="ld-g-quota"
                className="ld-grant-select"
                value={quotaType}
                onChange={(e) => setQuotaType(e.target.value as 'GRANT' | 'RURAL')}
                data-testid="grant-quota"
              >
                <option value="GRANT">{t('landing.grantQuotaGrant')}</option>
                <option value="RURAL">{t('landing.grantQuotaRural')}</option>
              </select>
            </div>
            <div className="ld-grant-select-row">
              <label className="ld-grant-select-label" htmlFor="ld-g-prog">
                {t('landing.grantProgram')}
              </label>
              <select
                id="ld-g-prog"
                className="ld-grant-select"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                disabled={!universityCode || cutoffsQ.isLoading}
                data-testid="grant-program"
              >
                <option value="">{t('landing.grantPick')}</option>
                {programOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : admissionError ? (
          <p className="ld-grant-api-note">{t('landing.grantApiUnavailable')}</p>
        ) : cyclesQ.isLoading ? (
          <p className="ld-grant-api-note">{t('landing.grantLoading')}</p>
        ) : null}

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

            {compareQ.data && (
              <p className="ld-grant-cutoff" data-testid="grant-compare-result">
                {compareQ.data.hasCutoff && compareQ.data.cutoff != null
                  ? t('landing.grantPastCutoff', {
                      cutoff: compareQ.data.cutoff,
                      gap: compareQ.data.gapToCutoff ?? 0,
                    })
                  : t('landing.grantNoCutoff')}
              </p>
            )}

            <p className="ld-grant-disclaimer">{t('landing.grantDisclaimer')}</p>
            <p className="ld-grant-disclaimer ld-grant-disclaimer-secondary">{t('landing.grantCutoffDisclaimer')}</p>
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

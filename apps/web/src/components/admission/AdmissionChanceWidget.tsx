import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ENT_MAX, ENT_THRESHOLD_2026, type EntScores } from '@bilimland/shared';
import {
  fetchAdmissionChanceProfileSubjects,
  fetchAdmissionChancePrograms,
  fetchAdmissionChanceUniversities,
  fetchAdmissionPrograms,
  fetchAdmissionCycles,
  fetchAdmissionUniversities,
  type AdmissionChanceProgram,
} from '../../api/admission';

const initialScores: EntScores = {
  mathLit: 5,
  readingLit: 5,
  history: 10,
  profile1: 25,
  profile2: 25,
};

type ChanceWidgetVariant = 'landing' | 'platform';

export function AdmissionChanceWidget({ variant }: { variant: ChanceWidgetVariant }) {
  const { t } = useTranslation();
  const [scores, setScores] = useState<EntScores>(initialScores);
  const [cycleSlug, setCycleSlug] = useState('');
  const [quotaType, setQuotaType] = useState<'GRANT' | 'RURAL'>('GRANT');
  const [profileSubjects, setProfileSubjects] = useState('');
  const [universityCode, setUniversityCode] = useState<number | ''>('');
  const [professionFilterId, setProfessionFilterId] = useState('');
  const [activeProgramId, setActiveProgramId] = useState('');

  const total = scores.mathLit + scores.readingLit + scores.history + scores.profile1 + scores.profile2;

  const setScore =
    (key: keyof EntScores) => (value: number) =>
      setScores((prev) => ({ ...prev, [key]: value }));

  const cyclesQ = useQuery({
    queryKey: ['admission', 'cycles'],
    queryFn: fetchAdmissionCycles,
    staleTime: 60_000,
  });

  const universitiesQ = useQuery({
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

  const profileSubjectsQ = useQuery({
    queryKey: ['admission', 'chance', 'profile-subjects', cycleSlug, quotaType, universityCode],
    queryFn: () =>
      fetchAdmissionChanceProfileSubjects({
        cycleSlug,
        quotaType,
        universityCode: universityCode === '' ? undefined : Number(universityCode),
      }),
    enabled: Boolean(cycleSlug),
    staleTime: 60_000,
  });

  // Backward compatibility: if chance endpoints are not deployed yet,
  // derive basic selectors from the legacy programs endpoint.
  const legacyProgramsQ = useQuery({
    queryKey: ['admission', 'legacy-programs', 'fallback'],
    queryFn: () => fetchAdmissionPrograms({ take: 500 }),
    enabled: profileSubjectsQ.isError,
    staleTime: 60_000,
  });

  const availableProfileSubjects = useMemo(() => {
    if (profileSubjectsQ.data?.length) {
      return profileSubjectsQ.data;
    }
    const values = new Set((legacyProgramsQ.data ?? []).map((item) => item.profileSubjects).filter(Boolean));
    return [...values]
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((value) => ({ value, label: value }));
  }, [profileSubjectsQ.data, legacyProgramsQ.data]);

  useEffect(() => {
    if (profileSubjects && !availableProfileSubjects.some((item) => item.value === profileSubjects)) {
      setProfileSubjects('');
      setProfessionFilterId('');
      setActiveProgramId('');
    }
  }, [profileSubjects, availableProfileSubjects]);

  const programsQ = useQuery({
    queryKey: [
      'admission',
      'chance',
      'programs',
      cycleSlug,
      quotaType,
      profileSubjects,
      universityCode,
      scores.mathLit,
      scores.readingLit,
      scores.history,
      scores.profile1,
      scores.profile2,
    ],
    queryFn: () =>
      fetchAdmissionChancePrograms({
        cycleSlug,
        quotaType,
        profileSubjects,
        universityCode: universityCode === '' ? undefined : Number(universityCode),
        mathLit: scores.mathLit,
        readingLit: scores.readingLit,
        history: scores.history,
        profile1: scores.profile1,
        profile2: scores.profile2,
      }),
    enabled: Boolean(cycleSlug && profileSubjects),
    staleTime: 15_000,
  });

  const programOptions = useMemo(
    () => {
      if (programsQ.data?.length) {
        return programsQ.data.map((item) => ({
          id: item.programId,
          label: `${item.programCode} - ${item.programName}`,
        }));
      }
      return (legacyProgramsQ.data ?? [])
        .filter((item) => (profileSubjects ? item.profileSubjects === profileSubjects : true))
        .map((item) => ({
          id: item.id,
          label: `${item.code} - ${item.name}`,
        }));
    },
    [programsQ.data, legacyProgramsQ.data, profileSubjects],
  );

  useEffect(() => {
    if (professionFilterId && !programOptions.some((item) => item.id === professionFilterId)) {
      setProfessionFilterId('');
    }
    if (activeProgramId && !programOptions.some((item) => item.id === activeProgramId)) {
      setActiveProgramId('');
    }
  }, [programOptions, professionFilterId, activeProgramId]);

  const visiblePrograms = useMemo<AdmissionChanceProgram[]>(() => {
    const rows = programsQ.data ?? [];
    if (!professionFilterId) return rows;
    return rows.filter((item) => item.programId === professionFilterId);
  }, [programsQ.data, professionFilterId]);

  const selectedProgramId = activeProgramId || professionFilterId;

  const universitiesByProgramQ = useQuery({
    queryKey: [
      'admission',
      'chance',
      'universities',
      cycleSlug,
      quotaType,
      selectedProgramId,
      universityCode,
      scores.mathLit,
      scores.readingLit,
      scores.history,
      scores.profile1,
      scores.profile2,
    ],
    queryFn: () =>
      fetchAdmissionChanceUniversities({
        cycleSlug,
        quotaType,
        programId: selectedProgramId,
        universityCode: universityCode === '' ? undefined : Number(universityCode),
        mathLit: scores.mathLit,
        readingLit: scores.readingLit,
        history: scores.history,
        profile1: scores.profile1,
        profile2: scores.profile2,
      }),
    enabled: Boolean(cycleSlug && selectedProgramId),
    staleTime: 15_000,
  });

  const admissionError =
    cyclesQ.isError ||
    universitiesQ.isError ||
    (profileSubjectsQ.isError && legacyProgramsQ.isError);

  const selectedProgram = visiblePrograms.find((item) => item.programId === selectedProgramId);

  return (
    <div className={`chance-widget chance-widget-${variant}`}>
      {admissionError ? <p className="chance-api-note">{t('chance.apiUnavailable')}</p> : null}

      <div className="chance-form-grid" data-testid={`chance-selects-${variant}`}>
        <section className="chance-block">
          <div className="chance-block-head">
            <h3>{t('chance.requiredFilters')}</h3>
            <span className="chance-block-badge">{t('chance.requiredBadge')}</span>
          </div>
          <div className="chance-selects">
            <Field label={t('chance.year')} htmlFor={`chance-cycle-${variant}`}>
              <select
                id={`chance-cycle-${variant}`}
                className="chance-select"
                value={cycleSlug}
                onChange={(e) => setCycleSlug(e.target.value)}
              >
                {(cyclesQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.slug}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('chance.quota')} htmlFor={`chance-quota-${variant}`}>
              <select
                id={`chance-quota-${variant}`}
                className="chance-select"
                value={quotaType}
                onChange={(e) => setQuotaType(e.target.value as 'GRANT' | 'RURAL')}
              >
                <option value="GRANT">{t('chance.quotaGrant')}</option>
                <option value="RURAL">{t('chance.quotaRural')}</option>
              </select>
            </Field>

            <Field label={t('chance.profileSubjects')} htmlFor={`chance-profile-${variant}`}>
              <select
                id={`chance-profile-${variant}`}
                className="chance-select"
                value={profileSubjects}
                onChange={(e) => {
                  setProfileSubjects(e.target.value);
                  setProfessionFilterId('');
                  setActiveProgramId('');
                }}
                disabled={!cycleSlug || (profileSubjectsQ.isLoading && legacyProgramsQ.isLoading)}
              >
                <option value="">{t('chance.pick')}</option>
                {availableProfileSubjects.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="chance-block">
          <div className="chance-block-head">
            <h3>{t('chance.optionalFilters')}</h3>
            <span className="chance-block-badge chance-block-badge-ghost">{t('chance.optionalBadge')}</span>
          </div>
          <div className="chance-selects">
            <Field label={t('chance.universityOptional')} htmlFor={`chance-university-${variant}`}>
              <select
                id={`chance-university-${variant}`}
                className="chance-select"
                value={universityCode === '' ? '' : String(universityCode)}
                onChange={(e) => {
                  setUniversityCode(e.target.value ? Number(e.target.value) : '');
                  setProfessionFilterId('');
                  setActiveProgramId('');
                }}
              >
                <option value="">{t('chance.allUniversities')}</option>
                {(universitiesQ.data ?? []).map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('chance.professionOptional')} htmlFor={`chance-program-filter-${variant}`}>
              <select
                id={`chance-program-filter-${variant}`}
                className="chance-select"
                value={professionFilterId}
                onChange={(e) => {
                  setProfessionFilterId(e.target.value);
                  setActiveProgramId(e.target.value);
                }}
                disabled={!programOptions.length}
              >
                <option value="">{t('chance.allProfessions')}</option>
                {programOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      </div>

      <div className="chance-panel">
        <ScoreRow
          id={`chance-math-${variant}`}
          label={t('landing.grantMath')}
          value={scores.mathLit}
          onChange={setScore('mathLit')}
          max={ENT_MAX.mathLit}
          threshold={ENT_THRESHOLD_2026.mathLit}
        />
        <ScoreRow
          id={`chance-reading-${variant}`}
          label={t('landing.grantReading')}
          value={scores.readingLit}
          onChange={setScore('readingLit')}
          max={ENT_MAX.readingLit}
          threshold={ENT_THRESHOLD_2026.readingLit}
        />
        <ScoreRow
          id={`chance-history-${variant}`}
          label={t('landing.grantHistory')}
          value={scores.history}
          onChange={setScore('history')}
          max={ENT_MAX.history}
          threshold={ENT_THRESHOLD_2026.history}
        />
        <ScoreRow
          id={`chance-p1-${variant}`}
          label={t('landing.grantProfile1')}
          value={scores.profile1}
          onChange={setScore('profile1')}
          max={ENT_MAX.profile1}
          threshold={ENT_THRESHOLD_2026.profile1}
        />
        <ScoreRow
          id={`chance-p2-${variant}`}
          label={t('landing.grantProfile2')}
          value={scores.profile2}
          onChange={setScore('profile2')}
          max={ENT_MAX.profile2}
          threshold={ENT_THRESHOLD_2026.profile2}
        />
      </div>

      <p className="chance-total">
        {t('chance.total')}: <strong>{total}</strong>
      </p>
      <div className="chance-legend">
        <span className="chance-legend-item pass">{t('chance.legendPass')}</span>
        <span className="chance-legend-item fail">{t('chance.legendFail')}</span>
      </div>

      <div className="chance-results-grid">
        <section className="chance-results">
          <h3 className="chance-list-title">{t('chance.professionsListTitle')}</h3>
          {!profileSubjects ? (
            <p className="chance-api-note">{t('chance.fillRequired')}</p>
          ) : programsQ.isLoading ? (
            <p className="chance-api-note">{t('chance.loading')}</p>
          ) : !visiblePrograms.length ? (
            <p className="chance-api-note">{t('chance.noPrograms')}</p>
          ) : (
            <div className="chance-list">
              {visiblePrograms.map((row) => (
                <ProgramCard
                  key={row.programId}
                  row={row}
                  selected={row.programId === selectedProgramId}
                  onSelect={() => setActiveProgramId(row.programId)}
                />
              ))}
            </div>
          )}
        </section>

        {selectedProgramId ? (
        <section className="chance-results">
          <h3 className="chance-list-title">{t('chance.universitiesListTitle')}</h3>
          {selectedProgram && (
            <p className="chance-selected-program">
              {t('chance.selectedProgram')}: <strong>{selectedProgram.programCode} - {selectedProgram.programName}</strong>
            </p>
          )}
          {universitiesByProgramQ.isLoading ? (
            <p className="chance-api-note">{t('chance.loading')}</p>
          ) : !(universitiesByProgramQ.data ?? []).length ? (
            <p className="chance-api-note">{t('chance.noUniversities')}</p>
          ) : (
            <div className="chance-list">
              {universitiesByProgramQ.data?.map((row) => (
                <div key={`${row.universityCode}-${row.programId}`} className={`chance-card ${row.isPass ? 'is-pass' : 'is-fail'}`}>
                  <p className="chance-card-title">
                    {row.universityName} ({row.universityCode})
                  </p>
                  <p className="chance-card-meta">
                    {t('chance.cutoff')}: {row.displayedMinScore} · {t('chance.byQuota')}: {t(`chance.quota${row.displayedQuotaType === 'RURAL' ? 'Rural' : 'Grant'}`)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
        ) : null}
      </div>

      {variant === 'landing' ? (
        <Link to="/login" className="chance-cta">
          {t('landing.grantCtaLogin')}
        </Link>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="chance-select-row">
      <label className="chance-select-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ScoreRow({
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
  const low = value < threshold;
  return (
    <div className={`chance-score-row ${low ? 'is-low' : ''}`}>
      <label className="chance-score-label" htmlFor={id}>
        {label}
      </label>
      <div className="chance-score-input">
        <input id={id} type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span>
          {value}/{max}
        </span>
      </div>
    </div>
  );
}

function ProgramCard({
  row,
  selected,
  onSelect,
}: {
  row: AdmissionChanceProgram;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`chance-card chance-card-button ${row.isPass ? 'is-pass' : 'is-fail'} ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <p className="chance-card-title">
        {row.programCode} - {row.programName}
      </p>
      <p className="chance-card-meta">
        {t('chance.cutoff')}: {row.displayedMinScore} · {t('chance.universitiesCount')}: {row.universityCount}
      </p>
    </button>
  );
}

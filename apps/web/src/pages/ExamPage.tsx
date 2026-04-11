import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSubjects, useTemplates, useExamTypes } from '../api/hooks/useExams';
import { useStartTest } from '../api/hooks/useTests';
import { useAuth } from '../api/hooks/useAuth';
import { Spinner } from '../components/common/Spinner';
import { useTelegram } from '../lib/telegram';
import { useNoTranslateWhileMounted } from '../lib/useNoTranslate';

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { webApp } = useTelegram();
  useNoTranslateWhileMounted();

  const { data: examTypes } = useExamTypes();
  const { data: subjects, isLoading: subjectsLoading } = useSubjects(examId);
  const { data: templates, isLoading: templatesLoading } = useTemplates(examId);
  const startTest = useStartTest();

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [entPassMode, setEntPassMode] = useState<'mandatory' | 'profile' | 'full'>('full');

  const mandatorySubjects = useMemo(() => subjects?.filter((s) => s.isMandatory) || [], [subjects]);
  const electiveSubjects = useMemo(() => subjects?.filter((s) => !s.isMandatory) || [], [subjects]);

  const examSlug = useMemo(() => examTypes?.find((et) => et.id === examId)?.slug, [examTypes, examId]);
  const examName = useMemo(() => examTypes?.find((e) => e.id === examId)?.name || '', [examTypes, examId]);
  const isEnt = examSlug === 'ent';
  const profileQuestionCount = examSlug === 'ent' ? 20 : examSlug === 'nuet' ? 15 : 10;
  const requiredProfiles = examSlug === 'ent' && entPassMode !== 'mandatory' ? 2 : 0;
  const maxProfiles = requiredProfiles > 0 ? requiredProfiles : electiveSubjects.length;
  const hasElectives = electiveSubjects.length > 0;
  const shouldRequireProfiles =
    hasElectives && requiredProfiles > 0 && (!isEnt || entPassMode === 'full' || entPassMode === 'profile');

  useEffect(() => {
    if (!isEnt) return;
    setSelectedTemplate(null);
    if (entPassMode === 'mandatory') setSelectedProfiles([]);
  }, [isEnt, entPassMode]);

  if (subjectsLoading || templatesLoading) return <Spinner fullScreen />;

  const toggleProfile = (subjectId: string) => {
    setSelectedProfiles((prev) => {
      if (prev.includes(subjectId)) return prev.filter((id) => id !== subjectId);
      if (prev.length >= maxProfiles) return prev;
      return [...prev, subjectId];
    });
  };

  const canStart =
    selectedTemplate &&
    (isEnt
      ? entPassMode === 'mandatory' ||
        (entPassMode === 'profile' && selectedProfiles.length === 2) ||
        (entPassMode === 'full' && selectedProfiles.length === 2)
      : !shouldRequireProfiles || selectedProfiles.length === requiredProfiles);

  const handleStartTest = async () => {
    if (!selectedTemplate || !canStart) return;
    try {
      const session = await startTest.mutateAsync({
        templateId: selectedTemplate,
        language: user?.preferredLanguage || 'ru',
        profileSubjectIds:
          isEnt && entPassMode === 'mandatory'
            ? undefined
            : selectedProfiles.length > 0
              ? selectedProfiles
              : undefined,
        entScope: isEnt ? entPassMode : undefined,
      });
      navigate(`/test/${session.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || t('common.error');
      if (webApp) webApp.showAlert(msg); else alert(msg);
    }
  };

  return (
    <div className="page">
      {/* Back */}
      <button className="back-btn" onClick={() => navigate('/app')}>
        <BackArrow /> {t('common.back')}
      </button>

      {/* Header */}
      <div className="page-hero" style={{ padding: '20px 22px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 4 }}>
          {t('exam.selectTemplate')}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          {examName}
        </div>
      </div>

      {isEnt && (
        <div className="section" style={{ marginTop: -8 }}>
          <div className="section-title">{t('exam.entPassFormat')}</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            {t('exam.entPassFormatLead')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(
              [
                { mode: 'mandatory' as const, label: t('exam.entPassMandatory') },
                { mode: 'profile' as const, label: t('exam.entPassProfile') },
                { mode: 'full' as const, label: t('exam.entPassFull') },
              ] as const
            ).map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setEntPassMode(mode)}
                className={`card ${entPassMode === mode ? 'active' : ''}`}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  marginBottom: 0,
                  padding: '12px 14px',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Mandatory Subjects */}
      {(!isEnt || entPassMode === 'mandatory' || entPassMode === 'full') && (
      <div className="section">
        <div className="section-title">{t('exam.mandatorySubjects')}</div>
        <div className="stagger-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mandatorySubjects.map((subject) => (
            <div key={subject.id} className="list-item" style={{ cursor: 'default' }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{subject.name}</span>
              <span className="badge badge-accent" style={{ fontSize: 11 }}>{t('exam.mandatory')}</span>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Step 2: Profile Subject Selection */}
      {hasElectives && (!isEnt || entPassMode === 'profile' || entPassMode === 'full') && (
        <div className="section">
          <div className="section-title">
            {t('exam.chooseProfile')}
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-light)', marginLeft: 'auto' }}>
              {selectedProfiles.length}/{maxProfiles}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            {shouldRequireProfiles ? t('exam.chooseProfileHint') : t('exam.chooseProfileOptionalHint')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {electiveSubjects.map((subject) => {
              const isSelected = selectedProfiles.includes(subject.id);
              const isDisabled = !isSelected && selectedProfiles.length >= maxProfiles;
              return (
                <button
                  key={subject.id}
                  onClick={() => toggleProfile(subject.id)}
                  disabled={isDisabled}
                  className={`chip ${isSelected ? 'active' : ''}`}
                >
                  <div className="chip-check">
                    {isSelected && <CheckCircle />}
                  </div>
                  {subject.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Templates */}
      <div className="section">
        <div className="section-title">{t('exam.selectTemplate')}</div>
        <div className="stagger-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates?.map((template) => {
            const templateQ = template.sections.reduce((s, sec) => s + sec.questionCount, 0);
            const profileQ =
              hasElectives &&
              (!isEnt || entPassMode === 'profile' || entPassMode === 'full')
                ? selectedProfiles.length * profileQuestionCount
                : 0;
            const totalQ = isEnt
              ? entPassMode === 'mandatory'
                ? templateQ
                : entPassMode === 'profile'
                  ? profileQ
                  : templateQ + profileQ
              : templateQ + profileQ;
            const fullEntQ = templateQ + 2 * profileQuestionCount;
            const displayDurationMins =
              isEnt && entPassMode !== 'full' && fullEntQ > 0 && totalQ > 0
                ? Math.max(5, Math.round(template.durationMins * (totalQ / fullEntQ)))
                : template.durationMins;
            const isSelected = selectedTemplate === template.id;

            return (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`card ${isSelected ? 'active' : ''}`}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{template.name}</span>
                  <div style={{
                    width: 22, height: 22, borderRadius: 'var(--r-full)',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    border: isSelected ? 'none' : '2px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 200ms var(--ease)',
                  }}>
                    {isSelected && <CheckCircle />}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                  <span className="info-row">
                    <ClockIcon /> {t('exam.duration', { minutes: displayDurationMins })}
                  </span>
                  <span className="info-row">
                    <DocIcon /> {t('exam.questions', { count: totalQ })}
                  </span>
                </div>

                {(template.sections.length > 0 ||
                  (hasElectives &&
                    selectedProfiles.length > 0 &&
                    (!isEnt || entPassMode === 'profile' || entPassMode === 'full'))) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(!isEnt || entPassMode === 'mandatory' || entPassMode === 'full') &&
                      template.sections.map((sec) => (
                        <span key={sec.id} className="badge badge-info" style={{ fontSize: 10 }}>
                          {sec.subject.name}: {sec.questionCount}
                        </span>
                      ))}
                    {hasElectives &&
                      selectedProfiles.length > 0 &&
                      (!isEnt || entPassMode === 'profile' || entPassMode === 'full') &&
                      electiveSubjects
                        .filter((s) => selectedProfiles.includes(s.id))
                        .map((s) => (
                          <span key={s.id} className="badge badge-warning" style={{ fontSize: 10 }}>
                            {s.name}: {profileQuestionCount}
                          </span>
                        ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start */}
      <div className="bottom-fixed">
        <button
          className="btn btn-primary"
          onClick={handleStartTest}
          disabled={!canStart || startTest.isPending}
        >
          {startTest.isPending
            ? t('common.loading')
            : canStart
              ? t('exam.startTest')
              : isEnt && (entPassMode === 'profile' || entPassMode === 'full') &&
                  selectedProfiles.length < 2
                ? t('exam.selectProfileFirst', { count: 2 })
                : !shouldRequireProfiles || selectedProfiles.length === requiredProfiles
                  ? t('exam.startTest')
                  : t('exam.selectProfileFirst', { count: requiredProfiles })}
        </button>
      </div>
    </div>
  );
}

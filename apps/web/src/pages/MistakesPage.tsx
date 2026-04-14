import { useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../api/hooks/useAuth';
import { useMistakesSummary, useStartMistakesPractice } from '../api/hooks/useTests';
import { Spinner } from '../components/common/Spinner';
import { localizedText } from '../lib/localizedText';

const EXAM_GRADIENTS: Record<string, string> = {
  ent: 'linear-gradient(135deg, #6366f1, #4f46e5)',
  nuet: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  nis: 'linear-gradient(135deg, #10b981, #059669)',
  ktl: 'linear-gradient(135deg, #f59e0b, #d97706)',
  physmath: 'linear-gradient(135deg, #3b82f6, #2563eb)',
};

export function MistakesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useMistakesSummary();
  const startPractice = useStartMistakesPractice();

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(
        i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-GB' : 'ru-RU',
        { day: 'numeric', month: 'short', year: 'numeric' },
      ),
    [i18n.language],
  );

  const lang = user?.preferredLanguage ?? 'ru';
  const uiLang = i18n.language;

  const getExamLabel = useCallback(
    (slug: string) => t(`profile.examNames.${slug}`, { defaultValue: slug.toUpperCase() }),
    [t],
  );

  const getSubjectLabel = useCallback(
    (slug: string) => t(`mistakes.subjects.${slug}`, { defaultValue: slug }),
    [t],
  );

  const examTitle = useCallback(
    (name: unknown, slug: string) => localizedText(name, uiLang) || getExamLabel(slug),
    [uiLang, getExamLabel],
  );

  const subjectTitle = useCallback(
    (name: unknown, slug: string) => localizedText(name, uiLang) || getSubjectLabel(slug),
    [uiLang, getSubjectLabel],
  );

  const onPractice = async (examTypeId?: string) => {
    try {
      const session = await startPractice.mutateAsync({
        language: lang,
        examTypeId,
        limit: 20,
      });
      navigate(`/test/${session.id}`, { state: { from: '/mistakes' } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const code = Array.isArray(msg) ? msg[0] : msg;
      if (code === 'NO_OPEN_MISTAKES') {
        await refetch();
      }
    }
  };

  if (isLoading) return <Spinner fullScreen />;
  if (isError || !data) {
    return (
      <div className="page mistakes-page">
        <p className="mistakes-page-error">{t('common.error')}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => refetch()}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const { openTotal, openByExam, recentRecoveries } = data;

  return (
    <div className="page mistakes-page">
      <header className="mistakes-page-head">
        <h1 className="page-title">{t('mistakes.title')}</h1>
        <p className="page-subtitle">{t('mistakes.subtitle')}</p>
      </header>

      <section className="mistakes-page-section surface">
        <h2 className="mistakes-page-section-title">{t('mistakes.openBlock')}</h2>
        <p className="mistakes-page-hint">{t('mistakes.openHint')}</p>
        {openTotal === 0 ? (
          <p className="mistakes-page-empty">{t('mistakes.noOpen')}</p>
        ) : (
          <>
            <div className="mistakes-page-total">
              <span className="mistakes-page-total-value">{openTotal}</span>
              <span className="mistakes-page-total-label">{t('mistakes.openTotal')}</span>
            </div>
            {openByExam.length > 1 && (
              <p className="mistakes-page-pick-hint">{t('mistakes.pickExam')}</p>
            )}
            <div className="mistakes-exam-actions stagger-list">
              {openByExam.map((row) => {
                const grad = EXAM_GRADIENTS[row.examSlug] || EXAM_GRADIENTS.ent;
                return (
                  <div key={row.examTypeId} className="mistakes-exam-row">
                    <div className="mistakes-exam-row-main">
                      <span className="mistakes-exam-dot" style={{ background: grad }} aria-hidden />
                      <div>
                        <div className="mistakes-exam-name">{examTitle(row.examName, row.examSlug)}</div>
                        <div className="mistakes-exam-count">
                          {t('mistakes.questionsToFix', { count: row.count })}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={startPractice.isPending}
                      onClick={() => onPractice(row.examTypeId)}
                    >
                      {t('mistakes.practice')}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="mistakes-page-section surface">
        <h2 className="mistakes-page-section-title">{t('mistakes.historyTitle')}</h2>
        <p className="mistakes-page-hint">{t('mistakes.historyHint')}</p>
        {recentRecoveries.length === 0 ? (
          <p className="mistakes-page-empty">{t('mistakes.noHistory')}</p>
        ) : (
          <ul className="mistakes-history-list">
            {recentRecoveries.map((r) => (
              <li key={`${r.sessionId}-${r.questionId}-${r.recoveredAt}`}>
                <Link
                  to={`/test/${r.sessionId}/review`}
                  state={{ from: '/mistakes' }}
                  className="mistakes-history-item"
                >
                  <span className="mistakes-history-date">{dateFmt.format(new Date(r.recoveredAt))}</span>
                  <span className="mistakes-history-meta">
                    {examTitle(r.examName, r.examSlug)}
                    {' · '}
                    {subjectTitle(r.subjectName, r.subjectSlug)}
                  </span>
                  <span className="mistakes-history-cta">{t('mistakes.viewSession')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mistakes-page-footnote">{t('mistakes.logicFootnote')}</p>
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTestSession, useSubmitAnswer, useFinishTest } from '../api/hooks/useTests';
import { useTestSessionStore } from '../stores/testSessionStore';
import { TestHeader } from '../components/test/TestHeader';
import { QuestionDisplay } from '../components/test/QuestionDisplay';
import { AnswerOptions } from '../components/test/AnswerOptions';
import { QuestionNavigator } from '../components/test/QuestionNavigator';
import { SubjectTabs } from '../components/test/SubjectTabs';
import { TestSectionProgress } from '../components/test/TestSectionProgress';
import { Spinner } from '../components/common/Spinner';
import { safeShowAlert, safeShowConfirm, useTelegram } from '../lib/telegram';
import { localizedText } from '../lib/localizedText';
import { useNoTranslateWhileMounted } from '../lib/useNoTranslate';

export function TestPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { webApp } = useTelegram();
  useNoTranslateWhileMounted();

  const { data: session, isLoading } = useTestSession(sessionId);
  const submitAnswer = useSubmitAnswer(sessionId!);
  const finishTest = useFinishTest(sessionId!);

  const {
    currentQuestionIndex, setCurrentQuestion, selectAnswer,
    getSelectedForQuestion, toggleFlag, isQuestionFlagged,
    setTimeRemaining, startTimer, stopTimer, timeRemaining, reset,
  } = useTestSessionStore();

  const [showNavigator, setShowNavigator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const questionOrderRef = useRef<string[]>([]);

  const orderedAnswers = useMemo(() => {
    if (!session?.answers) return [];
    const answersList = [...session.answers];
    const questionOrder = questionOrderRef.current;
    if (questionOrder.length === 0) return answersList;
    const orderMap = new Map(questionOrder.map((id, idx) => [id, idx]));
    return answersList.sort((a, b) => {
      const ai = orderMap.get(a.questionId) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderMap.get(b.questionId) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [session?.answers]);

  useEffect(() => {
    if (!session?.answers || session.answers.length === 0) return;
    const currentIds = session.answers.map((a) => a.questionId);
    const validIdSet = new Set(currentIds);
    const fromMetadata = (session.metadata?.questionOrder || []).filter((id) => validIdSet.has(id));
    const baseOrder = fromMetadata.length > 0
      ? fromMetadata
      : questionOrderRef.current.length > 0
        ? questionOrderRef.current.filter((id) => validIdSet.has(id))
        : currentIds;
    const seen = new Set(baseOrder);
    const missing = currentIds.filter((id) => !seen.has(id));
    questionOrderRef.current = [...baseOrder, ...missing];
  }, [session?.answers, session?.metadata?.questionOrder]);

  const sectionBoundaries = useMemo(() => {
    if (orderedAnswers.length === 0) return [];
    const boundaries: { index: number; subjectName: string; subjectSlug: string; count: number }[] = [];
    let currentSubjectId: string | null = null;
    for (let i = 0; i < orderedAnswers.length; i++) {
      const subj = orderedAnswers[i].question?.subject;
      const subjId = subj?.id || '';
      if (subjId !== currentSubjectId) {
        currentSubjectId = subjId;
        boundaries.push({
          index: i,
          subjectName: localizedText(subj?.name, i18n.language),
          subjectSlug: subj?.slug || '',
          count: 0,
        });
      }
      const currentBoundary = boundaries[boundaries.length - 1];
      if (currentBoundary) currentBoundary.count++;
    }
    return boundaries;
  }, [orderedAnswers, i18n.language]);

  const currentSection = useMemo(() => {
    for (let i = sectionBoundaries.length - 1; i >= 0; i--) {
      if (currentQuestionIndex >= sectionBoundaries[i].index) return sectionBoundaries[i];
    }
    return null;
  }, [sectionBoundaries, currentQuestionIndex]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    if (!session) return;
    if (session.status !== 'in_progress') {
      navigate(`/test/${sessionId}/review`, {
        replace: true,
        state: { from: (location.state as { from?: string } | undefined)?.from || '/app' },
      });
      return;
    }
    if (session.timeRemaining !== null && session.timeRemaining > 0) {
      setTimeRemaining(session.timeRemaining); startTimer();
    }
    const store = useTestSessionStore.getState();
    for (const answer of session.answers) {
      if (answer.selectedIds.length > 0 && !store.isQuestionAnswered(answer.questionId)) {
        for (const id of answer.selectedIds) store.selectAnswer(answer.questionId, id, answer.selectedIds.length > 1);
      }
    }
    return () => { stopTimer(); };
  }, [session?.id]);

  useEffect(() => {
    if (timeRemaining <= 0 && session?.status === 'in_progress') handleFinish();
  }, [timeRemaining]);

  const answers = orderedAnswers;
  const currentAnswer = answers[currentQuestionIndex];
  const currentQuestion = currentAnswer?.question;
  const answeredCount = answers.filter((a) => getSelectedForQuestion(a.questionId).length > 0).length;
  const unansweredCount = answers.length - answeredCount;
  const flaggedCount = answers.filter((a) => isQuestionFlagged(a.questionId)).length;
  const currentSectionMeta = useMemo(() => {
    if (!currentSection || !session?.metadata?.sections) return null;
    return session.metadata.sections.find((s) => s.subjectId === currentAnswer?.question?.subject?.id)
      || session.metadata.sections.find((s) => s.subjectSlug === currentSection.subjectSlug)
      || null;
  }, [currentSection, session?.metadata?.sections, currentAnswer?.question?.subject?.id]);

  const handleSelectOption = useCallback((optionId: string) => {
    if (!currentQuestion || !currentAnswer) return;
    const isMultiple = currentQuestion.type === 'multiple_choice';
    selectAnswer(currentAnswer.questionId, optionId, isMultiple);
    const selected = useTestSessionStore.getState().getSelectedForQuestion(currentAnswer.questionId);
    submitAnswer.mutate({ questionId: currentAnswer.questionId, selectedIds: selected });
  }, [currentQuestion, currentAnswer, selectAnswer, submitAnswer]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < answers.length - 1) {
      setCurrentQuestion(currentQuestionIndex + 1);
      if (webApp) webApp.HapticFeedback.selectionChanged();
    }
  }, [currentQuestionIndex, answers.length, setCurrentQuestion, webApp]);

  const handlePrev = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestion(currentQuestionIndex - 1);
      if (webApp) webApp.HapticFeedback.selectionChanged();
    }
  }, [currentQuestionIndex, setCurrentQuestion, webApp]);

  const handleFinish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true); stopTimer();
    try {
      await finishTest.mutateAsync();
      reset();
      navigate(`/test/${sessionId}/review`, {
        replace: true,
        state: { from: (location.state as { from?: string } | undefined)?.from || '/app' },
      });
    }
    catch {
      safeShowAlert(webApp, t('common.error'));
    }
    finally { setIsSubmitting(false); }
  };

  const handleFinishClick = () => {
    if (unansweredCount > 0) {
      const msg = t('test.finishConfirm', { count: unansweredCount });
      safeShowConfirm(webApp, msg, (ok) => {
        if (ok) void handleFinish();
      });
    } else void handleFinish();
  };

  const sectionProgressSegments = useMemo(() => {
    return sectionBoundaries.map((b) => {
      const slice = answers.slice(b.index, b.index + b.count);
      const answeredInSection = slice.filter((a) => getSelectedForQuestion(a.questionId).length > 0).length;
      return { answered: answeredInSection, total: b.count };
    });
  }, [sectionBoundaries, answers, getSelectedForQuestion]);

  const subjectTabSections = useMemo(
    () => sectionBoundaries.map((b) => ({
      startIndex: b.index,
      subjectName: b.subjectName,
      count: b.count,
    })),
    [sectionBoundaries],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      else if (e.key.toLowerCase() === 'f' && currentAnswer) { e.preventDefault(); toggleFlag(currentAnswer.questionId); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handlePrev, currentAnswer, toggleFlag]);

  if (isLoading || !session || !currentQuestion) return <Spinner fullScreen />;

  const inSectionIndex = currentSection ? currentQuestionIndex - currentSection.index + 1 : currentQuestionIndex + 1;
  const inSectionTotal = currentSection?.count || answers.length;

  return (
    <div className="page test-page">
      <TestHeader
        examName={
          session.metadata?.kind === 'remediation'
            ? t('mistakes.sessionTitle')
            : localizedText(session.examType?.name, i18n.language)
        }
        answeredCount={answeredCount}
        totalQuestions={answers.length}
        onFinish={handleFinishClick}
        finishDisabled={isSubmitting}
      />

      <SubjectTabs
        sections={subjectTabSections}
        currentQuestionIndex={currentQuestionIndex}
        onSelect={(start) => { setCurrentQuestion(start); setShowNavigator(false); }}
      />

      <div className="test-context-bar">
        <div className="test-context-bar-row">
          <span className="test-context-item">
            {t('test.contextQuestion', { current: currentQuestionIndex + 1, total: answers.length })}
          </span>
          <span className="test-context-sep" aria-hidden>·</span>
          <span className="test-context-item test-context-subject">
            {t('test.contextSubject', { name: currentSection?.subjectName || '—' })}
          </span>
          {sectionBoundaries.length > 1 && (
            <>
              <span className="test-context-sep" aria-hidden>·</span>
              <span className="test-context-item">
                {t('test.contextInSection', { current: inSectionIndex, total: inSectionTotal })}
              </span>
            </>
          )}
          {sectionBoundaries.length > 1 && currentSectionMeta?.isMandatory === false && (
            <>
              <span className="test-context-sep" aria-hidden>·</span>
              <span className="badge badge-warning test-context-elective">{t('exam.elective')}</span>
            </>
          )}
        </div>
        <p className="test-context-hint">
          {currentQuestion.type === 'multiple_choice' ? t('test.multipleChoiceHint') : t('test.singleChoiceHint')}
        </p>
      </div>

      <p className="test-stats-inline">
        <span style={{ color: 'var(--success)' }}>{answeredCount}</span>
        {' · '}
        <span style={{ color: unansweredCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{unansweredCount}</span>
        {' · '}
        <span style={{ color: flaggedCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{flaggedCount}</span>
        <span className="test-stats-inline-label">
          {' '}
          ({t('test.answered').toLowerCase()} / {t('test.unanswered').toLowerCase()} / {t('test.flagged').toLowerCase()})
        </span>
      </p>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowNavigator(!showNavigator)}
          className="chip"
          style={{ gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          {currentQuestionIndex + 1}/{answers.length}
          {!isCoarsePointer && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>← →</span>}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
            style={{ transform: showNavigator ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {showNavigator && (
        <div style={{ marginBottom: 16 }} className="animate-fadeIn">
          <QuestionNavigator
            questions={answers.map((a) => ({ id: a.questionId }))}
            sections={sectionBoundaries.map((b) => ({
              subjectId: answers[b.index]?.question?.subject?.id || `section-${b.index}`,
              subjectName: b.subjectName,
              startIndex: b.index,
              count: b.count,
              isMandatory: session?.metadata?.sections?.find((s) => s.subjectSlug === b.subjectSlug)?.isMandatory,
            }))}
            currentIndex={currentQuestionIndex}
            onSelect={(i) => { setCurrentQuestion(i); setShowNavigator(false); }}
          />
        </div>
      )}

      {/* Question */}
      <div className="animate-fadeIn" key={currentAnswer.questionId}>
        <QuestionDisplay content={currentQuestion.content} imageUrls={currentQuestion.imageUrls} />

        <div className="test-answer-options-label">{t('test.answerOptionsLabel')}</div>

        <AnswerOptions
          options={currentQuestion.answerOptions}
          selectedIds={getSelectedForQuestion(currentAnswer.questionId)}
          isMultiple={currentQuestion.type === 'multiple_choice'}
          onSelect={handleSelectOption}
        />

        <div style={{ marginTop: 8, minHeight: 18 }}>
          <span style={{
            fontSize: 12,
            color: submitAnswer.isPending ? 'var(--warning)' : 'var(--text-muted)',
            fontWeight: submitAnswer.isPending ? 600 : 400,
            transition: 'all 150ms var(--ease)',
          }}>
            {submitAnswer.isPending ? t('test.savingAnswer') : t('test.answerSaved')}
          </span>
        </div>
      </div>

      <div className="test-footer-dock">
        <TestSectionProgress segments={sectionProgressSegments} ariaLabel={t('test.sectionProgressAria')} />
        <div className="test-bottom-bar">
          <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={handlePrev} disabled={currentQuestionIndex === 0} aria-label={t('test.prev')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            onClick={() => { toggleFlag(currentAnswer.questionId); if (webApp) webApp.HapticFeedback.impactOccurred('light'); }}
            style={{ color: isQuestionFlagged(currentAnswer.questionId) ? 'var(--warning)' : undefined }}
            aria-label={isQuestionFlagged(currentAnswer.questionId) ? t('test.unflag') : t('test.flag')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill={isQuestionFlagged(currentAnswer.questionId) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M5 3v18" /><path d="M5 4h11l-2.5 4L16 12H5" />
            </svg>
          </button>
          <div className="test-bottom-counter" aria-live="polite">
            <span className="test-bottom-counter-current">{currentQuestionIndex + 1}</span>
            <span className="test-bottom-counter-sep">/</span>
            <span>{answers.length}</span>
          </div>
          {currentQuestionIndex === answers.length - 1 ? (
            <button type="button" className="btn btn-primary btn-sm test-bottom-primary" onClick={handleFinishClick} disabled={isSubmitting}>
              {unansweredCount > 0 ? t('test.finishWithUnanswered', { count: unansweredCount }) : t('test.finish')}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm test-bottom-primary" onClick={handleNext}>
              <span>{t('test.next')}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

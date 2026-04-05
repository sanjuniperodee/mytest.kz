import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTestReview, useExplanation } from '../api/hooks/useTests';
import { useAuth } from '../api/hooks/useAuth';
import { QuestionDisplay } from '../components/test/QuestionDisplay';
import { AnswerOptions } from '../components/test/AnswerOptions';
import { Spinner } from '../components/common/Spinner';
import { useTelegram } from '../lib/telegram';
import { renderMathInText } from '../lib/katex';

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

export function ReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data: session, isLoading } = useTestReview(sessionId);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const orderedAnswers = useMemo(() => {
    const list = [...(session?.answers || [])];
    const questionOrder = session?.metadata?.questionOrder || [];
    if (questionOrder.length === 0) return list;
    const orderMap = new Map(questionOrder.map((id, idx) => [id, idx]));
    return list.sort((a, b) => {
      const ai = orderMap.get(a.questionId) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderMap.get(b.questionId) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [session?.answers, session?.metadata?.questionOrder]);

  const sectionStats = useMemo(() => {
    if (orderedAnswers.length === 0) return [];
    const map = new Map<string, { subjectId: string; subjectName: string; correct: number; total: number }>();
    for (const answer of orderedAnswers) {
      const subj = answer.question?.subject;
      const subjId = subj?.id || 'unknown';
      if (!map.has(subjId)) map.set(subjId, { subjectId: subjId, subjectName: subj?.name || '', correct: 0, total: 0 });
      const s = map.get(subjId)!;
      s.total++;
      if (answer.isCorrect) s.correct++;
    }
    return Array.from(map.values());
  }, [orderedAnswers]);

  const sectionBoundaries = useMemo(() => {
    if (orderedAnswers.length === 0) return [];
    const boundaries: { index: number; subjectName: string }[] = [];
    let currentSubjectId = '';
    for (let i = 0; i < orderedAnswers.length; i++) {
      const subjId = orderedAnswers[i].question?.subject?.id || '';
      if (subjId !== currentSubjectId) {
        currentSubjectId = subjId;
        boundaries.push({ index: i, subjectName: orderedAnswers[i].question?.subject?.name || '' });
      }
    }
    return boundaries;
  }, [orderedAnswers]);

  if (isLoading || !session) return <Spinner fullScreen />;

  const answers = orderedAnswers;
  /** Mutually exclusive buckets (backend sets isCorrect=false for unanswered too). */
  const correctCount = answers.filter((a) => a.isCorrect === true).length;
  const unansweredCount = answers.filter((a) => a.selectedIds.length === 0).length;
  const incorrectCount = answers.filter(
    (a) => a.selectedIds.length > 0 && a.isCorrect === false,
  ).length;
  /** One row per question: wrong or skipped (matches "Только ошибки" list). */
  const needAttentionCount = answers.filter((a) => !a.isCorrect).length;
  const scoreRaw = Number(session.score ?? 0);
  const scorePercent = Number.isFinite(scoreRaw) ? scoreRaw : 0;
  const displayedAnswers = showErrorsOnly ? answers.filter((a) => !a.isCorrect) : answers;
  const backTo = (location.state as { from?: string } | undefined)?.from || '/app';
  const getScoreColor = (s: number) => s >= 80 ? 'var(--success)' : s >= 50 ? 'var(--warning)' : 'var(--error)';

  // SVG circle math
  const circumference = 2 * Math.PI * 70; // r=70
  const scoreDash = (scorePercent / 100) * circumference;

  return (
    <div className="page" style={{ paddingBottom: 20 }}>
      <button className="back-btn" onClick={() => navigate(backTo)}>
        <BackArrow /> {t('common.back')}
      </button>

      {session.metadata?.kind === 'remediation' && (
        <p className="mistakes-review-badge">{t('mistakes.reviewBadge')}</p>
      )}

      {/* Score card */}
      <div className="surface" style={{ padding: '32px 24px', textAlign: 'center', marginBottom: 20 }}>
        <div className="score-circle" style={{ '--score-color': getScoreColor(scorePercent) } as React.CSSProperties}>
          <svg viewBox="0 0 148 148">
            <circle className="score-track" cx="74" cy="74" r="70" />
            <circle
              className="score-fill"
              cx="74" cy="74" r="70"
              style={{
                strokeDasharray: `${scoreDash} ${circumference}`,
                stroke: getScoreColor(scorePercent),
              }}
            />
          </svg>
          <span className="score-value" style={{ color: getScoreColor(scorePercent) }}>
            {Math.round(scorePercent)}%
          </span>
          <span className="score-label">{t('review.score')}</span>
        </div>

        {session.rawScore !== null && session.maxScore !== null && (
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            {session.rawScore} / {session.maxScore}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
          {[
            { count: correctCount, label: t('review.correct'), cls: 'badge-success' },
            { count: incorrectCount, label: t('review.incorrect'), cls: 'badge-error' },
            { count: unansweredCount, label: t('review.unanswered'), cls: 'badge-warning' },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <span className={`badge badge-lg ${item.cls}`}>{item.count}</span>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-section breakdown */}
      {sectionStats.length > 1 && (
        <div className="surface" style={{ padding: 18, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, letterSpacing: '-0.2px' }}>
            {t('review.bySection')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sectionStats.map((sec) => {
              const pct = sec.total > 0 ? Math.round((sec.correct / sec.total) * 100) : 0;
              return (
                <div key={sec.subjectId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{sec.subjectName}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: getScoreColor(pct) }}>
                      {sec.correct}/{sec.total} ({pct}%)
                    </span>
                  </div>
                  <div className="progress-bar progress-bar-lg">
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: getScoreColor(pct) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter toggle */}
      <div className="toggle-group" style={{ marginBottom: 16 }}>
        {[false, true].map((errOnly) => (
          <button
            key={String(errOnly)}
            onClick={() => setShowErrorsOnly(errOnly)}
            className={`toggle-item ${showErrorsOnly === errOnly ? 'active' : ''}`}
          >
            {errOnly
              ? `${t('review.showErrors')} (${needAttentionCount})`
              : `${t('review.showAll')} (${answers.length})`}
          </button>
        ))}
      </div>

      {/* Questions */}
      <div className="stagger-list">
        {displayedAnswers.map((answer) => {
          const isExpanded = expandedQuestion === answer.questionId;
          const globalIdx = answers.indexOf(answer);
          const sectionHeader = sectionBoundaries.find((b) => b.index === globalIdx);
          const sectionNum = sectionHeader ? sectionBoundaries.indexOf(sectionHeader) + 1 : null;

          return (
            <div key={answer.id}>
              {sectionHeader && !showErrorsOnly && sectionBoundaries.length > 1 && (
                <div className="section-badge" style={{ marginTop: globalIdx > 0 ? 16 : 0, marginBottom: 10 }}>
                  <span className="section-badge-num">
                    {t('test.block')} {sectionNum}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {sectionHeader.subjectName}
                  </span>
                </div>
              )}

              <div className="review-card">
                <button
                  onClick={() => setExpandedQuestion(isExpanded ? null : answer.questionId)}
                  className="review-card-header"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      className="review-card-status"
                      style={{
                        background: answer.isCorrect ? 'var(--success-surface)' : answer.selectedIds.length === 0 ? 'var(--warning-surface)' : 'var(--error-surface)',
                        color: answer.isCorrect ? 'var(--success)' : answer.selectedIds.length === 0 ? 'var(--warning)' : 'var(--error)',
                      }}
                    >
                      {answer.isCorrect ? '✓' : answer.selectedIds.length === 0 ? '−' : '✗'}
                    </span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>#{globalIdx + 1}</span>
                      {sectionBoundaries.length > 1 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                          {answer.question?.subject?.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms var(--ease)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="review-card-body animate-fadeIn">
                    <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
                    <QuestionDisplay content={answer.question.content} imageUrls={answer.question.imageUrls} />
                    <AnswerOptions
                      options={answer.question.answerOptions}
                      selectedIds={answer.selectedIds}
                      isMultiple={answer.question.type === 'multiple_choice'}
                      disabled showCorrect onSelect={() => {}}
                    />
                    <ExplanationSection
                      sessionId={sessionId!}
                      questionId={answer.questionId}
                      hasSubscription={user?.hasActiveSubscription || false}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExplanationSection({ sessionId, questionId, hasSubscription }: {
  sessionId: string; questionId: string; hasSubscription: boolean;
}) {
  const { t } = useTranslation();
  const { webApp } = useTelegram();
  const [show, setShow] = useState(false);
  const { data, isLoading } = useExplanation(sessionId, questionId, show && hasSubscription);

  if (!hasSubscription) {
    return (
      <div style={{
        marginTop: 16, padding: 16, background: 'var(--warning-surface)',
        borderRadius: 'var(--r-md)', textAlign: 'center',
        border: '1px solid rgba(245, 158, 11, 0.15)',
      }}>
        <p style={{
          fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          {t('review.premiumOnly')}
        </p>
        <button className="btn btn-primary btn-xs" style={{ width: 'auto', padding: '8px 20px' }}
          onClick={() => {
            const link = 'https://t.me/bilimland_manager';
            if (webApp) webApp.openTelegramLink(link); else window.open(link, '_blank');
          }}>
          {t('review.getPremium')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => setShow(!show)} className="chip" style={{ gap: 6 }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.4 1.8 2.3h3.4c.3-.9 1-1.7 1.8-2.3A6 6 0 0 0 12 3Z" />
        </svg>
        {t('review.explanation')}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          style={{ transform: show ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {show && (
        <div style={{
          marginTop: 10, padding: 16, background: 'var(--success-surface)',
          borderRadius: 'var(--r-md)', border: '1px solid rgba(16, 185, 129, 0.15)',
        }} className="animate-fadeIn">
          {isLoading ? <Spinner size="sm" /> : data?.explanation ? (
            <div dangerouslySetInnerHTML={{ __html: renderMathInText(data.explanation) }}
              style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)' }} />
          ) : <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</p>}
        </div>
      )}
    </div>
  );
}

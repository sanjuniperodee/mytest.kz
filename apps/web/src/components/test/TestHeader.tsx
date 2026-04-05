import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTestSessionStore } from '../../stores/testSessionStore';

interface Props {
  examName?: string | null;
  answeredCount: number;
  totalQuestions: number;
  onFinish: () => void;
  finishDisabled?: boolean;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TestHeader({
  examName,
  answeredCount,
  totalQuestions,
  onFinish,
  finishDisabled,
}: Props) {
  const { t } = useTranslation();
  const { timeRemaining, tick, isTimerRunning } = useTestSessionStore();

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, tick]);

  const isLowTime = timeRemaining < 300;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="surface test-header-surface">
      <div className="test-header-top">
        <div className="test-header-exam" title={examName || undefined}>
          {examName?.trim() || t('test.defaultExamTitle')}
        </div>
        <div className="test-header-actions">
          <div
            className={`test-header-timer ${isLowTime ? 'test-header-timer-urgent' : ''}`}
            aria-live="polite"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="test-header-timer-value">{formatTime(timeRemaining)}</span>
          </div>
          <button
            type="button"
            className="test-header-finish"
            onClick={onFinish}
            disabled={finishDisabled}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            <span>{t('test.finishShort')}</span>
          </button>
        </div>
      </div>

      <div className="progress-bar test-header-progress">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="test-header-progress-meta">
        <span>
          {answeredCount}/{totalQuestions} {t('test.answered').toLowerCase()}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

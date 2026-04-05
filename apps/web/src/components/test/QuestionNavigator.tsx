import { useTestSessionStore } from '../../stores/testSessionStore';
import { useTranslation } from 'react-i18next';

interface Props {
  questions: { id: string }[];
  sections?: {
    subjectId: string;
    subjectName: string;
    startIndex: number;
    count: number;
    isMandatory?: boolean;
  }[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function QuestionNavigator({ questions, sections, currentIndex, onSelect }: Props) {
  const { t } = useTranslation();
  const { isQuestionAnswered, isQuestionFlagged } = useTestSessionStore();

  const renderQuestionButton = (q: { id: string }, index: number) => {
        const answered = isQuestionAnswered(q.id);
        const flagged = isQuestionFlagged(q.id);
        const isCurrent = index === currentIndex;

        let bg = 'var(--bg-elevated)';
        let color = 'var(--text-muted)';
        let border = '2px solid transparent';

        if (isCurrent) {
          bg = 'var(--accent)'; color = '#fff';
        } else if (answered) {
          bg = 'var(--accent-surface)'; color = 'var(--accent-light)';
        }
        if (flagged && !isCurrent) border = '2px solid var(--warning)';

    return (
      <button
        key={q.id}
        onClick={() => onSelect(index)}
        style={{
          width: '100%', aspectRatio: '1', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600,
          background: bg, color, border, cursor: 'pointer',
          transition: 'all 100ms var(--ease)',
        }}
      >
        {index + 1}
      </button>
    );
  };

  return (
    <div style={{
      padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
    }}>
      {!sections || sections.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
          {questions.map((q, index) => renderQuestionButton(q, index))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map((section, idx) => (
            <div key={section.subjectId}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  color: 'var(--accent-light)', letterSpacing: '0.05em',
                }}>
                  {t('test.block')} {idx + 1}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {section.subjectName}
                </span>
                <span style={{
                  fontSize: 10, color: section.isMandatory === false ? 'var(--warning)' : 'var(--text-muted)',
                  marginLeft: 'auto',
                }}>
                  {section.isMandatory === false ? t('exam.elective') : t('exam.mandatory')}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
                {questions
                  .slice(section.startIndex, section.startIndex + section.count)
                  .map((q, localIdx) => renderQuestionButton(q, section.startIndex + localIdx))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

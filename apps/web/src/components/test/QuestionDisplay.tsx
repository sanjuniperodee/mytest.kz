import { useMemo } from 'react';
import { renderMathInTextWithLineBreaks, splitQuestionStemLine } from '../../lib/questionStem';

interface Props {
  content: string;
  imageUrls?: string[];
}

export function QuestionDisplay({ content, imageUrls }: Props) {
  const text = typeof content === 'string' ? content : String(content ?? '');
  const { topic, body } = useMemo(() => splitQuestionStemLine(text), [text]);
  /** Первая строка в сид-данных — подпись темы; в интерфейсе показываем только условие. */
  const toRender = topic ? body : text;
  const renderedBody = useMemo(() => renderMathInTextWithLineBreaks(toRender), [toRender]);

  return (
    <div className="question-display" style={{ marginBottom: 20 }}>
      <div
        dangerouslySetInnerHTML={{ __html: renderedBody }}
        className="question-stem-body"
        style={{
          fontSize: 16,
          lineHeight: 1.75,
          color: 'var(--text-primary)',
          fontWeight: 400,
          letterSpacing: '-0.1px',
        }}
      />
      {imageUrls && imageUrls.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {imageUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Q image ${i + 1}`}
              style={{
                maxWidth: '100%',
                borderRadius: 'var(--r-md)',
                marginBottom: 8,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

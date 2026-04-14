import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { getQuestionContentDisplayParts } from '../../lib/localizedText';
import { renderMathInTextWithLineBreaks } from '../../lib/questionStem';
import { splitReadingStem } from '../../lib/splitReadingStem';

interface Props {
  content: unknown;
  imageUrls?: string[];
  /** Для «Оқу сауаттылығы» — мәтін мен сұрақты бөлек көрсету. */
  subjectSlug?: string;
}

const stemBodyStyle: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.75,
  color: 'var(--text-primary)',
  fontWeight: 400,
  letterSpacing: '-0.1px',
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 8,
};

export function QuestionDisplay({ content, imageUrls, subjectSlug }: Props) {
  const { t, i18n } = useTranslation();
  const { topicLine, stem } = useMemo(
    () => getQuestionContentDisplayParts(content, i18n.language),
    [content, i18n.language],
  );

  const isReading = subjectSlug === 'reading_literacy';
  const readingParts = useMemo(
    () => (isReading ? splitReadingStem(stem) : null),
    [isReading, stem],
  );

  const [passageCollapsed, setPassageCollapsed] = useState(false);
  useEffect(() => {
    setPassageCollapsed(false);
  }, [stem, topicLine]);

  const renderedTopic = useMemo(
    () => (topicLine ? renderMathInTextWithLineBreaks(topicLine) : ''),
    [topicLine],
  );
  const renderedSingle = useMemo(() => renderMathInTextWithLineBreaks(stem), [stem]);
  const renderedPassage = useMemo(
    () => (readingParts ? renderMathInTextWithLineBreaks(readingParts.passage) : ''),
    [readingParts],
  );
  const renderedPrompt = useMemo(
    () => (readingParts ? renderMathInTextWithLineBreaks(readingParts.prompt) : ''),
    [readingParts],
  );

  return (
    <div style={{ marginBottom: 20 }}>
      {topicLine ? (
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={labelStyle}>{t('test.questionContextLabel')}</div>
          <div
            dangerouslySetInnerHTML={{ __html: renderedTopic }}
            className="question-stem-body question-block-topic"
            style={{ ...stemBodyStyle, fontSize: 15, fontWeight: 500 }}
          />
        </div>
      ) : null}

      {isReading && readingParts ? (
        <>
          <div
            style={{
              marginBottom: 18,
              padding: '14px 16px',
              borderRadius: 'var(--r-md)',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={labelStyle}>{t('test.readingPassage')}</div>
            {!passageCollapsed && (
              <div
                dangerouslySetInnerHTML={{ __html: renderedPassage }}
                className="question-stem-body"
                style={stemBodyStyle}
              />
            )}
            <button
              type="button"
              onClick={() => setPassageCollapsed((c) => !c)}
              className="reading-passage-toggle"
              style={{
                marginTop: passageCollapsed ? 0 : 12,
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              {passageCollapsed ? t('test.readingShowPassage') : t('test.readingHidePassage')}
            </button>
          </div>

          <div style={{ marginBottom: 4 }}>
            <div style={labelStyle}>{t('test.readingQuestion')}</div>
            <div
              dangerouslySetInnerHTML={{ __html: renderedPrompt }}
              className="question-stem-body"
              style={stemBodyStyle}
            />
          </div>
        </>
      ) : (
        <div
          dangerouslySetInnerHTML={{ __html: renderedSingle }}
          className="question-stem-body"
          style={stemBodyStyle}
        />
      )}

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

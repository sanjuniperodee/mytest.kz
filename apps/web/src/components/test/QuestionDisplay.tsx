import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { getQuestionContentDisplayParts } from '../../lib/localizedText';
import { renderMathInTextWithLineBreaks } from '../../lib/questionStem';

interface Props {
  content: unknown;
  imageUrls?: string[];
  /** Для «Оқу сауаттылығы»: `passage` + `text` из JSON; без `passage` — цельный `text` (без эвристического сплита). */
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

const PASSAGE_COLLAPSE_LEN = 360;

export function QuestionDisplay({ content, imageUrls, subjectSlug }: Props) {
  const { t, i18n } = useTranslation();
  const { passage, topicLine, stem } = useMemo(
    () => getQuestionContentDisplayParts(content, i18n.language),
    [content, i18n.language],
  );

  const isReading = subjectSlug === 'reading_literacy';

  const [materialCollapsed, setMaterialCollapsed] = useState(false);
  useEffect(() => {
    setMaterialCollapsed(false);
  }, [passage, topicLine, stem]);

  const passageNeedsToggle = (passage || '').length > PASSAGE_COLLAPSE_LEN;

  const renderedTopic = useMemo(
    () => (topicLine ? renderMathInTextWithLineBreaks(topicLine) : ''),
    [topicLine],
  );
  const renderedPassage = useMemo(
    () => (passage ? renderMathInTextWithLineBreaks(passage) : ''),
    [passage],
  );
  const renderedStem = useMemo(() => renderMathInTextWithLineBreaks(stem), [stem]);
  const readingExplicitPassage = isReading && !!passage;
  const showPlainStem = stem.trim().length > 0 && !readingExplicitPassage;

  return (
    <div style={{ marginBottom: 20 }}>
      {topicLine ? (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={labelStyle}>{t('test.blockSectionLabel')}</div>
          <div
            dangerouslySetInnerHTML={{ __html: renderedTopic }}
            className="question-stem-body question-block-topic"
            style={{ ...stemBodyStyle, fontSize: 14, fontWeight: 600 }}
          />
        </div>
      ) : null}

      {passage ? (
        <div
          style={{
            marginBottom: 18,
            padding: '14px 16px',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={labelStyle}>{t('test.questionReadText')}</div>
          {(!passageNeedsToggle || !materialCollapsed) && (
            <div
              dangerouslySetInnerHTML={{ __html: renderedPassage }}
              className="question-stem-body"
              style={stemBodyStyle}
            />
          )}
          {passageNeedsToggle ? (
            <button
              type="button"
              onClick={() => setMaterialCollapsed((c) => !c)}
              className="reading-passage-toggle"
              style={{
                marginTop: materialCollapsed ? 0 : 12,
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              {materialCollapsed ? t('test.readingShowPassage') : t('test.readingHidePassage')}
            </button>
          ) : null}
        </div>
      ) : null}

      {readingExplicitPassage ? (
        <div style={{ marginBottom: 4 }}>
          <div style={labelStyle}>{t('test.readingQuestion')}</div>
          <div
            dangerouslySetInnerHTML={{ __html: renderedStem }}
            className="question-stem-body"
            style={stemBodyStyle}
          />
        </div>
      ) : null}

      {showPlainStem ? (
        <div
          dangerouslySetInnerHTML={{ __html: renderedStem }}
          className="question-stem-body"
          style={stemBodyStyle}
        />
      ) : null}

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

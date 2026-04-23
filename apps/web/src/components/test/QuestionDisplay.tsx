import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { getQuestionContentDisplayParts } from '../../lib/localizedText';
import { resolveMediaUrl } from '../../lib/resolveMediaUrl';
import { renderMathInTextWithLineBreaks } from '../../lib/questionStem';

interface Props {
  content: unknown;
  imageUrls?: string[];
  /** Язык текста вопроса/вариантов (сессия), иначе берётся язык UI. */
  contentLanguage?: string;
  /** Тексты вариантов (для исключения дублей картинок из блока вопроса). */
  answerOptionContents?: string[];
  /** Для «Оқу сауаттылығы»: `passage` + `text` из JSON; без `passage` — цельный `text` (без эвристического сплита). */
  subjectSlug?: string;
  hideTopicBlock?: boolean;
}

const stemBodyStyle: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.75,
  color: 'var(--text-primary)',
  fontWeight: 400,
  letterSpacing: '-0.1px',
} as CSSProperties;

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 8,
} as CSSProperties;

const PASSAGE_COLLAPSE_LEN = 360;

export function QuestionDisplay({
  content,
  imageUrls,
  contentLanguage,
  answerOptionContents,
  subjectSlug,
  hideTopicBlock,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = contentLanguage ?? i18n.language;
  const { passage, topicLine, stem } = useMemo(
    () => getQuestionContentDisplayParts(content, lang),
    [content, lang],
  );

  const isReading = subjectSlug === 'reading_literacy';

  const [materialCollapsed, setMaterialCollapsed] = useState(false);
  useEffect(() => {
    setMaterialCollapsed(false);
  }, [passage, topicLine, stem]);

  const passageNeedsToggle = (passage || '').length > PASSAGE_COLLAPSE_LEN;

  const renderedTopic = useMemo(
    () => (topicLine ? renderMathInTextWithLineBreaks(topicLine, imageUrls, lang) : ''),
    [topicLine, imageUrls, lang],
  );
  const renderedPassage = useMemo(
    () => (passage ? renderMathInTextWithLineBreaks(passage, imageUrls, lang) : ''),
    [passage, imageUrls, lang],
  );
  const renderedStem = useMemo(
    () => renderMathInTextWithLineBreaks(stem, imageUrls, lang),
    [stem, imageUrls, lang],
  );
  const readingExplicitPassage = isReading && !!passage;
  const showPlainStem = stem.trim().length > 0 && !readingExplicitPassage;
  const detachedImages = useMemo(() => {
    const all = Array.isArray(imageUrls) ? imageUrls.filter((u) => typeof u === 'string' && u.trim()) : [];
    if (all.length === 0) return all;

    const source = [topicLine || '', passage || '', stem || '', ...(answerOptionContents || [])].join('\n');
    const usedByToken = new Set<number>();
    const tokenRe = /\[\[img:(\d+)\]\]/gi;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = tokenRe.exec(source)) !== null) {
      const idx = Number.parseInt(tokenMatch[1], 10) - 1;
      if (Number.isFinite(idx) && idx >= 0) usedByToken.add(idx);
    }

    const usedByUrl = new Set<string>();
    const markdownRe = /!\[[^\]]*\]\(([^)]+)\)|\[![^\]]*\]\(([^)]+)\)/g;
    let mdMatch: RegExpExecArray | null;
    while ((mdMatch = markdownRe.exec(source)) !== null) {
      const url = String(mdMatch[1] ?? mdMatch[2] ?? '').trim();
      if (url) usedByUrl.add(resolveMediaUrl(url));
    }

    return all.filter((url, idx) => {
      if (usedByToken.has(idx)) return false;
      return !usedByUrl.has(resolveMediaUrl(url));
    });
  }, [imageUrls, topicLine, passage, stem, answerOptionContents]);

  return (
    <div style={{ marginBottom: 20 }}>
      {topicLine && !hideTopicBlock ? (
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

      {detachedImages.length > 0 && (
        <div style={{ marginTop: 14 }} className="question-detached-image-list">
          {detachedImages.map((url, i) => (
            <img
              key={i}
              src={resolveMediaUrl(url)}
              alt={`Q image ${i + 1}`}
              className="question-detached-image"
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}
    </div>
  );
}

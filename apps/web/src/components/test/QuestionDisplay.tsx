import { useMemo } from 'react';
import { renderMathInText } from '../../lib/katex';

interface Props {
  content: string;
  imageUrls?: string[];
}

export function QuestionDisplay({ content, imageUrls }: Props) {
  const renderedContent = useMemo(() => renderMathInText(content), [content]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        dangerouslySetInnerHTML={{ __html: renderedContent }}
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

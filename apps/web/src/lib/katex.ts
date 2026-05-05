import katex from 'katex';
import { resolveMediaUrl } from './resolveMediaUrl';
import { localizedText } from './localizedText';

type RenderMathOptions = {
  /**
   * Optional image pool for tokenized references in text:
   * [[img:1]] -> imageUrls[0]
   */
  imageUrls?: string[];
  /** Язык контента сессии / UI — для Json-полей { kk, ru, en } у вариантов ответа. */
  language?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createHtmlChunkStore() {
  const chunks: string[] = [];

  return {
    add(html: string) {
      const token = `\uE000${chunks.length}\uE001`;
      chunks.push(html);
      return token;
    },
    restore(text: string) {
      return text.replace(/\uE000(\d+)\uE001/g, (_match, indexRaw: string) => {
        const index = Number.parseInt(indexRaw, 10);
        return chunks[index] ?? '';
      });
    },
  };
}

/**
 * Parses a string and renders LaTeX between $ delimiters.
 * Returns HTML string with rendered formulas.
 *
 * $...$ for inline math
 * $$...$$ for display math
 */
export function renderMathInText(text: unknown, options?: RenderMathOptions): string {
  const raw = typeof text === 'string' ? text : localizedText(text, options?.language);
  if (!raw) return '';

  const htmlChunks = createHtmlChunkStore();

  // Handle tokenized images first: [[img:N]]
  const pool = Array.isArray(options?.imageUrls) ? options!.imageUrls : [];
  let result = raw.replace(/\[\[img:(\d+)\]\]/gi, (_match, nRaw: string) => {
    const idx = Number.parseInt(nRaw, 10) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= pool.length) return '';
    const url = resolveMediaUrl(pool[idx]);
    return htmlChunks.add(
      `<img class="markdown-inline-image" src="${escapeHtml(url)}" alt="image-${idx + 1}" loading="lazy" decoding="async" />`,
    );
  });

  // Handle Markdown images: ![alt](url)
  // Also support legacy/admin typo format: [!alt](url)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)|\[!([^\]]*)\]\(([^)]+)\)/g, (_match, alt1, url1, alt2, url2) => {
    const alt = (alt1 ?? alt2 ?? '').trim();
    const url = (url1 ?? url2 ?? '').trim();
    return htmlChunks.add(
      `<img class="markdown-inline-image" src="${escapeHtml(resolveMediaUrl(url))}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`,
    );
  });

  // Handle display math first ($$...$$)
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    try {
      return htmlChunks.add(
        katex.renderToString(latex.trim(), {
          displayMode: true,
          throwOnError: false,
        }),
      );
    } catch {
      return htmlChunks.add(`<span class="katex-error">${escapeHtml(latex)}</span>`);
    }
  });

  // Handle inline math ($...$) — avoid matching escaped dollars
  result = result.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$/g, (_match, latex: string) => {
    try {
      return htmlChunks.add(
        katex.renderToString(latex.trim(), {
          displayMode: false,
          throwOnError: false,
        }),
      );
    } catch {
      return htmlChunks.add(`<span class="katex-error">${escapeHtml(latex)}</span>`);
    }
  });

  return htmlChunks.restore(escapeHtml(result));
}

/**
 * Check if a text contains LaTeX expressions
 */
export function containsMath(text: string): boolean {
  return /\$[^$]+\$/.test(text);
}

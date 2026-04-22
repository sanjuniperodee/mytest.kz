import katex from 'katex';
import { resolveMediaUrl } from './resolveMediaUrl';

type RenderMathOptions = {
  /**
   * Optional image pool for tokenized references in text:
   * [[img:1]] -> imageUrls[0]
   */
  imageUrls?: string[];
};

/**
 * Parses a string and renders LaTeX between $ delimiters.
 * Returns HTML string with rendered formulas.
 *
 * $...$ for inline math
 * $$...$$ for display math
 */
export function renderMathInText(text: string, options?: RenderMathOptions): string {
  if (!text) return text;
  
  // Handle tokenized images first: [[img:N]]
  const pool = Array.isArray(options?.imageUrls) ? options!.imageUrls : [];
  let result = text.replace(/\[\[img:(\d+)\]\]/gi, (_match, nRaw: string) => {
    const idx = Number.parseInt(nRaw, 10) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= pool.length) return '';
    const url = resolveMediaUrl(pool[idx]);
    return `<img src="${url}" alt="image-${idx + 1}" style="max-width: 100%; border-radius: 8px; margin: 8px 0; border: 1px solid var(--border);" />`;
  });

  // Handle Markdown images: ![alt](url)
  // Also support legacy/admin typo format: [!alt](url)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)|\[!([^\]]*)\]\(([^)]+)\)/g, (_match, alt1, url1, alt2, url2) => {
    const alt = (alt1 ?? alt2 ?? '').trim();
    const url = (url1 ?? url2 ?? '').trim();
    return `<img src="${resolveMediaUrl(url)}" alt="${alt}" style="max-width: 100%; border-radius: 8px; margin: 8px 0; border: 1px solid var(--border);" />`;
  });

  // Handle display math first ($$...$$)
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return `<span class="katex-error">${latex}</span>`;
    }
  });

  // Handle inline math ($...$) — avoid matching escaped dollars
  result = result.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$/g, (_match, latex: string) => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<span class="katex-error">${latex}</span>`;
    }
  });

  return result;
}

/**
 * Check if a text contains LaTeX expressions
 */
export function containsMath(text: string): boolean {
  return /\$[^$]+\$/.test(text);
}

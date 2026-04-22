import katex from 'katex';

/**
 * Parses a string and renders LaTeX between $ delimiters.
 * Returns HTML string with rendered formulas.
 *
 * $...$ for inline math
 * $$...$$ for display math
 */
export function renderMathInText(text: string): string {
  if (!text) return text;
  
  // Handle Markdown images first: ![alt](url)
  // Also support legacy/admin typo format: [!alt](url)
  let result = text.replace(/!\[([^\]]*)\]\(([^)]+)\)|\[!([^\]]*)\]\(([^)]+)\)/g, (_match, alt1, url1, alt2, url2) => {
    const alt = (alt1 ?? alt2 ?? '').trim();
    const url = (url1 ?? url2 ?? '').trim();
    return `<img src="${url}" alt="${alt}" style="max-width: 100%; border-radius: 8px; margin: 8px 0; border: 1px solid var(--border);" />`;
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

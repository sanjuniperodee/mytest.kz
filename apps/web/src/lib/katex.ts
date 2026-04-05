import katex from 'katex';

/**
 * Parses a string and renders LaTeX between $ delimiters.
 * Returns HTML string with rendered formulas.
 *
 * $...$ for inline math
 * $$...$$ for display math
 */
export function renderMathInText(text: string): string {
  // Handle display math first ($$...$$)
  let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
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

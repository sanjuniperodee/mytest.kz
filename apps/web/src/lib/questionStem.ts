import { renderMathInText } from './katex';

/**
 * В сидах (мат. грамотность и др.) первая строка — подпись темы, дальше условие.
 * В UI показываем только условие; переносы строк в условии сохраняем через <br /> после KaTeX.
 */
export function splitQuestionStemLine(full: string): { topic: string | null; body: string } {
  const s = full.replace(/\r\n/g, '\n').trim();
  const i = s.indexOf('\n');
  if (i === -1) return { topic: null, body: s };
  const first = s.slice(0, i).trim();
  const rest = s.slice(i + 1).trim();
  if (!rest) return { topic: null, body: s };
  return { topic: first || null, body: rest };
}

/** Каждую строку прогоняем через KaTeX, между строками — <br />. */
export function renderMathInTextWithLineBreaks(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  return normalized
    .split('\n')
    .map((line) => renderMathInText(line.trim()))
    .join('<br />');
}

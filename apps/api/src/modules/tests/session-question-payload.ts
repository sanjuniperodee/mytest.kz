import type { Prisma } from '@prisma/client';

/**
 * Question shape for the session payloads (`GET /tests/sessions/:id` and
 * `GET /tests/sessions/:id/review`).
 *
 * The explanation text is a paid feature: it is served only by
 * `GET /tests/sessions/:id/review/:questionId/explanation` (PremiumGuard,
 * feature `explanations`). Session payloads therefore never carry it. Instead
 * each question gets:
 * - `hasExplanation` — whether the review can offer the explanation button;
 * - `explanationImageUrls` — the entries of `imageUrls` that the explanation
 *   embeds, so the exam and the review don't show them as images attached to
 *   the question itself;
 * - `explanation` — compatibility for mobile store builds ≤ 1.2.0, which read
 *   `explanation != null` as "has explanation" and scan it for image
 *   references. It is `null` when there is no explanation and otherwise holds
 *   only the `[[img:N]]` tokens of the images it embeds (`""` if none) — never
 *   the text. Drop it once those builds are gone.
 */

/** Question columns the session payloads need. `explanation` is read only to derive the flags above. */
export const SESSION_QUESTION_SELECT = {
  id: true,
  difficulty: true,
  type: true,
  content: true,
  imageUrls: true,
  subjectId: true,
  explanation: true,
  subject: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.QuestionSelect;

export type SessionQuestionPayload<Q> = Omit<Q, 'explanation'> & {
  explanation: string | null;
  hasExplanation: boolean;
  explanationImageUrls: string[];
};

/**
 * Strips the explanation text from a question, keeping only what the clients need without it.
 *
 * Images that only the explanation uses are removed from `imageUrls` too (their URLs would
 * otherwise reach free users; the premium explanation endpoint returns the full list). The
 * remaining images are re-indexed, so `[[img:N]]` tokens in the question content and answer
 * options are rewritten to match.
 */
export function toSessionQuestionPayload<
  Q extends { explanation?: unknown; imageUrls?: unknown; content?: unknown; answerOptions?: unknown },
>(question: Q): SessionQuestionPayload<Q> {
  const { explanation, ...rest } = question;
  const hasExplanation = !isEmptyExplanation(explanation);
  const urls = attachedImageUrls(question.imageUrls);
  const explanationIdx = hasExplanation ? referencedImageIndexes(explanation, urls) : [];

  const bodyIdx = new Set(referencedImageIndexes([question.content, question.answerOptions], urls));
  const hidden = new Set(explanationIdx.filter((idx) => !bodyIdx.has(idx)));

  // old index -> new index among the kept images
  const newIndex = new Map<number, number>();
  urls.forEach((_, idx) => {
    if (!hidden.has(idx)) newIndex.set(idx, newIndex.size);
  });
  const kept = explanationIdx.filter((idx) => newIndex.has(idx));

  const payload: Record<string, unknown> = {
    ...rest,
    explanation: hasExplanation ? kept.map((idx) => `[[img:${newIndex.get(idx)! + 1}]]`).join('\n') : null,
    hasExplanation,
    explanationImageUrls: kept.map((idx) => urls[idx]),
  };
  if (hidden.size > 0) {
    payload.imageUrls = urls.filter((_, idx) => !hidden.has(idx));
    const remap = (value: unknown) => remapImageTokens(value, newIndex);
    if ('content' in payload) payload.content = remap(payload.content);
    if (Array.isArray(payload.answerOptions)) {
      payload.answerOptions = payload.answerOptions.map((option: unknown) =>
        option && typeof option === 'object' && 'content' in option
          ? { ...option, content: remap((option as { content: unknown }).content) }
          : option,
      );
    }
  }
  return payload as SessionQuestionPayload<Q>;
}

/** Rewrites `[[img:N]]` tokens in every string of a JSON value to the re-indexed positions. */
function remapImageTokens(value: unknown, newIndex: Map<number, number>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\[\[img:(\d+)\]\]/gi, (match, n: string) => {
      const next = newIndex.get(Number.parseInt(n, 10) - 1);
      return next === undefined ? match : `[[img:${next + 1}]]`;
    });
  }
  if (Array.isArray(value)) return value.map((item) => remapImageTokens(item, newIndex));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, remapImageTokens(v, newIndex)]),
    );
  }
  return value;
}

/** Same filtering as the clients' `imageUrls()`: `[[img:N]]` indexes refer to this list. */
function attachedImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function isEmptyExplanation(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isEmptyExplanation);
  }
  return false;
}

/** Indexes into `urls` that the explanation embeds, by `[[img:N]]` token or markdown image URL. */
function referencedImageIndexes(explanation: unknown, urls: string[]): number[] {
  if (urls.length === 0) return [];
  const source = flattenText(explanation);
  const used = new Set<number>();

  const tokenRe = /\[\[img:(\d+)\]\]/gi;
  let token: RegExpExecArray | null;
  while ((token = tokenRe.exec(source)) !== null) {
    const idx = Number.parseInt(token[1], 10) - 1;
    if (idx >= 0 && idx < urls.length) used.add(idx);
  }

  const markdownRe = /!\[[^\]]*\]\(([^)]+)\)|\[![^\]]*\]\(([^)]+)\)/g;
  let markdown: RegExpExecArray | null;
  while ((markdown = markdownRe.exec(source)) !== null) {
    const ref = normalizeMediaUrl(markdown[1] ?? markdown[2] ?? '');
    if (!ref) continue;
    urls.forEach((url, idx) => {
      if (normalizeMediaUrl(url) === ref) used.add(idx);
    });
  }

  return [...used].sort((a, b) => a - b);
}

/** The web proxies `/uploads/...` as `/api/media/uploads/...`; treat both spellings as one image. */
function normalizeMediaUrl(url: string): string {
  return url.trim().replace(/^\/api\/media(?=\/uploads\/)/, '');
}

function flattenText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join('\n');
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(flattenText).join('\n');
  }
  return '';
}

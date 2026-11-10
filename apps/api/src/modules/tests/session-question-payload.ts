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
  // Read only to derive `source`; never sent to clients as is.
  metadata: true,
  subject: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.QuestionSelect;

/**
 * Where a question comes from, when its licence requires showing it (CC BY 4.0).
 * `openstax` — adapted from OpenStax textbooks (bank ids `osx-*`); the web links to /istochniki.
 */
export type QuestionSource = 'openstax';

export type SessionQuestionPayload<Q> = Omit<Q, 'explanation' | 'metadata'> & {
  explanation: string | null;
  hasExplanation: boolean;
  explanationImageUrls: string[];
  source: QuestionSource | null;
};

export function questionSource(metadata: unknown): QuestionSource | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const bank = (metadata as { sourceBankId?: unknown }).sourceBankId;
  return typeof bank === 'string' && bank.startsWith('osx-') ? 'openstax' : null;
}

/** Strips the explanation text from a question, keeping only what the clients need without it. */
export function toSessionQuestionPayload<
  Q extends { explanation?: unknown; imageUrls?: unknown; metadata?: unknown },
>(question: Q): SessionQuestionPayload<Q> {
  const { explanation, metadata, ...rest } = question;
  const hasExplanation = !isEmptyExplanation(explanation);
  const urls = attachedImageUrls(question.imageUrls);
  const usedIndexes = hasExplanation ? referencedImageIndexes(explanation, urls) : [];
  return {
    ...rest,
    explanation: hasExplanation ? usedIndexes.map((idx) => `[[img:${idx + 1}]]`).join('\n') : null,
    hasExplanation,
    explanationImageUrls: usedIndexes.map((idx) => urls[idx]),
    source: questionSource(metadata),
  };
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

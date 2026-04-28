/**
 * Shared section boundaries computation for ENT test sessions.
 * Used by TestPage and ReviewPage.
 */

import { localizedText } from './localizedText';

export interface SectionBoundary {
  index: number;
  subjectName: string;
  subjectSlug: string;
  count: number;
}

interface AnswerWithSubject {
  question?: {
    subject?: {
      id?: string | null;
      name?: unknown;
      slug?: string | null;
    };
  };
}

/**
 * Compute section boundaries (group questions by subject) for a test session.
 */
export function computeSectionBoundaries<T extends AnswerWithSubject>(
  orderedAnswers: T[],
  subjectContentLang: string,
): SectionBoundary[] {
  if (orderedAnswers.length === 0) return [];

  const boundaries: SectionBoundary[] = [];
  let currentSubjectId: string | null = null;

  for (let i = 0; i < orderedAnswers.length; i++) {
    const subj = orderedAnswers[i].question?.subject;
    const subjId = subj?.id || '';

    if (subjId !== currentSubjectId) {
      currentSubjectId = subjId;
      boundaries.push({
        index: i,
        subjectName: localizedText(subj?.name, subjectContentLang) || '',
        subjectSlug: subj?.slug || '',
        count: 0,
      });
    }

    const currentBoundary = boundaries[boundaries.length - 1];
    if (currentBoundary) currentBoundary.count++;
  }

  return boundaries;
}
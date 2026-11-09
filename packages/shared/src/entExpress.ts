import { ENT_CONFIG } from './constants/index';
import { ENT_TOTAL_MAX } from './entGrantModel';

export type EntExpressSectionInput = {
  subjectSlug?: string | null;
  correctCount: number;
  totalCount: number;
};

export type EntExpressEstimateSection = {
  subjectSlug: string;
  correctCount: number;
  totalCount: number;
  /** Максимум предмета на ЕНТ: 10 / 10 / 20 / 50. */
  maxPoints: number;
  /** Оценка баллов ЕНТ по предмету, округлена до целого. */
  points: number;
};

export type EntExpressEstimate = {
  /** Оценка балла ЕНТ, целое 0–140. */
  score: number;
  max: number;
  sections: EntExpressEstimateSection[];
};

/** Максимум предмета на ЕНТ: обязательные — из ENT_CONFIG.express.subjectMaxPoints, профильные — 50. */
export function entSubjectMaxPoints(subjectSlug: string | null | undefined): number {
  const mandatory: Record<string, number> = ENT_CONFIG.express.subjectMaxPoints;
  const slug = subjectSlug ?? '';
  return Object.prototype.hasOwnProperty.call(mandatory, slug)
    ? mandatory[slug]
    : ENT_CONFIG.maxProfilePointsPerSubject;
}

/**
 * Оценка балла ЕНТ (из 140) по экспресс-тесту: доля верных по предмету × максимум
 * предмета на ЕНТ. Итог — округлённая сумма неокруглённых долей (без накопления
 * ошибок округления), зажатая в 0–140. Предметы без вопросов дают 0.
 */
export function estimateEntScoreFromExpress(
  sections: readonly EntExpressSectionInput[],
): EntExpressEstimate {
  let exact = 0;
  const out: EntExpressEstimateSection[] = [];
  for (const section of sections) {
    const total = Math.max(0, Math.floor(Number(section.totalCount) || 0));
    if (total === 0) continue;
    const correct = Math.min(total, Math.max(0, Math.floor(Number(section.correctCount) || 0)));
    const maxPoints = entSubjectMaxPoints(section.subjectSlug);
    const share = (correct / total) * maxPoints;
    exact += share;
    out.push({
      subjectSlug: section.subjectSlug ?? '',
      correctCount: correct,
      totalCount: total,
      maxPoints,
      points: Math.round(share),
    });
  }
  return {
    score: Math.min(ENT_TOTAL_MAX, Math.max(0, Math.round(exact))),
    max: ENT_TOTAL_MAX,
    sections: out,
  };
}

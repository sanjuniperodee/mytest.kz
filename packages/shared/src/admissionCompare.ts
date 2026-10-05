import { passesThresholds, totalEntScore, type EntScores } from './entGrantModel';

export type AdmissionCompareResult = {
  total: number;
  passesEntThresholds: boolean;
  cutoff: number | null;
  hasCutoff: boolean;
  /** total − cutoff; положительно — выше прошлого порога (ориентир). */
  gapToCutoff: number | null;
};

export function compareEntToCutoff(scores: EntScores, minScore: number | null): AdmissionCompareResult {
  const total = totalEntScore(scores);
  const passesEntThresholds = passesThresholds(scores);
  const hasCutoff = minScore != null;
  const gapToCutoff = hasCutoff && minScore != null ? total - minScore : null;
  return {
    total,
    passesEntThresholds,
    cutoff: minScore,
    hasCutoff,
    gapToCutoff,
  };
}

/**
 * Qualitative chance of getting a grant, compared with last year's grant holders:
 *  HIGH   — total ≥ average score of last year's grant holders and at least CHANCE_HIGH_MIN_MARGIN
 *           above the minimum (with 1–2 grants the average equals the minimum)
 *  MEDIUM — total ≥ last year's minimum (проходной балл), but below the average: "на грани",
 *           cutoffs move a few points every year
 *  LOW    — up to CHANCE_LOW_MARGIN points below the minimum: reachable with a bit more preparation
 *  NONE   — further below, or the ЕНТ subject thresholds are not met
 */
export type AdmissionChanceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export const CHANCE_LOW_MARGIN = 5;
/** Without an average, treat "minimum + this" as comfortably above the cutoff. */
export const CHANCE_HIGH_MARGIN_FALLBACK = 5;
/** Never call a score "high chance" closer than this to the minimum. */
export const CHANCE_HIGH_MIN_MARGIN = 3;

export function admissionChance(
  total: number,
  passesEntThresholds: boolean,
  minScore: number | null,
  avgScore?: number | null,
): AdmissionChanceLevel {
  if (!passesEntThresholds || minScore == null) return 'NONE';
  const comfortable =
    avgScore != null
      ? Math.max(minScore + CHANCE_HIGH_MIN_MARGIN, avgScore)
      : minScore + CHANCE_HIGH_MARGIN_FALLBACK;
  if (total >= comfortable) return 'HIGH';
  if (total >= minScore) return 'MEDIUM';
  if (total >= minScore - CHANCE_LOW_MARGIN) return 'LOW';
  return 'NONE';
}

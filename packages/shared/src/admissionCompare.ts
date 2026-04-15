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

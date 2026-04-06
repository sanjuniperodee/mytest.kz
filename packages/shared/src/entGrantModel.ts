/**
 * ҰБТ (ЕНТ) 2026 — баллдық шектемелер (НТО жариялаған шекті баллдарға сәйкес модель).
 * Максимум: матем. сауаттылық 10 + оқу сауаттылығы 10 + Қазақстан тарихы 20 + 2 бейіндік × 50 = 140.
 */

export const ENT_MAX = {
  mathLit: 10,
  readingLit: 10,
  history: 20,
  profile1: 50,
  profile2: 50,
} as const;

export const ENT_THRESHOLD_2026 = {
  mathLit: 3,
  readingLit: 3,
  history: 5,
  profile1: 5,
  profile2: 5,
} as const;

export const ENT_TOTAL_MAX =
  ENT_MAX.mathLit +
  ENT_MAX.readingLit +
  ENT_MAX.history +
  ENT_MAX.profile1 +
  ENT_MAX.profile2;

export type EntScores = {
  mathLit: number;
  readingLit: number;
  history: number;
  profile1: number;
  profile2: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function totalEntScore(s: EntScores): number {
  return (
    clamp(s.mathLit, 0, ENT_MAX.mathLit) +
    clamp(s.readingLit, 0, ENT_MAX.readingLit) +
    clamp(s.history, 0, ENT_MAX.history) +
    clamp(s.profile1, 0, ENT_MAX.profile1) +
    clamp(s.profile2, 0, ENT_MAX.profile2)
  );
}

export function passesThresholds(s: EntScores): boolean {
  return (
    s.mathLit >= ENT_THRESHOLD_2026.mathLit &&
    s.readingLit >= ENT_THRESHOLD_2026.readingLit &&
    s.history >= ENT_THRESHOLD_2026.history &&
    s.profile1 >= ENT_THRESHOLD_2026.profile1 &&
    s.profile2 >= ENT_THRESHOLD_2026.profile2
  );
}

export type GrantTier = 'Blocked' | 'Grow' | 'Base' | 'National' | 'Strong';

export function grantTierHint(total: number, passes: boolean): GrantTier {
  if (!passes) return 'Blocked';
  if (total >= 75) return 'Strong';
  if (total >= 65) return 'National';
  if (total >= 50) return 'Base';
  return 'Grow';
}

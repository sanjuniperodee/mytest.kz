import { ENT_CONFIG } from '@bilimland/shared';

export type StatisticsFilter = {
  period: '30' | '90' | 'all';
  format: 'exam' | 'practice';
  examTypeId?: string;
  page: number;
};
export type StatisticsSession = {
  id: string;
  examTypeId: string;
  examType: { id: string; slug: string; name: unknown };
  status: string;
  finishedAt: Date | null;
  rawScore: number | null;
  maxScore: number | null;
  score: unknown;
  totalQuestions: number;
  durationSecs: number | null;
  language: string;
  metadata: unknown;
};
const round = (n: number) => Math.round(n * 10) / 10;
const meta = (s: StatisticsSession): Record<string, unknown> =>
  s.metadata && typeof s.metadata === 'object' && !Array.isArray(s.metadata)
    ? (s.metadata as Record<string, unknown>)
    : {};

export function statisticsFormat(s: StatisticsSession): 'exam' | 'practice' {
  const m = meta(s);
  if (m.kind === 'remediation') return 'practice';
  if (s.examType.slug !== 'ent') return 'exam';
  return s.totalQuestions === ENT_CONFIG.totalQuestions &&
    s.maxScore === ENT_CONFIG.maxTotalPoints &&
    (!m.entScope || m.entScope === 'full')
    ? 'exam'
    : 'practice';
}

export function statisticsPercent(s: StatisticsSession): number | null {
  if (s.rawScore != null && s.maxScore != null && s.maxScore > 0) {
    if (s.rawScore < 0 || s.rawScore > s.maxScore) return null;
    return round((s.rawScore / s.maxScore) * 100);
  }
  if (s.score == null || s.score === '') return null;
  const value = Number(s.score);
  return Number.isFinite(value) && value >= 0 && value <= 100
    ? round(value)
    : null;
}

function comparisonKey(s: StatisticsSession) {
  const m = meta(s);
  const profiles = Array.isArray(m.profileSubjectIds)
    ? [...m.profileSubjectIds].sort()
    : [];
  const sections = Array.isArray(m.sections)
    ? m.sections.map((v: any) => `${v?.subjectId}:${v?.questionCount}`).sort()
    : [];
  // Legacy rows can have a full score but no record of the chosen profile pair.
  if (s.examType.slug === 'ent' && profiles.length !== 2 && sections.length < 5)
    return null;
  return JSON.stringify([
    s.examTypeId,
    statisticsFormat(s),
    s.maxScore,
    s.totalQuestions,
    m.entScope ?? null,
    profiles,
    sections,
  ]);
}

/** Snapshot calculations are pure; no DB, AI calls or mutable caches. */
export function buildStatistics(
  rows: StatisticsSession[],
  filter: StatisticsFilter,
) {
  const selected = rows
    .filter(
      (s) =>
        ['completed', 'timed_out'].includes(s.status) &&
        s.finishedAt &&
        statisticsFormat(s) === filter.format &&
        (!filter.examTypeId || s.examTypeId === filter.examTypeId),
    )
    .sort(
      (a, b) =>
        b.finishedAt!.getTime() - a.finishedAt!.getTime() ||
        b.id.localeCompare(a.id),
    );
  const map = (s: StatisticsSession) => ({
    sessionId: s.id,
    examTypeId: s.examTypeId,
    examName: s.examType.name,
    date: s.finishedAt!.toISOString(),
    rawScore: s.rawScore,
    maxScore: s.maxScore,
    percent: statisticsPercent(s),
    status: s.status,
    language: s.language,
    durationSecs: s.durationSecs,
    totalQuestions: s.totalQuestions,
  });
  const scored = selected.filter((s) => statisticsPercent(s) != null);
  const latest = selected[0];
  const previous = selected[1];
  const comparable =
    !!latest &&
    !!previous &&
    statisticsPercent(latest) != null &&
    statisticsPercent(previous) != null &&
    comparisonKey(latest) != null &&
    comparisonKey(latest) === comparisonKey(previous);
  const durations = selected
    .map((s) => s.durationSecs)
    .filter((n): n is number => n != null && n >= 0);
  const best = scored.reduce<StatisticsSession | null>(
    (acc, s) =>
      !acc || statisticsPercent(s)! > statisticsPercent(acc)! ? s : acc,
    null,
  );
  const limit = 10;
  const pageCount = Math.max(1, Math.ceil(selected.length / limit));
  const page = Math.min(filter.page, pageCount);
  return {
    sessionIds: selected.map((s) => s.id),
    report: {
      summary: {
        total: selected.length,
        scored: scored.length,
        unscored: selected.length - scored.length,
        averagePercent: scored.length
          ? round(
              scored.reduce((sum, s) => sum + statisticsPercent(s)!, 0) /
                scored.length,
            )
          : null,
        latest: latest ? map(latest) : null,
        best: best ? map(best) : null,
        deltaPercentPoints: comparable
          ? round(statisticsPercent(latest)! - statisticsPercent(previous)!)
          : null,
        totalDurationSecs: durations.length
          ? durations.reduce((a, b) => a + b, 0)
          : null,
        timedOutCount: selected.filter((s) => s.status === 'timed_out').length,
      },
      chart: scored.slice(0, 30).reverse().map(map),
      chartLimit: 30,
      history: selected.slice((page - 1) * limit, page * limit).map(map),
      page,
      pageCount,
      limit,
    },
  };
}

import { ENT_TOTAL_MAX } from '@bilimland/shared';
import type {
  ParentReportAttemptDto,
  ParentReportDto,
  ParentReportFullEntDto,
  ParentReportGoalDto,
  ParentReportLang,
  ParentReportPlanDto,
  ParentReportScope,
  ParentReportScorePointDto,
  ParentReportWeakSubjectsDto,
} from '@bilimland/shared';
import { statisticsFormat, type StatisticsSession } from '../../users/domain/statistics';

/**
 * Чистые расчёты отчёта для родителей: без БД и сети, поэтому покрыты тестами.
 * «Полный ЕНТ» определяется так же, как в статистике ученика (statisticsFormat):
 * 120 заданий, 140 баллов, entScope full (или старые сессии без scope), не тренировка.
 */

export const PARENT_REPORT_ATTEMPTS_LIMIT = 8;
export const PARENT_REPORT_SERIES_LIMIT = 12;
export const PARENT_REPORT_WEAK_SUBJECTS_LIMIT = 3;

export type ParentReportSession = StatisticsSession;

export type ParentReportSection = {
  subjectName: unknown;
  correctCount: number;
  totalCount: number;
  rawPoints?: number;
  maxPoints?: number;
};

export type ParentReportGoalInput = {
  universityName: unknown;
  universityShortName: string | null;
  programName: unknown;
  programCode: string;
  requiredScore: number | null;
  admissionYear: number | null;
};

export function normalizeParentReportLang(raw: unknown): ParentReportLang {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'kk' ? 'kk' : 'ru';
}

/** { kk, ru, en } / { ru, kk } / строка → строка на языке отчёта. */
export function pickLocalized(value: unknown, lang: ParentReportLang): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const v = value as Record<string, unknown>;
  const pick = (key: string) => (typeof v[key] === 'string' ? (v[key] as string).trim() : '');
  return pick(lang) || pick('ru') || pick('kk') || pick('en');
}

/** Только имя: первое слово, без фамилии, не длиннее 40 символов. */
export function studentFirstName(raw: string | null | undefined): string | null {
  const first = (raw ?? '').trim().split(/\s+/)[0] ?? '';
  const clean = first.replace(/[<>]/g, '').slice(0, 40);
  return clean.length > 0 ? clean : null;
}

export function sessionScope(s: ParentReportSession): ParentReportScope {
  return s.examType.slug === 'ent' && statisticsFormat(s) === 'exam' ? 'full' : 'other';
}

function isRemediation(s: ParentReportSession): boolean {
  const m = s.metadata;
  return !!m && typeof m === 'object' && (m as { kind?: unknown }).kind === 'remediation';
}

/** Набранные баллы из сессии; null, если результат не посчитан или выглядит битым. */
export function sessionPoints(
  s: ParentReportSession,
): { score: number; maxScore: number } | null {
  if (s.rawScore == null || s.maxScore == null) return null;
  const score = Number(s.rawScore);
  const maxScore = Number(s.maxScore);
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return null;
  if (score < 0 || score > maxScore) return null;
  return { score: Math.round(score), maxScore: Math.round(maxScore) };
}

function finished(sessions: ParentReportSession[]): ParentReportSession[] {
  return sessions
    .filter((s) => (s.status === 'completed' || s.status === 'timed_out') && s.finishedAt)
    .sort(
      (a, b) =>
        b.finishedAt!.getTime() - a.finishedAt!.getTime() || b.id.localeCompare(a.id),
    );
}

/** Сессии с результатом «полного ЕНТ» (частичные и тренировки сюда не попадают), от новых к старым. */
export function fullEntSessions(sessions: ParentReportSession[]): ParentReportSession[] {
  return finished(sessions).filter((s) => sessionScope(s) === 'full' && sessionPoints(s) != null);
}

export function buildAttempts(sessions: ParentReportSession[]): ParentReportAttemptDto[] {
  return finished(sessions)
    .filter((s) => s.examType.slug === 'ent')
    .slice(0, PARENT_REPORT_ATTEMPTS_LIMIT)
    .map((s) => {
      const points = sessionPoints(s);
      return {
        date: s.finishedAt!.toISOString(),
        score: points?.score ?? null,
        maxScore: points?.maxScore ?? null,
        scope: sessionScope(s),
      };
    });
}

export function buildFullEnt(sessions: ParentReportSession[]): ParentReportFullEntDto {
  const full = fullEntSessions(sessions);
  const point = (s: ParentReportSession): ParentReportScorePointDto => ({
    date: s.finishedAt!.toISOString(),
    score: sessionPoints(s)!.score,
  });
  const latest = full[0] ?? null;
  const first = full.length > 0 ? full[full.length - 1] : null;
  // Лучший: больший балл, при равенстве — более свежий.
  const best = full.reduce<ParentReportSession | null>(
    (acc, s) => (!acc || sessionPoints(s)!.score > sessionPoints(acc)!.score ? s : acc),
    null,
  );
  return {
    count: full.length,
    maxScore: ENT_TOTAL_MAX,
    best: best ? point(best) : null,
    latest: latest ? point(latest) : null,
    first: first ? point(first) : null,
    changeSinceFirst:
      latest && first && latest !== first
        ? sessionPoints(latest)!.score - sessionPoints(first)!.score
        : null,
    series: full.slice(0, PARENT_REPORT_SERIES_LIMIT).reverse().map(point),
  };
}

/**
 * По какому тесту считать «где теряются баллы»: последний полный ЕНТ, а если его нет —
 * последний частичный тест ЕНТ (тренировки по ошибкам не берём: там только слабые темы).
 */
export function pickWeakSubjectsSession(
  sessions: ParentReportSession[],
): ParentReportSession | null {
  const done = finished(sessions).filter((s) => s.examType.slug === 'ent');
  return (
    done.find((s) => sessionScope(s) === 'full' && sessionPoints(s) != null) ??
    done.find((s) => !isRemediation(s) && sessionPoints(s) != null) ??
    null
  );
}

export function buildWeakSubjects(
  session: ParentReportSession | null,
  sections: ParentReportSection[] | null,
  lang: ParentReportLang,
): ParentReportWeakSubjectsDto | null {
  if (!session?.finishedAt || !sections) return null;
  const items = sections
    .map((sec) => {
      const hasPoints = sec.rawPoints != null && sec.maxPoints != null && sec.maxPoints > 0;
      const earned = hasPoints ? sec.rawPoints! : sec.correctCount;
      const max = hasPoints ? sec.maxPoints! : sec.totalCount;
      return {
        name: pickLocalized(sec.subjectName, lang),
        earnedPoints: Math.max(0, Math.round(earned)),
        maxPoints: Math.max(0, Math.round(max)),
        lostPoints: Math.max(0, Math.round(max - earned)),
      };
    })
    .filter((item) => item.name && item.maxPoints > 0 && item.lostPoints > 0)
    .sort(
      (a, b) =>
        b.lostPoints - a.lostPoints ||
        a.earnedPoints / a.maxPoints - b.earnedPoints / b.maxPoints ||
        a.name.localeCompare(b.name),
    )
    .slice(0, PARENT_REPORT_WEAK_SUBJECTS_LIMIT);
  return { date: session.finishedAt.toISOString(), scope: sessionScope(session), items };
}

export function buildGoal(
  goal: ParentReportGoalInput | null,
  bestFullScore: number | null,
  lang: ParentReportLang,
): ParentReportGoalDto | null {
  if (!goal) return null;
  const university =
    pickLocalized(goal.universityName, lang) || (goal.universityShortName ?? '').trim();
  const program = pickLocalized(goal.programName, lang);
  if (!university || !program) return null;
  const required =
    goal.requiredScore != null && Number.isFinite(goal.requiredScore)
      ? Math.round(goal.requiredScore)
      : null;
  return {
    university,
    program,
    programCode: goal.programCode,
    requiredScore: required,
    admissionYear: goal.admissionYear ?? null,
    currentScore: bestFullScore,
    gap: required != null && bestFullScore != null ? Math.max(0, required - bestFullScore) : null,
  };
}

export function buildParentReport(input: {
  lang: ParentReportLang;
  now: Date;
  firstName: string | null;
  sessions: ParentReportSession[];
  testsLast7Days: number;
  weakSession: ParentReportSession | null;
  weakSections: ParentReportSection[] | null;
  goal: ParentReportGoalInput | null;
  plan: ParentReportPlanDto;
}): ParentReportDto {
  const fullEnt = buildFullEnt(input.sessions);
  return {
    lang: input.lang,
    generatedAt: input.now.toISOString(),
    studentFirstName: studentFirstName(input.firstName),
    attempts: buildAttempts(input.sessions),
    fullEnt,
    testsLast7Days: Math.max(0, Math.floor(input.testsLast7Days)),
    weakSubjects: buildWeakSubjects(input.weakSession, input.weakSections, input.lang),
    goal: buildGoal(input.goal, fullEnt.best?.score ?? null, input.lang),
    plan: { active: input.plan.active, until: input.plan.active ? input.plan.until : null },
  };
}

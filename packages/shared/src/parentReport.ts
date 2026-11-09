/**
 * «Отчёт для родителей»: публичная страница по подписанной ссылке, которую ученик
 * отправляет родителю. Только агрегаты — без контактов, фамилии, id, ответов и разборов.
 */

export type ParentReportLang = 'ru' | 'kk';

/** full — полный ЕНТ (120 заданий, 140 баллов); other — частичный тест или тренировка. */
export type ParentReportScope = 'full' | 'other';

export interface ParentReportAttemptDto {
  /** ISO-дата завершения. */
  date: string;
  score: number | null;
  maxScore: number | null;
  scope: ParentReportScope;
}

export interface ParentReportScorePointDto {
  date: string;
  score: number;
}

export interface ParentReportFullEntDto {
  /** Сколько полных ЕНТ завершено за всё время. */
  count: number;
  /** Максимум полного ЕНТ (140). */
  maxScore: number;
  best: ParentReportScorePointDto | null;
  latest: ParentReportScorePointDto | null;
  first: ParentReportScorePointDto | null;
  /** latest − first; null, если полный ЕНТ сдан меньше двух раз. */
  changeSinceFirst: number | null;
  /** Последние полные ЕНТ, от старых к новым (для графика). */
  series: ParentReportScorePointDto[];
}

export interface ParentReportWeakSubjectDto {
  name: string;
  /** Сколько баллов потеряно по предмету. */
  lostPoints: number;
  earnedPoints: number;
  maxPoints: number;
}

export interface ParentReportWeakSubjectsDto {
  /** Дата теста, по которому посчитаны потери. */
  date: string;
  scope: ParentReportScope;
  items: ParentReportWeakSubjectDto[];
}

export interface ParentReportGoalDto {
  university: string;
  program: string;
  programCode: string;
  /** Проходной балл на грант по последним данным; null — не опубликован. */
  requiredScore: number | null;
  /** Год ЕНТ, к которому относится проходной балл. */
  admissionYear: number | null;
  /** С чем сравниваем — лучший полный ЕНТ; null, если его ещё нет. */
  currentScore: number | null;
  /** Сколько не хватает (0 — уже набирает); null, если сравнить не с чем. */
  gap: number | null;
}

export interface ParentReportPlanDto {
  active: boolean;
  /** ISO-дата окончания доступа; null — без даты окончания или нет доступа. */
  until: string | null;
}

export interface ParentReportDto {
  lang: ParentReportLang;
  generatedAt: string;
  /** Только имя (первое слово), без фамилии; null — имя не указано. */
  studentFirstName: string | null;
  /** Последние 8 попыток ЕНТ, от новых к старым. */
  attempts: ParentReportAttemptDto[];
  fullEnt: ParentReportFullEntDto;
  /** Все завершённые тесты за последние 7 дней. */
  testsLast7Days: number;
  weakSubjects: ParentReportWeakSubjectsDto | null;
  goal: ParentReportGoalDto | null;
  plan: ParentReportPlanDto;
}

export interface ParentReportLinkDto {
  /** null — активной ссылки нет (не создана или отозвана). */
  url: string | null;
}

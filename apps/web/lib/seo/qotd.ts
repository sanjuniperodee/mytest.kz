import type { PracticeQuestion, PracticeTopic } from "./practice-tests"

/**
 * «Вопрос дня»: из каких вопросов он выбирается и как. В пул идут только вопросы по
 * учебникам OpenStax (CC BY 4.0) из четырёх предметов — остальные предметы снимка в
 * ленту и в Telegram-канал не попадают.
 *
 * Здесь нет импортов времени выполнения (только типы): модуль напрямую проверяет
 * `npm test` в apps/web (lib/seo/qotd.test.mjs, node --test).
 */

/** Предметы, из которых берётся вопрос дня. */
export const QOTD_SUBJECTS: readonly string[] = ["matematika", "fizika", "himiya", "biologiya"]

/**
 * Первый день, когда вопрос дня выбран из пула OpenStax. До него выбор шёл из другого
 * пула, и под теми вопросами остались обсуждения (`qotd:<дата>`) — показывать над ними
 * другой вопрос нельзя, поэтому более ранние даты не отдаём вовсе.
 */
export const QOTD_SINCE = "2026-11-10"

export type QotdEntry = { subject: string; topic: PracticeTopic; question: PracticeQuestion }

export function buildQotdPool(topics: { subject: string; topic: PracticeTopic }[]): QotdEntry[] {
  return topics
    .filter(({ subject }) => QOTD_SUBJECTS.includes(subject))
    .flatMap(({ subject, topic }) =>
      topic.questions
        // Короткие вопросы без длинного текста для чтения — чтобы карточка помещалась в ленту.
        .filter((q) => q.source === "openstax" && !q.passage && q.stem.length <= 400 && q.options.length >= 3)
        .map((question) => ({ subject, topic, question })),
    )
}

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Один вопрос на всех в день: детерминированно по дате (`YYYY-MM-DD`). */
export function pickQotd(pool: QotdEntry[], date: string): QotdEntry | null {
  if (date < QOTD_SINCE || pool.length === 0) return null
  return pool[hash(`qotd:${date}`) % pool.length]
}

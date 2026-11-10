// Run: cd apps/web && npm test   (node --test; needs Node ≥ 22.18, which runs .ts directly)
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { buildQotdPool, pickQotd, QOTD_SINCE, QOTD_SUBJECTS } from "./qotd.ts"

const snapshot = JSON.parse(readFileSync(new URL("./practice-tests.data.json", import.meta.url), "utf8"))
const topics = snapshot.subjects.flatMap((s) => s.topics.map((topic) => ({ subject: s.slug, topic })))
const pool = buildQotdPool(topics)

const question = (extra = {}) => ({
  stem: "2 + 2 = ?",
  options: ["3", "4", "5", "6"],
  correct: 1,
  explanation: "4",
  difficulty: 1,
  ...extra,
})
const dayAfter = (start, n) => {
  const d = new Date(`${start}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

test("the question of the day comes from four subjects only", () => {
  assert.deepEqual([...QOTD_SUBJECTS].sort(), ["biologiya", "fizika", "himiya", "matematika"])
})

test("the pool built from the committed snapshot holds only OpenStax questions of those subjects", () => {
  // The snapshot does carry other subjects — otherwise this test would prove nothing.
  const others = topics.filter((t) => !QOTD_SUBJECTS.includes(t.subject))
  assert.ok(others.some((t) => t.topic.questions.some((q) => !q.passage && q.stem.length <= 400 && q.options.length >= 3)))

  assert.ok(pool.length > 100, `pool is suspiciously small: ${pool.length}`)
  for (const entry of pool) {
    assert.ok(QOTD_SUBJECTS.includes(entry.subject), `foreign subject in the pool: ${entry.subject}`)
    assert.equal(entry.question.source, "openstax")
  }
  assert.deepEqual([...new Set(pool.map((e) => e.subject))].sort(), [...QOTD_SUBJECTS].sort())
})

test("two years of days never pick a question outside the four subjects", () => {
  const seen = new Set()
  for (let i = 0; i < 731; i++) {
    const picked = pickQotd(pool, dayAfter(QOTD_SINCE, i))
    assert.ok(picked)
    assert.ok(QOTD_SUBJECTS.includes(picked.subject), `${dayAfter(QOTD_SINCE, i)} → ${picked.subject}`)
    assert.equal(picked.question.source, "openstax")
    seen.add(picked.subject)
  }
  assert.equal(seen.size, QOTD_SUBJECTS.length)
})

test("both conditions are required: the subject is on the list and the question is OpenStax", () => {
  const topic = (...questions) => ({ slug: "t", name: "T", questions })
  const built = buildQotdPool([
    { subject: "geografiya", topic: topic(question({ stem: "tagged, foreign subject", source: "openstax" })) },
    { subject: "fizika", topic: topic(question({ stem: "listed subject, no source" })) },
    { subject: "fizika", topic: topic(question({ stem: "ok", source: "openstax" })) },
    { subject: "himiya", topic: topic(question({ stem: "has a passage", source: "openstax", passage: "text" })) },
  ])
  assert.deepEqual(built.map((e) => e.question.stem), ["ok"])
})

test("the pick is stable for a date, and dates before the OpenStax pool have no question", () => {
  const date = dayAfter(QOTD_SINCE, 3)
  assert.equal(pickQotd(pool, date), pickQotd(pool, date))
  assert.ok(pickQotd(pool, QOTD_SINCE))
  assert.equal(pickQotd(pool, dayAfter(QOTD_SINCE, -1)), null)
  assert.equal(pickQotd(pool, "2026-10-20"), null)
  assert.equal(pickQotd([], date), null)
})

#!/usr/bin/env node
/**
 * Snapshot for the public topic tests /ent/<subject>/<topic> — free questions with
 * answers and explanations, open without registration (SEO: "тест ЕНТ по физике
 * кинематика" etc.).
 *
 * Built from the authored ENT banks (apps/api/prisma/ent-banks, format in its README —
 * the parser mirrors prisma/seed-ent-banks.ts). Only Russian single-choice questions,
 * at most QUESTIONS_PER_TOPIC per topic, topics with fewer than MIN_QUESTIONS are
 * skipped. Option order is shuffled deterministically, like the DB importer does.
 *
 * Refresh after editing the banks:
 *   cd apps/web && npm run seo:practice-data [-- <path-to-ent-banks>]
 */
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const BANKS = process.argv[2] ?? join(here, "../../api/prisma/ent-banks")
const OUT = join(here, "../lib/seo/practice-tests.data.json")

const QUESTIONS_PER_TOPIC = 10
const MIN_QUESTIONS = 6

/** Bank subject → /ent/<slug> (lib/ent-subjects.ts). Subjects without RU banks are absent. */
const SUBJECT_SLUGS = {
  math: "matematika",
  physics: "fizika",
  chemistry: "himiya",
  biology: "biologiya",
  geography: "geografiya",
  informatics: "informatika",
  world_history: "vsemirnaya-istoriya",
  law_basics: "pravo",
  russian_lang: "russkij-yazyk",
  english: "anglijskij-yazyk",
}

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "j",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
}

function slugify(text) {
  const latin = [...text.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("")
  const words = latin.replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
  let slug = ""
  for (const w of words) {
    if (slug && slug.length + w.length + 1 > 60) break
    slug = slug ? `${slug}-${w}` : w
  }
  // "…кислородсодержащие и" → drop a dangling conjunction/preposition left by the cut
  return slug.replace(/-(i|v|na|s|k|o|ob|po|ot|do|dlya)$/, "")
}

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.isFile() && e.name.endsWith(".txt")) out.push(p)
  }
  return out.sort()
}

function parseTopic(spec) {
  const t = {}
  for (const part of spec.split("|")) {
    const m = part.trim().match(/^(kk|ru|en)\s*=\s*(.+)$/)
    if (m) t[m[1]] = m[2].trim()
  }
  return t.ru || t.kk
}

/** Same grammar as prisma/seed-ent-banks.ts parseFile(). */
function parseFile(file) {
  const rel = relative(BANKS, file)
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n")
  const result = []
  let subject = ""
  let locales = []
  let topic = ""
  let d = null

  const flush = () => {
    if (!d) return
    if (!subject || locales.length === 0 || !topic) throw new Error(`${rel}:${d.line}: question before @subject/@locales/@topic`)
    result.push({
      subject,
      locales,
      topic,
      passage: d.passage?.trim() || undefined,
      stem: d.stem.trim(),
      options: d.options.map((o) => ({ text: o.text.trim(), correct: o.correct })),
      fixed: d.fixed,
      explanation: d.explanation.trim(),
      difficulty: d.difficulty,
    })
    d = null
  }

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, "")
    if (line.startsWith("//")) return
    const dir = line.match(/^@(subject|bank|locales|topic|weight)\s+(.*)$/)
    if (dir) {
      flush()
      const [, key, val] = dir
      if (key === "subject") subject = val.trim()
      else if (key === "locales") locales = val.split(",").map((x) => x.trim())
      else if (key === "topic") topic = parseTopic(val)
      return
    }
    if (line.trim() === "") return flush()
    const q = line.match(/^\? (.*)$/)
    if (q) {
      flush()
      d = { line: idx + 1, stem: q[1], options: [], fixed: false, explanation: "", difficulty: 3, cur: "stem" }
      return
    }
    if (!d) throw new Error(`${rel}:${idx + 1}: text outside a question`)
    let m
    if ((m = line.match(/^P: ?(.*)$/))) {
      d.passage = (d.passage ? d.passage + "\n" : "") + m[1]
      d.cur = "passage"
    } else if ((m = line.match(/^([+-]) (.*)$/))) {
      d.options.push({ text: m[2], correct: m[1] === "+" })
      d.cur = "option"
    } else if ((m = line.match(/^E: ?(.*)$/))) {
      d.explanation = (d.explanation ? d.explanation + "\n" : "") + m[1]
      d.cur = "explanation"
    } else if ((m = line.match(/^D: ?(\d)$/))) {
      d.difficulty = Math.min(5, Math.max(1, Number(m[1])))
    } else if (line === "!fixed") {
      d.fixed = true
    } else if (d.cur === "stem") d.stem += "\n" + line
    else if (d.cur === "passage") d.passage += "\n" + line
    else if (d.cur === "explanation") d.explanation += "\n" + line
    else if (d.cur === "option") d.options[d.options.length - 1].text += "\n" + line
  })
  flush()
  return result
}

/** Deterministic shuffle (mulberry32 seeded by the stem hash) — same as the DB importer. */
function seededShuffle(items, seedStr) {
  const h = createHash("sha1").update(seedStr).digest()
  let a = h.readUInt32LE(0)
  const rnd = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

if (!existsSync(BANKS)) {
  console.error(`ENT banks not found: ${BANKS}`)
  process.exit(1)
}

const bySubject = new Map()
for (const file of walk(BANKS)) {
  for (const q of parseFile(file)) {
    const slug = SUBJECT_SLUGS[q.subject]
    if (!slug || !q.locales.includes("ru")) continue
    if (q.options.filter((o) => o.correct).length !== 1 || !q.explanation) continue
    if (!bySubject.has(slug)) bySubject.set(slug, new Map())
    const topics = bySubject.get(slug)
    if (!topics.has(q.topic)) topics.set(q.topic, [])
    topics.get(q.topic).push(q)
  }
}

const subjects = []
for (const [slug, topics] of bySubject) {
  const outTopics = []
  const usedSlugs = new Set()
  for (const [name, qs] of topics) {
    if (qs.length < MIN_QUESTIONS) continue
    const topicSlug = slugify(name)
    if (!topicSlug || usedSlugs.has(topicSlug)) throw new Error(`${slug}: bad or duplicate topic slug for "${name}"`)
    usedSlugs.add(topicSlug)
    outTopics.push({
      slug: topicSlug,
      name,
      questions: qs.slice(0, QUESTIONS_PER_TOPIC).map((q) => {
        const options = q.fixed ? q.options : seededShuffle(q.options, q.stem)
        return {
          ...(q.passage ? { passage: q.passage } : {}),
          stem: q.stem,
          options: options.map((o) => o.text),
          correct: options.findIndex((o) => o.correct),
          explanation: q.explanation,
          difficulty: q.difficulty,
        }
      }),
    })
  }
  if (outTopics.length) subjects.push({ slug, topics: outTopics })
}
subjects.sort((a, b) => Object.values(SUBJECT_SLUGS).indexOf(a.slug) - Object.values(SUBJECT_SLUGS).indexOf(b.slug))

const data = { updatedAt: new Date().toISOString().slice(0, 10), subjects }
writeFileSync(OUT, JSON.stringify(data, null, 1) + "\n")

const topicCount = subjects.reduce((n, s) => n + s.topics.length, 0)
const questionCount = subjects.reduce((n, s) => n + s.topics.reduce((m, t) => m + t.questions.length, 0), 0)
console.log(`${OUT}: ${subjects.length} subjects, ${topicCount} topics, ${questionCount} questions`)
for (const s of subjects) console.log(`  ${s.slug}: ${s.topics.map((t) => `${t.slug}(${t.questions.length})`).join(", ")}`)

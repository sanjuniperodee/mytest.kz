#!/usr/bin/env node
/**
 * Snapshot for the public topic tests /ent/<subject>/<topic> — free questions with
 * answers and explanations, open without registration (SEO: "тест ЕНТ по физике
 * кинематика" etc.).
 *
 * Built from the ENT banks in git (apps/api/prisma/ent-banks, format in its README —
 * the parser mirrors prisma/seed-ent-banks.ts). Only Russian single-choice questions,
 * at most QUESTIONS_PER_TOPIC per topic, topics with fewer than MIN_QUESTIONS are
 * skipped. Option order is shuffled deterministically, like the DB importer does.
 * Questions from `osx-*` banks (OpenStax, CC BY 4.0) carry `source: "openstax"` — the
 * pages, the question of the day and the Telegram post must credit it (/istochniki).
 *
 * A subject that has no bank in git is NOT dropped: its topics are carried over from the
 * committed snapshot unchanged (and the build says so). Taking such a subject off the
 * site is an owner decision — pass `--drop=<subject-slug>[,…]` to do it on purpose.
 *
 * Topic URLs are indexed. A topic keeps its address through TOPIC_SLUGS; every topic URL
 * that was in the previous snapshot and is gone now is appended to
 * lib/seo/practice-redirects.json (next.config.mjs → 308 to the subject page).
 *
 * Refresh after editing the banks (re-running without changes rewrites nothing):
 *   cd apps/web && npm run seo:practice-data [-- <path-to-ent-banks>] [-- --drop=<slug>]
 */
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const BANKS = args.find((a) => !a.startsWith("--")) ?? join(here, "../../api/prisma/ent-banks")
const DROP = new Set(
  (args.find((a) => a.startsWith("--drop="))?.slice("--drop=".length) ?? "").split(",").map((x) => x.trim()).filter(Boolean),
)
const OUT = join(here, "../lib/seo/practice-tests.data.json")
const REDIRECTS_OUT = join(here, "../lib/seo/practice-redirects.json")

const QUESTIONS_PER_TOPIC = 10
// The page copy says «N вопросов», which is only grammatical from 5 up.
const MIN_QUESTIONS = 5

/** Bank subject → /ent/<slug> (lib/ent-subjects.ts). */
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

/**
 * Bank topic (ru) → the topic slug that is already indexed. The page takes its name from
 * the bank; only the address stays. Topics not listed here get slugify(name).
 */
const TOPIC_SLUGS = {
  matematika: {
    "Алгебраические выражения и их преобразования": "algebraicheskie-vyrazheniya-i-stepeni",
    "Функции и метод координат": "funkcii-i-grafiki",
    "Последовательности и прогрессии": "progressii",
    "Комбинаторика и теория вероятностей": "kombinatorika-veroyatnost-statistika",
  },
  fizika: {
    "Динамика": "dinamika-i-zakony-nyutona",
    "Работа, мощность, энергия и законы сохранения": "zakony-sohraneniya",
    "Механические колебания и волны": "kolebaniya-i-volny",
    "Электростатика": "elektrostatika-i-postoyannyj-tok",
    "Электромагнитные волны и оптика": "optika",
    "Атомная и ядерная физика": "kvantovaya-atomnaya-i-yadernaya-fizika",
  },
  himiya: {
    "Растворы": "rastvory-i-elektroliticheskaya-dissociaciya",
    "Расчёты по уравнениям химических реакций": "kolichestvennye-raschety",
  },
  biologiya: {
    "Строение клетки": "citologiya",
    "Молекулярная биология и биотехнология": "biohimiya-i-molekulyarnaya-biologiya",
    "Деление клетки. Размножение и развитие": "razmnozhenie-i-razvitie",
    "Генетика": "genetika-i-selekciya",
    "Эволюция": "evolyuciya-i-ekologiya",
  },
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
  let bank = ""
  let locales = []
  let topic = ""
  let d = null

  const flush = () => {
    if (!d) return
    if (!subject || locales.length === 0 || !topic) throw new Error(`${rel}:${d.line}: question before @subject/@locales/@topic`)
    result.push({
      subject,
      bank,
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
      else if (key === "bank") bank = val.trim()
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
const SUBJECT_ORDER = Object.values(SUBJECT_SLUGS)
for (const slug of DROP) {
  if (!SUBJECT_ORDER.includes(slug)) {
    console.error(`--drop: unknown subject "${slug}" (known: ${SUBJECT_ORDER.join(", ")})`)
    process.exit(1)
  }
}

/** The committed snapshot: source of the subjects that have no bank, and of the old URLs. */
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { subjects: [] }
const previousBySlug = new Map(previous.subjects.map((s) => [s.slug, s]))

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

function buildSubject(slug, topics) {
  const outTopics = []
  const usedSlugs = new Set()
  const skipped = []
  for (const [name, qs] of topics) {
    if (qs.length < MIN_QUESTIONS) {
      skipped.push(`${name} (${qs.length})`)
      continue
    }
    const topicSlug = TOPIC_SLUGS[slug]?.[name] ?? slugify(name)
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
          // Same rule as the API (session-question-payload.ts): bank id `osx-*` = OpenStax.
          ...(q.bank.startsWith("osx-") ? { source: "openstax" } : {}),
        }
      }),
    })
  }
  for (const pinned of Object.keys(TOPIC_SLUGS[slug] ?? {})) {
    if (!topics.has(pinned)) console.warn(`  ! ${slug}: TOPIC_SLUGS names "${pinned}", the banks have no such topic`)
  }
  if (skipped.length) console.log(`  ${slug}: fewer than ${MIN_QUESTIONS} questions, no page — ${skipped.join("; ")}`)
  return outTopics.length ? { slug, topics: outTopics } : null
}

const subjects = []
const origin = new Map()
for (const slug of SUBJECT_ORDER) {
  if (DROP.has(slug)) {
    origin.set(slug, "dropped (--drop)")
    continue
  }
  const built = bySubject.has(slug) ? buildSubject(slug, bySubject.get(slug)) : null
  if (built) {
    subjects.push(built)
    origin.set(slug, "built from the banks")
  } else if (previousBySlug.has(slug)) {
    subjects.push(previousBySlug.get(slug))
    origin.set(slug, "NO BANK IN GIT — kept as is from the committed snapshot")
  }
}

// lastmod per subject: a subject whose content did not change keeps its date, so a
// rebuild of one subject does not tell search engines that every page changed.
const today = new Date().toISOString().slice(0, 10)
const subjectUpdatedAt = {}
for (const s of subjects) {
  const before = previousBySlug.get(s.slug)
  const unchanged = before && JSON.stringify(before) === JSON.stringify(s)
  subjectUpdatedAt[s.slug] = unchanged ? (previous.subjectUpdatedAt?.[s.slug] ?? previous.updatedAt ?? today) : today
}
const updatedAt = Object.values(subjectUpdatedAt).sort().at(-1) ?? today

const data = { updatedAt, subjectUpdatedAt, subjects }
writeFileSync(OUT, JSON.stringify(data, null, 1) + "\n")

// Topic URLs that existed and are gone → 308 to the subject page (which always exists).
const liveUrls = new Set(subjects.flatMap((s) => s.topics.map((t) => `/ent/${s.slug}/${t.slug}`)))
const redirects = new Map(
  (existsSync(REDIRECTS_OUT) ? JSON.parse(readFileSync(REDIRECTS_OUT, "utf8")) : []).map((r) => [r.source, r.destination]),
)
const newlyRetired = []
for (const s of previous.subjects) {
  for (const t of s.topics) {
    const url = `/ent/${s.slug}/${t.slug}`
    if (!liveUrls.has(url) && !redirects.has(url)) {
      redirects.set(url, `/ent/${s.slug}`)
      newlyRetired.push(url)
    }
  }
}
for (const url of liveUrls) redirects.delete(url) // a topic that came back is a page again
const redirectList = [...redirects].map(([source, destination]) => ({ source, destination }))
redirectList.sort((a, b) => a.source.localeCompare(b.source))
writeFileSync(REDIRECTS_OUT, JSON.stringify(redirectList, null, 1) + "\n")

const topicCount = subjects.reduce((n, s) => n + s.topics.length, 0)
const countQuestions = (s) => s.topics.reduce((m, t) => m + t.questions.length, 0)
const questionCount = subjects.reduce((n, s) => n + countQuestions(s), 0)
console.log(`${OUT}: ${subjects.length} subjects, ${topicCount} topics, ${questionCount} questions`)
for (const slug of SUBJECT_ORDER) {
  if (!origin.has(slug)) continue
  const s = subjects.find((x) => x.slug === slug)
  console.log(`  ${slug} — ${origin.get(slug)}${s ? ` — ${s.topics.length} topics, ${countQuestions(s)} questions, lastmod ${subjectUpdatedAt[slug]}` : ""}`)
  if (s) console.log(`    ${s.topics.map((t) => `${t.slug}(${t.questions.length})`).join(", ")}`)
}
console.log(`${REDIRECTS_OUT}: ${redirectList.length} retired topic URLs${newlyRetired.length ? `, new in this run:` : ""}`)
for (const url of newlyRetired) console.log(`  ${url} → ${redirects.get(url)}`)

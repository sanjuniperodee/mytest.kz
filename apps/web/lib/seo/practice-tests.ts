import katex from "katex"
import snapshot from "./practice-tests.data.json"

/**
 * Открытые тесты по темам /ent/<предмет>/<тема>: вопросы с ответами и разбором без
 * регистрации. Данные — снимок авторских банков (scripts/build-practice-seo-data.mjs),
 * только для сервера: в клиент уходит один тест уже готовым HTML.
 */

export type PracticeQuestion = {
  passage?: string
  stem: string
  options: string[]
  correct: number
  explanation: string
  difficulty: number
}

export type PracticeTopic = { slug: string; name: string; questions: PracticeQuestion[] }
export type PracticeSubject = { slug: string; topics: PracticeTopic[] }

const data = snapshot as { updatedAt: string; subjects: PracticeSubject[] }

/** Дата последней пересборки снимка — lastmod в sitemap. */
export const PRACTICE_UPDATED_AT = data.updatedAt

/** «Тест ЕНТ по …» — предмет в дательном падеже. */
const RU_DATIVE: Record<string, string> = {
  matematika: "математике",
  fizika: "физике",
  himiya: "химии",
  biologiya: "биологии",
  geografiya: "географии",
  informatika: "информатике",
  "vsemirnaya-istoriya": "всемирной истории",
  pravo: "основам права",
  "russkij-yazyk": "русскому языку",
  "anglijskij-yazyk": "английскому языку",
}

export function subjectDative(subjectSlug: string, fallback: string): string {
  return RU_DATIVE[subjectSlug] ?? fallback.toLowerCase()
}

export function getPracticeSubject(subjectSlug: string): PracticeSubject | undefined {
  return data.subjects.find((s) => s.slug === subjectSlug)
}

export function getPracticeTopic(subjectSlug: string, topicSlug: string): PracticeTopic | undefined {
  return getPracticeSubject(subjectSlug)?.topics.find((t) => t.slug === topicSlug)
}

export function listPracticeTopics(): { subject: string; topic: PracticeTopic }[] {
  return data.subjects.flatMap((s) => s.topics.map((topic) => ({ subject: s.slug, topic })))
}

// ─── текст банка → HTML ────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Разметка банков: формулы в `$…$`, код в `…`, переносы строк. Рендерим на сервере,
 * чтобы KaTeX не попадал в клиентский бандл, а поисковик видел готовый текст.
 */
export function practiceHtml(text: string): string {
  // Готовый HTML прячем за токенами из Private Use Area, чтобы его не экранировать.
  const parts: string[] = []
  const hold = (html: string) => `\uE000${parts.push(html) - 1}\uE001`
  const withTokens = text
    .replace(/`([^`\n]+)`/g, (_m, code: string) => hold(`<code>${escapeHtml(code)}</code>`))
    .replace(/(?<!\\)\$((?:[^$\\]|\\.)+?)\$/g, (_m, latex: string) =>
      hold(katex.renderToString(latex.trim(), { throwOnError: false })),
    )
  return escapeHtml(withTokens)
    .replace(/\n/g, "<br />")
    .replace(/\uE000(\d+)\uE001/g, (_m, i: string) => parts[Number(i)] ?? "")
}

const LATEX_SYMBOLS: Record<string, string> = {
  cdot: "·", times: "×", div: ":", pm: "±", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠",
  approx: "≈", infty: "∞", in: "∈", notin: "∉", int: "∫", sum: "Σ", quad: " ", circ: "°", to: "→",
  rightarrow: "→", pi: "π", alpha: "α", beta: "β", gamma: "γ", Delta: "Δ", delta: "δ", lambda: "λ",
  mu: "μ", nu: "ν", omega: "ω", Omega: "Ω", rho: "ρ", sigma: "σ", varphi: "φ", phi: "φ",
  theta: "θ", eta: "η", varepsilon: "ε", epsilon: "ε",
}
const LATEX_FUNCTIONS = new Set(["sin", "cos", "tg", "ctg", "tan", "cot", "log", "ln", "lg", "lim", "max", "min", "arcsin", "arccos", "arctg"])

function latexToPlain(latex: string): string {
  let s = latex
    .replace(/\\\\/g, "; ") // перенос строки в cases/системах
    .replace(/\\[,;:! ]/g, " ") // отступы
    .replace(/\\\{/g, "\uE002") // фигурные скобки как символ (множества)
    .replace(/\\\}/g, "\uE003")
    .replace(/\\(?:begin|end)\{[a-z*]+\}/g, "")
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\\%/g, "%")
  // Изнутри наружу, пока есть что раскрывать: \sqrt{…}, \frac{…}{…}, \text{…}.
  for (let prev = ""; prev !== s; ) {
    prev = s
    s = s
      .replace(/\\(?:operatorname|mathrm|mathbb|text)\{([^{}]*)\}/g, "$1")
      .replace(/_\{([^{}]*)\}/g, "_$1")
      .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
  }
  return s
    .replace(/\^\{?2\}?/g, "²")
    .replace(/\^\{?3\}?/g, "³")
    .replace(/\\([a-zA-Z]+)/g, (_m, cmd: string) => LATEX_SYMBOLS[cmd] ?? (LATEX_FUNCTIONS.has(cmd) ? cmd : ""))
    .replace(/[{}_]/g, "")
    .replace(/\uE002/g, "{")
    .replace(/\uE003/g, "}")
    .replace(/\(([\w√.,²³]+)\)/g, "$1")
}

/** Простой текст для JSON-LD: формулы без LaTeX-команд, без обратных кавычек. */
export function practicePlainText(text: string): string {
  return text
    .replace(/\$([^$]+)\$/g, (_m, latex: string) => latexToPlain(latex))
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

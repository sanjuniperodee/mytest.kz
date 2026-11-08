import { NextResponse, type NextRequest } from "next/server"
import { listPracticeTopics, practiceHtml } from "@/lib/seo/practice-tests"
import { ENT_SUBJECTS } from "@/lib/ent-subjects"

export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Сегодняшняя дата по Алматы — у всех один и тот же вопрос дня. */
function almatyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date())
}

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Короткие вопросы без длинного текста для чтения — чтобы карточка помещалась в ленту.
const POOL = listPracticeTopics().flatMap(({ subject, topic }) =>
  topic.questions
    .filter((q) => !q.passage && q.stem.length <= 400 && q.options.length >= 3)
    .map((question) => ({ subject, topic, question })),
)

/**
 * «Вопрос дня» для сообщества: один вопрос ЕНТ на всех в день (детерминированно
 * по дате), с ответом и разбором. Обсуждение — тред с темой qotd:<дата>.
 */
export function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("date")
  const today = almatyToday()
  const date = requested && DATE_RE.test(requested) && requested <= today ? requested : today
  if (!POOL.length) return NextResponse.json({ error: "empty" }, { status: 404 })

  const { subject, topic, question } = POOL[hash(`qotd:${date}`) % POOL.length]
  const meta = ENT_SUBJECTS[subject]
  return NextResponse.json(
    {
      key: `qotd:${date}`,
      date,
      isToday: date === today,
      subject: { slug: subject, ru: meta?.ru ?? subject, kk: meta?.kk ?? meta?.ru ?? subject },
      topic: { slug: topic.slug, name: topic.name, href: `/ent/${subject}/${topic.slug}` },
      stemHtml: practiceHtml(question.stem),
      optionsHtml: question.options.map(practiceHtml),
      correct: question.correct,
      explanationHtml: practiceHtml(question.explanation),
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } },
  )
}

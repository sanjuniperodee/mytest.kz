import { NextResponse, type NextRequest } from "next/server"
import { listPracticeTopics, practiceHtml } from "@/lib/seo/practice-tests"
import { buildQotdPool, pickQotd } from "@/lib/seo/qotd"
import { ENT_SUBJECTS } from "@/lib/ent-subjects"

export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Сегодняшняя дата по Алматы — у всех один и тот же вопрос дня. */
function almatyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date())
}

// Только вопросы OpenStax по математике, физике, химии и биологии — lib/seo/qotd.ts.
const POOL = buildQotdPool(listPracticeTopics())

/**
 * «Вопрос дня» для сообщества: один вопрос ЕНТ на всех в день (детерминированно
 * по дате), с ответом и разбором. Обсуждение — тред с темой qotd:<дата>.
 * 404 — для дат до перехода на пул OpenStax (QOTD_SINCE) и при пустом пуле.
 */
export function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("date")
  const today = almatyToday()
  const date = requested && DATE_RE.test(requested) && requested <= today ? requested : today
  const picked = pickQotd(POOL, date)
  if (!picked) return NextResponse.json({ error: "unavailable" }, { status: 404 })

  const { subject, topic, question } = picked
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
      // CC BY 4.0: тот, кто показывает вопрос (карточка, пост в канале), указывает источник.
      source: question.source ?? null,
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } },
  )
}

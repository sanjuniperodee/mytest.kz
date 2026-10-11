import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, BookOpen, CheckCircle2, Gift } from "lucide-react"
import "katex/dist/katex.min.css"
import { OG_IMAGES } from "@/lib/seo"
import { getSiteUrl } from "@/lib/site"
import { ENT_SUBJECTS } from "@/lib/ent-subjects"
import {
  getPracticeSubject,
  getPracticeTopic,
  listPracticeTopics,
  practiceHtml,
  practicePlainText,
  subjectDative,
} from "@/lib/seo/practice-tests"
import { SeoShell } from "@/components/seo/seo-shell"
import { PracticeQuiz } from "@/components/seo/practice-quiz"
import { AdSlot } from "@/components/ads/ad-slot"

// Все темы известны при сборке (снимок банков) — остальные адреса 404.
export const dynamicParams = false

type Props = { params: Promise<{ subject: string; topic: string }> }

const CTA_HREF = "/login?source=topic-test"

export function generateStaticParams() {
  return listPracticeTopics().map(({ subject, topic }) => ({ subject, topic: topic.slug }))
}

function resolve(subjectSlug: string, topicSlug: string) {
  const info = ENT_SUBJECTS[subjectSlug]
  const topic = getPracticeTopic(subjectSlug, topicSlug)
  if (!info || !topic) return null
  return { info, topic, dative: subjectDative(subjectSlug, info.ru) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subject, topic: topicSlug } = await params
  const page = resolve(subject, topicSlug)
  if (!page) return {}
  const { topic, dative } = page
  const count = topic.questions.length
  const url = `${getSiteUrl()}/ent/${subject}/${topic.slug}`
  const title = `Тест ЕНТ по ${dative}: ${topic.name} — ${count} вопросов с ответами | mytest`
  const description = `Бесплатный тест ЕНТ по ${dative} на тему «${topic.name}»: ${count} вопросов в формате ЕНТ с правильными ответами и разбором решения. Без регистрации — начни прямо сейчас.`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "mytest",
      locale: "ru_RU",
      type: "article",
      images: OG_IMAGES,
    },
  }
}

export default async function EntTopicTestPage({ params }: Props) {
  const { subject, topic: topicSlug } = await params
  const page = resolve(subject, topicSlug)
  if (!page) notFound()
  const { info, topic, dative } = page
  const siblings = getPracticeSubject(subject)?.topics.filter((t) => t.slug !== topic.slug) ?? []
  const count = topic.questions.length
  const path = `/ent/${subject}/${topic.slug}`

  const questions = topic.questions.map((q) => ({
    passageHtml: q.passage ? practiceHtml(q.passage) : undefined,
    stemHtml: practiceHtml(q.stem),
    optionsHtml: q.options.map(practiceHtml),
    correct: q.correct,
    explanationHtml: practiceHtml(q.explanation),
  }))

  // schema.org Quiz — разметка «учебных задач» с верным ответом и разбором.
  const quizLd = {
    "@context": "https://schema.org",
    "@type": "Quiz",
    name: `Тест ЕНТ по ${dative}: ${topic.name}`,
    url: `${getSiteUrl()}${path}`,
    inLanguage: "ru",
    learningResourceType: "Practice problem",
    isAccessibleForFree: true,
    about: { "@type": "Thing", name: topic.name },
    educationalAlignment: {
      "@type": "AlignmentObject",
      alignmentType: "educationalSubject",
      targetName: info.ru,
    },
    provider: { "@type": "Organization", name: "mytest", url: getSiteUrl() },
    hasPart: topic.questions.map((q) => ({
      "@type": "Question",
      eduQuestionType: "Multiple choice",
      text: practicePlainText(q.passage ? `${q.passage}\n${q.stem}` : q.stem),
      suggestedAnswer: q.options
        .map((o, i) => ({ o, i }))
        .filter(({ i }) => i !== q.correct)
        .map(({ o, i }) => ({ "@type": "Answer", position: i, text: practicePlainText(o) })),
      acceptedAnswer: {
        "@type": "Answer",
        position: q.correct,
        text: practicePlainText(q.options[q.correct]),
        answerExplanation: { "@type": "Comment", text: practicePlainText(q.explanation) },
      },
    })),
  }

  return (
    <SeoShell
      lang="ru"
      crumbs={[
        { name: "Пробный ЕНТ", href: "/probnyy-ent" },
        { name: info.ru, href: `/ent/${subject}` },
        { name: topic.name, href: path },
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(quizLd) }} />
      <main className="text-foreground">
        <section className="mx-auto max-w-3xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            ЕНТ 2027 · {info.ru}
          </div>
          <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Тест ЕНТ по {dative}: {topic.name}
          </h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            {count} вопросов по теме «{topic.name}» в формате ЕНТ. Выбери ответ — сразу увидишь, верно ли, и
            разбор решения. Бесплатно и без регистрации.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />
              Ответы и объяснения
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />
              Без регистрации
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />
              {info.ru} на ЕНТ: {info.questions} заданий, до {info.maxScore} баллов
            </li>
          </ul>
        </section>

        <section className="mx-auto max-w-3xl px-4 sm:px-6" aria-label="Вопросы теста">
          <PracticeQuiz questions={questions} ctaHref={CTA_HREF} />
        </section>

        <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
          <AdSlot placement="content" />
        </div>

        {siblings.length > 0 && (
          <section className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
            <h2 className="mb-5 text-2xl font-semibold tracking-tight">Другие темы по {dative}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {siblings.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/ent/${subject}/${t.slug}`}
                    className="flex h-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t.questions.length} вопр.</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={`/ent/${subject}`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {info.ru} на ЕНТ: темы, частые ошибки, план подготовки
            </Link>
          </section>
        )}

        <section className="mt-12 border-t border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Теперь — полный пробный ЕНТ</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Пять предметов, таймер и балл из 140, как на настоящем экзамене. Первый пробник — бесплатно, после
              сдачи увидишь, в каких темах теряешь баллы.
            </p>
            <Link
              href={CTA_HREF}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
            >
              <Gift className="h-4 w-4" aria-hidden="true" />
              Сдать пробный ЕНТ бесплатно
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </SeoShell>
  )
}

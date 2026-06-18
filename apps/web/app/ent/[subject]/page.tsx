import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, BookOpen, CheckCircle2, Gift, Target, TrendingUp } from "lucide-react"

const SUBJECTS: Record<string, { ru: string; kk: string; maxScore: number; questions: number }> = {
  matematika: { ru: "Математика", kk: "Математика", maxScore: 50, questions: 30 },
  "matematicheskaya-gramotnost": { ru: "Математическая грамотность", kk: "Математикалық сауаттылық", maxScore: 10, questions: 10 },
  "istoriya-kazahstana": { ru: "История Казахстана", kk: "Қазақстан тарихы", maxScore: 20, questions: 20 },
  geografiya: { ru: "География", kk: "География", maxScore: 50, questions: 30 },
  biologiya: { ru: "Биология", kk: "Биология", maxScore: 50, questions: 30 },
  himiya: { ru: "Химия", kk: "Химия", maxScore: 50, questions: 30 },
  fizika: { ru: "Физика", kk: "Физика", maxScore: 50, questions: 30 },
  informatika: { ru: "Информатика", kk: "Информатика", maxScore: 50, questions: 30 },
  "anglijskij-yazyk": { ru: "Английский язык", kk: "Ағылшын тілі", maxScore: 50, questions: 30 },
  "kazahskij-yazyk": { ru: "Казахский язык", kk: "Қазақ тілі", maxScore: 50, questions: 30 },
  "russkij-yazyk": { ru: "Русский язык", kk: "Орыс тілі", maxScore: 50, questions: 30 },
  "vsemirnaya-istoriya": { ru: "Всемирная история", kk: "Дүниежүзі тарихы", maxScore: 50, questions: 30 },
  pravo: { ru: "Основы права", kk: "Құқық негіздері", maxScore: 50, questions: 30 },
}

export async function generateStaticParams() {
  return Object.keys(SUBJECTS).map((subject) => ({ subject }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>
}): Promise<Metadata> {
  const { subject } = await params
  const info = SUBJECTS[subject]
  if (!info) return {}
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"
  return {
    title: `Пробный ЕНТ по предмету ${info.ru} 2027 — онлайн бесплатно`,
    description: `Готовься к ЕНТ 2027 по предмету ${info.ru} онлайн. Пройди бесплатный пробный тест в реальном формате, получи разбор ошибок и объяснения. mytest.kz — ${info.questions} вопросов, максимум ${info.maxScore} баллов.`,
    keywords: [
      `ЕНТ ${info.ru}`,
      `пробный ЕНТ ${info.ru}`,
      `${info.ru} ЕНТ 2027`,
      `${info.ru} ЕНТ онлайн`,
      `${info.ru} тест онлайн`,
      `подготовка к ЕНТ ${info.ru}`,
      `${info.kk} ҰБТ`,
    ],
    alternates: {
      canonical: `${siteUrl}/ent/${subject}`,
    },
    openGraph: {
      title: `Пробный ЕНТ по предмету ${info.ru} 2027`,
      description: `Бесплатный пробный тест по ${info.ru} в формате ЕНТ. Разбор ошибок после сдачи.`,
      url: `${siteUrl}/ent/${subject}`,
    },
  }
}

export default async function EntSubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>
}) {
  const { subject } = await params
  const info = SUBJECTS[subject]
  if (!info) notFound()

  const tips: Record<string, string[]> = {
    matematika: [
      "Решай задачи по алгебре и геометрии ежедневно — мышечная память важна",
      "Начинай с лёгких задач, чтобы не тратить время на сложные",
      "Знай формулы наизусть: площади, объёмы, прогрессии",
    ],
    "istoriya-kazahstana": [
      "Учи даты по блокам: древность, средневековье, новое время, современность",
      "Делай ассоциации: событие + дата + причина + итог",
      "Уделяй внимание вопросам о независимости Казахстана — их всегда много",
    ],
  }
  const subjectTips = tips[subject] ?? [
    "Регулярные пробники лучше разовой зубрёжки — решай хотя бы 10 вопросов в день",
    "Разбирай каждую ошибку: не просто смотри правильный ответ, а понимай почему",
    "Следи за таймером — на ЕНТ скорость не менее важна, чем знания",
  ]

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `Подготовка к ЕНТ — ${info.ru}`,
    description: `Онлайн-тренажёр для подготовки к ЕНТ по предмету ${info.ru}. Пробные тесты в реальном формате с разбором ошибок.`,
    provider: {
      "@type": "Organization",
      name: "mytest",
      url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz",
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      inLanguage: ["ru", "kk"],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                ЕНТ 2027 · {info.ru}
              </div>
              <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Пробный ЕНТ по предмету{" "}
                <span className="text-accent">{info.ru}</span>{" "}
                — онлайн, бесплатно
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Сдай пробный тест в реальном формате ЕНТ: {info.questions} вопросов,
                максимум {info.maxScore} баллов. Получи разбор ошибок и объяснения
                сразу после сдачи — без карты.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
                >
                  <Gift className="h-4 w-4" aria-hidden="true" />
                  Начать бесплатно
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/#pricing"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary sm:text-base"
                >
                  Смотреть тарифы
                </Link>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  1 бесплатный пробник при регистрации
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Разбор ошибок после сдачи
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Два языка: русский и қазақ тілі
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-b border-border/60">
          <div className="mx-auto grid max-w-4xl grid-cols-3 divide-x divide-border/60 px-4 sm:px-6">
            {[
              { icon: BookOpen, label: "Вопросов", value: info.questions },
              { icon: Target, label: "Максимум баллов", value: info.maxScore },
              { icon: TrendingUp, label: "Предметов в ЕНТ", value: 5 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-6 text-center">
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <span className="text-2xl font-semibold tabular-nums">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">
            Как готовиться к ЕНТ по предмету {info.ru}
          </h2>
          <ul className="space-y-4">
            {subjectTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                  {i + 1}
                </span>
                <p className="leading-relaxed text-foreground">{tip}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="border-t border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Проверь свой уровень прямо сейчас
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Первый пробный ЕНТ — бесплатно. Зарегистрируйся и начни подготовку к ЕНТ 2027 уже сегодня.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
            >
              <Gift className="h-4 w-4" aria-hidden="true" />
              Попробовать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}

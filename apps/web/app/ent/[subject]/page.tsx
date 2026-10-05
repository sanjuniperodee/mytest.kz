import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Gift, Target, TrendingUp } from "lucide-react"
import { OG_IMAGES } from "@/lib/seo"
import { ENT_SUBJECTS, ENT_SUBJECT_SLUGS } from "@/lib/ent-subjects"
import { Reveal } from "@/components/motion/reveal"

const SUBJECTS = ENT_SUBJECTS

export async function generateStaticParams() {
  return ENT_SUBJECT_SLUGS.map((subject) => ({ subject }))
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
      siteName: "mytest",
      images: OG_IMAGES,
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

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz" },
      { "@type": "ListItem", position: 2, name: "Пробный ЕНТ", item: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"}/probnyy-ent` },
      { "@type": "ListItem", position: 3, name: info.ru, item: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"}/ent/${subject}` },
    ],
  }

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

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: info.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }

  const otherSubjects = ENT_SUBJECT_SLUGS.filter((slug) => slug !== subject)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <Reveal as="section" className="relative overflow-hidden border-b border-border/60 bg-secondary/30">
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
                {info.lead}</p>
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
        </Reveal>

        {/* Stats strip */}
        <Reveal as="section" className="border-b border-border/60">
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
        </Reveal>

        {/* Topics */}
        <Reveal as="section" className="mx-auto max-w-4xl px-4 pt-16 sm:px-6">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            Что входит в ЕНТ по предмету {info.ru}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {info.topics.map((topic) => (
              <li key={topic} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="leading-relaxed">{topic}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Mistakes */}
        <Reveal as="section" className="mx-auto max-w-4xl px-4 pt-16 sm:px-6">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            Где чаще всего теряют баллы по предмету {info.ru}
          </h2>
          <ul className="space-y-3">
            {info.mistakes.map((mistake) => (
              <li key={mistake} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="leading-relaxed">{mistake}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Plan */}
        <Reveal as="section" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">
            Как готовиться к ЕНТ по предмету {info.ru}
          </h2>
          <ol className="space-y-4">
            {info.plan.map((step, i) => (
              <li key={step} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                  {i + 1}
                </span>
                <p className="leading-relaxed text-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* FAQ */}
        <Reveal as="section" className="border-t border-border/60">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <h2 className="mb-8 text-2xl font-semibold tracking-tight">
              Частые вопросы: {info.ru} на ЕНТ
            </h2>
            <dl className="space-y-6">
              {info.faq.map((item) => (
                <div key={item.q}>
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="mt-2 leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        {/* Related links — internal SEO */}
        <Reveal as="section" className="border-y border-border/60">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Смотрите также
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/probnyy-ent" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                <Gift className="h-3.5 w-3.5 text-accent" />
                Полный пробный ЕНТ бесплатно
              </Link>
              <Link href="/podgotovka-k-ent" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                Подготовка к ЕНТ 2027
              </Link>
              <Link href="/prohodnoj-ball-ent" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                Проходной балл ЕНТ
              </Link>
              <Link href="/admission" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                Шансы на грант →
              </Link>
            </div>
            <p className="mb-4 mt-8 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Другие предметы ЕНТ
            </p>
            <div className="flex flex-wrap gap-2">
              {otherSubjects.map((slug) => (
                <Link
                  key={slug}
                  href={`/ent/${slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                >
                  {ENT_SUBJECTS[slug].ru}
                </Link>
              ))}
            </div>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal as="section" className="border-t border-border/60 bg-secondary/30">
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
        </Reveal>
      </main>
    </>
  )
}

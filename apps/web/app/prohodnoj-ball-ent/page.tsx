import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Gift, AlertCircle, Calculator } from "lucide-react"
import { OG_IMAGES } from "@/lib/seo"
import { Reveal } from "@/components/motion/reveal"
import { SeoShell } from "@/components/seo/seo-shell"
import { GrantHubDirectory } from "@/components/seo/grant/hub-directory"
import { loadGrantData } from "@/lib/seo/grant-cutoffs"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"

// Баллы читаются из прод API (ISR раз в 6 часов).
export const revalidate = 21600

export async function generateMetadata(): Promise<Metadata> {
  const data = await loadGrantData()
  const LATEST_YEAR = data.latestYear
  const NEXT_YEAR = data.nextYear
  return {
    title: "Проходной балл ЕНТ 2027 на грант — все вузы и специальности",
    description:
      `Реальные проходные баллы ЕНТ на грант ${LATEST_YEAR} года по ${data.listUniversities().length} вузам и ${data.listPrograms().length} группам программ Казахстана (данные МНВО РК), пороговые баллы и ориентир на ${NEXT_YEAR}. Калькулятор шансов на грант.`,
    keywords: [
      "проходной балл ент",
      "проходной балл ент 2027",
      "пороговый балл ент",
      "проходной балл ент 2026",
      "минимальный балл ент",
      "сколько нужно баллов для гранта ент",
      "ент сколько нужно баллов",
      "проходной балл для гранта",
      "ент грант 2027",
      "проходной балл казну",
      "проходной балл назарбаев университет",
      "пороговые баллы вузов казахстан",
      "ент калькулятор гранта",
    ],
    alternates: {
      canonical: `${siteUrl}/prohodnoj-ball-ent`,
      languages: {
        ru: `${siteUrl}/prohodnoj-ball-ent`,
        kk: `${siteUrl}/ubt-otu-baly`,
        "x-default": `${siteUrl}/prohodnoj-ball-ent`,
      },
    },
    openGraph: {
      title: "Проходной балл ЕНТ 2027 для гранта — my-test.kz",
      description: "Пороговые баллы ЕНТ по специальностям и вузам. Калькулятор шансов на грант.",
      url: `${siteUrl}/prohodnoj-ball-ent`,
      siteName: "mytest",
      images: OG_IMAGES,
    },
  }
}

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Проходной балл ЕНТ", item: `${siteUrl}/prohodnoj-ball-ent` },
  ],
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Какой минимальный проходной балл ЕНТ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Минимальный порог ЕНТ для допуска к поступлению — 50 баллов. Из них: не менее 15 баллов по обязательным предметам (математическая грамотность + грамотность чтения + история Казахстана) и не менее 35 баллов по двум профильным предметам. Если набрал ниже порога — документы в вуз не принимаются.",
      },
    },
    {
      "@type": "Question",
      name: "Сколько баллов нужно для гранта ЕНТ 2027?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Проходной балл для гранта зависит от специальности и вуза. Для популярных специальностей (медицина, IT, право) в ведущих вузах нужно 100–125+ баллов. Для менее конкурентных специальностей в региональных вузах — от 70–80 баллов. Точный проходной балл по вашей специальности можно проверить в нашем калькуляторе.",
      },
    },
    {
      "@type": "Question",
      name: "Как узнать проходной балл для конкретного вуза?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "На my-test.kz есть интерактивный калькулятор шансов на грант: введи свой балл ЕНТ и специальность — система покажет вероятность поступления в конкретный вуз на основе проходных баллов прошлых лет. Данные обновляются по каждому циклу приёма.",
      },
    },
    {
      "@type": "Question",
      name: "Влияет ли выбор квоты на проходной балл?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Да. Существует несколько квот: общий конкурс (GRANT), сельская квота (RURAL), квота для детей-сирот и другие. Проходной балл по общему конкурсу обычно выше, чем по квотам. Если ты имеешь право на квоту — учитывай это при оценке шансов.",
      },
    },
    {
      "@type": "Question",
      name: "Что делать, если баллов не хватает для гранта?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Есть два варианта: 1) повторно сдать ЕНТ в следующем году (за год реально поднять балл на 15–25 пунктов при системной подготовке с пробными тестами и разбором ошибок); 2) поступить на платную форму обучения и перевестись на грант после 1-го курса при отличной успеваемости.",
      },
    },
    {
      "@type": "Question",
      name: "Как проходные баллы менялись за последние годы?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "В целом проходные баллы для гранта в Казахстане росли последние 5 лет из-за увеличения конкуренции. По данным прошлых лет, медицина требует 110–125, IT и юриспруденция — 100–120, педагогика и технические специальности — 70–95. Точные данные смотри в нашем калькуляторе — там историческая динамика по вузам.",
      },
    },
  ],
}

export default async function ProhodnoiBallEntPage() {
  const data = await loadGrantData()
  const LATEST_YEAR = data.latestYear
  const NEXT_YEAR = data.nextYear
  return (
    <SeoShell lang="ru" alternate={{ href: "/ubt-otu-baly" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <Reveal as="section" className="border-b border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              ЕНТ 2027 · Проходные баллы
            </div>
            <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Проходной балл ЕНТ 2027{" "}
              <span className="text-accent">для гранта</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Сколько нужно набрать на ЕНТ, чтобы получить грант? Реальные проходные баллы {LATEST_YEAR}{" "}
              года по всем вузам и специальностям — по официальным спискам грантников МНВО РК — и
              калькулятор шансов по конкретным вузам.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admission"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
              >
                <Calculator className="h-4 w-4" />
                Проверить шансы на грант
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/probnyy-ent"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary sm:text-base"
              >
                <Gift className="h-4 w-4" />
                Сдать пробный ЕНТ бесплатно
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted-foreground">
              {[
                "Минимальный порог — 50 баллов",
                `Баллы ${LATEST_YEAR} по ${data.listUniversities().length} вузам и ${data.listPrograms().length} специальностям`,
                "Калькулятор по конкретным вузам",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* Minimum thresholds */}
        <Reveal as="section" className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Пороговые баллы ЕНТ — что они означают
          </h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg font-bold text-accent">50</span>
                <div>
                  <p className="font-semibold">Минимальный порог для поступления</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Не менее 15 баллов по обязательным предметам + не менее 35 баллов по двум профильным.
                    Ниже — документы не принимают.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/10 text-base font-bold text-amber-700 dark:text-amber-400">70+</span>
                <div>
                  <p className="font-semibold">Реальный старт для грантовой конкуренции</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    При 70–85 баллах есть шансы на грант в региональных вузах на менее
                    конкурентные специальности (педагогика, агрономия, технические).
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10 text-base font-bold text-green-700 dark:text-green-400">100+</span>
                <div>
                  <p className="font-semibold">Зона уверенного гранта</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    100+ баллов открывают гранты почти по всем специальностям. Для топ-вузов
                    (КазНУ, КАЗГЮУ, медицина) нужно 110–125+.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 dark:border-amber-400/20 dark:bg-amber-500/5 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-800 dark:text-amber-300">
              Проходные баллы меняются каждый год в зависимости от конкурса. Ниже — реальные баллы{" "}
              {LATEST_YEAR} года: ориентир на {NEXT_YEAR} с запасом в 3–5 баллов. Шансы по своим
              баллам и квоте — в{" "}
              <Link href="/admission" className="font-medium underline underline-offset-4">
                калькуляторе шансов
              </Link>.
            </span>
          </div>
        </Reveal>

        {/* Real cutoffs: every program group and university, linking to their pages */}
        <GrantHubDirectory data={data} lang="ru" />

        {/* How to prepare */}
        <Reveal as="section" className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Как набрать нужный балл для гранта
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Знать проходной балл — первый шаг. Второй — систематически готовиться, чтобы его достичь.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {
                n: "1",
                title: "Установи целевой балл",
                text: "Выбери специальность и вуз. Посмотри проходной балл прошлых лет в калькуляторе. Это твоя конкретная цель — не «набрать побольше», а конкретное число.",
              },
              {
                n: "2",
                title: "Сдай диагностический пробный ЕНТ",
                text: "Бесплатный пробный ЕНТ на my-test.kz покажет твой текущий уровень. Сравни с целевым баллом — получишь дефицит, который нужно закрыть.",
              },
              {
                n: "3",
                title: "Работай над слабыми предметами",
                text: "Не трать время на то, что и так знаешь. Сфокусируйся на предметах с наибольшим отставанием — именно там больше всего потенциала для роста.",
              },
              {
                n: "4",
                title: "Регулярно проверяй прогресс",
                text: "Каждые 1–2 недели полный пробный ЕНТ. Статистика покажет динамику по каждому предмету. Большинство учеников поднимают балл на 15–25 пунктов за 3–6 месяцев.",
              },
            ].map((item) => (
              <li key={item.n} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{item.n}</span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* FAQ */}
        <Reveal as="section" className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="mb-7 text-2xl font-semibold tracking-tight sm:text-3xl">
              Частые вопросы о проходных баллах ЕНТ
            </h2>
            <div className="space-y-4">
              {jsonLd.mainEntity.map((item) => (
                <div key={item.name} className="rounded-xl border border-border bg-card p-6">
                  <h3 className="font-semibold text-foreground">{item.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Internal links */}
        <Reveal as="section" className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Смотрите также</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/probnyy-ent" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
              <Gift className="h-3.5 w-3.5 text-accent" />
              Пробный ЕНТ бесплатно
            </Link>
            <Link href="/podgotovka-k-ent" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
              Подготовка к ЕНТ 2027
            </Link>
            <Link href="/uat" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
              Тегін ҰБТ (қазақша)
            </Link>
            <Link href="/ent-2027" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
              ЕНТ 2027
            </Link>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal as="section" className="border-t border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Узнай свои шансы на грант
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Введи балл ЕНТ и специальность — получи вероятность поступления по каждому вузу
              на основе реальных проходных баллов прошлых лет.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/admission"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
              >
                <Calculator className="h-4 w-4" />
                Калькулятор шансов на грант
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/probnyy-ent"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-4 text-sm font-semibold transition-colors hover:bg-secondary sm:text-base"
              >
                <Gift className="h-4 w-4" />
                Пробный ЕНТ бесплатно
              </Link>
            </div>
          </div>
        </Reveal>

      </main>
    </SeoShell>
  )
}

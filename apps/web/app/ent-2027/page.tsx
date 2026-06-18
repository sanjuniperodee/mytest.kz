import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Gift } from "lucide-react"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"

export const metadata: Metadata = {
  title: "Пробный ЕНТ 2027 — онлайн бесплатно | mytest",
  description:
    "Подготовься к ЕНТ 2027 с бесплатным пробным тестом. Реальный формат 140 вопросов, таймер, разбор ошибок после сдачи. Начни прямо сейчас на mytest.kz.",
  keywords: [
    "ЕНТ 2027",
    "пробный ЕНТ 2027",
    "подготовка к ЕНТ 2027",
    "ЕНТ 2027 онлайн",
    "ЕНТ 2027 бесплатно",
    "ҰБТ 2027",
    "тест ЕНТ 2027",
  ],
  alternates: { canonical: `${siteUrl}/ent-2027` },
  openGraph: {
    title: "Пробный ЕНТ 2027 — онлайн бесплатно",
    description: "1 бесплатный пробный ЕНТ 2027 без карты. Реальный формат, разбор ошибок.",
    url: `${siteUrl}/ent-2027`,
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Когда ЕНТ 2027?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ЕНТ 2027 пройдёт в мае–июне 2027 года. Точные даты объявляет МОН РК обычно в феврале–марте. Начинай готовиться заранее — за 6–8 месяцев.",
      },
    },
    {
      "@type": "Question",
      name: "Сколько вопросов на ЕНТ 2027?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ЕНТ 2027 состоит из 140 вопросов: обязательные предметы (математическая грамотность — 10 вопросов, история Казахстана — 20 вопросов, грамотность чтения — 10 вопросов) и два профильных предмета по 50 вопросов каждый.",
      },
    },
    {
      "@type": "Question",
      name: "Как получить грант на ЕНТ 2027?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Для гранта нужно набрать пороговый балл (обычно 65–70+) и войти в топ абитуриентов по выбранной специальности. Точные пороги зависят от вуза и специальности — проверяй в нашем калькуляторе шансов на поступление.",
      },
    },
    {
      "@type": "Question",
      name: "Можно ли пройти пробный ЕНТ 2027 бесплатно?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Да. На mytest.kz первый пробный ЕНТ в реальном формате полностью бесплатный — без карты и без регистрации кредитки. Зарегистрируйся и сразу начинай.",
      },
    },
  ],
}

export default function Ent2027Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-background text-foreground">
        <section className="relative overflow-hidden border-b border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Пробный <span className="text-accent">ЕНТ 2027</span> —{" "}
              онлайн, бесплатно
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Начни подготовку к ЕНТ 2027 уже сейчас. Первый полный пробный тест —
              бесплатно и без карты. 140 вопросов, реальный формат, таймер и разбор
              ошибок после сдачи.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
              >
                <Gift className="h-4 w-4" aria-hidden="true" />
                Попробовать бесплатно
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admission"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary sm:text-base"
              >
                Калькулятор шансов на грант
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              {[
                "140 вопросов · реальный формат",
                "Разбор ошибок после сдачи",
                "Русский и қазақ тілі",
                "Без карты — первый тест бесплатно",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">
            Вопросы о ЕНТ 2027
          </h2>
          <div className="space-y-4">
            {jsonLd.mainEntity.map((item) => (
              <div key={item.name} className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold text-foreground">{item.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.acceptedAnswer.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Subjects grid */}
        <section className="border-t border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight">
              Пробные ЕНТ по предметам
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { slug: "matematika", name: "Математика" },
                { slug: "istoriya-kazahstana", name: "История Казахстана" },
                { slug: "fizika", name: "Физика" },
                { slug: "himiya", name: "Химия" },
                { slug: "biologiya", name: "Биология" },
                { slug: "geografiya", name: "География" },
                { slug: "informatika", name: "Информатика" },
                { slug: "anglijskij-yazyk", name: "Английский язык" },
                { slug: "vsemirnaya-istoriya", name: "Всемирная история" },
              ].map(({ slug, name }) => (
                <Link
                  key={slug}
                  href={`/ent/${slug}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  {name}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

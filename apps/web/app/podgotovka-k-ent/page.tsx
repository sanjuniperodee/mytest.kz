import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Gift, BookOpen, Calendar, TrendingUp, AlertCircle } from "lucide-react"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"

export const metadata: Metadata = {
  title: "Подготовка к ЕНТ онлайн 2027 — как подготовиться к ЕНТ | mytest.kz",
  description:
    "Эффективная подготовка к ЕНТ 2027 онлайн. Пробные ЕНТ, разбор ошибок, статистика по предметам. Узнай проходные баллы, структуру ЕНТ и как набрать 100+ баллов. Первый пробник — бесплатно.",
  keywords: [
    "подготовка к ент",
    "подготовка к ент онлайн",
    "как подготовиться к ент",
    "подготовка к ент 2027",
    "курсы подготовки к ент",
    "ент подготовка бесплатно",
    "подготовка к ент казахстан",
    "ент 2027 подготовка",
    "как сдать ент",
    "как сдать ент на 100",
    "как подготовиться к ент за месяц",
    "подготовка к ент математика",
  ],
  alternates: { canonical: `${siteUrl}/podgotovka-k-ent` },
  openGraph: {
    title: "Подготовка к ЕНТ 2027 онлайн — mytest.kz",
    description: "Пробные ЕНТ, разбор ошибок, проходные баллы. Первый пробник бесплатно.",
    url: `${siteUrl}/podgotovka-k-ent`,
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Как подготовиться к ЕНТ с нуля?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Начни с диагностики: сдай пробный ЕНТ и посмотри, по каким предметам ты теряешь баллы. Потом систематически работай над слабыми темами по каждому предмету. Каждые 1–2 недели снова сдавай пробный ЕНТ, чтобы видеть прогресс. Чем раньше начнёшь — тем больше времени на закрытие пробелов.",
      },
    },
    {
      "@type": "Question",
      name: "Сколько баллов нужно для поступления в университет?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Минимальный порог ЕНТ — 50 баллов (15 — обязательные, 35 — профильные). Для грантов на популярные специальности нужно 100–120+ баллов. Точный проходной балл зависит от университета, специальности и квоты. Проверить шансы на конкретный грант можно в нашем калькуляторе.",
      },
    },
    {
      "@type": "Question",
      name: "Сколько времени нужно на подготовку к ЕНТ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Оптимально — 6–12 месяцев. Если ЕНТ через 3 месяца, сфокусируйся на пробных тестах и разборе ошибок: это самый быстрый способ поднять балл. Если осталось меньше месяца — концентрируйся на проходных темах и типичных вопросах, которые чаще всего встречаются в ЕНТ.",
      },
    },
    {
      "@type": "Question",
      name: "Какие предметы сложнее всего на ЕНТ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "По статистике, больше всего баллов теряют на математике (профильной) и по истории Казахстана. Математика — из-за сложных задач на 2–3 шага, история — из-за большого объёма дат и событий. Обязательные предметы (математическая грамотность, грамотность чтения) набирают большинство учеников на 7–8 из 10.",
      },
    },
    {
      "@type": "Question",
      name: "Насколько эффективны пробные ЕНТ для подготовки?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Очень эффективны — при условии, что ты разбираешь ошибки после каждого пробника. Просто сдавать без анализа почти бесполезно. Пробные ЕНТ помогают привыкнуть к формату, темпу, типам вопросов — это снижает стресс в день экзамена. Плюс ты точно видишь, над чем работать.",
      },
    },
    {
      "@type": "Question",
      name: "Что лучше — репетитор или онлайн-платформа для подготовки к ЕНТ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Зависит от твоего уровня. Репетитор лучше, если у тебя есть конкретные пробелы в знаниях и ты хочешь их разобрать глубоко. Платформа лучше, если тебе нужно практиковаться в формате теста и видеть прогресс. Оптимально — комбинировать: занятия по слабым темам + регулярные пробные ЕНТ для проверки.",
      },
    },
  ],
}

const subjects = [
  { slug: "matematika", name: "Математика", difficulty: "Сложно", pts: 50 },
  { slug: "fizika", name: "Физика", difficulty: "Сложно", pts: 50 },
  { slug: "himiya", name: "Химия", difficulty: "Средне", pts: 50 },
  { slug: "biologiya", name: "Биология", difficulty: "Средне", pts: 50 },
  { slug: "geografiya", name: "География", difficulty: "Средне", pts: 50 },
  { slug: "informatika", name: "Информатика", difficulty: "Средне", pts: 50 },
  { slug: "istoriya-kazahstana", name: "История Казахстана", difficulty: "Сложно", pts: 20 },
  { slug: "anglijskij-yazyk", name: "Английский язык", difficulty: "Средне", pts: 50 },
  { slug: "vsemirnaya-istoriya", name: "Всемирная история", difficulty: "Средне", pts: 50 },
]

const timeline = [
  { months: "12+ мес.", title: "Диагностика и база", text: "Сдай пробный ЕНТ, выяви слабые места. Начни систематически изучать теорию по профильным предметам." },
  { months: "6 мес.", title: "Регулярные пробники", text: "Раз в 1–2 недели полный пробный ЕНТ. Разбирай каждую ошибку. Смотри динамику баллов." },
  { months: "3 мес.", title: "Интенсив по слабым темам", text: "Сфокусируйся на 3–5 темах, где теряешь больше всего баллов. Решай однотипные задачи до автоматизма." },
  { months: "1 мес.", title: "Финальная шлифовка", text: "Только пробные ЕНТ в боевом режиме. Никакого нового материала. Разбирай ошибки, тренируй темп." },
]

export default function PodgotovkaKEntPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="border-b border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              ЕНТ 2027 · Подготовка
            </div>
            <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Подготовка к ЕНТ 2027{" "}
              <span className="text-accent">онлайн</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Пробные ЕНТ в реальном формате, разбор ошибок и статистика по предметам. Зарегистрируйся
              и получи первый пробный ЕНТ бесплатно — узнай свой текущий уровень уже сегодня.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
              >
                <Gift className="h-4 w-4" />
                Начать подготовку бесплатно
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admission"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary sm:text-base"
              >
                Калькулятор шансов на грант
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted-foreground">
              {[
                "Пробный ЕНТ в реальном формате",
                "Разбор ошибок с объяснениями",
                "Статистика по предметам",
                "Казахский и русский язык",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Structure */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Структура ЕНТ 2027
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            5 предметов, 140 вопросов, 240 минут. Структура не менялась несколько лет.
          </p>
          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Предмет</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Вопросов</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Макс. балл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { name: "Математическая грамотность", q: 10, pts: 10 },
                  { name: "Грамотность чтения", q: 10, pts: 10 },
                  { name: "История Казахстана", q: 20, pts: 20 },
                  { name: "1-й профильный предмет", q: 50, pts: 50 },
                  { name: "2-й профильный предмет", q: 50, pts: 50 },
                ].map((row) => (
                  <tr key={row.name}>
                    <td className="px-5 py-3 font-medium">{row.name}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{row.q}</td>
                    <td className="px-5 py-3 text-right font-semibold">{row.pts}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-secondary/30 font-semibold">
                  <td className="px-5 py-3">Итого</td>
                  <td className="px-5 py-3 text-right">140</td>
                  <td className="px-5 py-3 text-right">140</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 dark:border-amber-400/20 dark:bg-amber-500/5 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-800 dark:text-amber-300">
              Для прохождения ЕНТ нужно набрать минимум 50 баллов: не менее 15 по обязательным
              предметам и не менее 35 по профильным. Для гранта — смотри проходные баллы по
              специальности.
            </span>
          </div>
        </section>

        {/* Timeline */}
        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Как выстроить подготовку к ЕНТ
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Стратегия зависит от того, сколько времени у тебя осталось.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {timeline.map((step, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 shrink-0 text-accent" />
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">{step.months}</span>
                  </div>
                  <p className="mt-3 font-semibold">{step.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Subjects */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Подготовка к ЕНТ по предметам
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Тренируйся по профильным предметам отдельно — это быстрый способ поднять балл.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map(({ slug, name, difficulty, pts }) => (
              <Link
                key={slug}
                href={`/ent/${slug}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-secondary"
              >
                <div>
                  <span className="block">{name}</span>
                  <span className={`text-xs ${difficulty === "Сложно" ? "text-destructive" : "text-muted-foreground"}`}>
                    {difficulty} · {pts} балл.
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              7 советов для подготовки к ЕНТ
            </h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { n: "1", title: "Начни с диагностики", text: "Сдай пробный ЕНТ первым делом — так ты честно увидишь, где стоишь, без самообмана." },
                { n: "2", title: "Сфокусируйся на 3–4 слабых темах", text: "Попытка улучшить всё одновременно ничем не заканчивается. Выбери темы с наибольшим потенциалом роста." },
                { n: "3", title: "Разбирай каждую ошибку", text: "Не просто смотри правильный ответ — понимай, почему он правильный. Это работает." },
                { n: "4", title: "Сдавай пробники регулярно", text: "Раз в 1–2 недели, в боевом режиме, без шпаргалок. Это единственный способ видеть реальный прогресс." },
                { n: "5", title: "Следи за темпом", text: "На ЕНТ ~1,7 минуты на вопрос. Тренируй темп на пробниках — чтобы в день X не паниковать из-за времени." },
                { n: "6", title: "Не зубри — понимай", text: "История Казахстана — исключение. Там реально нужно запоминать даты. Но в математике и физике понимание важнее памяти." },
                { n: "7", title: "За неделю до ЕНТ — стоп новому", text: "Никакого нового материала. Только повторение пройденного и 1–2 пробника для разгона." },
              ].map((tip) => (
                <li key={tip.n} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{tip.n}</span>
                  <div>
                    <p className="font-semibold">{tip.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tip.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="mb-7 text-2xl font-semibold tracking-tight sm:text-3xl">
            Частые вопросы о подготовке к ЕНТ
          </h2>
          <div className="space-y-4">
            {jsonLd.mainEntity.map((item) => (
              <div key={item.name} className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold text-foreground">{item.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.acceptedAnswer.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Узнай свой уровень прямо сейчас
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Сдай бесплатный пробный ЕНТ — 140 вопросов, реальный формат, результат сразу.
              Первый шаг к подготовке — понять, где ты сейчас.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
              >
                <Gift className="h-4 w-4" />
                Начать подготовку бесплатно
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admission"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-4 text-sm font-semibold transition-colors hover:bg-secondary sm:text-base"
              >
                <TrendingUp className="h-4 w-4" />
                Шансы на грант
              </Link>
            </div>
          </div>
        </section>

      </main>
    </>
  )
}

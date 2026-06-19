import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Gift, BookOpen, Clock, Target, TrendingUp } from "lucide-react"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"

export const metadata: Metadata = {
  title: "Пробный ЕНТ онлайн бесплатно 2027 — сдать пробник ЕНТ",
  description:
    "Сдай пробный ЕНТ онлайн бесплатно. 140 вопросов, 240 минут, реальный формат ЕНТ 2027. Первый пробник без карты — разбор ошибок и объяснения после сдачи.",
  keywords: [
    "пробный ент",
    "пробный ент онлайн",
    "пробный ент бесплатно",
    "пробник ент",
    "пробный ент 2027",
    "сдать пробный ент",
    "пробный ент онлайн бесплатно",
    "тренировочный ент",
    "ент тест онлайн",
    "ент онлайн бесплатно",
    "пробное ент тестирование",
    "ент пробник бесплатно",
  ],
  alternates: { canonical: `${siteUrl}/probnyy-ent` },
  openGraph: {
    title: "Пробный ЕНТ онлайн бесплатно — mytest.kz",
    description: "Первый пробный ЕНТ бесплатно. 140 вопросов, реальный формат, разбор ошибок.",
    url: `${siteUrl}/probnyy-ent`,
  },
}

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Пробный ЕНТ", item: `${siteUrl}/probnyy-ent` },
  ],
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Что такое пробный ЕНТ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Пробный ЕНТ — это тренировочный тест в реальном формате Единого Национального Тестирования. Он включает 140 вопросов по 5 предметам: математическая грамотность (10), грамотность чтения (10), история Казахстана (20) и два профильных предмета (по 50 каждый). Время — 240 минут, как на настоящем ЕНТ.",
      },
    },
    {
      "@type": "Question",
      name: "Можно ли пройти пробный ЕНТ бесплатно?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Да. На mytest.kz первый пробный ЕНТ полностью бесплатен — без карты, без SMS, без скрытых платежей. Просто зарегистрируйся и сразу начинай. После сдачи получишь балл и базовый разбор ошибок.",
      },
    },
    {
      "@type": "Question",
      name: "Чем пробный ЕНТ отличается от настоящего?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Формат полностью совпадает: 140 вопросов, 240 минут, те же 5 предметов, та же система баллов. Разница в том, что результат пробного ЕНТ не влияет на поступление — это безопасная тренировка. После сдачи ты видишь свои ошибки и объяснения к каждому вопросу.",
      },
    },
    {
      "@type": "Question",
      name: "Сколько раз можно сдавать пробный ЕНТ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "На бесплатном тарифе — 1 полная попытка. На платных тарифах от 3 до неограниченного количества попыток. Чем больше пробников ты сдаёшь, тем точнее видишь прогресс и понимаешь, какие темы ещё нужно подтянуть.",
      },
    },
    {
      "@type": "Question",
      name: "Какие предметы входят в пробный ЕНТ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Обязательные предметы: математическая грамотность (10 баллов), грамотность чтения (10 баллов), история Казахстана (20 баллов). Профильные предметы на выбор: математика, физика, химия, биология, география, информатика, английский язык, история. Максимальный балл — 140.",
      },
    },
    {
      "@type": "Question",
      name: "Как подготовиться к ЕНТ с помощью пробных тестов?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Сдавай пробный ЕНТ раз в неделю и сразу разбирай ошибки. Смотри статистику по предметам — она покажет, где ты теряешь больше всего баллов. Работай над ошибками: mytest.kz показывает объяснение к каждому неверному ответу. Так ты закрываешь конкретные пробелы вместо того, чтобы повторять то, что уже знаешь.",
      },
    },
  ],
}

const subjects = [
  { slug: "matematika", name: "Математика", pts: 50 },
  { slug: "fizika", name: "Физика", pts: 50 },
  { slug: "himiya", name: "Химия", pts: 50 },
  { slug: "biologiya", name: "Биология", pts: 50 },
  { slug: "geografiya", name: "География", pts: 50 },
  { slug: "informatika", name: "Информатика", pts: 50 },
  { slug: "istoriya-kazahstana", name: "История Казахстана", pts: 20 },
  { slug: "anglijskij-yazyk", name: "Английский язык", pts: 50 },
  { slug: "vsemirnaya-istoriya", name: "Всемирная история", pts: 50 },
]

export default function ProbnyEntPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="border-b border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Бесплатно · без карты
            </div>
            <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Пробный ЕНТ онлайн{" "}
              <span className="text-accent">бесплатно</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Сдай пробный ЕНТ в реальном формате прямо сейчас — 140 вопросов, 240 минут, те же
              5 предметов что и на настоящем ЕНТ. Первый пробник бесплатен. Получи балл и
              разбор ошибок сразу после сдачи.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
              >
                <Gift className="h-4 w-4" />
                Сдать пробный ЕНТ бесплатно
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
                "140 вопросов — реальный формат",
                "240 минут — как на настоящем ЕНТ",
                "Разбор ошибок после сдачи",
                "Русский и қазақ тілі",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What is it */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Что такое пробный ЕНТ
          </h2>
          <div className="mt-5 grid gap-5 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
            <p>
              Пробный ЕНТ — это тренировочный экзамен в формате настоящего Единого Национального
              Тестирования. Структура, количество вопросов, система баллов и время — всё один в один,
              как на реальном ЕНТ в мае–июне.
            </p>
            <p>
              Главное отличие: результат пробного ЕНТ не влияет на поступление. Это безопасная среда,
              где можно ошибаться, учиться и смотреть объяснения — без стресса и без последствий.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BookOpen, label: "Вопросов", value: "140" },
              { icon: Clock, label: "Минут", value: "240" },
              { icon: Target, label: "Предметов", value: "5" },
              { icon: TrendingUp, label: "Макс. балл", value: "140" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-5 text-center">
                <Icon className="h-5 w-5 text-accent" />
                <span className="text-3xl font-semibold tabular-nums">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Why practice tests help */}
        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Почему пробные ЕНТ помогают набрать больше баллов
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Привыкаешь к формату",
                  text: "На настоящем ЕНТ важен темп. Пробники тренируют тебя решать 140 вопросов за 240 минут — примерно 1,7 минуты на вопрос.",
                },
                {
                  title: "Видишь реальный уровень",
                  text: "Мы показываем балл сразу после сдачи: какой предмет проседает, где теряешь больше всего очков. Честная картина без прикрас.",
                },
                {
                  title: "Разбираешь конкретные ошибки",
                  text: "Каждый неверный ответ — это объяснение: почему правильный вариант именно такой. Не просто ответ, а понимание.",
                },
                {
                  title: "Снижаешь стресс",
                  text: "Когда ты сдал 10–15 пробников и знаешь, чего ждать — тревога в день ЕНТ намного ниже. Мозг воспринимает формат как знакомый.",
                },
              ].map((item) => (
                <li key={item.title} className="rounded-xl border border-border bg-card p-5">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Subjects */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Пробные ЕНТ по предметам
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Можно тренироваться по всему ЕНТ сразу или по отдельному предмету — если нужно прокачать конкретную тему.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map(({ slug, name, pts }) => (
              <Link
                key={slug}
                href={`/ent/${slug}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-secondary"
              >
                <span>{name}</span>
                <span className="text-xs text-muted-foreground">{pts} балл.</span>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Как сдать пробный ЕНТ на mytest.kz
            </h2>
            <ol className="mt-6 space-y-4">
              {[
                { n: "1", title: "Зарегистрируйся — 1 минута", text: "Войди через Telegram или создай аккаунт по номеру телефона. Сразу получаешь 1 бесплатный пробный ЕНТ — без карты." },
                { n: "2", title: "Выбери профиль", text: "Укажи профильные предметы: математика, физика, химия, биология, география, информатика, английский язык или история. Система сформирует тест именно под твой профиль ЕНТ." },
                { n: "3", title: "Сдай тест", text: "140 вопросов, 240 минут. Таймер и формат как на настоящем ЕНТ. Можно сделать перерыв и вернуться — прогресс сохраняется." },
                { n: "4", title: "Получи результат и разбор", text: "Сразу после сдачи: итоговый балл по каждому предмету, список ошибок с объяснениями. Платные тарифы открывают полный разбор всех вопросов." },
              ].map((step) => (
                <li key={step.n} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">{step.n}</span>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="mb-7 text-2xl font-semibold tracking-tight sm:text-3xl">
            Частые вопросы о пробном ЕНТ
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
              Начни прямо сейчас — первый пробный ЕНТ бесплатно
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Зарегистрируйся за 1 минуту и сдай пробный ЕНТ в реальном формате. Без карты, без риска.
            </p>
            <Link
              href="/login"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
            >
              <Gift className="h-4 w-4" />
              Сдать пробный ЕНТ бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

      </main>
    </>
  )
}

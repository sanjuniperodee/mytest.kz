import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Gift, BookOpen, Clock, Target, TrendingUp } from "lucide-react"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"

export const metadata: Metadata = {
  title: "Тегін ҰБТ онлайн 2027 — ҰБТ-ға дайындық | mytest.kz",
  description:
    "Тегін ҰБТ сынақ тапсыру. 140 сұрақ, 240 минут, нақты ҰБТ 2027 форматы. Тіркелген соң бірінші сынақ тегін. Қателерді талдау, статистика, ҰБТ-ға дайындық mytest.kz-де.",
  keywords: [
    "тегін ҰБТ",
    "ҰБТ дайындық",
    "ҰБТ онлайн",
    "ҰБТ 2027",
    "ҰБТ сынақ",
    "ҰБТ тапсыру",
    "ҰБТ тест онлайн",
    "ҰБТ-ға дайындық",
    "тегін ҰБТ тест",
    "ҰБТ сынақ тесті",
    "UBT online",
    "UBT бесплатно",
    "пробный УБТ",
    "пробный ҰБТ онлайн",
    "ҰБТ дайындалу",
    "ЕНТ казахский язык",
  ],
  alternates: {
    canonical: `${siteUrl}/uat`,
    languages: {
      ru: `${siteUrl}/probnyy-ent`,
      kk: `${siteUrl}/uat`,
    },
  },
  openGraph: {
    title: "Тегін ҰБТ онлайн — mytest.kz",
    description: "Бірінші ҰБТ сынағы тегін. 140 сұрақ, нақты формат, қателерді талдау.",
    url: `${siteUrl}/uat`,
    locale: "kk_KZ",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "ҰБТ дегеніміз не?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ҰБТ (Ұлттық Бірыңғай Тестілеу) — Қазақстандағы жоғары оқу орындарына түсу үшін міндетті емтихан. 5 пән бойынша 140 сұрақтан тұрады: математикалық сауаттылық (10 балл), оқу сауаттылығы (10 балл), Қазақстан тарихы (20 балл) және 2 бейіндік пән (50 + 50 балл). Максималды балл — 140.",
      },
    },
    {
      "@type": "Question",
      name: "ҰБТ сынақ тестін тегін тапсыруға болады ма?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Иә. mytest.kz-де бірінші ҰБТ сынағы толығымен тегін — карта, SMS немесе жасырын төлемдерсіз. Тіркелгеннен кейін бірден бастаңыз. Тапсырып болғаннан соң балл мен қателерді талдауды аласыз.",
      },
    },
    {
      "@type": "Question",
      name: "ҰБТ сынақ пен нақты ҰБТ арасындағы айырмашылық не?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Формат толығымен сәйкес: 140 сұрақ, 240 минут, сол 5 пән, сол балл жүйесі. Айырмашылығы — сынақтың нәтижесі оқуға түсуге әсер етпейді. Бұл қауіпсіз жаттығу. Тапсырып болғаннан соң қателерін және әр сұраққа түсіндірмелерді көресіз.",
      },
    },
    {
      "@type": "Question",
      name: "ҰБТ-ға дайындықта сынақ тесттері қалай көмектеседі?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Апта сайын сынақ тапсырып, қателерді бірден талдаңыз. Пәндер бойынша статистиканы қараңыз — ол сізге ең көп балл жоғалтатын жерді көрсетеді. Дұрыс емес әр жауапқа mytest.kz түсіндірме береді. Осылайша білетін нәрсеңізді қайталаудың орнына нақты олқылықтарды жабасыз.",
      },
    },
    {
      "@type": "Question",
      name: "ҰБТ максималды балы қанша?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ҰБТ максималды балы — 140 балл. Оның ішінде: математикалық сауаттылық — 10 балл, оқу сауаттылығы — 10 балл, Қазақстан тарихы — 20 балл, 1-бейіндік пән — 50 балл, 2-бейіндік пән — 50 балл. Грант алу үшін әдетте 100+ балл жинау керек, бірақ нақты шек мамандыққа байланысты.",
      },
    },
    {
      "@type": "Question",
      name: "ҰБТ-ға қайсы пәндер кіреді?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Міндетті пәндер: математикалық сауаттылық, оқу сауаттылығы, Қазақстан тарихы. Бейіндік пәндер: математика, физика, химия, биология, география, информатика, ағылшын тілі, дүниежүзі тарихы. Екі бейіндік пән мамандығыңызға байланысты таңдалады.",
      },
    },
  ],
}

const subjectsKk = [
  { slug: "matematika", name: "Математика", pts: 50 },
  { slug: "fizika", name: "Физика", pts: 50 },
  { slug: "himiya", name: "Химия", pts: 50 },
  { slug: "biologiya", name: "Биология", pts: 50 },
  { slug: "geografiya", name: "География", pts: 50 },
  { slug: "informatika", name: "Информатика", pts: 50 },
  { slug: "istoriya-kazahstana", name: "Қазақстан тарихы", pts: 20 },
  { slug: "anglijskij-yazyk", name: "Ағылшын тілі", pts: 50 },
  { slug: "vsemirnaya-istoriya", name: "Дүниежүзі тарихы", pts: 50 },
]

export default function UatPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="border-b border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Тегін · картасыз
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                ҰБТ 2027
              </div>
            </div>
            <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Тегін ҰБТ сынақ тесті{" "}
              <span className="text-accent">онлайн</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Нақты ҰБТ форматында сынақ тапсырыңыз — 140 сұрақ, 240 минут, 5 пән.
              Бірінші сынақ тегін. Тапсырып болғаннан соң бірден балл мен қателерді талдауды алыңыз.
            </p>
            <p className="mt-2 text-base text-muted-foreground">
              Пробный ЕНТ онлайн бесплатно — для тех, кто готовится на русском:{" "}
              <Link href="/probnyy-ent" className="underline underline-offset-4">
                /probnyy-ent
              </Link>
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
              >
                <Gift className="h-4 w-4" />
                Тегін ҰБТ тапсыру
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admission"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary sm:text-base"
              >
                Грантқа түсу мүмкіндігін есептеу
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted-foreground">
              {[
                "140 сұрақ — нақты формат",
                "240 минут — нақты ҰБТ сияқты",
                "Қателерді талдау",
                "Қазақша және орысша",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            ҰБТ туралы негізгі сандар
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BookOpen, label: "Сұрақ саны", value: "140" },
              { icon: Clock, label: "Минут", value: "240" },
              { icon: Target, label: "Пән", value: "5" },
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

        {/* Score breakdown */}
        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              ҰБТ пәндері бойынша балл бөлінісі
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Барлық 5 пән бойынша максималды баллдар және олардың жалпы балдағы үлесі.
            </p>
            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Пән</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground">Сұрақ</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground">Макс. балл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { name: "Математикалық сауаттылық", q: 10, pts: 10 },
                    { name: "Оқу сауаттылығы", q: 10, pts: 10 },
                    { name: "Қазақстан тарихы", q: 20, pts: 20 },
                    { name: "1-бейіндік пән", q: 50, pts: 50 },
                    { name: "2-бейіндік пән", q: 50, pts: 50 },
                  ].map((row) => (
                    <tr key={row.name}>
                      <td className="px-5 py-3 font-medium">{row.name}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{row.q}</td>
                      <td className="px-5 py-3 text-right font-semibold">{row.pts}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-secondary/30 font-semibold">
                    <td className="px-5 py-3">Жиыны</td>
                    <td className="px-5 py-3 text-right">140</td>
                    <td className="px-5 py-3 text-right">140</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Why practice tests */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Неліктен сынақ тесттері ҰБТ баллын арттырады
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Форматқа үйренесіз",
                text: "Нақты ҰБТ-да қарқын маңызды. Сынақтар сізді 240 минутта 140 сұрақты шешуге үйретеді — сұраққа шамамен 1,7 минут.",
              },
              {
                title: "Нақты деңгейіңізді білесіз",
                text: "Тапсырғаннан кейін бірден балл көрсетіледі: қай пән артта қалып, қайда балл жоғалтып жатқаныңызды білесіз.",
              },
              {
                title: "Нақты қателерді талдайсыз",
                text: "Дұрыс емес әр жауапқа түсіндірме беріледі. Жай жауап емес — түсіну. Осылайша нақты тақырыптарды жабасыз.",
              },
              {
                title: "Стрессті азайтасыз",
                text: "10–15 сынақ тапсырып, нені күтетінін білсеңіз — ҰБТ күні алаңдаушылық әлдеқайда аз болады. Мидың форматты таныс ретінде қабылдауы.",
              },
            ].map((item) => (
              <li key={item.title} className="rounded-xl border border-border bg-card p-5">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Subjects */}
        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Пәндер бойынша ҰБТ сынақтары
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Барлық ҰБТ форматында немесе жеке пән бойынша жаттығуға болады.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjectsKk.map(({ slug, name, pts }) => (
                <Link
                  key={slug}
                  href={`/ent/${slug}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  <span>{name}</span>
                  <span className="text-xs text-muted-foreground">{pts} балл</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="mb-7 text-2xl font-semibold tracking-tight sm:text-3xl">
            ҰБТ туралы жиі қойылатын сұрақтар
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

        {/* How to start */}
        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              mytest.kz-де ҰБТ сынағын қалай тапсыруға болады
            </h2>
            <ol className="mt-6 space-y-4">
              {[
                { n: "1", title: "Тіркелу — 1 минут", text: "Telegram арқылы немесе телефон нөмірімен аккаунт жасаңыз. Бірден 1 тегін ҰБТ сынағы беріледі — картасыз." },
                { n: "2", title: "Бейінді таңдаңыз", text: "Бейіндік пәндерді көрсетіңіз: математика, физика, химия, биология, география, информатика, ағылшын тілі немесе тарих. Жүйе сіздің бейініңізге сай тест жасайды." },
                { n: "3", title: "Тест тапсырыңыз", text: "140 сұрақ, 240 минут. Таймер мен формат нақты ҰБТ сияқты. Үзіліс жасап, қайта оралуға болады — үлгерім сақталады." },
                { n: "4", title: "Нәтиже мен талдауды алыңыз", text: "Тапсырып болғаннан соң: әр пән бойынша жиынтық балл, қателер тізімі мен түсіндірмелер. Ақылы тарифтар барлық сұрақтардың толық талдауын ашады." },
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

        {/* CTA */}
        <section className="border-t border-border/60">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Қазір бастаңыз — бірінші ҰБТ сынағы тегін
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              1 минутта тіркеліп, нақты форматта ҰБТ сынағын тапсырыңыз. Картасыз, тәуекелсіз.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
              >
                <Gift className="h-4 w-4" />
                Тегін ҰБТ тапсыру
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/probnyy-ent"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-4 text-sm font-semibold transition-colors hover:bg-secondary sm:text-base"
              >
                На русском →
              </Link>
            </div>
          </div>
        </section>

      </main>
    </>
  )
}

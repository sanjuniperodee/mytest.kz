import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Calculator, Gift, Info } from "lucide-react"
import { SeoShell } from "@/components/seo/seo-shell"
import { GrantHubDirectory } from "@/components/seo/grant/hub-directory"
import { OG_IMAGES } from "@/lib/seo"
import { loadGrantData, programName } from "@/lib/seo/grant-cutoffs"
import { getSiteUrl } from "@/lib/site"

const siteUrl = getSiteUrl()

// Баллы читаются из прод API (ISR раз в 6 часов).
export const revalidate = 21600

export async function generateMetadata(): Promise<Metadata> {
  const data = await loadGrantData()
  const LATEST_YEAR = data.latestYear
  const NEXT_YEAR = data.nextYear
  const universitiesCount = data.listUniversities().length
  const programsCount = data.listPrograms().length
  return {
    title: { absolute: `ҰБТ өту балы ${NEXT_YEAR}: грантқа ЖОО және мамандықтар бойынша | mytest` },
    description: `${LATEST_YEAR} жылғы грантқа ҰБТ өту балдары: ${universitiesCount} ЖОО және ${programsCount} білім беру бағдарламаларының тобы (ҚР ҒЖБМ ресми деректері). Ауыл квотасы, жылдар бойынша өзгеріс және ${NEXT_YEAR} жылға бағдар.`,
    keywords: [
      "ҰБТ өту балы",
      `ҰБТ өту балы ${NEXT_YEAR}`,
      `ҰБТ өту балы ${LATEST_YEAR}`,
      "грантқа өту балы",
      "грантқа қанша балл керек",
      "ҰБТ шекті балл",
      "ЖОО өту балдары",
      "мамандықтар өту балы",
      "ауыл квотасы өту балы",
    ],
    alternates: {
      canonical: `${siteUrl}/ubt-otu-baly`,
      languages: {
        ru: `${siteUrl}/prohodnoj-ball-ent`,
        kk: `${siteUrl}/ubt-otu-baly`,
        "x-default": `${siteUrl}/prohodnoj-ball-ent`,
      },
    },
    openGraph: {
      title: `ҰБТ өту балы — грантқа ЖОО және мамандықтар бойынша`,
      description: `${LATEST_YEAR} жылғы нақты өту балдары: ${universitiesCount} ЖОО, ${programsCount} мамандық тобы.`,
      url: `${siteUrl}/ubt-otu-baly`,
      siteName: "mytest",
      locale: "kk_KZ",
      images: OG_IMAGES,
    },
  }
}

export default async function UbtOtuBalyPage() {
  const data = await loadGrantData()
  const LATEST_YEAR = data.latestYear
  const NEXT_YEAR = data.nextYear
  const universitiesCount = data.listUniversities().length
  const programsCount = data.listPrograms().length
  const summary = data.nationalSummary()
  const top = summary.maxCutoff ? data.getProgramByCode(summary.maxCutoff.programCode) : null

  const faq = [
    {
      q: "ҰБТ өту балы дегеніміз не?",
      a: "Өту балы — белгілі бір ЖОО-ның белгілі бір мамандығына (білім беру бағдарламаларының тобына) грант алған үміткерлердің ішіндегі ең төменгі ҰБТ балы. Ол алдын ала жарияланбайды: конкурс нәтижесінде, яғни сол жылы қанша адам қандай балмен өтінім бергеніне қарай анықталады.",
    },
    {
      q: "Өту балы мен шекті балдың айырмашылығы неде?",
      a: "Шекті балл — грант конкурсына қатысуға және ЖОО-ға құжат тапсыруға рұқсат беретін ең төменгі балл, ол әр пән бойынша да белгіленеді. Өту балы — нақты конкурста грант жеңіп алғандардың ең төменгі балы. Шекті балдан өту грант алуға кепілдік бермейді.",
    },
    {
      q: "Грантқа қанша балл керек?",
      a: `${LATEST_YEAR} жылы барлық ЖОО мен мамандықтар бойынша медианалық өту балы — ${summary.medianMin ?? "—"}. ${top && summary.maxCutoff ? `Ең жоғары өту балы — ${summary.maxCutoff.latest.min} («${programName(top, "kk")}»). ` : ""}Нақты мамандық пен ЖОО бойынша балдарды осы беттегі кестелерден қараңыз.`,
    },
    {
      q: "Ауыл квотасы дегеніміз не?",
      a: "Гранттардың 35%-ы ауыл мектептерінің түлектеріне арналған жеке конкурсқа бөлінеді. Ауыл жастары екі конкурсқа да қатысады, сондықтан олар үшін өту балы көбіне төменірек болады. Кестелерде ауыл квотасының өту балы бөлек көрсетілген.",
    },
    {
      q: `${NEXT_YEAR} жылғы өту балы қандай болады?`,
      a: `${NEXT_YEAR} жылғы балдар конкурстан кейін ғана белгілі болады. Бағдар ретінде соңғы жылдардың балдарын алып, 3–5 балл қор қосыңыз. Қазіргі деңгейіңізді білу үшін my-test.kz-те ҰБТ сынағын тегін тапсырыңыз.`,
    },
  ]
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }

  return (
    <SeoShell lang="kk" alternate={{ href: "/prohodnoj-ball-ent" }} crumbs={[{ name: "ҰБТ өту балдары", href: "/ubt-otu-baly" }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <main>
        <section className="border-b border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              ҚР ҒЖБМ деректері · {LATEST_YEAR}
            </p>
            <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              ҰБТ өту балы — грантқа <span className="text-accent">ЖОО және мамандықтар</span> бойынша
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">
              {LATEST_YEAR} жылы {universitiesCount} ЖОО-ға {programsCount} білім беру бағдарламаларының тобы бойынша{" "}
              {summary.grants.toLocaleString("ru-RU")} грант берілді. Төменде — грант иегерлерінің ресми тізімдерінен
              есептелген нақты өту балдары: әр мамандық пен әр ЖОО бойынша, ауыл квотасымен және жылдар бойынша
              өзгерісімен. {NEXT_YEAR} жылы түсетіндер үшін — сенімді бағдар.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login?source=seo-kk-hub"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                <Gift className="size-4" />
                Балыңды тексер — ҰБТ сынағы тегін
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/admission"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                <Calculator className="size-4" />
                Грант мүмкіндігін есептеу
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Өту балы, шекті балл және ауыл квотасы</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Шекті балл",
                text: "Конкурсқа қатысуға рұқсат беретін ең төменгі балл. Әр пән бойынша да шек бар — бір пәннен құласаңыз, жалпы балл жоғары болса да конкурсқа қатыса алмайсыз.",
              },
              {
                title: "Өту балы",
                text: "Нақты конкурста грант алғандардың ең төменгі балы. Жыл сайын үміткерлер санына қарай өзгереді, сондықтан соңғы бірнеше жылдың деректерін қараған дұрыс.",
              },
              {
                title: "Ауыл квотасы",
                text: "Гранттардың 35%-ы ауыл мектептерінің түлектеріне бөлінеді. Ауыл жастары жалпы конкурсқа да қатысады, яғни екі конкурста бақ сынайды.",
              },
            ].map((card) => (
              <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                <p className="font-semibold">{card.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Өз балдарыңызбен қай мамандыққа түсуге болатынын{" "}
              <Link href="/admission" className="font-medium text-foreground underline underline-offset-4">
                грант мүмкіндігінің калькуляторынан
              </Link>{" "}
              біліңіз, ал ҰБТ-ның толық форматын{" "}
              <Link href="/uat" className="font-medium text-foreground underline underline-offset-4">
                тегін ҰБТ сынағында
              </Link>{" "}
              байқап көріңіз.
            </span>
          </p>
        </section>

        <GrantHubDirectory data={data} lang="kk" />

        <section className="mx-auto max-w-4xl px-4 pb-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Жиі қойылатын сұрақтар</h2>
          <div className="mt-5 divide-y divide-border rounded-xl border border-border bg-card">
            {faq.map((item) => (
              <details key={item.q} className="p-5">
                <summary className="cursor-pointer list-none font-medium">{item.q}</summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </SeoShell>
  )
}

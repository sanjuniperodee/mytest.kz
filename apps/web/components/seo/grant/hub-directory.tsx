import Link from "next/link"
import { programName, universityName, type GrantData, type SeoLang } from "@/lib/seo/grant-cutoffs"
import { GRANT_ROUTES } from "@/lib/seo/grant-routes"

const tx = (lang: SeoLang, ru: string, kk: string) => (lang === "kk" ? kk : ru)

/**
 * Реальные проходные баллы для хаб-страниц: все группы программ и все вузы со
 * ссылками на их страницы. Это и контент по запросу «проходной балл ЕНТ», и
 * точка входа краулера во все программные страницы.
 */
export function GrantHubDirectory({ data, lang }: { data: GrantData; lang: SeoLang }) {
  const routes = GRANT_ROUTES[lang]
  const LATEST_YEAR = data.latestYear
  const programs = data.programOverview().sort((a, b) => b.grants - a.grants)
  const universities = data.universityOverview().sort((a, b) => b.grants - a.grants)

  return (
    <>
      <section id="specialnosti" className="border-y border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {tx(lang, `Проходные баллы на грант по специальностям — ${LATEST_YEAR}`, `Мамандықтар бойынша грантқа өту балдары — ${LATEST_YEAR}`)}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {tx(
              lang,
              "Реальные данные по официальным спискам грантников МНВО РК. «От» — самый низкий проходной балл среди вузов, медиана — типичный балл по стране. Нажмите на группу, чтобы увидеть баллы по каждому вузу.",
              "ҚР ҒЖБМ грант иегерлерінің ресми тізімдері бойынша нақты деректер. «Бастап» — ЖОО-лар арасындағы ең төменгі өту балы, медиана — ел бойынша әдеттегі балл. Әр ЖОО бойынша балдарды көру үшін топты басыңыз.",
            )}
          </p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-3 font-medium sm:px-4">{tx(lang, "Группа образовательных программ", "Білім беру бағдарламаларының тобы")}</th>
                  <th className="px-2 py-3 text-right sm:px-3 font-medium">{tx(lang, "Балл от", "Балл, бастап")}</th>
                  <th className="px-2 py-3 text-right sm:px-3 font-medium">{tx(lang, "Медиана", "Медиана")}</th>
                  <th className="px-2 py-3 text-right sm:px-3 font-medium">{tx(lang, "Грантов", "Грант")}</th>
                  <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">{tx(lang, "Вузов", "ЖОО")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {programs.map(({ program, lowest, median, grants, universities: count }) => (
                  <tr key={program.code} className="transition-colors hover:bg-secondary/30">
                    <td className="px-3 py-3 sm:px-4">
                      <Link href={routes.program(program.slug)} className="font-medium hover:underline">
                        {programName(program, lang)}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{program.code}</span>
                    </td>
                    <td className="px-2 py-3 text-right sm:px-3 font-semibold tabular-nums">{lowest}</td>
                    <td className="px-2 py-3 text-right sm:px-3 tabular-nums text-muted-foreground">{median}</td>
                    <td className="px-2 py-3 text-right sm:px-3 tabular-nums">{grants.toLocaleString("ru-RU")}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="vuzy" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {tx(lang, `Проходные баллы по вузам Казахстана — ${LATEST_YEAR}`, `Қазақстан ЖОО-лары бойынша өту балдары — ${LATEST_YEAR}`)}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {tx(
            lang,
            "Диапазон проходных баллов по всем специальностям вуза и число грантов в общем конкурсе.",
            "ЖОО-ның барлық мамандықтары бойынша өту балдарының аралығы және жалпы конкурстағы гранттар саны.",
          )}
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {universities.map(({ university, lowest, highest, grants }) => (
            <li key={university.code}>
              <Link
                href={routes.university(university.slug)}
                className="flex h-full items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary/50"
              >
                <span className="font-medium">{universityName(university, lang)}</span>
                <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {lowest}–{highest}
                  <br />
                  {tx(lang, `${grants.toLocaleString("ru-RU")} гр.`, `${grants.toLocaleString("ru-RU")} грант`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

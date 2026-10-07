import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { ProgramCutoffsPage, programMetadata } from "@/components/seo/grant/cutoff-pages"
import { loadGrantData } from "@/lib/seo/grant-cutoffs"
import { GRANT_ROUTES } from "@/lib/seo/grant-routes"

// Данные — прод API (снимок при недоступности); страницы обновляются раз в 6 часов,
// новые группы программ после сборки рендерятся по первому запросу.
export const revalidate = 21600
export const dynamicParams = true

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const data = await loadGrantData()
  return data.listPrograms().map((item) => ({ slug: item.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadGrantData()
  const program = data.findProgram((await params).slug)
  return program ? programMetadata(data, program, "kk") : {}
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  const data = await loadGrantData()
  const program = data.findProgram(slug)
  if (!program) notFound()
  // Адрес держится на коде: если название поменялось, старый слаг ведёт на новый (301).
  if (program.slug !== slug) permanentRedirect(GRANT_ROUTES.kk.program(program.slug))
  return <ProgramCutoffsPage data={data} program={program} lang="kk" />
}

import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { UniversityCutoffsPage, universityMetadata } from "@/components/seo/grant/cutoff-pages"
import { loadGrantData } from "@/lib/seo/grant-cutoffs"
import { GRANT_ROUTES } from "@/lib/seo/grant-routes"

// Данные — прод API (снимок при недоступности); страницы обновляются раз в 6 часов,
// новые вузы после сборки рендерятся по первому запросу.
export const revalidate = 21600
export const dynamicParams = true

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const data = await loadGrantData()
  return data.listUniversities().map((item) => ({ slug: item.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadGrantData()
  const university = data.findUniversity((await params).slug)
  return university ? universityMetadata(data, university, "kk") : {}
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  const data = await loadGrantData()
  const university = data.findUniversity(slug)
  if (!university) notFound()
  // Адрес держится на коде: если название поменялось, старый слаг ведёт на новый (301).
  if (university.slug !== slug) permanentRedirect(GRANT_ROUTES.kk.university(university.slug))
  return <UniversityCutoffsPage data={data} university={university} lang="kk" />
}

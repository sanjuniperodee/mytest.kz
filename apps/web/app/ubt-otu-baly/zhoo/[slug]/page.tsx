import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { UniversityCutoffsPage, universityMetadata } from "@/components/seo/grant/cutoff-pages"
import { getUniversity, listUniversities } from "@/lib/seo/grant-cutoffs"

// Все страницы собираются при билде из снимка данных; неизвестный slug — 404.
export const dynamicParams = false

export function generateStaticParams() {
  return listUniversities().map((u) => ({ slug: u.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const university = getUniversity((await params).slug)
  return university ? universityMetadata(university, "kk") : {}
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const university = getUniversity((await params).slug)
  if (!university) notFound()
  return <UniversityCutoffsPage university={university} lang="kk" />
}

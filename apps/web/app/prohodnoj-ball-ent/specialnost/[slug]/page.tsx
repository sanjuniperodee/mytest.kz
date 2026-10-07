import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ProgramCutoffsPage, programMetadata } from "@/components/seo/grant/cutoff-pages"
import { getProgram, listPrograms } from "@/lib/seo/grant-cutoffs"

// Все страницы собираются при билде из снимка данных; неизвестный slug — 404.
export const dynamicParams = false

export function generateStaticParams() {
  return listPrograms().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const program = getProgram((await params).slug)
  return program ? programMetadata(program, "ru") : {}
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const program = getProgram((await params).slug)
  if (!program) notFound()
  return <ProgramCutoffsPage program={program} lang="ru" />
}

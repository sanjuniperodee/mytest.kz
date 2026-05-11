import type { Metadata } from "next"
import { LegalShell } from "@/components/legal/legal-shell"
import { MarkdownIshDocument } from "@/components/legal/markdown-ish-document"
import { buildSupportMarkdown } from "@/lib/legal-content"
import { getSiteUrl } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  return {
    title: "Поддержка",
    description: "Связаться с поддержкой mytest и My Test.",
    alternates: { canonical: `${siteUrl}/support` },
    openGraph: {
      title: "Поддержка | mytest",
      url: `${siteUrl}/support`,
      type: "website",
    },
  }
}

export default function SupportPage() {
  const siteUrl = getSiteUrl()
  return (
    <LegalShell title="Поддержка">
      <MarkdownIshDocument source={buildSupportMarkdown(siteUrl)} />
    </LegalShell>
  )
}

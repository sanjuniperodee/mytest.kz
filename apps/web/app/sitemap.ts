import type { MetadataRoute } from "next"
import { ENT_SUBJECT_SLUGS } from "@/lib/ent-subjects"
import { loadGrantData } from "@/lib/seo/grant-cutoffs"
import { GRANT_ROUTES } from "@/lib/seo/grant-routes"

// Список страниц с баллами берётся из прод API — обновляем вместе с ними.
export const revalidate = 21600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await loadGrantData()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/admission`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/payment`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/mobile`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ]

  // SEO landing pages for ENT subject preparation — high-volume search queries
  const subjectRoutes: MetadataRoute.Sitemap = ENT_SUBJECT_SLUGS.map((slug) => ({
    url: `${baseUrl}/ent/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  // Only years with a real route under app/ent-<year>. /ent-2026 is a
  // permanent redirect to /ent-2027 (next.config.mjs), so it is not listed.
  const yearRoutes: MetadataRoute.Sitemap = ["2027"].map((year) => ({
    url: `${baseUrl}/ent-${year}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }))

  // High-priority SEO landing pages targeting specific query clusters
  const seoLandingRoutes: MetadataRoute.Sitemap = [
    // Russian query cluster: "пробный ент", "пробник ент", "ент тест онлайн"
    { url: `${baseUrl}/probnyy-ent`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    // Kazakh query cluster: "ҰБТ дайындық", "тегін ҰБТ", "ҰБТ онлайн"
    { url: `${baseUrl}/uat`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    // Russian query cluster: "подготовка к ент", "как подготовиться к ент"
    { url: `${baseUrl}/podgotovka-k-ent`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    // Russian query cluster: "проходной балл ент", "пороговый балл ент", "сколько нужно для гранта"
    { url: `${baseUrl}/prohodnoj-ball-ent`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    // Kazakh query cluster: "ҰБТ өту балы", "грантқа өту балы"
    { url: `${baseUrl}/ubt-otu-baly`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
  ]

  // Real grant cutoffs per university / program group, RU + KK pairs (hreflang).
  // lastModified = when the official grant data was last imported, not the build time.
  const dataUpdated = new Date(data.updatedAt)
  const pair = (ru: string, kk: string, priority: number): MetadataRoute.Sitemap =>
    [ru, kk].map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: dataUpdated,
      changeFrequency: "monthly" as const,
      priority,
      alternates: { languages: { ru: `${baseUrl}${ru}`, kk: `${baseUrl}${kk}` } },
    }))
  const cutoffRoutes: MetadataRoute.Sitemap = [
    ...data.listUniversities().flatMap((u) =>
      pair(GRANT_ROUTES.ru.university(u.slug), GRANT_ROUTES.kk.university(u.slug), 0.7),
    ),
    ...data.listPrograms().flatMap((p) =>
      pair(GRANT_ROUTES.ru.program(p.slug), GRANT_ROUTES.kk.program(p.slug), 0.7),
    ),
  ]

  return [...staticRoutes, ...seoLandingRoutes, ...yearRoutes, ...subjectRoutes, ...cutoffRoutes]
}

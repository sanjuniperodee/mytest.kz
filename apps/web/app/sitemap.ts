import type { MetadataRoute } from "next"
import { ENT_SUBJECT_SLUGS } from "@/lib/ent-subjects"
import { loadGrantData } from "@/lib/seo/grant-cutoffs"
import { GRANT_ROUTES } from "@/lib/seo/grant-routes"
import { listPracticeTopics, PRACTICE_UPDATED_AT } from "@/lib/seo/practice-tests"

// Список страниц с баллами берётся из прод API — обновляем вместе с ними.
export const revalidate = 21600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await loadGrantData()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/admission`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/payment`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/mobile`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/support`, changeFrequency: "monthly", priority: 0.5 },
  ]

  // SEO landing pages for ENT subject preparation — high-volume search queries
  const subjectRoutes: MetadataRoute.Sitemap = ENT_SUBJECT_SLUGS.map((slug) => ({
    url: `${baseUrl}/ent/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  // Only years with a real route under app/ent-<year>. /ent-2026 is a
  // permanent redirect to /ent-2027 (next.config.mjs), so it is not listed.
  const yearRoutes: MetadataRoute.Sitemap = ["2027"].map((year) => ({
    url: `${baseUrl}/ent-${year}`,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }))

  // High-priority SEO landing pages targeting specific query clusters
  const seoLandingRoutes: MetadataRoute.Sitemap = [
    // Russian query cluster: "пробный ент", "пробник ент", "ент тест онлайн"
    { url: `${baseUrl}/probnyy-ent`, changeFrequency: "weekly", priority: 1.0 },
    // Kazakh query cluster: "ҰБТ дайындық", "тегін ҰБТ", "ҰБТ онлайн"
    { url: `${baseUrl}/uat`, changeFrequency: "weekly", priority: 1.0 },
    // Russian query cluster: "подготовка к ент", "как подготовиться к ент"
    { url: `${baseUrl}/podgotovka-k-ent`, changeFrequency: "weekly", priority: 0.95 },
    // Russian query cluster: "проходной балл ент", "пороговый балл ент", "сколько нужно для гранта"
    { url: `${baseUrl}/prohodnoj-ball-ent`, changeFrequency: "weekly", priority: 0.95 },
    // Kazakh query cluster: "ҰБТ өту балы", "грантқа өту балы"
    { url: `${baseUrl}/ubt-otu-baly`, changeFrequency: "weekly", priority: 0.95 },
  ]

  // Open topic tests (questions with answers). lastModified = when the snapshot of
  // the question banks was rebuilt. Landing pages above carry no lastModified: it
  // used to be the request time, which only teaches Google to ignore the field.
  const practiceUpdated = new Date(PRACTICE_UPDATED_AT)
  const topicRoutes: MetadataRoute.Sitemap = listPracticeTopics().map(({ subject, topic }) => ({
    url: `${baseUrl}/ent/${subject}/${topic.slug}`,
    lastModified: practiceUpdated,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }))

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

  return [...staticRoutes, ...seoLandingRoutes, ...yearRoutes, ...subjectRoutes, ...topicRoutes, ...cutoffRoutes]
}

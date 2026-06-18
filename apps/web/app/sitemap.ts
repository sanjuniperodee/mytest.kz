import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/admission`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/payment`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ]

  // SEO landing pages for ENT subject preparation — high-volume search queries
  const subjectSlugs = [
    "matematika",
    "matematicheskaya-gramotnost",
    "istoriya-kazahstana",
    "geografiya",
    "biologiya",
    "himiya",
    "fizika",
    "informatika",
    "anglijskij-yazyk",
    "kazahskij-yazyk",
    "russkij-yazyk",
    "vsemirnaya-istoriya",
    "pravo",
  ]

  const subjectRoutes: MetadataRoute.Sitemap = subjectSlugs.map((slug) => ({
    url: `${baseUrl}/ent/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  const yearRoutes: MetadataRoute.Sitemap = ["2026", "2027"].map((year) => ({
    url: `${baseUrl}/ent-${year}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }))

  return [...staticRoutes, ...yearRoutes, ...subjectRoutes]
}

import type { SeoLang } from "./grant-cutoffs"

/** URL-схема страниц проходных баллов: русская ветка и её казахская пара (hreflang). */
export const GRANT_ROUTES: Record<
  SeoLang,
  { hub: string; university: (slug: string) => string; program: (slug: string) => string }
> = {
  ru: {
    hub: "/prohodnoj-ball-ent",
    university: (slug) => `/prohodnoj-ball-ent/vuz/${slug}`,
    program: (slug) => `/prohodnoj-ball-ent/specialnost/${slug}`,
  },
  kk: {
    hub: "/ubt-otu-baly",
    university: (slug) => `/ubt-otu-baly/zhoo/${slug}`,
    program: (slug) => `/ubt-otu-baly/mamandyk/${slug}`,
  },
}

export function otherLang(lang: SeoLang): SeoLang {
  return lang === "kk" ? "ru" : "kk"
}

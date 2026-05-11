/** Публичный origin сайта (для canonical, ссылок в юр. текстах). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (raw) return raw.replace(/\/+$/, "")
  return "https://my-test.kz"
}

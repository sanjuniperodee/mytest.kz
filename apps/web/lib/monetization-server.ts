const UPSTREAM = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.my-test.kz"
const CLIENT_RE = /^ca-pub-\d{10,20}$/

/**
 * AdSense publisher id из админки («Тарифы и доступ» → Реклама) для /ads.txt
 * (по нему же AdSense подтверждает сайт). Кэш 5 минут; при недоступном
 * API — null (ничего не публикуем, страницы не ломаются).
 */
export async function fetchAdsenseClientId(): Promise<string | null> {
  try {
    const res = await fetch(`${UPSTREAM}/api/v1/public/monetization`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ads?: { adsenseClientId?: unknown } }
    const clientId = data.ads?.adsenseClientId
    return typeof clientId === "string" && CLIENT_RE.test(clientId) ? clientId : null
  } catch {
    return null
  }
}

import type { BillingPlanDto, ParentReportDto, ParentReportLang } from "@bilimland/shared"

/**
 * Отчёт для родителей — только для серверных компонентов. Токен из ссылки уходит в API
 * как есть (подпись проверяет API); кэша нет — отчёт приватный и всегда свежий.
 */

const UPSTREAM = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.my-test.kz"
const TOKEN_RE = /^[A-Za-z0-9_-]{50}$/

export type ParentReportResult =
  | { status: "ok"; report: ParentReportDto }
  | { status: "not_found" }
  | { status: "unavailable" }

export async function fetchParentReport(
  token: string,
  lang: ParentReportLang,
  clientIp: string | null,
): Promise<ParentReportResult> {
  if (!TOKEN_RE.test(token)) return { status: "not_found" }
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": lang }
  // Лимит запросов в API считается по IP родителя, а не по IP сервера Next.
  if (clientIp) headers["X-Forwarded-For"] = clientIp
  try {
    const res = await fetch(
      `${UPSTREAM}/api/v1/public/parent-report/${encodeURIComponent(token)}?lang=${lang}`,
      { cache: "no-store", headers, signal: AbortSignal.timeout(6000) },
    )
    if (res.status === 404 || res.status === 400) return { status: "not_found" }
    if (!res.ok) return { status: "unavailable" }
    return { status: "ok", report: (await res.json()) as ParentReportDto }
  } catch {
    return { status: "unavailable" }
  }
}

/** Тарифы в продаже на языке отчёта; пустой список, если API недоступен. */
export async function fetchPlansForParents(lang: ParentReportLang): Promise<BillingPlanDto[]> {
  try {
    const res = await fetch(`${UPSTREAM}/api/v1/public/monetization?lang=${lang}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { plans?: BillingPlanDto[] }
    return Array.isArray(data.plans) ? data.plans.filter((p) => p && p.priceKzt > 0) : []
  } catch {
    return []
  }
}

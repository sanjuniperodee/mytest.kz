import type { ParentPayInfoDto } from "@bilimland/shared"

/**
 * «Оплатить за ученика» — только для серверных компонентов. Токен из ссылки уходит в API
 * как есть (подпись проверяет API); кэша нет — на странице живой статус платежа.
 */

import { apiInternalOrigin } from "@/lib/api-origin"

const TOKEN_RE = /^[A-Za-z0-9_-]{50}$/

export type ParentPayResult =
  | { status: "ok"; info: ParentPayInfoDto }
  | { status: "not_found" }
  | { status: "unavailable" }

export async function fetchParentPayInfo(token: string, clientIp: string | null): Promise<ParentPayResult> {
  if (!TOKEN_RE.test(token)) return { status: "not_found" }
  const headers: Record<string, string> = { Accept: "application/json" }
  // Лимит запросов в API считается по IP родителя, а не по IP сервера Next.
  if (clientIp) headers["X-Forwarded-For"] = clientIp
  try {
    const res = await fetch(`${apiInternalOrigin()}/api/v1/public/parent-pay/${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404 || res.status === 400) return { status: "not_found" }
    if (!res.ok) return { status: "unavailable" }
    return { status: "ok", info: (await res.json()) as ParentPayInfoDto }
  } catch {
    return { status: "unavailable" }
  }
}

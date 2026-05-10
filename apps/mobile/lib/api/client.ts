import { requireApiOrigin, getApiOrigin } from "@/lib/config"
import {
  Scope,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./storage"

const API_PREFIX = "/api/v1"

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  scope?: Scope
  auth?: boolean
  formData?: FormData
}

function buildUrl(path: string, query?: ApiOptions["query"]) {
  const origin = requireApiOrigin()
  const basePath = API_PREFIX + (path.startsWith("/") ? path : `/${path}`)
  const url = new URL(basePath, `${origin}/`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

let refreshInFlight: Promise<boolean> | null = null

async function refresh(scope: Scope): Promise<boolean> {
  const refreshToken = getRefreshToken(scope)
  if (!refreshToken) return false
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const res = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        await clearTokens(scope)
        return false
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string }
      await setTokens(scope, data)
      return true
    } catch {
      await clearTokens(scope)
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const scope: Scope = opts.scope ?? "user"
  const url = buildUrl(path, opts.query)
  const useAuth = opts.auth ?? Boolean(getAccessToken(scope))

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { ...(opts.headers || {}) }
    let body: BodyInit | undefined
    if (opts.formData) {
      body = opts.formData
    } else if (opts.body !== undefined) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json"
      body = JSON.stringify(opts.body)
    }
    if (useAuth) {
      const token = getAccessToken(scope)
      if (token) headers.Authorization = `Bearer ${token}`
    }
    return fetch(url, {
      method: opts.method || "GET",
      headers,
      body,
    })
  }

  let res = await doFetch()

  if (res.status === 401 && useAuth) {
    const ok = await refresh(scope)
    if (ok) {
      res = await doFetch()
    }
  }

  const contentType = res.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null)

  if (!res.ok) {
    const message =
      (isJson && payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : null) || res.statusText || "Request failed"
    throw new ApiError(res.status, message, payload)
  }

  return payload as T
}

export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return ""
  if (/^https?:\/\//i.test(path)) return path
  const origin = getApiOrigin()
  if (!origin) return path
  if (path.startsWith("/uploads")) {
    return `${origin}/api/media${path}`
  }
  return path.startsWith("/") ? `${origin}${path}` : `${origin}/${path}`
}

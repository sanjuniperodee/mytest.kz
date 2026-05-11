"use client"

import {
  Scope,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./storage"

const BASE = "/api/v1"

export class ApiError extends Error {
  status: number
  body: unknown
  /** Сервер может вернуть поле code (Nest HttpException payload). */
  code?: string
  constructor(status: number, message: string, body: unknown, code?: string) {
    super(message)
    this.status = status
    this.body = body
    this.code = code
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  scope?: Scope
  auth?: boolean // default: true if access token exists
  formData?: FormData
}

function buildUrl(path: string, query?: ApiOptions["query"]) {
  const url = new URL(BASE + (path.startsWith("/") ? path : `/${path}`), window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.pathname + url.search
}

let refreshInFlight: Promise<boolean> | null = null

async function refresh(scope: Scope): Promise<boolean> {
  const refreshToken = getRefreshToken(scope)
  if (!refreshToken) return false
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        credentials: "include",
      })
      if (!res.ok) {
        clearTokens(scope)
        return false
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string }
      setTokens(scope, data)
      return true
    } catch {
      clearTokens(scope)
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
      if (token) headers["Authorization"] = `Bearer ${token}`
    }
    return fetch(url, {
      method: opts.method || "GET",
      headers,
      body,
      credentials: "include",
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
    const bodyObj =
      isJson && payload !== null && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null
    const rawMsg = bodyObj?.message
    const message =
      typeof rawMsg === "string"
        ? rawMsg
        : Array.isArray(rawMsg)
          ? rawMsg.filter((x) => typeof x === "string").join(". ")
          : typeof rawMsg === "number"
            ? String(rawMsg)
            : res.statusText || "Request failed"
    const nested =
      rawMsg !== null &&
      typeof rawMsg === "object" &&
      !Array.isArray(rawMsg) &&
      "message" in (rawMsg as object)
        ? (rawMsg as { message?: string }).message
        : undefined
    const displayMessage = nested || message
    const code =
      typeof bodyObj?.code === "string"
        ? bodyObj.code
        : typeof (rawMsg as Record<string, unknown> | undefined)?.code === "string"
          ? String((rawMsg as Record<string, unknown>).code)
          : undefined
    throw new ApiError(res.status, displayMessage, payload, code)
  }

  return payload as T
}

// Resolve /uploads/... media paths against the API origin
export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return ""
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith("/uploads")) {
    // route through proxy origin so cookies/CORS are not an issue
    return `/api/media${path}`
  }
  return path
}

// Token storage. Mirrors Bilimland frontend keys.

const KEYS = {
  user: { access: "accessToken", refresh: "refreshToken" },
  admin: { access: "admin_accessToken", refresh: "admin_refreshToken" },
} as const

export type Scope = keyof typeof KEYS

export function getAccessToken(scope: Scope = "user"): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(KEYS[scope].access)
}

export function getRefreshToken(scope: Scope = "user"): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(KEYS[scope].refresh)
}

export function setTokens(
  scope: Scope,
  tokens: { accessToken: string; refreshToken: string },
) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEYS[scope].access, tokens.accessToken)
  window.localStorage.setItem(KEYS[scope].refresh, tokens.refreshToken)
}

export function clearTokens(scope: Scope = "user") {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEYS[scope].access)
  window.localStorage.removeItem(KEYS[scope].refresh)
}

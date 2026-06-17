// Access tokens live only in memory. Legacy localStorage keys are read once for
// migration and then removed.

const KEYS = {
  user: { access: "accessToken", refresh: "refreshToken" },
  admin: { access: "admin_accessToken", refresh: "admin_refreshToken" },
} as const

export type Scope = keyof typeof KEYS
const accessTokens: Record<Scope, string | null> = { user: null, admin: null }

export function getAccessToken(scope: Scope = "user"): string | null {
  if (accessTokens[scope]) return accessTokens[scope]
  if (typeof window === "undefined") return null
  const legacy = window.localStorage.getItem(KEYS[scope].access)
  if (legacy) {
    accessTokens[scope] = legacy
    window.localStorage.removeItem(KEYS[scope].access)
  }
  return accessTokens[scope]
}

export function getRefreshToken(scope: Scope = "user"): string | null {
  if (typeof window === "undefined") return null
  // Only legacy sessions have a refresh token here. New web sessions rely on
  // the httpOnly cookie set by the API.
  return window.localStorage.getItem(KEYS[scope].refresh)
}

export function setTokens(
  scope: Scope,
  tokens: { accessToken: string; refreshToken?: string },
) {
  accessTokens[scope] = tokens.accessToken
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEYS[scope].access)
  window.localStorage.removeItem(KEYS[scope].refresh)
}

export function clearTokens(scope: Scope = "user") {
  accessTokens[scope] = null
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEYS[scope].access)
  window.localStorage.removeItem(KEYS[scope].refresh)
}

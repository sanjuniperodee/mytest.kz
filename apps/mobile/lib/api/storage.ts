import * as SecureStore from "expo-secure-store"

const KEYS = {
  user: { access: "accessToken", refresh: "refreshToken" },
  admin: { access: "admin_accessToken", refresh: "admin_refreshToken" },
} as const

export type Scope = keyof typeof KEYS

type Cache = { access: string | null; refresh: string | null }

const cache: Record<Scope, Cache> = {
  user: { access: null, refresh: null },
  admin: { access: null, refresh: null },
}

export async function hydrateTokens(scope: Scope = "user"): Promise<void> {
  const k = KEYS[scope]
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(k.access),
    SecureStore.getItemAsync(k.refresh),
  ])
  cache[scope].access = access
  cache[scope].refresh = refresh
}

export function getAccessToken(scope: Scope = "user"): string | null {
  return cache[scope].access
}

export function getRefreshToken(scope: Scope = "user"): string | null {
  return cache[scope].refresh
}

export async function setTokens(
  scope: Scope,
  tokens: { accessToken: string; refreshToken: string },
) {
  const k = KEYS[scope]
  await SecureStore.setItemAsync(k.access, tokens.accessToken)
  await SecureStore.setItemAsync(k.refresh, tokens.refreshToken)
  cache[scope].access = tokens.accessToken
  cache[scope].refresh = tokens.refreshToken
}

export async function clearTokens(scope: Scope = "user") {
  const k = KEYS[scope]
  await SecureStore.deleteItemAsync(k.access).catch(() => {})
  await SecureStore.deleteItemAsync(k.refresh).catch(() => {})
  cache[scope].access = null
  cache[scope].refresh = null
}

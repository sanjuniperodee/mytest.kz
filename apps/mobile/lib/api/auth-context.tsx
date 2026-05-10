import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { api } from "./client"
import { Scope, clearTokens, getAccessToken, hydrateTokens, setTokens } from "./storage"
import type { AuthResponse, User } from "./types"

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  scope: Scope
  signOut: () => void
  setSession: (data: AuthResponse) => Promise<void>
  refresh: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  scope = "user",
}: {
  children: ReactNode
  scope?: Scope
}) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setLoading] = useState(true)

  const loadCurrentUser = useCallback(async (): Promise<User | null> => {
    const token = getAccessToken(scope)
    if (!token) {
      setUser(null)
      return null
    }
    try {
      const me = await api<User>("/users/me", { scope })
      setUser(me)
      return me
    } catch {
      await clearTokens(scope)
      setUser(null)
      return null
    }
  }, [scope])

  useEffect(() => {
    let cancelled = false

    async function bootstrapSession() {
      setLoading(true)
      try {
        await hydrateTokens(scope)
        if (!cancelled) await loadCurrentUser()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrapSession()

    return () => {
      cancelled = true
    }
  }, [loadCurrentUser, scope])

  const setSession = useCallback(
    async (data: AuthResponse) => {
      await setTokens(scope, data)
      setUser(data.user)
      setLoading(false)
    },
    [scope],
  )

  const signOut = useCallback(async () => {
    await clearTokens(scope)
    setUser(null)
    setLoading(false)
  }, [scope])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      return await loadCurrentUser()
    } finally {
      setLoading(false)
    }
  }, [loadCurrentUser])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      scope,
      signOut,
      setSession,
      refresh,
    }),
    [user, isLoading, scope, signOut, setSession, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

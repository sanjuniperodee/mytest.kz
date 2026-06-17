"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useSWRConfig } from "swr"
import { ApiError, api, invalidateAuthScope } from "./client"
import {
  Scope,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./storage"
import { prepareTelegramWebApp, waitForTelegramInitData } from "@/lib/telegram-webapp"
import type { AuthResponse, User } from "./types"

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  scope: Scope
  signOut: () => void
  setSession: (data: AuthResponse) => void
  refresh: (options?: { silent?: boolean }) => Promise<User | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  scope = "user",
}: {
  children: React.ReactNode
  scope?: Scope
}) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setLoading] = useState(true)
  const { mutate } = useSWRConfig()

  const clearUserCache = useCallback(() => {
    void mutate(() => true, undefined, { revalidate: false })
  }, [mutate])

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
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        invalidateAuthScope(scope)
        clearTokens(scope)
        clearUserCache()
        setUser(null)
      }
      return null
    }
  }, [clearUserCache, scope])

  useEffect(() => {
    let cancelled = false

    async function bootstrapSession() {
      setLoading(true)
      try {
        const profile = await loadCurrentUser()
        if (cancelled || profile) return

        const initData = await waitForTelegramInitData()
        if (cancelled || !initData) return

        prepareTelegramWebApp()
        try {
          const data = await api<AuthResponse>("/auth/telegram", {
            method: "POST",
            auth: false,
            body: { initData },
          })
          if (cancelled) return
          setTokens(scope, data)
          setUser(data.user)
        } catch {
          if (!cancelled) setUser(null)
        }
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
    (data: AuthResponse) => {
      invalidateAuthScope(scope)
      clearUserCache()
      setTokens(scope, data)
      setUser(data.user)
      setLoading(false)
    },
    [clearUserCache, scope],
  )

  const signOut = useCallback(() => {
    const refreshToken = getRefreshToken(scope)
    if (refreshToken) {
      void api("/auth/logout", {
        method: "POST",
        auth: false,
        body: { refreshToken },
      }).catch(() => null)
    }
    invalidateAuthScope(scope)
    clearTokens(scope)
    clearUserCache()
    setUser(null)
    setLoading(false)
  }, [clearUserCache, scope])

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    try {
      return await loadCurrentUser()
    } finally {
      if (!options?.silent) setLoading(false)
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

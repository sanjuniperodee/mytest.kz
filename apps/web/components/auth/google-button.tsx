"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import type { AuthResponse } from "@/lib/api/types"

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (
            el: HTMLElement,
            options: { theme?: string; size?: string; width?: number; type?: string; text?: string },
          ) => void
        }
      }
    }
  }
}

export function GoogleButton() {
  const router = useRouter()
  const { setSession } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const handleCredential = async (credential: string) => {
    try {
      const data = await api<AuthResponse>("/auth/google", {
        method: "POST",
        auth: false,
        body: { credential },
      })
      setSession(data)
      toast.success("Вы вошли через Google")
      router.replace("/dashboard")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Не удалось войти через Google"
      toast.error(msg)
    }
  }

  useEffect(() => {
    if (!clientId || !containerRef.current) return
    const interval = setInterval(() => {
      if (window.google && containerRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => handleCredential(resp.credential),
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          type: "standard",
          text: "continue_with",
        })
        clearInterval(interval)
      }
    }, 200)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        className="h-11 w-full rounded-md border border-border bg-muted text-sm text-muted-foreground flex items-center justify-center gap-2"
      >
        Google вход недоступен (нет client ID)
      </button>
    )
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <div ref={containerRef} className="flex justify-center" />
    </>
  )
}

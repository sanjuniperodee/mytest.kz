"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { getTelegramBotUsername } from "@/lib/telegram"
import type { AuthResponse } from "@/lib/api/types"

interface TgUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export function TelegramButton() {
  const router = useRouter()
  const { setSession } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const botUsername = getTelegramBotUsername()

  useEffect(() => {
    if (!containerRef.current) return

    // Telegram widget calls window.<callbackName>
    ;(window as unknown as Record<string, (u: TgUser) => void>).onTelegramAuth = async (u: TgUser) => {
      try {
        // Build initData-like query string from received user
        const params = new URLSearchParams()
        for (const [k, v] of Object.entries(u)) {
          if (v !== undefined && v !== null) params.set(k, String(v))
        }
        const data = await api<AuthResponse>("/auth/telegram", {
          method: "POST",
          auth: false,
          body: { initData: params.toString() },
        })
        setSession(data)
        toast.success("Вы вошли через Telegram")
        router.replace("/dashboard")
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Не удалось войти через Telegram"
        toast.error(msg)
      }
    }

    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.async = true
    script.setAttribute("data-telegram-login", botUsername)
    script.setAttribute("data-size", "large")
    script.setAttribute("data-radius", "8")
    script.setAttribute("data-onauth", "onTelegramAuth(user)")
    script.setAttribute("data-request-access", "write")
    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botUsername])

  return <div ref={containerRef} className="flex justify-center" />
}

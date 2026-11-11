"use client"

import { loginDestination } from "@/lib/api/login-return"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import type { AuthResponse } from "@/lib/api/types"

/**
 * Sign-in with a code mailed to the address, for accounts made through the closed email signup
 * (12 May – 17 June 2026) whose address cannot be used with Google. It is a way back, not a way to
 * register: an address without an account gets no mail. Shown only while the API has it switched on.
 */
export function EmailCodeLogin() {
  const router = useRouter()
  const { setSession } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<{ enabled: boolean }>("/auth/email/status", { auth: false })
      .then((status) => {
        if (!cancelled) setEnabled(status.enabled === true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!enabled) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 block w-full text-center text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        Регистрировались по email? Войти по коду из письма
      </button>
    )
  }

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed.includes("@")) {
      toast.error("Введите email")
      return
    }
    setLoading(true)
    try {
      await api("/auth/email/request-code", {
        method: "POST",
        auth: false,
        body: { email: trimmed },
      })
      setEmail(trimmed)
      setCode("")
      setStep("code")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось отправить код")
    } finally {
      setLoading(false)
    }
  }

  const verify = async (otp: string) => {
    setLoading(true)
    try {
      const data = await api<AuthResponse>("/auth/email/verify-code", {
        method: "POST",
        auth: false,
        body: { email, code: otp },
      })
      setSession(data)
      toast.success("Добро пожаловать!")
      router.replace(loginDestination())
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Неверный код")
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4">
      {step === "code" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Если аккаунт с адресом <span className="font-medium text-foreground">{email}</span> есть, мы
            отправили на него код. Проверьте папку «Спам». Если входили через Google — нажмите кнопку
            Google.
          </p>
          <div className="flex flex-col items-center gap-3">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(value) => {
                setCode(value)
                if (value.length === 6) void verify(value)
              }}
              disabled={loading}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {loading && <Spinner className="size-5" />}
          </div>
          <button
            type="button"
            onClick={() => {
              setStep("email")
              setCode("")
            }}
            className="self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Изменить адрес или запросить код ещё раз
          </button>
        </div>
      ) : (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-code-email">Email, указанный при регистрации</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email-code-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 pl-9"
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="h-11">
            {loading ? (
              <Spinner className="size-4" />
            ) : (
              <>
                Получить код на почту
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Только для аккаунтов, созданных по email. Результаты сохранятся; на других устройствах
            придётся войти заново.
          </p>
        </form>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight, ExternalLink, MessageCircle, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { getTelegramBotLink, getTelegramBotUsername } from "@/lib/telegram"
import type { AuthResponse } from "@/lib/api/types"

function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "")
  let withCountry = digits
  if (digits.startsWith("8")) withCountry = "7" + digits.slice(1)
  if (!withCountry.startsWith("7")) withCountry = "7" + withCountry
  return "+" + withCountry.slice(0, 11)
}

function isPhoneNotLinkedError(err: unknown) {
  if (!(err instanceof ApiError)) return false
  return (
    err.message.includes("Номер не найден") ||
    err.message.includes("Пользователь не найден") ||
    err.message.includes("Откройте бота")
  )
}

export function PhoneForm() {
  const router = useRouter()
  const { setSession } = useAuth()
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [registrationPhone, setRegistrationPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const botUsername = getTelegramBotUsername()
  const botLink = getTelegramBotLink("web")

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const formatted = formatPhone(phone)
    if (formatted.length !== 12) {
      toast.error("Введите номер в формате +7XXXXXXXXXX")
      return
    }
    setLoading(true)
    try {
      await api("/auth/web/request-code", {
        method: "POST",
        auth: false,
        body: { phone: formatted },
      })
      setPhone(formatted)
      setRegistrationPhone(null)
      setStep("code")
      toast.success("Код отправлен в Telegram")
    } catch (err) {
      if (isPhoneNotLinkedError(err)) {
        setPhone(formatted)
        setRegistrationPhone(formatted)
        toast("Сначала привяжите номер в Telegram")
        return
      }
      const msg = err instanceof ApiError ? err.message : "Не удалось отправить код"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const verify = async (otp: string) => {
    setLoading(true)
    try {
      const data = await api<AuthResponse>("/auth/web/verify-code", {
        method: "POST",
        auth: false,
        body: { phone, code: otp },
      })
      setSession(data)
      toast.success("Добро пожаловать!")
      router.replace("/dashboard")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Неверный код"
      toast.error(msg)
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  if (step === "code") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-muted-foreground">
            Мы отправили код в Telegram для номера{" "}
            <span className="font-medium text-foreground">{phone}</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(value) => {
              setCode(value)
              if (value.length === 6) verify(value)
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
            setStep("phone")
            setCode("")
          }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          Изменить номер
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={sendCode} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Номер телефона</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="+7 700 000 00 00"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (registrationPhone) setRegistrationPhone(null)
            }}
            className="pl-9 h-11"
            autoComplete="tel"
            required
          />
        </div>
      </div>
      {registrationPhone && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex gap-3">
            <MessageCircle className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div className="space-y-3">
              <div>
                <p className="font-medium text-amber-950">Номер ещё не привязан</p>
                <p className="mt-1 text-amber-900">
                  Код приходит в Telegram, поэтому сначала нужно один раз привязать{" "}
                  <span className="font-medium">{registrationPhone}</span> в боте @{botUsername}.
                </p>
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-amber-900">
                <li>Откройте бота и нажмите «Запустить» или /start.</li>
                <li>Нажмите кнопку «Поделиться номером».</li>
                <li>Когда код придёт в Telegram, вернитесь сюда и введите его.</li>
              </ol>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                >
                  <a href={botLink} target="_blank" rel="noreferrer">
                    Открыть @{botUsername}
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPhone(registrationPhone)
                    setRegistrationPhone(null)
                    setCode("")
                    setStep("code")
                  }}
                >
                  Ввести код из Telegram
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Button type="submit" disabled={loading} className="h-11">
        {loading ? (
          <Spinner className="size-4" />
        ) : (
          <>
            {registrationPhone ? "Отправить новый код" : "Получить код"}
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Нажимая кнопку, вы соглашаетесь с условиями использования
      </p>
    </form>
  )
}

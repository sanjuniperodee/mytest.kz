"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError, api } from "@/lib/api/client"
import { cn } from "@/lib/utils"

const SETUP_SECRET_STORAGE_KEY = "kaspi-session-setup-secret"

export default function KaspiSetupPage() {
  const [setupSecret, setSetupSecret] = useState("")
  const [phone, setPhone] = useState("")
  const [processId, setProcessId] = useState<string | null>(null)
  const [otp, setOtp] = useState("")
  const [status, setStatus] = useState<{ configured: boolean; sessionActive: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SETUP_SECRET_STORAGE_KEY)
      if (saved) setSetupSecret(saved)
    } catch {
      /* ignore */
    }
  }, [])

  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {}
    const s = setupSecret.trim()
    if (s) h["X-Kaspi-Session-Setup-Secret"] = s
    return h
  }

  const persistSecret = () => {
    try {
      const s = setupSecret.trim()
      if (s) sessionStorage.setItem(SETUP_SECRET_STORAGE_KEY, s)
      else sessionStorage.removeItem(SETUP_SECRET_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  const refreshStatus = async () => {
    const s = setupSecret.trim()
    if (!s) {
      setError("Укажите секрет настройки")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ configured: boolean; sessionActive: boolean }>("/billing/kaspi/setup/status", {
        auth: false,
        headers: buildHeaders(),
      })
      setStatus(res)
    } catch (e) {
      setStatus(null)
      setError(e instanceof ApiError ? e.message : "Не удалось проверить статус")
    } finally {
      setLoading(false)
    }
  }

  const requestCode = async () => {
    const s = setupSecret.trim()
    if (!s) {
      setError("Укажите секрет настройки (KASPI_SESSION_SETUP_SECRET на сервере)")
      return
    }
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 10) {
      setError("Введите номер телефона кассира (Kaspi)")
      return
    }
    persistSecret()
    setLoading(true)
    setError(null)
    setSuccess(null)
    setProcessId(null)
    try {
      const res = await api<{ processId: string }>("/billing/kaspi/setup/request-code", {
        method: "POST",
        auth: false,
        headers: buildHeaders(),
        body: { phoneNumber: digits },
      })
      setProcessId(res.processId)
      setSuccess("Код отправлен. Введите OTP из SMS / приложения Kaspi.")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка запроса кода")
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    if (!processId?.trim()) {
      setError("Сначала запросите код")
      return
    }
    const code = otp.trim()
    if (code.length < 4) {
      setError("Введите код из SMS")
      return
    }
    persistSecret()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await api("/billing/kaspi/setup/verify-otp", {
        method: "POST",
        auth: false,
        headers: buildHeaders(),
        body: { processId, otp: code },
      })
      setSuccess("Сессия сохранена на сервере. Проверьте статус ниже.")
      setOtp("")
      await refreshStatus()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Неверный код или ошибка Kaspi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard/billing"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Тарифы
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Настройка Kaspi Pay</h1>
        <p className="text-sm text-muted-foreground">
          Одноразовый вход кассира через OTP. Секрет настройки не храните в публичных переменных — только в{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code> API и в этом поле при работе.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Секрет настройки</label>
            <Input
              type="password"
              autoComplete="off"
              placeholder="X-Kaspi-Session-Setup-Secret"
              value={setupSecret}
              onChange={(e) => setSetupSecret(e.target.value)}
              className={cn(error && !setupSecret.trim() && "border-red-500")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Телефон кассира</label>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="77001234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <Button type="button" onClick={requestCode} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Отправить код
          </Button>

          {processId && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">OTP</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Код из SMS"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" onClick={verifyOtp} disabled={loading}>
                Подтвердить и сохранить сессию
              </Button>
            </>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={refreshStatus} disabled={loading}>
              Проверить статус сессии
            </Button>
          </div>

          {status && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p>
                В памяти API:{" "}
                <span className="font-medium">{status.configured ? "да" : "нет"}</span>
              </p>
              <p>
                Kaspi session check:{" "}
                <span className="font-medium">{status.sessionActive ? "активна" : "не активна / ошибка"}</span>
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-700">{success}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

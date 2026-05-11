"use client"

import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { toast } from "sonner"
import { Camera, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/api/auth-context"
import { api, ApiError, resolveMediaUrl } from "@/lib/api/client"
import { localize, type Locale } from "@/lib/api/i18n"
import { useUiI18n } from "@/lib/i18n/ui"
import type { User } from "@/lib/api/types"

const TIMEZONES = [
  "Asia/Almaty",
  "Asia/Aqtau",
  "Asia/Aqtobe",
  "Asia/Atyrau",
  "Asia/Oral",
  "Asia/Qostanay",
  "Asia/Qyzylorda",
]
const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_AVATAR_BYTES = 3 * 1024 * 1024

export default function ProfilePage() {
  const { user, refresh } = useAuth()
  const { locale: uiLocale, setLocale } = useUiI18n()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [language, setLanguage] = useState<"ru" | "kk">(uiLocale)
  const [timezone, setTimezone] = useState("Asia/Almaty")
  const [saving, setSaving] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setLanguage(((user.preferredLanguage as "ru" | "kk") || uiLocale) === "kk" ? "kk" : "ru")
      setTimezone(user.timezone || "Asia/Almaty")
    }
  }, [uiLocale, user])

  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const firstLastName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
  const fullNameStr = firstLastName || localize(user?.fullName, locale)
  const displayName =
    fullNameStr || user?.telegramUsername || user?.username || user?.phone || "U"
  const initials = displayName.toString().slice(0, 2).toUpperCase()
  const avatarSrc = resolveMediaUrl(user?.avatarUrl)

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      toast.error("Загрузите изображение JPG, PNG или WebP")
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Аватарка должна быть меньше 3 МБ")
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    setAvatarSaving(true)
    try {
      await api<User>("/users/me/avatar", {
        method: "POST",
        formData,
      })
      await refresh()
      toast.success("Аватарка обновлена")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось загрузить аватарку")
    } finally {
      setAvatarSaving(false)
    }
  }

  const onDeleteAvatar = async () => {
    setAvatarSaving(true)
    try {
      await api<User>("/users/me/avatar", {
        method: "DELETE",
      })
      await refresh()
      toast.success("Аватарка удалена")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось удалить аватарку")
    } finally {
      setAvatarSaving(false)
    }
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const currentLanguage =
        ((user?.preferredLanguage as "ru" | "kk" | null | undefined) || uiLocale) === "kk"
          ? "kk"
          : "ru"
      const currentTimezone = user?.timezone || "Asia/Almaty"
      const body: { preferredLanguage?: "ru" | "kk"; timezone?: string } = {}
      if (language !== currentLanguage) body.preferredLanguage = language
      if (timezone !== currentTimezone) body.timezone = timezone

      if (Object.keys(body).length === 0) {
        await setLocale(language, { syncProfile: false })
        toast.success("Настройки сохранены")
        return
      }

      await api<User>("/users/me", {
        method: "PATCH",
        body,
      })
      await refresh()
      await setLocale(language, { syncProfile: false })
      toast.success("Настройки сохранены")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Профиль</h1>
        <p className="text-muted-foreground">Личные данные и настройки аккаунта</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Аккаунт</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative size-20 shrink-0">
              <Avatar className="size-20">
                <AvatarImage
                  src={avatarSrc}
                  alt={displayName === "U" ? "Пользователь" : displayName}
                />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              {avatarSaving && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                  <Spinner className="size-5" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-lg">
                  {displayName === "U" ? "Пользователь" : displayName}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {user?.phone || user?.telegramUsername || "—"}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={onAvatarChange}
                  aria-label="Загрузить аватарку"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarSaving}
                >
                  <Camera className="size-4" />
                  Загрузить фото
                </Button>
                {user?.avatarUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onDeleteAvatar}
                    disabled={avatarSaving}
                  >
                    <Trash2 className="size-4" />
                    Удалить
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG или WebP до 3 МБ.</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lang">Язык интерфейса</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as "ru" | "kk")}>
                <SelectTrigger id="lang">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="kk">Қазақша</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tz">Часовой пояс</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : "Сохранить"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

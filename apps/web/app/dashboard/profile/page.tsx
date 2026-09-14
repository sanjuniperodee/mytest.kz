"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Camera,
  Crown,
  Languages,
  Phone,
  Send,
  Settings2,
  Trash2,
  User2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { useAuth } from "@/lib/api/auth-context";
import { api, ApiError, resolveMediaUrl } from "@/lib/api/client";
import { localize, type Locale } from "@/lib/api/i18n";
import { useUiI18n } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/api/types";
import { ProfileActivity } from "@/components/social/people";

const TIMEZONES = [
  "Asia/Almaty",
  "Asia/Aqtau",
  "Asia/Aqtobe",
  "Asia/Atyrau",
  "Asia/Oral",
  "Asia/Qostanay",
  "Asia/Qyzylorda",
];
const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const { locale: uiLocale, setLocale } = useUiI18n();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState<"ru" | "kk">(uiLocale);
  const [timezone, setTimezone] = useState("Asia/Almaty");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setLanguage(
        ((user.preferredLanguage as "ru" | "kk") || uiLocale) === "kk"
          ? "kk"
          : "ru",
      );
      setTimezone(user.timezone || "Asia/Almaty");
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [uiLocale, user]);

  const locale = uiLocale;
  const firstLastName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const fullNameStr = firstLastName || localize(user?.fullName, locale);
  const displayName =
    fullNameStr ||
    user?.telegramUsername ||
    user?.username ||
    user?.phone ||
    "Пользователь";
  const initials = displayName.toString().slice(0, 2).toUpperCase();
  const avatarSrc = resolveMediaUrl(user?.avatarUrl);

  const hasPaid = Boolean(user?.hasActiveSubscription);
  const tariffName = localize(
    user?.currentTariff?.name,
    locale,
    hasPaid ? "Premium" : "Стартовый доступ",
  );
  const contact =
    user?.phone ||
    (user?.telegramUsername ? `@${user.telegramUsername}` : null);
  const memberSince = formatMemberSince(user?.createdAt, locale);

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      toast.error("Загрузите изображение JPG, PNG или WebP");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Аватарка должна быть меньше 3 МБ");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setAvatarSaving(true);
    try {
      await api<User>("/users/me/avatar", { method: "POST", formData });
      await refresh();
      toast.success("Аватарка обновлена");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось загрузить аватарку",
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  const onDeleteAvatar = async () => {
    setAvatarSaving(true);
    try {
      await api<User>("/users/me/avatar", { method: "DELETE" });
      await refresh();
      toast.success("Аватарка удалена");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось удалить аватарку",
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const currentLanguage =
        ((user?.preferredLanguage as "ru" | "kk" | null | undefined) ||
          uiLocale) === "kk"
          ? "kk"
          : "ru";
      const currentTimezone = user?.timezone || "Asia/Almaty";
      const body: {
        firstName?: string;
        lastName?: string;
        preferredLanguage?: "ru" | "kk";
        timezone?: string;
      } = {};
      if (firstName.trim() !== (user?.firstName || ""))
        body.firstName = firstName.trim();
      if (lastName.trim() !== (user?.lastName || ""))
        body.lastName = lastName.trim();
      if (language !== currentLanguage) body.preferredLanguage = language;
      if (timezone !== currentTimezone) body.timezone = timezone;

      if (Object.keys(body).length === 0) {
        await setLocale(language, { syncProfile: false });
        toast.success("Настройки сохранены");
        return;
      }

      await api<User>("/users/me", { method: "PATCH", body });
      await refresh();
      await setLocale(language, { syncProfile: false });
      toast.success("Настройки сохранены");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    user != null &&
    (firstName.trim() !== (user.firstName || "") ||
      lastName.trim() !== (user.lastName || "") ||
      language !==
        (((user.preferredLanguage as "ru" | "kk") || uiLocale) === "kk"
          ? "kk"
          : "ru") ||
      timezone !== (user.timezone || "Asia/Almaty"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Профиль"
        description="Личные данные и настройки аккаунта"
      />

      {/* Identity card */}
      <Card className="overflow-hidden py-0">
        {/* Top section: avatar + name */}
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <Avatar className="size-20 ring-2 ring-border shadow-sm">
              <AvatarImage
                src={avatarSrc}
                alt={
                  displayName === "Пользователь" ? "Пользователь" : displayName
                }
              />
              <AvatarFallback className="text-2xl font-semibold bg-secondary text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {avatarSaving && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                <Spinner className="size-5" />
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold leading-tight">
                {displayName}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  hasPaid
                    ? "bg-amber-100 text-amber-800"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                <Crown className="size-3" aria-hidden="true" />
                {tariffName}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {contact && (
                <span className="inline-flex items-center gap-1.5">
                  {user?.phone ? (
                    <Phone className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Send className="size-3.5" aria-hidden="true" />
                  )}
                  {contact}
                </span>
              )}
              {memberSince && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {memberSince}
                </span>
              )}
            </div>
          </div>
        </CardContent>

        {/* Avatar actions */}
        <CardFooter className="flex flex-col gap-2 border-t border-border bg-secondary/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User2 className="size-3.5" aria-hidden="true" />
            Фото профиля · JPG, PNG или WebP до 3 МБ
          </div>
          <div className="flex gap-2">
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
              size="sm"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarSaving}
            >
              <Camera className="size-4" aria-hidden="true" />
              {user?.avatarUrl ? "Заменить" : "Загрузить"}
            </Button>
            {user?.avatarUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDeleteAvatar}
                disabled={avatarSaving}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Удалить
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Preferences */}
      {user && (
        <section className="space-y-3">
          <Link
            href={`/dashboard/community/people/${user.id}`}
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
          >
            {uiLocale === "kk"
              ? "Қауымдастықтағы профиль және жазылушылар →"
              : "Профиль в сообществе и подписчики →"}
          </Link>
          <ProfileActivity userId={user.id} />
        </section>
      )}
      <Card className="py-0">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Настройки
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="first-name">Имя</Label>
              <Input
                id="first-name"
                value={firstName}
                maxLength={100}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="last-name">Фамилия</Label>
              <Input
                id="last-name"
                value={lastName}
                maxLength={100}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="lang"
                className="inline-flex items-center gap-1.5 text-sm"
              >
                <Languages
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                Язык интерфейса
              </Label>
              <Select
                value={language}
                onValueChange={(v) => setLanguage(v as "ru" | "kk")}
              >
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
              <Label
                htmlFor="tz"
                className="inline-flex items-center gap-1.5 text-sm"
              >
                <CalendarDays
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                Часовой пояс
              </Label>
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

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            {dirty && (
              <span className="text-xs text-muted-foreground">
                Есть несохранённые изменения
              </span>
            )}
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : "Сохранить"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatMemberSince(
  createdAt: string | null | undefined,
  locale: Locale,
): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString(
    locale === "kk" ? "kk-KZ" : "ru-RU",
    {
      month: "long",
      year: "numeric",
    },
  );
  return locale === "kk" ? `${formatted} бері` : `С ${formatted}`;
}

"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";
import { Camera, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonAvatar, useSocialText } from "@/components/social/common";
import { useAuth } from "@/lib/api/auth-context";
import { api, ApiError } from "@/lib/api/client";
import { useUiI18n } from "@/lib/i18n/ui";
import type { User } from "@/lib/api/types";

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

type Language = "ru" | "kk";

/** Account owner's editor for everything shown on (or behind) their profile. */
export function EditProfileDialog({
  onSaved,
}: {
  onSaved: () => void | Promise<unknown>;
}) {
  const { user, refresh } = useAuth();
  const { locale, setLocale } = useUiI18n();
  const t = useSocialText();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [language, setLanguage] = useState<Language>(locale);
  const [timezone, setTimezone] = useState("Asia/Almaty");
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  const savedLanguage: Language =
    ((user?.preferredLanguage as Language | null | undefined) || locale) ===
    "kk"
      ? "kk"
      : "ru";
  const savedTimezone = user?.timezone || "Asia/Almaty";

  if (!user) return null;

  // Start from the saved values every time the dialog opens.
  const onOpenChange = (next: boolean) => {
    if (next) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setLanguage(savedLanguage);
      setTimezone(savedTimezone);
    }
    setOpen(next);
  };

  const afterChange = async () => {
    await refresh();
    await onSaved();
  };

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      toast.error(
        t(
          "Загрузите изображение JPG, PNG или WebP",
          "JPG, PNG немесе WebP суретін жүктеңіз",
        ),
      );
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(
        t("Фото должно быть меньше 3 МБ", "Фото 3 МБ-тан аз болуы керек"),
      );
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setAvatarSaving(true);
    try {
      await api<User>("/users/me/avatar", { method: "POST", formData });
      await afterChange();
      toast.success(t("Фото обновлено", "Фото жаңартылды"));
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : t("Не удалось загрузить фото", "Фотоны жүктеу мүмкін болмады"),
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  const onDeleteAvatar = async () => {
    setAvatarSaving(true);
    try {
      await api<User>("/users/me/avatar", { method: "DELETE" });
      await afterChange();
      toast.success(t("Фото удалено", "Фото жойылды"));
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : t("Не удалось удалить фото", "Фотоны жою мүмкін болмады"),
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  const body: {
    firstName?: string;
    lastName?: string;
    preferredLanguage?: Language;
    timezone?: string;
  } = {};
  if (firstName.trim() !== (user.firstName || ""))
    body.firstName = firstName.trim();
  if (lastName.trim() !== (user.lastName || "")) body.lastName = lastName.trim();
  if (language !== savedLanguage) body.preferredLanguage = language;
  if (timezone !== savedTimezone) body.timezone = timezone;
  const dirty = Object.keys(body).length > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      if (dirty) {
        await api<User>("/users/me", { method: "PATCH", body });
        await afterChange();
      }
      await setLocale(language, { syncProfile: false });
      toast.success(t("Профиль сохранён", "Профиль сақталды"));
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : t("Ошибка сохранения", "Сақтау қатесі"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden="true" />
          {t("Редактировать профиль", "Профильді өңдеу")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg" data-no-translate>
        <DialogHeader>
          <DialogTitle>{t("Редактировать профиль", "Профильді өңдеу")}</DialogTitle>
          <DialogDescription>
            {t(
              "Имя и фото видят другие участники. Язык и часовой пояс — только вы.",
              "Аты мен фотоны басқа қатысушылар көреді. Тіл мен уақыт белдеуін тек сіз көресіз.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <PersonAvatar
              person={{
                id: user.id,
                firstName: user.firstName ?? null,
                lastName: user.lastName ?? null,
                avatarUrl: user.avatarUrl ?? null,
              }}
              className="size-16 text-lg"
            />
            {avatarSaving && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                <Spinner className="size-5" />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={onAvatarChange}
                aria-label={t("Загрузить фото", "Фото жүктеу")}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarSaving}
              >
                <Camera className="size-4" aria-hidden="true" />
                {user.avatarUrl
                  ? t("Заменить фото", "Фотоны ауыстыру")
                  : t("Загрузить фото", "Фото жүктеу")}
              </Button>
              {user.avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onDeleteAvatar}
                  disabled={avatarSaving}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t("Удалить", "Жою")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("JPG, PNG или WebP до 3 МБ", "JPG, PNG немесе WebP, 3 МБ-қа дейін")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-first-name">{t("Имя", "Аты")}</Label>
            <Input
              id="profile-first-name"
              value={firstName}
              maxLength={100}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-last-name">{t("Фамилия", "Тегі")}</Label>
            <Input
              id="profile-last-name"
              value={lastName}
              maxLength={100}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-language">
              {t("Язык интерфейса", "Интерфейс тілі")}
            </Label>
            <Select
              value={language}
              onValueChange={(value) => setLanguage(value as Language)}
            >
              <SelectTrigger id="profile-language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="kk">Қазақша</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-timezone">
              {t("Часовой пояс", "Уақыт белдеуі")}
            </Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="profile-timezone" className="w-full">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t("Отмена", "Болдырмау")}
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Spinner className="size-4" /> : t("Сохранить", "Сақтау")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

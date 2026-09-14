"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Settings, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LoadState,
  Person,
  PersonAvatar,
  personName,
  useSocialText,
} from "./common";

import type { GroupDetail } from './group-types';
import { useGroupSettings } from './use-group-settings';
export function GroupSettings({
  id,
  onChange,
}: {
  id: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useSocialText();
  const router = useRouter();
  const { user } = useAuth();
  const { data, error, isLoading, busy, mutate, action } = useGroupSettings(id, open, onChange);
  const manager = data && data.myRole !== "member";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Управление группой", "Топты басқару")}
        >
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto"
        data-no-translate
      >
        <DialogHeader>
          <DialogTitle>
            {t("Участники и настройки", "Қатысушылар мен баптаулар")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Управляй группой, приглашениями и доступом.",
              "Топты, шақыруларды және қолжетімділікті басқар.",
            )}
          </DialogDescription>
        </DialogHeader>
        <LoadState
          loading={isLoading}
          error={error}
          retry={() => void mutate()}
        />
        {data && (
          <div className="space-y-5">
            {manager && !data.archived ? (
              <form
                key={`${data.title}-${data.onlyAdminsPost}`}
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void action(`/social/groups/${id}`, "PATCH", {
                    title: form.get("title"),
                    description: form.get("description"),
                    onlyAdminsPost: form.get("admins") === "on",
                  });
                }}
              >
                <label className="block text-sm">
                  {t("Название", "Атауы")}
                  <input
                    name="title"
                    required
                    maxLength={100}
                    defaultValue={data.title || ""}
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                  />
                </label>
                <label className="block text-sm">
                  {t("Описание", "Сипаттамасы")}
                  <textarea
                    name="description"
                    maxLength={500}
                    defaultValue={data.description}
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                  />
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="admins"
                    defaultChecked={data.onlyAdminsPost}
                  />
                  {t(
                    "Писать могут только администраторы",
                    "Тек әкімшілер жаза алады",
                  )}
                </label>
                <Button size="sm" disabled={busy}>
                  {t("Сохранить", "Сақтау")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                {data.description}
              </p>
            )}
            {manager && !data.archived && (
              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-sm font-medium">
                  {t("Приглашение в группу", "Топқа шақыру")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.inviteToken && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(
                              `${location.origin}/dashboard/community/invite/${data.inviteToken}`,
                            )
                            .then(() =>
                              toast.success(
                                t("Ссылка скопирована", "Сілтеме көшірілді"),
                              ),
                            )
                            .catch(() =>
                              toast.error(
                                t(
                                  "Не удалось скопировать",
                                  "Көшіру мүмкін болмады",
                                ),
                              ),
                            )
                        }
                      >
                        <Copy className="size-3" />
                        {t("Скопировать", "Көшіру")}
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/dashboard/community?invite=${id}`}
                          onClick={() => setOpen(false)}
                        >
                          {t("Пригласить в посте", "Жазбада шақыру")}
                        </Link>
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            "Заменить ссылку? Старые приглашения перестанут работать.",
                            "Сілтемені ауыстыру керек пе? Ескі шақырулар жұмыс істемейді.",
                          ),
                        )
                      )
                        void action(`/social/groups/${id}/invite`, "POST");
                    }}
                  >
                    <RefreshCw className="size-3" />
                    {t("Новая ссылка", "Жаңа сілтеме")}
                  </Button>
                </div>
              </div>
            )}
            <h3 className="text-sm font-semibold">
              {t("Участники", "Қатысушылар")} · {data.members.length}
            </h3>
            <div className="space-y-3">
              {data.members.map((member) => (
                <div
                  key={member.userId}
                  className="flex flex-wrap items-center gap-2 border-b border-border pb-3"
                >
                  <PersonAvatar person={member.user} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {personName(member.user)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.role === "owner"
                        ? t("Владелец", "Иесі")
                        : member.role === "admin"
                          ? t("Администратор", "Әкімші")
                          : t("Участник", "Қатысушы")}
                      {member.muted
                        ? t(" · без права писать", " · жаза алмайды")
                        : ""}
                      {member.banned
                        ? t(" · заблокирован", " · бұғатталған")
                        : ""}
                    </p>
                  </div>
                  {manager &&
                    member.userId !== user?.id &&
                    member.role !== "owner" &&
                    (data.myRole === "owner" || member.role === "member") && (
                      <select
                        aria-label={`${t("Действия", "Әрекеттер")}: ${personName(member.user)}`}
                        disabled={busy}
                        value=""
                        className="max-w-full rounded-lg border border-border bg-background p-2 text-xs"
                        onChange={(e) => {
                          const value = e.target.value;
                          if (
                            value &&
                            window.confirm(
                              t(
                                "Применить действие к участнику?",
                                "Қатысушыға әрекетті қолдану керек пе?",
                              ),
                            )
                          )
                            void action(
                              `/social/groups/${id}/members/${member.userId}`,
                              "PATCH",
                              { action: value },
                            );
                        }}
                      >
                        <option value="">{t("Действия", "Әрекеттер")}</option>
                        {data.myRole === "owner" && (
                          <>
                            <option
                              value={
                                member.role === "admin" ? "member" : "admin"
                              }
                            >
                              {member.role === "admin"
                                ? t(
                                    "Снять администратора",
                                    "Әкімшіліктен шығару",
                                  )
                                : t(
                                    "Назначить администратором",
                                    "Әкімші тағайындау",
                                  )}
                            </option>
                            <option value="transfer">
                              {t("Передать владение", "Иелікті беру")}
                            </option>
                          </>
                        )}
                        <option value={member.muted ? "unmute" : "mute"}>
                          {member.muted
                            ? t("Разрешить писать", "Жазуға рұқсат беру")
                            : t("Запретить писать", "Жазуға тыйым салу")}
                        </option>
                        <option value={member.banned ? "unban" : "ban"}>
                          {member.banned
                            ? t("Разблокировать", "Бұғаттан шығару")
                            : t("Заблокировать", "Бұғаттау")}
                        </option>
                        <option value="remove">
                          {t("Исключить", "Шығару")}
                        </option>
                      </select>
                    )}
                </div>
              ))}
            </div>
            {data.myRole === "owner" ? (
              <Button
                variant="destructive"
                disabled={busy || data.archived}
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        "Закрыть группу? Отправка и новые приглашения станут недоступны.",
                        "Топты жабу керек пе? Хабарлама жіберу мен шақыру тоқтатылады.",
                      ),
                    )
                  )
                    void action(`/social/groups/${id}`, "DELETE");
                }}
              >
                {t("Закрыть группу", "Топты жабу")}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (await action(`/social/groups/${id}/leave`, "POST")) {
                    setOpen(false);
                    router.push("/dashboard/messages");
                  }
                }}
              >
                {t("Покинуть группу", "Топтан шығу")}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

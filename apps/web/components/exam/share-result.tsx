"use client";

import { useState } from "react";
import Link from "next/link";
import { Share2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { useUiI18n } from "@/lib/i18n/ui";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz";
const INVITE_URL = `${SITE}/probnyy-ent?utm_source=share&utm_medium=result&utm_campaign=friend`;

/**
 * «Поделиться результатом»: пост в сообществе (наполняет ленту живыми результатами,
 * на которые отвечают) и ссылка другу в мессенджер — так приходят новые люди.
 */
export function ShareResult({
  score,
  maxScore,
  subjectLines,
}: {
  score: number;
  maxScore: number;
  /** «Математика 30/50» — по предмету. */
  subjectLines: string[];
}) {
  const { locale } = useUiI18n();
  const t = (ru: string, kk: string) => (locale === "kk" ? kk : ru);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);
  const [text, setText] = useState("");

  const defaultText = t(
    `Мой пробный ЕНТ: ${score}/${maxScore} 🎯\n${subjectLines.join(" · ")}\nКто сколько набирает? Какие темы даются тяжелее всего?`,
    `Менің ҰБТ сынағым: ${score}/${maxScore} 🎯\n${subjectLines.join(" · ")}\nКім қанша жинап жүр? Қай тақырыптар қиын?`,
  );
  const friendText = t(
    `Сдал пробный ЕНТ на my-test.kz — ${score}/${maxScore}. Попробуй тоже, это бесплатно:`,
    `my-test.kz-те ҰБТ сынағын тапсырдым — ${score}/${maxScore}. Сен де байқап көр, тегін:`,
  );

  const openDialog = () => {
    setText(defaultText);
    setPostId(null);
    setOpen(true);
  };

  const publish = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const post = await api<{ id: string }>("/social/posts", { method: "POST", body: { body: text.trim() } });
      setPostId(post.id);
      toast.success(t("Опубликовано в сообществе", "Қауымдастықта жарияланды"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Не удалось опубликовать", "Жариялау мүмкін болмады"));
    } finally {
      setBusy(false);
    }
  };

  const shareToFriend = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: friendText, url: INVITE_URL });
        return;
      } catch {
        // отменили системное меню — покажем ссылки ниже
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${friendText} ${INVITE_URL}`)}`, "_blank", "noopener");
  };

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={openDialog} data-no-translate>
        <Share2 className="size-4" aria-hidden="true" />
        {t("Поделиться", "Бөлісу")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" data-no-translate>
          <DialogHeader>
            <DialogTitle>{t("Поделиться результатом", "Нәтижемен бөлісу")}</DialogTitle>
            <DialogDescription>
              {t(
                "Опубликуй в сообществе — сравнишь результат с другими и получишь советы. Или отправь другу.",
                "Қауымдастықта жарияла — нәтижеңді басқалармен салыстырып, кеңес аласың. Немесе досыңа жібер.",
              )}
            </DialogDescription>
          </DialogHeader>
          {postId ? (
            <div className="space-y-3">
              <p className="text-sm">{t("Готово! Пост уже в ленте.", "Дайын! Жазба лентада.")}</p>
              <Button asChild className="w-full">
                <Link href={`/dashboard/community/post/${postId}`}>
                  <Users className="size-4" aria-hidden="true" />
                  {t("Открыть пост", "Жазбаны ашу")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={5} />
              <Button type="button" className="w-full" disabled={busy || !text.trim()} onClick={() => void publish()}>
                <Users className="size-4" aria-hidden="true" />
                {busy ? t("Публикуем…", "Жариялануда…") : t("Опубликовать в сообществе", "Қауымдастықта жариялау")}
              </Button>
            </div>
          )}
          <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => void shareToFriend()}>
              <Share2 className="size-4" aria-hidden="true" />
              {t("Отправить другу", "Досыңа жіберу")}
            </Button>
            <Button asChild variant="outline">
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(INVITE_URL)}&text=${encodeURIComponent(friendText)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Send className="size-4" aria-hidden="true" />
                Telegram
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

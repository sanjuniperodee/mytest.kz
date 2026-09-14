"use client";
import { useChatMedia } from "./use-chat-media";
import { useEffect, useRef, useState } from "react";
import { FileDown, Mic, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";
import { api, chatMediaBlob } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { useSocialText } from "./common";

export type Attachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
};
export function MessageMedia({ file }: { file: Attachment }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const t = useSocialText();
  useEffect(() => {
    let alive = true,
      objectUrl = "";
    setUrl("");
    setError(false);
    chatMediaBlob(file.id)
      .then((blob) => {
        if (alive) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, attempt]);
  if (error)
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAttempt((x) => x + 1)}
      >
        {t("Повторить загрузку", "Қайта жүктеу")}
      </Button>
    );
  if (!url)
    return (
      <span role="status" className="block py-3 text-xs opacity-60">
        {t("Загрузка вложения…", "Тіркеме жүктелуде…")}
      </span>
    );
  return (
    <div className="my-2 min-w-0 max-w-full">
      {file.mime.startsWith("image/") ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={file.name}
            className="max-h-72 max-w-full rounded-xl object-contain"
          />
        </a>
      ) : file.mime.startsWith("audio/") ? (
        <audio
          controls
          preload="metadata"
          src={url}
          className="h-10 w-full min-w-0 max-w-full"
        />
      ) : file.mime.startsWith("video/") ? (
        <video
          controls
          preload="metadata"
          playsInline
          src={url}
          className="max-h-72 w-full rounded-xl"
        />
      ) : null}
      <a
        href={url}
        download={file.name}
        className="mt-1 flex items-center gap-2 text-xs underline"
      >
        <FileDown className="size-3.5 shrink-0" />
        <span className="break-all">
          {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
        </span>
      </a>
    </div>
  );
}
export function MediaComposer({
  roomId,
  attachment,
  onChange,
  onBusy,
  disabled,
}: {
  roomId: string;
  attachment: Attachment | null;
  onChange: (file: Attachment | null) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
}) {
  const t = useSocialText();
  const { input, recording, uploading, upload, record } = useChatMedia(roomId, onChange, onBusy);
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/*,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("Прикрепить файл", "Файл тіркеу")}
        disabled={disabled || uploading || recording}
        onClick={() => input.current?.click()}
      >
        <Paperclip className="size-4" />
      </Button>
      <Button
        variant={recording ? "destructive" : "ghost"}
        size="icon"
        aria-label={
          recording
            ? t("Завершить запись", "Жазуды аяқтау")
            : t("Записать голосовое", "Дауыстық хабарлама жазу")
        }
        disabled={uploading || (disabled && !recording)}
        onClick={() => void record()}
      >
        {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
      </Button>
      {recording && (
        <span role="status" className="text-xs text-rose-500">
          {t("Идёт запись · до 3 минут", "Жазылуда · 3 минутқа дейін")}
        </span>
      )}
      {uploading && (
        <span role="status" className="text-xs">
          {t("Загрузка…", "Жүктелуде…")}
        </span>
      )}
      {attachment && (
        <span className="flex min-w-0 max-w-full items-center gap-1 rounded-lg bg-secondary px-2 text-xs">
          <span className="truncate">{attachment.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            disabled={disabled}
            aria-label={t("Убрать вложение", "Тіркемені алып тастау")}
            onClick={() => onChange(null)}
          >
            <X className="size-3" />
          </Button>
        </span>
      )}
    </div>
  );
}

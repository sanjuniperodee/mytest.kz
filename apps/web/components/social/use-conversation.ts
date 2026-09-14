"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { Page, useSocialText } from "./common";
import type { Message } from "./chat-types";
import type { Attachment } from "./media";
export function useConversation(id: string, onRead: () => void) {
  const t = useSocialText();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const pending = useRef<{
    body: string;
    clientId: string;
    attachmentId?: string;
  } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const readMessage = useRef<string | null>(null);
  const { data, error, isLoading, isValidating, mutate, size, setSize } =
    useSWRInfinite<Page<Message>>(
      (index, prev) =>
        index && !prev?.nextCursor
          ? null
          : `/social/rooms/${id}/messages${index ? `?cursor=${prev?.nextCursor}` : ""}`,
      (path: string) => api<Page<Message>>(path),
      { refreshInterval: 5000, revalidateAll: false, refreshWhenHidden: false },
    );
  const messages = [
    ...new Map(
      data?.flatMap((p) => p.items).map((m) => [m.id, m]) || [],
    ).values(),
  ].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const newest = data?.[0]?.items[0]?.id;
  useEffect(() => {
    if (nearBottom.current)
      scroller.current?.scrollTo({
        top: scroller.current.scrollHeight,
        behavior: "smooth",
      });
  }, [newest]);
  const markRead = useCallback(() => {
    if (
      !newest ||
      readMessage.current === newest ||
      !nearBottom.current ||
      document.visibilityState !== "visible"
    )
      return;
    void api(`/social/rooms/${id}/read`, {
      method: "PUT",
      body: { messageId: newest },
    })
      .then(() => {
        readMessage.current = newest;
        onRead();
      })
      .catch(() => {});
  }, [id, newest, onRead]);
  useEffect(() => {
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [markRead]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending || mediaBusy || (!draft.trim() && !attachment)) return;
    setSending(true);
    if (
      !pending.current ||
      pending.current.body !== draft.trim() ||
      pending.current.attachmentId !== attachment?.id
    )
      pending.current = {
        body: draft.trim(),
        clientId: crypto.randomUUID(),
        ...(attachment ? { attachmentId: attachment.id } : {}),
      };
    try {
      await api(`/social/rooms/${id}/messages`, {
        method: "POST",
        body: pending.current,
      });
      pending.current = null;
      setDraft("");
      setAttachment(null);
      nearBottom.current = true;
      await mutate();
      onRead();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t(
              "Не удалось отправить. Текст сохранён — попробуй ещё раз.",
              "Жіберу мүмкін болмады. Мәтін сақталды, қайталап көр.",
            ),
      );
    } finally {
      setSending(false);
    }
  }

  return {
    draft,
    setDraft,
    sending,
    attachment,
    setAttachment,
    mediaBusy,
    setMediaBusy,
    scroller,
    nearBottom,
    markRead,
    messages,
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    size,
    setSize,
    send,
  };
}

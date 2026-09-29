"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { api } from "@/lib/api/client";
import { type Page, useSocialText } from "./common";
import type { Message } from "./chat-types";
import type { Attachment } from "./media";
import { refreshMessageWindow } from "./message-window";
export function useConversation(id: string, onRead: () => void) {
  const t = useSocialText();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const sendLock = useRef(false);
  const readLock = useRef(false);
  const latestWindow = useRef<Page<Message> | undefined>(undefined);
  const [atBottom, setAtBottom] = useState(true);
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
      async (path: string) => {
        if (path.includes("?cursor=")) return api<Page<Message>>(path);
        const next = await refreshMessageWindow(
          latestWindow.current,
          () => api<Page<Message>>(path),
          (after) => api<Page<Message>>(`${path}?after=${after}`),
        );
        latestWindow.current = next;
        return next;
      },
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
        behavior: "instant",
      });
  }, [newest]);
  const markRead = useCallback(() => {
    if (
      !newest ||
      readLock.current ||
      readMessage.current === newest ||
      !nearBottom.current ||
      document.visibilityState !== "visible"
    )
      return;
    readLock.current = true;
    void api(`/social/rooms/${id}/read`, {
      method: "PUT",
      body: { messageId: newest },
    })
      .then(() => {
        readMessage.current = newest;
        onRead();
      })
      .catch(() => {})
      .finally(() => {
        readLock.current = false;
      });
  }, [id, newest, onRead]);
  useEffect(() => {
    markRead();
    const retry = window.setInterval(markRead, 5000);
    document.addEventListener("visibilitychange", markRead);
    return () => {
      window.clearInterval(retry);
      document.removeEventListener("visibilitychange", markRead);
    };
  }, [markRead]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (
      sendLock.current ||
      mediaBusy ||
      error ||
      (!draft.trim() && !attachment)
    )
      return;
    sendLock.current = true;
    setSendError("");
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
      await api<Message>(`/social/rooms/${id}/messages`, {
        method: "POST",
        body: pending.current,
      });
      pending.current = null;
      setDraft("");
      setAttachment(null);
      nearBottom.current = true;
      setAtBottom(true);
      // Delivery is already confirmed: a refresh failure must not invite a duplicate send.
    } catch {
      setSendError(
        t(
          "Не удалось отправить. Текст сохранён — попробуй ещё раз.",
          "Жіберу мүмкін болмады. Мәтін сақталды, қайталап көр.",
        ),
      );
      return;
    } finally {
      setSending(false);
      sendLock.current = false;
    }
    // Keep the server watermark unchanged until missing arrivals are fetched.
    // Refresh errors are not delivery errors: the acknowledged draft stays cleared.
    void mutate().catch(() => {});
    onRead();
  }

  async function removeMessage(messageId: string) {
    await api(`/social/rooms/${id}/messages/${messageId}`, {
      method: "DELETE",
    });
    if (latestWindow.current)
      latestWindow.current = {
        ...latestWindow.current,
        items: latestWindow.current.items.filter(
          (message) => message.id !== messageId,
        ),
      };
    void mutate(
      (pages) =>
        pages?.map((page) => ({
          ...page,
          items: page.items.filter((message) => message.id !== messageId),
        })),
      { revalidate: false },
    ).catch(() => {});
    onRead();
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
    sendError,
    removeMessage,
    atBottom,
    setAtBottom,
    jumpToLatest: () => {
      nearBottom.current = true;
      setAtBottom(true);
      scroller.current?.scrollTo({
        top: scroller.current.scrollHeight,
        behavior: "smooth",
      });
      markRead();
    },
  };
}

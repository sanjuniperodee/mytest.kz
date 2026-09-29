import { randomUUID } from "expo-crypto"
import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"
import useSWRInfinite from "swr/infinite"
import { api } from "@/lib/api/client"
import { useTr } from "@/lib/i18n/use-tr"
import { refreshMessageWindow } from "./message-window"
import type { Attachment, Message, Page } from "./types"

/** Messages, sending, retry-safe delivery and read markers for one room. */
export function useConversation(id: string, onRead: () => void) {
  const tr = useTr()
  const [draft, setDraft] = useState("")
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const sendLock = useRef(false)
  const readLock = useRef(false)
  const latestWindow = useRef<Page<Message> | undefined>(undefined)
  const pending = useRef<{ body: string; clientId: string; attachmentId?: string } | null>(null)
  const readMessage = useRef<string | null>(null)
  const nearBottom = useRef(true)
  const focused = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<Page<Message>>(
    (index, prev) =>
      index && !prev?.nextCursor ? null : `/social/rooms/${id}/messages${index ? `?cursor=${prev?.nextCursor}` : ""}`,
    async (path: string) => {
      if (path.includes("?cursor=")) return api<Page<Message>>(path)
      const next = await refreshMessageWindow(
        latestWindow.current,
        () => api<Page<Message>>(path),
        (after) => api<Page<Message>>(`${path}?after=${after}`),
      )
      latestWindow.current = next
      return next
    },
    {
      // Polling pauses while the app is in the background.
      refreshInterval: () => (AppState.currentState === "active" && focused.current ? 5000 : 0),
      revalidateAll: false,
      revalidateOnFocus: false,
    },
  )

  // Newest first: the list is inverted, so index 0 sits at the bottom.
  const messages = [...new Map(data?.flatMap((p) => p.items).map((m) => [m.id, m]) ?? []).values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  )
  const newest = messages[0]?.id

  const markRead = useCallback(() => {
    if (!newest || readLock.current || readMessage.current === newest || !nearBottom.current) return
    if (AppState.currentState !== "active" || !focused.current) return
    readLock.current = true
    void api(`/social/rooms/${id}/read`, { method: "PUT", body: { messageId: newest } })
      .then(() => {
        readMessage.current = newest
        onRead()
      })
      .catch(() => {})
      .finally(() => {
        readLock.current = false
      })
  }, [id, newest, onRead])

  useFocusEffect(
    useCallback(() => {
      focused.current = true
      void mutate().catch(() => {})
      markRead()
      return () => {
        focused.current = false
      }
    }, [markRead, mutate]),
  )

  useEffect(() => {
    markRead()
    const retry = setInterval(markRead, 5000)
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void mutate().catch(() => {})
        markRead()
      }
    })
    return () => {
      clearInterval(retry)
      sub.remove()
    }
  }, [markRead, mutate])

  async function send() {
    if (sendLock.current || mediaBusy || error || (!draft.trim() && !attachment)) return
    sendLock.current = true
    setSendError("")
    setSending(true)
    // Retrying an unconfirmed message reuses its client ID, so it can never be delivered twice.
    if (!pending.current || pending.current.body !== draft.trim() || pending.current.attachmentId !== attachment?.id) {
      pending.current = {
        body: draft.trim(),
        clientId: randomUUID(),
        ...(attachment ? { attachmentId: attachment.id } : {}),
      }
    }
    try {
      await api<Message>(`/social/rooms/${id}/messages`, { method: "POST", body: pending.current })
      pending.current = null
      setDraft("")
      setAttachment(null)
      nearBottom.current = true
      setAtBottom(true)
    } catch {
      setSendError(tr("Не удалось отправить. Текст сохранён — попробуй ещё раз.", "Жіберу мүмкін болмады. Мәтін сақталды, қайталап көр."))
      return
    } finally {
      setSending(false)
      sendLock.current = false
    }
    // Delivery is confirmed: a refresh failure must not invite a duplicate send.
    void mutate().catch(() => {})
    onRead()
  }

  async function removeMessage(messageId: string) {
    await api(`/social/rooms/${id}/messages/${messageId}`, { method: "DELETE" })
    if (latestWindow.current) {
      latestWindow.current = { ...latestWindow.current, items: latestWindow.current.items.filter((m) => m.id !== messageId) }
    }
    void mutate((pages) => pages?.map((page) => ({ ...page, items: page.items.filter((m) => m.id !== messageId) })), {
      revalidate: false,
    }).catch(() => {})
    onRead()
  }

  return {
    draft,
    setDraft,
    sending,
    attachment,
    setAttachment,
    mediaBusy,
    setMediaBusy,
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
  }
}

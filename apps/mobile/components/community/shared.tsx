import { Alert } from "react-native"
import { mutate as globalMutate } from "swr"
import { api } from "@/lib/api/client"
import { useUiLocale } from "@/lib/i18n/ui"

export const errorMessage = (e: unknown, fallback = "Error") => (e instanceof Error && e.message ? e.message : fallback)

export function confirmAction(opts: {
  title: string
  message?: string
  confirm: string
  cancel: string
  destructive?: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: opts.cancel, style: "cancel", onPress: () => resolve(false) },
        { text: opts.confirm, style: opts.destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}

/** Blocks or unblocks a person and refreshes everything the community screens cache. */
export async function setBlocked(userId: string, blocked: boolean) {
  await api(`/social/people/${userId}/block`, { method: blocked ? "PUT" : "DELETE" })
  await globalMutate((key) => typeof key === "string" && key.startsWith("/social/"))
  await globalMutate((key) => Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith("/social/"))
}

export function useDateLabels() {
  const { locale } = useUiLocale()
  const bcp = locale === "kk" ? "kk-KZ" : "ru-RU"
  return {
    shortDate: (value: string) =>
      new Date(value).toLocaleDateString(bcp, { day: "numeric", month: "short" }),
    day: (value: string) =>
      new Date(value).toLocaleDateString(bcp, { day: "numeric", month: "long", timeZone: "Asia/Almaty" }),
    time: (value: string) =>
      new Date(value).toLocaleTimeString(bcp, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" }),
  }
}

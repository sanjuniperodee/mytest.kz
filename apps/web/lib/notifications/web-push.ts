"use client"

import { api } from "@/lib/api/client"

export type PushState = "unsupported" | "denied" | "default" | "granted" | "subscribed"

const SW_URL = "/sw.js"

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/")
  return registration ? registration.pushManager.getSubscription() : null
}

/** Reads the state without prompting the user. */
export async function readPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported"
  if (Notification.permission === "denied") return "denied"
  if (Notification.permission !== "granted") return "default"
  return (await currentSubscription()) ? "subscribed" : "granted"
}

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a || a.byteLength !== b.byteLength) return false
  const view = new Uint8Array(a)
  return view.every((byte, i) => byte === b[i])
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON()
  await api("/notifications/push/subscribe", {
    method: "POST",
    body: { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } },
  })
}

/**
 * Asks for permission and subscribes this browser. Call it only from a click handler:
 * the permission prompt must follow a user action.
 */
export async function enablePush(publicKey: string): Promise<"subscribed" | "denied" | "dismissed"> {
  const permission = await Notification.requestPermission()
  if (permission === "denied") return "denied"
  if (permission !== "granted") return "dismissed"

  await navigator.serviceWorker.register(SW_URL, { scope: "/" })
  const registration = await navigator.serviceWorker.ready
  const key = base64UrlToBytes(publicKey)
  let subscription = await registration.pushManager.getSubscription()
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    // The server key changed: the old subscription can no longer be used.
    await subscription.unsubscribe()
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  })
  await saveSubscription(subscription)
  return "subscribed"
}

/**
 * Re-sends an existing subscription once per tab session (endpoint rotation, another account
 * signed in on this browser). Never prompts.
 */
export async function syncExistingPushSubscription(userId: string) {
  if (!isPushSupported() || Notification.permission !== "granted") return
  const marker = `mytest:push-synced:${userId}`
  if (window.sessionStorage.getItem(marker)) return
  const subscription = await currentSubscription()
  if (!subscription) return
  await saveSubscription(subscription)
  window.sessionStorage.setItem(marker, "1")
}

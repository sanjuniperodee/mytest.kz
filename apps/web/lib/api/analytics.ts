"use client"

import { api } from "./client"

const VID_KEY = "blm_vid_local"

function getVisitorId(): string {
  if (typeof window === "undefined") return ""
  let id = window.localStorage.getItem(VID_KEY)
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(VID_KEY, id)
  }
  return id
}

export async function recordVisit() {
  if (typeof window === "undefined") return
  const params = new URLSearchParams(window.location.search)
  try {
    await api("/analytics/visit", {
      method: "POST",
      auth: false,
      body: {
        visitorId: getVisitorId(),
        source: params.get("utm_source") || undefined,
        medium: params.get("utm_medium") || undefined,
        campaign: params.get("utm_campaign") || undefined,
        referrer: document.referrer || undefined,
        landingPath: window.location.pathname,
      },
    })
  } catch {
    // silent
  }
}

"use client"

import { api } from "./client"

const VID_KEY = "blm_vid_local"

/**
 * Путь для аналитики без секретов: ссылки «отчёт для родителей» (/progress/<token>) и
 * «оплатить за ученика» (/pay/<token>) работают без входа, поэтому токен не должен
 * попадать в visit_events/funnel_steps.
 */
const TOKEN_PATH_RE = /\/(progress|pay)\/[^/?#]+/
const TOKEN_PATH_START_RE = /^\/(progress|pay)\/[^/?#]+/

export function analyticsPath(pathname: string): string {
  return pathname.replace(TOKEN_PATH_START_RE, "/$1/:token")
}

function currentPath(): string {
  return analyticsPath(window.location.pathname)
}

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
        referrer: document.referrer.replace(TOKEN_PATH_RE, "/$1/:token") || undefined,
        landingPath: currentPath(),
      },
    })
  } catch {
    // silent
  }
}

export async function recordFunnelEvent(
  step: string,
  metadata?: Record<string, unknown>,
  sessionId?: string,
) {
  if (typeof window === "undefined") return
  try {
    await api("/analytics/event", {
      method: "POST",
      body: {
        step,
        sessionId,
        metadata,
        landingPath: currentPath(),
      },
    })
  } catch {
    // Analytics is intentionally non-blocking.
  }
}

export async function recordPublicFunnelEvent(
  step: string,
  metadata?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return
  try {
    await api("/analytics/public-event", {
      method: "POST",
      auth: false,
      body: {
        visitorId: getVisitorId(),
        step,
        metadata,
        landingPath: currentPath(),
      },
    })
  } catch {
    // Conversion analytics must never block the landing experience.
  }
}

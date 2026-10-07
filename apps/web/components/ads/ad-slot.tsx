"use client"

import { useEffect, useRef, useState } from "react"
import type { AdPlacementKey } from "@bilimland/shared"
import { useAuth } from "@/lib/api/auth-context"
import { hasPaidAccess, usePublicMonetization } from "@/lib/api/monetization"
import { useUiI18n } from "@/lib/i18n/ui"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const SCRIPT_ID = "adsbygoogle-js"

/** Скрипт AdSense подключаем один раз и только когда реклама реально нужна на экране. */
function ensureAdSenseScript(clientId: string) {
  if (document.getElementById(SCRIPT_ID)) return
  const script = document.createElement("script")
  script.id = SCRIPT_ID
  script.async = true
  script.crossOrigin = "anonymous"
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`
  document.head.appendChild(script)
}

/**
 * Один адаптивный блок Google AdSense. Ничего не рендерит, пока реклама выключена
 * в админке, место без ID блока или у пользователя подписка (если включено
 * «скрывать у подписчиков»). Скрипт и запрос объявления — только когда блок
 * подъезжает к экрану, поэтому на скорость первого экрана не влияет. Пустой
 * (незаполненный) блок схлопывается целиком.
 */
export function AdSlot({ placement, className }: { placement: AdPlacementKey; className?: string }) {
  const { data: config } = usePublicMonetization()
  const { user, isLoading: authLoading } = useAuth()
  const { locale } = useUiI18n()
  const containerRef = useRef<HTMLElement | null>(null)
  const insRef = useRef<HTMLModElement | null>(null)
  const [visible, setVisible] = useState(false)

  const ads = config?.ads
  const slot = ads?.slots[placement] ?? ""
  const hiddenForUser = Boolean(ads?.hideForPremium && hasPaidAccess(user))
  const enabled = Boolean(ads?.enabled && ads.adsenseClientId && slot) && !authLoading && !hiddenForUser

  useEffect(() => {
    if (!enabled || visible) return
    const node = containerRef.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, visible])

  useEffect(() => {
    const ins = insRef.current
    if (!enabled || !visible || !ads || !ins) return
    // StrictMode и повторные эффекты: один <ins> заполняется ровно один раз.
    if (ins.getAttribute("data-adsbygoogle-status")) return
    ensureAdSenseScript(ads.adsenseClientId)
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // Блокировщик рекламы или повторный push — просто остаётся пустое место, которое схлопнется.
    }
  }, [enabled, visible, ads])

  if (!enabled || !ads) return null

  const label = locale === "kk" ? "Жарнама" : "Реклама"
  return (
    <aside
      ref={containerRef}
      aria-label={label}
      data-ad-placement={placement}
      className={cn(
        // Пустой блок (data-ad-status="unfilled") прячется правилом в globals.css.
        "min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card/60 px-3 pt-2 pb-3",
        className,
      )}
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">{label}</p>
      {visible ? (
        <ins
          ref={insRef}
          className="adsbygoogle block min-h-[100px] w-full"
          style={{ display: "block" }}
          data-ad-client={ads.adsenseClientId}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <div className="min-h-[100px]" aria-hidden />
      )}
    </aside>
  )
}

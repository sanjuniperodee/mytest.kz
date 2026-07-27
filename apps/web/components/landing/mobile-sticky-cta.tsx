"use client"

import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { ConversionLink } from "./conversion-link"

export function MobileStickyCta() {
  const [pastHero, setPastHero] = useState(false)
  const [overConversionSection, setOverConversionSection] = useState(false)

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > 520)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll("#pricing, #lead, footer"))
    if (!targets.length) return

    const visibleTargets = new Set<Element>()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleTargets.add(entry.target)
          else visibleTargets.delete(entry.target)
        })
        setOverConversionSection(visibleTargets.size > 0)
      },
      { threshold: 0.08 },
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  const visible = pastHero && !overConversionSection

  return (
    <div
      className={[
        "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 transition-all duration-300 md:hidden",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
      ].join(" ")}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/95 p-2 pl-4 shadow-[0_20px_60px_-18px_oklch(0.18_0.012_60_/_0.45)] backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">1 пробный бесплатно</div>
          <div className="text-xs text-muted-foreground">Без карты · результат сразу</div>
        </div>
        <ConversionLink
          href="/login?source=sticky"
          placement="mobile_sticky"
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
        >
          Начать
          <ArrowRight className="size-4" />
        </ConversionLink>
      </div>
    </div>
  )
}

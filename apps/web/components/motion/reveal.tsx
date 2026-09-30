"use client"

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Fades + lifts content in the first time it scrolls into view.
 *
 * Progressive by design: the server render is fully visible. After hydration only
 * elements that are still below the fold are hidden (and revealed on approach), so
 * above-the-fold content, no-JS visitors, crawlers and reduced-motion users never
 * see a hidden state. Pure DOM data-attributes — no re-renders.
 */
export function Reveal({
  as,
  delay = 0,
  className,
  style,
  children,
}: {
  as?: ElementType
  /** ms; use small steps (60–90) to stagger siblings. */
  delay?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const Comp = (as ?? "div") as ElementType
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (typeof IntersectionObserver === "undefined") return
    // Already on screen (or above it, e.g. restored scroll position): leave it alone.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return

    el.dataset.reveal = "hidden"
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        el.dataset.reveal = "shown"
        io.disconnect()
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Comp
      ref={ref}
      className={cn(className)}
      style={delay ? ({ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties) : style}
    >
      {children}
    </Comp>
  )
}

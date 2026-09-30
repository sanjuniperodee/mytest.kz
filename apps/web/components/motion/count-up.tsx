"use client"

import { useEffect, useRef, useState } from "react"

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Counts up to `value` once it is on screen, and glides to new values on update.
 * Meant for numbers that arrive client-side (SWR data): it starts from `from` on mount.
 * Reduced-motion users get the final value immediately.
 */
export function CountUp({
  value,
  from = 0,
  duration = 900,
  animateOnMount = true,
  decimals = 0,
  format,
  className,
}: {
  value: number
  from?: number
  duration?: number
  /** false: render `value` straight away (SSR-safe) and only animate later changes. */
  animateOnMount?: boolean
  decimals?: number
  format?: (n: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const initial = animateOnMount ? from : value
  const shown = useRef(initial)
  const [text, setText] = useState(() => fmt(initial))
  const started = useRef(!animateOnMount)

  function fmt(n: number) {
    const v = decimals > 0 ? Number(n.toFixed(decimals)) : Math.round(n)
    return format ? format(v) : v.toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    let io: IntersectionObserver | undefined

    const run = (target: number) => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (reduce || !Number.isFinite(target)) {
        shown.current = target
        setText(fmt(target))
        return
      }
      const start = shown.current
      if (start === target) return
      // Later updates (revalidation) should be quick; the first count-up gets the full duration.
      const ms = started.current ? Math.min(duration, 500) : duration
      started.current = true
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / ms)
        const n = start + (target - start) * easeOutCubic(p)
        shown.current = n
        setText(fmt(n))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    if (started.current || typeof IntersectionObserver === "undefined") {
      run(value)
    } else {
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return
          io?.disconnect()
          run(value)
        },
        { threshold: 0.3 },
      )
      io.observe(el)
    }
    return () => {
      io?.disconnect()
      cancelAnimationFrame(raf)
    }
    // fmt closes over decimals/format only; re-run when the target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {text}
    </span>
  )
}

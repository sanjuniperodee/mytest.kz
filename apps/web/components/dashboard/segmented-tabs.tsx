"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/** In-page view switcher (feed filters, profile activity). The active pill slides between tabs. */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  items: { value: T; label: string }[]
  label: string
  className?: string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  // Skip the transition for the very first placement so the pill doesn't fly in from the left.
  const [animate, setAnimate] = useState(false)

  const measure = useCallback(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (active) setPill({ x: active.offsetLeft, w: active.offsetWidth })
  }, [])

  useIsoLayoutEffect(measure, [measure, value, items.length])

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    const list = listRef.current
    const ro = list && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null
    if (list) ro?.observe(list)
    return () => {
      cancelAnimationFrame(id)
      ro?.disconnect()
    }
  }, [measure])

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cn("relative flex gap-1 rounded-lg border border-border bg-card p-1", className)}
    >
      {pill && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-1 left-0 rounded-md bg-foreground",
            animate && "transition-[transform,width] duration-300 ease-out",
          )}
          style={{ width: pill.w, transform: `translateX(${pill.x}px)` }}
        />
      )}
      {items.map((item) => {
        const active = value === item.value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "press relative z-10 min-h-10 flex-1 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

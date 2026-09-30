"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

/** True when the OS asks for less motion. Server render assumes motion is fine. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}

/**
 * Props for recharts series (<Line>, <Bar>): a short draw-in instead of recharts' 1.5 s default,
 * and none at all when reduced motion is requested (recharts animates in JS, so CSS can't stop it).
 */
export function useChartAnimation() {
  const reduced = usePrefersReducedMotion()
  return { isAnimationActive: !reduced, animationDuration: 700, animationEasing: "ease-out" } as const
}

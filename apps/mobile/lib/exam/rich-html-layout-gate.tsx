import { createContext, useContext } from "react"

export type RichHtmlLayoutGateValue = {
  /** Idempotent: one slotId считается один раз (Strict Mode / повторные измерения). */
  reportSlotReady: (slotId: string) => void
}

export const RichHtmlLayoutGateContext = createContext<RichHtmlLayoutGateValue | null>(null)

export function useRichHtmlLayoutGate(): RichHtmlLayoutGateValue | null {
  return useContext(RichHtmlLayoutGateContext)
}

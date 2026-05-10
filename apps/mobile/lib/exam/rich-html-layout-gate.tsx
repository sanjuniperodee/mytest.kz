import { createContext, useContext } from "react"

export type RichHtmlLayoutGateValue = {
  reportSlotReady: () => void
}

export const RichHtmlLayoutGateContext = createContext<RichHtmlLayoutGateValue | null>(null)

export function useRichHtmlLayoutGate(): RichHtmlLayoutGateValue | null {
  return useContext(RichHtmlLayoutGateContext)
}

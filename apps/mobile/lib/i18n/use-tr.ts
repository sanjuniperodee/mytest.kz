import { useCallback } from "react"
import { useUiLocale } from "@/lib/i18n/ui"

/** `tr("Русский", "Қазақша")` — picks the string for the current UI language. */
export function useTr() {
  const { locale } = useUiLocale()
  return useCallback((ru: string, kk: string) => (locale === "kk" ? kk : ru), [locale])
}

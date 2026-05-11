"use client"

import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUiI18n } from "@/lib/i18n/ui"
import { cn } from "@/lib/utils"

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useUiI18n()
  const next = locale === "kk" ? "ru" : "kk"
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-9 gap-2 rounded-full px-3", className)}
      aria-label={locale === "kk" ? "Русский язык" : "Қазақ тілі"}
      onClick={() => void setLocale(next)}
    >
      <Languages className="size-4" />
      <span className="font-semibold">{locale === "kk" ? "RU" : "ҚАЗ"}</span>
    </Button>
  )
}

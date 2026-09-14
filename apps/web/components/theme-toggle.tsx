"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggle({
  className,
  showLabel = false,
}: {
  className?: string
  showLabel?: boolean
}) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size={showLabel ? "sm" : "icon-sm"}
        className={cn("h-9 rounded-xl", showLabel ? "gap-2 px-3" : "size-9", className)}
        aria-label="Переключить тему"
      >
        <Sun className="size-4 opacity-50" />
        {showLabel && <span className="text-xs font-medium">Тема</span>}
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="outline"
      size={showLabel ? "sm" : "icon-sm"}
      className={cn(
        "h-9 rounded-xl transition-all duration-200 active:scale-95",
        showLabel ? "gap-2 px-3" : "size-9",
        className
      )}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="size-4 text-amber-400 transition-transform duration-300 rotate-0 scale-100" />
      ) : (
        <Moon className="size-4 text-foreground/80 transition-transform duration-300 rotate-0 scale-100" />
      )}
      {showLabel && (
        <span className="text-xs font-medium">{isDark ? "Светлая" : "Тёмная"}</span>
      )}
    </Button>
  )
}

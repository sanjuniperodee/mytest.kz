"use client"

import { cn } from "@/lib/utils"

/** In-page view switcher (feed filters, profile activity). */
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
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex gap-1 rounded-lg border border-border bg-card p-1", className)}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "min-h-10 flex-1 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === item.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

"use client"

import { resolveMediaUrl } from "@/lib/api/client"

export function QuestionMedia({ src, alt }: { src?: string | null; alt?: string }) {
  if (!src) return null
  const url = resolveMediaUrl(src)
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url || "/placeholder.svg"} alt={alt || "Изображение к вопросу"} className="max-h-72 w-full object-contain" />
    </div>
  )
}

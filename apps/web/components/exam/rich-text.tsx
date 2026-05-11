"use client"

import { useMemo } from "react"
import katex from "katex"
import { resolveMediaUrl } from "@/lib/api/client"
import { localize, type Locale, type LocalizedText } from "@/lib/api/i18n"
import { cn } from "@/lib/utils"

type RichTextProps = {
  value: unknown
  locale: Locale
  imageUrls?: string[]
  className?: string
  as?: "div" | "span"
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function createHtmlChunkStore() {
  const chunks: string[] = []
  return {
    add(html: string) {
      const token = `\uE000${chunks.length}\uE001`
      chunks.push(html)
      return token
    },
    restore(text: string) {
      return text.replace(/\uE000(\d+)\uE001/g, (_match, indexRaw: string) => {
        const index = Number.parseInt(indexRaw, 10)
        return chunks[index] ?? ""
      })
    },
  }
}

export function renderRichTextHtml(
  value: unknown,
  options: { locale: Locale; imageUrls?: string[] },
): string {
  const raw =
    typeof value === "string"
      ? value
      : localize(value as LocalizedText, options.locale)
  if (!raw) return ""

  const htmlChunks = createHtmlChunkStore()
  const pool = Array.isArray(options.imageUrls) ? options.imageUrls : []
  let result = raw.replace(/\[\[img:(\d+)\]\]/gi, (_match, nRaw: string) => {
    const idx = Number.parseInt(nRaw, 10) - 1
    if (!Number.isFinite(idx) || idx < 0 || idx >= pool.length) return ""
    const url = resolveMediaUrl(pool[idx])
    return htmlChunks.add(
      `<img class="markdown-inline-image" src="${escapeHtml(url)}" alt="image-${idx + 1}" loading="lazy" decoding="async" />`,
    )
  })

  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)|\[!([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt1, url1, alt2, url2) => {
      const alt = (alt1 ?? alt2 ?? "").trim()
      const url = (url1 ?? url2 ?? "").trim()
      return htmlChunks.add(
        `<img class="markdown-inline-image" src="${escapeHtml(resolveMediaUrl(url))}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`,
      )
    },
  )

  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    try {
      return htmlChunks.add(
        katex.renderToString(latex.trim(), {
          displayMode: true,
          throwOnError: false,
        }),
      )
    } catch {
      return htmlChunks.add(`<span class="katex-error">${escapeHtml(latex)}</span>`)
    }
  })

  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (_match, latex: string) => {
    try {
      return htmlChunks.add(
        katex.renderToString(latex.trim(), {
          displayMode: true,
          throwOnError: false,
        }),
      )
    } catch {
      return htmlChunks.add(`<span class="katex-error">${escapeHtml(latex)}</span>`)
    }
  })

  result = result.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$/g, (_match, latex: string) => {
    try {
      return htmlChunks.add(
        katex.renderToString(latex.trim(), {
          displayMode: false,
          throwOnError: false,
        }),
      )
    } catch {
      return htmlChunks.add(`<span class="katex-error">${escapeHtml(latex)}</span>`)
    }
  })

  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (_match, latex: string) => {
    try {
      return htmlChunks.add(
        katex.renderToString(latex.trim(), {
          displayMode: false,
          throwOnError: false,
        }),
      )
    } catch {
      return htmlChunks.add(`<span class="katex-error">${escapeHtml(latex)}</span>`)
    }
  })

  return htmlChunks.restore(
    escapeHtml(result)
      .replace(/\r\n/g, "\n")
      .replace(/\n/g, "<br />"),
  )
}

export function getDetachedImageUrls(imageUrls: string[] | undefined, sources: string[]) {
  const all = Array.isArray(imageUrls)
    ? imageUrls.filter((url) => typeof url === "string" && url.trim())
    : []
  if (all.length === 0) return all

  const source = sources.join("\n")
  const usedByToken = new Set<number>()
  const tokenRe = /\[\[img:(\d+)\]\]/gi
  let tokenMatch: RegExpExecArray | null
  while ((tokenMatch = tokenRe.exec(source)) !== null) {
    const idx = Number.parseInt(tokenMatch[1], 10) - 1
    if (Number.isFinite(idx) && idx >= 0) usedByToken.add(idx)
  }

  const usedByUrl = new Set<string>()
  const markdownRe = /!\[[^\]]*\]\(([^)]+)\)|\[![^\]]*\]\(([^)]+)\)/g
  let markdownMatch: RegExpExecArray | null
  while ((markdownMatch = markdownRe.exec(source)) !== null) {
    const url = String(markdownMatch[1] ?? markdownMatch[2] ?? "").trim()
    if (url) usedByUrl.add(resolveMediaUrl(url))
  }

  return all.filter((url, idx) => {
    if (usedByToken.has(idx)) return false
    return !usedByUrl.has(resolveMediaUrl(url))
  })
}

export function imageReferenceText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return value.map(imageReferenceText).join("\n")
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(imageReferenceText).join("\n")
  }
  return ""
}

export function RichText({
  value,
  locale,
  imageUrls,
  className,
  as = "span",
}: RichTextProps) {
  const html = useMemo(
    () => renderRichTextHtml(value, { locale, imageUrls }),
    [value, locale, imageUrls],
  )
  if (!html) return null
  const Component = as
  return (
    <Component
      className={cn("rich-text", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** Простой рендер «псевдомаркдауна»: ## заголовки, абзацы, **жирный**. */

import type { ReactNode } from "react"

function parseBold(line: string): ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/)
    if (m) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {m[1]}
        </strong>
      )
    }
    return part
  })
}

export function MarkdownIshDocument({ source }: { source: string }) {
  const lines = source.split("\n")
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2
          key={key++}
          className="mt-10 scroll-mt-24 text-xl font-semibold tracking-tight text-foreground first:mt-0"
        >
          {trimmed.slice(3)}
        </h2>,
      )
      i++
      continue
    }

    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("## ")) {
      para.push(lines[i].trimEnd())
      i++
    }
    blocks.push(
      <p key={key++} className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base md:leading-7">
        {parseBold(para.join(" "))}
      </p>,
    )
  }

  return <div className="legal-doc">{blocks}</div>
}

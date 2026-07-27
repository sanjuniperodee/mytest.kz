"use client"

import { useLandingSettings } from "@/lib/api/landing"

function isSafeSocialUrl(value: string, hosts: string[]) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && hosts.includes(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function SocialLinks() {
  const { data } = useLandingSettings()
  const items = [
    {
      label: "Instagram",
      href: data?.instagramUrl,
      hosts: ["instagram.com", "www.instagram.com"],
    },
    {
      label: "TikTok",
      href: data?.tiktokUrl,
      hosts: ["tiktok.com", "www.tiktok.com"],
    },
    {
      label: "WhatsApp",
      href: data?.whatsappUrl,
      hosts: ["wa.me", "api.whatsapp.com", "www.whatsapp.com"],
    },
  ].filter((item): item is typeof item & { href: string } => {
    return Boolean(item.href && isSafeSocialUrl(item.href, item.hosts))
  })

  if (items.length === 0) return null

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center rounded-full border border-border px-3.5 text-xs font-medium hover:border-foreground/40 hover:bg-secondary"
        >
          {item.label}
        </a>
      ))}
    </div>
  )
}

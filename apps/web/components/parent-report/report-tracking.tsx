"use client"

import { useEffect, type ComponentProps } from "react"
import { recordPublicFunnelEvent } from "@/lib/api/analytics"

/** Один раз отмечает, что родитель открыл отчёт (без токена: путь вырезает analyticsPath). */
export function ParentReportViewBeacon({ lang }: { lang: string }) {
  useEffect(() => {
    void recordPublicFunnelEvent("parent_report_viewed", { lang })
  }, [lang])
  return null
}

/** Ссылка-CTA отчёта с отметкой клика; placement — какая кнопка. */
export function ParentReportCtaLink({
  placement,
  onClick,
  ...props
}: ComponentProps<"a"> & { placement: string }) {
  return (
    <a
      {...props}
      onClick={(event) => {
        void recordPublicFunnelEvent("parent_report_cta", { placement })
        onClick?.(event)
      }}
    />
  )
}

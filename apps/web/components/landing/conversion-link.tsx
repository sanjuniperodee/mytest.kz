"use client"

import Link from "next/link"
import type { ComponentProps } from "react"
import { recordPublicFunnelEvent } from "@/lib/api/analytics"

type ConversionLinkProps = ComponentProps<typeof Link> & {
  placement: string
}

export function ConversionLink({
  placement,
  onClick,
  ...props
}: ConversionLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        void recordPublicFunnelEvent("landing_cta", { placement })
        onClick?.(event)
      }}
    />
  )
}

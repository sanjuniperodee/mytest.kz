"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { SWRConfig } from "swr"
import { AuthProvider } from "@/lib/api/auth-context"
import { fetcher } from "@/lib/api/swr"
import { UiI18nProvider } from "@/lib/i18n/ui"
import { recordVisit } from "@/lib/api/analytics"

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    void recordVisit()
  }, [pathname])

  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }}
    >
      <AuthProvider scope="user">
        <UiI18nProvider>{children}</UiI18nProvider>
      </AuthProvider>
    </SWRConfig>
  )
}

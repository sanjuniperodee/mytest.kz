"use client"

import { SWRConfig } from "swr"
import { AuthProvider } from "@/lib/api/auth-context"
import { fetcher } from "@/lib/api/swr"
import { UiI18nProvider } from "@/lib/i18n/ui"

export function Providers({ children }: { children: React.ReactNode }) {
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

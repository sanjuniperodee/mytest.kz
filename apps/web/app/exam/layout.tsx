"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { rememberLoginNext } from "@/lib/api/login-return"
import { useAuth } from "@/lib/api/auth-context"
import { Spinner } from "@/components/ui/spinner"

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      rememberLoginNext(pathname)
      router.replace("/login")
    }
  }, [isAuthenticated, isLoading, pathname, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  return <div className="min-h-svh bg-background">{children}</div>
}

"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, BookOpen, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { ExamType } from "@/lib/api/types"

export default function ExamsPage() {
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const { data, isLoading } = useSWR<ExamType[]>("/exams/types")
  const items = Array.isArray(data) ? data : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="size-3" />
            Каталог пробников
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Экзамены</h1>
        <p className="text-muted-foreground">
          Выберите тип экзамена, чтобы начать пробное тестирование
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Каталог экзаменов пока пуст
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ex) => {
            const name = localize(ex.name, locale, "Экзамен")
            const description = localize(ex.description, locale)
            return (
              <Link
                key={ex.id}
                href={`/dashboard/exams/${ex.id}`}
                className="group block"
              >
                <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md">
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
                      <BookOpen className="size-5" />
                    </div>
                    <Badge variant="secondary" className="font-mono uppercase tracking-wider">
                      {ex.slug || ex.code || "exam"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <CardTitle className="text-lg leading-tight">{name}</CardTitle>
                    {description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center gap-1 text-sm font-medium text-foreground/80">
                      Открыть
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

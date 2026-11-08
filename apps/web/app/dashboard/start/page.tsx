"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Spinner } from "@/components/ui/spinner"
import type { ExamType } from "@/lib/api/types"

/**
 * Короткий адрес «начать бесплатный пробный ЕНТ». Сюда ведут кнопки с SEO-страниц
 * и лендинга через /login?next=… — id типа экзамена в URL не зашит, ищем ЕНТ по slug.
 */
export default function StartEntPage() {
  const router = useRouter()
  const { data: types, error } = useSWR<ExamType[]>("/exams/types")

  useEffect(() => {
    if (!types) return
    const ent = types.find((type) => (type.slug ?? type.code) === "ent") ?? types[0]
    router.replace(ent ? `/dashboard/exams/${ent.id}` : "/dashboard/exams")
  }, [router, types])

  if (error) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <p className="font-semibold">Не удалось открыть пробный ЕНТ</p>
        <Link href="/dashboard/exams" className="text-sm font-medium underline underline-offset-4">
          Перейти к списку тестов
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

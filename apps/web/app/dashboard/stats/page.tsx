"use client"

import useSWR from "swr"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/api/auth-context"
import { BarChart3 } from "lucide-react"

type EntHistorySession = {
  sessionId: string
  date: string | null
  rawScore: number | null
  maxScore: number | null
  score: number | null
  correctCount: number | null
  totalQuestions: number
  language: string | null
  metadata: { profileSubjectIds?: string[] } | null
}

type EntHistoryResponse = {
  sessions: EntHistorySession[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function TooltipScore(props: { raw: number | null; max: number | null }) {
  const score = props.raw != null ? props.raw : "-"
  const mx = props.max != null ? props.max : "-"
  return <span>{score} / {mx}</span>
}

function CustomTooltip(props: {
  active?: boolean
  payload?: Array<{ value: number; payload: EntHistorySession }>
}) {
  if (!props.active || !props.payload?.length) return null
  const item = props.payload[0]
  const session = item.payload
  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-md text-sm">
      <p className="font-medium">{formatDate(session.date)}</p>
      <p className="text-muted-foreground">
        <TooltipScore raw={session.rawScore} max={session.maxScore} />
      </p>
      {session.language ? (
        <p className="text-muted-foreground">Язык: {session.language}</p>
      ) : null}
    </div>
  )
}

export default function StatsPage() {
  const { user } = useAuth()

  const { data, isLoading } = useSWR<EntHistoryResponse>("/users/me/ent-history")

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const sessions = data?.sessions ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <BarChart3 className="size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Динамика ЕНТ</h1>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Пока нет данных. Сдайте первый пробный ЕНТ, чтобы увидеть график.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Прогресс по попыткам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={sessions}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleDateString("ru-RU", {
                          day: "2-digit",
                          month: "short",
                        })
                      }
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      domain={[0, "dataMax + 10"]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="rawScore"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">История попыток</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Дата</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Балл</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Макс</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">%</th>
                    <th className="pb-2 text-center font-medium text-muted-foreground">Язык</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...sessions].reverse().map((s) => {
                    const pct =
                      s.rawScore != null && s.maxScore != null && s.maxScore > 0
                        ? Math.round((s.rawScore / s.maxScore) * 100)
                        : null
                    return (
                      <tr key={s.sessionId}>
                        <td className="py-2">{formatDate(s.date)}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {s.rawScore ?? "-"}
                        </td>
                        <td className="py-2 text-right tabular-nums">{s.maxScore ?? "-"}</td>
                        <td className="py-2 text-right tabular-nums">
                          {pct != null ? `${pct}%` : "-"}
                        </td>
                        <td className="py-2 text-center uppercase">{s.language ?? "-"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

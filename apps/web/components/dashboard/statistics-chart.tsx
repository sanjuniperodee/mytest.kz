"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { StatisticsAttempt } from "@/lib/api/statistics-types"
import { localize } from "@/lib/api/i18n"

export function StatisticsChart({
  attempts,
  language,
}: {
  attempts: StatisticsAttempt[]
  language: "ru" | "kk"
}) {
  const date = (value: string) =>
    new Date(value).toLocaleDateString(language === "kk" ? "kk-KZ" : "ru-RU", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Almaty",
    })
  const data = attempts.map((attempt, index) => ({ ...attempt, index }))
  return (
    <div
      className="my-6 h-64 min-w-0"
      data-testid="statistics-chart"
      role="img"
      aria-label={
        language === "kk"
          ? "Нәтижелер пайызы, әрекеттер ретімен. Деректер төмендегі тарихта қолжетімді."
          : "Проценты результатов по порядку попыток. Данные доступны в истории ниже."
      }
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, left: -20, bottom: 0 }}
          accessibilityLayer
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="index"
            type="category"
            tickFormatter={(index) => date(data[Number(index)]?.date)}
            stroke="var(--muted-foreground)"
            fontSize={11}
            minTickGap={32}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(value) => `${value}%`}
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as StatisticsAttempt | undefined
              if (!active || !row) return null
              return (
                <div className="max-w-64 rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-sm">
                  <p className="font-medium">
                    {localize(row.examName, language, "")} · {date(row.date)}
                  </p>
                  <p className="mt-1 tabular-nums">
                    {row.percent}%
                    {row.rawScore != null &&
                      row.maxScore != null &&
                      ` · ${row.rawScore} / ${row.maxScore}`}
                  </p>
                </div>
              )
            }}
          />
          <Line
            type="linear"
            dataKey="percent"
            stroke="var(--foreground)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, fill: "var(--card)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

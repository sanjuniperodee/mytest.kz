"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export interface EntProgressPoint {
  attempt: number
  score: number
}

export function EntProgressLineChart({ data }: { data: EntProgressPoint[] }) {
  return (
    <ChartContainer
      config={{
        score: { label: "Результат", color: "var(--foreground)" },
      }}
      className="h-64 w-full"
    >
      <LineChart data={data} margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="attempt"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `#${value}`}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={34}
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel indicator="line" />}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--color-score)"
          strokeWidth={3}
          dot={{ r: 4 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartContainer>
  )
}

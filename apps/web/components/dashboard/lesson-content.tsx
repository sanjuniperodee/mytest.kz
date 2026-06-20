"use client"

import type { ReactNode } from "react"
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  LineChart as LineChartIcon,
  ListChecks,
  Sparkles,
  Wand2,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { RichText } from "@/components/exam/rich-text"
import { cn } from "@/lib/utils"
import type { AiTopicLesson } from "@/lib/api/types"

export const LESSON_SECTIONS = [
  { id: "teoriya", label: "Теория" },
  { id: "formuly", label: "Формулы" },
  { id: "vizualizacii", label: "Визуализации" },
  { id: "primery", label: "Разбор примеров" },
  { id: "praktika", label: "Практика" },
  { id: "lovushki", label: "Типичные ловушки" },
  { id: "chek-list", label: "Чек-лист" },
  { id: "mini-test", label: "Мини-тест" },
] as const

export type LessonSectionId = (typeof LESSON_SECTIONS)[number]["id"]

export function getPresentLessonSections(lesson: AiTopicLesson) {
  return LESSON_SECTIONS.filter((section) => {
    switch (section.id) {
      case "teoriya":
        return lesson.sections.length > 0
      case "formuly":
        return lesson.formulas.length > 0
      case "vizualizacii":
        return lesson.visualizations.length > 0
      case "primery":
        return lesson.workedExamples.length > 0
      case "praktika":
        return lesson.practice.length > 0
      case "lovushki":
        return lesson.commonTraps.length > 0
      case "chek-list":
        return lesson.checklist.length > 0
      case "mini-test":
        return lesson.miniTest.length > 0
    }
  })
}

type LessonTask = {
  prompt: string
  options?: string[]
  answer: string
  explanation: string
}

export function LessonContent({
  lesson,
  language,
}: {
  lesson: AiTopicLesson
  language: "ru" | "kk"
}) {
  return (
    <div className="flex flex-col gap-6">
      {lesson.sections.length > 0 && (
        <LessonSection id="teoriya" icon={<BookOpen className="size-4" />} title="Теория">
          <div className="grid gap-4">
            {lesson.sections.map((section, index) => (
              <div key={`${section.title}-${index}`} className="rounded-xl border border-border p-4">
                <RichText value={section.title} locale={language} as="div" className="font-semibold" />
                <RichText
                  value={section.content}
                  locale={language}
                  as="div"
                  className="mt-2 text-sm leading-6 text-muted-foreground"
                />
              </div>
            ))}
          </div>
        </LessonSection>
      )}

      {lesson.formulas.length > 0 && (
        <LessonSection id="formuly" icon={<Wand2 className="size-4" />} title="Формулы">
          <div className="grid gap-3">
            {lesson.formulas.map((formula, index) => (
              <div key={`${formula.latex}-${index}`} className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                <RichText value={`$$${formula.latex}$$`} locale={language} as="div" className="overflow-x-auto" />
                {formula.note && (
                  <RichText value={formula.note} locale={language} as="div" className="mt-2 text-sm leading-6 text-violet-950" />
                )}
              </div>
            ))}
          </div>
        </LessonSection>
      )}

      {lesson.visualizations.length > 0 && (
        <LessonSection id="vizualizacii" icon={<BarChart3 className="size-4" />} title="Визуализации">
          <div className="grid gap-4">
            {lesson.visualizations.map((visual, index) => (
              <LessonVisualization key={`${visual.title}-${visual.type}-${index}`} visual={visual} language={language} />
            ))}
          </div>
        </LessonSection>
      )}

      {lesson.workedExamples.length > 0 && (
        <LessonSection id="primery" icon={<ClipboardCheck className="size-4" />} title="Разбор примеров">
          <div className="grid gap-4">
            {lesson.workedExamples.map((example, index) => (
              <div key={`${example.title}-${index}`} className="rounded-xl border border-border p-4">
                <RichText value={example.title || `Пример ${index + 1}`} locale={language} as="div" className="font-semibold" />
                <RichText value={example.question} locale={language} as="div" className="mt-2 text-sm leading-6" />
                {example.steps.length > 0 && (
                  <ol className="mt-3 grid gap-2">
                    {example.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground">{stepIndex + 1}.</span>
                        <RichText value={step} locale={language} as="div" className="min-w-0 flex-1 leading-6" />
                      </li>
                    ))}
                  </ol>
                )}
                {example.answer && (
                  <RichText
                    value={example.answer}
                    locale={language}
                    as="div"
                    className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-950"
                  />
                )}
                {example.trap && (
                  <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <RichText value={example.trap} locale={language} as="div" className="leading-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </LessonSection>
      )}

      {lesson.practice.length > 0 && (
        <LessonSection id="praktika" icon={<Sparkles className="size-4" />} title="Практика">
          <TaskList tasks={lesson.practice} language={language} />
        </LessonSection>
      )}

      {(lesson.commonTraps.length > 0 || lesson.checklist.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {lesson.commonTraps.length > 0 && (
            <LessonSection id="lovushki" icon={<AlertTriangle className="size-4" />} title="Типичные ловушки">
              <BulletList items={lesson.commonTraps} language={language} tone="amber" />
            </LessonSection>
          )}
          {lesson.checklist.length > 0 && (
            <LessonSection id="chek-list" icon={<ListChecks className="size-4" />} title="Чек-лист">
              <BulletList items={lesson.checklist} language={language} tone="emerald" />
            </LessonSection>
          )}
        </div>
      )}

      {lesson.miniTest.length > 0 && (
        <LessonSection id="mini-test" icon={<CheckCircle2 className="size-4" />} title="Мини-тест">
          <TaskList tasks={lesson.miniTest} language={language} />
        </LessonSection>
      )}
    </div>
  )
}

function LessonSection({
  id,
  icon,
  title,
  children,
}: {
  id: LessonSectionId
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section id={`sec-${id}`} className="scroll-mt-24 flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function LessonVisualization({
  visual,
  language,
}: {
  visual: AiTopicLesson["visualizations"][number]
  language: "ru" | "kk"
}) {
  if (visual.type === "table") {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-secondary/50 p-3">
          <RichText value={visual.title} locale={language} as="div" className="text-sm font-semibold" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  <RichText value={visual.xLabel || "Пункт"} locale={language} as="div" />
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  <RichText value={visual.yLabel || "Значение"} locale={language} as="div" />
                </th>
                {visual.data.some((point) => point.secondValue != null) && (
                  <th className="px-3 py-2 text-left font-medium">
                    <RichText value="Доп." locale={language} as="div" />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visual.data.map((point, index) => (
                <tr key={`${point.label}-${index}`} className="border-t border-border">
                  <td className="px-3 py-2">
                    <RichText value={point.label} locale={language} as="div" />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{point.value}</td>
                  {visual.data.some((item) => item.secondValue != null) && (
                    <td className="px-3 py-2 tabular-nums">{point.secondValue ?? ""}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const hasSecondValue = visual.data.some((point) => point.secondValue != null)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        {visual.type === "line" ? (
          <LineChartIcon className="size-4 shrink-0 text-emerald-600" />
        ) : (
          <BarChart3 className="size-4 shrink-0 text-emerald-600" />
        )}
        <RichText value={visual.title} locale={language} as="div" className="min-w-0 text-sm font-semibold" />
      </div>
      <ChartContainer
        config={{
          value: { label: visual.yLabel || "Значение", color: "var(--chart-4)" },
          secondValue: { label: "Доп.", color: "var(--chart-2)" },
        }}
        className="h-64 w-full"
      >
        {visual.type === "line" ? (
          <LineChart data={visual.data} margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot />
            {hasSecondValue && (
              <Line type="monotone" dataKey="secondValue" stroke="var(--color-secondValue)" strokeWidth={2} dot />
            )}
          </LineChart>
        ) : (
          <BarChart data={visual.data} margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
            {hasSecondValue && <Bar dataKey="secondValue" fill="var(--color-secondValue)" radius={[4, 4, 0, 0]} />}
          </BarChart>
        )}
      </ChartContainer>
    </div>
  )
}

function BulletList({
  items,
  language,
  tone,
}: {
  items: string[]
  language: "ru" | "kk"
  tone: "amber" | "emerald"
}) {
  return (
    <ul className="grid gap-2">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className={cn(
            "rounded-lg p-3 text-sm leading-6",
            tone === "amber" ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950",
          )}
        >
          <RichText value={item} locale={language} as="div" />
        </li>
      ))}
    </ul>
  )
}

function TaskList({
  tasks,
  language,
}: {
  tasks: LessonTask[]
  language: "ru" | "kk"
}) {
  return (
    <div className="grid gap-3">
      {tasks.map((task, index) => {
        const options = task.options ?? []
        return (
          <div key={`${task.prompt}-${index}`} className="rounded-xl border border-border p-4">
            <div className="flex gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                {index + 1}
              </span>
              <RichText value={task.prompt} locale={language} as="div" className="min-w-0 flex-1 text-sm font-medium leading-6" />
            </div>
            {options.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {options.map((option, optionIndex) => (
                  <div key={`${option}-${optionIndex}`} className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-muted-foreground">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <RichText value={option} locale={language} as="div" className="min-w-0 flex-1 leading-6" />
                  </div>
                ))}
              </div>
            )}
            {task.answer && (
              <RichText
                value={task.answer}
                locale={language}
                as="div"
                className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-950"
              />
            )}
            {task.explanation && (
              <RichText
                value={task.explanation}
                locale={language}
                as="div"
                className="mt-2 rounded-lg border border-border bg-card p-3 text-sm leading-6 text-muted-foreground"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

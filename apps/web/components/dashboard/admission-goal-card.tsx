"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Target } from "lucide-react"
import { toast } from "sonner"
import { ApiError, api } from "@/lib/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type {
  AdmissionCutoffRow,
  AdmissionCycle,
  AdmissionGoal,
  AdmissionGoalResponse,
  University,
} from "@/lib/api/types"
import { useUiI18n } from "@/lib/i18n/ui"

type AdmissionGoalCardProps = {
  currentScore: number | null
  potentialScore: number | null
  maxScore?: number
}

type PickerStep = "university" | "program"

export function AdmissionGoalCard({
  currentScore,
  potentialScore,
  maxScore = 140,
}: AdmissionGoalCardProps) {
  const { data, mutate, isLoading, error } = useSWR<AdmissionGoalResponse>("/admission/goal")
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => locale === "kk" ? kk : ru
  const [open, setOpen] = React.useState(false)
  const goal = data?.goal ?? null

  if (isLoading) {
    return <Skeleton className="h-56 rounded-xl" />
  }

  if (error && !data) return <Card><CardContent className="space-y-3" data-no-translate><p role="alert" className="text-sm text-muted-foreground">{t("Не удалось загрузить цель поступления.", "Оқуға түсу мақсаты жүктелмеді.")}</p><Button variant="outline" size="sm" onClick={() => void mutate()}>{t("Повторить", "Қайталау")}</Button></CardContent></Card>

  return (
    <>
      <Card className="gap-4 rounded-xl border bg-card py-5">
        <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-2 px-5">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Target className="size-4" aria-hidden="true" />
            </span>
            Цель поступления
          </CardTitle>
          {goal && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              Изменить цель
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-5">
          {goal ? (
            <GoalContent
              goal={goal}
              currentScore={currentScore}
              potentialScore={potentialScore}
              maxScore={maxScore}
            />
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-4" data-no-translate>
              <p className="max-w-md text-sm text-muted-foreground">
                {t("Выберите вуз и специальность, чтобы сравнивать свой результат с опубликованным проходным баллом.", "Нәтижеңізді жарияланған өту балымен салыстыру үшін ЖОО мен мамандықты таңдаңыз.")}
              </p>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Target className="size-4" aria-hidden="true" />
                {t("Выбрать цель", "Мақсатты таңдау")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <GoalPickerDialog open={open} onOpenChange={setOpen} goal={goal} onMutate={mutate} />
    </>
  )
}

function GoalContent({
  goal,
  currentScore,
  potentialScore,
  maxScore,
}: {
  goal: AdmissionGoal
  currentScore: number | null
  potentialScore: number | null
  maxScore: number
}) {
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => locale === "kk" ? kk : ru
  const missing = goal.requiredScore != null && currentScore != null ? Math.max(0, goal.requiredScore - currentScore) : null

  return (
    <div className="flex flex-col gap-5">
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold">
          {goal.universityShortName || goal.universityName}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {goal.programCode} · {goal.programName}
        </p>
        {goal.profileSubjects && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {goal.profileSubjects}
          </p>
        )}
      </div>

      <ScoreBar
        currentScore={currentScore}
        potentialScore={potentialScore}
        requiredScore={goal.requiredScore}
        maxScore={maxScore}
      />

      <div className="grid grid-cols-2 gap-2" data-no-translate>
        <GoalMetric label={t("Проходной балл", "Өту балы")} value={formatScore(goal.requiredScore)} />
        <GoalMetric label={t("Ваш пробный", "Сіздің сынағыңыз")} value={formatScore(currentScore)} />
      </div>

      <div className="space-y-2 text-sm" data-no-translate>
        <p>{missing == null ? t("Пройдите полный пробный и сравните результат с целью, когда оба балла будут доступны.", "Толық сынақтан өтіп, екі балл да қолжетімді болғанда нәтижені мақсатпен салыстырыңыз.") : missing > 0 ? t(`До ориентира: ${missing} баллов.`, `Бағдарға дейін: ${missing} балл.`) : t("Результат пробного не ниже указанного ориентира.", "Сынақ нәтижесі көрсетілген бағдардан төмен емес.")}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("Проходной балл — ориентир по опубликованным данным, не гарантия получения гранта.", "Өту балы — жарияланған деректер бойынша бағдар, грант алуға кепілдік емес.")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/admission">Шанс на грант</Link>
        </Button>
      </div>
    </div>
  )
}

function GoalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-secondary/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ScoreBar({
  currentScore,
  potentialScore,
  requiredScore,
  maxScore,
}: {
  currentScore: number | null
  potentialScore: number | null
  requiredScore: number | null
  maxScore: number
}) {
  const currentPct = scorePct(currentScore, maxScore)
  const potentialPct = scorePct(potentialScore, maxScore)
  const extensionStart = Math.min(currentPct, potentialPct)
  const extensionWidth = Math.max(0, potentialPct - currentPct)
  const requiredPct = scorePct(requiredScore, maxScore)

  return (
    <div className="pt-5">
      <div
        className="relative h-3 overflow-visible rounded-full bg-secondary"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={maxScore}
        aria-valuenow={currentScore ?? undefined}
        aria-label="Баллы до цели поступления"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-foreground"
          style={{ width: `${currentPct}%` }}
        />
        {extensionWidth > 0 && (
          <div
            className="absolute inset-y-0 rounded-full border border-emerald-600/50 bg-[repeating-linear-gradient(135deg,rgba(5,150,105,0.35)_0,rgba(5,150,105,0.35)_5px,rgba(16,185,129,0.12)_5px,rgba(16,185,129,0.12)_10px)]"
            style={{ left: `${extensionStart}%`, width: `${extensionWidth}%` }}
          />
        )}
        {requiredScore != null && (
          <div
            className="absolute -top-5 bottom-[-0.35rem] w-px bg-emerald-700"
            style={{ left: `${requiredPct}%` }}
          >
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              грант {requiredScore}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>0</span>
        <span>{maxScore}</span>
      </div>
    </div>
  )
}

function GoalPickerDialog({
  open,
  onOpenChange,
  goal,
  onMutate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: AdmissionGoal | null
  onMutate: () => Promise<AdmissionGoalResponse | undefined>
}) {
  const [step, setStep] = React.useState<PickerStep>("university")
  const [selectedUniversity, setSelectedUniversity] = React.useState<University | null>(null)
  const [search, setSearch] = React.useState("")
  const [savingProgramId, setSavingProgramId] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState(false)
  const { data: universities, isLoading: universitiesLoading } =
    useSWR<University[]>(open ? "/admission/universities" : null)
  const { data: cycles } = useSWR<AdmissionCycle[]>(open ? "/admission/cycles" : null)
  const latestCycle = React.useMemo(() => pickLatestCycle(cycles), [cycles])
  const cycleSlug = latestCycle?.slug
  const universityCode = selectedUniversity?.code
  const cutoffKey =
    open && step === "program" && cycleSlug && universityCode != null
      ? `/admission/cutoffs:${cycleSlug}:${universityCode}`
      : null
  const { data: programs, isLoading: programsLoading } = useSWR<AdmissionCutoffRow[]>(
    cutoffKey,
    () =>
      api<AdmissionCutoffRow[]>("/admission/cutoffs", {
        query: { cycleSlug, universityCode, quotaType: "GRANT" },
      }),
  )

  React.useEffect(() => {
    if (!open) {
      setStep("university")
      setSelectedUniversity(null)
      setSearch("")
      setSavingProgramId(null)
      setRemoving(false)
    }
  }, [open])

  const filteredUniversities = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    const items = universities ?? []
    if (!query) return items
    return items.filter((university) => {
      const name = university.name.toLowerCase()
      const shortName = (university.shortName ?? "").toLowerCase()
      return name.includes(query) || shortName.includes(query)
    })
  }, [search, universities])

  async function saveGoal(row: AdmissionCutoffRow) {
    if (!selectedUniversity || !cycleSlug) return
    setSavingProgramId(row.programId)
    try {
      await api("/admission/goal", {
        method: "PUT",
        body: {
          universityCode: selectedUniversity.code,
          programId: row.programId,
          cycleSlug,
        },
      })
      await onMutate()
      onOpenChange(false)
      toast.success("Цель сохранена")
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось сохранить цель"))
    } finally {
      setSavingProgramId(null)
    }
  }

  async function removeGoal() {
    setRemoving(true)
    try {
      await api("/admission/goal", { method: "DELETE" })
      await onMutate()
      onOpenChange(false)
      toast.success("Цель снята")
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось снять цель"))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Выбрать цель поступления</DialogTitle>
          <DialogDescription>
            {step === "university"
              ? "Сначала выбери вуз."
              : "Теперь выбери специальность с проходным баллом гранта."}
          </DialogDescription>
        </DialogHeader>

        {step === "university" ? (
          <div className="flex flex-col gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по вузу"
            />
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              {universitiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : filteredUniversities.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Вузы не найдены
                </p>
              ) : (
                <div className="flex flex-col p-1">
                  {filteredUniversities.map((university) => (
                    <button
                      key={university.code}
                      type="button"
                      className="rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        setSelectedUniversity(university)
                        setStep("program")
                      }}
                    >
                      <span className="block font-medium">
                        {university.shortName || university.name}
                      </span>
                      {university.shortName && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {university.name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setStep("university")}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              назад
            </Button>
            <div className="rounded-lg bg-secondary/40 px-3 py-2 text-sm">
              <p className="font-medium">
                {selectedUniversity?.shortName || selectedUniversity?.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Цикл: {cycleSlug ?? "—"}
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              {programsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : !cycleSlug ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Приёмный цикл пока не найден
                </p>
              ) : (programs ?? []).length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Для этого вуза нет опубликованных специальностей
                </p>
              ) : (
                <div className="flex flex-col p-1">
                  {(programs ?? []).map((row) => (
                    <button
                      key={`${row.programId}-${row.profileVariant}-${row.quotaType}`}
                      type="button"
                      className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={savingProgramId != null}
                      onClick={() => void saveGoal(row)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {row.programCode} {row.programName}
                        </span>
                        {row.profileSubjects && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.profileSubjects}
                          </span>
                        )}
                      </span>
                      <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        {savingProgramId === row.programId ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <>грант {formatScore(row.minScore)}</>
                        )}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {goal && (
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void removeGoal()}
              disabled={removing}
            >
              {removing ? <Spinner className="size-4" /> : null}
              Снять цель
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function pickLatestCycle(cycles?: AdmissionCycle[]): AdmissionCycle | null {
  if (!cycles || cycles.length === 0) return null
  return cycles.reduce((latest, cycle) => {
    const latestOrder = latest.sortOrder ?? Number.NEGATIVE_INFINITY
    const cycleOrder = cycle.sortOrder ?? Number.NEGATIVE_INFINITY
    if (cycleOrder > latestOrder) return cycle
    if (cycleOrder === latestOrder && cycle.slug.localeCompare(latest.slug) > 0) return cycle
    return latest
  })
}

function scorePct(score: number | null, maxScore: number) {
  if (score == null || maxScore <= 0) return 0
  return Math.max(0, Math.min(100, (score / maxScore) * 100))
}

function formatScore(score: number | null) {
  return score == null ? "—" : String(score)
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback
}

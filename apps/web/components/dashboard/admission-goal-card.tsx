"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, ArrowRight, Target } from "lucide-react"
import { toast } from "sonner"
import { admissionChance } from "@bilimland/shared"
import { ApiError, api } from "@/lib/api/client"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import type {
  AdmissionCutoffRow,
  AdmissionCycle,
  AdmissionGoal,
  AdmissionGoalResponse,
  AdmissionHistoryPoint,
  University,
} from "@/lib/api/types"
import { ChanceBadge, grantsLabel, ruPlural, useT } from "@/components/admission/chance"

type AdmissionGoalCardProps = {
  /** Best full ЕНТ trial score. */
  currentScore: number | null
  /** Best score + points recoverable by working through open mistakes. */
  potentialScore: number | null
  maxScore?: number
}

type PickerStep = "university" | "program"
type QuotaType = "GRANT" | "RURAL"

export function AdmissionGoalCard({ currentScore, potentialScore, maxScore = 140 }: AdmissionGoalCardProps) {
  const { data, mutate, isLoading, error } = useSWR<AdmissionGoalResponse>("/admission/goal")
  const t = useT()
  const [open, setOpen] = React.useState(false)
  const goal = data?.goal ?? null

  if (isLoading) {
    return <Skeleton className="h-56 rounded-xl" />
  }

  if (error && !data)
    return (
      <Card>
        <CardContent className="space-y-3" data-no-translate>
          <p role="alert" className="text-sm text-muted-foreground">
            {t("Не удалось загрузить цель поступления.", "Оқуға түсу мақсаты жүктелмеді.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => void mutate()}>
            {t("Повторить", "Қайталау")}
          </Button>
        </CardContent>
      </Card>
    )

  return (
    <>
      <Card className="gap-4 rounded-xl border bg-card py-5">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-5" data-no-translate>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Target className="size-4" aria-hidden="true" />
            </span>
            {t("Цель поступления", "Түсу мақсаты")}
          </CardTitle>
          {goal && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              {t("Изменить", "Өзгерту")}
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
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t("Куда хочешь поступить?", "Қайда түскіңіз келеді?")}
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t(
                    "Выбери вуз и специальность — покажем проходной балл на грант за последние годы и сколько тебе не хватает по результатам пробных.",
                    "ЖОО мен мамандықты таңдаңыз — соңғы жылдардағы грантқа өту балын және сынақ нәтижелері бойынша қанша жетпейтінін көрсетеміз.",
                  )}
                </p>
              </div>
              <Button size="sm" onClick={() => setOpen(true)}>
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
  const t = useT()
  const required = goal.requiredScore
  const gap = required != null && currentScore != null ? currentScore - required : null
  // The trial total already respects the ЕНТ format; per-subject thresholds are unknown here.
  const chance =
    required != null && currentScore != null
      ? admissionChance(currentScore, currentScore >= 50, required, goal.avgScore ?? null)
      : null
  const potentialGap = required != null && potentialScore != null ? potentialScore - required : null
  const year = goal.admissionYear
  const quotaLabel =
    goal.quotaType === "RURAL" ? t("сельская квота", "ауыл квотасы") : t("общий конкурс", "жалпы конкурс")

  const calculatorHref = `/dashboard/admission?${new URLSearchParams({
    ...(goal.profileSubjects ? { profileSubjects: goal.profileSubjects } : {}),
    programId: goal.programId,
    uni: String(goal.universityCode),
    quota: goal.quotaType,
    tab: "universities",
    ...(currentScore != null ? { total: String(currentScore) } : {}),
  }).toString()}`

  return (
    <div className="flex flex-col gap-5" data-no-translate>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-lg font-semibold">{goal.universityShortName || goal.universityName}</p>
          {chance && <ChanceBadge level={chance} />}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {goal.programCode} · {goal.programName}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {[goal.profileSubjects, quotaLabel].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* The one sentence a student needs */}
      <div
        className={cn(
          "rounded-lg px-3 py-2.5 text-sm",
          gap == null
            ? "bg-secondary/50"
            : gap >= 0
              ? "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
              : "bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-100",
        )}
      >
        {required == null ? (
          t(
            "По этой цели в последнем конкурсе грантов не было — выбери другую специальность или вуз.",
            "Соңғы конкурста бұл мақсат бойынша грант болған жоқ — басқа мамандық не ЖОО таңдаңыз.",
          )
        ) : currentScore == null ? (
          t(
            `Нужно от ${required} баллов${year ? ` (проходной ${year} года)` : ""}. Пройди полный пробный ЕНТ — сравним твой результат с целью.`,
            `${required} балдан бастап қажет${year ? ` (${year} жылғы өту балы)` : ""}. Толық ҰБТ сынағын тапсырыңыз — нәтижеңізді мақсатпен салыстырамыз.`,
          )
        ) : gap! >= 0 ? (
          t(
            gap === 0
              ? `Твой лучший пробный ${currentScore} — ровно проходной балл. Это на грани: добери запас.`
              : `Твой лучший пробный ${currentScore} — на ${gap} ${ruPlural(gap!, "балл", "балла", "баллов")} выше проходного ${required}.`,
            `Ең жақсы сынағыңыз ${currentScore} — өту балынан (${required}) ${gap} балға жоғары.`,
          )
        ) : (
          t(
            `До проходного балла ${required} не хватает ${-gap!} ${ruPlural(-gap!, "балла", "баллов", "баллов")}. Твой лучший пробный — ${currentScore}.`,
            `${required} өту балына ${-gap!} балл жетпейді. Ең жақсы сынағыңыз — ${currentScore}.`,
          )
        )}
        {potentialGap != null && gap != null && gap < 0 && potentialScore! > currentScore! && (
          <p className="mt-1 text-xs opacity-80">
            {potentialGap >= 0
              ? t(
                  `Если разобрать открытые ошибки, можно выйти на ${potentialScore} — это уже проходной.`,
                  `Ашық қателерді талдасаңыз, ${potentialScore} балға шығуға болады — бұл өту балы.`,
                )
              : t(
                  `Разбор открытых ошибок даст до ${potentialScore} баллов.`,
                  `Ашық қателерді талдау ${potentialScore} балға дейін береді.`,
                )}
          </p>
        )}
      </div>

      <ScoreBar
        currentScore={currentScore}
        potentialScore={potentialScore}
        requiredScore={required}
        avgScore={goal.avgScore ?? null}
        maxScore={maxScore}
      />

      <div className="grid grid-cols-3 gap-2">
        <GoalMetric
          label={year ? t(`Проходной ${year}`, `Өту балы ${year}`) : t("Проходной", "Өту балы")}
          value={formatScore(required)}
        />
        <GoalMetric
          label={t("Средний балл", "Орташа балл")}
          value={goal.avgScore != null ? String(Math.round(goal.avgScore)) : "—"}
        />
        <GoalMetric label={t("Лучший пробный", "Ең жақсы сынақ")} value={formatScore(currentScore)} />
      </div>

      {(goal.history?.length ?? 0) > 0 && <GoalHistory history={goal.history!} grantCount={goal.grantCount ?? null} />}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={calculatorHref}>
            {t("Все вузы по этой специальности", "Осы мамандық бойынша барлық ЖОО")}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
        {gap != null && gap < 0 && (
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/mistakes">{t("Работать над ошибками", "Қателермен жұмыс")}</Link>
          </Button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(
          "Проходной балл — самый низкий балл, с которым дали грант (официальный список МНВО). Каждый год он меняется на несколько баллов — это ориентир, не гарантия.",
          "Өту балы — грант берілген ең төменгі балл (ҒЖБМ ресми тізімі). Ол жыл сайын бірнеше балға өзгереді — бұл кепілдік емес, бағдар.",
        )}
      </p>
    </div>
  )
}

function GoalHistory({ history, grantCount }: { history: AdmissionHistoryPoint[]; grantCount: number | null }) {
  const t = useT()
  const scores = history.map((h) => h.minScore)
  const lo = Math.min(...scores)
  const hi = Math.max(...scores)
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t("Проходной по годам", "Жылдар бойынша өту балы")}</p>
        {grantCount ? (
          <p className="text-xs text-muted-foreground">
            {t("в последнем конкурсе", "соңғы конкурста")}: {grantsLabel(grantCount, t)}
          </p>
        ) : null}
      </div>
      <div className="flex items-end gap-2" role="list">
        {history.map((h, i) => {
          const heightPct = hi === lo ? 70 : 35 + ((h.minScore - lo) / (hi - lo)) * 65
          const last = i === history.length - 1
          return (
            <div key={h.cycleSlug} className="flex min-w-0 flex-1 flex-col items-center gap-1" role="listitem">
              <span className={cn("text-xs tabular-nums", last ? "font-semibold" : "text-muted-foreground")}>
                {h.minScore}
              </span>
              <div className="flex h-10 w-full items-end">
                <div
                  className={cn("w-full rounded-sm", last ? "bg-emerald-600" : "bg-muted-foreground/30")}
                  style={{ height: `${heightPct}%` }}
                  title={h.grantCount ? grantsLabel(h.grantCount, t) : undefined}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{h.admissionYear ?? h.cycleSlug}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GoalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-secondary/30 px-3 py-2">
      <p className="truncate text-[11px] text-muted-foreground" title={label}>
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ScoreBar({
  currentScore,
  potentialScore,
  requiredScore,
  avgScore,
  maxScore,
}: {
  currentScore: number | null
  potentialScore: number | null
  requiredScore: number | null
  avgScore: number | null
  maxScore: number
}) {
  const t = useT()
  const currentPct = scorePct(currentScore, maxScore)
  const potentialPct = scorePct(potentialScore, maxScore)
  const extensionStart = Math.min(currentPct, potentialPct)
  const extensionWidth = Math.max(0, potentialPct - currentPct)
  const requiredPct = scorePct(requiredScore, maxScore)
  const reached = currentScore != null && requiredScore != null && currentScore >= requiredScore

  return (
    <div className="pt-6">
      <div
        className="relative h-3 overflow-visible rounded-full bg-secondary"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={maxScore}
        aria-valuenow={currentScore ?? undefined}
        aria-label={t("Баллы до цели поступления", "Түсу мақсатына дейінгі балдар")}
      >
        {requiredScore != null && avgScore != null && avgScore > requiredScore && (
          // the band where last year's grant holders were: from the cutoff to their average
          <div
            className="absolute inset-y-0 rounded-full bg-emerald-500/15"
            style={{ left: `${requiredPct}%`, width: `${Math.max(0, scorePct(avgScore, maxScore) - requiredPct)}%` }}
          />
        )}
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", reached ? "bg-emerald-600" : "bg-foreground")}
          style={{ width: `${currentPct}%` }}
        />
        {extensionWidth > 0 && (
          <div
            className="absolute inset-y-0 rounded-full border border-emerald-600/50 bg-[repeating-linear-gradient(135deg,rgba(5,150,105,0.35)_0,rgba(5,150,105,0.35)_5px,rgba(16,185,129,0.12)_5px,rgba(16,185,129,0.12)_10px)]"
            style={{ left: `${extensionStart}%`, width: `${extensionWidth}%` }}
          />
        )}
        {requiredScore != null && (
          <div className="absolute -top-6 bottom-[-0.35rem] w-px bg-emerald-700" style={{ left: `${requiredPct}%` }}>
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              {t("проходной", "өту балы")} {requiredScore}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>0</span>
        {extensionWidth > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-sm bg-emerald-600/40" aria-hidden="true" />
            {t("после разбора ошибок", "қателерді талдағаннан кейін")}
          </span>
        )}
        <span>{maxScore}</span>
      </div>
    </div>
  )
}

/** Cutoff shown for a quota: a rural applicant competes in both pools, so the lower one counts. */
function displayedCutoff(rows: AdmissionCutoffRow[], quota: QuotaType) {
  const grant = rows.find((r) => r.quotaType === "GRANT" && r.minScore != null)
  const rural = rows.find((r) => r.quotaType === "RURAL" && r.minScore != null)
  if (quota === "GRANT") return grant ?? null
  if (rural && (!grant || rural.minScore! <= grant.minScore!)) return rural
  return grant ?? null
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
  const t = useT()
  const [step, setStep] = React.useState<PickerStep>("university")
  const [selectedUniversity, setSelectedUniversity] = React.useState<University | null>(null)
  const [search, setSearch] = React.useState("")
  const [programSearch, setProgramSearch] = React.useState("")
  const [quota, setQuota] = React.useState<QuotaType>(goal?.quotaType ?? "GRANT")
  const [savingProgramId, setSavingProgramId] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState(false)
  const { data: cycles } = useSWR<AdmissionCycle[]>(open ? "/admission/cycles" : null)
  const latestCycle = React.useMemo(() => pickLatestCycle(cycles), [cycles])
  const cycleSlug = latestCycle?.slug
  const { data: universities, isLoading: universitiesLoading } = useSWR<University[]>(
    open && cycleSlug ? `/admission/universities?cycleSlug=${encodeURIComponent(cycleSlug)}` : null,
  )
  const universityCode = selectedUniversity?.code
  const cutoffKey =
    open && step === "program" && cycleSlug && universityCode != null
      ? `/admission/cutoffs:${cycleSlug}:${universityCode}:all`
      : null
  const { data: cutoffRows, isLoading: programsLoading } = useSWR<AdmissionCutoffRow[]>(cutoffKey, () =>
    api<AdmissionCutoffRow[]>("/admission/cutoffs", { query: { cycleSlug, universityCode } }),
  )

  React.useEffect(() => {
    if (!open) {
      setStep("university")
      setSelectedUniversity(null)
      setSearch("")
      setProgramSearch("")
      setSavingProgramId(null)
      setRemoving(false)
    } else {
      setQuota(goal?.quotaType ?? "GRANT")
    }
  }, [open, goal?.quotaType])

  const filteredUniversities = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    const items = universities ?? []
    if (!query) return items
    return items.filter((university) => {
      const name = university.name.toLowerCase()
      const shortName = (university.shortName ?? "").toLowerCase()
      return name.includes(query) || shortName.includes(query) || String(university.code) === query
    })
  }, [search, universities])

  // One row per program (profile variant) with the cutoff for the chosen quota.
  const programs = React.useMemo(() => {
    const byProgram = new Map<string, AdmissionCutoffRow[]>()
    for (const row of cutoffRows ?? []) {
      const list = byProgram.get(row.programId) ?? []
      list.push(row)
      byProgram.set(row.programId, list)
    }
    const query = programSearch.trim().toLowerCase()
    return [...byProgram.values()]
      .map((rows) => ({ base: rows[0], cutoff: displayedCutoff(rows, quota) }))
      .filter((p) => p.cutoff != null)
      .filter(
        (p) =>
          !query ||
          p.base.programName.toLowerCase().includes(query) ||
          p.base.programCode.toLowerCase().includes(query) ||
          (p.base.profileSubjects ?? "").toLowerCase().includes(query),
      )
      .sort((a, b) => a.base.programCode.localeCompare(b.base.programCode) || a.base.profileVariant - b.base.profileVariant)
  }, [cutoffRows, programSearch, quota])

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
          quotaType: quota,
        },
      })
      await onMutate()
      onOpenChange(false)
      toast.success(t("Цель сохранена", "Мақсат сақталды"))
    } catch (error) {
      toast.error(errorMessage(error, t("Не удалось сохранить цель", "Мақсатты сақтау мүмкін болмады")))
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
      toast.success(t("Цель снята", "Мақсат алынып тасталды"))
    } catch (error) {
      toast.error(errorMessage(error, t("Не удалось снять цель", "Мақсатты алу мүмкін болмады")))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-no-translate>
        <DialogHeader>
          <DialogTitle>{t("Цель поступления", "Түсу мақсаты")}</DialogTitle>
          <DialogDescription>
            {step === "university"
              ? t("Шаг 1 из 2: выбери вуз.", "1/2 қадам: ЖОО таңдаңыз.")
              : t("Шаг 2 из 2: выбери специальность.", "2/2 қадам: мамандық таңдаңыз.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <ToggleGroup
            type="single"
            value={quota}
            onValueChange={(v) => v && setQuota(v as QuotaType)}
            className="grid w-full grid-cols-2 gap-0.5 rounded-md border border-border bg-secondary p-0.5"
          >
            <ToggleGroupItem
              value="GRANT"
              className="h-8 w-full justify-center rounded-sm text-xs data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              {t("Общий конкурс", "Жалпы конкурс")}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="RURAL"
              className="h-8 w-full justify-center rounded-sm text-xs data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              {t("Сельская квота", "Ауыл квотасы")}
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-[11px] text-muted-foreground">
            {t(
              "Сельская квота — если ты оканчиваешь сельскую школу.",
              "Ауыл квотасы — ауыл мектебін бітірсеңіз.",
            )}
          </p>
        </div>

        {step === "university" ? (
          <div className="flex flex-col gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Поиск по названию или коду вуза", "ЖОО атауы не коды бойынша іздеу")}
              autoFocus
            />
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              {universitiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : filteredUniversities.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("Вузы не найдены", "ЖОО табылмады")}
                </p>
              ) : (
                <div className="flex flex-col p-1">
                  {filteredUniversities.map((university) => (
                    <button
                      key={university.code}
                      type="button"
                      className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        setSelectedUniversity(university)
                        setStep("program")
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{university.shortName || university.name}</span>
                        {university.shortName && (
                          <span className="block truncate text-xs text-muted-foreground">{university.name}</span>
                        )}
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setStep("university")}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t("Назад", "Артқа")}
              </Button>
              <p className="min-w-0 truncate text-sm font-medium">
                {selectedUniversity?.shortName || selectedUniversity?.name}
              </p>
            </div>
            <Input
              value={programSearch}
              onChange={(event) => setProgramSearch(event.target.value)}
              placeholder={t("Поиск специальности или кода (B057)", "Мамандықты не кодты іздеу (B057)")}
              autoFocus
            />
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              {programsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : !cycleSlug ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("Приёмный цикл пока не найден", "Қабылдау циклі табылмады")}
                </p>
              ) : programs.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("Нет специальностей с грантами", "Гранты бар мамандықтар жоқ")}
                </p>
              ) : (
                <div className="flex flex-col p-1">
                  {programs.map(({ base, cutoff }) => (
                    <button
                      key={base.programId}
                      type="button"
                      className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={savingProgramId != null}
                      onClick={() => void saveGoal(base)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {base.programCode} {base.programName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[base.profileSubjects, cutoff?.grantCount ? grantsLabel(cutoff.grantCount, t) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 tabular-nums">
                        {savingProgramId === base.programId ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <>
                            {t("от", "бастап")} {formatScore(cutoff?.minScore ?? null)}
                          </>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {latestCycle?.admissionYear && (
              <p className="text-[11px] text-muted-foreground">
                {t(
                  `Проходные баллы конкурса ${latestCycle.admissionYear} года.`,
                  `${latestCycle.admissionYear} жылғы конкурстың өту балдары.`,
                )}
              </p>
            )}
          </div>
        )}

        {goal && (
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => void removeGoal()} disabled={removing}>
              {removing ? <Spinner className="size-4" /> : null}
              {t("Снять цель", "Мақсатты алып тастау")}
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

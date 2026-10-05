"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { ArrowLeft, Building2, Calculator, ChevronRight, GraduationCap, Info, Search, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { ENT_MAX, ENT_TOTAL_MAX, totalEntScore } from "@bilimland/shared"
import type { AdmissionCycle, ChanceProgram, ChanceUniversity } from "@/lib/api/types"
import { ChanceBadge, ChanceLegend, CutoffTrend, grantsLabel, useT } from "@/components/admission/chance"

type QuotaType = "GRANT" | "RURAL"
type Tab = "programs" | "universities"
type Step = 1 | 2

interface ProfileSubjectOption {
  value: string
  label: string
}

interface Scores {
  mathLit: number
  readingLit: number
  history: number
  profile1: number
  profile2: number
}

const SCORE_FIELDS: {
  key: keyof Scores
  label: string
  short: string
  max: number
}[] = [
  { key: "mathLit", label: "Мат. грамотность", short: "МатГр", max: ENT_MAX.mathLit },
  { key: "readingLit", label: "Чит. грамотность", short: "ЧитГр", max: ENT_MAX.readingLit },
  { key: "history", label: "История Казахстана", short: "ИстКЗ", max: ENT_MAX.history },
  { key: "profile1", label: "Профильный 1", short: "Проф 1", max: ENT_MAX.profile1 },
  { key: "profile2", label: "Профильный 2", short: "Проф 2", max: ENT_MAX.profile2 },
]

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}

/** "Математика - Физика" -> ["Математика", "Физика"]; creative exams get numbered. */
function profileSubjectNames(profileSubjects: string): [string, string] | null {
  const parts = profileSubjects.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 2) return null
  if (parts[0] === parts[1]) return [`${parts[0]} 1`, `${parts[1]} 2`]
  return [parts[0], parts[1]]
}

function scoreQuery(cycleSlug: string, quotaType: QuotaType, scores: Scores, extra: Record<string, string>) {
  return new URLSearchParams({
    cycleSlug,
    quotaType,
    ...extra,
    mathLit: String(scores.mathLit),
    readingLit: String(scores.readingLit),
    history: String(scores.history),
    profile1: String(scores.profile1),
    profile2: String(scores.profile2),
  }).toString()
}

export default function AdmissionPage() {
  const t = useT()
  const [cycleSlug, setCycleSlug] = useState<string>("")
  const [quotaType, setQuotaType] = useState<QuotaType>("GRANT")
  const [profileSubjects, setProfileSubjects] = useState<string>("")
  const [step, setStep] = useState<Step>(1)
  const [scores, setScores] = useState<Scores>({
    mathLit: 8,
    readingLit: 8,
    history: 15,
    profile1: 35,
    profile2: 35,
  })
  const [tab, setTab] = useState<Tab>("programs")
  const [programId, setProgramId] = useState<string>("")
  const [search, setSearch] = useState("")
  const [highlightUniversity, setHighlightUniversity] = useState<number | null>(null)

  const total = useMemo(() => totalEntScore(scores), [scores])
  const debouncedScores = useDebouncedValue(scores, 250)

  // Deep link from the dashboard goal: ?profileSubjects=…&programId=…&quota=RURAL&tab=universities
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const subjects = params.get("profileSubjects")
    if (subjects) {
      setProfileSubjects(subjects)
      setStep(2)
    }
    const program = params.get("programId")
    if (program) setProgramId(program)
    if (params.get("quota") === "RURAL") setQuotaType("RURAL")
    if (params.get("tab") === "universities") setTab("universities")
    const goalUni = Number(params.get("uni"))
    if (Number.isFinite(goalUni) && goalUni > 0) setHighlightUniversity(goalUni)
    const knownTotal = Number(params.get("total"))
    if (Number.isFinite(knownTotal) && knownTotal > 0) {
      // spread a known total over the subjects proportionally — a starting point the user can edit
      const target = Math.min(ENT_TOTAL_MAX, Math.round(knownTotal))
      const ratio = target / ENT_TOTAL_MAX
      const next: Scores = {
        mathLit: Math.round(ENT_MAX.mathLit * ratio),
        readingLit: Math.round(ENT_MAX.readingLit * ratio),
        history: Math.round(ENT_MAX.history * ratio),
        profile1: Math.round(ENT_MAX.profile1 * ratio),
        profile2: 0,
      }
      // the last subject takes the rounding remainder so the total matches exactly
      next.profile2 = Math.max(
        0,
        Math.min(ENT_MAX.profile2, target - next.mathLit - next.readingLit - next.history - next.profile1),
      )
      setScores(next)
    }
  }, [])

  // Cycles
  const { data: cycles } = useSWR<AdmissionCycle[]>("/admission/cycles")
  const sortedCycles = useMemo(
    () => [...(cycles ?? [])].sort((a, b) => b.sortOrder - a.sortOrder),
    [cycles],
  )
  useEffect(() => {
    if (!cycleSlug && sortedCycles.length > 0) setCycleSlug(sortedCycles[0].slug)
  }, [sortedCycles, cycleSlug])
  const cycleYear = sortedCycles.find((c) => c.slug === cycleSlug)?.admissionYear ?? null

  // Profile subject options
  const profileOptionsKey =
    cycleSlug && quotaType
      ? `/admission/chance/profile-subjects?cycleSlug=${encodeURIComponent(cycleSlug)}&quotaType=${quotaType}`
      : null
  const { data: profileOpts, isLoading: profileLoading } = useSWR<ProfileSubjectOption[]>(profileOptionsKey)

  const handleProfileSelect = (value: string) => {
    setProfileSubjects(value)
    setProgramId("")
    setStep(2)
  }

  const programsKey =
    step === 2 && cycleSlug && profileSubjects
      ? `/admission/chance/programs?${scoreQuery(cycleSlug, quotaType, debouncedScores, { profileSubjects })}`
      : null
  const { data: programs, isLoading: progLoading } = useSWR<ChanceProgram[]>(programsKey, {
    keepPreviousData: true,
  })

  const filteredPrograms = useMemo(() => {
    if (!programs) return []
    const q = search.trim().toLowerCase()
    if (!q || tab !== "programs") return programs
    return programs.filter(
      (p) => p.programName.toLowerCase().includes(q) || p.programCode.toLowerCase().includes(q),
    )
  }, [programs, search, tab])

  const openProgram = (id: string) => {
    setProgramId(id)
    setSearch("")
    setTab("universities")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const subjectNames = profileSubjectNames(profileSubjects)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:py-12">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit bg-secondary">
          Калькулятор поступления 2026
        </Badge>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Куда пройдёшь с твоими баллами ЕНТ?
        </h1>
        <p className="max-w-2xl text-pretty text-muted-foreground" data-no-translate>
          {t(
            "Сравниваем твой балл с проходными баллами — самым низким баллом, с которым дали грант в каждом вузе. Данные из официальных списков обладателей грантов МНВО РК.",
            "Балыңызды өту балдарымен — әр ЖОО-да грант берілген ең төменгі балмен салыстырамыз. Деректер ҒЖБМ ресми грант иегерлерінің тізімдерінен алынған.",
          )}
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Form */}
        <Card className="lg:sticky lg:top-20 self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4" />
              Параметры
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>Год поступления</Label>
              <Select value={cycleSlug} onValueChange={setCycleSlug}>
                <SelectTrigger>
                  <SelectValue placeholder="Загружаем..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedCycles.map((c, i) => (
                    <SelectItem key={c.id} value={c.slug}>
                      <span data-no-translate>
                        {c.admissionYear ?? c.slug}
                        {i === 0 ? t(" — последний конкурс", " — соңғы конкурс") : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Тип квоты</Label>
              <ToggleGroup
                type="single"
                value={quotaType}
                onValueChange={(v) => v && setQuotaType(v as QuotaType)}
                className="grid w-full grid-cols-2 gap-0.5 rounded-md border border-border bg-secondary p-0.5"
              >
                <ToggleGroupItem
                  value="GRANT"
                  className="h-9 w-full justify-center rounded-sm data-[state=on]:bg-foreground data-[state=on]:text-background"
                >
                  Грант
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="RURAL"
                  className="h-9 w-full justify-center rounded-sm data-[state=on]:bg-foreground data-[state=on]:text-background"
                >
                  Сельская
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs leading-relaxed text-muted-foreground" data-no-translate>
                {quotaType === "RURAL"
                  ? t(
                      "Для выпускников сельских школ. Ты участвуешь и в общем конкурсе, поэтому показываем меньший из двух проходных баллов.",
                      "Ауыл мектептерінің түлектері үшін. Жалпы конкурсқа да қатысасыз, сондықтан екі өту балының төменін көрсетеміз.",
                    )
                  : t(
                      "Общий конкурс — для всех. Если ты окончил сельскую школу, выбери «Сельская»: шансы обычно выше.",
                      "Жалпы конкурс — барлығына. Ауыл мектебін бітірсеңіз, «Ауыл» таңдаңыз: мүмкіндік әдетте жоғары.",
                    )}
              </p>
            </div>

            {/* Step 1: Profile subjects */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold">
                  1
                </span>
                <Label>Профильные предметы</Label>
              </div>
              {profileLoading ? (
                <Skeleton className="h-10" />
              ) : (
                <Select value={profileSubjects} onValueChange={handleProfileSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите пару профильных" />
                  </SelectTrigger>
                  <SelectContent>
                    {(profileOpts || []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Step 2: ENT scores — only shown after profileSubjects selected */}
            {step === 2 && (
              <div className="border-t border-border pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold">
                    2
                  </span>
                  <Label>Баллы ЕНТ</Label>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                      total >= 100
                        ? "bg-emerald-100 text-emerald-900"
                        : total >= 70
                          ? "bg-amber-100 text-amber-900"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {total}/{ENT_TOTAL_MAX}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SCORE_FIELDS.map((f) => {
                    const label =
                      f.key === "profile1" && subjectNames
                        ? subjectNames[0]
                        : f.key === "profile2" && subjectNames
                          ? subjectNames[1]
                          : f.short
                    return (
                      <div key={f.key} className="flex min-w-0 flex-col gap-1">
                        <Label className="truncate text-xs text-muted-foreground" htmlFor={f.key}>
                          {label} ({f.max})
                        </Label>
                        <Input
                          id={f.key}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={f.max}
                          value={scores[f.key]}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            const clamped = Number.isFinite(v) ? Math.max(0, Math.min(f.max, v)) : 0
                            setScores((s) => ({ ...s, [f.key]: clamped }))
                          }}
                          className="h-10 tabular-nums"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="rounded-md border border-dashed border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                <Sparkles className="mb-1 inline size-3.5" /> Шаг 1 из 2: выберите пару профильных предметов
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ToggleGroup
              type="single"
              value={tab}
              onValueChange={(v) => {
                if (!v) return
                setTab(v as Tab)
                setSearch("")
              }}
              className="self-start rounded-md border border-border bg-card p-0.5"
            >
              <ToggleGroupItem
                value="programs"
                className="h-9 flex-none px-3 data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                <GraduationCap className="size-4" />
                <span className="ml-1">Специальности</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="universities"
                className="h-9 flex-none px-3 data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                <Building2 className="size-4" />
                <span className="ml-1">Вузы</span>
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={
                  tab === "programs"
                    ? t("Поиск специальности…", "Мамандықты іздеу…")
                    : t("Поиск вуза…", "ЖОО іздеу…")
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-no-translate
              />
            </div>
          </div>

          {step === 1 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Сначала выберите пару профильных предметов слева, чтобы увидеть результаты
              </CardContent>
            </Card>
          ) : tab === "programs" ? (
            <ProgramsList
              loading={progLoading && !programs}
              programs={filteredPrograms}
              total={total}
              cycleYear={cycleYear}
              onOpen={openProgram}
            />
          ) : (
            <UniversitiesList
              cycleSlug={cycleSlug}
              cycleYear={cycleYear}
              quotaType={quotaType}
              scores={debouncedScores}
              total={total}
              search={search}
              programs={programs ?? []}
              programsLoading={progLoading && !programs}
              programId={programId}
              highlightUniversity={highlightUniversity}
              onProgramChange={setProgramId}
              onBack={() => setTab("programs")}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ResultsSummary({
  total,
  cycleYear,
  children,
}: {
  total: number
  cycleYear: number | null
  children: React.ReactNode
}) {
  const t = useT()
  const [showLegend, setShowLegend] = useState(false)
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3 text-sm" data-no-translate>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-medium">{children}</p>
          <p className="text-xs text-muted-foreground">
            {t("Твой балл", "Сіздің балыңыз")}: <span className="font-semibold tabular-nums">{total}</span>
            {" · "}
            {cycleYear
              ? t(`проходные баллы конкурса ${cycleYear} года`, `${cycleYear} жылғы конкурстың өту балдары`)
              : t("проходные баллы прошлых лет", "өткен жылдардың өту балдары")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => setShowLegend((v) => !v)}
          aria-expanded={showLegend}
        >
          <Info className="size-3.5" aria-hidden="true" />
          {t("Как считаем", "Қалай есептейміз")}
        </Button>
      </div>
      {showLegend && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <ChanceLegend />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(
              "Проходной балл каждый год меняется на несколько баллов, поэтому это ориентир, а не гарантия. Грант даётся по группе программ: внутри неё конкурс общий по стране.",
              "Өту балы жыл сайын бірнеше балға өзгереді, сондықтан бұл кепілдік емес, бағдар. Грант бағдарламалар тобы бойынша беріледі: конкурс бүкіл ел бойынша ортақ.",
            )}
          </p>
        </div>
      )}
    </div>
  )
}

function ProgramsList({
  loading,
  programs,
  total,
  cycleYear,
  onOpen,
}: {
  loading: boolean
  programs: ChanceProgram[]
  total: number
  cycleYear: number | null
  onOpen: (programId: string) => void
}) {
  const t = useT()
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )
  }
  if (programs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Под ваши параметры пока нет результатов
        </CardContent>
      </Card>
    )
  }

  const reachable = programs.filter((p) => (p.passingUniversityCount ?? (p.isPass ? 1 : 0)) > 0).length

  return (
    <div className="flex flex-col gap-3">
      <ResultsSummary total={total} cycleYear={cycleYear}>
        {t(
          `Проходишь хотя бы в один вуз по ${reachable} из ${programs.length} специальностей`,
          `${programs.length} мамандықтың ${reachable}-і бойынша кем дегенде бір ЖОО-ға өтесіз`,
        )}
      </ResultsSummary>
      <ul className="flex flex-col gap-2">
        {programs.map((p) => (
          <ProgramRow key={`${p.programId}-${p.profileSubjects}`} program={p} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  )
}

function ProgramRow({ program, onOpen }: { program: ChanceProgram; onOpen: (programId: string) => void }) {
  const t = useT()
  const passing = program.passingUniversityCount ?? (program.isPass ? 1 : 0)
  const max = program.maxDisplayedMinScore ?? program.displayedMinScore
  const min = program.displayedMinScore
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(program.programId)}
        className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="py-0 transition-colors hover:bg-muted/40">
          <CardContent className="flex items-center gap-3 p-4" data-no-translate>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {program.programCode}
                </Badge>
                <p className="font-medium leading-tight">{program.programName}</p>
                {program.chance && (
                  <ChanceBadge level={program.chance} passesEntThresholds={program.passesEntThresholds} />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className={cn("font-medium", passing > 0 ? "text-foreground" : "")}>
                  {t(
                    `Проходишь в ${passing} из ${program.universityCount} вузов`,
                    `${program.universityCount} ЖОО-ның ${passing}-іне өтесіз`,
                  )}
                </span>
                {" · "}
                {t("проходной", "өту балы")}{" "}
                <span className="tabular-nums">{min != null && max != null && max !== min ? `${min}–${max}` : (min ?? "—")}</span>
                {program.totalGrantCount ? (
                  <>
                    {" · "}
                    {grantsLabel(program.totalGrantCount, t)}
                  </>
                ) : null}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </CardContent>
        </Card>
      </button>
    </li>
  )
}

function UniversitiesList({
  cycleSlug,
  cycleYear,
  quotaType,
  scores,
  total,
  search,
  programs,
  programsLoading,
  programId,
  highlightUniversity,
  onProgramChange,
  onBack,
}: {
  cycleSlug: string
  cycleYear: number | null
  quotaType: QuotaType
  scores: Scores
  total: number
  search: string
  programs: ChanceProgram[]
  programsLoading: boolean
  programId: string
  highlightUniversity: number | null
  onProgramChange: (programId: string) => void
  onBack: () => void
}) {
  const t = useT()

  useEffect(() => {
    if (programsLoading || programs.length === 0) return
    if (!programId || !programs.some((p) => p.programId === programId)) {
      onProgramChange(programs[0].programId)
    }
  }, [programs, programId, programsLoading, onProgramChange])

  const uniKey =
    cycleSlug && programId
      ? `/admission/chance/universities?${scoreQuery(cycleSlug, quotaType, scores, { programId })}`
      : null
  const { data: unis, isLoading: uniLoading } = useSWR<ChanceUniversity[]>(uniKey, { keepPreviousData: true })

  const filteredUnis = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!unis) return []
    if (!q) {
      // the student's goal university goes first
      const goal = unis.find((u) => u.universityCode === highlightUniversity)
      return goal ? [goal, ...unis.filter((u) => u !== goal)] : unis
    }
    return unis.filter(
      (u) =>
        u.universityName.toLowerCase().includes(q) ||
        (u.universityShortName ?? "").toLowerCase().includes(q) ||
        String(u.universityCode) === q,
    )
  }, [unis, search, highlightUniversity])

  const selected = programs.find((p) => p.programId === programId)
  const passing = (unis ?? []).filter((u) => u.isPass).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span data-no-translate>{t("Все специальности", "Барлық мамандықтар")}</span>
          </Button>
        </div>
        {programsLoading ? (
          <Skeleton className="h-10" />
        ) : (
          <Select value={programId} onValueChange={onProgramChange}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите специальность" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {programs.map((p) => (
                <SelectItem key={p.programId} value={p.programId}>
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{p.programCode}</span>
                  {p.programName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!programId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Выберите специальность, чтобы увидеть список вузов
          </CardContent>
        </Card>
      ) : uniLoading && !unis ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (unis ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Нет данных по этой специальности</CardContent>
        </Card>
      ) : (
        <>
          <ResultsSummary total={total} cycleYear={cycleYear}>
            {selected ? `${selected.programCode} ${selected.programName}: ` : ""}
            {t(
              `проходишь в ${passing} из ${(unis ?? []).length} вузов`,
              `${(unis ?? []).length} ЖОО-ның ${passing}-іне өтесіз`,
            )}
          </ResultsSummary>
          {filteredUnis.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground" data-no-translate>
                {t("Вуз не найден", "ЖОО табылмады")}
              </CardContent>
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredUnis.map((u) => (
                <UniversityRow
                  key={u.universityCode}
                  university={u}
                  cycleYear={cycleYear}
                  isGoal={u.universityCode === highlightUniversity}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function UniversityRow({
  university: u,
  cycleYear,
  isGoal,
}: {
  university: ChanceUniversity
  cycleYear: number | null
  isGoal?: boolean
}) {
  const t = useT()
  const gap = u.gapToCutoff
  return (
    <li>
      <Card className={cn("py-0", isGoal && "ring-2 ring-emerald-500/60")}>
        <CardContent className="flex items-start gap-3 p-4" data-no-translate>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium leading-tight">{u.universityShortName || u.universityName}</p>
              {u.chance && <ChanceBadge level={u.chance} passesEntThresholds={u.passesEntThresholds} />}
              {isGoal && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
                  {t("Твоя цель", "Сіздің мақсатыңыз")}
                </Badge>
              )}
              {u.cutoffSource === "GRANT_FALLBACK" && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                  {t("через общий конкурс", "жалпы конкурс арқылы")}
                </Badge>
              )}
            </div>
            {u.universityShortName && (
              <p className="truncate text-xs text-muted-foreground">{u.universityName}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {t("Проходной", "Өту балы")}
                {cycleYear ? ` ${cycleYear}` : ""}:{" "}
                <span className="font-semibold text-foreground tabular-nums">{u.displayedMinScore ?? "—"}</span>
              </span>
              {u.displayedMinScore != null && (
                <CutoffTrend
                  current={u.displayedMinScore}
                  previous={u.previousMinScore}
                  previousYear={u.previousAdmissionYear}
                />
              )}
              {u.avgScore != null && (
                <span>
                  {t("средний", "орташа")} <span className="tabular-nums">{Math.round(u.avgScore)}</span>
                </span>
              )}
              {u.grantCount ? <span>{grantsLabel(u.grantCount, t)}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-xs text-muted-foreground">
              {gap != null && gap >= 0 ? t("Запас", "Қор") : t("Не хватает", "Жетпейді")}
            </span>
            <span
              className={cn(
                "text-lg font-semibold tabular-nums",
                gap == null ? "" : gap >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
              )}
            >
              {gap == null ? "—" : gap > 0 ? `+${gap}` : gap}
            </span>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}

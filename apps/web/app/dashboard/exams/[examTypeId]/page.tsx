"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { ArrowLeft, BookOpen, Clock, Crown, Play } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { ExamType, Subject, TestSession, TestTemplate } from "@/lib/api/types"
import {
  buildEntProfilePairOptions,
  getSelectedEntProfilePairKey,
  isEntProfileSubjectAvailable,
} from "@/lib/ent-profile-pairs"

type EntScope = "mandatory" | "profile" | "full" | "creative"

const ENT_CREATIVE_QUESTION_COUNT = 30
const ENT_CREATIVE_DURATION_MINS = 70
const ENT_CREATIVE_SUBJECT_SLUGS = new Set(["reading_literacy", "history_kz"])

function entModePreview(
  mode: EntScope,
  template: TestTemplate | undefined,
  profileQuestionCount: number,
) {
  if (mode === "creative") {
    return { totalQ: ENT_CREATIVE_QUESTION_COUNT, displayMins: ENT_CREATIVE_DURATION_MINS }
  }
  if (!template) return { totalQ: 0, displayMins: 0 }
  const templateQ =
    template.sections?.reduce((sum, section) => sum + section.questionCount, 0) ??
    template.totalQuestions ??
    0
  const profileQ = 2 * profileQuestionCount
  const fullQ = templateQ + profileQ
  const totalQ = mode === "mandatory" ? templateQ : mode === "profile" ? profileQ : fullQ
  const displayMins =
    mode !== "full" && fullQ > 0 && totalQ > 0
      ? Math.max(5, Math.round(template.durationMins * (totalQ / fullQ)))
      : template.durationMins
  return { totalQ, displayMins }
}

export default function ExamDetailPage({
  params,
}: {
  params: Promise<{ examTypeId: string }>
}) {
  const { examTypeId } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const [selectedTemplate, setSelectedTemplate] = useState<TestTemplate | null>(null)
  const [language, setLanguage] = useState<"ru" | "kk">(
    user?.preferredLanguage === "kk" ? "kk" : "ru",
  )
  const [entScope, setEntScope] = useState<EntScope>("full")
  const [profileSubjectIds, setProfileSubjectIds] = useState<string[]>([])
  const [starting, setStarting] = useState(false)

  const { data: types } = useSWR<ExamType[]>("/exams/types")
  const examType = (types || []).find((t) => t.id === examTypeId)
  const examName = localize(examType?.name, locale, "Экзамен")
  const examDescription = localize(examType?.description, locale)
  const isENT = examType?.slug === "ent"

  const { data: subjects, isLoading: subjLoading } = useSWR<Subject[]>(
    `/exams/types/${examTypeId}/subjects`,
  )
  const { data: templates, isLoading: tplLoading } = useSWR<TestTemplate[]>(
    `/exams/types/${examTypeId}/templates`,
  )

  const profileSubjects = useMemo(
    () => (subjects || []).filter((subject) => !subject.isMandatory),
    [subjects],
  )
  const mandatorySubjects = useMemo(
    () => (subjects || []).filter((subject) => subject.isMandatory),
    [subjects],
  )
  const visibleMandatorySubjects = useMemo(
    () =>
      entScope === "creative"
        ? mandatorySubjects.filter((subject) => ENT_CREATIVE_SUBJECT_SLUGS.has(subject.slug))
        : mandatorySubjects,
    [entScope, mandatorySubjects],
  )
  const entProfilePairs = useMemo(
    () => buildEntProfilePairOptions(profileSubjects, language),
    [language, profileSubjects],
  )
  const selectedProfilePairKey = useMemo(
    () => getSelectedEntProfilePairKey(profileSubjectIds, profileSubjects, language),
    [language, profileSubjectIds, profileSubjects],
  )
  useEffect(() => {
    if (profileSubjectIds.length > 0 && profileSubjects.length > 0 && !selectedProfilePairKey) {
      setProfileSubjectIds([])
    }
  }, [profileSubjectIds.length, profileSubjects.length, selectedProfilePairKey])
  const entTemplatesSorted = useMemo(
    () => [...(templates || [])].sort((a, b) => b.durationMins - a.durationMins),
    [templates],
  )
  const activeEntTemplate = isENT ? entTemplatesSorted[0] : undefined
  const profileQuestionCount = isENT ? 40 : 10
  const requiresProfiles = isENT && (entScope === "profile" || entScope === "full")
  const showsMandatorySubjects =
    entScope === "mandatory" || entScope === "full" || entScope === "creative"

  const selectProfilePair = (key: string) => {
    const pair = entProfilePairs.find((option) => option.key === key)
    setProfileSubjectIds(pair ? pair.subjects.map((subject) => subject.id) : [])
  }

  const startTest = async () => {
    const templateForStart = isENT ? activeEntTemplate : selectedTemplate
    if (!templateForStart) {
      toast.error("Пробник пока недоступен")
      return
    }
    if (requiresProfiles && !selectedProfilePairKey) {
      toast.error("Выберите одну из доступных пар профильных предметов")
      return
    }
    setStarting(true)
    try {
      const shouldSendProfileSubjects = isENT && requiresProfiles
      const session = await api<TestSession>("/tests/start", {
        method: "POST",
        body: {
          templateId: templateForStart.id,
          language,
          profileSubjectIds: shouldSendProfileSubjects ? profileSubjectIds : undefined,
          entScope: isENT ? entScope : undefined,
        },
      })
      router.push(`/exam/${session.id}`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : ""
      if (message === "NO_ENTITLEMENT") {
        router.push("/dashboard/billing?reason=no_access")
        return
      }
      if (
        message === "TRIAL_LIMIT_EXCEEDED" ||
        message === "TOTAL_LIMIT_EXHAUSTED"
      ) {
        router.push("/dashboard/billing?reason=limit_exhausted")
        return
      }
      if (message === "DAILY_LIMIT_REACHED") {
        router.push("/dashboard/billing?reason=daily_limit")
        return
      }
      toast.error(message || "Не удалось запустить тест")
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/exams"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          К каталогу
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {examName}
        </h1>
        {examDescription && (
          <p className="mt-1 text-muted-foreground">{examDescription}</p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Предметы</h2>
        {subjLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
        ) : (subjects || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Список предметов недоступен</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(subjects || []).map((s) => {
              const isClosed = isENT && !isEntProfileSubjectAvailable(s, language)
              return (
                <Badge
                  key={s.id}
                  variant={s.isMandatory ? "default" : isClosed ? "outline" : "secondary"}
                  className={cn(
                    "text-sm py-1.5 px-3 font-normal",
                    isClosed && "border-dashed text-muted-foreground opacity-70",
                  )}
                >
                  {localize(s.name, locale, "Предмет")}
                  {isClosed && <span className="ml-1 text-[10px] uppercase">скоро</span>}
                </Badge>
              )
            })}
          </div>
        )}
      </section>

      {isENT && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Быстрый старт ЕНТ</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div>
                <Label>Язык заданий</Label>
                <RadioGroup
                  value={language}
                  onValueChange={(v) => setLanguage(v as "ru" | "kk")}
                  className="mt-2 grid gap-2 sm:grid-cols-2"
                >
                  <Label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2">
                    <RadioGroupItem value="ru" /> Русский
                  </Label>
                  <Label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2">
                    <RadioGroupItem value="kk" /> Қазақша
                  </Label>
                </RadioGroup>
              </div>

              <div>
                <Label>Объём ЕНТ</Label>
                <RadioGroup
                  value={entScope}
                  onValueChange={(v) => setEntScope(v as typeof entScope)}
                  className="mt-2 grid gap-2"
                >
                  {[
                    { v: "mandatory", l: "Только обязательные", s: "Математическая грамотность, грамотность чтения, история" },
                    { v: "profile", l: "Только профильные", s: "Два профильных предмета" },
                    { v: "full", l: "Полный ЕНТ", s: "Все обязательные и профильные предметы" },
                    {
                      v: "creative",
                      l: locale === "kk" ? "Шығармашылық емтихан" : "Творческий экзамен",
                      s:
                        locale === "kk"
                          ? "Оқу сауаттылығы + тарих; шығармашылық емтихандар ЖОО-да өтеді"
                          : "Грамотность чтения + история; творческие экзамены проходят в вузе",
                    },
                  ].map((option) => {
                    const preview = entModePreview(
                      option.v as EntScope,
                      activeEntTemplate,
                      profileQuestionCount,
                    )
                    return (
                      <Label
                        key={option.v}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3",
                          entScope === option.v && "border-foreground bg-secondary/50",
                        )}
                      >
                        <RadioGroupItem value={option.v} className="mt-1" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{option.l}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {option.s}
                          </span>
                        </span>
                        {activeEntTemplate && (
                          <span className="shrink-0 text-right text-xs text-muted-foreground">
                            {preview.totalQ} вопр.
                            <br />
                            {preview.displayMins} мин
                          </span>
                        )}
                      </Label>
                    )
                  })}
                </RadioGroup>
              </div>

              {requiresProfiles && (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Label>Пара профильных предметов</Label>
                    <Badge variant="secondary">
                      {selectedProfilePairKey ? "Выбрана" : "Не выбрана"}
                    </Badge>
                  </div>
                  {entProfilePairs.length > 0 ? (
                    <>
                      <RadioGroup
                        value={selectedProfilePairKey ?? ""}
                        onValueChange={selectProfilePair}
                        className="mt-2 grid gap-2 sm:grid-cols-2"
                      >
                        {entProfilePairs.map((pair) => (
                          <Label
                            key={pair.key}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3",
                              selectedProfilePairKey === pair.key && "border-foreground bg-secondary/50",
                            )}
                          >
                            <RadioGroupItem value={pair.key} className="mt-1" />
                            <span className="min-w-0 text-sm font-medium">
                              {pair.subjects
                                .map((subject) => localize(subject.name, language, "Предмет"))
                                .join(" + ")}
                            </span>
                          </Label>
                        ))}
                      </RadioGroup>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Некоторые пары доступны только для конкретного языка, если банк вопросов уже готов.
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Доступные пары профильных предметов пока не настроены
                    </p>
                  )}
                </div>
              )}

              <Button
                size="lg"
                className="h-11"
                onClick={startTest}
                disabled={starting || !activeEntTemplate || (requiresProfiles && !selectedProfilePairKey)}
              >
                {starting ? (
                  <Spinner className="size-4" />
                ) : (
                  <>
                    <Play className="size-4" />
                    Начать пробный ЕНТ
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Что войдёт в тест</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {showsMandatorySubjects && (
                <div>
                  <p className="mb-2 text-sm font-medium">Обязательные</p>
                  <div className="flex flex-wrap gap-2">
                    {visibleMandatorySubjects.map((s) => (
                      <Badge key={s.id} variant="default" className="font-normal">
                        {localize(s.name, language, "Предмет")}
                      </Badge>
                    ))}
                  </div>
                  {entScope === "creative" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {locale === "kk"
                        ? "Екі шығармашылық емтихан таңдаған ЖОО-да өтеді. Олармен бірге ең жоғары нәтиже 130 балл болады."
                        : "Два творческих экзамена проводятся в выбранном вузе. С ними максимальный результат составляет 130 баллов."}
                    </p>
                  )}
                </div>
              )}
              {requiresProfiles && (
                <div>
                  <p className="mb-2 text-sm font-medium">Профильные</p>
                  <div className="flex flex-wrap gap-2">
                    {profileSubjectIds.length > 0 ? (
                      profileSubjects
                        .filter((s) => profileSubjectIds.includes(s.id))
                        .map((s) => (
                          <Badge key={s.id} variant="secondary" className="font-normal">
                            {localize(s.name, language, "Предмет")}
                          </Badge>
                        ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Выберите пару перед стартом
                      </span>
                    )}
                  </div>
                </div>
              )}
              {!activeEntTemplate && !tplLoading && (
                <p className="text-sm text-destructive">Пробник пока недоступен</p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {!isENT && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Доступные пробники</h2>
          {tplLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : (templates || []).length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Пока нет доступных пробников
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(templates || []).map((t) => {
                const tName = localize(t.name, locale, "Пробник")
                const tDescription = localize(t.description, locale)
                return (
                  <Card
                    key={t.id}
                    className="relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md"
                  >
                    {t.isPremium && (
                      <Badge className="absolute right-3 top-3 bg-amber-500 hover:bg-amber-500">
                        <Crown className="size-3" />
                        Premium
                      </Badge>
                    )}
                    <CardHeader>
                      <div className="flex size-11 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
                        <BookOpen className="size-5" />
                      </div>
                      <CardTitle className="text-lg leading-tight">{tName}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {tDescription && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{tDescription}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {t.durationMins && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" />
                            {t.durationMins} мин
                          </span>
                        )}
                        <span>
                          {t.totalQuestions ??
                            t.sections?.reduce((sum, section) => sum + section.questionCount, 0) ??
                            0}{" "}
                          вопросов
                        </span>
                      </div>
                      <Button onClick={() => setSelectedTemplate(t)} className="mt-1">
                        <Play className="size-4" />
                        Начать
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      )}

      <Dialog open={!isENT && !!selectedTemplate} onOpenChange={(o) => !o && setSelectedTemplate(null)}>
        <DialogContent className="max-w-lg pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DialogHeader>
            <DialogTitle>{localize(selectedTemplate?.name, locale, "Пробник")}</DialogTitle>
            <DialogDescription>
              Настройте параметры пробника перед запуском
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-2">
            <div>
              <Label>Язык</Label>
              <RadioGroup
                value={language}
                onValueChange={(v) => setLanguage(v as "ru" | "kk")}
                className="mt-2 flex gap-3"
              >
                <Label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer flex-1">
                  <RadioGroupItem value="ru" /> Русский
                </Label>
                <Label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer flex-1">
                  <RadioGroupItem value="kk" /> Қазақша
                </Label>
              </RadioGroup>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Отмена
            </Button>
            <Button onClick={startTest} disabled={starting}>
              {starting ? (
                <Spinner className="size-4" />
              ) : (
                <>
                  <Play className="size-4" />
                  Начать пробник
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

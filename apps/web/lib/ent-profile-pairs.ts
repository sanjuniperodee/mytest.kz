import type { Subject } from "@/lib/api/types"

export const ENT_AVAILABLE_PROFILE_SUBJECT_SLUGS = [
  "math",
  "physics",
  "informatics",
  "geography",
  "biology",
] as const

const ENT_PROFILE_SUBJECT_PAIRS = [
  ["math", "physics"],
  ["math", "geography"],
  ["math", "informatics"],
] as const

const ENT_LOCALE_LIMITED_PROFILE_SUBJECT_PAIRS = [
  { pair: ["biology", "geography"], languages: ["kk", "ru"] },
] as const

const alwaysAvailableProfileSubjectSlugs = new Set<string>([
  "math",
  "physics",
  "informatics",
  "geography",
])
const localeLimitedProfileSubjectSlugs = new Set<string>(["biology"])

function normalizeLanguage(language?: string | null) {
  return language?.trim().toLowerCase() ?? null
}

export function isEntProfileSubjectAvailable(
  subject: Pick<Subject, "slug" | "isMandatory">,
  language?: string | null,
) {
  if (subject.isMandatory) return true
  if (alwaysAvailableProfileSubjectSlugs.has(subject.slug)) return true
  const normalizedLanguage = normalizeLanguage(language)
  return (
    localeLimitedProfileSubjectSlugs.has(subject.slug) &&
    ENT_LOCALE_LIMITED_PROFILE_SUBJECT_PAIRS.some((entry) =>
      entry.languages.some((allowedLanguage) => allowedLanguage === normalizedLanguage),
    )
  )
}

export interface EntProfilePairOption {
  key: string
  subjects: [Subject, Subject]
}

export function entProfilePairKey(slugs: readonly string[]) {
  return [...slugs].sort().join(":")
}

function isEntProfilePairAllowed(slugs: readonly string[], language?: string | null) {
  if (slugs.length !== 2) return false
  const key = entProfilePairKey(slugs)
  if (ENT_PROFILE_SUBJECT_PAIRS.some((pair) => entProfilePairKey(pair) === key)) return true
  const normalizedLanguage = normalizeLanguage(language)
  return ENT_LOCALE_LIMITED_PROFILE_SUBJECT_PAIRS.some(
    (entry) =>
      entProfilePairKey(entry.pair) === key &&
      entry.languages.some((allowedLanguage) => allowedLanguage === normalizedLanguage),
  )
}

export function buildEntProfilePairOptions(
  subjects: Subject[],
  language?: string | null,
): EntProfilePairOption[] {
  const bySlug = new Map(subjects.map((subject) => [subject.slug, subject]))
  const pairs = [
    ...ENT_PROFILE_SUBJECT_PAIRS,
    ...ENT_LOCALE_LIMITED_PROFILE_SUBJECT_PAIRS.map((entry) => entry.pair),
  ]

  return pairs.flatMap((pair) => {
    if (!isEntProfilePairAllowed(pair, language)) return []
    const first = bySlug.get(pair[0])
    const second = bySlug.get(pair[1])
    if (!first || !second) return []
    return [
      {
        key: entProfilePairKey(pair),
        subjects: [first, second] as [Subject, Subject],
      },
    ]
  })
}

export function getSelectedEntProfilePairKey(
  subjectIds: string[],
  subjects: Subject[],
  language?: string | null,
) {
  if (subjectIds.length !== 2) return null
  const byId = new Map(subjects.map((subject) => [subject.id, subject]))
  const slugs = subjectIds
    .map((id) => byId.get(id)?.slug)
    .filter((slug): slug is string => Boolean(slug))
  if (slugs.length !== 2) return null
  const key = entProfilePairKey(slugs)
  return buildEntProfilePairOptions(subjects, language).some((pair) => pair.key === key) ? key : null
}

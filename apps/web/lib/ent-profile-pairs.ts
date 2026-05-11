import type { Subject } from "@/lib/api/types"

export const ENT_AVAILABLE_PROFILE_SUBJECT_SLUGS = [
  "math",
  "physics",
  "informatics",
  "geography",
] as const

const ENT_PROFILE_SUBJECT_PAIRS = [
  ["math", "physics"],
  ["math", "geography"],
  ["math", "informatics"],
] as const

const entAvailableProfileSubjectSlugs = new Set<string>(ENT_AVAILABLE_PROFILE_SUBJECT_SLUGS)

export function isEntProfileSubjectAvailable(subject: Pick<Subject, "slug" | "isMandatory">) {
  return subject.isMandatory || entAvailableProfileSubjectSlugs.has(subject.slug)
}

export interface EntProfilePairOption {
  key: string
  subjects: [Subject, Subject]
}

export function entProfilePairKey(slugs: readonly string[]) {
  return [...slugs].sort().join(":")
}

export function buildEntProfilePairOptions(subjects: Subject[]): EntProfilePairOption[] {
  const bySlug = new Map(subjects.map((subject) => [subject.slug, subject]))

  return ENT_PROFILE_SUBJECT_PAIRS.flatMap((pair) => {
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

export function getSelectedEntProfilePairKey(subjectIds: string[], subjects: Subject[]) {
  if (subjectIds.length !== 2) return null
  const byId = new Map(subjects.map((subject) => [subject.id, subject]))
  const slugs = subjectIds
    .map((id) => byId.get(id)?.slug)
    .filter((slug): slug is string => Boolean(slug))
  if (slugs.length !== 2) return null
  const key = entProfilePairKey(slugs)
  return buildEntProfilePairOptions(subjects).some((pair) => pair.key === key) ? key : null
}

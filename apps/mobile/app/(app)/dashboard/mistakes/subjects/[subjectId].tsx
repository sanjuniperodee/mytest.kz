import { useLocalSearchParams } from "expo-router"
import { SubjectMistakesView } from "@/components/dashboard/mistakes/SubjectMistakesView"

export default function SubjectMistakesScreen() {
  const params = useLocalSearchParams<{ subjectId?: string | string[]; examTypeId?: string | string[] }>()
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value)
  return <SubjectMistakesView key={first(params.subjectId)} subjectId={first(params.subjectId) ?? ""} examTypeId={first(params.examTypeId)} />
}

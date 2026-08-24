import { useLocalSearchParams } from "expo-router"
import { SubjectMistakesView } from "@/components/dashboard/mistakes/SubjectMistakesView"

export default function SubjectMistakesScreen() {
  const params = useLocalSearchParams<{ subjectId?: string | string[] }>()
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId
  return <SubjectMistakesView subjectId={subjectId ?? ""} />
}

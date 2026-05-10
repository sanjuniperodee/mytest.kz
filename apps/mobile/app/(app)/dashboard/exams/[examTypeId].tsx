import { useLocalSearchParams } from "expo-router"
import { ExamTypeDetailView } from "@/components/dashboard/exams/ExamTypeDetailView"

export default function ExamDetailScreen() {
  const { examTypeId } = useLocalSearchParams<{ examTypeId: string | string[] }>()
  const id = typeof examTypeId === "string" ? examTypeId : examTypeId?.[0]
  if (!id) return null
  return <ExamTypeDetailView examTypeId={id} />
}

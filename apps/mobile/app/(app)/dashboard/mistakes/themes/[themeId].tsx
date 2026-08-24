import { useLocalSearchParams } from "expo-router"
import { ThemeLessonView } from "@/components/dashboard/mistakes/ThemeLessonView"

export default function ThemeLessonScreen() {
  const params = useLocalSearchParams<{ themeId?: string | string[] }>()
  const themeId = Array.isArray(params.themeId) ? params.themeId[0] : params.themeId
  return <ThemeLessonView themeId={themeId ?? ""} />
}

import AsyncStorage from "@react-native-async-storage/async-storage"

const PREFIX = "@exam:lastQuestionIdx:"

export function lastQuestionIdxStorageKey(userId: string | undefined, sessionId: string): string {
  const u = userId && userId.trim() ? userId.trim() : "_"
  return `${PREFIX}${u}:${sessionId}`
}

export async function readLastQuestionIndex(
  userId: string | undefined,
  sessionId: string,
  totalQuestions: number,
): Promise<number> {
  if (totalQuestions <= 0) return 0
  try {
    const raw = await AsyncStorage.getItem(lastQuestionIdxStorageKey(userId, sessionId))
    if (raw == null || raw === "") return 0
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return 0
    return Math.min(Math.max(0, n), totalQuestions - 1)
  } catch {
    return 0
  }
}

export async function writeLastQuestionIndex(
  userId: string | undefined,
  sessionId: string,
  index: number,
): Promise<void> {
  try {
    await AsyncStorage.setItem(lastQuestionIdxStorageKey(userId, sessionId), String(Math.max(0, Math.floor(index))))
  } catch {
    /* ignore */
  }
}

export async function clearLastQuestionIndex(userId: string | undefined, sessionId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(lastQuestionIdxStorageKey(userId, sessionId))
  } catch {
    /* ignore */
  }
}

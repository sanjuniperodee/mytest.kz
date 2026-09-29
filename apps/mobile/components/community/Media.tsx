import { MaterialCommunityIcons } from "@expo/vector-icons"
import { File } from "expo-file-system"
import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio"
import * as Sharing from "expo-sharing"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { api } from "@/lib/api/client"
import { useTr } from "@/lib/i18n/use-tr"
import { downloadChatMedia } from "@/lib/social/media"
import type { Attachment } from "@/lib/social/types"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { errorMessage } from "./shared"

const MAX_BYTES = 15 * 1024 * 1024
const MAX_RECORDING_MS = 180_000
const megabytes = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

/** Renders one attachment inside a message bubble. `onDark` is true for own (dark) bubbles. */
export function MessageMedia({ file, onDark }: { file: Attachment; onDark?: boolean }) {
  const tr = useTr()
  const { colors } = useAppTheme()
  const [uri, setUri] = useState("")
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [viewer, setViewer] = useState(false)
  const isImage = file.mime.startsWith("image/")
  const isAudio = file.mime.startsWith("audio/")
  const fg = onDark ? colors.background : colors.foreground

  // Images and voice notes load eagerly; other files download when opened.
  useEffect(() => {
    if (!isImage && !isAudio) return
    let alive = true
    setError(false)
    downloadChatMedia(file)
      .then((u) => alive && setUri(u))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
    // Polling returns fresh objects for the same attachment; only its id matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, isImage, isAudio, attempt])

  const openFile = async () => {
    try {
      const local = await downloadChatMedia(file)
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(local, { mimeType: file.mime, dialogTitle: file.name })
    } catch (e) {
      Alert.alert(tr("Не удалось открыть файл", "Файлды ашу мүмкін болмады"), errorMessage(e))
    }
  }

  if ((isImage || isAudio) && error) {
    return (
      <Button variant="outline" size="sm" onPress={() => setAttempt((x) => x + 1)}>
        {tr("Повторить загрузку", "Қайта жүктеу")}
      </Button>
    )
  }
  if (isImage || isAudio) {
    if (!uri) {
      return (
        <View style={styles.loading} accessibilityLabel={tr("Загрузка вложения…", "Тіркеме жүктелуде…")}>
          <ActivityIndicator color={fg} />
        </View>
      )
    }
    if (isImage) {
      return (
        <>
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={file.name} onPress={() => setViewer(true)}>
            <Image source={{ uri }} style={styles.image} resizeMode="cover" />
          </Pressable>
          <Modal visible={viewer} transparent animationType="fade" onRequestClose={() => setViewer(false)}>
            <Pressable style={styles.viewer} onPress={() => setViewer(false)} accessibilityLabel="Close">
              <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />
              <Pressable accessibilityRole="button" onPress={() => void openFile()} style={styles.viewerShare}>
                <MaterialCommunityIcons name="share-variant-outline" size={22} color="#fff" />
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )
    }
    return <VoicePlayer uri={uri} color={fg} />
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void openFile()}
      style={[styles.file, { borderColor: onDark ? `${colors.background}55` : colors.border }]}
    >
      <MaterialCommunityIcons name={file.mime === "application/pdf" ? "file-pdf-box" : "file-outline"} size={22} color={fg} />
      <View style={styles.fileCopy}>
        <Text numberOfLines={1} style={[styles.fileName, { color: fg }]}>
          {file.name}
        </Text>
        <Text style={[styles.fileMeta, { color: fg }]}>{megabytes(file.size)}</Text>
      </View>
    </Pressable>
  )
}

function VoicePlayer({ uri, color }: { uri: string; color: string }) {
  const player = useAudioPlayer(uri)
  const status = useAudioPlayerStatus(player)
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0
  const seconds = Math.round(status.playing || status.currentTime > 0 ? status.currentTime : status.duration)
  return (
    <View style={styles.voice}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (status.playing) player.pause()
          else {
            if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.1)) void player.seekTo(0)
            player.play()
          }
        }}
        style={styles.voiceButton}
      >
        <MaterialCommunityIcons name={status.playing ? "pause-circle" : "play-circle"} size={34} color={color} />
      </Pressable>
      <View style={styles.voiceBar}>
        <View style={[styles.track, { backgroundColor: `${color}33` }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.fileMeta, { color }]}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </Text>
      </View>
    </View>
  )
}

/**
 * Owns the microphone only while a recording is in progress: mounting starts it, unmounting
 * releases it. Keeping it out of the chat screen means no recorder exists until it is needed.
 */
function VoiceRecorder({ stopSignal, onDone, onError }: { stopSignal: number; onDone: (result: { uri: string; size: number } | null) => void; onError: (e: unknown) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const finished = useRef(false)

  const finish = async () => {
    if (finished.current) return
    finished.current = true
    try {
      await recorder.stop()
    } catch {
      // Nothing usable was recorded.
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {})
    const uri = recorder.uri
    onDone(uri ? { uri, size: new File(uri).size } : null)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
        await recorder.prepareToRecordAsync()
        if (!cancelled) recorder.record()
      } catch (e) {
        finished.current = true
        onError(e)
      }
    })()
    const limit = setTimeout(() => void finish(), MAX_RECORDING_MS)
    return () => {
      cancelled = true
      clearTimeout(limit)
      if (!finished.current) void recorder.stop().catch(() => {})
    }
    // Mount-only: one recording per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (stopSignal > 0) void finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSignal])

  return null
}

/** Attach a photo or file, or record a voice note, and upload it to the room. */
export function MediaComposer({
  roomId,
  attachment,
  onChange,
  onBusy,
  disabled,
}: {
  roomId: string
  attachment: Attachment | null
  onChange: (file: Attachment | null) => void
  onBusy: (busy: boolean) => void
  disabled: boolean
}) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const [menu, setMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [stopSignal, setStopSignal] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function upload(file: { uri: string; name: string; type: string; size?: number }) {
    if (file.size != null && file.size > MAX_BYTES) {
      Alert.alert(tr("Максимум 15 МБ", "Ең көбі 15 МБ"))
      return
    }
    setUploading(true)
    onBusy(true)
    try {
      const form = new FormData()
      form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob)
      const result = await api<Attachment>(`/social/rooms/${roomId}/media`, { method: "POST", formData: form })
      if (alive.current) onChange(result)
    } catch (e) {
      Alert.alert(tr("Не удалось загрузить", "Жүктеу мүмкін болмады"), errorMessage(e))
    } finally {
      if (alive.current) {
        setUploading(false)
        onBusy(false)
      }
    }
  }

  async function pickPhoto() {
    setMenu(false)
    const ImagePicker = await import("expo-image-picker")
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 })
    if (res.canceled || !res.assets[0]) return
    const a = res.assets[0]
    const mime = a.mimeType ?? "image/jpeg"
    await upload({ uri: a.uri, name: a.fileName ?? `photo.${mime === "image/png" ? "png" : "jpg"}`, type: mime, size: a.fileSize })
  }

  async function pickFile() {
    setMenu(false)
    const DocumentPicker = await import("expo-document-picker")
    const res = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "audio/*", "application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (res.canceled || !res.assets[0]) return
    const a = res.assets[0]
    await upload({ uri: a.uri, name: a.name, type: a.mimeType ?? "application/octet-stream", size: a.size })
  }

  async function toggleRecording() {
    if (recording) {
      // The recorder lives in <VoiceRecorder>; ask it to finish.
      setStopSignal((n) => n + 1)
      return
    }
    try {
      const permission = await requestRecordingPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(tr("Нужен доступ к микрофону", "Микрофонға рұқсат керек"), tr("Разрешите доступ к микрофону в настройках, чтобы записать голосовое.", "Дауыс жазу үшін баптауларда микрофонға рұқсат беріңіз."))
        return
      }
      setStopSignal(0)
      setRecording(true)
    } catch (e) {
      Alert.alert(tr("Не удалось начать запись", "Жазуды бастау мүмкін болмады"), errorMessage(e))
    }
  }

  const onRecorded = async (result: { uri: string; size: number } | null) => {
    setRecording(false)
    if (result && result.size > 0) await upload({ uri: result.uri, name: `voice-${Date.now()}.m4a`, type: "audio/mp4", size: result.size })
  }

  return (
    <View style={styles.composer}>
      {recording ? (
        <VoiceRecorder
          stopSignal={stopSignal}
          onDone={(result) => void onRecorded(result)}
          onError={(e) => {
            setRecording(false)
            Alert.alert(tr("Не удалось начать запись", "Жазуды бастау мүмкін болмады"), errorMessage(e))
          }}
        />
      ) : null}
      <View style={styles.tools}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr("Прикрепить файл", "Файл тіркеу")}
          disabled={disabled || uploading || recording}
          onPress={() => setMenu(true)}
          style={[styles.tool, (disabled || uploading || recording) && styles.dim]}
        >
          <MaterialCommunityIcons name="paperclip" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? tr("Завершить запись", "Жазуды аяқтау") : tr("Записать голосовое", "Дауыстық хабарлама жазу")}
          disabled={uploading || (disabled && !recording)}
          onPress={() => void toggleRecording()}
          style={[styles.tool, recording && { backgroundColor: colors.destructive }, (uploading || (disabled && !recording)) && styles.dim]}
        >
          <MaterialCommunityIcons name={recording ? "stop" : "microphone-outline"} size={22} color={recording ? colors.destructiveForeground : colors.foreground} />
        </Pressable>
        {recording ? (
          <Text accessibilityRole="alert" style={[styles.status, { color: colors.destructive }]}>
            {tr("Идёт запись · до 3 минут", "Жазылуда · 3 минутқа дейін")}
          </Text>
        ) : null}
        {uploading ? <ActivityIndicator size="small" color={colors.foreground} /> : null}
        {attachment ? (
          <View style={[styles.chip, { backgroundColor: colors.secondary }]}>
            <Text numberOfLines={1} style={[styles.chipText, { color: colors.foreground }]}>
              {attachment.name}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={tr("Убрать вложение", "Тіркемені алып тастау")} disabled={disabled} onPress={() => onChange(null)} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={16} color={colors.foreground} />
            </Pressable>
          </View>
        ) : null}
      </View>
      <Sheet visible={menu} onClose={() => setMenu(false)} title={tr("Прикрепить", "Тіркеу")}>
        <View style={styles.menu}>
          {(
            [
              ["image-outline", tr("Фото из галереи", "Галереядан фото"), pickPhoto],
              ["file-outline", tr("Файл (PDF, аудио, видео)", "Файл (PDF, аудио, бейне)"), pickFile],
            ] as const
          ).map(([icon, label, action]) => (
            <Pressable key={label} accessibilityRole="button" onPress={() => void action()} style={[styles.menuRow, { borderBottomColor: colors.border }]}>
              <MaterialCommunityIcons name={icon} size={22} color={colors.foreground} />
              <Text style={[styles.menuText, { color: colors.foreground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  )
}

const styles = StyleSheet.create({
  loading: { minHeight: 56, minWidth: 120, alignItems: "center", justifyContent: "center" },
  image: { width: 220, height: 220, borderRadius: 12 },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "80%" },
  viewerShare: { position: "absolute", top: 56, right: 20, padding: 8 },
  file: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, minWidth: 180 },
  fileCopy: { flexShrink: 1 },
  fileName: { fontSize: 13, fontFamily: fonts.sansSemi },
  fileMeta: { fontSize: 11, opacity: 0.7 },
  voice: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 200 },
  voiceButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  voiceBar: { flex: 1, gap: 4 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  composer: { marginBottom: 6 },
  tools: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  tool: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.4 },
  status: { fontSize: 12, fontFamily: fonts.sansSemi },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, maxWidth: "100%", flexShrink: 1 },
  chipText: { fontSize: 12, flexShrink: 1 },
  menu: { paddingTop: 8 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  menuText: { fontSize: 15, fontFamily: fonts.sansSemi },
})

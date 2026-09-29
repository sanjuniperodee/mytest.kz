import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useState } from "react"
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { SelectSheet } from "@/components/ui/select-sheet"
import { Sheet } from "@/components/ui/sheet"
import { useAuth } from "@/lib/api/auth-context"
import { api, ApiError } from "@/lib/api/client"
import type { User } from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

const TIMEZONES = ["Asia/Almaty", "Asia/Aqtau", "Asia/Aqtobe", "Asia/Atyrau", "Asia/Oral", "Asia/Qostanay", "Asia/Qyzylorda"]
const AVATAR_MIME = ["image/jpeg", "image/png", "image/webp"]
const MAX_AVATAR_BYTES = 3 * 1024 * 1024

type Language = "ru" | "kk"

/** The account owner's editor for everything shown on (or behind) their profile. */
export function EditProfileSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean
  onClose: () => void
  onSaved: () => void | Promise<unknown>
}) {
  const { user, refresh } = useAuth()
  const { locale, setLocale } = useUiLocale()
  const { colors } = useAppTheme()
  const tr = useTr()
  const savedLanguage: Language = ((user?.preferredLanguage as Language | null | undefined) || locale) === "kk" ? "kk" : "ru"
  const savedTimezone = user?.timezone || "Asia/Almaty"
  const [firstName, setFirstName] = useState(user?.firstName || "")
  const [lastName, setLastName] = useState(user?.lastName || "")
  const [language, setLanguage] = useState<Language>(savedLanguage)
  const [timezone, setTimezone] = useState(savedTimezone)
  const [saving, setSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)

  // Start from the saved values every time the sheet opens.
  const [wasVisible, setWasVisible] = useState(false)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible && user) {
      setFirstName(user.firstName || "")
      setLastName(user.lastName || "")
      setLanguage(savedLanguage)
      setTimezone(savedTimezone)
    }
  }
  if (!user) return null

  const afterChange = async () => {
    await refresh()
    await onSaved()
  }
  const fail = (e: unknown, fallback: string) =>
    Alert.alert(tr("Ошибка", "Қате"), e instanceof ApiError && e.message ? e.message : fallback)

  const pickAvatar = async () => {
    let ImagePicker: typeof import("expo-image-picker")
    try {
      ImagePicker = await import("expo-image-picker")
    } catch {
      Alert.alert(tr("Галерея недоступна", "Галерея қолжетімсіз"))
      return
    }
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 })
      if (res.canceled || !res.assets[0]) return
      const asset = res.assets[0]
      const mime = asset.mimeType ?? "image/jpeg"
      if (!AVATAR_MIME.includes(mime)) {
        Alert.alert(tr("Загрузите изображение JPG, PNG или WebP", "JPG, PNG немесе WebP суретін жүктеңіз"))
        return
      }
      if (asset.fileSize != null && asset.fileSize > MAX_AVATAR_BYTES) {
        Alert.alert(tr("Фото должно быть меньше 3 МБ", "Фото 3 МБ-тан аз болуы керек"))
        return
      }
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"
      const formData = new FormData()
      formData.append("file", { uri: asset.uri, name: `avatar.${ext}`, type: mime } as unknown as Blob)
      setAvatarBusy(true)
      try {
        await api<User>("/users/me/avatar", { method: "POST", formData })
        await afterChange()
      } catch (e) {
        fail(e, tr("Не удалось загрузить фото", "Фотоны жүктеу мүмкін болмады"))
      } finally {
        setAvatarBusy(false)
      }
    } catch (e) {
      fail(e, tr("Не удалось открыть галерею", "Галереяны ашу мүмкін болмады"))
    }
  }

  const removeAvatar = async () => {
    setAvatarBusy(true)
    try {
      await api<User>("/users/me/avatar", { method: "DELETE" })
      await afterChange()
    } catch (e) {
      fail(e, tr("Не удалось удалить фото", "Фотоны жою мүмкін болмады"))
    } finally {
      setAvatarBusy(false)
    }
  }

  const body: { firstName?: string; lastName?: string; preferredLanguage?: Language; timezone?: string } = {}
  if (firstName.trim() !== (user.firstName || "")) body.firstName = firstName.trim()
  if (lastName.trim() !== (user.lastName || "")) body.lastName = lastName.trim()
  if (language !== savedLanguage) body.preferredLanguage = language
  if (timezone !== savedTimezone) body.timezone = timezone

  const save = async () => {
    setSaving(true)
    try {
      if (Object.keys(body).length) {
        await api<User>("/users/me", { method: "PATCH", body })
        await afterChange()
      }
      setLocale(language, { syncProfile: false })
      onClose()
    } catch (e) {
      fail(e, tr("Ошибка сохранения", "Сақтау қатесі"))
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = [styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={tr("Редактировать профиль", "Профильді өңдеу")}
      description={tr(
        "Имя и фото видят другие участники. Язык и часовой пояс — только вы.",
        "Аты мен фотоны басқа қатысушылар көреді. Тіл мен уақыт белдеуін тек сіз көресіз.",
      )}
    >
      <View style={styles.body}>
        <View style={styles.avatarRow}>
          <View>
            <Avatar person={user} size={64} />
            {avatarBusy ? (
              <View style={[styles.busy, { backgroundColor: `${colors.background}B3` }]}>
                <ActivityIndicator color={colors.foreground} />
              </View>
            ) : null}
          </View>
          <View style={styles.avatarActions}>
            <Button
              variant="outline"
              size="sm"
              disabled={avatarBusy}
              onPress={() => void pickAvatar()}
              icon={(c) => <MaterialCommunityIcons name="camera-outline" size={16} color={c} />}
            >
              {user.avatarUrl ? tr("Заменить фото", "Фотоны ауыстыру") : tr("Загрузить фото", "Фото жүктеу")}
            </Button>
            {user.avatarUrl ? (
              <Button variant="ghost" size="sm" disabled={avatarBusy} onPress={() => void removeAvatar()}>
                {tr("Удалить", "Жою")}
              </Button>
            ) : null}
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {tr("JPG, PNG или WebP до 3 МБ", "JPG, PNG немесе WebP, 3 МБ-қа дейін")}
        </Text>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Имя", "Аты")}</Text>
        <TextInput value={firstName} onChangeText={setFirstName} maxLength={100} autoComplete="given-name" style={inputStyle} />
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Фамилия", "Тегі")}</Text>
        <TextInput value={lastName} onChangeText={setLastName} maxLength={100} autoComplete="family-name" style={inputStyle} />

        <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Язык интерфейса", "Интерфейс тілі")}</Text>
        <SegmentedTabs
          value={language}
          onChange={setLanguage}
          items={[
            { value: "ru", label: "Русский" },
            { value: "kk", label: "Қазақша" },
          ]}
        />
        <SelectSheet
          label={tr("Часовой пояс", "Уақыт белдеуі")}
          value={timezone}
          options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
          onChange={setTimezone}
        />

        <View style={styles.footer}>
          <Button variant="outline" disabled={saving} onPress={onClose}>
            {tr("Отмена", "Болдырмау")}
          </Button>
          <Button disabled={saving} onPress={() => void save()}>
            {saving ? tr("Сохраняем…", "Сақталуда…") : tr("Сохранить", "Сақтау")}
          </Button>
        </View>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: 8, paddingTop: 14 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 },
  busy: { ...StyleSheet.absoluteFillObject, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 12, marginBottom: 6 },
  label: { fontSize: 13, fontFamily: fonts.sansSemi, marginTop: 6 },
  input: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontFamily: fonts.sans },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
})

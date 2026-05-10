import { useEffect, useState } from "react"
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { router, type Href } from "expo-router"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError, resolveMediaUrl } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { User } from "@/lib/api/types"
import { t, useUiLocale } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

const TIMEZONES = [
  "Asia/Almaty",
  "Asia/Aqtau",
  "Asia/Aqtobe",
  "Asia/Atyrau",
  "Asia/Oral",
  "Asia/Qostanay",
  "Asia/Qyzylorda",
]

const AVATAR_MIME = ["image/jpeg", "image/png", "image/webp"] as const
const MAX_AVATAR_BYTES = 3 * 1024 * 1024

export function ProfileView() {
  const { colors, resolved } = useAppTheme()
  const { user, refresh } = useAuth()
  const { locale: uiLocale, setLocale } = useUiLocale()
  const ui = uiLocale
  const [language, setLanguage] = useState<"ru" | "kk">("ru")
  const [timezone, setTimezone] = useState("Asia/Almaty")
  const [saving, setSaving] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setLanguage(user?.preferredLanguage === "kk" ? "kk" : "ru")
      setTimezone(user.timezone || "Asia/Almaty")
    }
  }, [uiLocale, user])

  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const firstLastName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
  const fullNameStr = firstLastName || localize(user?.fullName, locale)
  const displayName =
    fullNameStr ||
    user?.telegramUsername ||
    user?.username ||
    user?.phone ||
    t("profileUserPlaceholder", ui)
  const initials = displayName.toString().slice(0, 2).toUpperCase()
  const avatarSrc = resolveMediaUrl(user?.avatarUrl)

  const pickAvatar = async () => {
    if (Platform.OS === "web") {
      Alert.alert(t("profilePhotoTitle", ui), t("profilePhotoWebUnavailable", ui))
      return
    }

    let ImagePicker: typeof import("expo-image-picker")
    try {
      ImagePicker = await import("expo-image-picker")
    } catch {
      Alert.alert(t("profileGalleryUnavailable", ui), t("profileGalleryModuleHint", ui))
      return
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(t("profilePhotoTitle", ui), t("profileGalleryPermission", ui))
        return
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      })
      if (res.canceled || !res.assets[0]) return
      const asset = res.assets[0]
      const mime = asset.mimeType ?? "image/jpeg"
      if (!AVATAR_MIME.includes(mime as (typeof AVATAR_MIME)[number])) {
        Alert.alert(t("alertFormatTitle", ui), t("alertFormatBody", ui))
        return
      }
      if (asset.fileSize != null && asset.fileSize > MAX_AVATAR_BYTES) {
        Alert.alert(t("alertSizeTitle", ui), t("alertSizeBody", ui))
        return
      }

      const ext =
        mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"
      const formData = new FormData()
      formData.append("file", {
        uri: asset.uri,
        name: `avatar.${ext}`,
        type: mime,
      } as unknown as Blob)

      setAvatarSaving(true)
      try {
        await api<User>("/users/me/avatar", {
          method: "POST",
          formData,
        })
        await refresh()
        Alert.alert(t("alertDone", ui), t("alertAvatarUpdated", ui))
      } catch (err) {
        Alert.alert(
          t("alertError", ui),
          err instanceof ApiError ? err.message : t("alertAvatarUploadFail", ui),
        )
      } finally {
        setAvatarSaving(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("ExponentImagePicker") || msg.includes("native module")) {
        Alert.alert(t("profileGalleryUnavailable", ui), t("profileGalleryNativeHint", ui))
        return
      }
      Alert.alert(t("alertError", ui), msg || t("profileGalleryError", ui))
    }
  }

  const deleteAvatar = async () => {
    setAvatarSaving(true)
    try {
      await api<User>("/users/me/avatar", {
        method: "DELETE",
      })
      await refresh()
      Alert.alert(t("alertDone", ui), t("alertAvatarDeleted", ui))
    } catch (err) {
      Alert.alert(
        t("alertError", ui),
        err instanceof ApiError ? err.message : t("alertAvatarDeleteFail", ui),
      )
    } finally {
      setAvatarSaving(false)
    }
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const currentLanguage =
        ((user?.preferredLanguage as "ru" | "kk" | null | undefined) || uiLocale) === "kk"
          ? "kk"
          : "ru"
      const currentTimezone = user?.timezone || "Asia/Almaty"
      const body: { preferredLanguage?: "ru" | "kk"; timezone?: string } = {}
      if (language !== currentLanguage) body.preferredLanguage = language
      if (timezone !== currentTimezone) body.timezone = timezone

      if (Object.keys(body).length === 0) {
        setLocale(language)
        Alert.alert(t("alertDone", ui), t("alertSettingsSaved", ui))
        setSaving(false)
        return
      }

      await api<User>("/users/me", {
        method: "PATCH",
        body,
      })
      await refresh()
      setLocale(language)
      Alert.alert(t("alertDone", ui), t("alertSettingsSaved", ui))
    } catch (err) {
      Alert.alert(t("alertError", ui), err instanceof ApiError ? err.message : t("alertSaveFailed", ui))
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.secondary }]}>
        <Spinner />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: colors.secondary }]}>
      <Text style={[styles.h1, { color: colors.foreground }]}>{t("profile", ui)}</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        {t("profileSubtitle", ui)}
      </Text>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("profileAccount", ui)}</Text>
        <View style={styles.accountRow}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
              {avatarSrc ? (
                <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
              ) : (
                <Text style={[styles.avatarFall, { color: colors.foreground }]}>{initials}</Text>
              )}
            </View>
            {avatarSaving ? (
              <View
                style={[
                  styles.avatarOverlay,
                  {
                    backgroundColor:
                      resolved === "dark" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
                  },
                ]}
              >
                <Spinner size="small" />
              </View>
            ) : null}
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
            <View>
              <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {user.phone || user.telegramUsername || "—"}
              </Text>
            </View>
            <View style={styles.avatarActions}>
              <Button variant="outline" disabled={avatarSaving} onPress={() => void pickAvatar()}>
                {t("profileUploadPhoto", ui)}
              </Button>
              {user.avatarUrl ? (
                <Button variant="outline" disabled={avatarSaving} onPress={() => void deleteAvatar()}>
                  {t("profileDeletePhoto", ui)}
                </Button>
              ) : null}
            </View>
          </View>
        </View>
        <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
          {t("profileAvatarHint", ui)}
        </Text>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {t("profileInterfaceLang", ui)}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["ru", "kk"] as const).map((lng) => (
            <Pressable
              key={lng}
              onPress={() => setLanguage(lng)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: language === lng ? colors.foreground : colors.border,
                backgroundColor: language === lng ? colors.foreground : colors.card,
              }}
            >
              <Text style={{ color: language === lng ? colors.background : colors.foreground }}>
                {lng === "ru" ? t("langRussian", ui) : t("langKazakh", ui)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>
          {t("profileTimezone", ui)}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TIMEZONES.map((tz) => (
            <Pressable
              key={tz}
              onPress={() => setTimezone(tz)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: timezone === tz ? colors.foreground : colors.border,
                backgroundColor: timezone === tz ? colors.foreground : colors.card,
              }}
            >
              <Text
                style={{
                  color: timezone === tz ? colors.background : colors.foreground,
                  fontSize: 12,
                }}
              >
                {tz.replace("Asia/", "")}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <Button onPress={() => void onSave()} disabled={saving}>
            {saving ? t("profileSaving", ui) : t("profileSave", ui)}
          </Button>
        </View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Документы и поддержка</Text>
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => router.push("/legal/privacy" as Href)}>
            <Text style={[styles.legalNav, { color: colors.accent }]}>Политика конфиденциальности</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/legal/terms" as Href)}>
            <Text style={[styles.legalNav, { color: colors.accent }]}>Условия использования</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/legal/support" as Href)}>
            <Text style={[styles.legalNav, { color: colors.accent }]}>Поддержка</Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 30, fontFamily: fonts.sansSemi, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
  cardTitle: { fontSize: 16, fontFamily: fonts.sansSemi, marginBottom: 14 },
  accountRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  avatarWrap: { width: 84, height: 84, position: "relative" },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: 84, height: 84 },
  avatarFall: { fontSize: 26, fontFamily: fonts.sansSemi },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  displayName: { fontSize: 18, fontFamily: fonts.sansSemi },
  meta: { fontSize: 14, marginTop: 4 },
  avatarActions: { gap: 8 },
  avatarHint: { fontSize: 12, marginTop: 12 },
  label: { fontSize: 13, marginBottom: 8 },
  legalNav: { fontSize: 15, paddingVertical: 4 },
})

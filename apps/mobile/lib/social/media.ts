import { Directory, File, Paths } from "expo-file-system"
import { requireApiOrigin } from "@/lib/config"
import { refreshSession } from "@/lib/api/client"
import { getAccessToken } from "@/lib/api/storage"
import type { Attachment } from "./types"

const extensionOf = (a: Attachment) => {
  const fromName = a.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]
  if (fromName) return `.${fromName.toLowerCase()}`
  if (a.mime === "image/png") return ".png"
  if (a.mime.startsWith("image/")) return ".jpg"
  if (a.mime.startsWith("audio/")) return ".m4a"
  if (a.mime.startsWith("video/")) return ".mp4"
  if (a.mime === "application/pdf") return ".pdf"
  return ""
}

function mediaDirectory() {
  const dir = new Directory(Paths.cache, "chat-media")
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  return dir
}

/** Chat media stays behind authorization: fetch it with the session token and cache it privately. */
export async function downloadChatMedia(attachment: Attachment): Promise<string> {
  const file = new File(mediaDirectory(), `${attachment.id}${extensionOf(attachment)}`)
  if (file.exists && file.size > 0) return file.uri
  const url = `${requireApiOrigin()}/api/v1/social/media/${encodeURIComponent(attachment.id)}`
  const attempt = () =>
    File.downloadFileAsync(url, file, {
      headers: { Authorization: `Bearer ${getAccessToken("user") ?? ""}` },
      idempotent: true,
    })
  try {
    await attempt()
  } catch (e) {
    if (!/401/.test(String(e)) || !(await refreshSession("user"))) throw e
    await attempt()
  }
  return file.uri
}

/** Private attachments must not outlive the session on the device. */
export function clearChatMediaCache() {
  try {
    const dir = new Directory(Paths.cache, "chat-media")
    if (dir.exists) dir.delete()
  } catch {
    // Best effort: the OS also purges the cache directory.
  }
}

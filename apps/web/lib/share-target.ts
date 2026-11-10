/**
 * Открывает мессенджер с готовым сообщением. Окно, созданное синхронно в клике (popup),
 * переживает await — Safari блокирует window.open, вызванный после ожидания сети.
 */
export function openShareTarget(target: string, popup: Window | null) {
  if (popup && !popup.closed) {
    popup.opener = null
    popup.location.href = target
    return
  }
  const opened = window.open(target, "_blank")
  if (opened) {
    opened.opener = null
    return
  }
  window.location.assign(target)
}

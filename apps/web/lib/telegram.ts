const DEFAULT_TELEGRAM_BOT_USERNAME = "bilimhan_bot"

export function getTelegramBotUsername() {
  return (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || DEFAULT_TELEGRAM_BOT_USERNAME)
    .trim()
    .replace(/^@/, "")
}

export function getTelegramBotLink(start = "web") {
  const username = getTelegramBotUsername()
  const query = start ? `?start=${encodeURIComponent(start)}` : ""
  return `https://t.me/${username}${query}`
}

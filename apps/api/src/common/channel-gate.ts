/**
 * The Telegram channel gate applies to Telegram-native accounts only. Accounts without Telegram,
 * and web (Google/email) accounts that linked Telegram later just for reminders
 * (`telegramLinkedAt`), are never gated. Keep every membership check consistent with this.
 */
export function isChannelGateExempt(user: {
  telegramId: bigint | number | null | undefined;
  telegramLinkedAt?: Date | null;
}) {
  return user.telegramId == null || Boolean(user.telegramLinkedAt);
}

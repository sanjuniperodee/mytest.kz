const DEFAULT_WA_DIGITS = '77775932124';

/** Digits for wa.me: env `VITE_WHATSAPP_NUMBER` if set, else same default as in-app paywall. */
export function getWhatsAppNumberDigits(): string {
  const raw = import.meta.env.VITE_WHATSAPP_NUMBER;
  if (raw && String(raw).trim()) {
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length >= 10) return digits;
  }
  return DEFAULT_WA_DIGITS;
}

/** WhatsApp chat link from env `VITE_WHATSAPP_NUMBER` (digits, with or without +7). */
export function getWhatsAppUrl(): string | null {
  const raw = import.meta.env.VITE_WHATSAPP_NUMBER;
  if (!raw || !String(raw).trim()) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}

export function openWhatsAppWithText(message: string): void {
  const n = getWhatsAppNumberDigits();
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`, '_blank');
}

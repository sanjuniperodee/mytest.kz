/** WhatsApp chat link from env `VITE_WHATSAPP_NUMBER` (digits, with or without +7). */
export function getWhatsAppUrl(): string | null {
  const raw = import.meta.env.VITE_WHATSAPP_NUMBER;
  if (!raw || !String(raw).trim()) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}

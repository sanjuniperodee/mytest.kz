// Never expose contact details, Telegram IDs, billing data or auth fields in social responses.
export const person = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;
export const order = [{ createdAt: "desc" as const }, { id: "desc" as const }];
export const page = <T extends { id: string }>(rows: T[]) => ({
  items: rows.slice(0, 30),
  nextCursor: rows.length > 30 ? rows[29].id : null,
});

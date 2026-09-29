import type { Message, Page } from "./types";

export const compareMessages = (a: Message, b: Message) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Keep arrivals between polling windows rather than losing a burst over 30. */
export async function refreshMessageWindow(
  previous: Page<Message> | undefined,
  fetchLatest: () => Promise<Page<Message>>,
  fetchAfter: (id: string) => Promise<Page<Message>>,
): Promise<Page<Message>> {
  const fresh = await fetchLatest();
  if (!previous?.items.length || !fresh.items.length) return fresh;
  const head = previous.items[0];
  let additions = fresh.items;
  let caughtUp = true;
  if (
    compareMessages(fresh.items[0], head) > 0 &&
    !fresh.items.some((m) => m.id === head.id)
  ) {
    additions = [];
    let anchor = head.id;
    caughtUp = false;
    // Bound work per poll; continue from the last received item on the next poll.
    for (let batch = 0; batch < 4; batch++) {
      const next = await fetchAfter(anchor);
      additions.push(...next.items);
      if (
        !next.nextCursor ||
        next.items.some((m) => compareMessages(m, fresh.items[0]) >= 0)
      ) {
        caughtUp = true;
        break;
      }
      anchor = next.nextCursor;
    }
  }
  const liveIds = new Set(fresh.items.map((m) => m.id));
  const boundary = fresh.items.at(-1)!;
  // The newest server window is authoritative for edits/removals in that range.
  const retained = previous.items.filter(
    (m) => !caughtUp || compareMessages(m, boundary) < 0 || liveIds.has(m.id),
  );
  const items = [
    ...new Map(
      [...retained, ...additions, ...(caughtUp ? fresh.items : [])].map((m) => [
        m.id,
        m,
      ]),
    ).values(),
  ].sort((a, b) => compareMessages(b, a));
  return { items, nextCursor: previous.nextCursor };
}

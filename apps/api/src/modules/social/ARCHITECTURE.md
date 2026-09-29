# Community and messaging

This is a modular monolith inside the existing Nest API, not another service or database.

## Boundaries

- `posts` owns feed, threads, reactions and reports. `people` owns profiles, follows and blocks.
- There is one profile per user for the whole platform (web `/dashboard/profile/:id`; own profile at `/dashboard/profile`). `GET /social/people/:id` adds `learning` (full-format ENT attempts and best result/rank from `LeaderboardService.getEntStanding`, so ranks match the leaderboard). Other people see the best result only when it is inside the public top-100 (`PUBLIC_LEADERBOARD_SIZE`); the owner always sees it.
- `chats` owns conversations, sending, retry deduplication and read markers. `groups` owns membership, invitations and ownership.
- Controllers validate/route HTTP requests; application services coordinate operations. There is no Prisma or filesystem I/O in controllers.
- `ChatAccessService` is the common access entry point for reads, sends, group administration and media. `SocialAccessService` handles bilateral user blocks.
- `domain/chat-policy.ts` defines permission decisions; PostgreSQL enums constrain room kinds and member roles.
- `ChatRepository` owns room serialization and the batched unread-count query. Ordinary Prisma queries stay close to their feature use case; no generic pass-through repository layer.
- `ChatFileStore` owns private local storage. `ChatMediaService` owns validation, quotas and download authorization. `domain/media-format.ts` validates file signatures.
- `ModerationService` is reached only behind the existing database-backed `AdminGuard`. Reading chat content/media and moderation mutations are audited. Group owners/admins cannot use platform moderation endpoints.

## Invariants

- The server chooses author, room membership and privilege; JWT `isAdmin` is not authority.
- Direct-room identity is the sorted user pair. Concurrent opens of the same pair race on `key` (nested create prevents a native upsert); the loser retries and reads the winner's room. Global room identity is `global`; group identities and revocable invitation tokens are random UUIDs.
- Group role changes and sends lock the same room row. Muted, banned or removed participants cannot send after the restriction commits.
- Only the owner transfers ownership or closes a group. An owner cannot leave without transferring ownership. Admins cannot promote themselves or manage the owner/other admins.
- Posts store a snapshot of the invitation token. Rotating it invalidates both copied links and old post invitations.
- Read markers refer to a message in that room and advance monotonically; they do not mark later, unseen messages read.
- `(authorId, clientId)` is unique. Reusing it for a different body, room or attachment is rejected.
- Media download requires active room access (or audited platform-admin access). Unsent uploads are visible only to their uploader. Deleted-message media is hidden from participants.
- Client components render views; `use-conversation`, `use-group-settings` and `use-chat-media` own network/state/recorder lifecycles. Blob URLs and microphone tracks are released on unmount.
- `GET /social/rooms/:id` (ChatsController) checks access and retrieves that exact room, independently of the 100-room inbox limit. Group settings (roles, invite token, full member list) are `GET /social/groups/:id`; never declare the same route in two controllers — Nest silently serves the first one registered. `GET /social/rooms/unread` returns the inbox unread total (direct + group, not global) for the navigation badge. Room previews include attachment metadata; global-room membership remains an idempotent operation.
- Message pagination uses `(createdAt, id)` keysets. `cursor` retrieves older rows in descending order; `after` retrieves newer rows in ascending order. Both are UUID message IDs scoped to the same room, including tombstones. Mixing directions is rejected. Pages contain at most 30 messages.
- The web `message-window` helper reconciles newest-window polling with forward catch-up (at most four batches per poll). It keeps the older-history cursor stable and never advances to a locally acknowledged send before catching up. Confirmed delivery and subsequent refresh failures are distinct; retrying an unconfirmed message reuses its client ID while the composer remains mounted.
- Read acknowledgements are serialized and sent only while the document is visible and the conversation is at the bottom. Failed acknowledgements retry on the next visibility/poll cycle. Feed refresh is manual to avoid shifting content while reading; nested replies remain explicitly expanded by the reader.

## Release scope and operational limits

- Web/admin/API are implemented. Native Expo chat screens are not part of this release.
- Text is limited to 2,000 characters. Groups allow 200 active participants; one attachment per message, 15 MB per upload and 150 MB per uploader per day. Voice recording stops at three minutes.
- Message refresh currently uses visibility-aware polling every five seconds; room lists every ten seconds. No claims of WebSocket delivery, push, typing indicators or end-to-end encryption.
- Newest-window deletions are reconciled during polling; deleting your own loaded message removes it immediately from local history. Changes by other participants to older, already-loaded history can require reloading the conversation. Long-lived conversations retain their loaded messages in memory; drafts and pending retry IDs are not persisted across a reload. Read markers use timestamps, so equal-timestamp messages share read status.
- Store private media in `CHAT_MEDIA_DIR` or `apps/api/private-chat-media` with the production API cwd. Back up this directory alongside PostgreSQL. It must never be exposed by nginx or the public uploads proxy.
- Deletion is a tombstone: text is cleared, attachment metadata/files remain accessible to platform moderation. Retention/purge automation is not implemented in this release; monitor disk usage and configure retention before large-scale media use.
- Migration only creates new tables/types and foreign keys; it does not modify existing learning/payment data. Rollback application code without dropping these tables.

## Verification

`SOCIAL_TEST_DATABASE_URL` opts integration tests into an isolated localhost PostgreSQL database. Tests exercise JWT sessions, validation, nested replies, idempotency, third-party access, role hierarchy, invite revocation, private media and moderation. `test/social-browser.cjs` exercises real social HTTP/database operations with a fixture only for the surrounding account shell. Never run those fixtures on production.

Additional isolated regression checks (no production access):

- `npm --prefix apps/api run test:api -- --runTestsByPath test/social-chat-pagination.http.spec.ts`: controller validation and service query/access contracts with mock persistence.
- `node --test apps/api/test/social-message-window.cjs`: pure reconciliation, bursts, bounded catch-up, deletion and failures.
- `WEB_TEST_URL=http://127.0.0.1:4320 node apps/api/test/social-polish-browser.cjs`: local web with mocked API, RU/KK at 320/390/1280px; feed drafts/lazy replies, inbox filters, room detail, read markers, safe retries, media controls, history anchoring and unobstructed composer. These fixtures do not replace PostgreSQL integration tests.

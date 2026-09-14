# Community and messaging

This is a modular monolith inside the existing Nest API, not another service or database.

## Boundaries

- `posts` owns feed, threads, reactions and reports. `people` owns public profiles, follows and blocks.
- `chats` owns conversations, sending, retry deduplication and read markers. `groups` owns membership, invitations and ownership.
- Controllers validate/route HTTP requests; application services coordinate operations. There is no Prisma or filesystem I/O in controllers.
- `ChatAccessService` is the common access entry point for reads, sends, group administration and media. `SocialAccessService` handles bilateral user blocks.
- `domain/chat-policy.ts` defines permission decisions; PostgreSQL enums constrain room kinds and member roles.
- `ChatRepository` owns room serialization and the batched unread-count query. Ordinary Prisma queries stay close to their feature use case; no generic pass-through repository layer.
- `ChatFileStore` owns private local storage. `ChatMediaService` owns validation, quotas and download authorization. `domain/media-format.ts` validates file signatures.
- `ModerationService` is reached only behind the existing database-backed `AdminGuard`. Reading chat content/media and moderation mutations are audited. Group owners/admins cannot use platform moderation endpoints.

## Invariants

- The server chooses author, room membership and privilege; JWT `isAdmin` is not authority.
- Direct-room identity is the sorted user pair. Global room identity is `global`; group identities and revocable invitation tokens are random UUIDs.
- Group role changes and sends lock the same room row. Muted, banned or removed participants cannot send after the restriction commits.
- Only the owner transfers ownership or closes a group. An owner cannot leave without transferring ownership. Admins cannot promote themselves or manage the owner/other admins.
- Posts store a snapshot of the invitation token. Rotating it invalidates both copied links and old post invitations.
- Read markers refer to a message in that room and advance monotonically; they do not mark later, unseen messages read.
- `(authorId, clientId)` is unique. Reusing it for a different body, room or attachment is rejected.
- Media download requires active room access (or audited platform-admin access). Unsent uploads are visible only to their uploader. Deleted-message media is hidden from participants.
- Client components render views; `use-conversation`, `use-group-settings` and `use-chat-media` own network/state/recorder lifecycles. Blob URLs and microphone tracks are released on unmount.

## Release scope and operational limits

- Web/admin/API are implemented. Native Expo chat screens are not part of this release.
- Text is limited to 2,000 characters. Groups allow 200 active participants; one attachment per message, 15 MB per upload and 150 MB per uploader per day. Voice recording stops at three minutes.
- Message refresh currently uses visibility-aware polling every five seconds; room lists every ten seconds. No claims of WebSocket delivery, push, typing indicators or end-to-end encryption.
- Store private media in `CHAT_MEDIA_DIR` or `apps/api/private-chat-media` with the production API cwd. Back up this directory alongside PostgreSQL. It must never be exposed by nginx or the public uploads proxy.
- Deletion is a tombstone: text is cleared, attachment metadata/files remain accessible to platform moderation. Retention/purge automation is not implemented in this release; monitor disk usage and configure retention before large-scale media use.
- Migration only creates new tables/types and foreign keys; it does not modify existing learning/payment data. Rollback application code without dropping these tables.

## Verification

`SOCIAL_TEST_DATABASE_URL` opts integration tests into an isolated localhost PostgreSQL database. Tests exercise JWT sessions, validation, nested replies, idempotency, third-party access, role hierarchy, invite revocation, private media and moderation. `test/social-browser.cjs` exercises real social HTTP/database operations with a fixture only for the surrounding account shell. Never run those fixtures on production.

# Email + Google account takeover: status, fix, prod check

Written 2026-11-10. Code: `apps/api/src/modules/auth/auth.service.ts`,
`apps/api/src/common/email-ownership.ts`. Tests: `apps/api/test/auth-email-google-takeover.http.spec.ts`.

## Was the hole still open?

**No new takeover has been possible since 17 June 2026.** The attack needs an account registered with
someone else's email, and `POST /auth/register` has returned 400 since commit `e4f742d`. From the same
day Google sign-in refused to merge into an account that was unverified or had a password (`69b1055`).
Email signup was open from 12 May (`d323926`) to 17 June.

What that June fix left behind, and what this change closes:

1. **Accounts merged before 17 June still accepted the pre-merge password.** The old merge set
   `google_id` and `email_verified = true` but kept `password_hash`, and password login only checked
   `email_verified`. If any of those accounts was pre-registered by a stranger, the stranger's
   password worked until now.
2. **People who signed up by email in good faith were locked out completely.** Password login said
   "confirm your email" (there is no way to do that) and Google sign-in said "this email is already
   registered". A squatted email blocked its real owner the same way.
3. **A session a stranger still holds** on a pre-registered account could, since the Telegram-connect
   release, attach a Telegram account and phone — a second way in.

## What the code does now

One rule: an account with a password, or with an email nobody verified, has *unproven* access
(`hasUnprovenEmailAccess`). Google sign-in is the only proof of who owns an email.

- **First Google sign-in with that email takes the account back.** Same user id, so results,
  purchases and profile stay. In one transaction: password removed, email marked verified, every
  session revoked, Telegram link and phone removed, push subscriptions deleted; the parent-report
  link is revoked just before it.
- **Password login is refused** for an unverified account and for any account that has Google
  (401, same status as before; asked only after the password matches, so it does not reveal which
  emails exist).
- **Connecting Telegram is refused** for an unproven account (403 `GOOGLE_SIGN_IN_REQUIRED`).

Sessions are database rows checked on every request, so revoking them kills access and refresh
tokens at once. The June note about stateless 60-day refresh tokens no longer applies.

### What is not undone

- **Nothing happens until the owner signs in with Google.** A stranger's open session on such an
  account keeps working until then. The optional cleanup below ends that wait.
- **Content is kept.** Name, avatar, results, posts and messages on the account cannot be told apart
  from the owner's own, so they stay; the owner can edit the profile.
- **Telegram link tokens issued in the 30 minutes before deploy** cannot be recalled (they are
  stateless). After deploy unproven accounts cannot get one.
- **One narrow race.** If a stranger had already attached Telegram and a phone, a Telegram login
  that starts just before the take-back and finishes just after it leaves one live session. It needs
  that login to be in flight at that moment. The check below shows whether any such account exists
  (`with_telegram_or_phone`); closing it properly means locking the user row when a session is
  created.

## Prod check (read-only)

Counts only, no personal data:

```sql
SELECT
  count(*)                                                              AS unproven_accounts,
  count(*) FILTER (WHERE google_id IS NULL)                             AS never_used_google,
  count(*) FILTER (WHERE google_id IS NOT NULL)                         AS merged_with_google,
  count(*) FILTER (WHERE google_id IS NOT NULL AND password_hash IS NOT NULL
                         AND NOT email_verified)                        AS merged_password_unverified,
  count(*) FILTER (WHERE telegram_id IS NOT NULL OR phone IS NOT NULL)  AS with_telegram_or_phone,
  count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM auth_sessions s
      WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now())) AS with_live_session,
  count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM test_sessions t WHERE t.user_id = u.id))            AS with_test_history
FROM users u
WHERE u.password_hash IS NOT NULL
   OR (u.email IS NOT NULL AND NOT u.email_verified);
```

How to read it:

- `never_used_google` — locked out today; their next Google sign-in takes the account back.
- `merged_with_google` — the accounts from point 1; the password is refused as soon as this ships.
- `merged_password_unverified` — the combination `password_hash` + `google_id` +
  `email_verified = false`. The code never wrote it (every merge set `email_verified = true`), so
  expect 0; anything else was edited by hand.
- `with_live_session` — accounts where somebody is signed in right now without proof of ownership.

Per account, still without emails (useful when the counts are small):

```sql
SELECT u.id,
       u.created_at,
       u.google_id IS NOT NULL    AS has_google,
       u.email_verified,
       u.telegram_id IS NOT NULL  AS has_telegram,
       (SELECT count(*) FROM auth_sessions s
         WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now()) AS live_sessions,
       (SELECT max(s.last_used_at) FROM auth_sessions s WHERE s.user_id = u.id)    AS last_refresh,
       (SELECT count(*) FROM test_sessions t WHERE t.user_id = u.id)               AS tests
FROM users u
WHERE u.password_hash IS NOT NULL
   OR (u.email IS NOT NULL AND NOT u.email_verified)
ORDER BY u.created_at;
```

## Optional one-off cleanup (writes — owner's decision, after deploy)

Signs every unproven account out once, so nobody stays logged in on a session that predates proof
of ownership. Owners sign in with Google again and the code does the rest. Do **not** clear
`password_hash` by hand: it is what makes the next Google sign-in run the full take-back.

```sql
UPDATE auth_sessions
SET revoked_at = now()
WHERE revoked_at IS NULL
  AND user_id IN (
    SELECT id FROM users
    WHERE password_hash IS NOT NULL OR (email IS NOT NULL AND NOT email_verified)
  );
```

If `with_telegram_or_phone` is above 0 and those links should not wait for the owner either:

```sql
UPDATE users
SET telegram_id = NULL, telegram_username = NULL, telegram_linked_at = NULL, phone = NULL
WHERE (password_hash IS NOT NULL OR (email IS NOT NULL AND NOT email_verified))
  AND telegram_id IS NOT NULL;
```

## What users can notice

- Someone who registered by email in May–June can sign in again: "Continue with Google" with the
  same address opens their old account with its results. Before, both doors were shut.
- The mobile app's email/password form now answers "Вход по паролю для этого аккаунта отключён.
  Войдите через Google с этим же email — аккаунт и результаты сохранятся." instead of "Подтвердите
  email перед входом". For accounts merged with Google before 17 June the password used to work
  and now gets this message.
- On that first Google sign-in the account is signed out on every other device, Telegram reminders
  must be connected again, browser push must be allowed again, and a parent-report link that was
  shared stops working (a new one can be sent). This happens once per account.
- "Connect Telegram" fails for an account that has not signed in with Google yet; the web shows its
  generic error toast for it.
- Ordinary Google and Telegram accounts: no change.

## Follow-ups (not in this change)

- **Email verification for signup** (or a magic link / password reset over the SMTP that now works).
  Needed before email signup can be opened again, and the only way back in for someone whose address
  cannot be used with Google sign-in. It changes the signup funnel, so it is a separate decision.
- Lock the user row when a session is created, to close the race described above.
- A Google account whose address changed to one that another account already holds fails with a
  500 (unique constraint) instead of a clear message. Existed before this change.
- `npm run lint` in `apps/api` cannot run: `eslint` is not a dependency and there is no config.
- `CLAUDE.md` says the root `package.json` is not checked in; it is.
- The web toast could show a specific message for `GOOGLE_SIGN_IN_REQUIRED`.

# Second proof of email ownership: a code sent to the address — proposal

Written 2026-11-10. **Status: proposal, nothing implemented. Waiting for the owner to pick** (see
"Decisions" at the end). Builds on `docs/auth-email-google-takeover.md` (commit `481b927`); this
branch sits on top of that commit and cannot ship before it.

## The gap

After `481b927` Google sign-in is the only proof of who owns an email. An account from the open
signup window (12 May – 17 June 2026) whose address has no Google account behind it — mail.ru,
yandex, icloud, a school address — has no way in: password login is refused, there is nothing else.
For the same reason email signup cannot be reopened.

## Facts from the code that shape the design

- **The only email form is in the mobile app** (`apps/mobile/components/auth/EmailLoginForm.tsx`,
  added with signup in `d323926`). The web login page has Google and Телефон tabs and no email
  field. So the affected people signed up in the app, and that is where they come back.
- **A link in a mail cannot open the app.** `apps/mobile/app.json` has only the custom scheme
  `mobile`, no universal links. A mailed link would sign the person in on the website in the
  phone's browser, not in the app they are holding. On the website, someone who opened the login
  page inside Telegram's in-app browser would have the link open in a different browser.
- **Mail is tight.** Prod sends through Resend's free plan (100 a day per the setup notes);
  `deploy/set-mail-env.sh` sets `MAIL_DAILY_CAP=90`, and that one counter is what lifecycle
  campaigns spend (`MailerService.reserveSlot`). Sign-in mail sharing it would get nothing on a day
  the campaigns ran first.
- **Per-IP limits may not see the visitor.** `ThrottlerGuard` keys on `req.ip`, the API trusts only
  `loopback` (`TRUST_PROXY`), and website requests arrive through the Next proxy, which calls
  `https://api.my-test.kz` from the server. Whether the API then sees the visitor's address or the
  server's own depends on the nginx config, which is not in the repo. **Not verified.**
- **Lifecycle mail goes only to accounts with a Google link** (`notification-channels.ts`). This
  proposal does not change that.
- **How many accounts are affected is unknown** — I have no prod access. The count is below.

## Decision 1 — scope

| | What it does | Cost |
|---|---|---|
| **0. Nothing** | Affected people write to support; an admin fixes the account by hand. | No new way in. Right answer if the count below is a handful. |
| **A. Recovery only** (recommended) | An existing account with no Google link signs in with a code mailed to its address. Unknown addresses get no mail. | One new sign-in path. Mail volume is a trickle, and it is hard to abuse: mail goes only to addresses that already have an account, and responses do not say which those are. |
| **B. A + reopen email signup** | An unknown address also gets a code; entering it creates the account. | Every signup costs one mail, so the free Resend plan becomes the ceiling on signups and logins. Anyone can make the site mail any address, so it needs per-IP limits that really see the visitor (unverified, above), probably a captcha, and a paid mail plan. Slower than the Google button; some codes will land in spam. |

A is built so that B is a small later change (create the account at the moment the code is
accepted). Recommendation: **A now; decide B after two to four weeks of real delivery numbers.**

Counts that would settle 0 versus A (read-only, no personal data):

```sql
SELECT
  count(*)                                                        AS no_google_unproven,
  count(*) FILTER (WHERE d IN ('gmail.com', 'googlemail.com'))    AS gmail,      -- Google works for these today
  count(*) FILTER (WHERE d NOT IN ('gmail.com', 'googlemail.com')) AS other,     -- the real gap
  count(*) FILTER (WHERE d NOT IN ('gmail.com', 'googlemail.com')
                   AND EXISTS (SELECT 1 FROM test_sessions t WHERE t.user_id = u.id)) AS other_with_tests
FROM (SELECT id, lower(split_part(email, '@', 2)) AS d FROM users
      WHERE google_id IS NULL AND email IS NOT NULL
        AND (password_hash IS NOT NULL OR NOT email_verified)) u;
```

And for B, how much signup the email door carried while it was open:

```sql
SELECT count(*) FILTER (WHERE password_hash IS NOT NULL) AS by_email, count(*) AS all_signups
FROM users WHERE created_at >= '2026-05-12' AND created_at < '2026-06-18';
```

## Decision 2 — code or link

Recommendation: **a 6-digit code typed into the form that asked for it**, not a link.

- It works the same in the app and on the site, with no deep-link setup and no "signed in, but in
  the wrong browser".
- It is the pattern the site already has for phones (`requestWebCode` / `verifyWebCode`, the
  `InputOTP` field in `phone-form.tsx`): "код придёт в Telegram" becomes "код придёт на почту".
- Mail scanners that open every link cannot use it up.

What a link does better: it cannot be guessed, and a person tricked into forwarding it gives away
less than a person tricked into reading out a code. The guessing risk is bounded below; the second
one is handled the usual way, by the text of the mail. If the owner prefers a link anyway, the
storage and limits below stay the same and the website gets a confirm page; the app would still
need the code.

## Design (for A with a code)

**Endpoints** — `POST /auth/email/request-code { email }`, `POST /auth/email/verify-code
{ email, code }`. Off unless `AUTH_EMAIL_CODE_ENABLED=1`, so a deploy does not switch it on.

**Who gets a code** — an account whose email matches (trimmed, lower-cased) and that has **no
Google link**. Accounts with Google keep using Google: their Google id is a stronger tie than a
mailbox, and this way nobody can make the site mail codes to ordinary users.

**The code**
- 6 digits from `crypto.randomInt`, valid 10 minutes, one live code per address (a new request
  replaces the old one).
- Stored in Redis only, as an HMAC of address + code under a key derived for this purpose from
  `JWT_SECRET` — a Redis dump does not show live codes. Redis because the codebase already keeps
  login codes there, expiry is built in and no migration is needed; if Redis is wiped, codes die.
- Bound to the address and the user id. On use the account is read again and must still have that
  email and no Google link.
- Single use: accepting a code deletes it first, and only the request that deleted it continues.
- Five wrong tries kill the code. Revoked also by a Google take-back of the same account.
- One answer for wrong, used, expired and unknown: 401 «Неверный или истёкший код».

**No way to learn which addresses have accounts** — `request-code` answers `{ ok: true }` for
every well-formed address. Limits are counted per address before the account lookup, so a 429
means the same for known and unknown addresses. The mail is sent after the response, so timing
does not differ. `verify-code` treats an unknown address exactly like a wrong code.

**Limits**
- Per address: one request per 60 s, 3 per hour, 6 per day.
- Per IP: 5 requests a minute and 10 verifications a minute (`@Throttle`, as on the phone
  endpoints), plus 20 requests an hour. Deliberately loose until the client-IP question is
  answered — if all website visitors share one bucket, a tight limit would lock everyone out.
- Guessing: at most 6 codes × 5 tries = 30 guesses a day per address (0.003 %), and for the whole
  site 5 × the day's sign-in mail budget.

**Mail budget** — sign-in mail gets its own daily counter and cap, `MAIL_AUTH_DAILY_CAP`
(default 20); campaigns may use `MAIL_DAILY_CAP − MAIL_AUTH_DAILY_CAP`. On prod today that is
70 campaign + 20 sign-in mails a day, total still 90. **This lowers campaign mail from 90 to 70 a
day.** When the sign-in budget is spent, or SMTP is not configured, `request-code` answers 503 for
every address alike. No unsubscribe header, no tracking; the mail is sent whether or not the
person opted out of campaigns.

**A correct code**
1. If the account has unproven access (`hasUnprovenEmailAccess`): the same take-back as Google.
   The body of `signInExistingWithGoogle` moves into one method, `takeBackAccount(userId, data,
   proof)`, called from both places — password, every session, Telegram link and phone, push
   subscriptions and the parent-report link go; user id, results and purchases stay.
2. `emailVerified = true`.
3. Free entitlements, then `generateTokens` — the same response and refresh cookie as any login.

Later code sign-ins into the same account are plain logins: nothing is revoked.

**Passwords do not come back.** The code is the login. A password set in the unverified window
proves nothing, and a "set a new password" feature would itself need a mailed code, plus storage
and a reset flow to maintain. After this change nobody can sign in with a password;
`POST /auth/login` stays only to answer old app builds with a message.

## What people see

- **App (needs a store release):** the Email tab asks for the address, then the code. No password
  field. Until the release, the old Email tab shows the server's message, changed to: «Вход по
  паролю отключён. Войдите на сайте my-test.kz: через Google или по коду из письма».
- **Website:** under the Google / Телефон tabs a quiet line, «Регистрировались по email? Войти по
  коду из письма», opening address → code. Not a third tab: in scope A a newcomer who typed a new
  address there would wait for a mail that never comes. Text under the field: «Если аккаунт с этим
  адресом есть, мы отправили код. Проверьте „Спам“. Входили через Google — нажмите кнопку Google».
- **The mail:** subject «Код для входа в my-test.kz», the code, «действует 10 минут», «если вы не
  запрашивали код — ничего не делайте и никому его не сообщайте». Russian or Kazakh by the
  account's language.
- **First sign-in with a code** into an account from the signup window: signed out on other
  devices; Telegram reminders, browser push and the parent-report link must be set up again —
  once, the same as on the Google path.
- "Connect Telegram" for an unproven account keeps the code `GOOGLE_SIGN_IN_REQUIRED`; its text
  names both ways.
- Google and Telegram accounts: no change.

## Not covered by this design

- Someone who keeps asking for codes for one address, or burning them with wrong guesses, can keep
  that address from signing in by code while they keep at it. No data is exposed.
- The 503 when the day's sign-in mail budget runs out is visible to everyone. Someone who holds a
  few eligible accounts can spend the budget down to its last mail and then learn, from whether the
  next request still gets through, if one chosen address has an account — about one address a day.
  Accepted; the alternative is to answer `ok` and send nothing, which leaves real people waiting
  for a mail with no explanation.
- A mailbox that its provider gave to a new person lets that person into the old account. True of
  any sign-in by email; it is why Google-linked accounts are left out.
- Delivery to mail.ru / yandex from the new sending domain is untested.

## Implementation plan (after approval)

API: `auth.controller.ts` (two routes), `auth.service.ts` (`takeBackAccount`, code sign-in), a small
`email-code` helper for storage and limits, `mailer.service.ts` (second budget), the mail template.
Web: `components/auth/email-code-form.tsx` and the line on `/login`. Mobile: `EmailLoginForm.tsx`.
Tests in `apps/api/test/auth-email-code.http.spec.ts`, same hermetic style as the takeover spec: the
code signs the owner in and takes the account back; a used, expired or wrong code is refused and
five wrong tries kill it; a stranger who pre-registered the address loses password and sessions;
an unknown address gets the same answer and no mail; each limit and the mail budget hold; a
Google-linked account gets no mail; a Google take-back kills a pending code; off by default.

## Decisions for the owner

1. **Scope:** 0, **A (recommended)** or B.
2. **Code (recommended)** or link.
3. Campaign mail drops to 70 a day to reserve 20 for sign-in — acceptable, or other numbers?
4. Run the count SQL above on prod (I cannot), and check what address the API sees for a request
   that came through the website — needed before B, useful for A.

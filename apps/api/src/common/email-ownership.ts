/**
 * Email signup (12 May – 17 June 2026) never checked that the address belonged to the person
 * registering it. A password, or an email that is still unverified, therefore proves nothing about
 * who owns the account: a stranger may have registered someone else's address first.
 *
 * Google sign-in is the only proof of email ownership we have. `AuthService.authenticateGoogle`
 * clears this state the first time the owner signs in; until then the account must not gain new
 * ways in (password login, Telegram link).
 */
export function hasUnprovenEmailAccess(user: {
  email?: string | null;
  emailVerified?: boolean | null;
  passwordHash?: string | null;
}) {
  return Boolean(user.passwordHash) || (Boolean(user.email) && !user.emailVerified);
}

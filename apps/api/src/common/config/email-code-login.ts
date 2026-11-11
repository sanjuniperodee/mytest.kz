import type { ConfigService } from '@nestjs/config';

/**
 * Sign-in with a one-time code mailed to the address (`AuthService.verifyEmailCode`) stays off until
 * `AUTH_EMAIL_CODE_ENABLED` is set, so deploying the code does not switch the feature on. The mailer
 * also reads it: while it is on, part of the daily mail budget is kept back for these codes.
 */
export function isEmailCodeLoginEnabled(config: Pick<ConfigService, 'get'>) {
  const raw = (config.get<string>('AUTH_EMAIL_CODE_ENABLED') ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

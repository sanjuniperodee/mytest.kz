import { ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';

export function getRequiredConfig(
  config: ConfigService,
  key: string,
): string {
  const value = config.get<string>(key)?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function getJwtExpiresIn(
  value: string | undefined,
  fallback: SignOptions['expiresIn'],
): SignOptions['expiresIn'] {
  return (value?.trim() || fallback) as SignOptions['expiresIn'];
}

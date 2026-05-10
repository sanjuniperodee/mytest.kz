import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Доступ к /billing/kaspi/setup/* только с заголовком
 * X-Kaspi-Session-Setup-Secret, совпадающим с KASPI_SESSION_SETUP_SECRET в .env.
 */
@Injectable()
export class KaspiSessionSetupSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('KASPI_SESSION_SETUP_SECRET')?.trim();
    if (!expected) {
      throw new ForbiddenException(
        'KASPI_SESSION_SETUP_SECRET is not set on the server',
      );
    }
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers['x-kaspi-session-setup-secret'];
    const given = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
    if (!given || given !== expected) {
      throw new ForbiddenException('Invalid X-Kaspi-Session-Setup-Secret');
    }
    return true;
  }
}

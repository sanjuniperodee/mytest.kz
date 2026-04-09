import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Включается только при BULK_IMPORT_ENABLED=true.
 * Если задан BULK_IMPORT_SECRET — требуется заголовок X-Bulk-Import-Token: <secret>
 * или Authorization: Bearer <secret>.
 */
@Injectable()
export class BulkImportGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<string>('BULK_IMPORT_ENABLED') === 'false') {
      throw new NotFoundException();
    }
    const secret = this.config.get<string>('BULK_IMPORT_SECRET');
    if (secret && secret.length > 0) {
      const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
      const h = req.headers;
      const raw =
        h['x-bulk-import-token'] ||
        (typeof h['authorization'] === 'string' && h['authorization'].startsWith('Bearer ')
          ? h['authorization'].slice(7)
          : undefined);
      if (raw !== secret) {
        throw new ForbiddenException('Invalid or missing bulk import token');
      }
    }
    return true;
  }
}

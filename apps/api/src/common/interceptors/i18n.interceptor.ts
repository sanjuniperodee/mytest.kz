import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Intercepts API responses and resolves i18n JSON fields to plain strings.
 *
 * Fields stored as { kk: "...", ru: "...", en: "..." } are resolved
 * to a single string based on the user's preferred language (from JWT)
 * or the Accept-Language header, falling back to 'ru'.
 */
@Injectable()
export class I18nInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const path = String(request.path ?? request.url ?? '');
    if (path.includes('/bulk')) {
      return next.handle();
    }
    // Catalog responses must stay { kk, ru, en } so web can pick by UI / ENT question lang
    // and admin forms can edit all locales without losing fields to a single resolved string.
    if (path.includes('/exams/')) {
      return next.handle();
    }

    // Get language from JWT payload, query param, or Accept-Language header
    const lang =
      request.query?.lang ||
      request.user?.preferredLanguage ||
      this.parseAcceptLanguage(request.headers['accept-language']) ||
      'ru';

    return next.handle().pipe(
      map((data) => this.resolveI18n(data, lang)),
    );
  }

  private parseAcceptLanguage(header?: string): string | null {
    if (!header) return null;
    const match = header.match(/^(kk|ru|en)/i);
    return match ? match[1].toLowerCase() : null;
  }

  private resolveI18n(data: any, lang: string): any {
    if (data === null || data === undefined) return data;
    if (Array.isArray(data)) return data.map((item) => this.resolveI18n(item, lang));
    if (typeof data !== 'object') return data;
    if (data instanceof Date) return data;

    // Prisma Decimal (and similar numeric wrappers) can arrive as class instances.
    // Convert them early so recursive object traversal does not turn them into {}.
    if (typeof data.toNumber === 'function') {
      const asNumber = data.toNumber();
      if (Number.isFinite(asNumber)) return asNumber;
    }
    if (Object.keys(data).length === 0 && typeof data.toString === 'function') {
      const asNumber = Number(data.toString());
      if (Number.isFinite(asNumber)) return asNumber;
    }

    // Check if this object IS an i18n object: has 'ru' key and optionally 'kk'/'en'
    if (this.isI18nObject(data)) {
      return data[lang] || data['ru'] || data['en'] || data['kk'] || '';
    }

    // Recurse into object properties
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = this.resolveI18n(value, lang);
    }
    return result;
  }

  /**
   * Detect i18n objects: must have 'ru' key (our fallback language),
   * at most 3 keys, all of which are language codes.
   */
  private isI18nObject(obj: any): boolean {
    const keys = Object.keys(obj);
    if (keys.length === 0 || keys.length > 4) return false;
    const langKeys = new Set(['kk', 'ru', 'en']);
    return keys.every((k) => langKeys.has(k)) && keys.includes('ru');
  }
}

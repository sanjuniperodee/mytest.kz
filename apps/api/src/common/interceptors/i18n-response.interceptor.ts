import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const LANGUAGES = ['kk', 'ru', 'en'];

function isLocalizedObject(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  return keys.length >= 2 && keys.every((k) => LANGUAGES.includes(k));
}

function extractLanguage(data: unknown, lang: string): unknown {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => extractLanguage(item, lang));
  }

  if (typeof data === 'object' && data !== null) {
    if (isLocalizedObject(data)) {
      return (data as Record<string, unknown>)[lang] ?? (data as Record<string, unknown>)['ru'];
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = extractLanguage(value, lang);
    }
    return result;
  }

  return data;
}

@Injectable()
export class I18nResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const lang = request.user?.preferredLanguage || request.query?.lang || 'ru';

    return next.handle().pipe(
      map((data) => extractLanguage(data, lang)),
    );
  }
}

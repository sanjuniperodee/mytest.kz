import { ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { I18nInterceptor } from '../src/common/interceptors/i18n.interceptor';

describe('API response language', () => {
  const value = { title: { ru: 'Тариф', kk: 'Тариф жоспары', en: 'Plan' } };
  async function resolve(request: Record<string, unknown>, data: unknown = value) {
    const req = { path: '/api/v1/billing/plans', headers: {}, ...request };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as ExecutionContext;
    return firstValueFrom(new I18nInterceptor().intercept(context, { handle: () => of(data) }));
  }
  it('uses the UI header ahead of an older token preference', async () => {
    expect(await resolve({ headers: { 'accept-language': 'kk-KZ' }, user: { preferredLanguage: 'ru' } }))
      .toEqual({ title: 'Тариф жоспары' });
  });
  it('keeps explicit content language and clients without a language header working', async () => {
    expect(await resolve({ query: { lang: 'ru' }, headers: { 'accept-language': 'kk' } }))
      .toEqual({ title: 'Тариф' });
    expect(await resolve({ user: { preferredLanguage: 'kk' } })).toEqual({ title: 'Тариф жоспары' });
    expect(await resolve({})).toEqual({ title: 'Тариф' });
  });
  it.each(['/api/v1/admin/settings', '/api/v1/exams/types', '/api/v1/questions/bulk'])
    ('preserves multilingual editing/catalog payloads on %s', async path => {
      expect(await resolve({ path, headers: { 'accept-language': 'kk' } })).toEqual(value);
    });
});

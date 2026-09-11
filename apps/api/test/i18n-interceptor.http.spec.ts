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
  it('localizes current tariff through the response interceptor without translating user names', async () => {
    const data = { name: 'Подписка на год', currentTariff: { name: 'Подписка на 5 пробных на 30 дней', description: 'Подписка на год' } };
    expect(await resolve({ path: '/api/v1/users/me', headers: { 'accept-language': 'kk' } }, data)).toEqual({
      name: data.name,
      currentTariff: { name: '30 күнге 5 сынаққа жазылым', description: 'Бір жылға жазылым' },
    });
  });
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

describe('billing presentation localization', () => {
  const { localizeBillingFields } = require('../src/common/billing-localization');
  const { BILLING_PLANS } = require('../src/modules/billing/billing.config');
  it('translates all catalog names, descriptions and features without changing prices or IDs', () => {
    for (const plan of BILLING_PLANS) {
      const translated = localizeBillingFields(plan, 'kk');
      expect(translated.name).not.toBe(plan.name);
      expect(translated.description).not.toBe(plan.description);
      expect(translated.features.every((f: string, i: number) => f !== plan.features[i])).toBe(true);
      expect(translated.priceKzt).toBe(plan.priceKzt);
      expect(translated.id).toBe(plan.id);
      expect(localizeBillingFields(plan, 'ru')).toEqual(plan);
    }
  });
  it('supports legacy subscription titles and preserves custom text and machine fields', () => {
    const value = { name: 'Подписка на 5 пробных на 30 дней', description: 'Подписка на год', code: 'Подписка на год', customer: 'Подписка на год' };
    expect(localizeBillingFields(value, 'kk')).toEqual({ ...value, name: '30 күнге 5 сынаққа жазылым', description: 'Бір жылға жазылым' });
    expect(localizeBillingFields({ name: 'Custom school plan' }, 'kk').name).toBe('Custom school plan');
  });
});

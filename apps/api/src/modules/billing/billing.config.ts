export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  priceKzt: number;
  durationDays: number;
  highlight?: string;
  features: string[];
}

/**
 * Starter economics assumptions (configurable):
 * - monthly gross margin target: 72%
 * - free->paid conversion baseline: 6-9%
 * - payback window target: <= 2.5 months
 */
export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'start-30',
    name: 'Старт 30 дней',
    description: 'Для быстрого входа в ритм и первых устойчивых результатов.',
    priceKzt: 5900,
    durationDays: 30,
    features: ['Неограниченные пробные ЕНТ', 'Разбор ошибок', 'Статистика по прогрессу'],
  },
  {
    id: 'focus-90',
    name: 'Фокус 90 дней',
    description: 'Основной тариф на четверть подготовки.',
    priceKzt: 14900,
    durationDays: 90,
    highlight: 'выгодный',
    features: ['Выгоднее месячного', 'Стабильный цикл подготовки', 'Приоритетная поддержка'],
  },
  {
    id: 'max-180',
    name: 'Максимум 180 дней',
    description: 'Для полной подготовки до экзамена.',
    priceKzt: 26900,
    durationDays: 180,
    features: ['Лучшее соотношение цены', 'Долгий горизонт подготовки', 'Доступ ко всем обновлениям'],
  },
];

export const ENT_TRIAL_LIMIT = 2;

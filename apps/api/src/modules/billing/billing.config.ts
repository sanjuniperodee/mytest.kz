export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  priceKzt: number;
  originalPriceKzt?: number;
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
    id: 'trial',
    name: '1 пробный ЕНТ',
    description: 'Одна полная попытка ЕНТ с Premium-разбором. Доступ действует 7 дней.',
    priceKzt: 570,
    durationDays: 7,
    originalPriceKzt: 1140,
    features: ['1 полный пробный ЕНТ', 'Premium-разбор вопросов', 'Доступ 7 дней'],
  },
  {
    id: 'week',
    name: '3 пробных ЕНТ',
    description: 'Три полные попытки ЕНТ с Premium-разбором. Доступ действует 30 дней.',
    priceKzt: 1490,
    originalPriceKzt: 2980,
    durationDays: 30,
    features: ['3 полных пробных ЕНТ', 'Premium-разбор вопросов', 'Статистика по попыткам'],
  },
  {
    id: 'month',
    name: 'Месяц без лимита',
    description: 'Безлимитные попытки ЕНТ в течение 30 дней.',
    priceKzt: 3900,
    originalPriceKzt: 7800,
    durationDays: 30,
    highlight: 'популярно',
    features: ['Безлимитные попытки ЕНТ', 'Доступ на 30 дней', 'Аналитика'],
  },
  {
    id: 'annual',
    name: '5 пробных ЕНТ',
    description: 'Пять полных попыток ЕНТ с Premium-разбором. Доступ действует 30 дней.',
    priceKzt: 1990,
    originalPriceKzt: 3980,
    durationDays: 30,
    features: ['5 полных пробных ЕНТ', 'Premium-разбор вопросов', 'Статистика по попыткам'],
  },
];

export const ENT_TRIAL_LIMIT = 2;

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
    name: 'Разовый доступ',
    description: 'Один полный пробный ЕНТ с Premium-разбором после сдачи.',
    priceKzt: 750,
    durationDays: 1,
    features: ['1 полный пробный ЕНТ', 'Premium-разбор вопросов', 'Статистика результата'],
  },
  {
    id: 'week',
    name: '5 пробных ЕНТ',
    description: 'Пять полных пробных ЕНТ с Premium-разбором. Доступ действует 7 дней.',
    priceKzt: 2400,
    originalPriceKzt: 4800,
    durationDays: 7,
    features: ['5 полных пробных ЕНТ', 'Premium-разбор вопросов', 'Статистика по попыткам'],
  },
  {
    id: 'month',
    name: 'Месяц',
    description: 'Стандартный цикл подготовки.',
    priceKzt: 3900,
    originalPriceKzt: 7800,
    durationDays: 30,
    highlight: 'популярно',
    features: ['Полный трекинг', 'Доступ на месяц', 'Аналитика'],
  },
  {
    id: 'annual',
    name: 'Годовой',
    description: 'Для полной подготовки до экзамена.',
    priceKzt: 28000,
    originalPriceKzt: 56000,
    durationDays: 365,
    highlight: 'выгодно',
    features: ['Лучшее соотношение цены', 'Долгий горизонт подготовки', 'Доступ ко всем обновлениям'],
  },
];

export const ENT_TRIAL_LIMIT = 2;

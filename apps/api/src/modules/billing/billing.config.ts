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
    name: 'Пробный',
    description: 'Одноразовое прохождение теста (действует только на 1 тест).',
    priceKzt: 750,
    durationDays: 1,
    features: ['Доступ к 1 тесту', 'Разбор ошибок', 'Статистика'],
  },
  {
    id: 'week',
    name: 'Неделя',
    description: 'Короткий интенсив для проверки своих сил.',
    priceKzt: 2400,
    originalPriceKzt: 4800,
    durationDays: 7,
    features: ['Все функции системы', 'Снятие ограничений'],
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

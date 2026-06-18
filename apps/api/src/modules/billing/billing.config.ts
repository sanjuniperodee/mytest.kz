export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  priceKzt: number;
  originalPriceKzt?: number;
  durationDays: number;
  highlight?: string;
  features: string[];
  /** null = unlimited */
  attemptsLimit: number | null;
  /** null = no daily cap */
  dailyLimit: number | null;
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'starter',
    name: 'Стартер',
    description: 'Одна полная попытка ЕНТ с Premium-разбором. Доступ действует 7 дней.',
    priceKzt: 570,
    originalPriceKzt: 1140,
    durationDays: 7,
    attemptsLimit: 1,
    dailyLimit: 1,
    features: ['1 полный пробный ЕНТ', 'Premium-разбор вопросов', 'Доступ 7 дней'],
  },
  {
    id: 'basic',
    name: 'Базовый',
    description: 'Три полные попытки ЕНТ с Premium-разбором. Доступ действует 30 дней.',
    priceKzt: 1490,
    originalPriceKzt: 2980,
    durationDays: 30,
    attemptsLimit: 3,
    dailyLimit: null,
    features: ['3 полных пробных ЕНТ', 'Premium-разбор вопросов', 'Статистика по попыткам'],
  },
  {
    id: 'pro',
    name: 'Про',
    description: 'Пять полных попыток ЕНТ с Premium-разбором. Доступ действует 30 дней.',
    priceKzt: 1990,
    originalPriceKzt: 3980,
    durationDays: 30,
    attemptsLimit: 5,
    dailyLimit: null,
    features: ['5 полных пробных ЕНТ', 'Premium-разбор вопросов', 'Статистика по попыткам'],
  },
  {
    id: 'premium',
    name: 'Премиум',
    description: 'Безлимитные попытки ЕНТ в течение 30 дней.',
    priceKzt: 3900,
    originalPriceKzt: 7800,
    durationDays: 30,
    highlight: 'популярно',
    attemptsLimit: null,
    dailyLimit: null,
    features: ['Безлимитные попытки ЕНТ', 'Доступ на 30 дней', 'Аналитика'],
  },
];

export const PLAN_BY_ID = new Map(BILLING_PLANS.map((p) => [p.id, p]));

export const ENT_TRIAL_LIMIT = 2;

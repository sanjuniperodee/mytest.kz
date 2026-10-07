/**
 * Единый контракт монетизации: бесплатный доступ, платные функции, каталог тарифов
 * и реклама. Хранится одной записью в БД (site_settings.key = "monetization") и
 * редактируется на странице «Тарифы и доступ» в админке. API, админка и веб берут
 * типы, дефолты и правила валидации отсюда, поэтому они не расходятся.
 *
 * Код тарифа (`code`) — стабильный идентификатор: он пишется в PaymentOrder.planCode
 * и Subscription.planType. Поэтому код нельзя переименовать, а проданный тариф —
 * удалить (только снять с продажи через `isActive: false`).
 */

import type { BillingPlanDto } from './types/index';

/** Текст тарифа на двух языках. Пустой `kk` — показываем `ru`. */
export interface LocalizedText {
  ru: string;
  kk: string;
}

/** Функции, которые можно закрыть подпиской. `true` в конфиге = нужна подписка. */
export const PREMIUM_FEATURE_KEYS = [
  'aiCoach',
  'explanations',
  'mistakesPractice',
  'retake',
] as const;
export type PremiumFeatureKey = (typeof PREMIUM_FEATURE_KEYS)[number];

export const PREMIUM_FEATURE_LABELS: Record<
  PremiumFeatureKey,
  { title: string; description: string }
> = {
  aiCoach: {
    title: 'AI-разбор ошибок',
    description: 'AI-анализ слабых тем, объяснение «почему я ошибся», AI-уроки и карта тем.',
  },
  explanations: {
    title: 'Объяснения к вопросам',
    description: 'Готовые пояснения к каждому вопросу на странице разбора теста.',
  },
  mistakesPractice: {
    title: 'Работа над ошибками',
    description: 'Тренировка по вопросам, в которых ученик ошибался.',
  },
  retake: {
    title: 'Пересдача теста',
    description: 'Повторное прохождение того же пробного ЕНТ.',
  },
};

/** Места на сайте, где может показываться реклама. */
export const AD_PLACEMENT_KEYS = ['results', 'dashboard', 'content'] as const;
export type AdPlacementKey = (typeof AD_PLACEMENT_KEYS)[number];

export const AD_PLACEMENT_LABELS: Record<AdPlacementKey, { title: string; description: string }> = {
  results: {
    title: 'Результаты теста',
    description: 'Под итоговым баллом на странице разбора — самое посещаемое место после теста.',
  },
  dashboard: {
    title: 'Главная кабинета',
    description: 'Внизу главной страницы личного кабинета.',
  },
  content: {
    title: 'Контентные страницы',
    description: 'SEO-страницы про ЕНТ и проходные баллы — туда приходит органический трафик.',
  },
};

export interface MonetizationPlan {
  /** Стабильный код: planCode в заказах и planType в подписках. Латиница, 2–20 символов. */
  code: string;
  name: LocalizedText;
  description: LocalizedText;
  priceKzt: number;
  /** Зачёркнутая «старая» цена; null — не показывать. */
  originalPriceKzt: number | null;
  durationDays: number;
  /** Сколько пробных ЕНТ даёт тариф за срок действия; null — безлимит. */
  attemptsLimit: number | null;
  /** Сколько платных попыток можно в день; null — без дневного лимита. */
  dailyLimit: number | null;
  features: LocalizedText[];
  /** Бейдж на карточке («популярно»); null — без бейджа. */
  badge: LocalizedText | null;
  /** Продаётся и виден на странице тарифов. Снятый с продажи тариф продолжает работать у купивших. */
  isActive: boolean;
}

export interface MonetizationFreeTier {
  enabled: boolean;
  /** Бесплатных полных пробных ЕНТ в день на пользователя (сброс в полночь по его часовому поясу). */
  dailyEntAttempts: number;
}

export interface MonetizationAds {
  enabled: boolean;
  /** Google AdSense publisher id: ca-pub-XXXXXXXXXXXXXXXX. */
  adsenseClientId: string;
  /** Не показывать рекламу пользователям с активной подпиской. */
  hideForPremium: boolean;
  /** data-ad-slot для каждого места; пустая строка — место выключено. */
  slots: Record<AdPlacementKey, string>;
}

export interface MonetizationConfig {
  freeTier: MonetizationFreeTier;
  premiumFeatures: Record<PremiumFeatureKey, boolean>;
  plans: MonetizationPlan[];
  ads: MonetizationAds;
  /** Когда сохранено в последний раз; null — используются дефолты. Нужен для защиты от гонки правок. */
  updatedAt: string | null;
}

/** То, что видят клиенты: тарифы в продаже уже на языке запроса. */
export interface PublicMonetizationConfig {
  freeTier: MonetizationFreeTier;
  premiumFeatures: Record<PremiumFeatureKey, boolean>;
  plans: BillingPlanDto[];
  ads: MonetizationAds;
}

/** Условия тарифа, зафиксированные в заказе/подписке в момент покупки. */
export interface PlanSnapshot {
  code: string;
  name: string;
  priceKzt: number;
  durationDays: number;
  attemptsLimit: number | null;
  dailyLimit: number | null;
}

export const FREE_DAILY_ATTEMPTS_MAX = 20;
export const PLAN_CODE_RE = /^[a-z][a-z0-9_-]{1,19}$/;
export const RESERVED_PLAN_CODES: ReadonlySet<string> = new Set(['free', 'admin', 'trial', 'paid']);
export const ADSENSE_CLIENT_RE = /^ca-pub-\d{10,20}$/;
export const ADSENSE_SLOT_RE = /^\d{6,20}$/;

const t = (ru: string, kk: string): LocalizedText => ({ ru, kk });

export const DEFAULT_MONETIZATION_PLANS: MonetizationPlan[] = [
  {
    code: 'starter',
    name: t('Разовый', 'Бір реттік'),
    description: t(
      'Одна дополнительная попытка ЕНТ и AI-разбор ошибок. Доступ действует 7 дней.',
      'Бір қосымша ҰБТ сынағы және қателерді AI-талдау. Қолжетімділік 7 күнге беріледі.',
    ),
    priceKzt: 490,
    originalPriceKzt: null,
    durationDays: 7,
    attemptsLimit: 1,
    dailyLimit: 1,
    features: [
      t('+1 полный пробный ЕНТ', '+1 толық ҰБТ сынағы'),
      t('AI-разбор ошибок', 'Қателерді AI-талдау'),
      t('Без рекламы', 'Жарнамасыз'),
      t('Доступ 7 дней', '7 күн қолжетімділік'),
    ],
    badge: null,
    isActive: true,
  },
  {
    code: 'basic',
    name: t('3 пробных', '3 сынақ'),
    description: t(
      'Три дополнительные попытки ЕНТ и AI-разбор ошибок. Доступ действует 30 дней.',
      'Үш қосымша ҰБТ сынағы және қателерді AI-талдау. Қолжетімділік 30 күнге беріледі.',
    ),
    priceKzt: 900,
    originalPriceKzt: 1470,
    durationDays: 30,
    attemptsLimit: 3,
    dailyLimit: null,
    features: [
      t('+3 полных пробных ЕНТ', '+3 толық ҰБТ сынағы'),
      t('AI-разбор ошибок', 'Қателерді AI-талдау'),
      t('Без рекламы', 'Жарнамасыз'),
      t('Статистика по попыткам', 'Сынақтар статистикасы'),
    ],
    badge: null,
    isActive: true,
  },
  {
    code: 'pro',
    name: t('5 пробных', '5 сынақ'),
    description: t(
      'Пять дополнительных попыток ЕНТ и AI-разбор ошибок. Доступ действует 30 дней.',
      'Бес қосымша ҰБТ сынағы және қателерді AI-талдау. Қолжетімділік 30 күнге беріледі.',
    ),
    priceKzt: 1490,
    originalPriceKzt: 2450,
    durationDays: 30,
    attemptsLimit: 5,
    dailyLimit: null,
    features: [
      t('+5 полных пробных ЕНТ', '+5 толық ҰБТ сынағы'),
      t('AI-разбор ошибок', 'Қателерді AI-талдау'),
      t('Без рекламы', 'Жарнамасыз'),
      t('Статистика по попыткам', 'Сынақтар статистикасы'),
    ],
    badge: null,
    isActive: true,
  },
  {
    code: 'premium',
    name: t('Месяц без лимита', 'Ай шектеусіз'),
    description: t(
      'Безлимитные попытки ЕНТ и все Premium-функции в течение 30 дней.',
      '30 күн бойы шексіз ҰБТ сынақтары және барлық Premium мүмкіндіктері.',
    ),
    priceKzt: 2990,
    originalPriceKzt: 5890,
    durationDays: 30,
    attemptsLimit: null,
    dailyLimit: null,
    features: [
      t('Безлимитные попытки ЕНТ', 'Шексіз ҰБТ сынақтары'),
      t('AI-разбор ошибок', 'Қателерді AI-талдау'),
      t('Без рекламы', 'Жарнамасыз'),
      t('Доступ на 30 дней', '30 күн қолжетімділік'),
    ],
    badge: t('популярно', 'танымал'),
    isActive: true,
  },
];

export const DEFAULT_MONETIZATION_CONFIG: MonetizationConfig = {
  freeTier: { enabled: true, dailyEntAttempts: 1 },
  premiumFeatures: {
    aiCoach: true,
    explanations: true,
    mistakesPractice: true,
    retake: true,
  },
  plans: DEFAULT_MONETIZATION_PLANS,
  ads: {
    enabled: false,
    adsenseClientId: '',
    hideForPremium: true,
    slots: { results: '', dashboard: '', content: '' },
  },
  updatedAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown, fallback: string, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function int(value: unknown, fallback: number): number {
  const n = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : fallback;
}

/** null/'' → null, число → округлённое число, иначе fallback. */
function nullableInt(value: unknown, fallback: number | null): number | null {
  if (value === null || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Принимает `{ru, kk}` или обычную строку (= русский текст). */
function text(value: unknown, fallback: LocalizedText, max: number): LocalizedText {
  if (typeof value === 'string') return { ru: value.trim().slice(0, max), kk: '' };
  if (!isRecord(value)) return { ...fallback };
  return { ru: str(value.ru, fallback.ru, max), kk: str(value.kk, fallback.kk, max) };
}

const EMPTY_TEXT: LocalizedText = { ru: '', kk: '' };

function normalizePlan(raw: unknown): MonetizationPlan | null {
  if (!isRecord(raw)) return null;
  const code = str(raw.code ?? raw.id, '', 20).toLowerCase();
  if (!code) return null;
  const defaults = DEFAULT_MONETIZATION_PLANS.find((p) => p.code === code);
  const badgeRaw = raw.badge === undefined ? raw.highlight : raw.badge;
  const badge =
    badgeRaw === undefined ? (defaults?.badge ?? null) : badgeRaw === null ? null : text(badgeRaw, EMPTY_TEXT, 30);
  return {
    code,
    name: text(raw.name, defaults?.name ?? { ru: code, kk: '' }, 60),
    description: text(raw.description, defaults?.description ?? EMPTY_TEXT, 300),
    priceKzt: int(raw.priceKzt, defaults?.priceKzt ?? 0),
    originalPriceKzt: nullableInt(raw.originalPriceKzt, null),
    durationDays: int(raw.durationDays, defaults?.durationDays ?? 30),
    // Отсутствующее поле не должно молча превращаться в «безлимит».
    attemptsLimit: nullableInt(raw.attemptsLimit, defaults ? defaults.attemptsLimit : 1),
    dailyLimit: nullableInt(raw.dailyLimit, defaults ? defaults.dailyLimit : null),
    features: Array.isArray(raw.features)
      ? raw.features
          .map((f) => text(f, EMPTY_TEXT, 120))
          .filter((f) => f.ru)
          .slice(0, 10)
      : (defaults?.features ?? []).map((f) => ({ ...f })),
    badge: badge && badge.ru ? badge : null,
    isActive: bool(raw.isActive, true),
  };
}

function clonePlans(plans: MonetizationPlan[]): MonetizationPlan[] {
  return plans.map((p) => ({
    ...p,
    name: { ...p.name },
    description: { ...p.description },
    features: p.features.map((f) => ({ ...f })),
    badge: p.badge ? { ...p.badge } : null,
  }));
}

/**
 * Приводит произвольный JSON (из БД или запроса) к полному конфигу. Ничего не
 * выбрасывает: недостающие поля берутся из дефолтов. Строгая проверка — в
 * `validateMonetizationConfig`.
 */
export function normalizeMonetizationConfig(raw: unknown): MonetizationConfig {
  const d = DEFAULT_MONETIZATION_CONFIG;
  if (!isRecord(raw)) {
    return {
      ...d,
      freeTier: { ...d.freeTier },
      premiumFeatures: { ...d.premiumFeatures },
      plans: clonePlans(d.plans),
      ads: { ...d.ads, slots: { ...d.ads.slots } },
    };
  }

  const free = isRecord(raw.freeTier) ? raw.freeTier : {};
  const features = isRecord(raw.premiumFeatures) ? raw.premiumFeatures : {};
  const ads = isRecord(raw.ads) ? raw.ads : {};
  const slots = isRecord(ads.slots) ? ads.slots : {};

  const plans: MonetizationPlan[] = [];
  if (Array.isArray(raw.plans)) {
    const seen = new Set<string>();
    for (const item of raw.plans) {
      const plan = normalizePlan(item);
      if (plan && !seen.has(plan.code)) {
        seen.add(plan.code);
        plans.push(plan);
      }
    }
  }

  return {
    freeTier: {
      enabled: bool(free.enabled, d.freeTier.enabled),
      dailyEntAttempts: int(free.dailyEntAttempts, d.freeTier.dailyEntAttempts),
    },
    premiumFeatures: Object.fromEntries(
      PREMIUM_FEATURE_KEYS.map((key) => [key, bool(features[key], d.premiumFeatures[key])]),
    ) as Record<PremiumFeatureKey, boolean>,
    plans: Array.isArray(raw.plans) ? plans : clonePlans(d.plans),
    ads: {
      enabled: bool(ads.enabled, d.ads.enabled),
      adsenseClientId: str(ads.adsenseClientId, d.ads.adsenseClientId, 40),
      hideForPremium: bool(ads.hideForPremium, d.ads.hideForPremium),
      slots: Object.fromEntries(
        AD_PLACEMENT_KEYS.map((key) => [key, str(slots[key], '', 20)]),
      ) as Record<AdPlacementKey, string>,
    },
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
}

export interface MonetizationValidationError {
  /** Путь к полю: "plans.2.priceKzt", "ads.adsenseClientId". */
  path: string;
  message: string;
}

/** Проверка одного тарифа; `prefix` — путь к нему в конфиге («plans.2.»). */
export function validateMonetizationPlan(
  plan: MonetizationPlan,
  prefix = '',
): MonetizationValidationError[] {
  const errors: MonetizationValidationError[] = [];
  const add = (field: string, message: string) => errors.push({ path: `${prefix}${field}`, message });
  if (!PLAN_CODE_RE.test(plan.code)) {
    add('code', 'Код: латиница/цифры/_/-, начинается с буквы, 2–20 символов');
  } else if (RESERVED_PLAN_CODES.has(plan.code)) {
    add('code', `Код «${plan.code}» зарезервирован`);
  }
  if (!plan.name.ru) add('name', 'Укажите название');
  if (!Number.isInteger(plan.priceKzt) || plan.priceKzt < 1 || plan.priceKzt > 1_000_000) {
    add('priceKzt', 'Цена: целое число от 1 до 1 000 000 ₸');
  }
  if (plan.originalPriceKzt != null && plan.originalPriceKzt <= plan.priceKzt) {
    add('originalPriceKzt', 'Старая цена должна быть больше текущей');
  }
  if (!Number.isInteger(plan.durationDays) || plan.durationDays < 1 || plan.durationDays > 3650) {
    add('durationDays', 'Срок: от 1 до 3650 дней');
  }
  if (plan.attemptsLimit != null && (plan.attemptsLimit < 1 || plan.attemptsLimit > 100_000)) {
    add('attemptsLimit', 'Попыток: от 1 или безлимит');
  }
  if (plan.dailyLimit != null && (plan.dailyLimit < 1 || plan.dailyLimit > 1000)) {
    add('dailyLimit', 'Дневной лимит: от 1 или без лимита');
  }
  return errors;
}

/** Строгая проверка перед сохранением. Пустой массив — конфиг корректен. */
export function validateMonetizationConfig(
  config: MonetizationConfig,
): MonetizationValidationError[] {
  const errors: MonetizationValidationError[] = [];
  const add = (path: string, message: string) => errors.push({ path, message });

  const daily = config.freeTier.dailyEntAttempts;
  if (!Number.isInteger(daily) || daily < 0 || daily > FREE_DAILY_ATTEMPTS_MAX) {
    add('freeTier.dailyEntAttempts', `От 0 до ${FREE_DAILY_ATTEMPTS_MAX} попыток в день`);
  }

  if (config.plans.length > 12) add('plans', 'Не больше 12 тарифов');
  const codes = new Set<string>();
  config.plans.forEach((plan, i) => {
    errors.push(...validateMonetizationPlan(plan, `plans.${i}.`));
    if (codes.has(plan.code)) add(`plans.${i}.code`, `Код «${plan.code}» уже используется`);
    codes.add(plan.code);
  });
  if (!config.plans.some((plan) => plan.isActive)) {
    add('plans', 'Хотя бы один тариф должен быть в продаже');
  }

  const { ads } = config;
  if (ads.adsenseClientId && !ADSENSE_CLIENT_RE.test(ads.adsenseClientId)) {
    add('ads.adsenseClientId', 'Формат: ca-pub-XXXXXXXXXXXXXXXX');
  }
  if (ads.enabled && !ads.adsenseClientId) {
    add('ads.adsenseClientId', 'Чтобы включить рекламу, укажите AdSense publisher id');
  }
  for (const key of AD_PLACEMENT_KEYS) {
    const slot = ads.slots[key];
    if (slot && !ADSENSE_SLOT_RE.test(slot)) {
      add(`ads.slots.${key}`, 'ID блока AdSense — только цифры (data-ad-slot)');
    }
  }
  return errors;
}

export function isFreeTierActive(config: Pick<MonetizationConfig, 'freeTier'>): boolean {
  return config.freeTier.enabled && config.freeTier.dailyEntAttempts > 0;
}

/** Бесплатных ЕНТ в день с учётом выключателя (0 — бесплатного доступа нет). */
export function freeDailyEntAttempts(config: Pick<MonetizationConfig, 'freeTier'>): number {
  return isFreeTierActive(config) ? config.freeTier.dailyEntAttempts : 0;
}

export function pickText(value: LocalizedText | null | undefined, lang: string): string {
  if (!value) return '';
  return (lang === 'kk' && value.kk) || value.ru || value.kk || '';
}

export function toBillingPlanDto(plan: MonetizationPlan, lang = 'ru'): BillingPlanDto {
  const badge = pickText(plan.badge, lang);
  return {
    id: plan.code,
    name: pickText(plan.name, lang),
    description: pickText(plan.description, lang),
    priceKzt: plan.priceKzt,
    ...(plan.originalPriceKzt != null ? { originalPriceKzt: plan.originalPriceKzt } : {}),
    durationDays: plan.durationDays,
    ...(badge ? { highlight: badge } : {}),
    features: plan.features.map((f) => pickText(f, lang)).filter(Boolean),
    attemptsLimit: plan.attemptsLimit,
    dailyLimit: plan.dailyLimit,
  };
}

export function toPublicMonetizationConfig(
  config: MonetizationConfig,
  lang = 'ru',
): PublicMonetizationConfig {
  const daily = freeDailyEntAttempts(config);
  return {
    freeTier: { enabled: daily > 0, dailyEntAttempts: daily },
    premiumFeatures: { ...config.premiumFeatures },
    plans: config.plans.filter((plan) => plan.isActive).map((plan) => toBillingPlanDto(plan, lang)),
    ads: {
      ...config.ads,
      enabled: config.ads.enabled && Boolean(config.ads.adsenseClientId),
      slots: { ...config.ads.slots },
    },
  };
}

export function toPlanSnapshot(plan: MonetizationPlan): PlanSnapshot {
  return {
    code: plan.code,
    name: plan.name.ru,
    priceKzt: plan.priceKzt,
    durationDays: plan.durationDays,
    attemptsLimit: plan.attemptsLimit,
    dailyLimit: plan.dailyLimit,
  };
}

/** Читает снапшот из JSON-колонки; null — у старых записей снапшота нет. */
export function parsePlanSnapshot(raw: unknown): PlanSnapshot | null {
  if (!isRecord(raw) || typeof raw.code !== 'string') return null;
  const durationDays = int(raw.durationDays, NaN);
  const priceKzt = int(raw.priceKzt, NaN);
  if (!Number.isFinite(durationDays) || !Number.isFinite(priceKzt)) return null;
  if (!('attemptsLimit' in raw) || !('dailyLimit' in raw)) return null;
  return {
    code: raw.code,
    name: typeof raw.name === 'string' ? raw.name : raw.code,
    priceKzt,
    durationDays,
    attemptsLimit: nullableInt(raw.attemptsLimit, null),
    dailyLimit: nullableInt(raw.dailyLimit, null),
  };
}

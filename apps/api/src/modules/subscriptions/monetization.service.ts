import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  freeDailyEntAttempts,
  normalizeMonetizationConfig,
  parsePlanSnapshot,
  toPlanSnapshot,
  validateMonetizationConfig,
  type MonetizationConfig,
  type MonetizationPlan,
  type PlanSnapshot,
  type PremiumFeatureKey,
} from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';

const SETTING_KEY = 'monetization';
/** Сколько процесс держит конфиг в памяти. Другие инстансы API увидят правку не позже. */
const CACHE_TTL_MS = 15_000;

/** Лимиты попыток, по которым считается доступ подписки. */
export interface PlanTerms {
  attemptsLimit: number | null;
  dailyLimit: number | null;
  durationDays: number;
  name: string;
}

/**
 * Единая точка правды о монетизации: бесплатные попытки, платные функции, каталог
 * тарифов и реклама. Всё хранится одной записью site_settings и правится в админке
 * («Тарифы и доступ»); пока админ ничего не сохранил — действуют дефолты из
 * `@bilimland/shared`.
 */
@Injectable()
export class MonetizationService implements OnModuleInit {
  private readonly logger = new Logger(MonetizationService.name);
  private cached: MonetizationConfig = normalizeMonetizationConfig(null);
  private cachedAt = 0;
  private loading: Promise<MonetizationConfig> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.getConfig().catch((err) => {
      this.logger.warn(`Monetization config not loaded at startup: ${String(err)}`);
    });
  }

  /** Актуальный конфиг (кэш процесса до 15 с). При ошибке БД — последний известный. */
  async getConfig(): Promise<MonetizationConfig> {
    if (Date.now() - this.cachedAt < CACHE_TTL_MS) return this.cached;
    this.loading ??= this.load().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /**
   * Последний загруженный конфиг без похода в БД. Для синхронных расчётов внутри
   * запроса, который уже вызвал `getConfig()`.
   */
  current(): MonetizationConfig {
    return this.cached;
  }

  async getPlan(
    code: string,
    opts: { includeInactive?: boolean } = {},
  ): Promise<MonetizationPlan | null> {
    const config = await this.getConfig();
    const plan = config.plans.find((p) => p.code === code) ?? null;
    if (!plan || (!plan.isActive && !opts.includeInactive)) return null;
    return plan;
  }

  async getActivePlans(): Promise<MonetizationPlan[]> {
    return (await this.getConfig()).plans.filter((p) => p.isActive);
  }

  /** Сколько бесплатных ЕНТ в день сейчас положено (0 — бесплатный доступ выключен). */
  freeDailyEntAttempts(): number {
    return freeDailyEntAttempts(this.cached);
  }

  /** true — функция открыта только по подписке. */
  isPremiumFeature(feature: PremiumFeatureKey): boolean {
    return this.cached.premiumFeatures[feature] !== false;
  }

  snapshotFor(plan: MonetizationPlan): PlanSnapshot {
    return toPlanSnapshot(plan);
  }

  /**
   * Условия подписки: снапшот, сохранённый при покупке, а для старых записей —
   * текущий тариф из каталога по коду. null — код неизвестен (например `free`).
   */
  planTerms(sub: { planType: string; planSnapshot?: unknown }): PlanTerms | null {
    const snapshot = parsePlanSnapshot(sub.planSnapshot);
    if (snapshot) {
      return {
        attemptsLimit: snapshot.attemptsLimit,
        dailyLimit: snapshot.dailyLimit,
        durationDays: snapshot.durationDays,
        name: snapshot.name,
      };
    }
    const plan = this.cached.plans.find((p) => p.code === sub.planType);
    if (!plan) return null;
    return {
      attemptsLimit: plan.attemptsLimit,
      dailyLimit: plan.dailyLimit,
      durationDays: plan.durationDays,
      name: plan.name.ru,
    };
  }

  /** Сохраняет конфиг из админки целиком. Возвращает нормализованную версию. */
  async update(adminId: string, raw: unknown): Promise<MonetizationConfig> {
    const next = normalizeMonetizationConfig(raw);
    const errors = validateMonetizationConfig(next);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'MONETIZATION_INVALID',
        code: 'MONETIZATION_INVALID',
        errors,
      });
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const row = await tx.siteSetting.findUnique({ where: { key: SETTING_KEY } });
      const before = normalizeMonetizationConfig(row?.value ?? null);

      // Оптимистическая блокировка: правка поверх чужого сохранения теряла бы изменения.
      const clientVersion =
        raw && typeof raw === 'object' && 'updatedAt' in raw
          ? ((raw as { updatedAt?: unknown }).updatedAt ?? null)
          : undefined;
      if (clientVersion !== undefined && clientVersion !== before.updatedAt) {
        throw new ConflictException({
          message: 'MONETIZATION_STALE',
          code: 'MONETIZATION_STALE',
        });
      }

      await this.assertRemovedPlansUnused(tx, before, next);

      const value: MonetizationConfig = { ...next, updatedAt: new Date().toISOString() };
      const json = value as unknown as Prisma.InputJsonObject;
      await tx.siteSetting.upsert({
        where: { key: SETTING_KEY },
        update: { value: json },
        create: { key: SETTING_KEY, value: json },
      });
      await tx.adminAudit.create({
        data: {
          actorUserId: adminId,
          targetType: 'monetization',
          targetId: SETTING_KEY,
          action: 'update_monetization',
          before: before as unknown as Prisma.InputJsonObject,
          after: json,
        },
      });
      return value;
    });

    this.cached = saved;
    this.cachedAt = Date.now();
    return saved;
  }

  private async assertRemovedPlansUnused(
    tx: Prisma.TransactionClient,
    before: MonetizationConfig,
    next: MonetizationConfig,
  ) {
    const nextCodes = new Set(next.plans.map((p) => p.code));
    const removed = before.plans.map((p) => p.code).filter((code) => !nextCodes.has(code));
    for (const code of removed) {
      const [orders, subscriptions] = await Promise.all([
        tx.paymentOrder.count({ where: { planCode: code } }),
        tx.subscription.count({ where: { planType: code } }),
      ]);
      if (orders + subscriptions > 0) {
        throw new BadRequestException({
          message: 'MONETIZATION_INVALID',
          code: 'MONETIZATION_INVALID',
          errors: [
            {
              path: 'plans',
              message: `Тариф «${code}» уже покупали — снимите его с продажи вместо удаления`,
            },
          ],
        });
      }
    }
  }

  private async load(): Promise<MonetizationConfig> {
    try {
      const row = await this.prisma.siteSetting.findUnique({
        where: { key: SETTING_KEY },
        select: { value: true },
      });
      this.cached = normalizeMonetizationConfig(row?.value ?? null);
      this.cachedAt = Date.now();
    } catch (err) {
      // Не роняем покупки и старт тестов из-за сбоя чтения настроек: работаем на последнем известном.
      this.logger.error(`Failed to load monetization config: ${String(err)}`);
      this.cachedAt = Date.now() - CACHE_TTL_MS + 2_000;
    }
    return this.cached;
  }
}

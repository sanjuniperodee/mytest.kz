import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';

const DEFAULT_INTERVAL_MS = 3 * 60 * 1000; // каждые 3 минуты
const DEFAULT_LOOKBACK_HOURS = 72;
const STARTUP_DELAY_MS = 15 * 1000;

/**
 * Фоновый добор Kaspi-платежей, подтверждённых уже ПОСЛЕ того как мы локально
 * пометили заказ failed по истечении окна оплаты. Реконсилит такие заказы с Kaspi
 * и, если платёж реально прошёл, проводит оплату + выдаёт доступ.
 *
 * Без новых зависимостей — таймерный планировщик в стиле DbSnapshotService.
 * Управление: KASPI_RECONCILE_ENABLED (по умолчанию вкл. в production),
 * KASPI_RECONCILE_INTERVAL_MS, KASPI_RECONCILE_LOOKBACK_HOURS.
 */
@Injectable()
export class KaspiReconcileService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KaspiReconcileService.name);
  private timer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private running = false;
  private enabled = false;
  private intervalMs = DEFAULT_INTERVAL_MS;
  private lookbackHours = DEFAULT_LOOKBACK_HOURS;

  constructor(
    private readonly config: ConfigService,
    private readonly billing: BillingService,
  ) {}

  onModuleInit() {
    const raw = this.config.get<string>('KASPI_RECONCILE_ENABLED');
    const nodeEnv = String(this.config.get('NODE_ENV') ?? '').toLowerCase();
    this.enabled =
      raw === undefined || raw === null || raw === ''
        ? nodeEnv === 'production'
        : this.parseBool(raw);

    if (!this.enabled) {
      this.logger.log('Kaspi reconcile scheduler disabled');
      return;
    }

    this.intervalMs = this.readInt(
      'KASPI_RECONCILE_INTERVAL_MS',
      DEFAULT_INTERVAL_MS,
      30_000,
      60 * 60_000,
    );
    this.lookbackHours = this.readInt(
      'KASPI_RECONCILE_LOOKBACK_HOURS',
      DEFAULT_LOOKBACK_HOURS,
      1,
      720,
    );

    this.timer = setInterval(() => void this.runOnce('interval'), this.intervalMs);
    this.timer.unref?.();

    // Первый прогон вскоре после старта (даём приложению инициализироваться).
    this.startupTimer = setTimeout(() => void this.runOnce('startup'), STARTUP_DELAY_MS);
    this.startupTimer.unref?.();

    this.logger.log(
      `Kaspi reconcile scheduler started (every ${Math.round(this.intervalMs / 1000)}s, lookback ${this.lookbackHours}h)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
  }

  private async runOnce(reason: string) {
    if (this.running) return;
    this.running = true;
    try {
      const res = await this.billing.recoverStaleKaspiPayments({
        lookbackHours: this.lookbackHours,
      });
      if (res.recovered > 0) {
        this.logger.warn(
          `Kaspi reconcile (${reason}): recovered ${res.recovered}/${res.checked} late-confirmed payment(s): ${res.recoveredOrderIds.join(', ')}`,
        );
      } else if (res.checked > 0) {
        this.logger.log(
          `Kaspi reconcile (${reason}): checked ${res.checked}, none newly paid`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Kaspi reconcile (${reason}) failed: ${message}`);
    } finally {
      this.running = false;
    }
  }

  private parseBool(raw: string): boolean {
    return ['1', 'true', 'yes', 'on', 'y'].includes(String(raw).trim().toLowerCase());
  }

  private readInt(key: string, fallback: number, min: number, max: number): number {
    const parsed = Number(this.config.get<string>(key));
    if (!Number.isFinite(parsed)) return fallback;
    const n = Math.floor(parsed);
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }
}

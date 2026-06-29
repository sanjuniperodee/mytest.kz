import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';

// Горячий проход: каждые ~2с, но только по «свежим» pending-заказам (юзер платит прямо
// сейчас) — чтобы пакет выдавался почти мгновенно БЕЗ участия фронта и без вебхука.
const DEFAULT_FAST_INTERVAL_MS = 2 * 1000;
const DEFAULT_FAST_WINDOW_MIN = 20;
// Холодный проход: редко, по всему хвосту (поздние подтверждения, рестарты, до 72ч).
const DEFAULT_SLOW_INTERVAL_MS = 3 * 60 * 1000;
const DEFAULT_LOOKBACK_HOURS = 72;
const STARTUP_DELAY_MS = 10 * 1000;

/**
 * Фоновый добор Kaspi-платежей в два уровня:
 *  - hot:  каждые ~5с сверяет только заказы, созданные за последние ~20 мин (юзер сейчас платит)
 *          → оплата проводится и пакет выдаётся в течение секунд, даже без вебхука/экрана;
 *  - cold: каждые ~3 мин проходит по всему хвосту (72ч) — поздние подтверждения, рестарты kaspi-pos.
 *
 * Без новых зависимостей (таймеры в стиле DbSnapshotService). Промоушн идёт через
 * finalizeKaspiPaymentPaid (только при авторитетном статусе Kaspi), поэтому реальные
 * отмены не «воскресают». Управление: KASPI_RECONCILE_ENABLED (по умолч. вкл. в production),
 * KASPI_RECONCILE_FAST_INTERVAL_MS, KASPI_RECONCILE_FAST_WINDOW_MIN,
 * KASPI_RECONCILE_INTERVAL_MS, KASPI_RECONCILE_LOOKBACK_HOURS.
 */
@Injectable()
export class KaspiReconcileService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KaspiReconcileService.name);
  private fastTimer: NodeJS.Timeout | null = null;
  private slowTimer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private runningFast = false;
  private runningSlow = false;
  private enabled = false;
  private fastIntervalMs = DEFAULT_FAST_INTERVAL_MS;
  private fastWindowMs = DEFAULT_FAST_WINDOW_MIN * 60 * 1000;
  private slowIntervalMs = DEFAULT_SLOW_INTERVAL_MS;
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

    this.fastIntervalMs = this.readInt(
      'KASPI_RECONCILE_FAST_INTERVAL_MS',
      DEFAULT_FAST_INTERVAL_MS,
      1_000,
      60_000,
    );
    this.fastWindowMs =
      this.readInt('KASPI_RECONCILE_FAST_WINDOW_MIN', DEFAULT_FAST_WINDOW_MIN, 1, 240) *
      60 *
      1000;
    this.slowIntervalMs = this.readInt(
      'KASPI_RECONCILE_INTERVAL_MS',
      DEFAULT_SLOW_INTERVAL_MS,
      30_000,
      60 * 60_000,
    );
    this.lookbackHours = this.readInt(
      'KASPI_RECONCILE_LOOKBACK_HOURS',
      DEFAULT_LOOKBACK_HOURS,
      1,
      720,
    );

    this.fastTimer = setInterval(() => void this.runFast('interval'), this.fastIntervalMs);
    this.fastTimer.unref?.();
    this.slowTimer = setInterval(() => void this.runSlow('interval'), this.slowIntervalMs);
    this.slowTimer.unref?.();

    // Первый прогон вскоре после старта.
    this.startupTimer = setTimeout(() => {
      void this.runFast('startup');
      void this.runSlow('startup');
    }, STARTUP_DELAY_MS);
    this.startupTimer.unref?.();

    this.logger.log(
      `Kaspi reconcile scheduler started (hot every ${Math.round(this.fastIntervalMs / 1000)}s / ${Math.round(
        this.fastWindowMs / 60000,
      )}min window, cold every ${Math.round(this.slowIntervalMs / 1000)}s / ${this.lookbackHours}h)`,
    );
  }

  onModuleDestroy() {
    for (const t of [this.fastTimer, this.slowTimer, this.startupTimer]) {
      if (t) clearTimeout(t as NodeJS.Timeout);
    }
    this.fastTimer = this.slowTimer = this.startupTimer = null;
  }

  /** Частый проход по свежим заказам (активное окно оплаты) — near-instant выдача. */
  private async runFast(reason: string) {
    if (this.runningFast) return;
    this.runningFast = true;
    try {
      const res = await this.billing.recoverStaleKaspiPayments({
        lookbackMs: this.fastWindowMs,
        statuses: ['pending'],
      });
      if (res.recovered > 0) {
        this.logger.warn(
          `Kaspi reconcile hot (${reason}): granted ${res.recovered} payment(s): ${res.recoveredOrderIds.join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Kaspi reconcile hot (${reason}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.runningFast = false;
    }
  }

  /** Редкий проход по всему хвосту (72ч) — поздние подтверждения, рестарты. */
  private async runSlow(reason: string) {
    if (this.runningSlow) return;
    this.runningSlow = true;
    try {
      const res = await this.billing.recoverStaleKaspiPayments({
        lookbackHours: this.lookbackHours,
      });
      if (res.recovered > 0) {
        this.logger.warn(
          `Kaspi reconcile cold (${reason}): recovered ${res.recovered}/${res.checked} late payment(s): ${res.recoveredOrderIds.join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Kaspi reconcile cold (${reason}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.runningSlow = false;
    }

    // Probe the Kaspi POS session — it's the single dependency behind webhook AND
    // reconcile. When it dies, payments silently stop confirming. Emit ONE distinct
    // line so monitoring can alert (Grafana rule matches "KASPI_SESSION_INACTIVE").
    try {
      const status = await this.billing.kaspiSetupStatus();
      if (status.configured && !status.sessionActive) {
        this.logger.error(
          'KASPI_SESSION_INACTIVE: Kaspi POS session is not authenticated — payments cannot be confirmed until re-auth via OTP.',
        );
      }
    } catch {
      // A session-probe failure must not break the reconcile loop.
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

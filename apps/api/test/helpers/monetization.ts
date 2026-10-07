import { normalizeMonetizationConfig } from '@bilimland/shared';
import { MonetizationService } from '../../src/modules/subscriptions/monetization.service';

/**
 * MonetizationService на фиксированном конфиге, без БД. `raw` — частичный конфиг
 * в формате site_settings (недостающее берётся из дефолтов).
 */
export function staticMonetization(raw: Record<string, unknown> | null = null): MonetizationService {
  const service = new MonetizationService({} as any);
  const internals = service as unknown as { cached: unknown; cachedAt: number };
  internals.cached = normalizeMonetizationConfig(raw);
  internals.cachedAt = Number.MAX_SAFE_INTEGER;
  return service;
}

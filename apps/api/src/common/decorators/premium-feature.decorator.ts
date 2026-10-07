import { SetMetadata } from '@nestjs/common';
import type { PremiumFeatureKey } from '@bilimland/shared';

export const PREMIUM_FEATURE_METADATA = 'premiumFeature';

/**
 * Какая платная функция стоит за маршрутом с PremiumGuard. Если в админке
 * («Тарифы и доступ» → Premium-функции) функция сделана бесплатной, гвард
 * пропускает всех; иначе требует активную подписку.
 */
export const PremiumFeature = (feature: PremiumFeatureKey) =>
  SetMetadata(PREMIUM_FEATURE_METADATA, feature);

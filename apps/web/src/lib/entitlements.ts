/**
 * Shared entitlement logic: trial access, daily limits, countdown formatting.
 * Used by HomePage, ProfilePage, PaywallPage, ExamPage.
 */

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '../api/hooks/useProfile';

export function formatCountdown(targetIso: string | null | undefined, nowMs: number): string | null {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = Math.max(0, target - nowMs);
  const totalSec = Math.floor(diff / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--error)';
}

export interface EntitlementResult {
  hasPremium: boolean;
  dailyBlocked: boolean;
  dailyCountdown: string | null;
  entTotalRemaining: number;
  entFreeRemaining: number;
  entPaidTrialRemaining: number;
  trialExhausted: boolean;
  trialSubtitle: string;
  trialActionLabel: string;
  startEnt: () => void;
}

/**
 * Shared entitlement hook for ENT exam.
 * Replaces duplicate logic in HomePage, ProfilePage, PaywallPage.
 */
export function useEntitlement(
  t: (key: string, opts?: Record<string, unknown>) => string,
  navigate: (path: string) => void,
): EntitlementResult {
  const { data: profile } = useProfile();
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const entAccess = profile?.accessByExam?.find((x) => x.examSlug === 'ent');
  const entTrial = profile?.trialStatus?.ent;

  const hasPremium =
    profile?.hasActiveSubscription === true ||
    (entAccess?.hasPaidTier === true && (entAccess?.hasAccess ?? false));

  const dailyBlocked = entAccess?.reasonCode === 'DAILY_LIMIT_REACHED';
  const dailyCountdown = formatCountdown(entAccess?.nextAllowedAt, nowMs);

  const entTotalRemainingFromAccess =
    entAccess?.total.remaining != null ? Math.max(0, entAccess.total.remaining) : null;
  const entTotalRemaining = Math.max(
    0,
    entTotalRemainingFromAccess ?? entTrial?.totalRemaining ?? entTrial?.remaining ?? 0,
  );
  const entFreeRemaining = Math.max(0, entTrial?.freeRemaining ?? entTrial?.remaining ?? 0);
  const entPaidTrialRemaining = Math.max(0, entTrial?.paidTrialRemaining ?? 0);

  const trialExhausted = !hasPremium && !dailyBlocked && entTotalRemaining <= 0;

  const trialSubtitle = hasPremium
    ? t('home.trialCtaPremium')
    : dailyBlocked
      ? t('home.dailyLimitReached', { countdown: dailyCountdown ?? '--:--:--' })
      : entTotalRemaining > 0
        ? entPaidTrialRemaining > 0 && entFreeRemaining > 0
          ? t('home.trialCtaMixed', {
              total: entTotalRemaining,
              free: entFreeRemaining,
              paid: entPaidTrialRemaining,
            })
          : entPaidTrialRemaining > 0
            ? t('home.trialCtaPaidTrialOnly', { count: entPaidTrialRemaining })
            : t('home.trialCtaRemaining', { count: entTotalRemaining })
        : t('home.trialCtaExhausted');

  const trialActionLabel = hasPremium
    ? t('home.trialPremiumAction')
    : dailyBlocked || trialExhausted
      ? t('home.trialOpenPlans')
      : t('home.trialStart');

  const startEnt = useCallback(() => {
    if (trialExhausted) {
      navigate('/paywall');
      return;
    }
    if (dailyBlocked) {
      navigate('/paywall?reason=daily_limit');
      return;
    }
    navigate('/app');
  }, [trialExhausted, dailyBlocked, navigate]);

  return {
    hasPremium,
    dailyBlocked,
    dailyCountdown,
    entTotalRemaining,
    entFreeRemaining,
    entPaidTrialRemaining,
    trialExhausted,
    trialSubtitle,
    trialActionLabel,
    startEnt,
  };
}
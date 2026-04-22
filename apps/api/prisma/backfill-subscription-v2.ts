import { PrismaClient, EntitlementStatus, EntitlementTier, EntitlementSourceType } from '@prisma/client';
import { ENT_TRIAL_LIMIT } from '../src/modules/billing/billing.config';

const prisma = new PrismaClient();

function entitlementStatusFromLimits(
  now: Date,
  windowEndsAt: Date | null,
  totalLimit: number | null,
  used: number,
): EntitlementStatus {
  if (windowEndsAt && windowEndsAt <= now) return EntitlementStatus.expired;
  if (totalLimit != null && used >= totalLimit) return EntitlementStatus.exhausted;
  return EntitlementStatus.active;
}

async function main() {
  const now = new Date();
  const entExam = await prisma.examType.findUnique({
    where: { slug: 'ent' },
    select: { id: true },
  });
  if (!entExam) {
    console.log('ENT exam type not found; skipping backfill');
    return;
  }

  const allExamTypes = await prisma.examType.findMany({
    where: { isActive: true },
    select: { id: true, slug: true },
  });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      timezone: true,
      entTrialUsed: true,
    },
  });

  for (const user of users) {
    const freeUsed = Math.max(0, user.entTrialUsed);
    const freeLimit = ENT_TRIAL_LIMIT;
    const freeStatus = entitlementStatusFromLimits(now, null, freeLimit, freeUsed);
    await prisma.userExamEntitlement.upsert({
      where: {
        sourceType_sourceRef: {
          sourceType: EntitlementSourceType.legacy_free_trial,
          sourceRef: `user:${user.id}:ent_free`,
        },
      },
      update: {
        examTypeId: entExam.id,
        tier: EntitlementTier.free,
        status: freeStatus,
        totalAttemptsLimit: freeLimit,
        dailyAttemptsLimit: null,
        usedAttemptsTotal: freeUsed,
        timezone: user.timezone || 'Asia/Almaty',
        windowStartsAt: now,
        windowEndsAt: null,
        exhaustedAt: freeStatus === EntitlementStatus.exhausted ? now : null,
      },
      create: {
        userId: user.id,
        examTypeId: entExam.id,
        tier: EntitlementTier.free,
        status: freeStatus,
        sourceType: EntitlementSourceType.legacy_free_trial,
        sourceRef: `user:${user.id}:ent_free`,
        totalAttemptsLimit: freeLimit,
        dailyAttemptsLimit: null,
        usedAttemptsTotal: freeUsed,
        timezone: user.timezone || 'Asia/Almaty',
        windowStartsAt: now,
        windowEndsAt: null,
        exhaustedAt: freeStatus === EntitlementStatus.exhausted ? now : null,
      },
    });
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { isActive: true },
    select: {
      id: true,
      userId: true,
      planType: true,
      examTypeId: true,
      startsAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  for (const sub of subscriptions) {
    const examScope =
      sub.examTypeId != null
        ? allExamTypes.filter((e) => e.id === sub.examTypeId)
        : sub.planType === 'trial'
          ? allExamTypes.filter((e) => e.slug === 'ent')
          : allExamTypes;
    const tier =
      sub.planType === 'trial' ? EntitlementTier.trial : EntitlementTier.paid;
    const sourceType =
      sub.planType === 'trial'
        ? EntitlementSourceType.legacy_trial_subscription
        : EntitlementSourceType.legacy_paid_subscription;
    const totalLimit = sub.planType === 'trial' ? 1 : null;

    for (const exam of examScope) {
      const usedForTrial =
        totalLimit == null
          ? 0
          : await prisma.testSession.count({
              where: {
                userId: sub.userId,
                examTypeId: exam.id,
                startedAt: { gte: sub.startsAt, lt: sub.expiresAt },
              },
            });
      const status = entitlementStatusFromLimits(
        now,
        sub.expiresAt,
        totalLimit,
        usedForTrial,
      );
      await prisma.userExamEntitlement.upsert({
        where: {
          sourceType_sourceRef: {
            sourceType,
            sourceRef: `subscription:${sub.id}:exam:${exam.id}`,
          },
        },
        update: {
          userId: sub.userId,
          examTypeId: exam.id,
          tier,
          status,
          subscriptionId: sub.id,
          totalAttemptsLimit: totalLimit,
          dailyAttemptsLimit: null,
          usedAttemptsTotal: usedForTrial,
          timezone: 'Asia/Almaty',
          windowStartsAt: sub.startsAt,
          windowEndsAt: sub.expiresAt,
          exhaustedAt: status === EntitlementStatus.exhausted ? now : null,
        },
        create: {
          userId: sub.userId,
          examTypeId: exam.id,
          tier,
          status,
          sourceType,
          sourceRef: `subscription:${sub.id}:exam:${exam.id}`,
          subscriptionId: sub.id,
          totalAttemptsLimit: totalLimit,
          dailyAttemptsLimit: null,
          usedAttemptsTotal: usedForTrial,
          timezone: 'Asia/Almaty',
          windowStartsAt: sub.startsAt,
          windowEndsAt: sub.expiresAt,
          exhaustedAt: status === EntitlementStatus.exhausted ? now : null,
        },
      });
    }
  }

  console.log('subscription v2 backfill complete');
}

main()
  .catch((err) => {
    console.error('backfill failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

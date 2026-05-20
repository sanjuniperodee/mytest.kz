import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntitlementStatus, EntitlementTier } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccessService } from '../../subscriptions/access.service';

function localizedLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.ru === 'string' && obj.ru.trim()) return obj.ru;
    if (typeof obj.kk === 'string' && obj.kk.trim()) return obj.kk;
    if (typeof obj.en === 'string' && obj.en.trim()) return obj.en;
  }
  return '—';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

@Injectable()
export class AdminUserService {
  constructor(
    private prisma: PrismaService,
    private accessService: AccessService,
  ) {}

  async getUsers(search?: string, page = 1, limit = 20) {
    const digits = search?.replace(/\D/g, '') ?? '';
    const where = search
      ? {
          OR: [
            { telegramUsername: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    let [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          subscriptions: {
            where: { isActive: true },
            orderBy: { expiresAt: 'desc' },
          },
          entitlements: {
            where: {
              status: EntitlementStatus.active,
              windowStartsAt: { lte: new Date() },
              OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: new Date() } }],
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    await Promise.all(items.map((u) => this.accessService.ensureSignupEntitlementsForUser(u.id)));

    if (items.length > 0) {
      const refreshed = await this.prisma.user.findMany({
        where: { id: { in: items.map((u) => u.id) } },
        include: {
          subscriptions: {
            where: { isActive: true },
            orderBy: { expiresAt: 'desc' },
          },
          entitlements: {
            where: {
              status: EntitlementStatus.active,
              windowStartsAt: { lte: new Date() },
              OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: new Date() } }],
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          },
        },
      });
      const byId = new Map(refreshed.map((u) => [u.id, u]));
      items = items.map((u) => byId.get(u.id) ?? u);
    }

    return {
      items: items.map((u) => ({
        ...u,
        telegramId: u.telegramId ? Number(u.telegramId) : null,
        hasActiveSubscription: u.entitlements.some((e) => e.tier === EntitlementTier.paid),
      })),
      total,
      page,
      limit,
    };
  }

  async updateUser(id: string, data: { isAdmin?: boolean }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async deleteUser(adminId: string, id: string) {
    if (adminId === id) {
      throw new BadRequestException('Cannot delete your own admin account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        telegramUsername: true,
        email: true,
        phone: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const deleted = await this.prisma.$transaction(async (tx) => {
      const sessionIds = (
        await tx.testSession.findMany({
          where: { userId: id },
          select: { id: true },
        })
      ).map((s) => s.id);

      if (sessionIds.length > 0) {
        await tx.funnelStep.updateMany({
          where: { sessionId: { in: sessionIds } },
          data: { sessionId: null },
        });
        await tx.attemptUsageLedger.updateMany({
          where: { sessionId: { in: sessionIds } },
          data: { sessionId: null },
        });
        await tx.testAnswer.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });
        await tx.testSession.deleteMany({ where: { id: { in: sessionIds } } });
      }

      await tx.visitEvent.updateMany({
        where: { userId: id },
        data: { userId: null },
      });
      await tx.subscription.updateMany({
        where: { grantedBy: id },
        data: { grantedBy: null },
      });
      await tx.userExamEntitlement.updateMany({
        where: { createdBy: id },
        data: { createdBy: null },
      });
      await tx.subscriptionPlanTemplate.updateMany({
        where: { createdBy: id },
        data: { createdBy: null },
      });

      const [
        paymentOrders,
        dailyUsage,
        usageLedger,
        entitlements,
        subscriptions,
      ] = await Promise.all([
        tx.paymentOrder.deleteMany({ where: { userId: id } }),
        tx.userExamDailyUsage.deleteMany({ where: { userId: id } }),
        tx.attemptUsageLedger.deleteMany({ where: { userId: id } }),
        tx.userExamEntitlement.deleteMany({ where: { userId: id } }),
        tx.subscription.deleteMany({ where: { userId: id } }),
      ]);

      await tx.user.delete({ where: { id } });

      return {
        paymentOrders: paymentOrders.count,
        dailyUsage: dailyUsage.count,
        usageLedger: usageLedger.count,
        entitlements: entitlements.count,
        subscriptions: subscriptions.count,
        testSessions: sessionIds.length,
      };
    });

    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.telegramUsername ||
      user.email ||
      user.phone ||
      user.id;

    return { deleted: true, id, displayName, deletedRelations: deleted };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
        },
        entitlements: {
          include: {
            examType: { select: { id: true, slug: true, name: true } },
            planTemplate: { select: { id: true, code: true, name: true } },
            subscription: { select: { id: true, planType: true, isActive: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    await this.accessService.ensureSignupEntitlementsForUser(id);

    const userWithEntitlements = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
        },
        entitlements: {
          include: {
            examType: { select: { id: true, slug: true, name: true } },
            planTemplate: { select: { id: true, code: true, name: true } },
            subscription: { select: { id: true, planType: true, isActive: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!userWithEntitlements) throw new NotFoundException('User not found');

    const sessions = await this.prisma.testSession.findMany({
      where: { userId: id },
      include: {
        examType: { select: { id: true, slug: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    const funnels = await this.prisma.funnelStep.findMany({
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      orderBy: { timestamp: 'desc' },
    });

    const subjectIds = new Set<string>();
    for (const session of sessions) {
      const meta = asRecord(session.metadata);
      const profileSubjectIds = Array.isArray(meta.profileSubjectIds)
        ? meta.profileSubjectIds.filter((v): v is string => typeof v === 'string')
        : [];
      for (const subjectId of profileSubjectIds) subjectIds.add(subjectId);

      const sections = Array.isArray(meta.sections)
        ? meta.sections.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v))
        : [];
      for (const section of sections) {
        if (typeof section.subjectId === 'string') subjectIds.add(section.subjectId);
      }
    }

    const subjects = subjectIds.size
      ? await this.prisma.subject.findMany({
          where: { id: { in: [...subjectIds] } },
          select: { id: true, slug: true, name: true },
        })
      : [];
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));

    return {
      user: {
        ...userWithEntitlements,
        telegramId: userWithEntitlements.telegramId ? Number(userWithEntitlements.telegramId) : null,
        hasActiveSubscription: userWithEntitlements.entitlements.some((e) => {
          const now = new Date();
          return (
            e.tier === EntitlementTier.paid &&
            e.status === EntitlementStatus.active &&
            e.windowStartsAt <= now &&
            (e.windowEndsAt == null || e.windowEndsAt > now)
          );
        }),
      },
      sessions: sessions.map((s) => ({
        ...(this.presentSessionMeta(s.examType.slug, s.metadata, subjectMap)),
        id: s.id,
        examTypeSlug: s.examType.slug,
        examTypeName: s.examType.name,
        status: s.status,
        language: s.language,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        durationSecs: s.durationSecs,
        score: s.score != null ? Number(s.score) : null,
        correctCount: s.correctCount,
        totalQuestions: s.totalQuestions,
      })),
      funnelSteps: funnels.map((f) => ({
        id: f.id,
        step: f.step,
        createdAt: f.timestamp,
      })),
    };
  }

  private presentSessionMeta(
    examTypeSlug: string,
    metadata: unknown,
    subjectMap: Map<string, { id: string; slug: string; name: unknown }>,
  ) {
    const meta = asRecord(metadata);
    const sections = Array.isArray(meta.sections)
      ? meta.sections.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v))
      : [];
    const profileSubjectIds = Array.isArray(meta.profileSubjectIds)
      ? meta.profileSubjectIds.filter((v): v is string => typeof v === 'string')
      : [];
    const entScope =
      meta.entScope === 'mandatory' ||
      meta.entScope === 'profile' ||
      meta.entScope === 'full' ||
      meta.entScope === 'creative'
        ? meta.entScope
        : null;
    const kind = typeof meta.kind === 'string' ? meta.kind : null;
    const isRetake = typeof meta.retakeOfSessionId === 'string';

    const allSectionSubjectIds = sections
      .map((section) => (typeof section.subjectId === 'string' ? section.subjectId : null))
      .filter((value): value is string => Boolean(value));
    const mandatorySubjectIds = sections
      .filter((section) => section.isMandatory !== false)
      .map((section) => (typeof section.subjectId === 'string' ? section.subjectId : null))
      .filter((value): value is string => Boolean(value));

    const toNames = (ids: string[]) =>
      [...new Set(ids)]
        .map((id) => subjectMap.get(id))
        .filter((value): value is { id: string; slug: string; name: unknown } => Boolean(value))
        .map((subject) => localizedLabel(subject.name));

    const profileSubjectNames = toNames(profileSubjectIds);
    const mandatorySubjectNames = toNames(mandatorySubjectIds);
    const sectionSubjectNames = toNames(allSectionSubjectIds);

    let modeLabel = 'Обычная сессия';
    if (kind === 'remediation') {
      modeLabel = 'Работа над ошибками';
    } else if (isRetake) {
      modeLabel = 'Повторная попытка';
    } else if (examTypeSlug === 'ent' && entScope === 'full') {
      modeLabel = 'Полный ЕНТ';
    } else if (examTypeSlug === 'ent' && entScope === 'profile') {
      modeLabel = 'Только профильные';
    } else if (examTypeSlug === 'ent' && entScope === 'mandatory') {
      modeLabel = 'Только обязательные';
    } else if (examTypeSlug === 'ent' && entScope === 'creative') {
      modeLabel = 'Творческий экзамен';
    }

    const subjectSummaryParts: string[] = [];
    if (profileSubjectNames.length > 0) {
      subjectSummaryParts.push(`Профиль: ${profileSubjectNames.join(' + ')}`);
    }
    if (mandatorySubjectNames.length > 0 && entScope !== 'profile') {
      subjectSummaryParts.push(`Обязательные: ${mandatorySubjectNames.join(', ')}`);
    } else if (subjectSummaryParts.length === 0 && sectionSubjectNames.length > 0) {
      subjectSummaryParts.push(sectionSubjectNames.join(', '));
    }

    return {
      modeLabel,
      entScope,
      kind,
      profileSubjectNames,
      mandatorySubjectNames,
      sectionSubjectNames,
      subjectSummary: subjectSummaryParts.join(' · ') || '—',
    };
  }
}

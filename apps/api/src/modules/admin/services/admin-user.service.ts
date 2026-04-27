import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntitlementStatus, EntitlementTier } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AdminUserService {
  constructor(private prisma: PrismaService) {}

  async getUsers(search?: string, page = 1, limit = 20) {
    const digits = search?.replace(/\D/g, '') ?? '';
    const where = search
      ? {
          OR: [
            { telegramUsername: { contains: search, mode: 'insensitive' as const } },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
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

    return {
      items: items.map((u) => ({
        ...u,
        telegramId: Number(u.telegramId),
        hasActiveSubscription: u.entitlements.some(
          (e) => e.tier === EntitlementTier.paid,
        ),
      })),
      total,
      page,
      limit,
    };
  }

  async updateUser(id: string, data: { isAdmin?: boolean }) {
    return this.prisma.user.update({ where: { id }, data });
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

    return {
      user: {
        ...user,
        telegramId: Number(user.telegramId),
        hasActiveSubscription: user.entitlements.some(
          (e) => e.tier === EntitlementTier.paid,
        ),
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        examTypeSlug: s.examType.slug,
        examTypeName: s.examType.name,
        status: s.status,
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
}

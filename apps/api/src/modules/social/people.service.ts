import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  LeaderboardService,
  PUBLIC_LEADERBOARD_SIZE,
} from "../leaderboard/leaderboard.service";
import { SocialAccessService } from "./social-access.service";
import { PeopleDto } from "./social.dto";
import { person } from "./social-selects";
@Injectable()
export class PeopleService {
  constructor(
    private readonly db: PrismaService,
    private readonly socialAccess: SocialAccessService,
    private readonly leaderboard: LeaderboardService,
  ) {}
  async people(user: string, query: PeopleDto) {
    const hidden = await this.socialAccess.hidden(user);
    const where: Prisma.UserWhereInput = {
      id: { notIn: [...hidden, ...(query.relation ? [] : [user])] },
    };
    if (query.q?.trim())
      where.OR = ["firstName", "lastName"].map((key) => ({
        [key]: { contains: query.q!.trim(), mode: "insensitive" },
      }));
    if (query.relation && query.userId) {
      await this.socialAccess.allowed(user, query.userId);
      if (query.relation === "followers")
        where.following = { some: { followingId: query.userId } };
      else where.followers = { some: { followerId: query.userId } };
    }
    return this.db.user.findMany({
      where,
      select: {
        ...person,
        followers: {
          where: { followerId: user },
          select: { followerId: true },
        },
      },
      take: 30,
      orderBy: { createdAt: "desc" },
    });
  }
  async profile(user: string, id: string) {
    const result = await this.db.user.findUnique({
      where: { id },
      select: {
        ...person,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            socialPosts: { where: { deletedAt: null, parentId: null } },
          },
        },
        followers: {
          where: { followerId: user },
          select: { followerId: true },
        },
      },
    });
    if (!result) throw new NotFoundException();
    const [block, hidden] = await Promise.all([
      this.db.socialBlock.findUnique({
        where: { blockerId_blockedId: { blockerId: user, blockedId: id } },
      }),
      this.socialAccess.hidden(user),
    ]);
    const unavailable = hidden.includes(id);
    return {
      ...result,
      blocked: !!block,
      unavailable,
      learning: unavailable ? null : await this.learning(user, id),
    };
  }
  // The profile is one identity across studying and community. Other people
  // see a best result only when the public leaderboard already shows it.
  private async learning(user: string, id: string) {
    const { attempts, best } = await this.leaderboard.getEntStanding(id);
    const visible =
      best && (id === user || best.rank <= PUBLIC_LEADERBOARD_SIZE);
    return {
      entAttempts: attempts,
      entBest: visible
        ? {
            rank: best.rank,
            rawScore: best.rawScore,
            maxScore: best.maxScore,
            profileSubjects: best.profileSubjects,
          }
        : null,
    };
  }
  private async ensureExists(id: string) {
    if (!(await this.db.user.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException();
  }
  async follow(user: string, id: string, enabled: boolean) {
    if (id === user)
      throw new BadRequestException("Нельзя подписаться на себя");
    await this.socialAccess.allowed(user, id);
    await this.ensureExists(id);
    const data = { followerId: user, followingId: id };
    if (enabled)
      await this.db.socialFollow.upsert({
        where: { followerId_followingId: data },
        create: data,
        update: {},
      });
    else await this.db.socialFollow.deleteMany({ where: data });
    return { ok: true };
  }
  async block(user: string, id: string, enabled: boolean) {
    if (id === user) throw new BadRequestException();
    await this.ensureExists(id);
    const data = { blockerId: user, blockedId: id };
    if (enabled)
      await this.db.$transaction([
        this.db.socialBlock.upsert({
          where: { blockerId_blockedId: data },
          create: data,
          update: {},
        }),
        this.db.socialFollow.deleteMany({
          where: {
            OR: [
              { followerId: user, followingId: id },
              { followerId: id, followingId: user },
            ],
          },
        }),
      ]);
    else await this.db.socialBlock.deleteMany({ where: data });
    return { ok: true };
  }
}

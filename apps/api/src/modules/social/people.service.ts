import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { SocialAccessService } from "./social-access.service";
import { ChatAccessService } from "./chat-access.service";
import { FeedDto, MessageDto, PeopleDto, PostDto } from "./social.dto";
import { person, order, page } from "./social-selects";
@Injectable()
export class PeopleService {
  constructor(
    private readonly db: PrismaService,
    private readonly socialAccess: SocialAccessService,
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
    const blocked = !!(await this.db.socialBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: user, blockedId: id } },
    }));
    return {
      ...result,
      blocked,
      unavailable: (await this.socialAccess.hidden(user)).includes(id),
    };
  }
  async follow(user: string, id: string, enabled: boolean) {
    if (id === user)
      throw new BadRequestException("Нельзя подписаться на себя");
    await this.socialAccess.allowed(user, id);
    await this.profile(user, id);
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
    await this.profile(user, id);
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

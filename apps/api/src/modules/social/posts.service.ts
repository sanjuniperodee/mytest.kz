import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type Redis from "ioredis";
import { PrismaService } from "../../database/prisma.service";
import { REDIS_CLIENT } from "../../database/redis.module";
import { SocialAccessService } from "./social-access.service";
import { ChatAccessService } from "./chat-access.service";
import {
  BLOCKED_CONTENT_MESSAGE,
  containsBlockedContent,
} from "./domain/content-filter";
import { FeedDto, MessageDto, PeopleDto, PostDto } from "./social.dto";
import {
  isPublicTopic,
  publicAuthorName,
  publicTextProblem,
} from "./domain/topics";
import { person, order, page } from "./social-selects";
@Injectable()
export class PostsService {
  constructor(
    private readonly db: PrismaService,
    private readonly socialAccess: SocialAccessService,
    private readonly chatAccess: ChatAccessService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}
  private include(user: string) {
    return {
      author: { select: person },
      groupInvite: { select: { id: true, title: true, archived: true } },
      _count: {
        select: {
          likes: true,
          reposts: true,
          replies: { where: { deletedAt: null } },
        },
      },
      likes: { where: { userId: user }, select: { userId: true } },
      reposts: { where: { userId: user }, select: { userId: true } },
    } satisfies Prisma.SocialPostInclude;
  }
  async feed(user: string, query: FeedDto) {
    const hidden = await this.socialAccess.hidden(user);
    const where: Prisma.SocialPostWhereInput = {
      deletedAt: null,
      authorId: { notIn: hidden },
    };
    if (query.parentId) {
      await this.post(user, query.parentId);
      where.parentId = query.parentId;
    } else where.parentId = query.tab === "replies" ? { not: null } : null;
    if (query.authorId) {
      await this.socialAccess.allowed(user, query.authorId);
      if (query.tab === "reposts") {
        where.reposts = { some: { userId: query.authorId } };
        delete where.parentId;
      } else where.authorId = query.authorId;
    }
    if (query.tab === "following")
      where.author = { followers: { some: { followerId: user } } };
    if (query.topicKey) where.topicKey = query.topicKey;
    return page(
      await this.db.socialPost.findMany({
        where,
        include: this.include(user),
        orderBy: order,
        take: 31,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
    );
  }
  async post(user: string, id: string) {
    const post = await this.db.socialPost.findUnique({
      where: { id },
      include: this.include(user),
    });
    if (!post || post.deletedAt)
      throw new NotFoundException("Публикация недоступна");
    await this.socialAccess.allowed(user, post.authorId);
    void this.view(user, id).catch(() => {});
    return post;
  }
  async create(user: string, data: PostDto) {
    if (containsBlockedContent(data.body))
      throw new BadRequestException(BLOCKED_CONTENT_MESSAGE);
    // Тема и публичность: ответ всегда наследует их от родителя (клиентские значения
    // игнорируются), корень может стать открытым только в теме вуза/специальности.
    let topicKey: string | null = data.topicKey ?? null;
    let isPublic = false;
    if (data.parentId) {
      const parent = await this.post(user, data.parentId);
      topicKey = parent.topicKey;
      isPublic = parent.isPublic;
    } else if (data.isPublic) {
      if (!isPublicTopic(topicKey))
        throw new BadRequestException(
          "Открытыми бывают только вопросы на страницах вузов и специальностей",
        );
      isPublic = true;
    }
    if (isPublic) {
      if (data.groupInviteId)
        throw new BadRequestException(
          "В открытый вопрос нельзя прикрепить приглашение в группу",
        );
      const problem = publicTextProblem(data.body);
      if (problem) throw new BadRequestException(problem);
    }
    let groupInviteToken: string | undefined;
    if (data.groupInviteId) {
      const { room, member } = await this.chatAccess.access(
        user,
        data.groupInviteId,
      );
      if (
        !room.title ||
        room.archived ||
        !room.inviteToken ||
        member.role === "member"
      )
        throw new ForbiddenException(
          "Приглашение в посте доступно администраторам группы",
        );
      groupInviteToken = room.inviteToken;
    }
    return this.db.socialPost.create({
      data: {
        authorId: user,
        body: data.body,
        parentId: data.parentId,
        groupInviteId: data.groupInviteId,
        groupInviteToken,
        topicKey,
        isPublic,
      },
      include: this.include(user),
    });
  }
  async remove(user: string, id: string) {
    const post = await this.post(user, id);
    const admin =
      post.authorId !== user
        ? await this.db.user.findUnique({
            where: { id: user },
            select: { isAdmin: true },
          })
        : null;
    if (post.authorId !== user && !admin?.isAdmin)
      throw new ForbiddenException();
    await this.db.socialPost.update({
      where: { id },
      data: { body: "", deletedAt: new Date() },
    });
    return { ok: true };
  }
  async react(
    user: string,
    id: string,
    kind: "like" | "repost",
    enabled: boolean,
  ) {
    await this.post(user, id);
    const data = { userId: user, postId: id };
    if (kind === "like") {
      if (enabled)
        await this.db.socialLike.upsert({
          where: { userId_postId: data },
          create: data,
          update: {},
        });
      else await this.db.socialLike.deleteMany({ where: data });
    } else {
      if (enabled)
        await this.db.socialRepost.upsert({
          where: { userId_postId: data },
          create: data,
          update: {},
        });
      else await this.db.socialRepost.deleteMany({ where: data });
    }
    return { ok: true };
  }
  async report(user: string, id: string, reason: string) {
    await this.post(user, id);
    await this.db.socialReport.upsert({
      where: { userId_postId: { userId: user, postId: id } },
      create: { userId: user, postId: id, reason },
      update: { reason },
    });
    return { ok: true };
  }
  async view(user: string, id: string) {
    const post = await this.db.socialPost.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, authorId: true },
    });
    if (!post || post.deletedAt)
      throw new NotFoundException("Публикация недоступна");
    await this.socialAccess.allowed(user, post.authorId);

    let shouldIncrement = true;
    if (this.redis) {
      try {
        const key = `post:view:${id}:${user}`;
        const set = await this.redis.set(key, "1", "EX", 86400, "NX");
        shouldIncrement = set === "OK";
      } catch {
        shouldIncrement = true;
      }
    }
    if (shouldIncrement) {
      await this.db.socialPost
        .update({
          where: { id },
          data: { views: { increment: 1 } },
        })
        .catch(() => {});
    }
    return { ok: true };
  }

  /**
   * Открытые вопросы для публичных страниц вузов и специальностей (без входа).
   * Отдаём только то, что нужно странице: текст, дату, «Имя Ф.» и счётчики —
   * без id пользователей, аватаров и ответов на закрытые посты.
   */
  async publicDiscussions(topicKey?: string, cursor?: string) {
    const replySelect = {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { firstName: true, lastName: true } },
      _count: { select: { likes: true } },
    } satisfies Prisma.SocialPostSelect;
    const rows = await this.db.socialPost.findMany({
      where: {
        isPublic: true,
        deletedAt: null,
        parentId: null,
        ...(topicKey ? { topicKey } : {}),
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        topicKey: true,
        author: { select: { firstName: true, lastName: true } },
        _count: {
          select: { likes: true, replies: { where: { deletedAt: null } } },
        },
        replies: {
          where: { deletedAt: null, isPublic: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 5,
          select: replySelect,
        },
      },
      orderBy: order,
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const shape = <T extends { author: { firstName: string | null; lastName: string | null } }>(
      row: T,
    ) => {
      const { author, ...rest } = row;
      return { ...rest, authorName: publicAuthorName(author.firstName, author.lastName) };
    };
    return {
      items: rows.slice(0, 20).map((row) => ({
        ...shape(row),
        replies: row.replies.map(shape),
      })),
      nextCursor: rows.length > 20 ? rows[19].id : null,
    };
  }

  /** Что произошло вокруг меня с момента `since`: ответы на мои посты и новые подписчики. */
  async activity(user: string, since: Date) {
    const floor = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const from = since < floor ? floor : since;
    const hidden = await this.socialAccess.hidden(user);
    const replyWhere: Prisma.SocialPostWhereInput = {
      deletedAt: null,
      createdAt: { gt: from },
      authorId: { not: user, notIn: hidden },
      parent: { authorId: user, deletedAt: null },
    };
    const [replies, followers, grouped] = await Promise.all([
      this.db.socialPost.count({ where: replyWhere }),
      this.db.socialFollow.count({
        where: { followingId: user, createdAt: { gt: from }, followerId: { notIn: hidden } },
      }),
      this.db.socialPost.groupBy({
        by: ["parentId"],
        where: replyWhere,
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
        take: 5,
      }),
    ]);
    // Куда именно ответили: до пяти моих постов с новыми ответами (для плашки в ленте).
    const parentIds = grouped.map((g) => g.parentId).filter((id): id is string => Boolean(id));
    const parents = parentIds.length
      ? await this.db.socialPost.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, body: true },
        })
      : [];
    const bodyById = new Map(parents.map((p) => [p.id, p.body]));
    const threads = grouped
      .filter((g) => g.parentId && bodyById.has(g.parentId))
      .map((g) => ({
        postId: g.parentId as string,
        excerpt: (bodyById.get(g.parentId as string) ?? "").slice(0, 90),
        replies: g._count._all,
      }));
    return { replies, followers, threads };
  }
}

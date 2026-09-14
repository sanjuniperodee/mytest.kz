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
export class PostsService {
  constructor(
    private readonly db: PrismaService,
    private readonly socialAccess: SocialAccessService,
    private readonly chatAccess: ChatAccessService,
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
    return post;
  }
  async create(user: string, data: PostDto) {
    if (data.parentId) await this.post(user, data.parentId);
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
}

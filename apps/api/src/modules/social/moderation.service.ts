import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ChatQueryDto } from "./social.dto";
import { person as chatPerson } from "./social-selects";
@Injectable()
export class ModerationService {
  constructor(private readonly db: PrismaService) {}

  async rooms(query: ChatQueryDto) {
    const where: Prisma.ChatRoomWhereInput = {};
    if (query.type === "group" || query.type === "direct" || query.type === "global")
      where.kind = query.type;
    if (query.q)
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        {
          members: {
            some: {
              user: {
                OR: [
                  { firstName: { contains: query.q, mode: "insensitive" } },
                  { lastName: { contains: query.q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ];
    const items = await this.db.chatRoom.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        key: true,
        kind: true,
        archived: true,
        updatedAt: true,
        _count: { select: { members: true, messages: true } },
        members: { take: 3, select: { user: { select: chatPerson } } },
      },
    });
    return {
      items: items.slice(0, 30),
      nextCursor: items.length > 30 ? items[29].id : null,
    };
  }

  async messages(user: string, id: string, query: ChatQueryDto) {
    await this.db.chatModerationAudit.create({
      data: { actorId: user, roomId: id, action: "view_messages" },
    });
    const items = await this.db.chatMessage.findMany({
      where: {
        roomId: id,
        ...(query.q
          ? { body: { contains: query.q, mode: "insensitive" } }
          : {}),
      },
      include: { author: { select: chatPerson }, attachment: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return {
      items: items.slice(0, 30),
      nextCursor: items.length > 30 ? items[29].id : null,
    };
  }

  async members(id: string, query: ChatQueryDto) {
    const items = await this.db.chatMember.findMany({
      where: { roomId: id, ...(query.cursor ? { userId: { gt: query.cursor } } : {}) },
      include: { user: { select: chatPerson } },
      orderBy: { userId: "asc" },
      take: 51,
    });
    return { items: items.slice(0, 50), nextCursor: items.length > 50 ? items[49].userId : null };
  }

  audit(id: string) {
    return this.db.chatModerationAudit.findMany({
      where: { roomId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async deleteMessage(user: string, id: string, message: string) {
    await this.db.$transaction([
      this.db.chatMessage.updateMany({
        where: { id: message, roomId: id },
        data: { body: "", deletedAt: new Date() },
      }),
      this.db.chatModerationAudit.create({
        data: {
          actorId: user,
          roomId: id,
          targetId: message,
          action: "platform_delete",
        },
      }),
    ]);
    return { ok: true };
  }

  async close(user: string, id: string) {
    await this.db.$transaction([
      this.db.chatRoom.update({
        where: { id },
        data: { archived: true, inviteToken: null },
      }),
      this.db.chatModerationAudit.create({
        data: { actorId: user, roomId: id, action: "platform_close" },
      }),
    ]);
    return { ok: true };
  }

  async reopen(user: string, id: string) {
    await this.db.$transaction([
      this.db.chatRoom.update({ where: { id }, data: { archived: false } }),
      this.db.chatModerationAudit.create({
        data: { actorId: user, roomId: id, action: "platform_reopen" },
      }),
    ]);
    return { ok: true };
  }

  reports() {
    return this.db.socialReport.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
      include: {
        post: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async dismiss(id: string) {
    await this.db.socialReport.deleteMany({ where: { id } });
    return { ok: true };
  }

  async remove(id: string) {
    await this.db.$transaction([
      this.db.socialPost.update({
        where: { id },
        data: { body: "", deletedAt: new Date() },
      }),
      this.db.socialReport.deleteMany({ where: { postId: id } }),
    ]);
    return { ok: true };
  }
}

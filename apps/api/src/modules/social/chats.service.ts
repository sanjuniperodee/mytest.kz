import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { SocialAccessService } from "./social-access.service";
import { ChatAccessService } from "./chat-access.service";
import { MessageDto } from "./social.dto";
import { ChatRepository } from "./infrastructure/chat.repository";
import { person, order, page } from "./social-selects";
@Injectable()
export class ChatsService {
  constructor(
    private readonly db: PrismaService,
    private readonly socialAccess: SocialAccessService,
    private readonly chatAccess: ChatAccessService,
    private readonly repository: ChatRepository,
  ) {}
  async openRoom(user: string, other?: string) {
    if (other === user)
      throw new BadRequestException("Выберите другого пользователя");
    if (other) {
      await this.socialAccess.allowed(user, other);
      if (
        !(await this.db.user.findUnique({
          where: { id: other },
          select: { id: true },
        }))
      )
        throw new NotFoundException();
    }
    const key = other ? [user, other].sort().join(":") : "global";
    const upsert = () =>
      this.db.chatRoom.upsert({
        where: { key },
        create: {
          key,
          kind: other ? "direct" : "global",
          members: {
            create: (other ? [user, other] : [user]).map((userId) => ({
              userId,
            })),
          },
        },
        update: {},
      });
    // A nested create keeps Prisma from using a native ON CONFLICT upsert, so two
    // people opening the same conversation at once can race on `key`. The loser
    // simply reads the room the winner created.
    const room = await upsert().catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return upsert();
      throw error;
    });
    if (!other)
      await this.db.chatMember.upsert({
        where: { roomId_userId: { roomId: room.id, userId: user } },
        create: { roomId: room.id, userId: user },
        update: {},
      });
    return { id: room.id };
  }
  private async room(user: string, id: string) {
    return (await this.chatAccess.access(user, id)).room;
  }
  async detail(user: string, id: string) {
    await this.room(user, id);
    const rooms = await this.rooms(user, id);
    if (!rooms[0]) throw new NotFoundException("Чат недоступен");
    return rooms[0];
  }
  async rooms(user: string, id?: string) {
    const hidden = await this.socialAccess.hidden(user);
    const rooms = await this.db.chatRoom.findMany({
      where: {
        ...(id ? { id } : {}),
        members: { some: { userId: user, banned: false } },
        OR: [
          { key: "global" },
          { title: { not: null } },
          { members: { none: { userId: { in: hidden } } } },
        ],
      },
      include: {
        members: {
          where: {
            OR: [
              { userId: user },
              { room: { key: { not: "global" }, title: null } },
            ],
          },
          select: {
            userId: true,
            readAt: true,
            role: true,
            muted: true,
            user: { select: person },
          },
        },
        messages: {
          where: { authorId: { notIn: hidden }, deletedAt: null },
          orderBy: order,
          take: 1,
          include: { author: { select: person }, attachment: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    const unread = await this.repository.unreadCounts(
      user,
      rooms.map((room) => room.id),
      hidden,
    );
    return rooms.map(({ inviteToken, ...room }) => ({
      ...room,
      unread: unread.get(room.id) || 0,
    }));
  }

  async unread(user: string) {
    const hidden = await this.socialAccess.hidden(user);
    return { count: await this.repository.unreadTotal(user, hidden) };
  }

  async messages(user: string, id: string, cursor?: string, after?: string) {
    await this.room(user, id);
    if (cursor && after)
      throw new BadRequestException("Выберите одно направление истории");
    const hidden = await this.socialAccess.hidden(user);
    const anchorId = cursor || after;
    // Tombstones remain valid anchors. Keyset pagination survives deletion and
    // cannot use a message from another room to move this room's timeline.
    const anchor = anchorId
      ? await this.db.chatMessage.findFirst({
          where: { id: anchorId, roomId: id },
          select: { id: true, createdAt: true },
        })
      : null;
    if (anchorId && !anchor)
      throw new BadRequestException("Сообщение истории недоступно");
    const direction = after ? "gt" : "lt";
    return page(
      await this.db.chatMessage.findMany({
        where: {
          roomId: id,
          authorId: { notIn: hidden },
          deletedAt: null,
          ...(anchor
            ? {
                OR: [
                  { createdAt: { [direction]: anchor.createdAt } },
                  {
                    createdAt: anchor.createdAt,
                    id: { [direction]: anchor.id },
                  },
                ],
              }
            : {}),
        },
        include: { author: { select: person }, attachment: true },
        orderBy: after ? [{ createdAt: "asc" }, { id: "asc" }] : order,
        take: 31,
      }),
    );
  }
  async send(user: string, id: string, data: MessageDto) {
    await this.chatAccess.access(user, id, this.db, true);
    if (!data.body && !data.attachmentId)
      throw new BadRequestException("Напишите сообщение или прикрепите файл");
    const existing = await this.db.chatMessage.findUnique({
      where: { authorId_clientId: { authorId: user, clientId: data.clientId } },
    });
    if (existing && (existing.roomId !== id || existing.body !== data.body))
      throw new BadRequestException("Идентификатор сообщения уже использован");
    return this.chatAccess.locked(id, async (tx) => {
      await this.chatAccess.access(user, id, tx, true);
      if (data.attachmentId) {
        const file = await tx.chatAttachment.findFirst({
          where: { id: data.attachmentId, roomId: id, uploaderId: user },
          include: { message: true },
        });
        if (!file || (file.message && file.message.clientId !== data.clientId))
          throw new BadRequestException("Вложение недоступно");
      }
      const message = await tx.chatMessage.upsert({
        where: {
          authorId_clientId: { authorId: user, clientId: data.clientId },
        },
        create: { ...data, roomId: id, authorId: user },
        update: {},
        include: { author: { select: person }, attachment: true },
      });
      if (
        message.roomId !== id ||
        message.body !== data.body ||
        message.attachmentId !== (data.attachmentId || null) ||
        message.deletedAt
      )
        throw new BadRequestException(
          "Идентификатор сообщения уже использован",
        );
      await tx.chatRoom.updateMany({
        where: { id, updatedAt: { lt: message.createdAt } },
        data: { updatedAt: message.createdAt },
      });
      return message;
    });
  }
  async read(user: string, id: string, messageId: string) {
    await this.room(user, id);
    const message = await this.db.chatMessage.findFirst({
      where: { id: messageId, roomId: id },
    });
    if (!message) throw new NotFoundException("Сообщение недоступно");
    await this.db.chatMember.updateMany({
      where: { roomId: id, userId: user, readAt: { lt: message.createdAt } },
      data: { readAt: message.createdAt },
    });
    return { ok: true };
  }
}

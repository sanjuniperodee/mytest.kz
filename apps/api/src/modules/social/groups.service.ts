import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { ChatAccessService } from "./chat-access.service";
import { canManageMember, GROUP_MEMBER_LIMIT } from "./domain/chat-policy";
import { GroupDto } from "./social.dto";

export const chatPerson = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;
@Injectable()
export class GroupsService {
  constructor(
    private readonly db: PrismaService,
    private readonly chatAccess: ChatAccessService,
  ) {}
  async create(user: string, dto: GroupDto) {
    const room = await this.db.chatRoom.create({
      data: {
        key: `group:${randomUUID()}`,
        kind: "group",
        title: dto.title,
        description: dto.description || "",
        onlyAdminsPost: dto.onlyAdminsPost || false,
        inviteToken: randomUUID(),
        members: { create: { userId: user, role: "owner" } },
      },
    });
    return { id: room.id };
  }
  async detail(user: string, id: string) {
    const { room, member } = await this.chatAccess.access(user, id);
    const manager = member.role !== "member";
    const members = await this.db.chatMember.findMany({
      where: { roomId: id, ...(manager ? {} : { banned: false }) },
      include: { user: { select: chatPerson } },
      orderBy: [{ role: "asc" }, { userId: "asc" }],
      take: 200,
    });
    return {
      ...room,
      inviteToken: manager ? room.inviteToken : null,
      myRole: member.role,
      members,
    };
  }
  async preview(token: string) {
    const room = await this.db.chatRoom.findFirst({
      where: { inviteToken: token, title: { not: null }, archived: false },
      select: {
        id: true,
        title: true,
        description: true,
        _count: { select: { members: { where: { banned: false } } } },
      },
    });
    if (!room)
      throw new NotFoundException("Приглашение отозвано или группа закрыта");
    return room;
  }
  async join(user: string, token: string) {
    const preview = await this.preview(token);
    return this.chatAccess.locked(preview.id, async (tx) => {
      const room = await tx.chatRoom.findFirst({
        where: { id: preview.id, inviteToken: token, archived: false },
      });
      if (!room) throw new NotFoundException("Приглашение недействительно");
      const member = await tx.chatMember.findUnique({
        where: { roomId_userId: { roomId: room.id, userId: user } },
      });
      if (member?.banned)
        throw new ForbiddenException("Доступ к группе закрыт");
      if (
        !member &&
        (await tx.chatMember.count({
          where: { roomId: room.id, banned: false },
        })) >= GROUP_MEMBER_LIMIT
      )
        throw new BadRequestException("В группе уже 200 участников");
      await tx.chatMember.upsert({
        where: { roomId_userId: { roomId: room.id, userId: user } },
        create: { roomId: room.id, userId: user },
        update: {},
      });
      return { id: room.id };
    });
  }
  async manage(
    user: string,
    id: string,
    action: "settings" | "rotate" | "archive",
    dto?: GroupDto,
  ) {
    return this.chatAccess.locked(id, async (tx) => {
      const { room, member } = await this.chatAccess.access(user, id, tx);
      if (
        !room.title ||
        member.role === "member" ||
        (action === "archive" && member.role !== "owner")
      )
        throw new ForbiddenException();
      if (room.archived) throw new BadRequestException("Группа закрыта");
      await tx.chatModerationAudit.create({
        data: { actorId: user, roomId: id, action },
      });
      return tx.chatRoom.update({
        where: { id },
        data:
          action === "rotate"
            ? { inviteToken: randomUUID() }
            : action === "archive"
              ? { archived: true, inviteToken: null }
              : dto!,
      });
    });
  }
  async member(user: string, id: string, target: string, action: string) {
    return this.chatAccess.locked(id, async (tx) => {
      const { room, member } = await this.chatAccess.access(user, id, tx);
      if (
        !room.title ||
        room.archived ||
        member.role === "member" ||
        target === user
      )
        throw new ForbiddenException();
      const other = await tx.chatMember.findUnique({
        where: { roomId_userId: { roomId: id, userId: target } },
      });
      if (!other) throw new NotFoundException();
      if (!canManageMember(member, other, action))
        throw new ForbiddenException("Недостаточно прав");
      if (action === "transfer") {
        if (other.banned)
          throw new BadRequestException("Сначала разблокируйте участника");
        await tx.chatMember.update({
          where: { roomId_userId: { roomId: id, userId: user } },
          data: { role: "admin" },
        });
      }
      if (action === "remove")
        await tx.chatMember.delete({
          where: { roomId_userId: { roomId: id, userId: target } },
        });
      else
        await tx.chatMember.update({
          where: { roomId_userId: { roomId: id, userId: target } },
          data:
            action === "transfer"
              ? { role: "owner", muted: false }
              : action === "admin" || action === "member"
                ? { role: action }
                : action === "ban" || action === "unban"
                  ? { banned: action === "ban", role: "member" }
                  : { muted: action === "mute" },
        });
      await tx.chatModerationAudit.create({
        data: { actorId: user, roomId: id, targetId: target, action },
      });
      return { ok: true };
    });
  }
  async leave(user: string, id: string) {
    return this.chatAccess.locked(id, async (tx) => {
      const { room, member } = await this.chatAccess.access(user, id, tx);
      if (!room.title) throw new BadRequestException();
      if (member.role === "owner")
        throw new BadRequestException(
          "Сначала передайте владение группой или закройте её",
        );
      await tx.chatMember.delete({
        where: { roomId_userId: { roomId: id, userId: user } },
      });
      return { ok: true };
    });
  }
  async deleteMessage(user: string, id: string, messageId: string) {
    return this.chatAccess.locked(id, async (tx) => {
      const { member } = await this.chatAccess.access(user, id, tx);
      const message = await tx.chatMessage.findFirst({
        where: { id: messageId, roomId: id },
      });
      if (!message) throw new NotFoundException();
      if (message.authorId !== user && member.role === "member")
        throw new ForbiddenException();
      await tx.chatMessage.update({
        where: { id: messageId },
        data: { deletedAt: new Date(), body: "" },
      });
      await tx.chatModerationAudit.create({
        data: {
          actorId: user,
          roomId: id,
          targetId: messageId,
          action: "delete_message",
        },
      });
      return { ok: true };
    });
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ChatRepository } from "./infrastructure/chat.repository";
import { canSend, isDirect } from "./domain/chat-policy";
@Injectable()
export class ChatAccessService {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: ChatRepository,
  ) {}
  // Serialize membership/role changes with sends, so removed/muted users cannot race a write.
  async locked<T>(
    id: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.repository.withRoomLock(id, work);
  }
  async access(
    user: string,
    id: string,
    tx: Prisma.TransactionClient = this.db,
    write = false,
  ) {
    const room = await tx.chatRoom.findFirst({
      where: { id, members: { some: { userId: user, banned: false } } },
      include: { members: { where: { userId: user } } },
    });
    if (!room) throw new NotFoundException("Чат недоступен");
    const member = room.members[0];
    if (write && !canSend(room, member))
      throw new ForbiddenException(
        "Отправка сообщений ограничена администратором",
      );
    if (isDirect(room.kind)) {
      const other = await tx.chatMember.findFirst({
        where: { roomId: id, userId: { not: user } },
      });
      if (
        other &&
        (await tx.socialBlock.findFirst({
          where: {
            OR: [
              { blockerId: user, blockedId: other.userId },
              { blockerId: other.userId, blockedId: user },
            ],
          },
        }))
      )
        throw new ForbiddenException(
          "Взаимодействие с пользователем недоступно",
        );
    }
    return { room, member };
  }
}

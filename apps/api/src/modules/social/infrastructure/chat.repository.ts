import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class ChatRepository {
  constructor(private readonly db: PrismaService) {}
  withRoomLock<T>(
    id: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ChatRoom" WHERE id = ${id}::uuid FOR UPDATE`;
      return work(tx);
    });
  }
  async unreadCounts(userId: string, roomIds: string[], hidden: string[]) {
    if (!roomIds.length) return new Map<string, number>();
    const rows = await this.db.$queryRaw<
      { roomId: string; count: bigint }[]
    >(Prisma.sql`
      SELECT m."roomId", COUNT(*) AS count FROM "ChatMessage" m
      JOIN "ChatMember" member ON member."roomId" = m."roomId" AND member."userId" = ${userId}::uuid
      WHERE m."roomId" IN (${Prisma.join(roomIds.map((id) => Prisma.sql`${id}::uuid`))})
      AND m."createdAt" > member."readAt" AND m."deletedAt" IS NULL
      AND m."authorId" NOT IN (${Prisma.join([userId, ...hidden].map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY m."roomId"`);
    return new Map(rows.map((row) => [row.roomId, Number(row.count)]));
  }
}

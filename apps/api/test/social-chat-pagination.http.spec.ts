import { Test } from "@nestjs/testing";
import { AuthGuard } from "@nestjs/passport";
import { ForbiddenException } from "@nestjs/common";
import request from "supertest";
import { ChatsController } from "../src/modules/social/chats.controller";
import { ChatsService } from "../src/modules/social/chats.service";

const roomId = "00000000-0000-4000-8000-000000000001";
const anchorId = "00000000-0000-4000-8000-000000000002";
const date = new Date("2026-09-22T12:00:00Z");
function fixture() {
  const db: any = {
    chatMessage: {
      findFirst: jest.fn().mockResolvedValue({ id: anchorId, createdAt: date }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    chatRoom: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: roomId, inviteToken: "private" }]),
    },
  };
  const social: any = { hidden: jest.fn().mockResolvedValue(["blocked-user"]) };
  const access: any = {
    access: jest.fn().mockResolvedValue({ room: { id: roomId } }),
  };
  const repository: any = {
    unreadCounts: jest.fn().mockResolvedValue(new Map([[roomId, 2]])),
  };
  return {
    db,
    access,
    service: new ChatsService(db, social, access, repository),
  };
}

describe("Chat history and room detail contracts", () => {
  it("uses room-scoped tombstone anchors and chronological forward pagination", async () => {
    const { service, db } = fixture();
    db.chatMessage.findMany.mockResolvedValue(
      Array.from({ length: 31 }, (_, i) => ({ id: String(i) })),
    );
    const result = await service.messages("user", roomId, undefined, anchorId);
    expect(db.chatMessage.findFirst).toHaveBeenCalledWith({
      where: { id: anchorId, roomId },
      select: { id: true, createdAt: true },
    });
    expect(db.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          roomId,
          deletedAt: null,
          authorId: { notIn: ["blocked-user"] },
          OR: [
            { createdAt: { gt: date } },
            { createdAt: date, id: { gt: anchorId } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 31,
      }),
    );
    expect(result.items).toHaveLength(30);
    expect(result.nextCursor).toBe("29");
  });
  it("uses deterministic keyset ordering for older messages, not a foreign Prisma cursor", async () => {
    const { service, db } = fixture();
    await service.messages("user", roomId, anchorId);
    const query = db.chatMessage.findMany.mock.calls[0][0];
    expect(query.where.OR).toEqual([
      { createdAt: { lt: date } },
      { createdAt: date, id: { lt: anchorId } },
    ]);
    expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(query.cursor).toBeUndefined();
    expect(query.skip).toBeUndefined();
  });
  it("rejects mixed directions and an anchor outside the current room", async () => {
    const { service, db } = fixture();
    await expect(
      service.messages("user", roomId, anchorId, anchorId),
    ).rejects.toThrow();
    db.chatMessage.findFirst.mockResolvedValue(null);
    await expect(service.messages("user", roomId, anchorId)).rejects.toThrow();
    expect(db.chatMessage.findMany).not.toHaveBeenCalled();
  });
  it("checks membership before reading room content or history", async () => {
    const { service, db, access } = fixture();
    access.access.mockRejectedValue(new ForbiddenException());
    await expect(service.detail("user", roomId)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.messages("user", roomId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(db.chatRoom.findMany).not.toHaveBeenCalled();
    expect(db.chatMessage.findMany).not.toHaveBeenCalled();
  });
  it("fetches the exact room outside the inbox limit, includes media previews, removes invite secrets", async () => {
    const { service, db } = fixture();
    expect(await service.detail("user", roomId)).toEqual({
      id: roomId,
      unread: 2,
    });
    const query = db.chatRoom.findMany.mock.calls[0][0];
    expect(query.where.id).toBe(roomId);
    expect(query.where.members).toEqual({
      some: { userId: "user", banned: false },
    });
    expect(query.include.messages.include.attachment).toBe(true);
  });
});

describe("Chat HTTP query validation (mock persistence)", () => {
  let app: any;
  const service = {
    detail: jest.fn().mockResolvedValue({ id: roomId }),
    messages: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ChatsController],
      providers: [{ provide: ChatsService, useValue: service }],
    })
      .overrideGuard(AuthGuard("jwt"))
      .useValue({
        canActivate(context: any) {
          context.switchToHttp().getRequest().user = { id: "user" };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it("validates room ids and query UUIDs and rejects unknown parameters", async () => {
    await request(app.getHttpServer())
      .get("/social/rooms/not-a-uuid")
      .expect(400);
    await request(app.getHttpServer())
      .get(`/social/rooms/${roomId}/messages?after=not-a-uuid`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/social/rooms/${roomId}/messages?secret=1`)
      .expect(400);
  });
  it("passes the current user and forward anchor to the service", async () => {
    await request(app.getHttpServer())
      .get(`/social/rooms/${roomId}`)
      .expect(200);
    expect(service.detail).toHaveBeenCalledWith("user", roomId);
    await request(app.getHttpServer())
      .get(`/social/rooms/${roomId}/messages?after=${anchorId}`)
      .expect(200);
    expect(service.messages).toHaveBeenCalledWith(
      "user",
      roomId,
      undefined,
      anchorId,
    );
  });
});

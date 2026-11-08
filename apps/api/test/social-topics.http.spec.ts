import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PostsService } from "../src/modules/social/posts.service";
import { PublicSocialController } from "../src/modules/social/public-social.controller";
import { publicAuthorName, publicTextProblem } from "../src/modules/social/domain/topics";

const userId = "00000000-0000-4000-8000-0000000000aa";
const parentId = "00000000-0000-4000-8000-0000000000bb";

function fixture(parent: Record<string, unknown> | null = null) {
  const db: any = {
    socialPost: {
      findUnique: jest.fn().mockResolvedValue(parent),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: "new", ...data })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    socialFollow: { count: jest.fn().mockResolvedValue(0) },
  };
  const socialAccess: any = {
    hidden: jest.fn().mockResolvedValue([]),
    allowed: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PostsService(db, socialAccess, {} as any);
  return { db, service };
}

describe("social topics and public discussions", () => {
  it("publishes an open question only inside a university/program topic", async () => {
    const { service, db } = fixture();
    await service.create(userId, { body: "Хватит ли 95 на IT в ЕНУ?", topicKey: "program:B057", isPublic: true });
    expect(db.socialPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ topicKey: "program:B057", isPublic: true }) }),
    );

    await expect(
      service.create(userId, { body: "Привет всем", isPublic: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(userId, { body: "Ответ дня", topicKey: "qotd:2026-11-08", isPublic: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("keeps ordinary feed posts closed even when a topic is set", async () => {
    const { service, db } = fixture();
    await service.create(userId, { body: "Мой ответ: B", topicKey: "qotd:2026-11-08" });
    expect(db.socialPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ topicKey: "qotd:2026-11-08", isPublic: false }) }),
    );
  });

  it("makes replies inherit topic and visibility from the parent, ignoring client values", async () => {
    const parent = {
      id: parentId,
      authorId: "someone",
      deletedAt: null,
      topicKey: "university:13",
      isPublic: true,
    };
    const { service, db } = fixture(parent);
    await service.create(userId, { body: "Хватит, в прошлом году было 92", parentId, topicKey: "qotd:2026-11-08", isPublic: false });
    expect(db.socialPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ topicKey: "university:13", isPublic: true, parentId }) }),
    );
  });

  it("rejects links and phone numbers in public text, not in closed posts", async () => {
    expect(publicTextProblem("пиши в t.me/someone")).not.toBeNull();
    expect(publicTextProblem("звони +7 701 123 45 67")).not.toBeNull();
    expect(publicTextProblem("набрал 112 баллов, прошёл на грант")).toBeNull();

    const { service } = fixture();
    await expect(
      service.create(userId, { body: "курсы тут https://spam.kz", topicKey: "program:B057", isPublic: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(userId, { body: "курсы тут https://spam.kz", topicKey: "qotd:2026-11-08" }),
    ).resolves.toBeDefined();
  });

  it("shows only a first name and initial on public pages", () => {
    expect(publicAuthorName("Айгерим", "Касымова")).toBe("Айгерим К.");
    expect(publicAuthorName("Данияр", null)).toBe("Данияр");
    expect(publicAuthorName(null, "Иванов")).toBe("Участник");
  });

  it("returns public questions without user ids and reads only isPublic roots", async () => {
    const { service, db } = fixture();
    db.socialPost.findMany.mockResolvedValue([
      {
        id: "p1",
        body: "Хватит ли 95?",
        createdAt: new Date("2026-11-08T10:00:00Z"),
        topicKey: "program:B057",
        author: { firstName: "Айгерим", lastName: "Касымова" },
        _count: { likes: 2, replies: 1 },
        replies: [
          {
            id: "r1",
            body: "Хватит",
            createdAt: new Date("2026-11-08T11:00:00Z"),
            author: { firstName: "Ерлан", lastName: null },
            _count: { likes: 0 },
          },
        ],
      },
    ]);
    const result = await service.publicDiscussions("program:B057");
    expect(db.socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPublic: true, deletedAt: null, parentId: null, topicKey: "program:B057" }),
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({ authorName: "Айгерим К.", replies: [expect.objectContaining({ authorName: "Ерлан" })] }),
    );
    expect(JSON.stringify(result)).not.toContain("Касымова");
    expect(result.items[0]).not.toHaveProperty("author");
  });

  it("serves public discussions without a JWT and validates the topic key", async () => {
    const posts = { publicDiscussions: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicSocialController],
      providers: [{ provide: PostsService, useValue: posts }],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    await request(app.getHttpServer())
      .get("/social/public/discussions?topicKey=program:B057")
      .expect(200);
    expect(posts.publicDiscussions).toHaveBeenCalledWith("program:B057", undefined);
    await request(app.getHttpServer())
      .get("/social/public/discussions?topicKey=qotd:2026-11-08")
      .expect(400);
    await app.close();
  });

  it("reports where people replied to me since my last visit", async () => {
    const { service, db } = fixture();
    db.socialPost.count.mockResolvedValue(3);
    db.socialPost.groupBy.mockResolvedValue([
      { parentId: "mine-1", _count: { _all: 2 }, _max: { createdAt: new Date() } },
      { parentId: "mine-2", _count: { _all: 1 }, _max: { createdAt: new Date() } },
    ]);
    db.socialPost.findMany.mockResolvedValue([
      { id: "mine-1", body: "Хватит ли 95 на IT?" },
      { id: "mine-2", body: "Кто сдавал био-хим?" },
    ]);
    const result = await service.activity(userId, new Date(Date.now() - 60_000));
    expect(result).toEqual({
      replies: 3,
      followers: 0,
      threads: [
        { postId: "mine-1", excerpt: "Хватит ли 95 на IT?", replies: 2 },
        { postId: "mine-2", excerpt: "Кто сдавал био-хим?", replies: 1 },
      ],
    });
    expect(db.socialPost.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ parent: { authorId: userId, deletedAt: null } }),
    });
  });
});

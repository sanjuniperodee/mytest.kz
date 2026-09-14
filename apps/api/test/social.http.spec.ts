import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import request from "supertest";
import { PrismaService } from "../src/database/prisma.service";
import { SocialModule } from "../src/modules/social/social.module";
import { JwtStrategy } from "../src/modules/auth/jwt.strategy";

// Explicit opt-in: this suite only touches users it creates in a local test database.
const url = process.env.SOCIAL_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("social HTTP + PostgreSQL", () => {
  let app: INestApplication;
  let db: PrismaService;
  const ids: string[] = [];
  const tokens: string[] = [];
  let post: string;
  let reply: string;
  let room: string;
  const auth = (index: number) => ({
    Authorization: `Bearer ${tokens[index]}`,
  });
  beforeAll(async () => {
    if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
      throw new Error("Use an isolated local SOCIAL_TEST_DATABASE_URL");
    process.env.DATABASE_URL = url;
    const module = await Test.createTestingModule({
      imports: [SocialModule],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_SECRET: "social-integration-only",
          }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    db = module.get(PrismaService);
    for (const name of ["Alice", "Bob", "Charlie"]) {
      const user = await db.user.create({
        data: { firstName: name, phone: `test-${randomUUID().slice(0, 12)}` },
      });
      ids.push(user.id);
      const session = await db.authSession.create({
        data: {
          userId: user.id,
          familyId: randomUUID(),
          refreshTokenHash: randomUUID().replace(/-/g, "").padEnd(64, "0"),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      tokens.push(
        new JwtService({ secret: "social-integration-only" }).sign({
          sub: user.id,
          sid: session.id,
          isAdmin: true,
        }),
      );
    }
  });
  afterAll(async () => {
    if (db) await db.user.deleteMany({ where: { id: { in: ids } } });
    await app?.close();
  });

  it("requires a valid active session and validates input", async () => {
    await request(app.getHttpServer()).get("/social/posts").expect(401);
    await request(app.getHttpServer())
      .post("/social/posts")
      .set(auth(0))
      .send({ body: "  " })
      .expect(400);
    await request(app.getHttpServer())
      .post("/social/posts")
      .set(auth(0))
      .send({ body: "x".repeat(2001) })
      .expect(400);
    await request(app.getHttpServer())
      .post("/social/posts")
      .set(auth(0))
      .send({ body: "hi", authorId: ids[1] })
      .expect(400);
  });
  it("persists posts, nested replies and does not expose private user fields", async () => {
    const created = await request(app.getHttpServer())
      .post("/social/posts")
      .set(auth(0))
      .send({ body: "  Мой первый пост  " })
      .expect(201);
    post = created.body.id;
    expect(created.body.body).toBe("Мой первый пост");
    expect(Object.keys(created.body.author).sort()).toEqual([
      "avatarUrl",
      "firstName",
      "id",
      "lastName",
    ]);
    reply = (
      await request(app.getHttpServer())
        .post("/social/posts")
        .set(auth(1))
        .send({ body: "Комментарий", parentId: post })
        .expect(201)
    ).body.id;
    await request(app.getHttpServer())
      .post("/social/posts")
      .set(auth(0))
      .send({ body: "Ответ на комментарий", parentId: reply })
      .expect(201);
    const thread = await request(app.getHttpServer())
      .get(`/social/posts?parentId=${reply}`)
      .set(auth(1))
      .expect(200);
    expect(thread.body.items).toHaveLength(1);
    expect(thread.body.items[0].body).toBe("Ответ на комментарий");
  });
  it("makes likes/reposts idempotent and supports following/profile tabs", async () => {
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .put(`/social/posts/${post}/like`)
        .set(auth(1))
        .expect(200);
      await request(app.getHttpServer())
        .put(`/social/posts/${post}/repost`)
        .set(auth(1))
        .expect(200);
      await request(app.getHttpServer())
        .put(`/social/people/${ids[0]}/follow`)
        .set(auth(1))
        .expect(200);
    }
    const result = await request(app.getHttpServer())
      .get(`/social/posts/${post}`)
      .set(auth(1))
      .expect(200);
    expect(result.body._count).toEqual({ likes: 1, reposts: 1, replies: 1 });
    for (const query of [
      `tab=following`,
      `tab=reposts&authorId=${ids[1]}`,
      `tab=replies&authorId=${ids[1]}`,
    ]) {
      const feed = await request(app.getHttpServer())
        .get(`/social/posts?${query}`)
        .set(auth(1))
        .expect(200);
      expect(feed.body.items.length).toBeGreaterThan(0);
    }
    await request(app.getHttpServer())
      .put(`/social/people/${ids[1]}/follow`)
      .set(auth(1))
      .expect(400);
  });
  it("deduplicates direct rooms and denies a third user access even with forged admin hint", async () => {
    room = (
      await request(app.getHttpServer())
        .post(`/social/rooms/direct/${ids[1]}`)
        .set(auth(0))
        .expect(201)
    ).body.id;
    const other = await request(app.getHttpServer())
      .post(`/social/rooms/direct/${ids[0]}`)
      .set(auth(1))
      .expect(201);
    expect(other.body.id).toBe(room);
    await request(app.getHttpServer())
      .get(`/social/rooms/${room}/messages`)
      .set(auth(2))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/social/rooms/${room}/messages`)
      .set(auth(2))
      .send({ body: "spy", clientId: randomUUID() })
      .expect(404);
    await request(app.getHttpServer())
      .get("/admin/social/reports")
      .set(auth(2))
      .expect(403);
  });
  it("deduplicates retried messages, tracks unread, and exposes only own global membership", async () => {
    const body = { body: "Привет!", clientId: randomUUID() };
    const sent = await request(app.getHttpServer())
      .post(`/social/rooms/${room}/messages`)
      .set(auth(0))
      .send(body)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post(`/social/rooms/${room}/messages`)
      .set(auth(0))
      .send(body)
      .expect(201);
    expect(retry.body.id).toBe(sent.body.id);
    let rooms = await request(app.getHttpServer())
      .get("/social/rooms")
      .set(auth(1))
      .expect(200);
    expect(rooms.body.find((r: { id: string }) => r.id === room).unread).toBe(
      1,
    );
    await request(app.getHttpServer())
      .put(`/social/rooms/${room}/read`)
      .set(auth(1))
      .send({ messageId: sent.body.id })
      .expect(200);
    rooms = await request(app.getHttpServer())
      .get("/social/rooms")
      .set(auth(1))
      .expect(200);
    expect(rooms.body.find((r: { id: string }) => r.id === room).unread).toBe(
      0,
    );
    const global = (
      await request(app.getHttpServer())
        .post("/social/rooms/global")
        .set(auth(0))
        .expect(201)
    ).body.id;
    await request(app.getHttpServer())
      .post("/social/rooms/global")
      .set(auth(1))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/social/rooms/${global}/messages`)
      .set(auth(0))
      .send(body)
      .expect(400);
    rooms = await request(app.getHttpServer())
      .get("/social/rooms")
      .set(auth(1))
      .expect(200);
    expect(
      rooms.body.find((r: { id: string }) => r.id === global).members,
    ).toHaveLength(1);
  });
  it("supports moderation and enforces post ownership independently of JWT hints", async () => {
    await request(app.getHttpServer())
      .delete(`/social/posts/${post}`)
      .set(auth(2))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/social/posts/${post}/report`)
      .set(auth(1))
      .send({ reason: "Проверить" })
      .expect(201);
    await db.user.update({ where: { id: ids[2] }, data: { isAdmin: true } });
    const reports = await request(app.getHttpServer())
      .get("/admin/social/reports")
      .set(auth(2))
      .expect(200);
    expect(
      reports.body.some((r: { postId: string }) => r.postId === post),
    ).toBe(true);
  });
  it("handles concurrent room creation and does not mark unseen messages as read", async () => {
    const pair = await Promise.all([
      request(app.getHttpServer())
        .post(`/social/rooms/direct/${ids[2]}`)
        .set(auth(0)),
      request(app.getHttpServer())
        .post(`/social/rooms/direct/${ids[0]}`)
        .set(auth(2)),
    ]);
    expect(pair.map((r) => r.status)).toEqual([201, 201]);
    expect(pair[0].body.id).toBe(pair[1].body.id);
    const seen = await request(app.getHttpServer())
      .post(`/social/rooms/${room}/messages`)
      .set(auth(0))
      .send({ body: "seen", clientId: randomUUID() })
      .expect(201);
    const unseen = await request(app.getHttpServer())
      .post(`/social/rooms/${room}/messages`)
      .set(auth(0))
      .send({ body: "unseen", clientId: randomUUID() })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/social/rooms/${room}/read`)
      .set(auth(1))
      .send({ messageId: seen.body.id })
      .expect(200);
    const rooms = await request(app.getHttpServer())
      .get("/social/rooms")
      .set(auth(1))
      .expect(200);
    expect(rooms.body.find((r: { id: string }) => r.id === room).unread).toBe(
      1,
    );
    await request(app.getHttpServer())
      .put(`/social/rooms/${pair[0].body.id}/read`)
      .set(auth(0))
      .send({ messageId: unseen.body.id })
      .expect(404);
  });
  it("blocks both directions, removes follows, hides posts and denies messages", async () => {
    await request(app.getHttpServer())
      .put(`/social/people/${ids[0]}/block`)
      .set(auth(1))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/social/posts/${post}`)
      .set(auth(1))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/social/rooms/${room}/messages`)
      .set(auth(0))
      .send({ body: "blocked", clientId: randomUUID() })
      .expect(403);
    const feed = await request(app.getHttpServer())
      .get("/social/posts")
      .set(auth(1))
      .expect(200);
    expect(
      feed.body.items.some((p: { authorId: string }) => p.authorId === ids[0]),
    ).toBe(false);
    expect(
      await db.socialFollow.count({
        where: { followerId: ids[1], followingId: ids[0] },
      }),
    ).toBe(0);
    await request(app.getHttpServer())
      .delete(`/social/people/${ids[0]}/block`)
      .set(auth(1))
      .expect(200);
  });
  it('enforces group roles, revocable invitations, bans, ownership and platform moderation', async () => {
    const group = (await request(app.getHttpServer()).post('/social/groups').set(auth(0)).send({ title: 'Study group' }).expect(201)).body.id;
    let detail = (await request(app.getHttpServer()).get(`/social/rooms/${group}`).set(auth(0)).expect(200)).body;
    expect(detail.myRole).toBe('owner');
    const token = detail.inviteToken;
    await request(app.getHttpServer()).get(`/social/rooms/${group}`).set(auth(1)).expect(404);
    await request(app.getHttpServer()).post(`/social/invites/${token}/join`).set(auth(1)).expect(201);
    await request(app.getHttpServer()).post('/social/posts').set(auth(0)).send({ body: 'Join us', groupInviteId: group }).expect(201);
    await request(app.getHttpServer()).post('/social/posts').set(auth(1)).send({ body: 'Join us', groupInviteId: group }).expect(403);
    await request(app.getHttpServer()).patch(`/social/groups/${group}`).set(auth(1)).send({ title: 'Unauthorized' }).expect(403);
    await request(app.getHttpServer()).patch(`/social/groups/${group}`).set(auth(0)).send({ title: 'Study group', onlyAdminsPost: true }).expect(200);
    await request(app.getHttpServer()).post(`/social/rooms/${group}/messages`).set(auth(1)).send({ body: 'blocked', clientId: randomUUID() }).expect(403);
    await request(app.getHttpServer()).patch(`/social/groups/${group}/members/${ids[1]}`).set(auth(0)).send({ action: 'admin' }).expect(200);
    const sent = (await request(app.getHttpServer()).post(`/social/rooms/${group}/messages`).set(auth(1)).send({ body: 'admin message', clientId: randomUUID() }).expect(201)).body;
    await request(app.getHttpServer()).patch(`/social/groups/${group}/members/${ids[0]}`).set(auth(1)).send({ action: 'ban' }).expect(403);
    await request(app.getHttpServer()).post(`/social/groups/${group}/invite`).set(auth(0)).expect(201);
    await request(app.getHttpServer()).get(`/social/invites/${token}`).set(auth(1)).expect(404);
    await request(app.getHttpServer()).post(`/social/invites/${token}/join`).set(auth(1)).expect(404);
    await request(app.getHttpServer()).patch(`/social/groups/${group}/members/${ids[1]}`).set(auth(0)).send({ action: 'ban' }).expect(200);
    detail = (await request(app.getHttpServer()).get(`/social/rooms/${group}`).set(auth(0)).expect(200)).body;
    await request(app.getHttpServer()).post(`/social/invites/${detail.inviteToken}/join`).set(auth(1)).expect(403);
    await request(app.getHttpServer()).get(`/social/rooms/${group}/messages`).set(auth(1)).expect(404);
    await request(app.getHttpServer()).patch(`/social/groups/${group}/members/${ids[1]}`).set(auth(0)).send({ action: 'unban' }).expect(200);
    await request(app.getHttpServer()).patch(`/social/groups/${group}/members/${ids[1]}`).set(auth(0)).send({ action: 'transfer' }).expect(200);
    await request(app.getHttpServer()).post(`/social/groups/${group}/leave`).set(auth(1)).expect(400);
    await request(app.getHttpServer()).get(`/admin/social/rooms/${group}/messages`).set(auth(1)).expect(403);
    await request(app.getHttpServer()).get(`/admin/social/rooms/${group}/messages`).set(auth(2)).expect(200);
    await request(app.getHttpServer()).delete(`/admin/social/rooms/${group}/messages/${sent.id}`).set(auth(2)).expect(200);
    expect((await request(app.getHttpServer()).get(`/social/rooms/${group}/messages`).set(auth(1)).expect(200)).body.items).toHaveLength(0);
    await request(app.getHttpServer()).post(`/admin/social/rooms/${group}/close`).set(auth(2)).expect(201);
    await request(app.getHttpServer()).post(`/social/rooms/${group}/messages`).set(auth(1)).send({ body: 'closed', clientId: randomUUID() }).expect(403);
    const audit = await request(app.getHttpServer()).get(`/admin/social/rooms/${group}/audit`).set(auth(2)).expect(200);
    expect(audit.body.some((a: { action: string }) => a.action === 'view_messages')).toBe(true);
  });
  it('serves private media only to authorized participants and rejects disguised files', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1kAAAAASUVORK5CYII=', 'base64');
    await request(app.getHttpServer()).post(`/social/rooms/${room}/media`).set(auth(0)).attach('file', Buffer.from('<html>not an image</html>'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
    const file = (await request(app.getHttpServer()).post(`/social/rooms/${room}/media`).set(auth(0)).attach('file', png, { filename: 'test.png', contentType: 'image/png' }).expect(201)).body;
    await request(app.getHttpServer()).get(`/social/media/${file.id}`).set(auth(1)).expect(404);
    const sent = (await request(app.getHttpServer()).post(`/social/rooms/${room}/messages`).set(auth(0)).send({ body: '', attachmentId: file.id, clientId: randomUUID() }).expect(201)).body;
    await request(app.getHttpServer()).get(`/social/media/${file.id}`).expect(401);
    await request(app.getHttpServer()).get(`/social/media/${file.id}`).set(auth(1)).expect(200).expect('Content-Type', /image\/png/);
    await db.user.update({ where: { id: ids[2] }, data: { isAdmin: false } });
    await request(app.getHttpServer()).get(`/social/media/${file.id}`).set(auth(2)).expect(404);
    await request(app.getHttpServer()).post(`/social/rooms/${room}/messages`).set(auth(1)).send({ body: '', attachmentId: file.id, clientId: randomUUID() }).expect(400);
    await request(app.getHttpServer()).delete(`/social/rooms/${room}/messages/${sent.id}`).set(auth(0)).expect(200);
    await request(app.getHttpServer()).get(`/social/media/${file.id}`).set(auth(1)).expect(404);
    await db.user.update({ where: { id: ids[2] }, data: { isAdmin: true } });
  });
  it("paginates without duplicates and makes deleted content unavailable", async () => {
    await db.socialPost.createMany({
      data: Array.from({ length: 35 }, (_, i) => ({
        authorId: ids[0],
        body: `page ${i}`,
      })),
    });
    const first = (
      await request(app.getHttpServer())
        .get("/social/posts")
        .set(auth(0))
        .expect(200)
    ).body;
    const second = (
      await request(app.getHttpServer())
        .get(`/social/posts?cursor=${first.nextCursor}`)
        .set(auth(0))
        .expect(200)
    ).body;
    expect(first.items).toHaveLength(30);
    expect(second.items.length).toBeGreaterThan(0);
    const all = [...first.items, ...second.items].map(
      (p: { id: string }) => p.id,
    );
    expect(new Set(all).size).toBe(all.length);
    await request(app.getHttpServer())
      .delete(`/social/posts/${post}`)
      .set(auth(0))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/social/posts/${post}`)
      .set(auth(0))
      .expect(404);
    await request(app.getHttpServer())
      .post("/social/posts")
      .set(auth(1))
      .send({ body: "reply", parentId: post })
      .expect(404);
  });
});

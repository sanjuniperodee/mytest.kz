/* Local browser smoke test. Requires API build, migrated isolated PostgreSQL and
 * web dev on :4318 with NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4319.
 * SOCIAL_TEST_DATABASE_URL must explicitly point to localhost. No production services used.
 */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { mkdir } = require("node:fs/promises");
const { Test } = require("@nestjs/testing");
const { ConfigService } = require("@nestjs/config");
const { JwtService } = require("@nestjs/jwt");
const { chromium } = require("playwright");
const { SocialModule } = require("../dist/modules/social/social.module");
const { PostsService } = require("../dist/modules/social/posts.service");
const { ChatsService } = require("../dist/modules/social/chats.service");
const { PrismaService } = require("../dist/database/prisma.service");
const { JwtStrategy } = require("../dist/modules/auth/jwt.strategy");

(async () => {
  const url = process.env.SOCIAL_TEST_DATABASE_URL;
  assert(
    url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname),
    "Use isolated local test database",
  );
  process.env.DATABASE_URL = url;
  const module = await Test.createTestingModule({
    imports: [SocialModule],
    providers: [
      JwtStrategy,
      {
        provide: ConfigService,
        useValue: new ConfigService({ JWT_SECRET: "browser-test-only" }),
      },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api/v1");
  const db = module.get(PrismaService),
    social = module.get(PostsService);
  const chats = module.get(ChatsService);
  const ids = [];
  let browser;
  let page;
  try {
    const users = [];
    for (const [firstName, lastName] of [
      ["Аружан", "Серик"],
      ["Данияр", "Омаров"],
      ["Айлин", "Канат"],
    ]) {
      const user = await db.user.create({ data: { firstName, lastName } });
      ids.push(user.id);
      users.push(user);
    }
    const session = await db.authSession.create({
      data: {
        userId: ids[0],
        familyId: randomUUID(),
        refreshTokenHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const jwt = new JwtService({ secret: "browser-test-only" });
    const token = jwt.sign({ sub: ids[0], sid: session.id });
    // Only the surrounding account shell is provided by this test fixture.
    // All social requests pass through the real controller, JWT guard, service and PostgreSQL.
    app.getHttpAdapter().get("/api/v1/users/me", (req, res) => {
      try {
        const payload = jwt.verify(
          (req.headers.authorization || "").replace("Bearer ", ""),
        );
        assert.equal(payload.sub, ids[0]);
        res.json({
          id: ids[0],
          firstName: users[0].firstName,
          lastName: users[0].lastName,
          isChannelMember: true,
          preferredLanguage: "ru",
        });
      } catch {
        res.status(401).json({ message: "Unauthorized" });
      }
    });
    app
      .getHttpAdapter()
      .get("/api/v1/public/landing-settings", (_req, res) => res.json({}));
    app
      .getHttpAdapter()
      .post("/api/v1/analytics/visit", (_req, res) => res.json({ ok: true }));
    const first = await social.create(ids[1], {
      body: "Сегодня впервые набрал 118 баллов на пробном ЕНТ! 🎉\nПомогло разбирать ошибки после каждого теста. А что помогает вам не терять мотивацию?",
    });
    await social.create(ids[2], {
      body: "Ищу напарника для подготовки по математике 📐\nДавайте решать по 10 задач в день и обсуждать сложные темы вместе.",
    });
    await social.create(ids[0], {
      body: "Маленькие шаги каждый день. Сегодня разобрала все ошибки по истории Казахстана ✨",
    });
    const room = await chats.openRoom(ids[0], ids[1]);
    await chats.send(ids[1], room.id, {
      body: "Привет! Давай готовиться вместе? 🙌",
      clientId: randomUUID(),
    });
    await app.listen(4319, "127.0.0.1");
    browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route("https://telegram.org/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "" }),
    );
    await context.addInitScript((token) => {
      localStorage.setItem("accessToken", token);
      localStorage.setItem("mytest-locale", "ru");
    }, token);
    page = await context.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") console.error("BROWSER", m.text());
    });
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("PAGE_ERROR", e.message);
    });
    const artifacts = "/tmp/bilimland-social-browser";
    await mkdir(artifacts, { recursive: true });
    async function noOverflow() {
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        "Horizontal overflow",
      );
    }
    await page.goto("http://localhost:4318/dashboard/community");
    await page
      .getByRole("heading", { name: "Свои люди. Общая цель." })
      .waitFor();
    await page.getByText("Сегодня впервые набрал", { exact: false }).waitFor();
    await page.screenshot({
      path: `${artifacts}/feed-desktop.png`,
      fullPage: true,
    });
    await noOverflow();
    await page
      .getByLabel("Текст публикации")
      .fill("Пост из браузера: готовимся вместе!");
    await page
      .getByRole("button", { name: "Опубликовать", exact: true })
      .click();
    await page
      .getByText("Пост из браузера: готовимся вместе!", { exact: true })
      .waitFor();
    const article = page
      .locator("article")
      .filter({ hasText: "Сегодня впервые набрал" });
    await article
      .getByRole("button", { name: "Нравится", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("article")]
          .find((a) => a.textContent.includes("Сегодня впервые набрал"))
          ?.querySelector('[aria-label="Нравится"]')
          ?.getAttribute("aria-pressed") === "true",
    );
    await article.getByRole("button", { name: "Репост", exact: true }).click();
    await article
      .getByRole("link", { name: "Комментарии", exact: true })
      .click();
    await page.waitForURL(`**/post/${first.id}`);
    await page.getByPlaceholder("Поделись своим ответом…").waitFor();
    await page
      .getByLabel("Текст публикации")
      .fill("Крутой результат! Продолжай 🙌");
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    await page
      .getByText("Крутой результат! Продолжай 🙌", { exact: true })
      .waitFor();
    await page
      .locator("article")
      .filter({ hasText: "Крутой результат!" })
      .getByRole("link", { name: "Комментарии", exact: true })
      .click();
    await page.waitForURL(
      (u) => u.pathname.includes("/post/") && !u.pathname.endsWith(first.id),
    );
    await page
      .getByLabel("Текст публикации")
      .fill("Ответ на ответ из браузера");
    await page.getByRole("button", { name: "Ответить", exact: true }).click();
    await page
      .getByText("Ответ на ответ из браузера", { exact: true })
      .waitFor();
    await page.goto(
      `http://localhost:4318/dashboard/community/people/${ids[1]}`,
    );
    await page
      .getByRole("button", { name: "Подписаться", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Вы подписаны", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Написать", exact: true }).click();
    await page
      .getByText("Привет! Давай готовиться вместе? 🙌", { exact: true })
      .last()
      .waitFor();
    await page
      .getByLabel("Сообщение", { exact: true })
      .fill("Да, давай! Начнём с математики.");
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await page
      .locator("p")
      .filter({ hasText: /^Да, давай! Начнём с математики\.$/ })
      .last()
      .waitFor();
    assert.equal(
      await db.chatMessage.count({
        where: { roomId: room.id, body: "Да, давай! Начнём с математики." },
      }),
      1,
    );
    await page.screenshot({
      path: `${artifacts}/chat-desktop.png`,
      fullPage: true,
    });
    for (const width of [390, 320, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("http://localhost:4318/dashboard/community");
      await page
        .getByText("Пост из браузера: готовимся вместе!", { exact: true })
        .waitFor();
      await noOverflow();
      await page.screenshot({
        path: `${artifacts}/feed-${width}.png`,
        fullPage: true,
      });
      await page.goto(
        `http://localhost:4318/dashboard/messages?room=${room.id}`,
      );
      await page.getByLabel("Сообщение", { exact: true }).waitFor();
      await noOverflow();
      await page.screenshot({
        path: `${artifacts}/chat-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:4318/dashboard/messages");
    await page.getByRole("button", { name: "Общий чат", exact: true }).click();
    await page
      .getByLabel("Сообщение", { exact: true })
      .fill("Привет всему сообществу!");
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await page.getByText("Привет всему сообществу!", { exact: true }).waitFor();
    await page
      .getByRole("link", { name: "Назад к чатам", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Общий чат", exact: true })
      .waitFor();
    await page.goto(
      `http://localhost:4318/dashboard/community/people/${ids[0]}`,
    );
    await page.getByRole("tab", { name: "Репосты", exact: true }).click();
    await page.getByText("Сегодня впервые набрал", { exact: false }).waitFor();
    await noOverflow();
    await page.screenshot({
      path: `${artifacts}/profile-mobile.png`,
      fullPage: true,
    });
    await page.goto('http://localhost:4318/dashboard/messages');
    await page.getByRole('button', { name: 'Создать группу', exact: true }).click();
    await page.getByLabel('Название', { exact: true }).fill('Математика — вместе к 140');
    await page.getByRole('button', { name: 'Создать', exact: true }).click();
    await page.getByRole('heading', { name: 'Математика — вместе к 140', exact: true }).waitFor();
    const groupId = new URL(page.url()).searchParams.get('room');
    assert(groupId);
    await page.getByRole('button', { name: 'Управление группой', exact: true }).click();
    await page.getByLabel('Описание', { exact: true }).fill('Разбираем сложные задачи вместе');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await page.getByRole('link', { name: 'Пригласить в посте', exact: true }).click();
    await page.getByLabel('Текст публикации').fill('Присоединяйтесь к нашей группе!');
    await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
    await page.getByText('Присоединяйтесь к нашей группе!', { exact: true }).waitFor();
    await page.getByRole('link').filter({ hasText: 'Посмотреть и присоединиться' }).click();
    await page.getByRole('button', { name: 'Присоединиться', exact: true }).click();
    await page.getByLabel('Сообщение', { exact: true }).waitFor();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1kAAAAASUVORK5CYII=', 'base64');
    await page.locator('input[type=file]').setInputFiles({ name: 'solution.png', mimeType: 'image/png', buffer: png });
    await page.getByText('solution.png', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Отправить', exact: true }).click();
    await page.getByRole('img', { name: 'solution.png', exact: true }).waitFor();
    await context.grantPermissions(['microphone']);
    await page.getByRole('button', { name: 'Записать голосовое', exact: true }).click();
    await page.getByRole('button', { name: 'Завершить запись', exact: true }).waitFor();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Завершить запись', exact: true }).click();
    await page.getByText(/^voice-.*\.webm$/).waitFor();
    await page.getByRole('button', { name: 'Отправить', exact: true }).click();
    await page.locator('audio').waitFor();
    await noOverflow();
    await page.screenshot({ path: `${artifacts}/group-media-mobile.png`, fullPage: true });
    assert.equal(await db.chatMessage.count({ where: { roomId: groupId, attachment: { mime: { startsWith: 'audio/' } } } }), 1);
    assert.deepEqual(errors, []);
    console.log(
      "SOCIAL_BROWSER_OK: posts, likes, reposts, nested replies, follows, direct/global messages, profile; widths 320/390/768/1440; no page errors",
    );
    console.log(`Screenshots: ${artifacts}`);
  } catch (e) {
    if (page) {
      console.error(
        "PAGE",
        page.url(),
        (await page.locator("body").innerText()).slice(0, 2500),
      );
      await page.screenshot({
        path: "/tmp/bilimland-social-browser/failure.png",
        fullPage: true,
      });
    }
    throw e;
  } finally {
    await browser?.close();
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

// Local browser fixtures. Never connects to a live API or writes production data.
const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const base = process.env.WEB_TEST_URL || "http://127.0.0.1:4320";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Local preview only");
const ids = {
  direct: "00000000-0000-4000-8000-000000000001",
  group: "00000000-0000-4000-8000-000000000002",
  global: "00000000-0000-4000-8000-000000000003",
  outside: "00000000-0000-4000-8000-000000000004",
};
const self = {
  id: "self",
  firstName: "Аружан",
  lastName: null,
  avatarUrl: null,
};
const other = {
  id: "other",
  firstName: "Данияр",
  lastName: "Алиев",
  avatarUrl: null,
};
const message = (i) => ({
  id: String(i).padStart(4, "0"),
  authorId: other.id,
  author: other,
  body: `Сообщение ${i}: обсуждаем подготовку к экзамену и сложные задания`,
  createdAt: new Date(Date.UTC(2026, 8, 22, 0, 0, i)).toISOString(),
});
const paginate = (rows) => ({
  items: rows.slice(0, 30),
  nextCursor: rows.length > 30 ? rows[29].id : null,
});
const post = (id, body, parentId = null) => ({
  id,
  body,
  parentId,
  authorId: other.id,
  author: other,
  createdAt: "2026-09-22T00:00:00Z",
  _count: { likes: 2, replies: 1, reposts: 0 },
  likes: [],
  reposts: [],
  views: 17,
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const lang of ["ru", "kk"])
      for (const scenario of ["feed", "inbox", "conversation", "global"]) {
        const t = (ru, kk) => (lang === "ru" ? ru : kk);
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        });
        await context.addInitScript((language) => {
          localStorage.setItem("accessToken", "local-social-fixture");
          localStorage.setItem("mytest-locale", language);
          localStorage.setItem("mytest-theme", "light");
        }, lang);
        const page = await context.newPage(),
          errors = [],
          requests = [],
          sends = [],
          reads = [];
        page.setDefaultTimeout(10000);
        page.on("pageerror", (error) => errors.push(error.message));
        const state = {
          failSend: true,
          failPublish: true,
          failHistory: false,
          rows: Array.from({ length: 60 }, (_, i) => message(i + 1)),
          published: [],
        };
        const room = (id) => ({
          id,
          kind:
            id === ids.global
              ? "global"
              : id === ids.group
                ? "group"
                : "direct",
          key: id === ids.global ? "global" : id,
          title:
            id === ids.group
              ? "Математика • ҰБТ 2027"
              : id === ids.global
                ? "Global"
                : null,
          archived: false,
          onlyAdminsPost: false,
          unread: id === ids.direct ? 3 : 0,
          members: [
            { userId: self.id, role: "member", muted: false, user: self },
            { userId: other.id, role: "member", muted: false, user: other },
          ],
          messages:
            id === ids.group
              ? [
                  {
                    ...message(60),
                    body: "",
                    attachment: {
                      id: "file",
                      name: "voice.webm",
                      mime: "audio/webm",
                      size: 1000,
                    },
                  },
                ]
              : [message(60)],
        });
        await page.route("**/api/v1/**", async (route) => {
          const req = route.request(),
            url = new URL(req.url()),
            path = url.pathname.replace("/api/v1", "");
          requests.push(`${req.method()} ${path}${url.search}`);
          const ok = (json) => route.fulfill({ json }),
            fail = () =>
              route.fulfill({
                status: 503,
                json: { message: "Тестовый сбой / Сынақ қатесі" },
              });
          if (path === "/users/me")
            return ok({
              ...self,
              preferredLanguage: lang,
              isChannelMember: true,
              hasActiveSubscription: false,
            });
          if (path === "/social/rooms/global") return ok({ id: ids.global });
          if (path === "/social/rooms")
            return ok([room(ids.direct), room(ids.group), room(ids.global)]);
          if (/^\/social\/rooms\/[^/]+$/.test(path))
            return ok(room(path.split("/").at(-1)));
          if (path.endsWith("/messages")) {
            if (req.method() === "POST") {
              const payload = req.postDataJSON();
              sends.push(payload);
              if (state.failSend) {
                state.failSend = false;
                return fail();
              }
              const sent = {
                ...message(state.rows.length + 1),
                body: payload.body,
                author: self,
                authorId: self.id,
              };
              state.rows.push(sent);
              return ok(sent);
            }
            if (state.failHistory) return fail();
            const after = url.searchParams.get("after"),
              cursor = url.searchParams.get("cursor");
            return ok(
              paginate(
                after
                  ? state.rows.filter((row) => row.id > after)
                  : [...state.rows]
                      .filter((row) => !cursor || row.id < cursor)
                      .reverse(),
              ),
            );
          }
          if (path.endsWith("/read")) {
            reads.push(req.postDataJSON().messageId);
            return ok({ ok: true });
          }
          if (path.endsWith("/media") && req.method() === "POST")
            return ok({
              id: "upload",
              name: "notes.pdf",
              mime: "application/pdf",
              size: 200,
            });
          if (path === "/social/posts" && req.method() === "POST") {
            if (state.failPublish) {
              state.failPublish = false;
              return fail();
            }
            state.published.unshift(post("new-post", req.postDataJSON().body));
            return ok(state.published[0]);
          }
          if (path === "/social/posts") {
            const parent = url.searchParams.get("parentId");
            return ok({
              items:
                parent === "root"
                  ? [post("reply", "Ответ с вложенной веткой", "root")]
                  : parent === "reply"
                    ? [post("nested", "Глубокий ответ", "reply")]
                    : url.searchParams.get("tab") === "following"
                      ? []
                      : [
                          ...state.published,
                          post("root", "Как разобраться с логарифмами?"),
                        ],
              nextCursor: null,
            });
          }
          if (path === "/social/posts/root")
            return ok(post("root", "Как разобраться с логарифмами?"));
          return ok({});
        });
        const destination =
          scenario === "feed"
            ? "/dashboard/community"
            : scenario === "global"
              ? "/dashboard/global-chat"
              : `/dashboard/messages${scenario === "conversation" ? `?room=${ids.outside}` : ""}`;
        await page.goto(
          `${base}${destination}${destination.includes("?") ? "&" : "?"}lang=${lang}`,
        );
        if (scenario === "feed") {
          const draft = page.locator("#compose-post");
          await draft.fill("Черновик важного вопроса");
          await page
            .getByRole("button", {
              name: t("Подписки", "Жазылымдар"),
              exact: true,
            })
            .click();
          await expect(
            page.getByText(
              t("В подписках пока тихо", "Жазылымдарда әзірге тыныш"),
            ),
          ).toBeVisible();
          await expect(draft).toHaveValue("Черновик важного вопроса");
          await expect(
            page.getByRole("link", {
              name: t("Найти людей", "Адамдарды табу"),
              exact: true,
            }),
          ).toBeVisible();
          await page
            .getByRole("button", {
              name: t("Все публикации", "Барлық жазбалар"),
              exact: true,
            })
            .click();
          await expect(
            page.getByText("Как разобраться с логарифмами?", { exact: true }),
          ).toBeVisible();
          const publish = page.getByRole("button", {
            name: t("Опубликовать", "Жариялау"),
            exact: true,
          });
          await publish.click();
          await expect(draft).toHaveValue("Черновик важного вопроса");
          await expect(
            page
              .getByRole("alert")
              .filter({ hasText: t("Текст сохранён", "Мәтін сақталды") }),
          ).toBeVisible();
          await publish.click();
          await expect(draft).toHaveValue("");
          await expect(
            page.getByText("Черновик важного вопроса", { exact: true }),
          ).toBeVisible();
          await page
            .getByRole("button", {
              name: t("Обновить ленту", "Лентаны жаңарту"),
              exact: true,
            })
            .click();
        } else if (scenario === "inbox") {
          const list = page.getByTestId("room-list");
          await expect(
            list.getByText(t("Голосовое сообщение", "Дауыстық хабарлама")),
          ).toBeVisible();
          await page
            .getByRole("button", {
              name: t("Непрочитанные", "Оқылмаған"),
              exact: true,
            })
            .click();
          await expect(list.getByRole("link")).toHaveCount(1);
          await page
            .getByRole("textbox", { name: t("Поиск чатов", "Чаттарды іздеу") })
            .fill("нет такого имени");
          await expect(
            page.getByText(t("Чаты не найдены", "Чаттар табылмады")),
          ).toBeVisible();
          await page
            .getByRole("button", {
              name: t("Сбросить фильтры", "Сүзгілерді тазалау"),
            })
            .click();
          await page
            .getByRole("button", { name: t("Группы", "Топтар"), exact: true })
            .click();
          await expect(list.getByRole("link")).toHaveCount(1);
          await expect(list.getByText("Математика • ҰБТ 2027")).toBeVisible();
        } else {
          const history = page.getByTestId("message-history");
          const input = page.getByPlaceholder(
            t("Напиши сообщение…", "Хабарлама жаз…"),
          );
          const send = page.getByRole("button", {
            name: t("Отправить", "Жіберу"),
            exact: true,
          });
          await expect(input).toBeEnabled();
          await expect(
            history.getByText(message(60).body, { exact: true }),
          ).toBeVisible();
          await expect.poll(() => reads.length).toBeGreaterThan(0);
          await expect(
            page.getByText(
              t(
                "Модераторы платформы могут просматривать сообщения и вложения.",
                "Платформа модераторлары хабарламалар мен тіркемелерді көре алады.",
              ),
            ),
          ).toBeVisible();
          assert.equal(
            await history
              .getByRole("link", { name: "Профиль: Данияр Алиев" })
              .last()
              .getAttribute("href"),
            "/dashboard/community/people/other",
          );
          if (scenario === "global") {
            await expect(
              page.getByRole("heading", {
                name: t("Глобальный чат", "Жаһандық чат"),
                exact: true,
              }),
            ).toHaveCount(2);
            assert(requests.includes("POST /social/rooms/global"));
            assert(requests.includes(`GET /social/rooms/${ids.global}`));
          } else {
            assert(
              requests.includes(`GET /social/rooms/${ids.outside}`),
              "room detail is independent of inbox listing",
            );
            await input.fill("Черновик с вложением");
            await input.press("Enter");
            await expect(input).toHaveValue("Черновик с вложением\n");
            assert.equal(sends.length, 0, "mobile Enter inserts a line break");
            const chooser = page.waitForEvent("filechooser");
            await page
              .getByRole("button", {
                name: t("Прикрепить файл", "Файл тіркеу"),
              })
              .click();
            await (
              await chooser
            ).setFiles({
              name: "notes.pdf",
              mimeType: "application/pdf",
              buffer: Buffer.from("%PDF-1.4 local fixture"),
            });
            await expect(
              page.getByText("notes.pdf", { exact: true }),
            ).toBeVisible();
            assert.equal(
              sends.length,
              0,
              "attachment controls do not submit the draft",
            );
            await page
              .getByRole("button", {
                name: t("Убрать вложение", "Тіркемені алып тастау"),
              })
              .click();
            assert.equal(
              sends.length,
              0,
              "removing attachment does not submit",
            );
            await input.fill("");
            await history.evaluate((el) => {
              el.scrollTop = 0;
              el.dispatchEvent(new Event("scroll"));
            });
            const readCount = reads.length;
            state.rows.push(
              ...Array.from({ length: 45 }, (_, i) => message(61 + i)),
            );
            await expect
              .poll(() => history.locator("time").count(), { timeout: 14000 })
              .toBe(75);
            assert.equal(
              reads.length,
              readCount,
              "history reading must not mark new arrivals as read",
            );
            await expect(
              page.getByRole("button", {
                name: t("К новым сообщениям", "Жаңа хабарламаларға"),
              }),
            ).toBeVisible();
            await page
              .getByRole("button", {
                name: t("К новым сообщениям", "Жаңа хабарламаларға"),
              })
              .click();
            await expect.poll(() => reads.at(-1)).toBe(message(105).id);
            await input.fill("Повторяем безопасно");
            await send.click();
            await expect(
              page
                .getByRole("alert")
                .filter({
                  hasText: t("Не удалось отправить", "Жіберу мүмкін болмады"),
                }),
            ).toBeVisible();
            await expect(input).toHaveValue("Повторяем безопасно");
            await send.evaluate((button) => {
              button.form.requestSubmit();
              button.form.requestSubmit();
            });
            await expect(input).toHaveValue("");
            await expect(
              history.getByText("Повторяем безопасно", { exact: true }),
            ).toBeVisible();
            assert.equal(sends.length, 2);
            assert.equal(sends[0].clientId, sends[1].clientId);
            await input.fill("Доставлено при сбое обновления");
            state.failHistory = true;
            await send.click();
            await expect(input).toHaveValue("");
            await expect(
              page.getByRole("alert").filter({ hasText: "Тестовый сбой" }),
            ).toBeVisible();
            assert.equal(sends.length, 3);
            await expect(
              page.getByText(
                t(
                  "Не удалось отправить. Текст сохранён — попробуй ещё раз.",
                  "Жіберу мүмкін болмады. Мәтін сақталды, қайталап көр.",
                ),
              ),
            ).toHaveCount(0);
            state.failHistory = false;
            await page
              .getByRole("button", {
                name: t("Повторить", "Қайталау"),
                exact: true,
              })
              .click();
            await expect(
              history.getByText("Доставлено при сбое обновления", {
                exact: true,
              }),
            ).toBeVisible();
            await history.evaluate((el) => {
              el.scrollTop = 0;
              el.dispatchEvent(new Event("scroll"));
            });
            const anchor = history.locator('[data-message-id="0031"]');
            const previousY = (await anchor.boundingBox()).y;
            const count = await history.locator("time").count();
            await page
              .getByRole("button", {
                name: t("Ранние сообщения", "Алдыңғы хабарламалар"),
              })
              .click();
            await expect(history.locator("time")).toHaveCount(count + 30);
            await expect
              .poll(async () =>
                Math.abs((await anchor.boundingBox()).y - previousY),
              )
              .toBeLessThan(3);
            await page
              .getByRole("button", {
                name: t("К новым сообщениям", "Жаңа хабарламаларға"),
              })
              .click();
          }
        }
        for (const width of [320, 390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          );
          assert(!overflow, `${scenario} ${lang} overflow at ${width}`);
          if (scenario === "global" || scenario === "conversation") {
            await page.evaluate(() => window.scrollTo(0, 0));
            const send = page.getByRole("button", {
              name: t("Отправить", "Жіберу"),
              exact: true,
            });
            const unobstructed = await send.evaluate((button) => {
              const rect = button.getBoundingClientRect();
              return button.contains(
                document.elementFromPoint(
                  rect.x + rect.width / 2,
                  rect.y + rect.height / 2,
                ),
              );
            });
            assert(
              unobstructed,
              `${scenario} ${lang} composer obscured at ${width}`,
            );
          }
          await page.screenshot({
            path: `/tmp/social-${scenario}-${lang}-${width}.png`,
            fullPage: true,
          });
        }
        if (scenario === "feed") {
          await page.goto(`${base}/dashboard/community/post/root?lang=${lang}`);
          await expect(
            page.getByText("Ответ с вложенной веткой", { exact: true }),
          ).toBeVisible();
          assert(!requests.some((path) => path.includes("parentId=reply")));
          await page
            .getByRole("button", {
              name: t("Посмотреть все ответы (1)", "Барлық жауапты көру (1)"),
              exact: true,
            })
            .click();
          await expect(
            page.getByText("Глубокий ответ", { exact: true }),
          ).toBeVisible();
        }
        assert.deepEqual(errors, []);
        console.log(
          JSON.stringify({
            scenario,
            lang,
            widths: [320, 390, 1280],
            errors: errors.length,
            pass: true,
          }),
        );
        await context.close();
      }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

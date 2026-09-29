// Runs the pure web reconciliation helper without a browser or database.
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const source = readFileSync(
  resolve(__dirname, "../../web/components/social/message-window.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
const exported = {};
new Function("exports", compiled)(exported);
const { refreshMessageWindow } = exported;
const message = (i) => ({
  id: String(i).padStart(4, "0"),
  createdAt: new Date(Date.UTC(2026, 8, 22, 0, 0, i)).toISOString(),
  body: `message-${i}`,
});
const range = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => message(from + i));
const page = (items) => ({
  items: items.slice(0, 30),
  nextCursor: items.length > 30 ? items[29].id : null,
});
function server(rows) {
  return {
    latest: () => Promise.resolve(page([...rows].reverse())),
    after: (id) => Promise.resolve(page(rows.filter((m) => m.id > id))),
  };
}

test("initial window retains the older cursor", async () => {
  const api = server(range(1, 50));
  assert.deepEqual(
    await refreshMessageWindow(undefined, api.latest, api.after),
    page(range(1, 50).reverse()),
  );
});
test("overlapping arrivals retain history without duplicates", async () => {
  const first = page(range(1, 50).reverse()),
    api = server(range(1, 55));
  const result = await refreshMessageWindow(first, api.latest, api.after);
  assert.deepEqual(
    result.items.map((m) => m.id),
    range(21, 55)
      .reverse()
      .map((m) => m.id),
  );
  assert.equal(result.nextCursor, first.nextCursor);
});
test("a burst over 30 is stitched without gaps", async () => {
  const first = page(range(1, 50).reverse()),
    api = server(range(1, 130));
  const result = await refreshMessageWindow(first, api.latest, api.after);
  assert.deepEqual(
    result.items.map((m) => m.id),
    range(21, 130)
      .reverse()
      .map((m) => m.id),
  );
});
test("bounded catch-up continues next poll without jumping the watermark", async () => {
  const first = page(range(1, 50).reverse()),
    api = server(range(1, 300));
  const partial = await refreshMessageWindow(first, api.latest, api.after);
  assert.equal(partial.items[0].id, message(170).id);
  const next = await refreshMessageWindow(partial, api.latest, api.after);
  assert.equal(next.items[0].id, message(290).id);
  const complete = await refreshMessageWindow(next, api.latest, api.after);
  assert.deepEqual(
    complete.items.map((m) => m.id),
    range(21, 300)
      .reverse()
      .map((m) => m.id),
  );
});
test("deletions in the authoritative newest range disappear", async () => {
  const first = page(range(1, 50).reverse()),
    api = server(range(1, 51).filter((m) => m.id !== message(40).id));
  const result = await refreshMessageWindow(first, api.latest, api.after);
  assert(!result.items.some((m) => m.id === message(40).id));
});
test("failed catch-up does not mutate the existing window", async () => {
  const first = page(range(1, 50).reverse()),
    snapshot = JSON.stringify(first),
    api = server(range(1, 100));
  await assert.rejects(
    refreshMessageWindow(first, api.latest, () =>
      Promise.reject(Error("offline")),
    ),
  );
  assert.equal(JSON.stringify(first), snapshot);
});
test("equal timestamps use ids to preserve deterministic order", async () => {
  const rows = range(1, 70).map((m) => ({
    ...m,
    createdAt: message(1).createdAt,
  }));
  const api = server(rows),
    first = page(rows.slice(0, 30).reverse());
  const result = await refreshMessageWindow(first, api.latest, api.after);
  assert.deepEqual(
    result.items.map((m) => m.id),
    [...rows].reverse().map((m) => m.id),
  );
});

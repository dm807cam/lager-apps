import { test, expect } from "../../../tests/fixtures.mjs";
import { makeEpub } from "./make-book.mjs";
import { offline, importBook, openBook, docs } from "./helpers.mjs";

test.beforeEach(async ({ page }) => { await offline(page); });
const sent = ingested => ingested.filter(x => x.slug === "habit-tracker" && x.endpoint === "activity").map(x => JSON.parse(x.body));

test("Folio sends its reading sessions to the Habit Tracker", async ({ openApp }) => {
  const start = Date.now() - 864e5, s = { id: "r1", bookId: "b1", title: "The Lantern Orchard", author: "Mira Testwood", start, end: start + 25 * 60e3, ms: 25 * 60e3, chars: 30000 };
  const seed = [{ path: "data/users/test-user/lib/sessions/r1", data: s },
    { path: "data/users/test-user/lib/marks/m1", data: { id: "m1", kind: "hl", bookId: "b1", ch: 0, start: 0, end: 5, text: "a private highlight", note: "a private note", updatedAt: start } }];
  const { ingested, errors } = await openApp("folio", { seed, waitFor: 0 });
  await expect.poll(() => sent(ingested).length, { timeout: 15000 }).toBe(1);
  const b = sent(ingested)[0];
  expect(b.v).toBe(1);
  expect(b.source).toMatchObject({ app: "folio", name: "Folio", kinds: [{ kind: "reading", label: "Reading", unit: "min" }] });
  const d = new Date(start), day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  expect(b.events).toEqual([expect.objectContaining({ op: "upsert", id: "r1", kind: "reading", date: day, minutes: 25, value: 20, unit: "pages", title: "The Lantern Orchard", url: "https://folio.lager.test/#book/b1" })]);
  const raw = JSON.stringify(b);
  expect(raw).not.toContain("private");
  expect(errors).toEqual([]);
});

test("reading for a few minutes becomes a session that ticks Habits", async ({ openApp, page }) => {
  await page.clock.install();
  const { ingested } = await openApp("folio", { seed: [], waitFor: 300 });
  const [id] = await importBook(page, "lantern.epub", await makeEpub());
  await openBook(page, id);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("ArrowRight"); await page.clock.runFor(30000); }
  await page.clock.runFor(8000);
  await expect.poll(async () => (await docs(page, /lib\/sessions\//)).length).toBe(1);
  const s = (await docs(page, /lib\/sessions\//))[0].data;
  expect(s.bookId).toBe(id);
  expect(s.ms).toBeGreaterThanOrEqual(170000);
  expect(s.chars).toBeGreaterThan(1000);
  await page.clock.runFor(10000);
  await expect.poll(() => sent(ingested).flatMap(b => b.events).filter(e => e.id === s.id).map(e => e.minutes).pop(), { timeout: 10000 }).toBeGreaterThanOrEqual(2.8);
  const e = sent(ingested).flatMap(b => b.events).filter(e => e.id === s.id).pop();
  expect(e).toMatchObject({ kind: "reading", title: "The Lantern Orchard" });
  expect(e.minutes).toBeGreaterThanOrEqual(2.8);
});

test("a session that is idle stops counting", async ({ openApp, page }) => {
  await page.clock.install();
  await openApp("folio", { seed: [], waitFor: 300 });
  const [id] = await importBook(page, "lantern.epub", await makeEpub());
  await openBook(page, id);
  await page.keyboard.press("ArrowRight");
  await page.clock.runFor(30 * 60e3);   // the phone lies on the table for half an hour
  await expect.poll(async () => (await docs(page, /lib\/sessions\//)).length).toBe(1);
  const s = (await docs(page, /lib\/sessions\//))[0].data;
  expect(s.ms).toBeLessThanOrEqual(10 * 60e3 + 5000);
});

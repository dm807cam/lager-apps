import { test, expect } from "../../../tests/fixtures.mjs";

const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const batch = (events, source = { app: "workout-tracker", name: "Workout Tracker", kinds: [{ kind: "workout", label: "Workout", unit: "min" }] }) => ({ v: 1, source, events });
const docs = (page, prefix) => page.evaluate(p => Object.entries(window.__lager.dump()).filter(([k]) => k.startsWith(p)), prefix);

test.describe("Activity API v1 inbox", () => {
  test("turns a batch into activities and empties the inbox", async ({ openApp }) => {
    const { page, errors } = await openApp("habit-tracker");
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([
      { id: "s_1", kind: "workout", date: day(-1), minutes: 52, title: "Full Body" },
      { id: "s_2", kind: "workout", date: day(0), minutes: 40 }
    ]));
    await expect.poll(async () => (await docs(page, "activities/")).length).toBe(2);
    expect(await docs(page, "inbox/")).toEqual([]);
    const [, act] = (await docs(page, "activities/workout-tracker~s_1"))[0];
    expect(act).toMatchObject({ app: "workout-tracker", id: "s_1", kind: "workout", date: day(-1), minutes: 52, title: "Full Body" });
    const [, app] = (await docs(page, "apps/workout-tracker"))[0];
    expect(app.name).toBe("Workout Tracker");
    expect(errors).toEqual([]);
  });

  test("the same id again updates, op delete removes", async ({ openApp }) => {
    const { page } = await openApp("habit-tracker");
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([{ id: "s_1", kind: "workout", date: day(0), minutes: 30 }]));
    await expect.poll(async () => (await docs(page, "activities/")).length).toBe(1);
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([{ id: "s_1", kind: "workout", date: day(0), minutes: 45 }]));
    await expect.poll(async () => (await docs(page, "activities/workout-tracker~s_1"))[0][1].minutes).toBe(45);
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([{ op: "delete", id: "s_1" }]));
    await expect.poll(async () => (await docs(page, "activities/")).length).toBe(0);
  });

  test("rejects malformed events but keeps the good ones", async ({ openApp }) => {
    const { page } = await openApp("habit-tracker");
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([
      { id: "ok", kind: "workout", date: day(0) },
      { id: "bad-kind", kind: "Not A Slug", date: day(0) },
      { id: "no-date", kind: "workout" },
      { kind: "workout", date: day(0) }
    ]));
    await expect.poll(async () => (await docs(page, "inbox/")).length).toBe(0);
    expect((await docs(page, "activities/")).map(([k]) => k)).toEqual(["activities/workout-tracker~ok"]);
    const [, app] = (await docs(page, "apps/workout-tracker"))[0];
    expect(app.rejected).toBe(3);
  });

  test("drops whole batches with a wrong version or source", async ({ openApp }) => {
    const { page } = await openApp("habit-tracker");
    await page.evaluate(() => window.__lager.ingest("inbox", { v: 2, source: "x", events: [{ id: "a", kind: "workout", date: "2026-01-01" }] }));
    await page.evaluate(() => window.__lager.ingest("inbox", { v: 1, source: { app: "Bad App!" }, events: [{ id: "a", kind: "workout", date: "2026-01-01" }] }));
    await expect.poll(async () => (await docs(page, "inbox/")).length).toBe(0);
    expect(await docs(page, "activities/")).toEqual([]);
  });

  test("text from outside is shown as text, never as HTML", async ({ openApp }) => {
    const { page } = await openApp("habit-tracker");
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([{ id: "x", kind: "workout", date: day(0), title: "<img src=x onerror=window.__pwned=1>" }],
      { app: "workout-tracker", name: "<b>Evil</b>" }));
    await page.getByRole("button", { name: "Apps" }).click();
    await expect(page.getByText("<img src=x onerror=window.__pwned=1>")).toBeVisible();
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});

test.describe("habits", () => {
  test("a linked habit ticks itself from received activity, history included", async ({ openApp }) => {
    const { page } = await openApp("habit-tracker");
    const events = [0, -2, -4, -7, -9, -11].map((o, i) => ({ id: "w" + i, kind: "workout", date: day(o), minutes: 50, title: "Full Body" }));
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch(events));
    await page.getByRole("button", { name: /Work out/ }).first().click();
    await page.locator("#sheet button[type=submit]").click();
    const row = page.locator(".habit", { hasText: "Work out" });
    await expect(row.locator("[data-check]")).toHaveAttribute("aria-pressed", "true");
    await expect(row).toContainText("Workout Tracker · 50 min");
  });

  test("a manual habit is ticked and unticked by tapping", async ({ openApp }) => {
    const { page } = await openApp("habit-tracker");
    await page.getByRole("button", { name: "Create your own" }).click();
    await page.fill("#hn", "Read 10 pages");
    await page.locator("#sheet button[type=submit]").click();
    const check = page.locator(".habit", { hasText: "Read 10 pages" }).locator("[data-check]");
    await check.click();
    await expect(check).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await docs(page, "checks/")).length).toBe(1);
    await check.click();
    await expect(check).toHaveAttribute("aria-pressed", "false");
    await expect.poll(async () => (await docs(page, "checks/")).length).toBe(0);
  });

  test("a minimum number of minutes is respected", async ({ openApp }) => {
    const { page } = await openApp("habit-tracker");
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([{ id: "m1", kind: "meditation", date: day(0), minutes: 3 }],
      { app: "stillwater", name: "Stillwater", kinds: [{ kind: "meditation", label: "Meditation", unit: "min" }] }));
    await page.getByRole("button", { name: /Meditate/ }).first().click();   // suggestion: 5+ min a day
    await page.locator("#sheet button[type=submit]").click();
    const check = page.locator(".habit", { hasText: "Meditate" }).locator("[data-check]");
    await expect(check).toHaveAttribute("aria-pressed", "false");
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([{ id: "m2", kind: "meditation", date: day(0), minutes: 4 }],
      { app: "stillwater", name: "Stillwater" }));
    await expect(check).toHaveAttribute("aria-pressed", "true");
  });
  test("Folio reading sessions tick the suggested Read habit", async ({ openApp }) => {
    const { page, errors } = await openApp("habit-tracker");
    const folio = { app: "folio", name: "Folio", kinds: [{ kind: "reading", label: "Reading", unit: "min" }] };
    // the suggestion exists before Folio ever sent anything, and the generic "Read" chip isn't shown twice
    await expect(page.locator(".chip", { hasText: "Read" })).toHaveCount(1);
    await page.getByRole("button", { name: /Read/ }).first().click();   // suggestion: 15+ min a day, linked to Folio
    await page.locator("#sheet button[type=submit]").click();
    const check = page.locator(".habit", { hasText: "Read" }).locator("[data-check]");
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([{ id: "r1", kind: "reading", date: day(0), minutes: 9, value: 6, unit: "pages", title: "An Invented Novel" }], folio));
    await expect.poll(async () => (await docs(page, "activities/folio~r1")).length).toBe(1);
    await expect(check).toHaveAttribute("aria-pressed", "false");
    await page.evaluate(b => window.__lager.ingest("inbox", b), batch([{ id: "r2", kind: "reading", date: day(0), minutes: 7, value: 5, unit: "pages" }], folio));
    await expect(check).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });
});

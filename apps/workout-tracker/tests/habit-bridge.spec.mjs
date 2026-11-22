import { test, expect } from "../../../tests/fixtures.mjs";

const UID = "test-user";
function workouts(n) {
  const out = [], now = Date.now();
  for (let i = 1; i <= n; i++) {
    const start = now - i * 2 * 864e5, id = "s_" + start;
    out.push({ path: `data/users/${UID}/${id}`, data: { id, kind: "session", startedAt: start, endedAt: start + 50 * 60000, updatedAt: start + 50 * 60000, done: true, planId: null, name: "Full Body", order: [], targets: {}, count: {}, rest: {}, notes: {}, sets: {} } });
  }
  return out;
}
const sent = ingested => ingested.filter(x => x.slug === "habit-tracker" && x.endpoint === "activity").map(x => JSON.parse(x.body));

test.describe("Habit Tracker bridge", () => {
  test("sends the whole history once, in Activity API v1 format", async ({ openApp }) => {
    const { page, ingested, errors } = await openApp("workout-tracker", { seed: workouts(5), waitFor: 0 });
    await expect.poll(() => sent(ingested).length, { timeout: 15000 }).toBeGreaterThan(0);
    const [b] = sent(ingested);
    expect(b.v).toBe(1);
    expect(b.source).toMatchObject({ app: "workout-tracker", name: "Workout Tracker", kinds: [{ kind: "workout" }] });
    expect(b.events).toHaveLength(5);
    for (const e of b.events) {
      expect(e).toMatchObject({ op: "upsert", kind: "workout", title: "Full Body", minutes: 50 });
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(ingested[0].origin).toBe("https://workout-tracker.lager.test");
    const state = await page.evaluate(u => window.__lager.store.get(`data/users/${u}/bridge/habit-tracker/state`), UID);
    expect(Object.keys(state.sent)).toHaveLength(5);
    expect(errors).toEqual([]);
  });

  test("sends nothing again when nothing changed", async ({ openApp }) => {
    const { page, ingested } = await openApp("workout-tracker", { seed: workouts(3), waitFor: 0 });
    await expect.poll(() => sent(ingested).length, { timeout: 15000 }).toBe(1);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(4000);
    expect(sent(ingested)).toHaveLength(1);
  });

  test("a deleted workout becomes a delete event", async ({ openApp }) => {
    const seed = workouts(2);
    const { page, ingested } = await openApp("workout-tracker", { seed, waitFor: 0 });
    await expect.poll(() => sent(ingested).length, { timeout: 15000 }).toBe(1);
    const victim = seed[0];
    await page.evaluate(([path, data]) => window.__lager.set(path, Object.assign({}, data, { deleted: true, updatedAt: Date.now() + 1000 })), [victim.path, victim.data]);
    await expect.poll(() => sent(ingested).length, { timeout: 15000 }).toBe(2);
    expect(sent(ingested)[1].events).toEqual([{ op: "delete", id: victim.data.id }]);
  });

  test("sends no deletes while the snapshot is capped at 1000 documents", async ({ openApp }) => {
    const seed = workouts(1005).concat([{ path: `data/users/${UID}/bridge/habit-tracker/state`, data: { sent: { s_gone: "x" }, full: Date.now(), at: Date.now() } }]);
    const { ingested } = await openApp("workout-tracker", { seed, waitFor: 0 });
    await expect.poll(() => sent(ingested).length, { timeout: 15000 }).toBeGreaterThan(0);
    await new Promise(r => setTimeout(r, 1500));
    const events = sent(ingested).flatMap(b => b.events);
    expect(events.filter(e => e.op === "delete")).toEqual([]);
  });
});

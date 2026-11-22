import { test, expect } from "../../../tests/fixtures.mjs";

const sits = (n, now) => Array.from({ length: n }, (_, i) => { const at = now - (i + 1) * 8 * 3600e3, id = "s_" + at; return { path: `data/users/test-user/${id}`, data: { id, kind: "session", at, dur: 600, type: "mind", breath: "off", updatedAt: at } }; });

test("Stillwater sends its sessions to the Habit Tracker as meditation activities", async ({ openApp }) => {
  const at = Date.now() - 864e5, id = "s_" + at;
  const seed = [{ path: `data/users/test-user/${id}`, data: { id, kind: "session", at, dur: 720, type: "breath", breath: "calm", mood: 4, note: "private note", updatedAt: at } }];
  const { ingested, errors } = await openApp("stillwater", { seed, waitFor: 0 });
  await expect.poll(() => ingested.filter(x => x.slug === "habit-tracker").length, { timeout: 15000 }).toBe(1);
  const b = JSON.parse(ingested[0].body);
  expect(b.source.app).toBe("stillwater");
  expect(b.events).toEqual([expect.objectContaining({ op: "upsert", id, kind: "meditation", minutes: 12, title: "Breathwork" })]);
  // Journal notes and moods stay in Stillwater.
  expect(ingested[0].body).not.toContain("private note");
  expect(ingested[0].body).not.toContain("mood");
  expect(errors).toEqual([]);
});

test("Stillwater sends no deletes while only the first 1000 documents could be read", async ({ openApp }) => {
  const now = Date.now();
  const seed = sits(1005, now).concat([{ path: "data/users/test-user/bridge/habit-tracker/state", data: { sent: { s_gone: "x" }, full: now, at: now } }]);
  const { ingested } = await openApp("stillwater", { seed, waitFor: 0, fail: [{ op: "get", path: "^data/users/test-user$" }] });
  await expect.poll(() => ingested.filter(x => x.slug === "habit-tracker").length, { timeout: 15000 }).toBeGreaterThan(0);
  await new Promise(r => setTimeout(r, 1500));
  const events = ingested.filter(x => x.slug === "habit-tracker").flatMap(x => JSON.parse(x.body).events);
  expect(events.filter(e => e.op === "delete")).toEqual([]);
});

test("Stillwater reads the whole journal past 1000 documents on a new device", async ({ openApp }) => {
  const now = Date.now();
  const seed = sits(1205, now).concat([{ path: "data/users/test-user/bridge/habit-tracker/state", data: { sent: { s_gone: "x" }, full: now, at: now } }]);
  const { ingested } = await openApp("stillwater", { seed, waitFor: 0 });
  const events = () => ingested.filter(x => x.slug === "habit-tracker").flatMap(x => JSON.parse(x.body).events);
  await expect.poll(() => new Set(events().filter(e => e.op === "upsert").map(e => e.id)).size, { timeout: 30000 }).toBe(1205);
  await expect.poll(() => events().filter(e => e.op === "delete").map(e => e.id), { timeout: 15000 }).toEqual(["s_gone"]);
});

test("Stillwater picks up a sit from another device when the journal is past 1000 documents", async ({ openApp }) => {
  const now = Date.now();
  const { ingested, page } = await openApp("stillwater", { seed: sits(1205, now), waitFor: 0 });
  const events = () => ingested.filter(x => x.slug === "habit-tracker").flatMap(x => JSON.parse(x.body).events);
  await expect.poll(() => new Set(events().map(e => e.id)).size, { timeout: 30000 }).toBe(1205);
  // Another device stores a new sit; its id sorts after the first 1000.
  const at = Date.now(), id = "s_" + at;
  await page.evaluate(async ([id, at]) => { const db = await lager.use("db"); await db.doc("data/users/test-user/" + id).set({ id, kind: "session", at, dur: 900, type: "mind", breath: "off", updatedAt: at }); }, [id, at]);
  await expect.poll(() => events().some(e => e.op === "upsert" && e.id === id), { timeout: 15000 }).toBe(true);
});

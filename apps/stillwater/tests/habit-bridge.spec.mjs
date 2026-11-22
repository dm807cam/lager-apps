import { test, expect } from "../../../tests/fixtures.mjs";

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

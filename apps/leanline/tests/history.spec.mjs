import { test, expect } from "../../../tests/fixtures.mjs";

test("loads every measurement, also beyond one query's 1000 results", async ({ openApp }) => {
  const now = Date.now();
  const seed = [{ path: "settings/profile", data: { sex: "m", height: 180, unit: "kg", goal: null } }]
    .concat(Array.from({ length: 1100 }, (_, i) => { const t = now - i * 6 * 3600e3, key = t + "-x" + i; return { path: "measurements/" + key, data: { key, t, w: 80 + (i % 7) / 10, f: null, savedAt: t } }; }));
  const { page, errors } = await openApp("leanline", { seed, waitFor: 1500 });
  await expect(page.locator("#history h2 small")).toHaveText("1100 measurements");
  expect(errors).toEqual([]);
});

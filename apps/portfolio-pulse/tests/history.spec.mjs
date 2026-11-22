import { test, expect } from "../../../tests/fixtures.mjs";

const iso = t => new Date(t).toISOString().slice(0, 10);

test("loads every value, also beyond one query's 1000 results", async ({ openApp }) => {
  const today = Date.UTC(2026, 10, 1);
  const seed = Array.from({ length: 1100 }, (_, i) => { const date = iso(today - i * 864e5); return { path: "entries/" + date, data: { date, value: 10000 + i, savedAt: 1 } }; });
  const { page, errors } = await openApp("portfolio-pulse", { seed, waitFor: 1500 });
  await expect(page.locator("#history h2 small")).toHaveText("1100 values");
  expect(errors).toEqual([]);
});

test("the date field allows today after the page stayed open past midnight", async ({ openApp }) => {
  const { page } = await openApp("portfolio-pulse", { seed: [] });
  await page.evaluate(() => { document.getElementById("date").max = "2000-01-01"; });
  await page.locator("#fab").click();
  const { value, max } = await page.locator("#date").evaluate(e => ({ value: e.value, max: e.max }));
  expect(max).toBe(value);
});

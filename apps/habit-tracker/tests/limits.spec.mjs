import { test, expect } from "../../../tests/fixtures.mjs";

// A Lager query returns at most 1000 documents (the mock does the same).
const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const habit = (id, name) => ({ path: `habits/${id}`, data: { id, name, icon: "", color: "#2f6fbf", freq: { t: "daily" }, link: null, createdAt: Date.now() - 500 * 864e5, order: 1, archived: false } });
const checks = (id, days) => Array.from({ length: days }, (_, i) => ({ path: `checks/${id}~${day(-i)}`, data: { habit: id, date: day(-i), at: 1 } }));

test.describe("Habits with a long history", () => {
  test("counts every check, also beyond one query's 1000 results", async ({ openApp }) => {
    const seed = ["h_a", "h_b", "h_c"].flatMap((id, i) => [habit(id, "Habit " + i), ...checks(id, 380)]);
    const { page, errors } = await openApp("habit-tracker", { seed, waitFor: 1500 });
    await expect(page.locator(".habit .flame")).toHaveCount(3);
    for (const t of await page.locator(".habit .flame").allTextContents()) expect(t).toContain("380 days in a row");
    expect(errors).toEqual([]);
  });

  test("deleting a habit removes all of its checks", async ({ openApp }) => {
    const { page } = await openApp("habit-tracker", { seed: [habit("h_a", "Read"), ...checks("h_a", 390)], waitFor: 1000 });
    await page.locator('[data-open="h_a"]').first().click();
    await page.locator('#sheet [data-act="edit"]').click();
    await page.locator('#sheet [data-act="del"]').click();
    await page.locator('#sheet [data-act="del"]').click();
    await expect.poll(() => page.evaluate(() => [...window.__lager.store.keys()].filter(k => k.startsWith("checks/") || k.startsWith("habits/")).length)).toBe(0);
  });
});

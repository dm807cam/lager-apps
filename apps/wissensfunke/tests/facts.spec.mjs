import { test, expect, seedOf } from "../../../tests/fixtures.mjs";

test("shows a fact of the day from the seed data", async ({ openApp }) => {
  const { page } = await openApp("wissensfunke");
  const titles = seedOf("wissensfunke").map(d => d.data.title);
  const shown = await page.locator(".fact-title").innerText();
  expect(titles).toContain(shown);
});

test("the seed is complete and well formed", () => {
  const facts = seedOf("wissensfunke");
  expect(facts.length).toBeGreaterThanOrEqual(100);
  const ns = facts.map(f => f.data.n);
  expect(new Set(ns).size).toBe(ns.length);
  for (const f of facts) {
    expect(f.path).toMatch(/^facts\/f\d{3}$/);
    expect(f.data).toEqual({ n: expect.any(Number), cat: expect.any(String), title: expect.any(String), text: expect.any(String) });
  }
});

test("starring a fact stores it in the viewer's private area", async ({ openApp }) => {
  const { page } = await openApp("wissensfunke");
  await page.locator(".glass [data-fav]").click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__lager.dump()).filter(k => k.startsWith("data/users/test-user/favs/items/")).length)).toBe(1);
});

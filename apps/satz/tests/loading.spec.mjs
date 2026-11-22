import { test, expect } from "../../../tests/fixtures.mjs";

const BASE = "data/users/test-user/satz";
const library = text => [
  { path: `${BASE}/books/b1`, data: { title: "Roman", goal: 0, order: 1000, createdAt: 1 } },
  { path: `${BASE}/chapters/c1`, data: { bookId: "b1", title: "Eins", auto: "", order: 1000, words: 2, chars: text.length, caret: 0, createdAt: 1, updatedAt: 1 } },
  { path: `${BASE}/texts/c1`, data: { text, updatedAt: 1, client: "other-device" } }
];
const writesTo = (page, part) => page.evaluate(p => window.__lager.writes.filter(w => w.path.includes(p)), part);

test.describe("Satz on a bad connection", () => {
  test("opens the stored chapter", async ({ openApp }) => {
    const { page, errors } = await openApp("satz", { seed: library("Mein Text"), waitFor: 1500 });
    await expect(page.locator("#ta")).toHaveValue("Mein Text");
    expect(errors).toEqual([]);
  });

  test("a chapter that fails to load stays read-only, then opens when its text arrives", async ({ openApp }) => {
    const { page } = await openApp("satz", {
      seed: library("Mein Text"), waitFor: 1500,
      fail: [{ op: "get", path: "/texts/" }, { op: "snapshot", path: "/texts/" }]
    });
    const ta = page.locator("#ta");
    await expect(ta).toHaveJSProperty("readOnly", true);
    await ta.focus();
    await page.keyboard.type("Neu");
    await page.waitForTimeout(1500);
    expect(await writesTo(page, "/texts/")).toEqual([]);
    await page.evaluate(() => { window.__lager.fail = []; return window.__lager.flush(); });
    await expect(ta).toHaveValue("Mein Text");
    await expect(ta).toHaveJSProperty("readOnly", false);
  });

  test("does not start a new book when the library can't be loaded", async ({ openApp }) => {
    test.setTimeout(30000);
    const { page } = await openApp("satz", {
      seed: library("Mein Text"), waitFor: 0,
      fail: [{ op: "get", path: "/books" }, { op: "snapshot", path: "/books" }]
    });
    await expect(page.locator("#fatal")).toBeVisible({ timeout: 15000 });
    expect(await writesTo(page, "/books/")).toEqual([]);
    expect(await writesTo(page, "/chapters/")).toEqual([]);
  });
});

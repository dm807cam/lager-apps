import { test, expect } from "../../../tests/fixtures.mjs";

// 1500 visitors on one page: 1200 thumbs up, 300 down; 200 of them changed their mind from down to up.
// That is 1700 vote events, more than one query returns.
function votes(site, page) {
  const out = [], t0 = Date.now() - 864e5;
  for (let i = 0; i < 1500; i++) {
    const visitor = "v" + String(i).padStart(4, "0");
    if (i < 200) out.push({ path: `votes/a${i}`, data: { site, page, target: "page", visitor, value: -1, ts: t0 + i } });
    out.push({ path: `votes/b${i}`, data: { site, page, target: "page", visitor, value: i < 1200 ? 1 : -1, ts: t0 + 10000 + i } });
  }
  return out;
}
const comments = (site, page, n) => Array.from({ length: n }, (_, i) => ({ path: `approved/c${String(i).padStart(5, "0")}`, data: { site, page, url: "", parentId: null, name: "Gast " + i, text: "Kommentar " + i, createdAt: Date.now() - 864e5 + i * 1000 } }));
const settings = { path: "settings/main", data: { moderation: true, instantSince: 0 } };

test("the widget counts every vote on a page past 1000 vote events", async ({ openApp }) => {
  const { page, errors } = await openApp("kommentare", { seed: [settings, ...votes("blog.example.com", "/post")], path: "/?site=blog.example.com&page=/post", waitFor: 0 });
  await expect(page.locator(".vbtn.up span").last()).toHaveText("1200", { timeout: 15000 });
  await expect(page.locator(".vbtn.down span").last()).toHaveText("300");
  expect(errors).toEqual([]);
});

test("a new vote past 1000 vote events shows up live", async ({ openApp }) => {
  const { page } = await openApp("kommentare", { seed: [settings, ...votes("blog.example.com", "/post")], path: "/?site=blog.example.com&page=/post", waitFor: 0 });
  await expect(page.locator(".vbtn.up span").last()).toHaveText("1200", { timeout: 15000 });
  await page.locator(".vbtn.up").click();
  await expect(page.locator(".vbtn.up span").last()).toHaveText("1201");
  await page.waitForTimeout(1500);   // after the stored vote comes back through the listeners
  await expect(page.locator(".vbtn.up span").last()).toHaveText("1201");
});

test("the admin view counts every comment and vote past 1000", async ({ openApp }) => {
  const seed = [settings, ...votes("blog.example.com", "/post"), ...comments("blog.example.com", "/post", 1100)];
  const { page, errors } = await openApp("kommentare", { seed, path: "/?admin", waitFor: 0 });
  await page.getByRole("tab", { name: /Seiten/ }).click();
  const row = page.locator("tbody tr").first();
  await expect(row).toContainText("1100", { timeout: 15000 });
  await expect(row).toContainText("1200");
  await expect(row).toContainText("300");
  expect(errors).toEqual([]);
});

test("the widget shows every comment on a page past 1000", async ({ openApp }) => {
  const { page } = await openApp("kommentare", { seed: [settings, ...comments("blog.example.com", "/post", 1100)], path: "/?site=blog.example.com&page=/post", waitFor: 0 });
  await expect(page.locator("body")).toContainText("Kommentar 1099", { timeout: 15000 });
  await expect(page.locator("body")).toContainText("Kommentar 0");
});

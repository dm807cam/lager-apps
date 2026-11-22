import { test, expect } from "../../../tests/fixtures.mjs";

// Three day files a day for a year: more than one query returns.
function chunks(site) {
  const out = [], now = Date.now();
  for (let i = 0; i < 360; i++) {
    const ts = now - i * 864e5 - 3600e3, day = new Date(ts).toISOString().slice(0, 10);
    for (let n = 0; n < 3; n++) out.push({ path: `chunks/${site}~${day}~${n}`, data: { site, day, n, count: 1, bytes: 120, updatedAt: ts, events: [{ t: "pv", pid: `p${i}-${n}`, ts: ts + n, p: "/post", v: `v${i}-${n}` }] } });
  }
  return out;
}
const SITE = { path: "sites/blog", data: { name: "Blog", domain: "blog.example.com", origins: [], extra: [], tz: "UTC", createdAt: Date.now() - 400 * 864e5 } };

test("Byline reads every day file of a long range past 1000", async ({ openApp }) => {
  const seed = [SITE, ...chunks("blog")];
  const { page, errors } = await openApp("byline", { seed, path: "/#site=blog&range=12m", waitFor: 0 });
  const read = () => page.evaluate(() => new Set(window.__lager.reads.filter(r => r.path === "chunks").flatMap(r => r.ids)).size);
  await expect.poll(read, { timeout: 20000 }).toBe(1080);
  expect(errors).toEqual([]);
});

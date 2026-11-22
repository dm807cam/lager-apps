// Level 1: every app in apps/ gets these checks automatically, with no code of its own.
import { test, expect, appSlugs, manifest, DOMAIN } from "./fixtures.mjs";

const ALWAYS_OK = new Set([DOMAIN]);
const hostOf = u => { try { return new URL(u).hostname; } catch { return ""; } };

for (const slug of appSlugs()) {
  test.describe(slug, () => {
    for (const scheme of ["light", "dark"]) {
      test(`loads without errors (${scheme})`, async ({ openApp, page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        const { errors } = await openApp(slug, { waitFor: 1500 });
        expect(errors, "uncaught errors in the page").toEqual([]);
        const text = (await page.locator("body").innerText()).trim();
        expect(text.length, "the app shows some content").toBeGreaterThan(10);
      });
    }

    test("fits a phone screen", async ({ openApp, page }) => {
      await page.setViewportSize({ width: 375, height: 760 });
      await openApp(slug, { waitFor: 1200 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "no horizontal scrolling at 375 px").toBeLessThanOrEqual(1);
    });

    test("only contacts the hosts it declares", async ({ openApp }) => {
      const { requests } = await openApp(slug, { waitFor: 1500 });
      const allowed = new Set([...(manifest(slug).externalHosts || []), "fonts.gstatic.com"]);
      const foreign = [...new Set(requests.map(hostOf))].filter(h => h && !h.endsWith("." + DOMAIN) && !ALWAYS_OK.has(h) && !allowed.has(h));
      expect(foreign, "undeclared external hosts (add them to externalHosts in lager.json)").toEqual([]);
    });
  });
}

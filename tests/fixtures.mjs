// Shared Playwright fixtures: open any app of this repo on a fake Lager host with the mock runtime.
import { test as base, expect } from "@playwright/test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DOMAIN = "lager.test";
const MOCK = readFileSync(join(ROOT, "tools/lager-mock.js"), "utf8");

export const appSlugs = () => readdirSync(join(ROOT, "apps"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
export function manifest(slug) { return JSON.parse(readFileSync(join(ROOT, "apps", slug, "lager.json"), "utf8")); }
export function seedOf(slug) {
  const m = manifest(slug);
  return (m.seed || []).flatMap(f => JSON.parse(readFileSync(join(ROOT, "apps", slug, f), "utf8")));
}
export const appUrl = (slug, path = "/") => `https://${slug}.${DOMAIN}${path}`;

/**
 * openApp(slug, options) loads apps/<slug>/index.html at https://<slug>.lager.test/ with the mock runtime.
 * options: seed (docs, default: the app's seed files), user, completeReply, path, ingest (handler for
 * POSTs to any *.lager.test/_ingest/*), waitFor (ms to let the app settle, default 800).
 * Returns { page, errors, requests, ingested }.
 */
export const test = base.extend({
  openApp: async ({ page, context }, use) => {
    const errors = [], requests = [], ingested = [];
    page.on("pageerror", e => errors.push(String(e && e.stack || e)));
    page.on("request", r => requests.push(r.url()));
    await context.route(`https://*.${DOMAIN}/**`, async route => {
      const url = new URL(route.request().url());
      const slug = url.hostname.split(".")[0];
      if (url.pathname.startsWith("/_ingest/")) {
        ingested.push({ slug, endpoint: url.pathname.slice("/_ingest/".length), origin: route.request().headers().origin || null, body: route.request().postData() });
        return route.fulfill({ status: 202, headers: { "access-control-allow-origin": route.request().headers().origin || "*" }, body: "" });
      }
      const file = join(ROOT, "apps", slug, "index.html");
      if ((url.pathname === "/" || url.pathname === "/index.html") && existsSync(file)) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: readFileSync(file) });
      return route.fulfill({ status: 404, body: "not found" });
    });
    const open = async (slug, opts = {}) => {
      const m = manifest(slug);
      const config = { seed: opts.seed ?? seedOf(slug), user: opts.user, completeReply: opts.completeReply ?? null, capabilities: m.capabilities };
      await page.addInitScript(`window.__LAGER_CONFIG__=${JSON.stringify(config)};\n${MOCK}`);
      await page.goto(appUrl(slug, opts.path || "/"));
      await page.waitForTimeout(opts.waitFor ?? 800);
      return { page, errors, requests, ingested };
    };
    await use(open);
  }
});
export { expect };

// Shared setup for the Folio tests: JSZip from node_modules instead of the CDN, and a quick way to add a book.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const JSZIP = readFileSync(require.resolve("jszip/dist/jszip.min.js"), "utf8");

export async function offline(page) {
  await page.route("https://cdn.jsdelivr.net/**", r => r.fulfill({ status: 200, contentType: "application/javascript", body: JSZIP }));
  await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
}
export async function addBook(page, name, buffer, mimeType = "application/epub+zip") {
  await page.locator("#file").setInputFiles({ name, mimeType, buffer });
}
export const store = (page, prefix) => page.evaluate(p => Object.entries(window.__lager.dump ? window.__lager.dump() : {}).filter(([k]) => k.startsWith(p)), prefix);
/* Playwright's boundingBox is unreliable inside transformed CSS columns; click where the page itself says the element is */
export async function tap(page, selector) {
  const r = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const x = e.getClientRects()[0] || e.getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; }, selector);
  if (!r) throw new Error("not found: " + selector);
  await page.mouse.click(r.x, r.y);
}
export const docs = (page, re) => page.evaluate(src => Object.entries(window.__lager.dump()).filter(([k]) => new RegExp(src).test(k)).map(([path, data]) => ({ path, data })), re.source);
export async function importBook(page, name, buffer, mimeType) {
  const before = await page.locator("[data-book]").count();
  await addBook(page, name, buffer, mimeType);
  await page.waitForFunction(n => document.querySelectorAll("[data-book]").length > n, before, { timeout: 15000 });
  return page.locator("[data-book]").evaluateAll(es => es.map(e => e.dataset.book));
}
export async function openBook(page, id) {
  await page.evaluate(id => { location.hash = "#book/" + id; }, id);
  await page.waitForFunction(() => document.getElementById("colm").childNodes.length > 0 && document.getElementById("ft-r").textContent !== "");
}
/* what the reader shows: chapter heading line and the percentage */
export const where = page => page.evaluate(() => ({ chapter: document.getElementById("rd-hdt").textContent, pct: parseInt(document.getElementById("ft-r").textContent, 10) }));
export const bookDoc = async page => (await docs(page, /lib\/books\/[^/]+$/))[0].data;

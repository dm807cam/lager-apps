import { test, expect } from "../../../tests/fixtures.mjs";
import { makeEpub } from "./make-book.mjs";
import { offline, importBook, openBook, where, docs, bookDoc, tap } from "./helpers.mjs";

test.beforeEach(async ({ page }) => { await offline(page); });
const select = (page, para, from, to) => page.evaluate(([para, from, to]) => {
  const p = document.querySelectorAll("#colm p")[para], t = p.firstChild, r = document.createRange();
  r.setStart(t, from); r.setEnd(t, to); getSelection().removeAllRanges(); getSelection().addRange(r);
}, [para, from, to]);

test("Folio turns pages and remembers the place across visits", async ({ openApp, page }) => {
  const { errors } = await openApp("folio", { seed: [] });
  const [id] = await importBook(page, "lantern.epub", await makeEpub());
  await openBook(page, id);
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await bookDoc(page)).progress?.ch, { timeout: 5000 }).toBe(1);
  const here = await where(page);
  expect(here.chapter).toBe("Chapter 1");
  const saved = (await bookDoc(page)).progress;
  expect(saved.off).toBeGreaterThan(500);
  await page.keyboard.press("Escape");
  await expect(page.locator("#rd")).toBeHidden();
  await expect(page.locator(".hero h2")).toHaveText("The Lantern Orchard");
  await page.locator(".hero [data-open]").click();
  await page.waitForFunction(() => document.getElementById("ft-r").textContent !== "");
  expect(await where(page)).toEqual(here);
  expect(errors).toEqual([]);
});

test("a larger font keeps you on the same passage", async ({ openApp, page }) => {
  await openApp("folio", { seed: [] });
  const [id] = await importBook(page, "lantern.epub", await makeEpub());
  await openBook(page, id);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150); }
  await page.waitForTimeout(400);
  const first = () => page.evaluate(() => { const c = document.getElementById("colm"), fr = document.getElementById("flow").getBoundingClientRect();
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let n; const r = document.createRange();
    while ((n = w.nextNode())) for (let i = 0; i < n.nodeValue.length; i++) { if (!/\S/.test(n.nodeValue[i])) continue; r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getClientRects()[0]; if (b && b.left >= fr.left - 1 && b.left < fr.right) return n.nodeValue.slice(i, i + 30); }
    return ""; });
  const before = await first();
  await page.mouse.click(200, 400);
  await page.locator("#rb-aa").click();
  for (let i = 0; i < 4; i++) await page.locator('[data-step="size"][data-d="1"]').click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  // the passage that started the page is still on screen
  const text = await page.evaluate(() => { const c = document.getElementById("colm"), fr = document.getElementById("flow").getBoundingClientRect(); let s = "";
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let n; const r = document.createRange();
    while ((n = w.nextNode())) { r.selectNodeContents(n); for (const b of r.getClientRects()) if (b.left >= fr.left - 1 && b.left < fr.right) { s += n.nodeValue; break; } } return s; });
  expect(text.replace(/\s+/g, " ")).toContain(before.replace(/\s+/g, " ").slice(0, 20));
  await expect.poll(async () => (await docs(page, /settings$/))[0]?.data.size).toBe(23);
});

test("highlights and notes are stored and come back", async ({ openApp, page }) => {
  await openApp("folio", { seed: [] });
  const [id] = await importBook(page, "lantern.epub", await makeEpub());
  await openBook(page, id);
  await page.keyboard.press("ArrowRight");
  await select(page, 1, 0, 30);
  await expect(page.locator("#seltool")).toBeVisible();
  await page.locator('#seltool [data-sel="note"]').click();
  await page.locator("#note-t").fill("Remember this river.");
  await page.locator('[data-note="save"]').click();
  await expect.poll(async () => (await docs(page, /lib\/marks\//)).length).toBe(1);
  const m = (await docs(page, /lib\/marks\//))[0].data;
  expect(m).toMatchObject({ kind: "hl", bookId: id, ch: 1, note: "Remember this river.", color: "y", chapter: "Chapter 1" });
  expect(m.end - m.start).toBe(m.text.length);
  await expect(page.locator("#colm mark.hl")).toHaveCount(1);
  expect(await page.locator("#colm mark.hl").innerText()).toBe(m.text);
  // change its colour by tapping it
  await tap(page, "#colm mark.hl");
  await page.locator('#seltool [data-col="b"]').click();
  await expect.poll(async () => (await docs(page, /lib\/marks\//))[0].data.color).toBe("b");
  await page.keyboard.press("Escape");
  await page.locator("#tab-notes").click();
  await expect(page.locator("#notes")).toContainText("Remember this river.");
  await expect(page.locator("#notes")).toContainText(m.text);
});

test("footnotes open in place and bookmarks mark the page", async ({ openApp, page }) => {
  await openApp("folio", { seed: [] });
  const [id] = await importBook(page, "lantern.epub", await makeEpub());
  await openBook(page, id);
  await page.keyboard.press("ArrowRight");
  while (!(await page.evaluate(() => { const a = document.querySelector("#colm a.nr"), f = document.getElementById("flow").getBoundingClientRect(); const r = a.getClientRects()[0]; return r.left >= f.left && r.left < f.right; }))) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400); }
  const before = await where(page);
  await tap(page, "#colm a.nr");
  await expect(page.locator("#rd-over .pop")).toContainText("planted in an invented year");
  expect(await where(page)).toEqual(before);
  await page.keyboard.press("Escape");
  await page.keyboard.press("b");
  await expect(page.locator("#ribbon")).toHaveClass(/(^|\s)on(\s|$)/);
  await expect.poll(async () => (await docs(page, /lib\/marks\//)).map(d => d.data.kind)).toEqual(["bm"]);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#ribbon")).not.toHaveClass(/(^|\s)on(\s|$)/);
});

test("turning past the last page finishes the book", async ({ openApp, page }) => {
  await openApp("folio", { seed: [] });
  const [id] = await importBook(page, "lantern.epub", await makeEpub({ chapters: 1, perChapter: 4 }));
  await openBook(page, id);
  for (let i = 0; i < 40 && !(await page.locator("#endcard").count()); i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator("#endcard")).toContainText("The Lantern Orchard");
  await expect.poll(async () => (await bookDoc(page)).finishedAt).toBeGreaterThan(0);
  await page.locator('[data-end="lib"]').click();
  await expect(page.locator(".badge.done")).toHaveText("Finished");
});

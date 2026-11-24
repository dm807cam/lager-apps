import { test, expect } from "../../../tests/fixtures.mjs";
import { makeEpub, paragraphs } from "./make-book.mjs";
import { offline, addBook, importBook, docs, bookDoc } from "./helpers.mjs";

test.beforeEach(async ({ page }) => { await offline(page); });

test("Folio imports an EPUB with its contents, cover and chapter text", async ({ openApp, page }) => {
  const { errors } = await openApp("folio", { seed: [] });
  await importBook(page, "lantern.epub", await makeEpub());
  await expect(page.locator(".bk .t")).toHaveText("The Lantern Orchard");
  const b = await bookDoc(page);
  expect(b).toMatchObject({ title: "The Lantern Orchard", author: "Mira Testwood", lang: "en", ready: true, progress: null, desc: "An invented book for tests." });
  expect(b.cover).toMatch(/^\/_blob\//);
  expect(b.chapters.map(c => c.t || "")).toEqual(["", "Chapter 1", "Chapter 2", "Chapter 3", "Notes"]);
  // a contents entry pointing into the middle of a chapter keeps its offset
  const part = b.toc.find(e => e.t === "A second part");
  expect(part.ch).toBe(1);
  expect(part.o).toBeGreaterThan(5000);
  const ch1 = (await docs(page, new RegExp("lib/books/" + b.id + "/ch/1_\\d+$"))).map(d => d.data.h).join("");
  expect(ch1).toContain('data-s="i"');                 // .emph { font-style: italic } survives as a flag
  expect(ch1).toContain('data-h="4|n1"');               // the footnote link points at the notes chapter
  expect(ch1).not.toContain("Text no reader should see"); // display:none in the book's CSS
  expect(ch1).not.toMatch(/<script|onerror|class="emph"/);
  expect(errors).toEqual([]);
});

test("Folio reads the contents of an EPUB 2 book from its NCX", async ({ openApp, page }) => {
  await openApp("folio", { seed: [] });
  await importBook(page, "old.epub", await makeEpub({ title: "An Older Orchard", epub2: true }));
  const b = await bookDoc(page);
  expect(b.toc.map(e => [e.t, e.ch, e.d])).toEqual([["Chapter 1", 1, 0], ["A second part", 1, 1], ["Chapter 2", 2, 0], ["Chapter 3", 3, 0]]);
  expect(b.toc[1].o).toBeGreaterThan(5000);
});

test("Folio refuses DRM-protected books and duplicates", async ({ openApp, page }) => {
  await openApp("folio", { seed: [] });
  await addBook(page, "locked.epub", await makeEpub({ title: "Locked", drm: true }));
  await expect(page.locator("#toast")).toContainText("DRM");
  await importBook(page, "lantern.epub", await makeEpub());
  await addBook(page, "again.epub", await makeEpub());
  await expect(page.locator("#toast")).toContainText("already in your library");
  await expect(page.locator("[data-book]")).toHaveCount(1);
});

test("Folio splits a Project Gutenberg text file into chapters and drops the licence", async ({ openApp, page }) => {
  await openApp("folio", { seed: [] });
  const txt = "Title: A Tale of Small Rivers\nAuthor: Ola Inventa\n\n*** START OF THE PROJECT GUTENBERG EBOOK SMALL RIVERS ***\n\nCHAPTER I\n\n" + paragraphs(20, 1).join("\n\n") + "\n\nCHAPTER II\n\n" + paragraphs(20, 300).join("\n\n") + "\n\n*** END OF THE PROJECT GUTENBERG EBOOK ***\nThe licence text.";
  await importBook(page, "rivers.txt", Buffer.from(txt), "text/plain");
  const b = await bookDoc(page);
  expect(b).toMatchObject({ title: "A Tale of Small Rivers", author: "Ola Inventa", kind: "txt" });
  expect(b.toc.map(e => e.t)).toEqual(["CHAPTER I", "CHAPTER II"]);
  const text = (await docs(page, /\/ch\//)).map(d => d.data.h).join("");
  expect(text).not.toContain("licence");
  expect(text).not.toContain("Title:");
});

test("removing a book deletes its text, pictures and highlights", async ({ openApp, page }) => {
  await openApp("folio", { seed: [] });
  const [id] = await importBook(page, "lantern.epub", await makeEpub());
  await page.evaluate(async id => { const db = await lager.use("db"); await db.doc("data/users/test-user/lib/marks/m1").set({ id: "m1", kind: "hl", bookId: id, ch: 1, start: 0, end: 10, text: "x", color: "y", updatedAt: Date.now() }); }, id);
  await page.locator(`[data-book="${id}"]`).click();
  await page.locator("[data-bact=delete]").click();
  await page.locator("[data-bact=delete-yes]").click();
  await expect(page.locator("[data-book]")).toHaveCount(0);
  await expect.poll(async () => (await docs(page, /lib\/(books|marks)\//)).length).toBe(0);
});

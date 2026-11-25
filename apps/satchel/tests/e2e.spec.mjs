import { readFileSync } from "node:fs";
import { test, expect } from "../../../tests/fixtures.mjs";

const OWNER = { id: "u-ada", name: "Ada", owner: true, canEdit: true };
const GUEST = { id: null, name: null, owner: false, canEdit: false };

// Invented test content; deterministic bytes for the multi-chunk file.
function bytes(n, seed = 7) { const b = Buffer.alloc(n); let x = seed; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; b[i] = x >>> 24; } return b; }

async function upload(page, name, buffer, mimeType = "application/octet-stream") {
  await page.setInputFiles("#pick-files", { name, mimeType, buffer });
  await expect(page.locator(".item .name .t", { hasText: name }).first()).toBeVisible({ timeout: 20000 });
}
const store = page => page.evaluate(() => Object.entries(window.__lager.dump()).map(([path, data]) => ({ path, data })));
async function downloadVia(page, name) {
  await page.getByRole("button", { name: "Actions for " + name }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Download", exact: true }).click()]);
  return readFileSync(await dl.path());
}
async function createLink(page, name, { password } = {}) {
  await page.getByRole("button", { name: "Actions for " + name }).click();
  await page.getByRole("menuitem", { name: "Share link" }).click();
  if (password) await page.getByPlaceholder("No password").fill(password);
  await page.getByRole("button", { name: "Create link" }).click();
  const url = await page.getByRole("textbox", { name: "Share link" }).inputValue();
  await page.getByRole("button", { name: "Done" }).click();
  return url;
}
async function openAsGuest(openApp, page, seed, url) {
  await page.goto("about:blank");   // a hash-only navigation would not reload the page as the guest
  const r = await openApp("satchel", { seed, user: GUEST, path: "/" + new URL(url).hash });
  expect(await page.evaluate(() => window.__LAGER_CONFIG__.user.id)).toBeNull();
  return r;
}

test("satchel stores only ciphertext and returns the exact file", async ({ openApp }) => {
  const { page, errors } = await openApp("satchel", { seed: [], user: OWNER });
  const secret = "Invented launch plan: marker-73915 for the test";
  await upload(page, "plan.txt", Buffer.from(secret), "text/plain");

  const docs = await store(page);
  const meta = docs.find(d => d.path.startsWith("data/users/u-ada/drive/files/"));
  expect(meta.data).toMatchObject({ name: "plan.txt", size: secret.length, blob: { o: "u-ada" } });
  const chunks = docs.filter(d => /^blobs\/u-ada\/files\/[^/]+\/c\/\d+$/.test(d.path));
  expect(chunks).toHaveLength(1);
  const everythingShared = JSON.stringify(docs.filter(d => !d.path.startsWith("data/users/")));
  expect(everythingShared).not.toContain("marker-73915");
  expect(everythingShared).not.toContain(Buffer.from(secret).toString("base64").slice(0, 20));
  expect(everythingShared).not.toContain("plan.txt");

  await page.getByRole("button", { name: "Preview plan.txt" }).click();
  await expect(page.locator("dialog.pv pre")).toContainText("marker-73915");
  await page.getByRole("button", { name: "Close preview" }).click();

  expect((await downloadVia(page, "plan.txt")).toString()).toBe(secret);
  expect(errors).toEqual([]);
});

test("satchel round-trips a file that spans several chunks", async ({ openApp }) => {
  const { page, errors } = await openApp("satchel", { seed: [], user: OWNER });
  const data = bytes(450 * 1024);
  await upload(page, "scan.bin", data);
  const chunks = (await store(page)).filter(d => /\/c\/\d+$/.test(d.path));
  expect(chunks).toHaveLength(3);
  expect(chunks.every(c => JSON.stringify(c.data).length < 256 * 1024)).toBe(true);
  expect(Buffer.compare(await downloadVia(page, "scan.bin"), data)).toBe(0);
  expect(errors).toEqual([]);
});

test("satchel shows file names as text, never as HTML", async ({ openApp }) => {
  const { page, errors } = await openApp("satchel", { seed: [], user: OWNER });
  const evil = '<img src=x onerror="window.__pwned=1">.txt';
  await upload(page, evil, Buffer.from("hi"), "text/plain");
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await page.locator(".item .name img").count()).toBe(0);
  expect(errors).toEqual([]);
});

test("satchel creates folders, uploads into them and moves files", async ({ openApp }) => {
  const { page, errors } = await openApp("satchel", { seed: [], user: OWNER });
  await page.getByRole("button", { name: "New folder" }).first().click();
  await page.getByRole("textbox", { name: "Name" }).fill("Projects");
  await page.getByRole("button", { name: "Create folder" }).click();
  await upload(page, "notes.md", Buffer.from("# Notes"), "text/markdown");
  await page.getByRole("button", { name: "Actions for notes.md" }).click();
  await page.getByRole("menuitem", { name: "Move", exact: true }).click();
  await page.locator("dialog .tree").getByRole("button", { name: "Projects" }).click();
  await page.getByRole("button", { name: "Move here" }).click();
  await expect(page.getByRole("button", { name: "Preview notes.md" })).toHaveCount(0);

  const docs = await store(page);
  const folder = docs.find(d => d.path.startsWith("data/users/u-ada/drive/folders/"));
  const file = docs.find(d => d.path.startsWith("data/users/u-ada/drive/files/"));
  expect(folder.data.name).toBe("Projects");
  expect(file.data.folder).toBe(folder.path.split("/").pop());

  await page.getByRole("button", { name: "Open folder Projects" }).click();
  await expect(page.getByRole("button", { name: "Preview notes.md" })).toBeVisible();
  await upload(page, "notes.md", Buffer.from("second"), "text/markdown");
  await expect(page.getByRole("button", { name: "Preview notes (2).md" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("satchel moves a file to Team and back", async ({ openApp }) => {
  const { page, errors } = await openApp("satchel", { seed: [], user: OWNER });
  await upload(page, "budget.csv", Buffer.from("item,cost\npaper,3"), "text/csv");
  await page.getByRole("button", { name: "Actions for budget.csv" }).click();
  await page.getByRole("menuitem", { name: "Move to Team" }).click();
  await expect.poll(async () => (await store(page)).filter(d => d.path.startsWith("team/space/files/")).length).toBe(1);
  expect((await store(page)).filter(d => d.path.startsWith("data/users/u-ada/drive/files/"))).toHaveLength(0);
  await page.getByRole("button", { name: "Team" }).first().click();
  await page.getByRole("button", { name: "Preview budget.csv" }).click();
  await expect(page.locator("dialog.pv table")).toContainText("paper");
  expect(errors).toEqual([]);
});

test("satchel share link opens for a guest and counts the visit", async ({ openApp, page }) => {
  await openApp("satchel", { seed: [], user: OWNER });
  const content = "Invented itinerary for the guest test";
  await upload(page, "trip.txt", Buffer.from(content), "text/plain");
  const url = await createLink(page, "trip.txt");
  expect(url).toMatch(/#l=[0-9a-f]+&o=u-ada&k=[A-Za-z0-9_-]{43}$/);
  const seed = await store(page);
  const linkDoc = seed.find(d => d.path.startsWith("links/u-ada/l/"));
  expect(JSON.stringify(linkDoc.data)).not.toContain("trip.txt");

  const { errors } = await openAsGuest(openApp, page, seed, url);
  await expect(page.getByText("From Ada")).toBeVisible();
  await expect(page.locator(".item .name .t", { hasText: "trip.txt" })).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download trip.txt" }).click()]);
  expect(readFileSync(await dl.path()).toString()).toBe(content);
  await expect.poll(async () => (await store(page)).filter(d => d.path.startsWith("hits/")).map(d => d.data.e).sort()).toEqual(["dl", "open"]);
  await expect(page.getByRole("button", { name: "Save to My files" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("satchel password links need the right password", async ({ openApp, page }) => {
  await openApp("satchel", { seed: [], user: OWNER });
  await upload(page, "contract.txt", Buffer.from("terms"), "text/plain");
  const url = await createLink(page, "contract.txt", { password: "correct horse" });
  const seed = await store(page);
  await openAsGuest(openApp, page, seed, url);
  await expect(page.getByText("This link has a password")).toBeVisible();
  await page.getByRole("textbox", { name: "Password" }).fill("wrong");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByText("That password isn't right")).toBeVisible({ timeout: 10000 });
  await page.getByRole("textbox", { name: "Password" }).fill("correct horse");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.locator(".item .name .t", { hasText: "contract.txt" })).toBeVisible({ timeout: 10000 });

  // The key in the link alone is not enough.
  const linkDoc = seed.find(d => d.path.startsWith("links/u-ada/l/"));
  expect(linkDoc.data.pw).toMatchObject({ iter: 310000 });
});

test("satchel deleted and expired links stop working", async ({ openApp, page }) => {
  const { errors } = await openApp("satchel", { seed: [], user: OWNER });
  await upload(page, "a.txt", Buffer.from("a"), "text/plain");
  const first = await createLink(page, "a.txt");
  const second = await createLink(page, "a.txt");

  await page.getByRole("button", { name: "Links" }).first().click();
  await expect(page.locator(".tag")).toHaveCount(2);
  await page.locator(".tag").first().getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete link" }).click();
  await expect(page.locator(".tag")).toHaveCount(1);
  const deletedUrl = (await store(page)).some(d => d.path.endsWith(new URL(second).hash.match(/l=([0-9a-f]+)/)[1])) ? first : second;

  await page.evaluate(h => { location.hash = h; }, new URL(deletedUrl).hash);
  await expect(page.getByText("This link doesn't work any more")).toBeVisible();

  const liveUrl = deletedUrl === first ? second : first;
  const lid = new URL(liveUrl).hash.match(/l=([0-9a-f]+)/)[1];
  await page.evaluate(async lid => {
    const path = `links/u-ada/l/${lid}`;
    await window.__lager.set(path, { ...window.__lager.store.get(path), expiresAt: Date.now() - 1000 });
  }, lid);
  await page.evaluate(h => { location.hash = h; }, new URL(liveUrl).hash);
  await expect(page.getByText("This link has expired")).toBeVisible();
  expect(errors).toEqual([]);
});

test("satchel shows people without upload rights how to open links", async ({ openApp, page }) => {
  const { errors } = await openApp("satchel", { seed: [], user: GUEST });
  await expect(page.getByText("Open a shared link")).toBeVisible();
  await expect(page.locator("#pick-files")).toBeAttached();
  expect(errors).toEqual([]);
});

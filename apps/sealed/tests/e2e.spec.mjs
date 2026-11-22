// Sealed: end-to-end encryption between two people, run through the mock Lager runtime.
// Each person gets their own browser context; the "server" is the mock store, carried from one
// person to the next as seed data, so everything one person stores is what the other one reads.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, manifest, appUrl, DOMAIN } from "../../../tests/fixtures.mjs";

const MOCK = readFileSync(join(ROOT, "tools/lager-mock.js"), "utf8");
const HTML = readFileSync(join(ROOT, "apps/sealed/index.html"));
const ADA = { id: "u-ada", name: "Ada Example", owner: true };
const BEN = { id: "u-ben", name: "Ben Example", owner: false, canEdit: true };
const PASS_A = "correct horse battery staple";
const PASS_B = "tulip-orbit-velvet-42";

async function openAs(browser, user, seed = []) {
  const context = await browser.newContext({ viewport: { width: 400, height: 800 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await context.route(`https://*.${DOMAIN}/**`, route => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: HTML }));
  const config = { seed, user, capabilities: manifest("sealed").capabilities };
  await page.addInitScript(`window.__LAGER_CONFIG__=${JSON.stringify(config)};\n${MOCK}`);
  await page.goto(appUrl("sealed"));
  return { page, context, errors };
}
const dump = page => page.evaluate(() => Object.entries(window.__lager.dump()).map(([path, data]) => ({ path, data })));

async function setup(page, pass, name) {
  await expect(page.getByRole("heading", { name: "Welcome to Sealed" })).toBeVisible();
  if (name) await page.locator("#name").fill(name);
  await page.locator("#pass1").fill(pass);
  await page.locator("#pass2").fill(pass);
  await page.getByRole("button", { name: "Create my keys" }).click();
  await expect(page.getByRole("button", { name: "New chat" })).toBeVisible({ timeout: 15000 });
}
async function unlock(page, pass) {
  await page.locator("#unlock").fill(pass);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("button", { name: "New chat" })).toBeVisible({ timeout: 15000 });
}
async function send(page, text) {
  await page.locator("#composer").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".b.me .tx", { hasText: text }).last()).toBeVisible();
}

// Ada and Ben both set up; Ben writes to Ada. Returns the server state afterwards.
async function benWritesToAda(browser, text) {
  const a = await openAs(browser, ADA);
  await setup(a.page, PASS_A, "Ada");
  const s1 = await dump(a.page);
  await a.context.close();
  const b = await openAs(browser, BEN, s1);
  await setup(b.page, PASS_B, "Ben");
  await b.page.getByRole("button", { name: "New chat" }).click();
  await b.page.getByRole("button", { name: /Ada/ }).click();
  await send(b.page, text);
  const s2 = await dump(b.page);
  await b.context.close();
  return { s2, bErrors: b.errors, aErrors: a.errors };
}

test.describe("sealed", () => {
  test("keys are stored only encrypted, and a wrong passphrase is refused", async ({ browser }) => {
    const a = await openAs(browser, ADA);
    await setup(a.page, PASS_A, "Ada");
    const state = await dump(a.page);
    const keyring = state.find(d => d.path === "data/users/u-ada/keyring");
    expect(keyring.data.kdf).toMatchObject({ alg: "PBKDF2-SHA256", iter: 600000 });
    const all = JSON.stringify(state);
    expect(all).not.toContain('"d":');            // no private JWK in clear anywhere
    expect(all).not.toContain(PASS_A);
    const dir = state.find(d => d.path === "directory/u-ada");
    expect(dir.data).toMatchObject({ v: 1, name: "Ada" });
    for (const d of state.filter(d => d.path.startsWith("data/users/u-ada/vault"))) expect(Object.keys(d.data).sort()).toEqual(["box", "v"]);
    await a.context.close();

    const again = await openAs(browser, ADA, state);
    await again.page.locator("#unlock").fill("not the passphrase");
    await again.page.getByRole("button", { name: "Unlock" }).click();
    await expect(again.page.getByText("Wrong passphrase.")).toBeVisible({ timeout: 10000 });
    await unlock(again.page, PASS_A);
    expect(a.errors.concat(again.errors)).toEqual([]);
    await again.context.close();
  });

  test("a message reaches the other person and the server only holds ciphertext", async ({ browser }) => {
    const secret = "Meet at the old mill at 7";
    const { s2, aErrors, bErrors } = await benWritesToAda(browser, secret);
    const inAda = s2.filter(d => d.path.startsWith("inbox/u-ada/msgs/"));
    const inBen = s2.filter(d => d.path.startsWith("inbox/u-ben/msgs/"));
    expect(inAda).toHaveLength(1);
    expect(inBen).toHaveLength(1);                 // Ben keeps his own encrypted copy
    expect(JSON.stringify(s2)).not.toContain(secret);
    expect(JSON.stringify(s2)).not.toContain("old mill");
    expect(Object.keys(inAda[0].data.e.k).sort()).toEqual(["u-ada", "u-ben"]);

    const a = await openAs(browser, ADA, s2);
    await unlock(a.page, PASS_A);
    await expect(a.page.locator("#chatlist")).toContainText(secret);
    await expect(a.page.locator("#chatlist .badge")).toHaveText("1");
    await a.page.getByRole("button", { name: /Ben/ }).click();
    await expect(a.page.locator(".b .tx", { hasText: secret })).toBeVisible();
    // Ada's reply and her read receipt go to Ben's inbox
    await send(a.page, "See you there");
    await expect.poll(async () => (await dump(a.page)).filter(d => d.path.startsWith("inbox/u-ben/msgs/")).length).toBe(3);
    expect(aErrors.concat(bErrors, a.errors)).toEqual([]);
    await a.context.close();
  });

  test("a tampered message is shown as unverifiable, never as text", async ({ browser }) => {
    const { s2 } = await benWritesToAda(browser, "Original text");
    const doc = s2.find(d => d.path.startsWith("inbox/u-ada/msgs/"));
    const ct = doc.data.e.ct;
    doc.data.e.ct = (ct[5] === "A" ? "B" : "A") + ct.slice(1);       // flip ciphertext
    const a = await openAs(browser, ADA, s2);
    await unlock(a.page, PASS_A);
    await a.page.getByRole("button", { name: /Ben/ }).click();
    await expect(a.page.locator(".b.bad")).toContainText("Couldn't verify");
    await expect(a.page.getByText("Original text")).toHaveCount(0);
    await a.context.close();
  });

  test("message text is rendered as text, never as HTML", async ({ browser }) => {
    const evil = "<img src=x onerror=window.__pwned=1>";
    const { s2 } = await benWritesToAda(browser, evil);
    const a = await openAs(browser, ADA, s2);
    await unlock(a.page, PASS_A);
    await a.page.getByRole("button", { name: /Ben/ }).click();
    await expect(a.page.locator(".b .tx", { hasText: evil })).toBeVisible();
    expect(await a.page.evaluate(() => window.__pwned)).toBeUndefined();
    await a.context.close();
  });

  test("a changed key pauses sending until it is reviewed", async ({ browser }) => {
    const { s2 } = await benWritesToAda(browser, "hello");
    const a = await openAs(browser, ADA, s2);
    await unlock(a.page, PASS_A);
    // Someone replaces Ben's directory entry with a different, self-signed key
    await a.page.evaluate(async () => {
      const S = crypto.subtle, b64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
      const sig = await S.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const dh = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
      const sr = b64(await S.exportKey("raw", sig.publicKey)), dr = b64(await S.exportKey("raw", dh.publicKey)), at = Date.now();
      const s = b64(await S.sign({ name: "ECDSA", hash: "SHA-256" }, sig.privateKey, new TextEncoder().encode(JSON.stringify(["sealed-dir-v1", "u-ben", "Ben", sr, dr, at]))));
      await window.__lager.set("directory/u-ben", { v: 1, name: "Ben", sig: sr, dh: dr, at, s });
    });
    await a.page.getByRole("button", { name: /Ben/ }).click();
    await expect(a.page.getByRole("alert")).toContainText("security key changed");
    await expect(a.page.locator("#composer")).toHaveCount(0);
    await a.page.getByRole("alert").getByRole("button", { name: "Review" }).click();
    await expect(a.page.getByText("New safety number")).toBeVisible();
    await a.page.getByRole("button", { name: "Accept new key" }).click();
    await a.page.getByRole("button", { name: "Back" }).last().click();
    await expect(a.page.locator("#composer")).toBeVisible();
    await a.context.close();
  });

  test("a draft survives background updates and quick messages all arrive", async ({ browser }) => {
    const { s2 } = await benWritesToAda(browser, "first");
    const b = await openAs(browser, BEN, s2);
    await unlock(b.page, PASS_B);
    await b.page.getByRole("button", { name: /Ada/ }).click();
    await b.page.locator("#composer").fill("half-written draft");
    // a background change (here: Ada renames herself) re-renders the chat
    const ada = s2.find(d => d.path === "directory/u-ada").data;
    await b.page.evaluate(d => window.__lager.set("directory/u-ada", Object.assign({}, d, { at: d.at })), ada);
    await b.page.waitForTimeout(400);
    await expect(b.page.locator("#composer")).toHaveValue("half-written draft");
    await b.page.locator("#composer").fill("second");
    await b.page.getByRole("button", { name: "Send" }).click();
    await b.page.locator("#composer").fill("third");
    await b.page.getByRole("button", { name: "Send" }).click();
    await expect.poll(async () => (await dump(b.page)).filter(d => d.path.startsWith("inbox/u-ada/msgs/")).length).toBe(3);
    await expect(b.page.locator(".b.me .tx")).toHaveText(["first", "second", "third"]);
    expect(b.errors).toEqual([]);
    await b.context.close();
  });

  test("junk and future-dated documents are cleared and can't hide real messages", async ({ browser }) => {
    const { s2 } = await benWritesToAda(browser, "real message");
    const real = s2.find(d => d.path.startsWith("inbox/u-ada/msgs/"));
    for (let i = 0; i < 5; i++) s2.push({ path: `inbox/u-ada/msgs/junk${i}`, data: { v: 1, from: "u-ben", c: real.data.c, at: Date.now() + 1e12, e: { v: 1 } } });
    // a copy of Ben's real message re-signed under another id is rejected (ids are bound to the sender)
    s2.push({ path: "inbox/u-ada/msgs/0123456789abcdef0123456789abcdef", data: Object.assign({}, real.data, { e: Object.assign({}, real.data.e, { id: "0123456789abcdef0123456789abcdef" }) }) });
    const a = await openAs(browser, ADA, s2);
    await unlock(a.page, PASS_A);
    await a.page.getByRole("button", { name: /Ben/ }).click();
    await expect(a.page.locator(".b .tx", { hasText: "real message" })).toHaveCount(1);
    await expect.poll(async () => (await dump(a.page)).filter(d => d.path.startsWith("inbox/u-ada/msgs/")).length).toBe(1);
    expect(a.errors).toEqual([]);
    await a.context.close();
  });

  test("groups: members receive messages, a removed member gets nothing new", async ({ browser }) => {
    const CLEO = { id: "u-cleo", name: "Cleo Example", owner: false, canEdit: true };
    const { s2 } = await benWritesToAda(browser, "hi");
    let c = await openAs(browser, CLEO, s2);
    await setup(c.page, "cleo passphrase 1234", "Cleo");
    let state = await dump(c.page); await c.context.close();
    // Ada creates a group with Ben and Cleo
    let a = await openAs(browser, ADA, state);
    await unlock(a.page, PASS_A);
    await a.page.getByRole("button", { name: "New chat" }).click();
    await a.page.getByRole("button", { name: "New group" }).click();
    await a.page.getByLabel("Group name").fill("Book club");
    const picker = a.page.locator(".panel").last();
    await picker.getByRole("button", { name: /Ben/ }).click();
    await picker.getByRole("button", { name: /Cleo/ }).click();
    await a.page.getByRole("button", { name: "Create group" }).click();
    await send(a.page, "Welcome everyone");
    state = await dump(a.page); await a.context.close();
    // Cleo sees it and replies
    c = await openAs(browser, CLEO, state);
    await unlock(c.page, "cleo passphrase 1234");
    await c.page.getByRole("button", { name: /Book club/ }).click();
    await expect(c.page.locator(".b .tx", { hasText: "Welcome everyone" })).toBeVisible();
    await expect(c.page.locator(".sys", { hasText: "created the group" })).toBeVisible();
    await send(c.page, "Thanks Ada");
    state = await dump(c.page); await c.context.close();
    // Ada removes Cleo
    a = await openAs(browser, ADA, state);
    await unlock(a.page, PASS_A);
    await a.page.getByRole("button", { name: /Book club/ }).click();
    await expect(a.page.locator(".b .tx", { hasText: "Thanks Ada" })).toBeVisible();
    await a.page.getByRole("button", { name: "Chat info" }).click();
    await a.page.getByRole("button", { name: "Remove Cleo", exact: true }).click();
    await a.page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(a.page.getByText("2 members")).toBeVisible();
    state = await dump(a.page); await a.context.close();
    // Cleo is out: no composer, and the others stop encrypting to her
    c = await openAs(browser, CLEO, state);
    await unlock(c.page, "cleo passphrase 1234");
    await c.page.getByRole("button", { name: /Book club/ }).click();
    await expect(c.page.getByText("You're no longer a member")).toBeVisible();
    const gid = (await dump(c.page)).find(d => d.path.startsWith("inbox/u-cleo/msgs/")).data.c;
    state = await dump(c.page); await c.context.close();
    const b = await openAs(browser, BEN, state);
    await unlock(b.page, PASS_B);
    await b.page.getByRole("button", { name: /Book club/ }).click();
    await expect(b.page.locator(".sys", { hasText: /removed Cleo/ })).toBeVisible();
    await expect(b.page.locator(".conv-head .sub")).not.toContainText("Cleo");
    expect(gid).toMatch(/^g[0-9a-f]{32}$/);
    await send(b.page, "Ben here");
    const after = (await dump(b.page)).filter(d => d.path.startsWith("inbox/") && d.data.c === gid && d.data.from === "u-ben");
    expect(after.every(d => !("u-cleo" in d.data.e.k))).toBe(true);
    expect(after.some(d => d.path.startsWith("inbox/u-cleo/"))).toBe(false);
    await b.context.close();
  });

  test("safety numbers match on both sides", async ({ browser }) => {
    const { s2 } = await benWritesToAda(browser, "hi");
    const read = async (user, pass, peer) => {
      const x = await openAs(browser, user, s2);
      await unlock(x.page, pass);
      await x.page.getByRole("button", { name: new RegExp(peer) }).click();
      await x.page.getByRole("button", { name: "Chat info" }).click();
      const n = (await x.page.locator("#safety").innerText()).replace(/\s+/g, "");
      await x.context.close();
      return n;
    };
    const fromAda = await read(ADA, PASS_A, "Ben"), fromBen = await read(BEN, PASS_B, "Ada");
    expect(fromAda).toMatch(/^\d{60}$/);
    expect(fromAda).toBe(fromBen);
  });
});

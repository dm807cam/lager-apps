#!/usr/bin/env node
// Static checks for every app in apps/ and a privacy scan of the whole repository.
// Usage: node tools/validate.mjs [slug ...]
// Private terms (your server's domain, real names, ...) come from the PRIVACY_DENYLIST environment
// variable or an untracked .privacy-denylist file, one term per line. They are never printed.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CI = !!process.env.GITHUB_ACTIONS;
let errors = 0, warnings = 0;
const report = (level, file, msg, line) => {
  level === "error" ? errors++ : warnings++;
  const rel = relative(ROOT, file);
  if (CI) console.log(`::${level} file=${rel}${line ? ",line=" + line : ""}::${msg}`);
  else console.log(`${level === "error" ? "✗" : "!"} ${rel}${line ? ":" + line : ""}  ${msg}`);
};
const error = (f, m, l) => report("error", f, m, l), warn = (f, m, l) => report("warning", f, m, l);
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

const CAPABILITIES = ["db", "user", "permissions", "assets", "room", "page", "downloads", "ingest", "embed", "complete"];
const IMPLICIT = new Set(["db", "user", "permissions"]);
const CATEGORIES = ["analytics", "education", "finance", "games", "health", "mindfulness", "privacy", "productivity", "publishing", "social", "tools", "writing"];
const CDN_HOSTS = ["cdn.jsdelivr.net", "data.jsdelivr.com", "fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com", "cdnjs.cloudflare.com", "esm.sh", "esm.run", "ga.jspm.io"];
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SEGMENT = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

/* ---------- privacy ---------- */
const SECRET_PATTERNS = [
  [/ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|gh[osu]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/, "API key (sk-…)"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "Google API key"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/, "private key"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JSON Web Token"],
  [/LAGER_TOKEN\s*[=:]\s*["']?[A-Za-z0-9_-]{16,}/, "Lager token"],
  [/[?&](?:key|token|access_token|api_key)=[A-Za-z0-9_-]{16,}/, "secret in a URL"]
];
const EMAIL = /[A-Za-z0-9._%+-]+@(?!example\.(?:com|org|net)\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
const EMAIL_OK = /^(noreply|no-reply|users\.noreply\.github\.com)|@users\.noreply\.github\.com$|@anthropic\.com$/i;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IP_OK = new Set(["127.0.0.1", "0.0.0.0", "255.255.255.255"]);

function denylist() {
  const raw = [process.env.PRIVACY_DENYLIST || "", existsSync(join(ROOT, ".privacy-denylist")) ? readFileSync(join(ROOT, ".privacy-denylist"), "utf8") : ""].join("\n");
  return [...new Set(raw.split(/[\n,]/).map(s => s.trim()).filter(s => s && !s.startsWith("#") && s.length >= 3))];
}
function trackedFiles() {
  try { return execSync("git ls-files -co --exclude-standard", { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean).map(f => join(ROOT, f)); }
  catch { return []; }
}
function privacyScan(files, terms) {
  const TEXT = new Set([".html", ".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml", ".svg", ".txt", ".css", ".toml"]);
  for (const f of files) {
    if (!existsSync(f) || !TEXT.has(extname(f)) || f.includes("node_modules") || f.endsWith("package-lock.json")) continue;
    const text = readFileSync(f, "utf8"), lower = text.toLowerCase();
    terms.forEach((t, i) => { const at = lower.indexOf(t.toLowerCase()); if (at >= 0) error(f, `contains private term #${i + 1} from the privacy denylist`, lineOf(text, at)); });
    for (const [re, what] of SECRET_PATTERNS) { const m = re.exec(text); if (m) error(f, `looks like a ${what}`, lineOf(text, m.index)); }
    if (f.endsWith("validate.mjs")) continue;
    for (const m of text.matchAll(EMAIL)) if (!EMAIL_OK.test(m[0]) && !/^\d/.test(m[0].split("@")[1])) error(f, `e-mail address (${m[0].replace(/^(.).*(@.*)$/, "$1…$2")}); use name@example.com in examples`, lineOf(text, m.index));
    for (const m of text.matchAll(IPV4)) if (!IP_OK.has(m[0]) && m[0].split(".").every(n => +n <= 255) && !/[\d.]\d*\.\d+\.\d+\.\d+\.\d/.test(text.slice(m.index - 2, m.index + m[0].length + 2))) warn(f, `IP address ${m[0]}`, lineOf(text, m.index));
  }
}

/* ---------- scripts ---------- */
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function checkScripts(file, html) {
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/type=["']?(?:application\/(?:ld\+)?json|text\/template|importmap)/i.test(m[1])) continue;
    const code = m[2], module = /type=["']?module/i.test(m[1]);
    try { new AsyncFunction(module ? code.replace(/^\s*(import|export)\b[^\n]*$/gm, "") : code); }
    catch (e) { error(file, `inline script does not parse: ${e.message}`, lineOf(html, m.index)); }
  }
}

/* ---------- icon (the subset of SVG Lager accepts) ---------- */
const SVG_ELEMENTS = new Set(["svg", "g", "defs", "linearGradient", "radialGradient", "stop", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "title", "desc"]);
const SVG_ATTRS = new Set("xmlns viewBox width height id d x y x1 y1 x2 y2 cx cy r rx ry fx fy points fill fill-opacity fill-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity opacity transform gradientUnits gradientTransform spreadMethod offset stop-color stop-opacity".split(" "));
function checkIcon(file) {
  const svg = readFileSync(file, "utf8");
  if (svg.length > 64 * 1024) error(file, "icon is larger than 64 KiB");
  const root = /^\s*<svg\b([^>]*)>/.exec(svg);
  if (!root) return error(file, "icon must start with an <svg> element");
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(root[1])) error(file, 'icon needs xmlns="http://www.w3.org/2000/svg"');
  const vb = /viewBox="([\d.\s-]+)"/.exec(root[1]);
  if (!vb || (p => p.length !== 4 || p[2] !== p[3])(vb[1].trim().split(/\s+/))) error(file, "icon viewBox must be square, e.g. 0 0 512 512");
  let count = 0;
  for (const t of svg.matchAll(/<([A-Za-z][\w-]*)([^>]*)>/g)) {
    count++;
    if (!SVG_ELEMENTS.has(t[1])) error(file, `icon uses <${t[1]}>, which Lager does not allow`, lineOf(svg, t.index));
    for (const a of t[2].matchAll(/([\w:-]+)\s*=/g)) if (!SVG_ATTRS.has(a[1])) error(file, `icon uses the attribute ${a[1]}, which Lager does not allow`, lineOf(svg, t.index));
  }
  if (count > 500) error(file, "icon has more than 500 elements");
}

/* ---------- seed ---------- */
function checkSeed(file) {
  let docs;
  try { docs = JSON.parse(readFileSync(file, "utf8")); } catch (e) { return error(file, "seed is not valid JSON: " + e.message); }
  if (!Array.isArray(docs)) return error(file, "seed must be a JSON array of {path, data}");
  if (docs.length > 1000) error(file, "seed has more than 1000 documents (import_data takes at most 1000 per call; split the file)");
  docs.forEach((d, i) => {
    const where = `document ${i + 1}`;
    if (!d || typeof d.path !== "string" || !d.data || typeof d.data !== "object" || Array.isArray(d.data)) return error(file, `${where}: needs {path, data} with an object as data`);
    const s = d.path.split("/");
    if (s.length % 2 || s.length > 16 || !s.every(x => SEGMENT.test(x) && x !== "." && x !== "..")) error(file, `${where}: invalid document path ${d.path}`);
    if (s[0] === "data" && s[1] === "users") error(file, `${where}: seeds must not contain anyone's private data (data/users/...)`);
    if (JSON.stringify(d.data).length > 256 * 1024) error(file, `${where}: document larger than 256 KiB`);
  });
}

/* ---------- one app ---------- */
function checkApp(slug) {
  const dir = join(ROOT, "apps", slug), mf = join(dir, "lager.json");
  for (const f of ["index.html", "lager.json", "README.md"]) if (!existsSync(join(dir, f))) error(join(dir, f), `missing ${f}`);
  if (!existsSync(mf)) return;
  let m;
  try { m = JSON.parse(readFileSync(mf, "utf8")); } catch (e) { return error(mf, "lager.json is not valid JSON: " + e.message); }
  const known = new Set(["$schema", "slug", "title", "description", "version", "language", "category", "themeColor", "entry", "icon", "capabilities", "seed", "externalHosts", "integrations", "status"]);
  Object.keys(m).forEach(k => { if (!known.has(k)) error(mf, `unknown field "${k}"`); });
  if (m.slug !== slug) error(mf, `slug "${m.slug}" must match the folder name "${slug}"`);
  if (!SLUG.test(slug)) error(mf, "slug: lowercase letters, digits and hyphens, at most 63 characters");
  if (typeof m.title !== "string" || !m.title.trim() || m.title.length > 100) error(mf, "title: required, at most 100 characters");
  if (typeof m.description !== "string" || !m.description.trim() || m.description.length > 200 || /\n/.test(m.description)) error(mf, "description: one line, at most 200 characters");
  if (!Number.isInteger(m.version) || m.version < 1) error(mf, "version: the Lager version number this code was deployed as (integer ≥ 1)");
  if (!/^[a-z]{2}$/.test(m.language || "")) error(mf, 'language: two-letter code such as "en" or "de"');
  if (!CATEGORIES.includes(m.category)) error(mf, `category: one of ${CATEGORIES.join(", ")}`);
  if (!/^#[0-9a-f]{6}$/i.test(m.themeColor || "")) error(mf, "themeColor: hex colour such as #1f2a5c");
  if (m.entry !== "index.html") error(mf, 'entry must be "index.html" (Lager apps are one self-contained HTML file)');
  if (m.status && !["stable", "beta", "deprecated"].includes(m.status)) error(mf, "status: stable, beta or deprecated");
  if (m.icon) { existsSync(join(dir, m.icon)) ? checkIcon(join(dir, m.icon)) : error(mf, `icon file ${m.icon} not found`); }
  else warn(mf, "no icon: add icon.svg (marketplace listings and home screens use it)");
  const caps = m.capabilities || {};
  if (typeof caps !== "object" || Array.isArray(caps)) error(mf, "capabilities must be an object");
  Object.keys(caps).forEach(c => { if (!CAPABILITIES.includes(c)) error(mf, `unknown capability "${c}"`); });
  const origins = JSON.stringify(caps).match(/https?:\/\/[^"]+/g) || [];
  origins.forEach(o => { if (!/\$\{LAGER_APPS_DOMAIN\}|example\.(com|org)/.test(o)) error(mf, `capabilities name the website ${o}; use https://<app>.\${LAGER_APPS_DOMAIN} for apps on the same server`); });
  (m.seed || []).forEach(s => existsSync(join(dir, s)) ? checkSeed(join(dir, s)) : error(mf, `seed file ${s} not found`));
  if (m.integrations) for (const [api, role] of Object.entries(m.integrations)) if (!/^[a-z-]+\/v\d+$/.test(api) || !["sender", "receiver"].includes(role)) error(mf, `integrations: {"<api>/v<n>": "sender" | "receiver"}, got ${api}: ${role}`);

  const file = join(dir, "index.html");
  if (!existsSync(file)) return;
  const html = readFileSync(file, "utf8");
  if (statSync(file).size > 16 * 1024 * 1024) error(file, "larger than 16 MiB, Lager's limit");
  if (!/^\s*<!doctype html>/i.test(html)) error(file, "must start with <!doctype html>", 1);
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) error(file, "needs <meta name=\"viewport\"> for phones");
  if (!/<title>[^<]+<\/title>/i.test(html)) error(file, "needs a <title>");
  if (/<script[^>]+src=["'](?!https:\/\/)/i.test(html)) error(file, "loads a local script file; Lager serves one HTML file, so inline it or load it from a CDN");
  checkScripts(file, html);
  const used = new Set([...html.matchAll(/\b(?:lager|R|window\.lager)\s*\.\s*use\(\s*["'`](\w+)["'`]/g)].map(x => x[1]));
  if (/\blager\.complete\(|\bR\.complete\(/.test(html)) used.add("complete");
  for (const c of used) if (!IMPLICIT.has(c) && !(c in caps)) error(file, `uses lager.use("${c}") but lager.json does not declare it`);
  for (const c of Object.keys(caps)) if (!IMPLICIT.has(c) && !used.has(c)) warn(mf, `declares "${c}" but the code never calls lager.use("${c}")`);
  for (const [re, what] of [[/\bwindow\.claude\b|\bclaude\.(use|complete)\(/, "window.claude (a claude.ai API; use window.lager)"], [/\bwindow\.storage\./, "window.storage (a claude.ai API; use lager.use(\"db\"))"]])
    { const x = re.exec(html); if (x) error(file, `uses ${what}`, lineOf(html, x.index)); }
  if (/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(html)) warn(file, "uses browser storage; fine as an offline cache, but the record must live in lager.use(\"db\")");
  const hosts = new Set([...html.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map(x => x[1]).filter(h => CDN_HOSTS.includes(h)));
  const declared = new Set(m.externalHosts || []);
  for (const h of hosts) if (!declared.has(h) && !(h === "fonts.gstatic.com" && declared.has("fonts.googleapis.com"))) error(mf, `the code loads from ${h}; list it in externalHosts`);
  for (const h of declared) if (!hosts.has(h)) warn(mf, `externalHosts lists ${h}, which the code never mentions`);
  const tests = existsSync(join(dir, "tests")) ? readdirSync(join(dir, "tests")).filter(f => f.endsWith(".spec.mjs")) : [];
  if (!tests.length && (Object.keys(caps).some(c => !IMPLICIT.has(c)) || m.integrations)) warn(dir, "no app tests: apps with integrations or extra capabilities should have tests/*.spec.mjs (see docs/TESTING.md)");
}

/* ---------- run ---------- */
const all = readdirSync(join(ROOT, "apps"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
const only = process.argv.slice(2);
for (const s of only) if (!all.includes(s)) error(join(ROOT, "apps", s), "no such app");
(only.length ? only.filter(s => all.includes(s)) : all).forEach(checkApp);
const terms = denylist();
privacyScan(trackedFiles(), terms);
console.log(`\n${all.length} apps checked, privacy denylist: ${terms.length ? terms.length + " terms" : "not set (add PRIVACY_DENYLIST)"}. ${errors} errors, ${warnings} warnings.`);
process.exit(errors ? 1 : 0);

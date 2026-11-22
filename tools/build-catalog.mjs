#!/usr/bin/env node
// Builds catalog.json (the machine-readable app index a marketplace can read) and the app table in
// README.md from every apps/*/lager.json. With --check it only verifies both are up to date.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const slugs = readdirSync(join(ROOT, "apps"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();

const apps = slugs.map(slug => {
  const m = JSON.parse(readFileSync(join(ROOT, "apps", slug, "lager.json"), "utf8"));
  const testDir = join(ROOT, "apps", slug, "tests");
  return {
    slug, title: m.title, description: m.description, version: m.version, status: m.status || "stable",
    language: m.language, category: m.category, themeColor: m.themeColor,
    path: `apps/${slug}`, entry: `apps/${slug}/${m.entry}`, icon: m.icon ? `apps/${slug}/${m.icon}` : null,
    capabilities: Object.keys(m.capabilities || {}).sort(),
    externalHosts: m.externalHosts || [], integrations: m.integrations || {},
    seed: (m.seed || []).map(s => `apps/${slug}/${s}`),
    tests: existsSync(testDir) ? readdirSync(testDir).filter(f => f.endsWith(".spec.mjs")).length : 0
  };
});
const catalog = JSON.stringify({ schema: 1, repository: "https://github.com/dm807cam/lager-apps", apps }, null, 2) + "\n";

const flag = { en: "English", de: "Deutsch" };
const rows = apps.map(a => `| ${a.icon ? `<img src="${a.icon}" width="24" height="24" alt="">` : ""} | [${a.title}](${a.path}) | ${a.description.replace(/\|/g, "\\|")} | ${flag[a.language] || a.language} | ${a.category}${a.status !== "stable" ? ` · ${a.status}` : ""} |`);
const table = ["<!-- catalog:start -->", "| | App | What it does | Language | Category |", "|---|---|---|---|---|", ...rows, "<!-- catalog:end -->"].join("\n");
const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
const nextReadme = readme.replace(/<!-- catalog:start -->[\s\S]*<!-- catalog:end -->/, table);

const catPath = join(ROOT, "catalog.json");
const stale = [];
if (!existsSync(catPath) || readFileSync(catPath, "utf8") !== catalog) stale.push("catalog.json");
if (nextReadme !== readme) stale.push("README.md");
if (check) {
  if (stale.length) { console.error(`Out of date: ${stale.join(", ")}. Run npm run catalog and commit the result.`); process.exit(1); }
  console.log("catalog.json and README.md are up to date.");
} else {
  writeFileSync(catPath, catalog);
  writeFileSync(readmePath, nextReadme);
  console.log(`Wrote catalog.json and the README table (${apps.length} apps).`);
}

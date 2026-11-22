// Checks every internal link in the concept spike: href/src attributes and .html paths inside inline scripts.
// Run: node check-links.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".html") && !/\.v\d+\.html$/.test(name)) pages.push(full);
  }
})(ROOT);

let links = 0;
const broken = [];
for (const page of pages) {
  const html = readFileSync(page, "utf8"), found = new Set();
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) found.add(m[1]);
  for (const m of html.matchAll(/['"`]([\w./-]+\.html(?:#[\w-]+)?)['"`]/g)) found.add(m[1]);
  for (const raw of found) {
    if (/^(https?:|mailto:|data:|#|\$\{)/.test(raw) || raw.includes("${")) continue;
    const [path, hash] = raw.split("#"), target = resolve(dirname(page), path.split("?")[0]);
    links++;
    if (!existsSync(target)) { broken.push(`${relative(ROOT, page)} -> ${raw} (no such file)`); continue; }
    if (hash && target.endsWith(".html") && !new RegExp(`id=["']${hash}["']`).test(readFileSync(target, "utf8"))) broken.push(`${relative(ROOT, page)} -> ${raw} (no such id)`);
  }
}
console.log(`${pages.length} pages, ${links} internal links checked`);
if (broken.length) { console.log("BROKEN:\n" + broken.join("\n")); process.exit(1); }
console.log("all links resolve");

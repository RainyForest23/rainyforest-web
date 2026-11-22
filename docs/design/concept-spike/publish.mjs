// Puts the mock pages online as a stopgap preview, on the gh-pages branch of this repo
// (https://rainyforest23.github.io/rainyforest-web/). The real site replaces it once it is deployed.
//
//   node publish.mjs            build the folder to publish and check its links
//   node publish.mjs --push     the same, then replace the gh-pages branch with it
//
// What goes online: index.html, about.html, the Work pages, the "under construction" pages, forest.js, soon.js and the CV PDF.
// Build scripts, the standalone figure and older iterations stay out.
// Each page is adjusted on the way out: CV points at the PDF, the language link is dropped,
// and search engines are asked not to index this temporary address.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, "..", "..", "..");
const OUT = mkdtempSync(join(tmpdir(), "rainyforest-preview-"));

const pages = ["index.html", "about.html"];
(function walk(dir) {
  for (const name of readdirSync(join(HERE, dir))) {
    const rel = join(dir, name);
    if (statSync(join(HERE, rel)).isDirectory()) walk(rel);
    else if (name === "index.html") pages.push(rel);
  }
})("work");
for (const section of ["study", "principles", "keynotes", "blog"]) pages.push(join(section, "index.html"));   // the "under construction" pages

for (const page of pages) {
  const up = "../".repeat(page.split("/").length - 1);
  let html = readFileSync(join(HERE, page), "utf8");
  html = html
    .replace(/<li><a href="#">CV<\/a><\/li>/, `<li><a href="${up}woorim-shin-cv.pdf">CV</a></li>`)
    .replace(/\s*<a class="lang" href="#"[^>]*>[^<]*<\/a>/, "")                  // no Korean version yet
    .replace("<head>", '<head><meta name="robots" content="noindex">');
  if (/href="#"(?! *class="me")/.test(html.replace(/<a class="me" href="#">/g, ""))) throw new Error(`${page}: a link still goes nowhere`);
  mkdirSync(dirname(join(OUT, page)), { recursive: true });
  writeFileSync(join(OUT, page), html);
}
for (const file of ["forest.js", "soon.js"]) cpSync(join(HERE, file), join(OUT, file));
cpSync(join(REPO, "public", "cv", "woorim-shin-cv.pdf"), join(OUT, "woorim-shin-cv.pdf"));
writeFileSync(join(OUT, ".nojekyll"), "");

execFileSync("node", [join(HERE, "check-links.mjs"), OUT], { stdio: "inherit" });
console.log(`${pages.length} pages in ${OUT}`);

if (process.argv.includes("--push")) {
  const git = (...args) => execFileSync("git", args, { cwd: OUT, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
  const remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd: REPO }).toString().trim();
  const source = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO }).toString().trim();
  git("init", "-q", "-b", "gh-pages");
  git("add", "-A");
  git("-c", "user.name=" + execFileSync("git", ["config", "user.name"], { cwd: REPO }).toString().trim(),
      "-c", "user.email=" + execFileSync("git", ["config", "user.email"], { cwd: REPO }).toString().trim(),
      "commit", "-q", "-m", `Preview of the mock pages (from ${source})`);
  git("push", "-q", "--force", remote, "gh-pages");                              // the branch is a build product: replaced each time
  console.log("pushed to gh-pages:", relative(REPO, HERE), "at", source);
}

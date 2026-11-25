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
for (const section of ["study", "principles", "keynotes", "blog"]) pages.push(join(section, "index.html"));   // the "under construction" pages, and the keynote cinema

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
cpSync(join(HERE, "keynotes", "tesla-jr"), join(OUT, "keynotes", "tesla-jr"), { recursive: true, filter: (p) => !/(captions|deck)\.json$/.test(p) });   // the deck: the prepared Keynote export if there is one, and the still images
writeFileSync(join(OUT, ".nojekyll"), "");

// Study is private. The site is static and public, so the only real lock is encryption: the Study page goes online
// as ciphertext and is decrypted in the reader's browser with the password. Without a password nothing of Study is
// published and the menu item keeps its "under construction" page.
// The password comes from the environment (STUDY_PASSWORD) or the macOS keychain (service "rainyforest-study"); it is never written anywhere.
const password = (() => {
  if (process.env.STUDY_PASSWORD) return process.env.STUDY_PASSWORD;
  try { return execFileSync("security", ["find-generic-password", "-s", "rainyforest-study", "-w"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; }
})();
if (password && password.length < 12) throw new Error("the Study password must be at least 12 characters: the encrypted page is public, so a short one can be guessed offline");
if (password) {
  const { webcrypto: wc } = await import("node:crypto");
  const plain = readFileSync(join(HERE, "study", "notes.html"), "utf8").replace("<head>", '<head><meta name="robots" content="noindex">')
    .replace(/<li><a href="#">CV<\/a><\/li>/, '<li><a href="../woorim-shin-cv.pdf">CV</a></li>').replace(/\s*<a class="lang" href="#"[^>]*>[^<]*<\/a>/, "");
  const salt = wc.getRandomValues(new Uint8Array(16)), iv = wc.getRandomValues(new Uint8Array(12)), ITER = 600000;
  const key = await wc.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, await wc.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]), { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const data = new Uint8Array(await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const payload = Buffer.concat([salt, iv, data]).toString("base64");
  const lock = readFileSync(join(OUT, "study", "index.html"), "utf8");                    // keep the page's look; swap its words for a password box
  const page = lock.replace(/<main class="soon-main">[\s\S]*?<\/main>/, `<main class="soon-main"><div class="soon-text"><p class="kicker">Study</p><h1>Private for now</h1>
<p>These notes are not public yet. If you have the password, they open here.</p>
<form id="lock" style="display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1.2rem"><input id="pw" type="password" autocomplete="current-password" aria-label="Password" required style="flex:1 1 12rem;min-width:0;padding:.55rem .7rem;background:#0a0f0d;color:#e6ebe4;border:1px solid #5d6b64;font:inherit"><button style="padding:.55rem 1rem;background:#e6ebe4;color:#0a0f0d;border:0;font:inherit;font-weight:600;cursor:pointer">Open</button></form>
<p id="msg" role="status" style="min-height:1.6em;font-size:.84rem"></p>
<p class="links"><a href="../work/index.html">See the experience →</a><a href="../index.html">Home</a></p></div></main>
<script>
document.getElementById("lock").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("msg"), raw = Uint8Array.from(atob("${payload}"), (c) => c.charCodeAt(0));
  msg.textContent = "Opening…";
  try {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(document.getElementById("pw").value), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: raw.slice(0, 16), iterations: ${ITER} }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const html = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(16, 28) }, key, raw.slice(28)));
    document.open(); document.write(html); document.close();
  } catch { msg.textContent = "That password does not open it."; }
});
</script>`);
  writeFileSync(join(OUT, "study", "index.html"), page);
  console.log("Study: published encrypted");
} else console.log("Study: no password set, so nothing of it is published (the menu item shows its under-construction page)");

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

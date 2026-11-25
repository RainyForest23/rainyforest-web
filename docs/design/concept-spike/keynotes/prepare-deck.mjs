// Prepares a Keynote deck for the cinema page, animations and all.
//
// Keynote's own "export to HTML" keeps the builds and transitions. This script takes that export and makes it fit to publish:
//   1. (with --export) asks Keynote to export the deck; the original file is not changed
//   2. leaves out every slide that holds a movie, and the movie files themselves (the demo recordings are too large, and stay out by rule)
//   3. leaves out the .pdfp copies of the slides, which the player never asks for
//   4. teaches the player two things, by a small patch to its script: to tell the page around it which step it is on,
//      and to go forward or back when that page asks. That is what lets a caption follow each animation step
//   5. makes sure captions.json has one entry per step, keeping what is already written
//
//   KEYNOTE_FILE=/path/to/deck.key node keynotes/prepare-deck.mjs --export     export, then prepare
//   node keynotes/prepare-deck.mjs                                             prepare from the last export
//
// The export lives in .keynote-export/ at the top of the repo and the prepared deck in keynotes/<deck>/deck/.
// Both are git-ignored: decks are tens of megabytes and belong in object storage, not in the repository.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, "..", "..", "..", "..");
const DECK = "tesla-jr", SRC = join(REPO, ".keynote-export", DECK), DST = join(HERE, DECK, "deck");

if (process.argv.includes("--export")) {
  const file = process.env.KEYNOTE_FILE, app = process.env.KEYNOTE_APP || "Keynote";
  if (!file || !existsSync(file)) throw new Error("set KEYNOTE_FILE to the .key file to export");
  rmSync(SRC, { recursive: true, force: true });
  execFileSync("osascript", ["-e", `
    tell application "${app}"
      set wasRunning to running
      set doc to open POSIX file "${file}"
      delay 2
      export doc to POSIX file "${SRC}" as HTML
      close doc saving no
      if not wasRunning then quit
    end tell`], { stdio: "inherit" });
}
if (!existsSync(join(SRC, "index.html"))) throw new Error(`no export at ${SRC}: run with --export first`);

const isMovie = (name) => /\.(mp4|mov|m4v)$/i.test(name);
const header = JSON.parse(readFileSync(join(SRC, "assets", "header.json"), "utf8"));
const withMovie = header.slideList.filter((id) => readdirSync(join(SRC, "assets", id, "assets")).some(isMovie));
const keep = header.slideList.filter((id) => !withMovie.includes(id));

rmSync(DST, { recursive: true, force: true });
cpSync(SRC, DST, { recursive: true, filter: (p) => !isMovie(p) && !p.endsWith(".pdfp") && !withMovie.some((id) => p.includes(id)) });

// the list of slides, in both forms the player reads (JSON over http, JSONP from a file)
header.slideList = keep; header.slideCount = keep.length;
writeFileSync(join(DST, "assets", "header.json"), JSON.stringify(header));
writeFileSync(join(DST, "assets", "header.jsonp"), `local_header( ${JSON.stringify(header)})`);

// the patch to the player
const playerPath = join(DST, "assets", "player", "main.js");
let player = readFileSync(playerPath, "utf8");
const setter = "setCurrentSceneIndexTo(A){this.currentSceneIndex=A,";
if (player.split(setter).length !== 2) throw new Error("this version of Keynote's player is laid out differently: the step hook has to be found again");
for (const method of ["advanceToNextBuild(", "goBackToPreviousBuild("]) if (!player.includes(method)) throw new Error(`the player has no ${method})`);
player = player.replace(setter, `setCurrentSceneIndexTo(A){window.__show=this;try{parent.postMessage({keynote:"step",step:A+1,of:this.script.numScenes},"*")}catch(e){}this.currentSceneIndex=A,`)
  + `;addEventListener("message",function(e){var c=window.__show;if(!c)return;if(e.data==="keynote:next")c.advanceToNextBuild();else if(e.data==="keynote:prev")c.goBackToPreviousBuild()});`;
writeFileSync(playerPath, player);

// one caption per step
const steps = keep.reduce((n, id) => n + JSON.parse(readFileSync(join(SRC, "assets", id, `${id}.json`), "utf8")).events.length, 0);
const capPath = join(HERE, DECK, "captions.json"), old = existsSync(capPath) ? JSON.parse(readFileSync(capPath, "utf8")) : {};
writeFileSync(capPath, JSON.stringify(Object.fromEntries(Array.from({ length: steps }, (_, i) => [String(i + 1), old[String(i + 1)] || ""])), null, 2) + "\n");
writeFileSync(join(HERE, DECK, "deck.json"), JSON.stringify({ slides: keep.length, steps, leftOut: withMovie.length }) + "\n");

const size = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
console.log(`${DECK}: ${keep.length} slides, ${steps} steps, ${(size(DST) / 1e6).toFixed(1)} MB; left out ${withMovie.length} slide(s) with a movie`);

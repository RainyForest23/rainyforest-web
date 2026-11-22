// Energy cost model figure: two identical boards side by side, one running an AI workload, one running Node.js.
// In front of each stand three columns: the watts it draws from CPU, GPU and memory.
// Numbers are the rounded readings published in content/legacy/energy-attribution-model.mdx (solo runs).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const KIT = process.env.ANATOMY_KIT ?? join(homedir(), ".claude/skills/anatomy");   // the anatomy skill's folder (MIT). Set ANATOMY_KIT if it lives elsewhere
const k = await import(`${KIT}/kit/iso-kit.mjs`);
const { kitScript } = await import(`${KIT}/scripts/inline-kit.mjs`);
const HERE = dirname(fileURLToPath(import.meta.url));

/* ---- the model: watts each workload draws when it runs alone on the same slice (2 cores, 4 GB, 1 GPU) ---- */
// Source: Mathematics-energy.pdf, workload-induced power when each runs alone (Section 4.2, Fig. 5).
// Stated in the text: Node.js 14 W, AI 65-145 W, GPU share 74/93/83 %, CPU 9-11 W, memory 0.8 W, YOLO storage about 7 W. Per-part values are rounded from those.
const NODE = { name: "Node.js", cpu: 13, gpu: 0, mem: 0.8, sto: 0, total: 14 };
const AI = [
  { name: "ResNet", cpu: 9, gpu: 135, mem: 0.8, sto: 0, total: 145 },
  { name: "YOLO", cpu: 11, gpu: 53, mem: 0.8, sto: 7, total: 72 },
  { name: "GPT-2", cpu: 10, gpu: 54, mem: 0.8, sto: 0, total: 65 },
];
const WATT = 0.5;                                  // world units of column height per watt
const UNITS = ["cpu", "gpu", "mem"], LABEL = { cpu: "CPU", gpu: "GPU", mem: "MEM" };
const watts = (v) => (v === 0 ? "0" : v < 1 ? v.toFixed(1) : String(Math.round(v))) + " W";

const WIDTH = 760, HEIGHT = 400, FOOTER = 96;     // FOOTER: room under the drawing for each station's name and total
const AZIMUTH = 58;                                 // turned so the row of three columns runs nearly left to right
const PLATE = { x: -72, y: -75, w: 144, d: 150, r: 8 }, PLATE_H = 10, FOOT_H = 5;   // each workload has its own bench
const OX = -60;                                     // left edge of the board and the meter; both are 120 wide
const BENCH_Y = -67, BENCH_D = 40, BENCH_TOP = 5;   // the meter stands behind the board so the columns never hide it
const BOARD_Y = -19, BOARD_D = 78, BOARD_TOP = 4.4;
const COL = { cpu: 10, gpu: 46, mem: 82 };          // x offset of each column's pad
const PAD_TOP = BENCH_TOP + 1.2;
const colPlan = (unit) => ({ x: OX + COL[unit] + 3, y: BENCH_Y + 9, w: 22, d: 22, r: 1.4 });
const colX = (unit) => OX + COL[unit] + 14;
const rad = AZIMUTH * Math.PI / 180, SPREAD = 102;   // the two benches sit side by side at the same depth
const PLACE = { ai: [-Math.sin(rad) * SPREAD, Math.cos(rad) * SPREAD, 0], node: [Math.sin(rad) * SPREAD, -Math.cos(rad) * SPREAD, 0] };

const P = k.fitProjection(
  Object.values(PLACE).flatMap(([dx, dy]) => [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [colX("gpu"), BENCH_Y + 9, PAD_TOP + 135 * WATT + 16]].map(([x, y, z]) => [x + dx, y + dy, z])),
  WIDTH, HEIGHT, { pad: 22, azimuth: AZIMUTH },
);

const at = (p) => k.iso(p, P);
const pt = (p) => { const [x, y] = at(p); return `${x.toFixed(2)} ${y.toFixed(2)}`; };
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const box = (plan, z, h, tone = "mid", bevel = 0.5, steps = 4) => S(k.slabOf(plan, z, h, P, steps, bevel), { tone });
const rectY = (y, x0, x1, z0, z1) => "M" + [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].map(pt).join("L") + "Z";
const text = (x, y, z, s, size, opt = {}) => k.faceTextSvg(k.topMatrix([x, y], z, P, opt.along || "x"), s, { size, tone: opt.tone || "hi", anchor: opt.anchor || "start" })
  .replace("<text ", `<text${opt.part ? ` data-part="${opt.part}"` : ""}${opt.res ? ` data-res="${opt.res}"` : ""} `);
// upright lettering: faces the reader instead of lying on a surface
const up = (p, s, cls, opt = {}) => { const [x, y] = at(p); return `<text class="up ${cls}"${opt.part ? ` data-part="${opt.part}"` : ""}${opt.res ? ` data-res="${opt.res}"` : ""} x="${x.toFixed(1)}" y="${(y + (opt.dy || 0)).toFixed(1)}" text-anchor="middle">${s}</text>`; };

function plate() {
  const out = [];
  for (const [x, y] of [...k.corners(PLATE, 22)].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

// one board. Both stations draw exactly this: the hardware share is identical
function board() {
  const ox = OX, out = [], B = { x: ox, y: BOARD_Y, w: 120, d: BOARD_D, r: 3 }, z = BOARD_TOP, y0 = BOARD_Y;
  for (const [x, y] of k.corners(B, 5)) out.push(S(k.cylinder(x, y, 1.8, 0, 2.9, P, 12), { tone: "lo", crease: "none" }));
  out.push(`<g data-res="board">${S(k.slabOf(B, 2.9, z - 2.9, P, 5, 0.4), { tone: "mid" })}</g>`);
  out.push(L(k.corners(B, 5).map(([x, y]) => k.ring(x, y, 2.2, z, P, 14)).join(""), { tone: "mid" }));
  out.push(D(k.corners(B, 5).map(([x, y]) => at([x, y, z])), { size: 0.45, tone: "hi" }));
  // a coloured run from each part to the back edge, where its column stands
  const run = (unit, from) => `<g data-line="${unit}">${L(k.lineOnTop([colX(unit), from], [colX(unit), y0], z, P), { tone: "hi" })}${D([at([colX(unit), from, z])], { size: 0.7, tone: "hi" })}</g>`;
  out.push(run("cpu", y0 + 26), run("gpu", y0 + 42), run("mem", y0 + 21));

  // memory: two sticks
  for (const y of [y0 + 22, y0 + 31]) {
    const stick = { x: ox + 70, y, w: 42, d: 6, r: 0.6 };
    out.push(box({ x: stick.x - 1.5, y: y - 0.6, w: 45, d: 7.2, r: 0.6 }, z, 1.6, "lo", 0.2));
    out.push(S(k.slabOf(stick, z + 1.6, 8, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    out.push(D([at([stick.x + 2, y + 3, z + 9.6]), at([stick.x + 40, y + 3, z + 9.6])], { size: 0.35, tone: "hi" }));
  }
  out.push(text(ox + 71, y0 + 17, z, "MEM", 5.4));

  // CPU: socket frame, lever, chip
  const frame = { x: ox + 8, y: y0 + 26, w: 36, d: 36, r: 1.6 };
  for (const [x, y] of [[ox + 50, y0 + 30], [ox + 50, y0 + 37], [ox + 50, y0 + 44]]) out.push(S(k.cylinder(x, y, 2, z, 5, P, 14, 0.3), { tone: "mid" }));
  out.push(box(frame, z, 2, "mid", 0.3));
  out.push(L(k.planOutline(k.insetPlan(frame, 2), z + 2, P, 3), { tone: "lo" }));
  out.push(L("M" + [[frame.x + 1, frame.y + 34.4], [frame.x + 33, frame.y + 34.4], [frame.x + 33, frame.y + 29]].map((q) => pt([q[0], q[1], z + 2.6])).join("L"), { tone: "hi" }));
  out.push(S(k.slabOf({ x: frame.x + 6, y: frame.y + 6, w: 24, d: 24, r: 1.4 }, z + 2, 4, P, 4, 0.6), { tone: "hi", crease: "lo" }));
  out.push(D([at([frame.x + 8.4, frame.y + 27.6, z + 6])], { size: 0.5, tone: "hi" }));
  out.push(text(ox + 9, y0 + 73, z, "CPU", 5.6));

  // GPU: card with a fan, nearest the reader
  const G = { x: ox + 56, y: y0 + 42, w: 56, d: 32, r: 2 }, gt = z + 12;
  out.push(box(k.insetPlan(G, 1), z, 2.2, "lo", 0.2));
  out.push(S(k.slabOf(G, z + 2.2, gt - z - 2.2, P, 5, 1), { tone: "hi", crease: "lo" }));
  for (let x = G.x + 6; x < G.x + G.w - 6; x += 6.2) out.push(L(rectY(G.y + G.d, x, x + 3.4, z + 4.6, gt - 2.6), { tone: "lo" }));
  const fx = G.x + 17, fy = G.y + 16;
  out.push(L(k.ring(fx, fy, 12.5, gt, P, 44), { tone: "mid" }), L(k.ring(fx, fy, 3.4, gt, P, 16), { tone: "mid" }));
  const blades = [];
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; blades.push(k.lineOnTop([fx + Math.cos(a) * 3.8, fy + Math.sin(a) * 3.8], [fx + Math.cos(a + 0.55) * 11.2, fy + Math.sin(a + 0.55) * 11.2], gt, P)); }
  out.push(L(blades.join(""), { tone: "lo" }), D([at([fx, fy, gt])], { size: 0.5, tone: "hi" }));
  out.push(L(k.lineOnTop([G.x + 33, G.y + 3], [G.x + 33, G.y + G.d - 3], gt, P), { tone: "faint" }));
  out.push(text(G.x + 36, G.y + 19.5, gt, "GPU", 5.6));
  return out.join("");
}

// the meter behind the board: a bench, three pads, a lead from the board to each
function bench() {
  const out = [], B = { x: OX, y: BENCH_Y, w: 120, d: BENCH_D, r: 3 };
  out.push(S(k.slabOf(B, 0, BENCH_TOP, P, 6, 0.8), { tone: "mid" }));
  out.push(D(k.corners(B, 4).map(([x, y]) => at([x, y, BENCH_TOP])), { size: 0.4 }));
  for (const unit of UNITS) {
    out.push(S(k.slabOf({ x: OX + COL[unit], y: BENCH_Y + 6, w: 28, d: 28, r: 2 }, BENCH_TOP, PAD_TOP - BENCH_TOP, P, 4, 0.3), { tone: "hi", crease: "lo" }));
    out.push(L(k.planOutline(colPlan(unit), PAD_TOP, P, 3), { tone: "mid" }));
    out.push(`<g data-line="${unit}">${k.wireSvg(at([colX(unit), BENCH_Y + BENCH_D, 0.2]), at([colX(unit), BOARD_Y - 0.6, 0.2]), { tone: "hi", size: 1.3 })}</g>`);
  }
  return out.join("");
}

// one column: the watts one workload draws from one part
function colSvg(plan, z, w, unit) {
  const h = w * WATT;
  if (h < 0.3) return "";                              // under a watt: thinner than a line at this scale, the empty pad says so
  return `<g data-res="${unit}">${k.solidSvg(k.slabOf(plan, z, h, P, 3, Math.min(0.6, h / 3)), { tone: "hi", crease: "none" })}</g>`;
}
const columns = (who, w) => UNITS.map((u) => `<g data-part="col-${who}-${u}">${colSvg(colPlan(u), PAD_TOP, w[u], u)}</g>`).join("");

// above each column, facing the reader: which part, and how many watts. The pair rides on the column's top
const tags = (who, w) => UNITS.map((u) => {
  const plan = colPlan(u), top = [colX(u), BENCH_Y + 20, PAD_TOP];
  const clear = at(top)[1] - at([plan.x, plan.y, PAD_TOP])[1] + 7;          // lift the lettering clear of the column's far corner
  return `<g data-part="tag-${who}-${u}" transform="translate(0 ${(-k.screenRise(w[u] * WATT, P)).toFixed(1)})">${up(top, LABEL[u], "unit", { res: u, dy: -clear - 14 })}${up(top, watts(w[u]), "val", { res: u, dy: -clear, part: `val-${who}-${u}` })}</g>`;
}).join("");

// under each bench, facing the reader: what it is, what it draws in total, and the share it was given
function caption(who, w) {
  const foot = [PLATE.x + PLATE.w, PLATE.y + PLATE.d, -PLATE_H - FOOT_H], mid = [at([0, 0, 0])[0], at(foot)[1]];
  const line = (s, cls, dy, part) => `<text class="up ${cls}"${part ? ` data-part="${part}"` : ""} x="${mid[0].toFixed(1)}" y="${(mid[1] + dy).toFixed(1)}" text-anchor="middle">${s}</text>`;
  return line(who === "ai" ? "AI WORKLOAD" : "NON-AI WORKLOAD", "kind", 22)
    + line(w.name, "name", 40, `name-${who}`)
    + line(w.total + " W", "total", 70, `total-${who}`)
    + line("2 cores · 4 GB · 1 GPU", "spec", 88);
}

const station = (who, w) => `<g data-station="${who}" transform="${k.translateAlong(P, PLACE[who])}"><g data-res="base">${plate()}</g>${bench()}${columns(who, w)}${board()}${tags(who, w)}${caption(who, w)}</g>`;

/* ---- dot fills: every face is the same screen grid, its tone is the size and colour of the dot ---- */
const PITCH = 2.6;
const ramps = {
  n: ["#35423c", "#465650", "#5a6b63", "#6f8178", "#899b91"],   // structure
  g: ["#1d3027", "#233a2f", "#2a4537", "#315040", "#395c49"],   // the boards
  d: ["#222c27", "#2a3630", "#323f39", "#3b4942", "#45544c"],   // the bench plate stays quiet
  c: ["#2f5140", "#3b6850", "#4a8263", "#5a9a76", "#72b98e"],   // CPU
  y: ["#6e5720", "#8a6a22", "#b08f38", "#cfa843", "#e8c45c"],   // GPU
  m: ["#2b4a63", "#35607f", "#437a9e", "#5390b6", "#6aa9cf"],   // memory
};
const HUE = { cpu: "#72b98e", gpu: "#e8c45c", mem: "#6aa9cf" };
const radii = [0.42, 0.56, 0.72, 0.9, 1.08];
const defs = `<defs>${Object.entries(ramps).map(([id, cols]) => cols.map((c, i) =>
  `<pattern id="${id}${i}" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse"><circle cx="${PITCH / 2}" cy="${PITCH / 2}" r="${radii[i]}" fill="${c}"/></pattern>`).join("")).join("")}</defs>`;
const fills = (sel, id) => [0, 1, 2, 3].map((i) => `${sel} .iso-shade[data-shade="${i}"]{fill:url(#${id}${i})}`).join("") + `${sel} .iso-top{fill:url(#${id}4)}`;
const CSS = `
.iso{--anatomy-page:#0a0f0d;--anatomy-card:#0a0f0d;--anatomy-paper:#0a0f0d;--anatomy-face:#0a0f0d;--anatomy-text:#93a199;--anatomy-strong:#e6ebe4;--anatomy-muted:#5d6b64;
  --anatomy-hi:#c9d4cd;--anatomy-mid:#7d8c84;--anatomy-lo:#55635c;--anatomy-faint:#36433d;--anatomy-lit:#e0b84c;--anatomy-dot:#c9d4cd}
.iso-plate{box-shadow:none;border:1px dotted #2c3833}
.iso-halo{display:none}
${fills(".iso-svg", "n")}${fills('.iso-svg [data-res="board"]', "g")}${fills('.iso-svg [data-res="base"]', "d")}${fills('.iso-svg [data-res="cpu"]', "c")}${fills('.iso-svg [data-res="gpu"]', "y")}${fills('.iso-svg [data-res="mem"]', "m")}
${UNITS.map((u) => `[data-res="${u}"] .iso-edge{stroke:${HUE[u]}}.iso-svg .iso-face-text[data-res="${u}"]{fill:${HUE[u]}}[data-line="${u}"] .iso-line{stroke:${HUE[u]};stroke-width:1.1px}[data-line="${u}"] circle{fill:${HUE[u]};stroke:${HUE[u]};opacity:1}`).join("")}
.iso-face-text{font-weight:600;letter-spacing:.06em}.iso-face-text[data-tone="hi"]{fill:#e6ebe4}.iso-face-text[data-tone="mid"]{fill:#b4c0b9}
.iso-svg .up{font-family:var(--anatomy-mono);font-weight:600;fill:#e6ebe4;letter-spacing:.02em}
.iso-svg .up.unit{font-size:10.5px}.iso-svg .up.val{font-size:12.5px}
${UNITS.map((u) => `.iso-svg .up[data-res="${u}"]{fill:${HUE[u]}}`).join("")}
.iso-svg .up.kind{font-size:11px;letter-spacing:.14em;fill:#93a199}.iso-svg .up.name{font-size:15px}.iso-svg .up.total{font-size:28px;letter-spacing:0}.iso-svg .up.spec{font-size:10.5px;fill:#93a199}
.iso-key i{display:inline-block;width:9px;height:9px;border-radius:50%}
.iso-stage{outline:none;cursor:pointer}.iso-stage:focus-visible{outline:1px dotted #93a199;outline-offset:6px}
`;

const first = AI[0];
const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT + FOOTER,
  label: "Two separate benches side by side, each with the same server board: CPU, GPU and memory. The left one runs an AI workload, the right one runs Node.js. Behind each board stand three columns for the watts drawn from CPU, GPU and memory, with the reading above each. Under each bench are its name, its total watts and the share it was given, which is the same for both.",
  body: [defs, station("ai", first), station("node", NODE)],
});

const live = `
const P = ${JSON.stringify(P)}, NODE = ${JSON.stringify(NODE)}, AI = ${JSON.stringify(AI)}, WATT = ${WATT}, PAD_TOP = ${PAD_TOP}, UNITS = ${JSON.stringify(UNITS)};
const PLANS = ${JSON.stringify(Object.fromEntries(UNITS.map((u) => [u, colPlan(u)])))};
const k = { solidSvg, slabOf };
const colSvg = ${colSvg.toString()};
const watts = ${watts.toString()};
const stage = document.querySelector(".iso-stage"), svg = stage.querySelector("svg"), readout = document.querySelector("[data-readout]");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const cols = Object.fromEntries(UNITS.map((u) => [u, part("col-ai-" + u)])), vals = Object.fromEntries(UNITS.map((u) => [u, part("val-ai-" + u)])), tags = Object.fromEntries(UNITS.map((u) => [u, part("tag-ai-" + u)]));
const nameEl = part("name-ai"), totalEl = part("total-ai");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let pick = 0, now = { cpu: AI[0].cpu, gpu: AI[0].gpu, mem: AI[0].mem }, frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idle = 0;
function draw() {
  const t = AI[pick];
  for (const u of UNITS) { cols[u].innerHTML = colSvg(PLANS[u], PAD_TOP, now[u], u); tags[u].setAttribute("transform", "translate(0 " + (-screenRise(now[u] * WATT, P)).toFixed(1) + ")"); const s = watts(now[u]); if (vals[u].textContent !== s) vals[u].textContent = s; }
  const total = Math.round(now.cpu + now.gpu + now.mem + t.sto) + " W";
  if (totalEl.textContent !== total) totalEl.textContent = total;
  if (nameEl.textContent !== t.name) nameEl.textContent = t.name;
  const text = t.name + " " + t.total + " W · Node.js " + NODE.total + " W · ≈" + (t.total / NODE.total).toFixed(1) + "×";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text); stage.setAttribute("aria-valuenow", String(pick + 1));
}
function tick(ms) {
  const dt = last ? Math.min((ms - last) / 1000, 1 / 30) : 1 / 60; last = ms;
  if (touring) { clock += dt; pick = Math.floor(clock / 3) % AI.length; }
  const goal = AI[pick], f = still.matches ? 1 : 1 - Math.exp(-dt / 0.3);
  let done = true;
  for (const u of UNITS) { now[u] += (goal[u] - now[u]) * f; if (Math.abs(goal[u] - now[u]) < 0.05) now[u] = goal[u]; else done = false; }
  draw();
  frame = visible && (touring || !done) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const choose = (i) => { touring = false; pick = (i + AI.length) % AI.length; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = pick * 3; run(); }, 5000); run(); };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("click", () => choose(pick + 1));
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "Enter") { e.preventDefault(); choose(pick + 1); }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); choose(pick - 1); }
});
const forced = new URLSearchParams(location.search).get("pick");
if (forced !== null) { touring = false; pick = +forced; now = { cpu: AI[pick].cpu, gpu: AI[pick].gpu, mem: AI[pick].mem }; }
draw();
`;

const key = (c, label) => `<span class="iso-key"><i style="background:${c}"></i>${label}</span>`;
let body = k.plateHtml({
  fig: "Fig 1",
  title: "Same share, different energy",
  hint: "Click or arrow keys: next AI workload",
  readout: `${first.name} ${first.total} W · Node.js ${NODE.total} W · ≈${(first.total / NODE.total).toFixed(1)}×`,
  caption: "Two workloads are each given the same share of a server: 2 cores, 4 GB of memory, 1 GPU. Billing by allocation charges them the same. The columns show what each one actually draws from each part when it runs alone, at 2 W per unit of height. The AI workload leans on the GPU, the web server on the CPU, and memory costs both the same because it is paid for by the amount held. YOLO also draws about 7 W through storage, which is in its total but not drawn.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Energy bench: arrow keys change the AI workload" aria-valuemin="1" aria-valuemax="${AI.length}" aria-valuenow="1">${svg}</div>`,
});
body = body.replace('<span class="iso-caption">', `<span class="iso-keys">${key(HUE.cpu, "CPU")}${key(HUE.gpu, "GPU")}${key(HUE.mem, "Memory")}</span><span class="iso-caption">`);
const html = k.pageHtml({ title: "Energy cost model", theme: "dark", body, script: kitScript() + live, width: 820 }).replace("</style>", CSS + "</style>");
writeFileSync(join(HERE, "energy-bench.html"), html);
console.log("wrote energy-bench.html", html.length);

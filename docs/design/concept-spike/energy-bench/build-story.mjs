// Energy cost model, told by scrolling: the two separate benches of Fig 1 slide together into one server,
// a wall meter gives one number, and the model splits it part by part while the formula builds underneath.
// Numbers: Mathematics-energy.pdf. Stated in the text: Node.js 14 W and ResNet 145 W alone (workload-induced), GPU share 93 %,
// CPU 9 W, memory 0.2 W/GB x 4 GB, attribution error 0.1-0.4 % (AI) and 0.4-4.1 % (Node.js).
// Read off the charts (Fig. 6 and 7, so approximate): 235 W at the wall for ResNet + Node.js, attributed 143 W and 13 W.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const KIT = process.env.ANATOMY_KIT ?? join(homedir(), ".claude/skills/anatomy");   // the anatomy skill's folder (MIT). Set ANATOMY_KIT if it lives elsewhere
const k = await import(`${KIT}/kit/iso-kit.mjs`);
const { kitScript } = await import(`${KIT}/scripts/inline-kit.mjs`);
const HERE = dirname(fileURLToPath(import.meta.url));

/* ---- the model: watts each workload draws when it runs alone on the same slice (2 cores, 4 GB, 1 GPU) ---- */
const SOLO = { ai: { name: "ResNet", cpu: 9, gpu: 135, mem: 0.8, total: 145 }, node: { name: "Node.js", cpu: 13, gpu: 0, mem: 0.8, total: 14 } };
const SHARED = { ai: { cpu: 8, gpu: 134, mem: 0.8, total: 143 }, node: { cpu: 12.5, gpu: 0, mem: 0.8, total: 13 } };
const WALL = 235, BASELINE = WALL - SHARED.ai.total - SHARED.node.total;
const SPREAD_APART = 102, SPREAD_JOINED = 85.6;    // joined: the two plates touch and read as one machine
const METER = { x: 30, y: 46, w: 40, d: 28, r: 3 };  // the wall meter sits in the corner the joined plates leave open
// tall screens: the benches stand one above the other (one behind the other in the scene) so each can be drawn large
const TALL_APART = 112, TALL_JOINED = 88.6, METER_T = { x: -95, y: 22, w: 38, d: 26, r: 3 };
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
const rad = AZIMUTH * Math.PI / 180, SPREAD = SPREAD_APART;   // the two benches sit side by side at the same depth
const PLACE = { ai: [-Math.sin(rad) * SPREAD, Math.cos(rad) * SPREAD, 0], node: [Math.sin(rad) * SPREAD, -Math.cos(rad) * SPREAD, 0] };

const P = k.fitProjection(
  Object.values(PLACE).flatMap(([dx, dy]) => [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [colX("gpu"), BENCH_Y + 9, PAD_TOP + 135 * WATT + 16]].map(([x, y, z]) => [x + dx, y + dy, z])).concat([[METER.x + METER.w, METER.y + METER.d, 0]]),
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

// lettering for each bench, facing the reader. Wide screens: centred underneath, with the share it was given
function caption(who, w) {
  const foot = [PLATE.x + PLATE.w, PLATE.y + PLATE.d, -PLATE_H - FOOT_H], mid = [at([0, 0, 0])[0], at(foot)[1]];
  const line = (s, cls, dy, part) => `<text class="up ${cls}"${part ? ` data-part="${part}"` : ""} x="${mid[0].toFixed(1)}" y="${(mid[1] + dy).toFixed(1)}" text-anchor="middle">${s}</text>`;
  return `<g class="only-wide">${line(who === "ai" ? "AI WORKLOAD" : "NON-AI WORKLOAD", "kind", 22)
    + line(w.name, "name", 40, `name-${who}`)
    + line(w.total + " W", "total", 70, `total-${who}`)
    + line("2 cores · 4 GB · 1 GPU", "spec", 88)}</g>`;
}
// Tall screens: tucked into the empty corner beside each plate (top left for the upper bench, bottom right for the lower)
function captionTall(who, w) {
  const top = who === "ai";
  const x = top ? at([PLATE.x, PLATE.y + PLATE.d, 0])[0] : at([PLATE.x + PLATE.w, PLATE.y, 0])[0];
  const y = top ? at([PLATE.x, PLATE.y, 0])[1] : at([PLATE.x + PLATE.w, PLATE.y + PLATE.d, -PLATE_H - FOOT_H])[1];
  const line = (s, cls, dy, part) => `<text class="up ${cls}"${part ? ` data-part="${part}"` : ""} x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${top ? "start" : "end"}">${s}</text>`;
  return `<g class="only-tall">${top
    ? line("AI WORKLOAD", "kind", 2) + line(w.name, "name", 20, "name-ai-t") + line(w.total + " W", "total", 46, "total-ai-t")
    : line("NON-AI", "kind", -34) + line(w.name, "name", -17, "name-node-t") + line(w.total + " W", "total", 10, "total-node-t")}</g>`;
}

const station = (who, w) => `<g data-station="${who}" transform="${k.translateAlong(P, PLACE[who])}"><g data-res="base">${plate()}</g>${bench()}${columns(who, w)}${board()}${tags(who, w)}${caption(who, w)}${captionTall(who, w)}</g>`;

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


// the wall meter: a clamp box with a lead to each half of the machine
function meter(M, leads, cls, lettering) {
  const out = leads.map(([a, b]) => k.wireSvg(at([a[0], a[1], 0.2]), at([b[0], b[1], 0.2]), { tone: "hi", size: 1.3 }));
  out.push(S(k.slabOf(M, 0, 12, P, 5, 0.8), { tone: "hi" }));
  out.push(L(k.planOutline({ x: M.x + 5, y: M.y + 5, w: M.w - 10, d: 11, r: 1 }, 12, P, 3), { tone: "mid" }));          // display window
  out.push(L(k.ring(M.x + M.w - 8, M.y + M.d - 6, 2.6, 12, P, 16), { tone: "mid" }));
  out.push(D(k.corners(M, 3).map(([x, y]) => at([x, y, 12])), { size: 0.4, tone: "hi" }));
  return `<g data-part="${cls}" class="only-${cls.split("-")[1]}" style="opacity:0">${out.join("")}${lettering}</g>`;
}
const [wx, wy] = at([METER.x + 20, METER.y + 14, 12]);
const meterWide = meter(METER, [[[METER.x, METER.y + 14], [-0.6, METER.y + 14]], [[METER.x + 20, METER.y], [METER.x + 20, 29.2]]], "meter-wide",
  `<text class="up total" x="${wx.toFixed(1)}" y="${(wy + 52).toFixed(1)}" text-anchor="middle">${WALL} W</text><text class="up spec" x="${wx.toFixed(1)}" y="${(wy + 68).toFixed(1)}" text-anchor="middle">at the wall</text>`);
const tx = at([METER_T.x, METER_T.y + METER_T.d, 0])[0] - 6, ty = at([METER_T.x + METER_T.w, METER_T.y + METER_T.d, 0])[1];
const meterTall = meter(METER_T, [[[METER_T.x + 19, METER_T.y], [METER_T.x + 19, 0.6]], [[METER_T.x + METER_T.w, METER_T.y + 13], [-25.7, METER_T.y + 13]]], "meter-tall",
  `<text class="up spec" x="${tx.toFixed(1)}" y="${(ty + 15).toFixed(1)}" text-anchor="start">at the wall</text><text class="up total" x="${tx.toFixed(1)}" y="${(ty + 38).toFixed(1)}" text-anchor="start">${WALL} W</text>`);
const [jx, jy] = at([0, 0, PAD_TOP + 135 * WATT + 30]);
const joined = `<text data-part="one" class="up kind only-wide" x="${jx.toFixed(1)}" y="${jy.toFixed(1)}" text-anchor="middle" style="opacity:0">ONE SERVER</text>`;

// the frame for tall screens: both benches one above the other, at their widest spacing
const DEP = [Math.cos(rad), Math.sin(rad)];
const tallPts = [-1, 1].flatMap((sgn) => k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0).map(([x, y, z]) => at([x + sgn * DEP[0] * TALL_APART, y + sgn * DEP[1] * TALL_APART, z])))
  .concat([at([colX("gpu") - DEP[0] * TALL_APART, BENCH_Y + 9 - DEP[1] * TALL_APART, PAD_TOP + 135 * WATT])], k.boxCorners(METER_T, 0, 12).map(at));
const bx = tallPts.map((q) => q[0]), by = tallPts.map((q) => q[1]);
const VB_TALL = [Math.min(...bx) - 16, Math.min(...by) - 46, Math.max(...bx) - Math.min(...bx) + 28, Math.max(...by) - Math.min(...by) + 46 + 30].map((v) => +v.toFixed(1)).join(" ");
const VB_WIDE = `0 0 ${WIDTH} ${HEIGHT + FOOTER}`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT + FOOTER,
  label: "Two benches with identical server boards, an AI workload and Node.js, each with three columns for CPU, GPU and memory watts. As the page scrolls they join into one server with a single wall meter, and the columns refill one part at a time as the model splits the measured energy.",
  body: [defs, station("ai", SOLO.ai), station("node", SOLO.node), meterWide, meterTall, joined],
});

/* ---- the formula, typeset with KaTeX (the site already ships it for the blog) ---- */
const REPO = join(HERE, "..", "..", "..", "..");
const katex = (await import(`${REPO}/node_modules/katex/dist/katex.mjs`)).default;
const KATEX_VERSION = JSON.parse(readFileSync(`${REPO}/node_modules/katex/package.json`, "utf8")).version;   // the stylesheet must be the same version as the markup
const tex = (s) => katex.renderToString("\\displaystyle " + s, { throwOnError: true });
const T = (s) => `\\text{${s}}`;
const share = (unit) => `\\frac{U^{${T(unit)}}_{i}}{\\sum_{j} U^{${T(unit)}}_{j}}`;
const active = (unit) => `\\left(E^{${T(unit)}} - E^{${T(unit)}}_{${T("idle")}}\\right)\\cdot${share(unit)}`;
const CORE = { cpu: active("cpu"), gpuBase: `E^{${T("gpu")}}_{${T("idle")}}\\cdot a_i`, gpuAct: active("gpu"), mem: `E^{${T("mem")}}_{${T("idle")}}\\cdot\\frac{m_i}{M}` };
const brace = (core, label) => `\\underbrace{${core}}_{${T(label)}}`;
const term = (unit, label, wide, tall) => `<span class="term" data-term="${unit}"><span class="lab">${label}</span><span class="m wide">${tex(wide)}</span><span class="m tall">${tex(tall)}</span></span>`;
const plus = (unit) => `<span class="plus" data-term="${unit}">${tex("+")}</span>`;
const formula = `
<div class="formula" aria-label="The attribution formula, built up one part at a time">
  <span class="lhs">${tex("E_{w_i} =")}</span>
  ${term("cpu", "CPU · by use", brace(CORE.cpu, "CPU: by use"), CORE.cpu)}
  ${plus("gpu")}
  ${term("gpu", "GPU · reserved, plus used", brace(CORE.gpuBase, "GPU: reserved") + " + " + brace(CORE.gpuAct, "GPU: used"), CORE.gpuBase + " + " + CORE.gpuAct)}
  ${plus("mem")}
  ${term("mem", "memory · by amount held", brace(CORE.mem, "memory: by amount held"), CORE.mem)}
  <span class="check" data-term="sum"><span class="m">${tex(`E^{${T("sys")}} = E^{${T("baseline")}} + \\sum_{i} E_{w_i}`)}</span><span class="arrow">measured</span><span class="m">${tex(`${WALL} \\approx ${BASELINE} + ${SHARED.ai.total} + ${SHARED.node.total}\\ ${T("W")}`)}</span></span>
</div>`;

const steps = [
  ["Same share, different energy.", ["Two workloads, each given the same slice of a server: 2 cores, 4 GB, 1 GPU.", "Run alone, one draws 145&nbsp;W and the other 14&nbsp;W.", "Billing by allocation charges them the same."]],
  ["But they share one machine.", ["Put both on the same server and the meter reads one number.", `${WALL}&nbsp;W at the wall: both workloads, plus the machine itself.`, "Who used what?"]],
  ["CPU: by use.", ["The chip reports its own energy.", "Take off what it burns idle, then split the rest by how busy each workload kept it."]],
  ["GPU: reserved, plus used.", ["A GPU held for you costs energy even while it waits, so that part follows the reservation.", "The rest follows use."]],
  ["Memory: by what you hold.", ["Memory draws the same whether or not it is read.", "So it is charged by the amount held, not by activity."]],
  ["One rule per part, one number per workload.", ["The three parts add up to each workload's energy.", "Checked against each workload measured alone, the split is within 0.4&nbsp;% for the AI workloads and 4.1&nbsp;% for Node.js.", "What is left over is the machine's own baseline."]],
];
const MORE = `<p class="more fade"><a href="../index.html">More detail →</a><a href="../../index.html">All experience</a></p>`;   // the last scene hands over to the write-up
const words = steps.map(([h, lines], i) => `<section class="step"><${i ? "h2" : "h1"} data-split>${h}</${i ? "h2" : "h1"}><p class="body">${lines.map((l) => `<span class="ln fade">${l}</span>`).join("")}</p>${i === steps.length - 1 ? MORE : ""}</section>`).join("");
const crumb = `<p class="crumb"><span><a href="../../../index.html">Rainyforest</a> / <a href="../../index.html">Experience</a> / Energy cost model</span><a href="../index.html">Write-up →</a></p>`;

const TALL_Q = "(max-width: 44rem), (max-aspect-ratio: 4/5)";
const PAGE_CSS = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#0a0f0d;color:#e6ebe4;font:400 clamp(.94rem,.9rem + .2vw,1.06rem)/1.6 "Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif}
.story{position:relative;height:calc(var(--n) * 100svh)}
/* wide: the figure is the page; the words stand in a slim column beside it and the formula runs underneath */
.stage{position:sticky;top:0;height:100svh;overflow:hidden;display:grid;grid-template-columns:minmax(14rem,22rem) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;gap:.25rem 1.5rem;padding:.75rem clamp(16px,3vw,40px) 1rem}
.crumb{grid-column:1 / -1;grid-row:1;margin:0;display:flex;justify-content:space-between;gap:1rem;font:500 .78rem/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#5d6b64}.crumb a{color:#93a199;text-decoration:none}.crumb a:hover{color:#e6ebe4}
.words{position:relative;grid-column:1;grid-row:2;align-self:center;min-height:19rem}
.fig{grid-column:2;grid-row:2;min-height:0;position:relative}.fig .iso-svg{position:absolute;inset:0;width:100%;height:100%}
.step{position:absolute;inset:0 0 auto 0;pointer-events:none}.step.on{pointer-events:auto}
.step .more{margin:1rem 0 0;display:flex;flex-wrap:wrap;gap:.4rem 1.4rem;font-size:.9rem}.step .more a{color:#e6ebe4;text-underline-offset:.3em;text-decoration-style:dotted}.step .more a + a{color:#93a199}
.step h1,.step h2{margin:0;font-size:clamp(1.5rem,1rem + 1.7vw,2.4rem);font-weight:700;line-height:1.08;letter-spacing:-.03em}
.step p.body{margin:.7rem 0 0;color:#93a199;line-height:1.45}.body .ln{display:block;text-wrap:balance}.body .ln + .ln{margin-top:.4em}
.ch{display:inline-block;opacity:0;transform:translateY(.45em);transition:opacity .25s linear,transform .25s linear}.w{display:inline-block;white-space:nowrap}
.fade{opacity:0;transform:translateY(.7rem);transition:opacity .25s linear,transform .25s linear}
.step.on .ch{opacity:1;transform:none;transition:opacity .55s cubic-bezier(.2,.7,.2,1) calc(var(--i) * 26ms),transform .7s cubic-bezier(.2,.7,.2,1) calc(var(--i) * 26ms)}
.step.on .fade{opacity:1;transform:none;transition:opacity .7s cubic-bezier(.2,.7,.2,1) calc(.25s + var(--i) * .12s),transform .8s cubic-bezier(.2,.7,.2,1) calc(.25s + var(--i) * .12s)}

.formula{grid-column:1 / -1;display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:.5rem .6em;min-height:8.2em;padding-top:.9rem;border-top:1px dotted #2c3833;font-size:clamp(.82rem,.6rem + .58vw,1.1rem);color:#e6ebe4}
.formula .katex{font-size:1.24em}
.formula .lab,.formula .m.tall{display:none}
.formula [data-term]{opacity:0;transform:translateY(.6rem);transition:opacity .55s cubic-bezier(.2,.7,.2,1),transform .65s cubic-bezier(.2,.7,.2,1)}
.formula [data-term].on{opacity:1;transform:none}
.formula .lhs{opacity:.3;transition:opacity .5s}.formula.started .lhs{opacity:1}
${UNITS.map((u) => `.formula .term[data-term="${u}"]{color:${HUE[u]}}`).join("")}
.formula .check{flex-basis:100%;display:flex;justify-content:center;align-items:baseline;gap:1.1em;color:#93a199;font-size:.86em;margin-top:.1rem}
.formula .check .arrow{font:500 .72em/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:#5d6b64}
.formula .check .m:last-child{color:#e6ebe4}

.iso-svg .up{paint-order:stroke;stroke:#0a0f0d;stroke-width:3.2px;stroke-linejoin:round}
.only-tall{display:none}
.ticks{position:absolute;right:calc(clamp(16px,3vw,40px) / 2);top:42%;transform:translate(50%,-50%);display:grid;gap:.6rem}
.ticks span{width:5px;height:5px;border-radius:50%;background:#5d6b64;transition:background .3s,transform .3s}.ticks span.on{background:#e0b84c;transform:scale(1.6)}
.after{padding:clamp(3rem,8vw,6rem) clamp(16px,4vw,48px) 1rem;max-width:44rem}.after h2{margin:0;font-size:clamp(1.4rem,1rem + 1.6vw,2.1rem);letter-spacing:-.02em}.after p{color:#93a199;margin:.7rem 0 0}.after .links{display:flex;flex-wrap:wrap;gap:.4rem 1.6rem;margin-top:1.3rem}.after .links a{color:#e6ebe4;text-underline-offset:.3em;text-decoration-style:dotted}.after .links a + a{color:#93a199}
footer{padding:2rem clamp(16px,4vw,48px) 3rem;color:#5d6b64;font-size:.8rem}

/* tall: words, then the figure with the benches one above the other, then the formula one term per line */
@media ${TALL_Q}{
  .stage{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;gap:.4rem;padding:.7rem 16px .9rem}
  .words{grid-column:1;grid-row:2;align-self:start;min-height:12.6rem}.fig{grid-column:1;grid-row:3}
  .step h1,.step h2{font-size:clamp(1.45rem,1.1rem + 1.8vw,2rem)}.step p.body{margin-top:.5rem}
  .only-wide{display:none}.only-tall{display:inline}
  .iso-svg .only-tall .total{font-size:22px}
  .formula{grid-column:1;display:grid;grid-template-columns:auto minmax(0,1fr);justify-content:start;align-items:end;gap:.3rem .5em;min-height:10.4rem;align-content:start;padding-top:.6rem;font-size:.8rem}
  .formula .m.wide{display:none}.formula .m.tall{display:inline}
  .formula .lhs,.formula .plus{align-self:end;padding-bottom:.15em}
  .formula .check{grid-column:1 / -1;justify-content:flex-start;flex-wrap:wrap;gap:.2rem .8em;margin-top:.25rem}
  .ticks{top:50%}
}
.nofx .ch,.nofx .fade,.nofx .formula [data-term],.nofx .formula .lhs{transition:none!important}
@media (prefers-reduced-motion:reduce){.ch,.fade,.step.on .ch,.step.on .fade,.formula [data-term]{transition:opacity .2s linear;transform:none}}
`;

const live = `
const P = ${JSON.stringify(P)}, WATT = ${WATT}, PAD_TOP = ${PAD_TOP}, UNITS = ${JSON.stringify(UNITS)}, SOLO = ${JSON.stringify(SOLO)}, SHARED = ${JSON.stringify(SHARED)};
const PLANS = ${JSON.stringify(Object.fromEntries(UNITS.map((u) => [u, colPlan(u)])))}, RAD = ${rad};
const SPACING = { wide: [${SPREAD_APART}, ${SPREAD_JOINED}], tall: [${TALL_APART}, ${TALL_JOINED}] }, VIEW = { wide: "${VB_WIDE}", tall: "${VB_TALL}" };
const k = { solidSvg, slabOf };
const colSvg = ${colSvg.toString()};
const watts = ${watts.toString()};
const story = document.querySelector(".story"), stage = story.querySelector(".stage"), svg = stage.querySelector("svg"), N = ${steps.length};
const stepEls = [...stage.querySelectorAll(".step")], ticks = [...stage.querySelectorAll(".ticks span")], formula = stage.querySelector(".formula");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const WHO = ["ai", "node"], el = {};
for (const who of WHO) { el[who] = { g: svg.querySelector('[data-station="' + who + '"]'), totals: [part("total-" + who), part("total-" + who + "-t")] }; for (const u of UNITS) el[who][u] = { col: part("col-" + who + "-" + u), tag: part("tag-" + who + "-" + u), val: part("val-" + who + "-" + u) }; }
const meters = [part("meter-wide"), part("meter-tall")], one = part("one");
for (const h of stage.querySelectorAll("[data-split]")) {
  const ws = h.textContent.trim().split(/\\s+/); let i = 0; h.setAttribute("aria-label", ws.join(" ")); h.textContent = "";
  ws.forEach((word, wi) => { const w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden", "true");
    for (const ch of word) { const c = document.createElement("span"); c.className = "ch"; c.style.setProperty("--i", i++); c.textContent = ch; w.appendChild(c); }
    h.appendChild(w); if (wi < ws.length - 1) h.appendChild(document.createTextNode(" ")); });
}
for (const st of stepEls) [...st.querySelectorAll(".fade")].forEach((e, i) => e.style.setProperty("--i", i));
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), ramp = (p, a, b) => clamp((p - a) / (b - a)), ease = (t) => t * t * (3 - 2 * t);
const SHOW = { cpu: 1.55, gpu: 2.55, mem: 3.55 };                    // when each part's rule arrives
const still = matchMedia("(prefers-reduced-motion: reduce)"), tallQ = matchMedia("${TALL_Q}"), forced = new URLSearchParams(location.search).get("p");
if (forced !== null) document.documentElement.classList.add("nofx");
let p = 0, raf = 0, last = 0, mode = "";
const target = () => { if (forced !== null) return clamp(parseFloat(forced), 0, N - 1); const b = story.getBoundingClientRect(); return clamp(-b.top / Math.max(1, b.height - innerHeight)) * (N - 1); };
function draw() {
  const now = tallQ.matches ? "tall" : "wide";
  if (now !== mode) { mode = now; svg.setAttribute("viewBox", VIEW[mode]); }
  const [apart, joinedAt] = SPACING[mode], sep = apart + (joinedAt - apart) * ease(ramp(p, 0.45, 1.0));
  // wide: side by side at the same depth. tall: one behind the other, so they stack up the screen
  const dir = mode === "wide" ? [Math.sin(RAD), -Math.cos(RAD)] : [Math.cos(RAD), Math.sin(RAD)];
  WHO.forEach((who, i) => {
    const sgn = i ? 1 : -1;
    el[who].g.setAttribute("transform", translateAlong(P, [sgn * dir[0] * sep, sgn * dir[1] * sep, 0]));
    for (const u of UNITS) {
      const v = p < SHOW[u] ? SOLO[who][u] * (1 - ease(ramp(p, 0.45, 0.95))) : SHARED[who][u] * ease(ramp(p, SHOW[u], SHOW[u] + 0.4));
      el[who][u].col.innerHTML = colSvg(PLANS[u], PAD_TOP, v, u);
      el[who][u].tag.setAttribute("transform", "translate(0 " + (-screenRise(v * WATT, P)).toFixed(1) + ")");
      const s = p < 0.7 ? watts(SOLO[who][u]) : p < SHOW[u] + 0.2 ? "?" : watts(SHARED[who][u]);
      if (el[who][u].val.textContent !== s) el[who][u].val.textContent = s;
    }
    const t = p < 0.7 ? SOLO[who].total + " W" : p < 4.55 ? "?" : "≈" + SHARED[who].total + " W";
    for (const e of el[who].totals) if (e.textContent !== t) e.textContent = t;
  });
  const shared = ease(ramp(p, 0.75, 1.1));
  for (const m of meters) m.style.opacity = shared;
  one.style.opacity = shared;
  stepEls.forEach((st, i) => st.classList.toggle("on", Math.abs(p - i) < 0.42));
  ticks.forEach((tk, i) => tk.classList.toggle("on", Math.round(p) === i));
  formula.classList.toggle("started", p > 1.5);
  for (const e of formula.querySelectorAll("[data-term]")) e.classList.toggle("on", p > ({ cpu: 1.5, gpu: 2.5, mem: 3.5, sum: 4.5 })[e.dataset.term]);
}
function frame(ms) {
  raf = 0;
  const dt = Math.min(0.05, (ms - last) / 1000 || 0); last = ms;
  const goal = target();
  p = still.matches || forced !== null ? goal : p + (goal - p) * (1 - Math.exp(-dt * 5.5));
  if (Math.abs(goal - p) < 0.0005) p = goal;
  draw();
  if (p !== goal) raf = requestAnimationFrame(frame);
}
const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
addEventListener("scroll", kick, { passive: true }); addEventListener("resize", kick); tallQ.addEventListener("change", kick);
kick();
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Energy cost model, in six scenes — Rainyforest</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css">
<style>${k.ISO_CSS}${CSS}${PAGE_CSS}</style></head><body class="iso" data-theme="dark">
<main class="story" style="--n:${steps.length}"><div class="stage">
${crumb}
<div class="words">${words}</div>
<div class="fig">${svg}</div>
${formula}
<div class="ticks" aria-hidden="true">${steps.map(() => "<span></span>").join("")}</div>
</div></main>
<section class="after"><h2>The picture is the short version.</h2><p>The write-up has the rest: whose decision this helps, the objects and their relations, the trade-offs, what broke, and how the result was checked.</p><p class="links"><a href="../index.html">More detail →</a><a href="../../index.html">All experience</a><a href="../../../index.html">Home</a></p></section>
<footer>A preview. The 235 W, 143 W and 13 W are read off the paper's charts and are approximate.</footer>
<script type="module">${(kitScript() + live).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
const OUT = join(HERE, "..", "work", "energy-cost-model", "story");
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), html);
console.log("wrote work/energy-cost-model/story/index.html", html.length);

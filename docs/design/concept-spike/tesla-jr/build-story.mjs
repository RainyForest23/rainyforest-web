// Tesla Jr., told by scrolling: a car that steers like a car, sees only through cameras and has no map.
// Seven scenes, one per stage of the stack, each named with the piece of software that does it:
// the simulator · stereo depth to points · Nav2 costmap (voxel layer, inflation) · Smac Hybrid-A* · MPPI · the conversion node · the run.
// Every number comes from the project's own records (github.com/RainyForest23/tesla-jr: README, docs/PROGRESS.md,
// docs/TRIAL_AND_ERROR.md, isaac/scripts/ackermann_control.py, nav2/teslajr_nav2.yaml).
// The search tree and the controller's rollouts are drawn by small re-implementations below, with the project's own
// settings (turning radius 1.0 m, 72 headings, inflation 0.55 m; 40 steps of 0.05 s). They show how the methods work;
// they are not Nav2's logs. The sharp-cornered first path is a sketch.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const KIT = process.env.ANATOMY_KIT ?? join(homedir(), ".claude/skills/anatomy");   // the anatomy skill's folder (MIT)
const k = await import(`${KIT}/kit/iso-kit.mjs`);
const { kitScript } = await import(`${KIT}/scripts/inline-kit.mjs`);
const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, "..", "..", "..", "..");
const katex = (await import(`${REPO}/node_modules/katex/dist/katex.mjs`)).default;
const KATEX_VERSION = JSON.parse(readFileSync(`${REPO}/node_modules/katex/package.json`, "utf8")).version;

/* ---- the facts ---- */
const CAR = { wheelBase: 0.65, wheelRadius: 0.12, maxSteer: 0.6, length: 1.0, width: 0.6, minTurn: 1.0 };   // metres, radians
const OBST = [[5, 0.7], [9, -0.7]], GOAL = 11, STOP = 10.81;                         // the recorded avoidance run
const pathY = (x) => -0.13 * Math.exp(-(((x - 5) / 1.6) ** 2)) + 0.12 * Math.exp(-(((x - 9) / 1.6) ** 2));   // 0.13 m right, then 0.12 m left
const CMD = { v: 0.4, w: 0.2 };                                                      // the example command used in the project's run book
const steer = Math.atan(CAR.wheelBase * CMD.w / CMD.v), spin = CMD.v / CAR.wheelRadius;

/* ---- the methods, re-implemented small, with the project's settings ---- */
const NAV = { cell: 0.25, inflation: 0.55, lethal: 0.25, minHeight: [0.15, 0.35], bins: 72, radius: 1.0, tolerance: 0.35, batch: 1000, steps: 40, dt: 0.05, vmax: 0.7, range: 6.0 };
const BUMP = { cmd: 0.05, speed: 0.03, time: 1.0, dist: 0.7 };                        // the virtual bumper's thresholds, from ackermann_control.py
const FIRST = [OBST[0]];                                                             // what is known at the start: the second obstacle is past the 6 m the costmap marks
const pathA = (x) => -0.13 * Math.exp(-(((x - 5) / 1.6) ** 2));                      // the first plan: only the first obstacle
const SEE = OBST[1][0] - NAV.lethal - NAV.range;                                     // where the camera is when the second obstacle comes into range: 2.75 m
const distTo = (x, y, obst) => Math.min(...obst.map(([ox, oy]) => Math.max(Math.abs(x - ox), Math.abs(y - oy)) - NAV.lethal));   // to the nearest known obstacle's face
const costAt = (x, y, obst) => { const d = distTo(x, y, obst); return d <= 0 ? 1 : d >= NAV.inflation ? 0 : Math.exp(-3.0 * d) * 0.9; };   // cost_scaling_factor 3.0
// Hybrid-A*: states are (x, y, heading); from each, three short arcs a car can drive: left at the tightest turn, straight, right
function hybridAStar(start, obst) {
  const step = 0.5, key = (n) => Math.round(n.x / 0.25) + "," + Math.round(n.y / 0.25) + "," + Math.round(n.th / (2 * Math.PI / NAV.bins));
  const open = [{ ...start, g: 0, f: 0, parent: null }], seen = new Set(), edges = [];
  while (open.length && edges.length < 900) {
    open.sort((a, b) => a.f - b.f); const n = open.shift();
    if (seen.has(key(n))) continue; seen.add(key(n));
    if (n.parent) edges.push(n);
    if (Math.hypot(n.x - GOAL, n.y) < NAV.tolerance) return edges;
    for (const kappa of [1 / NAV.radius, 0, -1 / NAV.radius]) {
      const th = n.th + kappa * step, x = n.x + step * Math.cos(n.th + kappa * step / 2), y = n.y + step * Math.sin(n.th + kappa * step / 2), c = costAt(x, y, obst);
      if (c >= 1 || Math.abs(y) > 1.7 || x < 0) continue;
      const g = n.g + step * (1 + 6 * c) + (kappa ? 0.06 : 0);
      open.push({ x, y, th, g, f: g + Math.hypot(GOAL - x, y) * 1.05, parent: n, kappa });
    }
  }
  return edges;
}
const SEARCH = hybridAStar({ x: 0.8, y: 0, th: 0 }, FIRST), SEARCH2 = hybridAStar({ x: SEE, y: pathA(SEE), th: 0 }, OBST);
// MPPI: many short futures, each a noisy sequence of turn rates rolled forward through a car model; the cheapest wins
function rollouts(count, from, obst, ref, seed) {
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; }, out = [];
  for (let i = 0; i < count; i++) {
    let { x, y, th } = from, w = rnd() * 1.4, cost = 0; const pts = [[x, y]];
    for (let t = 0; t < NAV.steps; t++) {
      w = Math.max(-NAV.vmax / NAV.radius, Math.min(NAV.vmax / NAV.radius, w + rnd() * 0.5));
      th += w * NAV.dt; x += NAV.vmax * NAV.dt * Math.cos(th); y += NAV.vmax * NAV.dt * Math.sin(th);
      cost += costAt(x, y, obst) * 4 + Math.abs(y - ref(x)) * 0.6;
      if (t % 4 === 3) pts.push([x, y]);
    }
    out.push({ pts, cost });
  }
  return out.sort((a, b) => b.cost - a.cost);                              // cheapest last, so it is drawn on top
}
const ROLL_FROM = { x: 1.4, y: 0, th: 0 }, ROLL = rollouts(44, ROLL_FROM, FIRST, pathA, 7);

/* ---- drawing helpers ---- */
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const part = (name, body, show = false) => `<g data-part="${name}" style="opacity:${show ? 1 : 0}">${body}</g>`;
const hullOf = (pts) => {                                  // outline of a set of screen points
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => { const h = []; for (const q of list) { while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  return [...half(p), ...half(p.reverse())];
};
// a wheel: a short cylinder lying on its side, turned by `yaw` about the vertical
function wheelSvg(P, cx, cy, r, w, yaw) {
  const ax = [-Math.sin(yaw), Math.cos(yaw)], fw = [Math.cos(yaw), Math.sin(yaw)], disc = (side) => Array.from({ length: 28 }, (_, i) => {
    const t = i / 28 * 6.2832; return iso([cx + ax[0] * side * w / 2 + fw[0] * r * Math.cos(t), cy + ax[1] * side * w / 2 + fw[1] * r * Math.cos(t), r + r * Math.sin(t)], P);
  });
  const near = depthOf([cx + ax[0], cy + ax[1], r], P) > depthOf([cx - ax[0], cy - ax[1], r], P) ? 1 : -1, a = disc(near), b = disc(-near);
  const d = (pts) => "M" + pts.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L") + "Z", hub = disc(near).map((q, i, all) => { const c = iso([cx + ax[0] * near * w / 2, cy + ax[1] * near * w / 2, r], P); return [c[0] + (q[0] - c[0]) * 0.42, c[1] + (q[1] - c[1]) * 0.42]; });
  return `<g class="iso-solid"><path class="iso-fill" d="${d(hullOf([...a, ...b]))}"/><path class="iso-shade" data-shade="1" d="${d(hullOf([...a, ...b]))}"/><path class="iso-top" d="${d(a)}"/><path class="iso-line" data-tone="hi" d="${d(hullOf([...a, ...b]))}${d(a)}"/><path class="iso-line" data-tone="mid" d="${d(hub)}"/></g>`;
}
const { iso, depthOf } = k;

/* ---- figure A: the course, as the simulator shows it: a ground grid, world axes, the robot. 30 units to the metre ---- */
const U = 30, FLOOR = { x: -1.3 * U, y: -2 * U, w: 13.6 * U, d: 4 * U, r: 4 };
function course(P, id) {
  const at = (x, y, z = 0) => iso([x * U, y * U, z * U], P), pt = (x, y, z = 0) => at(x, y, z).map((v) => v.toFixed(1)).join(" ");
  const line = (cls, ...pts) => `<path class="${cls}" d="M${pts.map((q) => pt(...q)).join("L")}"/>`;
  const circle = (q, r, cls, extra = "") => `<circle class="${cls}" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${r}"${extra}/>`;
  const label = (x, y, text, size = 7, tone = "hi") => k.faceTextSvg(k.topMatrix([x * U, y * U], 0, P, "x"), text, { size, tone });
  const out = [`<g data-res="base">${S(k.slabOf(FLOOR, -4, 4, P, 5, 1), { tone: "mid" })}</g>`];
  // ground grid: a line every half metre, a stronger one every metre
  const grid = [[], []];
  for (let i = -2; i <= 24; i++) grid[i % 2 ? 0 : 1].push(`M${pt(i * 0.5, -1.9)}L${pt(i * 0.5, 1.9)}`);
  for (let j = -3; j <= 3; j++) grid[j % 2 ? 0 : 1].push(`M${pt(-1.2, j * 0.5)}L${pt(12.2, j * 0.5)}`);
  out.push(`<path class="grid" d="${grid[0].join("")}"/><path class="grid strong" d="${grid[1].join("")}"/>`);
  for (const m of [0, 5, 10]) out.push(label(m - 0.07, -1.55, m + " m", 7, "mid"));
  // world axes, as in the simulator's corner
  const o = [-0.9, -1.6];
  out.push(line("axis x", [o[0], o[1]], [o[0] + 0.7, o[1]]), line("axis y", [o[0], o[1]], [o[0], o[1] + 0.7]), line("axis z", [o[0], o[1]], [o[0], o[1], 0.7]));
  out.push(L(k.ring(GOAL * U, 0, NAV.tolerance * U, 0, P, 32), { tone: "hi", dashed: true }) + L(k.ring(GOAL * U, 0, 3, 0, P, 14), { tone: "hi" }), label(GOAL - 0.28, 0.85, "GOAL", 7));

  // SEE. Three stereo cameras; the front one's view volume; a point wherever it sees something
  const eye = [0.75, 0, 0.32], far = 0.75 + NAV.range, hw = 1.75, top = 1.15;   // drawn out to the 6 m the costmap marks
  const corners = [[far, -hw, 0.02], [far, hw, 0.02], [far, hw, top], [far, -hw, top]];
  out.push(part("frustum", corners.map((c) => line("frustum", eye, c)).join("") + line("frustum", ...corners, corners[0])
    + line("frustum side", [0.6, 0.25, 0.3], [2.4, 3.2 * 0.55, 0.02]) + line("frustum side", [0.6, -0.25, 0.3], [2.4, -3.2 * 0.55, 0.02])));
  const cloud = [], floorPts = [];
  const rnd = (i, j) => { let h = Math.imul(i * 7 + 3, 374761393) ^ Math.imul(j * 13 + 5, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const cloud2 = [];
  OBST.forEach(([ox, oy], n) => { for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) {
    (n ? cloud2 : cloud).push(circle(at(ox - 0.26, oy - 0.25 + a * 0.1, 0.03 + b * 0.09), 1.15, "pt"));
    if (b === 5) (n ? cloud2 : cloud).push(circle(at(ox - 0.25 + a * 0.1, oy - 0.25 + (a * 3 % 6) * 0.1, 0.5), 1.0, "pt"));
  } });
  for (let i = 0; i < 130; i++) { const x = 1.5 + rnd(i, 91) * 4.9, y = (rnd(i, 92) - 0.5) * 2 * (0.25 + (x - 0.75) * 0.28); floorPts.push(circle(at(x, y, 0.02 + (x - 1.5) * 0.045), 0.85, "pt floor")); }
  out.push(part("cloud-floor", floorPts.join("")), part("cloud", cloud.join("")), part("cloud2", cloud2.join("")));

  // MARK. The costmap. First everything the camera saw on the floor counts; then only what stands above the height cut;
  // then every obstacle is given a margin (inflation): the bigger the dot, the higher the cost
  const wrong = [], lethal = [], inflated = [], second = [];
  for (let i = 4; i <= 46; i++) for (let j = -7; j <= 7; j++) {
    const x = i * NAV.cell, y = j * NAV.cell, c = costAt(x, y, FIRST), c2 = costAt(x, y, [OBST[1]]);
    if (c2 > 0.12) second.push(circle(at(x, y), c2 >= 1 ? 2.5 : 0.7 + 1.9 * c2, c2 >= 1 ? "cell" : "cell soft"));   // the second obstacle: not known until it is seen
    if (c >= 1) lethal.push(circle(at(x, y), 2.5, "cell"));
    else if (c > 0.12) inflated.push(circle(at(x, y), 0.7 + 1.9 * c, "cell soft"));
    else if (x >= 1.5 && x <= 6.4 && Math.abs(y) <= 0.25 + (x - 0.75) * 0.28 && rnd(i, j) < 0.35) wrong.push(circle(at(x, y), 2.5, "cell"));   // 35 %: 2,243 of 6,400
  }
  out.push(part("cells-wrong", wrong.join("")), part("cells-inflated", inflated.join("")), part("cells-lethal", lethal.join("")), part("cells2", second.join("")));
  const cutAt = (h) => line("cut", [1.5, -1.6, h], [6.4, -1.6, h], [6.4, 1.6, h], [1.5, 1.6, h], [1.5, -1.6, h]);
  out.push(part("cut-low", cutAt(NAV.minHeight[0])), part("cut-high", cutAt(NAV.minHeight[1])));

  // PLAN. The search tree in the order it grew, the path it found, and the sharp one the first planner gave
  const arc = (n) => { const q = n.parent, m = [(q.x + n.x) / 2 + (n.kappa || 0) * 0.02 * Math.sin(q.th), (q.y + n.y) / 2 - (n.kappa || 0) * 0.02 * Math.cos(q.th)]; return `M${pt(q.x, q.y, 0.01)}Q${pt(m[0], m[1], 0.01)} ${pt(n.x, n.y, 0.01)}`; };
  out.push(part("tree", `<path class="tree" pathLength="1" d="${SEARCH.map(arc).join("")}"/>`), part("tree2", `<path class="tree" pathLength="1" d="${SEARCH2.map(arc).join("")}"/>`));
  const sharp = [[0.8, 0], [4.1, 0], [4.5, -0.95], [5.7, -0.95], [6.2, 0], [8.2, 0], [8.6, 0.95], [9.5, 0.95], [10, 0], [GOAL, 0]];
  out.push(part("path-sharp", line("route sharp", ...sharp.map((q) => [q[0], q[1], 0.01]))));
  const curve = (fn, from) => Array.from({ length: 60 }, (_, i) => from + (STOP - from) * i / 59).map((x) => pt(x, fn(x), 0.012)).join("L");
  out.push(part("path", `<path class="route" pathLength="1" d="M${curve(pathA, 0.8)}"/>`), part("path-b", `<path class="route" pathLength="1" d="M${curve((x) => { const q = Math.min(1, Math.max(0, (x - SEE) / 0.9)), e = q * q * (3 - 2 * q); return pathA(x) * (1 - e) + pathY(x) * e; }, SEE)}"/>`));

  // FOLLOW. The controller's rollouts from where the car is, cheapest on top
  out.push(part("rollouts", ROLL.map((r, i) => line(i === ROLL.length - 1 ? "roll best" : "roll", ...r.pts.map((q) => [q[0], q[1], 0.014]))).join("")
    + line("footprint", ...[[0.55, 0.33], [0.55, -0.33], [-0.55, -0.33], [-0.55, 0.33], [0.55, 0.33]].map(([dx, dy]) => [ROLL_FROM.x - 0.3 + dx, ROLL_FROM.y + dy, 0.014]))));
  out.push(`<g data-part="live-rolls"></g>`);                                // the same thing, redrawn from wherever the car is during the run

  // things that stand up, back to front: the two obstacles and the car
  const box = (x, y) => S(k.slabOf({ x: x * U - 7.5, y: y * U - 7.5, w: 15, d: 15, r: 0.6 }, 0, 15, P, 3, 0.5), { tone: "hi", crease: "lo" });
  const car = () => {
    const b = { x: -0.18 * U, y: -0.3 * U, w: 1.0 * U, d: 0.6 * U, r: 3 }, ax = (dx, dy, dz, cls) => `<path class="axis ${cls}" d="M${iso([8, 0, 14], P).map((v) => v.toFixed(1)).join(" ")}L${iso([8 + dx, dy, 14 + dz], P).map((v) => v.toFixed(1)).join(" ")}"/>`;
    return `<g data-part="car"><g data-res="car">${S(k.slabOf(b, 3, 6, P, 4, 0.8), { tone: "hi" })}${S(k.slabOf({ x: b.x + 2, y: b.y + 3, w: 13, d: b.d - 6, r: 1.5 }, 9, 5, P, 3, 0.5), { tone: "hi" })}${S(k.slabOf({ x: b.x + 23, y: b.y + 4, w: 5, d: b.d - 8, r: 1 }, 9, 3, P, 3, 0.4), { tone: "hi" })}</g>${ax(11, 0, 0, "x")}${ax(0, 11, 0, "y")}${ax(0, 0, 11, "z")}</g>`;
  };
  const standing = [[5 * U, () => box(...OBST[0])], [9 * U, () => box(...OBST[1])], [0, car]].sort((a, b) => depthOf([a[0], 0, 0], P) - depthOf([b[0], 0, 0], P));
  out.push(...standing.map(([, draw]) => draw()));
  return k.figureSvg({ width: P.width, height: P.height, className: `view ${id}`, label: "A simulated course 11 metres long with two obstacles and a goal. A small car drives it using only cameras.", body: out })
    .replace("<svg", `<svg data-view="${id}" data-p='${JSON.stringify(P)}'`);
}
const fit = (w, h, azimuth) => Object.assign(k.fitProjection(k.boxCorners(FLOOR, -4, 36), w, h, { pad: 14, azimuth }), { width: w, height: h });
const P_WIDE = fit(860, 330, 66), P_TALL = fit(440, 540, 22);

/* ---- figure B: the car close up. 110 units to the metre ---- */
const V = 110, PAD = { x: -62, y: -80, w: 206, d: 160, r: 6 }, PAD_B = { x: -74, y: -80, w: 218, d: 160, r: 6 };
const P_CAR = Object.assign(k.fitProjection([...k.boxCorners(PAD, -6, 0), [0, 0, 62]], 620, 420, { pad: 22, azimuth: 40 }), { width: 620, height: 420 });
const FRONT = CAR.wheelBase * V, HALF = 30, WR = CAR.wheelRadius * V, WW = 9;
// the car, back to front: the two wheels on the far side, the body, the camera, the two wheels on the near side
function carSvg(P) {
  const at = (p) => iso(p, P), slab = (plan, z, h, tone = "hi", bevel = 0.8) => S(k.slabOf(plan, z, h, P, 4, bevel), { tone, crease: "lo" });
  const wheels = [["rr", 0, -HALF, 0], ["fr", FRONT, -HALF, 1], ["rl", 0, HALF, 0], ["fl", FRONT, HALF, 1]];
  const farSide = depthOf([0, 1, 0], P) > 0 ? -1 : 1;                              // which side of the car is away from the viewer
  const side = (sgn) => wheels.filter((w) => Math.sign(w[2]) === sgn).sort((a, b) => depthOf([a[1], 0, 0], P) - depthOf([b[1], 0, 0], P))
    .map(([id, x, y, front]) => `<g data-wheel="${id}" data-front="${front}">${wheelSvg(P, x, y, WR, WW, 0)}</g>`).join("");
  const body = `<g data-res="car">${[
    slab({ x: -20, y: -24, w: 110, d: 48, r: 5 }, 9, 12),                         // chassis
    slab({ x: -4, y: -27, w: 8, d: 54, r: 1 }, 11, 4, "mid", 0.4), slab({ x: FRONT - 4, y: -27, w: 8, d: 54, r: 1 }, 11, 4, "mid", 0.4),   // axles
    slab({ x: -18, y: -20, w: 9, d: 40, r: 2 }, 21, 22),                           // seat back
    slab({ x: -9, y: -20, w: 26, d: 40, r: 2 }, 21, 5, "mid", 0.5),                // seat
    slab({ x: 48, y: -22, w: 40, d: 44, r: 4 }, 21, 8),                            // bonnet
    slab({ x: 44, y: -19, w: 3, d: 38, r: 1 }, 21, 16, "mid", 0.4),                // windscreen
    S(k.cylinder(36, 0, 6, 27, 2.4, P, 20, 0.4), { tone: "hi" }),                  // steering wheel
    slab({ x: 88, y: -26, w: 5, d: 52, r: 1.5 }, 8, 8, "mid", 0.5),                // bumper
  ].join("")}</g>`;
  const cam = `<g class="cam">${S(k.slabOf({ x: 78, y: -15, w: 7, d: 30, r: 1.5 }, 29, 7, P, 3, 0.5), { tone: "hi", lit: true })}${k.dotsSvg([at([85, -9, 32.5]), at([85, 9, 32.5])], { size: 1.3, tone: "hi" })}</g>`;
  return side(farSide) + body + cam + side(-farSide);
}
function closeUp() {
  const P = P_CAR, at = (p) => iso(p, P);
  const out = [`<g data-res="base">${S(k.slabOf(PAD, -6, 6, P, 6, 1.2), { tone: "mid" })}</g>`];
  out.push(L(k.planOutline(k.insetPlan(PAD, 5), 0, P), { tone: "lo" }));
  // on the floor: the wheelbase, and the straight-ahead line the steering is measured from
  out.push(k.wireSvg(at([0, -62, 0]), at([FRONT, -62, 0]), { tone: "hi", size: 1.4 }), k.faceTextSvg(k.topMatrix([10, -66], 0, P, "x"), "L = 0.65 m", { size: 8, tone: "hi" }));
  out.push(L(k.lineOnTop([0, -62], [0, -HALF - 6], 0, P) + k.lineOnTop([FRONT, -62], [FRONT, -HALF - 6], 0, P), { tone: "lo", dotted: true }));
  out.push(k.wireSvg(at([FRONT, HALF + 9, 0]), at([FRONT + 52, HALF + 9, 0]), { tone: "lo", dashed: true, ends: "to", size: 1.2 }));
  out.push(`<g data-part="heading"></g>`, k.faceTextSvg(k.topMatrix([-52, 68], 0, P, "x"), "r = 0.12 m", { size: 8, tone: "hi" }));
  out.push(carSvg(P));
  return k.figureSvg({ width: P.width, height: P.height, className: "view car", label: "The car close up: four wheels, a stereo camera on the bonnet. The front wheels turn to the steering angle the formula gives.", body: out })
    .replace("<svg", `<svg data-view="car"`);
}
// the virtual bumper: cameras look forward and to both sides; nothing looks back. The car reverses into a wall it cannot see
const WALL = { x: -70, y: -66, w: 26, d: 132, r: 1.5 }, WALL_H = 46, BACK_FROM = 12, BACK_TO = -22;   // the car backs up until its tail meets the wall
const P_BUMP = Object.assign(k.fitProjection([...k.boxCorners(PAD_B, -6, 0), ...k.boxCorners(WALL, 0, WALL_H), [120, 0, 40]], 620, 420, { pad: 26, azimuth: 40 }), { width: 620, height: 420 });
function bumpView() {
  const P = P_BUMP, at = (p) => iso(p, P), pt = (p) => at(p).map((v) => v.toFixed(1)).join(" ");
  const line = (cls, ...pts) => `<path class="${cls}" d="M${pts.map(pt).join("L")}"/>`, text = (x, y, s, tone = "mid") => k.faceTextSvg(k.topMatrix([x, y], 0, P, "x"), s, { size: 7, tone });
  const out = [`<g data-res="base">${S(k.slabOf(PAD_B, -6, 6, P, 6, 1.2), { tone: "mid" })}</g>`, L(k.planOutline(k.insetPlan(PAD_B, 5), 0, P), { tone: "lo" })];
  out.push(S(k.slabOf(WALL, 0, WALL_H, P, 3, 0.8), { tone: "hi", crease: "lo" }));
  const face = WALL.x + WALL.w, marks = [];                                 // marked on the wall's face, where the tail met it
  for (let j = -3; j <= 3; j++) { const q = at([face, j * 8, 30]); marks.push(`<circle class="cell" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3"/>`); }
  const fans = line("frustum", [85, 0, 0], [140, -34, 0]) + line("frustum", [85, 0, 0], [140, 34, 0]) + line("frustum", [62, 24, 0], [100, 74, 0]) + line("frustum", [62, 24, 0], [22, 74, 0])
    + line("frustum", [62, -24, 0], [100, -74, 0]) + line("frustum", [62, -24, 0], [22, -74, 0]) + text(112, 3, "front") + text(50, 70, "left") + text(50, -62, "right");
  out.push(`<g data-part="bcar" transform="${k.translateAlong(P, [BACK_FROM, 0, 0])}">${fans}${carSvg(P)}</g>`);
  out.push(part("b-marks", marks.join("")), text(-44, 76, "no camera behind", "hi"));
  const read = (n, y, s) => `<text data-part="b-l${n}" class="read" x="18" y="${y}" style="opacity:0">${s}</text>`;
  out.push(read(1, 366, "command: reverse"), read(2, 384, "moving: 0.00 m/s"), read(3, 402, `${BUMP.time.toFixed(1)} s → marked ${BUMP.dist} m behind, wheels stopped`));
  return k.figureSvg({ width: P.width, height: P.height, className: "view bump", label: "The car reversing into a wall. Its three cameras look forward, left and right; none looks back. After a second of being told to move and not moving, the place behind it is marked as an obstacle.", body: out })
    .replace("<svg", `<svg data-view="bump"`);
}

/* ---- dot fills (the same look as the rest of the site) ---- */
const ramps = { n: ["#35423c", "#465650", "#5a6b63", "#6f8178", "#899b91"], d: ["#222c27", "#2a3630", "#323f39", "#3b4942", "#45544c"], w: ["#7d8a84", "#97a39c", "#b4c0b9", "#ccd6cf", "#e6ebe4"] };
const radii = [0.42, 0.56, 0.72, 0.9, 1.08], PITCH = 2.6;
const defs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(ramps).map(([id, cols]) => cols.map((c, i) => `<pattern id="${id}${i}" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse"><circle cx="${PITCH / 2}" cy="${PITCH / 2}" r="${radii[i]}" fill="${c}"/></pattern>`).join("")).join("")}</defs></svg>`;
const fills = (sel, id) => [0, 1, 2, 3].map((i) => `${sel} .iso-shade[data-shade="${i}"]{fill:url(#${id}${i})}`).join("") + `${sel} .iso-top{fill:url(#${id}4)}`;

/* ---- the formula ---- */
const tex = (s) => katex.renderToString("\\displaystyle " + s, { throwOnError: true }), T = (s) => `\\text{${s}}`;
const formula = `<div class="formula" aria-label="The conversion from a speed and a turn rate to a steering angle and a wheel speed">
  <span class="term" data-term="in">${tex(`\\underbrace{(v,\\ \\omega)}_{${T("the command")}}`)}</span>
  <span class="term arrow" data-term="steer">${tex("\\longrightarrow")}</span>
  <span class="term hot" data-term="steer">${tex(`\\underbrace{\\delta = \\arctan\\!\\left(\\frac{L\\,\\omega}{v}\\right)}_{${T("steering angle")}}`)}</span>
  <span class="term hot" data-term="spin">${tex(`\\underbrace{\\omega_{${T("wheel")}} = \\frac{v}{r}}_{${T("wheel speed")}}`)}</span>
  <span class="term rule" data-term="bump">${tex(`\\underbrace{|v_{${T("cmd")}}| > ${BUMP.cmd}\\ ${T("and")}\\ |v| < ${BUMP.speed}\\ ${T("m/s, for")}\\ ${BUMP.time.toFixed(1)}\\ ${T("s")}}_{${T("told to move, not moving")}}\\ \\Longrightarrow\\ \\underbrace{${T("an obstacle")}\\ ${BUMP.dist}\\ ${T("m that way")}}_{${T("marked in the costmap, wheels stopped")}}`.replace(/\\\\/g, "\\"))}</span>
  <span class="check" data-term="num">${tex(`v = ${CMD.v}\\ ${T("m/s")},\\ \\omega = ${CMD.w}\\ ${T("rad/s")}`)}<span class="arrowword">gives</span>${tex(`\\delta = ${(steer * 180 / Math.PI).toFixed(0)}^\\circ,\\ \\omega_{${T("wheel")}} = ${spin.toFixed(1)}\\ ${T("rad/s")}`)}</span>
</div>`;

// each scene: heading, lines, and the tag under the picture: the piece of software and its key numbers
const steps = [
  ["A car, a camera, no map.", ["Course robots usually turn on the spot, carry a LiDAR and drive on a map made beforehand.", "This one steers like a car, sees only through cameras, and has no map.", "Built and tested in a simulator, as a one-person course project."],
    "Isaac Sim 4.2 · ROS 2 Humble · T870, my own model"],
  ["See: depth becomes points.", ["Three stereo cameras cover about 180° ahead.", "Each depth image becomes a cloud of points: 307,200 from the front camera, about 27 times a second.", "A point is a place where something is."],
    "/stereo/left/points · PointCloud2 · 640 × 480 · ~27 Hz"],
  ["Mark: points become a costmap.", ["Nav2 drops the points into a grid. At first the floor itself counted: 2,243 of 6,400 cells, and the car stood still.", "Only points above a height now count. Raising that cut from 0.15 m to 0.35 m left the real obstacles.", "Then each obstacle is given a margin, 0.55 m wide. The closer to it, the higher the cost."],
    "nav2_costmap_2d · VoxelLayer + InflationLayer · min_obstacle_height 0.35 · inflation_radius 0.55"],
  ["Plan: search only what a car can drive.", ["The first planner drew corners a car cannot take.", "Hybrid-A* searches differently. From each position it tries three short arcs: left at the tightest turn, 1.0 m, straight, and right.", "Arcs that run into cost are dropped. What is left is a path the car can follow."],
    "nav2_smac_planner · SmacPlannerHybrid · minimum_turning_radius 1.0 · 72 headings"],
  ["Follow: imagine many futures, take the cheapest.", ["Twenty times a second the controller rolls 1,000 possible next two seconds through a model of the car.", "Each is scored: stay near the path, stay out of cost, do not hit anything with the car's real outline.", "The cheapest one gives the next command: a speed and a turn rate."],
    "nav2_mppi_controller · MPPIController · batch 1000 × 40 steps · Ackermann model · 20 Hz"],
  ["Drive: from a command to the wheels.", ["A car has no turn rate. It has a steering angle, and wheels that spin.", "The node written for this project turns one into the other.", "It also reports where the car now is, which starts the loop again."],
    "/cmd_vel → ackermann_control (my node) → joints · /odom · /tf"],
  ["Look again: the plan changes.", ["Nothing is planned once. The costmap only marks what a camera has seen within 6 m, so the second obstacle is not in the first plan.", "A few metres on it comes into range: new points, new cells, a new search, a new path.", "All the while the controller keeps taking the cheapest of its futures. The car swerves 0.13 m right, then 0.12 m left, and stops at 10.81 m."],
    "obstacle_max_range 6.0 · rolling costmap in the odom frame, no stored map · goal (11, 0), tolerance 0.35"],
  ["No eyes at the back.", ["The cameras look forward, left and right. Backing out of a dead end, the car could not see the wall behind it and kept reversing into it.", "The fix is a bumper made of logic: told to move, not moving, for a second, so something must be there.", "That place is marked in the costmap like anything a camera saw. The wheels stop and the planner looks for another way."],
    "/virtual_bumper/points → VoxelLayer, never cleared · in ackermann_control (my node)"],
];
const MORE = `<p class="more fade"><a href="../index.html">More detail →</a><a href="../../index.html">All experience</a></p>`;
const words = steps.map(([h, lines], i) => `<section class="step"><${i ? "h2" : "h1"}>${h}</${i ? "h2" : "h1"}><p class="body">${lines.map((l) => `<span class="ln">${l}</span>`).join("")}</p>${i === steps.length - 1 ? MORE : ""}</section>`).join("");
const tags = steps.map(([, , tag]) => `<span class="tag">${tag}</span>`).join("");
const crumb = `<p class="crumb"><span><a href="../../../index.html">Rainyforest</a> / <a href="../../index.html">Experience</a> / Tesla Jr.</span><a href="../index.html">Write-up →</a></p>`;
const TALL_Q = "(max-width: 44rem), (max-aspect-ratio: 4/5)";

const CSS = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#0a0f0d;color:#e6ebe4;font:400 clamp(.94rem,.9rem + .2vw,1.06rem)/1.6 "Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif}
.iso{--anatomy-page:#0a0f0d;--anatomy-card:#0a0f0d;--anatomy-paper:#0a0f0d;--anatomy-face:#0a0f0d;--anatomy-hi:#c9d4cd;--anatomy-mid:#7d8c84;--anatomy-lo:#55635c;--anatomy-faint:#36433d;--anatomy-lit:#e0b84c;--anatomy-dot:#c9d4cd}
.iso-halo{display:none}
${fills(".iso-svg", "n")}${fills('.iso-svg [data-res="base"]', "d")}${fills('.iso-svg [data-res="car"]', "w")}
[data-res="car"] .iso-edge{stroke:#e6ebe4}.cam .iso-top,.cam .iso-shade{fill:#e0b84c}.cam .iso-edge{stroke:#e0b84c}
.iso-face-text{font-weight:600;letter-spacing:.05em}.iso-face-text[data-tone="hi"]{fill:#e6ebe4}
.cell{fill:#d2654e}.cell.soft{opacity:.8}.pt{fill:#a9c4b8}.pt.floor{opacity:.6}
.view path{vector-effect:non-scaling-stroke}
.grid{fill:none;stroke:#1f2a25;stroke-width:1px}.grid.strong{stroke:#2e3a34}
.axis{fill:none;stroke-width:1.8px;stroke-linecap:round}.axis.x{stroke:#d2654e}.axis.y{stroke:#72b98e}.axis.z{stroke:#6aa9cf}
.frustum{fill:none;stroke:#93a199;stroke-width:1px;stroke-dasharray:1 3;stroke-linecap:round}.frustum.side{opacity:.55}
.cut{fill:none;stroke:#e6ebe4;stroke-width:1.2px;stroke-dasharray:5 3}
.tree{fill:none;stroke:#93a199;stroke-width:1px;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:var(--left,0)}
.roll{fill:none;stroke:#7d8c84;stroke-width:.9px;opacity:.55}.roll.best{stroke:#e0b84c;stroke-width:2.2px;opacity:1}
.footprint{fill:none;stroke:#e6ebe4;stroke-width:1.1px}
.route.old{stroke:#93a199;stroke-width:1.4px;stroke-dasharray:.006 .01;opacity:.7}
.read{font:600 12px ui-monospace,Menlo,Consolas,monospace;fill:#e6ebe4;letter-spacing:.02em}
.formula .rule{color:#e6ebe4}
.tags{position:absolute;left:0;right:0;bottom:0;margin:0;min-height:2.6em;font:500 clamp(.66rem,.6rem + .2vw,.78rem)/1.35 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#93a199;letter-spacing:.02em}
.tags .tag{position:absolute;left:0;bottom:0;opacity:0;transition:opacity .5s}.tags .tag.on{opacity:1}
.sim{position:absolute;left:0;top:0;margin:0;font:500 clamp(.62rem,.58rem + .15vw,.72rem)/1.3 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:#5d6b64}
.route{fill:none;stroke:#e0b84c;stroke-width:2.2px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:var(--left,0)}
.route.sharp{stroke:#93a199;stroke-width:1.6px;stroke-dasharray:1.5 4}
.story{position:relative;height:calc(var(--n) * 100svh)}
.stage{position:sticky;top:0;height:100svh;overflow:hidden;display:grid;grid-template-columns:minmax(14rem,22rem) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;gap:.25rem 1.5rem;padding:.75rem clamp(16px,3vw,40px) 1rem}
.crumb{grid-column:1 / -1;margin:0;display:flex;justify-content:space-between;gap:1rem;font:500 .78rem/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#5d6b64}.crumb a{color:#93a199;text-decoration:none}.crumb a:hover{color:#e6ebe4}
.words{position:relative;grid-column:1;grid-row:2;align-self:center;min-height:19rem}
.fig{grid-column:2;grid-row:2;min-height:0;position:relative}.fig .view{position:absolute;inset:1.3em 0 3em 0;width:100%;height:calc(100% - 4.3em);transition:opacity .6s cubic-bezier(.2,.7,.2,1)}
.view.tall{display:none}
.step{position:absolute;inset:0 0 auto 0;pointer-events:none}.step.on{pointer-events:auto}
.step h1,.step h2{margin:0;font-size:clamp(1.5rem,1rem + 1.7vw,2.4rem);font-weight:700;line-height:1.08;letter-spacing:-.03em}
.step p.body{margin:.7rem 0 0;color:#93a199;line-height:1.45}.body .ln{display:block;text-wrap:balance}.body .ln + .ln{margin-top:.4em}
.step .more{margin:1rem 0 0;display:flex;flex-wrap:wrap;gap:.4rem 1.4rem;font-size:.9rem}.step .more a{color:#e6ebe4;text-underline-offset:.3em;text-decoration-style:dotted}.step .more a + a{color:#93a199}
/* each block of words is one unit and brightens from its bottom edge upward */
.step h1,.step h2,.step .ln,.step .more{-webkit-mask-image:linear-gradient(to top,#000 33.4%,transparent 66.6%);mask-image:linear-gradient(to top,#000 33.4%,transparent 66.6%);-webkit-mask-size:100% 300%;mask-size:100% 300%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:0 0%;mask-position:0 0%;transition:-webkit-mask-position .3s linear,mask-position .3s linear}
.step h1,.step h2{padding:.12em 0;margin:-.12em 0}
.step.on h1,.step.on h2,.step.on .ln,.step.on .more{-webkit-mask-position:0 100%;mask-position:0 100%;transition:-webkit-mask-position .9s cubic-bezier(.3,0,.2,1) calc(var(--i,0) * .14s),mask-position .9s cubic-bezier(.3,0,.2,1) calc(var(--i,0) * .14s)}
.formula{grid-column:1 / -1;display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:.5rem 1.1em;min-height:8.2em;padding-top:.9rem;border-top:1px dotted #2c3833;font-size:clamp(.82rem,.6rem + .58vw,1.1rem);color:#e6ebe4}
.formula .katex{font-size:1.24em}.formula .hot{color:#e0b84c}
.formula [data-term]{opacity:0;transition:opacity .6s cubic-bezier(.2,.7,.2,1)}.formula [data-term].on{opacity:1}
.formula .check{flex-basis:100%;display:flex;justify-content:center;align-items:baseline;flex-wrap:wrap;gap:.2rem 1.1em;color:#93a199;font-size:.86em}
.formula .check .arrowword{font:500 .72em/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:#5d6b64}
.ticks{position:absolute;right:calc(clamp(16px,3vw,40px) / 2);top:42%;transform:translate(50%,-50%);display:grid;gap:.6rem}
.ticks span{width:5px;height:5px;border-radius:50%;background:#5d6b64;transition:background .3s,transform .3s}.ticks span.on{background:#e0b84c;transform:scale(1.6)}
.after{padding:clamp(3rem,8vw,6rem) clamp(16px,4vw,48px) 1rem;max-width:44rem}.after h2{margin:0;font-size:clamp(1.4rem,1rem + 1.6vw,2.1rem);letter-spacing:-.02em}.after p{color:#93a199;margin:.7rem 0 0}.after .links{display:flex;flex-wrap:wrap;gap:.4rem 1.6rem;margin-top:1.3rem}.after .links a{color:#e6ebe4;text-underline-offset:.3em;text-decoration-style:dotted}.after .links a + a{color:#93a199}
footer{padding:2rem clamp(16px,4vw,48px) 3rem;color:#5d6b64;font-size:.8rem}
@media ${TALL_Q}{
  .stage{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;gap:.4rem;padding:.7rem 16px .9rem}
  .words{grid-column:1;grid-row:2;align-self:start;min-height:17.2rem}.fig{grid-column:1;grid-row:3}
  .step h1,.step h2{font-size:clamp(1.45rem,1.1rem + 1.8vw,2rem)}.step p.body{margin-top:.5rem}
  .view.wide{display:none}.view.tall{display:block}.read{display:none}
  .formula{grid-column:1;justify-content:flex-start;min-height:9.6rem;gap:.3rem .8em;padding-top:.6rem;font-size:.8rem}.formula .arrow{display:none}.formula .check{justify-content:flex-start}
  .ticks{top:50%}
}
.nofx *{transition:none!important}
@media (prefers-reduced-motion:reduce){.step h1,.step h2,.step .ln,.step .more,.fig .view,.formula [data-term]{transition:opacity .2s linear}}
`;

const live = `
const U = ${U}, V = ${V}, CAR = ${JSON.stringify(CAR)}, STOP = ${STOP}, STEER = ${steer}, P_CAR = ${JSON.stringify(P_CAR)}, FRONT = ${FRONT}, HALF = ${HALF}, WR = ${WR}, WW = ${WW};
const hullOf = ${hullOf.toString()};
const wheelSvg = ${wheelSvg.toString()};
const pathY = ${pathY.toString()};
const pathA = ${pathA.toString()};
const NAV = ${JSON.stringify(NAV)}, OBST = ${JSON.stringify(OBST)}, FIRST = [OBST[0]], SEE = ${SEE}, BACK_FROM = ${BACK_FROM}, BACK_TO = ${BACK_TO}, P_BUMP = ${JSON.stringify(P_BUMP)};
const distTo = ${distTo.toString()};
const costAt = ${costAt.toString()};
const rollouts = ${rollouts.toString()};
const story = document.querySelector(".story"), stage = story.querySelector(".stage"), N = ${steps.length};
const stepEls = [...stage.querySelectorAll(".step")], ticks = [...stage.querySelectorAll(".ticks span")], formula = stage.querySelector(".formula");
for (const st of stepEls) [...st.querySelectorAll(".ln, .more")].forEach((e, i) => e.style.setProperty("--i", i + 1));
const views = [...stage.querySelectorAll("[data-view]")].filter((v) => v.dataset.p).map((svg) => ({ svg, P: JSON.parse(svg.dataset.p), part: (n) => svg.querySelector('[data-part="' + n + '"]') }));
const carView = stage.querySelector('[data-view="car"]'), fronts = [...carView.querySelectorAll('[data-front="1"]')], heading = carView.querySelector('[data-part="heading"]');
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), ramp = (p, a, b) => clamp((p - a) / (b - a)), ease = (t) => t * t * (3 - 2 * t);
const still = matchMedia("(prefers-reduced-motion: reduce)"), forced = new URLSearchParams(location.search).get("p");
if (forced !== null) document.documentElement.classList.add("nofx");
let p = 0, raf = 0, last = 0, lastYaw = -1;
const target = () => { if (forced !== null) return clamp(parseFloat(forced), 0, N - 1); const b = story.getBoundingClientRect(); return clamp(-b.top / Math.max(1, b.height - innerHeight)) * (N - 1); };
const tagEls = [...stage.querySelectorAll(".tags .tag")];
const bumpView = stage.querySelector('[data-view="bump"]'), bpart = (n) => bumpView.querySelector('[data-part="' + n + '"]');
const TERMS = { in: [3.7, 6.5], steer: [4.78, 6.5], spin: [4.88, 6.5], num: [4.96, 6.5], bump: [6.7, 99] };
let lastRoll = "";
function draw() {
  const close = ease(ramp(p, 4.55, 4.9)) * (1 - ease(ramp(p, 5.45, 5.75)));          // the close-up of the car takes over for the formula
  const bump = ease(ramp(p, 6.45, 6.65));                                           // and the second close-up for the virtual bumper
  const running = p > 5.7 && p < 6.5, run = ease(ramp(p, 5.75, 6.4));
  const px = p < 5.7 ? 0.8 + 0.6 * ease(ramp(p, 3.5, 3.85)) : 1.4 + (STOP - 1.4) * run;   // where the front of the car is along the course
  const seen = ease(ramp(px, SEE, SEE + 0.9));                                     // 0 until the second obstacle comes into range, then 1
  const py = pathA(px) * (1 - seen) + pathY(px) * seen;
  for (const v of views) {
    const show = (name, value) => { v.part(name).style.opacity = value; };
    const here = translateAlong(v.P, [(px - 0.8) * U, py * U, 0]);
    v.svg.style.opacity = clamp(1 - close - bump);
    show("frustum", Math.max(ease(ramp(p, 0.55, 0.9)) * (1 - ease(ramp(p, 2.55, 2.9))), running ? 0.85 * (1 - ease(ramp(px, 4.8, 5.9))) : 0));
    v.part("frustum").setAttribute("transform", here);                               // the view moves with the car
    show("cloud", ease(ramp(p, 0.7, 1.0)) * (1 - ease(ramp(p, 2.55, 2.9))));
    show("cloud-floor", ease(ramp(p, 0.7, 1.0)) * (1 - 0.75 * ease(ramp(p, 1.95, 2.2))) * (1 - ease(ramp(p, 2.55, 2.9))));   // dims once it is below the cut
    show("cells-wrong", ease(ramp(p, 1.5, 1.75)) * (1 - ease(ramp(p, 1.95, 2.2))));
    show("cut-low", ease(ramp(p, 1.5, 1.75)) * (1 - ease(ramp(p, 1.9, 2.05))));
    show("cut-high", ease(ramp(p, 1.9, 2.05)) * (1 - ease(ramp(p, 2.55, 2.9))));
    show("cells-lethal", ease(ramp(p, 1.5, 1.75)));
    show("cells-inflated", ease(ramp(p, 2.2, 2.45)));
    show("path-sharp", ease(ramp(p, 2.55, 2.75)) * (1 - ease(ramp(p, 2.85, 3.05))));
    const grown = ramp(p, 2.9, 3.35);
    v.part("tree").style.opacity = (grown > 0 ? 1 : 0) * (1 - 0.8 * ease(ramp(p, 3.5, 3.9))) * (1 - seen);
    v.part("tree").firstElementChild.style.setProperty("--left", String(1 - grown));
    const drawn = ease(ramp(p, 3.3, 3.5));
    v.part("path").style.opacity = drawn > 0 ? 1 : 0; v.part("path").firstElementChild.style.setProperty("--left", String(1 - drawn));
    v.part("path").firstElementChild.classList.toggle("old", seen > 0.5);              // the first plan, once it has been replaced
    // the second obstacle comes into range: its points and cells appear, a new search grows from the car, a new path replaces the old
    const found = ease(ramp(px, SEE, SEE + 0.5));
    show("cloud2", found * (1 - ease(ramp(px, SEE + 2.5, SEE + 3.5)))); show("cells2", found);
    const regrow = ramp(px, SEE + 0.1, SEE + 1.0);
    v.part("tree2").style.opacity = (regrow > 0 ? 1 : 0) * (1 - ease(ramp(px, SEE + 1.4, SEE + 2.6)));
    v.part("tree2").firstElementChild.style.setProperty("--left", String(1 - regrow));
    const redrawn = ease(ramp(px, SEE + 0.7, SEE + 1.3));
    v.part("path-b").style.opacity = redrawn > 0 ? 1 : 0; v.part("path-b").firstElementChild.style.setProperty("--left", String(1 - redrawn));
    show("rollouts", ease(ramp(p, 3.6, 3.9)) * (1 - ease(ramp(p, 4.5, 4.8))));
    v.part("car").setAttribute("transform", here);
  }
  // during the run the controller's futures are redrawn from wherever the car is, against whatever is known by then
  const key = running ? Math.round(px * 6) + ":" + (seen > 0.3) : "";
  if (key !== lastRoll) {
    lastRoll = key;
    const known = seen > 0.3 ? OBST : FIRST, ref = (x) => pathA(x) * (1 - seen) + pathY(x) * seen;
    const list = running && px < STOP - 1.2 ? rollouts(26, { x: px, y: py, th: 0 }, known, ref, Math.round(px * 6) + 3) : [];
    for (const v of views) v.part("live-rolls").innerHTML = list.map((r, i) => '<path class="' + (i === list.length - 1 ? "roll best" : "roll") + '" d="M' + r.pts.map((q) => iso([q[0] * U, q[1] * U, 0.4], v.P).map((n) => n.toFixed(1)).join(" ")).join("L") + '"/>').join("");
  }
  carView.style.opacity = close;
  const yaw = STEER * ease(ramp(p, 4.72, 4.98));
  if (Math.abs(yaw - lastYaw) > 0.002) {
    lastYaw = yaw;
    for (const g of fronts) g.innerHTML = wheelSvg(P_CAR, FRONT, g.dataset.wheel === "fl" ? HALF : -HALF, WR, WW, yaw);
    const a = iso([FRONT, HALF + 9, 0], P_CAR), b = iso([FRONT + 52 * Math.cos(yaw), HALF + 9 + 52 * Math.sin(yaw), 0], P_CAR), t = iso([FRONT + 60 * Math.cos(yaw / 2), HALF + 9 + 60 * Math.sin(yaw / 2), 0], P_CAR);
    heading.innerHTML = yaw < 0.01 ? "" : '<path class="route" style="stroke-dasharray:none;stroke-width:1.6px" d="M' + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1) + '"/><circle cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '" r="1.6" fill="#e0b84c"/><text x="' + (t[0] + 4).toFixed(1) + '" y="' + (t[1] + 3).toFixed(1) + '" fill="#e0b84c" font-size="11" font-weight="600" font-family="ui-monospace,Menlo,monospace">δ = ' + Math.round(yaw * 180 / Math.PI) + "°</text>";
  }
  // the virtual bumper: back up until the wall stops the car; a second later the place behind it is marked
  bumpView.style.opacity = bump;
  bpart("bcar").setAttribute("transform", translateAlong(P_BUMP, [BACK_FROM + (BACK_TO - BACK_FROM) * ease(ramp(p, 6.62, 6.8)), 0, 0]));
  bpart("b-l1").style.opacity = ramp(p, 6.6, 6.66); bpart("b-l2").style.opacity = ramp(p, 6.8, 6.86); bpart("b-l3").style.opacity = ramp(p, 6.9, 6.96);
  bpart("b-marks").style.opacity = ease(ramp(p, 6.88, 6.97));
  stepEls.forEach((st, i) => st.classList.toggle("on", Math.abs(p - i) < 0.42));
  tagEls.forEach((t, i) => t.classList.toggle("on", Math.abs(p - i) < 0.5));
  ticks.forEach((tk, i) => tk.classList.toggle("on", Math.round(p) === i));
  for (const e of formula.querySelectorAll("[data-term]")) { const [from, to] = TERMS[e.dataset.term]; e.classList.toggle("on", p > from && p < to); }
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
addEventListener("scroll", kick, { passive: true }); addEventListener("resize", kick);
kick();
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tesla Jr., in eight scenes — Rainyforest</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css">
<style>${k.ISO_CSS}${CSS}</style></head><body class="iso" data-theme="dark">${defs}
<main class="story" style="--n:${steps.length}"><div class="stage">
${crumb}
<div class="words">${words}</div>
<div class="fig"><p class="sim" aria-hidden="true">Perspective · /World/t870</p>${course(P_WIDE, "wide")}${course(P_TALL, "tall")}${closeUp().replace('class="iso-svg view car"', 'class="iso-svg view car" style="opacity:0"')}${bumpView().replace('class="iso-svg view bump"', 'class="iso-svg view bump" style="opacity:0"')}<p class="tags">${tags}</p></div>
${formula}
<div class="ticks" aria-hidden="true">${steps.map(() => "<span></span>").join("")}</div>
</div></main>
<section class="after"><h2>The picture is the short version.</h2><p>The write-up has the rest: why a car and not a robot base, what the node does, what broke on the way, and what the camera alone could not do.</p><p class="links"><a href="../index.html">More detail →</a><a href="../../index.html">All experience</a><a href="../../../index.html">Home</a></p></section>
<footer>A preview. Everything here ran in a simulator. The search trees and the rollouts are drawn by small re-implementations with the project's settings, to show how the methods work; they are not Nav2's own output. The sharp-cornered path and the wall in the last scene are sketches.</footer>
<script type="module">${(kitScript() + live).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
const OUT = join(HERE, "..", "work", "tesla-jr", "story");
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), html);
console.log("wrote work/tesla-jr/story/index.html", html.length);

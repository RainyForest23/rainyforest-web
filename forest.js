// The forest behind a reading page (Work list, write-ups). Same drawing as the first page, without ground or snake.
// Wide screens: fixed behind the page, trees at the sides, the text column left clear. Narrow screens: a short band of canopy under the nav.
// <canvas class="forest" data-rain="sides|none" data-column="main .wrap">
(() => {
  const cv = document.querySelector('canvas.forest'); if (!cv) return;
  const ctx = cv.getContext('2d'), css = getComputedStyle(document.documentElement);
  const hex = name => { const h = css.getPropertyValue(name).trim().slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const K = Object.fromEntries(['bg', 'dot', 'leaf-lo', 'leaf', 'leaf-hi', 'bark-lo', 'bark-hi', 'rain'].map(n => [n, hex('--' + n)]));
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgb = a => `rgb(${a.map(Math.round).join(',')})`;
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const hash = (x, y) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y) => vnoise(x, y) * 0.65 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.35;
  const ramp = (mat, l) => {
    l = clamp(l);
    if (mat === 'bark') return lerp(K['bark-lo'], K['bark-hi'], l);
    if (mat === 'floor') return lerp(K['floor-lo'], K['floor-hi'], l);
    return l < .5 ? lerp(K['leaf-lo'], K.leaf, l * 2) : lerp(K.leaf, K['leaf-hi'], (l - .5) * 2);
  };


  let W = 0, H = 0, s = 8, ox = 0, cols = 0, rows = 0, G = 0, dpr = 1, wide = true, zones = [], open = [], drops = [];
  const base = document.createElement('canvas');
  const groundAt = () => G;                                    // no ground here: trunks run off the bottom of the screen
  const dot = (g, c, r, rad) => { g.beginPath(); g.arc(ox + (c + 0.5) * s, (r + 0.5) * s, rad, 0, 6.2832); g.fill(); };
  const quiet = (c, r) => { let q = 1; for (const z of zones) q = Math.min(q, Math.hypot(Math.max(z.c0 - c, 0, c - z.c1), Math.max(z.r0 - r, 0, r - z.r1)) / z.f); return q; };

  function layout() {
    const col = document.querySelector(cv.dataset.column || 'main .wrap').getBoundingClientRect(), nav = document.querySelector('.nav').getBoundingClientRect();
    W = document.documentElement.clientWidth;
    wide = (W - col.width) / 2 >= 72;                          // is there room for trees beside the text?
    H = wide ? window.innerHeight : Math.round(nav.height);
    cv.style.position = wide ? 'fixed' : 'absolute'; cv.style.height = H + 'px';
    s = W < 520 ? 6 : W < 1000 ? 7 : 8;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [cv, base]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    cols = Math.ceil(W / s); rows = Math.ceil(H / s); ox = (W - cols * s) / 2; G = rows + 14;
    const top = cv.getBoundingClientRect().top;
    const box = (el, pad, f) => { const b = el.getBoundingClientRect(); return { c0: Math.floor((b.left - ox) / s) - pad, c1: Math.ceil((b.right - ox) / s) + pad - 1, r0: Math.floor((b.top - top) / s) - pad, r1: Math.ceil((b.bottom - top) / s) + pad - 1, f }; };
    zones = [...document.querySelectorAll('.nav .me, .nav ul, .nav .lang')].map(el => box(el, 1, 4));
    if (wide) zones.push({ c0: Math.floor((col.left - ox) / s) - 3, c1: Math.ceil((col.right - ox) / s) + 2, r0: -999, r1: 999, f: Math.max(5, Math.round(cols * 0.045)) });
    paint();
    open = []; for (let c = 0; c < cols; c++) if (quiet(c, Math.floor(rows / 2)) > 0.6) open.push(c);   // columns where rain may fall
    drops = wide && cv.dataset.rain === 'sides' ? Array.from({ length: Math.round(open.length * 0.28) }, () => newDrop(true)) : [];
  }

  function paint() {
    const big = cols >= 140, mid = cols >= 90, k = big ? 1 : mid ? 0.82 : 0.62;
    const ch = wide ? rows * (big ? 0.27 : mid ? 0.25 : 0.2) : rows * 0.8;                      // canopy depth
    const trees = (big ? [
      [.335, 2.2, 0, .28], [.665, 2.2, 0, .28], [.105, 3.2, 0, .4], [.255, 3, .02, .4], [.74, 3.2, -.02, .4], [.985, 3.6, 0, .4],
      [.165, 6, -.03, .7], [.82, 6.5, .035, .7], [.045, 11, .05, 1], [.93, 12.5, -.06, 1],
    ] : mid ? [
      [.12, 2.6, 0, .4], [.88, 2.6, 0, .4], [.19, 4.6, -.03, .7], [.81, 4.8, .03, .7], [.04, 9, .05, 1], [.95, 10, -.06, 1],
    ] : [
      [.11, 2, 0, .35], [.2, 3.2, -.02, .6], [.8, 3.4, .025, .6], [.02, 7.5, .04, 1], [.985, 8, -.05, 1],
    ]).map(([x, w, lean, z], i) => ({ x, w, lean, z, sd: i + 1 }));
    const trunkX = (t, r) => t.x * cols + t.lean * (G - r) + Math.sin((G - r) * 0.035 + t.sd * 1.7) * 1.3 * t.z;

    // things drawn by stamping small discs along a curve: branches, lianas, vines, ferns
    const stamp = (map, x, y, rad, lum, mat, fade = 1) => {
      for (let c = Math.floor(x - rad); c <= Math.ceil(x + rad); c++) for (let r = Math.floor(y - rad); r <= Math.ceil(y + rad); r++) {
        const d = Math.hypot(c + .5 - x, r + .5 - y); if (d > rad + .35) continue;
        const l = lum * (1 - 0.45 * (d / (rad + .35)) ** 2), key = c * 4096 + r, cur = map.get(key);
        if (!cur || l > cur.l) map.set(key, { l, mat, fade });
      }
    };
    const blobs = [], limbs = { mid: new Map(), near: new Map() }, hang = new Map(), ferns = new Map();

    for (const t of trees) {
      if (t.z < .6) continue;
      const n = t.z >= 1 ? 3 : 2, inward = t.x < .5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const h1 = hash(t.sd, i * 7 + 1), h2 = hash(t.sd, i * 7 + 2), side = i % 2 ? -inward : inward;
        const r0 = ch * (0.72 + 0.34 * i) + h1 * 3, x0 = trunkX(t, r0), len = t.w * (2.4 + 1.6 * h2);
        const dx = side * (0.85 + 0.5 * h1), dy = -(0.55 + 0.5 * h2), nrm = Math.hypot(dx, dy);
        for (let p = 0; p <= 1; p += 0.5 / len) {
          const bend = Math.sin(p * 3.1416) * len * 0.08;
          stamp(t.z >= 1 ? limbs.near : limbs.mid, x0 + dx / nrm * len * p, r0 + dy / nrm * len * p + bend, (t.w * 0.2) * (1 - p) + 0.5, 0.62 - 0.2 * p, 'bark', 0.45 + 0.55 * t.z);
        }
        blobs.push({ x: x0 + dx / nrm * len, y: r0 + dy / nrm * len, R: (6 + 5 * h1) * k, z: t.z, i: blobs.length });
      }
      for (const off of [-1, 1]) {                                          // a fern at each side of the roots
        const bx = trunkX(t, G) + off * t.w * (0.9 + 0.4 * hash(t.sd, off + 5)), by = groundAt(Math.round(bx)) + 1;
        for (let f = 0; f < 5; f++) {
          const ang = (-160 + f * 35 + (hash(t.sd * 3 + off, f) - .5) * 12) * Math.PI / 180, L = (10 + 7 * hash(f, t.sd)) * k * (0.6 + 0.4 * t.z);
          for (let p = 0; p <= 1; p += 0.4 / L) {
            const x = bx + Math.cos(ang) * L * p, y = by + Math.sin(ang) * L * p + 0.55 * L * p * p;
            stamp(ferns, x, y, 0.3 + 0.55 * Math.sin(Math.min(1, p * 1.08) * 3.1416) ** 0.6 * (0.4 + 0.6 * Math.abs(Math.sin(p * L * 1.1))), 0.4 + 0.5 * p, 'leaf', 0.55 + 0.45 * t.z);
          }
        }
      }
    }
    // canopy: overlapping leaf clumps, thinner over the middle of the screen
    const nb = Math.round(cols / 2.6);
    for (let i = 0; i < nb; i++) {
      let x = hash(i, 11) * cols, y = hash(i, 12) ** 1.7 * ch * 1.05 - 2, R = ((big ? 5 : 4) + hash(i, 13) * (big ? 9 : 7)) * (mid ? 1 : 0.85);
      const centre = Math.exp(-(((x / cols - .5) / .2) ** 2));
      if (wide && centre > 0.3 && y + R > ch * 0.45) { y *= 0.3; R *= 0.7; }
      blobs.push({ x, y, R, z: 0.4 + 0.6 * hash(i, 14), i: blobs.length });
    }
    for (const side of [0, 1]) for (let i = 0; i < 4; i++)
      blobs.push({ x: side ? cols - hash(i, 21) * cols * 0.13 : hash(i, 22) * cols * 0.13, y: ch * (0.45 + 0.7 * hash(i + side * 9, 23)), R: (9 + 5 * hash(i, 24 + side)) * k, z: 0.95, i: blobs.length });
    blobs.sort((a, b) => a.z - b.z);

    // lianas draped between trunks, and vines hanging from the canopy
    const strong = trees.filter(t => t.z >= .6);
    for (let i = 0; i + 1 < strong.length; i++) {
      const a = strong[i], b = strong[i + 1]; if (Math.abs(a.x - b.x) > 0.3) continue;
      const ra = ch * (0.95 + 0.3 * hash(i, 31)), rb = ch * (0.8 + 0.3 * hash(i, 32)), xa = trunkX(a, ra), xb = trunkX(b, rb), sag = (7 + 6 * hash(i, 33)) * k;
      for (let p = 0; p <= 1; p += 0.4 / Math.abs(xb - xa)) {
        const x = xa + (xb - xa) * p, y = ra + (rb - ra) * p + sag * 4 * p * (1 - p);
        stamp(hang, x, y, 0.45, 0.42, 'bark', 0.8);
        if (Math.round(p * Math.abs(xb - xa)) % 5 === 2) stamp(hang, x, y + 1.2, 0.7, 0.5, 'leaf', 0.8);
      }
    }
    for (let i = 0; i < (big ? 14 : mid ? 9 : 6); i++) {
      const rr = hash(i, 41), x0 = (rr < .5 ? rr * 2 * .34 : .66 + (rr - .5) * 2 * .34) * cols, r0 = ch * (0.2 + 0.5 * hash(i, 42)), len = 8 + hash(i, 43) * rows * 0.3;
      for (let d = 0; d <= len; d += 0.5) {
        const x = x0 + Math.sin(d * 0.11 + i) * 1.1, y = r0 + d;
        stamp(hang, x, y, 0.35, 0.34, 'leaf', 0.75);
        if (Math.round(d * 2) % 7 === 3) stamp(hang, x + (Math.round(d) % 2 ? 1.1 : -1.1), y, 0.75, 0.55, 'leaf', 0.75);
      }
    }
    // big leaves in the bottom corners, drawn on their own layer so the snake can pass behind them
    const leaves = [];
    for (const side of [0, 1]) [[-84, 30], [-60, 37], [-35, 33], [-13, 25]].forEach(([deg, L], i) => {
      const a = (side ? 180 - deg : deg) * Math.PI / 180, len = L * k * (0.9 + 0.2 * hash(i, 51 + side));
      leaves.push({ x: side ? cols + 2 - i * 2 : -2 + i * 2, y: rows + 3, cos: Math.cos(a), sin: Math.sin(a), len, wid: len * 0.4, light: 0.8 + 0.2 * hash(i, 53 + side), flip: side ? -1 : 1 });
    });

    const trunk = (t, c, r, gr) => {
      if (r > gr) return null;
      const h = G - r, hw = t.w / 2 * (0.82 + 0.18 * Math.exp(-h / 40)) + (t.z >= .6 ? t.w * 0.95 * Math.exp(-Math.max(0, h) / (t.w * 0.75)) : 0);
      const px = c + .5 - trunkX(t, r), u = px / hw; if (Math.abs(u) > 1) return null;
      let l = 0.06 + Math.sqrt(1 - u * u) ** 0.7 * clamp(0.78 - 0.62 * u, 0.12, 1);           // round column lit from the left
      if (t.w > 4 && Math.sin(px * 2.6 + vnoise(r * 0.05, t.sd) * 5 + Math.sin(r * 0.09 + t.sd) * 0.8) > 0.5) l *= 0.4;   // bark furrows
      l *= 0.82 + 0.36 * fbm(c * 0.35 + t.sd * 7, r * 0.09);                                  // blotches
      const moss = t.z >= .6 && fbm(c * 0.2 + t.sd * 3, r * 0.1) > 0.72;
      return { l: moss ? l * 0.9 : l, mat: moss ? 'leaf' : 'bark', fade: 0.4 + 0.6 * t.z };
    };
    const blob = (b, c, r) => {
      const dx = c + .5 - b.x, dy = r + .5 - b.y; if (Math.abs(dx) > b.R * 1.2 || Math.abs(dy) > b.R * 1.2) return null;
      const R = b.R * (0.8 + 0.4 * vnoise(Math.atan2(dy, dx) * 2.2 + b.i * 13, b.i)), d = Math.hypot(dx, dy) / R; if (d > 1) return null;
      let l = clamp(0.66 - 0.6 * dy / R - 0.16 * dx / R) * (0.5 + 0.5 * Math.sqrt(1 - d * d));  // clump lit from above
      l *= (0.5 + 0.9 * hash(c * 7 + b.i, r)) * (0.75 + 0.5 * vnoise(c * 0.9, r * 0.9));        // leaves
      return l < 0.07 ? null : { l, mat: 'leaf', fade: 0.4 + 0.6 * b.z };
    };


    const g = base.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = rgb(K.bg); g.fillRect(0, 0, W, H);
    const rad0 = Math.max(0.6, s * 0.07);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const sink = wide ? 1 : clamp((rows - r - 1) / (rows * 0.45));          // the band thins out toward its lower edge
      const q = Math.min(1, quiet(c, r)) * sink, key = c * 4096 + r;
      if (q <= 0) continue;                                                   // nothing at all behind the text
      let hit = null;
      for (const t of trees) if (t.z < .6) hit = trunk(t, c, r, G) || hit;
      for (const b of blobs) if (b.z < .7) hit = blob(b, c, r) || hit;
      hit = hang.get(key) || hit;
      for (const t of trees) if (t.z >= .6 && t.z < 1) hit = trunk(t, c, r, G) || hit;
      hit = limbs.mid.get(key) || hit;
      for (const t of trees) if (t.z >= 1) hit = trunk(t, c, r, G) || hit;
      hit = limbs.near.get(key) || hit;
      for (const b of blobs) if (b.z >= .7) hit = blob(b, c, r) || hit;
      g.globalAlpha = q; g.fillStyle = rgb(K.dot); dot(g, c, r, rad0);
      if (hit) { g.fillStyle = rgb(lerp(K.bg, ramp(hit.mat, hit.l), hit.fade)); dot(g, c, r, s * (0.06 + 0.45 * clamp(hit.l)) * (0.55 + 0.45 * q)); }
      if (wide) for (const lf of leaves) {                                    // big leaves in the bottom corners
        const px = (c + .5 - lf.x) * lf.cos + (r + .5 - lf.y) * lf.sin, py = -(c + .5 - lf.x) * lf.sin + (r + .5 - lf.y) * lf.cos, u = px / lf.len;
        if (u <= 0 || u >= 1) continue;
        const hw = lf.wid / 2 * Math.sin(3.1416 * u ** 0.8), v = py / hw; if (Math.abs(v) > 1) continue;
        g.globalAlpha = 1; g.fillStyle = rgb(K.bg); g.fillRect(ox + c * s, r * s, s, s);
        if (Math.abs(v) > 0.8 || u < 0.04) continue;
        let l = (v * lf.flip > 0 ? 0.36 : 0.66) * lf.light * (0.8 + 0.2 * (1 - Math.abs(v)));
        if (Math.abs(py) < 0.6) l *= 0.25; else { const ph = px * 0.2 - Math.abs(py) * 0.42; if (ph - Math.floor(ph) < 0.14) l *= 0.55; }
        g.globalAlpha = q; g.fillStyle = rgb(ramp('leaf', 0.12 + 0.85 * l)); dot(g, c, r, s * (0.14 + 0.4 * l));
      }
      g.globalAlpha = 1;
    }
  }

  const newDrop = anywhere => ({ c: open[Math.floor(Math.random() * open.length)], y: anywhere ? Math.random() * rows : -Math.random() * rows * 0.5, v: 50 + Math.random() * 30 });
  let last = 0, raf = 0;
  function frame(ms) {
    raf = 0;
    const dt = Math.min(0.05, (ms - last) / 1000 || 0); last = ms;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const moving = drops.length && !still.matches;
    if (moving) {
      ctx.fillStyle = rgb(K.rain);
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i]; d.y += d.v * dt;
        if (d.y > rows + 4) { drops[i] = newDrop(false); continue; }
        for (let n = 0; n < 4; n++) { const r = Math.floor(d.y) - n; if (r < 0) continue; ctx.globalAlpha = [0.5, 0.28, 0.14, 0.07][n]; dot(ctx, d.c, r, s * 0.16); }
      }
      ctx.globalAlpha = 1;
    }
    if (moving && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  let timer = 0;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { layout(); kick(); }, 120); });
  document.addEventListener('visibilitychange', kick);
  still.addEventListener('change', kick);
  layout(); kick();
})();

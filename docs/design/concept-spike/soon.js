// The "under construction" picture, for sections that are not built yet:
// one tree, and the site's snake in a hard hat climbing it. Same dot grid as everything else.
// <canvas class="soon" aria-hidden="true">
(() => {
  const cv = document.querySelector('canvas.soon'); if (!cv) return;
  const ctx = cv.getContext('2d'), css = getComputedStyle(document.documentElement);
  const hex = name => { const h = css.getPropertyValue(name).trim().slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const K = Object.fromEntries(['bg', 'dot', 'ink', 'ink-2', 'leaf-lo', 'leaf', 'leaf-hi', 'bark-lo', 'bark-hi', 'floor-lo', 'floor-hi', 'rain', 'snake', 'snake-2', 'snake-hi', 'tongue'].map(n => [n, hex('--' + n)]));
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgb = a => `rgb(${a.map(Math.round).join(',')})`;
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const hash = (x, y) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y) => vnoise(x, y) * 0.65 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.35;
  const leafTone = l => { l = clamp(l); return l < .5 ? lerp(K['leaf-lo'], K.leaf, l * 2) : lerp(K.leaf, K['leaf-hi'], (l - .5) * 2); };

  let W = 0, H = 0, s = 8, ox = 0, cols = 0, rows = 0, G = 0, top = 0, crown = 0, tx = 0, hw = 5, Z = 1, dpr = 1, zones = [], drops = [];
  const base = document.createElement('canvas'), front = document.createElement('canvas');   // base: ground, tree and its leaves. front: what the snake passes behind
  const dot = (g, c, r, rad) => { g.beginPath(); g.arc(ox + (c + 0.5) * s, (r + 0.5) * s, rad, 0, 6.2832); g.fill(); };
  const quiet = (c, r) => { let q = 1; for (const z of zones) q = Math.min(q, Math.hypot(Math.max(z.c0 - c, 0, c - z.c1), Math.max(z.r0 - r, 0, r - z.r1)) / z.f); return q; };
  const trunkX = r => tx + Math.sin((G - r) * 0.03) * 0.8;
  const halfAt = r => hw * (0.86 + 0.14 * Math.exp(-(G - r) / 40)) + hw * 0.9 * Math.exp(-Math.max(0, G - r) / (hw * 1.4));   // flares into roots

  function layout() {
    W = document.documentElement.clientWidth; H = window.innerHeight;
    const wide = W >= 720;
    s = W < 520 ? 6 : W < 1000 ? 7 : 8; Z = wide ? 1.35 : 1.05;          // Z: how large the snake is drawn
    dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [cv, base, front]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    cols = Math.ceil(W / s); rows = Math.ceil(H / s); ox = (W - cols * s) / 2;
    G = rows - Math.max(9, Math.round(rows * 0.13)); top = Math.round(rows * 0.2); crown = Math.round(top * 0.85);   // crown: the row where the snake goes out of sight
    tx = cols * (wide ? 0.7 : 0.8); hw = wide ? 5.6 : 3.9;
    const box = (el, pad, f) => { const b = el.getBoundingClientRect(); return { c0: Math.floor((b.left - ox) / s) - pad, c1: Math.ceil((b.right - ox) / s) + pad - 1, r0: Math.floor(b.top / s) - pad, r1: Math.ceil(b.bottom / s) + pad - 1, f }; };
    zones = [...document.querySelectorAll('.nav .me, .nav ul, .nav .lang, .soon-text')].map(el => box(el, 1, 4));
    paint();
    drops = Array.from({ length: Math.round(cols * 0.16) }, () => ({ c: Math.floor(Math.random() * cols), y: Math.random() * rows, v: 50 + Math.random() * 30 }));
  }

  function paint() {
    const g = base.getContext('2d'), f = front.getContext('2d');
    for (const x of [g, f]) { x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); }
    g.fillStyle = rgb(K.bg); g.fillRect(0, 0, W, H);
    // leaf clumps: a crown over the tree and a thin band across the top (behind the snake), a bush at the foot (in front of it)
    const blobs = [];
    for (let i = 0; i < 26; i++) blobs.push({ x: tx + (hash(i, 1) - .5) * hw * 9, y: top * 0.35 + hash(i, 2) * top * 0.8, R: 5 + hash(i, 3) * 7, i });
    for (let i = 0; i < Math.round(cols / 5); i++) blobs.push({ x: hash(i, 4) * cols, y: hash(i, 5) * top * 0.3 - 1, R: 3 + hash(i, 6) * 4, i: i + 40 });
    for (let i = 0; i < 6; i++) blobs.push({ x: tx + (hash(i, 7) - .5) * hw * 4.2, y: G + 1.5 - hash(i, 8) * 4, R: 3.2 + hash(i, 9) * 2.6, i: i + 90, near: true });
    const leafAt = (c, r, near) => {
      let best = 0;
      for (const b of blobs) {
        if (!!b.near !== near) continue;
        const dx = c + .5 - b.x, dy = r + .5 - b.y; if (Math.abs(dx) > b.R * 1.2 || Math.abs(dy) > b.R * 1.2) continue;
        const R = b.R * (0.8 + 0.4 * vnoise(Math.atan2(dy, dx) * 2.2 + b.i * 13, b.i)), d = Math.hypot(dx, dy) / R; if (d > 1) continue;
        const l = clamp(0.66 - 0.6 * dy / R - 0.16 * dx / R) * (0.5 + 0.5 * Math.sqrt(1 - d * d)) * (0.5 + 0.9 * hash(c * 7 + b.i, r)) * (0.75 + 0.5 * vnoise(c * 0.9, r * 0.9));
        if (l > best) best = l;
      }
      return best;
    };
    const rad0 = Math.max(0.6, s * 0.07);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const q = Math.min(1, quiet(c, r));
      g.fillStyle = rgb(K.dot); dot(g, c, r, rad0);
      if (r >= G) {                                                          // ground
        const l = 0.2 + 0.3 * (r - G) / Math.max(1, rows - G) + 0.4 * fbm(c * 0.15, r * 0.45) + 0.18 * hash(c, r);
        g.fillStyle = rgb(lerp(K['floor-lo'], K['floor-hi'], clamp(l))); dot(g, c, r, s * (0.06 + 0.45 * clamp(l)));
      } else {                                                               // the tree
        const px = c + .5 - trunkX(r), half = halfAt(r), u = px / half;
        if (Math.abs(u) <= 1 && r > top * 0.55 && q > 0) {                     // the crown hides the top of the trunk
          let l = 0.2 + Math.sqrt(1 - u * u) ** 0.5 * clamp(0.62 - 0.26 * u, 0.36, 1);   // lit from the left, but the far side still reads
          if (Math.sin(px * 2.6 + vnoise(r * 0.05, 3) * 5 + Math.sin(r * 0.09) * 0.8) > 0.5) l *= 0.62;
          l *= 0.82 + 0.36 * fbm(c * 0.35 + 21, r * 0.09);
          g.globalAlpha = q; g.fillStyle = rgb(lerp(K['bark-lo'], K['bark-hi'], clamp(l))); dot(g, c, r, s * (0.06 + 0.45 * clamp(l))); g.globalAlpha = 1;
        }
      }
      const leaf = (x, l, alpha, cover) => {
        if (cover) { x.globalAlpha = alpha; x.fillStyle = rgb(K.bg); x.fillRect(ox + c * s, r * s, s, s); }
        x.globalAlpha = alpha; x.fillStyle = rgb(leafTone(l)); dot(x, c, r, s * (0.06 + 0.45 * clamp(l)) * (0.55 + 0.45 * alpha)); x.globalAlpha = 1;
      };
      const far = leafAt(c, r, false), near = leafAt(c, r, true);
      if (far > 0.07 && q > 0) leaf(g, far, q, far > 0.3);                      // the crown, behind the snake
      if (near > 0.07) leaf(f, near, 1, true);                                 // the bush the snake comes out of
      // where the snake goes out of sight: a cap of full leaves with a ragged lower edge, in front of it
      const edge = crown + (hash(c, 5) > 0.45 ? 1 : 0) + (hash(c, 9) > 0.8 ? 1 : 0);
      if (Math.abs(c + .5 - trunkX(r)) <= hw * 2.4 && r >= crown - 4 && r <= edge) leaf(f, 0.5 + 0.45 * hash(c, r), 1, true);
    }
  }

  /* ---- the snake: climbs by winding round the trunk; the head and its hat stay on the near side ---- */
  const bodyR = (u, L) => {
    u /= Z;
    const r = u < 0.8 ? 1.0 + u / 0.8 : u < 2.6 ? 2.0 + (u - 0.8) / 1.8 * 0.6 : u < 3.8 ? 2.6 - (u - 2.6) / 1.2 * 1.3 : u < 8 ? 1.3 + (u - 3.8) / 4.2 * 0.5
      : (u * Z / L < 0.55 ? 1.8 : Math.max(0.3, 1.8 * (1 - (u * Z / L - 0.55) / 0.45) ** 0.85));
    return r * Z;
  };
  const snake = { hy: null, wait: 0 };
  function drawSnake(dt, moving, time) {
    const L = clamp(rows * 0.5, 30, 54) * Z, kk = 0.36 / Z;
    const pin = new URLSearchParams(location.search).get('y');
    if (pin !== null) { snake.hy = top + (G - top) * parseFloat(pin); moving = false; }
    if (snake.hy === null) snake.hy = G - (G - top) * 0.42;
    if (moving) {
      if (snake.wait > 0) { snake.wait -= dt; if (snake.wait <= 0) snake.hy = G + 3; else return; }
      snake.hy -= (3.6 + 1.2 * Math.sin(time * 1.5)) * dt;                   // climbs in small surges
      if (snake.hy < -L * 0.8) { snake.wait = 2.5; return; }
    }
    const pts = [];
    for (let u = 0, y = snake.hy; u <= L && y < rows + 4; u += 0.25) {
      const wrap = smooth(6 * Z, 13 * Z, u), amp = (hw * 0.4) * (1 - wrap) + (hw + 1.5) * wrap, th = y * kk;
      const slope = amp * kk * Math.cos(th), n = Math.hypot(1, slope);
      pts.push({ u, x: trunkX(y) + amp * Math.sin(th), y, tx: -slope / n, ty: -1 / n, behind: wrap > 0.5 && Math.cos(th) < -0.05 });
      y += 0.25 / n;
    }
    const cells = new Map();
    for (const p of pts) {
      const R = bodyR(p.u, L), reach = R + 0.5;
      for (let c = Math.floor(p.x - reach); c <= Math.ceil(p.x + reach); c++) for (let r = Math.floor(p.y - reach); r <= Math.ceil(p.y + reach); r++) {
        const dx = c + .5 - p.x, dy = r + .5 - p.y, d = Math.hypot(dx, dy); if (d > reach) continue;
        const key = c * 4096 + r, cur = cells.get(key), rel = d / R;
        if (!cur || (cur.behind && !p.behind) || (cur.behind === p.behind && rel < cur.rel)) cells.set(key, { c, r, rel, d, R, u: p.u, behind: p.behind, v: (dx * -p.ty + dy * p.tx) / R });
      }
    }
    for (const p of cells.values()) {
      if (p.r >= G + 1 || p.r < crown) continue;                             // under the bush at the foot, or up inside the leaves
      if (p.behind && Math.abs(p.c + .5 - trunkX(p.r)) <= halfAt(p.r) - 0.2) continue;            // passing behind the trunk
      ctx.fillStyle = rgb(K.bg); ctx.fillRect(ox + p.c * s, p.r * s, s, s);
      const band = p.u > 5.4 * Z && (p.u - 5.4 * Z) % (5.2 * Z) < 1.7 * Z, back = !band && Math.abs(p.v) < 0.5;
      ctx.fillStyle = rgb(band ? K['snake-2'] : back ? K['snake-hi'] : K.snake);
      dot(ctx, p.c, p.r, s * (0.15 + 0.33 * Math.min(1, clamp(1 - (p.d - p.R) / 0.5)) * (1 - 0.38 * Math.min(1, p.rel) ** 2)));
    }
    // hard hat, drawn upright like a hat seen from the front: a dome with a ridge, a wide brim, and the eyes just under it
    const at = u => pts[Math.min(pts.length - 1, Math.round(u * 4))], h = at(1.5 * Z);
    if (h && h.y < G - 1) {
      const cx = at(1.2 * Z).x, rb = Math.floor(h.y), half = 2.7 * Z, tall = Math.round(2.9 * Z);
      const put = (c, r, colour, rad) => { if (r < crown) return; ctx.fillStyle = rgb(K.bg); ctx.fillRect(ox + c * s, r * s, s, s); if (colour) { ctx.fillStyle = rgb(colour); dot(ctx, c, r, s * rad); } };
      for (let c = Math.floor(cx - half - 2); c <= Math.ceil(cx + half + 1); c++) {
        const dx = c + .5 - cx;
        if (Math.abs(dx) <= half + 1.6) put(c, rb, K.ink, 0.47);                                   // brim
        for (let k = 1; k <= tall; k++) if (Math.abs(dx) <= half * Math.sqrt(1 - ((k - 0.5) / (tall + 0.4)) ** 2)) put(c, rb - k, Math.abs(dx) < 0.55 ? K['ink-2'] : K.ink, 0.42);   // dome and ridge
      }
      for (const side of [-1, 1]) put(Math.floor(cx + side * 1.25 * Z), rb + 2, null, 0);          // eyes
    }
  }

  let last = 0, raf = 0;
  function frame(ms) {
    raf = 0;
    const dt = Math.min(0.05, (ms - last) / 1000 || 0); last = ms;
    const moving = !still.matches;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (moving) {
      ctx.fillStyle = rgb(K.rain);
      for (const d of drops) {
        d.y += d.v * dt; if (d.y > G + 2) { d.y = -Math.random() * rows * 0.5; d.c = Math.floor(Math.random() * cols); }
        const q = Math.min(1, quiet(d.c, Math.floor(d.y)));
        for (let n = 0; n < 4; n++) { const r = Math.floor(d.y) - n; if (r < 0) continue; ctx.globalAlpha = [0.5, 0.28, 0.14, 0.07][n] * (0.2 + 0.8 * q); dot(ctx, d.c, r, s * 0.16); }
      }
      ctx.globalAlpha = 1;
    }
    drawSnake(dt, moving, ms / 1000);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(front, 0, 0);
    if (moving && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  let timer = 0;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { layout(); kick(); }, 120); });
  document.addEventListener('visibilitychange', kick);
  still.addEventListener('change', kick);
  layout(); kick();
})();

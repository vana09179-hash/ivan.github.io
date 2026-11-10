// Renault Duster (2009, первое поколение) — математическое описание кузова.
// Оси: X — вперёд, Y — вверх, Z — вправо. Единицы — метры.
import * as THREE from 'three';

export const V3 = THREE.Vector3;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
const box = (v, a, b, e) => sstep(a - e, a + e, v) * sstep(b + e, b - e, v);

// Монотонная кубическая интерполяция (PCHIP) по опорным точкам
export function pchip(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0]);
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

// ── Паспортные размеры ─────────────────────────────────────────────
export const DIM = {
  wheelbase: 2.673, xNose: 2.158, xTail: -2.157,   // длина 4315
  xw: 2.673 / 2, wheelY: 0.337, tireR: 0.343, track: 0.772,
  archR: 0.405, archY: 0.36, archZ: 0.45,
  xe: 1.9,                                       // границы «лофта», дальше — торцы
};
const D = DIM;

// ── Продольные кривые ─────────────────────────────────────────────
export const yb = pchip([[-2.2, 0.42], [-1.9, 0.36], [-1.75, 0.31], [-1.0, 0.29], [1.0, 0.29], [1.75, 0.28], [2.2, 0.28]]);
export const ys = pchip([[-2.2, 1.115], [-1.7, 1.105], [-1.2, 1.075], [-0.2, 1.05], [0.97, 1.03], [1.34, 0.995], [1.9, 0.935], [2.2, 0.91]]);
export const gh = pchip([[2.3, 0], [0.99, 0], [0.80, 0.115], [0.45, 0.335], [0.27, 0.425], [0.12, 0.455], [-0.5, 0.47], [-1.2, 0.445], [-1.8, 0.395], [-2.2, 0.38]]);
export const yt = pchip([[2.2, 0.955], [1.98, 0.965], [1.6, 1.02], [1.2, 1.065], [1.06, 1.08], [0.9, 1.185], [0.6, 1.38], [0.42, 1.49],
  [0.3, 1.555], [0.1, 1.60], [-0.4, 1.625], [-1.0, 1.62], [-1.6, 1.60], [-1.85, 1.585], [-2.2, 1.57]]);
export const yr = x => ys(x) + gh(x);
const Wb = pchip([[-2.2, 0.835], [-1.65, 0.835], [-1.1, 0.868], [0.8, 0.87], [1.5, 0.835], [2.2, 0.835]]);

const WC = 0.835, DF = 0.60, NF = 2.8, DR = 0.45, NR_ = 3.2;
const sup = (u, n) => Math.pow(Math.max(0, 1 - Math.pow(clamp(u, 0, 1), n)), 1 / n);
export const W0 = x => Wb(x) * sup((x - (D.xNose - DF)) / DF, NF) * sup(((D.xTail + DR) - x) / DR, NR_);

const shape = e => 1 - 0.08 * Math.pow(1 - e, 3.5) - 0.065 * Math.pow(e, 4);
const TUMBLE = 0.36;
const ledge = x => 0.025 * sstep(1.05, 0.9, x);
export const zG = x => W0(x) * 0.935 - ledge(x);        // основание бокового стекла
export const wr = x => zG(x) - TUMBLE * gh(x);          // полуширина по кромке крыши

// Раздутые колёсные арки
export function flare(x, y) {
  let f = 0;
  for (const xw of [D.xw, -D.xw]) {
    const d = Math.hypot(x - xw, y - D.archY), t = (d - D.archR) / 0.12;
    if (t < 1) f = Math.max(f, t <= 0 ? 1 : Math.pow(1 - Math.pow(t, 2.2), 2));
  }
  return 0.06 * f;
}
const hoodBulge = (x, z) => 0.011 * sstep(0.44, 0.32, Math.abs(z)) * sstep(1.04, 1.25, x) * sstep(2.02, 1.86, x);

// ── Торцы: силуэт спереди и сзади (по оси) + скругление в плане ──
const xCf = pchip([[0.20, 1.98], [0.27, 2.07], [0.32, 2.115], [0.40, 2.15], [0.50, 2.158], [0.58, 2.155], [0.63, 2.145], [0.70, 2.13],
  [0.84, 2.108], [0.89, 2.095], [0.928, 2.07], [0.95, 2.03], [0.963, 1.99], [0.972, 1.94], [0.977, 1.90], [1.0, 1.80], [1.07, 1.70]]);
const xCr = pchip([[0.30, -2.0], [0.38, -2.09], [0.45, -2.14], [0.55, -2.157], [0.62, -2.155], [0.655, -2.145], [0.685, -2.09],
  [0.90, -2.07], [1.06, -2.045], [1.30, -1.925], [1.50, -1.815], [1.52, -1.875], [1.55, -1.885], [1.585, -1.865], [1.592, -1.80], [1.61, -1.5]]);
const sweep = (z, d, n) => d * (1 - sup(Math.abs(z) / WC, n));
function reliefF(y, z) {
  z = Math.abs(z);
  return -0.014 * box(y, 0.72, 0.89, 0.008) * sstep(0.49, 0.455, z)
    - 0.03 * box(y, 0.405, 0.555, 0.012) * sstep(0.52, 0.47, z)
    - 0.02 * sstep(0.085, 0.05, Math.hypot((z - 0.65) / 1.4, y - 0.48));
}
const reliefR = (y, z) => 0.012 * box(y, 0.775, 0.905, 0.01) * sstep(0.33, 0.29, Math.abs(z));
export const faceF = (y, z) => (y > 1.07 ? 9 : xCf(y)) - sweep(z, DF, NF) + reliefF(y, z);
export const faceR = (y, z) => (y > 1.61 ? -9 : xCr(y)) + sweep(z, DR, NR_) + reliefR(y, z);

// ── Сечение ──────────────────────────────────────────────────────
const NA = 6, NB = 64, NC = 16, ND = 46;
export function halfProfile(x) {   // [z, y, flareFlag]
  const out = [], b = yb(x), s = ys(x), w = W0(x), r = yr(x), t = yt(x), g = zG(x), q = wr(x);
  const zB = w * shape(0);
  for (let j = 0; j < NA; j++) out.push([zB * j / NA, b, 0]);
  for (let j = 0; j <= NB; j++) { const e = j / NB; out.push([w * shape(e), b + (s - b) * e, 1]); }
  for (let j = 0; j <= NC; j++) { const e = j / NC; out.push([lerp(g, q, e), lerp(s + 0.004 * (ledge(x) / 0.025), r, e), 0]); }
  for (let j = 1; j <= ND; j++) {
    const tt = j / ND, th = Math.PI / 2 * (1 - (1 - tt) * (1 - tt));
    const z = j === ND ? 0 : q * Math.sqrt(Math.cos(th));
    out.push([z, r + (t - r) * Math.sin(th) + hoodBulge(x, z), 0]);
  }
  return out;
}

// Полуширина кузова на высоте y (без арок)
export function halfW(x, y) {
  const b = yb(x), s = ys(x);
  if (y < b) return 0;
  if (y <= s) return W0(x) * shape((y - b) / (s - b));
  const r = yr(x);
  if (y <= r && r > s) return lerp(zG(x), wr(x), (y - s) / (r - s));
  const t = yt(x); if (y >= t) return 0;
  const k = (y - r) / (t - r);
  return wr(x) * Math.pow(Math.max(0, 1 - k * k), 0.25);
}
export const sideZ = (x, y) => halfW(x, y) + (y <= ys(x) ? flare(x, y) : 0);
export function topY(x, z) {
  const q = wr(x), zn = clamp(Math.abs(z) / q, 0, 1), r = yr(x);
  return r + (yt(x) - r) * Math.sqrt(1 - Math.pow(zn, 4)) + hoodBulge(x, z);
}
function bisect(f, lo, hi) { for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (f(m)) lo = m; else hi = m; } return lo; }
export function frontX(y, z) {
  z = Math.abs(z); const f = faceF(y, z);
  if (halfW(D.xe, y) >= z) return f;
  if (halfW(1.1, y) <= z) return Math.min(f, 1.1);
  return Math.min(f, bisect(m => halfW(m, y) > z, 1.1, D.xe));
}
export function rearX(y, z) {
  z = Math.abs(z); const f = faceR(y, z);
  if (halfW(-D.xe, y) >= z) return f;
  if (halfW(-1.1, y) <= z) return Math.max(f, -1.1);
  return Math.max(f, bisect(m => halfW(m, y) > z, -1.1, -D.xe));
}

// Параметризации поверхностей для накладных деталей
export const PF = (z, y) => new V3(frontX(y, z), y, z);
export const PR = (z, y) => new V3(rearX(y, z), y, z);
export const PS = (x, y) => new V3(x, y, sideZ(x, y));
export const PT = (x, z) => new V3(x, topY(x, z), z);

// ── Оболочка кузова ──────────────────────────────────────────────
export function buildShell() {
  const NS = 300, NR = 64, rings = [];
  const mk = (x, prof, cap, k) => {
    const half = prof.map(([z0, y0, fl]) => {
      let z = z0, y = y0, xx = x;
      if (cap) {
        const cy = cap > 0 ? 0.62 : 0.95, s = 1 - k / NR;
        z = z0 * s; y = cy + (y0 - cy) * s;
        xx = cap > 0 ? faceF(y, z) : faceR(y, z);
      } else xx = clamp(x, faceR(y, z), faceF(y, z));
      return [xx, y, z + (fl && !cap ? flare(xx, y) : 0)];
    });
    const ring = half.slice();
    for (let j = half.length - 2; j >= 1; j--) ring.push([half[j][0], half[j][1], -half[j][2]]);
    return ring;
  };
  const pr = halfProfile(-D.xe), pf = halfProfile(D.xe);
  for (let k = NR; k >= 1; k--) rings.push(mk(0, pr, -1, k));
  for (let i = 0; i < NS; i++) { const x = -D.xe + 2 * D.xe * i / (NS - 1); rings.push(mk(x, halfProfile(x), 0, 0)); }
  for (let k = 1; k <= NR; k++) rings.push(mk(0, pf, 1, k));
  const M = rings[0].length, pos = new Float32Array(rings.length * M * 3), idx = [];
  rings.forEach((r, i) => r.forEach((p, j) => pos.set(p, (i * M + j) * 3)));
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c = a + M, d = b + M;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── Маски (стекло / чёрный пластик и швы / хром) ─────────────────
function mask(S, w, h, ox, draw) {
  const c = document.createElement('canvas'); c.width = Math.round(w * S); c.height = Math.round(h * S);
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.setTransform(S, 0, 0, -S, ox * S, c.height);
  g.lineJoin = g.lineCap = 'round';
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}
const GLASS = '#f00', BLACK = '#0f0', CHROME = '#00f', PAINT = '#000';
function poly(g, pts, fill, stroke, lw) {
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function line(g, pts, lw = 0.006, col = BLACK) {
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.strokeStyle = col; g.lineWidth = lw; g.stroke();
}
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

export const beltY = x => ys(x) + 0.03, winTop = x => yr(x) - 0.05;
export function buildMasks(Q = 1) {
  const S = 910.2 * Q;
  let xTip = 0.99; while (winTop(xTip) < beltY(xTip) + 0.004) xTip -= 0.002;

  const side = mask(S, 4.5, 2.25, 2.25, g => {
    // нижний чёрный пластик бамперов
    poly(g, [[1.70, 0.1], [2.3, 0.1], [2.3, 0.37], [1.70, 0.37]], BLACK);
    poly(g, [[-1.70, 0.1], [-2.3, 0.1], [-2.3, 0.47], [-1.70, 0.47]], BLACK);
    // чёрные стойки и уголок зеркала
    poly(g, [...range(-1.17, xTip, 60).map(x => [x, beltY(x)]), ...range(xTip, -1.17, 60).map(x => [x, winTop(x)])], BLACK);
    const win = pts => poly(g, pts, GLASS, BLACK, 0.016);
    win([...range(-0.045, 0.70, 30).map(x => [x, beltY(x)]), ...range(0.70, -0.045, 30).map(x => [x, winTop(x)])]);
    win([...range(-0.155, -1.07, 30).map(x => [x, beltY(x)]), [-1.045, winTop(-1.045)], ...range(-1.045, -0.155, 30).map(x => [x, winTop(x)])]);
    win([[-1.17, beltY(-1.17) + 0.005], [-1.4, ys(-1.4) + 0.085], [-1.57, ys(-1.57) + 0.135], [-1.475, winTop(-1.475) - 0.005],
      ...range(-1.475, -1.145, 12).map(x => [x, winTop(x) - 0.005])]);
    // проёмы дверей
    const sill = 0.36, ax = -D.xw, ar = 0.548;
    line(g, [[0.80, sill], [0.80, ys(0.8) - 0.01], [0.86, ys(0.86) + 0.012], ...range(0.86, -1.105, 80).map(x => [x, yr(x) - 0.014])]);
    line(g, [[-0.10, sill], [-0.10, beltY(-0.1)]]);
    const a0 = Math.acos((-1.105 - ax) / ar);
    line(g, [[-1.105, yr(-1.105) - 0.014], [-1.105, D.archY + ar * Math.sin(a0)],
      ...range(a0, 0.02, 24).map(a => [ax + ar * Math.cos(a), D.archY + ar * Math.sin(a)]), [ax + ar, sill]]);
    line(g, [[0.80, sill], [ax + ar, sill]]);
    // швы бамперов
    line(g, [[1.735, 0.50], [1.78, 0.74]], 0.004);
    line(g, [[-1.735, 0.50], [-1.80, 0.69], [-2.3, 0.69]]);
    // защитные молдинги дверей
    g.lineCap = 'round';
    line(g, [[0.70, 0.52], [-0.02, 0.52]], 0.06);
    line(g, [[-0.18, 0.52], [-0.74, 0.52]], 0.06);
    // фара (боковая часть)
    poly(g, [[2.3, 0.74], [1.85, 0.74], [1.78, 0.79], [1.745, 0.87], [1.78, 0.91], [2.3, 0.91]], GLASS, BLACK, 0.012);
  });

  const cowl = z => 1.035 - 0.10 * (z / 0.7) ** 2, head = z => 0.33 - 0.09 * (z / 0.6) ** 2;
  const top = mask(S, 4.5, 1.125, 2.25, g => {
    // жабо под лобовым стеклом
    const zs = range(-0.02, 0.74, 40);
    poly(g, [...zs.map(z => [cowl(z) + 0.075, z]), ...zs.slice().reverse().map(z => [cowl(z) - 0.02, z])], BLACK);
    // лобовое стекло
    const up = [], lo = [];
    for (const x of range(0.2, 1.04, 160)) {
      const zl = x < 0.33 ? 0.6 * Math.sqrt((0.33 - x) / 0.09) : -0.02;
      const zh = Math.min(wr(x) - 0.06, x < 1.035 ? 0.7 * Math.sqrt((1.035 - x) / 0.10) : -1);
      if (zh > zl) { up.push([x, zh]); lo.push([x, zl]); }
    }
    poly(g, [...up, ...lo.reverse()], GLASS, BLACK, 0.022);
    // капот
    line(g, [[cowl(0.69) + 0.075, 0.69], [1.5, 0.665], [1.86, 0.63], [1.97, 0.55]], 0.006);
    for (const z of [0.25]) { g.beginPath(); g.arc(1.3, z, 0.014, 0, 7); g.fillStyle = BLACK; g.fill(); }
    // водостоки крыши
    line(g, [[0.16, 0.455], [-1.76, 0.455]], 0.014);
  });

  const front = mask(S, 1.125, 2.25, 0, g => {
    poly(g, [[-0.1, 0.1], [1.2, 0.1], [1.2, 0.37], [-0.1, 0.37]], BLACK);
    poly(g, [[-0.1, 0.255], [0.36, 0.255], [0.42, 0.33], [0.42, 0.375], [-0.1, 0.375]], CHROME);
    poly(g, [[-0.1, 0.405], [0.455, 0.405], [0.50, 0.44], [0.50, 0.555], [-0.1, 0.555]], BLACK, BLACK, 0.01);   // воздухозаборник
    poly(g, [[0.57, 0.425], [0.73, 0.425], [0.73, 0.535], [0.57, 0.535]], BLACK, BLACK, 0.03);                // ПТФ
    poly(g, [[-0.1, 0.72], [0.447, 0.72], [0.492, 0.89], [-0.1, 0.89]], BLACK, BLACK, 0.008);             // решётка
    poly(g, [[0.515, 0.775], [0.545, 0.74], [1.2, 0.74], [1.2, 0.91], [0.53, 0.91]], GLASS, BLACK, 0.012); // фара
    line(g, [[-0.1, 0.928], [0.50, 0.928], [0.53, 0.915]], 0.006);
    line(g, [[-0.1, 0.692], [0.47, 0.692], [0.52, 0.74]], 0.005);
  });

  const rear = mask(S, 1.125, 2.25, 0, g => {
    poly(g, [[-0.1, 0.1], [1.2, 0.1], [1.2, 0.47], [-0.1, 0.47]], BLACK);
    poly(g, [[-0.1, 0.375], [0.34, 0.375], [0.40, 0.43], [0.40, 0.475], [-0.1, 0.475]], CHROME);
    poly(g, [[-0.1, 1.095], [0.56, 1.095], [0.585, 1.12], [0.505, 1.455], [0.48, 1.475], [-0.1, 1.475]], GLASS, BLACK, 0.03);
    line(g, [[0.53, 1.51], [0.645, 1.08], [0.615, 0.70], [-0.1, 0.70]], 0.006);
    line(g, [[-0.1, 1.508], [0.53, 1.508]], 0.005);
    poly(g, [[-0.1, 0.775], [0.30, 0.775], [0.30, 0.905], [-0.1, 0.905]], BLACK);
  });
  return { side, top, front, rear };
}

// ── Материалы оболочки ──────────────────────────────────────────
export function shellMaterial(masks, glass, params) {
  const m = new THREE.MeshPhysicalMaterial(params);
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tSide: { value: masks.side }, tTop: { value: masks.top }, tFront: { value: masks.front }, tRear: { value: masks.rear } });
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying vec3 vObj; varying vec3 vObjN;\nvoid main() {\n vObj = position; vObjN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `
uniform sampler2D tSide, tTop, tFront, tRear;
varying vec3 vObj; varying vec3 vObjN;
void main() {
  vec3 an = abs(normalize(vObjN));
  vec2 fuv = vec2(abs(vObj.z) / 1.125, vObj.y / 2.25);
  vec3 mS = texture2D(tSide, vec2((vObj.x + 2.25) / 4.5, vObj.y / 2.25)).rgb;
  vec3 mT = texture2D(tTop, vec2((vObj.x + 2.25) / 4.5, abs(vObj.z) / 1.125)).rgb;
  vec3 mF = texture2D(tFront, fuv).rgb, mR = texture2D(tRear, fuv).rgb;
  bool sideDom = an.z > an.y && an.z > an.x;
  vec3 mk = sideDom ? mS : (an.y >= an.x ? (vObjN.y > 0. ? mT : vec3(0., 1., 0.)) : (vObj.x > 0. ? mF : mR));
  if (sideDom && vObj.z > 0.) {
    vec2 q = abs(vObj.xy - vec2(-1.615, 0.985)) - vec2(0.05, 0.045);
    float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - 0.022;
    mk.g = max(mk.g, 1. - smoothstep(0.0015, 0.0035, abs(d)));
  }
  if (abs(vObj.z) > ${D.archZ.toFixed(3)} && min(length(vObj.xy - vec2(${D.xw.toFixed(4)}, ${D.archY})), length(vObj.xy - vec2(-${D.xw.toFixed(4)}, ${D.archY}))) < ${D.archR}) discard;
  bool isGlass = mk.r > 0.5 && mk.g < 0.5;
  if (isGlass ${glass ? '==' : '!='} false) discard;
  float kB = mk.g, kC = mk.b * (1. - mk.g);
  bool inner = !gl_FrontFacing;
`)
      .replace('#include <color_fragment>', glass ? `#include <color_fragment>
  if (vObj.x > 1.7) { diffuseColor.rgb = vec3(1.); diffuseColor.a = 0.1; }` : `#include <color_fragment>
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012), kB);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5), kC);
  if (inner) diffuseColor.rgb = vec3(0.03, 0.03, 0.033);`)
      .replace('#include <roughnessmap_fragment>', glass ? '#include <roughnessmap_fragment>' : `#include <roughnessmap_fragment>
  roughnessFactor = mix(mix(roughnessFactor, 0.6, kB), 0.4, kC); if (inner) roughnessFactor = 0.9;`)
      .replace('#include <metalnessmap_fragment>', glass ? '#include <metalnessmap_fragment>' : `#include <metalnessmap_fragment>
  metalnessFactor = mix(mix(metalnessFactor, 0., kB), 1., kC); if (inner) metalnessFactor = 0.;`)
      .replace('#include <lights_physical_fragment>', glass ? '#include <lights_physical_fragment>' : `#include <lights_physical_fragment>
  #ifdef USE_CLEARCOAT
  material.clearcoat *= (1. - kB) * (inner ? 0. : 1.);
  #endif`);
  };
  return m;
}

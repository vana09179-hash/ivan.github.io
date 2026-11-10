// Навесные детали: колёса, оптика, решётка, зеркала, салон и т.д.
import * as THREE from 'three';
import {
  V3, clamp, sstep, lerp, DIM as D, PF, PR, PS, PT, sideZ, topY, frontX, rearX, ys, yr, wr, yb, halfW,
} from './body.js';

const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
const Std = p => new THREE.MeshStandardMaterial(p);
const Phys = p => new THREE.MeshPhysicalMaterial(p);

// ── Текстуры ─────────────────────────────────────────────────────
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}
const plateTex = () => canvasTex(1040, 224, (g, w, h) => {
  g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4f4f1'; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 18); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 5; g.beginPath(); g.moveTo(790, 10); g.lineTo(790, h - 10); g.stroke();
  g.fillStyle = '#111'; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  g.font = 'bold 150px Arial, sans-serif'; g.fillText('Е 009 КХ', 400, 172);
  g.font = 'bold 110px Arial, sans-serif'; g.fillText('77', 908, 118);
  g.font = 'bold 40px Arial, sans-serif'; g.fillText('RUS', 880, 186);
  [['#fff', 0], ['#1c3fa8', 1], ['#d3222a', 2]].forEach(([c, i]) => { g.fillStyle = c; g.fillRect(940, 150 + i * 13, 62, 13); });
  g.strokeStyle = '#333'; g.lineWidth = 1.5; g.strokeRect(940, 150, 62, 39);
});
const textTex = (txt, w, h, font, fg, bg) => canvasTex(w, h, g => {
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, w / 2, h / 2 + h * 0.04);
});

// ── Общие помощники геометрии ────────────────────────────────────
const outwardRef = p => new V3(p.x - clamp(p.x, -1.6, 1.6), p.y - 0.75, p.z).normalize();

// Накладка-«заплатка» на поверхности P(u,v) со скруглённым контуром
export function patch(P, o) {
  const { cu, cv, hu, hv, p = 6, nu = 20, nv = 12, off = 0.004, edge = 0.3, mat } = o;
  const pos = [], uv = [], rr = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    let a = -1 + 2 * i / nu, b = -1 + 2 * j / nv;
    const ri = Math.max(Math.abs(a), Math.abs(b)), rp = Math.pow(Math.abs(a) ** p + Math.abs(b) ** p, 1 / p);
    const s = rp > 0 ? ri / rp : 0; a *= s; b *= s;
    const q = P(cu + a * hu, cv + b * hv);
    pos.push(q.x, q.y, q.z); uv.push(a * 0.5 + 0.5, b * 0.5 + 0.5); rr.push(ri);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const P3 = g.attributes.position, N3 = g.attributes.normal, v = new V3(), n = new V3();
  for (let i = 0; i < P3.count; i++) {
    v.fromBufferAttribute(P3, i); n.fromBufferAttribute(N3, i);
    if (n.dot(outwardRef(v)) < 0) n.negate();
    const d = typeof off === 'function' ? off(rr[i]) : off * Math.min(1, (1 - rr[i]) / edge) - 0.0015;
    v.addScaledVector(n, d); P3.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = false;
  return m;
}
export function frame(P, u, v) {
  const e = 0.004, pos = P(u, v);
  const n = P(u + e, v).sub(P(u - e, v)).cross(P(u, v + e).sub(P(u, v - e))).normalize();
  if (n.dot(outwardRef(pos)) < 0) n.negate();
  return { pos, n };
}
// Поставить объект на поверхность: локальная Z — по нормали, Y — «вверх»
export function place(obj, f, off = 0, up = new V3(0, 1, 0)) {
  const z = f.n.clone(), x = up.clone().cross(z).normalize(), y = z.clone().cross(x);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  obj.position.copy(f.pos).addScaledVector(z, off);
  return obj;
}
export function tubeOn(P, pts, r, off, closed, mat, seg = 80, rs = 8) {
  const p3 = pts.map(([u, v]) => { const f = frame(P, u, v); return f.pos.addScaledVector(f.n, off); });
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p3, closed, 'centripetal'), seg, r, rs, closed), mat);
}
function roundedPoly(pts, r, n = 5) {
  const out = [], L = pts.length;
  for (let i = 0; i < L; i++) {
    const a = pts[(i + L - 1) % L], b = pts[i], c = pts[(i + 1) % L];
    const d1 = Math.hypot(a[0] - b[0], a[1] - b[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const p1 = [lerp(b[0], a[0], r / d1), lerp(b[1], a[1], r / d1)], p2 = [lerp(b[0], c[0], r / d2), lerp(b[1], c[1], r / d2)];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    out.push(m);
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      out.push([u * u * p1[0] + 2 * u * t * b[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * b[1] + t * t * p2[1]]);
    }
  }
  return out;
}
export function rbox(w, h, d, r, seg = 5) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), P = g.attributes.position, v = new V3(), c = new V3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i); c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    v.sub(c).normalize().multiplyScalar(r).add(c); P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
function bar(a, b, w, h, mat, r = 0) {
  const len = a.distanceTo(b), m = new THREE.Mesh(r ? rbox(w, h, len, r, 2) : new THREE.BoxGeometry(w, h, len), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); return m;
}
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

// ── Материалы ────────────────────────────────────────────────────
export function makeMaterials() {
  return {
    black: Std({ color: 0x0b0b0c, roughness: 0.62 }),
    gloss: Phys({ color: 0x050506, roughness: 0.18, clearcoat: 1 }),
    rubber: Std({ color: 0x0c0c0d, roughness: 0.9 }),
    chrome: Std({ color: 0xf2f2f2, metalness: 1, roughness: 0.08 }),
    satin: Std({ color: 0xb9bcc0, metalness: 1, roughness: 0.32 }),
    alloy: Std({ color: 0xc9ccd0, metalness: 1, roughness: 0.24 }),
    steel: Std({ color: 0x7c7f84, metalness: 1, roughness: 0.42 }),
    dark: Std({ color: 0x1b1c1e, roughness: 0.85 }),
    fabric: Std({ color: 0x2a2b2e, roughness: 0.97 }),
    fabric2: Std({ color: 0x3a3b3f, roughness: 0.97 }),
    mirror: Std({ color: 0xffffff, metalness: 1, roughness: 0.02 }),
    clear: Phys({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.22, depthWrite: false }),
    amber: Phys({ color: 0xff8a00, roughness: 0.2, clearcoat: 1, emissive: 0xff6a00, emissiveIntensity: 0.15 }),
    red: Phys({ color: 0xb00812, roughness: 0.18, clearcoat: 1, emissive: 0xff0010, emissiveIntensity: 0.12 }),
    bulb: Std({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 0.05, roughness: 0.2 }),
    screen: Std({ color: 0x05080c, emissive: 0xff7a1a, emissiveIntensity: 0.25, roughness: 0.2 }),
  };
}

// ── Колесо ───────────────────────────────────────────────────────
function buildWheel(M, front) {
  const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  // шина 215/65 R16
  const R = D.tireR, pr = [], half = [[0.206, 0.086], [0.212, 0.098], [0.232, 0.105], [0.268, 0.1085], [0.300, 0.106], [0.322, 0.099], [0.335, 0.088], [0.3405, 0.078]];
  half.forEach(([r, a]) => pr.push(new THREE.Vector2(r, -a)));
  const i0 = pr.length;
  for (const a of [-0.048, -0.016, 0.016, 0.048]) {
    pr.push(new THREE.Vector2(R, a - 0.0055), new THREE.Vector2(R - 0.008, a - 0.004), new THREE.Vector2(R - 0.008, a + 0.004), new THREE.Vector2(R, a + 0.0055));
  }
  const i1 = pr.length - 1;
  half.slice().reverse().forEach(([r, a]) => pr.push(new THREE.Vector2(r, a)));
  const v0 = i0 / (pr.length - 1), v1 = i1 / (pr.length - 1);
  const bump = canvasTex(64, 256, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#000'; c.lineWidth = 9;
    const ya = h * (1 - v1) - 6, yb2 = h * (1 - v0) + 6, ym = (ya + yb2) / 2;
    for (const o of [-64, 0, 64]) { c.beginPath(); c.moveTo(o + 6, ya); c.lineTo(o + 44, ym); c.lineTo(o + 6, yb2); c.stroke(); }
    c.fillStyle = '#777'; c.font = 'bold 9px Arial';
  }, false);
  bump.wrapS = THREE.RepeatWrapping; bump.repeat.set(84, 1);
  const tire = new THREE.Mesh(new THREE.LatheGeometry(pr, 96), Std({ color: 0x0d0d0e, roughness: 0.88, bumpMap: bump, bumpScale: 1.2 }));
  tire.rotation.x = Math.PI / 2; tire.castShadow = true; spin.add(tire);
  // обод
  const rim = [[0.214, -0.088], [0.205, -0.082], [0.2, -0.07], [0.186, -0.05], [0.181, 0], [0.186, 0.04], [0.199, 0.064], [0.205, 0.08], [0.215, 0.087], [0.2155, 0.093], [0.203, 0.094], [0.197, 0.082], [0.196, 0.06]]
    .map(([r, a]) => new THREE.Vector2(r, a));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(rim, 72), M.alloy); barrel.material = M.alloy.clone(); barrel.material.side = THREE.DoubleSide;
  barrel.rotation.x = Math.PI / 2; spin.add(barrel);
  // лицевая часть: 5 сдвоенных спиц
  const sh = new THREE.Shape(); sh.absarc(0, 0, 0.197, 0, Math.PI * 2, false);
  const hole = (phi, base, r1, r2) => {
    const al = r => base - Math.asin(0.014 / r), pts = [], n = 12;
    for (let i = 0; i <= n; i++) { const r = lerp(r1, r2, i / n), a = phi + al(r) * (1 - 0.5 * Math.pow(Math.abs(2 * i / n - 1), 6)); pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a))); }
    for (let i = n; i >= 0; i--) { const r = lerp(r1, r2, i / n), a = phi - al(r) * (1 - 0.5 * Math.pow(Math.abs(2 * i / n - 1), 6)); pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a))); }
    sh.holes.push(new THREE.Path().setFromPoints(pts.reverse()));
  };
  for (let k = 0; k < 5; k++) {
    const a = k * Math.PI * 2 / 5 + Math.PI / 2;
    hole(a + Math.PI / 5, 27 * Math.PI / 180, 0.078, 0.177);
    hole(a, 9 * Math.PI / 180, 0.098, 0.173);
  }
  const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 64 });
  const fp = fg.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const r = Math.hypot(fp.getX(i), fp.getY(i));
    fp.setZ(i, fp.getZ(i) + 0.05 + 0.02 * (Math.pow(r / 0.197, 1.6) - 1));
  }
  fg.computeVertexNormals();
  const face = new THREE.Mesh(fg, M.alloy); face.castShadow = true; spin.add(face);
  const cap = mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.012, 32), M.satin, 0, 0, 0.047); cap.rotation.x = Math.PI / 2; spin.add(cap);
  const dsh = new THREE.Shape(); dsh.moveTo(0, 0.02); dsh.lineTo(0.014, 0); dsh.lineTo(0, -0.02); dsh.lineTo(-0.014, 0);
  spin.add(mesh(new THREE.ExtrudeGeometry(dsh, { depth: 0.002, bevelEnabled: false }), M.chrome, 0, 0, 0.053));
  for (let k = 0; k < 5; k++) {
    const a = k * Math.PI * 2 / 5 + Math.PI / 2 + Math.PI / 5;
    const nut = mesh(new THREE.CylinderGeometry(0.0095, 0.011, 0.016, 6), M.chrome, 0.054 * Math.cos(a), 0.054 * Math.sin(a), 0.036);
    nut.rotation.x = Math.PI / 2; spin.add(nut);
  }
  // тормоза: спереди диск + суппорт, сзади барабан
  if (front) {
    const disc = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.022, 48), M.steel, 0, 0, -0.012); disc.rotation.x = Math.PI / 2; spin.add(disc);
    const hat = mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.04, 32), M.dark, 0, 0, 0.0); hat.rotation.x = Math.PI / 2; spin.add(hat);
    const cal = mesh(rbox(0.11, 0.075, 0.07, 0.015, 3), Std({ color: 0x55585c, roughness: 0.6, metalness: 0.6 }), -0.1, 0.075, -0.014);
    cal.rotation.z = -Math.atan2(0.1, 0.075); g.add(cal);
  } else {
    const drum = mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.07, 40), M.dark, 0, 0, -0.03); drum.rotation.x = Math.PI / 2; spin.add(drum);
  }
  g.userData.spin = spin;
  return g;
}

// ── Сборка всех деталей ─────────────────────────────────────────
export function buildParts(M, paint) {
  const root = new THREE.Group(), sym = new THREE.Group(), lit = { head: [], tail: [], spots: [] }, wheels = [];
  root.add(sym);
  const addS = o => (sym.add(o), o), add = o => (root.add(o), o);

  // колёса, оси
  for (const [x, f] of [[D.xw, true], [-D.xw, false]]) for (const s of [1, -1]) {
    const w = buildWheel(M, f); w.position.set(x, D.wheelY, s * D.track); if (s < 0) w.rotation.y = Math.PI;
    add(w); wheels.push(w.userData.spin);
    const ax = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 12), M.dark, x, D.wheelY, s * 0.42); ax.rotation.x = Math.PI / 2; add(ax);
  }
  // колёсные арки: подкрылок, стенка, кромка
  for (const xw of [D.xw, -D.xw]) {
    const a0 = Math.asin((0.296 - D.archY) / D.archR), n = 64, pos = [], idx = [], edge = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, Math.PI - a0, i / n), x = xw + D.archR * Math.cos(a), y = D.archY + D.archR * Math.sin(a), z = sideZ(x, y);
      pos.push(x, y, z + 0.002, x, y, D.archZ - 0.02); edge.push(new V3(x, y, z));
      if (i < n) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setIndex(idx); lg.computeVertexNormals();
    const liner = Std({ color: 0x040404, roughness: 1, envMapIntensity: 0.15, side: THREE.DoubleSide }); addS(new THREE.Mesh(lg, liner));
    const wall = mesh(new THREE.CircleGeometry(D.archR + 0.01, 48, a0, Math.PI - 2 * a0), liner, xw, D.archY, D.archZ - 0.015); addS(wall);
    addS(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 96, 0.007, 6), paint));
    // стойка и пружина
    const strut = bar(new V3(xw, D.wheelY + 0.05, 0.62), new V3(xw - 0.02, 0.78, 0.56), 0.05, 0.05, M.dark); addS(strut);
  }

  // ── Фары ──
  const bucketMat = Std({ color: 0xd8dade, metalness: 1, roughness: 0.14, side: THREE.DoubleSide });
  const PFc = (z, y) => PF(Math.min(z, halfW(1.74, y) - 0.004), y);
  addS(patch(PFc, { cu: 0.655, cv: 0.825, hu: 0.185, hv: 0.115, p: 5, nu: 40, nv: 14, mat: bucketMat, off: r => -(0.005 + 0.075 * (1 - Math.pow(r, 3))) }));
  const bowl = new THREE.LatheGeometry(range(0, 1, 12).map(t => new THREE.Vector2(0.008 + 0.05 * t, 0.045 * t * t)), 32);
  for (const [z, y, s] of [[0.59, 0.826, 1.3], [0.722, 0.826, 1.12]]) {
    const f = frame(PF, z, y), grp = new THREE.Group(); place(grp, f, -0.07);
    const b = new THREE.Mesh(bowl, M.chrome.clone()); b.material.side = THREE.DoubleSide; b.rotation.x = Math.PI / 2; b.scale.setScalar(s); grp.add(b);
    const lens = mesh(new THREE.SphereGeometry(0.03, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.clear, 0, 0, 0.012); lens.rotation.x = Math.PI / 2; lens.scale.z = 0.6; grp.add(lens);
    const bl = mesh(new THREE.SphereGeometry(0.014, 16, 12), M.bulb, 0, 0, 0.012); grp.add(bl);
    const ring = mesh(new THREE.TorusGeometry(0.052 * s, 0.005, 8, 40), M.gloss, 0, 0, 0.046); grp.add(ring);
    addS(grp);
  }
  { const f = frame(PF, 0.80, 0.826), o = mesh(new THREE.SphereGeometry(0.026, 20, 14), M.amber); place(o, f, -0.04); o.scale.set(1, 2.1, 1); addS(o); }
  // противотуманки
  { const f = frame(PF, 0.65, 0.48), grp = new THREE.Group(); place(grp, f, 0.004);
    const b = new THREE.Mesh(bowl, bucketMat); b.rotation.x = Math.PI / 2; b.scale.set(0.8, 0.8, 0.5); b.position.z = -0.02; grp.add(b);
    grp.add(mesh(new THREE.TorusGeometry(0.047, 0.006, 8, 40), M.satin, 0, 0, 0.004));
    const gl = mesh(new THREE.CircleGeometry(0.045, 32), M.clear, 0, 0, 0.004); grp.add(gl);
    grp.add(mesh(new THREE.SphereGeometry(0.01, 12, 10), M.bulb, 0, 0, -0.012)); addS(grp); }

  // ── Решётка радиатора ──
  const meshTex = canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#050505'; g.fillRect(0, 0, w, w); g.strokeStyle = '#3a3b3d'; g.lineWidth = 7;
    for (let i = -w; i < 2 * w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + w, w); g.moveTo(i + w, 0); g.lineTo(i, w); g.stroke(); }
  });
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping; meshTex.repeat.set(34, 5);
  add(patch(PF, { cu: 0, cv: 0.806, hu: 0.475, hv: 0.084, p: 12, nu: 48, nv: 6, off: 0.002, edge: 0.01, mat: Std({ map: meshTex, roughness: 0.5, metalness: 0.4 }) }));
  const gp = [[-0.497, 0.897], [0.497, 0.897], [0.45, 0.715], [-0.45, 0.715]];
  add(tubeOn(PF, roundedPoly(gp, 0.03), 0.011, 0.014, true, M.chrome, 200));
  for (const s of [1, -1]) add(tubeOn(PF, range(0, 1, 6).map(t => [s * lerp(0.165, 0.195, t), lerp(0.715, 0.897, t)]), 0.009, 0.012, false, M.chrome, 12));
  for (const y of [0.76, 0.806, 0.852]) {
    const hw = lerp(0.45, 0.497, (y - 0.715) / 0.182) - 0.012;
    add(tubeOn(PF, range(-hw, hw, 30).map(z => [z, y]), 0.0065, 0.008, false, M.satin, 60, 6));
  }
  for (const y of [0.44, 0.48, 0.52]) add(tubeOn(PF, range(-0.47, 0.47, 30).map(z => [z, y]), 0.007, 0.006, false, M.gloss, 60, 6));
  // ромб Renault
  const diamond = (w, h) => {
    const s = new THREE.Shape(); s.moveTo(0, h); s.lineTo(w, 0); s.lineTo(0, -h); s.lineTo(-w, 0); s.closePath();
    const hl = new THREE.Path(); hl.moveTo(0, h * 0.5); hl.lineTo(-w * 0.5, 0); hl.lineTo(0, -h * 0.5); hl.lineTo(w * 0.5, 0); hl.closePath(); s.holes.push(hl);
    return new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
  };
  add(place(mesh(diamond(0.043, 0.057), M.chrome), frame(PF, 0, 0.806), 0.016));
  add(place(mesh(diamond(0.034, 0.045), M.chrome), frame(PR, 0, 1.005), 0.002));

  // ── Номера ──
  const plate = Std({ map: plateTex(), roughness: 0.45 });
  for (const [P, y] of [[PF, 0.622], [PR, 0.84]]) {
    const f = frame(P, 0, y);
    add(place(mesh(rbox(0.54, 0.13, 0.012, 0.005, 2), M.black), f, 0.004));
    add(place(mesh(new THREE.PlaneGeometry(0.52, 0.112), plate), f, 0.0108));
  }

  // ── Задняя часть ──
  const lampTex = canvasTex(256, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#c20b16'); gr.addColorStop(1, '#8e0610');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const eye = (cy, r, c1, c2) => {
      const rg = g.createRadialGradient(w / 2, cy, 2, w / 2, cy, r); rg.addColorStop(0, c1); rg.addColorStop(1, c2);
      g.fillStyle = rg; g.beginPath(); g.arc(w / 2, cy, r, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3;
      for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(w / 2, cy, r * k / 3.2, 0, 7); g.stroke(); }
      g.strokeStyle = 'rgba(40,0,0,.6)'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, cy, r, 0, 7); g.stroke();
    };
    eye(150, 92, '#ff3a3a', '#b00a14'); eye(362, 92, '#ffffff', '#d9d9d9');
    g.fillStyle = '#ff9a1c'; g.beginPath(); g.arc(w / 2, 362, 30, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
    for (let y = 8; y < h; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  const tailMat = Phys({ map: lampTex, emissiveMap: lampTex, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.12, clearcoat: 1 });
  const PRc = (z, y) => PR(Math.min(z, halfW(-1.72, y) - 0.004), y);
  addS(patch(PRc, { cu: 0.70, cv: 0.955, hu: 0.085, hv: 0.155, p: 5, nu: 30, nv: 30, off: 0.014, edge: 0.35, mat: tailMat }));
  lit.tail.push(tailMat);
  const dTex = textTex('DUSTER', 1024, 64, '700 50px Arial, sans-serif', '#1a1a1a', '#e9e9e9');
  add(patch(PR, { cu: 0, cv: 0.935, hu: 0.34, hv: 0.02, p: 10, nu: 40, nv: 6, off: 0.01, edge: 0.4, mat: Std({ map: dTex, metalness: 1, roughness: 0.16 }) }));
  const badge = (txt, z, y, w) => {
    const t = textTex(txt, 512, 96, 'italic 700 70px Arial, sans-serif', '#f4f4f4');
    const m = Std({ map: t, transparent: true, alphaTest: 0.4, metalness: 1, roughness: 0.2, color: 0xffffff });
    add(place(mesh(new THREE.PlaneGeometry(w, w * 96 / 512), m), frame(PR, z, y), 0.003));
  };
  badge('RENAULT', -0.42, 0.975, 0.2); badge('4WD', 0.44, 0.975, 0.13);
  addS(patch(PR, { cu: 0.60, cv: 0.515, hu: 0.06, hv: 0.016, p: 6, off: 0.004, mat: M.red }));
  const stop = add(patch(PR, { cu: 0, cv: 1.553, hu: 0.15, hv: 0.009, p: 8, nu: 24, nv: 4, off: 0.003, mat: M.red.clone() })); lit.tail.push(stop.material);
  const ex = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.24, 20, 1, true), M.chrome.clone(), -2.0, 0.345, -0.47); ex.material.side = THREE.DoubleSide; ex.rotation.z = Math.PI / 2; add(ex);
  // задний дворник
  { const a = PR(0, 1.07), b = PR(0.2, 1.13), c1 = PR(0.02, 1.135), c2 = PR(0.38, 1.135);
    for (const p of [a, b, c1, c2]) p.x -= 0.014;
    add(mesh(new THREE.SphereGeometry(0.022, 12, 10), M.black, a.x + 0.006, a.y, a.z));
    add(bar(a, b, 0.012, 0.01, M.black)); add(bar(c1, c2, 0.014, 0.012, M.rubber)); }

  // ── Бок ──
  for (const x of [0.02, -0.95]) {
    const y = ys(x) - 0.105;
    addS(patch(PS, { cu: x, cv: y, hu: 0.095, hv: 0.032, p: 5, off: 0.0025, edge: 0.05, mat: M.gloss }));
    const f = frame(PS, x, y); addS(place(mesh(rbox(0.16, 0.03, 0.022, 0.011, 3), M.black), f, 0.016));
    if (x > 0) addS(place(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 16).rotateX(Math.PI / 2), M.chrome), frame(PS, x - 0.105, y - 0.012), 0.002));
  }
  addS(patch(PS, { cu: 0.90, cv: 0.865, hu: 0.03, hv: 0.013, p: 3, off: 0.007, edge: 0.8, mat: M.amber }));
  // зеркала
  { const mg = new THREE.Group(), base = PS(0.79, 1.085);
    const hg = new THREE.SphereGeometry(1, 28, 20), hp = hg.attributes.position;
    for (let i = 0; i < hp.count; i++) { const x = hp.getX(i); hp.setX(i, x < -0.25 ? -0.25 : x); }
    hg.scale(0.062, 0.068, 0.108); hg.computeVertexNormals();
    const c = new V3(base.x - 0.02, base.y + 0.04, base.z + 0.125);
    mg.add(mesh(hg, M.black, c.x, c.y, c.z));
    const gl = mesh(new THREE.CircleGeometry(1, 32), M.mirror, c.x - 0.0165, c.y, c.z); gl.scale.set(0.095, 0.058, 1); gl.rotation.y = -Math.PI / 2; mg.add(gl);
    mg.add(bar(new V3(base.x, base.y, base.z - 0.02), new V3(c.x + 0.005, c.y - 0.025, c.z - 0.06), 0.035, 0.05, M.black, 0.012));
    addS(mg); }
  // рейлинги
  { const z = 0.52, x0 = 0.10, x1 = -1.66;
    const pts = range(0, 1, 40).map(t => { const x = lerp(x0, x1, t), e = Math.min(t, 1 - t) / 0.06; return new V3(x, topY(x, z) + 0.052 * sstep(0, 1, e) - 0.006, z); });
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.017, 10);
    addS(new THREE.Mesh(tg, M.satin));
    for (const x of [x0 - 0.03, (x0 + x1) / 2, x1 + 0.03]) addS(mesh(rbox(0.13, 0.05, 0.04, 0.012, 3), M.black, x, topY(x, z) + 0.016, z)); }

  // ── Дворники, антенна ──
  const cowl = z => 1.035 - 0.10 * (z / 0.7) ** 2;
  for (const [za, zb, zp] of [[-0.56, -0.03, -0.62], [0.03, 0.5, -0.06]]) {
    const pt = (z, dx, h) => { const x = cowl(z) + dx; return new V3(x, topY(x, z) + h, z); };
    add(bar(pt(za, -0.045, 0.014), pt(zb, -0.045, 0.014), 0.012, 0.016, M.rubber));
    add(bar(pt(za, -0.045, 0.024), pt(zb, -0.045, 0.024), 0.008, 0.006, M.black));
    const pv = pt(zp, 0.03, 0.02), mid = pt((za + zb) / 2, -0.045, 0.03);
    add(bar(pv, mid, 0.014, 0.008, M.black)); add(mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.02, 16), M.black, pv.x, pv.y - 0.008, pv.z));
  }
  { const b = PT(0.13, 0); add(mesh(new THREE.ConeGeometry(0.022, 0.03, 16), M.black, b.x, b.y + 0.012, 0));
    add(bar(new V3(b.x, b.y + 0.02, 0), new V3(b.x - 0.3, b.y + 0.24, 0), 0.005, 0.005, M.black)); }

  // ── Салон ──
  const cabin = new THREE.Group(); root.add(cabin);
  const cb = (g, m, x, y, z, rz = 0) => { const o = mesh(g, m, x, y, z); o.rotation.z = rz; cabin.add(o); return o; };
  cb(new THREE.BoxGeometry(3.0, 0.04, 1.42), M.dark, -0.45, 0.43, 0);
  cb(rbox(0.46, 0.34, 1.46, 0.06), M.dark, 0.84, 0.85, 0);                       // панель
  cb(new THREE.BoxGeometry(0.05, 0.72, 1.56), M.dark, 1.04, 0.66, 0);
  cb(new THREE.BoxGeometry(0.76, 0.5, 1.4), M.black, 1.44, 0.68, 0);          // моторный отсек
  cb(new THREE.BoxGeometry(0.75, 0.02, 1.52), M.black, 1.43, 0.925, 0);                         // моторный щит
  cb(rbox(0.2, 0.09, 0.4, 0.04), M.dark, 0.72, 1.035, -0.36);                    // козырёк приборов
  cb(rbox(0.06, 0.24, 0.26, 0.02), M.black, 0.60, 0.9, 0);                      // центральная консоль
  cb(new THREE.PlaneGeometry(0.15, 0.035).rotateY(-Math.PI / 2), M.screen, 0.568, 0.97, 0);
  const gauge = Std({ roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.35, map: canvasTex(128, 128, g => {
    g.fillStyle = '#060606'; g.fillRect(0, 0, 128, 128); g.translate(64, 64); g.strokeStyle = '#ddd'; g.lineWidth = 3;
    for (let i = 0; i <= 12; i++) { const a = Math.PI * (0.75 + 1.5 * i / 12); g.beginPath(); g.moveTo(Math.cos(a) * 46, Math.sin(a) * 46); g.lineTo(Math.cos(a) * 58, Math.sin(a) * 58); g.stroke(); }
    g.strokeStyle = '#e8302a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(-30, -36); g.stroke();
    g.fillStyle = '#222'; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
  }) });
  gauge.emissiveMap = gauge.map;
  for (const z of [-0.43, -0.29]) cb(new THREE.CircleGeometry(0.05, 24).rotateY(-Math.PI / 2), gauge, 0.618, 1.02, z);
  cb(rbox(0.95, 0.2, 0.2, 0.04), M.dark, 0.1, 0.55, 0);                         // тоннель
  cb(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), M.satin, 0.3, 0.72, 0, -0.2);
  cb(new THREE.SphereGeometry(0.026, 14, 10), M.black, 0.316, 0.8, 0);
  { const sw = new THREE.Group(); sw.position.set(0.5, 1.0, -0.36); sw.rotation.z = -0.42; cabin.add(sw);
    sw.add(new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.016, 10, 48).rotateY(Math.PI / 2), M.black));
    sw.add(mesh(rbox(0.04, 0.1, 0.13, 0.02, 3), M.black, 0.01, 0, 0));
    for (const a of [Math.PI / 2, -0.55, Math.PI + 0.55]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.028, 0.17).translate(0, 0, 0.085), M.black); s.position.x = 0.008; s.rotation.x = a; sw.add(s); }
    sw.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 12).rotateZ(Math.PI / 2), M.dark, 0.16, 0, 0)); }
  const seat = (x, z, w) => {
    cb(rbox(0.5, 0.14, w, 0.05), M.fabric, x, 0.6, z);
    cb(rbox(0.36, 0.05, w - 0.16, 0.02), M.fabric2, x, 0.662, z);
    cb(rbox(0.13, 0.64, w, 0.05), M.fabric, x - 0.3, 0.92, z, -0.3);
    cb(rbox(0.05, 0.46, w - 0.16, 0.02), M.fabric2, x - 0.262, 0.93, z, -0.3);
  };
  const headrest = (x, z) => { cb(rbox(0.1, 0.17, 0.25, 0.04), M.fabric, x, 1.33, z, -0.15); cb(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), M.satin, x + 0.01, 1.22, z + 0.06); cb(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), M.satin, x + 0.01, 1.22, z - 0.06); };
  for (const z of [-0.37, 0.37]) { seat(0.05, z, 0.5); headrest(-0.345, z); }
  seat(-0.82, 0, 1.3); for (const z of [-0.42, 0.42]) headrest(-1.215, z);
  cb(rbox(0.09, 0.12, 0.2, 0.03), M.fabric, -1.215, 1.3, 0, -0.15);
  cb(new THREE.BoxGeometry(0.72, 0.025, 1.24), M.dark, -1.56, 1.06, 0);          // полка багажника
  cb(rbox(0.05, 0.065, 0.22, 0.015, 3), M.black, 0.40, 1.445, 0);               // салонное зеркало
  cb(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 8), M.black, 0.42, 1.49, 0);

  // зеркальная половина
  const sym2 = sym.clone(); sym2.scale.z = -1; root.add(sym2);
  root.traverse(o => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });
  return { root, wheels, lit };
}

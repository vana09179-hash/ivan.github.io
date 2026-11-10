import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildShell, buildMasks, shellMaterial, DIM } from './body.js';
import { buildParts, makeMaterials } from './parts.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const small = Math.min(innerWidth, innerHeight) < 700;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const BG = 0x23262b;
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 16, 46);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;

const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 120);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 0.25; controls.maxDistance = 16; controls.maxPolarAngle = Math.PI * 0.497;
controls.autoRotateSpeed = 0.9;

// свет
const sun = new THREE.DirectionalLight(0xfff4e4, 2.4);
sun.position.set(5, 9, 6); sun.castShadow = true;
sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
scene.add(sun, new THREE.HemisphereLight(0xcfd8e6, 0x2a2622, 0.5));

// пол
const floorTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const r = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  r.addColorStop(0, '#6c7078'); r.addColorStop(0.45, '#3c3f45'); r.addColorStop(1, '#23262b');
  g.fillStyle = r; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const floor = new THREE.Mesh(new THREE.CircleGeometry(50, 64), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82, metalness: 0.0 }));
floor.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = (v - 0.5) * 3.2 + 0.5; });
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// ── Автомобиль ──
const COLORS = [
  ['Коричневый «Кайю»', 0x5d4636], ['Хаки', 0x5b6146], ['Синий минерал', 0x2f4f78], ['Серая платина', 0xa9adb1],
  ['Серая комета', 0x565b61], ['Белый лёд', 0xeeeeea], ['Красный', 0x9c1218], ['Чёрная жемчужина', 0x0b0c0e],
];
const paintParams = { color: COLORS[0][1], metalness: 0.55, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.035 };
const masks = buildMasks(small ? 0.5 : 1);
const paint = shellMaterial(masks, false, paintParams);
const glass = shellMaterial(masks, true, { color: 0x1c2624, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.3, depthWrite: false, envMapIntensity: 1.6 });
const paintPlain = new THREE.MeshPhysicalMaterial(paintParams);
const car = new THREE.Group(); scene.add(car);
const shellG = buildShell();
const body = new THREE.Mesh(shellG, paint); body.castShadow = true; car.add(body);
const glassMesh = new THREE.Mesh(shellG, glass); glassMesh.renderOrder = 2; car.add(glassMesh);
const M = makeMaterials();
const parts = buildParts(M, paintPlain); car.add(parts.root);

// фары
const spots = [1, -1].map(s => {
  const l = new THREE.SpotLight(0xfff1d6, 0, 26, 0.5, 0.7, 1.4);
  l.position.set(2.0, 0.82, s * 0.64); l.target.position.set(9, 0.1, s * 0.9); car.add(l, l.target); return l;
});
const state = { lights: false, spin: false, rotate: false };
function applyLights() {
  const on = state.lights;
  M.bulb.emissiveIntensity = on ? 9 : 0.05;
  M.amber.emissiveIntensity = on ? 0.9 : 0.15;
  parts.lit.tail.forEach(m => { m.emissiveIntensity = on ? 1.5 : 0.12; });
  spots.forEach(l => { l.intensity = on ? 260 : 0; });
  sun.intensity = on ? 0.9 : 2.4; renderer.toneMappingExposure = on ? 0.8 : 1.05;
}

// ── Интерфейс ──
const VIEWS = {
  front34: [[4.7, 1.75, 4.9], [0, 0.6, 0]], front: [[7.6, 1.15, 0], [0, 0.78, 0]], side: [[0, 1.1, 8.2], [0, 0.78, 0]],
  rear: [[-5.2, 1.7, -4.3], [0, 0.6, 0]], top: [[0.01, 9.5, 0], [0, 0.6, 0]], cabin: [[-0.1, 1.3, -0.36], [0.9, 1.12, -0.26]],
};
let fly = null;
function setView(name, instant) {
  let [p, t] = VIEWS[name];
  if (name !== 'cabin' && innerWidth < innerHeight) p = p.map((v, i) => t[i] + (v - t[i]) * 1.45);
  if (instant) { camera.position.set(...p); controls.target.set(...t); controls.update(); return; }
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t), k: 0 };
}
const colorsEl = document.getElementById('colors');
COLORS.forEach(([name, hex], i) => {
  const b = document.createElement('button'); b.className = 'sw' + (i ? '' : ' on'); b.title = name; b.setAttribute('aria-label', name);
  b.style.setProperty('--c', '#' + hex.toString(16).padStart(6, '0'));
  b.onclick = () => { paint.color.setHex(hex); paintPlain.color.setHex(hex); colorsEl.querySelectorAll('.sw').forEach(e => e.classList.toggle('on', e === b)); };
  colorsEl.append(b);
});
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
  document.querySelectorAll('[data-view]').forEach(e => e.classList.toggle('on', e === b)); setView(b.dataset.view);
});
document.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
  const k = b.dataset.toggle; state[k] = !state[k]; b.classList.toggle('on', state[k]);
  if (k === 'lights') applyLights(); if (k === 'rotate') controls.autoRotate = state.rotate;
});
canvas.addEventListener('pointerdown', () => { fly = null; });

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 52 : 34; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize(); setView('front34', true); applyLights();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (fly) {
    fly.k = Math.min(1, fly.k + dt / 0.9); const e = fly.k * fly.k * (3 - 2 * fly.k);
    camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (fly.k >= 1) fly = null;
  }
  if (state.spin) parts.wheels.forEach((w, i) => { w.rotation.z += (i % 2 ? 1 : -1) * dt * 5; });
  controls.update(); renderer.render(scene, camera);
});
document.getElementById('loader').classList.add('done');
window.__duster = { setView, state, camera, controls, VIEWS, applyLights, DIM, renderer, scene, sun };

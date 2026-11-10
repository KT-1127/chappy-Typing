/*!
 * scene3d.js — 3D 背景（空に浮かぶ島とりんごの木）。Three.js（vendor/three.min.js）を使う
 *
 *   Scene3D.init(container)  → 使えれば true（WebGL がないときは false。CSS の背景のまま）
 *   Scene3D.setView("title") title / modes / play / result / records
 *   Scene3D.setTheme("day")  day / sunset / night
 *   Scene3D.pulse()          正しく打ったとき（カメラが少し進む）
 *   Scene3D.celebrate(big)   問題クリア・コンボのとき（きらきら）
 *   Scene3D.setEnabled(false) / setReduced(true)
 */
(function (global) {
"use strict";

const THEMES = {
  day:    { top: 0x6fbaf7, bottom: 0xeaf6ff, fog: 0xdcefff, hemiSky: 0xffffff, hemiGround: 0xb8dca8, hemi: 0.75, sun: 0xfff1d6, sunI: 0.85, grass: 0x7cc46a, stars: 0, sparkle: 0xffffff },
  sunset: { top: 0x7d8fd9, bottom: 0xffd0a6, fog: 0xffd9bf, hemiSky: 0xffe2c8, hemiGround: 0xb59a8a, hemi: 0.6, sun: 0xffa86b, sunI: 0.85, grass: 0x9ccc74, stars: 0, sparkle: 0xffe0b0 },
  night:  { top: 0x0d1b3f, bottom: 0x2d4f86, fog: 0x203a66, hemiSky: 0x8fb0ff, hemiGround: 0x2a3550, hemi: 0.45, sun: 0xc4d6ff, sunI: 0.55, grass: 0x5e9f6a, stars: 1, sparkle: 0xfff6c2 },
};
const VIEWS = {
  title:   { r: 16, h: 6.2, look: 4.6, speed: 0.045 },
  modes:   { r: 17, h: 6.5, look: 1.2, speed: 0.03 },
  steps:   { r: 17, h: 6.5, look: 1.2, speed: 0.03 },
  play:    { r: 11.5, h: 2.8, look: 1.9, speed: 0.025 },
  result:  { r: 14, h: 5.2, look: 1.4, speed: 0.07 },
  records: { r: 18, h: 8, look: 0.8, speed: 0.025 },
  wardrobe:{ r: 15, h: 5, look: 2.4, speed: 0.04 },
};

let T, renderer, scene, camera, container;
let ok = false, enabled = true, reduced = false, running = false;
let sky, hemi, sun, fog, stars, sparkles, sparkleMat;
const grassMats = []; // 島の草（テーマで色を変える）
const floaters = [], clouds = [], bobbers = [];
let angle = 0.6, boost = 0, glow = 0, last = 0;
let slowTime = 0, quality = 2; // 重いときは自動で画質を下げる（2 → 1 → 0）
const view = { r: 16, h: 6.2, look: 4.6, speed: 0.045 };
let target = VIEWS.title;
let theme = "day";

// ---- 小さな道具 ----
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function mat(color, extra) { return new T.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.85, metalness: 0 }, extra || {})); }
/** 頂点を少しずらして、手作りっぽい形にする */
function jitter(geo, amt, r) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + (r() - 0.5) * amt, p.getY(i) + (r() - 0.5) * amt * 0.6, p.getZ(i) + (r() - 0.5) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeApple(scale) {
  const g = new T.Group();
  const body = new T.Mesh(new T.SphereGeometry(0.22, 12, 10), mat(0xe2432f, { roughness: 0.45 }));
  body.scale.set(1, 0.92, 1);
  const stem = new T.Mesh(new T.CylinderGeometry(0.015, 0.02, 0.12, 5), mat(0x6b4a2b));
  stem.position.y = 0.24;
  const leaf = new T.Mesh(new T.SphereGeometry(0.08, 6, 4), mat(0x4a9628));
  leaf.scale.set(1.4, 0.3, 0.7);
  leaf.position.set(0.08, 0.27, 0);
  leaf.rotation.z = -0.5;
  g.add(body, stem, leaf);
  g.scale.setScalar(scale || 1);
  body.castShadow = true;
  return g;
}

function makeTree(r, size) {
  const g = new T.Group();
  const trunk = new T.Mesh(jitter(new T.CylinderGeometry(0.12 * size, 0.2 * size, 1.2 * size, 6), 0.04, r), mat(0x8b5e3c));
  trunk.position.y = 0.6 * size;
  trunk.castShadow = true;
  g.add(trunk);
  const greens = [0x6cc06a, 0x5bb35e, 0x7fcf73];
  const blobs = 3 + Math.floor(r() * 2);
  for (let i = 0; i < blobs; i++) {
    const m = mat(greens[i % greens.length]);
    const s = (0.65 + r() * 0.35) * size;
    const blob = new T.Mesh(jitter(new T.IcosahedronGeometry(s, 0), 0.12 * size, r), m);
    blob.position.set((r() - 0.5) * 0.8 * size, (1.45 + r() * 0.5) * size, (r() - 0.5) * 0.8 * size);
    blob.castShadow = true;
    g.add(blob);
    // 実ったりんご
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const a = makeApple(0.42 * size);
      const th = r() * Math.PI * 2, ph = 0.3 + r() * 1.1;
      a.position.set(
        blob.position.x + Math.cos(th) * Math.sin(ph) * s * 0.95,
        blob.position.y + Math.cos(ph) * s * 0.7 - 0.1,
        blob.position.z + Math.sin(th) * Math.sin(ph) * s * 0.95,
      );
      g.add(a);
    }
  }
  return g;
}

function makeIsland(radius, seed, opts) {
  opts = opts || {};
  const r = rnd(seed);
  const g = new T.Group();
  const grassM = mat(THEMES[theme].grass);
  grassMats.push(grassM);
  const top = new T.Mesh(jitter(new T.CylinderGeometry(radius, radius * 0.96, 0.5, 10, 1), 0.12, r), grassM);
  top.receiveShadow = true;
  const soil = new T.Mesh(jitter(new T.CylinderGeometry(radius * 0.96, radius * 0.86, 0.55, 10, 1), 0.1, r), mat(0xa8774f));
  soil.position.y = -0.5;
  const rock = new T.Mesh(jitter(new T.ConeGeometry(radius * 0.86, radius * 1.3, 9, 3), radius * 0.12, r), mat(0x9a8f86));
  rock.rotation.x = Math.PI;
  rock.position.y = -0.77 - radius * 0.65;
  g.add(top, soil, rock);
  // 木
  const trees = opts.trees != null ? opts.trees : Math.max(1, Math.round(radius * 0.8));
  for (let i = 0; i < trees; i++) {
    const a = (i / trees) * Math.PI * 2 + r() * 0.8;
    const d = trees === 1 ? 0 : radius * (0.35 + r() * 0.35);
    const t = makeTree(r, (opts.treeSize || 1) * (0.8 + r() * 0.4));
    t.position.set(Math.cos(a) * d, 0.25, Math.sin(a) * d);
    t.rotation.y = r() * 6;
    g.add(t);
  }
  // 小石と花
  for (let i = 0; i < radius * 3; i++) {
    const a = r() * Math.PI * 2, d = radius * (0.2 + r() * 0.75);
    if (r() < 0.35) {
      const s = new T.Mesh(new T.DodecahedronGeometry(0.12 + r() * 0.15, 0), mat(0xc9c1b8));
      s.position.set(Math.cos(a) * d, 0.3, Math.sin(a) * d);
      g.add(s);
    } else {
      const colors = [0xffffff, 0xffe37a, 0xff9fb7, 0xb9a4ff];
      const f = new T.Mesh(new T.SphereGeometry(0.07, 6, 4), mat(colors[Math.floor(r() * colors.length)], { emissive: 0x222222 }));
      f.position.set(Math.cos(a) * d, 0.32, Math.sin(a) * d);
      g.add(f);
    }
  }
  return g;
}

function makeCloud(r) {
  const g = new T.Group();
  const m = mat(0xffffff, { roughness: 1, emissive: 0x9fb6cc, emissiveIntensity: 0.25, transparent: true, opacity: 0.95 });
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.8 + r() * 0.9;
    const b = new T.Mesh(new T.IcosahedronGeometry(s, 1), m);
    b.position.set((i - n / 2) * 0.9 + r() * 0.4, r() * 0.5, (r() - 0.5) * 0.8);
    b.scale.y = 0.75;
    g.add(b);
  }
  return g;
}

function makeSky() {
  const geo = new T.SphereGeometry(120, 32, 16);
  const m = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color() }, bottom: { value: new T.Color() } },
    vertexShader: "varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; float t = smoothstep(-0.15, 0.6, h); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }",
  });
  return new T.Mesh(geo, m);
}

function makePoints(count, spread, size, color, additive) {
  const geo = new T.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread.x;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread.y + (spread.cy || 0);
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread.z;
  }
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  const m = new T.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending });
  return new T.Points(geo, m);
}

// ---- 組み立て ----
function build() {
  scene = new T.Scene();
  fog = new T.Fog(0xdcefff, 28, 75);
  scene.fog = fog;
  camera = new T.PerspectiveCamera(42, 1, 0.1, 300);

  sky = makeSky();
  scene.add(sky);
  hemi = new T.HemisphereLight(0xffffff, 0xb8dca8, 0.95);
  scene.add(hemi);
  sun = new T.DirectionalLight(0xfff1d6, 1.15);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.002;
  scene.add(sun);

  // 真ん中の島
  const main = makeIsland(5, 11, { trees: 4, treeSize: 1.15 });
  scene.add(main);
  bobbers.push({ obj: main, base: 0, amp: 0.08, speed: 0.5, ph: 0 });

  // まわりの小さな島
  const r = rnd(5);
  const spots = [[-11, 1.5, -6, 2], [12, -1, -4, 2.4], [-7, -2.5, 9, 1.6], [9, 2.8, 10, 1.4], [-16, 3.5, 4, 1.8], [3, -3.5, -14, 2.2], [17, 4, -12, 1.5]];
  spots.forEach(([x, y, z, rad], i) => {
    const isl = makeIsland(rad, 100 + i, { trees: rad > 1.8 ? 2 : 1, treeSize: 0.75 });
    isl.position.set(x, y, z);
    isl.rotation.y = r() * 6;
    scene.add(isl);
    bobbers.push({ obj: isl, base: y, amp: 0.25 + r() * 0.2, speed: 0.4 + r() * 0.3, ph: r() * 6 });
  });

  // 雲
  for (let i = 0; i < 12; i++) {
    const c = makeCloud(r);
    const a = r() * Math.PI * 2, d = 14 + r() * 22;
    c.position.set(Math.cos(a) * d, -4 + r() * 12, Math.sin(a) * d);
    c.scale.setScalar(0.8 + r() * 1.2);
    scene.add(c);
    clouds.push({ obj: c, a, d, y: c.position.y, speed: 0.008 + r() * 0.01 });
  }
  // 下に広がる雲の海
  for (let i = 0; i < 26; i++) {
    const c = makeCloud(r);
    const a = r() * Math.PI * 2, d = 6 + r() * 34;
    c.position.set(Math.cos(a) * d, -11 - r() * 3, Math.sin(a) * d);
    c.scale.set(2.2 + r() * 1.5, 1, 2.2 + r() * 1.5);
    scene.add(c);
  }

  // 浮かんでいるりんご
  for (let i = 0; i < 14; i++) {
    const a = makeApple(0.7 + r() * 0.45);
    const ang = r() * Math.PI * 2, d = 5.5 + r() * 3.5; // カメラ（半径11.5以上）に近づきすぎない
    a.position.set(Math.cos(ang) * d, 0.5 + r() * 5, Math.sin(ang) * d);
    scene.add(a);
    floaters.push({ obj: a, base: a.position.y, ph: r() * 6, spin: 0.3 + r() * 0.6 });
  }

  // きらきら・星
  sparkleMat = null;
  sparkles = makePoints(260, { x: 40, y: 18, z: 40, cy: 3 }, 0.12, 0xffffff, true);
  sparkleMat = sparkles.material;
  scene.add(sparkles);
  stars = makePoints(900, { x: 220, y: 120, z: 220, cy: 50 }, 0.6, 0xffffff, true);
  stars.material.fog = false;
  scene.add(stars);
}

function applyTheme() {
  const th = THEMES[theme];
  sky.material.uniforms.top.value.setHex(th.top);
  sky.material.uniforms.bottom.value.setHex(th.bottom);
  fog.color.setHex(th.fog);
  hemi.color.setHex(th.hemiSky);
  hemi.groundColor.setHex(th.hemiGround);
  hemi.intensity = th.hemi;
  sun.color.setHex(th.sun);
  sun.intensity = th.sunI;
  stars.visible = !!th.stars;
  for (const m of grassMats) m.color.setHex(th.grass);
  sparkleMat.color.setHex(th.sparkle);
}

function resize() {
  if (!ok) return;
  const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 縦長の画面では少し引いて、島が切れないようにする
  camera.fov = w / h < 1.2 ? 52 : 42;
  camera.updateProjectionMatrix();
}

function frame(t) {
  if (!running) return;
  requestAnimationFrame(frame);
  const now = t / 1000;
  const dt = Math.min(0.05, last ? now - last : 0.016);
  last = now;

  // 描画が重い状態（30fps 未満）が3秒続いたら、画質を1段下げる
  if (dt > 1 / 30) slowTime += dt; else slowTime = Math.max(0, slowTime - dt * 0.5);
  if (slowTime > 3 && quality > 0) {
    quality--;
    slowTime = 0;
    renderer.setPixelRatio(quality === 1 ? 1 : 0.75);
    if (quality === 0) { renderer.shadowMap.enabled = false; sun.castShadow = false; }
    resize();
  }

  // カメラ（ねらいの位置へなめらかに近づける）
  const k = 1 - Math.pow(0.02, dt);
  view.r += (target.r - view.r) * k;
  view.h += (target.h - view.h) * k;
  view.look += (target.look - view.look) * k;
  view.speed += (target.speed - view.speed) * k;
  boost *= Math.pow(0.15, dt);
  glow *= Math.pow(0.2, dt);
  if (!reduced) angle += (view.speed + boost) * dt;
  const sway = reduced ? 0 : Math.sin(now * 0.3) * 0.25;
  camera.position.set(Math.cos(angle) * view.r, view.h + sway, Math.sin(angle) * view.r);
  camera.lookAt(0, view.look, 0);

  if (!reduced) {
    for (const b of bobbers) b.obj.position.y = b.base + Math.sin(now * b.speed + b.ph) * b.amp;
    for (const f of floaters) {
      f.obj.position.y = f.base + Math.sin(now * 0.8 + f.ph) * 0.35;
      f.obj.rotation.y += f.spin * dt * (1 + glow * 6);
    }
    for (const c of clouds) {
      c.a += c.speed * dt;
      c.obj.position.set(Math.cos(c.a) * c.d, c.y, Math.sin(c.a) * c.d);
    }
    // きらきらはゆっくり上へ
    const p = sparkles.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.25 + glow * 3);
      if (y > 12) y = -6;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  }
  sparkleMat.size = 0.12 + glow * 0.18;
  sparkleMat.opacity = 0.65 + glow * 0.35;
  renderer.render(scene, camera);
}

function start() {
  if (!ok || running || !enabled) return;
  running = true;
  last = 0;
  requestAnimationFrame(frame);
}

global.Scene3D = {
  init(el) {
    T = global.THREE;
    if (!T) return false;
    container = el;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    build();
    applyTheme();
    ok = true;
    resize();
    addEventListener("resize", resize);
    start();
    return true;
  },
  get ok() { return ok; },
  setView(name) { target = VIEWS[name] || VIEWS.title; },
  setTheme(name) {
    if (!THEMES[name]) return;
    theme = name;
    if (!ok) return;
    applyTheme();
  },
  pulse() { if (!reduced) boost = Math.min(boost + 0.012, 0.18); },
  celebrate(big) { glow = Math.min(1, glow + (big ? 1 : 0.35)); if (big && !reduced) boost = Math.min(boost + 0.12, 0.3); },
  setEnabled(v) {
    enabled = !!v;
    if (!ok) return;
    renderer.domElement.style.display = enabled ? "" : "none";
    if (enabled) start(); else running = false;
  },
  setReduced(v) { reduced = !!v; },
};
})(window);

/*!
 * chappy.js — チャッピー（まなびコンパスの Chappy.tsx を React なしに移したもの）
 *
 *   const cp = Chappy.create();          // cp.el を好きな場所に置く
 *   cp.setMood("happy");                 // normal / happy / sleep / think
 *   cp.play("jump");                     // jump / wave / ears / nod / oops
 *   cp.setSkin("glasses");               // きせかえ（Chappy.SKINS）。Chappy.setSkinAll() で全員まとめて
 *
 * パーツ画像（assets/chappy/*.webp）を元の絵の座標のまま SVG で重ね、css/style.css の
 * 「チャッピー」の部分で動かす。目と口は SVG で描いているので表情を変えられる。
 */
(function (global) {
"use strict";

const NS = "http://www.w3.org/2000/svg";
const BASE = "assets/chappy/";

// パーツ画像の位置（x, y, 幅, 高さ）
const PARTS = {
  tail: [566, 298, 377, 572],
  apple: [759, 86, 198, 249],
  body: [212, 595, 437, 378],
  patch: [499, 623, 119, 253],
  armR: [557, 622, 127, 241],
  earL: [164, 57, 218, 251],
  earR: [558, 60, 175, 250],
  head: [141, 179, 619, 462],
};
const EYES = [
  { cx: 296.2, cy: 409.5, rx: 27, ry: 46.6, rot: 3.6, hx: 288.5, hy: 384, hrx: 7.5, hry: 10 },
  { cx: 544.5, cy: 417.1, rx: 28, ry: 46, rot: 3.1, hx: 536, hy: 391, hrx: 6.2, hry: 7.8 },
];
const FACE = "#3AB7C2";
const MOUTH = "M367,474 C371,494 383,499 393,498 C405,497 412,490 416,484 C421,491 428,499 440,500 C452,500 464,493 469,474";
let uid = 0;
const all = new Set();     // 作ったチャッピー（きせかえをまとめて変えるため）
let defaultSkin = "none";

// きせかえ：layer = neck（首まわり。頭の後ろ）/ front（頭の前）
const SKINS = {
  none: { name: "なし", layer: null, svg: "" },
  sprout: { name: "ふたば", layer: "front", svg:
    '<path d="M452,215 C450,180 452,150 455,118" fill="none" stroke="#4A9628" stroke-width="11" stroke-linecap="round"/>' +
    '<ellipse cx="412" cy="112" rx="46" ry="22" transform="rotate(-28 412 112)" fill="#7CC75B" stroke="#4A9628" stroke-width="6"/>' +
    '<ellipse cx="498" cy="104" rx="50" ry="24" transform="rotate(24 498 104)" fill="#8ED46A" stroke="#4A9628" stroke-width="6"/>' },
  glasses: { name: "メガネ", layer: "front", svg:
    '<g fill="rgba(255,255,255,.10)" stroke="#F2B63C" stroke-width="12"><rect x="222" y="350" width="148" height="120" rx="42"/><rect x="470" y="357" width="148" height="120" rx="42"/></g>' +
    '<path d="M370,405 Q420,384 470,410" fill="none" stroke="#F2B63C" stroke-width="10" stroke-linecap="round"/>' },
  ribbon: { name: "リボン", layer: "front", svg:
    '<g transform="translate(646,262) rotate(18)"><path d="M0,0 L-74,-44 Q-92,0 -74,44 Z" fill="#FF7A9C" stroke="#E2577D" stroke-width="6" stroke-linejoin="round"/>' +
    '<path d="M0,0 L74,-44 Q92,0 74,44 Z" fill="#FF7A9C" stroke="#E2577D" stroke-width="6" stroke-linejoin="round"/><circle r="22" fill="#E2577D"/></g>' },
  scarf: { name: "マフラー", layer: "neck", svg:
    '<path d="M238,604 Q450,690 662,604 L668,664 Q450,748 232,664 Z" fill="#E2432F"/>' +
    '<path d="M300,632 L296,688 M380,654 L378,712 M460,662 L460,722 M540,652 L542,712 M610,630 L614,686" stroke="#fff" stroke-opacity=".55" stroke-width="12"/>' +
    '<path d="M520,672 L596,668 L606,812 L530,806 Z" fill="#C4311F"/><path d="M528,790 L604,796" stroke="#fff" stroke-opacity=".55" stroke-width="10"/>' },
  headphones: { name: "ヘッドホン", layer: "front", svg:
    '<path d="M170,430 C150,40 750,40 732,430" fill="none" stroke="#2B3A4A" stroke-width="30" stroke-linecap="round"/>' +
    '<path d="M170,430 C150,40 750,40 732,430" fill="none" stroke="#3AB7C2" stroke-width="9" stroke-linecap="round"/>' +
    '<rect x="116" y="356" width="84" height="156" rx="36" fill="#2B3A4A"/><rect x="131" y="374" width="54" height="120" rx="25" fill="#3AB7C2"/>' +
    '<rect x="702" y="356" width="84" height="156" rx="36" fill="#2B3A4A"/><rect x="717" y="374" width="54" height="120" rx="25" fill="#3AB7C2"/>' },
  crown: { name: "王冠", layer: "front", svg:
    '<g transform="translate(450,214)"><path d="M-86,0 L-86,-62 L-43,-26 L0,-86 L43,-26 L86,-62 L86,0 Z" fill="#F7C548" stroke="#D99A2B" stroke-width="7" stroke-linejoin="round"/>' +
    '<circle cx="-86" cy="-66" r="11" fill="#F7C548" stroke="#D99A2B" stroke-width="5"/><circle cx="0" cy="-90" r="12" fill="#F7C548" stroke="#D99A2B" stroke-width="5"/><circle cx="86" cy="-66" r="11" fill="#F7C548" stroke="#D99A2B" stroke-width="5"/>' +
    '<circle cx="0" cy="-26" r="13" fill="#E2432F"/><circle cx="-48" cy="-14" r="8" fill="#3AB7C2"/><circle cx="48" cy="-14" r="8" fill="#3AB7C2"/></g>' },
};

function el(tag, attrs, children) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
  for (const c of children || []) e.appendChild(c);
  return e;
}
function part(k) {
  const [x, y, w, h] = PARTS[k];
  return el("image", { href: BASE + k + ".webp", x, y, width: w, height: h, preserveAspectRatio: "none" });
}
function group(cls, children) { return el("g", { class: cls }, children); }

function eyes(mood, grad) {
  return EYES.map((e) => {
    if (mood === "happy") {
      return el("path", { d: `M${e.cx - 25},${e.cy + 10} Q${e.cx},${e.cy - 40} ${e.cx + 25},${e.cy + 10}`, fill: "none", stroke: FACE, "stroke-width": 14, "stroke-linecap": "round" });
    }
    if (mood === "sleep") {
      return el("path", { d: `M${e.cx - 24},${e.cy + 2} Q${e.cx},${e.cy + 22} ${e.cx + 24},${e.cy + 2}`, fill: "none", stroke: FACE, "stroke-width": 12, "stroke-linecap": "round" });
    }
    return el("g", { transform: `rotate(${e.rot} ${e.cx} ${e.cy})` }, [
      el("ellipse", { cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, fill: `url(#${grad})` }),
      el("ellipse", { cx: e.hx, cy: e.hy, rx: e.hrx, ry: e.hry, transform: `rotate(-18 ${e.hx} ${e.hy})`, fill: "#E8FCFD", opacity: ".92" }),
    ]);
  });
}

function create(opts) {
  opts = opts || {};
  const id = ++uid;
  const eyeGrad = `cpEye${id}`;
  const shadowGrad = `cpShadow${id}`;
  let mood = opts.mood || "normal";

  const eyesG = group("cp-eyes", eyes(mood, eyeGrad));
  const neckG = group("cp-acc cp-acc-neck", []);
  const frontG = group("cp-acc cp-acc-front", []);
  let skin = "none";
  function setSkin(id) {
    const sk = SKINS[id] || SKINS.none;
    skin = SKINS[id] ? id : "none";
    neckG.innerHTML = sk.layer === "neck" ? sk.svg : "";
    frontG.innerHTML = sk.layer === "front" ? sk.svg : "";
  }
  const svg = el("svg", { class: `cp cp-${mood}`, viewBox: "128 46 846 934" }, [
    el("defs", {}, [
      el("linearGradient", { id: eyeGrad, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        el("stop", { offset: 0, "stop-color": "#4FC5D0" }),
        el("stop", { offset: 1, "stop-color": "#2EA6B3" }),
      ]),
      el("radialGradient", { id: shadowGrad }, [
        el("stop", { offset: 0, "stop-color": "#1D3A36", "stop-opacity": ".22" }),
        el("stop", { offset: 1, "stop-color": "#1D3A36", "stop-opacity": "0" }),
      ]),
    ]),
    el("ellipse", { class: "cp-shadow", cx: 448, cy: 966, rx: 210, ry: 18, fill: `url(#${shadowGrad})` }),
    group("cp-all", [
      group("cp-tail", [part("tail"), group("cp-apple", [part("apple")])]),
      part("body"),
      group("cp-patch", [part("patch")]),
      group("cp-armR", [part("armR")]),
      neckG,
      group("cp-head", [
        group("cp-earL", [part("earL")]),
        group("cp-earR", [part("earR")]),
        part("head"),
        group("cp-face", [
          group("cp-look", [eyesG]),
          group("cp-mouth", [el("path", { d: MOUTH, fill: "none", stroke: FACE, "stroke-width": 12, "stroke-linecap": "round", "stroke-linejoin": "round" })]),
        ]),
        frontG,
      ]),
    ]),
  ]);
  if (opts.label === false) svg.setAttribute("aria-hidden", "true");
  else { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "チャッピー"); }

  setSkin(opts.skin || defaultSkin);

  const timers = {};
  let moodTimer = 0;

  function setMood(m) {
    if (m === mood) return;
    svg.classList.remove(`cp-${mood}`);
    mood = m;
    svg.classList.add(`cp-${mood}`);
    eyesG.replaceChildren(...eyes(mood, eyeGrad));
  }

  const api = {
    el: svg,
    get mood() { return mood; },
    get skin() { return skin; },
    setMood,
    setSkin,
    /** しばらくだけ表情を変えて、元に戻す */
    flashMood(m, ms, back) {
      clearTimeout(moodTimer);
      setMood(m);
      moodTimer = setTimeout(() => setMood(back || "normal"), ms || 700);
    },
    play(move, ms) {
      const cls = `is-${move}`;
      const dur = ms || { jump: 900, wave: 1650, ears: 750, nod: 750, oops: 500 }[move] || 1000;
      svg.classList.remove(cls);
      void svg.getBoundingClientRect(); // 付け直して、同じ動きをもう一度再生する
      svg.classList.add(cls);
      clearTimeout(timers[cls]);
      timers[cls] = setTimeout(() => svg.classList.remove(cls), dur);
    },
  };
  if (!opts.fixedSkin) all.add(api);
  return api;
}

global.Chappy = {
  create,
  SKINS,
  /** すべてのチャッピーのきせかえを変える */
  setSkinAll(id) { defaultSkin = SKINS[id] ? id : "none"; for (const c of all) c.setSkin(defaultSkin); },
};
})(window);

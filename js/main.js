/*!
 * main.js — 画面の切り替え、演出、結果、記録、きせかえ、設定
 */
(function () {
"use strict";

const $ = (id) => document.getElementById(id);
const Store = window.Store, Sound = window.Sound, CT = window.CT, Scene3D = window.Scene3D;
const data = Store.load();
const settings = data.settings;

const LANG_NAME = { ja: "日本語", en: "English" };
const DIFF_NAME = { easy: "やさしい", normal: "ふつう", hard: "むずかしい" };
const FIELD_NAME = Object.assign({ all: "すべての分野" }, window.WORDS_TECH.fields);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const ICONS = {
  tech: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.1-.4-.4-2.1 2.6-2.2Z"/></svg>',
  step: '<svg viewBox="0 0 24 24"><path d="M4 18h4v-4h4v-4h4V6h4"/><path d="M4 21h16"/></svg>',
  weak: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8v3l2 1.5"/></svg>',
  cannon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  free: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>',
};
const APPLE_IMG = '<img src="assets/chappy/apple.webp" alt="">';

const MODES = [
  { id: "rush", name: "りんごラッシュ", desc: "60秒でりんごを何個集められるか挑戦！", icon: APPLE_IMG, options: ["lang", "diff"],
    say: "60秒で、りんごを何個集められるかな？ ミスなしで続けるとボーナスがもらえるよ" },
  { id: "tech", name: "技術科ことば", desc: "技術分野の用語で、りんごを集めよう。", options: ["field"],
    say: "技術科の用語が出るよ。意味も表示されるから、打ちながら覚えちゃおう！" },
  { id: "step", name: "ステップ練習", desc: "ホームポジションから文章まで、順番に。", options: ["lang"],
    say: "はじめての人はここから！ 指の置き方から、少しずつ練習しよう" },
  { id: "weak", name: "にがて特訓", desc: "記録から苦手なキーを割り出して集中練習。", options: ["lang"],
    say: "これまでの記録から、苦手なキーを中心に出題するよ" },
  { id: "cannon", name: "りんごキャノン", desc: "落ちてくる言葉を打って、島を守ろう。", options: ["lang", "diff"],
    say: "落ちてくる言葉を打つと、ぼくがりんごで撃ち落とすよ！ 3回落とすとおしまい" },
  { id: "free", name: "フリー計測", desc: "飾りなしで、速さと正確さを測定。", options: ["lang", "diff", "time"],
    say: "飾りなしで、いまの実力を測ろう。時間も選べるよ" },
];
const modeOf = (id) => MODES.find((m) => m.id === id);

/** Google アナリティクスにイベントを送る（モード名や成績の数字だけ。個人を特定する情報は送らない） */
function track(name, params) {
  try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) { /* 送れなくても続ける */ }
}
/** モードの選び方（言語・難しさ・分野・レッスン）を1つの文字列に */
function variantOf(mode, o) {
  if (mode === "tech") return `ja:${o.field}`;
  if (mode === "step") return `${o.lang}:${o.lessonId}`;
  if (mode === "weak") return o.lang;
  if (mode === "free") return `${o.lang}:${o.diff}:${o.time}`;
  return `${o.lang}:${o.diff}`;
}

let screen = "title";
let selectedMode = modeOf(settings.mode) ? settings.mode : "rush";
let game = null;           // いま遊んでいるモード
let lastStart = null;      // { mode, opts }（もう一回用）
let lastResult = null;
let resultReadyAt = 0;
let returnTo = "title";    // 記録・きせかえから戻る先

// ---- チャッピーたち ----
Chappy.setSkinAll(settings.skin);
const titleCp = Chappy.create();
const modeCp = Chappy.create();
const playCp = Chappy.create({ label: false });
const resultCp = Chappy.create();
const wardrobeCp = Chappy.create();
$("titleChappy").appendChild(titleCp.el);
$("modeChappy").appendChild(modeCp.el);
$("playChappy").appendChild(playCp.el);
$("resultChappy").appendChild(resultCp.el);
$("wardrobeChappy").appendChild(wardrobeCp.el);

// ---- 画面のキーボード（指ガイド） ----
const kb = CT.Keyboard.create($("kbBox"), { layout: settings.layout });
let kbHeat = null;
let guideOn = true;

// ---- 3D 背景 ----
let has3d = false;
function setup3d() {
  if (settings.use3d && !Scene3D.ok) Scene3D.init($("scene3d"));
  if (Scene3D.ok) Scene3D.setEnabled(settings.use3d);
  has3d = Scene3D.ok && settings.use3d;
  document.body.classList.toggle("has3d", has3d);
  applySky();
}
function applySky() {
  if (Scene3D.ok) Scene3D.setTheme(settings.sky);
  document.body.classList.toggle("sky-night", has3d && settings.sky === "night");
}

// ---- 画面の切り替え ----
function show(name) {
  screen = name;
  document.body.dataset.screen = name;
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === `scr-${name}`));
  // 前の画面のボタンにフォーカスが残ると、Enter でそのボタンが押されてしまうので外す
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  if (name !== "play") Sound.bgm("title");
  if (Scene3D.ok) Scene3D.setView(name);
  if (name === "title") setTimeout(() => titleCp.play("wave"), 400);
  if (name === "modes") renderModes();
  if (name === "steps") renderSteps();
  if (name === "records") renderRecords();
  if (name === "wardrobe") renderWardrobe();
}

// ---- タイトル ----
function startFromTitle() {
  Sound.unlock();
  Sound.se("click");
  show("modes");
}
$("btnStart").addEventListener("click", startFromTitle);
$("titleChappy").addEventListener("click", () => {
  Sound.unlock();
  titleCp.play(pick(["jump", "wave", "ears", "nod"]));
});

// ---- モード選択 ----
function renderModes() {
  const grid = $("modeGrid");
  if (!grid.children.length) {
    for (const m of MODES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mode-card glass";
      b.dataset.mode = m.id;
      b.setAttribute("role", "radio");
      b.innerHTML = `<span class="mode-icon">${m.icon || ICONS[m.id]}</span>
        <span class="mode-text"><span class="mode-name">${m.name}</span><span class="mode-desc">${m.desc}</span></span>`;
      b.addEventListener("click", () => selectMode(m.id, true));
      b.addEventListener("mouseenter", () => Sound.se("hover"));
      grid.appendChild(b);
    }
  }
  selectMode(selectedMode, false);
  setSeg("segLang", settings.lang);
  setSeg("segDiff", settings.diff);
  setSeg("segField", settings.field);
  setSeg("segTime", String(settings.time));
  modeCp.play("wave");
}

function selectMode(id, byUser) {
  const m = modeOf(id);
  selectedMode = id;
  settings.mode = id;
  Store.save();
  document.querySelectorAll(".mode-card").forEach((c) => c.setAttribute("aria-checked", String(c.dataset.mode === id)));
  $("rowLang").hidden = !m.options.includes("lang");
  $("rowDiff").hidden = !m.options.includes("diff");
  $("rowField").hidden = !m.options.includes("field");
  $("rowTime").hidden = !m.options.includes("time");
  $("btnTechList").hidden = id !== "tech";
  $("btnGo").innerHTML = (id === "step" ? "レッスンをえらぶ" : "スタート") + " <kbd>Enter</kbd>";
  if (byUser) { Sound.se("click"); modeCp.play("nod"); }
  sayModes(m.say);
  updateBest();
}

function sayModes(text) {
  const b = $("modeBubble");
  b.textContent = text;
  b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
}

function setSeg(id, v) {
  $(id).querySelectorAll("button").forEach((b) => {
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(b.dataset.v === String(v)));
  });
}
function bindSeg(id, key, after) {
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    settings[key] = key === "time" ? Number(b.dataset.v) : b.dataset.v;
    Store.save();
    setSeg(id, b.dataset.v);
    Sound.se("click");
    if (after) after();
  });
}
bindSeg("segLang", "lang", updateBest);
bindSeg("segDiff", "diff", updateBest);
bindSeg("segField", "field", updateBest);
bindSeg("segTime", "time", updateBest);

function bestKeyFor(mode) {
  const s = settings;
  if (mode === "rush") return `rush:${s.lang}:${s.diff}`;
  if (mode === "tech") return `tech:ja:${s.field}`;
  if (mode === "cannon") return `cannon:${s.lang}:${s.diff}`;
  if (mode === "free") return `free:${s.lang}:${s.diff}:${s.time}`;
  return null;
}
function updateBest() {
  const el = $("optBest");
  const m = selectedMode;
  if (m === "step") {
    const p = stepProgress(settings.lang);
    el.innerHTML = `クリアしたレッスン：<b>${p.cleared}</b> / ${p.total} ・ ★ <b>${p.stars}</b> / ${p.total * 3}`;
    return;
  }
  if (m === "weak") {
    const wk = CT.modes.weak.weakKeys(settings.lang);
    el.innerHTML = wk.fallback
      ? "まだ記録が少ないので、まちがえやすいキーで練習します。"
      : `いまの苦手キー：<b>${wk.keys.map((k) => k.toUpperCase()).join(" ")}</b>`;
    return;
  }
  const b = data.best[bestKeyFor(m)];
  if (!b) { el.textContent = "この組み合わせはまだ記録がありません。"; return; }
  const head = m === "cannon" ? `<b>${b.score}</b> 点` : m === "free" ? `<b>${b.score}</b> 打/分` : `<b>${b.score}</b> 個`;
  el.innerHTML = `自己ベスト：${head} ・ <b>${b.kpm}</b> 打/分 ・ 正確さ <b>${b.acc}</b>%`;
}

function optsFor(mode) {
  const s = settings;
  if (mode === "rush" || mode === "cannon") return { lang: s.lang, diff: s.diff };
  if (mode === "tech") return { field: s.field };
  if (mode === "weak") return { lang: s.lang };
  if (mode === "free") return { lang: s.lang, diff: s.diff, time: s.time };
  return {};
}
function goFromModes() {
  if (selectedMode === "step") { Sound.se("click"); show("steps"); return; }
  startGame(selectedMode, optsFor(selectedMode));
}
$("btnGo").addEventListener("click", goFromModes);

// 技術科ことばの一覧
$("btnTechList").addEventListener("click", () => {
  Sound.se("click");
  const T = window.WORDS_TECH;
  const box = $("techList");
  box.innerHTML = "";
  for (const [f, name] of Object.entries(T.fields)) {
    const h = document.createElement("h3");
    h.innerHTML = `${name}<small>${T[f].length}語</small>`;
    const table = document.createElement("table");
    for (const [d, k, m] of T[f]) {
      const tr = table.insertRow();
      tr.insertCell().textContent = d;
      tr.insertCell().textContent = CT.normalizeKana(k) === CT.normalizeKana(d) ? "" : k;
      tr.insertCell().textContent = m;
    }
    box.append(h, table);
  }
  $("techDlg").showModal();
});

// ダイアログを閉じたあと、開いたボタンにフォーカスが戻ると Enter でまた開いてしまうので外す
for (const d of ["techDlg", "settingsDlg"]) {
  $(d).addEventListener("close", () => { if (document.activeElement) document.activeElement.blur(); });
}

// ---- ステップ練習：レッスン選択 ----
function stepProgress(lang) {
  const list = window.LESSONS[lang];
  let cleared = 0, stars = 0;
  for (const l of list) { const s = data.steps[`${lang}:${l.id}`] || 0; if (s) cleared++; stars += s; }
  return { cleared, stars, total: list.length };
}
function recommendedLesson(lang) {
  const list = window.LESSONS[lang];
  return list.find((l) => !(data.steps[`${lang}:${l.id}`] >= 1)) || list[list.length - 1];
}
function starsHTML(n) {
  return [0, 1, 2].map((i) => (i < n ? "★" : '<span class="off">★</span>')).join("");
}
function renderSteps() {
  const lang = settings.lang;
  setSeg("segStepLang", lang);
  const list = window.LESSONS[lang];
  const p = stepProgress(lang);
  const rec = recommendedLesson(lang);
  $("stepsSum").innerHTML = `クリア ${p.cleared} / ${p.total} ・ ★ ${p.stars} / ${p.total * 3}　|　<kbd>Enter</kbd> で「${rec.title}」をはじめる`;
  const grid = $("lessonGrid");
  grid.innerHTML = "";
  list.forEach((l, i) => {
    const st = data.steps[`${lang}:${l.id}`] || 0;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lesson-card glass" + (st ? " done" : "");
    b.innerHTML = `<span class="lesson-num">LESSON ${i + 1}</span><span class="lesson-title">${l.title}</span>
      <span class="lesson-note">${l.note}</span><span class="lesson-stars">${starsHTML(st)}</span>`;
    b.addEventListener("click", () => startGame("step", { lang, lessonId: l.id }));
    b.addEventListener("mouseenter", () => Sound.se("hover"));
    grid.appendChild(b);
  });
}
$("segStepLang").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  settings.lang = b.dataset.v;
  Store.save();
  Sound.se("click");
  renderSteps();
});

// ---- プレイ ----
const els = {
  hudBox: document.querySelector(".hud"), hudItems: $("hudItems"), barBox: $("hudBarBox"), bar: $("hudBar"),
  card: $("wordCard"), display: $("wDisplay"), kana: $("wKana"), roma: $("wRoma"), meaning: $("wMeaning"), next: $("wNext"),
  kbBox: $("kbBox"), bubble: $("playBubble"), overlay: $("overlay"), ime: $("imeWarn"), arena: $("arena"),
};
let hudVals = {};
let appleIco = null;
let bubbleTimer = 0;
let shownApples = 0, targetApples = 0;
let countdownId = 0;

function span(cls, text) {
  const s = document.createElement("span");
  if (cls) s.className = cls;
  s.textContent = text;
  return s;
}

const hud = {
  setup(items) {
    els.hudItems.replaceChildren();
    els.hudBox.classList.remove("warn");
    hudVals = {};
    appleIco = null;
    for (const it of items) {
      const d = document.createElement("div");
      d.className = "hud-item" + (it.k === "time" ? " hud-time" : "") + (it.apple ? " hud-apples" : "") + (it.wide ? " wide" : "") + (it.hearts ? " hearts" : "");
      if (it.apple) {
        appleIco = document.createElement("img");
        appleIco.src = "assets/chappy/apple.webp"; appleIco.alt = "りんご"; appleIco.className = "apple-ico";
        d.appendChild(appleIco);
      } else {
        d.appendChild(span("hud-label", it.label));
      }
      const v = span("hud-val", "");
      d.appendChild(v);
      hudVals[it.k] = v;
      els.hudItems.appendChild(d);
    }
    shownApples = 0; targetApples = 0;
  },
  set(k, v) {
    if (k === "apples") { shownApples = v; if (v === 0) targetApples = 0; }
    if (hudVals[k]) hudVals[k].textContent = v;
  },
  bar(r) {
    els.barBox.classList.toggle("off", r == null);
    if (r != null) els.bar.style.transform = `scaleX(${Math.max(0, Math.min(1, r))})`;
  },
  warn(on) {
    els.hudBox.classList.toggle("warn", on);
    const t = els.hudItems.querySelector(".hud-time");
    if (t) t.classList.toggle("warn", on);
  },
};

const app = {
  chappy: playCp,
  hud,
  arena: els.arena,

  layout(name, o) {
    o = o || {};
    document.body.dataset.layout = name;
    guideOn = name !== "cannon" && (settings.guide || !!o.forceGuide);
    els.kbBox.hidden = !guideOn;
  },

  /** 問題の表示 */
  renderWord(s, o) {
    o = o || {};
    const w = s.word, t = s.typer;
    const rest = t.rest();
    const typed = t.typed();
    const missCls = "cur" + (o.miss ? " miss" : "");
    if (w.text != null) {
      els.display.className = "w-display en-text" + (w.text.length > 22 ? " long" : "");
      const cur = rest[0];
      els.display.replaceChildren(span("typed", typed), span(missCls, cur === " " ? "␣" : (cur || "")), span("", rest.slice(1)));
      els.kana.replaceChildren();
      els.roma.replaceChildren();
      els.roma.hidden = true;
    } else {
      const doneLen = t.kanaDone().length;
      els.display.className = "w-display" + (w.display.length > 14 ? " long" : "");
      if (w.display === w.kana) {
        // ひらがな・カタカナだけの問題は、表示する文字そのものに進み具合の色をつける
        els.display.replaceChildren(span("kana-done", w.kana.slice(0, doneLen)), span("", w.kana.slice(doneLen)));
        els.kana.replaceChildren();
      } else {
        els.display.textContent = w.display;
        els.kana.replaceChildren(span("done", w.kana.slice(0, doneLen)), span("", w.kana.slice(doneLen)));
      }
      els.roma.hidden = !settings.romaji;
      els.roma.className = "w-roma" + (typed.length + rest.length > 34 ? " long" : "");
      els.roma.replaceChildren(span("typed", typed), span(missCls, rest[0] || ""), span("", rest.slice(1)));
    }
    if (w.meaning) {
      els.meaning.replaceChildren(Object.assign(document.createElement("b"), { textContent: FIELD_NAME[w.field] || "" }), w.meaning);
    } else {
      els.meaning.replaceChildren();
    }
    if (o.fresh) { els.card.classList.remove("in"); void els.card.offsetWidth; els.card.classList.add("in"); }
    const up = s.upcoming;
    els.next.replaceChildren();
    if (up) els.next.append("つぎ ▸ ", Object.assign(document.createElement("b"), { textContent: up.display }));
    else els.next.append(Object.assign(document.createElement("b"), { textContent: "ラスト！" }));
    if (guideOn) kb.highlight(t.expected());
  },

  say(text, ms) {
    clearTimeout(bubbleTimer);
    els.bubble.hidden = false;
    els.bubble.textContent = text;
    els.bubble.classList.remove("pop"); void els.bubble.offsetWidth; els.bubble.classList.add("pop");
    bubbleTimer = setTimeout(() => { els.bubble.hidden = true; }, ms || 1600);
  },

  missFx(quiet) {
    els.card.classList.remove("shake"); void els.card.offsetWidth; els.card.classList.add("shake");
    if (!quiet) {
      playCp.play("oops");
      playCp.flashMood("think", 650);
    }
  },

  wordClearFx(got, total) {
    targetApples = total;
    const from = els.card.getBoundingClientRect();
    const sx = from.left + from.width / 2, sy = from.top + from.height / 2;
    floatText(`+${got.total}`, sx, from.top + 18, "");
    const n = Math.min(got.total, 5);
    for (let i = 0; i < n; i++) {
      setTimeout(() => flyApple(sx + (Math.random() - .5) * 120, sy + (Math.random() - .5) * 40, i === n - 1), i * 70);
    }
    if (Scene3D.ok) Scene3D.celebrate(false);
  },

  wordFx() {
    const r = els.card.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + 30, 8);
    if (Scene3D.ok) Scene3D.celebrate(false);
  },

  comboFx(combo) {
    const r = playCp.el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height * .3, 22);
    floatText(`${combo} COMBO`, r.left + r.width / 2, r.top - 10, "combo");
    playCp.play("jump");
    playCp.flashMood("happy", 1500);
    if (Scene3D.ok) Scene3D.celebrate(true);
  },

  countdown(done, o) {
    o = o || {};
    let n = 3;
    const id = ++countdownId;
    playCp.setMood("normal");
    playCp.play("wave");
    const step = () => {
      if (screen !== "play" || id !== countdownId) return; // やめた・やり直したときは止める
      if (n > 0) {
        overlayText(String(n), "big");
        Sound.se("count");
        n--;
        setTimeout(step, 750);
      } else {
        overlayText("スタート！", "big word");
        Sound.se("go");
        Sound.bgm(o.bgm || "play");
        done();
      }
    };
    step();
  },

  flashWord(text, then) {
    overlayText(text, "big word", true);
    setTimeout(() => { els.overlay.classList.remove("dim"); then(); }, 1400);
  },

  banner(text) { overlayText(text, "banner"); },

  /** チャッピーからりんごを撃つ（りんごキャノン） */
  shoot(toRect, cb) {
    const from = playCp.el.getBoundingClientRect();
    const x = from.left + from.width * .62, y = from.top + from.height * .2;
    const tx = toRect.left + toRect.width / 2, ty = toRect.top + toRect.height / 2;
    const img = document.createElement("img");
    img.src = "assets/chappy/apple.webp"; img.className = "fly-apple"; img.alt = "";
    img.style.left = x - 20 + "px"; img.style.top = y - 20 + "px";
    document.body.appendChild(img);
    const anim = img.animate([
      { transform: "translate(0,0) scale(.7) rotate(0)" },
      { transform: `translate(${tx - x}px, ${ty - y}px) scale(1) rotate(540deg)` },
    ], { duration: 220, easing: "cubic-bezier(.3,.6,.5,1)" });
    anim.onfinish = () => { img.remove(); cb(); };
    playCp.play("wave", 400);
  },
  burstAt(x, y, n) { burst(x, y, n); if (Scene3D.ok) Scene3D.celebrate(false); },
  floatAt(text, x, y) { floatText(text, x, y, "combo"); },

  finish(result) { if (screen === "play") onFinish(result); },
};

function overlayText(text, cls, dim) {
  els.overlay.classList.toggle("dim", !!dim);
  els.overlay.replaceChildren(span(cls, text));
}

function floatText(text, x, y, cls) {
  const d = span("float-text " + cls, text);
  d.style.left = x + "px"; d.style.top = y + "px";
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 950);
}

function flyApple(x, y, isLast) {
  if (!appleIco) return;
  const toRect = appleIco.getBoundingClientRect();
  const img = document.createElement("img");
  img.src = "assets/chappy/apple.webp";
  img.className = "fly-apple";
  img.alt = "";
  img.style.left = x - 20 + "px"; img.style.top = y - 20 + "px";
  document.body.appendChild(img);
  const dx = toRect.left + toRect.width / 2 - x, dy = toRect.top + toRect.height / 2 - y;
  const anim = img.animate([
    { transform: "translate(0,0) scale(.6) rotate(0)", opacity: 0 },
    { transform: `translate(${dx * .25}px, ${dy * .1 - 60}px) scale(1.1) rotate(-20deg)`, opacity: 1, offset: .3 },
    { transform: `translate(${dx}px, ${dy}px) scale(.7) rotate(15deg)`, opacity: 1 },
  ], { duration: 620, easing: "cubic-bezier(.5,0,.6,1)" });
  anim.onfinish = () => {
    img.remove();
    if (!appleIco) return;
    appleIco.classList.remove("bump"); void appleIco.offsetWidth; appleIco.classList.add("bump");
    hud.set("apples", isLast ? targetApples : Math.min(shownApples + 1, targetApples));
  };
}

function burst(x, y, count) {
  if (document.body.classList.contains("reduce")) return;
  const box = document.createElement("div");
  box.className = "burst";
  box.style.left = x + "px"; box.style.top = y + "px";
  const colors = ["#2ea6b3", "#e2432f", "#f2b63c", "#4a9628", "#7fd0d8"];
  for (let i = 0; i < count; i++) {
    const b = document.createElement("i");
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
    b.style.background = colors[i % colors.length];
    b.style.setProperty("--dx", Math.cos(a) * d + "px");
    b.style.setProperty("--dy", Math.sin(a) * d - 30 + "px");
    b.style.setProperty("--rot", Math.random() * 540 + "deg");
    if (i % 3 === 0) b.style.borderRadius = "50%";
    box.appendChild(b);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1100);
}

function startGame(mode, opts) {
  Sound.unlock();
  Sound.se("click");
  Sound.bgm(null);
  if (game) game.stop();
  els.overlay.replaceChildren();
  els.overlay.classList.remove("dim");
  els.bubble.hidden = true;
  els.ime.hidden = true;
  els.meaning.replaceChildren();
  els.arena.replaceChildren();
  lastStart = { mode, opts };
  show("play");
  playCp.setMood("normal");
  game = CT.modes[mode].create(app, opts);
  game.start();
  track("game_start", { game_mode: mode, game_variant: variantOf(mode, opts) });
}

function quitGame() {
  if (game && lastStart) track("game_quit", { game_mode: lastStart.mode, game_variant: variantOf(lastStart.mode, lastStart.opts) });
  if (game) game.stop();
  game = null;
  countdownId++;
  els.overlay.replaceChildren();
  els.overlay.classList.remove("dim");
  Sound.setHurry(false);
  Sound.se("click");
  show(lastStart && lastStart.mode === "step" ? "steps" : "modes");
}

// ---- 結果 ----
const RESULT_LINES = {
  top: ["信じられない速さ！ 本物のマスターだね", "指が風みたいだったよ！"],
  good: ["すごくいい感じ！ りんごがいっぱいだ", "なめらかに打てていたよ！"],
  mid: ["いい調子！ 続けるほど速くなるよ", "少しずつ指がなじんできたね"],
  low: ["はじめの一歩、ナイス！", "ゆっくりで大丈夫。いっしょに練習しよう"],
};
const HEAD_ICONS = { score: ICONS.cannon, kpm: ICONS.free, acc: ICONS.weak };

function resultLabel(r) {
  const name = modeOf(r.mode).name;
  if (r.mode === "tech") return `${name} ・ ${FIELD_NAME[r.field]}`;
  if (r.mode === "step") return `${name} ・ ${LANG_NAME[r.lang]} ・ ${r.lessonTitle}`;
  if (r.mode === "weak") return `${name} ・ ${LANG_NAME[r.lang]}`;
  if (r.mode === "free") return `${name} ・ ${LANG_NAME[r.lang]} ・ ${DIFF_NAME[r.diff]} ・ ${r.time}秒`;
  return `${name} ・ ${LANG_NAME[r.lang]} ・ ${DIFF_NAME[r.diff]}`;
}
function headText(r) {
  if (r.headType === "apples") return `${r.score} 個`;
  if (r.headType === "score") return `${r.score} 点`;
  if (r.headType === "kpm") return `${r.score} 打/分`;
  if (r.headType === "acc") return `${r.score}%`;
  if (r.headType === "stars") return "★".repeat(r.score) + "☆".repeat(3 - r.score);
  return "";
}

function onFinish(r) {
  game = null;
  lastResult = r;
  const applesBefore = data.totals.apples;
  const { isBest, prev } = Store.addResult(r);
  let prevStars = 0;
  if (r.mode === "step") prevStars = Store.setStars(r.stepId, r.stars);
  const earned = CT.Achievements.check(data, r);
  Store.save();
  const rank = CT.rankOf(r.kpm, r.acc);
  track("game_finish", {
    game_mode: r.mode, game_variant: lastStart ? variantOf(r.mode, lastStart.opts) : "",
    score: r.score, kpm: r.kpm, accuracy: r.acc, rank: rank.letter, new_best: !!isBest,
  });
  for (const a of earned) track("unlock_achievement", { achievement_id: a.id });

  $("resMode").textContent = resultLabel(r);

  // いちばん大きく見せる数字
  const main = $("resMain");
  main.innerHTML = "";
  let countEl = null;
  if (r.headType === "stars") {
    const st = document.createElement("div");
    st.className = "result-stars";
    st.innerHTML = [0, 1, 2].map((i) => `<i class="${i < r.stars ? "" : "off"}" style="animation-delay:${0.35 + i * 0.25}s">★</i>`).join("");
    main.append(st, span("result-sub", r.stars ? "クリア！" : "もう少し！"));
  } else {
    if (r.headType === "apples") main.insertAdjacentHTML("beforeend", '<img src="assets/chappy/apple.webp" alt="" class="result-apple">');
    else main.insertAdjacentHTML("beforeend", `<span class="result-icon">${HEAD_ICONS[r.headType]}</span>`);
    countEl = span("result-num", "0");
    main.append(countEl, span("result-unit", { apples: "個", score: "点", kpm: "打/分", acc: "%" }[r.headType]));
  }

  // バッジ（新記録など）
  const badge = $("resBadge");
  let badgeText = "";
  if (r.mode === "step") {
    if (r.stars > prevStars) badgeText = prevStars ? `★ を更新！（前回 ${"★".repeat(prevStars)}）` : "レッスンクリア！";
  } else if (r.bestKey && isBest && r.score > 0) {
    badgeText = prev ? `自己ベスト更新！（前回のベスト ${prev.score}）` : "はじめての記録！";
  }
  badge.hidden = !badgeText;
  badge.textContent = badgeText;

  $("resRank").textContent = rank.letter;
  $("resRankTitle").textContent = rank.title;

  // 成績の数字
  const speed = r.lang === "en" ? `${r.kpm}<small>打/分</small><br><small>${r.wpm} WPM</small>` : `${r.kpm}<small>打/分</small>`;
  const acc = `${r.acc}<small>%</small>`;
  let stats;
  if (r.mode === "cannon") stats = [["速さ", speed], ["正確さ", acc], ["ウェーブ", r.wave], ["撃ち落とした数", r.kills], ["最大コンボ", r.maxCombo]];
  else if (r.mode === "step") stats = [["速さ", speed], ["正確さ", acc], ["ミス", r.miss], ["時間", CT.modes.step.formatTime(r.seconds)], ["目安 ★2/★3", `${r.goal[0]}<small>/</small>${r.goal[1]}<small>打/分</small>`]];
  else if (r.mode === "weak") stats = [["速さ", speed], ["全体の正確さ", acc], ["ミス", r.miss], ["時間", CT.modes.step.formatTime(r.seconds)], ["問題数", r.words]];
  else if (r.mode === "free") stats = [["正確さ", acc], ["ミス", r.miss], ["正しく打った数", r.correct], [r.lang === "en" ? "WPM" : "クリアした問題", r.lang === "en" ? r.wpm : r.words], ["時間", `${r.time}<small>秒</small>`]];
  else stats = [["速さ", speed], ["正確さ", acc], ["ミス", r.miss], ["最大コンボ", r.maxCombo], ["クリアした問題", r.words]];
  $("resStats").innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

  renderWeakAdvice(r);

  // 新しく取った実績・解放したきせかえ
  const earnedBox = $("resEarned");
  earnedBox.innerHTML = "";
  for (const a of earned) earnedBox.insertAdjacentHTML("beforeend", `<span class="earned-chip">${a.icon} 実績「${a.name}」</span>`);
  for (const [id, need] of Object.entries(CT.Achievements.UNLOCK.skin)) {
    if (need > applesBefore && need <= data.totals.apples) earnedBox.insertAdjacentHTML("beforeend", `<span class="earned-chip">👕 きせかえ「${Chappy.SKINS[id].name}」が解放！</span>`);
  }
  for (const [id, need] of Object.entries(CT.Achievements.UNLOCK.sky)) {
    if (need > applesBefore && need <= data.totals.apples) earnedBox.insertAdjacentHTML("beforeend", `<span class="earned-chip">🌅 背景「${CT.Achievements.SKY_NAMES[id]}」が解放！</span>`);
  }
  earnedBox.hidden = !earnedBox.children.length;

  // チャッピー
  let tier = ["SS", "S"].includes(rank.letter) ? "top" : ["A", "B"].includes(rank.letter) ? "good" : ["C", "D"].includes(rank.letter) ? "mid" : "low";
  let line = pick(RESULT_LINES[tier]);
  if (r.mode === "step") line = r.stars === 3 ? "★3つ！ 完ぺきだね！" : r.stars ? "クリアおめでとう！ 次のレッスンにも行ってみよう" : "正確さ 90% でクリアだよ。もう一回やってみよう！";
  else if (r.mode === "cannon") line = r.wave >= 5 ? "すごい！ 島をしっかり守れたね" : "ナイスファイト！ 次はもっと先のウェーブへ";
  else if (r.mode === "weak") line = r.score >= 95 ? "苦手キーもばっちり！ 克服できてきたね" : "苦手なキーは、ゆっくり正確に打つのが近道だよ";
  if (badgeText && r.mode !== "step" && prev) line = "自己ベスト更新！ やったね！";
  if (r.mode === "step") tier = r.stars === 3 ? "top" : r.stars ? "good" : "low";
  const bub = $("resBubble");
  bub.textContent = line;
  resultCp.setMood(tier === "low" ? "normal" : "happy");

  // ボタン
  $("btnNextLesson").hidden = !(r.mode === "step" && r.stars >= 1 && r.nextLesson);
  $("btnToModes").innerHTML = (r.mode === "step" ? "レッスン選択" : "モード選択") + " <kbd>Esc</kbd>";

  show("result");
  resultReadyAt = performance.now() + 900;
  if (countEl) countUp(countEl, r.score, 900);
  setTimeout(() => {
    if (r.mode === "step" && r.stars) Sound.se("star");
    else Sound.se(badgeText ? "record" : "result");
    resultCp.play(tier === "top" || badgeText ? "jump" : tier === "low" ? "nod" : "wave");
    bub.classList.remove("pop"); void bub.offsetWidth; bub.classList.add("pop");
    if (Scene3D.ok && (badgeText || tier === "top")) Scene3D.celebrate(true);
  }, 350);
  if (earned.length) setTimeout(() => Sound.se("badge"), 1300);
}

function renderWeakAdvice(r) {
  const wbox = $("resWeak");
  wbox.innerHTML = "";
  const div = (t) => Object.assign(document.createElement("div"), { textContent: t });
  if (r.mode === "weak") {
    wbox.append(div("特訓したキーの正確さ"));
    const list = document.createElement("div");
    list.className = "weak-list";
    for (const p of r.perKey) {
      const tot = p.ok + p.ng;
      list.appendChild(keyChip(p.k, tot ? `${Math.round((p.ok / tot) * 1000) / 10}%` : "—"));
    }
    wbox.append(list);
    if (r.fallback) wbox.append(div("記録がたまると、あなたの苦手なキーで特訓できるようになります。"));
    return;
  }
  const weak = Object.entries(r.keyStats).filter(([, v]) => v.ng > 0).sort((a, b) => b[1].ng - a[1].ng).slice(0, 3);
  let advice;
  if (r.correct === 0) advice = "キーを打つと、ここにアドバイスが出ます。";
  else if (r.acc < 90) advice = "まずは正確さを大切に。ゆっくりでもミスを減らすと、結果的に速くなります。";
  else if (r.kpm < 150) advice = "F と J の出っぱりに人さし指を置いて、手元を見ずに打つ練習をしてみましょう。";
  else if (r.diff && r.diff !== "hard") advice = "いい調子です。次は難しさを上げて挑戦してみましょう。";
  else advice = "すばらしい！ この調子で記録をのばしていきましょう。";
  if (weak.length) {
    const list = document.createElement("div");
    list.className = "weak-list";
    for (const [k, v] of weak) list.appendChild(keyChip(k, `${v.ng}回`));
    wbox.append(div("今回ミスが多かったキー"), list);
    const finger = CT.fingerOf(weak[0][0]);
    if (finger) wbox.append(div(`「${keyLabel(weak[0][0])}」は${finger}で打つキーです。`));
  }
  wbox.append(div(advice));
}

function countUp(el, to, ms) {
  const t0 = performance.now();
  const isFloat = !Number.isInteger(to);
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / ms);
    const v = to * (1 - Math.pow(1 - p, 3));
    el.textContent = isFloat ? v.toFixed(1) : Math.round(v);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function keyLabel(k) { return k === "space" ? "スペース" : k.toUpperCase(); }
function keyChip(k, note) {
  const c = document.createElement("span");
  c.className = "key-chip";
  c.append(Object.assign(document.createElement("b"), { textContent: k === "space" ? "␣" : k.toUpperCase() }), note);
  return c;
}

function retry() { if (lastStart) startGame(lastStart.mode, lastStart.opts); }
function nextLesson() {
  if (!lastResult || !lastResult.nextLesson || $("btnNextLesson").hidden) return;
  startGame("step", { lang: lastResult.lang, lessonId: lastResult.nextLesson });
}
function backFromResult() {
  Sound.se("click");
  show(lastResult && lastResult.mode === "step" ? "steps" : "modes");
}
$("btnRetry").addEventListener("click", retry);
$("btnNextLesson").addEventListener("click", nextLesson);
$("btnToModes").addEventListener("click", backFromResult);
$("btnToRecords").addEventListener("click", () => { Sound.se("click"); returnTo = "result"; show("records"); });

// ---- 記録 ----
let recTab = "rush";
function renderRecords() {
  const t = data.totals;
  $("recTotals").innerHTML = [
    ["集めたりんご", t.apples.toLocaleString()], ["プレイ回数", t.plays.toLocaleString()],
    ["打ったキー", t.keystrokes.toLocaleString()], ["連続で遊んだ日", `${data.streak.days}<small> 日（最高 ${data.streak.best}）</small>`],
  ].map(([k, v]) => `<div class="glass rec-total"><span>${k}</span><b>${v}</b></div>`).join("");

  renderChart();
  renderBestTable();

  // 苦手マップ
  if (!kbHeat) kbHeat = CT.Keyboard.create($("recHeat"), { layout: settings.layout, heat: true });
  kbHeat.setLayout(settings.layout);
  const rates = {}, counts = {};
  for (const [k, v] of Object.entries(data.keys)) {
    const n = v.ok + v.ng;
    if (n >= 5) { rates[k] = v.ng / n; counts[k] = n; }
  }
  kbHeat.heat(rates, counts);
  $("recHeatNote").textContent = Object.keys(rates).length
    ? "赤いほどミスが多いキーです。キーにマウスをのせると数字が出ます。"
    : "まだデータがありません。遊ぶとキーごとのミスの割合がここに出ます。";

  // ステップ練習
  $("recSteps").innerHTML = '<div class="step-progress">' + ["ja", "en"].map((l) => {
    const p = stepProgress(l);
    return `<div class="sp-row"><span>${LANG_NAME[l]}</span><span class="sp-bar"><i style="width:${(p.cleared / p.total) * 100}%"></i></span><span>${p.cleared}/${p.total} ・ ★${p.stars}</span></div>`;
  }).join("") + "</div>";

  // 実績
  const L = CT.Achievements.LIST;
  const got = L.filter((a) => data.achievements[a.id]).length;
  $("recBadgeCount").textContent = `（${got} / ${L.length}）`;
  $("recBadges").innerHTML = L.map((a) => `<div class="badge${data.achievements[a.id] ? "" : " locked"}" title="${a.desc}"><span class="bi">${a.icon}</span><span><b>${a.name}</b>${a.desc}</span></div>`).join("");

  // 最近のプレイ
  const h = data.history.slice(0, 30);
  $("recHistory").innerHTML = h.length
    ? "<tr><th>日時</th><th>モード</th><th>内容</th><th>結果</th><th>速さ</th><th>正確さ</th></tr>" +
      h.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${(modeOf(r.mode) || { name: r.mode }).name}</td><td>${historyDetail(r)}</td>
        <td class="num">${headText(r.headType ? r : Object.assign({}, r, { headType: "apples", score: r.apples }))}</td><td class="num">${r.kpm} 打/分</td><td class="num">${r.acc}%</td></tr>`).join("")
    : '<tr><td class="rec-empty">まだプレイの記録がありません。</td></tr>';
}

function historyDetail(r) {
  if (r.mode === "tech") return FIELD_NAME[r.field] || "";
  if (r.mode === "step") return `${LANG_NAME[r.lang]} ・ ${r.lessonTitle}`;
  if (r.mode === "weak") return LANG_NAME[r.lang];
  if (r.mode === "free") return `${LANG_NAME[r.lang]} ・ ${DIFF_NAME[r.diff]} ・ ${r.time}秒`;
  return `${LANG_NAME[r.lang]} ・ ${DIFF_NAME[r.diff]}`;
}

function renderBestTable() {
  setSeg("recTabs", recTab);
  const cell = (b, unit) => b ? `<td class="num">${b.score} ${unit} <small>・ ${b.kpm} 打/分</small></td>` : '<td class="rec-empty">—</td>';
  let html = "";
  if (recTab === "rush" || recTab === "cannon") {
    const unit = recTab === "rush" ? "個" : "点";
    html = "<tr><th>難しさ</th><th>日本語</th><th>English</th></tr>";
    for (const d of ["easy", "normal", "hard"]) html += `<tr><td>${DIFF_NAME[d]}</td>${cell(data.best[`${recTab}:ja:${d}`], unit)}${cell(data.best[`${recTab}:en:${d}`], unit)}</tr>`;
  } else if (recTab === "tech") {
    html = "<tr><th>分野</th><th>自己ベスト</th></tr>";
    for (const f of Object.keys(FIELD_NAME)) html += `<tr><td>${FIELD_NAME[f]}</td>${cell(data.best[`tech:ja:${f}`], "個")}</tr>`;
  } else {
    html = "<tr><th></th><th>やさしい</th><th>ふつう</th><th>むずかしい</th></tr>";
    for (const l of ["ja", "en"]) for (const tm of [30, 60, 120]) {
      html += `<tr><td>${LANG_NAME[l]} ${tm}秒</td>` + ["easy", "normal", "hard"].map((d) => {
        const b = data.best[`free:${l}:${d}:${tm}`];
        return b ? `<td class="num">${b.score} <small>打/分</small></td>` : '<td class="rec-empty">—</td>';
      }).join("") + "</tr>";
    }
  }
  $("recBest").innerHTML = html;
}
$("recTabs").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  recTab = b.dataset.v;
  Sound.se("click");
  renderBestTable();
});

/** 速さの折れ線グラフ（1系列なので凡例なし。点にマウスをのせると詳しく出る） */
function renderChart() {
  const box = $("recChart");
  const pts = data.history.slice(0, 30).reverse();
  if (pts.length < 2) { box.innerHTML = '<div class="chart-empty">2回以上遊ぶと、グラフが表示されます。</div>'; return; }
  const W = Math.max(300, box.clientWidth || 860), H = box.clientHeight || 200;
  const pad = { l: 40, r: 14, t: 14, b: 26 };
  const max = Math.max(...pts.map((p) => p.kpm), 50);
  const top = Math.ceil(max / 50) * 50;
  const x = (i) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  let g = "";
  for (let i = 0; i <= 4; i++) g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y((top / 4) * i)}" y2="${y((top / 4) * i)}"/>`;
  const ticks = [0, 1, 2, 3, 4].map((i) => `<text x="${pad.l - 8}" y="${y((top / 4) * i) + 4}" text-anchor="end">${(top / 4) * i}</text>`).join("");
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.kpm).toFixed(1)}`).join("");
  const dots = pts.map((p, i) => `<circle class="dot" cx="${x(i)}" cy="${y(p.kpm)}" r="4" data-i="${i}"/>`).join("");
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="最近${pts.length}回の速さ（打/分）の移り変わり">
    <g class="grid">${g}</g><g class="axis">${ticks}
      <text x="${pad.l}" y="${H - 6}">${fmtDate(pts[0].date)}</text>
      <text x="${W - pad.r}" y="${H - 6}" text-anchor="end">${fmtDate(pts[pts.length - 1].date)}</text></g>
    <line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
    <path class="line" d="${path}"/>${dots}
    <rect class="hit" x="${pad.l - 10}" y="0" width="${W - pad.l - pad.r + 20}" height="${H}"/></svg><div class="chart-tip" hidden></div>`;
  const svg = box.querySelector("svg"), tip = box.querySelector(".chart-tip"), cross = box.querySelector(".cross");
  const hit = box.querySelector(".hit");
  hit.addEventListener("mousemove", (e) => {
    const r = svg.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(((mx - pad.l) / (W - pad.l - pad.r)) * (pts.length - 1))));
    const p = pts[i];
    box.querySelectorAll(".dot").forEach((d) => d.classList.toggle("on", Number(d.dataset.i) === i));
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.style.left = (x(i) / W) * r.width + "px";
    tip.style.top = (y(p.kpm) / H) * r.height + "px";
    tip.innerHTML = `<b>${p.kpm}</b> 打/分 ・ 正確さ ${p.acc}%<br>${fmtDate(p.date)} ${(modeOf(p.mode) || { name: "" }).name}`;
  });
  hit.addEventListener("mouseleave", () => {
    tip.hidden = true;
    cross.setAttribute("visibility", "hidden");
    box.querySelectorAll(".dot.on").forEach((d) => d.classList.remove("on"));
  });
}

function fmtDate(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

$("btnRecords").addEventListener("click", () => {
  Sound.unlock(); Sound.se("click");
  if (screen !== "records" && screen !== "wardrobe") returnTo = screen;
  show("records");
});
$("btnExport").addEventListener("click", () => {
  Sound.se("click");
  const blob = new Blob([Store.exportJSON()], { type: "application/json" });
  const a = document.createElement("a");
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `chappy-typing-records-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$("btnImport").addEventListener("click", () => { Sound.se("click"); $("fileImport").click(); });
$("fileImport").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const text = await f.text();
    if (!confirm("いまの記録を、読み込んだファイルの記録に置きかえます。よろしいですか？")) return;
    Store.importJSON(text);
    applyAll();
    renderRecords();
    alert("記録を読み込みました。");
  } catch (err) {
    alert("読み込めませんでした：" + err.message);
  }
});
$("btnReset").addEventListener("click", () => {
  if (!confirm("記録をすべて消しますか？（設定は残ります）この操作は元に戻せません。")) return;
  Store.reset();
  renderRecords();
});

// ---- きせかえ ----
const SKY_SWATCH = {
  day: "linear-gradient(180deg, #6fbaf7, #eaf6ff)",
  sunset: "linear-gradient(180deg, #7d8fd9, #ffd0a6)",
  night: "linear-gradient(180deg, #0d1b3f, #2d4f86)",
};
let wardrobeBuilt = false;
function renderWardrobe() {
  const total = data.totals.apples;
  $("wardrobeApples").innerHTML = `<img src="assets/chappy/apple.webp" alt="">集めたりんご ${total.toLocaleString()} 個`;
  const skinGrid = $("skinGrid"), skyGrid = $("skyGrid");
  if (!wardrobeBuilt) {
    wardrobeBuilt = true;
    for (const [id, sk] of Object.entries(Chappy.SKINS)) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "item"; b.dataset.id = id;
      const th = span("thumb", "");
      th.appendChild(Chappy.create({ skin: id, fixedSkin: true, label: false }).el);
      b.append(th, span("", sk.name), span("lock-note", ""));
      b.addEventListener("click", () => chooseSkin(id));
      skinGrid.appendChild(b);
    }
    for (const [id, name] of Object.entries(CT.Achievements.SKY_NAMES)) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "item"; b.dataset.id = id;
      const sw = span("swatch", "");
      sw.style.background = SKY_SWATCH[id];
      b.append(sw, span("", name), span("lock-note", ""));
      b.addEventListener("click", () => chooseSky(id));
      skyGrid.appendChild(b);
    }
  }
  const U = CT.Achievements.UNLOCK;
  for (const [grid, kind, cur] of [[skinGrid, "skin", settings.skin], [skyGrid, "sky", settings.sky]]) {
    for (const b of grid.children) {
      const need = U[kind][b.dataset.id];
      const locked = total < need;
      b.classList.toggle("locked", locked);
      b.setAttribute("aria-pressed", String(b.dataset.id === cur));
      b.setAttribute("aria-disabled", String(locked));
      const note = b.querySelector(".lock-note");
      note.textContent = locked ? `🔒 りんご ${need} 個で解放` : (kind === "sky" && !has3d ? "3D 背景がオンのとき" : "");
    }
  }
}
function chooseSkin(id) {
  if (data.totals.apples < CT.Achievements.UNLOCK.skin[id]) { Sound.se("miss"); wardrobeCp.play("oops"); return; }
  settings.skin = id;
  Store.save();
  Chappy.setSkinAll(id);
  Sound.se("word");
  wardrobeCp.play("jump");
  wardrobeCp.flashMood("happy", 1200);
  renderWardrobe();
}
function chooseSky(id) {
  if (data.totals.apples < CT.Achievements.UNLOCK.sky[id]) { Sound.se("miss"); wardrobeCp.play("oops"); return; }
  settings.sky = id;
  Store.save();
  applySky();
  Sound.se("word");
  renderWardrobe();
}
$("btnWardrobe").addEventListener("click", () => {
  Sound.unlock(); Sound.se("click");
  if (screen !== "records" && screen !== "wardrobe") returnTo = screen;
  show("wardrobe");
  wardrobeCp.play("wave");
});

// ---- もどる ----
document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", goBack));
function goBack() {
  Sound.se("click");
  if (screen === "modes") show("title");
  else if (screen === "steps") show("modes");
  else if (screen === "records" || screen === "wardrobe") show(["records", "wardrobe", "play"].includes(returnTo) ? "title" : returnTo);
}

// ---- 設定 ----
const dlg = $("settingsDlg");
function syncSettingsUI() {
  $("volBgm").value = Math.round(settings.bgm * 100);
  $("volSe").value = Math.round(settings.se * 100);
  $("volBgmOut").textContent = $("volBgm").value;
  $("volSeOut").textContent = $("volSe").value;
  $("chkMute").checked = settings.muted;
  $("chkGuide").checked = settings.guide;
  $("chkRomaji").checked = settings.romaji;
  $("chk3d").checked = settings.use3d;
  $("chkReduce").checked = settings.reduceMotion;
  setSeg("segLayout", settings.layout);
  setSeg("segFont", settings.fontSize);
  $("btnMute").setAttribute("aria-pressed", String(settings.muted));
}
function applyAll() {
  Sound.setVolume(settings.bgm, settings.se);
  Sound.setMuted(settings.muted);
  document.body.dataset.fs = settings.fontSize;
  const reduce = settings.reduceMotion || prefersReduced;
  document.body.classList.toggle("reduce", reduce);
  kb.setLayout(settings.layout);
  Chappy.setSkinAll(settings.skin);
  setup3d();
  if (Scene3D.ok) Scene3D.setReduced(reduce);
  syncSettingsUI();
}
$("btnSettings").addEventListener("click", () => { Sound.unlock(); Sound.se("click"); syncSettingsUI(); dlg.showModal(); });
const onSetting = (fn) => (e) => { fn(e); Store.save(); applyAll(); };
$("volBgm").addEventListener("input", onSetting((e) => { settings.bgm = e.target.value / 100; }));
$("volSe").addEventListener("input", onSetting((e) => { settings.se = e.target.value / 100; }));
$("volSe").addEventListener("change", () => Sound.se("word"));
$("chkMute").addEventListener("change", onSetting((e) => { settings.muted = e.target.checked; }));
$("chkGuide").addEventListener("change", onSetting((e) => { settings.guide = e.target.checked; }));
$("chkRomaji").addEventListener("change", onSetting((e) => { settings.romaji = e.target.checked; }));
$("chk3d").addEventListener("change", onSetting((e) => { settings.use3d = e.target.checked; }));
$("chkReduce").addEventListener("change", onSetting((e) => { settings.reduceMotion = e.target.checked; }));
for (const [id, key] of [["segLayout", "layout"], ["segFont", "fontSize"]]) {
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    settings[key] = b.dataset.v;
    Store.save();
    Sound.se("click");
    applyAll();
  });
}
$("btnMute").addEventListener("click", () => {
  Sound.unlock();
  settings.muted = !settings.muted;
  Store.save();
  applyAll();
  if (!settings.muted) Sound.se("click");
});

// ---- キーボード ----
document.addEventListener("keydown", (e) => {
  if (dlg.open || $("techDlg").open) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // 日本語入力（IME）がオンのとき
  if (e.isComposing || e.key === "Process" || e.keyCode === 229) {
    if (screen === "play") els.ime.hidden = false;
    return;
  }

  if (screen === "play") {
    if (e.key === "Escape") { e.preventDefault(); quitGame(); return; }
    if (e.key.length === 1) {
      e.preventDefault(); // スペースでのスクロールや、Firefox の「'」「/」検索を止める
      els.ime.hidden = true;
      if (!game) return;
      const ok = game.onKey(e.key);
      if (ok === true) {
        if (guideOn) kb.flash(e.key, true);
        if (Scene3D.ok) Scene3D.pulse();
      } else if (ok === false && guideOn) {
        kb.flash(e.key, false);
      }
    }
    return;
  }

  // ボタンにフォーカスがあるときの Enter / Space は、ボタンのクリックにまかせる
  // （いま表示している画面・メニューの中のボタンだけ。前の画面に残ったフォーカスは無視する）
  const ae = document.activeElement;
  const onButton = !!(ae && ae.tagName === "BUTTON" && ae.closest(".screen.active, .topbar"));

  if (screen === "title") {
    if (e.key === "Enter" && !onButton) { e.preventDefault(); startFromTitle(); }
  } else if (screen === "modes") {
    if (e.key === "Escape") goBack();
    else if (e.key === "Enter" && !onButton) { e.preventDefault(); goFromModes(); }
    else if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const i = MODES.findIndex((m) => m.id === selectedMode);
      const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[e.key];
      selectMode(MODES[(i + d + MODES.length) % MODES.length].id, true);
    }
  } else if (screen === "steps") {
    if (e.key === "Escape") goBack();
    else if (e.key === "Enter" && !onButton) { e.preventDefault(); startGame("step", { lang: settings.lang, lessonId: recommendedLesson(settings.lang).id }); }
  } else if (screen === "result") {
    if (performance.now() < resultReadyAt) return; // 打ち終わりの勢いで押してしまわないように
    if (e.key === "Enter" && !onButton) { e.preventDefault(); retry(); }
    else if (e.key === "n" || e.key === "N") nextLesson();
    else if (e.key === "Escape") backFromResult();
  } else if (screen === "records" || screen === "wardrobe") {
    if (e.key === "Escape") goBack();
  }
});

// 最初の操作で音を出せるようにする
["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, () => Sound.unlock(), { once: true, capture: true }));

// ---- 背景のりんご（3D が使えないとき用） ----
(function floaters() {
  const box = document.querySelector(".floaters");
  const spots = [[8, 62], [18, 30], [86, 56], [74, 22], [92, 34], [4, 40]];
  spots.forEach(([x, y], i) => {
    const img = document.createElement("img");
    img.src = "assets/chappy/apple.webp"; img.alt = "";
    img.style.left = x + "%"; img.style.top = y + "%";
    img.style.animationDelay = `${-i * 1.3}s`;
    img.style.width = 26 + (i % 3) * 8 + "px";
    box.appendChild(img);
  });
})();

// ---- スマホ・タブレット ----
if (matchMedia("(hover: none) and (pointer: coarse)").matches) {
  $("mobileBlock").hidden = false;
  $("mobileChappy").appendChild(Chappy.create({ mood: "happy" }).el);
}

// ---- はじまり ----
applyAll();
show("title");

// 動作確認用（ブラウザのコンソールから使える）
window.__chappyTyping = { show, startGame, data, settings };
})();

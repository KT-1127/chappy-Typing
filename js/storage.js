/*!
 * storage.js — 記録の保存（この端末のブラウザだけに保存）
 * 保存できない環境（プライベートモードなど）でも、ゲームはそのまま遊べるようにする。
 */
(function (global) {
"use strict";

const KEY = "chappy-typing:v1";
const HISTORY_MAX = 200;

function defaultSettings() {
  return {
    lang: "ja", diff: "normal", field: "all", time: 60,
    bgm: 0.5, se: 0.8, muted: false,
    guide: true, layout: "jis", romaji: true, fontSize: "m",
    use3d: true, reduceMotion: false,
    skin: "none", sky: "day",
  };
}

function defaults() {
  return {
    version: 1,
    settings: defaultSettings(),
    best: {},         // "rush:ja:normal" → { score, kpm, acc, date }
    history: [],      // 新しい順
    keys: {},         // "a" → { ok, ng }
    totals: { apples: 0, plays: 0, keystrokes: 0 },
    romajiPref: {},
    steps: {},        // "ja:fj" → ★の数（0〜3）
    achievements: {}, // id → 取った日時
    streak: { last: "", days: 0, best: 0 },
  };
}

let data = defaults();

function merge(d) {
  const base = defaults();
  const out = Object.assign(base, d);
  out.settings = Object.assign(defaultSettings(), d.settings || {});
  out.totals = Object.assign(defaults().totals, d.totals || {});
  out.streak = Object.assign(defaults().streak, d.streak || {});
  // 段階1の記録（apples だけ）を新しい形にそろえる
  for (const v of Object.values(out.best)) if (v.score == null && v.apples != null) v.score = v.apples;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = merge(JSON.parse(raw));
  } catch (e) { data = defaults(); }
  return data;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 保存できなくても続ける */ }
}

function dayStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 1回分のプレイを記録する。{ isBest, prev } を返す */
function addResult(r) {
  let isBest = false, prev = null;
  if (r.bestKey) {
    prev = data.best[r.bestKey] || null;
    isBest = !prev || r.score > prev.score || (r.score === prev.score && r.kpm > prev.kpm);
    if (isBest) data.best[r.bestKey] = { score: r.score, kpm: r.kpm, acc: r.acc, date: r.date };
  }
  // 履歴（キー別の記録は重いので履歴には入れない）
  const h = Object.assign({}, r);
  delete h.keyStats; delete h.stats;
  data.history.unshift(h);
  if (data.history.length > HISTORY_MAX) data.history.length = HISTORY_MAX;

  data.totals.apples += r.apples || 0;
  data.totals.plays += 1;
  data.totals.keystrokes += r.correct || 0;
  for (const [k, v] of Object.entries(r.keyStats || {})) {
    const s = data.keys[k] || (data.keys[k] = { ok: 0, ng: 0 });
    s.ok += v.ok; s.ng += v.ng;
  }
  // 連続で遊んだ日数
  const today = dayStr(new Date());
  const yest = dayStr(new Date(Date.now() - 86400000));
  if (data.streak.last !== today) {
    data.streak.days = data.streak.last === yest ? data.streak.days + 1 : 1;
    data.streak.last = today;
    data.streak.best = Math.max(data.streak.best, data.streak.days);
  }
  save();
  return { isBest, prev };
}

/** レッスンの★を記録（よいほうを残す） */
function setStars(id, stars) {
  const prev = data.steps[id] || 0;
  if (stars > prev) data.steps[id] = stars;
  save();
  return prev;
}

/** 画面側が同じオブジェクトを見ているので、入れかえずに中身だけ差しかえる */
function replaceWith(d, keepSettings) {
  const keep = data.settings;
  for (const k of Object.keys(data)) delete data[k];
  Object.assign(data, d);
  if (keepSettings) data.settings = keep;
  save();
}

function reset() { replaceWith(defaults(), true); }

/** 書き出し用の JSON 文字列 */
function exportJSON() {
  return JSON.stringify({ app: "chappy-typing", exportedAt: new Date().toISOString(), data }, null, 2);
}

/** 読み込み。うまくいけば true、形がちがえばエラーを投げる */
function importJSON(text) {
  const obj = JSON.parse(text);
  const d = obj && obj.app === "chappy-typing" ? obj.data : obj;
  if (!d || d.version !== 1 || typeof d.best !== "object" || !Array.isArray(d.history)) {
    throw new Error("チャッピータイピングの記録ファイルではないようです。");
  }
  replaceWith(merge(d), false);
  return true;
}

global.Store = {
  load, save, addResult, setStars, reset, exportJSON, importJSON,
  get data() { return data; },
};
})(window);

/*!
 * achievements.js — 実績（称号）と、きせかえの解放条件
 *   CT.Achievements.check(data, result) → 新しく取った実績の配列
 */
(function (global) {
"use strict";

const stepCount = (d) => Object.values(d.steps).filter((s) => s >= 1).length;
const allSteps = (d, lang) => global.LESSONS[lang].every((l) => (d.steps[`${lang}:${l.id}`] || 0) >= 1);

// check(d, r): d = 保存データ、r = 今回の結果（ないときもある）
const LIST = [
  { id: "first", icon: "🌱", name: "はじめの一歩", desc: "はじめてプレイした", check: (d) => d.totals.plays >= 1 },
  { id: "plays30", icon: "📅", name: "常連さん", desc: "30回プレイした", check: (d) => d.totals.plays >= 30 },
  { id: "streak3", icon: "🔥", name: "3日連続", desc: "3日続けて遊んだ", check: (d) => d.streak.days >= 3 },
  { id: "streak7", icon: "🏅", name: "1週間連続", desc: "7日続けて遊んだ", check: (d) => d.streak.days >= 7 },
  { id: "apples100", icon: "🍎", name: "りんご100個", desc: "りんごを合計100個集めた", check: (d) => d.totals.apples >= 100 },
  { id: "apples1000", icon: "🧺", name: "りんご1000個", desc: "りんごを合計1000個集めた", check: (d) => d.totals.apples >= 1000 },
  { id: "apples5000", icon: "🌳", name: "りんご農園", desc: "りんごを合計5000個集めた", check: (d) => d.totals.apples >= 5000 },
  { id: "combo10", icon: "✨", name: "10コンボ", desc: "ミスなしで10問続けた", check: (d, r) => r && r.maxCombo >= 10 },
  { id: "combo30", icon: "💫", name: "30コンボ", desc: "ミスなしで30問続けた", check: (d, r) => r && r.maxCombo >= 30 },
  { id: "perfect", icon: "💎", name: "パーフェクト", desc: "50打以上をミスなしで打った", check: (d, r) => r && r.correct >= 50 && r.miss === 0 },
  { id: "kpm200", icon: "🚲", name: "200打/分", desc: "1分あたり200打をこえた（50打以上）", check: (d, r) => r && r.correct >= 50 && r.kpm >= 200 },
  { id: "kpm300", icon: "🚄", name: "300打/分", desc: "1分あたり300打をこえた（50打以上）", check: (d, r) => r && r.correct >= 50 && r.kpm >= 300 },
  { id: "kpm400", icon: "🚀", name: "400打/分", desc: "1分あたり400打をこえた（50打以上）", check: (d, r) => r && r.correct >= 50 && r.kpm >= 400 },
  { id: "step5", icon: "📈", name: "レッスン5つ", desc: "ステップ練習を5つクリアした", check: (d) => stepCount(d) >= 5 },
  { id: "stepAll", icon: "🎓", name: "ステップ修了", desc: "日本語か英語のレッスンをすべてクリアした", check: (d) => allSteps(d, "ja") || allSteps(d, "en") },
  { id: "stars3", icon: "🌟", name: "三つ星", desc: "レッスンで★3つを取った", check: (d) => Object.values(d.steps).some((s) => s >= 3) },
  { id: "tech30", icon: "🔧", name: "技術科ことば博士", desc: "技術科ことばで、1回にりんご30個", check: (d, r) => r && r.mode === "tech" && r.apples >= 30 },
  { id: "techAll", icon: "🧰", name: "全分野制覇", desc: "技術科ことばを4分野すべてで遊んだ", check: (d) => ["material", "bio", "energy", "info"].every((f) => d.best[`tech:ja:${f}`]) },
  { id: "cannon5", icon: "🎯", name: "キャノンの名手", desc: "りんごキャノンでウェーブ5に到達", check: (d, r) => r && r.mode === "cannon" && r.wave >= 5 },
  { id: "cannon10", icon: "🛡️", name: "島の守り神", desc: "りんごキャノンでウェーブ10に到達", check: (d, r) => r && r.mode === "cannon" && r.wave >= 10 },
  { id: "bilingual", icon: "🌏", name: "バイリンガル", desc: "日本語と英語の両方で遊んだ", check: (d) => d.history.some((h) => h.lang === "ja") && d.history.some((h) => h.lang === "en") },
  { id: "weak", icon: "🔍", name: "弱点克服", desc: "にがて特訓で、特訓キーの正確さ95%以上", check: (d, r) => r && r.mode === "weak" && r.score >= 95 },
];

function check(d, r) {
  const got = [];
  for (const a of LIST) {
    if (d.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.check(d, r); } catch (e) { ok = false; }
    if (ok) { d.achievements[a.id] = Date.now(); got.push(a); }
  }
  return got;
}

// きせかえの解放条件（集めたりんごの合計）
const UNLOCK = {
  skin: { none: 0, sprout: 30, glasses: 100, ribbon: 250, scarf: 500, headphones: 1000, crown: 2000 },
  sky: { day: 0, sunset: 300, night: 800 },
};
const SKY_NAMES = { day: "昼の空", sunset: "夕焼け", night: "星空" };

global.CT = Object.assign(global.CT || {}, { Achievements: { LIST, check, UNLOCK, SKY_NAMES } });
})(window);

/*!
 * modes/weak.js — にがて特訓：記録から苦手なキーを割り出し、そのキーを多く含む問題を出す
 * 15問（3問に1問はキーの集中練習）。結果は「特訓キーの正確さ」。
 */
(function (global) {
"use strict";

const COUNT = 15;
const FALLBACK = { ja: ["y", "b", "p", "z", "x"], en: ["b", "p", "q", "z", "x"] };

/** 苦手なキー（ミス率が高い順に最大5つ）。データが少なければ fallback: true */
function weakKeys(lang) {
  const keys = global.Store.data.keys;
  const list = Object.entries(keys)
    .filter(([k, v]) => v.ok + v.ng >= 15 && v.ng > 0 && (/^[a-z]$/.test(k) || (lang === "en" && k.length === 1)))
    .map(([k, v]) => ({ k, rate: v.ng / (v.ok + v.ng) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5)
    .map((x) => x.k);
  if (list.length >= 3) return { keys: list, fallback: false };
  const fill = FALLBACK[lang].filter((k) => !list.includes(k));
  return { keys: list.concat(fill).slice(0, 5), fallback: true };
}

/** 問題の「打つ文字列」（日本語はおすすめのローマ字） */
function strokes(w) {
  if (w.text != null) return w.text.toLowerCase();
  return global.CT.createTyper({ lang: "ja", kana: w.kana }).rest();
}

function buildItems(lang, keys) {
  const CT = global.CT;
  const pool = ["easy", "normal", "hard"].flatMap((d) => CT.wordsFor(lang, d));
  const scored = pool.map((w) => {
    const s = strokes(w);
    let hit = 0;
    for (const c of s) if (keys.includes(c)) hit++;
    return { w, score: hit / Math.sqrt(s.length), hit };
  }).filter((x) => x.hit > 0).sort((a, b) => b.score - a.score).slice(0, 36);
  const words = CT.shuffle(scored.map((x) => x.w));
  const home = "asdfjkl";
  const items = [];
  for (let i = 0; i < COUNT; i++) {
    if (i % 3 === 2 || !words.length) {
      let t = "";
      const len = 5 + Math.floor(Math.random() * 2);
      while (t.length < len) t += Math.random() < 0.65 ? keys[Math.floor(Math.random() * keys.length)] : home[Math.floor(Math.random() * home.length)];
      items.push({ display: t, text: t, drill: true });
    } else {
      items.push(words[i % words.length]);
    }
  }
  return items;
}

function create(app, opts) {
  const CT = global.CT;
  const lang = opts.lang;
  const wk = weakKeys(lang);
  const items = buildItems(lang, wk.keys);
  const s = CT.createSession({ lang, words: items, ordered: true, limit: items.length, pref: global.Store.data.romajiPref });
  let running = false, startAt = 0, raf = 0;
  const label = wk.keys.map((k) => k.toUpperCase()).join(" ");

  function weakAcc() {
    let ok = 0, ng = 0;
    for (const k of wk.keys) { const v = s.stats.keyStats[k]; if (v) { ok += v.ok; ng += v.ng; } }
    return ok + ng ? Math.round((ok / (ok + ng)) * 1000) / 10 : 100;
  }

  function loop() {
    if (!running) return;
    const t = (performance.now() - startAt) / 1000;
    app.hud.set("acc", weakAcc() + "%");
    app.hud.set("speed", CT.summarize(s.stats, Math.max(t, 1), lang).kpm);
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    running = false;
    cancelAnimationFrame(raf);
    const t = (performance.now() - startAt) / 1000;
    const sum = CT.summarize(s.stats, t, lang);
    const acc = weakAcc();
    global.Sound.se("finish");
    app.chappy.setMood(acc >= 90 ? "happy" : "normal");
    app.chappy.play(acc >= 90 ? "jump" : "nod");
    const perKey = wk.keys.map((k) => {
      const v = s.stats.keyStats[k] || { ok: 0, ng: 0 };
      return { k, ok: v.ok, ng: v.ng };
    });
    app.flashWord("おしまい！", () => app.finish({
      mode: "weak", lang, headType: "acc", score: acc, weakKeys: wk.keys, perKey, fallback: wk.fallback,
      ...sum, miss: s.stats.miss, correct: s.stats.correct, words: s.stats.words,
      maxCombo: s.stats.maxCombo, keyStats: s.stats.keyStats, seconds: Math.round(t), date: Date.now(),
    }));
  }

  return {
    start() {
      app.layout("card", { forceGuide: true });
      app.hud.setup([
        { k: "prog", label: "すすみ", big: true },
        { k: "keys", label: "特訓するキー", wide: true },
        { k: "acc", label: "特訓キーの正確さ" },
        { k: "speed", label: "打/分" },
      ]);
      app.hud.set("prog", `0 / ${COUNT}`);
      app.hud.set("keys", label);
      app.hud.set("acc", "—"); app.hud.set("speed", 0);
      app.hud.bar(0);
      app.renderWord(s);
      app.say(wk.fallback ? "まだ記録が少ないから、まちがえやすいキーで練習しよう" : `${label} を中心に練習しよう！`, 3000);
      app.countdown(() => { running = true; startAt = performance.now(); raf = requestAnimationFrame(loop); });
    },
    onKey(key) {
      if (!running) return;
      const r = s.key(key);
      if (r.ignored) return;
      if (!r.ok) {
        global.Sound.se("miss");
        app.renderWord(s, { miss: true });
        app.missFx();
        return false;
      }
      global.Sound.se("key");
      if (!r.wordDone) { app.renderWord(s); return true; }
      global.Sound.se("word");
      app.wordFx();
      app.chappy.play("nod");
      app.hud.set("prog", `${s.stats.words} / ${COUNT}`);
      app.hud.bar(s.stats.words / COUNT);
      if (s.stats.words >= COUNT) { finish(); return true; }
      s.next();
      app.renderWord(s, { fresh: true });
      return true;
    },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}

global.CT = global.CT || {};
global.CT.modes = global.CT.modes || {};
global.CT.modes.weak = { create, weakKeys };
})(window);

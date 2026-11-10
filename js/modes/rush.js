/*!
 * modes/rush.js — りんごラッシュ / 技術科ことば：60秒で何個りんごを集められるか
 *
 * りんごのルール
 *   ・1問打ち終わるごとに、長さに応じて 1〜（6打で1個）
 *   ・ミスなしで続けて打てた問題の数が「コンボ」。5コンボ以上で +1、10コンボ以上で +2
 * 技術科ことば（opts.tech）は、技術科の用語を出題し、用語の意味も表示する。
 */
(function (global) {
"use strict";

const DURATION = 60;
const START_LINES = ["いくよ！ りんごをたくさん集めよう", "肩の力をぬいて、リラックス！", "まずは正確に。速さはあとからついてくるよ"];
const TECH_START = ["技術科の用語、いくつ打てるかな？", "意味も読みながら打ってみよう！", "用語を覚えるチャンスだよ"];
const CHEER_LINES = ["いい調子！", "そのリズム！", "なめらか！", "りんごがどんどん集まるね", "ナイスタイピング！"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function applesFor(typedLen, combo, perfect) {
  const base = Math.max(1, Math.round(typedLen / 6));
  const bonus = !perfect ? 0 : combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
  return { base, bonus, total: base + bonus };
}

function create(app, opts) {
  const CT = global.CT;
  const tech = !!opts.tech;
  const lang = tech ? "ja" : opts.lang;
  const s = CT.createSession({
    lang, diff: opts.diff, pref: global.Store.data.romajiPref,
    words: tech ? CT.techWords(opts.field) : null,
  });
  let apples = 0;
  let running = false;
  let startAt = 0, raf = 0, lastTickSec = -1, hurry = false;

  function elapsed() { return running ? (performance.now() - startAt) / 1000 : 0; }

  function loop() {
    if (!running) return;
    const t = elapsed();
    const left = Math.max(0, DURATION - t);
    app.hud.set("time", left.toFixed(1));
    app.hud.bar(left / DURATION);
    const sum = CT.summarize(s.stats, Math.max(t, 1), lang);
    app.hud.set("speed", lang === "en" ? sum.wpm : sum.kpm);
    if (left <= 10 && !hurry) {
      hurry = true;
      app.hud.warn(true);
      global.Sound.setHurry(true);
      app.say("ラスト10秒！", 1800);
    }
    const sec = Math.ceil(left);
    if (left <= 5 && sec !== lastTickSec && sec > 0) { lastTickSec = sec; global.Sound.se("tick"); }
    if (left <= 0) { finish(); return; }
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    running = false;
    cancelAnimationFrame(raf);
    global.Sound.setHurry(false);
    global.Sound.se("finish");
    app.chappy.setMood("happy");
    app.chappy.play("jump");
    const sum = CT.summarize(s.stats, DURATION, lang);
    const field = opts.field || "all";
    app.flashWord("おしまい！", () => app.finish({
      mode: tech ? "tech" : "rush", lang, diff: tech ? null : opts.diff, field: tech ? field : null,
      bestKey: tech ? `tech:ja:${field}` : `rush:${lang}:${opts.diff}`,
      headType: "apples", score: apples, apples, ...sum,
      miss: s.stats.miss, correct: s.stats.correct, words: s.stats.words,
      maxCombo: s.stats.maxCombo, keyStats: s.stats.keyStats,
      seconds: DURATION, date: Date.now(),
    }));
  }

  return {
    start() {
      app.layout("card");
      app.hud.setup([
        { k: "time", label: "のこり", big: true },
        { k: "apples", apple: true },
        { k: "combo", label: "コンボ" },
        { k: "speed", label: lang === "en" ? "WPM" : "打/分" },
      ]);
      app.hud.set("time", DURATION.toFixed(1));
      app.hud.set("apples", 0); app.hud.set("combo", 0); app.hud.set("speed", 0);
      app.hud.bar(1);
      app.renderWord(s);
      app.countdown(() => {
        running = true;
        startAt = performance.now();
        app.say(pick(tech ? TECH_START : START_LINES), 2200);
        raf = requestAnimationFrame(loop);
      });
    },
    onKey(key) {
      if (!running) return;
      const r = s.key(key);
      if (r.ignored) return;
      if (!r.ok) {
        global.Sound.se("miss");
        app.renderWord(s, { miss: true });
        app.missFx();
        app.hud.set("combo", 0);
        if (r.wordMiss === 3) app.say("あわてなくて大丈夫。ゆっくりいこう", 2000);
        return false;
      }
      global.Sound.se("key");
      if (!r.wordDone) { app.renderWord(s); return true; }

      // 1問クリア
      const typedLen = s.typer.typed().length;
      const combo = s.stats.combo;
      const got = applesFor(typedLen, combo, r.perfect);
      apples += got.total;
      app.wordClearFx(got, apples);
      app.hud.set("combo", combo);
      if (r.perfect && combo > 0 && combo % 5 === 0) {
        global.Sound.se("combo");
        app.comboFx(combo);
        app.say(combo >= 20 ? `${combo}コンボ！ とまらない！` : combo >= 10 ? `${combo}コンボ！ すごい！` : `${combo}コンボ！ いい調子`, 1600);
      } else {
        global.Sound.se(got.total >= 3 ? "apple" : "word");
        app.chappy.play(s.stats.words % 4 === 0 ? "ears" : "nod");
        if (s.stats.words % 8 === 0) app.say(pick(CHEER_LINES), 1400);
      }
      s.next();
      app.renderWord(s, { fresh: true });
      return true;
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      global.Sound.setHurry(false);
    },
  };
}

global.CT = global.CT || {};
global.CT.modes = global.CT.modes || {};
global.CT.modes.rush = { create, DURATION };
global.CT.modes.tech = { create: (app, opts) => create(app, Object.assign({}, opts, { tech: true })) };
})(window);

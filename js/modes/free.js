/*!
 * modes/free.js — フリー計測：飾りなしで、決めた時間の速さと正確さを測る
 */
(function (global) {
"use strict";

function create(app, opts) {
  const CT = global.CT;
  const lang = opts.lang;
  const DURATION = Number(opts.time) || 60;
  const s = CT.createSession({ lang, diff: opts.diff, pref: global.Store.data.romajiPref });
  let running = false, startAt = 0, raf = 0, lastTickSec = -1;

  function loop() {
    if (!running) return;
    const t = (performance.now() - startAt) / 1000;
    const left = Math.max(0, DURATION - t);
    const sum = CT.summarize(s.stats, Math.max(t, 1), lang);
    app.hud.set("time", left.toFixed(1));
    app.hud.bar(left / DURATION);
    app.hud.set("speed", sum.kpm);
    app.hud.set("acc", s.stats.correct + s.stats.miss ? sum.acc + "%" : "—");
    if (lang === "en") app.hud.set("wpm", sum.wpm);
    else app.hud.set("count", s.stats.correct);
    const sec = Math.ceil(left);
    if (left <= 3 && sec !== lastTickSec && sec > 0) { lastTickSec = sec; global.Sound.se("tick"); }
    if (left <= 0) { finish(); return; }
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    running = false;
    cancelAnimationFrame(raf);
    const sum = CT.summarize(s.stats, DURATION, lang);
    global.Sound.se("finish");
    app.flashWord("おしまい", () => app.finish({
      mode: "free", lang, diff: opts.diff, time: DURATION,
      bestKey: `free:${lang}:${opts.diff}:${DURATION}`,
      headType: "kpm", score: sum.kpm, ...sum,
      miss: s.stats.miss, correct: s.stats.correct, words: s.stats.words,
      maxCombo: s.stats.maxCombo, keyStats: s.stats.keyStats, seconds: DURATION, date: Date.now(),
    }));
  }

  return {
    start() {
      app.layout("free");
      app.hud.setup([
        { k: "time", label: "のこり", big: true },
        { k: "speed", label: "打/分" },
        lang === "en" ? { k: "wpm", label: "WPM" } : { k: "count", label: "正しく打った数" },
        { k: "acc", label: "正確さ" },
      ]);
      app.hud.set("time", DURATION.toFixed(1));
      app.hud.set("speed", 0); app.hud.set("acc", "—");
      app.hud.set(lang === "en" ? "wpm" : "count", 0);
      app.hud.bar(1);
      app.renderWord(s);
      app.countdown(() => { running = true; startAt = performance.now(); raf = requestAnimationFrame(loop); }, { bgm: "title" });
    },
    onKey(key) {
      if (!running) return;
      const r = s.key(key);
      if (r.ignored) return;
      if (!r.ok) {
        global.Sound.se("miss");
        app.renderWord(s, { miss: true });
        app.missFx(true);
        return false;
      }
      global.Sound.se("key");
      if (r.wordDone) { s.next(); app.renderWord(s, { fresh: true }); }
      else app.renderWord(s);
      return true;
    },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}

global.CT = global.CT || {};
global.CT.modes = global.CT.modes || {};
global.CT.modes.free = { create };
})(window);

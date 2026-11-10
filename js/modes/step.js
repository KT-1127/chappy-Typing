/*!
 * modes/step.js — ステップ練習：レッスンを1つずつ。時間制限なし、決まった数を打つ
 * ★1：正確さ 90% 以上 / ★2：95% 以上で goal[0] 打/分 / ★3：97% 以上で goal[1] 打/分
 */
(function (global) {
"use strict";

const rint = (n) => Math.floor(Math.random() * n);

/** キー練習の文字列（同じキーが3回続かないように） */
function keyDrill(keys, mix) {
  const len = 4 + rint(3);
  let out = "";
  while (out.length < len) {
    const pool = mix && Math.random() < 0.3 ? mix : keys;
    const c = pool[rint(pool.length)];
    if (out.length >= 2 && out[out.length - 1] === c && out[out.length - 2] === c) continue;
    out += c;
  }
  return out;
}

function kanaDrill(set) {
  const arr = Array.isArray(set) ? set : Array.from(set);
  const len = 2 + rint(3);
  let out = "";
  for (let i = 0; i < len; i++) out += arr[rint(arr.length)];
  return out;
}

function itemsFor(lesson, lang) {
  const CT = global.CT;
  const n = lesson.count;
  const out = [];
  if (lesson.type === "keys") {
    for (let i = 0; i < n; i++) { const t = keyDrill(lesson.keys, lesson.mix); out.push({ display: t, text: t }); }
  } else if (lesson.type === "kana") {
    for (let i = 0; i < n; i++) { const k = kanaDrill(lesson.kana); out.push({ display: k, kana: k }); }
  } else if (lesson.type === "list") {
    const l = CT.shuffle(lesson.list.slice());
    for (let i = 0; i < n; i++) {
      const it = l[i % l.length];
      out.push(Array.isArray(it) ? { display: it[0], kana: it[1] } : { display: it, text: it });
    }
  } else {
    const l = CT.shuffle(CT.wordsFor(lang, lesson.diff));
    for (let i = 0; i < n; i++) out.push(l[i % l.length]);
  }
  return out;
}

function starsFor(lesson, kpm, acc) {
  if (acc >= 97 && kpm >= lesson.goal[1]) return 3;
  if (acc >= 95 && kpm >= lesson.goal[0]) return 2;
  if (acc >= 90) return 1;
  return 0;
}

function create(app, opts) {
  const CT = global.CT;
  const lessons = global.LESSONS[opts.lang];
  const idx = lessons.findIndex((l) => l.id === opts.lessonId);
  const lesson = lessons[idx];
  const items = itemsFor(lesson, opts.lang);
  const s = CT.createSession({ lang: opts.lang, words: items, ordered: true, limit: items.length, pref: global.Store.data.romajiPref });
  let running = false, startAt = 0, raf = 0;

  function elapsed() { return (performance.now() - startAt) / 1000; }
  function loop() {
    if (!running) return;
    const t = elapsed();
    app.hud.set("time", formatTime(t));
    const sum = CT.summarize(s.stats, Math.max(t, 1), opts.lang);
    app.hud.set("speed", sum.kpm);
    app.hud.set("acc", sum.acc + "%");
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    running = false;
    cancelAnimationFrame(raf);
    const t = elapsed();
    const sum = CT.summarize(s.stats, t, opts.lang);
    const stars = starsFor(lesson, sum.kpm, sum.acc);
    global.Sound.se("finish");
    app.chappy.setMood(stars ? "happy" : "normal");
    app.chappy.play(stars ? "jump" : "nod");
    const next = lessons[idx + 1];
    app.flashWord(stars ? "クリア！" : "おしまい", () => app.finish({
      mode: "step", lang: opts.lang, lessonId: lesson.id, lessonTitle: `${idx + 1}. ${lesson.title}`,
      stepId: `${opts.lang}:${lesson.id}`, stars, goal: lesson.goal,
      nextLesson: next ? next.id : null,
      headType: "stars", score: stars, ...sum,
      miss: s.stats.miss, correct: s.stats.correct, words: s.stats.words,
      maxCombo: s.stats.maxCombo, keyStats: s.stats.keyStats,
      seconds: Math.round(t), date: Date.now(),
    }));
  }

  return {
    lesson,
    start() {
      app.layout("card", { forceGuide: true });
      app.hud.setup([
        { k: "prog", label: "すすみ", big: true },
        { k: "acc", label: "正確さ" },
        { k: "speed", label: "打/分" },
        { k: "time", label: "時間" },
      ]);
      app.hud.set("prog", `0 / ${items.length}`);
      app.hud.set("acc", "—"); app.hud.set("speed", 0); app.hud.set("time", "0:00");
      app.hud.bar(0);
      app.renderWord(s);
      app.say(lesson.note, 3200);
      app.countdown(() => {
        running = true;
        startAt = performance.now();
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
        if (r.wordMiss === 3) app.say("キーボードの光っているキーを見てみよう", 2000);
        return false;
      }
      global.Sound.se("key");
      if (!r.wordDone) { app.renderWord(s); return true; }
      global.Sound.se("word");
      app.wordFx();
      app.chappy.play("nod");
      app.hud.set("prog", `${s.stats.words} / ${items.length}`);
      app.hud.bar(s.stats.words / items.length);
      if (s.stats.words >= items.length) { finish(); return true; }
      s.next();
      app.renderWord(s, { fresh: true });
      return true;
    },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}

function formatTime(t) {
  const m = Math.floor(t / 60), sec = Math.floor(t % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

global.CT = global.CT || {};
global.CT.modes = global.CT.modes || {};
global.CT.modes.step = { create, starsFor, formatTime };
})(window);

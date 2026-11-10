/*!
 * modes/cannon.js — りんごキャノン：落ちてくる言葉を打って、りんごで撃ち落とす
 *   ・最初のキーで、そのキーから打てる言葉（いちばん下のもの）にねらいを定める
 *   ・下まで落ちるとライフが1つ減る（3つ）。8個落とすごとにウェーブが上がって速くなる
 */
(function (global) {
"use strict";

const LIVES = 3;
const PER_WAVE = 8;

function create(app, opts) {
  const CT = global.CT;
  const lang = opts.lang;
  const listDiff = opts.diff === "easy" ? "easy" : "normal";
  const speedMul = { easy: 0.85, normal: 1, hard: 1.3 }[opts.diff] || 1;
  const pool = CT.shuffle(CT.wordsFor(lang, listDiff));
  let poolIdx = 0;
  const arena = app.arena;
  const words = [];
  const stats = { correct: 0, miss: 0, words: 0, combo: 0, maxCombo: 0, keyStats: {} };
  let target = null, lives = LIVES, wave = 1, kills = 0, score = 0;
  let running = false, startAt = 0, raf = 0, lastT = 0, spawnIn = 0.4;

  const interval = () => Math.max(0.75, (lang === "en" ? 2.1 : 2.4) * Math.pow(0.88, wave - 1));
  const fallSpeed = () => (arena.clientHeight / 9) * speedMul * (1 + (wave - 1) * 0.12);
  const groundY = () => arena.clientHeight - 175;

  function bump(k, field) {
    const name = CT.keyName(k);
    const s = stats.keyStats[name] || (stats.keyStats[name] = { ok: 0, ng: 0 });
    s[field]++;
  }

  function nextWord() {
    for (let i = 0; i < pool.length; i++) {
      const w = pool[poolIdx++ % pool.length];
      if (!words.some((x) => x.w.display === w.display)) return w;
    }
    return pool[poolIdx++ % pool.length];
  }

  function makeTyper(w) {
    return w.text != null ? CT.createTyper({ lang: "en", text: w.text }) : CT.createTyper({ lang: "ja", kana: w.kana, pref: global.Store.data.romajiPref });
  }

  function spawn() {
    const w = nextWord();
    const el = document.createElement("div");
    el.className = "cn-word";
    const x = 10 + Math.random() * 80;
    el.style.left = x + "%";
    arena.appendChild(el);
    const item = { w, el, typer: makeTyper(w), y: 0, speed: fallSpeed() * (0.85 + Math.random() * 0.3), missFlash: false };
    words.push(item);
    render(item);
  }

  function render(item) {
    const t = item.typer, rest = t.rest(), typed = t.typed();
    const parts = [];
    const sp = (cls, txt) => { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = txt; return s; };
    if (item.w.text != null) {
      const d = document.createElement("div");
      d.className = "cn-text";
      d.append(sp("typed", typed), sp("cur" + (item.missFlash ? " miss" : ""), rest[0] === " " ? "␣" : rest[0] || ""), sp("", rest.slice(1)));
      parts.push(d);
    } else {
      const d = document.createElement("div");
      d.className = "cn-disp";
      d.textContent = item.w.display;
      const r = document.createElement("div");
      r.className = "cn-roma";
      r.append(sp("typed", typed), sp("cur" + (item.missFlash ? " miss" : ""), rest[0] || ""), sp("", rest.slice(1)));
      parts.push(d, r);
    }
    item.el.replaceChildren(...parts);
    item.el.classList.toggle("target", item === target);
  }

  function remove(item, cls) {
    const i = words.indexOf(item);
    if (i >= 0) words.splice(i, 1);
    if (target === item) target = null;
    item.el.classList.add(cls);
    setTimeout(() => item.el.remove(), 450);
  }

  function destroy(item) {
    const typedLen = item.typer.typed().length;
    const pts = Math.round(typedLen * 10 * (1 + Math.min(stats.combo, 10) * 0.1)) + (wave - 1) * 5;
    score += pts;
    kills++;
    stats.words++;
    app.hud.set("score", score);
    const rect = item.el.getBoundingClientRect();
    words.splice(words.indexOf(item), 1);
    target = null;
    item.el.classList.add("locked");
    app.shoot(rect, () => {
      global.Sound.se("pop");
      app.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 16);
      app.floatAt(`+${pts}`, rect.left + rect.width / 2, rect.top);
      item.el.classList.add("boom");
      setTimeout(() => item.el.remove(), 400);
    });
    global.Sound.se("shoot");
    app.chappy.play("nod");
    if (kills % PER_WAVE === 0) {
      wave++;
      app.hud.set("wave", wave);
      global.Sound.se("wave");
      app.banner(`WAVE ${wave}`);
      app.chappy.play("jump");
      app.chappy.flashMood("happy", 1200);
      if (wave === 3) app.say("どんどん速くなるよ！", 1600);
      if (wave === 5) app.say("すごい、ウェーブ5！", 1600);
    }
  }

  function hitGround(item) {
    lives--;
    stats.combo = 0;
    app.hud.set("lives", hearts());
    global.Sound.se("lose");
    app.missFx();
    app.say(lives > 0 ? "あっ、落ちちゃった！" : "島が…！", 1400);
    remove(item, "fall");
    if (lives <= 0) gameOver();
  }

  function hearts() { return "♥".repeat(Math.max(0, lives)) + "♡".repeat(LIVES - Math.max(0, lives)); }

  function loop(t) {
    if (!running) return;
    const now = t / 1000;
    const dt = Math.min(0.1, lastT ? now - lastT : 0.016); // 描画が遅いパソコンでも、落ちる速さは同じ
    lastT = now;
    spawnIn -= dt;
    if (spawnIn <= 0 && words.length < 6) { spawn(); spawnIn = interval(); }
    const g = groundY();
    for (const item of words.slice()) {
      item.y += item.speed * dt * (item === target ? 0.7 : 1); // ねらった言葉は少しゆっくり
      item.el.style.transform = `translate(-50%, ${item.y}px)`;
      if (item.y >= g) hitGround(item);
      if (!running) return;
    }
    const el = (performance.now() - startAt) / 1000;
    app.hud.set("speed", CT.summarize(stats, Math.max(el, 1), lang).kpm);
    raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(raf);
    for (const item of words.slice()) remove(item, "fall");
    app.chappy.setMood("sleep");
    const el = (performance.now() - startAt) / 1000;
    const sum = CT.summarize(stats, el, lang);
    app.flashWord("ゲームオーバー", () => {
      app.chappy.setMood("normal");
      app.finish({
        mode: "cannon", lang, diff: opts.diff, bestKey: `cannon:${lang}:${opts.diff}`,
        headType: "score", score, wave, kills, ...sum,
        miss: stats.miss, correct: stats.correct, words: kills, maxCombo: stats.maxCombo,
        keyStats: stats.keyStats, seconds: Math.round(el), date: Date.now(),
      });
    });
  }

  return {
    start() {
      app.layout("cannon");
      arena.replaceChildren();
      app.hud.setup([
        { k: "score", label: "スコア", big: true },
        { k: "wave", label: "ウェーブ" },
        { k: "lives", label: "ライフ", hearts: true },
        { k: "speed", label: "打/分" },
      ]);
      app.hud.set("score", 0); app.hud.set("wave", 1); app.hud.set("lives", hearts()); app.hud.set("speed", 0);
      app.hud.bar(null);
      app.say("落ちてくる言葉を打って、島を守ろう！", 2600);
      app.countdown(() => { running = true; startAt = performance.now(); lastT = 0; raf = requestAnimationFrame(loop); }, { bgm: "battle" });
    },
    onKey(key) {
      if (!running) return;
      if (key.length !== 1) return;
      let item = target;
      let ok = false;
      if (item) {
        const exp = item.typer.expected();
        ok = item.typer.input(key).ok;
        if (!ok) bump(exp, "ng");
      } else {
        // いちばん下の言葉から順に、このキーで始められるものをさがす
        const order = words.slice().sort((a, b) => b.y - a.y);
        for (const w of order) {
          if (w.typer.input(key).ok) { item = w; ok = true; target = w; break; }
        }
        if (!ok && order[0]) bump(order[0].typer.expected(), "ng");
      }
      if (!ok) {
        stats.miss++;
        stats.combo = 0;
        global.Sound.se("miss");
        app.missFx(true);
        if (target) { target.missFlash = true; render(target); target.missFlash = false; }
        return false;
      }
      stats.correct++;
      bump(key, "ok");
      global.Sound.se("key");
      for (const w of words) if (w !== item) w.el.classList.remove("target");
      if (item.typer.done()) {
        stats.combo++;
        stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
        destroy(item);
      } else {
        render(item);
      }
      return true;
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      arena.replaceChildren();
    },
  };
}

global.CT = global.CT || {};
global.CT.modes = global.CT.modes || {};
global.CT.modes.cannon = { create };
})(window);

/*!
 * session.js — 1回分のタイピング（出題・入力・成績）。どのモードでも使う共通部分。
 *
 *   const s = CT.createSession({ lang: "ja", diff: "normal", pref });
 *   const s = CT.createSession({ lang, words: [...], ordered: true, limit: 10 });  問題を指定するとき
 *   問題は { display, kana, meaning? }（ローマ字で打つ）か { display, text }（そのまま打つ）
 *   s.word        いまの問題 { display, kana } / { display, text }
 *   s.typer       入力判定（typing.js）
 *   s.key("a")    → { ok, wordDone, expected }
 *   s.next()      次の問題へ
 *   s.stats       { correct, miss, words, combo, maxCombo, keyStats }
 */
(function (global) {
"use strict";

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 同じ問題が続かないように、全部出し終わるまで重ならない袋から取り出す */
function bag(list) {
  let pool = [];
  let last = null;
  return () => {
    if (!pool.length) {
      pool = shuffle(list.slice());
      if (pool.length > 1 && pool[pool.length - 1] === last) pool.unshift(pool.pop());
    }
    last = pool.pop();
    return last;
  };
}

function wordsFor(lang, diff) {
  if (lang === "en") return global.WORDS_EN[diff].map((t) => ({ display: t, text: t }));
  return global.WORDS_JA[diff].map(([d, k]) => ({ display: d, kana: k }));
}

/** 技術科ことば（field = all / material / bio / energy / info） */
function techWords(field) {
  const T = global.WORDS_TECH;
  const keys = field && field !== "all" ? [field] : Object.keys(T.fields);
  const out = [];
  for (const f of keys) for (const [d, k, m] of T[f]) out.push({ display: d, kana: k, meaning: m, field: f });
  return out;
}

function ordered(list) {
  let i = 0;
  return () => list[i++ % list.length];
}

/** キー別の記録に使う名前（英字は小文字にそろえる） */
function keyName(k) {
  if (k === " ") return "space";
  return k.length === 1 ? k.toLowerCase() : k;
}

function createSession(opts) {
  const lang = opts.lang, diff = opts.diff;
  const pref = opts.pref || {};
  const list = opts.words || wordsFor(lang, diff);
  const pull = opts.ordered ? ordered(list) : bag(list);
  const limit = opts.limit || 0;
  let drawn = 0;
  const draw = () => { drawn++; return pull(); };
  const stats = { correct: 0, miss: 0, words: 0, perfectWords: 0, combo: 0, maxCombo: 0, keyStats: {} };
  let word = null, typer = null, upcoming = draw();
  let wordMiss = 0;

  function next() {
    word = upcoming;
    upcoming = limit && drawn >= limit ? null : draw();
    typer = word.text != null
      ? global.CT.createTyper({ lang: "en", text: word.text })
      : global.CT.createTyper({ lang: "ja", kana: word.kana, pref });
    wordMiss = 0;
  }

  function bumpKey(k, field) {
    const name = keyName(k);
    if (!name) return;
    const s = stats.keyStats[name] || (stats.keyStats[name] = { ok: 0, ng: 0 });
    s[field]++;
  }

  function key(k) {
    const expected = typer.expected();
    const r = typer.input(k);
    if (r.ignored) return { ignored: true };
    if (r.ok) {
      stats.correct++;
      bumpKey(k, "ok");
      if (r.done) {
        stats.words++;
        if (wordMiss === 0) {
          stats.perfectWords++;
          stats.combo++;
          stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
        }
      }
      return { ok: true, wordDone: r.done, perfect: r.done && wordMiss === 0, expected };
    }
    stats.miss++;
    wordMiss++;
    stats.combo = 0;
    bumpKey(expected, "ng");
    return { ok: false, expected, wordMiss };
  }

  next();
  return {
    lang, diff, stats, pref,
    get word() { return word; },
    get upcoming() { return upcoming; },
    get typer() { return typer; },
    get wordMiss() { return wordMiss; },
    key, next,
  };
}

// ---- 成績の計算 ----
function summarize(stats, seconds, lang) {
  const min = Math.max(seconds, 1) / 60;
  const kpm = Math.round(stats.correct / min);
  const total = stats.correct + stats.miss;
  const acc = total ? Math.round((stats.correct / total) * 1000) / 10 : 100;
  const wpm = lang === "en" ? Math.round((stats.correct / 5) / min) : null;
  return { kpm, acc, wpm };
}

// ランク（速さ × 正確さ で決める）
const RANKS = [
  { min: 420, letter: "SS", title: "伝説の収穫者" },
  { min: 330, letter: "S", title: "りんごマスター" },
  { min: 260, letter: "A", title: "りんご名人" },
  { min: 200, letter: "B", title: "実りの木" },
  { min: 150, letter: "C", title: "若木" },
  { min: 90, letter: "D", title: "ふたば" },
  { min: 0, letter: "E", title: "りんごの芽" },
];
function rankOf(kpm, acc) {
  const score = kpm * Math.pow(acc / 100, 2);
  return RANKS.find((r) => score >= r.min);
}

// どの指で打つキーか（苦手キーのアドバイス用）
const FINGERS = {
  "左手の小指": "1qaz",
  "左手の薬指": "2wsx",
  "左手の中指": "3edc",
  "左手の人さし指": "45rtfgvb",
  "右手の人さし指": "67yuhjnm",
  "右手の中指": "8ik,",
  "右手の薬指": "9ol.",
  "右手の小指": "0p;:/-[]@^'\"?!",
};
function fingerOf(k) {
  if (k === "space") return "親指";
  for (const [f, keys] of Object.entries(FINGERS)) if (keys.includes(k)) return f;
  return "";
}

global.CT = Object.assign(global.CT || {}, { createSession, summarize, rankOf, fingerOf, RANKS, wordsFor, techWords, shuffle, keyName });
})(window);

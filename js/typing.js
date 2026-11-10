/*!
 * typing.js — 入力判定エンジン（日本語ローマ字 / 英語）
 *
 * 日本語:
 *   const t = CT.createTyper({ lang: "ja", kana: "しゃしん" });
 *   t.input("s")  → { ok: true, done: false }   正しいキー
 *   t.input("q")  → { ok: false }               ミス（進まない）
 *   t.typed()     → ここまで打ったローマ字
 *   t.rest()      → 残りのおすすめローマ字（ガイド表示用）
 *   t.expected()  → 次に押すべきおすすめのキー（苦手分析用）
 *
 * 「し = shi / si / ci」「ん = nn / n（次が子音のとき）」「っ = 子音を重ねる / xtu / ltu」など、
 * 打ち方の候補をすべて受け付けます。
 */
(function (global) {
"use strict";

// ---- かな → ローマ字の候補（先頭がガイドに出すおすすめ） ----
const T = {
  "あ":["a"],"い":["i","yi"],"う":["u","wu","whu"],"え":["e"],"お":["o"],
  "か":["ka","ca"],"き":["ki"],"く":["ku","cu","qu"],"け":["ke"],"こ":["ko","co"],
  "さ":["sa"],"し":["shi","si","ci"],"す":["su"],"せ":["se","ce"],"そ":["so"],
  "た":["ta"],"ち":["chi","ti"],"つ":["tsu","tu"],"て":["te"],"と":["to"],
  "な":["na"],"に":["ni"],"ぬ":["nu"],"ね":["ne"],"の":["no"],
  "は":["ha"],"ひ":["hi"],"ふ":["fu","hu"],"へ":["he"],"ほ":["ho"],
  "ま":["ma"],"み":["mi"],"む":["mu"],"め":["me"],"も":["mo"],
  "や":["ya"],"ゆ":["yu"],"よ":["yo"],
  "ら":["ra"],"り":["ri"],"る":["ru"],"れ":["re"],"ろ":["ro"],
  "わ":["wa"],"を":["wo"],"ゐ":["wyi"],"ゑ":["wye"],
  "が":["ga"],"ぎ":["gi"],"ぐ":["gu"],"げ":["ge"],"ご":["go"],
  "ざ":["za"],"じ":["ji","zi"],"ず":["zu"],"ぜ":["ze"],"ぞ":["zo"],
  "だ":["da"],"ぢ":["di"],"づ":["du"],"で":["de"],"ど":["do"],
  "ば":["ba"],"び":["bi"],"ぶ":["bu"],"べ":["be"],"ぼ":["bo"],
  "ぱ":["pa"],"ぴ":["pi"],"ぷ":["pu"],"ぺ":["pe"],"ぽ":["po"],
  "ゔ":["vu"],
  "ぁ":["xa","la"],"ぃ":["xi","li"],"ぅ":["xu","lu"],"ぇ":["xe","le"],"ぉ":["xo","lo"],
  "ゃ":["xya","lya"],"ゅ":["xyu","lyu"],"ょ":["xyo","lyo"],"ゎ":["xwa","lwa"],
  "っ":["xtu","ltu","xtsu","ltsu"],
  // 2文字でひとまとまりの音
  "きゃ":["kya"],"きぃ":["kyi"],"きゅ":["kyu"],"きぇ":["kye"],"きょ":["kyo"],
  "しゃ":["sha","sya"],"しぃ":["syi"],"しゅ":["shu","syu"],"しぇ":["she","sye"],"しょ":["sho","syo"],
  "ちゃ":["cha","tya","cya"],"ちぃ":["tyi","cyi"],"ちゅ":["chu","tyu","cyu"],"ちぇ":["che","tye","cye"],"ちょ":["cho","tyo","cyo"],
  "にゃ":["nya"],"にぃ":["nyi"],"にゅ":["nyu"],"にぇ":["nye"],"にょ":["nyo"],
  "ひゃ":["hya"],"ひぃ":["hyi"],"ひゅ":["hyu"],"ひぇ":["hye"],"ひょ":["hyo"],
  "みゃ":["mya"],"みぃ":["myi"],"みゅ":["myu"],"みぇ":["mye"],"みょ":["myo"],
  "りゃ":["rya"],"りぃ":["ryi"],"りゅ":["ryu"],"りぇ":["rye"],"りょ":["ryo"],
  "ぎゃ":["gya"],"ぎぃ":["gyi"],"ぎゅ":["gyu"],"ぎぇ":["gye"],"ぎょ":["gyo"],
  "じゃ":["ja","jya","zya"],"じぃ":["jyi","zyi"],"じゅ":["ju","jyu","zyu"],"じぇ":["je","jye","zye"],"じょ":["jo","jyo","zyo"],
  "ぢゃ":["dya"],"ぢぃ":["dyi"],"ぢゅ":["dyu"],"ぢぇ":["dye"],"ぢょ":["dyo"],
  "びゃ":["bya"],"びぃ":["byi"],"びゅ":["byu"],"びぇ":["bye"],"びょ":["byo"],
  "ぴゃ":["pya"],"ぴぃ":["pyi"],"ぴゅ":["pyu"],"ぴぇ":["pye"],"ぴょ":["pyo"],
  "ふぁ":["fa"],"ふぃ":["fi"],"ふぇ":["fe"],"ふぉ":["fo"],"ふゅ":["fyu"],
  "てぃ":["thi"],"てゅ":["thu"],"でぃ":["dhi"],"でゅ":["dhu"],
  "とぅ":["twu"],"どぅ":["dwu"],
  "うぃ":["wi","whi"],"うぇ":["we","whe"],"うぉ":["who"],
  "ゔぁ":["va"],"ゔぃ":["vi"],"ゔぇ":["ve"],"ゔぉ":["vo"],
  "つぁ":["tsa"],"つぃ":["tsi"],"つぇ":["tse"],"つぉ":["tso"],
  "くぁ":["qa","kwa"],"くぃ":["qi"],"くぇ":["qe"],"くぉ":["qo"],
  "ぐぁ":["gwa"],
  // 記号
  "ー":["-"],"、":[","],"。":["."],"！":["!"],"？":["?"],"・":["/"],
  "「":["["],"」":["]"],"～":["~"],"　":[" "],
};

const CONSONANT = /^[bcdfghjklmpqrstvwxz]/;

/** カタカナ → ひらがな、全角英数 → 半角 */
function normalizeKana(s) {
  return s
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[！-～]/g, (c) => {
      const h = String.fromCharCode(c.charCodeAt(0) - 0xfee0);
      return T[c] ? c : h; // ！？～ は表にあるのでそのまま
    });
}

// ---- 日本語 ----
function createJaTyper(kanaRaw, pref) {
  const kana = normalizeKana(kanaRaw);
  pref = pref || {}; // { "し": "si" } のように、その人がよく使う打ち方
  let pos = 0;        // 何文字目のかなまで打ち終わったか
  let buf = "";       // いま打っている途中のローマ字
  let typedStr = "";  // 打ち終わったローマ字
  let cands = null;   // pos から始まる候補のキャッシュ

  /** 1つのかなの候補（その人の好みを先頭に） */
  function opts(k) {
    const list = T[k] || (/^[\x20-\x7e]$/.test(k) ? [k.toLowerCase()] : null);
    if (!list) return [k];
    const p = pref[k];
    if (p && list.includes(p) && list[0] !== p) return [p, ...list.filter((o) => o !== p)];
    return list;
  }

  /** i の位置から始まる候補 [{ len: 何文字分, str: ローマ字 }]（っ・ん の重ね打ちは含めない） */
  function simple(i) {
    const out = [];
    if (i >= kana.length) return out;
    const two = kana.substr(i, 2);
    if (two.length === 2 && T[two]) for (const s of opts(two)) out.push({ len: 2, str: s, key: two });
    for (const s of opts(kana[i])) out.push({ len: 1, str: s, key: kana[i] });
    return out;
  }

  /** i の位置から始まる候補をすべて */
  function candidates(i) {
    const c = kana[i];
    if (c === "っ") {
      const out = [];
      const next = i + 1 < kana.length && kana[i + 1] !== "っ" && kana[i + 1] !== "ん" ? simple(i + 1) : [];
      for (const n of next) {
        if (!CONSONANT.test(n.str)) continue;
        out.push({ len: 1 + n.len, str: n.str[0] + n.str, key: n.key, sokuon: true });
        if (n.str.startsWith("ch")) out.push({ len: 1 + n.len, str: "t" + n.str, key: n.key, sokuon: true });
      }
      for (const s of opts("っ")) out.push({ len: 1, str: s, key: "っ" });
      return out;
    }
    if (c === "ん") {
      const out = [];
      // 次が子音で始まるなら n 1回でよい（ん＋次の音をまとめて受け付ける）
      if (i + 1 < kana.length) {
        for (const n of candidates(i + 1)) {
          if (CONSONANT.test(n.str) && n.str[0] !== "n" && n.str[0] !== "y") {
            out.push({ len: 1 + n.len, str: "n" + n.str, key: n.key, hatsu: true });
          }
        }
      }
      const base = ["nn", "xn", "n'"];
      const p = pref["ん"];
      if (p && base.includes(p)) base.sort((a, b) => (a === p ? -1 : b === p ? 1 : 0));
      for (const s of base) out.push({ len: 1, str: s, key: "ん" });
      return out;
    }
    return simple(i);
  }

  function getCands() {
    if (!cands) cands = candidates(pos);
    return cands;
  }

  function commit(cand) {
    typedStr += cand.str;
    // 好みの打ち方を覚える（いま打ったかなについて）
    if (!cand.sokuon && !cand.hatsu) pref[cand.key] = cand.str;
    pos += cand.len;
    buf = "";
    cands = null;
  }

  function input(keyRaw) {
    if (pos >= kana.length) return { ok: false, done: true };
    const key = keyRaw.length === 1 ? keyRaw.toLowerCase() : keyRaw;
    if (key.length !== 1) return { ok: false, ignored: true };
    const next = buf + key;
    const list = getCands();
    const matching = list.filter((c) => c.str.startsWith(next));
    if (matching.length) {
      const exact = matching.filter((c) => c.str === next);
      const longer = matching.some((c) => c.str.length > next.length);
      if (exact.length && !longer) {
        exact.sort((a, b) => b.len - a.len);
        commit(exact[0]);
      } else {
        buf = next;
      }
      return { ok: true, done: pos >= kana.length };
    }
    // 打ち途中の buf がそれ自体で完成した候補なら、それを確定してからもう一度試す
    const exactBuf = buf && list.find((c) => c.str === buf);
    if (exactBuf) {
      const saved = { pos, buf, typedStr };
      commit(exactBuf);
      const r = input(key);
      if (r.ok) return r;
      pos = saved.pos; buf = saved.buf; typedStr = saved.typedStr; cands = null;
    }
    return { ok: false, done: false };
  }

  /** pos から最後までのおすすめローマ字 */
  function guideFrom(i) {
    let s = "";
    while (i < kana.length) {
      const c = candidates(i)[0];
      if (!c) { s += kana[i]; i++; continue; }
      s += c.str;
      i += c.len;
    }
    return s;
  }

  function rest() {
    if (pos >= kana.length) return "";
    const list = getCands();
    const cur = list.find((c) => c.str.startsWith(buf)) || list[0];
    return cur.str.slice(buf.length) + guideFrom(pos + cur.len);
  }

  return {
    lang: "ja",
    input,
    typed: () => typedStr + buf,
    rest,
    expected: () => rest()[0] || "",
    done: () => pos >= kana.length,
    progress: () => (kana.length ? pos / kana.length : 1),
    kanaDone: () => kana.slice(0, pos),
    kanaRest: () => kana.slice(pos),
    pref,
  };
}

// ---- 英語 ----
function createEnTyper(text) {
  let pos = 0;
  function input(key) {
    if (pos >= text.length) return { ok: false, done: true };
    if (key.length !== 1) return { ok: false, ignored: true };
    if (key === text[pos]) {
      pos++;
      return { ok: true, done: pos >= text.length };
    }
    return { ok: false, done: false };
  }
  return {
    lang: "en",
    input,
    typed: () => text.slice(0, pos),
    rest: () => text.slice(pos),
    expected: () => text[pos] || "",
    done: () => pos >= text.length,
    progress: () => (text.length ? pos / text.length : 1),
  };
}

function createTyper(o) {
  return o.lang === "en" ? createEnTyper(o.text) : createJaTyper(o.kana, o.pref);
}

const api = { createTyper, normalizeKana, KANA_TABLE: T };
global.CT = Object.assign(global.CT || {}, api);
if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

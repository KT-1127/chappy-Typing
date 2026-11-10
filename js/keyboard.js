/*!
 * keyboard.js — 画面のキーボード（指ガイド・苦手マップ）
 *
 *   const kb = CT.Keyboard.create(container, { layout: "jis" });
 *   kb.highlight("k")        次に押すキーと指を光らせる（大文字・記号は Shift も）
 *   kb.flash("k", true)      押したキーを一瞬光らせる（false ならミスの色）
 *   kb.heat({ k: 0.12 })     キーごとのミス率で色をつける（記録画面用）
 *   kb.setLayout("us")
 */
(function (global) {
"use strict";

// [ふつうに押したときの文字, Shift を押したときの文字]
const LAYOUTS = {
  jis: [
    [["1","!"],["2","\""],["3","#"],["4","$"],["5","%"],["6","&"],["7","'"],["8","("],["9",")"],["0",""],["-","="],["^","~"],["\\","|"]],
    [["q","Q"],["w","W"],["e","E"],["r","R"],["t","T"],["y","Y"],["u","U"],["i","I"],["o","O"],["p","P"],["@","`"],["[","{"]],
    [["a","A"],["s","S"],["d","D"],["f","F"],["g","G"],["h","H"],["j","J"],["k","K"],["l","L"],[";","+"],[":","*"],["]","}"]],
    [["z","Z"],["x","X"],["c","C"],["v","V"],["b","B"],["n","N"],["m","M"],[",","<"],[".",">"],["/","?"],["\\","_"]],
  ],
  us: [
    [["1","!"],["2","@"],["3","#"],["4","$"],["5","%"],["6","^"],["7","&"],["8","*"],["9","("],["0",")"],["-","_"],["=","+"]],
    [["q","Q"],["w","W"],["e","E"],["r","R"],["t","T"],["y","Y"],["u","U"],["i","I"],["o","O"],["p","P"],["[","{"],["]","}"],["\\","|"]],
    [["a","A"],["s","S"],["d","D"],["f","F"],["g","G"],["h","H"],["j","J"],["k","K"],["l","L"],[";",":"],["'","\""]],
    [["z","Z"],["x","X"],["c","C"],["v","V"],["b","B"],["n","N"],["m","M"],[",","<"],[".",">"],["/","?"]],
  ],
};
// 行ごとの左の余白（キー何個分か）
const INDENT = [0, 0.5, 0.75, 1.25];
const FINGER_NAMES = ["左手の小指", "左手の薬指", "左手の中指", "左手の人さし指", "右手の人さし指", "右手の中指", "右手の薬指", "右手の小指", "親指"];

/** 列の番号 → 指の番号（0〜7） */
function fingerOfCol(c) {
  if (c <= 0) return 0;
  if (c === 1) return 1;
  if (c === 2) return 2;
  if (c <= 4) return 3;
  if (c <= 6) return 4;
  if (c === 7) return 5;
  if (c === 8) return 6;
  return 7;
}

/** 文字 → { row, col, shift, finger }。見つからなければ null */
function charInfo(ch, layout) {
  if (ch === " ") return { space: true, finger: 8, shift: false };
  const rows = LAYOUTS[layout] || LAYOUTS.jis;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const [base, sh] = rows[r][c];
      if (ch === base) return { row: r, col: c, shift: false, finger: fingerOfCol(c) };
      if (ch === sh) return { row: r, col: c, shift: true, finger: fingerOfCol(c) };
    }
  }
  return null;
}

function create(container, opts) {
  opts = opts || {};
  let layout = opts.layout || "jis";
  let keyEls = {};       // "r-c" → 要素
  let spaceEl, shiftL, shiftR, fingerLabel;
  let lit = [];

  const root = document.createElement("div");
  root.className = "kb" + (opts.heat ? " kb-heat" : "");
  container.appendChild(root);

  function build() {
    root.replaceChildren();
    keyEls = {};
    const rows = LAYOUTS[layout];
    rows.forEach((row, r) => {
      const rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      if (r === 3) {
        shiftL = keyDiv("Shift", "kb-mod kb-shift f0");
        rowEl.appendChild(shiftL);
      } else {
        const pad = document.createElement("span");
        pad.className = "kb-pad";
        pad.style.flexGrow = INDENT[r];
        rowEl.appendChild(pad);
      }
      row.forEach(([base, sh], c) => {
        const letter = /^[a-z]$/.test(base);
        const el = keyDiv(letter ? base.toUpperCase() : base, `kb-key f${fingerOfCol(c)}` + (base === "f" || base === "j" ? " kb-home" : ""), letter ? "" : sh);
        el.dataset.k = base;
        keyEls[`${r}-${c}`] = el;
        rowEl.appendChild(el);
      });
      if (r === 3) {
        shiftR = keyDiv("Shift", "kb-mod kb-shift f7");
        shiftL.style.flexGrow = INDENT[3];
        shiftR.style.flexGrow = 13.5 - INDENT[3] - row.length;
        rowEl.appendChild(shiftR);
      } else {
        const pad = document.createElement("span");
        pad.className = "kb-pad";
        pad.style.flexGrow = Math.max(0.2, 13.5 - INDENT[r] - row.length);
        rowEl.appendChild(pad);
      }
      root.appendChild(rowEl);
    });
    const sp = document.createElement("div");
    sp.className = "kb-row";
    sp.innerHTML = '<span class="kb-pad" style="flex-grow:3.5"></span>';
    spaceEl = keyDiv("", "kb-key kb-space f8");
    spaceEl.dataset.k = "space";
    sp.appendChild(spaceEl);
    sp.insertAdjacentHTML("beforeend", '<span class="kb-pad" style="flex-grow:3.5"></span>');
    root.appendChild(sp);
    if (!opts.heat) {
      fingerLabel = document.createElement("div");
      fingerLabel.className = "kb-finger";
      root.appendChild(fingerLabel);
    }
  }

  function keyDiv(label, cls, sub) {
    const d = document.createElement("div");
    d.className = cls;
    d.innerHTML = (sub ? `<small>${esc(sub)}</small>` : "") + `<span>${esc(label)}</span>`;
    return d;
  }

  function elFor(ch) {
    const info = charInfo(ch, layout);
    if (!info) return { info: null, el: null };
    if (info.space) return { info, el: spaceEl };
    return { info, el: keyEls[`${info.row}-${info.col}`] };
  }

  function highlight(ch) {
    for (const e of lit) e.classList.remove("next");
    lit = [];
    const { info, el } = elFor(ch);
    if (!el) { if (fingerLabel) fingerLabel.textContent = ""; return; }
    el.classList.add("next");
    lit.push(el);
    if (info.shift) {
      // Shift は、打つキーと反対の手で押す
      const s = info.finger <= 3 ? shiftR : shiftL;
      s.classList.add("next");
      lit.push(s);
    }
    if (fingerLabel) {
      fingerLabel.innerHTML = `<i class="dot f${info.finger}"></i>${FINGER_NAMES[info.finger]}` + (info.shift ? `<span class="kb-plus">＋ ${info.finger <= 3 ? "右" : "左"}手の小指で Shift</span>` : "");
    }
  }

  function flash(ch, ok) {
    const { el } = elFor(ch === "space" ? " " : ch);
    if (!el) return;
    const cls = ok ? "hit" : "bad";
    el.classList.remove("hit", "bad");
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 220);
  }

  /** rates: { "a": 0.1, "space": 0.02 } 0〜1 */
  function heat(rates, counts) {
    const all = Object.values(keyEls).concat([spaceEl]);
    for (const el of all) {
      const k = el.dataset.k;
      const rate = rates[k];
      el.style.removeProperty("--heat");
      el.removeAttribute("title");
      el.classList.toggle("nodata", rate == null);
      if (rate != null) {
        el.style.setProperty("--heat", Math.min(1, rate / 0.15).toFixed(3)); // 15% で真っ赤
        el.title = `${k === "space" ? "スペース" : k.toUpperCase()}：ミス ${Math.round(rate * 1000) / 10}%（${counts[k]}回）`;
      }
    }
  }

  build();
  return {
    el: root,
    highlight, flash, heat,
    setLayout(l) { if (l !== layout && LAYOUTS[l]) { layout = l; build(); } },
    get layout() { return layout; },
  };
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

global.CT = Object.assign(global.CT || {}, { Keyboard: { create, charInfo, FINGER_NAMES } });
})(window);

/*!
 * audio.js — 効果音と BGM（Web Audio API でその場で作る。音源ファイルは使わない）
 *
 *   Sound.unlock()            最初のクリックやキー入力のときに呼ぶ（ブラウザの決まりで、それまで音は出せない）
 *   Sound.se("key")           効果音：key / miss / word / apple / combo / count / go / finish / result / record / click / hover / tick
 *   Sound.bgm("title")        BGM：title / play / null（止める）
 *   Sound.setVolume(bgm, se)  0〜1
 *   Sound.setMuted(true)
 */
(function (global) {
"use strict";

let ctx = null, master, comp, bgmBus, seBus, noiseBuf;
let vol = { bgm: 0.5, se: 0.8 }, muted = false;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function init() {
  if (ctx) return true;
  const AC = global.AudioContext || global.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
  master = ctx.createGain();
  master.connect(comp); comp.connect(ctx.destination);
  bgmBus = ctx.createGain(); bgmBus.connect(master);
  seBus = ctx.createGain(); seBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolume();
  return true;
}

function applyVolume() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.03);
  bgmBus.gain.setTargetAtTime(vol.bgm * 0.55, t, 0.05);
  seBus.gain.setTargetAtTime(vol.se, t, 0.02);
}

function unlock() {
  if (!init()) return;
  if (ctx.state === "suspended") ctx.resume();
  if (pendingSong !== undefined) { const s = pendingSong; pendingSong = undefined; bgm(s); }
}

// ---- 音の部品 ----
/** 音程のある音（エンベロープつき） */
function tone(dest, { type = "sine", freq, t, dur = 0.2, gain = 0.2, attack = 0.005, slideTo, filter, detune = 0 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type || "lowpass"; f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7;
    o.connect(f); node = f;
  }
  node.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

/** ノイズ（打楽器・クリック音） */
function noise(dest, { t, dur = 0.05, gain = 0.2, type = "highpass", freq = 6000, q = 0.7 }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

/** ベルのような音（倍音を少し足す） */
function bell(dest, freq, t, dur, gain) {
  tone(dest, { type: "sine", freq, t, dur, gain });
  tone(dest, { type: "sine", freq: freq * 2, t, dur: dur * 0.5, gain: gain * 0.25 });
  tone(dest, { type: "triangle", freq: freq * 3.01, t, dur: dur * 0.25, gain: gain * 0.08 });
}

// ---- 効果音 ----
const SE = {
  key(t) {
    const f = 1700 + Math.random() * 260;
    tone(seBus, { type: "triangle", freq: f, t, dur: 0.045, gain: 0.07, slideTo: f * 0.7 });
    noise(seBus, { t, dur: 0.018, gain: 0.05, freq: 7000 });
  },
  miss(t) {
    tone(seBus, { type: "square", freq: 190, t, dur: 0.16, gain: 0.07, slideTo: 120, filter: { freq: 900 } });
    tone(seBus, { type: "sine", freq: 95, t, dur: 0.18, gain: 0.12 });
  },
  word(t) {
    bell(seBus, mtof(88), t, 0.35, 0.09);
    bell(seBus, mtof(95), t + 0.07, 0.5, 0.08);
  },
  apple(t) {
    [84, 88, 91, 96].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.045, 0.3, 0.06));
  },
  combo(t) {
    [79, 83, 86, 91, 95].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.05, 0.45, 0.07));
    noise(seBus, { t, dur: 0.4, gain: 0.03, type: "bandpass", freq: 9000, q: 1.5 });
  },
  count(t) { bell(seBus, mtof(81), t, 0.3, 0.12); },
  go(t) {
    [72, 76, 79, 84].forEach((m) => bell(seBus, mtof(m + 12), t, 0.7, 0.07));
  },
  tick(t) {
    tone(seBus, { type: "sine", freq: 1050, t, dur: 0.08, gain: 0.1 });
    noise(seBus, { t, dur: 0.03, gain: 0.05, type: "bandpass", freq: 2500, q: 3 });
  },
  finish(t) {
    [84, 79, 76, 72].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.06, 0.5, 0.08));
  },
  result(t) {
    [72, 76, 79, 84, 88].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.09, 0.8, 0.07));
  },
  record(t) {
    const seq = [72, 76, 79, 84, 79, 84, 88, 91, 96];
    seq.forEach((m, i) => bell(seBus, mtof(m), t + i * 0.08, 0.9, 0.07));
    noise(seBus, { t: t + 0.4, dur: 1.2, gain: 0.03, type: "bandpass", freq: 8000, q: 1 });
  },
  // りんごキャノン
  shoot(t) {
    noise(seBus, { t, dur: 0.18, gain: 0.08, type: "bandpass", freq: 1800, q: 0.8 });
    tone(seBus, { type: "triangle", freq: 520, t, dur: 0.16, gain: 0.08, slideTo: 1400 });
  },
  pop(t) {
    tone(seBus, { type: "sine", freq: 300, t, dur: 0.2, gain: 0.2, slideTo: 70 });
    noise(seBus, { t, dur: 0.22, gain: 0.12, type: "lowpass", freq: 2400 });
    bell(seBus, mtof(91), t + 0.03, 0.3, 0.05);
  },
  lose(t) {
    tone(seBus, { type: "sawtooth", freq: 260, t, dur: 0.45, gain: 0.06, slideTo: 90, filter: { freq: 1200 } });
    tone(seBus, { type: "sine", freq: 130, t, dur: 0.4, gain: 0.15, slideTo: 60 });
  },
  wave(t) {
    [72, 79, 84, 88, 91].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.06, 0.6, 0.07));
    tone(seBus, { type: "sine", freq: 110, t, dur: 0.5, gain: 0.15, slideTo: 220 });
  },
  star(t) {
    bell(seBus, mtof(88), t, 0.6, 0.1);
    bell(seBus, mtof(95), t + 0.05, 0.7, 0.07);
    noise(seBus, { t, dur: 0.3, gain: 0.03, type: "bandpass", freq: 9000, q: 2 });
  },
  badge(t) {
    [84, 88, 91, 96, 100].forEach((m, i) => bell(seBus, mtof(m), t + i * 0.07, 0.7, 0.06));
  },
  click(t) { tone(seBus, { type: "sine", freq: 880, t, dur: 0.08, gain: 0.08, slideTo: 1320 }); },
  hover(t) { tone(seBus, { type: "sine", freq: 1320, t, dur: 0.04, gain: 0.025 }); },
};

function se(name) {
  if (!ctx || muted || ctx.state !== "running" || !SE[name]) return;
  SE[name](ctx.currentTime + 0.001);
}

// ---- BGM ----
// 和音は MIDI の音番号。1小節に1つ。
const SONGS = {
  // メニュー：ゆったり、やわらかい
  title: {
    bpm: 84, swing: 0.12,
    bars: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59],
           [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 62], [55, 59, 62, 65]],
    drums: "soft", arp: "slow", melody: 0.35, seed: 7,
  },
  // プレイ中：明るく前向き、でも打つ邪魔にならない
  play: {
    bpm: 112, swing: 0,
    bars: [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67],
           [53, 57, 60, 64], [55, 59, 62, 65], [48, 52, 55, 60], [48, 52, 55, 59]],
    drums: "beat", arp: "fast", melody: 0.55, seed: 21,
  },
  // りんごキャノン：少し緊張感のある曲
  battle: {
    bpm: 128, swing: 0,
    bars: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65],
           [57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 62]],
    drums: "beat", arp: "fast", melody: 0.6, seed: 33,
  },
};

let current = null;       // { name, song, gain, step, nextTime, timer }
let pendingSong;          // 音が出せるようになる前に頼まれた曲
let hurry = false;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** 8小節ぶんのメロディを作る（毎回同じになるよう、種を固定） */
function makeMelody(song) {
  const r = rng(song.seed);
  const rhythms = [
    [1,0,0,0, 1,0,1,0, 0,0,1,0, 0,0,0,0],
    [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,0,0,0],
    [0,0,1,0, 1,0,0,0, 1,0,1,0, 1,0,0,0],
    [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,1,0],
  ];
  const scale = [0, 2, 4, 7, 9]; // ペンタトニック（C）
  return song.bars.map((chord, bar) => {
    const rh = rhythms[Math.floor(r() * rhythms.length)];
    const notes = [];
    let last = 76;
    for (let i = 0; i < 16; i++) {
      if (!rh[i] || r() > song.melody + 0.35) { notes.push(0); continue; }
      // 拍の頭は和音の音、それ以外は音階から近い音
      let n;
      if (i % 4 === 0) {
        const c = chord[Math.floor(r() * chord.length)] % 12;
        n = 72 + c; if (n < 74) n += 12;
      } else {
        const step = scale[Math.floor(r() * scale.length)];
        n = 72 + step + (r() < 0.4 ? 12 : 0);
      }
      while (Math.abs(n - last) > 7) n += n > last ? -12 : 12;
      last = n;
      notes.push(n);
    }
    if (bar % 4 === 3) { notes.fill(0, 10); notes[8] = notes[8] || 72 + (chord[0] % 12); }
    return notes;
  });
}

function scheduleStep(cur, step, t) {
  const s = cur.song;
  const g = cur.gain;
  const spb = 60 / s.bpm;             // 1拍の長さ
  const st = spb / 4;                 // 16分音符の長さ
  const bar = Math.floor(step / 16) % s.bars.length;
  const i = step % 16;
  const chord = s.bars[bar];

  // パッド（小節の頭で和音を長くのばす）
  if (i === 0) {
    for (const m of chord) {
      tone(g, { type: "sawtooth", freq: mtof(m), t, dur: spb * 4.1, gain: 0.012, attack: 0.35, filter: { freq: 1100 }, detune: -7 });
      tone(g, { type: "triangle", freq: mtof(m), t, dur: spb * 4.1, gain: 0.02, attack: 0.3, detune: 6 });
    }
  }
  // ベース
  const root = chord[0] - 12;
  const bassHit = s.drums === "beat" ? [0, 6, 8, 14].includes(i) : [0, 8].includes(i);
  if (bassHit) {
    const n = i === 14 ? root + 7 : root;
    tone(g, { type: "triangle", freq: mtof(n), t, dur: st * (i === 0 || i === 8 ? 3.5 : 1.8), gain: 0.16, filter: { freq: 600 } });
    tone(g, { type: "sine", freq: mtof(n - 12), t, dur: st * 3, gain: 0.12 });
  }
  // アルペジオ（ころころした音）
  const arpEvery = s.arp === "fast" ? 2 : 4;
  if (i % arpEvery === 0) {
    const idx = (i / arpEvery) % chord.length;
    const up = Math.floor(i / (arpEvery * chord.length)) % 2;
    const m = chord[up ? chord.length - 1 - idx : idx] + 12;
    tone(g, { type: "sine", freq: mtof(m), t, dur: st * 3, gain: 0.05 });
    tone(g, { type: "triangle", freq: mtof(m + 12), t, dur: st * 1.2, gain: 0.012 });
  }
  // メロディ（ベルの音）
  const mel = cur.melody[bar][i];
  if (mel) bell(g, mtof(mel), t, st * 5, 0.045);

  // ドラム
  if (s.drums === "beat") {
    if (i % 4 === 0) { // キック
      tone(g, { type: "sine", freq: 130, t, dur: 0.22, gain: 0.28, slideTo: 42 });
    }
    if (i === 4 || i === 12) { // クラップ
      noise(g, { t, dur: 0.12, gain: 0.09, type: "bandpass", freq: 1500, q: 1.2 });
      noise(g, { t: t + 0.012, dur: 0.1, gain: 0.06, type: "bandpass", freq: 1800, q: 1.2 });
    }
    if (i % 2 === 0 || hurry) { // ハイハット
      noise(g, { t, dur: i % 4 === 2 ? 0.05 : 0.025, gain: i % 4 === 2 ? 0.05 : 0.03, freq: 8000 });
    }
  } else if (s.drums === "soft") {
    if (i === 0 || i === 10) tone(g, { type: "sine", freq: 90, t, dur: 0.25, gain: 0.12, slideTo: 45 });
    if (i === 4 || i === 12) noise(g, { t, dur: 0.15, gain: 0.025, type: "bandpass", freq: 2200, q: 0.8 });
    if (i % 2 === 0) noise(g, { t, dur: 0.03, gain: 0.015, freq: 9000 });
  }
}

function startSong(name) {
  const song = SONGS[name];
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
  gain.connect(bgmBus);
  const cur = { name, song, gain, step: 0, nextTime: ctx.currentTime + 0.1, melody: makeMelody(song) };
  const spb = 60 / song.bpm;
  cur.timer = setInterval(() => {
    // タブが裏に回って遅れたときは、たまった音を一度に鳴らさず、今から再開する
    if (cur.nextTime < ctx.currentTime - 0.1) {
      const skip = Math.ceil((ctx.currentTime - cur.nextTime) / (spb / 4));
      cur.step += skip;
      cur.nextTime += skip * (spb / 4);
    }
    while (cur.nextTime < ctx.currentTime + 0.15) {
      const swing = cur.step % 2 === 1 ? song.swing * spb / 4 : 0;
      scheduleStep(cur, cur.step, cur.nextTime + swing);
      cur.step++;
      cur.nextTime += spb / 4;
    }
  }, 30);
  return cur;
}

function stopSong(cur, fade) {
  clearInterval(cur.timer);
  const t = ctx.currentTime;
  cur.gain.gain.cancelScheduledValues(t);
  cur.gain.gain.setValueAtTime(Math.max(cur.gain.gain.value, 0.0001), t);
  cur.gain.gain.exponentialRampToValueAtTime(0.0001, t + (fade || 0.6));
  setTimeout(() => cur.gain.disconnect(), ((fade || 0.6) + 0.5) * 1000);
}

function bgm(name) {
  if (!ctx || ctx.state !== "running") { pendingSong = name; return; }
  if (current && current.name === name) return;
  if (current) { stopSong(current); current = null; }
  hurry = false;
  if (name && SONGS[name]) current = startSong(name);
}

global.Sound = {
  unlock,
  se,
  bgm,
  setHurry(v) { hurry = !!v; },
  setVolume(b, s) { vol.bgm = b; vol.se = s; applyVolume(); },
  setMuted(m) { muted = !!m; applyVolume(); },
  get muted() { return muted; },
};
})(window);

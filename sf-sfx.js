/* 音效：全部用 WebAudio 现场合成，不需要任何音频文件。
 * 这里同时是整个插件的“音频管理”：
 *  - 音频系统被 iPhone 暂停/打断后，会自动唤醒；唤不醒就丢掉重新建一个（设置页里也有手动“重置音频”）。
 *  - 声音分三条轨：sfx（烟花等）、bgm（打年兽的背景鼓点）、hit（命中音，比背景高约 2~3dB，命中时会短暂压低背景）。
 *  - 打年兽用的乐器全部是民乐打击乐的合成音，音高统一在五声音阶 D E F♯ A B 里。 */
(function (SF) {
  "use strict";
  var ctx = null, master = null, sfxBus = null, bgmBus = null, hitBus = null, noiseBuf = null;
  var active = 0, epoch = 0, tried = 0, tryAt = 0;
  var DEF = { bgm: 0.55, hit: 0.75 };
  var vol = loadVol();
  // 五声音阶（D 宫）：D E F# A B
  var F = { D2: 73.4, D3: 146.8, E3: 164.8, Fs3: 185, A3: 220, B3: 246.9, D4: 293.7, E4: 329.6, Fs4: 370, A4: 440, B4: 493.9, D5: 587.3, E5: 659.3, Fs5: 740, A5: 880, B5: 987.8, D6: 1174.7 };

  function loadVol() {
    try { var v = JSON.parse(localStorage.getItem("sf_vol")); if (v && typeof v.bgm === "number" && typeof v.hit === "number") return v; } catch (e) {}
    return { bgm: DEF.bgm, hit: DEF.hit };
  }
  function saveVol() { try { localStorage.setItem("sf_vol", JSON.stringify(vol)); } catch (e) {} }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // 新建一个音频系统（旧的丢掉）
  function make() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    if (ctx) { try { ctx.close(); } catch (e) {} }
    ctx = new AC(); epoch++; active = 0; tried = 0;
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -8; lim.knee.value = 8; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.12;
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(lim); lim.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.625; sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = vol.bgm; bgmBus.connect(master);
    hitBus = ctx.createGain(); hitBus.gain.value = vol.hit; hitBus.connect(master);
    var n = ctx.sampleRate, d; noiseBuf = ctx.createBuffer(1, n, n); d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function tryResume() { try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
  function getCtx() {
    if (!ctx) make();
    if (!ctx) return null;
    if (ctx.state !== "running") tryResume();
    return ctx;
  }
  // 在用户点击里调用：第一次尝试唤醒；上次唤醒没成功，这次直接换一个新的
  function unlock() {
    if (!ctx) make(); if (!ctx) return;
    if (ctx.state === "running") { tried = 0; return; }
    if (tried >= 1 && performance.now() - tryAt > 300) make();
    tried++; tryAt = performance.now(); tryResume();
  }
  // 音频系统没在运行时不排声音（否则恢复后会一股脑同时响出来）
  function rdy2() { return SF.sfx.enabled() && !!getCtx() && ctx.state === "running"; }
  function ready() { return rdy2() && active < 40; }
  function track(node) { active++; node.onended = function () { active = Math.max(0, active - 1); }; }

  function tone(f, t, dur, type, vol0, f2, free, dst) {
    var o = ctx.createOscillator(), g = ctx.createGain(), atk = dst ? 0.004 : 0.012;
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol0, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dst || sfxBus); o.start(t); o.stop(t + dur + 0.03);
    if (!free) track(o);
  }
  function noise(t, dur, type, f1, f2, vol0, dst) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f1, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(vol0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dst || sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    track(s);
  }
  // 噼里啪啦：一条噪声 + 随机脉冲
  function crackle(t, dur, n, vol0) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    var ts = []; for (var i = 0; i < n; i++) ts.push(t + Math.random() * dur);
    ts.sort(function (a, b) { return a - b; });
    ts.forEach(function (tt) { g.gain.setValueAtTime(vol0 * (0.4 + Math.random() * 0.6), tt); g.gain.setValueAtTime(0, tt + 0.016); });
    s.connect(hp); hp.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.1);
    track(s);
  }
  function boom(t, k) { tone(150, t, 0.55, "sine", 0.5 * k, 38); noise(t, 0.5, "lowpass", 1000, 120, 0.55 * k); }
  function pop(t) { noise(t, 0.14, "bandpass", 1500, 300, 0.6); tone(240, t, 0.16, "sine", 0.3, 90); }
  function sparkle(t) {
    for (var i = 0; i < 7; i++) tone(1800 + Math.random() * 2600, t + Math.random() * 0.55, 0.16, "sine", 0.06, 0, true);
  }

  function launch() {
    if (!ready()) return;
    var t = ctx.currentTime, k = Math.floor(Math.random() * 4);
    if (k === 0) tone(480, t, 0.55, "sine", 0.1, 1900);
    else if (k === 1) { tone(600, t, 0.25, "sine", 0.09, 1300); tone(900, t + 0.27, 0.28, "sine", 0.09, 2200); }
    else if (k === 2) noise(t, 0.55, "bandpass", 500, 3200, 0.28);
    else { noise(t, 0.6, "lowpass", 300, 1800, 0.4); tone(260, t, 0.55, "triangle", 0.08, 900); }
  }
  function burst() {
    if (!ready()) return;
    var t = ctx.currentTime, k = Math.floor(Math.random() * 5);
    if (k === 0) boom(t, 1);
    else if (k === 1) { crackle(t, 0.8, 18, 0.28); tone(1800, t, 0.12, "square", 0.03, 600); }
    else if (k === 2) sparkle(t);
    else if (k === 3) pop(t);
    else { boom(t, 0.8); crackle(t + 0.05, 0.9, 14, 0.22); }
  }
  function notes(list, gap, vol0, dur, dst) {
    var t = ctx.currentTime;
    list.forEach(function (f, i) { tone(f, t + i * gap, dur || 0.5, "sine", vol0, 0, false, dst); });
  }

  // ---------- 民乐打击乐（合成）----------
  function dagu(w, v, dst) { tone(130, w, 0.28, "sine", 0.6 * v, 73.4, false, dst); noise(w, 0.06, "lowpass", 500, 150, 0.18 * v, dst); }
  function tangu(f, w, v, dst) { tone(f * 1.35, w, 0.22, "sine", 0.42 * v, f, false, dst); noise(w, 0.05, "lowpass", 1400, 500, 0.1 * v, dst); }
  function bangzi(w, v, dst) { noise(w, 0.035, "bandpass", 3000, 2000, 0.28 * v, dst); tone(1900, w, 0.045, "triangle", 0.1 * v, 1500, false, dst); }
  function xiaocha(w, acc, dst) { noise(w, 0.05, "highpass", 8000, 0, acc ? 0.1 : 0.05, dst); }
  function dacha(w, v, dst) { noise(w, 0.25, "highpass", 5500, 0, 0.3 * v, dst); }
  function daluo(w, v, dst) {
    tone(F.D3, w, 1.8, "sine", 0.2 * v, 0, false, dst); tone(F.A3, w, 1.4, "sine", 0.1 * v, 0, false, dst); tone(F.D4, w, 1.1, "sine", 0.07 * v, 0, false, dst);
    noise(w, 0.35, "bandpass", 900, 300, 0.09 * v, dst);
  }
  function yunluo(f, w, v, dst) { tone(f, w, 0.4, "sine", 0.16 * v, 0, false, dst); tone(f * 2.76, w, 0.18, "sine", 0.05 * v, 0, false, dst); noise(w, 0.02, "highpass", 7000, 0, 0.06 * v, dst); }
  function xiaoluo(w, v, dst) { tone(F.D6, w, 0.22, "sine", 0.26 * v, 0, false, dst); tone(F.D6 * 2.38, w, 0.12, "sine", 0.1 * v, 0, false, dst); noise(w, 0.03, "highpass", 8000, 0, 0.14 * v, dst); }

  // 命中瞬间把背景轨压低 db 分贝：约 10ms 压下去，约 200ms 回来
  function duck(db) {
    if (!ctx || !bgmBus) return;
    var t = ctx.currentTime, base = vol.bgm, lo = base * Math.pow(10, -db / 20), g = bgmBus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.setTargetAtTime(lo, t, 0.004); g.setTargetAtTime(base, t + 0.05, 0.07);
  }
  function applyVol() {
    if (!ctx) return; var t = ctx.currentTime;
    bgmBus.gain.cancelScheduledValues(t); bgmBus.gain.setValueAtTime(vol.bgm, t); hitBus.gain.setValueAtTime(vol.hit, t);
  }

  SF.sfx = {
    enabled: function () { try { return localStorage.getItem("sf_sfx") !== "0"; } catch (e) { return true; } },
    set: function (on) { try { localStorage.setItem("sf_sfx", on ? "1" : "0"); } catch (e) {} },
    unlock: unlock,
    // ---- 音频状态（设置页用）----
    state: function () { return ctx ? ctx.state : "none"; },
    epoch: function () { return epoch; },
    reset: function () { make(); if (ctx) tryResume(); return ctx ? ctx.state : "none"; },
    test: function () {
      if (!ready()) return false;
      yunluo(F.D6, ctx.currentTime, 1, hitBus); setTimeout(function () { SF.sfx.hitg(); }, 260); return true;
    },
    getVol: function () { return { bgm: vol.bgm, hit: vol.hit }; },
    setVol: function (kind, v) { vol[kind] = clamp(v, 0, 1); saveVol(); applyVol(); },
    resetVol: function () { vol = { bgm: DEF.bgm, hit: DEF.hit }; saveVol(); applyVol(); },
    // 试听：约 9 秒的背景鼓点 + 几下命中音，拖音量滑块时用来听比例
    preview: function () {
      if (!ready()) return false;
      var base = ctx.currentTime + 0.15, step = 60 / 108 / 4, S = SF.sfx.sched;
      for (var s = 0; s < 64; s++) {
        var w = base + s * step, st = s % 16;
        if (s === 0) S.gong(w);
        if (st === 0 || st === 8) S.kick(w, 0.8);
        if (st === 4 || st === 12) S.snare(true, w);
        if (st % 2 === 0) S.hat(st % 4 === 2, w);
      }
      var hits = []; for (var b = 1; b < 4; b++) [0, 4, 8, 12].forEach(function (st) { hits.push(b * 16 + st); });
      hits.forEach(function (s, i) {
        var kind = i === hits.length - 1 ? "bigb" : i % 2 ? "hito" : "hitg";
        setTimeout(function () { SF.sfx[kind](); }, (0.15 + s * step) * 1000);
      });
      return true;
    },
    // ---- 一般音效 ----
    launch: launch,
    burst: burst,
    text: function () { if (ready()) notes([523, 659, 784, 988, 1175], 0.09, 0.12, 0.55); },
    packet: function () {
      if (!ready()) return; var t = ctx.currentTime;
      tone(1760, t, 0.5, "sine", 0.18); tone(2349, t + 0.07, 0.6, "sine", 0.14); noise(t, 0.25, "highpass", 6000, 0, 0.08);
    },
    flip: function () {
      if (!ready()) return; var t = ctx.currentTime;
      tone(380, t, 0.16, "triangle", 0.14, 900); tone(1175, t + 0.13, 0.45, "sine", 0.14); tone(1568, t + 0.2, 0.5, "sine", 0.1);
    },
    snip: function () {
      if (!ready()) return; var t = ctx.currentTime;
      noise(t, 0.05, "bandpass", 4500, 2500, 0.3); tone(1900, t, 0.05, "triangle", 0.07, 1000);
    },
    shh: function () { if (ready()) noise(ctx.currentTime, 0.07, "highpass", 3500, 6500, 0.05); },
    save: function () { if (ready()) notes([659, 880, 1175], 0.1, 0.13, 0.5); },
    tap: function () { if (ready()) tone(700, ctx.currentTime, 0.07, "sine", 0.07, 520); },
    // ---- 打年兽用 ----
    hush: function () {
      if (!ctx || !master) return; var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.04); master.gain.setValueAtTime(0.8, t + 0.35);
    },
    now: function () { if (!ctx) make(); return ctx && ctx.state === "running" ? ctx.currentTime : null; },
    raw: function () { return ctx ? ctx.currentTime : 0; },
    suspend: function () { if (ctx && ctx.state === "running") { try { ctx.suspend(); } catch (e) {} } },
    resume: function () { if (ctx && ctx.state !== "running") tryResume(); },
    latency: function () { return ctx ? ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000 : 0; },
    // 背景轨（按声卡时间提前排好）。音高全部取自五声音阶
    sched: {
      kick: function (w, v) { if (rdy2()) dagu(w, v == null ? 1 : v, bgmBus); },
      snare: function (soft, w) { if (!rdy2()) return; var k = soft ? 0.45 : 1; tangu(F.A3, w, 0.8 * k, bgmBus); bangzi(w, k, bgmBus); },
      hat: function (acc, w) { if (rdy2()) xiaocha(w, acc, bgmBus); },
      tom: function (f, w, v) { if (rdy2()) tangu(f, w, v == null ? 1 : v, bgmBus); },
      chime: function (w) { if (!rdy2()) return; yunluo(F.A5, w, 0.9, bgmBus); yunluo(F.D6, w + 0.06, 0.8, bgmBus); },
      cow: function (w) { if (rdy2()) bangzi(w, 0.4, bgmBus); },
      gong: function (w) { if (rdy2()) daluo(w, 1, bgmBus); },
      click: function (w) { if (rdy2()) bangzi(w, 1.3, hitBus); }
    },
    // 命中音（命中轨，音量比背景高；命中瞬间压低背景）
    hitg: function () { if (!ready()) return; var t = ctx.currentTime; xiaoluo(t, 1, hitBus); xiaocha(t, true, hitBus); duck(4); },
    hito: function () { if (!ready()) return; var t = ctx.currentTime; bangzi(t, 1, hitBus); tangu(F.E4, t, 0.9, hitBus); duck(3); },
    bigb: function () { if (!ready()) return; var t = ctx.currentTime; dagu(t, 1.1, hitBus); dacha(t, 0.9, hitBus); duck(8); },
    bag: function () { if (!ready()) return; var t = ctx.currentTime; yunluo(F.A5, t, 1, hitBus); yunluo(F.D6, t + 0.07, 1, hitBus); duck(3); },
    miss: function () { if (!ready()) return; var t = ctx.currentTime; tone(110, t, 0.16, "sine", 0.22, 70, false, hitBus); noise(t, 0.1, "lowpass", 300, 120, 0.14, hitBus); },
    thump: function () { if (ready()) tangu(F.D3, ctx.currentTime, 0.5, hitBus); },
    win: function () {
      if (!ready()) return; var t = ctx.currentTime;
      [F.D5, F.E5, F.A5, F.B5, F.D6].forEach(function (f, i) { yunluo(f, t + i * 0.1, 1, hitBus); });
    },
    // 试听：连放 10 次升空+爆炸
    demo: function () {
      for (var i = 0; i < 10; i++) setTimeout(function () { launch(); setTimeout(burst, 550); }, i * 900 + Math.random() * 200);
    }
  };
})(window.__SF);

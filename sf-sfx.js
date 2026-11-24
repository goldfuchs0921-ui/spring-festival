/* 音效：全部用 WebAudio 现场合成，不需要任何音频文件。烟花升空/爆炸每次随机选不同的声音。 */
(function (SF) {
  "use strict";
  var ctx = null, master = null, noiseBuf = null, active = 0;

  function life(d) { active++; setTimeout(function () { active--; }, d * 1000 + 80); }
  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      var n = ctx.sampleRate, d; noiseBuf = ctx.createBuffer(1, n, n); d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function rdy2() { return SF.sfx.enabled() && !!getCtx(); }
  function ready() { return SF.sfx.enabled() && active < 32 && !!getCtx(); }

  function tone(f, t, dur, type, vol, f2, free) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
    if (!free) life(dur);
  }
  function noise(t, dur, type, f1, f2, vol) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f1, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    life(dur);
  }
  // 噼里啪啦：一条噪声 + 随机脉冲
  function crackle(t, dur, n, vol) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    var ts = []; for (var i = 0; i < n; i++) ts.push(t + Math.random() * dur);
    ts.sort(function (a, b) { return a - b; });
    ts.forEach(function (tt) { g.gain.setValueAtTime(vol * (0.4 + Math.random() * 0.6), tt); g.gain.setValueAtTime(0, tt + 0.016); });
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.1);
    life(dur);
  }
  function boom(t, k) { tone(150, t, 0.55, "sine", 0.5 * k, 38); noise(t, 0.5, "lowpass", 1000, 120, 0.55 * k); }
  function pop(t) { noise(t, 0.14, "bandpass", 1500, 300, 0.6); tone(240, t, 0.16, "sine", 0.3, 90); }
  function sparkle(t) {
    for (var i = 0; i < 7; i++) tone(1800 + Math.random() * 2600, t + Math.random() * 0.55, 0.16, "sine", 0.06, 0, true);
    life(0.8);
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
  function notes(list, gap, vol, dur) {
    var t = ctx.currentTime;
    list.forEach(function (f, i) { tone(f, t + i * gap, dur || 0.5, "sine", vol); });
  }

  SF.sfx = {
    enabled: function () { try { return localStorage.getItem("sf_sfx") !== "0"; } catch (e) { return true; } },
    set: function (on) { try { localStorage.setItem("sf_sfx", on ? "1" : "0"); } catch (e) {} },
    unlock: function () { getCtx(); },
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
    // ---- 打年兽用：鼓组（按声卡时钟提前排好，节拍才稳）----
    // 立刻把声音压掉（退出游戏/校准时用），0.35 秒后恢复音量
    hush: function () {
      if (!ctx || !master) return; var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.04); master.gain.setValueAtTime(0.5, t + 0.35);
    },
    now: function () { if (!ctx) getCtx(); return ctx && ctx.state === "running" ? ctx.currentTime : null; },
    raw: function () { return ctx ? ctx.currentTime : 0; },
    suspend: function () { if (ctx && ctx.state === "running") ctx.suspend(); },
    resume: function () { if (ctx && ctx.state === "suspended") ctx.resume(); },
    latency: function () { return ctx ? ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000 : 0; },
    sched: {
      kick: function (w, v) { if (rdy2()) tone(160, w, 0.24, "sine", 0.55 * (v == null ? 1 : v), 42); },
      snare: function (soft, w) { if (!rdy2()) return; var k = soft ? 0.45 : 1; noise(w, 0.14, "bandpass", 2200, 900, 0.35 * k); tone(210, w, 0.1, "triangle", 0.18 * k, 120); },
      hat: function (acc, w) { if (rdy2()) noise(w, 0.045, "highpass", 7500, 0, acc ? 0.1 : 0.05); },
      tom: function (f, w, v) { if (!rdy2()) return; var k = v == null ? 1 : v; tone(f, w, 0.2, "sine", 0.42 * k, f * 0.55); noise(w, 0.05, "bandpass", 1800, 900, 0.12 * k); },
      chime: function (w) { if (!rdy2()) return; tone(1319, w, 0.3, "sine", 0.14); tone(1760, w + 0.05, 0.3, "sine", 0.1); },
      cow: function (w) { if (!rdy2()) return; tone(820, w, 0.09, "square", 0.035); tone(1230, w, 0.07, "square", 0.025); },
      gong: function (w) {
        if (!rdy2()) return;
        tone(147, w, 1.6, "sine", 0.22); tone(221, w, 1.3, "sine", 0.12); tone(311, w, 1.0, "sine", 0.07); noise(w, 0.4, "bandpass", 800, 300, 0.1);
      },
      click: function (w) { if (!rdy2()) return; tone(1400, w, 0.06, "sine", 0.3); noise(w, 0.02, "highpass", 6000, 0, 0.12); }
    },
    thump: function () { if (ready()) tone(200, ctx.currentTime, 0.12, "sine", 0.22, 90); },
    hitg: function () { if (!ready()) return; var t = ctx.currentTime; noise(t, 0.12, "bandpass", 2500, 600, 0.3); tone(880, t, 0.16, "triangle", 0.12, 1400); },
    hito: function () { if (!ready()) return; var t = ctx.currentTime; noise(t, 0.1, "bandpass", 1500, 500, 0.22); tone(520, t, 0.12, "triangle", 0.09, 700); },
    bigb: function () { if (!ready()) return; var t = ctx.currentTime; tone(120, t, 0.5, "sine", 0.5, 35); noise(t, 0.5, "lowpass", 1200, 120, 0.55); crackle(t + 0.03, 0.6, 14, 0.25); },
    miss: function () { if (ready()) tone(220, ctx.currentTime, 0.2, "sawtooth", 0.06, 110); },
    bag: function () { if (ready()) notes([988, 1319], 0.07, 0.12, 0.4); },
    win: function () { if (ready()) notes([523, 659, 784, 1047, 1319], 0.1, 0.14, 0.6); },
    // 试听：连放 10 次升空+爆炸
    demo: function () {
      for (var i = 0; i < 10; i++) setTimeout(function () { launch(); setTimeout(burst, 550); }, i * 900 + Math.random() * 200);
    }
  };
})(window.__SF);

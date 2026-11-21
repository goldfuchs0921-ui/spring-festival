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
  function ready() { return SF.sfx.enabled() && active < 16 && !!getCtx(); }

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
    // 试听：连放 10 次升空+爆炸
    demo: function () {
      for (var i = 0; i < 10; i++) setTimeout(function () { launch(); setTimeout(burst, 550); }, i * 900 + Math.random() * 200);
    }
  };
})(window.__SF);

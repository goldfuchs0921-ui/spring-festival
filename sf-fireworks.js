/* 烟花引擎：点击烟花、文字愿望烟花、零点大烟花（全部代码绘制，没有图片） */
(function (SF) {
  "use strict";
  var cv, ctx, W = 0, H = 0, dpr = 1, parts = [], rockets = [], raf = 0, last = 0, timers = [];
  var COLORS = ["#ffd36b", "#ff5b5b", "#ff8fb1", "#7fe3ff", "#fff1b8", "#ffa94d", "#b9a2ff"];

  function resize() {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

  function burst(x, y, color) {
    var n = 60 + Math.floor(Math.random() * 30), ring = Math.random() < 0.35;
    var c2 = SF.pick(COLORS);
    for (var i = 0; i < n; i++) {
      var a = (Math.PI * 2 * i) / n + Math.random() * 0.1;
      var sp = ring ? 2.6 : 1 + Math.random() * 3.4;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 1.2 + Math.random() * 0.8,
        c: i % 5 === 0 ? c2 : color, s: 1.6 + Math.random() * 1.4, g: 0.035 });
    }
  }

  function launch(x, y) {
    if (!cv) return;
    rockets.push({ x: x, y: H, tx: x, ty: y, c: SF.pick(COLORS), t: 0 });
    start();
  }

  // 把文字采样成点阵，点从爆点飞到字形位置
  function text(str, cx, cy) {
    if (!cv || !str) return;
    str = String(str).slice(0, 16);
    var lines = str.length > 8 ? [str.slice(0, Math.ceil(str.length / 2)), str.slice(Math.ceil(str.length / 2))] : [str];
    var c = document.createElement("canvas"), fs = 64, lh = 76;
    c.width = 640; c.height = lh * lines.length + 20;
    var g = c.getContext("2d");
    g.font = "bold " + fs + 'px "PingFang SC","Noto Sans SC",sans-serif';
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach(function (l, i) { g.fillText(l, 320, 10 + lh * i + lh / 2); });
    var d = g.getImageData(0, 0, c.width, c.height).data, pts = [];
    for (var y = 0; y < c.height; y += 5) for (var x = 0; x < c.width; x += 5) if (d[(y * c.width + x) * 4 + 3] > 128) pts.push([x, y]);
    var maxw = 0; lines.forEach(function (l) { maxw = Math.max(maxw, g.measureText(l).width); });
    var k = Math.min(0.62, (W * 0.82) / Math.max(maxw, 1));
    var ox = cx == null ? W / 2 : cx, oy = cy == null ? H * 0.25 : cy;
    var col = SF.pick(COLORS);
    pts.forEach(function (p) {
      parts.push({ x: ox, y: oy, ox: ox, oy: oy, tx: ox + (p[0] - 320) * k, ty: oy + (p[1] - c.height / 2) * k,
        age: 0, life: 3.6, c: col, s: 1.9, text: true });
    });
    start();
  }

  function loop(t) {
    raf = 0;
    if (!ctx) return;
    var dt = Math.min(0.05, (t - last) / 1000); last = t;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    rockets = rockets.filter(function (r) {
      r.t += dt / 0.55;
      var e = 1 - Math.pow(1 - Math.min(r.t, 1), 2);
      var y = H + (r.ty - H) * e;
      ctx.fillStyle = "#ffe9b0"; ctx.beginPath(); ctx.arc(r.x, y, 2.2, 0, 7); ctx.fill();
      if (r.t >= 1) { burst(r.tx, r.ty, r.c); return false; }
      return true;
    });

    parts = parts.filter(function (p) {
      p.age += dt;
      var a;
      if (p.text) {
        var k = Math.min(p.age / 0.9, 1), e = 1 - Math.pow(1 - k, 3);
        p.x = p.ox + (p.tx - p.ox) * e + (k >= 1 ? Math.sin(p.age * 9 + p.tx) * 0.25 : 0);
        p.y = p.oy + (p.ty - p.oy) * e;
        a = p.age < 2.6 ? 1 : Math.max(0, 1 - (p.age - 2.6));
      } else {
        p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g * 60 * dt;
        p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt;
        a = Math.max(0, 1 - p.age / p.life);
      }
      if (p.age >= p.life) return false;
      ctx.globalAlpha = a; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    if (parts.length || rockets.length) raf = requestAnimationFrame(loop);
  }

  SF.fx = {
    attach: function (canvas) { cv = canvas; ctx = cv.getContext("2d"); resize(); },
    resize: resize,
    launch: launch,
    text: text,
    // 大烟花：ms 毫秒内连续发射，返回停止函数
    finale: function (ms) {
      var end = Date.now() + (ms || 12000);
      var id = setInterval(function () {
        if (Date.now() > end) { clearInterval(id); return; }
        for (var i = 0; i < 2; i++) launch(W * (0.12 + Math.random() * 0.76), H * (0.1 + Math.random() * 0.4));
      }, 380);
      timers.push(id);
      return function () { clearInterval(id); };
    },
    stop: function () { timers.forEach(clearInterval); timers = []; },
    detach: function () {
      SF.fx.stop(); if (raf) cancelAnimationFrame(raf);
      raf = 0; parts = []; rockets = []; cv = null; ctx = null;
    }
  };
})(window.__SF);

/* 打年兽：爆竹从下往上飘，到年兽身上的瞬间点它（或点鼓）。三个回合 + 两次中场演出。
 * 年兽、爆竹、鼓全部用画布现画，音乐用 WebAudio 合成，没有任何图片/音频文件。
 * 想调难度/节奏：改 DIFFS（速度和判定宽度）、R1/R2/R3（每小节哪一拍出爆竹）、LIMIT（每天计入记录的局数）。 */
(function (SF) {
  "use strict";

  var LIMIT = 3;
  var DIFFS = {
    slow: { n: "慢", bpm: 90, fly: 1.7, gw: 100, ow: 180 },
    mid: { n: "中", bpm: 108, fly: 1.5, gw: 90, ow: 160 },
    fast: { n: "快", bpm: 126, fly: 1.3, gw: 75, ow: 140 }
  };
  // 一小节 16 拍(0-15)。数字 = 普通爆竹；[拍,"big"] = 大爆竹（点两下）；[拍,"bag"] = 福袋
  var R1 = [[0, 8], [0, 6, 12], [4, 8], [0, 8, 12], [0, 6], [4, 10], [0, 8], [0, 4, 8, 12]];
  var R2 = [[0, 3, 6, 10], [0, 4, 8, [12, "big"]], [0, 4, 7, 10, 13], [0, 3, 8, 11], [0, 4, 8, 11], [0, 3, 6, [10, "big"]], [0, 3, 7, 10, 13], [0, 6, 9, 12]];
  var R3 = [[0, 3, 6, 9, 12], [0, 4, 7, [10, "bag"], 13], [0, 3, 6, 10, 13], [0, 4, 8, 11], [0, 3, 6, 9, [12, "bag"]], [0, 4, 8, [12, "big"]]];
  var PLAN = [
    { kind: "intro", bars: 1 }, { kind: "round", bars: 8, pat: R1, r: 1 }, { kind: "inter", bars: 3, i: 1 },
    { kind: "round", bars: 8, pat: R2, r: 2 }, { kind: "inter", bars: 3, i: 2 }, { kind: "round", bars: 6, pat: R3, r: 3 }
  ];
  var BANNER = { 1: "第一回合", 2: "第二回合", 3: "最后一回合" };

  // 中场演出：4 套配套组合，年兽的状态和角色的动作是同一场戏
  var SETS = [
    { side: "R", nl: ["呼…呼…不行了…", "等、等一下…", "本座…歇一会儿…"], cl: ["快赢了，再坚持一下！", "年兽喘气了，乘胜追击！", "你可以的，我在旁边看着呢！", "节奏很棒，再来一轮！"], nAt: 0.08, cAt: 0.3 },
    { side: "L", nl: ["哼，本座还能打！", "整理一下鬃毛…帅吗？", "来呀来呀，略略略～"], cl: ["哈哈，这鬼脸也太丑了！", "别被它骗了，它在拖时间！", "我也来一个——略略略！"], nAt: 0.1, cAt: 0.72 },
    { side: "R", nl: ["别打了…下次不敢了…", "求求你…最后一次…", "（偷偷看你）"], cl: ["别心软，再打一轮！", "它偷看你呢，不许放水！", "装可怜没用哦！"], nAt: 0.12, cAt: 0.5 },
    { side: "L", nl: ["……？", "嗯？这是什么…", "（愣住）"], cl: ["给你个好东西～", "来，这个送你！", "接好了哦～"], nAt: 0.85, cAt: 0.1 }
  ];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // ---------- 记录 ----------
  async function load() {
    var s = await SF.st.get("nian", null);
    if (!s) s = { best: {}, recent: [], day: "", today: 0, total: 0, wins: 0, lastDiff: "mid", lastChar: null };
    s.best = s.best || {}; s.recent = s.recent || [];
    var d = SF.today(); if (s.day !== d) { s.day = d; s.today = 0; }
    return s;
  }

  // ---------- 排谱 ----------
  function build(diff) {
    var D = DIFFS[diff], stepMs = 60000 / D.bpm / 4, barMs = stepMs * 16, bar = 0, phases = [], notes = [], id = 0, W = 0, recent = [], accent = {};
    PLAN.forEach(function (p) {
      phases.push({ kind: p.kind, s: bar, e: bar + p.bars, r: p.r || 0, i: p.i || 0 });
      if (p.pat) p.pat.forEach(function (items, bi) {
        items.forEach(function (it) {
          var step = typeof it === "number" ? it : it[0], type = typeof it === "number" ? "n" : it[1];
          // 目标点：年兽肚子椭圆里随机一点，和最近两个错开
          var ex = 0, ey = 0, tries = 0;
          do {
            var a = Math.random() * 6.283, r = Math.sqrt(Math.random());
            ex = Math.cos(a) * r; ey = Math.sin(a) * r; tries++;
          } while (tries < 8 && recent.some(function (q) { return Math.hypot(q[0] - ex, q[1] - ey) < 0.6; }));
          recent.push([ex, ey]); if (recent.length > 2) recent.shift();
          notes.push({ id: id++, t: (bar + bi) * barMs + step * stepMs, type: type, state: 0, ex: ex, ey: ey, sxf: 0.14 + Math.random() * 0.72 });
          accent[(bar + bi) * 16 + step] = type;
          W += type === "big" ? 2 : type === "bag" ? 0 : 1;
        });
      });
      bar += p.bars;
    });
    var last = notes[notes.length - 1];
    return { D: D, stepMs: stepMs, barMs: barMs, phases: phases, notes: notes, W: W, totalBars: bar, totalSteps: bar * 16, accent: accent, lastT: last.t };
  }
  function phaseAt(tl, bar) {
    for (var i = 0; i < tl.phases.length; i++) if (bar >= tl.phases[i].s && bar < tl.phases[i].e) return tl.phases[i];
    return tl.phases[tl.phases.length - 1];
  }

  // ---------- 画年兽 ----------
  function drawNian(g, cx, cy, s, o) {
    var pose = o.pose, tt = o.tt, pl = o.beat, hurt = o.hurt > 0;
    g.save(); g.translate(cx, cy); g.scale(s, s);
    var bob = Math.sin(tt * 6) * 2 - pl * 5, sy = 1, rot = 0, ox = 0;
    if (pose === "pant") { sy = 0.95 + Math.sin(tt * 7) * 0.025; bob += 14; }
    if (hurt) { rot = (o.hv === 1 ? 1 : -1) * 0.1 * o.hurt; ox = -8 * o.hurt * (o.hv === 1 ? -1 : 1); sy = 1 - 0.04 * o.hurt; }
    if (o.shake) ox += (Math.random() - 0.5) * 6;
    g.translate(ox, bob); g.rotate(rot); g.scale(1, sy);

    function hand(x, y) {
      g.fillStyle = "#f2b04a"; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill();
      g.fillStyle = "#fff3d0"; for (var i = -1; i <= 1; i++) { g.beginPath(); g.arc(x + i * 8, y - 14, 3.2, 0, 7); g.fill(); }
    }
    function arm(x0, y0, x1, y1) {
      g.strokeStyle = "#c93a26"; g.lineWidth = 32; g.lineCap = "round";
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 10, x1, y1); g.stroke(); hand(x1, y1);
    }
    // 脚
    g.fillStyle = "#b02a1c"; g.beginPath(); g.ellipse(-42, 122, 26, 15, 0, 0, 7); g.ellipse(42, 122, 26, 15, 0, 0, 7); g.fill();
    // 身体
    var bg = g.createLinearGradient(0, -20, 0, 120); bg.addColorStop(0, "#e5502f"); bg.addColorStop(1, "#a8281c");
    g.fillStyle = bg; g.beginPath(); g.ellipse(0, 40, 70, 82, 0, 0, 7); g.fill();
    g.fillStyle = "#f6cf90"; g.beginPath(); g.ellipse(0, 52, 42, 52, 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(190,110,50,.35)"; g.lineWidth = 3;
    for (var k = 0; k < 3; k++) { g.beginPath(); g.arc(0, 42 + k * 18, 30 - k * 4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }

    // 手臂
    var a = Math.sin(tt * 9) * 4;
    if (hurt) {
      if (o.hv === 2) { arm(-62, 10, -96, -30, 0); arm(62, 10, 96, -30, 0); } else { arm(-62, 10, -102, 34); arm(62, 10, 102, 34); }
    } else if (pose === "pant") { arm(-62, 20, -80, 104); arm(62, 20, 80, 104); }
    else if (pose === "clown1") { arm(-62, 20, -86, 62); arm(62, 12, 50 - Math.sin(tt * 10) * 10, -46 + Math.sin(tt * 10) * 6); }
    else if (pose === "clown2") { arm(-62, 20, -86, 62); arm(62, 8, 70 + Math.sin(tt * 8) * 8, -108); }
    else if (pose === "clown3") { arm(-62, 8, -52, -50); arm(62, 8, 52, -50); }
    else if (pose === "beg") { arm(-62, 10, -9 + Math.sin(tt * 9) * 3, 2); arm(62, 10, 9 - Math.sin(tt * 9) * 3, 2); }
    else if (pose === "play1") { arm(-62, 20, -84, 70); arm(62, 20, 84, 70); }
    else if (pose === "play2") { arm(-62, 20, -84, 70); arm(62, 12, 92, -6); g.font = "30px serif"; g.textAlign = "center"; g.fillText("🧨", 100, -8); }
    else if (pose === "play3") { arm(-62, 10, -98, -44); arm(62, 10, 98, -44); }
    else if (pose === "scared") { arm(-62, 10, -96 + a, -40); arm(62, 10, 96 - a, -40); }
    else { arm(-62, 10, -98 + a, -25); arm(62, 10, 98 - a, -25); }

    // 鬃毛 + 头
    var mr = pose === "play3" ? 30 : pose === "clown2" ? 22 + Math.sin(tt * 10) * 3 : 22;
    g.fillStyle = "#f2a33a";
    for (var i = 0; i < 14; i++) {
      var ang = i / 14 * 6.283 + (pose === "clown2" ? Math.sin(tt * 8 + i) * 0.05 : 0);
      g.beginPath(); g.arc(Math.cos(ang) * 64, -62 + Math.sin(ang) * 64, mr, 0, 7); g.fill();
    }
    g.fillStyle = "#ffd77a";
    g.beginPath(); g.moveTo(-36, -112); g.lineTo(-24, -142); g.lineTo(-12, -112); g.closePath(); g.moveTo(12, -112); g.lineTo(24, -142); g.lineTo(36, -112); g.closePath(); g.fill();
    var hg = g.createLinearGradient(0, -122, 0, 4); hg.addColorStop(0, "#ee5a3a"); hg.addColorStop(1, "#cb3722");
    g.fillStyle = hg; g.beginPath(); g.arc(0, -60, 62, 0, 7); g.fill();
    g.fillStyle = "#c93a26"; g.beginPath(); g.arc(-60, -92, 14, 0, 7); g.arc(60, -92, 14, 0, 7); g.fill();

    // 表情
    var eye = "angry", mouth = "roar";
    if (hurt) { eye = "squint"; mouth = "wry"; }
    else if (pose === "pant") { eye = o.u != null && o.u < 0.4 ? "dizzy" : "half"; mouth = "tongue"; }
    else if (pose === "clown1") { eye = "wink"; mouth = "grin"; }
    else if (pose === "clown2") { eye = "happy"; mouth = "grin"; }
    else if (pose === "clown3" || pose === "taunt") { eye = "cross"; mouth = "tongue"; }
    else if (pose === "beg") { eye = "sparkle"; mouth = "w"; }
    else if (pose === "play1" || pose === "play2" || pose === "scared") { eye = "wide"; mouth = "o"; }
    else if (pose === "play3") { eye = "dizzy"; mouth = "o"; }
    else if (o.blood != null && o.blood <= 0) eye = "dizzy";
    else if (o.blood != null && o.blood <= 25) eye = "half";

    var look = o.look || 0;
    [-1, 1].forEach(function (sd) {
      var ex = sd * 24, ey = -66;
      g.save(); g.translate(ex, ey);
      if (eye === "squint") {
        g.strokeStyle = "#3a0f0a"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(-sd * 10, -8); g.lineTo(sd * 8, 0); g.lineTo(-sd * 10, 8); g.stroke();
      } else if (eye === "happy" || (eye === "wink" && sd === 1)) {
        g.strokeStyle = "#3a0f0a"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.arc(0, 4, 10, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
      } else {
        var rad = eye === "wide" ? 16 : eye === "sparkle" ? 15 : 13;
        g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, rad, 0, 7); g.fill();
        if (eye === "dizzy") {
          g.strokeStyle = "#3a0f0a"; g.lineWidth = 2.2; g.save(); g.rotate(tt * 6 * sd); g.beginPath(); g.arc(0, 0, 9, 0, 5); g.stroke(); g.beginPath(); g.arc(0, 0, 4, 0, 4.5); g.stroke(); g.restore();
        } else {
          var px = look * 3, pr = eye === "wide" ? 3.5 : eye === "sparkle" ? 8 : 6;
          if (eye === "cross") px = -sd * 5;
          g.fillStyle = "#2a0b08"; g.beginPath(); g.arc(px, 0, pr, 0, 7); g.fill();
          if (eye === "sparkle") { g.fillStyle = "#fff"; g.beginPath(); g.arc(px - 3, -3, 2.6, 0, 7); g.arc(px + 3, 3, 1.4, 0, 7); g.fill(); }
        }
        if (eye === "half" || eye === "dizzy" && false) { g.fillStyle = "#d9422a"; g.fillRect(-rad - 1, -rad - 1, rad * 2 + 2, rad + 2); }
        if (eye === "angry") {
          g.strokeStyle = "#5a1810"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(sd * 15, -24); g.lineTo(-sd * 12, -12); g.stroke();
        }
      }
      g.restore();
    });
    // 腮红
    if (eye === "sparkle" || pose === "pant") { g.fillStyle = "rgba(255,150,150,.5)"; g.beginPath(); g.ellipse(-44, -36, 11, 7, 0, 0, 7); g.ellipse(44, -36, 11, 7, 0, 0, 7); g.fill(); }
    // 嘴
    g.save(); g.translate(0, -26);
    if (mouth === "roar") {
      var mh = 16 + pl * 6, lip = -mh * 0.3;
      g.fillStyle = "#3a0f0a"; g.beginPath(); g.ellipse(0, 0, 30, mh, 0, 0, 7); g.fill();
      g.save(); g.beginPath(); g.ellipse(0, 0, 30, mh, 0, 0, 7); g.clip();
      g.fillStyle = "#ff9aa6"; g.beginPath(); g.ellipse(0, mh * 0.62, 17, mh * 0.5, 0, 0, 7); g.fill();
      g.fillStyle = "#fff";
      [-19, -9.5, 0, 9.5, 19].forEach(function (x) {
        var len = Math.abs(x) > 15 ? 17 : 10;
        g.beginPath(); g.moveTo(x - 4.5, lip - 6); g.lineTo(x + 4.5, lip - 6); g.lineTo(x, lip + len); g.closePath(); g.fill();
      });
      g.restore();
      // 上嘴唇：用和脸同样的渐变盖住牙根，牙齿看起来是从嘴唇下面长出来的
      var hg2 = g.createLinearGradient(0, -96, 0, 30); hg2.addColorStop(0, "#ee5a3a"); hg2.addColorStop(1, "#cb3722");
      g.fillStyle = hg2; g.beginPath(); g.moveTo(-34, -mh - 2); g.lineTo(34, -mh - 2); g.lineTo(34, lip); g.quadraticCurveTo(0, lip + 10, -34, lip); g.closePath(); g.fill();
      g.strokeStyle = "#a82c1a"; g.lineWidth = 2.5; g.lineCap = "round"; g.beginPath(); g.moveTo(-31, lip + 0.5); g.quadraticCurveTo(0, lip + 10, 31, lip + 0.5); g.stroke();
    } else if (mouth === "wry") {
      g.strokeStyle = "#3a0f0a"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(-24, 0); g.lineTo(-8, -6); g.lineTo(8, 4); g.lineTo(24, -4); g.stroke();
    } else if (mouth === "tongue") {
      g.fillStyle = "#3a0f0a"; g.beginPath(); g.ellipse(0, 0, 22, 12, 0, 0, 7); g.fill();
      var tl = 22 + Math.sin(tt * 8) * 4; g.fillStyle = "#ff8a9a"; rr(g, -10, 2, 20, tl, 9); g.fill();
    } else if (mouth === "grin") {
      g.fillStyle = "#3a0f0a"; g.beginPath(); g.arc(0, -6, 26, 0.05 * Math.PI, 0.95 * Math.PI); g.closePath(); g.fill();
      g.fillStyle = "#fff"; g.fillRect(-14, -6, 28, 6);
    } else if (mouth === "w") {
      g.strokeStyle = "#3a0f0a"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(-14, -2); g.quadraticCurveTo(-7, 8, 0, -2); g.quadraticCurveTo(7, 8, 14, -2); g.stroke();
    } else {
      g.fillStyle = "#3a0f0a"; g.beginPath(); g.ellipse(0, 2, 10, 12, 0, 0, 7); g.fill();
    }
    g.restore();
    g.fillStyle = "#7a1d12"; g.beginPath(); g.arc(-7, -46, 3, 0, 7); g.arc(7, -46, 3, 0, 7); g.fill();
    if (pose === "play3") { g.fillStyle = "rgba(30,20,20,.5)"; g.beginPath(); g.arc(0, -60, 62, 0, 7); g.fill(); }
    if (hurt && o.hv === 2) {
      g.font = "22px serif"; g.textAlign = "center";
      for (var q = 0; q < 3; q++) { var aa = tt * 7 + q * 2.1; g.fillText("⭐", Math.cos(aa) * 52, -128 + Math.sin(aa) * 12); }
    }
    g.restore();
  }

  // ---------- 画头像 ----------
  function drawAvatar(g, x, y, r, im, name, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    g.beginPath(); g.arc(0, 0, r, 0, 7); g.closePath(); g.save(); g.clip();
    if (im) {
      var w = im.naturalWidth || r * 2, h = im.naturalHeight || r * 2, k = Math.max(r * 2 / w, r * 2 / h);
      g.drawImage(im, -w * k / 2, -h * k / 2, w * k, h * k);
    } else {
      g.fillStyle = "#f2b394"; g.fillRect(-r, -r, r * 2, r * 2);
      g.fillStyle = "#7a2418"; g.font = "700 " + r + 'px "PingFang SC",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(name || "?").slice(0, 1), 0, 2);
    }
    g.restore(); g.strokeStyle = "#ffd77a"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
    g.restore();
  }
  function emoji(g, ch, x, y, size, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.font = size + "px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, 0, 0); g.restore();
  }

  // ---------- 画爆竹 / 福袋 ----------
  function drawNote(g, n, x, y, sc, t) {
    g.save(); g.translate(x, y); g.rotate(Math.sin(t * 0.01 + n.id) * 0.2); g.scale(sc, sc);
    if (n.type === "bag") {
      var glow = 0.5 + 0.5 * Math.sin(t * 0.012 + n.id);
      g.fillStyle = "rgba(255,215,122," + (0.25 + glow * 0.3) + ")"; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill();
      g.fillStyle = "#d9302a"; g.beginPath(); g.arc(0, 4, 20, 0, 7); g.fill();
      g.fillStyle = "#b8201c"; g.beginPath(); g.moveTo(-9, -12); g.lineTo(9, -12); g.lineTo(14, -2); g.lineTo(-14, -2); g.closePath(); g.fill();
      g.strokeStyle = "#ffd77a"; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -9); g.lineTo(10, -9); g.stroke();
      g.fillStyle = "#ffe29a"; g.font = '700 17px "STKaiti","KaiTi",serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("福", 0, 6);
    } else {
      var big = n.type === "big", k = big ? 1.5 : 1;
      if (big) { g.fillStyle = "rgba(255,150,60," + (0.25 + 0.2 * Math.sin(t * 0.015)) + ")"; g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill(); }
      g.scale(k, k);
      g.fillStyle = big ? "#a8121c" : "#d9302a"; rr(g, -9, -20, 18, 42, 4); g.fill();
      g.fillStyle = "#ffd77a"; g.fillRect(-9, -9, 18, 4); g.fillRect(-9, 8, 18, 4);
      g.strokeStyle = "#8a6a30"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -20); g.quadraticCurveTo(5, -30, 1, -35); g.stroke();
      var fl = 0.6 + 0.4 * Math.sin(t * 0.03 + n.id);
      g.fillStyle = "rgba(255,230,120," + fl + ")"; g.beginPath(); g.arc(1, -37, 4 + fl * 2, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(1, -37, 1.6, 0, 7); g.fill();
    }
    g.restore();
  }

  // ---------- 游戏 ----------
  var G = null;

  function startGame(opts, onClose) {
    if (G) return;
    var root = SF.appRoot; if (!root) return;
    var D = DIFFS[opts.diff], tl = build(opts.diff);
    var ov = SF.h("div", "sfn-g");
    ov.style.zIndex = SF.zTop();
    ov.innerHTML = '<canvas class="sfn-cv"></canvas>' +
      '<div class="sfn-hud"><button class="sfn-x" type="button">✕</button><div class="sfn-bl"><span>年兽</span><div><i></i></div></div><div class="sfn-sc"><b>0</b><small>连击 0</small></div></div>' +
      '<div class="sfn-prot"></div><div class="sfn-ban"></div><div class="sfn-bub c"></div><div class="sfn-bub n"></div>';
    root.appendChild(ov);
    var cv = ov.querySelector(".sfn-cv"), g = cv.getContext("2d");
    var els = {
      blood: ov.querySelector(".sfn-bl i"), score: ov.querySelector(".sfn-sc b"), combo: ov.querySelector(".sfn-sc small"),
      prot: ov.querySelector(".sfn-prot"), ban: ov.querySelector(".sfn-ban"), bc: ov.querySelector(".sfn-bub.c"), bn: ov.querySelector(".sfn-bub.n")
    };
    G = {
      ov: ov, cv: cv, g: g, els: els, D: D, tl: tl, notes: tl.notes, diff: opts.diff, char: opts.char, lines: opts.lines || [],
      startA: null, offset: opts.offset != null ? opts.offset : Math.round(SF.sfx.latency()) + 50, nextStep: 0, pulseStep: 0, brk: 0, paused: false, stop: false, W: 0, H: 0, dpr: 1, L: null,
      score: 0, combo: 0, maxCombo: 0, good: 0, okc: 0, miss: 0, hsum: 0, prot: 0, blood: 100, dmg: 100 / (0.62 * tl.W),
      parts: [], texts: [], rings: [], judges: [], hurt: 0, hv: 0, taunt: 0, pulse: 0, drum: 0, shake: 0, flash: 0, inter: null, phase: null, end: null,
      avatar: null, bubT: { c: 0, n: 0 }, banT: 0, curBar: -1
    };
    var me = G;
    me.avatar = null;
    if (opts.char) loadAvatar(opts.char.avatar).then(function (im) { me.avatar = im; });

    function resize() {
      me.dpr = Math.min(window.devicePixelRatio || 1, 2);
      me.W = cv.clientWidth; me.H = cv.clientHeight;
      cv.width = me.W * me.dpr; cv.height = me.H * me.dpr; g.setTransform(me.dpr, 0, 0, me.dpr, 0, 0);
      var s = Math.min(me.W * 0.78 / 220, me.H * 0.5 / 280);
      me.L = { W: me.W, H: me.H, s: s, cx: me.W / 2, cy: me.H * 0.4, rx: 56 * s, ry: 46 * s, by: 52 * s, dz: me.H * 0.82 };
    }
    resize();
    var onRs = function () { resize(); }; window.addEventListener("resize", onRs);
    var onVis = function () { if (document.hidden && !me.paused && !me.end) pause(false); };
    document.addEventListener("visibilitychange", onVis);

    function pause(ask) {
      if (me.paused || me.stop) return; me.paused = true; SF.sfx.suspend();
      if (!ask) SF.toast("已暂停，点一下继续");
      if (ask) {
        SF.confirm("退出打年兽", "本局不计入记录，确定退出吗？").then(function (ok) {
          if (ok) quit(); else resume();
        });
      } else {
        ov.classList.add("paused");
        ov.addEventListener("pointerdown", function once() { ov.removeEventListener("pointerdown", once); resume(); }, { once: true });
      }
    }
    function resume() { if (!me.paused) return; SF.sfx.resume(); me.paused = false; ov.classList.remove("paused"); }
    function quit() { cleanup(); if (onClose) onClose(); }
    function cleanup() {
      me.stop = true; cancelAnimationFrame(me.raf); clearInterval(me.sch); if (SF.sfx) { SF.sfx.resume(); if (SF.sfx.hush) SF.sfx.hush(); }
      window.removeEventListener("resize", onRs); document.removeEventListener("visibilitychange", onVis);
      if (ov.parentNode) ov.remove(); G = null;
    }
    me.cleanup = cleanup;
    ov.querySelector(".sfn-x").onclick = function () { if (!me.end) pause(true); };

    function clock() { return me.startA == null ? -1000 : (SF.sfx.raw() - me.startA) * 1000 - me.offset; }
    function banner(txt, ms) {
      els.ban.textContent = txt; els.ban.classList.remove("on"); void els.ban.offsetWidth; els.ban.classList.add("on"); me.banT = (ms || 1100);
    }
    function bubble(who, text, x, y, ms) {
      var b = who === "c" ? els.bc : els.bn;
      b.textContent = text; b.style.left = clamp(x - 80, 8, me.W - 168) + "px"; b.style.top = y + "px"; b.classList.add("on"); me.bubT[who] = ms || 2200;
    }
    function text(x, y, txt, col, size) { me.texts.push({ x: x, y: y, txt: txt, col: col || "#fff", size: size || 28, age: 0, life: 0.9 }); }
    function burstAt(x, y, n, cols, sp) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, v = (0.6 + Math.random()) * (sp || 3);
        me.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, age: 0, life: 0.6 + Math.random() * 0.6, c: SF.pick(cols || ["#ffd36b", "#ff7a3a", "#fff1b8", "#ff5b5b"]), s: 1.8 + Math.random() * 2, g: 0.09 });
      }
    }
    function jfx(x, y, kind, label) {
      me.rings.push({ x: x, y: y, kind: kind, age: 0 });
      me.judges = [{ kind: kind, label: label || (kind === "perfect" ? "精准" : kind === "good" ? "不错" : "漏"), age: 0 }];
    }
    function geomBase(n) { var L = me.L; return { sx: L.W * n.sxf, sy: L.H * 0.86, tx: L.cx + n.ex * L.rx, ty: L.cy + L.by + n.ey * L.ry }; }
    function geomAt(n, t) {
      var fly = D.fly * 1000, p = (t - (n.t - fly)) / fly; if (p < 0) return null;
      var b = geomBase(n), pc = Math.min(p, 1);
      return { x: b.sx + (b.tx - b.sx) * pc + Math.sin(t * 0.012 + n.id) * 6 * (1 - pc), y: b.sy + (b.ty - b.sy) * pc, p: p, sc: 0.6 + 0.4 * pc, tx: b.tx, ty: b.ty };
    }

    // ----- 判定 -----
    function updHud() {
      els.blood.style.width = clamp(me.blood, 0, 100) + "%"; els.score.textContent = me.score; els.combo.innerHTML = me.brk > 0 ? '<span class="sfn-brk">连击中断</span>' : "连击 " + me.combo + (me.combo > 1 ? ' <span class="sfn-up">↑</span>' : "");
      els.prot.textContent = me.prot > 0 ? "🧧 福袋保护" : ""; els.prot.classList.toggle("on", me.prot > 0);
    }
    function hitNote(n, q, mult) {
      n.state = 2; var gm = geomAt(n, clock()) || { x: me.L.cx, y: me.L.cy, tx: me.L.cx, ty: me.L.cy };
      var tx = gm.tx != null ? gm.tx : gm.x, ty = gm.ty != null ? gm.ty : gm.y;
      if (n.type === "bag") {
        if (me.prot > 0) { me.score += 100; text(tx, ty, "福袋 +100", "#ffd77a", 24); } else { me.prot = 1; text(tx, ty, "福袋保护！", "#ffd77a", 26); }
        me.combo++; me.maxCombo = Math.max(me.maxCombo, me.combo);
        burstAt(tx, ty, 14, ["#ffd77a", "#fff1b8"], 3); if (SF.sfx) SF.sfx.bag(); updHud(); return;
      }
      var w = n.type === "big" ? 2 : 1, m = mult || 1;
      me.combo++; me.maxCombo = Math.max(me.maxCombo, me.combo);
      me.score += Math.round(((q === 2 ? 100 : 50) * w + Math.min(me.combo, 50) * 2) * m);
      me.hsum += (q === 2 ? 1 : 0.6) * w * m; me.blood -= me.dmg * (q === 2 ? 1 : 0.6) * w * m;
      if (q === 2) me.good++; else me.okc++;
      me.hurt = n.type === "big" ? 1.5 : 1; me.hv = Math.floor(Math.random() * 3); me.flash = n.type === "big" ? 0.5 : 0.18; me.shake = n.type === "big" ? 0.4 : 0.1;
      burstAt(tx, ty, n.type === "big" ? 36 : 16, null, n.type === "big" ? 5 : 3.2);
      jfx(tx, ty, q === 2 ? "perfect" : "good");
      if (SF.sfx) { if (n.type === "big") SF.sfx.bigb(); else if (q === 2) SF.sfx.hitg(); else SF.sfx.hito(); }
      updHud();
    }
    function missNote(n, early) {
      n.state = 3; var b = geomBase(n), gm = geomAt(n, clock());
      var x = gm ? gm.x : b.tx, y = gm ? gm.y : b.ty;
      if (n.type === "bag") { if (early) burstAt(x, y, 8, ["#ffd77a"], 2); return; }
      me.miss++;
      if (me.prot > 0) { me.prot = 0; text(x, y - 20, "福袋挡住了！", "#ffd77a", 22); }
      else { me.combo = 0; me.brk = 0.9; }
      jfx(b.tx, b.ty, "miss", early ? "太早" : "漏"); me.taunt = early ? 0 : 0.8;
      if (early) burstAt(x, y, 10, ["#ff9a5a", "#fff"], 2.4);
      if (SF.sfx) SF.sfx.miss(); updHud();
    }
    function judge(n, t, viaDrum) {
      var dt = t - n.t, adt = Math.abs(dt), q = adt <= D.gw ? 2 : adt <= D.ow ? 1 : 0;
      if (!q) { if (dt < 0 && !viaDrum) missNote(n, true); return; }
      if (n.type === "big") { n.state = 1; n.firstT = t; n.q = q; var b = geomBase(n); text(b.tx, b.ty - 40, "再点一下！", "#ffb25a", 26); return; }
      hitNote(n, q, 1);
    }
    function tap(x, y) {
      if (me.startA == null || me.paused || me.end) return;
      var t = clock(); if (t < 0) return;
      var L = me.L, dr = y > L.dz;
      if (dr) { me.drum = 1; if (me.inter == null && SF.sfx) { /* 声音由判定决定 */ } }
      if (me.inter) { interTap(x, y); if (dr && SF.sfx) SF.sfx.thump(); return; }
      var ch = me.notes.filter(function (n) { return n.state === 1; })[0];
      if (ch && t - ch.firstT <= 420) { hitNote(ch, ch.q, 1); return; }
      var target = null, bd = 1e9;
      me.notes.forEach(function (n) {
        if (n.state !== 0) return;
        if (dr) { var d = Math.abs(t - n.t); if (d <= D.ow && d < bd) { bd = d; target = n; } }
        else {
          var p = geomAt(n, t); if (!p) return;
          var dd = Math.hypot(p.x - x, p.y - y), rad = n.type === "big" ? 58 : 46;
          if (dd <= rad && dd < bd) { bd = dd; target = n; }
        }
      });
      if (!target) { if (dr && SF.sfx) SF.sfx.thump(); return; }
      judge(target, t, dr);
    }
    function interTap(x, y) {
      var I = me.inter, L = me.L;
      if (I.av && !I.gotBag && Math.hypot(x - I.av.x, y - I.av.y) < I.av.r * 1.5) {
        I.gotBag = true;
        if (me.prot > 0) { me.score += 100; text(I.av.x, I.av.y - I.av.r - 20, "福袋 +100", "#ffd77a", 24); } else { me.prot = 1; text(I.av.x, I.av.y - I.av.r - 20, "福袋保护！", "#ffd77a", 24); }
        burstAt(I.av.x, I.av.y - I.av.r, 16, ["#ffd77a", "#fff1b8"], 3); if (SF.sfx) SF.sfx.bag(); updHud(); return;
      }
      if (!I.gotNian && Math.abs(x - L.cx) < 95 * L.s && Math.abs(y - (L.cy - 20 * L.s)) < 130 * L.s) {
        I.gotNian = true; me.score += 50; I.react = 1.2;
        bubble("n", SF.pick(["哎哟！", "别戳我啦！", "嘿嘿，痒～"]), I.nx, I.ny, 1400);
        text(x, y - 20, "+50 逗到了", "#fff", 22); burstAt(x, y, 10, ["#fff1b8", "#ffd77a"], 2.4); if (SF.sfx) SF.sfx.tap(); updHud();
      }
    }
    cv.addEventListener("pointerdown", function (e) {
      e.preventDefault(); var r = cv.getBoundingClientRect(); SF.audio.unlock(); tap(e.clientX - r.left, e.clientY - r.top);
    });

    // ----- 节奏 -----
    var TOM = { 3: 240, 6: 200, 7: 260, 9: 230, 10: 190, 11: 250, 13: 220, 14: 180 };
    // 每 25ms 检查一次，把接下来 150ms 内要响的鼓点按声卡时间排好，不受画面卡顿影响
    function schedule() {
      if (me.startA == null || me.stop || me.paused) return;
      var now = SF.sfx.now(); if (now == null) return;
      var stepSec = tl.stepMs / 1000;
      while (me.nextStep < tl.totalSteps + 16 && me.startA + me.nextStep * stepSec < now + 0.15) {
        playStep(me.nextStep, me.startA + me.nextStep * stepSec); me.nextStep++;
      }
    }
    // 每个爆竹落点都有一声对应的鼓：0/8 拍底鼓，4/12 拍军鼓，其他拍是不同音高的通鼓，大爆竹是低音鼓，福袋是铃声
    function playStep(s, w) {
      var bar = Math.floor(s / 16), st = s % 16, ph = phaseAt(tl, bar), first = bar === ph.s && st === 0, S = SF.sfx.sched;
      if (ph.kind === "intro") { if (st % 4 === 0) { S.kick(w); S.hat(true, w); } return; }
      if (ph.kind === "inter") {
        if (first) S.gong(w);
        if (st === 0 || st === 8) S.kick(w);
        if (st === 12) S.snare(true, w);
        if (st % 4 === 0) S.hat(false, w);
        return;
      }
      var acc = tl.accent[s];
      if (first) S.gong(w);
      if (st === 0 || st === 8) S.kick(w, acc ? 1 : 0.5);
      if (st === 4 || st === 12) S.snare(!acc, w);
      if (st % 2 === 0) S.hat(st % 4 === 2, w);
      if (acc) {
        var onGrid = st === 0 || st === 4 || st === 8 || st === 12;
        if (acc === "bag") S.chime(w);
        else if (acc === "big") S.tom(110, w, 1.3);
        else if (!onGrid) S.tom(TOM[st] || 210, w, 1);
      }
      if (me.combo >= 10 && st % 4 === 2) S.cow(w);
      if (me.combo >= 20 && (st === 7 || st === 15)) S.snare(true, w);
    }
    function enterPhase(ph) {
      me.phase = ph;
      if (ph.kind === "round") banner(BANNER[ph.r], 1400);
      if (ph.kind === "inter") {
        var set = SETS[(ph.i - 1 + me.setOff) % 4], ai = me.lines;
        var cline = SF.pick(set.cl);
        if (ai.length && set !== SETS[3] && Math.random() < 0.65) cline = SF.pick(ai);
        me.inter = { set: set, idx: (ph.i - 1 + me.setOff) % 4, ph: ph, nline: SF.pick(set.nl), cline: cline, shownN: false, shownC: false, gotBag: false, gotNian: false, react: 0, av: null, nx: 0, ny: 0, boomed: false };
        banner("中场休息", 1400);
      } else me.inter = null;
    }
    me.setOff = Math.floor(Math.random() * 4);
    // 两次中场要抽不同的组：第二次从第一次的下一组起
    function finish(win) {
      var t1 = performance.now();
      me.end = { t0: t1, win: win }; banner(win ? "年兽被吓跑啦！" : "年兽还没打跑…", 2400);
      if (win) { if (SF.sfx) SF.sfx.win(); for (var i = 0; i < 6; i++) setTimeout(function () { if (!G || G !== me) return; burstAt(me.L.W * (0.15 + Math.random() * 0.7), me.L.H * (0.15 + Math.random() * 0.35), 40, null, 4.5); if (SF.sfx) SF.sfx.burst(); }, i * 260); }
      setTimeout(function () { if (G === me) showResult(win); }, win ? 2500 : 1900);
    }

    // ----- 每帧 -----
    var prevNow = performance.now();
    function frame(now) {
      if (me.stop) return;
      me.raf = requestAnimationFrame(frame);
      if (!document.body.contains(ov)) { cleanup(); return; }
      var dt = Math.min(0.05, (now - prevNow) / 1000); prevNow = now;
      if (me.paused) return;
      if (me.startA == null) { var c0 = SF.sfx.now(); if (c0 != null) me.startA = c0 + 0.9; }
      schedule();
      var t = clock();
      if (!me.end) update(t, dt);
      else me.parts.length && updateParts(dt);
      draw(t, dt);
    }
    function updateParts(dt) {
      me.parts = me.parts.filter(function (p) { p.age += dt; p.vy += p.g; p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt; return p.age < p.life; });
    }
    function update(t, dt) {
      if (t >= 0) {
        while (me.pulseStep * tl.stepMs <= t) {
          var ps = me.pulseStep, pst = ps % 16;
          if (pst % 4 === 0) me.pulse = 1;
          if (pst % 4 === 0 && phaseAt(tl, Math.floor(ps / 16)).kind === "intro") banner(["预备", "3", "2", "1"][pst / 4], 700);
          me.pulseStep++;
        }
        var bar = Math.floor(t / tl.barMs), ph = phaseAt(tl, bar);
        if (ph !== me.phase) enterPhase(ph);
        me.curBar = bar;
      }
      me.notes.forEach(function (n) {
        if (n.state === 0 && t > n.t + D.ow) missNote(n, false);
        else if (n.state === 1 && t - n.firstT > 420) hitNote(n, 1, 0.7);
      });
      me.pulse = Math.max(0, me.pulse - dt * 4); me.hurt = Math.max(0, me.hurt - dt * 3); me.taunt = Math.max(0, me.taunt - dt);
      me.drum = Math.max(0, me.drum - dt * 6); me.shake = Math.max(0, me.shake - dt); me.flash = Math.max(0, me.flash - dt * 2);
      me.bubT.c -= dt * 1000; me.bubT.n -= dt * 1000; if (me.bubT.c <= 0) els.bc.classList.remove("on"); if (me.bubT.n <= 0) els.bn.classList.remove("on");
      if (me.combo >= 10 && Math.random() < (me.combo >= 20 ? 0.3 : 0.14)) me.parts.push({ x: Math.random() * me.W, y: -8, vx: (Math.random() - 0.5) * 0.6, vy: 1 + Math.random(), age: 0, life: 3, c: SF.pick(["#ffd36b", "#ff7a7a", "#fff1b8"]), s: 2, g: 0 });
      updateParts(dt);
      me.texts = me.texts.filter(function (x) { x.age += dt; x.y -= 24 * dt; return x.age < x.life; });
      me.rings = me.rings.filter(function (r) { r.age += dt; return r.age < 0.45; });
      me.judges = me.judges.filter(function (j) { j.age += dt; return j.age < 0.6; });
      if (me.brk > 0) { me.brk -= dt; if (me.brk <= 0) updHud(); }
      var last = me.notes[me.notes.length - 1];
      if (last.state >= 2 && t > tl.lastT + 700 && !me.end) finish(me.blood <= 0);
    }

    // ----- 绘制 -----
    var JC = { perfect: ["#fff8d0", "#ffd23f", "#ff8f1f", "#ffcf5a"], good: ["#f0faff", "#79ccff", "#2f7bff", "#7cb8ff"], miss: ["#ffe0e6", "#ff8aa0", "#c23a5a", "#ff9aae"] };
    // 判定圈：内圈固定、小而淡；最近的一个爆竹临近时，外圈收缩到内圈上，内圈随之变亮
    function drawRing(x, y, a, t, n) {
      var q = clamp((t - (n.t - 700)) / 700, 0, 1), r0 = 24, hot = q >= 0.97;
      g.save();
      g.globalAlpha = a * (0.4 + 0.6 * q);
      g.strokeStyle = "rgba(25,8,35,.35)"; g.lineWidth = 4.5; g.beginPath(); g.arc(x, y, r0, 0, 7); g.stroke();
      g.strokeStyle = hot ? "#fff3b0" : "#ffd23f"; g.lineWidth = hot ? 3.4 : 2.2; g.beginPath(); g.arc(x, y, r0, 0, 7); g.stroke();
      g.globalAlpha = a * (0.06 + 0.2 * q); g.fillStyle = "#ffd23f"; g.beginPath(); g.arc(x, y, r0, 0, 7); g.fill();
      if (q < 1 && a > 0.9) {
        g.globalAlpha = 0.85 * (1 - 0.3 * q); g.strokeStyle = "#fff6d0"; g.lineWidth = 1.8;
        g.beginPath(); g.arc(x, y, r0 + 42 * (1 - q), 0, 7); g.stroke();
      }
      g.restore();
    }
    function drawRingFx() {
      me.rings.forEach(function (r) {
        var k = r.age / 0.45, col = r.kind === "perfect" ? "#ffd23f" : r.kind === "good" ? "#5ab4ff" : "#b8bccc";
        g.save(); g.globalAlpha = 1 - k;
        if (r.kind === "miss") { g.setLineDash([5, 5]); g.lineWidth = 2.5; g.strokeStyle = col; g.beginPath(); g.arc(r.x, r.y, 24 - 6 * k, 0, 7); g.stroke(); }
        else {
          g.strokeStyle = col; g.lineWidth = 4 * (1 - k) + 1; g.beginPath(); g.arc(r.x, r.y, 24 + 26 * k, 0, 7); g.stroke();
          g.globalAlpha = 0.3 * (1 - k); g.fillStyle = col; g.beginPath(); g.arc(r.x, r.y, 24, 0, 7); g.fill();
        }
        g.restore();
      });
    }
    // 判定文字：固定显示在年兽脚下和战鼓之间的空地，只显示最新一个；渐变 + 细描边 + 柔光
    function drawJudges() {
      var L = me.L;
      me.judges.forEach(function (j) {
        var k = j.age / 0.6, pop = k < 0.18 ? 0.7 + 0.45 * (k / 0.18) : k < 0.32 ? 1.15 - 0.15 * ((k - 0.18) / 0.14) : 1;
        var al = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45, c = JC[j.kind], size = 34, chars = Array.from(j.label), adv = size * 1.12;
        g.save(); g.globalAlpha = clamp(al, 0, 1); g.translate(L.cx, L.H * 0.7 - k * 8); g.scale(pop, pop);
        g.font = "800 " + size + 'px "PingFang SC","Noto Sans SC",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
        var gr = g.createLinearGradient(0, -size * 0.55, 0, size * 0.55);
        gr.addColorStop(0, c[0]); gr.addColorStop(0.5, c[1]); gr.addColorStop(1, c[2]);
        var x0 = -adv * (chars.length - 1) / 2;
        chars.forEach(function (ch, i) {
          var x = x0 + i * adv;
          g.shadowColor = c[1]; g.shadowBlur = 12; g.strokeStyle = "rgba(25,8,35,.8)"; g.lineWidth = 5; g.strokeText(ch, x, 0);
          g.shadowBlur = 0; g.fillStyle = gr; g.fillText(ch, x, 0);
        });
        g.restore();
      });
    }

    function drawBg(t) {
      var L = me.L, bgr = g.createLinearGradient(0, 0, 0, L.H); bgr.addColorStop(0, "#0d1130"); bgr.addColorStop(0.55, "#3b1d3e"); bgr.addColorStop(1, "#7a2230");
      g.fillStyle = bgr; g.fillRect(0, 0, L.W, L.H);
      g.fillStyle = "rgba(255,255,255,.55)";
      for (var i = 0; i < 22; i++) { var sx = (i * 97) % L.W, sy = (i * 53) % (L.H * 0.4); g.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(t * 0.001 + i)); g.fillRect(sx, sy, 2, 2); }
      g.globalAlpha = 1;
      g.fillStyle = "rgba(20,6,16,.55)"; g.beginPath(); g.ellipse(L.cx, L.cy + 135 * L.s, 120 * L.s, 20 * L.s, 0, 0, 7); g.fill();
      // 灯笼：连击越高晃得越欢
      var amp = 0.05 + Math.min(me.combo, 30) * 0.004, beat = 60000 / D.bpm;
      for (var k = 0; k < 5; k++) {
        var lx = L.W * (k + 0.5) / 5, len = 34 + (k % 2) * 14, ang = Math.sin(t / beat * Math.PI + k) * amp;
        g.save(); g.translate(lx, 0); g.rotate(ang);
        g.strokeStyle = "#ffd77a"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
        g.fillStyle = "rgba(255,120,70," + (0.18 + Math.min(me.combo, 30) * 0.008) + ")"; g.beginPath(); g.arc(0, len + 16, 30, 0, 7); g.fill();
        g.fillStyle = "#d9302a"; g.beginPath(); g.ellipse(0, len + 16, 14, 17, 0, 0, 7); g.fill();
        g.fillStyle = "#ffd77a"; g.fillRect(-6, len - 2, 12, 4); g.fillRect(-6, len + 30, 12, 3);
        g.restore();
      }
    }
    function drawDrum() {
      var L = me.L, cx = L.W / 2, cy = L.H * 0.925, w = L.W * 0.62, h = L.H * 0.1, k = 1 + me.drum * 0.06;
      g.save(); g.translate(cx, cy); g.scale(k, k);
      g.fillStyle = "#a8201c"; rr(g, -w / 2, -h * 0.2, w, h * 0.9, 10); g.fill();
      g.fillStyle = "#ffd77a"; g.fillRect(-w / 2, -h * 0.2, w, 5); g.fillRect(-w / 2, h * 0.6, w, 5);
      for (var i = 0; i < 9; i++) { g.beginPath(); g.arc(-w / 2 + w * (i + 0.5) / 9, h * 0.1, 3, 0, 7); g.fill(); }
      g.fillStyle = me.drum > 0.1 ? "#fff3d0" : "#f3d9a8"; g.beginPath(); g.ellipse(0, -h * 0.2, w / 2, h * 0.28, 0, 0, 7); g.fill();
      g.strokeStyle = "#ffd77a"; g.lineWidth = 3; g.stroke();
      g.restore();
      if (!me.end && !me.inter) { g.fillStyle = "rgba(255,243,208,.6)"; g.font = '12px "PingFang SC",sans-serif'; g.textAlign = "center"; g.fillText("点击爆竹或战鼓", cx, L.H * 0.985); }
    }
    function interScene(t) {
      var I = me.inter, L = me.L, ph = I.ph, u = clamp((t - ph.s * tl.barMs) / ((ph.e - ph.s) * tl.barMs), 0, 1), set = I.set, idx = I.idx;
      var r = Math.min(L.W * 0.11, 44), side = set.side, y = L.H * 0.7, x, rot = 0, tt = t / 1000;
      var inX = side === "R" ? L.W - r - 16 : r + 16, outX = side === "R" ? L.W + r + 20 : -r - 20;
      x = outX + (inX - outX) * ease((u - 0.05) / 0.2);
      if (u > 0.9) x = inX + (outX - inX) * ease((u - 0.9) / 0.1);
      var pose = "pant", ems = [];
      if (idx === 0) {
        pose = "pant"; if (u > 0.3) rot = Math.sin(tt * 8) * 0.15;
        if (u > 0.35) ems.push(["💪", x + (side === "R" ? -r - 14 : r + 14), y - 6 + Math.sin(tt * 6) * 3, 30, 0]);
      } else if (idx === 1) {
        pose = u < 0.35 ? "clown1" : u < 0.7 ? "clown2" : "clown3";
        if (u < 0.7) { if (u > 0.3) ems.push(["😏", x, y - r - 20, 28, 0]); } else { rot = Math.sin(tt * 30) * 0.08; ems.push(["😜", x, y - r - 22, 30, Math.sin(tt * 12) * 0.2]); }
      } else if (idx === 2) {
        pose = "beg";
        if (u > 0.4) { rot = Math.sin(tt * 26) * 0.07; ems.push(["🤭", x, y - r - 20, 28, 0]); }
      } else {
        var walkTo = L.cx - 100 * L.s - r * 0.4; x = (r + 16) + (walkTo - (r + 16)) * ease((u - 0.05) / 0.35); if (u > 0.9) x = walkTo + ((r + 16) - walkTo) * ease((u - 0.9) / 0.1);
        y = L.H * 0.68 + Math.sin(tt * 10) * (u > 0.05 && u < 0.4 ? 4 : 0);
        if (u < 0.5) pose = "play1"; else if (u < 0.72) pose = "play2"; else pose = "play3";
        if (u >= 0.4 && u < 0.72) { var p = clamp((u - 0.4) / 0.3, 0, 1); ems.push(["🧨", x + r + (L.cx + 60 * L.s - x - r) * ease(p), y - 10 - 40 * Math.sin(p * Math.PI), 26, p * 6]); }
        if (u >= 0.72 && !I.boomed) { I.boomed = true; me.flash = 0.9; me.shake = 0.5; burstAt(L.cx + 90 * L.s, L.cy, 50, null, 5); if (SF.sfx) SF.sfx.bigb(); }
        if (u >= 0.72) { rot = Math.sin(tt * 28) * 0.09; ems.push(["😵", x, y - r - 22, 28, 0]); }
      }
      I.av = { x: x, y: y, r: r };
      var nrot = I.react > 0 ? Math.sin(tt * 30) * 0.02 : 0;
      I.nx = side === "R" ? 10 : L.W - 170; I.ny = L.cy - 120 * L.s;
      if (u >= set.nAt && !I.shownN) { I.shownN = true; bubble("n", I.nline, I.nx + 80, I.ny, 2400); }
      if (u >= set.cAt && !I.shownC && me.char) { I.shownC = true; bubble("c", I.cline, x, y - r - 74, 2600); }
      if (I.react > 0) I.react -= 1 / 60;
      return { pose: pose, u: u, ems: ems, rot: rot };
    }
    function draw(t, dt) {
      var L = me.L, tt = t / 1000;
      g.save();
      if (me.shake > 0) g.translate((Math.random() - 0.5) * 8 * me.shake * 2, (Math.random() - 0.5) * 8 * me.shake * 2);
      drawBg(t);
      // 年兽
      var pose = "fight", sc = null, nx = L.cx, ny = L.cy, ns = L.s, nrot = 0, u = null;
      if (me.inter) { sc = interScene(t); pose = sc.pose; u = sc.u; }
      else if (me.taunt > 0) pose = "taunt";
      if (me.end) {
        var p = clamp((performance.now() - me.end.t0) / 1500, 0, 1);
        if (me.end.win) { pose = "scared"; nx = L.cx + p * p * L.W * 0.9; ny = L.cy - p * L.H * 0.35; ns = L.s * (1 - 0.7 * p); nrot = p * 12; }
        else pose = "taunt";
      }
      if (nrot) { g.save(); g.translate(nx, ny); g.rotate(nrot); g.translate(-nx, -ny); }
      drawNian(g, nx, ny, ns, { pose: pose, tt: tt, beat: me.pulse, hurt: me.inter || me.end ? 0 : me.hurt, hv: me.hv, blood: me.blood, u: u, shake: me.flash > 0.3 && !me.inter });
      if (nrot) g.restore();
      if (me.inter && !me.inter.gotNian) { g.globalAlpha = 0.6 + 0.4 * Math.sin(tt * 6); emoji(g, "✨", L.cx + 70 * L.s, L.cy - 130 * L.s, 22, 0); g.globalAlpha = 1; }
      // 目标光点 + 爆竹
      var upc = me.notes.filter(function (n) { return n.state === 0 && t >= n.t - D.fly * 1000 && n.t >= t - D.ow; }).sort(function (a, b) { return a.t - b.t; });
      me.notes.forEach(function (n) { n._rk = 99; }); upc.forEach(function (n, i) { n._rk = i; });
      if (!me.end) me.notes.forEach(function (n) {
        if (n.state === 2 || n.state === 3 || t < 0) return;
        var gm = geomAt(n, t); if (!gm) return;
        var a = clamp((gm.p - 0.15) / 0.5, 0, 1);
        if (n.state === 0 && n._rk < 3) drawRing(gm.tx, gm.ty, n._rk === 0 ? 1 : n._rk === 1 ? 0.5 : 0.3, t, n);
        drawNote(g, n, gm.x, gm.y, gm.sc * (n.state === 1 ? 1.15 : 1), t);
      });
      drawRingFx();
      // 粒子
      g.globalCompositeOperation = "lighter";
      me.parts.forEach(function (p) { g.globalAlpha = clamp(1 - p.age / p.life, 0, 1); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill(); });
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      drawDrum();
      // 头像 + 表情
      if (me.inter && sc && me.inter.av) {
        var A = me.inter.av; drawAvatar(g, A.x, A.y, A.r, me.avatar, me.char && SF.cname(me.char), sc.rot);
        sc.ems.forEach(function (e) { emoji(g, e[0], e[1], e[2], e[3], e[4]); });
        if (!me.inter.gotBag) emoji(g, "🧧", A.x + (A.x > L.W / 2 ? -1 : 1) * (A.r + 8), A.y - A.r - 6 + Math.sin(tt * 5) * 4, 24, 0);
      }
      drawJudges();
      // 飘字
      me.texts.forEach(function (x) {
        g.globalAlpha = clamp(1 - x.age / x.life, 0, 1); g.fillStyle = x.col; g.font = "700 " + x.size + 'px "PingFang SC",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
        g.strokeStyle = "rgba(60,10,10,.7)"; g.lineWidth = 4; g.strokeText(x.txt, x.x, x.y); g.fillText(x.txt, x.x, x.y);
      });
      g.globalAlpha = 1;
      if (me.flash > 0) { g.fillStyle = "rgba(255,240,200," + Math.min(0.5, me.flash * 0.6) + ")"; g.fillRect(0, 0, L.W, L.H); }
      g.restore();
      if (me.banT > 0) { me.banT -= dt * 1000; }
    }

    // ----- 结算 -----
    async function showResult(win) {
      if (G !== me) return; cancelAnimationFrame(me.raf); me.stop = true;
      var pct = clamp(me.hsum / tl.W, 0, 1), grade = pct >= 0.92 ? "S" : pct >= 0.8 ? "A" : pct >= 0.65 ? "B" : "C";
      var rec = await load(), counted = rec.today < LIMIT, nbS = false, nbC = false;
      var b = rec.best[me.diff] || { score: 0, combo: 0 };
      if (counted) {
        if (me.score > b.score) { nbS = true; b.score = me.score; }
        if (me.maxCombo > b.combo) { nbC = true; b.combo = me.maxCombo; }
        rec.best[me.diff] = b; rec.today++; rec.total = (rec.total || 0) + 1; if (win) rec.wins = (rec.wins || 0) + 1;
        rec.recent.unshift({ t: Date.now(), diff: me.diff, score: me.score, combo: me.maxCombo, grade: grade, win: win }); rec.recent = rec.recent.slice(0, 10);
        rec.lastDiff = me.diff; rec.lastChar = me.char ? me.char.id : rec.lastChar;
        await SF.st.set("nian", rec);
      }
      if (win && SF.fortune) SF.fortune.award("nian");
      var res = { score: me.score, combo: me.maxCombo, grade: grade, diff: me.diff, win: win, good: me.good, ok: me.okc, miss: me.miss };
      var box = SF.h("div", "sfn-res");
      box.innerHTML = '<small>BEAT NIAN · 难度「' + D.n + "」</small><h3>" + (win ? "年兽被吓跑啦！" : "年兽还没打跑…") + '</h3><div class="sfn-gr">' + grade + "</div>" +
        '<div class="sfn-rw"><span>得分</span><b>' + me.score + (nbS ? ' <em>新纪录！</em>' : "") + '</b></div>' +
        '<div class="sfn-rw"><span>最高连击</span><b>' + me.maxCombo + (nbC ? ' <em>新纪录！</em>' : "") + '</b></div>' +
        '<div class="sfn-rw"><span>好 / 一般 / 漏</span><b>' + me.good + " / " + me.okc + " / " + me.miss + "</b></div>" +
        '<p class="sfn-tp">' + (counted ? "历史最高：" + b.score + " 分 · " + b.combo + " 连击" : "今日已打满 " + LIMIT + " 局，这局不计入记录") + "</p>" +
        '<div class="sfn-bt"><button class="sfb" data-a="again" type="button">再来一局</button><button class="sfb ghost" data-a="send" type="button">发给 TA</button><button class="sfb ghost" data-a="back" type="button">返回</button></div>';
      ov.appendChild(box);
      box.onclick = function (e) {
        var a = e.target.closest("[data-a]"); if (!a) return;
        if (a.dataset.a === "send") {
          SF.sendCard("战绩会作为卡片发过去，角色能读到你的成绩。", function () {
            return {
              messageType: "nian-score", cardData: res,
              modelText: "我打了一局年兽，难度「" + D.n + "」，" + (win ? "把年兽吓跑了" : "年兽还没被打跑") + "。得分 " + res.score + "，最高连击 " + res.combo + "，评级 " + grade + "。"
            };
          });
        } else if (a.dataset.a === "again") { var o2 = opts; cleanup(); if (onClose) onClose(); startGame(o2, onClose); }
        else { cleanup(); if (onClose) onClose(); }
      };
    }

    banner("准备", 900);
    me.sch = setInterval(schedule, 25);
    me.raf = requestAnimationFrame(frame);
  }
  function loadAvatar(url) {
    return new Promise(function (res) {
      if (!url) { res(null); return; }
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = url; setTimeout(function () { res(null); }, 2500);
    });
  }

  // ---------- 节拍校准：跟着“嗒”声点 12 拍，取中位数当作这台手机的延迟 ----------
  function calibrate(onDone) {
    if (SF.sfx && !SF.sfx.enabled()) { SF.toast("请先打开音效再校准"); return; }
    var timers = [], clicks = [], taps = [], state = "idle", iv = 0;
    var C = SF.layer(SF.appRoot, "节拍校准", { k: "CALIBRATION", key: "nianCal", onClose: function () { timers.forEach(clearTimeout); clearInterval(iv); state = "done"; if (SF.sfx.hush) SF.sfx.hush(); } });
    if (!C) return;
    C.body.innerHTML = '<p class="tip">跟着节拍，在听到“嗒”声的同时点击圆形按钮，共 12 拍。建议在安静的地方进行。</p>' +
      '<div class="sfn-cal"><button class="sfn-pad" type="button">开始</button></div><p class="sfn-cs">准备好后点“开始”</p><div class="sfn-cres"></div>';
    var pad = C.body.querySelector(".sfn-pad"), cs = C.body.querySelector(".sfn-cs"), res = C.body.querySelector(".sfn-cres");
    function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
    function finish() {
      if (state === "done") return; state = "result";
      var ds = [];
      for (var i = 3; i < clicks.length; i++) {
        var best = null;
        taps.forEach(function (tt) { var d = (tt - clicks[i]) * 1000; if (Math.abs(d) <= 350 && (best == null || Math.abs(d) < Math.abs(best))) best = d; });
        if (best != null) ds.push(best);
      }
      pad.textContent = "完成"; pad.disabled = true;
      if (ds.length < 5) { cs.textContent = "有效点击太少，请再试一次"; res.innerHTML = '<button class="sfb block" data-a="retry" type="button">重试</button>'; return; }
      var m = Math.round(clamp(median(ds), -50, 400)), dev = median(ds.map(function (d) { return Math.abs(d - m); }));
      cs.textContent = "测得延迟约 " + m + " ms" + (dev > 60 ? "（节奏有点不稳，建议重试）" : "");
      res.innerHTML = '<div class="sfrow" style="gap:10px"><button class="sfb" style="flex:1" data-a="use" type="button">采用</button><button class="sfb ghost" data-a="retry" type="button">重试</button></div>';
      res.dataset.m = m;
    }
    function start() {
      SF.audio.unlock();
      var base = SF.sfx.now();
      if (base == null) { cs.textContent = "音频准备中，请再点一次"; return; }
      state = "run"; clicks = []; taps = []; pad.textContent = "点！"; res.innerHTML = "";
      for (var i = 0; i < 12; i++) {
        clicks.push(base + 0.9 + i * 0.7);
        (function (k) { timers.push(setTimeout(function () { cs.textContent = "第 " + (k + 1) + " / 12 拍"; }, (0.9 + k * 0.7) * 1000)); })(i);
      }
      // 不一次排完：只排接下来 0.12 秒内的，中途退出就不会再响
      var nextClick = 0; clearInterval(iv);
      iv = setInterval(function () {
        var now = SF.sfx.raw();
        while (nextClick < clicks.length && clicks[nextClick] < now + 0.12) { SF.sfx.sched.click(clicks[nextClick]); nextClick++; }
        if (nextClick >= clicks.length) clearInterval(iv);
      }, 30);
      timers.push(setTimeout(finish, (0.9 + 12 * 0.7 + 0.5) * 1000));
    }
    pad.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      if (state === "idle") start();
      else if (state === "run") { taps.push(SF.sfx.raw()); pad.classList.add("hit"); setTimeout(function () { pad.classList.remove("hit"); }, 90); }
    });
    C.body.addEventListener("click", async function (e) {
      var a = e.target.closest("[data-a]"); if (!a) return;
      if (a.dataset.a === "retry") { state = "idle"; clicks = []; taps = []; pad.disabled = false; pad.textContent = "开始"; cs.textContent = "准备好后点“开始”"; res.innerHTML = ""; }
      else if (a.dataset.a === "use") {
        await SF.st.set("nian_cal", { offset: +res.dataset.m, at: Date.now() }); SF.toast("校准完成"); C.close(); if (onDone) onDone();
      }
    });
  }

  // ---------- 菜单 ----------
  SF.nian = {
    mountCard: function (c, m, r) {
      SF.setRoche(r);
      var cd = m.cardData || {};
      c.replaceChildren(SF.h("div", "sfc-nn", '<b class="sfc-nn-g">' + SF.esc(cd.grade || "") + "</b><div><strong>" + (cd.win ? "吓跑了年兽！" : "年兽还在…") + "</strong><em>难度" + SF.esc((DIFFS[cd.diff] || {}).n || "") + " · " + SF.esc(cd.score) + " 分 · " + SF.esc(cd.combo) + " 连击</em></div>"));
    },
    open: async function () {
      var L = SF.layer(SF.appRoot, "打年兽", { full: true, k: "BEAT NIAN", key: "nian" });
      if (!L) return;
      var rec = await load(), lines = await SF.st.get("nian_lines", {}), chars = await SF.chars(), cal = await SF.st.get("nian_cal", null);
      var diff = DIFFS[rec.lastDiff] ? rec.lastDiff : "mid", cid = rec.lastChar || (chars[0] && chars[0].id) || null, busy = false;
      if (cid && !chars.some(function (c) { return c.id === cid; })) cid = chars[0] ? chars[0].id : null;

      function fmt(t) { var d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate(); }
      function render() {
        if (!L.alive) return;
        var b = rec.best[diff] || { score: 0, combo: 0 }, n = (lines[cid] || []).length;
        var h = '<h4>难度</h4><div class="sf-seg">' + Object.keys(DIFFS).map(function (k) { return '<span data-d="' + k + '" class="' + (diff === k ? "on" : "") + '">' + DIFFS[k].n + "</span>"; }).join("") + "</div>";
        h += "<h4>中场陪你的 TA</h4>" + (chars.length ? SF.chipRow(chars.map(function (c) { return '<span class="sfchip' + (cid === c.id ? " on" : "") + '" data-c="' + SF.esc(c.id) + '">' + SF.esc(SF.cname(c)) + "</span>"; }).join("")) : '<p class="tip">没有读取到角色，中场就只有年兽表演。</p>');
        if (cid) h += '<div class="sfrow" style="justify-content:space-between;margin-top:2px"><span class="tip" style="margin:0">已有 ' + n + ' 句 TA 的台词</span><span class="sf-lnk" data-a="lines">' + (n ? "重新写 10 句" : "让 TA 写 10 句") + "（AI 1 次）</span></div>";
        h += '<h4>我的纪录 · ' + DIFFS[diff].n + '</h4><div class="sf-card"><div class="sfn-st"><div><small>最高分</small><b>' + b.score + "</b></div><div><small>最高连击</small><b>" + b.combo + "</b></div><div><small>今日局数</small><b>" + rec.today + "/" + LIMIT + "</b></div></div></div>";
        h += '<h4>节拍校准</h4><div class="sf-card"><div class="sfrow" style="justify-content:space-between;gap:12px"><span class="tip" style="margin:0">' + (cal ? "已校准 · 延迟 " + cal.offset + " ms" : "未校准 · 使用默认值，建议先校准") + '</span><button class="sfb sm" data-a="cal" type="button">' + (cal ? "重新校准" : "开始校准") + "</button></div>" + (cal ? '<div style="text-align:right;margin-top:6px"><span class="sf-lnk" data-a="calreset">恢复默认</span></div>' : "") + "</div>";
        h += '<button class="sfb block" style="margin-top:18px" data-a="play" type="button">开打</button>';
        h += '<div class="sfn-tips"><span>爆竹抵达年兽的瞬间，点击爆竹或战鼓</span><span>大爆竹需连点两下 · 福袋可抵消一次失误</span><span>每日前 ' + LIMIT + " 局计入战绩</span></div>";
        if (rec.recent.length) h += "<h4>最近 " + rec.recent.length + ' 局</h4><div class="sf-card">' + rec.recent.map(function (x) {
          return '<div class="sfr-i"><div><small>' + fmt(x.t) + " · " + (DIFFS[x.diff] || {}).n + (x.win ? " · 吓跑了" : "") + "</small><p>" + x.score + " 分 · " + x.combo + " 连击 · 评级 " + x.grade + "</p></div></div>";
        }).join("") + "</div>";
        L.body.innerHTML = h; SF.fadeRows(L.body);
      }
      L.body.addEventListener("click", async function (e) {
        var a = e.target.closest("[data-d],[data-c],[data-a]"); if (!a) return;
        if (a.dataset.d) { diff = a.dataset.d; render(); }
        else if (a.dataset.c) { cid = a.dataset.c; render(); }
        else if (a.dataset.a === "lines") {
          if (busy) return;
          var ch = chars.filter(function (c) { return c.id === cid; })[0]; if (!ch) return;
          if (!(await SF.confirm("调用 AI", "让「" + SF.cname(ch) + "」写 10 句打年兽时在旁边说的台词，会消耗 1 次 AI。继续吗？"))) return;
          busy = true; a.textContent = "写台词中…";
          try {
            var raw = await SF.ai("你是" + SF.cname(ch) + "。" + SF.persona(ch),
              "玩家正在玩“打年兽”（春节赶走怪兽的小游戏），你在旁边看着。请写 10 句你会说的台词：可以给玩家加油，也可以调侃年兽。口吻要符合你自己，每句 20 字以内，不要提具体分数。只输出 JSON 数组，例如：[\"台词一\",\"台词二\"]", 0.95);
            var arr = SF.parseJson(raw);
            if (!Array.isArray(arr)) throw new Error("没有解析到台词，请再试一次");
            arr = arr.map(function (x) { return String(x).trim().replace(/^["“「]|["”」]$/g, "").slice(0, 30); }).filter(Boolean).slice(0, 12);
            if (arr.length < 3) throw new Error("写出来的台词太少，请再试一次");
            lines[cid] = arr; await SF.st.set("nian_lines", lines); SF.toast("已保存 " + arr.length + " 句");
          } catch (err) { SF.toast("失败：" + (err.message || err)); }
          busy = false; render();
        }
        else if (a.dataset.a === "cal") calibrate(async function () { cal = await SF.st.get("nian_cal", null); render(); });
        else if (a.dataset.a === "calreset") { await SF.st.del("nian_cal"); cal = null; render(); }
        else if (a.dataset.a === "play") {
          SF.audio.unlock();
          var char = chars.filter(function (c) { return c.id === cid; })[0] || null;
          rec.lastDiff = diff; rec.lastChar = cid; await SF.st.set("nian", rec);
          startGame({ diff: diff, char: char, lines: (cid && lines[cid]) || [], offset: cal ? cal.offset : null }, async function () { rec = await load(); render(); });
        }
      });
      render();
    }
  };

  SF.cssApp.push(`
.sfn-st{display:flex;justify-content:space-around;text-align:center}
.sfn-st small{display:block;font-size:10.5px;letter-spacing:.2em;color:var(--k);margin-bottom:6px}
.sfn-st b{font:300 28px/1.1 -apple-system,"PingFang SC",sans-serif;color:var(--big);font-variant-numeric:tabular-nums}
.sfn-tips{margin-top:12px;text-align:center}
.sfn-tips span{display:block;font-size:12px;line-height:1.9;letter-spacing:.06em;color:var(--k)}
.sfn-cal{display:flex;justify-content:center;margin:18px 0 8px}
.sfn-pad{width:150px;height:150px;border-radius:50%;border:0;font:600 24px/1 -apple-system,"PingFang SC",sans-serif;letter-spacing:.2em;color:#fff6ec;background:radial-gradient(circle at 35% 30%,#f2603f,#a8281c);box-shadow:0 6px 22px rgba(168,40,28,.45);transition:transform .08s,filter .08s;touch-action:manipulation}
.sfn-pad.hit{transform:scale(.93);filter:brightness(1.25)}.sfn-pad[disabled]{opacity:.5}
.sfn-cs{text-align:center;font-size:13px;color:var(--ctx);min-height:20px;margin:6px 0 12px}
.sfn-brk{color:#ff8aa0}.sfn-up{color:#ffd23f}
.sfn-g{position:absolute;inset:0;background:#0d1130;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;color:#fff3dc}
.sfn-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.sfn-g.paused::after{content:"已暂停，点一下继续";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,6,20,.6);font-size:16px;letter-spacing:.3em}
.sfn-hud{position:absolute;left:0;right:0;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 0 max(14px,env(safe-area-inset-left));pointer-events:none}
.sfn-x{pointer-events:auto;flex:0 0 36px;height:36px;padding:0;border-radius:50%;border:1px solid rgba(255,215,122,.55);background:rgba(36,10,20,.55);color:#ffd77a;font-size:14px}
.sfn-bl{flex:1;min-width:0}.sfn-bl span{display:block;font-size:10px;letter-spacing:.4em;color:rgba(255,243,220,.7);margin-bottom:4px}
.sfn-bl div{height:9px;border-radius:5px;background:rgba(255,255,255,.14);overflow:hidden}.sfn-bl i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff5b3a,#ffb35a);transition:width .25s}
.sfn-sc{text-align:right}.sfn-sc b{display:block;font:300 24px/1 -apple-system,sans-serif;color:#ffd77a;font-variant-numeric:tabular-nums}.sfn-sc small{font-size:11px;color:rgba(255,243,220,.7)}
.sfn-prot{position:absolute;left:0;right:0;top:calc(62px + env(safe-area-inset-top));z-index:5;text-align:center;font-size:12px;color:#ffd77a;opacity:0;transition:opacity .3s;pointer-events:none}.sfn-prot.on{opacity:1}
.sfn-ban{position:absolute;left:0;right:0;top:44%;z-index:6;text-align:center;font:600 28px/1.2 "Songti SC","STSong",serif;letter-spacing:.3em;color:#ffe29a;text-shadow:0 0 18px rgba(255,150,80,.8);opacity:0;pointer-events:none}
.sfn-ban.on{animation:sfnBan 1.2s ease-out}
@keyframes sfnBan{0%{opacity:0;transform:scale(.7)}18%{opacity:1;transform:scale(1.05)}70%{opacity:1}100%{opacity:0;transform:scale(1)}}
.sfn-bub{position:absolute;z-index:7;width:160px;padding:8px 11px;border-radius:14px;background:rgba(255,248,232,.95);color:#4a1a12;font-size:13px;line-height:1.5;opacity:0;transform:translateY(6px);transition:opacity .25s,transform .25s;pointer-events:none}
.sfn-bub.on{opacity:1;transform:none}.sfn-bub.n{background:rgba(255,226,170,.95)}
.sfn-res{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;background:rgba(10,6,20,.82)}
.sfn-res small{font-size:10px;letter-spacing:.5em;color:#dca898}
.sfn-res h3{margin:10px 0 4px;font:600 24px/1.3 "Songti SC","STSong",serif;letter-spacing:.2em;color:#ffe29a}
.sfn-gr{margin:6px 0 14px;font:700 76px/1 "Songti SC",serif;color:#ffd77a;text-shadow:0 0 28px rgba(255,150,80,.7)}
.sfn-rw{display:flex;justify-content:space-between;width:min(300px,100%);padding:8px 2px;border-bottom:1px solid rgba(240,201,135,.2);font-size:14px}
.sfn-rw b{font-weight:600;color:#fff3dc;font-variant-numeric:tabular-nums}.sfn-rw em{font-style:normal;margin-left:6px;padding:1px 7px;border-radius:9px;background:#ffd77a;color:#7a1010;font-size:11px;font-weight:700}
.sfn-tp{margin:12px 0 0;font-size:12px;color:#dca898}
.sfn-bt{display:flex;gap:10px;margin-top:20px}
`);
  SF.cssChat.push([
    ".sfc-nn{display:flex;gap:12px;align-items:center;width:230px;max-width:100%;padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,#2a1840,#7a2230);color:#fff3dc;box-shadow:0 6px 18px rgba(60,20,40,.35);font-family:-apple-system,'PingFang SC',sans-serif}",
    ".sfc-nn-g{flex:0 0 46px;height:46px;border-radius:50%;border:2px solid #ffd77a;text-align:center;font:700 26px/42px 'Songti SC',serif;color:#ffd77a}",
    ".sfc-nn strong{display:block;font:600 14.5px/1.4 sans-serif}.sfc-nn em{display:block;margin-top:3px;font-style:normal;font-size:11.5px;opacity:.85}"
  ].join("\n"));
})(window.__SF);

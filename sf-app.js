/* 首页场景：四个时段的背景图 + 嵌在建筑上的功能入口 + 倒计时 + 点天空放烟花 */
(function (SF) {
  "use strict";
  // 入口位置：box = [左, 上, 右, 下]，单位是场景图的像素（按 1220×2576 的基准量的）；tag = 标签在入口框里的位置
  var SPOTS = [
    { id: "watch", label: "守岁", en: "VIGIL", box: [340, 760, 580, 990], act: function () { return SF.watch.open(); } },
    { id: "stage", label: "春晚", en: "GALA", box: [780, 765, 1200, 1095], tag: [.45, .62], locked: 1 },
    { id: "tree", label: "年度回忆", en: "MEMORIES", box: [15, 980, 455, 1335], tag: [.62, .4], locked: 1 },
    { id: "drum", label: "打年兽", en: "BEAT NIAN", box: [450, 1125, 845, 1315], act: function () { return SF.nian.open(); } },
    { id: "stall", label: "红包", en: "RED PACKET", box: [905, 1235, 1175, 1425], tag: [.1, .5], act: function () { return SF.rp.openStall(); } },
    { id: "board", label: "春联", en: "COUPLETS", box: [655, 1360, 915, 1605], tag: [.45, .5], act: function () { return SF.cp.open(); } },
    { id: "cut", label: "剪纸", en: "PAPERCUT", box: [920, 1475, 1220, 1795], tag: [.1, .5], act: function () { return SF.pc.open(); } },
    { id: "lantern", label: "灯谜", en: "RIDDLES", box: [55, 1360, 395, 1585], act: function () { return SF.rd.open(); } },
    { id: "home", label: "走亲戚", en: "VISITING", box: [75, 1585, 725, 2055], locked: 1 },
    { id: "gate", label: "集五福", en: "BLESSINGS", box: [575, 2035, 1090, 2495], tag: [.5, .38], act: function () { return SF.fortune.open(); } },
    { id: "shed", label: "测试", en: "TEST", box: [105, 1915, 325, 2095], tag: [.5, .45], act: function () { return SF.test.open(); } }
  ];
  var IMG = { morning: "morning.png", noon: "noon.png", dusk: "dusk.png", night: "night.png" };
  var S = {};

  function pct(v, base) { return (v / base * 100).toFixed(3) + "%"; }

  // 红色手写线：有的线段在字前面，有的在字后面，来回穿过文字
  function silk(u, locked) {
    var c = locked ? "#b78f86" : "#ff5a5a";
    var defs = '<linearGradient id="' + u + 'g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + c + '" stop-opacity="0"/><stop offset=".14" stop-color="' + c + '"/><stop offset=".86" stop-color="' + c + '"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></linearGradient>' +
      '<clipPath id="' + u + 'f"><rect x="0" y="0" width="45" height="40"/><rect x="90" y="0" width="45" height="40"/></clipPath>' +
      '<clipPath id="' + u + 'b"><rect x="45" y="0" width="45" height="40"/><rect x="135" y="0" width="25" height="40"/></clipPath>';
    var P = '<path d="M2 30C16 6 28 4 34 18C38 30 22 34 30 22C40 6 58 4 66 20C72 33 56 36 62 24C72 4 92 6 98 22C104 34 88 36 94 24C104 6 126 8 132 22C138 32 126 34 130 26C138 14 150 14 158 20" stroke-width="' + (locked ? 1 : 1.3) + '"/>';
    var at = ' viewBox="0 0 160 40" preserveAspectRatio="none" fill="none" stroke="url(#' + u + 'g)" stroke-linecap="round" aria-hidden="true"';
    return '<svg class="sf-silk back"' + at + "><defs>" + defs + '</defs><g clip-path="url(#' + u + 'b)">' + P + "</g></svg>" +
      '<svg class="sf-silk front"' + at + '><g clip-path="url(#' + u + 'f)">' + P + "</g></svg>";
  }
  function tagHtml(s) {
    var u = "sfs" + s.id;
    return '<span class="sf-tagi"><b class="sf-en">' + s.en + "</b>" + silk(u, s.locked) +
      '<span class="sf-cn">' + s.label + '</span><i class="sf-cap"></i><i class="sf-star s1"></i><i class="sf-star s2"></i><u class="sf-dot d1"></u><u class="sf-dot d2"></u><u class="sf-dot d3"></u>' +
      (s.locked ? '<small class="sf-soon">即将开放</small>' : "") + "</span>";
  }

  function loadScene(force) {
    var p = SF.period();
    if (!force && p === S.period) return;
    S.period = p;
    var bg = S.bg; if (!bg) return;
    function tryLoad(name, ok, fail) {
      var im = new Image();
      im.onload = function () { ok(im.src); }; im.onerror = fail;
      im.src = SF.BASE + name + "?v=" + SF.VER;
    }
    function apply(src) { if (S.bg !== bg) return; bg.style.backgroundImage = 'url("' + src + '")'; bg.style.opacity = 1; }
    function giveUp() { if (S.bg === bg) bg.style.opacity = 1; }
    bg.style.opacity = 0;
    tryLoad(IMG[p], apply, function () { if (p !== "night") tryLoad(IMG.night, apply, giveUp); else giveUp(); });
  }

  SF.app = {
    refreshScene: function () { loadScene(true); },
    mount: function (container, roche) {
      SF.setRoche(roche, true);
      SF.injectCss("sf-css-app", SF.cssApp);
      SF.injectChatCss();
      var root = SF.h("div", "roche-plugin-spring-festival sf-root");
      root.innerHTML =
        '<div class="sf-view"><div class="sf-scene"><div class="sf-bg"></div></div></div>' +
        '<canvas class="sf-fx"></canvas>' +
        '<div class="sf-top"><button class="sf-back" type="button" aria-label="返回">‹</button><div class="sf-cd"><small>距新春零点</small><b>--</b></div><button class="sf-snd" type="button" aria-label="音效"></button></div>';
      container.replaceChildren(root);
      SF.appRoot = root;
      setTimeout(function () { SF.inbox.drain(); }, 700);
      var view = root.querySelector(".sf-view"), scene = root.querySelector(".sf-scene");
      S = { root: root, bg: scene.querySelector(".sf-bg"), period: null, prev: null };

      var byId = {};
      SPOTS.forEach(function (s, i) {
        byId[s.id] = s;
        var b = s.box, tag = s.tag || [.5, .5];
        var el = SF.h("button", "sf-spot" + (s.locked ? " lock" : ""));
        el.type = "button"; el.dataset.id = s.id;
        el.style.cssText = "left:" + pct(b[0], SF.IW) + ";top:" + pct(b[1], SF.IH) + ";width:" + pct(b[2] - b[0], SF.IW) + ";height:" + pct(b[3] - b[1], SF.IH);
        el.innerHTML = '<i class="sf-glow" style="animation-delay:' + (i * 0.37).toFixed(2) + 's"></i><span class="sf-tag" style="left:' + tag[0] * 100 + "%;top:" + tag[1] * 100 + "%;--d:" + (i * 0.29).toFixed(2) + 's">' + tagHtml(s) + "</span>";
        scene.appendChild(el);
      });

      function layout() {
        var w = view.clientWidth, h = view.clientHeight; if (!w || !h) return;
        var k = Math.max(w / SF.IW, h / SF.IH), sw = SF.IW * k, sh = SF.IH * k;
        scene.style.width = sw + "px"; scene.style.height = sh + "px"; scene.style.marginLeft = ((w - sw) / 2) + "px";
        if (!S.laid) { S.laid = true; view.scrollTop = Math.max(0, (sh - h) / 2); }
        SF.fx.resize();
      }
      SF.fx.attach(root.querySelector(".sf-fx"));
      layout();
      if (window.ResizeObserver) { S.ro = new ResizeObserver(layout); S.ro.observe(view); }
      loadScene(true);

      root.addEventListener("pointerdown", function () { SF.audio.unlock(); });
      root.querySelector(".sf-back").onclick = function () { try { roche.ui.closeApp(); } catch (e) {} };
      var snd = root.querySelector(".sf-snd");
      function paintSnd() { var on = SF.sfx && SF.sfx.enabled(); snd.textContent = on ? "♪" : "静"; snd.classList.toggle("off", !on); }
      snd.onclick = function () { SF.sfx.set(!SF.sfx.enabled()); paintSnd(); SF.sfx.tap(); };
      paintSnd();

      scene.addEventListener("click", function (e) {
        var b = e.target.closest(".sf-spot");
        if (b) {
          var s = byId[b.dataset.id], rr = b.getBoundingClientRect(), vr = view.getBoundingClientRect();
          var rip = SF.h("i", "sf-rip"); b.appendChild(rip); setTimeout(function () { rip.remove(); }, 800);
          if (s.locked) { SF.toast(s.label + "：即将开放"); return; }
          if (root._sfl > 0 || S.lock) return; // 已经有页面打开，或刚点过：忽略
          if (S.half && S.half.alive) { S.half.close(); S.half = null; if (s.id === S.halfId) { S.halfId = null; return; } }
          S.lock = true; setTimeout(function () { S.lock = false; }, 500);
          // 进入功能页：首页朝被点的建筑“走近”并变暗
          root.style.setProperty("--ox", (rr.left + rr.width / 2 - vr.left) + "px");
          root.style.setProperty("--oy", (rr.top + rr.height / 2 - vr.top) + "px");
          SF.audio.unlock(); if (SF.sfx) SF.sfx.tap();
          try {
            Promise.resolve(s.act()).then(function (l) { if (l && l.half) { S.half = l; S.halfId = s.id; } }, function (err) { console.error(err); });
          } catch (err) { console.error(err); SF.toast("出错了：" + (err.message || err)); }
          return;
        }
        var r = scene.getBoundingClientRect();
        if ((e.clientY - r.top) / r.height > 0.42) return; // 只有天空区域响应
        var rr2 = root.getBoundingClientRect();
        SF.fx.launch(e.clientX - rr2.left, e.clientY - rr2.top);
        if (SF.fortune) SF.fortune.award("firework");
      });

      var cd = root.querySelector(".sf-cd b"), n = 0;
      function tick() {
        var now = SF.now(), left = SF.TARGET - now;
        cd.textContent = left > 0 ? SF.fmtLeft(left) : "新春快乐";
        if (S.prev != null && S.prev < SF.TARGET && now >= SF.TARGET) SF.watch.midnight();
        S.prev = now;
        if (++n % 30 === 0) loadScene(false);
      }
      tick(); S.timer = setInterval(tick, 1000);
    },
    unmount: function () {
      clearInterval(S.timer); if (S.ro) S.ro.disconnect();
      SF.fx.detach(); SF.audio.stop();
      var st = document.getElementById("sf-css-app"); if (st) st.remove();
      SF.appRoot = null; S = {};
    }
  };

  SF.cssApp.push(`
.roche-plugin-spring-festival{position:relative;display:flex;flex-direction:column;width:calc(100% + env(safe-area-inset-left) + env(safe-area-inset-right));height:calc(100% + env(safe-area-inset-top) + env(safe-area-inset-bottom));margin:calc(0px - env(safe-area-inset-top)) calc(0px - env(safe-area-inset-right)) calc(0px - env(safe-area-inset-bottom)) calc(0px - env(safe-area-inset-left));min-width:0;min-height:0;overflow:hidden;background:#141a3c;color:#fff3dc;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;-webkit-user-select:none;user-select:none}
.roche-plugin-spring-festival *{box-sizing:border-box}
.sf-view{position:absolute;inset:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;transform-origin:var(--ox,50%) var(--oy,50%);transition:transform .7s cubic-bezier(.22,1,.36,1),filter .7s}
.sfl-open .sf-view{transform:scale(1.1);filter:brightness(.68) saturate(.9)}
.sf-scene{position:relative}
.sf-bg{position:absolute;inset:0;background:linear-gradient(#141a3c,#2a2450) center/100% 100% no-repeat;background-size:100% 100%;opacity:0;transition:opacity .6s}
.sf-spot{position:absolute;margin:0;padding:0;border:0;background:none;outline:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sf-glow{position:absolute;inset:-6%;border-radius:18%;pointer-events:none;background:radial-gradient(closest-side,rgba(255,214,120,.3),rgba(255,214,120,0) 74%);animation:sfGlow 3.4s ease-in-out infinite}
.sf-spot.lock .sf-glow{background:radial-gradient(closest-side,rgba(150,160,220,.14),rgba(150,160,220,0) 72%)}
.sf-rip{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:2px solid rgba(255,235,190,.9);pointer-events:none;animation:sfRip .8s ease-out forwards}
@keyframes sfRip{to{transform:scale(9);opacity:0}}
.sf-tag{position:absolute;transform:translate(-50%,-50%);font-size:15px;transition:transform .2s}
.sf-spot:active .sf-tag{transform:translate(-50%,-50%) scale(.93)}
.sf-tagi{position:relative;display:flex;flex-direction:column;align-items:center;animation:sfFloat 4.2s ease-in-out infinite;animation-delay:calc(var(--d,0) * -1s)}
.sf-tagi::before{content:"";position:absolute;inset:-1.1em -2em;background:radial-gradient(closest-side,rgba(18,8,22,.66),rgba(18,8,22,0));pointer-events:none;z-index:-1}
.sf-en{position:absolute;left:-.95em;top:-1em;z-index:0;white-space:nowrap;pointer-events:none;font:italic 700 1.05em/1 Georgia,"Times New Roman","Songti SC",serif;letter-spacing:-.03em;color:rgba(255,255,255,.42);text-shadow:0 0 .5em rgba(20,8,12,.4)}
.sf-cn{position:relative;z-index:2;white-space:nowrap;font:600 1em/1 "Songti SC","STSong","Noto Serif SC","Source Han Serif SC",serif;letter-spacing:.2em;margin-right:-.2em;color:#fff;text-shadow:0 0 .55em rgba(255,60,70,.9),0 0 .12em rgba(255,90,90,.7),0 1px 3px rgba(0,0,0,.6)}
.sf-cap{position:relative;z-index:1;display:block;width:calc(100% + .9em);height:.3em;margin-top:.22em;border-radius:999px;background:#fff;box-shadow:0 0 .7em rgba(255,255,255,.75);animation:sfCap 3s ease-in-out infinite}
.sf-silk{position:absolute;left:50%;top:50%;width:calc(100% + 2.6em);height:1.9em;transform:translate(-50%,-66%);pointer-events:none;overflow:visible;animation:sfWob 6s ease-in-out infinite alternate}
.sf-silk.back{z-index:1}.sf-silk.front{z-index:3;animation-delay:-1.2s}
.sf-star{position:absolute;z-index:3;width:.55em;height:.55em;background:#fff;clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);filter:drop-shadow(0 0 4px #fff);animation:sfTw 2.4s ease-in-out infinite}
.sf-star.s1{right:-1em;bottom:-.2em}.sf-star.s2{width:.36em;height:.36em;right:-1.6em;bottom:.12em;animation-delay:-1.1s}
.sf-dot{position:absolute;z-index:3;width:.2em;height:.2em;border-radius:50%;background:#f4efe6;opacity:.85}
.sf-dot.d1{left:62%;top:-.35em}.sf-dot.d2{left:-.5em;top:55%;width:.14em;height:.14em}.sf-dot.d3{right:-.4em;top:-.1em;width:.12em;height:.12em}
.sf-soon{position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:.5em;white-space:nowrap;font:400 .62em/1 -apple-system,"PingFang SC",sans-serif;letter-spacing:.6em;margin-right:-.6em;color:rgba(255,255,255,.78);text-shadow:0 0 .6em rgba(20,8,12,.8)}
.sf-spot.lock .sf-cn{color:rgba(240,232,224,.82)}
.sf-spot.lock .sf-en{color:rgba(255,255,255,.26)}
.sf-spot.lock .sf-cap{background:linear-gradient(180deg,#d6cdc8,#b8aca6);box-shadow:none;opacity:.8;animation:none}
.sf-spot.lock .sf-star{opacity:.5;animation:none}
@keyframes sfGlow{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes sfFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes sfCap{50%{box-shadow:0 0 1.1em rgba(255,240,210,.95)}}
@keyframes sfWob{from{transform:translate(-50%,-66%) rotate(-1.2deg) translateX(-3px)}to{transform:translate(-50%,-66%) rotate(1.2deg) translateX(3px)}}
@keyframes sfTw{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.6);opacity:.5}}
@media (prefers-reduced-motion:reduce){.sf-glow,.sf-tagi,.sf-cap,.sf-silk,.sf-star{animation:none}.sf-view{transition:none}}
.sf-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5}
.sf-top{position:absolute;left:0;right:0;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 0 max(14px,env(safe-area-inset-left));pointer-events:none}
.sf-back,.sf-snd{pointer-events:auto;width:38px;height:38px;padding:0;border-radius:50%;border:1px solid rgba(255,215,122,.55);background:rgba(36,10,20,.55);color:#ffd77a;line-height:1;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.sf-back{font-size:24px;padding-bottom:3px}.sf-snd{font-size:16px}.sf-snd.off{opacity:.55;font-size:13px}
.sf-cd{padding:5px 16px 6px;border-radius:14px;text-align:center;background:rgba(36,10,20,.5);border:1px solid rgba(255,215,122,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.sf-cd small{display:block;font-size:10.5px;color:rgba(255,243,220,.7)}
.sf-cd b{font:700 17px/1.3 "PingFang SC",sans-serif;color:#ffd77a;letter-spacing:.06em;font-variant-numeric:tabular-nums}
`);

  SF.injectChatCss(); // 所有模块都加载完后，把聊天卡片样式常驻注入
})(window.__SF);

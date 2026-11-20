/* 首页场景：四个时段的背景图 + 嵌在建筑上的功能入口 + 倒计时 + 点天空放烟花 */
(function (SF) {
  "use strict";
  // 入口位置：box = [左, 上, 右, 下]，单位是场景图的像素（按 1220×2576 的基准量的）
  var SPOTS = [
    { id: "watch", label: "守岁", box: [340, 760, 580, 990], sh: "round", act: function () { SF.watch.open(); } },
    { id: "stage", label: "春晚", box: [780, 765, 1200, 1095], sh: "round", tag: [.5, .62], locked: 1 },
    { id: "tree", label: "年度回忆", box: [15, 980, 455, 1335], sh: "ellipse", tag: [.5, .4], locked: 1 },
    { id: "drum", label: "打年兽", box: [450, 1125, 845, 1315], sh: "ellipse", locked: 1 },
    { id: "stall", label: "红包", box: [905, 1235, 1175, 1425], sh: "round", act: function () { SF.rp.openStall(); } },
    { id: "board", label: "春联", box: [655, 1360, 915, 1605], sh: "round", locked: 1 },
    { id: "cut", label: "剪纸", box: [920, 1475, 1220, 1795], sh: "round", tag: [.45, .5], act: function () { SF.pc.open(); } },
    { id: "lantern", label: "灯谜", box: [55, 1360, 395, 1585], sh: "round", locked: 1 },
    { id: "home", label: "走亲戚", box: [75, 1585, 725, 2055], sh: "round", locked: 1 },
    { id: "gate", label: "集五福", box: [575, 2035, 1090, 2495], sh: "round", tag: [.5, .38], act: function () { SF.fortune.open(); } },
    { id: "shed", label: "测试", box: [105, 1915, 325, 2095], sh: "round", act: function () { SF.test.open(); } }
  ];
  var IMG = { morning: "morning.png", noon: "noon.png", dusk: "dusk.png", night: "night.png" };
  var S = {};

  function pct(v, base) { return (v / base * 100).toFixed(3) + "%"; }

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
    function apply(src) {
      if (S.bg !== bg) return;
      bg.style.backgroundImage = 'url("' + src + '")'; bg.style.opacity = 1;
    }
    function giveUp() { if (S.bg === bg) bg.style.opacity = 1; }
    bg.style.opacity = 0;
    tryLoad(IMG[p], apply, function () {
      if (p !== "night") tryLoad(IMG.night, apply, giveUp); else giveUp();
    });
  }

  SF.app = {
    refreshScene: function () { loadScene(true); },
    mount: function (container, roche) {
      SF.setRoche(roche);
      SF.injectCss("sf-css-app", SF.cssApp);
      SF.injectChatCss();
      var root = SF.h("div", "roche-plugin-spring-festival sf-root");
      root.innerHTML =
        '<div class="sf-view"><div class="sf-scene"><div class="sf-bg"></div></div></div>' +
        '<canvas class="sf-fx"></canvas>' +
        '<div class="sf-top"><button class="sf-back" type="button" aria-label="返回">‹</button><div class="sf-cd"><small>距新春零点</small><b>--</b></div></div>';
      container.replaceChildren(root);
      SF.appRoot = root;
      var view = root.querySelector(".sf-view"), scene = root.querySelector(".sf-scene");
      S = { root: root, bg: scene.querySelector(".sf-bg"), period: null, prev: null };

      var byId = {};
      SPOTS.forEach(function (s, i) {
        byId[s.id] = s;
        var b = s.box, tag = s.tag || [.5, .5];
        var el = SF.h("button", "sf-spot sf-sh-" + s.sh + (s.locked ? " lock" : ""));
        el.type = "button"; el.dataset.id = s.id;
        el.style.cssText = "left:" + pct(b[0], SF.IW) + ";top:" + pct(b[1], SF.IH) + ";width:" + pct(b[2] - b[0], SF.IW) + ";height:" + pct(b[3] - b[1], SF.IH);
        el.innerHTML = '<i class="sf-glow" style="animation-delay:' + (i * 0.37).toFixed(2) + 's"></i><span class="sf-tag" style="left:' + tag[0] * 100 + "%;top:" + tag[1] * 100 + "%;animation-delay:" + (i * 0.29).toFixed(2) + 's">' + s.label + (s.locked ? "<small>即将开放</small>" : "") + "</span>";
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

      root.addEventListener("pointerdown", function () { SF.audio.unlock(); }, { once: true });
      root.querySelector(".sf-back").onclick = function () { try { roche.ui.closeApp(); } catch (e) {} };

      scene.addEventListener("click", function (e) {
        var b = e.target.closest(".sf-spot");
        if (b) {
          var s = byId[b.dataset.id];
          if (s.locked) { SF.toast(s.label + "：即将开放"); return; }
          SF.audio.unlock();
          try { s.act(); } catch (err) { console.error(err); SF.toast("出错了：" + (err.message || err)); }
          return;
        }
        var r = scene.getBoundingClientRect();
        if ((e.clientY - r.top) / r.height > 0.42) return; // 只有天空区域响应
        var rr = root.getBoundingClientRect();
        SF.fx.launch(e.clientX - rr.left, e.clientY - rr.top);
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

  SF.cssApp.push([
    '.roche-plugin-spring-festival{position:relative;display:flex;flex-direction:column;width:calc(100% + env(safe-area-inset-left) + env(safe-area-inset-right));height:calc(100% + env(safe-area-inset-top) + env(safe-area-inset-bottom));margin:calc(0px - env(safe-area-inset-top)) calc(0px - env(safe-area-inset-right)) calc(0px - env(safe-area-inset-bottom)) calc(0px - env(safe-area-inset-left));min-width:0;min-height:0;overflow:hidden;background:#141a3c;color:#fff3dc;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;-webkit-user-select:none;user-select:none}',
    ".roche-plugin-spring-festival *{box-sizing:border-box}",
    ".sf-view{position:absolute;inset:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch}",
    ".sf-scene{position:relative}",
    ".sf-bg{position:absolute;inset:0;background:linear-gradient(#141a3c,#2a2450) center/100% 100% no-repeat;background-size:100% 100%;opacity:0;transition:opacity .6s}",
    ".sf-spot{position:absolute;margin:0;padding:0;border:0;background:none;outline:0;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".sf-sh-ellipse{border-radius:50%}.sf-sh-round{border-radius:18%}",
    ".sf-glow{position:absolute;inset:-6%;border-radius:inherit;pointer-events:none;background:radial-gradient(closest-side,rgba(255,214,120,.34),rgba(255,214,120,0) 74%);animation:sfGlow 3.4s ease-in-out infinite}",
    ".sf-spot.lock .sf-glow{background:radial-gradient(closest-side,rgba(150,160,220,.16),rgba(150,160,220,0) 72%)}",
    '.sf-tag{position:absolute;transform:translate(-50%,-50%);padding:4px 11px 5px;border-radius:999px;white-space:nowrap;text-align:center;background:linear-gradient(180deg,rgba(130,26,34,.93),rgba(78,14,24,.93));border:1px solid #e9bd62;color:#ffe3a1;font:600 13px/1.15 "STKaiti","KaiTi","Songti SC",serif;letter-spacing:.1em;box-shadow:0 2px 10px rgba(0,0,0,.45);animation:sfFloat 3.6s ease-in-out infinite}',
    ".sf-spot.lock .sf-tag{background:rgba(40,42,70,.85);border-color:#8d8aa5;color:#c9c6dc}",
    ".sf-tag small{display:block;margin-top:2px;font:400 9px/1.2 -apple-system,sans-serif;letter-spacing:0;opacity:.8}",
    "@keyframes sfGlow{0%,100%{opacity:.3}50%{opacity:1}}",
    "@keyframes sfFloat{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,calc(-50% - 3px))}}",
    "@media (prefers-reduced-motion:reduce){.sf-glow,.sf-tag{animation:none}}",
    ".sf-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5}",
    ".sf-top{position:absolute;left:0;right:0;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 0 max(14px,env(safe-area-inset-left));pointer-events:none}",
    ".sf-top::after{content:'';width:38px}",
    ".sf-back{pointer-events:auto;width:38px;height:38px;padding:0 0 3px;border-radius:50%;border:1px solid rgba(255,215,122,.55);background:rgba(36,10,20,.55);color:#ffd77a;font-size:24px;line-height:1;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}",
    ".sf-cd{padding:5px 16px 6px;border-radius:14px;text-align:center;background:rgba(36,10,20,.5);border:1px solid rgba(255,215,122,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}",
    ".sf-cd small{display:block;font-size:10.5px;color:rgba(255,243,220,.7)}",
    '.sf-cd b{font:700 17px/1.3 "STKaiti","KaiTi","Songti SC",serif;color:#ffd77a;letter-spacing:.06em;font-variant-numeric:tabular-nums}'
  ].join("\n"));

  SF.injectChatCss(); // 所有模块都加载完后，把聊天卡片样式常驻注入
})(window.__SF);

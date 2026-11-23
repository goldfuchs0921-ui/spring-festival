/* 剪纸窗花：手指在红纸上剪，自动 2/4/8 折对称展开。可存作品墙、导出图片、发给角色。 */
(function (SF) {
  "use strict";
  var S = 512, COLORS = ["#c8202b", "#e0402f", "#9a1624"], WIDTHS = [7, 13, 24];

  function shrink(src, px, q) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        var c = document.createElement("canvas"); c.width = c.height = px;
        c.getContext("2d").drawImage(im, 0, 0, px, px); res(c.toDataURL("image/jpeg", q || 0.82));
      };
      im.onerror = function () { res(src); }; im.src = src;
    });
  }
  async function exportImg(item) {
    try {
      var b = await (await fetch(item.img)).blob(), f = new File([b], "新春窗花.jpg", { type: b.type });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    var a = document.createElement("a"); a.href = item.img; a.download = "新春窗花.jpg";
    document.body.appendChild(a); a.click(); a.remove();
    SF.toast("没有自动保存的话，请长按图片保存到相册");
  }
  async function sendTo(item) {
    var convs = []; try { convs = (await SF.roche.conversation.list()) || []; } catch (e) {}
    var L = SF.layer(SF.appRoot, "发给谁", { k: "PAPERCUT", key: "sendTo" });
    if (!L) return;
    L.body.innerHTML = '<p class="tip">选一个聊天，窗花会作为卡片发过去（我发的，角色能读到一句描述）。</p>' + (convs.map(function (c, i) {
      return '<span class="sfchip" data-i="' + i + '">' + SF.esc(c.name || c.title || c.handle || "聊天") + "</span>";
    }).join("") || '<p class="tip">没有读取到聊天</p>');
    L.body.onclick = async function (e) {
      var a = e.target.closest("[data-i]"); if (!a) return;
      var c = convs[+a.dataset.i]; a.textContent = "发送中…";
      try {
        var small = await shrink(item.img, 360, 0.8);
        await SF.roche.chat.createCard({
          conversationId: c.id || c.conversationId, messageType: "paper-cut", isMe: true,
          cardData: { img: small, fold: item.fold, name: item.name || "", desc: item.desc || "", shape: item.shape || "sq" },
          modelText: "我剪了一张名叫《" + (item.name || "窗花") + "》的新春窗花送给你（" + item.fold + "折对称剪纸，" + (item.shape === "ci" ? "圆形" : "方形") + "）" + descOf(item) + "。"
        });
        SF.toast("已发送"); L.close();
      } catch (err) { SF.toast("发送失败：" + (err.message || err)); a.textContent = SF.esc(c.name || c.title || "聊天"); }
    };
  }

  function askName(def) {
    return new Promise(function (res) {
      var done = false, L = SF.layer(SF.appRoot, "给作品起个名字", { k: "PAPERCUT", key: "pcName", onClose: function () { if (!done) { done = true; res(null); } } });
      if (!L) { res(null); return; }
      L.body.innerHTML = '<input type="text" maxlength="12" placeholder="最多12个字" value="' + SF.esc(def) + '"><div class="sfrow" style="margin-top:14px;justify-content:center"><button class="sfb">保存</button></div>';
      var inp = L.body.querySelector("input");
      setTimeout(function () { inp.focus(); inp.select(); }, 320);
      L.body.querySelector("button").onclick = function () { var v = inp.value.trim().slice(0, 12) || def; done = true; L.close(); res(v); };
    });
  }

  function loadImg(src) {
    return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; });
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function dateStr(t) { var d = new Date(t); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; }
  function descOf(it) { return (it.desc ? "，画面是：" + it.desc : ""); }

  // 拼贴版式：每格都是正方形（圆形窗花显示成圆）。[x, y, 边长, 旋转角]，都按画板宽度的比例；h = 画板高/宽
  var TPL = [
    { id: 1, h: 1, c: [[0, 0, .5], [.5, 0, .5], [0, .5, .5], [.5, .5, .5]] },
    { id: 2, h: 1, c: [[0, 0, 2 / 3], [2 / 3, 0, 1 / 3], [2 / 3, 1 / 3, 1 / 3], [0, 2 / 3, 1 / 3], [1 / 3, 2 / 3, 1 / 3], [2 / 3, 2 / 3, 1 / 3]] },
    { id: 3, h: 1, c: [[0, 0, 1 / 3], [1 / 3, 0, 1 / 3], [2 / 3, 0, 1 / 3], [0, 1 / 3, 2 / 3], [2 / 3, 1 / 3, 1 / 3], [2 / 3, 2 / 3, 1 / 3]] },
    { id: 4, h: 1 / 3, c: [[0, 0, 1 / 3], [1 / 3, 0, 1 / 3], [2 / 3, 0, 1 / 3]] },
    { id: 5, h: 1.5, c: [[0, 0, .5], [.5, 0, .5], [0, .5, .5], [.5, .5, .5], [0, 1, .5], [.5, 1, .5]] },
    { id: 6, h: 1, c: [[.02, .04, .52], [.46, .44, .52]] },
    { id: 7, h: 1, c: [[.04, .04, .62, -6], [.34, .34, .62, 5]] },
    { id: 8, h: 1, c: [[0, 0, 1]] }
  ];

  // ---------- 查看页：大图左右滑动 + 底部缩略图条 ----------
  function viewer(items, start, onClose) {
    if (SF._viewer && SF._viewer.parentNode) return; // 已经开着：不重复开
    var idx = Math.max(0, Math.min(start, items.length - 1)), busy = 0, closed = false;
    var V = SF.h("div", "sfv " + SF.themeCls());
    V.style.zIndex = SF.zTop(); SF._viewer = V; // 盖在所有已打开的弹窗上面
    V.innerHTML = '<div class="sfv-bg"></div>' +
      '<div class="sfv-top"><button class="sfv-x" type="button">✕</button><span class="sfv-cnt"></span><button class="sfv-hr" type="button">♡</button></div>' +
      '<div class="sfv-stage"><div class="sfv-pg" data-s="p"><img draggable="false"></div><div class="sfv-pg" data-s="c"><img draggable="false"></div><div class="sfv-pg" data-s="n"><img draggable="false"></div></div>' +
      '<div class="sfv-info"><div class="sfv-meta"><small>PAPERCUT</small><em></em></div><div class="sfv-name"><b></b><button class="sfv-ed" type="button">✎</button></div>' +
      '<p class="sfv-desc" data-a="ds"></p><p class="sfv-sub"></p>' +
      '<div class="sfrow" style="gap:10px;margin-top:14px"><button class="sfb" style="flex:1" data-a="s" type="button">发给 TA</button><button class="sfb ghost" style="flex:1" data-a="x" type="button">导出</button></div>' +
      '<div class="sfv-more"><span class="sf-lnk" data-a="sh"></span><span class="sf-lnk" data-a="d">删除</span></div></div>' +
      '<div class="sfv-strip"></div>';
    SF.appRoot.appendChild(V);
    var stage = V.querySelector(".sfv-stage"), strip = V.querySelector(".sfv-strip"), bgEl = V.querySelector(".sfv-bg"), pg = {};
    [].forEach.call(V.querySelectorAll(".sfv-pg"), function (e) { pg[e.dataset.s] = e; });

    function persist() { return SF.st.set("cuts", items); }
    function setImg(el, it) {
      var im = el.querySelector("img");
      if (it) { if (im.getAttribute("src") !== it.img) im.src = it.img; el.style.visibility = ""; el.classList.toggle("ci", it.shape === "ci"); } else el.style.visibility = "hidden";
    }
    function fill() { setImg(pg.p, items[idx - 1]); setImg(pg.c, items[idx]); setImg(pg.n, items[idx + 1]); }
    // 页面位置完全由手指位移 dx 决定；松手后的动画只是把 dx 推到终点
    function place(dx, anim) {
      var w = stage.clientWidth || 1, p = Math.min(1, Math.abs(dx) / w);
      var tr = anim ? "transform .34s cubic-bezier(.22,1,.36,1),opacity .34s" : "none";
      ["p", "c", "n"].forEach(function (k) { pg[k].style.transition = tr; });
      pg.c.style.transform = "translateX(" + dx + "px) scale(" + (1 - 0.08 * p) + ")"; pg.c.style.opacity = 1 - 0.35 * p;
      pg.p.style.transform = "translateX(" + (dx - w) + "px) scale(" + (dx > 0 ? 0.92 + 0.08 * p : 0.92) + ")"; pg.p.style.opacity = dx > 0 ? 0.65 + 0.35 * p : 0.65;
      pg.n.style.transform = "translateX(" + (dx + w) + "px) scale(" + (dx < 0 ? 0.92 + 0.08 * p : 0.92) + ")"; pg.n.style.opacity = dx < 0 ? 0.65 + 0.35 * p : 0.65;
    }
    function info() {
      var it = items[idx];
      V.querySelector(".sfv-cnt").textContent = (idx + 1) + " / " + items.length;
      V.querySelector(".sfv-meta em").textContent = pad2(idx + 1) + " / " + pad2(items.length);
      V.querySelector(".sfv-name b").textContent = it.name || "窗花";
      var d = V.querySelector(".sfv-desc"); d.textContent = it.desc || "点此添加描述"; d.classList.toggle("empty", !it.desc);
      V.querySelector(".sfv-sub").textContent = it.fold + " 折 · " + (it.shape === "ci" ? "圆形" : "方形") + " · " + dateStr(it.t);
      V.querySelector('[data-a="sh"]').textContent = it.shape === "ci" ? "改为方形显示" : "改为圆形显示";
      var hr = V.querySelector(".sfv-hr"); hr.textContent = it.fav ? "♥" : "♡"; hr.classList.toggle("on", !!it.fav);
    }

    // ----- 底部缩略图条：滚动聚焦 -----
    var prog = 0, tmr = 0;
    function buildStrip() {
      strip.innerHTML = items.map(function (x, i) { return '<div class="sfv-t' + (x.shape === "ci" ? " ci" : "") + '" data-i="' + i + '"><img src="' + x.img + '" draggable="false">' + (x.fav ? "<u>♥</u>" : "") + "</div>"; }).join("");
      focus();
    }
    function focus() {
      var mid = strip.scrollLeft + strip.clientWidth / 2, best = 0, bd = 1e9;
      [].forEach.call(strip.querySelectorAll(".sfv-t"), function (t, i) {
        var d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - mid), k = Math.max(0, 1 - d / 120);
        t.style.transform = "scale(" + (0.82 + 0.4 * k) + ")"; t.style.opacity = 0.45 + 0.55 * k;
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }
    function scrollStrip(i, smooth) {
      var t = strip.querySelectorAll(".sfv-t")[i]; if (!t) return;
      prog = 1; clearTimeout(tmr);
      strip.scrollTo({ left: t.offsetLeft + t.offsetWidth / 2 - strip.clientWidth / 2, behavior: smooth ? "smooth" : "auto" });
      setTimeout(function () { prog = 0; focus(); }, smooth ? 480 : 60);
    }
    strip.addEventListener("scroll", function () {
      focus(); if (prog) return;
      clearTimeout(tmr);
      tmr = setTimeout(function () { var b = focus(); if (b !== idx) goTo(b, true, true); }, 120);
    }, { passive: true });
    strip.addEventListener("click", function (e) { var t = e.target.closest(".sfv-t"); if (t) { goTo(+t.dataset.i, true); scrollStrip(+t.dataset.i, true); } });

    function goTo(n, animate, fromStrip) {
      n = Math.max(0, Math.min(items.length - 1, n)); if (n === idx || busy) return;
      var dir = n > idx ? 1 : -1;
      if (SF.sfx) SF.sfx.tap();
      if (animate && Math.abs(n - idx) === 1 && !SF.reduce()) {
        busy = 1; place(-dir * stage.clientWidth, true);
        setTimeout(function () { idx = n; fill(); place(0, false); info(); busy = 0; if (!fromStrip) scrollStrip(idx, true); }, 340);
      } else { idx = n; fill(); place(0, false); info(); if (!fromStrip) scrollStrip(idx, true); }
    }

    // ----- 手势：横向翻页 / 向下拖动关闭 -----
    var x0 = 0, y0 = 0, dx = 0, dy = 0, axis = "", drag = false, vx = SF.velo(), vy = SF.velo();
    stage.addEventListener("pointerdown", function (e) {
      if (busy || closed) return;
      drag = true; axis = ""; x0 = e.clientX; y0 = e.clientY; dx = dy = 0; vx = SF.velo(); vy = SF.velo(); vx.add(e.clientX); vy.add(e.clientY);
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
    });
    stage.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var mx = e.clientX - x0, my = e.clientY - y0;
      if (!axis) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; axis = Math.abs(mx) > Math.abs(my) ? "x" : "y"; }
      if (axis === "x") {
        dx = mx; vx.add(e.clientX);
        var edge = (dx > 0 && idx === 0) || (dx < 0 && idx === items.length - 1);
        place(edge ? dx * 0.3 : dx, false);
      } else {
        dy = Math.max(0, my); vy.add(e.clientY);
        var k = Math.min(1, dy / (V.clientHeight * 0.5));
        V.style.transition = "none"; V.style.transform = "translateY(" + dy + "px) scale(" + (1 - 0.12 * k) + ")"; bgEl.style.opacity = 1 - 0.8 * k;
      }
    });
    function up() {
      if (!drag) return; drag = false;
      if (axis === "x") {
        var w = stage.clientWidth, v = vx.get(), dir = dx < 0 ? 1 : -1;
        var can = (dir === 1 && idx < items.length - 1) || (dir === -1 && idx > 0);
        var fast = Math.abs(v) > 500 && (v < 0) === (dx < 0);
        if (can && (Math.abs(dx) > w * 0.5 || fast)) goTo(idx + dir, true);
        else { place(0, true); }
      } else if (axis === "y") {
        var v2 = vy.get(), H = V.clientHeight;
        if (dy > H * 0.25 || v2 > 500) closeV();
        else { V.style.transition = "transform .34s cubic-bezier(.22,1,.36,1)"; V.style.transform = ""; bgEl.style.opacity = ""; setTimeout(function () { V.style.transition = ""; }, 360); }
      }
    }
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);

    function closeV() {
      if (closed) return; closed = true;
      if (SF._viewer === V) SF._viewer = null;
      V.style.transition = "transform .3s cubic-bezier(.5,0,.8,.4),opacity .3s"; V.style.transform = "translateY(" + V.clientHeight * 0.4 + "px) scale(.85)"; V.style.opacity = 0;
      setTimeout(function () { V.remove(); }, 320);
      if (onClose) onClose();
    }
    V.querySelector(".sfv-x").onclick = closeV;
    V.querySelector(".sfv-hr").onclick = function () { var it = items[idx]; it.fav = !it.fav; persist(); info(); buildStrip(); scrollStrip(idx, false); };
    V.querySelector(".sfv-ed").onclick = function () {
      var nb = V.querySelector(".sfv-name b"), it = items[idx], done = false;
      var inp = SF.h("input", "sfv-in"); inp.type = "text"; inp.maxLength = 12; inp.value = it.name || "窗花";
      nb.replaceWith(inp); inp.focus(); inp.select();
      function fin() {
        if (done) return; done = true;
        it.name = inp.value.trim().slice(0, 12) || it.name || "窗花"; persist();
        var b = SF.h("b"); b.textContent = it.name; inp.replaceWith(b); info();
      }
      inp.onblur = fin; inp.onkeydown = function (e) { if (e.key === "Enter") inp.blur(); };
    };
    function editDesc() {
      var d = V.querySelector(".sfv-desc"), it = items[idx], done = false;
      var ta = SF.h("textarea", "sfv-ta"); ta.rows = 2; ta.maxLength = 40; ta.placeholder = "这张窗花剪的是什么？（40字内）"; ta.value = it.desc || "";
      d.replaceWith(ta); ta.focus();
      function fin() {
        if (done) return; done = true;
        it.desc = ta.value.trim().slice(0, 40); persist();
        var p = SF.h("p", "sfv-desc"); p.dataset.a = "ds"; ta.replaceWith(p); info();
      }
      ta.onblur = fin;
    }
    V.querySelector(".sfv-info").addEventListener("click", async function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var a = b.dataset.a, it = items[idx];
      if (a === "ds") editDesc();
      else if (a === "x") exportImg(it);
      else if (a === "s") sendTo(it);
      else if (a === "sh") { it.shape = it.shape === "ci" ? "sq" : "ci"; persist(); fill(); info(); buildStrip(); scrollStrip(idx, false); }
      else if (a === "d") {
        if (!(await SF.confirm("删除窗花", "确定删除这张窗花吗？"))) return;
        var gone = items.splice(idx, 1)[0]; await persist();
        var ws = await SF.st.get("cut_wall", null);
        if (ws && ws.cells) { Object.keys(ws.cells).forEach(function (k) { if (ws.cells[k] === gone.id) delete ws.cells[k]; }); await SF.st.set("cut_wall", ws); }
        if (!items.length) { closeV(); return; }
        idx = Math.min(idx, items.length - 1); buildStrip(); fill(); place(0, false); info(); scrollStrip(idx, false);
      }
    });

    fill(); place(0, false); info(); buildStrip();
    requestAnimationFrame(function () { requestAnimationFrame(function () { V.classList.add("in"); scrollStrip(idx, false); }); });
  }

  // ---------- 作品墙：拼贴版式 ----------
  async function wall() {
    var L = SF.layer(SF.appRoot, "作品墙", { full: true, k: "GALLERY", key: "wall" });
    if (!L) return;
    var items = await SF.st.get("cuts", []);
    var st = await SF.st.get("cut_wall", { tpl: 3, cells: {} });
    if (!st.cells) st.cells = {};
    function tpl() { return TPL.filter(function (t) { return t.id === st.tpl; })[0] || TPL[2]; }
    // 每个格子放哪张：用户指定的优先；没指定(undefined)的按最新作品自动补；清空(null)的留空
    function assign() {
      var t = tpl(), used = {}, out = [];
      t.c.forEach(function (_, i) { if (st.cells[i] != null) used[st.cells[i]] = 1; });
      var pool = items.filter(function (x) { return !used[x.id]; });
      t.c.forEach(function (_, i) {
        var id = st.cells[i], w = null;
        if (id != null) w = items.filter(function (x) { return x.id === id; })[0] || null;
        else if (id === undefined) w = pool.shift() || null;
        out.push(w);
      });
      return out;
    }
    function geo(c, h) { return "left:" + c[0] * 100 + "%;top:" + c[1] / h * 100 + "%;width:" + c[2] * 100 + "%;height:" + c[2] / h * 100 + "%" + (c[3] ? ";transform:rotate(" + c[3] + "deg)" : ""); }
    function render() {
      var t = tpl(), as = assign();
      var icons = TPL.map(function (x) {
        return '<button class="sfp-ti' + (x.id === t.id ? " on" : "") + '" data-t="' + x.id + '" type="button"><span class="ib" style="width:30px;height:' + (30 * x.h).toFixed(1) + 'px">' +
          x.c.map(function (c) { return '<i style="' + geo(c, x.h) + '"></i>'; }).join("") + "</span></button>";
      }).join("");
      var h = '<div class="sfrow-h"><div class="sfrow-in sfp-tpl">' + icons + "</div></div>";
      h += '<div class="sfp-board" style="aspect-ratio:1/' + t.h + '">' + t.c.map(function (c, i) {
        var w = as[i];
        return '<div class="sfp-c' + (w && w.shape === "ci" ? " ci" : "") + '" data-c="' + i + '" style="' + geo(c, t.h) + '"><div class="sfp-ci">' +
          (w ? '<img src="' + w.img + '" draggable="false">' + (w.desc ? '<em class="sfp-cap">' + SF.esc(w.desc) + "</em>" : "") : "<span>+</span>") + "</div>" +
          (w ? '<button class="sfp-sw" data-sw="' + i + '" type="button">⇄</button>' : "") + "</div>";
      }).join("") + "</div>";
      h += '<div class="sfp-acts2"><button class="sfb" style="flex:1" data-a="exp" type="button">导出拼贴图</button><span class="sf-lnk" data-a="all">浏览全部 ' + items.length + "</span></div>";
      L.body.innerHTML = h; SF.fadeRows(L.body);
    }
    function pick(i) {
      if (!items.length) { SF.toast("还没有作品，先去剪一张"); return; }
      var P = SF.layer(SF.appRoot, "选择窗花", { k: "GALLERY", key: "pcPick" });
      if (!P) return;
      P.body.innerHTML = '<div class="sfp-wall">' + items.map(function (x, k) {
        return '<div class="sfp-it" data-k="' + k + '"><div class="sfp-th' + (x.shape === "ci" ? " ci" : "") + '"><img src="' + x.img + '" draggable="false"></div><small>' + SF.esc(x.name || "窗花") + "</small></div>";
      }).join("") + '</div><div class="sfrow" style="justify-content:center;margin-top:14px"><span class="sf-lnk" data-a="clr">清空这一格</span></div>';
      P.body.onclick = async function (e) {
        var a = e.target.closest("[data-k],[data-a]"); if (!a) return;
        st.cells[i] = a.dataset.a === "clr" ? null : items[+a.dataset.k].id;
        await SF.st.set("cut_wall", st); P.close(); render();
      };
    }
    async function exportCollage() {
      var t = tpl(), as = assign();
      if (!as.some(Boolean)) { SF.toast("还没有放入窗花"); return; }
      var Wd = 1080, pad = 48, bw = Wd - pad * 2, bh = bw * t.h, Ht = Math.round(bh + pad * 2 + 64);
      var cv = document.createElement("canvas"); cv.width = Wd; cv.height = Ht;
      var g = cv.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, Ht);
      gr.addColorStop(0, "#f6e6c8"); gr.addColorStop(1, "#efd3b0"); g.fillStyle = gr; g.fillRect(0, 0, Wd, Ht);
      for (var i = 0; i < t.c.length; i++) {
        var w = as[i]; if (!w) continue;
        var c = t.c[i], sz = c[2] * bw - 16, cx = pad + c[0] * bw + c[2] * bw / 2, cy = pad + c[1] * bw + c[2] * bw / 2;
        var im = await loadImg(w.img); if (!im) continue;
        g.save(); g.translate(cx, cy); if (c[3]) g.rotate(c[3] * Math.PI / 180);
        if (w.shape === "ci") { g.beginPath(); g.arc(0, 0, sz / 2, 0, 7); g.closePath(); } else rrect(g, -sz / 2, -sz / 2, sz, sz, sz * 0.08);
        g.clip(); g.drawImage(im, -sz / 2, -sz / 2, sz, sz);
        if (w.desc) {
          g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(-sz / 2, sz / 2 - 46, sz, 46);
          g.fillStyle = "#fff"; g.font = '24px "PingFang SC",sans-serif'; g.textAlign = "center"; g.fillText(w.desc.slice(0, 16), 0, sz / 2 - 14);
        }
        g.restore();
      }
      g.fillStyle = "rgba(150,40,30,.75)"; g.font = '30px "PingFang SC",sans-serif'; g.textAlign = "center"; g.fillText("新春窗花", Wd / 2, Ht - pad + 4);
      var url = cv.toDataURL("image/jpeg", 0.92), P = SF.layer(SF.appRoot, "拼贴图", { k: "GALLERY", key: "pcCollage" });
      if (!P) return;
      P.body.innerHTML = '<div class="sfp-big"><img src="' + url + '"></div><button class="sfb block" style="margin-top:14px" type="button">导出 / 分享</button>';
      P.body.querySelector("button").onclick = function () { exportImg({ img: url }); };
    }
    L.body.onclick = async function (e) {
      var t = e.target.closest("[data-t],[data-sw],[data-c],[data-a]"); if (!t) return;
      var reload = async function () { st = (await SF.st.get("cut_wall", st)) || st; if (!st.cells) st.cells = {}; render(); };
      if (t.dataset.t) { st.tpl = +t.dataset.t; await SF.st.set("cut_wall", st); render(); }
      else if (t.dataset.sw != null) pick(+t.dataset.sw);
      else if (t.dataset.c != null) {
        var i = +t.dataset.c, w = assign()[i];
        if (w) viewer(items, items.indexOf(w), reload); else pick(i);
      } else if (t.dataset.a === "exp") exportCollage();
      else if (t.dataset.a === "all") { if (items.length) viewer(items, 0, reload); else SF.toast("还没有作品"); }
    };
    render();
  }

  SF.pc = {
    wall: wall,
    // ---------- 聊天里的窗花卡片 ----------
    mountCard: function (c, m, r) {
      SF.setRoche(r);
      var cd = m.cardData || {};
      var d = SF.h("div", "sfc-pc", '<img draggable="false"><span>' + SF.esc(cd.name ? "《" + cd.name + "》" : "新春窗花") + " · " + SF.esc(cd.fold || "") + "折</span>" + (cd.desc ? "<em>" + SF.esc(cd.desc) + "</em>" : ""));
      if (cd.shape === "ci") d.classList.add("ci");
      d.querySelector("img").src = cd.img || "";
      c.replaceChildren(d);
    },
    // ---------- 剪纸摊 ----------
    open: function () {
      var L = SF.layer(SF.appRoot, "剪纸摊", { full: true, k: "PAPERCUT" });
      var fold = 4, circle = false, color = 0, tool = "line", wi = 1, hist = [], drawing = false, last = null, lastSnd = 0;
      L.body.innerHTML =
        '<div class="sf-card sfp-set">' +
        '<div class="sfp-bar" data-g="fold"><b>折数</b><span class="sfchip" data-v="2">2折</span><span class="sfchip on" data-v="4">4折</span><span class="sfchip" data-v="8">8折</span></div>' +
        '<div class="sfp-bar" data-g="shape"><b>形状</b><span class="sfchip on" data-v="sq">方形</span><span class="sfchip" data-v="ci">圆形</span><span class="sfp-sp"></span>' +
        '<i class="sfp-dot on" data-g="color" data-v="0" style="background:#c8202b"></i><i class="sfp-dot" data-g="color" data-v="1" style="background:#e0402f"></i><i class="sfp-dot" data-g="color" data-v="2" style="background:#9a1624"></i></div></div>' +
        '<div class="sfp-stage"><canvas class="sfp-cv" width="' + S + '" height="' + S + '"></canvas></div>' +
        '<div class="sfp-mini"><span class="sf-lnk" data-a="undo">↶ 撤销</span><span class="sf-lnk" data-a="clear">清空</span></div>' +
        '<div class="sf-card sfp-set">' +
        '<div class="sfp-bar" data-g="tool"><b>剪法</b><span class="sfchip on" data-v="line">画线</span><span class="sfchip" data-v="dot">圆点</span><span class="sfchip" data-v="diamond">菱形</span><span class="sfchip" data-v="star">星</span></div>' +
        '<div class="sfp-bar" data-g="size"><b>粗细</b><span class="sfchip" data-v="0">细</span><span class="sfchip on" data-v="1">中</span><span class="sfchip" data-v="2">粗</span></div></div>' +
        '<div class="sfrow sfp-acts"><button class="sfb ghost" data-a="wall" type="button">作品墙</button><button class="sfb" style="flex:1" data-a="save" type="button">保存到作品墙</button></div>';
      var cv = L.body.querySelector(".sfp-cv"), g = cv.getContext("2d");
      var m = document.createElement("canvas"); m.width = m.height = S;
      var mg = m.getContext("2d");

      function sym(x, y) {
        var a = [[x, y]];
        if (fold >= 2) a.push([S - x, y]);
        if (fold >= 4) a.push([x, S - y], [S - x, S - y]);
        if (fold >= 8) a.push([y, x], [S - y, x], [y, S - x], [S - y, S - x]);
        return a;
      }
      function render(guides) {
        g.clearRect(0, 0, S, S); g.save();
        if (circle) { g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 6, 0, 7); g.clip(); }
        g.fillStyle = COLORS[color]; g.fillRect(0, 0, S, S);
        g.globalCompositeOperation = "destination-out"; g.drawImage(m, 0, 0); g.restore();
        if (guides) {
          g.save(); g.strokeStyle = "rgba(255,226,154,.5)"; g.setLineDash([6, 8]); g.lineWidth = 1.5; g.beginPath();
          if (fold >= 2) { g.moveTo(S / 2, 0); g.lineTo(S / 2, S); }
          if (fold >= 4) { g.moveTo(0, S / 2); g.lineTo(S, S / 2); }
          if (fold >= 8) { g.moveTo(0, 0); g.lineTo(S, S); g.moveTo(S, 0); g.lineTo(0, S); }
          g.stroke(); g.restore();
        }
      }
      function seg(p, q) {
        var A = sym(p[0], p[1]), B = sym(q[0], q[1]);
        mg.lineCap = "round"; mg.lineWidth = WIDTHS[wi]; mg.strokeStyle = "#fff";
        for (var i = 0; i < A.length; i++) { mg.beginPath(); mg.moveTo(A[i][0], A[i][1]); mg.lineTo(B[i][0], B[i][1]); mg.stroke(); }
      }
      function stamp(x, y) {
        var r = WIDTHS[wi] * 1.2; mg.fillStyle = "#fff";
        sym(x, y).forEach(function (p) {
          mg.beginPath();
          if (tool === "dot") mg.arc(p[0], p[1], r, 0, 7);
          else if (tool === "diamond") { var d = r * 1.4; mg.moveTo(p[0], p[1] - d); mg.lineTo(p[0] + d, p[1]); mg.lineTo(p[0], p[1] + d); mg.lineTo(p[0] - d, p[1]); mg.closePath(); }
          else { var s = r * 1.8; mg.moveTo(p[0], p[1] - s); mg.quadraticCurveTo(p[0], p[1], p[0] + s, p[1]); mg.quadraticCurveTo(p[0], p[1], p[0], p[1] + s); mg.quadraticCurveTo(p[0], p[1], p[0] - s, p[1]); mg.quadraticCurveTo(p[0], p[1], p[0], p[1] - s); mg.closePath(); }
          mg.fill();
        });
      }
      function pos(e) { var b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * S / b.width, (e.clientY - b.top) * S / b.height]; }
      function snap() { hist.push(mg.getImageData(0, 0, S, S)); if (hist.length > 12) hist.shift(); }

      cv.addEventListener("pointerdown", function (e) {
        e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {}
        snap(); drawing = true; var p = pos(e); if (SF.sfx) SF.sfx.snip();
        if (tool === "line") { seg(p, p); last = p; } else stamp(p[0], p[1]);
        render(true);
      });
      cv.addEventListener("pointermove", function (e) {
        if (!drawing || tool !== "line") return;
        var p = pos(e); seg(last, p); last = p; render(true);
        var nw = performance.now(); if (SF.sfx && nw - lastSnd > 110) { lastSnd = nw; SF.sfx.shh(); }
      });
      var up = function () { drawing = false; last = null; };
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

      function snapshot(px) {
        render(false);
        var o = document.createElement("canvas"); o.width = o.height = px;
        var og = o.getContext("2d"); og.fillStyle = "#f5e6c8"; og.fillRect(0, 0, px, px); og.drawImage(cv, 0, 0, px, px);
        render(true); return o.toDataURL("image/jpeg", 0.86);
      }
      function mark(grp, val) {
        [].forEach.call(L.body.querySelectorAll('.sfp-bar[data-g="' + grp + '"] .sfchip,[data-g="' + grp + '"].sfp-dot'), function (n) {
          n.classList.toggle("on", n.dataset.v === String(val));
        });
      }
      L.body.addEventListener("click", async function (e) {
        var n = e.target.closest("[data-v],[data-a]"); if (!n) return;
        var grp = n.dataset.g || (n.parentNode && n.parentNode.dataset && n.parentNode.dataset.g);
        if (n.dataset.v != null && grp) {
          var v = n.dataset.v;
          if (grp === "fold") fold = +v; else if (grp === "shape") circle = v === "ci";
          else if (grp === "color") color = +v; else if (grp === "tool") tool = v; else if (grp === "size") wi = +v;
          if (grp === "shape") mark("shape", v); else mark(grp, v);
          if (grp === "fold") { mg.clearRect(0, 0, S, S); hist = []; }
          render(true);
        } else if (n.dataset.a === "undo") { var h = hist.pop(); if (h) { mg.putImageData(h, 0, 0); render(true); } }
        else if (n.dataset.a === "clear") { snap(); mg.clearRect(0, 0, S, S); render(true); }
        else if (n.dataset.a === "wall") wall();
        else if (n.dataset.a === "save") {
          var arr0 = await SF.st.get("cuts", []);
          var nm = await askName("窗花 " + (arr0.length + 1));
          if (nm == null) return;
          var arr = await SF.st.get("cuts", []);
          arr.unshift({ id: Date.now(), t: Date.now(), name: nm, fold: fold, shape: circle ? "ci" : "sq", desc: "", img: snapshot(640) });
          if (arr.length > 40) arr.length = 40;
          if (await SF.st.set("cuts", arr)) { SF.toast("已保存到作品墙"); if (SF.sfx) SF.sfx.save(); if (SF.fortune) SF.fortune.award("cut"); }
          else SF.toast("保存失败，存储空间可能不足");
        }
      });
      render(true);
    }
  };

  SF.cssApp.push(`
.sfp-set{margin-bottom:10px;padding:10px 14px}
.sfp-bar{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;margin:4px 0}.sfp-bar b{flex:0 0 40px;font-size:11px;font-weight:400;letter-spacing:.2em;color:var(--k)}.sfp-bar .sfchip{margin:0}.sfp-sp{flex:1}
.sfp-dot{width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.5);box-sizing:border-box}.sfp-dot.on{border-color:var(--btx);box-shadow:0 0 8px var(--acc)}
.sfp-stage{display:flex;justify-content:center;margin:12px 0 6px}
.sfp-cv{width:min(100%,44vh);aspect-ratio:1;touch-action:none;border-radius:8px;background:#f5e6c8;box-shadow:0 6px 22px rgba(0,0,0,.35)}
.sfp-mini{display:flex;justify-content:flex-end;gap:16px;margin:0 4px 10px}
.sfp-acts{margin-top:14px;gap:10px}.sfp-acts .sfb{white-space:nowrap}
.sfp-wall{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sfp-th{aspect-ratio:1;border-radius:12px;overflow:hidden;border:1.5px solid var(--cbd)}.sfp-th.ci{border-radius:50%}
.sfp-th img,.sfp-big img{width:100%;height:100%;display:block;object-fit:cover}
.sfp-big{border-radius:12px;overflow:hidden;border:1px solid var(--cbd)}
.sfp-it small{display:block;margin-top:5px;text-align:center;font-size:11.5px;color:var(--ctx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sfp-tpl{padding-top:6px}
.sfp-ti{position:relative;flex:0 0 46px;height:56px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;border:1.5px solid var(--cbd);background:var(--cbg);transition:transform .2s,border-color .2s}
.sfp-ti .ib{position:relative;display:block}
.sfp-ti i{position:absolute;border-radius:2px;background:var(--cbd);transform-origin:center}
.sfp-ti.on{border-color:var(--acc);transform:translateY(-2px) scale(1.06)}.sfp-ti.on i{background:var(--acc)}
.sfp-board{position:relative;width:100%;margin-top:12px;border-radius:18px;background:var(--card);border:1px solid var(--hair)}
.sfp-c{position:absolute}
.sfp-ci{position:absolute;inset:4px;border-radius:14%;overflow:hidden;background:rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;color:var(--k);font-size:26px;box-shadow:0 2px 10px rgba(0,0,0,.16)}
.sfp-c.ci .sfp-ci{border-radius:50%}
.sfp-ci img{width:100%;height:100%;object-fit:cover;display:block}
.sfp-cap{position:absolute;left:0;right:0;bottom:0;padding:16px 8px 6px;font-style:normal;font-size:10.5px;text-align:center;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.55));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sfp-c.ci .sfp-cap{left:16%;right:16%;bottom:12%;padding:3px 6px;border-radius:8px;background:rgba(0,0,0,.45)}
.sfp-sw{position:absolute;right:8px;bottom:8px;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;font-size:12px;line-height:24px}
.sfp-c.ci .sfp-sw{right:14%;bottom:14%}
.sfp-acts2{display:flex;align-items:center;gap:14px;margin-top:16px}
.sfv{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top);color:var(--tx);opacity:0;transform:scale(.96);transition:opacity .35s,transform .45s cubic-bezier(.22,1,.36,1);font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif}
.sfv.in{opacity:1;transform:none}.sfv *{box-sizing:border-box}
.sfv-bg{position:absolute;inset:0;background:var(--panel);z-index:0}
.sfv-top{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:10px 16px 0}
.sfv-x,.sfv-hr{width:38px;height:38px;padding:0;border-radius:50%;border:1px solid var(--cbd);background:var(--cbg);color:var(--ctx);font-size:17px}
.sfv-hr.on{color:#ff5b6e}.sfv-cnt{font-size:13px;letter-spacing:.2em;color:var(--k)}
.sfv-stage{position:relative;z-index:2;flex:0 0 42%;margin-top:6px;overflow:hidden;touch-action:none}
.sfv-pg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;will-change:transform,opacity}
.sfv-pg img{width:auto;height:auto;max-width:72%;max-height:92%;aspect-ratio:1;object-fit:cover;border-radius:16px;border:2px solid rgba(255,255,255,.4);box-shadow:0 14px 40px rgba(0,0,0,.3);-webkit-user-drag:none}
.sfv-pg.ci img{border-radius:50%}
.sfv-info{position:relative;z-index:2;flex:1 1 auto;min-height:0;overflow:auto;padding:14px 26px 4px;text-align:center}
.sfv-meta{display:flex;justify-content:space-between;font-size:10px;letter-spacing:5px;color:var(--k)}.sfv-meta em{font-style:normal;letter-spacing:.2em}
.sfv-name{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px}
.sfv-name b,.sfv-in{font:300 26px/1.2 "PingFang SC",sans-serif;letter-spacing:.14em;color:var(--big)}
.sfv-in{width:60%;text-align:center;border:0;border-bottom:1px solid var(--cbd);background:transparent;outline:0;padding:0}
.sfv-ed{border:0;background:none;color:var(--ctx);font-size:16px;padding:4px}
.sfv-desc{margin:8px 0 0;font-size:13.5px;line-height:1.7;color:var(--tx);min-height:22px}.sfv-desc.empty{color:var(--k);font-size:12px;letter-spacing:.1em}
.sfv-ta{width:100%;margin-top:8px;padding:8px 10px;border-radius:12px;border:1px solid var(--cbd);background:var(--inp);color:var(--tx);font:13.5px/1.6 inherit;font-family:inherit;outline:0;resize:none}
.sfv-sub{margin:6px 0 0;font-size:11.5px;letter-spacing:.12em;color:var(--k)}
.sfv-more{display:flex;justify-content:center;gap:22px;margin-top:8px}
.sfv-strip{position:relative;z-index:2;flex:0 0 auto;display:flex;align-items:center;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:10px 0 calc(14px + env(safe-area-inset-bottom));scrollbar-width:none;-webkit-overflow-scrolling:touch}
.sfv-strip::-webkit-scrollbar{display:none}
.sfv-strip::before,.sfv-strip::after{content:"";flex:0 0 calc(50% - 38px)}
.sfv-t{position:relative;flex:0 0 56px;height:56px;border-radius:12px;overflow:hidden;scroll-snap-align:center;border:1.5px solid var(--cbd)}.sfv-t.ci{border-radius:50%}
.sfv-t img{width:100%;height:100%;object-fit:cover;display:block}.sfv-t u{position:absolute;right:3px;top:1px;font-size:10px;color:#ff5b6e;text-decoration:none}
`);
  SF.cssChat.push([
    ".sfc-pc{width:200px;max-width:100%;border-radius:10px;overflow:hidden;border:2px solid #e9bd62;background:#f5e6c8;box-shadow:0 4px 14px rgba(120,10,20,.3)}",
    ".sfc-pc.ci img{border-radius:50%}.sfc-pc em{display:block;padding:6px 10px;font-style:normal;font-size:12px;line-height:1.5;color:#7a2418}",
    ".sfc-pc img{display:block;width:100%}.sfc-pc span{display:block;padding:5px 10px;font:600 12px/1.4 serif;letter-spacing:.1em;color:#fff3dc;background:#a51a26;text-align:center}"
  ].join("\n"));
})(window.__SF);

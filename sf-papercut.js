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
    var L = SF.layer(SF.appRoot, "发给谁");
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
          cardData: { img: small, fold: item.fold },
          modelText: "我剪了一张新春窗花送给你（" + item.fold + "折对称剪纸，红纸镂空的图案）。"
        });
        SF.toast("已发送"); L.close();
      } catch (err) { SF.toast("发送失败：" + (err.message || err)); a.textContent = SF.esc(c.name || c.title || "聊天"); }
    };
  }

  async function wall() {
    var L = SF.layer(SF.appRoot, "作品墙", { full: true });
    async function render() {
      var a = await SF.st.get("cuts", []);
      L.body.innerHTML = a.length ? '<div class="sfp-wall">' + a.map(function (x, i) {
        return '<div class="sfp-th" data-i="' + i + '"><img src="' + x.img + '" draggable="false"></div>';
      }).join("") + "</div>" : '<p class="tip">还没有作品。去剪一张吧。</p>';
    }
    L.body.onclick = async function (e) {
      var t = e.target.closest("[data-i]"); if (!t) return;
      var a = await SF.st.get("cuts", []), item = a[+t.dataset.i]; if (!item) return;
      var V = SF.layer(SF.appRoot, "窗花（" + item.fold + "折）");
      V.body.innerHTML = '<div class="sfp-big"><img src="' + item.img + '"></div><div class="sfrow" style="justify-content:center;margin-top:12px"><button class="sfb sm" data-a="x">导出</button><button class="sfb sm" data-a="s">发给 TA</button><button class="sfb sm ghost" data-a="d">删除</button></div>';
      V.body.onclick = async function (ev) {
        var b = ev.target.closest("[data-a]"); if (!b) return;
        if (b.dataset.a === "x") exportImg(item);
        else if (b.dataset.a === "s") sendTo(item);
        else if (b.dataset.a === "d") {
          if (!(await SF.confirm("删除窗花", "确定删除这张窗花吗？"))) return;
          var cur = await SF.st.get("cuts", []); cur.splice(+t.dataset.i, 1); await SF.st.set("cuts", cur); V.close(); render();
        }
      };
    };
    render();
  }

  SF.pc = {
    wall: wall,
    // ---------- 聊天里的窗花卡片 ----------
    mountCard: function (c, m, r) {
      SF.setRoche(r);
      var cd = m.cardData || {};
      var d = SF.h("div", "sfc-pc", '<img draggable="false"><span>新春窗花 · ' + SF.esc(cd.fold || "") + "折</span>");
      d.querySelector("img").src = cd.img || "";
      c.replaceChildren(d);
    },
    // ---------- 剪纸摊 ----------
    open: function () {
      var L = SF.layer(SF.appRoot, "剪纸摊", { full: true });
      var fold = 4, circle = false, color = 0, tool = "line", wi = 1, hist = [], drawing = false, last = null;
      L.body.innerHTML =
        '<div class="sfp-bar" data-g="fold"><span class="sfchip" data-v="2">2折</span><span class="sfchip on" data-v="4">4折</span><span class="sfchip" data-v="8">8折</span></div>' +
        '<div class="sfp-bar" data-g="shape"><span class="sfchip on" data-v="sq">方形</span><span class="sfchip" data-v="ci">圆形</span><span class="sfp-sp"></span>' +
        '<i class="sfp-dot on" data-g="color" data-v="0" style="background:#c8202b"></i><i class="sfp-dot" data-g="color" data-v="1" style="background:#e0402f"></i><i class="sfp-dot" data-g="color" data-v="2" style="background:#9a1624"></i></div>' +
        '<div class="sfp-stage"><canvas class="sfp-cv" width="' + S + '" height="' + S + '"></canvas></div>' +
        '<div class="sfp-bar" data-g="tool"><span class="sfchip on" data-v="line">画线</span><span class="sfchip" data-v="dot">圆点</span><span class="sfchip" data-v="diamond">菱形</span><span class="sfchip" data-v="star">星</span></div>' +
        '<div class="sfp-bar" data-g="size"><span class="sfchip" data-v="0">细</span><span class="sfchip on" data-v="1">中</span><span class="sfchip" data-v="2">粗</span></div>' +
        '<p class="tip">在红纸上滑动就是“剪掉”，虚线是折痕，对称的图案会自动出现。</p>' +
        '<div class="sfrow" style="justify-content:center;flex-wrap:wrap"><button class="sfb sm ghost" data-a="undo">撤销</button><button class="sfb sm ghost" data-a="clear">清空</button><button class="sfb sm" data-a="save">保存到作品墙</button><button class="sfb sm ghost" data-a="wall">作品墙</button></div>';
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
        snap(); drawing = true; var p = pos(e);
        if (tool === "line") { seg(p, p); last = p; } else stamp(p[0], p[1]);
        render(true);
      });
      cv.addEventListener("pointermove", function (e) {
        if (!drawing || tool !== "line") return;
        var p = pos(e); seg(last, p); last = p; render(true);
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
          var arr = await SF.st.get("cuts", []);
          arr.unshift({ id: Date.now(), t: Date.now(), fold: fold, img: snapshot(640) });
          if (arr.length > 40) arr.length = 40;
          if (await SF.st.set("cuts", arr)) { SF.toast("已保存到作品墙"); if (SF.fortune) SF.fortune.award("cut"); }
          else SF.toast("保存失败，存储空间可能不足");
        }
      });
      render(true);
    }
  };

  SF.cssApp.push([
    ".sfp-bar{display:flex;align-items:center;flex-wrap:wrap;margin:2px 0 4px}.sfp-sp{flex:1}",
    ".sfp-dot{width:22px;height:22px;border-radius:50%;margin-left:10px;border:2px solid rgba(255,255,255,.35);box-sizing:border-box}.sfp-dot.on{border-color:#ffd77a;box-shadow:0 0 8px #ffd77a}",
    ".sfp-stage{display:flex;justify-content:center;margin:8px 0}",
    ".sfp-cv{width:min(100%,46vh);aspect-ratio:1;touch-action:none;border-radius:6px;background:#f5e6c8;box-shadow:0 6px 22px rgba(0,0,0,.45)}",
    ".sfp-wall{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}",
    ".sfp-th{aspect-ratio:1;border-radius:6px;overflow:hidden;border:1.5px solid rgba(255,215,122,.4)}.sfp-th img,.sfp-big img{width:100%;height:100%;display:block;object-fit:cover}",
    ".sfp-big{border-radius:8px;overflow:hidden;border:2px solid #ffd77a}"
  ].join("\n"));
  SF.cssChat.push([
    ".sfc-pc{width:200px;max-width:100%;border-radius:10px;overflow:hidden;border:2px solid #e9bd62;background:#f5e6c8;box-shadow:0 4px 14px rgba(120,10,20,.3)}",
    ".sfc-pc img{display:block;width:100%}.sfc-pc span{display:block;padding:5px 10px;font:600 12px/1.4 serif;letter-spacing:.1em;color:#fff3dc;background:#a51a26;text-align:center}"
  ].join("\n"));
})(window.__SF);

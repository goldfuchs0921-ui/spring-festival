/* 测试面板（左下角小棚）：不用等时间、不花额度就能测大部分功能 */
(function (SF) {
  "use strict";
  var GEARS = [["auto", "自动"], ["morning", "清晨"], ["noon", "正午"], ["dusk", "黄昏"], ["night", "夜晚"]];
  var NAME = { morning: "清晨", noon: "正午", dusk: "黄昏", night: "夜晚" };
  var X0 = 0.08, DX = 0.21; // 第 0 档的位置，和档位间距（占轨道宽度的比例）
  function gx(i) { return X0 + i * DX; }

  // 轨道里的小插画：随档位切换
  function art(k) {
    var d = "";
    if (k === "morning") d = '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdd5db"/><stop offset="1" stop-color="#e4e0da"/></linearGradient></defs><rect width="400" height="70" fill="url(#tg)"/><path d="M0 70V58Q30 50 60 56T120 54T180 57T240 55T300 58L300 70Z" fill="#a9a8ad" opacity=".85"/>';
    else if (k === "noon") d = '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#79bfec"/><stop offset="1" stop-color="#d4ecf7"/></linearGradient></defs><rect width="400" height="70" fill="url(#tg)"/><ellipse cx="90" cy="22" rx="30" ry="7" fill="#fff" opacity=".85"/><ellipse cx="250" cy="34" rx="36" ry="8" fill="#fff" opacity=".75"/><path d="M0 70V55Q50 42 100 54T200 52T300 56T400 50V70Z" fill="#8fb7a0" opacity=".9"/>';
    else if (k === "dusk") {
      d = '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6ad8e"/><stop offset="1" stop-color="#f3c9a0"/></linearGradient></defs><rect width="400" height="70" fill="url(#tg)"/>';
      var hs = [10, 22, 14, 28, 12, 20, 30, 16, 24, 13, 26, 18, 22, 12, 28, 16];
      hs.forEach(function (h, i) { d += '<rect x="' + (i * 25) + '" y="' + (70 - 14 - h) + '" width="19" height="' + (h + 14) + '" fill="#8d7d7f" opacity=".88"/>'; });
    } else if (k === "night") {
      d = '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#161c40"/><stop offset="1" stop-color="#3a3868"/></linearGradient></defs><rect width="400" height="70" fill="url(#tg)"/>';
      for (var i = 0; i < 26; i++) d += '<circle cx="' + ((i * 53) % 400) + '" cy="' + ((i * 29) % 40 + 4) + '" r="' + (i % 3 ? 0.7 : 1.2) + '" fill="#fff" opacity=".8"/>';
      d += '<path d="M0 70V50L40 34L80 52L130 30L180 54L240 36L300 56L350 38L400 52V70Z" fill="#1d2044"/>';
    } else d = '<defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cdd5db"/><stop offset=".3" stop-color="#7fc3ee"/><stop offset=".62" stop-color="#f0b68f"/><stop offset="1" stop-color="#202648"/></linearGradient></defs><rect width="400" height="70" fill="url(#tg)"/>';
    return '<svg viewBox="0 0 400 70" preserveAspectRatio="none">' + d + "</svg>";
  }

  SF.test = {
    open: function () {
      var L = SF.layer(SF.appRoot, "测试面板", { full: true, k: "TEST" });
      var key = SF.forcePeriod || "auto", gi = function (k) { return GEARS.map(function (g) { return g[0]; }).indexOf(k); };
      var btn = function (a, t, g) { return '<button class="sfb sm ' + (g === false ? "" : "ghost") + '" data-a="' + a + '" type="button">' + t + "</button>"; };
      L.body.innerHTML =
        "<h4>场景时段预览</h4>" +
        '<div class="sf-card"><div class="sft-hd"><span>当前时段</span><b class="sft-cur"></b>' + btn("rst", "↻ Reset") + "</div>" +
        '<div class="sft-track"><div class="sft-art"></div><i class="sft-th"></i></div>' +
        '<div class="sft-lbs">' + GEARS.map(function (g, i) { return '<span data-g="' + g[0] + '" style="left:' + gx(i) * 100 + '%">' + g[1] + "</span>"; }).join("") + "</div></div>" +
        "<h4>时间</h4><div class=\"sf-card sft-grid\">" + btn("t10", "拨到零点前10秒", false) + btn("treal", "恢复真实时间") + btn("mid", "立刻预演零点") + "</div>" +
        "<h4>福卡</h4><div class=\"sf-card sft-grid\">" + btn("extra", "额外抽一张") + btn("fill", "发满五福") + btn("day", "重置今日签到") + btn("once", "重置首次任务") + btn("fzero", "福卡清零") + "</div>" +
        "<h4>音效试听</h4><div class=\"sf-card sft-grid\">" + [["launch", "升空"], ["burst", "爆炸"], ["demo", "连放10次"], ["text", "文字烟花"], ["packet", "拆红包"], ["flip", "福卡"], ["snip", "剪纸"], ["save", "保存"]].map(function (s) { return btn("snd_" + s[0], s[1]); }).join("") + "</div>" +
        "<h4>清理数据</h4><div class=\"sf-card sft-grid\">" + btn("cv", "清空语音缓存") + btn("crp", "清空红包记录") + btn("cpool", "清空祝福池") + btn("ccut", "清空作品墙") + btn("ccp", "清空我的春联") + btn("crd", "重置灯谜进度") + btn("cnn", "清空打年兽记录") + btn("cgala", "清空我的春晚") + "</div>" +
        "<h4>存储自检</h4><div class=\"sf-card\"><p class=\"tip\" style=\"margin:0 0 10px\">红包记录和祝福池现在走共享存储，聊天里和 App 里都能读写；这里检查的是 App 自己的存储。</p>" + btn("self", "自检") + "</div>" +
        '<p class="tip" style="margin-top:22px;text-align:center">新春年味 v' + SF.VER + "　GoldFuchs &amp; Claude</p>";

      var track = L.body.querySelector(".sft-track"), artEl = L.body.querySelector(".sft-art"), th = L.body.querySelector(".sft-th"), curEl = L.body.querySelector(".sft-cur"), shown = null;
      var THEMES = ["sft-night", "sft-day", "sft-morning", "sft-noon", "sft-dusk"];
      function paint(x, k) {
        var ep = k === "auto" ? SF.period() : k;
        th.style.left = x * 100 + "%"; th.className = "sft-th " + ep;
        artEl.style.clipPath = "inset(0 " + (1 - x) * 100 + "% 0 0 round 999px)";
        if (shown !== k) {
          shown = k; artEl.innerHTML = art(k); curEl.textContent = k === "auto" ? "自动 · " + NAME[ep] : NAME[k];
          [].forEach.call(L.body.querySelectorAll(".sft-lbs span"), function (n) { n.classList.toggle("on", n.dataset.g === k); });
          THEMES.forEach(function (t) { L.el.classList.remove(t); }); L.el.classList.add(SF.themeFor(k));
        }
      }
      function apply(k) { key = k; SF.forcePeriod = k === "auto" ? null : k; if (SF.app) SF.app.refreshScene(); }
      function snapTo(k) {
        track.classList.add("snap"); apply(k); shown = null; paint(gx(gi(k)), k);
        setTimeout(function () { track.classList.remove("snap"); }, 340);
      }
      paint(gx(gi(key)), key);

      // 拖动圆点：跟手，松手吸附到最近的档位
      var dragging = false;
      function fromEvent(e) {
        var r = track.getBoundingClientRect(), f = Math.min(gx(4), Math.max(gx(0), (e.clientX - r.left) / r.width));
        return { f: f, k: GEARS[Math.round((f - X0) / DX)][0] };
      }
      track.addEventListener("pointerdown", function (e) { dragging = true; try { track.setPointerCapture(e.pointerId); } catch (x) {} var o = fromEvent(e); paint(o.f, o.k); });
      track.addEventListener("pointermove", function (e) { if (!dragging) return; var o = fromEvent(e); paint(o.f, o.k); });
      function end(e) { if (!dragging) return; dragging = false; snapTo(fromEvent(e).k); if (SF.sfx) SF.sfx.tap(); }
      track.addEventListener("pointerup", end); track.addEventListener("pointercancel", end);

      L.body.addEventListener("click", async function (e) {
        var g = e.target.closest(".sft-lbs span");
        if (g) { snapTo(g.dataset.g); return; }
        var n = e.target.closest("[data-a]"); if (!n) return;
        SF.audio.unlock();
        var a = n.dataset.a;
        if (a === "rst") { snapTo("auto"); return; }
        if (a && a.indexOf("snd_") === 0) { if (SF.sfx && SF.sfx[a.slice(4)]) SF.sfx[a.slice(4)](); return; }
        if (a === "t10") { SF.offset = SF.TARGET - 10000 - Date.now(); SF.toast("已拨到零点前10秒，回首页看倒计时"); L.close(); if (SF.app) SF.app.refreshScene(); }
        else if (a === "treal") { SF.offset = 0; SF.toast("已恢复真实时间"); if (SF.app) SF.app.refreshScene(); }
        else if (a === "mid") { L.close(); SF.watch.midnight(); }
        else if (a === "extra") { await SF.fortune.testExtra(); }
        else if (a === "fill") { await SF.fortune.testFill(); SF.toast("五福已发满"); }
        else if (a === "day") { await SF.fortune.testDay(); SF.toast("今日签到已重置"); }
        else if (a === "once") { await SF.fortune.testOnce(); SF.toast("首次任务已重置"); }
        else if (a === "fzero") { if (await SF.confirm("福卡清零", "确定清空所有福卡和新年大礼吗？")) { await SF.fortune.testReset(); SF.toast("已清零"); } }
        else if (a === "cv") {
          if (!(await SF.confirm("清空语音", "已保存的零点语音会被删除，再用就要重新合成（花一次语音费用）。继续吗？"))) return;
          var cs = await SF.chars(); for (var i = 0; i < cs.length; i++) await SF.st.del("zv_" + cs[i].id); SF.toast("语音缓存已清空");
        }
        else if (a === "crp") { SF.ls.del("rp_records"); SF.toast("红包记录已清空"); }
        else if (a === "cpool") { var c2 = await SF.chars(); for (var j = 0; j < c2.length; j++) SF.ls.del("rp_pool_" + c2[j].id); SF.toast("祝福池已清空"); }
        else if (a === "ccut") { if (await SF.confirm("清空作品墙", "所有窗花作品会被删除。继续吗？")) { await SF.st.del("cuts"); await SF.st.del("cut_wall"); SF.toast("已清空"); } }
        else if (a === "ccp") { if (await SF.confirm("清空春联", "我的春联会被全部删除。继续吗？")) { await SF.st.del("couplets"); SF.toast("已清空"); } }
        else if (a === "crd") { await SF.st.del("riddles"); SF.toast("灯谜进度已重置"); }
        else if (a === "cnn") { if (await SF.confirm("清空打年兽记录", "最高分、最高连击、今日局数和已存的台词都会清掉。继续吗？")) { await SF.st.del("nian"); await SF.st.del("nian_lines"); SF.toast("已清空"); } }
        else if (a === "cgala") { if (await SF.confirm("清空春晚", "已保存的春晚和设置会被删除。继续吗？")) { await SF.st.del("gala_shows"); await SF.st.del("gala_cfg"); SF.toast("已清空"); } }
        else if (a === "self") {
          var ok = await SF.st.set("selftest", { t: Date.now() }), back = await SF.st.get("selftest", null);
          await SF.st.del("selftest");
          SF.toast(ok && back ? "存储正常" : "存储异常：写入或读取失败");
        }
      });
      return L;
    }
  };

  SF.cssApp.push(`
.sft-hd{display:flex;align-items:center;gap:10px}
.sft-hd span{font-size:13px;color:var(--k);letter-spacing:.1em}
.sft-hd b{flex:1;font:600 24px/1 -apple-system,"PingFang SC",sans-serif;color:var(--big);white-space:nowrap}
.sft-track{position:relative;height:64px;margin:16px 0 4px;border-radius:999px;overflow:hidden;background:var(--cbg);border:1px solid var(--cbd);touch-action:none}
.sft-art{position:absolute;inset:0}.sft-art svg{display:block;width:100%;height:100%}
.sft-th{position:absolute;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;pointer-events:none}
.sft-th.morning{background:radial-gradient(circle at 35% 30%,#fffbe8,#ffe9a8);box-shadow:0 0 14px rgba(255,236,170,.9)}
.sft-th.noon{background:radial-gradient(circle at 35% 30%,#ffffff,#ffe27a);box-shadow:0 0 18px rgba(255,236,120,1)}
.sft-th.dusk{background:radial-gradient(circle at 35% 30%,#fff0c4,#ffb86b);box-shadow:0 0 16px rgba(255,190,110,.95)}
.sft-th.night{background:radial-gradient(circle at 35% 30%,#ffffff,#d9dcf2);box-shadow:inset -7px -3px 0 0 rgba(120,130,175,.4),0 0 14px rgba(200,210,255,.8)}
.sft-track.snap .sft-th{transition:left .32s cubic-bezier(.22,1,.36,1)}
.sft-track.snap .sft-art{transition:clip-path .32s cubic-bezier(.22,1,.36,1)}
.sft-lbs{position:relative;height:36px}
.sft-lbs span{position:absolute;top:6px;transform:translateX(-50%);font-size:13px;color:var(--k);white-space:nowrap;padding:2px 4px}
.sft-lbs span.on{color:var(--big);font-weight:700}
.sft-lbs span.on::after{content:"";position:absolute;left:50%;top:24px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#d6412c}
.sft-grid{display:flex;flex-wrap:wrap;gap:8px}
`);
})(window.__SF);

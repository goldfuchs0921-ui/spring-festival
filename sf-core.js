/* 核心工具：存储、时间、弹层、语音、公共样式 */
(function (SF) {
  "use strict";
  SF.cssApp = [];   // 只在 App 打开时注入，关闭即删
  SF.cssChat = [];  // 聊天卡片/弹层用，常驻
  SF.offset = 0;    // 测试用：时间偏移
  SF.forcePeriod = null; // 测试用：强制场景时段
  SF.IW = 1220; SF.IH = 2576; // 场景图比例基准
  SF.TARGET = new Date(2027, 1, 6, 0, 0, 0).getTime(); // 2027 春节零点（本机时间）

  SF.now = function () { return Date.now() + SF.offset; };
  SF.setRoche = function (r) { if (r) SF.roche = r; };
  SF.h = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  SF.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  SF.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  SF.pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  SF.toast = function (m) { try { SF.roche.ui.toast(m); } catch (e) { console.log(m); } };
  SF.confirm = async function (title, message) {
    try { return !!(await SF.roche.ui.confirm({ title: title, message: message })); }
    catch (e) { return window.confirm(message); }
  };
  SF.today = function () {
    var d = new Date(SF.now());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  };
  SF.period = function () {
    if (SF.forcePeriod) return SF.forcePeriod;
    var h = new Date(SF.now()).getHours();
    return h >= 5 && h < 10 ? "morning" : h >= 10 && h < 16 ? "noon" : h >= 16 && h < 19 ? "dusk" : "night";
  };
  SF.fmtLeft = function (ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400); s %= 86400;
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d + "天 " + p(Math.floor(s / 3600)) + ":" + p(Math.floor((s % 3600) / 60)) + ":" + p(s % 60);
  };

  // ---------- 插件私有存储（出错不抛）----------
  SF.st = {
    get: async function (k, d) {
      try { var v = await SF.roche.storage.get(k); return v == null ? d : v; } catch (e) { return d; }
    },
    set: async function (k, v) {
      try { await SF.roche.storage.set(k, v); return true; } catch (e) { console.error(e); return false; }
    },
    del: async function (k) {
      try { await SF.roche.storage.delete(k); return true; } catch (e) { return false; }
    }
  };

  // ---------- 角色 / 用户 / AI / 语音 ----------
  SF.cname = function (c) { return (c && (c.handle || c.name)) || "角色"; };
  SF.isZh = function (lang) { return !lang || /chinese|中文|zh|mandarin|普通话|汉语/i.test(lang); };
  SF.chars = async function () { try { return (await SF.roche.character.list()) || []; } catch (e) { return []; } };
  SF.userName = async function () {
    try { var p = await SF.roche.persona.getActiveUserPersona(); return (p && (p.handle || p.name)) || "你"; }
    catch (e) { return "你"; }
  };
  SF.parseJson = function (t) {
    t = String(t || "").replace(/```json|```/gi, "");
    var m = t.match(/[\[{][\s\S]*[\]}]/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
  };
  SF.ai = async function (system, user, temp) {
    var r = await SF.roche.ai.chat({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: temp || 0.9
    });
    return (r && r.text) || "";
  };
  SF.persona = function (c) { return String((c && (c.persona || c.bio)) || "").slice(0, 700); };

  // 按当前全局 TTS 供应商选角色的 Voice ID 合成，返回音频地址
  SF.tts = async function (char, text, language) {
    var r = SF.roche, provider = "minimax";
    try { provider = await r.voice.getProvider(); } catch (e) {}
    var vid = provider === "elevenlabs" ? char.elevenLabsVoiceId : char.minimaxVoiceId;
    if (!vid) throw new Error("「" + SF.cname(char) + "」没有绑定当前 " + provider + " 的 Voice ID");
    var t = char.tts || {}, el = t.elevenLabs || {};
    return await r.voice.tts({
      text: text, voiceId: vid, language: language || t.language || "Chinese",
      speed: t.speed, vol: t.volume, pitch: t.pitch,
      elevenLabsStability: el.stability, elevenLabsSimilarity: el.similarity,
      elevenLabsStyle: el.style, elevenLabsSpeakerBoost: el.speakerBoost,
      senderName: SF.cname(char)
    });
  };
  SF.hasVoice = async function (c) {
    var p = "minimax";
    try { p = await SF.roche.voice.getProvider(); } catch (e) {}
    return !!(p === "elevenlabs" ? c.elevenLabsVoiceId : c.minimaxVoiceId);
  };
  // 把音频地址转成可长期保存的 data URL；失败返回 null
  SF.toData = async function (url) {
    try {
      var b = await (await fetch(url)).blob();
      return await new Promise(function (res, rej) {
        var f = new FileReader(); f.onload = function () { res(f.result); }; f.onerror = rej; f.readAsDataURL(b);
      });
    } catch (e) { return null; }
  };

  // ---------- 音频播放（iOS 需要一次点击解锁）----------
  SF.audio = {
    el: null, unlocked: false,
    get: function () { if (!this.el) this.el = new Audio(); return this.el; },
    unlock: function () {
      if (SF.sfx) SF.sfx.unlock();
      if (this.unlocked) return; this.unlocked = true;
      try {
        var a = this.get();
        a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
        var p = a.play(); if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    },
    play: function (src) {
      var a = this.get(); a.pause(); a.src = src;
      return new Promise(function (res) {
        a.onended = function () { res(true); };
        a.onerror = function () { res(false); };
        var p = a.play(); if (p && p.catch) p.catch(function () { res(false); });
      });
    },
    stop: function () { if (this.el) { this.el.pause(); this.el.onended = null; this.el.onerror = null; } }
  };

  // ---------- 主题：夜晚/黄昏用「黑夜」，清晨/正午用「转白天」 ----------
  SF.themeCls = function () { var p = SF.period(); return p === "night" || p === "dusk" ? "sft-night" : "sft-day"; };
  SF.reduce = function () { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  // 跟手拖动：位移超过 50% 或速度超过 500px/s 就算完成
  SF.shouldFinish = function (dist, size, v) { return Math.abs(dist) > size * 0.5 || Math.abs(v) > 500; };
  SF.velo = function () {
    var s = [];
    return {
      add: function (x) { var t = performance.now(); s.push([t, x]); while (s.length > 1 && t - s[0][0] > 120) s.shift(); },
      get: function () {
        if (s.length < 2) return 0;
        var a = s[0], b = s[s.length - 1], dt = (b[0] - a[0]) / 1000;
        return dt > 0 ? (b[1] - a[1]) / dt : 0;
      }
    };
  };

  // ---------- 弹层 / 抽屉 ----------
  // opts: full(整页) half(半屏，不挡天空) fixed(挂在 body 上) k(英文小标题) onClose
  SF.layer = function (parent, title, opts) {
    opts = opts || {};
    var w = SF.h("div", "sfl " + SF.themeCls() + (opts.full ? " sfl-full" : "") + (opts.half ? " sfl-half" : "") + (opts.fixed ? " sfl-fixed" : ""));
    var fx = "";
    for (var i = 0; i < 14; i++) fx += '<i style="left:' + (Math.random() * 100).toFixed(1) + "%;animation-duration:" + (4 + Math.random() * 5).toFixed(1) + "s;animation-delay:-" + (Math.random() * 6).toFixed(1) + "s;opacity:" + (0.25 + Math.random() * 0.5).toFixed(2) + '"></i>';
    w.innerHTML = '<div class="sfl-mask"></div><div class="sfl-panel"><i class="sfl-glow"></i><i class="sfl-halo"></i><span class="sfl-br">❋</span><div class="sfl-fx">' + fx + "</div>" +
      '<div class="sfl-grab"><i class="sfl-bar"></i><div class="sfl-head"><div><small class="sfl-k"></small><b></b></div><button class="sfl-x" type="button">✕</button></div></div><div class="sfl-body"></div></div>';
    w.querySelector("b").textContent = title;
    w.querySelector(".sfl-k").textContent = opts.k || "";
    parent.appendChild(w);
    var panel = w.querySelector(".sfl-panel"), mask = w.querySelector(".sfl-mask"), closed = false, under = !opts.half && !opts.fixed;
    if (under) { parent._sfl = (parent._sfl || 0) + 1; parent.classList.add("sfl-open"); }
    var L = {
      el: w, body: w.querySelector(".sfl-body"),
      close: function (instant) {
        if (closed) return; closed = true;
        if (under) { parent._sfl = Math.max(0, (parent._sfl || 1) - 1); if (!parent._sfl) parent.classList.remove("sfl-open"); }
        if (opts.onClose) opts.onClose();
        if (instant === true || SF.reduce()) { w.remove(); return; }
        panel.style.transition = ""; panel.style.transform = ""; mask.style.transition = ""; mask.style.opacity = "";
        w.classList.remove("in"); w.classList.add("out");
        setTimeout(function () { w.remove(); }, 380);
      },
      setTitle: function (t) { w.querySelector("b").textContent = t; }
    };
    w.querySelector(".sfl-x").onclick = function () { L.close(); };
    mask.onclick = function () { L.close(); };

    // 抽屉下拉关闭：进度完全跟手；拖过 50% 或速度 > 500px/s 才关闭，否则弹回
    var grab = w.querySelector(".sfl-grab"), y0 = 0, dy = 0, drag = false, ve = SF.velo();
    grab.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".sfl-x") || closed) return;
      drag = true; y0 = e.clientY; dy = 0; ve = SF.velo(); ve.add(e.clientY);
      try { grab.setPointerCapture(e.pointerId); } catch (x) {}
      panel.style.transition = "none"; mask.style.transition = "none";
    });
    grab.addEventListener("pointermove", function (e) {
      if (!drag) return;
      dy = Math.max(0, e.clientY - y0); ve.add(e.clientY);
      panel.style.transform = "translateY(" + dy + "px)";
      mask.style.opacity = Math.max(0, 1 - dy / Math.max(1, panel.offsetHeight));
    });
    function endDrag() {
      if (!drag) return; drag = false;
      var h = panel.offsetHeight, v = ve.get();
      panel.style.transition = "transform .3s cubic-bezier(.22,1,.36,1)"; mask.style.transition = "opacity .3s";
      if (dy > 0 && (dy > h * 0.5 || v > 500)) {
        panel.style.transform = "translateY(" + h + "px)"; mask.style.opacity = 0;
        setTimeout(function () { L.close(true); }, 300);
      } else {
        panel.style.transform = "translateY(0)"; mask.style.opacity = "";
        setTimeout(function () { panel.style.transition = ""; panel.style.transform = ""; mask.style.transition = ""; }, 320);
      }
    }
    grab.addEventListener("pointerup", endDrag);
    grab.addEventListener("pointercancel", endDrag);

    w.classList.add("enter");
    setTimeout(function () { w.classList.remove("enter"); }, 900);
    requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add("in"); }); });
    return L;
  };

  // ---------- 横滑选择行：末尾渐隐 ----------
  SF.chipRow = function (html) { return '<div class="sfrow-h"><div class="sfrow-in">' + html + "</div></div>"; };
  SF.fadeRows = function (root) {
    [].forEach.call(root.querySelectorAll(".sfrow-in"), function (r) {
      function upd() { r.classList.toggle("sl", r.scrollLeft > 2); r.classList.toggle("se", r.scrollLeft + r.clientWidth >= r.scrollWidth - 2); }
      if (!r._f) { r._f = 1; r.addEventListener("scroll", upd, { passive: true }); }
      upd();
    });
  };

  SF.injectCss = function (id, arr) {
    var o = document.getElementById(id); if (o) o.remove();
    var s = document.createElement("style"); s.id = id; s.textContent = arr.join("\n");
    document.head.appendChild(s); return s;
  };
  SF.injectChatCss = function () { SF.injectCss("sf-css-chat", SF.cssChat); };

  // ---------- 公共样式（抽屉、按钮、主题）----------
  var stagger = "";
  for (var si = 1; si <= 9; si++) stagger += ".sfl.enter .sfl-body>*:nth-child(" + si + "){animation-delay:" + (0.05 + si * 0.045).toFixed(3) + "s}\n";
  SF.cssChat.push(`
.sft-night{--panel:linear-gradient(180deg,#10283a 0%,#5d2130 55%,#a8392c 100%);--tx:#fdeee2;--k:#dca898;--big:#fff8ef;--acc:#f2b394;--hair:rgba(240,201,135,.2);--line:linear-gradient(90deg,rgba(240,201,135,.65),transparent);--cbd:rgba(240,201,135,.34);--ctx:#f7dcb4;--cbg:rgba(255,255,255,.06);--btn:linear-gradient(135deg,#f7dca6,#d4833f);--btx:#2c0f0a;--inp:rgba(0,0,0,.28);--glow:rgba(255,190,130,.42);--halo:rgba(255,205,140,.5);--br:#ffd9c4;--dot:#fff;--shd:rgba(0,0,0,.45)}
.sft-day{--panel:linear-gradient(180deg,#cfe6ee 0%,#f2e2d4 46%,#e9b6a2 78%,#d9704f 100%);--tx:#3a2318;--k:#9a5c46;--big:#31170c;--acc:#a8402a;--hair:rgba(168,52,34,.2);--line:linear-gradient(90deg,rgba(168,52,34,.45),transparent);--cbd:rgba(150,60,35,.36);--ctx:#8e3520;--cbg:rgba(255,255,255,.3);--btn:linear-gradient(135deg,#e2573a,#a8331f);--btx:#fff6ec;--inp:rgba(255,255,255,.55);--glow:rgba(255,214,160,.75);--halo:rgba(255,226,150,.85);--br:#c66a4a;--dot:#fff3d8;--shd:rgba(120,40,20,.28)}
.sft-day .sfl-fx i{border-radius:50% 0 50% 50%}
.sfl{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;justify-content:flex-end;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;color:var(--tx);-webkit-user-select:none;user-select:none}
.sfl-fixed{position:fixed;z-index:99999}
.sfl *{box-sizing:border-box}
.sfl-mask{position:absolute;inset:0;background:rgba(10,6,20,.5);opacity:0;transition:opacity .35s}
.sfl.in .sfl-mask{opacity:1}.sfl.out .sfl-mask{opacity:0}
.sfl-panel{position:relative;width:100%;max-width:560px;margin:0 auto;max-height:84%;display:flex;flex-direction:column;overflow:hidden;background:var(--panel);border-top:1px solid var(--cbd);border-radius:22px 22px 0 0;box-shadow:0 -10px 40px var(--shd);padding-bottom:env(safe-area-inset-bottom);transform:translateY(100%);transition:transform .5s cubic-bezier(.22,1,.36,1)}
.sfl.in .sfl-panel{transform:none}.sfl.out .sfl-panel{transform:translateY(100%);transition:transform .34s cubic-bezier(.5,0,.8,.4)}
.sfl-full .sfl-panel{height:100%;max-height:100%;max-width:none;border-radius:0;border-top:0;padding-top:env(safe-area-inset-top)}
.sfl-half{pointer-events:none}.sfl-half .sfl-mask{display:none}.sfl-half .sfl-panel{pointer-events:auto;max-height:56%}
.sfl-glow{position:absolute;left:50%;top:-6%;width:170px;height:170px;border-radius:50%;transform:translateX(-50%);pointer-events:none;background:radial-gradient(circle,var(--glow),transparent 68%);animation:sflPulse 3.6s ease-in-out infinite}
.sfl-halo{position:absolute;right:6px;top:34px;width:74px;height:74px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,var(--halo),transparent 66%)}
.sfl-br{position:absolute;right:-16px;top:-18px;font-size:66px;pointer-events:none;color:var(--br);opacity:.2;transform:rotate(-18deg)}
.sfl-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.sfl-fx i{position:absolute;top:-10px;width:3px;height:3px;border-radius:50%;background:var(--dot);animation:sflFall linear infinite}
@keyframes sflFall{to{transform:translateY(600px);opacity:0}}
@keyframes sflPulse{50%{transform:translateX(-50%) scale(1.16);opacity:.6}}
.sfl-grab{position:relative;z-index:2;flex:0 0 auto;touch-action:none}
.sfl-bar{display:block;width:38px;height:4px;border-radius:2px;background:var(--cbd);margin:8px auto 0}
.sfl-head{position:relative;display:flex;align-items:center;justify-content:space-between;padding:8px 20px 12px}
.sfl-head::after{content:"";position:absolute;left:20px;right:20px;bottom:0;height:1px;background:var(--line)}
.sfl-k{display:block;min-height:11px;margin-bottom:3px;font-size:9px;letter-spacing:5px;color:var(--k);text-transform:uppercase}
.sfl-head b{font:300 22px/1.2 "PingFang SC","Noto Sans SC",sans-serif;letter-spacing:.14em;color:var(--big)}
.sfl-x{width:30px;height:30px;padding:0;border-radius:50%;border:1px solid var(--cbd);background:var(--cbg);color:var(--ctx);font-size:13px}
.sfl-body{position:relative;z-index:2;flex:1 1 auto;min-height:0;overflow:auto;padding:12px 20px 24px;-webkit-overflow-scrolling:touch}
.sfl h4{margin:20px 0 8px;font:400 10.5px/1.3 -apple-system,"PingFang SC",sans-serif;letter-spacing:5px;color:var(--k)}
.sfl p.tip{margin:4px 0 10px;font-size:12px;line-height:1.7;color:var(--k)}
.sfl input[type=text],.sfl textarea,.sfl select{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--cbd);background:var(--inp);color:var(--tx);font-size:14px;line-height:1.5;font-family:inherit;outline:0}
.sfl input::placeholder,.sfl textarea::placeholder{color:var(--k);opacity:.7}
.sfb{border:0;border-radius:12px;padding:11px 20px;font:600 14px/1 -apple-system,"PingFang SC",sans-serif;color:var(--btx,#2c0f0a);background:var(--btn,linear-gradient(135deg,#f7dca6,#d4833f));box-shadow:0 2px 10px rgba(0,0,0,.25);transition:transform .15s,filter .2s}
.sfb:active{transform:scale(.95);filter:brightness(1.1)}.sfb[disabled]{opacity:.45}
.sfb.ghost{background:var(--cbg);color:var(--ctx);border:1px solid var(--cbd);box-shadow:none}
.sfb.sm{padding:8px 14px;font-size:12.5px}
.sfchip{display:inline-block;padding:6px 13px;margin:0 8px 8px 0;border-radius:14px;border:1px solid var(--cbd);color:var(--ctx);background:var(--cbg);font-size:12.5px;transition:transform .16s,background .25s,color .25s}
.sfchip:active{transform:scale(.93)}
.sfchip.on{background:var(--btn);border-color:transparent;color:var(--btx);font-weight:600;animation:sfPop .32s}
@keyframes sfPop{40%{transform:scale(1.09)}}
.sfrow{display:flex;align-items:center;gap:8px}
.sfrow-h{margin:0 -20px}
.sfrow-in{display:flex;gap:8px;overflow-x:auto;padding:2px 20px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 44px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 44px),transparent)}
.sfrow-in::-webkit-scrollbar{display:none}
.sfrow-in.sl{-webkit-mask-image:linear-gradient(90deg,transparent,#000 32px,#000 calc(100% - 44px),transparent);mask-image:linear-gradient(90deg,transparent,#000 32px,#000 calc(100% - 44px),transparent)}
.sfrow-in.sl.se{-webkit-mask-image:linear-gradient(90deg,transparent,#000 32px);mask-image:linear-gradient(90deg,transparent,#000 32px)}
.sfrow-in.se:not(.sl){-webkit-mask-image:none;mask-image:none}
.sfrow-in .sfchip{margin:0;flex:0 0 auto;white-space:nowrap}
.sfl.enter .sfl-body>*{animation:sfUp .55s cubic-bezier(.22,1,.36,1) both}
${stagger}@keyframes sfUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.sfl *,.sfl{animation:none!important;transition:none!important}}
`);
})(window.__SF);

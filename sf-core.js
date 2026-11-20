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

  // ---------- 弹层 ----------
  // opts: full(整页) half(半屏，不挡天空) fixed(挂在 body 上) onClose
  SF.layer = function (parent, title, opts) {
    opts = opts || {};
    var w = SF.h("div", "sfl" + (opts.full ? " sfl-full" : "") + (opts.half ? " sfl-half" : "") + (opts.fixed ? " sfl-fixed" : ""));
    w.innerHTML = '<div class="sfl-mask"></div><div class="sfl-panel"><div class="sfl-head"><b></b><button class="sfl-x" type="button">✕</button></div><div class="sfl-body"></div></div>';
    w.querySelector("b").textContent = title;
    parent.appendChild(w);
    var L = {
      el: w, body: w.querySelector(".sfl-body"),
      close: function () { if (w.parentNode) w.remove(); if (opts.onClose) opts.onClose(); },
      setTitle: function (t) { w.querySelector("b").textContent = t; }
    };
    w.querySelector(".sfl-x").onclick = L.close;
    w.querySelector(".sfl-mask").onclick = L.close;
    requestAnimationFrame(function () { w.classList.add("in"); });
    return L;
  };

  SF.injectCss = function (id, arr) {
    var o = document.getElementById(id); if (o) o.remove();
    var s = document.createElement("style"); s.id = id; s.textContent = arr.join("\n");
    document.head.appendChild(s); return s;
  };
  SF.injectChatCss = function () { SF.injectCss("sf-css-chat", SF.cssChat); };

  // 公共样式：弹层、按钮（聊天里也会用，所以常驻）
  SF.cssChat.push([
    '.sfl{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;justify-content:flex-end;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;color:#fff3dc;-webkit-user-select:none;user-select:none}',
    '.sfl-fixed{position:fixed;z-index:99999}',
    '.sfl-mask{position:absolute;inset:0;background:rgba(10,6,20,.55);opacity:0;transition:opacity .25s}',
    '.sfl.in .sfl-mask{opacity:1}',
    '.sfl-panel{position:relative;width:100%;max-width:560px;margin:0 auto;max-height:82%;display:flex;flex-direction:column;background:linear-gradient(180deg,#3b1522,#230b15);border-top:1.5px solid #d9a441;border-radius:20px 20px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.45);padding-bottom:env(safe-area-inset-bottom);transform:translateY(40px);opacity:0;transition:transform .28s,opacity .28s}',
    '.sfl.in .sfl-panel{transform:none;opacity:1}',
    '.sfl-full .sfl-panel{max-height:100%;height:100%;max-width:none;border-radius:0;border-top:0;padding-top:env(safe-area-inset-top)}',
    '.sfl-half{pointer-events:none}.sfl-half .sfl-mask{display:none}.sfl-half .sfl-panel{pointer-events:auto;max-height:55%}',
    '.sfl-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 18px 8px}',
    '.sfl-head b{font:600 19px/1.2 "STKaiti","KaiTi","Songti SC",serif;letter-spacing:.14em;color:#ffd77a}',
    '.sfl-x{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,215,122,.4);background:rgba(255,255,255,.06);color:#ffd77a;font-size:14px}',
    '.sfl-body{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 18px 20px;-webkit-overflow-scrolling:touch}',
    '.sfb{border:0;border-radius:999px;padding:10px 20px;font:600 14px/1 -apple-system,"PingFang SC",sans-serif;color:#5a1010;background:linear-gradient(180deg,#ffe29a,#e5a93d);box-shadow:0 2px 8px rgba(0,0,0,.35)}',
    '.sfb:active{transform:scale(.97)}.sfb[disabled]{opacity:.45}',
    '.sfb.ghost{background:rgba(255,255,255,.07);color:#ffd77a;border:1px solid rgba(255,215,122,.45);box-shadow:none}',
    '.sfb.sm{padding:7px 13px;font-size:12.5px}',
    '.sfchip{display:inline-block;padding:6px 13px;margin:0 8px 8px 0;border-radius:999px;border:1px solid rgba(255,215,122,.4);color:#ffe3a1;background:rgba(255,255,255,.05);font-size:13px}',
    '.sfchip.on{background:linear-gradient(180deg,#c8202b,#8f1420);border-color:#ffd77a;color:#fff}',
    '.sfl h4{margin:16px 0 6px;font:600 15px/1.3 "STKaiti","KaiTi","Songti SC",serif;letter-spacing:.1em;color:#ffd77a}',
    '.sfl p.tip{margin:4px 0 10px;font-size:12px;line-height:1.7;color:rgba(255,243,220,.7)}',
    '.sfl input[type=text],.sfl textarea,.sfl select{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,215,122,.4);background:rgba(0,0,0,.28);color:#fff3dc;font-size:14px;line-height:1.5;font-family:inherit;outline:0}',
    '.sfrow{display:flex;align-items:center;gap:8px}'
  ].join("\n"));
})(window.__SF);

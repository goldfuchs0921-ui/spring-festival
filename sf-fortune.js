/* 集五福：福禄寿喜财。每天 6 个小任务各抽 1 张（每天最多 6 张），连续重复 2 次后下一张必出新的。 */
(function (SF) {
  "use strict";
  var TYPES = [{ k: "fu", ch: "福" }, { k: "lu", ch: "禄" }, { k: "shou", ch: "寿" }, { k: "xi", ch: "喜" }, { k: "cai", ch: "财" }];
  var TASKS = [
    { k: "sign", t: "每日签到", d: "在这里点一下签到" },
    { k: "firework", t: "放一次烟花", d: "点击首页的天空" },
    { k: "wish", t: "放一个愿望烟花", d: "在守岁里写一句话" },
    { k: "cut", t: "保存一张窗花", d: "去剪纸摊剪一张" },
    { k: "send", t: "发出一个红包", d: "聊天里点 + 号里的红包" },
    { k: "open", t: "拆开一个红包", d: "拆开角色发来的红包" }
  ];
  var chain = Promise.resolve(), view = null;

  async function load() {
    var s = await SF.st.get("fortune", null);
    if (!s) s = { cards: {}, day: "", done: {}, dup: 0, total: 0, gift: null };
    s.cards = s.cards || {}; s.done = s.done || {};
    var d = SF.today();
    if (s.day !== d) { s.day = d; s.done = {}; }
    return s;
  }
  function drawOne(s) {
    var missing = TYPES.filter(function (t) { return !(s.cards[t.k] > 0); });
    var t = s.dup >= 2 && missing.length ? SF.pick(missing) : SF.pick(TYPES);
    var had = s.cards[t.k] > 0;
    s.cards[t.k] = (s.cards[t.k] || 0) + 1;
    s.dup = had ? s.dup + 1 : 0;
    s.total = (s.total || 0) + 1;
    return t;
  }
  function popup(t) {
    var root = SF.appRoot;
    if (!root || !document.body.contains(root)) { SF.toast("获得福卡「" + t.ch + "」"); return; }
    if (SF.sfx) SF.sfx.flip();
    var o = SF.h("div", "sff-pop", '<div class="sff-card"><b>' + t.ch + "</b></div><p>获得福卡「" + t.ch + "」</p>");
    root.appendChild(o);
    o.onclick = function () { o.remove(); };
    setTimeout(function () { if (o.parentNode) o.remove(); }, 2600);
  }
  async function doAward(task, force) {
    var s = await load();
    if (!force && s.done[task]) return null;
    if (task) s.done[task] = 1;
    var t = drawOne(s);
    await SF.st.set("fortune", s);
    popup(t);
    if (view) view();
    return t;
  }

  async function giftFlow(s) {
    var L = SF.layer(SF.appRoot, "新年大礼", { k: "BLESSINGS" });
    L.body.innerHTML = '<p class="tip">五福集齐啦。选一种方式领取新年大礼：预设不花额度；让角色亲自写会调用一次 AI。</p><div class="sff-gsrc"></div><div class="sff-gch"></div><div class="sfrow" style="margin-top:12px"><button class="sfb" data-a="go">领取</button></div>';
    var src = "preset", cid = null, chars = await SF.chars();
    var box = L.body.querySelector(".sff-gsrc"), chb = L.body.querySelector(".sff-gch");
    function paint() {
      box.innerHTML = '<span class="sfchip' + (src === "preset" ? " on" : "") + '" data-s="preset">预设（免费）</span><span class="sfchip' + (src === "ai" ? " on" : "") + '" data-s="ai">让角色写（AI 1 次）</span>';
      chb.innerHTML = src === "ai" ? (chars.length ? SF.chipRow(chars.map(function (c) { return '<span class="sfchip' + (cid === c.id ? " on" : "") + '" data-c="' + SF.esc(c.id) + '">' + SF.esc(SF.cname(c)) + "</span>"; }).join("")) : '<p class="tip">没有读取到角色</p>') : "";
      SF.fadeRows(chb);
    }
    paint();
    L.body.addEventListener("click", async function (e) {
      var a = e.target.closest("[data-s],[data-c],[data-a]"); if (!a) return;
      if (a.dataset.s) { src = a.dataset.s; paint(); }
      else if (a.dataset.c) { cid = a.dataset.c; paint(); }
      else if (a.dataset.a === "go") {
        var text = "", who = "新春";
        if (src === "preset") text = SF.pick(SF.data.gift);
        else {
          var c = chars.filter(function (x) { return x.id === cid; })[0];
          if (!c) { SF.toast("先选一位角色"); return; }
          if (!(await SF.confirm("调用 AI", "让「" + SF.cname(c) + "」写新年大礼，会消耗 1 次 AI。继续吗？"))) return;
          a.disabled = true; a.textContent = "写信中…";
          try {
            var me = await SF.userName();
            text = (await SF.ai("你是" + SF.cname(c) + "。" + SF.persona(c), "你集齐了福禄寿喜财五福。请以你自己的口吻，给「" + me + "」写一封新年大礼小信，80到130字，真诚温暖，不要列表，不要加引号，只输出正文。", 0.9)).trim().replace(/^["“「]|["”」]$/g, "");
            who = SF.cname(c);
          } catch (err) { SF.toast("AI 调用失败：" + (err.message || err)); a.disabled = false; a.textContent = "领取"; return; }
          if (!text) { SF.toast("没有收到内容，请重试"); a.disabled = false; a.textContent = "领取"; return; }
        }
        var s2 = await load(); s2.gift = { who: who, text: text, ts: Date.now() };
        await SF.st.set("fortune", s2);
        L.close(); showGift(s2.gift); if (view) view();
      }
    });
  }
  function showGift(g) {
    var L = SF.layer(SF.appRoot, "新年大礼", { k: "BLESSINGS" });
    L.body.innerHTML = '<div class="sff-letter"><p>' + SF.esc(g.text) + '</p><em>—— ' + SF.esc(g.who) + "</em></div>";
  }

  SF.fortune = {
    award: function (task, force) { chain = chain.then(function () { return doAward(task, force); }).catch(function (e) { console.error(e); }); return chain; },
    load: load,
    open: async function () {
      var L = SF.layer(SF.appRoot, "集五福", { full: true, k: "BLESSINGS", onClose: function () { view = null; } });
      async function render() {
        var s = await load(), got = TYPES.filter(function (t) { return s.cards[t.k] > 0; }).length;
        var done = TASKS.filter(function (t) { return s.done[t.k]; }).length;
        var h = '<div class="sff-hero"><b>' + got + "<span>/5</span></b><small>已集福卡　·　今日福气 " + done + "/" + TASKS.length + "</small></div>" + '<div class="sff-grid">' + TYPES.map(function (t) {
          var n = s.cards[t.k] || 0;
          return '<div class="sff-c' + (n ? "" : " off") + '"><b>' + t.ch + "</b>" + (n > 1 ? "<i>×" + n + "</i>" : "") + "</div>";
        }).join("") + "</div>";
        h += '<p class="tip" style="margin-top:12px">每个任务每天一次，各抽一张福卡，福卡可能重复。</p>';
        h += "<h4>今日福气</h4>" + '<div class="sf-card">' + TASKS.map(function (t) {
          var ok = s.done[t.k];
          return '<div class="sff-t' + (ok ? " ok" : "") + '"><div><b>' + t.t + "</b><small>" + t.d + "</small></div>" +
            (ok ? "<span>已完成</span>" : t.k === "sign" ? '<button class="sfb sm" data-a="sign">签到</button>' : "<span>去完成</span>") + "</div>";
        }).join("") + "</div>";
        if (got === 5) h += '<button class="sfb block" style="margin-top:18px" data-a="gift" type="button">' + (s.gift ? "再看看新年大礼" : "领取新年大礼") + "</button>";
        L.body.innerHTML = h;
      }
      view = render;
      L.body.addEventListener("click", async function (e) {
        var a = e.target.closest("[data-a]"); if (!a) return;
        if (a.dataset.a === "sign") await SF.fortune.award("sign");
        else if (a.dataset.a === "gift") { var s = await load(); if (s.gift) showGift(s.gift); else giftFlow(s); }
      });
      render();
    },
    // 测试面板用
    testFill: async function () { var s = await load(); TYPES.forEach(function (t) { s.cards[t.k] = Math.max(1, s.cards[t.k] || 0); }); await SF.st.set("fortune", s); if (view) view(); },
    testReset: async function () { await SF.st.del("fortune"); if (view) view(); },
    testDay: async function () { var s = await load(); s.done = {}; await SF.st.set("fortune", s); if (view) view(); },
    testExtra: function () { return SF.fortune.award(null, true); }
  };

  SF.cssApp.push([
    ".sff-hero{margin:0 0 14px}.sff-hero b{font:200 54px/1 -apple-system,\"PingFang SC\",sans-serif;color:var(--big)}.sff-hero b span{font-size:22px;color:var(--acc);margin-left:4px}.sff-hero small{display:block;margin-top:8px;font-size:10px;letter-spacing:5px;color:var(--k)}",
    ".sff-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:8px 0 12px}",
    '.sff-c{position:relative;aspect-ratio:3/4;border-radius:10px;background:linear-gradient(160deg,#d4262f,#8f1420);border:1.5px solid #ffd77a;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 14px rgba(255,215,122,.25)}',
    '.sff-c b{font:700 34px/1 "STKaiti","KaiTi","Songti SC",serif;color:#ffe29a;text-shadow:0 1px 6px rgba(0,0,0,.4)}',
    ".sff-c.off{filter:grayscale(.9) brightness(.5);border-color:rgba(255,215,122,.3)}",
    ".sff-c i{position:absolute;right:-5px;top:-7px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:#ffd77a;color:#7a1010;font:700 11px/18px sans-serif;text-align:center;font-style:normal}",
    ".sff-t{display:flex;align-items:center;justify-content:space-between;padding:11px 2px;border-bottom:1px solid var(--hair)}",
    ".sff-t b{display:block;font-size:14px;font-weight:500;color:var(--tx)}.sff-t small{font-size:11.5px;color:var(--k)}",
    ".sf-card .sff-t:first-child{padding-top:2px}.sf-card .sff-t:last-child{border-bottom:0;padding-bottom:2px}",
    ".sff-t>span{font-size:12px;color:var(--acc)}.sff-t.ok b{opacity:.5;text-decoration:line-through}.sff-t.ok>span{color:#4f9d63}",
    ".sff-pop{position:absolute;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,6,20,.5);color:#ffe3a1;font:600 16px/1 serif;letter-spacing:.1em}",
    ".sff-pop .sff-card{width:112px;height:150px;border-radius:12px;background:linear-gradient(160deg,#d4262f,#8f1420);border:2px solid #ffd77a;display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(255,200,90,.55);animation:sffFlip .6s ease-out}",
    '.sff-pop .sff-card b{font:700 60px/1 "STKaiti","KaiTi","Songti SC",serif;color:#ffe29a}.sff-pop p{margin-top:18px}',
    "@keyframes sffFlip{from{transform:rotateY(180deg) scale(.6);opacity:0}to{transform:none;opacity:1}}",
    '.sff-letter{margin:8px 0;padding:22px 20px;border-radius:6px;background:linear-gradient(180deg,#fff1cf,#f3d9a0);color:#6a1a14;font:16px/2 "STKaiti","KaiTi","Songti SC",serif;box-shadow:0 6px 24px rgba(0,0,0,.4)}',
    ".sff-letter p{margin:0 0 10px;white-space:pre-wrap}.sff-letter em{display:block;text-align:right;font-style:normal;color:#9a2a20}"
  ].join("\n"));
})(window.__SF);

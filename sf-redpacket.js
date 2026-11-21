/* 红包：聊天卡片 + 「+」面板发送 + 红包摊（记录/祝福池）。红包只有祝福，没有金额。 */
(function (SF) {
  "use strict";
  function fmt(t) {
    var d = new Date(t), p = function (n) { return ("0" + n).slice(-2); };
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function clean(t) { return String(t || "").trim().replace(/^["“「]|["”」]$/g, ""); }
  function fmtAmt(n) { return Number(n).toFixed(2); }
  function mtext(cd) {
    var amt = cd.amount != null ? "，金额 " + fmtAmt(cd.amount) : "";
    var base = "我给你发了一个新春红包" + amt + "，里面写着：「" + cd.blessing + "」";
    return cd.status === "opened" ? base + "（你已经拆开了）" : base;
  }
  async function getPool(id) { return await SF.st.get("rp_pool_" + id, []); }
  async function addRecord(r) {
    var a = await SF.st.get("rp_records", []); a.unshift(r); if (a.length > 60) a.length = 60;
    await SF.st.set("rp_records", a);
  }
  async function aiBless(char) {
    var me = await SF.userName();
    return clean(await SF.ai("你是" + SF.cname(char) + "。" + SF.persona(char),
      "现在是春节，请你用自己的口吻，写一句送给「" + me + "」的红包祝福，30字以内，口语化，只输出这句话。", 0.95)).slice(0, 80);
  }
  async function genPool(char) {
    var me = await SF.userName();
    var a = SF.parseJson(await SF.ai("你是" + SF.cname(char) + "。" + SF.persona(char),
      "春节到了，请你用自己的口吻，写12条不同的红包祝福，对象是「" + me + "」，每条30字以内，口语化，风格有变化。只输出 JSON 数组，例如：[\"祝福一\",\"祝福二\"]", 0.95));
    if (!Array.isArray(a)) throw new Error("没有解析到祝福列表，请重试");
    return a.map(clean).filter(Boolean).slice(0, 20);
  }
  function sparks(card) {
    for (var i = 0; i < 12; i++) {
      var s = SF.h("span", "sfc-spark"), a = Math.random() * 6.28, d = 40 + Math.random() * 60;
      s.style.cssText = "left:" + (20 + Math.random() * 40) + "px;top:30px;--dx:" + Math.cos(a) * d + "px;--dy:" + (Math.sin(a) * d - 20) + "px";
      card.appendChild(s); setTimeout(function (x) { return function () { x.remove(); }; }(s), 1000);
    }
  }


  function countUp(el, to, ms) {
    var t0 = performance.now();
    (function f(t) {
      var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * e).toFixed(2);
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }
  function coins(ov) {
    var r = ov.querySelector(".sfx-env").getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.4;
    for (var i = 0; i < 36; i++) {
      var s = SF.h("i", "sfx-p"), a = Math.random() * 6.283, d = 90 + Math.random() * 190, sz = 4 + Math.random() * 6;
      s.style.cssText = "left:" + cx + "px;top:" + cy + "px;width:" + sz + "px;height:" + sz + "px;--dx:" + Math.cos(a) * d + "px;--dy:" + (Math.sin(a) * d - 60) + "px;animation-delay:" + (Math.random() * 0.15).toFixed(2) + "s";
      ov.appendChild(s); setTimeout(function (x) { return function () { x.remove(); }; }(s), 1500);
    }
  }
  // 全屏拆红包：从聊天卡片位置放大到屏幕中央，点「開」拆开，点任意处收回卡片位置
  function showEnvelope(cd, title, rect, commit) {
    return new Promise(function (resolve) {
      var amt = cd.amount != null ? fmtAmt(cd.amount) : "", opened = false, closing = false;
      var ov = SF.h("div", "sfx");
      ov.innerHTML = '<div class="sfx-bg"></div><div class="sfx-env"><div class="sfx-paper"><small>新春红包</small>' + (amt ? '<b class="sfx-amt">¥ <span>0.00</span></b>' : "") + "<p>" + SF.esc(cd.blessing || "") + '</p></div><div class="sfx-body"><span>' + SF.esc(title) + '</span></div><div class="sfx-flap"></div><button class="sfx-open" type="button">開</button></div><div class="sfx-hint">点击任意处收下</div>';
      document.body.appendChild(ov);
      var env = ov.querySelector(".sfx-env"), bg = ov.querySelector(".sfx-bg"), hint = ov.querySelector(".sfx-hint");
      requestAnimationFrame(function () { bg.style.opacity = 1; });
      var er = env.getBoundingClientRect();
      var from = rect ? { dx: rect.left + rect.width / 2 - (er.left + er.width / 2), dy: rect.top + rect.height / 2 - (er.top + er.height / 2), s: Math.max(0.2, rect.width / er.width) } : { dx: 0, dy: 0, s: 0.5 };
      if (!SF.reduce()) env.animate([{ transform: "translate(" + from.dx + "px," + from.dy + "px) scale(" + from.s + ")", opacity: 0.6 }, { transform: "none", opacity: 1 }], { duration: 560, easing: "cubic-bezier(.2,.9,.25,1)" });
      function open() {
        if (opened) return; opened = true;
        ov.classList.add("open");
        if (SF.sfx) SF.sfx.packet();
        coins(ov);
        if (amt) countUp(ov.querySelector(".sfx-amt span"), Number(amt), 950);
        setTimeout(function () { hint.style.opacity = 1; }, 900);
        if (commit) commit();
      }
      function close() {
        if (closing) return; closing = true;
        var done = function () { ov.remove(); resolve(); };
        if (SF.reduce()) return done();
        bg.style.opacity = 0; hint.style.opacity = 0;
        var a = env.animate([{ transform: "none", opacity: 1 }, { transform: "translate(" + from.dx + "px," + from.dy + "px) scale(" + from.s + ")", opacity: 0 }], { duration: 400, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" });
        a.onfinish = done; setTimeout(done, 520);
      }
      ov.querySelector(".sfx-open").onclick = function (e) { e.stopPropagation(); open(); };
      ov.addEventListener("click", function (e) { if (!opened && e.target.closest(".sfx-env")) return; close(); });
      if (!commit) setTimeout(open, 700); // 已经拆过的红包：自动展开给你看
    });
  }

  SF.rp = {
    // ---------- 聊天里的红包卡片 ----------
    mountCard: function (c, m, r) {
      SF.setRoche(r);
      var cd = m.cardData || {}, sealed = cd.dir === "ta2me" && cd.status !== "opened";
      var card = SF.h("div", "sfc-rp " + (sealed ? "sealed" : "done"));
      var who = cd.dir === "ta2me" ? SF.esc(cd.fromName || "TA") + " 送给你" : "你送给 " + SF.esc(cd.toName || "TA");
      var amtHtml = !sealed && cd.amount != null ? '<b class="sfc-amt">¥ ' + fmtAmt(cd.amount) + "</b>" : "";
      card.innerHTML = '<div class="sfc-rp-top"><span class="sfc-coin">福</span><div class="sfc-rp-t"><strong>新春红包</strong>' + amtHtml + "<em>" +
        (sealed ? "点一下，拆开看看" : SF.esc(cd.blessing || "")) + '</em></div></div><div class="sfc-rp-bot">' + who + "</div>";
      c.replaceChildren(card);
      async function commit() {
        var nd = Object.assign({}, cd, { status: "opened", openedAt: Date.now() });
        try {
          await r.chat.updateCard({ conversationId: m.conversationId, messageId: m.id, cardData: nd, modelText: mtext(nd) });
        } catch (e) { SF.toast("红包更新失败：" + (e.message || e)); return; }
        addRecord({ t: Date.now(), dir: "opened", who: cd.fromName || "TA", blessing: cd.blessing, amount: cd.amount });
        try {
          await r.chat.sendMessage({ conversationId: m.conversationId, kind: "system", text: "你领取了 " + (cd.fromName || "TA") + " 的新春红包" + (cd.amount != null ? "，金额 " + fmtAmt(cd.amount) : "") });
        } catch (e) { console.warn("系统提示发送失败", e); }
        if (SF.fortune) SF.fortune.award("open");
      }
      var busy = false;
      card.onclick = function () {
        if (busy) return; busy = true;
        showEnvelope(cd, who.replace(/<[^>]+>/g, ""), card.getBoundingClientRect(), sealed ? commit : null).then(function () { busy = false; });
      };
    },

    // ---------- 「+」面板：发红包 ----------
    openSheet: async function (ctx, r) {
      SF.setRoche(r);
      var conv = null;
      try { conv = await r.conversation.get(ctx.conversationId); } catch (e) {}
      var isGroup = !!(conv && conv.isGroup), members = (conv && conv.memberProfiles) || [];
      var st = { dir: "ta2me", src: "preset", text: "", amount: "", pool: [],
        cid: isGroup ? null : ((conv && conv.contactId) || ctx.contactId || (ctx.contact && ctx.contact.id) || null) };
      if (!isGroup && !st.cid) { SF.toast("没有找到这个聊天的角色"); return; }
      var L = SF.layer(document.body, "新春红包", { fixed: true, k: "RED PACKET" });

      async function render() {
        st.pool = st.cid ? await getPool(st.cid) : [];
        var h = '<p class="tip">选择谁发、金额和祝福从哪来。</p><div><span class="sfchip' + (st.dir === "ta2me" ? " on" : "") + '" data-d="ta2me">TA 发给我</span><span class="sfchip' + (st.dir === "me2ta" ? " on" : "") + '" data-d="me2ta">我发给 TA</span></div>';
        if (isGroup) {
          h += "<h4>" + (st.dir === "ta2me" ? "谁来发" : "发给谁") + "</h4>" + SF.chipRow(members.map(function (x) {
            return '<span class="sfchip' + (st.cid === x.id ? " on" : "") + '" data-c="' + SF.esc(x.id) + '">' + SF.esc(x.handle || x.name || x.displayName) + "</span>";
          }).join(""));
        }
        h += "<h4>祝福从哪来</h4><div>";
        var opts = st.dir === "ta2me" ? [["preset", "预设（免费）"], ["pool", "祝福池（" + st.pool.length + "）"], ["ai", "TA 现写（AI 1 次）"]] : [["preset", "预设（免费）"], ["custom", "我自己写"]];
        h += opts.map(function (o) { return '<span class="sfchip' + (st.src === o[0] ? " on" : "") + '" data-s="' + o[0] + '">' + o[1] + "</span>"; }).join("") + "</div>";
        if (st.src === "custom") h += '<textarea rows="3" maxlength="60" placeholder="写给 TA 的祝福（60字内）">' + SF.esc(st.text) + "</textarea>";
        if (st.src === "pool" && !st.pool.length) h += '<p class="tip">祝福池是空的。去首页的红包摊里，可以让角色一次攒 12 句。</p>';
        h += "<h4>金额</h4>";
        if (st.dir === "me2ta") h += '<input type="text" class="sfamt" inputmode="decimal" placeholder="如 8.88，留空则随机吉利数字" value="' + SF.esc(st.amount) + '"><div style="margin-top:8px">' + ["6.66", "8.88", "66.6", "88.8", "520", "1314"].map(function (v) { return '<span class="sfchip" data-q="' + v + '">' + v + "</span>"; }).join("") + "</div>";
        else h += '<p class="tip">TA 发的红包，金额会从吉利数字里随机抽。</p>';
        h += '<div class="sfrow" style="margin-top:16px;justify-content:center"><button class="sfb" data-a="send">发出红包</button></div>';
        L.body.innerHTML = h; SF.fadeRows(L.body);
        var ta = L.body.querySelector("textarea"); if (ta) ta.oninput = function () { st.text = ta.value; };
        var am = L.body.querySelector(".sfamt"); if (am) am.oninput = function () { st.amount = am.value; };
      }
      L.body.addEventListener("click", async function (e) {
        var a = e.target.closest("[data-d],[data-s],[data-c],[data-a],[data-q]"); if (!a) return;
        if (a.dataset.d) { st.dir = a.dataset.d; st.src = "preset"; await render(); }
        else if (a.dataset.s) { st.src = a.dataset.s; await render(); }
        else if (a.dataset.c) { st.cid = a.dataset.c; if (st.src === "pool") st.src = "preset"; await render(); }
        else if (a.dataset.q) { st.amount = a.dataset.q; await render(); }
        else if (a.dataset.a === "send") await send(a);
      });
      async function send(btn) {
        if (!st.cid) { SF.toast("先选一位角色"); return; }
        btn.disabled = true;
        try {
          var amount;
          if (st.dir === "me2ta" && String(st.amount || "").trim() !== "") {
            var num = Number(String(st.amount).trim());
            if (!isFinite(num) || num <= 0 || num > 99999.99) { SF.toast("金额请填 0.01 ~ 99999.99"); btn.disabled = false; return; }
            amount = Math.round(num * 100) / 100;
          } else amount = SF.pick(SF.data.amounts);
          var char = (await r.character.get(st.cid)) || {}, name = SF.cname(char), blessing = "";
          if (st.dir === "me2ta") {
            blessing = st.src === "custom" ? clean(st.text) : SF.pick(SF.data.rp);
            if (!blessing) { SF.toast("先写一句祝福"); btn.disabled = false; return; }
          } else if (st.src === "pool") {
            var pool = await getPool(st.cid);
            if (pool.length) { var i = Math.floor(Math.random() * pool.length); blessing = pool.splice(i, 1)[0]; await SF.st.set("rp_pool_" + st.cid, pool); }
            else blessing = SF.pick(SF.data.rp);
          } else if (st.src === "ai") {
            if (!(await SF.confirm("调用 AI", "让「" + name + "」现写一句祝福，会消耗 1 次 AI。继续吗？"))) { btn.disabled = false; return; }
            btn.textContent = "写祝福中…";
            blessing = await aiBless(char);
            if (!blessing) throw new Error("没有收到祝福内容，请重试");
          } else blessing = SF.pick(SF.data.rp);
          var cd = { dir: st.dir, status: "sealed", blessing: blessing, amount: amount, fromName: name, toName: name, ts: Date.now() };
          await r.chat.createCard({
            conversationId: ctx.conversationId, messageType: "red-packet", isMe: st.dir === "me2ta",
            senderId: st.dir === "ta2me" ? st.cid : undefined, cardData: cd, modelText: mtext(cd)
          });
          addRecord({ t: Date.now(), dir: st.dir, who: name, blessing: blessing, amount: amount });
          if (SF.fortune) SF.fortune.award("send");
          L.close();
        } catch (e) { SF.toast("发送失败：" + (e.message || e)); btn.disabled = false; btn.textContent = "发出红包"; }
      }
      render();
    },

    // ---------- 首页红包摊：记录 / 祝福池 ----------
    openStall: async function () {
      var L = SF.layer(SF.appRoot, "红包摊", { full: true, k: "RED PACKET" });
      var tab = "rec", chars = await SF.chars(), cid = chars[0] ? chars[0].id : null;
      async function render() {
        var h = '<div><span class="sfchip' + (tab === "rec" ? " on" : "") + '" data-t="rec">红包记录</span><span class="sfchip' + (tab === "pool" ? " on" : "") + '" data-t="pool">祝福池</span></div>';
        if (tab === "rec") {
          var a = await SF.st.get("rp_records", []);
          h += a.length ? a.map(function (x) {
            var lab = x.dir === "ta2me" ? SF.esc(x.who) + " → 我" : x.dir === "me2ta" ? "我 → " + SF.esc(x.who) : "拆开了 " + SF.esc(x.who) + " 的红包";
            return '<div class="sfr-i"><div><small>' + fmt(x.t) + "　" + lab + (x.amount != null ? " · ¥" + fmtAmt(x.amount) : "") + "</small><p>" + SF.esc(x.blessing || "") + "</p></div></div>";
          }).join("") : '<p class="tip">还没有红包记录。在聊天里点「+」号里的「新春红包」就能发。</p>';
        } else {
          h += '<p class="tip">祝福池按角色分开存。让角色一次攒 12 句（AI 1 次），之后发红包时随机抽，每句只用一次。</p>' +
            (chars.length ? SF.chipRow(chars.map(function (c) { return '<span class="sfchip' + (cid === c.id ? " on" : "") + '" data-c="' + SF.esc(c.id) + '">' + SF.esc(SF.cname(c)) + "</span>"; }).join("")) : '<p class="tip">没有读取到角色</p>');
          if (cid) {
            var p = await getPool(cid);
            h += '<div class="sfrow" style="margin:6px 0 10px"><button class="sfb sm" data-a="gen">攒 12 句（AI 1 次）</button>' + (p.length ? '<button class="sfb sm ghost" data-a="clr">清空</button>' : "") + "</div>";
            h += p.map(function (x, i) { return '<div class="sfr-i"><p>' + SF.esc(x) + '</p><button class="sfb sm ghost" data-x="' + i + '">删</button></div>'; }).join("") || '<p class="tip">池子是空的。</p>';
          }
        }
        L.body.innerHTML = h; SF.fadeRows(L.body);
      }
      L.body.addEventListener("click", async function (e) {
        var a = e.target.closest("[data-t],[data-c],[data-a],[data-x]"); if (!a) return;
        if (a.dataset.t) { tab = a.dataset.t; }
        else if (a.dataset.c) { cid = a.dataset.c; }
        else if (a.dataset.x != null) { var p = await getPool(cid); p.splice(+a.dataset.x, 1); await SF.st.set("rp_pool_" + cid, p); }
        else if (a.dataset.a === "clr") { await SF.st.set("rp_pool_" + cid, []); }
        else if (a.dataset.a === "gen") {
          var char = chars.filter(function (c) { return c.id === cid; })[0];
          if (!(await SF.confirm("调用 AI", "让「" + SF.cname(char) + "」一次写 12 句红包祝福，会消耗 1 次 AI。继续吗？"))) return;
          a.disabled = true; a.textContent = "攒祝福中…";
          try { var add = await genPool(char); var old = await getPool(cid); await SF.st.set("rp_pool_" + cid, old.concat(add).slice(-40)); SF.toast("已加入 " + add.length + " 句"); }
          catch (err) { SF.toast("失败：" + (err.message || err)); }
        }
        render();
      });
      render();
    }
  };

  // 聊天卡片 + 弹层样式（常驻）
  SF.cssChat.push([
    '.sfc-rp{position:relative;width:236px;max-width:100%;border-radius:14px;overflow:hidden;background:linear-gradient(160deg,#dc3a36,#a51a26);border:1.5px solid #f0c15a;box-shadow:0 4px 14px rgba(120,10,20,.4);color:#fff3dc;font-family:-apple-system,"PingFang SC",sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}',
    ".sfc-rp-top{display:flex;gap:12px;align-items:center;padding:14px 14px 12px}",
    '.sfc-coin{flex:0 0 44px;height:44px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff0b8,#e0a533);color:#8f1420;font:700 24px/44px "STKaiti","KaiTi","Songti SC",serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.35)}',
    '.sfc-rp-t strong{display:block;font:700 16px/1.3 "STKaiti","KaiTi","Songti SC",serif;letter-spacing:.12em;color:#ffe29a}',
    ".sfc-rp-t em{display:block;margin-top:4px;font-style:normal;font-size:12.5px;line-height:1.5;color:#ffeccc;word-break:break-all}",
    ".sfc-rp-bot{padding:6px 14px;font-size:11px;background:rgba(80,8,16,.45);color:#ffd9a0}",
    ".sfc-rp.sealed{cursor:pointer}.sfc-rp.sealed .sfc-coin{animation:sfcPulse 1.6s ease-in-out infinite}",
    ".sfc-rp.open{animation:sfcPop .6s}.sfc-rp.open .sfc-coin{animation:sfcSpin .7s}",
    "@keyframes sfcPulse{50%{transform:scale(1.1);box-shadow:0 0 14px rgba(255,214,120,.9)}}",
    "@keyframes sfcSpin{to{transform:rotateY(360deg)}}@keyframes sfcPop{40%{transform:scale(1.05)}}",
    ".sfc-spark{position:absolute;width:6px;height:6px;border-radius:50%;background:#ffe29a;animation:sfcSpark .9s ease-out forwards}",
    "@keyframes sfcSpark{to{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}",
    '.sfc-amt{display:block;margin-top:2px;font:700 20px/1.3 "STKaiti","KaiTi","Songti SC",serif;color:#fff3dc}',
    `.sfx{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;font-family:-apple-system,"PingFang SC",sans-serif;-webkit-user-select:none;user-select:none}
.sfx-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,rgba(150,28,38,.88),rgba(12,4,14,.95));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:0;transition:opacity .4s}
.sfx-env{position:relative;width:min(74vw,300px);height:calc(min(74vw,300px) * 1.4);border-radius:16px;background:linear-gradient(160deg,#e24a40,#a51a26);border:2px solid #f0c15a;box-shadow:0 24px 70px rgba(0,0,0,.55),0 0 80px rgba(255,190,90,.28);perspective:900px}
.sfx-flap{position:absolute;left:1%;right:1%;top:0;height:46%;background:linear-gradient(180deg,#f2594c,#c22a2e);clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:top center;transition:transform .75s cubic-bezier(.3,.9,.3,1);z-index:4}
.sfx.open .sfx-flap{transform:rotateX(180deg);z-index:1}
.sfx-paper{position:absolute;left:7%;right:7%;top:10%;height:70%;border-radius:10px;background:linear-gradient(180deg,#fff6df,#f4dcaa);z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px;padding:14% 14px 0;text-align:center;color:#8f1420;transform:translateY(40%);opacity:0;transition:transform .85s cubic-bezier(.2,.9,.25,1) .3s,opacity .4s .3s}
.sfx.open .sfx-paper{transform:translateY(-14%);opacity:1}
.sfx-paper small{font:600 12px/1 "STKaiti","KaiTi",serif;letter-spacing:.3em;color:#b3322a}
.sfx-amt{font:700 38px/1.1 "STKaiti","KaiTi","Songti SC",serif;color:#a51a26;font-variant-numeric:tabular-nums}
.sfx-paper p{margin:0;font:15px/1.8 "STKaiti","KaiTi","Songti SC",serif;color:#7a2418}
.sfx-body{position:absolute;left:0;right:0;bottom:0;height:56%;background:linear-gradient(170deg,#ea5243,#b01f2b);clip-path:polygon(0 22%,50% 0,100% 22%,100% 100%,0 100%);border-radius:0 0 14px 14px;z-index:3;display:flex;align-items:flex-end;justify-content:center;padding-bottom:16px}
.sfx-body span{font:600 13px/1 "STKaiti","KaiTi",serif;letter-spacing:.2em;color:#ffd9a0}
.sfx-open{position:absolute;left:50%;top:46%;width:66px;height:66px;margin:-33px 0 0 -33px;padding:0;border:0;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff0b8,#e0a533);color:#8f1420;font:700 30px/66px "STKaiti","KaiTi","Songti SC",serif;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,.4);animation:sfxPulse 1.6s ease-in-out infinite}
.sfx.open .sfx-open{animation:sfxGone .6s forwards;pointer-events:none}
@keyframes sfxPulse{50%{transform:scale(1.08);box-shadow:0 0 24px rgba(255,214,120,.9)}}
@keyframes sfxGone{to{transform:rotateY(540deg) scale(0);opacity:0}}
.sfx-p{position:fixed;border-radius:50%;pointer-events:none;background:radial-gradient(circle at 35% 30%,#fff0b8,#e0a533);animation:sfxP 1.2s cubic-bezier(.2,.8,.3,1) forwards}
@keyframes sfxP{0%{transform:translate(0,0) scale(.2);opacity:1}70%{opacity:1}100%{transform:translate(var(--dx),calc(var(--dy) + 80px)) scale(1);opacity:0}}
.sfx-hint{position:absolute;left:0;right:0;bottom:calc(9% + env(safe-area-inset-bottom));text-align:center;color:rgba(255,235,200,.85);letter-spacing:.4em;font-size:12px;opacity:0;transition:opacity .5s}
@media (prefers-reduced-motion:reduce){.sfx *{animation:none!important;transition:none!important}}`
  ].join("\n"));
  SF.cssApp.push([
    ".sfr-i{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 2px;border-bottom:1px solid var(--hair)}",
    ".sfr-i small{display:block;font-size:11px;color:var(--k);margin-bottom:3px}.sfr-i p{margin:0;font-size:13.5px;line-height:1.6;flex:1;color:var(--tx)}"
  ].join("\n"));
})(window.__SF);

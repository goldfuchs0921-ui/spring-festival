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
    var amt = cd.amount != null ? "（虚拟压岁钱 " + fmtAmt(cd.amount) + "，只是红包上的数字，不是真的转账）" : "";
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

  SF.rp = {
    // ---------- 聊天里的红包卡片 ----------
    mountCard: function (c, m, r) {
      SF.setRoche(r);
      var cd = m.cardData || {}, sealed = cd.dir === "ta2me" && cd.status !== "opened";
      var card = SF.h("div", "sfc-rp " + (sealed ? "sealed" : "done"));
      var who = (cd.dir === "ta2me" ? SF.esc(cd.fromName || "TA") + " 送给你" : "你送给 " + SF.esc(cd.toName || "TA")) + (cd.amount != null ? " · 虚拟压岁钱" : "");
      var amtHtml = !sealed && cd.amount != null ? '<b class="sfc-amt">¥ ' + fmtAmt(cd.amount) + "</b>" : "";
      card.innerHTML = '<div class="sfc-rp-top"><span class="sfc-coin">福</span><div class="sfc-rp-t"><strong>新春红包</strong>' + amtHtml + "<em>" +
        (sealed ? "点一下，拆开看看" : SF.esc(cd.blessing || "")) + '</em></div></div><div class="sfc-rp-bot">' + who + "</div>";
      c.replaceChildren(card);
      if (!sealed) return;
      var busy = false;
      card.onclick = async function () {
        if (busy) return; busy = true;
        card.classList.add("open"); sparks(card); if (SF.sfx) SF.sfx.packet();
        card.querySelector("em").textContent = cd.blessing || "";
        if (cd.amount != null) card.querySelector("em").before(SF.h("b", "sfc-amt", "¥ " + fmtAmt(cd.amount)));
        await SF.wait(700);
        try {
          var nd = Object.assign({}, cd, { status: "opened", openedAt: Date.now() });
          await r.chat.updateCard({ conversationId: m.conversationId, messageId: m.id, cardData: nd, modelText: mtext(nd) });
        } catch (e) { SF.toast("红包更新失败：" + (e.message || e)); busy = false; card.classList.remove("open"); return; }
        addRecord({ t: Date.now(), dir: "opened", who: cd.fromName || "TA", blessing: cd.blessing, amount: cd.amount });
        if (SF.fortune) SF.fortune.award("open");
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
      var L = SF.layer(document.body, "新春红包", { fixed: true });

      async function render() {
        st.pool = st.cid ? await getPool(st.cid) : [];
        var h = '<p class="tip">红包里有祝福和一个虚拟金额，金额只显示在红包上，不会计入 Roche 钱包。</p><div><span class="sfchip' + (st.dir === "ta2me" ? " on" : "") + '" data-d="ta2me">TA 发给我</span><span class="sfchip' + (st.dir === "me2ta" ? " on" : "") + '" data-d="me2ta">我发给 TA</span></div>';
        if (isGroup) {
          h += "<h4>" + (st.dir === "ta2me" ? "谁来发" : "发给谁") + "</h4><div>" + members.map(function (x) {
            return '<span class="sfchip' + (st.cid === x.id ? " on" : "") + '" data-c="' + SF.esc(x.id) + '">' + SF.esc(x.handle || x.name || x.displayName) + "</span>";
          }).join("") + "</div>";
        }
        h += "<h4>祝福从哪来</h4><div>";
        var opts = st.dir === "ta2me" ? [["preset", "预设（免费）"], ["pool", "祝福池（" + st.pool.length + "）"], ["ai", "TA 现写（AI 1 次）"]] : [["preset", "预设（免费）"], ["custom", "我自己写"]];
        h += opts.map(function (o) { return '<span class="sfchip' + (st.src === o[0] ? " on" : "") + '" data-s="' + o[0] + '">' + o[1] + "</span>"; }).join("") + "</div>";
        if (st.src === "custom") h += '<textarea rows="3" maxlength="60" placeholder="写给 TA 的祝福（60字内）">' + SF.esc(st.text) + "</textarea>";
        if (st.src === "pool" && !st.pool.length) h += '<p class="tip">祝福池是空的。去首页的红包摊里，可以让角色一次攒 12 句。</p>';
        h += "<h4>金额（虚拟压岁钱）</h4>";
        if (st.dir === "me2ta") h += '<input type="text" class="sfamt" inputmode="decimal" placeholder="如 8.88，留空则随机吉利数字" value="' + SF.esc(st.amount) + '"><div style="margin-top:8px">' + ["6.66", "8.88", "66.6", "88.8", "520", "1314"].map(function (v) { return '<span class="sfchip" data-q="' + v + '">' + v + "</span>"; }).join("") + "</div>";
        else h += '<p class="tip">TA 发的红包，金额会从吉利数字里随机抽。</p>';
        h += '<div class="sfrow" style="margin-top:16px;justify-content:center"><button class="sfb" data-a="send">发出红包</button></div>';
        L.body.innerHTML = h;
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
      var L = SF.layer(SF.appRoot, "红包摊", { full: true });
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
          h += '<p class="tip">祝福池按角色分开存。让角色一次攒 12 句（AI 1 次），之后发红包时随机抽，每句只用一次。</p><div>' +
            (chars.map(function (c) { return '<span class="sfchip' + (cid === c.id ? " on" : "") + '" data-c="' + SF.esc(c.id) + '">' + SF.esc(SF.cname(c)) + "</span>"; }).join("") || '<p class="tip">没有读取到角色</p>') + "</div>";
          if (cid) {
            var p = await getPool(cid);
            h += '<div class="sfrow" style="margin:6px 0 10px"><button class="sfb sm" data-a="gen">攒 12 句（AI 1 次）</button>' + (p.length ? '<button class="sfb sm ghost" data-a="clr">清空</button>' : "") + "</div>";
            h += p.map(function (x, i) { return '<div class="sfr-i"><p>' + SF.esc(x) + '</p><button class="sfb sm ghost" data-x="' + i + '">删</button></div>'; }).join("") || '<p class="tip">池子是空的。</p>';
          }
        }
        L.body.innerHTML = h;
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
    '.sfc-amt{display:block;margin-top:2px;font:700 20px/1.3 "STKaiti","KaiTi","Songti SC",serif;color:#fff3dc}'
  ].join("\n"));
  SF.cssApp.push([
    ".sfr-i{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 2px;border-bottom:1px solid rgba(255,215,122,.16)}",
    ".sfr-i small{display:block;font-size:11px;color:rgba(255,215,122,.75);margin-bottom:3px}.sfr-i p{margin:0;font-size:13.5px;line-height:1.6;flex:1}"
  ].join("\n"));
})(window.__SF);

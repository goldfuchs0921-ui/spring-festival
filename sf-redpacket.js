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
  function cloud(x, y, k, col) {
    return '<path transform="translate(' + x + " " + y + ") scale(" + k + ')" d="M10 40a12 12 0 0 1 22-6a14 14 0 0 1 26 4a10 10 0 0 1 2 20H16a10 10 0 0 1-6-18z" fill="none" stroke="' + col + '" stroke-width="2"/>';
  }
  function fwSvg(W, H) {
    var B = [[.18, .16, 64], [.85, .12, 48], [.12, .84, 56], [.88, .8, 70]], o = "";
    B.forEach(function (b) {
      var cx = b[0] * W, cy = b[1] * H, r = b[2];
      for (var i = 0; i < 16; i++) {
        var a = Math.PI * 2 * i / 16, cs = Math.cos(a), sn = Math.sin(a), rr = i % 2 ? 0.8 : 1;
        o += '<line x1="' + (cx + cs * r * .3).toFixed(1) + '" y1="' + (cy + sn * r * .3).toFixed(1) + '" x2="' + (cx + cs * r * rr).toFixed(1) + '" y2="' + (cy + sn * r * rr).toFixed(1) + '"/>' +
          '<circle cx="' + (cx + cs * r * 1.08).toFixed(1) + '" cy="' + (cy + sn * r * 1.08).toFixed(1) + '" r="1.3"/>';
      }
    });
    return '<svg class="sfx-fw" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">' + o + "</svg>";
  }
  function envHtml(cd, title, amt) {
    var cl = "rgba(255,255,255,.13)";
    return fwSvg(window.innerWidth, window.innerHeight) +
      '<div class="sfx-env">' +
      '<div class="sfx-paper"><small>新春红包</small>' + (amt ? '<b class="sfx-amt">¥ <span>0.00</span></b>' : "") + "<p>" + SF.esc(cd.blessing || "") + "</p></div>" +
      '<svg class="sfx-face" viewBox="0 0 300 450" preserveAspectRatio="none"><defs><linearGradient id="sfxf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#df5440"/><stop offset="1" stop-color="#bd3a2d"/></linearGradient></defs>' +
      '<path d="M0 128C62 142 108 168 150 168C192 168 238 142 300 128V450H0Z" fill="url(#sfxf)"/>' + cloud(26, 236, 1.2, cl) + cloud(190, 300, 1.5, cl) + cloud(60, 384, 1, cl) + cloud(214, 214, .9, cl) + "</svg>" +
      '<div class="sfx-from">' + SF.esc(title) + "</div>" +
      '<div class="sfx-tassel"><i></i><b></b><u></u></div>' +
      '<div class="sfx-flap"><svg viewBox="0 0 300 450" preserveAspectRatio="none"><defs><linearGradient id="sfxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f27058"/><stop offset="1" stop-color="#dd4e3b"/></linearGradient></defs>' +
      '<path d="M0 0H300V128C238 142 192 168 150 168C108 168 62 142 0 128Z" fill="url(#sfxg)"/>' +
      '<path d="M10 119C66 133 110 158 150 158C190 158 234 133 290 119" fill="none" stroke="#ffe3b0" stroke-opacity=".85" stroke-width="1.4" stroke-dasharray="2 5" stroke-linecap="round"/>' +
      cloud(18, 36, 1, cl) + cloud(196, 66, 1.2, cl) + cloud(108, 14, .8, cl) + '</svg><span class="sfx-ttl">开启好运</span></div>' +
      '<button class="sfx-open" type="button"><svg viewBox="0 0 100 100"><defs><radialGradient id="sfxs" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#e3aa3c"/></radialGradient></defs>' +
      '<g fill="url(#sfxs)"><circle cx="50" cy="24" r="22"/><circle cx="76" cy="50" r="22"/><circle cx="50" cy="76" r="22"/><circle cx="24" cy="50" r="22"/><circle cx="50" cy="50" r="30"/></g></svg><span>開</span></button>' +
      "</div>";
  }
  // 全屏拆红包：从聊天卡片位置放大到屏幕中央，点「開」拆开，点任意处收回卡片位置
  function showEnvelope(cd, title, rect, commit) {
    return new Promise(function (resolve) {
      var amt = cd.amount != null ? fmtAmt(cd.amount) : "", opened = false, closing = false;
      var ov = SF.h("div", "sfx");
      ov.innerHTML = '<div class="sfx-bg"></div>' + envHtml(cd, title, amt) + '<div class="sfx-hint">点击任意处收下</div>';
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
      var cd = m.cardData || {}, sealed = cd.dir === "ta2me" && cd.status !== "opened", mine = cd.dir !== "ta2me";
      var card = SF.h("div", "sfc-rp " + (sealed ? "sealed" : "done"));
      var fromName = mine ? "你" : (cd.fromName || "TA");
      var who = mine ? "你送给 " + (cd.toName || "TA") : (cd.fromName || "TA") + " 送给你";
      var title = sealed ? "恭喜发财，大吉大利" : (cd.blessing || "");
      var status = sealed ? "点击领取" : (mine ? "已送出" : "已领取") + (cd.amount != null ? " · ¥" + fmtAmt(cd.amount) : "");
      card.innerHTML = '<div class="sfc-rp-in"><span class="sfc-env"></span><div class="sfc-rp-t"><strong>' + SF.esc(title) + "</strong><em>" + SF.esc(status) + '</em></div></div><div class="sfc-rp-bot">' + SF.esc(fromName) + " 发出的红包</div>" + (sealed ? '<i class="sfc-rp-dot"></i>' : "");
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
        showEnvelope(cd, who, card.getBoundingClientRect(), sealed ? commit : null).then(function () { busy = false; });
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
        var h = '<div class="sf-seg"><span data-d="ta2me" class="' + (st.dir === "ta2me" ? "on" : "") + '">TA 发给我</span><span data-d="me2ta" class="' + (st.dir === "me2ta" ? "on" : "") + '">我发给 TA</span></div>';
        if (isGroup) {
          h += "<h4>" + (st.dir === "ta2me" ? "谁来发" : "发给谁") + "</h4>" + SF.chipRow(members.map(function (x) {
            return '<span class="sfchip' + (st.cid === x.id ? " on" : "") + '" data-c="' + SF.esc(x.id) + '">' + SF.esc(x.handle || x.name || x.displayName) + "</span>";
          }).join(""));
        }
        var opts = st.dir === "ta2me" ? [["preset", "预设"], ["pool", "祝福池 " + st.pool.length], ["ai", "TA 现写"]] : [["preset", "预设"], ["custom", "我来写"]];
        h += '<h4>祝福</h4><div class="sf-card"><div class="sf-seg">' + opts.map(function (o) { return '<span data-s="' + o[0] + '" class="' + (st.src === o[0] ? "on" : "") + '">' + o[1] + "</span>"; }).join("") + "</div>";
        if (st.src === "custom") h += '<textarea rows="3" maxlength="60" style="margin-top:12px" placeholder="写给 TA 的祝福（60字内）">' + SF.esc(st.text) + "</textarea>";
        if (st.src === "pool" && !st.pool.length) h += '<p class="tip" style="margin:10px 0 0">祝福池是空的，去首页红包摊里让角色攒一些。</p>';
        if (st.src === "ai") h += '<p class="tip" style="margin:10px 0 0">发出时会调用 1 次 AI。</p>';
        h += "</div>";
        if (st.dir === "me2ta") {
          h += '<h4>金额</h4><div class="sf-card"><input type="text" class="sfamt" inputmode="decimal" placeholder="如 8.88，留空则随机吉利数字" value="' + SF.esc(st.amount) + '">' +
            SF.chipRow(["6.66", "8.88", "66.6", "88.8", "520", "1314"].map(function (v) { return '<span class="sfchip' + (st.amount === v ? " on" : "") + '" data-q="' + v + '">' + v + "</span>"; }).join("")) + "</div>";
        } else h += '<p class="tip" style="margin-top:14px">TA 发的红包，金额会从吉利数字里随机抽。</p>';
        h += '<button class="sfb block" data-a="send" type="button" style="margin-top:18px">发出红包</button>';
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
        var h = '<div class="sf-seg"><span data-t="rec" class="' + (tab === "rec" ? "on" : "") + '">红包记录</span><span data-t="pool" class="' + (tab === "pool" ? "on" : "") + '">祝福池</span></div>';
        if (tab === "rec") {
          var a = await SF.st.get("rp_records", []);
          h += "<h4>最近</h4>" + (a.length ? '<div class="sf-card">' + a.map(function (x) {
            var lab = x.dir === "ta2me" ? SF.esc(x.who) + " → 我" : x.dir === "me2ta" ? "我 → " + SF.esc(x.who) : "拆开了 " + SF.esc(x.who) + " 的红包";
            return '<div class="sfr-i"><div><small>' + fmt(x.t) + "　" + lab + (x.amount != null ? " · ¥" + fmtAmt(x.amount) : "") + "</small><p>" + SF.esc(x.blessing || "") + "</p></div></div>";
          }).join("") + "</div>" : '<p class="tip">还没有红包记录。在聊天里点「+」号里的「新春红包」就能发。</p>');
        } else {
          h += "<h4>选择角色</h4>" + (chars.length ? SF.chipRow(chars.map(function (c) { return '<span class="sfchip' + (cid === c.id ? " on" : "") + '" data-c="' + SF.esc(c.id) + '">' + SF.esc(SF.cname(c)) + "</span>"; }).join("")) : '<p class="tip">没有读取到角色</p>');
          if (cid) {
            var p = await getPool(cid);
            h += "<h4>祝福池 · " + p.length + " 句</h4>" + '<div class="sf-card"><div class="sfrow"><button class="sfb" style="flex:1" data-a="gen" type="button">攒 12 句（AI 1 次）</button>' + (p.length ? '<span class="sf-lnk" data-a="clr">清空</span>' : "") + "</div>" +
              p.map(function (x, i) { return '<div class="sfr-i"><p>' + SF.esc(x) + '</p><span class="sf-lnk" data-x="' + i + '">删除</span></div>'; }).join("") + "</div>";
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

  // 聊天卡片 + 全屏红包样式（常驻）
  SF.cssChat.push(`
.sfc-rp{position:relative;width:240px;max-width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(135deg,#f08a6e,#e25a44);color:#fff;font-family:-apple-system,"PingFang SC",sans-serif;box-shadow:0 6px 18px rgba(214,80,60,.28);-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;cursor:pointer;transition:transform .15s}
.sfc-rp:active{transform:scale(.98)}
.sfc-rp::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 88% 14%,rgba(255,255,255,.28),transparent 42%),radial-gradient(circle at 8% 96%,rgba(255,255,255,.16),transparent 46%)}
.sfc-rp.done{background:linear-gradient(135deg,#e9a08c,#d98570)}
.sfc-rp-in{position:relative;display:flex;gap:12px;align-items:center;padding:14px 14px 12px}
.sfc-env{position:relative;flex:0 0 34px;height:44px;border-radius:7px;background:linear-gradient(180deg,#ffeadf,#ffcdb8);box-shadow:0 2px 6px rgba(120,30,20,.25)}
.sfc-env::before{content:"";position:absolute;left:0;right:0;top:0;height:22px;border-radius:7px 7px 50% 50%/7px 7px 100% 100%;border-bottom:1.5px solid rgba(214,100,80,.45)}
.sfc-env::after{content:"";position:absolute;left:50%;top:16px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:#f3c24f;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.sfc-rp-t{min-width:0}
.sfc-rp-t strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 15px/1.4 -apple-system,"PingFang SC",sans-serif}
.sfc-rp-t em{display:block;margin-top:3px;font-style:normal;font-size:12px;opacity:.88}
.sfc-rp-bot{position:relative;margin:0 14px;padding:7px 0 10px;border-top:1px solid rgba(255,255,255,.28);font-size:11.5px;opacity:.92}
.sfc-rp-dot{position:absolute;right:9px;top:9px;width:9px;height:9px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 0 2px rgba(255,255,255,.65)}
.sf-card input+.sfrow-h{margin-top:10px}
.sfx{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;font-family:-apple-system,"PingFang SC",sans-serif;-webkit-user-select:none;user-select:none}
.sfx-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,#2e1a34,#0e0714);opacity:0;transition:opacity .4s}
.sfx-fw{position:absolute;inset:0;pointer-events:none;stroke:rgba(236,200,130,.55);stroke-width:1;fill:rgba(236,200,130,.55);stroke-linecap:round;animation:sfxTw 3s ease-in-out infinite}
@keyframes sfxTw{50%{opacity:.55}}
.sfx-env{position:relative;width:min(76vw,300px);aspect-ratio:300/450;border-radius:18px;overflow:hidden;background:#c8402f;box-shadow:0 24px 70px rgba(0,0,0,.55)}
.sfx-paper{position:absolute;left:8%;right:8%;top:4%;height:40%;border-radius:10px;background:linear-gradient(180deg,#fff6df,#f6e0b4);z-index:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:9% 12px 0;text-align:center;color:#8f1420;transform:scale(.94) translateY(8%);transition:transform .7s cubic-bezier(.2,.9,.25,1) .25s}
.sfx.open .sfx-paper{transform:none}
.sfx-paper small{font:600 11px/1 "Songti SC","STSong",serif;letter-spacing:.3em;color:#b3322a}
.sfx-amt{font:700 32px/1.1 "Songti SC","STSong",serif;color:#a51a26;font-variant-numeric:tabular-nums}
.sfx-paper p{margin:0;font:14px/1.7 "Songti SC","STSong",serif;color:#7a2418}
.sfx-face{position:absolute;inset:0;width:100%;height:100%;z-index:2}
.sfx-from{position:absolute;left:0;right:0;bottom:7%;z-index:3;text-align:center;font:600 12px/1 "Songti SC","STSong",serif;letter-spacing:.22em;color:#ffd9b0}
.sfx-tassel{position:absolute;left:50%;top:38%;width:0;z-index:3;transition:opacity .4s,transform .6s}
.sfx-tassel i{position:absolute;left:-.75px;top:0;width:1.5px;height:44px;background:#f0c970}
.sfx-tassel b{position:absolute;left:-8px;top:42px;width:16px;height:16px;border-radius:50%;border:2px solid #f0c970;background:#e24a3a}
.sfx-tassel u{position:absolute;left:-7px;top:58px;width:14px;height:54px;background:linear-gradient(180deg,#f7d98a,#d9a043);clip-path:polygon(25% 0,75% 0,100% 100%,0 100%)}
.sfx.open .sfx-tassel{opacity:0;transform:translateY(20px)}
.sfx-flap{position:absolute;inset:0;z-index:4;transition:transform .75s cubic-bezier(.3,.9,.3,1),opacity .55s}
.sfx-flap svg{position:absolute;inset:0;width:100%;height:100%}
.sfx.open .sfx-flap{transform:translateY(-34%);opacity:0}
.sfx-ttl{position:absolute;left:0;right:0;top:12%;text-align:center;font:600 26px/1 "Songti SC","STSong",serif;letter-spacing:.2em;color:#ffe3a8;text-shadow:0 2px 8px rgba(120,20,10,.35)}
.sfx-open{position:absolute;left:50%;top:37.3%;width:74px;height:74px;margin:-37px 0 0 -37px;padding:0;border:0;background:none;z-index:5;animation:sfxPulse 1.6s ease-in-out infinite;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))}
.sfx-open svg{position:absolute;inset:0;width:100%;height:100%}
.sfx-open span{position:relative;font:700 30px/74px "Songti SC","STSong",serif;color:#9a1f1a}
.sfx.open .sfx-open{animation:sfxGone .6s forwards;pointer-events:none}
@keyframes sfxPulse{50%{transform:scale(1.07)}}
@keyframes sfxGone{to{transform:rotateY(540deg) scale(0);opacity:0}}
.sfx-p{position:fixed;border-radius:50%;pointer-events:none;background:radial-gradient(circle at 35% 30%,#fff0b8,#e0a533);animation:sfxP 1.2s cubic-bezier(.2,.8,.3,1) forwards}
@keyframes sfxP{0%{transform:translate(0,0) scale(.2);opacity:1}70%{opacity:1}100%{transform:translate(var(--dx),calc(var(--dy) + 80px)) scale(1);opacity:0}}
.sfx-hint{position:absolute;left:0;right:0;bottom:calc(9% + env(safe-area-inset-bottom));text-align:center;color:rgba(255,235,200,.85);letter-spacing:.4em;font-size:12px;opacity:0;transition:opacity .5s}
@media (prefers-reduced-motion:reduce){.sfx *,.sfc-rp{animation:none!important;transition:none!important}}
`);

  SF.cssApp.push([
    ".sfr-i{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 2px;border-bottom:1px solid var(--hair)}",
    ".sf-card .sfr-i:last-child{border-bottom:0}",
    ".sfr-i small{display:block;font-size:11px;color:var(--k);margin-bottom:3px}.sfr-i p{margin:0;font-size:13.5px;line-height:1.6;flex:1;color:var(--tx)}"
  ].join("\n"));
})(window.__SF);

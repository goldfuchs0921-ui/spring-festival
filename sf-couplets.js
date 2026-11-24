/* 春联：春联工坊（预设 / 角色来写）+ 对对联 + 我的春联。红纸图用画布现画，不需要图片文件。
 * 想加预设春联：往下面 PRESET 数组里加 ["上联","下联","横批"]，上下联字数要相同。
 * 另外这里放了两个公共工具：SF.sendCard（选聊天发卡片）、SF.exportImg（导出图片），灯谜和打年兽也会用。 */
(function (SF) {
  "use strict";

  var PRESET = [
    ["天增岁月人增寿", "春满乾坤福满门", "吉星高照"],
    ["爆竹声声辞旧岁", "梅花朵朵迎新春", "辞旧迎新"],
    ["门迎春夏秋冬福", "户纳东西南北财", "福星高照"],
    ["和顺一门有百福", "平安二字值千金", "平安是福"],
    ["春回大地风光好", "福满人间喜事多", "喜迎新春"],
    ["瑞雪迎春归大地", "红梅报喜满人间", "梅开五福"],
    ["山清水秀风光美", "人寿年丰喜气多", "国泰民安"],
    ["万象更新辞旧岁", "一元复始迎新春", "春满人间"],
    ["春到人间花争艳", "福临门第喜盈门", "福到春来"],
    ["莺歌燕舞春光好", "桃李争妍气象新", "春色满园"],
    ["喜居宝地千年旺", "福照家门万事兴", "吉祥如意"],
    ["欢天喜地度佳节", "张灯结彩迎新春", "欢度春节"],
    ["国泰民安逢盛世", "风调雨顺颂华年", "太平盛世"],
    ["三阳开泰春光美", "五福临门喜气多", "喜气洋洋"],
    ["羊毫写就千家福", "爆竹迎来万里春", "喜迎新春"]
  ];
  var STYLES = [
    { n: "大红金字", c1: "#d9303a", c2: "#a8121c", ink: "#ffe29a", bd: "#ffd77a", fleck: 0 },
    { n: "朱红墨字", c1: "#e8573a", c2: "#c93f27", ink: "#2b0f0a", bd: "#5a1a10", fleck: 0 },
    { n: "洒金红", c1: "#c8202b", c2: "#9a1624", ink: "#fff0c0", bd: "#f0c35a", fleck: 1 }
  ];
  var KAI = '"STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif SC",serif';

  function zh(s) { return String(s || "").replace(/[^\u4e00-\u9fa5]/g, ""); }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function shrink(src, w, h, q) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(im, 0, 0, w, h); res(c.toDataURL("image/jpeg", q || 0.8));
      };
      im.onerror = function () { res(src); }; im.src = src;
    });
  }

  // ---------- 公共工具 ----------
  SF.exportImg = async function (src, name) {
    try {
      var b = await (await fetch(src)).blob(), f = new File([b], name || "新春图片.jpg", { type: b.type });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    var a = document.createElement("a"); a.href = src; a.download = name || "新春图片.jpg";
    document.body.appendChild(a); a.click(); a.remove();
    SF.toast("没有自动保存的话，请长按图片保存到相册");
  };
  // 选一个聊天，把 makeCard(会话) 返回的卡片发过去。makeCard 返回 { messageType, cardData, modelText }
  SF.sendCard = async function (tip, makeCard) {
    var convs = []; try { convs = (await SF.roche.conversation.list()) || []; } catch (e) {}
    var L = SF.layer(SF.appRoot, "发给谁", { k: "SEND", key: "sendCard" });
    if (!L) return;
    L.body.innerHTML = '<p class="tip">' + SF.esc(tip) + "</p>" + (convs.map(function (c, i) {
      return '<span class="sfchip" data-i="' + i + '">' + SF.esc(c.name || c.title || c.handle || "聊天") + "</span>";
    }).join("") || '<p class="tip">没有读取到聊天</p>');
    L.body.onclick = async function (e) {
      var a = e.target.closest("[data-i]"); if (!a) return;
      var c = convs[+a.dataset.i], old = a.textContent; a.textContent = "发送中…";
      try {
        var card = await makeCard(c);
        await SF.roche.chat.createCard({
          conversationId: c.id || c.conversationId, messageType: card.messageType, isMe: true,
          cardData: card.cardData, modelText: card.modelText
        });
        SF.toast("已发送"); L.close();
      } catch (err) { SF.toast("发送失败：" + (err.message || err)); a.textContent = old; }
    };
  };

  // ---------- 画红纸 ----------
  function vtext(g, str, cx, y, h, st) {
    var ch = Array.from(str), n = Math.max(1, ch.length), step = (h - 70) / n, size = Math.min(104, step * 0.86);
    g.fillStyle = st.ink; g.font = "700 " + size + "px " + KAI; g.textAlign = "center"; g.textBaseline = "middle";
    ch.forEach(function (c, i) { g.fillText(c, cx, y + 35 + step * (i + 0.5)); });
  }
  function strip(g, x, y, w, h, st, seed) {
    var gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, st.c1); gr.addColorStop(1, st.c2);
    g.fillStyle = gr; rr(g, x, y, w, h, 6); g.fill();
    g.strokeStyle = st.bd; g.lineWidth = 3; rr(g, x + 8, y + 8, w - 16, h - 16, 3); g.stroke();
    if (st.fleck) {
      var s = seed; g.fillStyle = "rgba(255,215,122,.65)";
      for (var i = 0; i < 46; i++) {
        s = (s * 9301 + 49297) % 233280; var fx = x + 14 + (s / 233280) * (w - 28);
        s = (s * 9301 + 49297) % 233280; var fy = y + 14 + (s / 233280) * (h - 28);
        g.beginPath(); g.arc(fx, fy, 1.2 + (i % 3) * 0.7, 0, 7); g.fill();
      }
    }
  }
  // c = { up, down, top, by, kind }；返回图片地址
  function draw(c, si) {
    var st = STYLES[si] || STYLES[0], W = 640, H = 960, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var g = cv.getContext("2d"), bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#f8ead0"); bg.addColorStop(1, "#efd3b0"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    strip(g, 90, 46, 460, 112, st, 11);
    strip(g, 370, 186, 190, 724, st, 23); // 上联在右
    strip(g, 80, 186, 190, 724, st, 37);  // 下联在左
    var top = Array.from(c.top || ""), tn = Math.max(1, top.length), ts = Math.min(76, 400 / tn * 0.8);
    g.fillStyle = st.ink; g.font = "700 " + ts + "px " + KAI; g.textAlign = "center"; g.textBaseline = "middle";
    top.forEach(function (ch, i) { g.fillText(ch, 90 + 460 * (i + 0.5) / tn, 104); });
    vtext(g, c.up || "", 465, 186, 724, st);
    vtext(g, c.down || "", 175, 186, 724, st);
    if (c.by) {
      g.fillStyle = "rgba(120,40,30,.8)"; g.font = '26px "PingFang SC",sans-serif'; g.textAlign = "center";
      g.fillText(c.by + (c.kind === "dui" ? " 对" : " 写"), 175, 938);
    }
    return cv.toDataURL("image/jpeg", 0.88);
  }
  function modelOf(it) {
    return (it.by ? "我和「" + it.by + "」一起写了一副新春对联" : "我写了一副新春对联送给你") +
      "：上联「" + it.up + "」，下联「" + it.down + "」，横批「" + it.top + "」。";
  }
  async function cardOf(it, si) {
    var img = it.img || draw(it, si);
    return {
      messageType: "couplet",
      cardData: { img: await shrink(img, 360, 540, 0.8), up: it.up, down: it.down, top: it.top, by: it.by || "" },
      modelText: modelOf(it)
    };
  }

  // ---------- AI ----------
  async function aiCouplet(char) {
    var me = await SF.userName();
    var raw = await SF.ai("你是" + SF.cname(char) + "。" + SF.persona(char),
      "春节到了，请你用自己的身份和口吻，为「" + me + "」写一副春联。上联下联各7个字，字数相同，对仗工整，上联末字用仄声、下联末字用平声，再给一个4字横批。内容吉祥，可以带一点你的性格。只输出 JSON：{\"up\":\"上联\",\"down\":\"下联\",\"top\":\"横批\"}", 0.9);
    var j = SF.parseJson(raw) || {};
    var up = zh(j.up), down = zh(j.down), top = zh(j.top);
    if (up.length < 4 || up.length > 9 || up.length !== down.length || top.length < 2 || top.length > 6) throw new Error("写出来的春联字数不对，请再试一次");
    return { up: up, down: down, top: top, by: SF.cname(char), kind: "mk" };
  }
  async function aiDui(char, up) {
    var raw = await SF.ai("你是" + SF.cname(char) + "。" + SF.persona(char),
      "我出上联：「" + up + "」。请你用自己的身份和口吻对出下联（必须正好" + up.length + "个字，对仗工整，末字用平声），再给一个4字横批。只输出 JSON：{\"down\":\"下联\",\"top\":\"横批\"}", 0.9);
    var j = SF.parseJson(raw) || {};
    var down = zh(j.down), top = zh(j.top);
    if (down.length !== up.length || top.length < 2 || top.length > 6) throw new Error("对出来的字数不对，请再试一次");
    return { up: up, down: down, top: top, by: SF.cname(char), kind: "dui" };
  }

  SF.cp = {
    mountCard: function (c, m, r) {
      SF.setRoche(r);
      var cd = m.cardData || {};
      var d = SF.h("div", "sfc-cp", '<img draggable="false"><span>新春对联 · 横批「' + SF.esc(cd.top || "") + "」</span>");
      d.querySelector("img").src = cd.img || "";
      c.replaceChildren(d);
    },
    open: function () {
      var L = SF.layer(SF.appRoot, "春联", { full: true, k: "COUPLETS", key: "cp" });
      if (!L) return;
      var curs = {}, tab = "mk", si = 0, src = "preset", cid = null, cur = null, chars = [], mine = [], tries = [], upText = "", busy = false;

      function styleRow() {
        return "<h4>红纸</h4>" + SF.chipRow(STYLES.map(function (s, i) {
          return '<span class="sfchip' + (si === i ? " on" : "") + '" data-st="' + i + '">' + s.n + "</span>";
        }).join(""));
      }
      function charRow() {
        return "<h4>角色</h4>" + (chars.length ? SF.chipRow(chars.map(function (c) {
          return '<span class="sfchip' + (cid === c.id ? " on" : "") + '" data-c="' + SF.esc(c.id) + '">' + SF.esc(SF.cname(c)) + "</span>";
        }).join("")) : '<p class="tip">没有读取到角色</p>');
      }
      function preview() {
        if (!cur) return "";
        return '<div class="sfcp-pv"><img src="' + draw(cur, si) + '"></div>' +
          '<div class="sfrow" style="margin-top:14px"><button class="sfb" style="flex:1" data-a="save" type="button">贴到门上</button></div>' +
          '<div class="sfrow" style="justify-content:center;gap:22px;margin-top:6px"><span class="sf-lnk" data-a="exp">导出图片</span><span class="sf-lnk" data-a="send">发给聊天</span></div>';
      }
      async function render() {
        if (!L.alive) return;
        var h = '<div class="sf-seg"><span data-t="mk" class="' + (tab === "mk" ? "on" : "") + '">春联工坊</span><span data-t="dui" class="' + (tab === "dui" ? "on" : "") + '">对对联</span><span data-t="my" class="' + (tab === "my" ? "on" : "") + '">我的春联 ' + mine.length + "</span></div>";
        if (tab === "mk") {
          h += styleRow() + '<h4>来源</h4><div class="sf-seg"><span data-s="preset" class="' + (src === "preset" ? "on" : "") + '">预设</span><span data-s="ai" class="' + (src === "ai" ? "on" : "") + '">角色来写</span></div>';
          if (src === "ai") h += charRow();
          h += '<button class="sfb block" style="margin-top:16px" data-a="gen" type="button">' + (src === "ai" ? "请 TA 来写（AI 1 次）" : cur ? "换一副" : "抽一副") + "</button>";
          h += '<div style="margin-top:16px">' + preview() + "</div>";
        } else if (tab === "dui") {
          h += styleRow() + '<p class="tip" style="margin-top:14px">你写上联（4 到 7 个字），请角色对下联和横批。</p>' +
            '<input type="text" class="sfcp-up" maxlength="7" placeholder="写上联" value="' + SF.esc(upText) + '">' + charRow() +
            '<button class="sfb block" style="margin-top:16px" data-a="dui" type="button">请 TA 对（AI 1 次）</button>';
          if (tries.length) {
            h += '<h4>对出来的</h4><div class="sf-card">' + tries.map(function (t, i) {
              return '<div class="sfr-i" data-k="' + i + '"><div><small>' + SF.esc(t.by) + (t === cur ? " · 当前" : "") + "</small><p>" + SF.esc(t.down) + "　/　" + SF.esc(t.top) + "</p></div></div>";
            }).join("") + "</div>";
          }
          h += '<div style="margin-top:16px">' + preview() + "</div>";
        } else {
          h += mine.length ? '<div class="sfcp-grid" style="margin-top:14px">' + mine.map(function (x, i) {
            return '<div class="sfcp-th" data-m="' + i + '"><img src="' + x.img + '" draggable="false"></div>';
          }).join("") + "</div>" : '<p class="tip" style="margin-top:14px">还没有春联。去工坊抽一副，或者和角色对一副，点「贴到门上」。</p>';
        }
        L.body.innerHTML = h; SF.fadeRows(L.body);
        var inp = L.body.querySelector(".sfcp-up"); if (inp) inp.oninput = function () { upText = inp.value; };
      }
      async function saveCur() {
        if (!cur) return;
        var arr = await SF.st.get("couplets", []);
        arr.unshift({ id: Date.now(), t: Date.now(), up: cur.up, down: cur.down, top: cur.top, by: cur.by || "", kind: cur.kind || "mk", style: si, img: draw(cur, si) });
        if (arr.length > 30) arr.length = 30;
        if (await SF.st.set("couplets", arr)) {
          mine = arr; SF.toast("已贴到门上"); if (SF.sfx) SF.sfx.save(); if (SF.fortune) SF.fortune.award("couplet"); render();
        } else SF.toast("保存失败，存储空间可能不足");
      }
      function detail(k) {
        var it = mine[k]; if (!it) return;
        var D = SF.layer(SF.appRoot, "春联", { k: "COUPLETS", key: "cpView" });
        if (!D) return;
        D.body.innerHTML = '<div class="sfcp-pv"><img src="' + it.img + '"></div><div class="sfrow" style="gap:10px;margin-top:14px"><button class="sfb" style="flex:1" data-a="send" type="button">发给 TA</button><button class="sfb ghost" style="flex:1" data-a="exp" type="button">导出</button></div><div style="text-align:center;margin-top:10px"><span class="sf-lnk" data-a="del">删除</span></div>';
        D.body.onclick = async function (e) {
          var a = e.target.closest("[data-a]"); if (!a) return;
          if (a.dataset.a === "exp") SF.exportImg(it.img, "新春对联.jpg");
          else if (a.dataset.a === "send") SF.sendCard("春联会作为卡片发过去，角色能读到上下联和横批。", function () { return cardOf(it, it.style); });
          else if (a.dataset.a === "del") {
            if (!(await SF.confirm("删除春联", "确定删除这副春联吗？"))) return;
            mine = mine.filter(function (x) { return x !== it; }); await SF.st.set("couplets", mine); D.close(); render();
          }
        };
      }

      L.body.addEventListener("click", async function (e) {
        var a = e.target.closest("[data-t],[data-st],[data-s],[data-c],[data-a],[data-k],[data-m]"); if (!a) return;
        var d = a.dataset;
        if (d.t) { curs[tab] = cur; tab = d.t; cur = curs[tab] || null; render(); }
        else if (d.st != null) { si = +d.st; render(); }
        else if (d.s) { src = d.s; render(); }
        else if (d.c) { cid = d.c; render(); }
        else if (d.k != null) { cur = tries[+d.k] || cur; render(); }
        else if (d.m != null) detail(+d.m);
        else if (d.a === "save") saveCur();
        else if (d.a === "exp") { if (cur) SF.exportImg(draw(cur, si), "新春对联.jpg"); }
        else if (d.a === "send") { if (cur) SF.sendCard("春联会作为卡片发过去，角色能读到上下联和横批。", function () { return cardOf(cur, si); }); }
        else if (d.a === "gen" || d.a === "dui") {
          if (busy) return;
          if (d.a === "gen" && src === "preset") {
            var p, n = 0; do { p = SF.pick(PRESET); n++; } while (cur && cur.up === p[0] && n < 8);
            cur = { up: p[0], down: p[1], top: p[2], by: "", kind: "mk" }; render(); return;
          }
          var char = chars.filter(function (c) { return c.id === cid; })[0];
          if (!char) { SF.toast("先选一位角色"); return; }
          var up = "";
          if (d.a === "dui") {
            up = zh(upText);
            if (up.length < 4 || up.length > 7) { SF.toast("上联请写 4 到 7 个汉字"); return; }
          }
          if (!(await SF.confirm("调用 AI", "让「" + SF.cname(char) + "」" + (d.a === "dui" ? "对下联" : "写春联") + "，会消耗 1 次 AI。继续吗？"))) return;
          busy = true; a.disabled = true; a.textContent = "写联中…";
          try {
            var r = d.a === "dui" ? await aiDui(char, up) : await aiCouplet(char);
            cur = r; if (d.a === "dui") tries.unshift(r);
          } catch (err) { SF.toast("失败：" + (err.message || err)); }
          busy = false; render();
        }
      });

      SF.chars().then(function (c) { chars = c; cid = c[0] ? c[0].id : null; render(); });
      SF.st.get("couplets", []).then(function (a) { mine = a || []; render(); });
      render();
    }
  };

  SF.cssApp.push(`
.sfcp-pv{border-radius:10px;overflow:hidden;border:1px solid var(--cbd);background:#f5e6c8;max-width:300px;margin:0 auto}
.sfcp-pv img{display:block;width:100%}
.sfcp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sfcp-th{aspect-ratio:2/3;border-radius:8px;overflow:hidden;border:1.5px solid var(--cbd);background:#f5e6c8}
.sfcp-th img{width:100%;height:100%;object-fit:cover;display:block}
.sfcp-up{margin-bottom:4px;letter-spacing:.3em;text-align:center;font-size:18px}
`);
  SF.cssChat.push([
    ".sfc-cp{width:170px;max-width:100%;border-radius:10px;overflow:hidden;border:2px solid #e9bd62;background:#f5e6c8;box-shadow:0 4px 14px rgba(120,10,20,.3)}",
    ".sfc-cp img{display:block;width:100%}",
    ".sfc-cp span{display:block;padding:5px 8px;font:600 11.5px/1.4 serif;letter-spacing:.08em;color:#fff3dc;background:#a51a26;text-align:center}"
  ].join("\n"));
})(window.__SF);

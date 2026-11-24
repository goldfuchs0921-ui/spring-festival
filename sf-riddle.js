/* 灯谜：猜灯谜（预设）+ 角色出谜（AI）。
 * 想加预设谜语：往 PRESET 里加 { c:"类别", q:"谜面", a:["答案","也算对的说法"], h:"提示" }。 */
(function (SF) {
  "use strict";

  var PRESET = [
    { c: "字谜", q: "一口咬掉牛尾巴（打一字）", a: ["告"], h: "牛字去掉尾巴，再加一个口" },
    { c: "字谜", q: "千里相逢（打一字）", a: ["重"], h: "千和里合起来" },
    { c: "字谜", q: "二十一日（打一字）", a: ["昔"], h: "二十是廿，再加一和日" },
    { c: "字谜", q: "人在草木中（打一字）", a: ["茶"], h: "草字头，木字底，当中夹着一个人" },
    { c: "字谜", q: "禾下一把火（打一字）", a: ["秋"], h: "禾苗下面烧把火" },
    { c: "字谜", q: "十个哥哥（打一字）", a: ["克"], h: "十加上“兄”" },
    { c: "物谜", q: "千条线，万条线，落到水里看不见（打一自然现象）", a: ["雨", "下雨"], h: "从天上落下来的" },
    { c: "物谜", q: "红公鸡，绿尾巴，身体钻到地底下（打一蔬菜）", a: ["红萝卜", "胡萝卜", "萝卜"], h: "地里长的，可以炖汤" },
    { c: "物谜", q: "身穿绿衣裳，肚里水汪汪，生的儿子多，个个黑脸膛（打一水果）", a: ["西瓜"], h: "夏天解暑" },
    { c: "物谜", q: "麻屋子，红帐子，里面住着白胖子（打一食物）", a: ["花生"], h: "壳里的果仁，榨油也能吃" },
    { c: "物谜", q: "小小一姑娘，坐在水中央，身穿粉红袄，阵阵放清香（打一花）", a: ["荷花", "莲花"], h: "夏天池塘里的花" },
    { c: "物谜", q: "弟兄七八个，围着柱子坐，大家一分手，衣服就撕破（打一蔬菜）", a: ["大蒜", "蒜"], h: "一瓣一瓣的，做菜调味" },
    { c: "物谜", q: "头戴红帽子，身穿白袍子，走路摆架子，说话伸脖子（打一家禽）", a: ["鹅", "大鹅"], h: "嘎嘎叫，爱伸长脖子" },
    { c: "物谜", q: "红口袋，绿口袋，有人怕，有人爱（打一蔬菜）", a: ["辣椒"], h: "吃起来火辣辣" },
    { c: "年俗", q: "皮薄馅大个儿小，煮熟浮起像元宝，北方除夕必吃它（打一食物）", a: ["饺子"], h: "形状像元宝" },
    { c: "年俗", q: "又圆又糯，里面有馅，浮在汤里，正月十五吃（打一食物）", a: ["汤圆", "元宵"], h: "圆圆的，寓意团圆" },
    { c: "年俗", q: "红纸写字门上贴，左右对称好意头（打一年俗物件）", a: ["春联", "对联"], h: "上联下联加横批" },
    { c: "年俗", q: "噼里啪啦一声响，吓得年兽往后躲（打一物）", a: ["爆竹", "鞭炮", "炮竹", "炮仗"], h: "过年点着放的" },
    { c: "年俗", q: "红红的纸包，长辈给晚辈，里头装着祝福（打一物）", a: ["红包", "压岁钱"], h: "拆开有惊喜" },
    { c: "年俗", q: "身披彩衣满街跑，踩着鼓点伴锣响，舞动起来吉祥到（打一年俗表演）", a: ["舞狮", "狮子", "舞狮子"], h: "和舞龙是好搭档" },
    { c: "年俗", q: "天上开花不结果，只在夜里亮一瞬（打一物）", a: ["烟花", "焰火"], h: "过年夜里的天空" },
    { c: "年俗", q: "福字倒着贴，是什么意思（打一吉祥话）", a: ["福到", "福到了", "福倒了"], h: "“倒”和“到”同音" },
    { c: "年俗", q: "生肖排第八，毛白性温顺，2027年轮到它（打一生肖）", a: ["羊"], h: "丁未年" },
    { c: "年俗", q: "大年三十夜里不睡觉，守着钟声等天亮（打一年俗）", a: ["守岁"], h: "守着旧岁迎新年" },
    { c: "年俗", q: "农历一年的最后一天（打一节日）", a: ["除夕", "大年三十"], h: "团圆饭就在这天" },
    { c: "年俗", q: "挂在檐下红彤彤，点亮夜晚照路明（打一物）", a: ["灯笼", "红灯笼"], h: "元宵节也要挂" }
  ];

  function norm(s) { return String(s || "").replace(/[\s，。,.！!？?、“”"'「」（）()]/g, "").toLowerCase(); }
  function judge(input, answers) {
    var t = norm(input); if (!t) return false;
    return answers.some(function (a) { a = norm(a); return a && (t === a || t.indexOf(a) >= 0); });
  }
  function burst(box) {
    for (var i = 0; i < 16; i++) {
      var s = SF.h("i", "sfrd-p"), a = Math.random() * 6.283, d = 50 + Math.random() * 70;
      s.style.cssText = "--dx:" + (Math.cos(a) * d).toFixed(0) + "px;--dy:" + (Math.sin(a) * d - 20).toFixed(0) + "px;animation-delay:" + (Math.random() * 0.1).toFixed(2) + "s";
      box.appendChild(s); setTimeout(function (x) { return function () { x.remove(); }; }(s), 1100);
    }
  }
  async function aiRiddle(char) {
    var me = await SF.userName();
    var raw = await SF.ai("你是" + SF.cname(char) + "。" + SF.persona(char),
      "春节到了，请你用自己的口吻，给「" + me + "」出一道适合春节猜的灯谜（字谜、物谜、春节习俗都可以），答案必须是常见的词，不超过4个字，谜面20到40字。只输出 JSON：" +
      "{\"q\":\"谜面\",\"a\":\"答案\",\"alt\":[\"其他也算对的说法\"],\"h\":\"一句提示\",\"say\":\"揭晓答案时你用自己口吻说的一句话，30字内\",\"wrong\":\"对方猜错时你说的一句话，20字内\"}", 0.9);
    var j = SF.parseJson(raw) || {};
    var a = String(j.a || "").trim(), q = String(j.q || "").trim();
    if (!q || !a) throw new Error("没有拿到完整的灯谜，请再试一次");
    var alts = [a].concat(Array.isArray(j.alt) ? j.alt.map(String) : []);
    return { c: "角色出谜", q: q, a: alts, h: String(j.h || "").trim(), say: String(j.say || "").trim(), wrong: String(j.wrong || "").trim(), by: SF.cname(char) };
  }
  async function aiJudge(char, r, guess) {
    var raw = await SF.ai("你是" + SF.cname(char) + "。" + SF.persona(char),
      "你出的灯谜是：「" + r.q + "」，正确答案是「" + r.a[0] + "」。对方回答：「" + guess + "」。意思相同或者合理就算对。请判断，并用你自己的口吻回复一句话（25字内）。只输出 JSON：{\"ok\":true,\"say\":\"回复\"}", 0.5);
    var j = SF.parseJson(raw);
    if (!j || typeof j.ok !== "boolean") throw new Error("没有拿到判定结果，请再试一次");
    return { ok: j.ok, say: String(j.say || "").trim() };
  }

  SF.rd = {
    mountCard: function (c, m, r) {
      SF.setRoche(r);
      var cd = m.cardData || {};
      c.replaceChildren(SF.h("div", "sfc-rd", '<i class="sfc-rd-l"></i><div><small>灯谜' + (cd.by ? " · " + SF.esc(cd.by) : "") + "</small><p>" + SF.esc(cd.q || "") + "</p></div>"));
    },
    open: function () {
      var L = SF.layer(SF.appRoot, "灯谜", { full: true, k: "RIDDLES", key: "rd" });
      if (!L) return;
      var tab = "pre", st = { done: {}, ok: 0 }, cur = null, curIdx = -1, state = "ask", wrongLine = "", sayLine = "", hinted = false, lastGuess = "", chars = [], cid = null, busy = false, ai = null;

      function nextPreset() {
        var left = PRESET.map(function (_, i) { return i; }).filter(function (i) { return st.done[i] == null; });
        if (!left.length) { curIdx = -1; cur = null; return; }
        curIdx = SF.pick(left); cur = PRESET[curIdx]; state = "ask"; hinted = false; wrongLine = ""; lastGuess = ""; sayLine = "";
      }
      function lantern(r) {
        return '<div class="sfrd-box"><div class="sfrd-lan' + (state === "ok" ? " lit" : "") + '"><i class="sfrd-cord"></i><div class="sfrd-body"><small>' + SF.esc(r.c) + "</small><p>" + SF.esc(r.q) + '</p></div><i class="sfrd-tas"></i></div></div>';
      }
      function playUI(r, isAi) {
        var h = lantern(r);
        if (r.by && isAi) h += '<p class="tip" style="text-align:center">' + SF.esc(r.by) + " 出的谜</p>";
        if (state === "ask") {
          h += '<input type="text" class="sfrd-in" maxlength="12" placeholder="写下你的答案" value="">' +
            '<div class="sfrow" style="margin-top:12px"><button class="sfb" style="flex:1" data-a="guess" type="button">猜</button></div>';
          if (hinted && r.h) h += '<p class="tip" style="margin-top:10px">提示：' + SF.esc(r.h) + "</p>";
          if (wrongLine) h += '<p class="tip sfrd-wr" style="margin-top:8px">' + SF.esc(wrongLine) + "</p>";
          h += '<div class="sfrow" style="justify-content:center;gap:20px;margin-top:8px">' +
            (!hinted && r.h ? '<span class="sf-lnk" data-a="hint">提示</span>' : "") + '<span class="sf-lnk" data-a="reveal">看答案</span>' +
            (isAi && lastGuess ? '<span class="sf-lnk" data-a="mine">我觉得我答对了</span><span class="sf-lnk" data-a="aijudge">让 TA 判（AI 1 次）</span>' : "") + "</div>";
        } else {
          h += '<div class="sf-card" style="margin-top:14px;text-align:center"><small class="sfrd-k">谜底</small><div class="sfrd-ans">' + SF.esc(r.a[0]) + "</div>" +
            '<p class="tip" style="margin:6px 0 0">' + (state === "ok" ? "猜对了！" : "没猜出来，下次加油") + "</p>" +
            (sayLine ? '<p class="sfrd-say">' + SF.esc((r.by ? r.by + "：" : "") + sayLine) + "</p>" : "") + "</div>" +
            '<div class="sfrow" style="gap:10px;margin-top:14px"><button class="sfb" style="flex:1" data-a="next" type="button">' + (isAi ? "再出一道" : "下一道") + '</button><button class="sfb ghost" data-a="send" type="button">发给聊天</button></div>';
        }
        return h;
      }
      async function render() {
        if (!L.alive) return;
        var cnt = Object.keys(st.done).filter(function (k) { return st.done[k] === 1; }).length;
        var h = '<div class="sf-seg"><span data-t="pre" class="' + (tab === "pre" ? "on" : "") + '">猜灯谜</span><span data-t="ai" class="' + (tab === "ai" ? "on" : "") + '">角色出谜</span></div>';
        if (tab === "pre") {
          h += '<p class="tip" style="margin-top:12px;text-align:center">已猜对 ' + st.ok + " 道（预设 " + cnt + "/" + PRESET.length + "）</p>";
          if (!cur) {
            h += '<div class="sf-card" style="margin-top:12px;text-align:center"><p class="tip" style="margin:0">预设灯谜都猜完啦！</p></div><div style="text-align:center;margin-top:14px"><span class="sf-lnk" data-a="again">再玩一遍</span></div>';
          } else h += playUI(cur, false);
        } else {
          h += '<h4>选一位角色</h4>' + (chars.length ? SF.chipRow(chars.map(function (c) {
            return '<span class="sfchip' + (cid === c.id ? " on" : "") + '" data-c="' + SF.esc(c.id) + '">' + SF.esc(SF.cname(c)) + "</span>";
          }).join("")) : '<p class="tip">没有读取到角色</p>');
          if (!ai) h += '<button class="sfb block" style="margin-top:16px" data-a="make" type="button">请 TA 出一道（AI 1 次）</button>';
          else h += '<div style="margin-top:14px">' + playUI(ai, true) + "</div>" + (state === "ask" ? '<div style="text-align:center;margin-top:12px"><span class="sf-lnk" data-a="make">换一道（AI 1 次）</span></div>' : "");
        }
        L.body.innerHTML = h; SF.fadeRows(L.body);
        var inp = L.body.querySelector(".sfrd-in");
        if (inp) inp.onkeydown = function (e) { if (e.key === "Enter") L.body.querySelector('[data-a="guess"]').click(); };
        if (state === "ok" && L.body.querySelector(".sfrd-lan")) burst(L.body.querySelector(".sfrd-box"));
      }
      async function persist() { await SF.st.set("riddles", st); }
      async function win(isAi) {
        state = "ok"; st.ok++;
        if (!isAi && curIdx >= 0) st.done[curIdx] = 1;
        await persist();
        if (SF.sfx) SF.sfx.save();
        if (SF.fortune) SF.fortune.award("riddle");
        render();
      }
      function shareOf(r) {
        return function () {
          return {
            messageType: "riddle-card", cardData: { q: r.q, by: r.by || "" },
            modelText: "我想到一道灯谜考考你：「" + r.q + "」，你来猜猜看。（谜底我先不告诉你）"
          };
        };
      }
      L.body.addEventListener("click", async function (e) {
        var a = e.target.closest("[data-t],[data-c],[data-a]"); if (!a) return;
        var d = a.dataset, isAi = tab === "ai", r = isAi ? ai : cur;
        if (d.t) { tab = d.t; state = "ask"; hinted = false; wrongLine = ""; lastGuess = ""; sayLine = ""; if (tab === "pre" && !cur) nextPreset(); render(); return; }
        if (d.c) { cid = d.c; render(); return; }
        var act = d.a;
        if (act === "again") { st.done = {}; await persist(); nextPreset(); render(); }
        else if (act === "hint") { hinted = true; render(); }
        else if (act === "guess" && r) {
          var inp = L.body.querySelector(".sfrd-in"), g = inp ? inp.value.trim() : "";
          if (!g) { SF.toast("先写一个答案"); return; }
          lastGuess = g;
          if (judge(g, r.a)) { sayLine = isAi ? r.say : ""; win(isAi); }
          else { wrongLine = (isAi && r.wrong) ? r.by + "：" + r.wrong : "不对哦，再想想"; if (SF.sfx) SF.sfx.tap(); render(); }
        }
        else if (act === "mine" && r) { sayLine = r.say; win(true); }
        else if (act === "aijudge" && r) {
          if (busy) return;
          var char = chars.filter(function (c) { return c.id === cid; })[0]; if (!char) return;
          if (!(await SF.confirm("调用 AI", "让「" + SF.cname(char) + "」来判你的答案，会消耗 1 次 AI。继续吗？"))) return;
          busy = true; a.textContent = "判定中…";
          try {
            var v = await aiJudge(char, r, lastGuess);
            if (v.ok) { sayLine = v.say || r.say; win(true); }
            else { wrongLine = r.by + "：" + (v.say || "还差一点哦"); render(); }
          } catch (err) { SF.toast("失败：" + (err.message || err)); render(); }
          busy = false;
        }
        else if (act === "reveal" && r) {
          state = "fail"; sayLine = isAi ? r.say : "";
          if (!isAi && curIdx >= 0) { st.done[curIdx] = 0; await persist(); }
          render();
        }
        else if (act === "next") {
          if (isAi) { ai = null; state = "ask"; hinted = false; wrongLine = ""; lastGuess = ""; sayLine = ""; render(); }
          else { nextPreset(); render(); }
        }
        else if (act === "send" && r) SF.sendCard("灯谜会作为卡片发过去，不带谜底，角色可以陪你猜。", shareOf(r));
        else if (act === "make") {
          if (busy) return;
          var ch = chars.filter(function (c) { return c.id === cid; })[0];
          if (!ch) { SF.toast("先选一位角色"); return; }
          if (!(await SF.confirm("调用 AI", "让「" + SF.cname(ch) + "」出一道灯谜，会消耗 1 次 AI。继续吗？"))) return;
          busy = true; a.disabled = true; a.textContent = "出题中…";
          try { ai = await aiRiddle(ch); state = "ask"; hinted = false; wrongLine = ""; lastGuess = ""; sayLine = ""; }
          catch (err) { SF.toast("失败：" + (err.message || err)); }
          busy = false; render();
        }
      });

      SF.st.get("riddles", { done: {}, ok: 0 }).then(function (s) { st = s || { done: {}, ok: 0 }; st.done = st.done || {}; st.ok = st.ok || 0; if (!cur) nextPreset(); render(); });
      SF.chars().then(function (c) { chars = c; cid = c[0] ? c[0].id : null; render(); });
      nextPreset(); render();
    }
  };

  SF.cssApp.push(`
.sfrd-box{position:relative;display:flex;justify-content:center;margin:22px 0 14px}
.sfrd-lan{position:relative;width:min(78%,260px);padding:26px 16px 22px;border-radius:50% / 40%;text-align:center;background:radial-gradient(circle at 50% 35%,#f2543f,#b5231a 78%);border:2px solid #ffd77a;box-shadow:0 0 22px rgba(255,120,80,.35);color:#ffe9b8;animation:sfrdSw 4s ease-in-out infinite;transform-origin:50% -20px}
.sfrd-lan.lit{box-shadow:0 0 44px rgba(255,214,120,.95);animation:sfrdSw 1.6s ease-in-out infinite}
.sfrd-cord{position:absolute;left:50%;top:-22px;width:2px;height:22px;margin-left:-1px;background:#ffd77a}
.sfrd-tas{position:absolute;left:50%;bottom:-26px;width:14px;height:26px;margin-left:-7px;background:linear-gradient(180deg,#f7d98a,#d9a043);clip-path:polygon(25% 0,75% 0,100% 100%,0 100%)}
.sfrd-body small{display:block;font-size:10px;letter-spacing:.4em;color:#ffd77a;margin-bottom:8px}
.sfrd-body p{margin:0;font:600 16px/1.7 "Songti SC","STSong",serif}
@keyframes sfrdSw{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(1.6deg)}}
.sfrd-in{text-align:center;font-size:17px;letter-spacing:.2em}
.sfrd-k{font-size:10px;letter-spacing:.4em;color:var(--k)}
.sfrd-ans{margin:6px 0;font:600 30px/1.3 "Songti SC","STSong",serif;letter-spacing:.2em;color:var(--big)}
.sfrd-say{margin:10px 0 0;font-size:13.5px;line-height:1.7;color:var(--tx)}
.sfrd-wr{text-align:center;color:var(--acc)}
.sfrd-p{position:absolute;left:50%;top:44%;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff0b8,#e0a533);pointer-events:none;animation:sfrdP 1s cubic-bezier(.2,.8,.3,1) forwards}
@keyframes sfrdP{0%{transform:translate(0,0) scale(.3);opacity:1}100%{transform:translate(var(--dx),calc(var(--dy) + 40px)) scale(1);opacity:0}}
@media (prefers-reduced-motion:reduce){.sfrd-lan{animation:none}}
`);
  SF.cssChat.push([
    ".sfc-rd{display:flex;gap:10px;align-items:center;width:230px;max-width:100%;padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,#f08a6e,#e25a44);color:#fff;box-shadow:0 6px 18px rgba(214,80,60,.28);font-family:-apple-system,'PingFang SC',sans-serif}",
    ".sfc-rd-l{flex:0 0 26px;height:34px;border-radius:50% / 40%;background:radial-gradient(circle at 50% 35%,#ffeadf,#ffb79e);border:1.5px solid #ffd77a}",
    ".sfc-rd small{display:block;font-size:10.5px;letter-spacing:.3em;opacity:.85;margin-bottom:3px}.sfc-rd p{margin:0;font:600 13.5px/1.6 serif}"
  ].join("\n"));
})(window.__SF);

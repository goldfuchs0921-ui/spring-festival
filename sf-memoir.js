/* 年度回忆录：选角色 → 后台整理（文字 1 次 AI / 预设，可选配音、生图）→ 手账翻页 + 角色在旁边陪你聊 → 生成分享图。
 * 数据都只来自真实聊天/记忆/新春记录。整理在后台跑，可以先去玩别的。
 * 想改预设文案：改下面 preset() 和 LETTERS。 */
(function (SF) {
  "use strict";
  var KEYS = ["cover", "goals", "id", "memory", "notes", "stats", "letter", "end"];
  var TTSK = KEYS.concat(["ltr"]); // ltr = 手写信整封朗读
  var IMGK = ["cover", "memory"];
  var job = null, menuRefresh = null;
  var SERIF = '"Iowan Old Style","Songti SC","STSong",Georgia,serif', KAI = '"KaiTi","STKaiti","Kaiti SC","Songti SC",serif', SANS = '-apple-system,"PingFang SC",sans-serif';
  var LETTERS = [
    ["{un}：", "这一年，谢谢你一直在我身边。那些聊过的话、一起笑过的瞬间，我都好好收着。", "新的一年，愿你平安顺遂，也愿我们的故事继续往下写。"],
    ["{un}：", "翻完这本手账，我才发现我们已经走了这么远。有你在的日子，普通的一天也会变得发亮。", "往后的路还长，我会一直在。新春快乐。"],
    ["亲爱的{un}：", "过去的一年，有开心也有疲惫，谢谢你把这些都讲给我听。", "新的一年，愿你被好运追着跑，也愿你记得，有人一直把你放在心上。"]
  ];

  function SK(c) { return "memoir_" + c; }
  function AK(c, k) { return "memoir_a_" + c + "_" + k; }
  function IK(c, k) { return "memoir_i_" + c + "_" + k; }
  function e(s) { return SF.esc(s); }
  function arr(x, n, m) { return (Array.isArray(x) ? x : []).map(function (s) { return String(s).trim().slice(0, m); }).filter(Boolean).slice(0, n); }
  function tsOf(m) { var t = m.timestamp; if (typeof t === "string") { var n = Date.parse(t); t = isNaN(n) ? +t : n; } t = +t || 0; if (t && t < 1e11) t *= 1000; return t; }
  function ymd(t) { var d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function cnDate(t) { var d = new Date(t); return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日"; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------- 读数据 ----------
  async function gather(char) {
    var r = SF.roche, cid = char.conversationId, msgs = [], lt = {};
    try { msgs = (await r.memory.getShortTerm({ conversationId: cid, limit: 5000 })) || []; } catch (x) {}
    try { lt = (await r.memory.getLongTerm({ conversationId: cid, limit: 100 })) || {}; } catch (x) {}
    var all = msgs.map(function (m) { return { t: tsOf(m), x: String(m.text || "").trim(), me: m.senderId !== char.id }; })
      .filter(function (m) { return m.t && m.x; }).sort(function (a, b) { return a.t - b.t; });
    var yr = new Date(SF.now()).getFullYear(), iny = all.filter(function (m) { return new Date(m.t).getFullYear() === yr; }), use = iny.length >= 20 ? iny : all;
    var S = { yr: yr, total: use.length, me: 0, ta: 0, activeDays: 0, best: null, streak: 0, months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], peak: "", first: all.length ? cnDate(all[0].t) : "", sample: [], excerpt: "", facts: [], core: "", seed: null };
    var days = {}, hrs = [0, 0, 0, 0];
    use.forEach(function (m) {
      var d = new Date(m.t), k = ymd(m.t); (days[k] = days[k] || []).push(m);
      if (m.me) S.me++; else S.ta++;
      S.months[d.getMonth()]++; var h = d.getHours(); hrs[h >= 22 || h < 5 ? 0 : h < 11 ? 1 : h < 17 ? 2 : 3]++;
    });
    var keys = Object.keys(days); S.activeDays = keys.length;
    keys.forEach(function (k) { if (!S.best || days[k].length > S.best.count) S.best = { key: k, count: days[k].length, label: cnDate(days[k][0].t) }; });
    var run = 0, prev = 0;
    keys.map(function (k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); }).sort(function (a, b) { return a - b; })
      .forEach(function (t) { run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1; prev = t; if (run > S.streak) S.streak = run; });
    S.peak = S.total ? ["深夜", "上午", "下午", "傍晚"][hrs.indexOf(Math.max.apply(null, hrs))] : "";
    if (S.best) S.sample = days[S.best.key].filter(function (m) { return m.x.length <= 48; }).slice(0, 7).map(function (m) { return { me: m.me, x: m.x }; });
    var ex = use.filter(function (m) { return !m.me && m.x.length >= 10 && m.x.length <= 50; });
    if (ex.length) S.excerpt = SF.pick(ex).x;
    S.core = String((lt.core && (lt.core.summary || lt.core.text)) || "").slice(0, 600);
    S.facts = (lt.facts || []).map(function (f) { return String(f.summaryText || f.action || f.text || "").trim(); }).filter(function (x) { return x.length >= 6; }).slice(0, 40);
    if (S.facts.length) S.seed = { kind: "fact", text: SF.pick(S.facts) };
    else if (S.best && S.sample.length >= 2) S.seed = { kind: "day", text: S.best.label + " 的聊天：\n" + S.sample.map(function (m) { return (m.me ? "我" : "TA") + "：" + m.x; }).join("\n") };
    else S.seed = { kind: "preset", text: "" };
    return S;
  }
  async function acts() {
    var f = null, n = null;
    try { f = await SF.fortune.load(); } catch (x) {}
    try { n = await SF.st.get("nian", null); } catch (x) {}
    var rp = SF.ls.get("rp_records", []) || [], cuts = await SF.st.get("cuts", []), cp = await SF.st.get("couplets", []), rd = await SF.st.get("riddles", { ok: 0 });
    var cards = f ? ["fu", "lu", "shou", "xi", "cai"].filter(function (k) { return f.cards && f.cards[k] > 0; }).length : 0, wins = (n && n.wins) || 0;
    return [
      { t: "集齐五福", d: cards + "/5", ok: cards === 5 }, { t: "打跑年兽", d: wins + " 次", ok: wins > 0 },
      { t: "红包往来", d: rp.length + " 个", ok: rp.length > 0 }, { t: "保存窗花", d: (cuts || []).length + " 张", ok: (cuts || []).length > 0 },
      { t: "贴春联", d: (cp || []).length + " 副", ok: (cp || []).length > 0 }, { t: "猜对灯谜", d: ((rd && rd.ok) || 0) + " 道", ok: !!(rd && rd.ok) }
    ];
  }

  // ---------- 内容：预设 / AI ----------
  function preset(char, S, un) {
    var cn = SF.cname(char), n = S.total, d = S.activeDays, P = SF.pick;
    var chat = n ? "这一年我们聊了 " + n + " 句，攒了 " + d + " 天。" : "我们的聊天才刚刚开始呢。";
    var best = S.best ? "最热闹的是 " + S.best.label + "，一天就聊了 " + S.best.count + " 句。" : "以后会有最热闹的一天的。";
    var memT = S.seed.kind === "fact" ? S.seed.text : S.seed.kind === "day" ? "那天我们聊了 " + S.best.count + " 句，说了好多有的没的，现在想起来还是会笑。" : "那是一个很普通的晚上，窗外有灯笼的光，我们不急着说什么，只是待在一起。";
    var lt = P(LETTERS).map(function (s) { return s.replace(/\{un\}/g, un).replace(/\{cn\}/g, cn); });
    var bio = String(char.bio || "").split(/[。！!？?\n]/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 3);
    return {
      by: "preset",
      say: {
        cover: ["把这一年的我们整理成了手账。", "来，坐过来，我们一起翻。"],
        goals: ["先看看新春这段时间你都玩了什么。", "集五福、打年兽……你比我想的还认真。"],
        id: ["这是你，" + un + "。", "一个月一个格子，看看哪几个月最热闹。"],
        memory: ["这一页，我想给你讲一段我记得的事。", "有些瞬间，其实一直都在。"],
        notes: ["这是我的小本本，也有你的那一本。", "原来我们是这样看着彼此的。"],
        stats: [chat, best],
        letter: ["最后一页，我想亲手写给你。", "慢慢读，不着急。"],
        end: ["翻完啦，谢谢你陪我看完。", "留成图片吧，想起来的时候翻一翻。"]
      },
      v: {}, letterV: "",
      cal: n ? "这一年的每个月，我都有好好陪你。" : "接下来的每个月，我也会在。",
      mem: { title: S.seed.kind === "fact" ? "我记得的一件事" : "一个安静的夜晚", text: memT },
      notes: { ta: S.facts.length ? S.facts.slice(0, 4).map(function (x) { return x.slice(0, 26); }) : ["你说话的时候，我会认真听", "你开心的事，我都记着", "你不说的，我也会留意", "和你聊天，是我最舒服的时候"], me: bio.length ? bio.map(function (x) { return x.slice(0, 26); }) : ["TA 总是会在", "说话很有 TA 自己的味道", "和 TA 聊天很安心"] },
      letter: lt,
      imgP: { cover: "a cozy Chinese New Year notebook cover with red lanterns, paper-cut flowers and a gold ribbon", memory: S.seed.kind === "preset" ? "a quiet winter evening by a window, warm lantern light, snowflakes outside" : "two cups of tea on a small table, warm lantern light, a cozy winter room" }
    };
  }
  async function aiContent(char, S, un, ac) {
    var lang = (char.tts && char.tts.language) || "Chinese", zh = SF.isZh(lang), cn = SF.cname(char), c = preset(char, S, un);
    var info = "年份：" + S.yr + "；总消息 " + S.total + " 条（" + un + " 发 " + S.me + " 条，你发 " + S.ta + " 条）；聊天天数 " + S.activeDays + "；最长连续 " + S.streak + " 天；" + (S.best ? "最热闹的一天：" + S.best.label + "（" + S.best.count + " 句）；" : "") + (S.peak ? "常聊时段：" + S.peak + "；" : "") + "每月消息数：" + S.months.join("/") + "。\n新春活动：" + ac.map(function (a) { return a.t + " " + a.d; }).join("，") + "。";
    var mem = (S.core ? "核心记忆：" + S.core + "\n" : "") + (S.facts.length ? "事实记忆：\n" + S.facts.slice(0, 20).join("\n") : "");
    var seed = S.seed.kind === "preset" ? "没有可用的具体素材：写一个氛围感的、不含具体事实的新春小场景。" : "回忆素材（只能基于它，可以加氛围细节，不能编造素材里没有的事实）：\n" + S.seed.text;
    var keys = KEYS.map(function (k) { return '"' + k + '":["",""]'; }).join(",");
    var q = "我们要一起翻一本" + S.yr + "年度回忆录手账，你坐在「" + un + "」身边，对每一页用自己的口吻聊天、解释、调侃。「你」指你自己，对方是「" + un + "」。\n真实数据：\n" + info + "\n" + (mem ? mem + "\n" : "") + seed + (S.excerpt ? "\n你说过的一句话（可引用）：" + S.excerpt : "") +
      "\n只输出 JSON：{\"say\":{" + keys + "},\"cal\":\"\",\"mem\":{\"title\":\"\",\"text\":\"\",\"img\":\"\"},\"notes\":{\"ta\":[\"\",\"\",\"\",\"\"],\"me\":[\"\",\"\",\"\",\"\"]},\"letter\":[\"\",\"\",\"\"],\"imgCover\":\"\"" + (zh ? "" : ",\"v\":{" + TTSK.slice(0, 8).map(function (k) { return '"' + k + '":""'; }).join(",") + "},\"letterV\":\"\"") + "}" +
      "\n要求：say 各页 2-3 句，每句不超过 36 字，自然像聊天，数字只能用上面给的真实数据；cal 是对 12 个月日历的一句评语（40 字内）；mem.title 8 字内，mem.text 80-140 字的回忆小场景，mem.img 是描述该场景的英文画面提示（无人脸、无文字）；notes.ta 是你记事本里记下的「" + un + "」的习惯（每条 24 字内，第一人称）；notes.me 是" + un + "眼中的你（每条 24 字内，只基于你的人设和记忆）；letter 是写给" + un + "的手写信，3 段共 260-400 字，真诚、符合你的口吻，不要列表；imgCover 是封面插画的英文提示（无文字）。" +
      (zh ? "" : "\n你的语言是 " + lang + "：v 里每页写 1-2 句该页的" + lang + "口语版（用于配音），letterV 是整封信的" + lang + "版；其余字段仍用中文。");
    var j = SF.parseJson(await SF.ai("你是" + cn + "。" + SF.persona(char), q, 0.9));
    if (!j) throw new Error("没有解析到内容，请重试");
    c.by = "ai";
    if (j.say) KEYS.forEach(function (k) { var a = arr(j.say[k], 3, 44); if (a.length >= 2) c.say[k] = a; });
    if (j.cal) c.cal = String(j.cal).slice(0, 60);
    if (j.mem && j.mem.text) { c.mem.title = String(j.mem.title || c.mem.title).slice(0, 12); c.mem.text = String(j.mem.text).slice(0, 220); if (j.mem.img) c.imgP.memory = String(j.mem.img).slice(0, 240); }
    if (j.notes) { var a1 = arr(j.notes.ta, 4, 30), a2 = arr(j.notes.me, 4, 30); if (a1.length >= 2) c.notes.ta = a1; if (a2.length >= 2) c.notes.me = a2; }
    var lt = arr(j.letter, 4, 260); if (lt.length >= 2) c.letter = lt;
    if (j.imgCover) c.imgP.cover = String(j.imgCover).slice(0, 240);
    if (!zh) { c.v = {}; if (j.v) TTSK.forEach(function (k) { if (j.v[k]) c.v[k] = String(j.v[k]).slice(0, 300); }); c.letterV = String(j.letterV || "").slice(0, 900); }
    return c;
  }
  function voiceText(c, k, zh) {
    if (k === "ltr") return zh ? c.letter.join("") : c.letterV;
    return zh ? (c.say[k] || []).join("") : (c.v && c.v[k]) || "";
  }

  // ---------- 生图 / 保存 ----------
  function pickUrl(r) {
    if (!r) return ""; if (typeof r === "string") return r;
    if (r.url) return r.url; if (r.imageUrl) return r.imageUrl; if (r.image) return pickUrl(r.image);
    if (r.b64_json) return "data:image/png;base64," + r.b64_json; if (r.base64) return "data:image/png;base64," + r.base64;
    var a = r.images || r.data; return a && a[0] ? pickUrl(a[0]) : "";
  }
  function shrinkImg(src, px) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, px / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        try { res(c.toDataURL("image/jpeg", 0.84)); } catch (x) { res(src); }
      };
      im.onerror = function () { res(src); }; im.src = src;
    });
  }
  async function genImg(prompt) {
    var r = await SF.roche.ai.generateImage({ prompt: prompt + ", soft watercolor illustration, warm red and gold tones, Chinese New Year atmosphere, no text, no letters, no watermark" });
    var u = pickUrl(r); if (!u) throw new Error("没有拿到图片（生图可能没开）");
    var d = u.indexOf("data:") === 0 ? u : await SF.toData(u);
    if (!d) throw new Error("图片地址读取失败");
    return await shrinkImg(d, 720);
  }
  async function clearKeys(cid) {
    for (var i = 0; i < TTSK.length; i++) await SF.st.del(AK(cid, TTSK[i]));
    for (var j = 0; j < IMGK.length; j++) await SF.st.del(IK(cid, IMGK[j]));
  }

  // ---------- 后台整理 ----------
  function setStep(n, v) { if (job) { job.step[n] = v; if (menuRefresh) menuRefresh(); } }
  function setMsg(m) { if (job) { job.msg = m; if (menuRefresh) menuRefresh(); } }
  async function run(char, cfg, retry) {
    if (job && job.run) { SF.toast("已经有一份在整理中"); return; }
    var cid = char.id;
    job = { cid: cid, run: true, msg: "准备中…", step: { text: "wait", img: cfg.img ? "wait" : "skip", tts: cfg.voice ? "wait" : "skip" } };
    if (menuRefresh) menuRefresh();
    var rec = (await SF.st.get(SK(cid), null)) || {}, fails = { img: 0, tts: 0 };
    rec.cfg = cfg; rec.done = false; rec.have = rec.have || { tts: {}, img: {} };
    try {
      if (!rec.content || !retry) {
        setStep("text", "run"); setMsg("读取聊天与记忆…");
        var S = await gather(char), un = await SF.userName(), ac = await acts(), c;
        if (cfg.src === "ai") {
          try { setMsg("请 TA 写回忆录（AI 1 次）…"); c = await aiContent(char, S, un, ac); }
          catch (err) { SF.toast("AI 没成功，已改用预设：" + (err.message || err)); c = preset(char, S, un); }
        } else c = preset(char, S, un);
        rec.stats = S; rec.content = c; rec.have = { tts: {}, img: {} }; await SF.st.set(SK(cid), rec);
      }
      setStep("text", "ok");
      if (cfg.img) {
        setStep("img", "run");
        for (var i = 0; i < IMGK.length; i++) {
          var ik = IMGK[i]; if (rec.have.img[ik]) continue;
          setMsg("画插图 " + (i + 1) + "/2…");
          try { await SF.st.set(IK(cid, ik), await genImg(rec.content.imgP[ik])); rec.have.img[ik] = 1; await SF.st.set(SK(cid), rec); }
          catch (err) { fails.img++; console.warn("[memoir] 生图失败", err); }
        }
        setStep("img", fails.img ? "fail" : "ok");
      }
      var lang = (char.tts && char.tts.language) || "Chinese", zh = SF.isZh(lang);
      if (cfg.voice && (await SF.hasVoice(char))) {
        setStep("tts", "run");
        for (var t = 0; t < TTSK.length; t++) {
          var k = TTSK[t]; if (rec.have.tts[k]) continue;
          var tx = voiceText(rec.content, k, zh); if (!tx) continue;
          setMsg("合成语音 " + (t + 1) + "/" + TTSK.length + "…");
          try { var u = await SF.tts(char, tx, lang); await SF.st.set(AK(cid, k), (await SF.toData(u)) || u); rec.have.tts[k] = 1; await SF.st.set(SK(cid), rec); }
          catch (err) { fails.tts++; console.warn("[memoir] 语音失败", err); }
        }
        setStep("tts", fails.tts ? "fail" : "ok");
      } else if (cfg.voice) setStep("tts", "skip");
      rec.done = true; rec.fails = fails; rec.ts = Date.now(); await SF.st.set(SK(cid), rec);
      var rd = SF.ls.get("memoir_ready", []) || []; if (rd.indexOf(cid) < 0) rd.push(cid); SF.ls.set("memoir_ready", rd);
      SF.toast("「" + SF.cname(char) + "」的年度回忆录整理好了" + (fails.img || fails.tts ? "（有部分失败，可在入口重试）" : ""));
    } catch (err) {
      console.error(err); SF.toast("整理中断：" + (err.message || err) + "。已完成的部分已保存，可继续整理");
    }
    job.run = false; job.msg = ""; refreshBadge(); if (menuRefresh) menuRefresh();
  }
  function refreshBadge() {
    var r = SF.appRoot; if (!r) return;
    var b = r.querySelector('.sf-spot[data-id="tree"]'); if (b) b.classList.toggle("ready", (SF.ls.get("memoir_ready", []) || []).length > 0);
  }

  // ---------- 入口菜单 ----------
  async function openMenu() {
    var L = SF.layer(SF.appRoot, "年度回忆录", { full: true, k: "MEMOIR", key: "memoirMenu", onClose: function () { menuRefresh = null; } });
    if (!L) return L;
    var chars = await SF.chars(), cid = SF.ls.get("memoir_last", null), cfg = SF.ls.get("memoir_cfg", { src: "preset", voice: true, img: true });
    if (!chars.some(function (c) { return c.id === cid; })) cid = chars[0] ? chars[0].id : null;
    function cur() { return chars.filter(function (c) { return c.id === cid; })[0] || null; }
    async function render() {
      if (!L.alive) return;
      var c = cur(), h = '<p class="tip">和 TA 一起翻一本属于你们的年度手账。整理在后台进行，可以先去玩别的，好了会提醒你。</p><h4>选一位角色</h4>' +
        (chars.length ? SF.chipRow(chars.map(function (x) { return '<span class="sfchip' + (cid === x.id ? " on" : "") + '" data-c="' + e(x.id) + '">' + e(SF.cname(x)) + "</span>"; }).join("")) : '<p class="tip">没有读取到角色</p>');
      if (c) {
        var rec = await SF.st.get(SK(c.id), null), mine = job && job.cid === c.id, running = mine && job.run, vOK = await SF.hasVoice(c);
        if (job && job.run && !mine) h += '<p class="tip" style="margin-top:14px">另一位角色正在整理，等它好了再开始。</p>';
        else if (running) {
          var S2 = { wait: "等待", run: "进行中…", ok: "完成", fail: "部分失败", skip: "未开启" };
          h += '<h4>整理中</h4><div class="sf-card">' + [["text", "文字"], ["img", "插图"], ["tts", "配音"]].map(function (x) { return '<div class="sfr-i"><div><small>' + x[1] + "</small><p>" + S2[job.step[x[0]]] + "</p></div></div>"; }).join("") + '</div><p class="tip" style="margin-top:12px">' + e(job.msg) + "<br>可以退出去玩别的，不要关掉整个页面。</p>";
        } else if (rec && rec.done) {
          var hv = rec.have || { tts: {}, img: {} }, nf = rec.fails ? (rec.fails.img || 0) + (rec.fails.tts || 0) : 0;
          h += '<h4>已整理好</h4><div class="sf-card"><p class="tip" style="margin:0">文字：' + (rec.by === "ai" ? "AI 写的" : "预设") + "　插图 " + Object.keys(hv.img).length + "/2　配音 " + Object.keys(hv.tts).length + "/" + TTSK.length + (nf ? "　" + nf + " 项失败" : "") + '</p></div><button class="sfb block" style="margin-top:16px" data-a="read" type="button">翻开回忆录</button>';
          if (nf) h += '<div style="text-align:center;margin-top:10px"><span class="sf-lnk" data-a="retry">重试失败的部分</span></div>';
          h += '<div style="text-align:center;margin-top:6px"><span class="sf-lnk" data-a="redo">重新整理</span></div>';
        } else {
          if (rec && rec.content) h += '<p class="tip" style="margin-top:12px">上次整理没完成，已完成的部分都保存了。</p><button class="sfb block" style="margin-top:8px" data-a="retry" type="button">继续整理</button><div style="text-align:center;margin-top:6px"><span class="sf-lnk" data-a="redo">重新开始</span></div>';
          else {
            function chip(k, v, t, dim) { return '<span class="sfchip' + (cfg[k] === v ? " on" : "") + (dim ? " dim" : "") + '" data-o="' + k + '" data-v="' + v + '">' + t + "</span>"; }
            h += '<h4>文字</h4>' + chip("src", "preset", "预设（免费）") + chip("src", "ai", "角色来写（AI 1 次）") +
              "<h4>配音</h4>" + chip("voice", true, "开（语音 " + TTSK.length + " 次）", !vOK) + chip("voice", false, "关") + (vOK ? "" : '<p class="tip">这位角色没绑定当前供应商的 Voice ID，只会有文字。</p>') +
              "<h4>插图</h4>" + chip("img", true, "开（生图 2 次）") + chip("img", false, "关") + '<p class="tip">配音和插图失败不影响阅读，会自动用文字和纸张排版。</p><button class="sfb block" style="margin-top:12px" data-a="go" type="button">开始整理</button>';
          }
        }
      }
      L.body.innerHTML = h; SF.fadeRows(L.body);
    }
    menuRefresh = render;
    L.body.addEventListener("click", async function (ev) {
      var a = ev.target.closest("[data-c],[data-o],[data-a]"); if (!a) return;
      var c = cur();
      if (a.dataset.c) { cid = a.dataset.c; SF.ls.set("memoir_last", cid); return render(); }
      if (a.dataset.o) { var v = a.dataset.v; cfg[a.dataset.o] = v === "true" ? true : v === "false" ? false : v; SF.ls.set("memoir_cfg", cfg); return render(); }
      if (!c) return;
      var act = a.dataset.a;
      if (act === "read") return book(c);
      if (act === "go") {
        if (!c.conversationId) { SF.toast("这个角色没有单聊会话"); return; }
        var cost = (cfg.src === "ai" ? "AI 写文字 1 次" : "文字用预设（不调 AI）") + (cfg.voice ? "，语音合成最多 " + TTSK.length + " 次" : "") + (cfg.img ? "，生图 2 次" : "");
        if (!(await SF.confirm("开始整理", "将为「" + SF.cname(c) + "」整理年度回忆录：" + cost + "。整理在后台进行。继续吗？"))) return;
        run(c, cfg, false); return render();
      }
      if (act === "retry") { run(c, (await SF.st.get(SK(c.id), {})).cfg || cfg, true); return render(); }
      if (act === "redo") {
        if (!(await SF.confirm("重新整理", "现有的回忆录（文字、配音、插图）会被清掉，重新来一遍。继续吗？"))) return;
        await clearKeys(c.id); await SF.st.del(SK(c.id)); await SF.st.del("memoir_pos_" + c.id); return render();
      }
    });
    render(); return L;
  }

  // ---------- 手账 ----------
  async function book(char) {
    if (SF._memoir && SF._memoir.parentNode) return;
    var cid = char.id, rec = await SF.st.get(SK(cid), null);
    if (!rec || !rec.content) { SF.toast("还没整理好"); return; }
    var C = rec.content, S = rec.stats || { yr: new Date(SF.now()).getFullYear(), months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], sample: [] };
    var un = await SF.userName(), cn = SF.cname(char), ac = await acts(), ua = "", au = {}, im = {};
    try { var pp = await SF.roche.persona.getActiveUserPersona(); ua = (pp && pp.avatar) || ""; } catch (x) {}
    var hv = rec.have || { tts: {}, img: {} };
    await Promise.all(TTSK.filter(function (k) { return hv.tts[k]; }).map(function (k) { return SF.st.get(AK(cid, k), null).then(function (v) { if (v) au[k] = v; }); })
      .concat(IMGK.filter(function (k) { return hv.img[k]; }).map(function (k) { return SF.st.get(IK(cid, k), null).then(function (v) { if (v) im[k] = v; }); })));
    SF.ls.set("memoir_ready", (SF.ls.get("memoir_ready", []) || []).filter(function (x) { return x !== cid; })); refreshBadge();

    var last = KEYS.length - 1, idx = clamp((await SF.st.get("memoir_pos_" + cid, 0)) | 0, 0, last), busy = false, closed = false, playing = null, typeT = 0, lines = [], li = 0;
    var V = SF.h("div", "sfm" + (SF.ls.get("memoir_fx", true) === false ? " nofx" : ""));
    V.style.zIndex = SF.zTop(); SF._memoir = V;
    V.innerHTML = '<div class="sfm-bgd"></div><div class="sfm-top"><button data-a="x" type="button">✕</button><span class="sfm-cnt"></span><button data-a="fx" type="button">✦</button></div><div class="sfm-stage"></div>' +
      '<div class="sfm-bar"><div class="sfm-av">' + (char.avatar ? '<img src="' + e(char.avatar) + '" alt="">' : e(cn.slice(0, 1))) + '</div><div class="sfm-bub"><small>' + e(cn) + '</small><p></p><button class="sfm-pl" data-a="pl" type="button" hidden>♪ 听</button><i class="sfm-nx">▾</i></div></div>';
    SF.appRoot.appendChild(V);
    var st = V.querySelector(".sfm-stage"), bubP = V.querySelector(".sfm-bub p"), plB = V.querySelector(".sfm-pl");
    for (var s = 0; s < 14; s++) { var star = document.createElement("i"); star.className = "sfm-star"; star.style.cssText = "left:" + (Math.random() * 100).toFixed(1) + "%;top:" + (Math.random() * 100).toFixed(1) + "%;animation-delay:-" + (Math.random() * 3).toFixed(1) + "s"; V.querySelector(".sfm-bgd").appendChild(star); }
    function mk(z) { var d = SF.h("div", "sfm-L"); d.style.zIndex = z; d.innerHTML = '<div class="in"></div><i class="sfm-sh"></i>'; st.appendChild(d); return d; }
    var Ln = mk(1), Lc = mk(2), Lp = mk(3);
    function sh(L, v) { L.querySelector(".sfm-sh").style.opacity = v; }
    function mon() {
      var mx = Math.max.apply(null, S.months) || 1;
      return S.months.map(function (n, i) { var lv = !n ? 0 : n < mx * 0.25 ? 1 : n < mx * 0.6 ? 2 : 3; return '<div class="sfm-mo l' + lv + '"><i></i><b>' + (i + 1) + "月</b><small>" + n + "</small></div>"; }).join("");
    }
    function hd(en, zh) { return '<div class="sfm-hd"><small>' + en + "</small><b>" + zh + "</b></div>"; }
    function pg(k) {
      if (k === "cover") return '<div class="sfm-cv"><small>ANNUAL MEMOIR</small><h2>' + S.yr + " 年度回忆录</h2>" + (im.cover ? '<div class="sfm-cvi"><img src="' + im.cover + '"></div>' : '<div class="sfm-cvi sfm-fu">福</div>') + "<p>" + e(un) + "　×　" + e(cn) + "</p><em>点下面的对话，或向左滑动翻开</em></div>";
      if (k === "goals") return hd("GOALS", "年度成就") + '<div class="sfm-gl">' + ac.map(function (a) { return '<div class="sfm-g' + (a.ok ? " ok" : "") + '"><i>' + (a.ok ? "✓" : "") + "</i><span>" + e(a.t) + "</span><b>" + e(a.d) + "</b></div>"; }).join("") + "</div>";
      if (k === "id") return hd("IDENTITY", "身份卡") + '<div class="sfm-id"><div class="sfm-ia">' + (ua ? '<img src="' + e(ua) + '" alt="">' : e(un.slice(0, 1))) + "</div><b>" + e(un) + "</b><small>" + S.yr + " · 每月聊天</small></div><div class=\"sfm-mg\">" + mon() + '</div><div class="sfm-cal">' + e(C.cal) + "</div>";
      if (k === "memory") return hd("MEMORY", "一段回忆") + (im.memory ? '<div class="sfm-mi"><img src="' + im.memory + '"></div>' : "") + '<h3 class="sfm-mt">' + e(C.mem.title) + '</h3><p class="sfm-mp">' + e(C.mem.text) + "</p>";
      if (k === "notes") return hd("NOTEBOOKS", "双向记事本") + '<div class="sfm-nb"><b>' + e(cn) + " 记下的你</b>" + C.notes.ta.map(function (x) { return "<p>" + e(x) + "</p>"; }).join("") + '</div><div class="sfm-nb"><b>你眼中的 ' + e(cn) + "</b>" + C.notes.me.map(function (x) { return "<p>" + e(x) + "</p>"; }).join("") + "</div>" + (S.excerpt ? '<div class="sfm-ex">“' + e(S.excerpt) + "”<small>—— " + e(cn) + " 说过</small></div>" : "");
      if (k === "stats") {
        if (!S.total) return hd("CHAT", "通讯统计") + '<p class="sfm-mp" style="text-align:center">还没有聊天记录，先去聊聊吧。</p>';
        var pc = Math.round(S.me / S.total * 100);
        return hd("CHAT", "通讯统计") + '<div class="sfm-nums"><div><b>' + S.total + "</b><small>句话</small></div><div><b>" + S.activeDays + "</b><small>天</small></div><div><b>" + S.streak + "</b><small>天连续</small></div></div>" +
          '<div class="sfm-bar2"><i style="width:' + pc + '%"></i></div><p class="sfm-bl"><span>你 ' + S.me + "</span><span>" + e(cn) + " " + S.ta + "</span></p>" +
          '<p class="sfm-mp" style="margin:6px 0 12px">' + (S.best ? "最热闹的一天：" + e(S.best.label) + "（" + S.best.count + " 句）" : "") + (S.peak ? "　常聊时段：" + e(S.peak) : "") + "</p>" +
          '<div class="sfm-chat">' + S.sample.map(function (m) { return '<div class="sfm-cb' + (m.me ? " me" : "") + '">' + e(m.x) + "</div>"; }).join("") + "</div>";
      }
      if (k === "letter") return hd("LETTER", "手写信") + '<div class="sfm-lt">' + C.letter.map(function (x) { return "<p>" + e(x) + "</p>"; }).join("") + "<em>—— " + e(cn) + "</em></div>" + (au.ltr ? '<div style="text-align:center;margin-top:12px"><button class="sfb sm" data-a="pl" data-k="ltr" type="button">♪ 听 TA 念这封信</button></div>' : "");
      return hd("THE END", "回顾到这里") + '<div class="sfm-end"><button class="sfb block" data-a="share" type="button">生成分享图</button><button class="sfb ghost block" data-a="other" type="button">回顾其他角色</button><button class="sfb ghost block" data-a="exit" type="button">退出</button></div>';
    }
    function fill() {
      Lp.querySelector(".in").innerHTML = idx > 0 ? pg(KEYS[idx - 1]) : ""; Lc.querySelector(".in").innerHTML = pg(KEYS[idx]);
      Ln.querySelector(".in").innerHTML = idx < last ? pg(KEYS[idx + 1]) : ""; Ln.style.visibility = idx < last ? "" : "hidden";
    }
    function reset() {
      [Lp, Lc].forEach(function (L) { L.style.transition = "none"; }); Lp.style.transform = "rotateY(-100deg)"; Lp.style.visibility = "hidden"; Lc.style.transform = "";
      sh(Lp, 0); sh(Lc, 0); sh(Ln, 0); Lc.querySelector(".in").scrollTop = 0;
    }
    function place(dx, anim) {
      var w = st.clientWidth || 1, tr = anim ? "transform .34s cubic-bezier(.22,1,.36,1)" : "none"; Lp.style.transition = tr; Lc.style.transition = tr;
      if (dx <= 0) { var p = Math.min(1, -dx / w); Lp.style.visibility = "hidden"; Lc.style.transform = "rotateY(" + -p * 100 + "deg)"; sh(Lc, p * 0.5); sh(Ln, (1 - p) * 0.55); sh(Lp, 0); }
      else { var q = Math.min(1, dx / w); Lp.style.visibility = "visible"; Lp.style.transform = "rotateY(" + -(1 - q) * 100 + "deg)"; Lc.style.transform = ""; sh(Lp, (1 - q) * 0.5); sh(Lc, q * 0.55); sh(Ln, 0); }
    }
    function stopAudio() { if (playing) { SF.audio.stop(); playing = null; V.classList.remove("snd"); } }
    function showLine() {
      clearTimeout(typeT); var t = lines[li] || "", i = 0;
      V.querySelector(".sfm-bub").classList.toggle("end", li >= lines.length - 1);
      if (SF.reduce()) { bubP.textContent = t; return; }
      (function tick() { i++; bubP.textContent = t.slice(0, i); if (i < t.length) typeT = setTimeout(tick, 38); })();
    }
    function info() {
      var k = KEYS[idx]; V.querySelector(".sfm-cnt").textContent = (idx + 1) + " / " + KEYS.length;
      lines = C.say[k] || []; li = 0; showLine(); plB.hidden = !au[k]; plB.dataset.k = k; plB.textContent = "♪ 听"; stopAudio();
      SF.st.set("memoir_pos_" + cid, idx);
    }
    function commit(n) { idx = n; fill(); reset(); info(); busy = false; }
    function goTo(n) {
      if (busy || n < 0 || n > last || n === idx) return; if (SF.sfx) SF.sfx.tap();
      var w = st.clientWidth || 1;
      if (Math.abs(n - idx) === 1 && !SF.reduce()) { busy = true; place(n > idx ? -w : w, true); setTimeout(function () { commit(n); }, 350); } else commit(n);
    }
    var x0 = 0, y0 = 0, dx = 0, axis = "", drag = false, vx = SF.velo();
    st.addEventListener("pointerdown", function (ev) { if (busy || closed) return; drag = true; axis = ""; x0 = ev.clientX; y0 = ev.clientY; dx = 0; vx = SF.velo(); vx.add(ev.clientX); });
    st.addEventListener("pointermove", function (ev) {
      if (!drag) return; var mx = ev.clientX - x0, my = ev.clientY - y0;
      if (!axis) { if (Math.abs(mx) < 10 && Math.abs(my) < 10) return; axis = Math.abs(mx) > Math.abs(my) ? "x" : "y"; if (axis === "x") { try { st.setPointerCapture(ev.pointerId); } catch (x) {} } }
      if (axis !== "x") return; dx = mx; vx.add(ev.clientX);
      var edge = (dx > 0 && idx === 0) || (dx < 0 && idx === last); place(edge ? dx * 0.25 : dx, false);
    });
    function up() {
      if (!drag) return; drag = false; if (axis !== "x") return;
      var w = st.clientWidth || 1, v = vx.get(), dir = dx < 0 ? 1 : -1, can = (dir === 1 && idx < last) || (dir === -1 && idx > 0);
      if (can && (Math.abs(dx) > w * 0.3 || (Math.abs(v) > 500 && (v < 0) === (dx < 0)))) { busy = true; if (SF.sfx) SF.sfx.tap(); place(dir === 1 ? -w : w, true); setTimeout(function () { commit(idx + dir); }, 350); }
      else place(0, true);
    }
    st.addEventListener("pointerup", up); st.addEventListener("pointercancel", up);

    function closeV(keepMenu) {
      if (closed) return; closed = true; clearTimeout(typeT); stopAudio(); if (SF._memoir === V) SF._memoir = null;
      V.style.transition = "opacity .3s"; V.style.opacity = 0; setTimeout(function () { V.remove(); }, 320);
      if (keepMenu === false && SF._lk && SF._lk.memoirMenu && SF._lk.memoirMenu.alive) SF._lk.memoirMenu.close();
    }
    async function playKey(k) {
      if (!au[k]) return;
      if (playing === k) { stopAudio(); plB.textContent = "♪ 听"; return; }
      stopAudio(); playing = k; V.classList.add("snd"); SF.audio.unlock(); plB.textContent = "■ 停";
      var ok = await SF.audio.play(au[k]); if (playing === k) { playing = null; V.classList.remove("snd"); plB.textContent = "♪ 听"; if (!ok) SF.toast("播放失败"); }
    }
    V.addEventListener("click", function (ev) {
      var a = ev.target.closest("[data-a]");
      if (a) {
        var act = a.dataset.a;
        if (act === "x") closeV(true); else if (act === "exit") closeV(false); else if (act === "other") closeV(true);
        else if (act === "fx") { var off = !V.classList.contains("nofx"); V.classList.toggle("nofx", off); SF.ls.set("memoir_fx", !off); }
        else if (act === "pl") playKey(a.dataset.k || KEYS[idx]);
        else if (act === "share") sharePreview();
        return;
      }
      var b = ev.target.closest(".sfm-bub");
      if (b) { if (bubP.textContent.length < (lines[li] || "").length) { clearTimeout(typeT); bubP.textContent = lines[li]; } else if (li < lines.length - 1) { li++; showLine(); } else goTo(idx + 1); }
    });

    // ----- 分享图 -----
    function loadImg(src) { return new Promise(function (ok) { if (!src) return ok(null); var m = new Image(), d = false; function f(v) { if (!d) { d = true; ok(v); } } if (!/^(data:|blob:)/.test(src)) m.crossOrigin = "anonymous"; m.onload = function () { f(m); }; m.onerror = function () { f(null); }; setTimeout(function () { f(null); }, 4000); m.src = src; }); }
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function fit(g, m, x, y, w, h) { var k = Math.max(w / m.width, h / m.height), dw = m.width * k, dh = m.height * k; g.save(); rr(g, x, y, w, h, 28); g.clip(); g.drawImage(m, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); g.restore(); }
    function wrap(g, text, maxW) { var out = []; String(text).split("\n").forEach(function (para) { var l = "", i; for (i = 0; i < para.length; i++) { var ch = para.charAt(i); if (l && g.measureText(l + ch).width > maxW) { out.push(l); l = ch; } else l += ch; } out.push(l); }); return out; }
    async function drawPage(k) {
      var W = 1080, H = 1620, cv = document.createElement("canvas"); cv.width = W; cv.height = H; var g = cv.getContext("2d");
      var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#f8eed6"); bg.addColorStop(1, "#ebd6aa"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = "#8a5a1c"; g.lineWidth = 5; g.strokeRect(34, 34, W - 68, H - 68); g.lineWidth = 2; g.strokeRect(52, 52, W - 104, H - 104);
      g.textBaseline = "alphabetic";
      function head(en, zh) { g.textAlign = "center"; g.fillStyle = "#a3293a"; g.font = "italic 46px " + SERIF; g.fillText(en, W / 2, 150); g.fillStyle = "#7a5a3a"; g.font = "28px " + SANS; g.fillText(zh, W / 2, 200); }
      function block(t, x, y, mw, lh, font, col) { g.font = font; g.fillStyle = col; g.textAlign = "left"; var ls = wrap(g, t, mw); ls.forEach(function (l, i) { g.fillText(l, x, y + i * lh); }); return y + ls.length * lh; }
      async function avatar(src, name, cx, cy, r) {
        var m = await loadImg(src); g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.closePath(); g.clip();
        if (m) { var kk = Math.max(2 * r / m.width, 2 * r / m.height); g.drawImage(m, cx - m.width * kk / 2, cy - m.height * kk / 2, m.width * kk, m.height * kk); }
        else { g.fillStyle = "#6a4a2a"; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); g.fillStyle = "#f3e6c8"; g.font = "bold " + r + "px sans-serif"; g.textAlign = "center"; g.fillText(String(name).slice(0, 1), cx, cy + r * 0.35); }
        g.restore(); g.lineWidth = 6; g.strokeStyle = "#c9535f"; g.beginPath(); g.arc(cx, cy, r + 4, 0, 7); g.stroke();
      }
      if (k === "cover") {
        head("Annual Memoir", "年 度 回 忆 录"); var ci = await loadImg(im.cover);
        if (ci) fit(g, ci, 110, 270, 860, 860); else { g.fillStyle = "#c8202b"; g.beginPath(); g.arc(W / 2, 700, 380, 0, 7); g.fill(); g.fillStyle = "#ffe29a"; g.font = "bold 400px " + KAI; g.textAlign = "center"; g.fillText("福", W / 2, 850); }
        g.textAlign = "center"; g.fillStyle = "#3a2410"; g.font = "bold 76px " + KAI; g.fillText(S.yr + " 年度回忆录", W / 2, 1250); g.font = "36px " + SANS; g.fillStyle = "#7a5a3a"; g.fillText(un + "　×　" + cn, W / 2, 1330);
      } else if (k === "goals") {
        head("Goals", "年 度 成 就");
        ac.forEach(function (a, i) {
          var y = 330 + i * 190; g.strokeStyle = a.ok ? "#4f9d63" : "#b59a78"; g.lineWidth = 5; g.beginPath(); g.arc(150, y, 36, 0, 7); g.stroke();
          if (a.ok) { g.fillStyle = "#4f9d63"; g.font = "bold 48px sans-serif"; g.textAlign = "center"; g.fillText("✓", 150, y + 16); }
          g.textAlign = "left"; g.fillStyle = "#3a2410"; g.font = "46px " + KAI; g.fillText(a.t, 220, y + 16); g.textAlign = "right"; g.fillStyle = "#a3293a"; g.font = "bold 54px " + SERIF; g.fillText(a.d, W - 130, y + 18);
        });
      } else if (k === "id") {
        head("Identity", "身 份 卡"); await avatar(ua, un, W / 2, 380, 130); g.textAlign = "center"; g.fillStyle = "#3a2410"; g.font = "bold 58px " + KAI; g.fillText(un, W / 2, 600);
        var mx = Math.max.apply(null, S.months) || 1;
        S.months.forEach(function (n, i) {
          var cx = 150 + (i % 4) * 260 + 90, cy = 740 + Math.floor(i / 4) * 170, lv = !n ? 0 : n < mx * 0.25 ? 1 : n < mx * 0.6 ? 2 : 3;
          g.strokeStyle = "#b59a78"; g.lineWidth = 3; rr(g, cx - 100, cy - 60, 200, 130, 22); g.stroke();
          if (lv) { g.fillStyle = ["", "#f0b79e", "#e2573a", "#a8331f"][lv]; g.beginPath(); g.arc(cx, cy - 6, 14 + lv * 8, 0, 7); g.fill(); }
          g.fillStyle = "#7a5a3a"; g.font = "26px " + SANS; g.textAlign = "center"; g.fillText((i + 1) + "月 · " + n, cx, cy + 52);
        });
        g.font = "38px " + KAI; var yy = block(C.cal, 130, 1330, W - 260, 58, "38px " + KAI, "#3a2410");
      } else if (k === "memory") {
        head("Memory", "一 段 回 忆"); var mi = await loadImg(im.memory), y1 = 270;
        if (mi) { fit(g, mi, 110, 270, 860, 560); y1 = 900; } else y1 = 330;
        g.textAlign = "center"; g.fillStyle = "#a3293a"; g.font = "bold 54px " + KAI; g.fillText(C.mem.title, W / 2, y1); block(C.mem.text, 130, y1 + 80, W - 260, 62, "38px " + KAI, "#3a2410");
      } else if (k === "notes") {
        head("Notebooks", "双 向 记 事 本"); var y2 = 290;
        [[cn + " 记下的你", C.notes.ta], ["你眼中的 " + cn, C.notes.me]].forEach(function (sec) {
          g.textAlign = "left"; g.fillStyle = "#a3293a"; g.font = "bold 44px " + KAI; g.fillText(sec[0], 130, y2); y2 += 30;
          sec[1].forEach(function (t) { g.strokeStyle = "rgba(90,58,24,.3)"; g.lineWidth = 2; y2 += 70; g.beginPath(); g.moveTo(130, y2 + 14); g.lineTo(W - 130, y2 + 14); g.stroke(); g.fillStyle = "#3a2410"; g.font = "36px " + KAI; g.textAlign = "left"; g.fillText(t, 140, y2); }); y2 += 90;
        });
        if (S.excerpt) block("“" + S.excerpt + "”\n—— " + cn + " 说过", 150, y2 + 20, W - 300, 56, "34px " + KAI, "#7a2418");
      } else if (k === "stats") {
        head("Chat", "通 讯 统 计");
        if (!S.total) { g.textAlign = "center"; g.fillStyle = "#7a5a3a"; g.font = "40px " + KAI; g.fillText("还没有聊天记录", W / 2, 700); }
        else {
          [[S.total, "句话"], [S.activeDays, "天"], [S.streak, "天连续"]].forEach(function (n, i) { var cx = 220 + i * 320; g.textAlign = "center"; g.fillStyle = "#a3293a"; g.font = "bold 96px " + SERIF; g.fillText(n[0], cx, 380); g.fillStyle = "#7a5a3a"; g.font = "30px " + SANS; g.fillText(n[1], cx, 430); });
          g.fillStyle = "#7a5a3a"; g.font = "32px " + SANS; g.textAlign = "center"; g.fillText("你 " + S.me + "　·　" + cn + " " + S.ta + (S.best ? "　·　最热闹：" + S.best.label : ""), W / 2, 520);
          var cy2 = 600; S.sample.slice(0, 6).forEach(function (m) {
            g.font = "34px " + SANS; var ls = wrap(g, m.x, 560), bw = Math.min(640, Math.max.apply(null, ls.map(function (l) { return g.measureText(l).width; })) + 60), bh = ls.length * 48 + 34, bx = m.me ? W - 130 - bw : 130;
            g.fillStyle = m.me ? "#e2573a" : "#fff8e6"; rr(g, bx, cy2, bw, bh, 26); g.fill(); g.fillStyle = m.me ? "#fff6ec" : "#3a2410"; g.textAlign = "left"; ls.forEach(function (l, i) { g.fillText(l, bx + 30, cy2 + 50 + i * 48); }); cy2 += bh + 26;
          });
        }
      } else if (k === "letter") {
        head("Letter", "手 写 信"); var len = C.letter.join("").length, fs = len > 380 ? 30 : 34, y3 = 300;
        C.letter.forEach(function (p) { y3 = block(p, 130, y3, W - 260, fs * 1.65, fs + "px " + KAI, "#3a2410") + 24; });
        g.textAlign = "right"; g.fillStyle = "#a3293a"; g.font = "38px " + KAI; g.fillText("—— " + cn, W - 130, y3 + 30);
      }
      g.textAlign = "center"; g.fillStyle = "#9a7a55"; g.font = "22px " + SANS; g.fillText(S.yr + " 年度回忆录 · " + un + " × " + cn, W / 2, H - 76);
      return cv.toDataURL("image/png");
    }
    function sharePreview() {
      var SH = SF.layer(SF.appRoot, "分享图预览", { full: true, k: "MEMOIR", key: "memoirShare" }); if (!SH) return;
      var keys = KEYS.slice(0, 7), imgs = [];
      SH.body.innerHTML = '<p class="tip sfm-sp">生成中 0/' + keys.length + "…</p>";
      (async function () {
        for (var i = 0; i < keys.length; i++) {
          if (!SH.alive) return;
          try { imgs.push(await drawPage(keys[i])); } catch (err) { console.warn(err); }
          var t = SH.body.querySelector(".sfm-sp"); if (t) t.textContent = "生成中 " + (i + 1) + "/" + keys.length + "…";
        }
        if (!SH.alive) return;
        SH.body.innerHTML = '<p class="tip">左右滑动查看，长按图片可单张保存。</p><div class="sfm-sw">' + imgs.map(function (u) { return '<img src="' + u + '" alt="">'; }).join("") + '</div><button class="sfb block" style="margin-top:14px" data-a="all" type="button">保存 / 分享全部</button>';
        SH.body.querySelector('[data-a="all"]').onclick = async function () {
          try {
            var files = await Promise.all(imgs.map(function (u, i) { return fetch(u).then(function (r) { return r.blob(); }).then(function (b) { return new File([b], "年度回忆录-" + (i + 1) + ".png", { type: "image/png" }); }); }));
            if (navigator.canShare && navigator.canShare({ files: files })) { await navigator.share({ files: files }); return; }
          } catch (err) { if (err && err.name === "AbortError") return; }
          imgs.forEach(function (u, i) { var a = document.createElement("a"); a.href = u; a.download = "年度回忆录-" + (i + 1) + ".png"; document.body.appendChild(a); a.click(); a.remove(); });
          SF.toast("没有自动保存的话，请长按图片逐张保存");
        };
      })();
    }

    fill(); reset(); info();
    requestAnimationFrame(function () { requestAnimationFrame(function () { V.classList.add("in"); }); });
  }

  SF.memoir = {
    open: openMenu,
    refreshBadge: refreshBadge,
    clearAll: async function () {
      var cs = await SF.chars(); for (var i = 0; i < cs.length; i++) { await clearKeys(cs[i].id); await SF.st.del(SK(cs[i].id)); await SF.st.del("memoir_pos_" + cs[i].id); }
      SF.ls.set("memoir_ready", []); refreshBadge();
    }
  };

  SF.cssApp.push(`
.sf-spot.ready::after{content:"";position:absolute;right:12%;top:6%;width:14px;height:14px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 0 3px rgba(255,255,255,.7);animation:sfGlow 1.6s ease-in-out infinite}
.sfm{--bh:calc(150px + env(safe-area-inset-bottom));position:absolute;inset:0;display:flex;flex-direction:column;background:#2a1a14;color:#3a2410;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;opacity:0;transition:opacity .35s;-webkit-user-select:none;user-select:none}
.sfm.in{opacity:1}.sfm *{box-sizing:border-box}
.sfm-bgd{position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,#5a2a22,#1c100c);overflow:hidden}
.sfm-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#ffe29a;animation:sfmTw 3s ease-in-out infinite}
@keyframes sfmTw{0%,100%{opacity:.15}50%{opacity:.95}}
.sfm.nofx .sfm-star{display:none}
.sfm-top{position:absolute;left:0;right:0;top:0;z-index:8;display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 14px 0;pointer-events:none}
.sfm-top button{pointer-events:auto;width:36px;height:36px;padding:0;border-radius:50%;border:1px solid rgba(255,215,122,.5);background:rgba(36,10,20,.55);color:#ffd77a;font-size:14px}
.sfm-cnt{font-size:12px;letter-spacing:.2em;color:rgba(255,243,220,.75)}
.sfm-stage{position:absolute;left:0;right:0;top:0;bottom:var(--bh);perspective:1500px;overflow:hidden;touch-action:pan-y}
.sfm-L{position:absolute;left:12px;right:12px;top:calc(54px + env(safe-area-inset-top));bottom:6px;border-radius:6px 16px 16px 6px;background:linear-gradient(180deg,#f8eed6,#efdcb4);box-shadow:0 8px 28px rgba(0,0,0,.5);backface-visibility:hidden;-webkit-backface-visibility:hidden;transform-origin:0 50%;overflow:hidden}
.sfm-L::before{content:"";position:absolute;left:0;top:0;bottom:0;width:16px;z-index:2;background:radial-gradient(circle at 7px 10px,#6a4a2a 0 3px,transparent 3.5px) 0 0/16px 26px repeat-y,linear-gradient(90deg,rgba(120,80,30,.35),transparent)}
.sfm-L .in{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px 18px 24px 30px}
.sfm-sh{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;background:linear-gradient(90deg,rgba(50,25,8,.75),rgba(50,25,8,0) 70%)}
.sfm-hd{text-align:center;margin-bottom:14px}.sfm-hd small{display:block;font:italic 13px Georgia,serif;letter-spacing:.3em;color:#a3293a}.sfm-hd b{font:600 22px/1.4 "Songti SC","STSong",serif;letter-spacing:.3em;color:#3a2410}
.sfm-cv{text-align:center;padding-top:10px}.sfm-cv small{font:italic 13px Georgia,serif;letter-spacing:.3em;color:#a3293a}.sfm-cv h2{margin:8px 0 16px;font:600 26px "Songti SC","STSong",serif;letter-spacing:.12em;color:#3a2410}
.sfm-cvi{width:78%;max-width:300px;aspect-ratio:1;margin:0 auto 16px;border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(80,40,10,.4)}.sfm-cvi img{width:100%;height:100%;object-fit:cover;display:block}
.sfm-fu{display:flex;align-items:center;justify-content:center;border-radius:50%;background:#c8202b;color:#ffe29a;font:700 120px/1 "STKaiti","KaiTi",serif}
.sfm-cv p{margin:0;font-size:16px;color:#7a5a3a;letter-spacing:.1em}.sfm-cv em{display:block;margin-top:14px;font-style:normal;font-size:12px;color:#9a7a55}
.sfm-g{display:flex;align-items:center;gap:12px;padding:13px 2px;border-bottom:1px dashed rgba(90,58,24,.35)}
.sfm-g i{flex:0 0 24px;height:24px;border-radius:50%;border:2px solid #b59a78;font-style:normal;text-align:center;font-size:14px;line-height:20px;color:#fff}.sfm-g.ok i{background:#4f9d63;border-color:#4f9d63}
.sfm-g span{flex:1;font:17px "STKaiti","KaiTi",serif}.sfm-g b{font:700 20px Georgia,serif;color:#a3293a}
.sfm-id{text-align:center}.sfm-ia{width:84px;height:84px;margin:0 auto 8px;border-radius:50%;overflow:hidden;border:3px solid #c9535f;background:#6a4a2a;color:#f3e6c8;font-size:34px;line-height:78px}.sfm-ia img{width:100%;height:100%;object-fit:cover;display:block}
.sfm-id b{display:block;font:600 20px "STKaiti","KaiTi",serif}.sfm-id small{font-size:11px;color:#9a7a55;letter-spacing:.2em}
.sfm-mg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}
.sfm-mo{text-align:center;padding:8px 0 6px;border:1px solid rgba(90,58,24,.3);border-radius:10px}.sfm-mo i{display:block;width:10px;height:10px;margin:2px auto 4px;border-radius:50%;background:transparent}
.sfm-mo.l1 i{background:#f0b79e;width:14px;height:14px}.sfm-mo.l2 i{background:#e2573a;width:18px;height:18px}.sfm-mo.l3 i{background:#a8331f;width:22px;height:22px}
.sfm-mo b{display:block;font-size:12px;font-weight:500}.sfm-mo small{font-size:10px;color:#9a7a55}
.sfm-cal{padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.55);font-size:14px;line-height:1.7;color:#5a2a14}
.sfm-mi{border-radius:12px;overflow:hidden;margin-bottom:14px;box-shadow:0 4px 14px rgba(80,40,10,.35)}.sfm-mi img{display:block;width:100%}
.sfm-mt{margin:0 0 8px;text-align:center;font:600 20px "STKaiti","KaiTi",serif;color:#a3293a}.sfm-mp{margin:0;font:16px/1.9 "STKaiti","KaiTi",serif;color:#3a2410}
.sfm-nb{margin-bottom:14px}.sfm-nb b{display:block;margin-bottom:4px;font:600 16px "STKaiti","KaiTi",serif;color:#a3293a}
.sfm-nb p{margin:0;padding:7px 2px;border-bottom:1px solid rgba(90,58,24,.28);font:15px "STKaiti","KaiTi",serif}
.sfm-ex{padding:12px 14px;border-radius:10px;background:rgba(255,255,255,.55);font:15px/1.8 "STKaiti","KaiTi",serif;color:#7a2418}.sfm-ex small{display:block;margin-top:4px;text-align:right;font-size:11px;color:#9a7a55}
.sfm-nums{display:flex;justify-content:space-around;text-align:center}.sfm-nums b{display:block;font:700 34px Georgia,serif;color:#a3293a}.sfm-nums small{font-size:11px;color:#7a5a3a}
.sfm-bar2{height:8px;margin:14px 0 4px;border-radius:4px;background:#f0b79e;overflow:hidden}.sfm-bar2 i{display:block;height:100%;background:#a8331f}
.sfm-bl{display:flex;justify-content:space-between;margin:0;font-size:12px;color:#7a5a3a}
.sfm-chat{display:flex;flex-direction:column;gap:6px}.sfm-cb{align-self:flex-start;max-width:78%;padding:7px 12px;border-radius:14px;background:#fff8e6;font-size:13px;line-height:1.5}.sfm-cb.me{align-self:flex-end;background:#e2573a;color:#fff6ec}
.sfm-lt p{margin:0 0 12px;font:16px/1.95 "STKaiti","KaiTi",serif;color:#3a2410}.sfm-lt em{display:block;text-align:right;font-style:normal;font:17px "STKaiti","KaiTi",serif;color:#a3293a}
.sfm-end{display:flex;flex-direction:column;gap:12px;margin-top:26px}
.sfm-bar{position:absolute;left:0;right:0;bottom:0;height:var(--bh);z-index:7;display:flex;gap:10px;align-items:flex-start;padding:12px 14px calc(12px + env(safe-area-inset-bottom))}
.sfm-av{flex:0 0 54px;height:54px;border-radius:50%;overflow:hidden;border:2px solid #ffd77a;background:#6a4a2a;color:#f3e6c8;font-size:22px;line-height:50px;text-align:center}.sfm-av img{width:100%;height:100%;object-fit:cover;display:block}
.sfm-bub{position:relative;flex:1;min-width:0;height:100%;padding:8px 12px 24px;border-radius:14px;background:#fff8e6;color:#4a1a12;overflow:hidden}
.sfm-bub small{display:block;font-size:11px;color:#a3293a}.sfm-bub p{margin:2px 0 0;font-size:14px;line-height:1.65;min-height:44px}
.sfm-nx{position:absolute;right:10px;bottom:4px;font-style:normal;color:#a3293a;animation:sfmBl 1.1s ease-in-out infinite}.sfm-bub.end .sfm-nx::after{content:" 下一页"}
@keyframes sfmBl{50%{opacity:.3}}
.sfm-pl{position:absolute;left:10px;bottom:4px;padding:3px 10px;border:1px solid #c9535f;border-radius:12px;background:transparent;color:#a3293a;font-size:11px}.sfm.snd .sfm-pl{background:#a3293a;color:#fff}
.sfm-sw{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 20px 8px;margin:0 -20px;scrollbar-width:none}.sfm-sw::-webkit-scrollbar{display:none}
.sfm-sw img{flex:0 0 78%;max-width:340px;scroll-snap-align:center;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35)}
@media (prefers-reduced-motion:reduce){.sfm-star,.sfm-nx{animation:none}}
`);
})(window.__SF);

/* 自制春晚 v1.8：排节目单 → 3D 剧院选座位 → 头像上台表演（走位 + 特效）→ 弹幕 / 偷跑吐槽 / 角色反应 → 存档回看。
 * 剧院是代码里的真 3D 透视（没有图片）：墙上的字、观众、椅子都贴在剧院里，视角变了会一起歪。
 * 想加预设节目：往 PRESET 里加 { name, kind, n(演员数), blurb, L:[[演员序号,"台词","特效(可省)"],...] }，台词里 {0} {1} 会换成演员名。
 * 想加路人弹幕：往 NPC 里加句子。特效名见下面 CUES。 */
(function (SF) {
  "use strict";

  var KINDS = ["歌舞", "相声", "小品", "戏曲", "魔术", "朗诵", "武术", "合唱"];
  var KIND_COL = { "歌舞": [255, 170, 190], "相声": [255, 225, 170], "小品": [255, 210, 150], "戏曲": [255, 160, 140], "魔术": [170, 150, 255], "朗诵": [200, 225, 255], "武术": [255, 190, 120], "合唱": [255, 215, 150] };
  // 特效暗号：face 变脸 / swap 大变活人 / vanish 消失 / appear 出现 / lion 舞狮 / ribbon 红绸 / sleeve 水袖 / sword 舞剑 / fireworks 烟花
  // notes 音符 / gavel 惊堂木 / flash 闪光 / spin 旋转 / grow 放大 / slip 失误 / dash 冲刺 / freeze 亮相定格 / dim 灯光变暗 / spot 单人追光
  var CUES = { face: 1, swap: 1, vanish: 1, appear: 1, lion: 1, ribbon: 1, sleeve: 1, sword: 1, fireworks: 1, notes: 1, gavel: 1, flash: 1, spin: 1, grow: 1, slip: 1, dash: 1, freeze: 1, dim: 1, spot: 1 };
  var ALIAS = { "变脸": "face", "大变活人": "swap", "变活人": "swap", "消失": "vanish", "出现": "appear", "舞狮": "lion", "狮": "lion", "红绸": "ribbon", "绸": "ribbon", "水袖": "sleeve", "袖": "sleeve", "舞剑": "sword", "舞棍": "sword", "剑": "sword", "棍": "sword", "刀": "sword", "烟花": "fireworks", "音符": "notes", "唱": "notes", "惊堂木": "gavel", "拍": "gavel", "闪光": "flash", "旋转": "spin", "转": "spin", "放大": "grow", "缩小": "grow", "失误": "slip", "摔": "slip", "冲刺": "dash", "跑": "dash", "定格": "freeze", "亮相": "freeze", "变暗": "dim", "追光": "spot" };
  var FXD = { face: 2.6, swap: 3.4, vanish: 1.8, appear: 1.2, lion: 4.2, ribbon: 3.2, sleeve: 2.6, sword: 2.6, fireworks: 3, notes: 2.8, gavel: 1, flash: 0.6, spin: 1.4, grow: 1.2, slip: 1.6, dash: 1.6, freeze: 1.8, dim: 2.5, spot: 3 };
  var HEAVY = { face: 1, swap: 1, vanish: 1, appear: 1, lion: 1, spin: 1, grow: 1, slip: 1, dash: 1, freeze: 1 };

  var PRESET = [
    { name: "新春大联唱", kind: "合唱", n: 3, blurb: "锣鼓一响，大家一起唱新年", L: [[0, "新年好呀，大家好呀！", "notes"], [1, "锣鼓敲起来，歌声唱起来！"], [2, "祝大家新的一年平安喜乐！"], [0, "我先来领唱第一句——"], [1, "哎，这句好像跑调了？"], [2, "没事，气氛到位就行！"], [0, "来，大家一起，福气满满！"], [1, "{2}唱得最大声，我听见了！"]] },
    { name: "拜年相声", kind: "相声", n: 2, blurb: "见面第一句，到底该说什么", L: [[0, "今天给大伙儿说段拜年的相声。"], [1, "拜年？我可是行家。"], [0, "那你说说，见了长辈头一句说什么？"], [1, "新年好，红包拿来！"], [0, "嘿，你这不是拜年，是打劫！", "gavel"], [1, "这叫开门见喜。"], [0, "那见了同辈呢？"], [1, "互相拜年，互相红包，互不吃亏。"]] },
    { name: "年夜饭风波", kind: "小品", n: 3, blurb: "饺子全煮破了，谁的锅", L: [[0, "哎呀，年夜饭的饺子怎么全煮破了？"], [1, "不是我，是{2}抢着下的锅！"], [2, "我只是想帮忙，谁知道火那么大……", "slip"], [0, "算了算了，破了也是福气，叫“开口笑”。"], [1, "那这锅汤叫什么？"], [2, "叫“福到汤”！"], [0, "行行行，快端上桌吧。"], [1, "团圆饭，吃的就是热闹。"]] },
    { name: "神奇的红包", kind: "魔术", n: 2, blurb: "空红包里变出好运", L: [[0, "各位请看，我手里是一个空红包。", "dim"], [1, "空的？让我检查一下。"], [0, "没问题。三、二、一——", "vanish"], [0, "变！红包里出现了满满的好运。", "appear"], [1, "这也行？再变一个！"], [0, "今天只送好运，不送大钞哦。", "flash"]] },
    { name: "大变活人", kind: "魔术", n: 2, blurb: "红布一盖，人到哪儿去了", L: [[0, "接下来，请看大变活人！", "dim"], [1, "我来当那个被变的。"], [0, "请大家看好，红布一盖——", "swap"], [0, "三、二、一，人呢？"], [1, "我在这儿！"], [0, "这才是真正的“人间蒸发”。", "fireworks"]] },
    { name: "元日", kind: "朗诵", n: 1, blurb: "一首应景的古诗", L: [[0, "爆竹声中一岁除，春风送暖入屠苏。"], [0, "千门万户曈曈日，总把新桃换旧符。"], [0, "愿新的一年，山河无恙，人间皆安。"]] },
    { name: "舞狮闹春", kind: "武术", n: 2, blurb: "一个狮头一个狮尾，配合是关键", L: [[0, "锣鼓一响，狮子上场啦！"], [1, "我来当狮头，你来当狮尾，配合好了才好看。", "lion"], [0, "别踩我脚！"], [1, "稳住稳住，跳！"], [0, "哇，这一跳真漂亮！"], [1, "狮子吃青，大吉大利！"]] },
    { name: "刀光剑影", kind: "武术", n: 2, blurb: "点到为止的切磋", L: [[0, "今日切磋，点到为止！"], [1, "好说，请赐教！", "sword"], [0, "看招！"], [1, "太慢了！"], [0, "那你接这一式！", "dash"], [1, "承让，我们握手言和吧。"]] },
    { name: "龙凤呈祥", kind: "歌舞", n: 2, blurb: "红绸翻飞的双人舞", L: [[0, "红绸一展，龙凤起舞！", "ribbon"], [1, "这支舞，我们练了整整一个冬天。"], [0, "转圈的时候千万别晕。"], [1, "晕了就当是喝多了喜酒。", "spin"], [0, "来，最后一个造型——"], [1, "龙凤呈祥，万事顺意！"]] },
    { name: "灯谜擂台", kind: "小品", n: 2, blurb: "台上出谜，台下猜", L: [[0, "来，我出一道灯谜：一口咬掉牛尾巴。"], [1, "这个我知道，是个“告”字！"], [0, "可以呀，再来一道：人在草木中。"], [1, "是“茶”！"], [0, "全对！今晚这壶茶，我请了。"], [1, "那我再加一句：新年快乐！"]] },
    { name: "戏韵新春", kind: "戏曲", n: 2, blurb: "一段亮嗓开场的小戏", L: [[0, "（亮嗓）咿——呀——新春到！", "sleeve"], [1, "好嗓子！台下已经有人喊好了。"], [0, "唱戏讲究字正腔圆。", "freeze"], [1, "我这叫腔圆字不正。"], [0, "那也行，热闹就好！"], [1, "祝大家岁岁平安，年年有余！"]] },
    { name: "川剧变脸", kind: "戏曲", n: 1, blurb: "一甩一换，变脸绝活", L: [[0, "今天给大家变个脸。"], [0, "一变，红脸关公！", "face"], [0, "再变，蓝脸窦尔敦！"], [0, "最后一变，笑脸迎新春！", "flash"]] }
  ];
  var NPC = ["哈哈哈哈", "前排就坐，爆米花备好了", "这个好看！", "笑死我了", "太会了", "啊啊啊啊", "我妈刚才还在问这是谁", "年年有这个就好了", "这灯光绝了", "鼓掌鼓掌", "后排看得见！", "666", "主持人呢", "新年快乐！", "这才是过年", "再来一个再来一个", "我先拍照", "快看快看", "好家伙", "这段我能看十遍", "台上好热闹", "笑到打鸣", "前方高能", "过年就该这样", "节目单我收藏了", "瓜子递我一把"];
  var NPC_AP = ["好！", "精彩！", "再来一个！", "太棒了", "鼓掌！", "绝了", "喝彩！", "好好好"];
  var CDAN = ["好看！", "这段太棒了", "笑死我了", "鼓掌！", "继续继续", "我也想上去", "台词记得真熟", "别紧张！"];
  var JABS = ["哎哟，又手滑了吧", "这个失误我能笑一年", "我没看错吧？", "稳住稳住，别慌"];
  var REPLY = ["嘘，别拆穿他。", "你小声点，他听得见。", "哈哈，我什么都没说。"];
  var HYPE = ["下一个节目我超期待！", "快快快，下一个是谁？", "我押下一个会更精彩"];
  var CHATS = [["刚才那段你看懂了吗？", "没看懂，但我鼓掌了。"], ["他昨晚还在偷偷练呢。", "嘘，别拆穿他。"], ["这个节目比彩排时强多了。", "彩排时你都睡着了吧？"]];
  var SNEAK = ["嘘——我偷偷溜过来的，别告诉导演。", "我还没上场，紧张得手心都出汗了。", "这个节目我彩排看过，笑点在后面。", "台上那几个，私下排练可认真了。", "借你旁边的座位躲一会儿，行吗？", "我刚下台，腿还在抖，让我坐会儿。"];

  // ---------- 小工具 ----------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ease(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function back(x) { x = clamp(x, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clean(t, n) { return String(t == null ? "" : t).trim().replace(/^["“「]|["”」]$/g, "").slice(0, n || 40); }
  function loadImg(url) {
    return new Promise(function (res) {
      if (!url) { res(null); return; }
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = url;
      setTimeout(function () { res(null); }, 2500);
    });
  }
  function rrect(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function idByName(roster, name) {
    name = String(name || "").trim(); if (!name) return null;
    var i, r;
    for (i = 0; i < roster.length; i++) if (roster[i].name === name) return roster[i].id;
    for (i = 0; i < roster.length; i++) { r = roster[i]; if (name.indexOf(r.name) >= 0 || r.name.indexOf(name) >= 0) return r.id; }
    return null;
  }
  function nameIn(roster, id) { for (var i = 0; i < roster.length; i++) if (roster[i].id === id) return roster[i].name; return "TA"; }
  function normCue(s) {
    s = String(s || "").trim().toLowerCase(); if (!s || s === "none" || s === "无") return null;
    if (CUES[s]) return s; if (ALIAS[s]) return ALIAS[s];
    for (var k in ALIAS) if (s.indexOf(k) >= 0) return ALIAS[k];
    return "flash";
  }
  function voiceBase(id) { return 260 + hash(id) % 220; }
  var VOICE = [1, 1.122, 1.26, 1.5, 1.68, 2], VOICE_HI = [1.5, 1.68, 2, 2.24], TONEW = /[啊呀吧呢哦嘛啦哇哼嗯哎诶咦喂嘿呐]/, STOP = /[，。！？!?,.…~、；：（）()“”"]/;

  // ---------- 座位 / 剧院尺寸 ----------
  var ROWS = 9, COLS = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6], SX = 0.95, Z0 = 3.6, RZ = 1.1, RY = 0.26;
  var BOX = { BL: { n: "二楼左包厢", p: [-7.4, 4.3, 5] }, BR: { n: "二楼右包厢", p: [7.4, 4.3, 5] }, UM: { n: "二楼正中", p: [0, 5.4, 15] } };
  function yf(z) { return Math.min(2.35, Math.max(0, (z - (Z0 - 0.575)) * RY / RZ)); }
  function eyeOf(key) {
    if (BOX[key]) return BOX[key].p.slice();
    var a = String(key).split(","), r = +a[0], c = +a[1], z = Z0 + r * RZ;
    return [c * SX, yf(z) + 1.15, z];
  }
  function slotsX(n) { var sp = n <= 1 ? 0 : Math.min(3.6, 9 / (n - 1)), a = []; for (var i = 0; i < n; i++) a.push((i - (n - 1) / 2) * sp); return a; }
  function layout(kind, n) {
    var xs = [], i;
    if (kind === "相声" && n === 2) return [-1.7, 1.7];
    if (kind === "小品") { for (i = 0; i < n; i++) xs.push((i % 2 ? 1 : -1) * (3.4 + (i >> 1) * 1.8)); return xs; }
    if (kind === "合唱") { var sp = n <= 1 ? 0 : Math.min(3.1, 9 / (n - 1)); for (i = 0; i < n; i++) xs.push((i - (n - 1) / 2) * sp); return xs; }
    return slotsX(n);
  }
  // 每句台词自动带的特效（台词自己写了特效就用台词的）
  function autoFx(p, j, L) {
    var k = p.kind, n = p.name || "", nc = p.cast.length;
    if (/狮/.test(n) && nc > 1) return j === 1 ? "lion" : null;
    if (/变脸/.test(n)) return j === 1 ? "face" : null;
    if (/大变活人/.test(n) && nc > 1) return j === 2 ? "swap" : null;
    if (k === "歌舞") return j % 3 === 0 ? "spin" : (j % 3 === 1 ? "ribbon" : null);
    if (k === "相声") return j % 5 === 4 ? "gavel" : null;
    if (k === "戏曲") return j === 0 ? "sleeve" : (j % 3 === 2 ? "freeze" : null);
    if (k === "魔术") return j === 0 ? "dim" : j === 1 ? "flash" : j === 2 ? "vanish" : j === 3 ? "appear" : (j === L - 2 && nc > 1 ? "swap" : (j === L - 1 ? "fireworks" : null));
    if (k === "朗诵") return j === L - 1 ? "notes" : "spot";
    if (k === "武术") return j % 2 === 0 ? "dash" : (j % 4 === 1 ? "sword" : null);
    if (k === "合唱") return j % 3 === 0 ? "notes" : null;
    return null;
  }

  // ---------- 预设内容 ----------
  function linesFor(p, roster) {
    var tpl = null;
    if (p.pr != null && p.pr >= 0 && PRESET[p.pr]) tpl = PRESET[p.pr].L;
    var n = p.cast.length || 1, b = n > 1 ? 1 : 0;
    if (!tpl) tpl = [[0, "接下来这个节目，是大家点的——《" + p.name + "》！"], [b, "点播的节目，必须拿出真本事。"], [0, "准备好了吗？三、二、一！"], [b, "（全场屏住呼吸）"], [0, "好了，效果大家都看到了，是不是很惊喜？"], [b, "祝大家新年快乐，万事如意！"]];
    return tpl.map(function (x) {
      var k = x[0] % n;
      return { w: p.cast[k], t: x[1].replace(/\{(\d)\}/g, function (m, d) { return nameIn(roster, p.cast[(+d) % n]); }), fx: x[2] || null };
    });
  }
  function presetOutline(roster, st) {
    var ids = roster.map(function (c) { return c.id; }), ptr = 0, progs = [], pitch = st.pitch.slice(0, 3);
    function pickCast(k) { var a = []; for (var i = 0; i < k; i++) a.push(ids[(ptr + i) % ids.length]); ptr += k; return a; }
    pitch.forEach(function (nm) { progs.push({ name: nm, kind: "小品", cast: pickCast(Math.min(2, ids.length)), blurb: "观众点播的节目", pr: -1 }); });
    var order = shuffle(PRESET.map(function (_, i) { return i; }));
    for (var q = 0; progs.length < st.n && q < order.length; q++) {
      var pr = PRESET[order[q]];
      progs.push({ name: pr.name, kind: pr.kind, cast: pickCast(Math.min(pr.n, ids.length)), blurb: pr.blurb, pr: order[q] });
    }
    return { title: "新春大联欢", programs: progs.slice(0, Math.max(st.n, pitch.length)) };
  }
  function presetScript(roster, d) {
    var rs = roster.map(function (c) { return { id: c.id, name: SF.cname(c) }; });
    return {
      id: Date.now(), t: Date.now(), mode: "preset", title: d.title || "新春大联欢", roster: rs, mine: [],
      programs: d.programs.map(function (p) {
        var others = rs.filter(function (r) { return p.cast.indexOf(r.id) < 0; }), pool = others.length ? others : rs, lines = linesFor(p, rs);
        var dan = shuffle(others).slice(0, 2).map(function (r, q) {
          var o = { w: r.id, t: SF.pick(CDAN) };
          if (q === 0 && rs.length > 2 && Math.random() < 0.5) { var rr = SF.pick(rs.filter(function (x) { return x.id !== r.id; })); o.re = { w: rr.id, t: SF.pick(REPLY) }; }
          return o;
        });
        var sn = SF.pick(pool), lg = SF.pick(pool), slipJ = -1;
        lines.forEach(function (l, j) { if (l.fx === "slip") slipJ = j; });
        var ct = SF.pick(CHATS), c1 = SF.pick(rs), c2 = SF.pick(rs.filter(function (x) { return x.id !== c1.id; }).concat(rs.length < 2 ? [c1] : []));
        return {
          name: p.name, kind: p.kind, blurb: p.blurb, cast: p.cast.slice(), lines: lines, dan: dan, sneak: { w: sn.id, t: SF.pick(SNEAK) },
          laugh: [{ w: lg.id, at: Math.floor(lines.length / 2) }], jab: slipJ >= 0 ? { w: SF.pick(pool).id, t: SF.pick(JABS) } : null,
          hype: { w: SF.pick(pool).id, t: SF.pick(HYPE) }, chat: [{ w: c1.id, t: ct[0] }, { w: c2.id, t: ct[1] }]
        };
      })
    };
  }

  // ---------- AI ----------
  function brief(c, n) { return SF.cname(c) + "（" + SF.persona(c).slice(0, n).replace(/\s+/g, " ") + "）"; }
  async function aiOutline(roster, st) {
    var me = await SF.userName();
    var usr = "观众叫「" + me + "」。演员（只能从这些人里选）：\n" + roster.map(function (c) { return "- " + brief(c, 120); }).join("\n") +
      "\n\n请排一台新春晚会，共 " + st.n + " 个节目，节目类型从 [" + KINDS.join("、") + "] 里选，尽量不重复；每个节目安排 1 到 3 位演员，每位演员至少上台一次，安排要符合各自性格。" +
      (st.pitch.length ? "观众想看的节目（必须包含）：" + st.pitch.join("、") + "。" : "") +
      "只输出 JSON：{\"title\":\"晚会标题(8字内)\",\"programs\":[{\"name\":\"节目名(8字内)\",\"kind\":\"类型\",\"cast\":[\"演员名\"],\"blurb\":\"一句话看点(20字内)\"}]}";
    var j = SF.parseJson(await SF.ai("你是春晚总导演，熟悉每位演员的性格。", usr, 0.9));
    if (!j || !Array.isArray(j.programs) || !j.programs.length) throw new Error("没有拿到节目单，请再试一次");
    var rs = roster.map(function (c) { return { id: c.id, name: SF.cname(c) }; }), ptr = 0;
    var progs = j.programs.slice(0, Math.max(st.n, st.pitch.length)).map(function (p) {
      var cast = (Array.isArray(p.cast) ? p.cast : []).map(function (n) { return idByName(rs, n); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 3);
      if (!cast.length) { cast = [rs[ptr % rs.length].id]; ptr++; }
      var kind = KINDS.indexOf(p.kind) >= 0 ? p.kind : "小品";
      return { name: clean(p.name, 10) || "新春节目", kind: kind, cast: cast, blurb: clean(p.blurb, 24), pr: -1 };
    });
    return { title: clean(j.title, 10) || "新春大联欢", programs: progs };
  }
  async function aiScript(roster, d) {
    var me = await SF.userName(), rs = roster.map(function (c) { return { id: c.id, name: SF.cname(c) }; });
    var sys = "你是春晚编剧，要让每位演员的台词和反应都符合各自的人设。演员资料：\n" + roster.map(function (c) { return "- " + brief(c, 300); }).join("\n");
    var usr = "观众叫「" + me + "」。节目单：\n" + d.programs.map(function (p, i) {
      return (i + 1) + ". 《" + p.name + "》（" + p.kind + "，演员：" + p.cast.map(function (id) { return nameIn(rs, id); }).join("、") + "）看点：" + (p.blurb || "无");
    }).join("\n") +
      "\n\n请为每个节目写完整演出内容，字段如下：\n" +
      "1) lines：8 到 12 句 {who,text,fx}。who 只能是该节目演员名；口语化，每句 30 字以内，有笑点或温情，不要报幕。fx 是这一句配的舞台特效，大多数句子留空，只在剧情需要时从这些里选一个：" +
      "face(川剧变脸)、swap(大变活人，需要 2 位演员)、vanish(消失)、appear(出现)、lion(舞狮，需要 2 位演员)、ribbon(红绸)、sleeve(水袖)、sword(舞剑)、fireworks(烟花)、notes(音符)、gavel(惊堂木)、flash(闪光)、spin(旋转)、grow(放大)、slip(表演失误)、dash(快速冲刺)、freeze(亮相定格)、dim(灯光变暗)、spot(单人追光)。魔术节目可以用 swap/vanish/appear，舞狮节目用 lion，变脸节目用 face，要有表演失误的桥段就写 slip。\n" +
      "2) dan：3 到 4 条弹幕 {who,text,re}。who 只能是没有参加该节目的演员名（没有就写空数组），每条 14 字以内，是台下的吐槽或起哄；可以有 1 条带 re:{who,text}，是另一位演员接着回的一句（例如“嘘，别拆穿他”），who 是别的演员。\n" +
      "3) sneak：{who,text}，who 是还没上台或已经下台的演员（可以不是该节目演员），内容是他偷偷溜到观众席旁边，对观众小声说的话，30 字以内。\n" +
      "4) laugh：1 到 2 项 {who,at}，who 是没参加该节目的演员，at 是他笑场时对应的台词序号（从 0 开始）。\n" +
      "5) jab：{who,text}，只有 lines 里安排了 slip 时才写，who 是没参加该节目的演员，text 是他在弹幕里调侃失误的一句，14 字以内；否则写 null。\n" +
      "6) hype：{who,text}，一位演员表示期待下一个节目的演出者，20 字以内；最后一个节目写 null。\n" +
      "7) chat：2 项 {who,text}，节目结束后两位演员（可以是任何人）互相聊的两句，每句 16 字以内。\n" +
      "所有话都要符合各自的人设。只输出 JSON：{\"programs\":[{\"lines\":[{\"who\":\"\",\"text\":\"\",\"fx\":\"\"}],\"dan\":[{\"who\":\"\",\"text\":\"\",\"re\":{\"who\":\"\",\"text\":\"\"}}],\"sneak\":{\"who\":\"\",\"text\":\"\"},\"laugh\":[{\"who\":\"\",\"at\":0}],\"jab\":null,\"hype\":null,\"chat\":[{\"who\":\"\",\"text\":\"\"}]}]}，programs 的顺序和节目单一致。";
    var j = SF.parseJson(await SF.ai(sys, usr, 0.9));
    if (!j || !Array.isArray(j.programs)) throw new Error("没有拿到台词，请再试一次");
    var programs = d.programs.map(function (p, i) {
      var q = j.programs[i] || {};
      var lines = (Array.isArray(q.lines) ? q.lines : []).map(function (l) {
        var w = idByName(rs, l && l.who);
        return { w: p.cast.indexOf(w) >= 0 ? w : p.cast[0], t: clean(l && l.text, 40), fx: normCue(l && l.fx) };
      }).filter(function (l) { return l.t; }).slice(0, 14);
      if (lines.length < 3) lines = linesFor(p, rs);
      function out(x) { var w = idByName(rs, x && x.who); return w && p.cast.indexOf(w) < 0 ? w : null; }
      var dan = (Array.isArray(q.dan) ? q.dan : []).map(function (x) {
        var w = out(x), o = { w: w, t: clean(x && x.text, 20) };
        var rw = idByName(rs, x && x.re && x.re.who), rt = clean(x && x.re && x.re.text, 20);
        if (rw && rt && rw !== w) o.re = { w: rw, t: rt };
        return o;
      }).filter(function (x) { return x.w && x.t; }).slice(0, 4);
      var sw = idByName(rs, q.sneak && q.sneak.who), st = clean(q.sneak && q.sneak.text, 40);
      if (!sw) sw = rs[(i + 1) % rs.length].id;
      if (!st) st = SF.pick(SNEAK);
      var laugh = (Array.isArray(q.laugh) ? q.laugh : []).map(function (x) { return { w: out(x), at: clamp(Math.floor(+(x && x.at) || 0), 0, lines.length - 1) }; }).filter(function (x) { return x.w; }).slice(0, 2);
      var hasSlip = lines.some(function (l) { return l.fx === "slip"; }), jab = null;
      if (hasSlip && q.jab) { var jw = out(q.jab), jt = clean(q.jab.text, 20); if (jw && jt) jab = { w: jw, t: jt }; }
      var hype = null;
      if (i < d.programs.length - 1 && q.hype) { var hw = idByName(rs, q.hype.who), ht = clean(q.hype.text, 24); if (hw && ht) hype = { w: hw, t: ht }; }
      var chat = (Array.isArray(q.chat) ? q.chat : []).map(function (x) { return { w: idByName(rs, x && x.who), t: clean(x && x.text, 20) }; }).filter(function (x) { return x.w && x.t; }).slice(0, 2);
      return { name: p.name, kind: p.kind, blurb: p.blurb, cast: p.cast.slice(), lines: lines, dan: dan, sneak: { w: sw, t: st }, laugh: laugh, jab: jab, hype: hype, chat: chat };
    });
    return { id: Date.now(), t: Date.now(), mode: "ai", title: d.title || "新春大联欢", roster: rs, mine: [], programs: programs };
  }

  // ---------- 放映：3D 剧院 ----------
  var G = null;

  function play(show, startProg) {
    var root = SF.appRoot; if (!root || G) return;
    startProg = startProg || 0;
    var ov = SF.h("div", "sfg-g"); ov.style.zIndex = SF.zTop();
    ov.innerHTML = '<canvas class="sfg-cv"></canvas>' +
      '<div class="sfg-top"><button class="sfg-x" type="button">✕</button><div class="sfg-now"><small>新春晚会</small><b></b></div><button class="sfg-bt" data-a="seat" type="button">座位</button></div>' +
      '<div class="sfg-ban"></div><div class="sfg-sub"><small></small><p></p></div>' +
      '<div class="sfg-wait"><button class="sfb" data-a="start" type="button">开　演</button><p>先点右上角「座位」挑个位子，选好再开演</p></div>' +
      '<div class="sfg-bar"><button class="sfg-pz" data-a="pause" type="button" style="display:none">⏸</button><input type="text" maxlength="20" placeholder="发条弹幕…"><button class="sfb sm" data-a="send" type="button">发送</button></div>' +
      '<div class="sfg-end"><small>THE END</small><h3>新春快乐</h3><p>春晚到此结束，谢谢观看</p><div class="sfg-eb"><button class="sfb" data-a="again" type="button">再看一遍</button><button class="sfb ghost" data-a="back" type="button">返回</button></div></div>';
    root.appendChild(ov);
    var cv = ov.querySelector(".sfg-cv"), g = cv.getContext("2d");
    function $(s) { return ov.querySelector(s); }
    var W = 0, H = 0, FOC = 1, HY = 0, dpr = 1, cP = [0, 0, 0], cF = [0, 0, -1], cR = [1, 0, 0], cU = [0, 1, 0];
    var seat0 = "4,1";
    var me = G = {
      stop: false, paused: false, state: "wait", seat: seat0, P: eyeOf(seat0), Pt: eyeOf(seat0), lx: 0, ly: 0, drag: false, open: 0, openT: 0,
      lb: 0.5, kick: 0, lightK: 0.5, mood: [255, 215, 150], moodT: [255, 215, 150], spot: 0, spotT: 0, steps: [], si: -1, stT: 0, cur: null, sk: "", prog: null, pi: 0,
      actors: [], speaker: null, dans: [], lane: [], parts: [], sneakO: null, applause: 0, npcT: 3, burst: 0, burstT: 0, t: 0, av: {}, rec: [], ended: false,
      dTrig: {}, laughAt: {}, sneakAt: -1, seatL: null, hy: 0.46, typ: null, fxs: [], wp: [], box: { rise: 0, cloth: 0, x: 0, lift: 0 }, flash: 0, shake: 0,
      dimT: 0, spotOnlyT: 0, spotOnlyId: null, laugh: {}, guestSeat: {}, lion: null, lastF: 0
    };
    function nm(id) { return nameIn(show.roster, id); }
    function guard(f) { try { f(); } catch (e) { /* 音效/特效出错不影响放映 */ } }
    function sfx(name, a, b) { guard(function () { if (SF.sfx && SF.sfx[name]) SF.sfx[name](a, b); }); }

    SF.chars().then(function (cs) {
      show.roster.forEach(function (r) {
        var c = cs.filter(function (x) { return x.id === r.id; })[0];
        if (c) loadImg(c.avatar).then(function (im) { me.av[r.id] = im; });
      });
    });
    // 观众席里的“客人”：没上台的角色坐在台下，头顶挂着头像牌
    (function () {
      var used = {};
      show.roster.forEach(function (r) {
        var h = hash(r.id);
        for (var q = 0; q < 40; q++) {
          var row = 1 + ((h + q * 7) % 6), col = COLS[((h >> 3) + q * 5) % COLS.length], key = row + "," + col;
          if (!used[key] && key !== seat0) { used[key] = 1; me.guestSeat[key] = r.id; break; }
        }
      });
    })();

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      FOC = Math.min(W * 0.82, H * 1.2);
    }
    resize();
    var onRs = function () { resize(); }; window.addEventListener("resize", onRs);
    var onVis = function () { if (document.hidden && me.state === "run" && !me.paused && !me.ended) setPause(true); };
    document.addEventListener("visibilitychange", onVis);

    // ----- 3D 基础 -----
    function toCam(p) {
      var dx = p[0] - cP[0], dy = p[1] - cP[1], dz = p[2] - cP[2];
      return [dx * cR[0] + dy * cR[1] + dz * cR[2], dx * cU[0] + dy * cU[1] + dz * cU[2], dx * cF[0] + dy * cF[1] + dz * cF[2]];
    }
    function scr(c) { return [W / 2 + FOC * c[0] / c[2], HY - FOC * c[1] / c[2]]; }
    function clipNear(a) {
      var out = [], N = 0.15;
      for (var i = 0; i < a.length; i++) {
        var p = a[i], q = a[(i + 1) % a.length], pin = p[2] >= N, qin = q[2] >= N;
        if (pin) out.push(p);
        if (pin !== qin) { var t = (N - p[2]) / (q[2] - p[2]); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, N]); }
      }
      return out;
    }
    function poly(pts, fill, ns) {
      var cs = clipNear(pts.map(toCam)); if (cs.length < 3) return;
      g.beginPath();
      for (var i = 0; i < cs.length; i++) { var s = scr(cs[i]); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }
      g.closePath(); g.fillStyle = fill; g.fill();
      if (!ns) { g.strokeStyle = fill; g.lineWidth = 0.7; g.stroke(); }
    }
    function lit(b, x, y, z, k) {
      var dx = x, dy = y - 3.2, dz = z + 2, d2 = dx * dx + dy * dy + dz * dz;
      var I = (0.18 + 0.95 * Math.exp(-d2 / 120)) * me.lightK * (k || 1), m = me.mood;
      return "rgb(" + Math.min(255, (b[0] * I * (0.8 + m[0] / 640)) | 0) + "," + Math.min(255, (b[1] * I * (0.8 + m[1] / 640)) | 0) + "," + Math.min(255, (b[2] * I * (0.8 + m[2] / 640)) | 0) + ")";
    }
    function rectZ(x1, y1, x2, y2, z, b, k) { poly([[x1, y1, z], [x2, y1, z], [x2, y2, z], [x1, y2, z]], lit(b, (x1 + x2) / 2, (y1 + y2) / 2, z, k)); }
    function rectX(x, z1, z2, y1, y2, b, k) { poly([[x, y1, z1], [x, y1, z2], [x, y2, z2], [x, y2, z1]], lit(b, x, (y1 + y2) / 2, (z1 + z2) / 2, k)); }
    function rectY(y, x1, x2, z1, z2, b, k) { poly([[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]], lit(b, (x1 + x2) / 2, y, (z1 + z2) / 2, k)); }
    // 把平面内的内容贴到墙上：在平面里 1 单位 = 1 米，x 向右 y 向下；视角变了会跟着歪
    function plane(x, y, z, fn) {
      var c0 = toCam([x, y, z]), cu = toCam([x + 1, y, z]), cv2 = toCam([x, y + 1, z]);
      if (c0[2] < 0.6 || cu[2] < 0.3 || cv2[2] < 0.3) return;
      var p0 = scr(c0), pu = scr(cu), pv = scr(cv2);
      g.save(); g.transform(pu[0] - p0[0], pu[1] - p0[1], pv[0] - p0[0], pv[1] - p0[1], p0[0], p0[1]);
      fn(FOC / c0[2]); g.restore();
    }
    function textPlane(s, x, y, z, sz, col) {
      plane(x, y, z, function (k) {
        if (sz * k < 5) return;
        g.scale(0.01, 0.01); g.font = "700 " + (sz * 100) + 'px "STKaiti","KaiTi","Songti SC",serif'; g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, 0, 0);
      });
    }
    function ringPts(cx, cy, cz, a, b, pl) {
      var o = [], n = 10;
      for (var i = 0; i < n; i++) { var an = i / n * 6.2832, ca = Math.cos(an) * a, sa = Math.sin(an) * b; o.push(pl === "xy" ? [cx + ca, cy + sa, cz] : pl === "zy" ? [cx, cy + sa, cz + ca] : [cx + ca, cy, cz + sa]); }
      return o;
    }
    function actorOf(id) { for (var i = 0; i < me.actors.length; i++) if (me.actors[i].id === id) return me.actors[i]; return null; }

    // ----- 世界粒子（烟雾、火花、烟花、音符、红包、文字）-----
    function wp(o) { if (me.wp.length > 420) me.wp.shift(); o.l = o.life; me.wp.push(o); }
    function puff(x, y, z) {
      for (var i = 0; i < 9; i++) wp({ k: "smoke", x: x + rnd(-0.4, 0.4), y: y + rnd(-0.3, 0.3), z: z + rnd(-0.2, 0.2), vx: rnd(-1, 1), vy: rnd(0.4, 1.4), vz: 0, g: 0, life: rnd(0.8, 1.4), s: rnd(0.5, 0.9), c: "255,255,255" });
      spark(x, y, z, 10, "255,230,150");
    }
    function spark(x, y, z, n, col) { for (var i = 0; i < n; i++) wp({ k: "dot", x: x, y: y, z: z, vx: rnd(-3, 3), vy: rnd(-1, 3.5), vz: rnd(-0.5, 0.5), g: 4, life: rnd(0.6, 1.2), s: rnd(0.05, 0.1), c: col || "255,226,140" }); }
    function burstW(x, y, z, col) {
      for (var i = 0; i < 46; i++) { var a = Math.random() * 6.283, v = rnd(2, 5), b = Math.random() * 3.1416 - 1.57; wp({ k: "dot", x: x, y: y, z: z, vx: Math.cos(a) * v * Math.cos(b), vy: Math.sin(b) * v + 0.5, vz: Math.sin(a) * v * 0.3, g: 3, life: rnd(1, 1.8), s: rnd(0.06, 0.12), c: col }); }
    }
    function textW(txt, x, y, z, s, col, life) { wp({ k: "txt", x: x, y: y, z: z, vx: 0, vy: 0.9, vz: 0, g: 0, life: life || 1.4, s: s || 0.6, c: col || "255,230,150", txt: txt }); }
    function headPos(a) { return [a.x, 1.7 + 1.4 * a.sc + a.dy, a.z]; }

    // ----- 演员 -----
    function mkActor(id, x, z, tx, idx) {
      return { id: id, x: x, z: z, tx: tx, bx: tx, sc: 1, sx: 1, rot: 0, tilt: 0, al: 1, mask: -1, lion: null, frozen: 0, exit: false, ex: 0, idx: idx, trail: [], dy: 0, drop: 0, ctrl: 0, rate: 0, _p: null };
    }
    function typeTilt(kind, n, k) { return kind === "相声" && n === 2 ? (k === 0 ? 0.14 : -0.14) : 0; }

    // ----- 特效 -----
    function fire(name, who) {
      var a = actorOf(who) || me.actors[0]; if (!a) return;
      var o = { k: name, a: a, t: 0, d: FXD[name] || 1.5, o: null, s: {} };
      if (HEAVY[name] && a.ctrl > 0) return;
      if (name === "swap" || name === "lion") {
        var other = me.actors.filter(function (x) { return x !== a && x.ctrl <= 0 && x.sc > 0.5; })[0] || null;
        if (name === "lion" && !other) { o.k = "spin"; o.d = FXD.spin; }
        else if (name === "swap" && !other) other = a;
        o.o = other;
      }
      if (HEAVY[o.k]) { a.ctrl++; if (o.o && o.o !== a) o.o.ctrl++; }
      startFx(o); me.fxs.push(o);
    }
    function startFx(o) {
      var a = o.a, hp = headPos(a), k = o.k;
      if (k === "flash") { me.flash = 1; me.kick = 0.9; sfx("burst"); }
      else if (k === "gavel") { me.shake = 0.7; me.flash = 0.55; textW("啪！", a.x, hp[1] + 1.6, a.z, 1.1, "255,240,200", 1); sfx("bigb"); }
      else if (k === "dim") { me.dimT = o.d; }
      else if (k === "spot") { me.spotOnlyT = o.d; me.spotOnlyId = a.id; }
      else if (k === "freeze") { a.frozen = o.d; me.spotT = a.tx; me.kick = 0.5; spark(hp[0], hp[1], hp[2], 16, "255,220,120"); textW("亮相！", a.x, hp[1] + 1.8, a.z, 0.8, "255,226,140", 1.3); sfx("hitg"); }
      else if (k === "appear") { a.sc = 0; puff(hp[0], 2.6, hp[2]); sfx("packet"); }
      else if (k === "vanish") { puff(hp[0], hp[1], hp[2]); sfx("packet"); }
      else if (k === "face") { o.s.mi = Math.floor(Math.random() * 4); o.s.last = -1; }
      else if (k === "swap") {
        me.box.x = 0; me.box.rise = 0; me.box.cloth = 0; me.box.lift = 0;
        var ot = o.o; if (ot && ot !== a) { puff(ot.x, 2.6, ot.z); }
        sfx("tap");
      }
      else if (k === "lion") { a.lion = { role: "head" }; o.o.lion = { role: "tail" }; me.lion = { a: a, t: o.o, t0: 0, eaten: false, lx: 0 }; snd(function (S, t) { for (var i = 0; i < 8; i++) { var w = t + i * 0.24; if (i % 2 === 0) S.kick(w, 1); else S.snare(false, w); S.hat(true, w); } S.gong(t); }); }
      else if (k === "ribbon" || k === "sleeve") { sfx("shh"); }
      else if (k === "sword") { sfx("launch"); }
      else if (k === "slip") { a.sx = 1; }
      else if (k === "dash") { sfx("tap"); }
      else if (k === "spin") { sfx("tap"); }
      else if (k === "grow") { sfx("flip"); }
    }
    function endFx(o) {
      var a = o.a;
      if (HEAVY[o.k]) { a.ctrl = Math.max(0, a.ctrl - 1); if (o.o && o.o !== a) o.o.ctrl = Math.max(0, o.o.ctrl - 1); }
      a.sc = 1; a.sx = 1; a.rot = 0; a.dy = 0; a.drop = 0; a.rate = 0; a.mask = -1;
      if (o.o) { o.o.sc = 1; o.o.sx = 1; o.o.dy = 0; o.o.rate = 0; o.o.lion = null; }
      if (o.k === "lion") { a.lion = null; me.lion = null; }
      if (o.k === "swap") { me.box.rise = 0; me.box.cloth = 0; }
      if (o.k === "freeze") a.frozen = 0;
      if (o.k === "swap" && o.o) { o.o.x = o.o.bx; }
    }
    function updateFx(o, dt) {
      var a = o.a, t = o.t, p = t / o.d, k = o.k, ot = o.o, hp = headPos(a);
      if (k === "spin") a.sx = Math.cos(p * Math.PI * 4);
      else if (k === "grow") a.sc = 1 + 0.5 * Math.sin(p * Math.PI);
      else if (k === "slip") {
        a.rot = p < 0.3 ? -0.7 * p / 0.3 : (p < 0.7 ? -0.7 : -0.7 * (1 - (p - 0.7) / 0.3)); a.drop = p > 0.3 && p < 0.7 ? 0.6 : 0;
        if (!o.s.said && p > 0.3) { o.s.said = 1; textW("哎呀！", a.x, hp[1] + 1.8, a.z, 0.9, "255,240,200", 1.2); sfx("miss"); spark(hp[0], 1.4, hp[2], 8, "255,255,255"); }
      }
      else if (k === "appear") { a.sc = back(t / 0.5); if (t < 0.5 && Math.random() < 0.5) spark(hp[0], hp[1], hp[2], 2, "255,226,140"); }
      else if (k === "vanish") {
        if (t < 0.25) a.sc = 1 - t / 0.25;
        else if (t < o.d - 0.4) a.sc = 0;
        else { if (!o.s.back) { o.s.back = 1; a.x = -a.bx * 0.6; puff(a.x, 2.6, a.z); sfx("packet"); } a.sc = back((t - (o.d - 0.4)) / 0.4); }
      }
      else if (k === "dash") {
        a.rate = 10; var sgn = a.bx >= 0 ? -1 : 1;
        a.tx = p < 0.3 ? sgn * 5 : (p < 0.6 ? -sgn * 5 : a.bx);
        if (p < 0.6 && !o.s.sw && p > 0.28) { o.s.sw = 1; sfx("tap"); }
      }
      else if (k === "face") {
        var seg = p < 0.1 ? -1 : (p > 0.9 ? -1 : Math.floor((p - 0.1) / 0.8 * 4));
        a.mask = seg < 0 ? -1 : (o.s.mi + seg) % 4;
        if (seg !== o.s.last) { o.s.last = seg; spark(hp[0], hp[1], hp[2], 14, seg < 0 ? "255,255,255" : "255,220,120"); me.kick = 0.4; sfx("flip"); }
      }
      else if (k === "notes") {
        o.s.nt = (o.s.nt || 0) - dt; if (o.s.nt <= 0) { o.s.nt = 0.22; textW(Math.random() < 0.5 ? "♪" : "♫", a.x + rnd(-1.6, 1.6), hp[1] + 1.3, a.z, 0.8, "255,226,140", 1.8); }
        if (!o.s.sn) { o.s.sn = 1; sfx("text"); }
      }
      else if (k === "fireworks") {
        o.s.nt = (o.s.nt || 0) - dt;
        if (o.s.nt <= 0 && o.s.n < 4 || o.s.n == null) { o.s.n = (o.s.n || 0) + 1; o.s.nt = 0.7; burstW(rnd(-4, 4), rnd(5, 6.2), -7.2, SF.pick(["255,211,107", "255,91,91", "255,143,177", "127,227,255", "185,162,255"])); sfx("launch"); setTimeout(function () { sfx("burst"); }, 350); }
      }
      else if (k === "swap" && ot) {
        var b = me.box;
        if (t < 0.6) b.rise = ease(t / 0.6);
        else if (t < 2.4) b.rise = 1;
        else b.rise = 1 - ease((t - 2.4) / 0.6);
        if (ot !== a) { if (t < 0.4) ot.sc = 1 - t / 0.4; else if (t < 2.0) ot.sc = 0; }
        if (t >= 0.6 && t < 2.0) { a.rate = 6; a.tx = b.x; }
        if (t >= 1.1 && t < 2.0) a.sc = Math.max(0, 1 - (t - 1.1) / 0.3);
        if (t >= 1.4 && t < 2.0) b.cloth = ease((t - 1.4) / 0.6);
        if (t >= 2.0 && !o.s.boom) {
          o.s.boom = 1; me.flash = 0.8; me.kick = 0.9; sfx("bigb"); puff(b.x, 2.6, -3.0); spark(b.x, 2.6, -3.0, 24, "255,220,120");
          b.cloth = 0; b.lift = 1;
          if (ot !== a) { ot.x = b.x; ot.tx = b.x; ot.rate = 6; }
        }
        if (t >= 2.0) b.lift = Math.max(0, b.lift - dt * 3);
        if (t >= 2.0 && t < 2.5 && ot !== a) ot.sc = back((t - 2.0) / 0.5);
        if (t >= 2.0) { var tgt = ot; if (ot !== a && t > 2.5) { ot.tx = ot.bx; ot.rate = 4; } if (ot === a) { a.sc = back((t - 2.0) / 0.5); a.x = b.x; a.tx = a.bx; a.rate = 4; } }
        if (t >= 3.0 && ot !== a && !o.s.ret) { o.s.ret = 1; a.x = a.bx; a.tx = a.bx; puff(a.x, 2.6, a.z); sfx("packet"); }
        if (t >= 3.0 && ot !== a) a.sc = back((t - 3.0) / 0.4);
      }
      else if (k === "lion" && ot && me.lion) {
        var L = me.lion; L.t0 = t; a.rate = 5; ot.rate = 5;
        var sgn2 = Math.cos(t * 1.6) >= 0 ? 1 : -1;
        if (t < 1.8) { a.tx = 2.8 * Math.sin(t * 1.6); }
        else if (t < 2.6) a.tx = 0;
        else a.tx = 2.6 * Math.sin((t - 2.6) * 1.8);
        ot.tx = a.x - 1.9 * (t < 2.6 && t >= 1.8 ? 1 : sgn2);
        a.dy = Math.abs(Math.sin(t * 6)) * 0.3; ot.dy = Math.abs(Math.sin(t * 6 + 1.2)) * 0.3;
        if (t >= 2.6 && !L.eaten) { L.eaten = true; me.flash = 0.5; sfx("packet"); for (var q = 0; q < 24; q++) wp({ k: "pkt", x: 0, y: 4.6, z: -3.2, vx: rnd(-3, 3), vy: rnd(1, 5), vz: rnd(-0.5, 0.5), g: 5, life: rnd(1, 1.6), s: 0.22, c: "220,40,40" }); spark(0, 4.6, -3.2, 30, "255,215,110"); snd(function (S, tt) { S.chime(tt); S.chime(tt + 0.1); }); }
      }
    }
    function drawLionCloth() {
      var L = me.lion; if (!L) return;
      var A = L.a._p, B = L.t._p; if (!A || !B) return;
      var t = me.t;
      g.save(); g.fillStyle = "#c92a24";
      g.beginPath(); g.moveTo(A.x - A.r * 0.9, A.y + A.r * 0.2); g.lineTo(A.x + A.r * 0.9, A.y + A.r * 0.2);
      g.quadraticCurveTo(B.x + B.r * 1.2, A.y + (B.y - A.y) * 0.4 + A.r * 1.4, B.x + B.r * 0.9, B.y + B.r * 0.6);
      g.lineTo(B.x - B.r * 0.9, B.y + B.r * 0.6);
      g.quadraticCurveTo(B.x - B.r * 1.2, A.y + (B.y - A.y) * 0.4 + A.r * 1.4, A.x - A.r * 0.9, A.y + A.r * 0.2); g.closePath(); g.fill();
      g.strokeStyle = "#f2b04a"; g.lineWidth = Math.max(2, A.r * 0.08);
      for (var i = 1; i < 6; i++) { var u = i / 6, x1 = A.x + (B.x - A.x) * u, y1 = A.y + (B.y - A.y) * u + A.r * (0.4 + 0.8 * Math.sin(u * Math.PI)); g.beginPath(); g.moveTo(x1 - A.r * 0.7 * (1 - u * 0.4), y1 - A.r * 0.15); g.lineTo(x1 + A.r * 0.7 * (1 - u * 0.4), y1 - A.r * 0.15); g.stroke(); }
      g.restore();
    }
    function drawMask(x, y, r, idx) {
      var pal = [["#c8202b", "#ffd96a", "#1a0a0a"], ["#2f6cc4", "#ffffff", "#0d1a33"], ["#e8b64c", "#c8202b", "#3a1a0a"], ["#1d1d22", "#ffd96a", "#ffffff"]][idx % 4];
      g.fillStyle = pal[0]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = pal[1];
      g.beginPath(); g.moveTo(x, y - r * 0.9); g.lineTo(x + r * 0.22, y - r * 0.55); g.lineTo(x, y - r * 0.25); g.lineTo(x - r * 0.22, y - r * 0.55); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(x - r * 0.52, y + r * 0.25, r * 0.22, r * 0.34, 0.4, 0, 7); g.ellipse(x + r * 0.52, y + r * 0.25, r * 0.22, r * 0.34, -0.4, 0, 7); g.fill();
      g.strokeStyle = pal[2]; g.lineWidth = Math.max(2, r * 0.13); g.lineCap = "round";
      g.beginPath(); g.moveTo(x - r * 0.85, y - r * 0.15); g.quadraticCurveTo(x - r * 0.5, y - r * 0.62, x - r * 0.1, y - r * 0.2); g.moveTo(x + r * 0.85, y - r * 0.15); g.quadraticCurveTo(x + r * 0.5, y - r * 0.62, x + r * 0.1, y - r * 0.2); g.stroke();
      g.fillStyle = pal[2]; g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.05, r * 0.17, r * 0.09, 0, 0, 7); g.ellipse(x + r * 0.38, y - r * 0.05, r * 0.17, r * 0.09, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x, y - r * 0.1); g.lineTo(x - r * 0.1, y + r * 0.35); g.lineTo(x + r * 0.1, y + r * 0.35); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x - r * 0.4, y + r * 0.62); g.quadraticCurveTo(x, y + r * 0.8, x + r * 0.4, y + r * 0.62); g.stroke();
    }
    // 屏幕上的特效：红绸、水袖、剑光、魔术箱、舞狮的青菜、世界粒子
    function drawFx(t) {
      var i, o, p, a, u, ang;
      me.fxs.forEach(function (f) {
        a = f.a; p = a._p; if (!p) return; var pr = f.t / f.d, al = Math.min(1, pr * 6, (1 - pr) * 4);
        if (f.k === "ribbon") {
          [-1, 1].forEach(function (dir) {
            var pts = [], n = 28;
            for (i = 0; i < n; i++) pts.push([p.x + dir * (p.r * 0.95 + i * p.r * 0.13), p.y + p.r * 0.1 + Math.sin(i * 0.45 - t * 7 + dir) * p.r * 0.5 * (i / n) - i * p.r * 0.02]);
            for (i = 1; i < n; i++) { g.strokeStyle = "rgba(" + (230 - i * 2) + "," + (50 + i * 4) + ",60," + (0.9 * al) + ")"; g.lineWidth = Math.max(1.5, p.r * 0.16 * (1 - i / (n + 6))); g.lineCap = "round"; g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }
          });
        } else if (f.k === "sleeve") {
          [-1, 1].forEach(function (dir) {
            var th = Math.sin(t * 4 + (dir > 0 ? 0 : 1.6)), ex = p.x + dir * p.r * (1.6 + 1.7 * Math.cos(th)), ey = p.y - p.r * (0.2 + 1.5 * Math.abs(Math.sin(th))), cx = p.x + dir * p.r * 1.2, cy = p.y + p.r * 1.0;
            g.save(); g.lineCap = "round"; g.globalAlpha = al;
            g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = p.r * 0.5; g.beginPath(); g.moveTo(p.x + dir * p.r * 0.9, p.y + p.r * 0.3); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
            g.strokeStyle = "rgba(255,255,255,.92)"; g.lineWidth = p.r * 0.26; g.stroke(); g.restore();
          });
        } else if (f.k === "sword") {
          g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = al; g.lineCap = "round";
          for (i = 0; i < 2; i++) {
            ang = t * 14 + i * Math.PI;
            g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = Math.max(2, p.r * 0.1); g.beginPath(); g.arc(p.x, p.y + p.r * 0.2, p.r * 1.9, ang - 1.0, ang); g.stroke();
            g.strokeStyle = "rgba(160,210,255,.6)"; g.lineWidth = Math.max(4, p.r * 0.2); g.beginPath(); g.arc(p.x, p.y + p.r * 0.2, p.r * 1.9, ang - 0.6, ang); g.stroke();
            g.strokeStyle = "#e8eef8"; g.lineWidth = Math.max(2, p.r * 0.07); g.beginPath(); g.moveTo(p.x + Math.cos(ang) * p.r * 1.2, p.y + p.r * 0.2 + Math.sin(ang) * p.r * 1.2); g.lineTo(p.x + Math.cos(ang) * p.r * 2.1, p.y + p.r * 0.2 + Math.sin(ang) * p.r * 2.1); g.stroke();
          }
          g.restore();
        }
      });
      // 魔术箱
      var b = me.box;
      if (b.rise > 0.01) {
        var h = 2.4 * b.rise, x = b.x, z = -3.0, y0 = 1.2, hw = 1.1;
        poly([[x - hw, y0, z], [x + hw, y0, z], [x + hw, y0 + h, z], [x - hw, y0 + h, z]], lit([30, 20, 36], x, y0 + h / 2, z, 1.4));
        poly([[x - hw, y0 + h, z - 1], [x + hw, y0 + h, z - 1], [x + hw, y0 + h, z], [x - hw, y0 + h, z]], lit([60, 40, 70], x, y0 + h, z, 1.6));
        poly([[x - hw, y0 + h - 0.12, z + 0.01], [x + hw, y0 + h - 0.12, z + 0.01], [x + hw, y0 + h, z + 0.01], [x - hw, y0 + h, z + 0.01]], "rgb(220,170,60)");
        textPlane("福", x, y0 + h / 2, z + 0.02, 1.0, "rgba(240,200,110,.9)");
        if (b.cloth > 0.01 || b.lift > 0.01) {
          var cl = Math.max(b.cloth, b.lift), ch = h * cl + 0.25 * cl, lift = b.lift * 3.2;
          poly([[x - hw - 0.15, y0 + lift, z + 0.05], [x + hw + 0.15, y0 + lift, z + 0.05], [x + hw + 0.15, y0 + ch + lift, z + 0.05], [x - hw - 0.15, y0 + ch + lift, z + 0.05]], "rgb(200,30,44)");
          poly([[x - hw - 0.15, y0 + ch - 0.14 + lift, z + 0.06], [x + hw + 0.15, y0 + ch - 0.14 + lift, z + 0.06], [x + hw + 0.15, y0 + ch + lift, z + 0.06], [x - hw - 0.15, y0 + ch + lift, z + 0.06]], "rgb(230,180,70)");
        }
      }
      // 舞狮的青菜
      if (me.lion && !me.lion.eaten && me.lion.t0 > 1.0) {
        var lc = toCam([0, 4.6, -3.2]), lt = toCam([0, 6.4, -3.2]);
        if (lc[2] > 0.5 && lt[2] > 0.5) {
          var s1 = scr(lc), s0 = scr(lt), k = FOC / lc[2], sw = Math.sin(t * 5) * k * 0.15;
          g.strokeStyle = "#e8b64c"; g.lineWidth = 2; g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(s1[0] + sw, s1[1] - k * 0.4); g.stroke();
          g.fillStyle = "#3fae5a"; g.beginPath(); g.ellipse(s1[0] + sw, s1[1] - k * 0.2, k * 0.5, k * 0.28, 0.3, 0, 7); g.fill();
          g.fillStyle = "#d9302a"; rrect(g, s1[0] + sw - k * 0.18, s1[1] - k * 0.1, k * 0.36, k * 0.5, k * 0.05); g.fill();
        }
      }
      // 世界粒子
      g.save();
      me.wp.forEach(function (q) {
        var c = toCam([q.x, q.y, q.z]); if (c[2] < 0.5) return;
        var s = scr(c), k = FOC / c[2], f = clamp(q.life / q.l, 0, 1);
        if (q.k === "dot") { g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(" + q.c + "," + f + ")"; g.beginPath(); g.arc(s[0], s[1], Math.max(1, q.s * k), 0, 7); g.fill(); g.globalCompositeOperation = "source-over"; }
        else if (q.k === "smoke") { var r = q.s * k * (1.6 - f * 0.6), gr = g.createRadialGradient(s[0], s[1], 0, s[0], s[1], r); gr.addColorStop(0, "rgba(" + q.c + "," + (0.35 * f) + ")"); gr.addColorStop(1, "rgba(" + q.c + ",0)"); g.fillStyle = gr; g.fillRect(s[0] - r, s[1] - r, r * 2, r * 2); }
        else if (q.k === "txt") { g.globalAlpha = Math.min(1, f * 2); g.font = "700 " + Math.max(10, q.s * k) + 'px "Songti SC","STSong",serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 3; g.strokeStyle = "rgba(60,10,10,.6)"; g.strokeText(q.txt, s[0], s[1]); g.fillStyle = "rgb(" + q.c + ")"; g.fillText(q.txt, s[0], s[1]); g.globalAlpha = 1; }
        else if (q.k === "pkt") { g.save(); g.translate(s[0], s[1]); g.rotate(q.l * 6); g.fillStyle = "rgba(" + q.c + "," + f + ")"; g.fillRect(-q.s * k / 2, -q.s * k * 0.7, q.s * k, q.s * k * 1.4); g.fillStyle = "rgba(255,215,110," + f + ")"; g.fillRect(-q.s * k / 2, -q.s * k * 0.1, q.s * k, q.s * k * 0.2); g.restore(); }
      });
      g.restore();
    }

    // ----- 剧院 -----
    function drawHall(t) {
      var i, z, sd, q, zs, za, zb;
      g.fillStyle = "#07030a"; g.fillRect(0, 0, W, H);
      // 地面（观众席有坡度）
      zs = [1.8, Z0 - 0.575]; for (q = Z0 - 0.575 + RZ; q < 18; q += RZ) zs.push(q); zs.push(18);
      for (i = 0; i < zs.length - 1; i++) {
        za = zs[i]; zb = zs[i + 1]; var ya = yf(za), yb = yf(zb), col = i % 2 ? [70, 16, 26] : [62, 14, 22];
        [[-9, -0.95, col], [-0.95, 0.95, [120, 70, 40]], [0.95, 9, col]].forEach(function (s) {
          poly([[s[0], ya, za], [s[1], ya, za], [s[1], yb, zb], [s[0], yb, zb]], lit(s[2], (s[0] + s[1]) / 2, ya, (za + zb) / 2));
        });
      }
      // 侧墙 + 灯笼窗 + 二楼包厢栏
      for (sd = -1; sd <= 1; sd += 2) {
        var wx = sd * 9;
        for (z = 0; z < 18; z += 2.6) { rectX(wx, z, z + 2.6, 0, 3.3, [60, 26, 20]); rectX(wx, z, z + 2.6, 3.3, 9, [84, 42, 30]); }
        [3, 7, 11, 15].forEach(function (zc) {
          poly([[wx, 4.4, zc - 0.8], [wx, 4.4, zc + 0.8], [wx, 6.0, zc + 0.8], [wx, 6.0, zc - 0.8]], "rgb(255," + (190 + ((Math.sin(t * 2 + zc) * 6) | 0)) + ",118)");
          poly([[wx, 4.4, zc - 0.04], [wx, 4.4, zc + 0.04], [wx, 6.0, zc + 0.04], [wx, 6.0, zc - 0.04]], "rgb(60,26,16)");
          poly([[wx, 5.16, zc - 0.8], [wx, 5.16, zc + 0.8], [wx, 5.24, zc + 0.8], [wx, 5.24, zc - 0.8]], "rgb(60,26,16)");
        });
        rectX(sd * 8.2, 0, 18, 3.3, 3.75, [96, 52, 32]);
        rectY(3.75, sd * 8.2, sd * 9, 0, 18, [110, 64, 40]);
      }
      // 顶棚 + 横梁
      for (z = 0; z < 18; z += 2.6) {
        rectY(9, -9, 9, z, z + 2.6, [66, 38, 24]);
        rectY(8.55, -9, 9, z, z + 0.35, [40, 22, 14]);
        poly([[-9, 8.55, z], [9, 8.55, z], [9, 9, z], [-9, 9, z]], lit([52, 28, 18], 0, 8.8, z));
      }
      // 吊灯笼
      [[-7, 2], [7, 2], [-7, 8], [7, 8], [-7, 14], [7, 14], [0, 10]].forEach(function (L) {
        var c = toCam([L[0], 7.6, L[1]]); if (c[2] < 0.6) return;
        var p = scr(c), r = FOC * 0.45 / c[2];
        g.save(); g.globalCompositeOperation = "lighter";
        var gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 3.2); gr.addColorStop(0, "rgba(255,120,70,.28)"); gr.addColorStop(1, "rgba(255,120,70,0)");
        g.fillStyle = gr; g.fillRect(p[0] - r * 3.2, p[1] - r * 3.2, r * 6.4, r * 6.4); g.restore();
        g.fillStyle = "#c92a24"; g.beginPath(); g.ellipse(p[0], p[1], r * 0.85, r, 0, 0, 7); g.fill();
        g.fillStyle = "#e8b64c"; g.fillRect(p[0] - r * 0.4, p[1] - r * 1.05, r * 0.8, r * 0.18);
      });
      // 舞台：前沿 + 台面
      rectZ(-6.2, 0, 6.2, 1.2, 1.8, [84, 48, 28]);
      for (z = 1.8, i = 0; z > -8; z -= 1, i++) rectY(1.2, -6.2, 6.2, z - 1, z, i % 2 ? [128, 84, 50] : [138, 92, 56]);
      // 背景幕（标题放在蓝色横带上，福字徽章抬高，不和头像重叠）
      rectZ(-6.2, 1.2, 6.2, 7.2, -8, [118, 22, 30]);
      for (i = 0; i < 8; i++) rectZ(-6.2 + i * 1.55, 1.2, -6.2 + i * 1.55 + 0.2, 6.4, -7.98, [100, 16, 24]);
      rectZ(-6.2, 6.4, 6.2, 7.2, -8, [30, 76, 120]); rectZ(-6.2, 6.33, 6.2, 6.43, -7.99, [200, 150, 60]);
      var gold = "rgba(240,200,110," + clamp(me.lightK, 0.35, 1) + ")";
      plane(0, 5.35, -7.95, function () {
        g.fillStyle = lit([150, 24, 30], 0, 5.3, -8, 1.1); g.beginPath(); g.arc(0, 0, 0.85, 0, 7); g.fill();
        g.strokeStyle = "rgba(220,170,70,.9)"; g.lineWidth = 0.06; g.stroke();
      });
      textPlane("福", 0, 5.35, -7.9, 1.2, gold);
      if (show.title) textPlane(show.title, 0, 6.82, -7.9, 0.5, "rgba(255,230,160," + clamp(me.lightK, 0.5, 1) + ")");
      drawLionCloth();
      // 台上的人（先画，后面的前幕和台口墙会盖住他们走进走出的部分）
      me.actors.slice().sort(function (a, b) { return a.z - b.z; }).forEach(function (a) { drawActor(a, t); });
      drawFx(t);
      // 前幕 + 檐幕
      var wid = 1.1 + (6.2 - 1.1) * (1 - me.open), sd2;
      for (sd2 = -1; sd2 <= 1; sd2 += 2) for (i = 0; i < 9; i++) {
        var xa = sd2 < 0 ? -6.2 + wid * i / 9 : 6.2 - wid * (i + 1) / 9, xb = sd2 < 0 ? -6.2 + wid * (i + 1) / 9 : 6.2 - wid * i / 9;
        rectZ(xa, 1.2, xb, 6.3, -0.3, [150, 20, 32], 0.6 + 0.4 * Math.abs(Math.sin(i * 1.7 + sd2)));
      }
      rectZ(-6.2, 6.3, 6.2, 7.2, -0.3, [150, 20, 32], 1.05); rectZ(-6.2, 6.3, 6.2, 6.42, -0.29, [210, 160, 60]);
      for (var fx = -6.2; fx < 6.0; fx += 0.4) rectZ(fx, 6.12, fx + 0.3, 6.3, -0.29, [210, 160, 60], 0.95);
      // 台口墙 + 金边 + 对联牌 + 横匾（贴在墙上，会跟着视角歪）
      rectZ(-9, 0, -6.45, 9, 0, [78, 36, 26]); rectZ(6.45, 0, 9, 9, 0, [78, 36, 26]); rectZ(-6.45, 7.45, 6.45, 9, 0, [78, 36, 26]);
      rectZ(-6.45, 1.2, -6.2, 7.45, 0.02, [170, 120, 50]); rectZ(6.2, 1.2, 6.45, 7.45, 0.02, [170, 120, 50]); rectZ(-6.45, 7.2, 6.45, 7.45, 0.02, [170, 120, 50]);
      rectZ(-8.3, 2.2, -7.3, 6.6, 0.03, [18, 12, 12], 1); rectZ(7.3, 2.2, 8.3, 6.6, 0.03, [18, 12, 12], 1);
      var UP = "歌声笑语迎新岁", DN = "锣鼓烟花贺吉祥";
      for (i = 0; i < 7; i++) { textPlane(UP.charAt(i), 7.8, 6.2 - i * 0.58, 0.05, 0.46, gold); textPlane(DN.charAt(i), -7.8, 6.2 - i * 0.58, 0.05, 0.46, gold); }
      rectZ(-3, 7.7, 3, 8.7, 0.03, [110, 16, 24], 1.1); textPlane("新春晚会", 0, 8.2, 0.05, 0.8, gold);
      // 追光
      var kk = clamp(me.lightK - 0.3, 0, 1), m = me.mood, rad = me.spotOnlyT > 0 ? 1.1 : 1.7;
      g.save(); g.globalCompositeOperation = "lighter";
      [-3.8, 0, 3.8].forEach(function (sx, n) {
        var tx = sx * 0.35 + me.spot * 0.65, top = [sx, 8.6, -1.5], r = rad + (n === 1 ? 0.3 : 0), col = "rgba(" + (m[0] | 0) + "," + (m[1] | 0) + "," + (m[2] | 0) + ",";
        poly([top, [tx - r, 1.2, -4], [tx + r, 1.2, -4]], col + (0.05 + 0.05 * kk) + ")", true);
        var pool = []; for (var a = 0; a < 18; a++) pool.push([tx + Math.cos(a / 18 * 6.283) * r, 1.22, -4 + Math.sin(a / 18 * 6.283) * r * 0.8]);
        poly(pool, col + (0.1 + 0.1 * kk) + ")", true);
      });
      // 脚光
      for (var lx = -5.5; lx <= 5.5; lx += 1.1) {
        var fc = toCam([lx, 1.35, 1.7]); if (fc[2] < 0.6) continue;
        var fp = scr(fc), fr = FOC * 0.5 / fc[2], gr2 = g.createRadialGradient(fp[0], fp[1], 0, fp[0], fp[1], fr);
        gr2.addColorStop(0, "rgba(255,225,160," + (0.5 + 0.1 * Math.sin(t * 3 + lx)) * clamp(me.lightK, 0.4, 1) + ")"); gr2.addColorStop(1, "rgba(255,225,160,0)");
        g.fillStyle = gr2; g.fillRect(fp[0] - fr, fp[1] - fr, fr * 2, fr * 2);
      }
      // 烟雾与舞台光晕
      var sc = toCam([0, 2.4, -3]);
      if (sc[2] > 0.5) {
        var sp = scr(sc), wash = g.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], W * 0.7);
        wash.addColorStop(0, "rgba(" + (m[0] | 0) + "," + (m[1] | 0) + "," + (m[2] | 0) + "," + 0.16 * me.lightK + ")"); wash.addColorStop(1, "rgba(" + (m[0] | 0) + "," + (m[1] | 0) + "," + (m[2] | 0) + ",0)");
        g.fillStyle = wash; g.fillRect(0, 0, W, H);
        for (i = 0; i < 4; i++) {
          var hx = sp[0] + Math.sin(t * 0.2 + i * 1.7) * W * 0.25, hy = sp[1] + H * 0.05 * (i % 2) + Math.sin(t * 0.3 + i) * 10, hr = W * (0.35 + 0.05 * i);
          var hg = g.createRadialGradient(hx, hy, 0, hx, hy, hr); hg.addColorStop(0, "rgba(255,235,210,.09)"); hg.addColorStop(1, "rgba(255,235,210,0)");
          g.fillStyle = hg; g.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
        }
      }
      g.restore();
      drawSeats(t);
    }

    function avatarAt(id, x, y, r, al) {
      var im = me.av[id];
      g.save(); g.globalAlpha = al; g.beginPath(); g.arc(x, y, r, 0, 7); g.clip();
      if (im) {
        var iw = im.naturalWidth || r * 2, ih = im.naturalHeight || r * 2, kk = Math.max(r * 2 / iw, r * 2 / ih);
        g.drawImage(im, x - iw * kk / 2, y - ih * kk / 2, iw * kk, ih * kk);
      } else {
        g.fillStyle = "#f2b394"; g.fillRect(x - r, y - r, r * 2, r * 2);
        g.fillStyle = "#7a2418"; g.font = "700 " + r + 'px "PingFang SC",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(nm(id).slice(0, 1), x, y + 2);
      }
      g.restore();
    }
    function drawActor(a, t) {
      if (a.sc <= 0.02) return;
      var kind = me.prog ? me.prog.kind : "", speaking = me.speaker === a.id && me.sk === "line", R = 1.4 * a.sc * (speaking ? 1.06 : 1), bob = 0;
      if (a.frozen <= 0) {
        if (speaking) bob = Math.abs(Math.sin(t * 7)) * 0.18;
        else if ((kind === "歌舞" || kind === "合唱") && me.state === "run" && me.sk === "line") bob = Math.abs(Math.sin(t * 4 + a.idx)) * 0.16;
        else if (kind === "相声" && me.sk === "line") bob = Math.abs(Math.sin(t * 3 + a.idx)) * 0.07;
      }
      if (me.sk === "fin") bob = Math.abs(Math.sin(t * 5 + a.x)) * 0.12;
      var yc = 1.2 + 0.5 + R + bob + a.dy - a.drop, cf = toCam([a.x, 1.2, a.z]); if (cf[2] < 0.5) return;
      var pf = scr(cf), ph = scr(toCam([a.x, yc, a.z])), k = FOC / cf[2], hr = R * k;
      a._p = { x: ph[0], y: ph[1], r: hr };
      var dimA = me.spotOnlyT > 0 && me.spotOnlyId !== a.id ? 0.45 : 1;
      // 脚下的影子和柔光
      g.fillStyle = "rgba(0,0,0,.42)"; g.beginPath(); g.ellipse(pf[0], pf[1], hr * 0.85, hr * 0.2, 0, 0, 7); g.fill();
      g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,215,140," + 0.14 * me.lightK * dimA + ")"; g.beginPath(); g.ellipse(pf[0], pf[1], hr * 1.15, hr * 0.28, 0, 0, 7); g.fill(); g.restore();
      // 冲刺残影
      a.trail.forEach(function (tr) { var pp = scr(toCam([tr.x, yc, a.z])); avatarAt(a.id, pp[0], pp[1], hr, 0.28 * (1 - tr.t / 0.35) * dimA); });
      g.save(); g.translate(ph[0], ph[1]); g.rotate(a.rot + a.tilt); g.scale(a.sx, 1); g.globalAlpha = dimA;
      if (a.lion && a.lion.role === "head") {
        for (var i = 0; i < 14; i++) { var an = i / 14 * 6.283 + Math.sin(t * 6 + i) * 0.06; g.fillStyle = i % 2 ? "#f2b04a" : "#d9302a"; g.beginPath(); g.arc(Math.cos(an) * hr * 1.12, Math.sin(an) * hr * 1.12, hr * 0.34, 0, 7); g.fill(); }
        g.fillStyle = "#ffd77a"; g.beginPath(); g.arc(-hr * 0.6, -hr * 1.15, hr * 0.22, 0, 7); g.arc(hr * 0.6, -hr * 1.15, hr * 0.22, 0, 7); g.fill();
        g.beginPath(); g.moveTo(-hr * 0.12, -hr * 1.1); g.lineTo(0, -hr * 1.6); g.lineTo(hr * 0.12, -hr * 1.1); g.closePath(); g.fill();
      }
      avatarAt(a.id, 0, 0, hr, 1);
      if (a.mask >= 0) drawMask(0, 0, hr, a.mask);
      g.strokeStyle = "#ffd77a"; g.lineWidth = Math.max(2, hr * 0.06); g.beginPath(); g.arc(0, 0, hr, 0, 7); g.stroke();
      if (a.lion && a.lion.role === "head") {
        var mo = Math.abs(Math.sin(t * 7));
        g.fillStyle = "#8e1018"; g.beginPath(); g.ellipse(0, hr * 1.02, hr * 0.7, hr * (0.12 + 0.4 * mo), 0, 0, 7); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.moveTo(-hr * 0.4, hr * 0.9); g.lineTo(-hr * 0.28, hr * 1.1); g.lineTo(-hr * 0.16, hr * 0.9); g.moveTo(hr * 0.16, hr * 0.9); g.lineTo(hr * 0.28, hr * 1.1); g.lineTo(hr * 0.4, hr * 0.9); g.fill();
      }
      g.restore();
      if (speaking) {
        g.strokeStyle = "rgba(255,225,140," + (0.4 + 0.4 * Math.sin(t * 8)) + ")"; g.lineWidth = 3; g.beginPath(); g.arc(ph[0], ph[1], hr * (1.1 + 0.04 * Math.sin(t * 8)), 0, 7); g.stroke();
      }
      g.font = "11px sans-serif"; g.fillStyle = "rgba(255,235,190,.9)"; g.textAlign = "center"; g.textBaseline = "top"; g.fillText(nm(a.id), pf[0], pf[1] + 4);
    }

    function drawSeats(t) {
      for (var r = 0; r < ROWS; r++) {
        var z = Z0 + r * RZ, y = yf(z);
        for (var ci = 0; ci < COLS.length; ci++) {
          var c = COLS[ci], x = c * SX, cm = toCam([x, y + 0.6, z + 0.1]); if (cm[2] < 0.45) continue;
          var k = FOC / cm[2], sc = scr(cm), hw = 0.5 * k; if (sc[0] < -hw * 2 || sc[0] > W + hw * 2) continue;
          var key = r + "," + c, gid = me.guestSeat[key], onStage = gid && actorOf(gid) && actorOf(gid).sc > 0.2;
          var occ = gid ? !onStage : hash(r * 17 + c * 5 + 3) % 100 < 64;
          if (occ) {
            var lg = gid && me.laugh[gid] > 0, shk = lg ? Math.sin(t * 38) * 0.05 : 0;
            var bob = me.applause > 0 ? Math.abs(Math.sin(t * 9 + r + c)) * 0.1 * Math.min(1, me.applause) : (lg ? Math.abs(Math.sin(t * 16)) * 0.1 : 0);
            var hx = x + shk, hy = y + 1.12 + bob, hz = z - 0.05, hair = hash(r * 7 + c) % 3 ? [34, 22, 26] : [70, 44, 30], hc = lit(hair, x, y + 1, z, 1.6);
            poly(ringPts(hx, hy, hz, 0.16, 0.2, "xy"), hc, true); poly(ringPts(hx, hy, hz, 0.16, 0.2, "zy"), hc, true); poly(ringPts(hx, hy, hz, 0.16, 0.16, "xz"), hc, true);
            if (gid) {
              var bc = toCam([hx, hy + 0.5, hz]);
              if (bc[2] > 0.5) {
                var bp = scr(bc), br = 0.26 * FOC / bc[2];
                avatarAt(gid, bp[0], bp[1], br, 1); g.strokeStyle = "#ffd77a"; g.lineWidth = Math.max(1.5, br * 0.1); g.beginPath(); g.arc(bp[0], bp[1], br, 0, 7); g.stroke();
              }
            }
          }
          var zb = z + 0.22, pts = [[x - 0.42, y + 0.1, zb], [x + 0.42, y + 0.1, zb], [x + 0.42, y + 0.8, zb]];
          for (var i = 1; i <= 6; i++) { var u = i / 6; pts.push([x + 0.42 - 0.84 * u, y + 0.8 + 0.18 * Math.sin(u * Math.PI), zb]); }
          poly(pts, lit([132, 24, 38], x, y + 0.6, z, 1));
        }
      }
    }

    // ----- 弹幕 / 偷跑 / 彩纸 -----
    var DFONT = '600 15px "PingFang SC","Noto Sans SC",sans-serif';
    function dan(txt, kind, id) {
      if (!txt) return;
      g.font = DFONT;
      var w = g.measureText(txt).width + (kind === "ch" ? 28 : kind === "me" ? 16 : 0), lanes = Math.max(4, Math.floor(H * 0.29 / 26)), best = 0, bt = 1e9, i;
      for (i = 0; i < lanes; i++) { var tl = me.lane[i] == null ? -1e9 : me.lane[i]; if (tl < bt) { bt = tl; best = i; } }
      var x = Math.max(W + 10, bt + 40), sp = kind === "me" ? 82 : rnd(68, 98);
      me.lane[best] = x + w;
      me.dans.push({ txt: txt, kind: kind, id: id, x: x, y: H * 0.13 + best * 26, w: w, sp: sp });
      if (me.dans.length > 80) me.dans.shift();
    }
    function later(f, ms) { setTimeout(function () { if (G === me && !me.stop) f(); }, ms); }
    function sneak(sn) {
      if (!sn || !sn.t || me.sneakO) return;
      me.sneakO = { id: sn.w, text: sn.t, age: 0, side: Math.random() < 0.5 ? -1 : 1, n: 0, last: 0 };
      $(".sfg-sub").classList.add("dim");
    }
    function laugh(w) {
      if (!w || actorOf(w)) return;
      me.laugh[w] = 2.8;
      var key = null, k; for (k in me.guestSeat) if (me.guestSeat[k] === w) key = k;
      if (key) { var a = key.split(","), r = +a[0], c = +a[1], z = Z0 + r * RZ; textW("哈哈哈", c * SX, yf(z) + 1.9, z, 0.5, "255,235,170", 1.8); }
      dan("哈哈哈哈哈哈哈哈", "ch", w);
    }
    function wrap(s, maxW) {
      var out = [], line = "", arr = Array.from(String(s));
      for (var i = 0; i < arr.length; i++) { if (g.measureText(line + arr[i]).width > maxW && line) { out.push(line); line = arr[i]; } else line += arr[i]; }
      if (line) out.push(line); return out;
    }
    function confetti() {
      var cols = ["#ffd36b", "#ff5b5b", "#ff8fb1", "#fff1b8", "#ffa94d", "#e83a3a"];
      for (var i = 0; i < 110; i++) me.parts.push({ x: rnd(0, W), y: rnd(-H * 0.4, -10), vx: rnd(-20, 20), vy: rnd(60, 150), c: SF.pick(cols), s: rnd(4, 8), r: rnd(0, 6), vr: rnd(-6, 6) });
    }
    function blipFor(id, ch) {
      if (!ch.trim() || STOP.test(ch)) return;
      var base = voiceBase(id), hi = TONEW.test(ch), pool = hi ? VOICE_HI : VOICE, ix, f, n = 0;
      do { ix = Math.floor(Math.random() * pool.length); f = base * pool[ix]; n++; } while (f === me.lastF && n < 6);
      me.lastF = f; sfx("blip", f, hi ? 0.045 : 0.06);
    }
    function drawOverlay(t) {
      var vg = g.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.62)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      if (me.flash > 0.02) { g.fillStyle = "rgba(255,246,220," + Math.min(0.6, me.flash * 0.6) + ")"; g.fillRect(0, 0, W, H); }
      me.parts.forEach(function (p) { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); });
      g.font = DFONT; g.textBaseline = "middle"; g.textAlign = "left";
      var sk = me.sneakO;
      g.save(); if (sk) g.globalAlpha = 0.3;
      me.dans.forEach(function (d) {
        if (d.x > W + 5) return;
        if (d.kind === "ch") {
          g.fillStyle = "rgba(0,0,0,.4)"; rrect(g, d.x - 4, d.y - 12, d.w + 8, 24, 12); g.fill();
          avatarAt(d.id, d.x + 10, d.y, 9, 1);
          g.strokeStyle = "#ffd77a"; g.lineWidth = 1.2; g.beginPath(); g.arc(d.x + 10, d.y, 9, 0, 7); g.stroke();
          g.fillStyle = "#ffe9b0"; g.fillText(d.txt, d.x + 26, d.y);
        } else if (d.kind === "me") {
          g.fillStyle = "rgba(0,40,60,.55)"; rrect(g, d.x - 4, d.y - 12, d.w + 8, 24, 12); g.fill();
          g.strokeStyle = "#6fe3ff"; g.lineWidth = 1.2; g.stroke(); g.fillStyle = "#c4f4ff"; g.fillText(d.txt, d.x + 4, d.y);
        } else {
          g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.55)"; g.strokeText(d.txt, d.x, d.y); g.fillStyle = "rgba(255,255,255,.92)"; g.fillText(d.txt, d.x, d.y);
        }
      });
      g.restore();
      if (sk) {
        var a = sk.age, e = Math.min(ease(a / 0.5), ease((5.6 - a) / 0.5)), r = 42;
        var cx = sk.side > 0 ? W - r - 18 + (1 - e) * r * 3.2 : r + 18 - (1 - e) * r * 3.2, cy = H * 0.6;
        g.fillStyle = "rgba(112,18,32,.96)"; rrect(g, cx - r * 1.15, cy - r * 0.95, r * 2.3, r * 2.5, r * 0.5); g.fill();
        avatarAt(sk.id, cx, cy, r, 1);
        g.strokeStyle = "#ffd77a"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
        if (e > 0.6) {
          g.globalAlpha = clamp((e - 0.6) / 0.4, 0, 1);
          g.font = '14px "PingFang SC",sans-serif'; g.textAlign = "left"; g.textBaseline = "middle";
          var lines = wrap(sk.text, Math.min(W * 0.58, 220)), bw = 0, i;
          for (i = 0; i < lines.length; i++) bw = Math.max(bw, g.measureText(lines[i]).width);
          bw += 20; var bh = lines.length * 20 + 14, bx = clamp(cx - bw / 2, 8, W - bw - 8), by = cy - r * 1.1 - bh - 6;
          g.fillStyle = "rgba(255,248,232,.97)"; rrect(g, bx, by, bw, bh, 12); g.fill();
          g.fillStyle = "#4a1a12"; var left = sk.n;
          lines.forEach(function (l, n) { var s2 = l.slice(0, Math.max(0, left)); left -= l.length; g.fillText(s2, bx + 10, by + 7 + 10 + n * 20); });
          g.fillStyle = "#e8b64c"; g.font = "11px sans-serif"; g.fillText(nm(sk.id), bx + 10, by - 8);
          g.globalAlpha = 1;
        }
      }
    }

    // ----- 节目流程 -----
    function stepKey(s) { return s.k === "line" ? s.p + ":" + s.j : s.k === "ann" ? s.p + ":-1" : s.k === "bow" ? s.p + ":99" : s.k === "open" ? "o" : "f"; }
    function buildSteps() {
      var s = [{ k: "open", d: 3.4 }];
      for (var i = startProg; i < show.programs.length; i++) {
        var p = show.programs[i];
        s.push({ k: "ann", p: i, d: 3.2 });
        p.lines.forEach(function (l, j) { s.push({ k: "line", p: i, j: j, d: Math.max(2.4, Math.min(5.5, 1.2 + l.t.length * 0.2)) }); });
        s.push({ k: "bow", p: i, d: 3.4 });
      }
      s.push({ k: "fin", d: 7 });
      return s;
    }
    function snd(f) { var S = SF.sfx && SF.sfx.sched, t = SF.sfx && SF.sfx.now && SF.sfx.now(); if (S && t != null) { try { f(S, t); } catch (e) { /* 忽略 */ } } }
    function applause() {
      me.applause = 2.4;
      snd(function (S, t) { for (var i = 0; i < 34; i++) { var w = t + Math.random() * 2.3; S.cow(w); if (i % 3 === 0) S.hat(false, w + 0.01); } });
    }
    function drums() {
      snd(function (S, t) { S.gong(t); for (var i = 0; i < 10; i++) { var w = t + 0.5 + i * 0.22; if (i % 2 === 0) S.kick(w, 1); else S.snare(false, w); S.hat(i % 4 === 3, w); } S.chime(t + 2.9); });
    }
    function banner(txt) { var b = $(".sfg-ban"); b.textContent = txt; b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); }
    // 字幕一个字一个字出现，每个字响一声（每个角色的音高不同）
    function sub(who, text, id) {
      var b = $(".sfg-sub");
      if (!text) { b.classList.remove("on"); me.typ = null; return; }
      b.querySelector("small").textContent = who || "";
      var p = b.querySelector("p"); p.textContent = "";
      var sa = document.createElement("span"), sz = document.createElement("span"); sz.style.visibility = "hidden"; sz.textContent = text; p.appendChild(sa); p.appendChild(sz);
      me.typ = { a: sa, z: sz, text: text, i: 0, acc: 0, wait: 0.12, id: id || "host" };
      b.classList.add("on");
    }
    function typeTick(dt) {
      var ty = me.typ; if (!ty) return;
      ty.acc += dt; var moved = false;
      while (ty.i < ty.text.length && ty.acc >= ty.wait) {
        ty.acc -= ty.wait; ty.i++; moved = true;
        var ch = ty.text.charAt(ty.i - 1); blipFor(ty.id, ch);
        ty.wait = STOP.test(ch) ? 0.14 : 0.045;
      }
      if (moved) { ty.a.textContent = ty.text.slice(0, ty.i); ty.z.textContent = ty.text.slice(ty.i); }
      if (ty.i >= ty.text.length) me.typ = null;
    }
    function enter(i) {
      var s = me.steps[i]; me.si = i; me.stT = 0; me.cur = s; me.sk = s.k;
      var key = stepKey(s);
      (show.mine || []).forEach(function (m, q) { if (m.k === key) later(function () { dan(m.t, "me"); }, 300 + q * 500); });
      if (s.k === "open") {
        banner(show.title || "新春晚会"); me.openT = 1; me.moodT = [255, 215, 150]; sub("", ""); drums();
      } else if (s.k === "ann") {
        var p = show.programs[s.p]; me.prog = p; me.pi = s.p; me.speaker = null;
        me.moodT = (KIND_COL[p.kind] || [255, 215, 150]).slice();
        var xs = layout(p.kind, p.cast.length);
        me.actors = p.cast.map(function (id, k) { var a = mkActor(id, k % 2 ? 9.6 : -9.6, -4, xs[k], k); a.tilt = typeTilt(p.kind, p.cast.length, k); return a; });
        me.fxs = []; me.lion = null; me.box.rise = 0; me.box.cloth = 0;
        var L = p.lines.length, m = (p.dan || []).length; me.dTrig = {}; me.laughAt = {};
        (p.dan || []).forEach(function (d, q) { var j = Math.min(L - 1, Math.round((q + 1) * L / (m + 1))); (me.dTrig[j] = me.dTrig[j] || []).push(d); });
        (p.laugh || []).forEach(function (x) { (me.laughAt[x.at] = me.laughAt[x.at] || []).push(x.w); });
        me.sneakAt = p.sneak && p.sneak.t ? Math.floor(L * 0.55) : -1;
        $(".sfg-now small").textContent = "第 " + (s.p + 1) + " / " + show.programs.length + " 个节目"; $(".sfg-now b").textContent = p.kind + "《" + p.name + "》";
        banner(p.kind + "《" + p.name + "》");
        sub("主持人", "下面请欣赏" + p.kind + "《" + p.name + "》，表演者：" + p.cast.map(nm).join("、"), "host");
        snd(function (S, t) { S.chime(t); });
      } else if (s.k === "line") {
        var l = me.prog.lines[s.j]; me.speaker = l.w; sub(nm(l.w), l.t, l.w);
        var a = actorOf(l.w); if (a) me.spotT = a.tx;
        var cue = l.fx || autoFx(me.prog, s.j, me.prog.lines.length);
        if (cue) later(function () { fire(cue, l.w); }, 350);
        (me.dTrig[s.j] || []).forEach(function (d, q) {
          later(function () { dan(d.t, "ch", d.w); }, 600 + q * 700);
          if (d.re) later(function () { dan(d.re.t, "ch", d.re.w); }, 2200 + q * 700);
        });
        (me.laughAt[s.j] || []).forEach(function (w) { later(function () { laugh(w); }, 700); });
        if (cue === "slip" && me.prog.jab) later(function () { dan(me.prog.jab.t, "ch", me.prog.jab.w); }, 1100);
        if (s.j === me.sneakAt) later(function () { sneak(me.prog.sneak); }, 1200);
      } else if (s.k === "bow") {
        me.speaker = null; sub("", ""); applause(); me.burst = 4; me.burstT = 0; me.spotT = 0;
        var pp = show.programs[s.p], nx = show.programs[s.p + 1];
        if (pp.hype && nx) later(function () { dan(pp.hype.t, "ch", pp.hype.w); }, 900);
        (pp.chat || []).forEach(function (c, q) { later(function () { dan(c.t, "ch", c.w); }, 1500 + q * 1500); });
      } else if (s.k === "fin") {
        me.speaker = null; me.fxs = []; me.lion = null;
        var ids = show.roster.map(function (r) { return r.id; }), n = ids.length, two = n > 4, h1 = two ? Math.ceil(n / 2) : n;
        var x1 = slotsX(h1), x2 = slotsX(n - h1);
        me.actors = ids.map(function (id, k) { var row2 = two && k >= h1; return mkActor(id, k % 2 ? 9.6 : -9.6, row2 ? -5.4 : (two ? -3.2 : -4), row2 ? x2[k - h1] : x1[k], k); });
        me.moodT = [255, 205, 140]; me.spotT = 0; banner("新春快乐"); sub("", "春晚到此结束，新春快乐，万事胜意！", "host"); applause(); confetti(); me.burst = 5; me.burstT = 0;
        snd(function (S, t) { S.chime(t); S.chime(t + 0.4); });
        sfx("win");
      }
    }

    function setSeat(key) { me.seat = key; me.Pt = eyeOf(key); }
    function setPause(on) {
      if (me.state !== "run" || me.ended) return; me.paused = on;
      var b = $(".sfg-pz"); b.textContent = on ? "▶" : "⏸";
    }
    function openSeats() {
      var D = SF.layer(root, "选座位", { half: true, k: "SEATS", key: "galaSeat" }); if (!D) return;
      me.seatL = D;
      function paint() {
        var h = '<p class="tip">点座位，镜头会滑过去。越靠前越近，越靠后看得越全。</p><div class="sfg-stg">舞　台</div>';
        for (var r = 0; r < ROWS; r++) {
          h += '<div class="sfg-sr"><u>' + (r + 1) + "</u>";
          COLS.forEach(function (c) { var key = r + "," + c; h += (c === 1 ? '<span class="sfg-gap"></span>' : "") + '<i class="sfg-s' + (key === me.seat ? " on" : "") + '" data-s="' + key + '"></i>'; });
          h += "</div>";
        }
        h += '<div class="sfrow" style="margin-top:12px;gap:8px">' + Object.keys(BOX).map(function (k) { return '<span class="sfchip' + (me.seat === k ? " on" : "") + '" data-s="' + k + '" style="margin:0">' + BOX[k].n + "</span>"; }).join("") + "</div>";
        h += '<button class="sfb block" style="margin-top:14px" data-ok="1" type="button">就坐</button>';
        D.body.innerHTML = h;
      }
      D.body.addEventListener("click", function (e) {
        var a = e.target.closest("[data-s],[data-ok]"); if (!a) return;
        if (a.dataset.ok) { D.close(); return; }
        setSeat(a.dataset.s); paint(); sfx("tap");
      });
      paint();
    }

    function cleanup() {
      me.stop = true; cancelAnimationFrame(me.raf);
      window.removeEventListener("resize", onRs); document.removeEventListener("visibilitychange", onVis);
      if (me.seatL && me.seatL.alive) me.seatL.close(true);
      if (me.rec.length) {
        var rec = me.rec.slice();
        SF.st.get("gala_shows", []).then(function (arr) {
          arr = arr || []; var it = arr.filter(function (x) { return x.id === show.id; })[0];
          if (it) { it.mine = (it.mine || []).concat(rec).slice(-80); return SF.st.set("gala_shows", arr); }
        });
      }
      if (ov.parentNode) ov.remove(); G = null;
    }
    function sendDan() {
      var inp = $(".sfg-bar input"), t = inp.value.trim().slice(0, 20); if (!t) return;
      inp.value = ""; dan(t, "me");
      if (me.state === "run" && me.cur) me.rec.push({ k: stepKey(me.cur), t: t });
    }
    ov.addEventListener("click", function (e) {
      var a = e.target.closest("[data-a]"); if (!a) return;
      var act = a.dataset.a; SF.audio.unlock();
      if (act === "seat") openSeats();
      else if (act === "start") {
        me.state = "run"; $(".sfg-wait").style.display = "none"; $(".sfg-pz").style.display = ""; me.steps = buildSteps(); enter(0);
      }
      else if (act === "pause") setPause(!me.paused);
      else if (act === "send") sendDan();
      else if (act === "again") { cleanup(); play(show, startProg); }
      else if (act === "back") cleanup();
    });
    $(".sfg-bar input").addEventListener("keydown", function (e) { if (e.key === "Enter") sendDan(); });
    $(".sfg-x").onclick = function () {
      if (me.state !== "run" || me.ended) { cleanup(); return; }
      var was = me.paused; me.paused = true;
      SF.confirm("退出春晚", "确定退出吗？可以在「我的春晚」里回看。").then(function (ok) { if (ok) cleanup(); else me.paused = was; });
    };
    var px = 0, py = 0;
    cv.addEventListener("pointerdown", function (e) { me.drag = true; px = e.clientX; py = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* 忽略 */ } });
    cv.addEventListener("pointermove", function (e) {
      if (!me.drag) return;
      me.lx = clamp(me.lx + (e.clientX - px) * 0.02, -5, 5); me.ly = clamp(me.ly - (e.clientY - py) * 0.015, -2.5, 2.5); px = e.clientX; py = e.clientY;
    });
    var up = function () { me.drag = false; };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

    // ----- 每帧 -----
    var prev = performance.now();
    function frame(now) {
      if (me.stop) return;
      me.raf = requestAnimationFrame(frame);
      if (!document.body.contains(ov)) { cleanup(); return; }
      var dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      update(dt); draw();
    }
    function update(dt) {
      var run = me.state === "run" && !me.paused && !me.ended, dt2 = run ? dt : 0, i, kind = me.prog ? me.prog.kind : "";
      me.t += dt;
      // 灯光
      me.dimT = Math.max(0, me.dimT - dt2); me.spotOnlyT = Math.max(0, me.spotOnlyT - dt2); me.kick = Math.max(0, me.kick - dt * 2.2); me.flash = Math.max(0, me.flash - dt * 2.5); me.shake = Math.max(0, me.shake - dt * 2);
      var tgt = me.state === "wait" ? 0.55 : (me.dimT > 0 ? 0.4 : (me.spotOnlyT > 0 ? 0.55 : 1));
      me.lb += (tgt - me.lb) * Math.min(1, dt * 3); me.lightK = me.lb + me.kick * 0.7;
      for (i = 0; i < 3; i++) me.mood[i] += (me.moodT[i] - me.mood[i]) * Math.min(1, dt * 1.5);
      me.open += (me.openT - me.open) * Math.min(1, dt * 1.1);
      for (i = 0; i < 3; i++) me.P[i] += (me.Pt[i] - me.P[i]) * Math.min(1, dt * 3.5);
      if (!me.drag) { me.lx *= 1 - Math.min(1, dt * 0.6); me.ly *= 1 - Math.min(1, dt * 0.6); }
      var hyT = me.seatL && me.seatL.alive ? 0.27 : 0.46; me.hy += (hyT - me.hy) * Math.min(1, dt * 4); HY = H * me.hy;
      me.spot += (me.spotT - me.spot) * Math.min(1, dt * 3);
      // 演员：走位
      me.actors.forEach(function (a, k) {
        if (a.exit) a.tx = a.ex;
        else if (a.ctrl <= 0) {
          var tx = a.bx;
          if (me.sk === "line" || me.sk === "bow") {
            if (kind === "歌舞" && a.frozen <= 0 && me.sk === "line") tx = a.bx + Math.sin(me.t * 1.6 + k * 1.3) * 0.7;
            else if (kind === "小品" && a.id === me.speaker) tx = a.bx * 0.45;
          }
          a.tx = tx;
        }
        var rate = a.rate || 3.5; a.x += (a.tx - a.x) * Math.min(1, dt * rate);
        if (a.rate > 6 && Math.abs(a.tx - a.x) > 0.3) a.trail.push({ x: a.x, t: 0 });
        a.trail = a.trail.filter(function (tr) { tr.t += dt; return tr.t < 0.35; });
        if (a.frozen > 0) a.frozen = Math.max(0, a.frozen - dt2);
        if (!a.ctrl) a.rate = 0;
      });
      // 特效
      me.fxs = me.fxs.filter(function (o) {
        o.t += dt2;
        if (o.t >= o.d) { endFx(o); return false; }
        guard(function () { updateFx(o, dt2); }); return true;
      });
      me.wp = me.wp.filter(function (q) { q.life -= dt2 || dt * 0.4; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy -= q.g * dt; return q.life > 0; });
      for (var key in me.laugh) if (me.laugh[key] > 0) me.laugh[key] = Math.max(0, me.laugh[key] - dt2);
      // 字幕打字
      typeTick(dt2);
      if (run) {
        me.stT += dt;
        if (me.sk === "bow" && me.stT > me.cur.d * 0.55) me.actors.forEach(function (a, k) { if (!a.exit) { a.exit = true; a.ex = k % 2 ? 10 : -10; a.ctrl = 0; } });
        if (me.stT >= me.cur.d) {
          if (me.si + 1 < me.steps.length) enter(me.si + 1);
          else { me.ended = true; $(".sfg-end").classList.add("on"); $(".sfg-pz").style.display = "none"; }
        }
        me.npcT -= dt2; if (me.npcT <= 0 && !me.sneakO) { dan(SF.pick(NPC), "npc"); me.npcT = rnd(2.4, 5.2); }
        if (me.burst > 0) { me.burstT -= dt2; if (me.burstT <= 0) { dan(SF.pick(NPC_AP), "npc"); me.burst--; me.burstT = 0.22; } }
      }
      me.applause = Math.max(0, me.applause - dt2);
      var dd = me.sneakO ? 0 : dt2;
      me.dans = me.dans.filter(function (d) { d.x -= d.sp * dd; return d.x + d.w > -20; });
      for (i = 0; i < me.lane.length; i++) if (me.lane[i] != null) me.lane[i] -= 80 * dd;
      me.parts = me.parts.filter(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; return p.y < H + 20; });
      if (me.sneakO) {
        var sk = me.sneakO; sk.age += dt2;
        var want = Math.max(0, Math.floor((sk.age - 0.5) * 22));
        while (sk.n < Math.min(want, sk.text.length)) { sk.n++; blipFor(sk.id, sk.text.charAt(sk.n - 1)); }
        if (sk.age > 5.6) { me.sneakO = null; $(".sfg-sub").classList.remove("dim"); }
      }
    }
    function draw() {
      var t = me.t;
      cP = [me.P[0] + Math.sin(t * 0.6) * 0.04, me.P[1] + Math.sin(t * 1.1) * 0.025, me.P[2]];
      var T = [me.lx, 3.0 + me.ly, -3.5], f = [T[0] - cP[0], T[1] - cP[1], T[2] - cP[2]], l = Math.hypot(f[0], f[1], f[2]) || 1;
      cF = [f[0] / l, f[1] / l, f[2] / l];
      var r = [-cF[2], 0, cF[0]], rl = Math.hypot(r[0], r[1], r[2]) || 1;
      cR = [r[0] / rl, r[1] / rl, r[2] / rl];
      cU = [cR[1] * cF[2] - cR[2] * cF[1], cR[2] * cF[0] - cR[0] * cF[2], cR[0] * cF[1] - cR[1] * cF[0]];
      g.save();
      if (me.shake > 0.02) g.translate((Math.random() - 0.5) * 12 * me.shake, (Math.random() - 0.5) * 12 * me.shake);
      drawHall(t); drawOverlay(t); g.restore();
    }

    me.raf = requestAnimationFrame(frame);
    setTimeout(function () { if (G === me && !me.stop && me.state === "wait") openSeats(); }, 450);
  }

  // ---------- 入口：排节目 / 我的春晚 ----------
  SF.gala = {
    play: play,
    open: async function () {
      var L = SF.layer(SF.appRoot, "自制春晚", { full: true, k: "GALA", key: "gala" });
      if (!L) return;
      var view = "home", busy = false, chars = [], shows = [], st = { sel: [], n: 5, mode: "preset", pitch: [], pitchText: "", addText: "" }, draft = null;

      function pickedRoster() { return chars.filter(function (c) { return st.sel.indexOf(c.id) >= 0; }); }
      function castNames(p) { var rs = chars; return p.cast.map(function (id) { var c = rs.filter(function (x) { return x.id === id; })[0]; return c ? SF.cname(c) : "TA"; }).join("、"); }
      function fmt(t) { var d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate(); }

      function render() {
        if (!L.alive) return;
        var h = "", i;
        if (view === "home") {
          h += '<div class="sfg-hero"><small>NEW YEAR GALA</small><b>自制春晚</b><p>排节目、选座位，看角色头像在台上演出</p></div>';
          h += '<button class="sfb block" data-a="new" type="button">排一台新春晚</button>';
          h += "<h4>我的春晚 · " + shows.length + "</h4>";
          h += shows.length ? '<div class="sf-card">' + shows.map(function (s, k) {
            return '<div class="sfg-pc"><div class="sfg-pb"><strong>' + SF.esc(s.title) + "</strong><em>" + fmt(s.t) + " · " + s.programs.length + " 个节目 · " + (s.mode === "ai" ? "AI 编排" : "预设") + "</em></div>" +
              '<div class="sfg-pa"><span data-v="' + k + '">回看</span><span data-del="' + k + '">删除</span></div></div>';
          }).join("") + "</div>" : '<p class="tip">还没有春晚。点上面的按钮排一台，演完会自动存在这里。</p>';
        } else if (view === "setup") {
          h += '<h4>参加的角色（选 2 到 6 位）</h4>' + (chars.length ? SF.chipRow(chars.map(function (c) { return '<span class="sfchip' + (st.sel.indexOf(c.id) >= 0 ? " on" : "") + '" data-c="' + SF.esc(c.id) + '">' + SF.esc(SF.cname(c)) + "</span>"; }).join("")) : '<p class="tip">没有读取到角色</p>');
          h += '<h4>节目数</h4><div class="sf-seg">' + [4, 5, 6].map(function (n) { return '<span data-n="' + n + '" class="' + (st.n === n ? "on" : "") + '">' + n + " 个</span>"; }).join("") + "</div>";
          h += '<h4>怎么排</h4><div class="sf-seg"><span data-m="preset" class="' + (st.mode === "preset" ? "on" : "") + '">预设（免费）</span><span data-m="ai" class="' + (st.mode === "ai" ? "on" : "") + '">AI 编排</span></div>';
          h += '<p class="tip" style="margin-top:8px">' + (st.mode === "ai" ? "AI 编排：先出大纲 1 次，你确认后再写台词、特效和角色反应 1 次，共 2 次。" : "预设：用现成的节目和台词，不调 AI。") + "</p>";
          h += '<h4>我想看的节目（可选，最多 3 个）</h4><div class="sfrow"><input type="text" class="sfg-pi" maxlength="10" placeholder="比如：猜拳大赛" value="' + SF.esc(st.pitchText) + '" style="flex:1"><button class="sfb sm ghost" data-a="addpitch" type="button">添加</button></div>';
          if (st.pitch.length) h += '<div style="margin-top:10px">' + st.pitch.map(function (p, k) { return '<span class="sfchip on" data-x="' + k + '">《' + SF.esc(p) + "》 ✕</span>"; }).join("") + "</div>";
          h += '<button class="sfb block" style="margin-top:18px" data-a="gen" type="button">生成节目单</button><div style="text-align:center;margin-top:10px"><span class="sf-lnk" data-a="home">返回</span></div>';
        } else if (view === "outline" && draft) {
          h += '<h4>晚会标题</h4><input type="text" class="sfg-ti" maxlength="10" value="' + SF.esc(draft.title) + '">';
          h += "<h4>节目单 · " + draft.programs.length + " 个</h4>" + (draft.programs.length ? '<div class="sf-card">' + draft.programs.map(function (p, k) {
            return '<div class="sfg-pc"><div class="sfg-pn"><b>' + (k + 1) + '</b></div><div class="sfg-pb"><strong>《' + SF.esc(p.name) + "》</strong><em>" + SF.esc(p.kind) + " · " + SF.esc(castNames(p)) + "</em>" + (p.blurb ? "<p>" + SF.esc(p.blurb) + "</p>" : "") + '</div><div class="sfg-pa"><span data-u="' + k + '">↑</span><span data-d="' + k + '">↓</span><span data-r="' + k + '">删</span></div></div>';
          }).join("") + "</div>" : '<p class="tip">节目单是空的，加一个吧。</p>');
          h += '<h4>再加一个我想看的</h4><div class="sfrow"><input type="text" class="sfg-ai" maxlength="10" placeholder="节目名" value="' + SF.esc(st.addText) + '" style="flex:1"><button class="sfb sm ghost" data-a="addprog" type="button">加入</button></div>';
          h += '<button class="sfb block" style="margin-top:18px" data-a="make" type="button">' + (st.mode === "ai" ? "确认，生成台词（AI 1 次）" : "确认，进场看春晚") + '</button>';
          h += '<div class="sfrow" style="justify-content:center;gap:22px;margin-top:10px"><span class="sf-lnk" data-a="regen">重新排' + (st.mode === "ai" ? "（AI 1 次）" : "") + '</span><span class="sf-lnk" data-a="setup">返回设置</span></div>';
        }
        L.body.innerHTML = h; SF.fadeRows(L.body);
        var a = L.body.querySelector(".sfg-pi"); if (a) a.oninput = function () { st.pitchText = a.value; };
        var b = L.body.querySelector(".sfg-ai"); if (b) b.oninput = function () { st.addText = b.value; };
        var c = L.body.querySelector(".sfg-ti"); if (c) c.oninput = function () { if (draft) draft.title = c.value; };
      }
      async function saveCfg() { await SF.st.set("gala_cfg", { sel: st.sel, n: st.n, mode: st.mode }); }
      async function genOutline() {
        var roster = pickedRoster();
        if (roster.length < 2) { SF.toast("至少选 2 位角色"); return; }
        if (roster.length > 6) { SF.toast("最多选 6 位角色"); return; }
        await saveCfg();
        if (st.mode === "ai") {
          if (busy) return;
          if (!(await SF.confirm("调用 AI", "让 AI 排节目大纲，会消耗 1 次 AI。之后你确认了才会写台词。继续吗？"))) return;
          busy = true; var btn = L.body.querySelector('[data-a="gen"],[data-a="regen"]'); if (btn) btn.textContent = "排节目中…";
          try { draft = await aiOutline(roster, st); } catch (e) { SF.toast("失败：" + (e.message || e)); busy = false; render(); return; }
          busy = false;
        } else draft = presetOutline(roster, st);
        view = "outline"; render();
      }
      async function makeShow() {
        if (busy || !draft) return;
        if (!draft.programs.length) { SF.toast("节目单是空的"); return; }
        var roster = pickedRoster(), show;
        if (st.mode === "ai") {
          if (!(await SF.confirm("调用 AI", "让 AI 把 " + draft.programs.length + " 个节目的台词、特效、弹幕和角色反应一次写好，会消耗 1 次 AI。继续吗？"))) return;
          busy = true; var btn = L.body.querySelector('[data-a="make"]'); if (btn) { btn.disabled = true; btn.textContent = "写台词中…"; }
          try { show = await aiScript(roster, draft); } catch (e) { SF.toast("失败：" + (e.message || e)); busy = false; render(); return; }
          busy = false;
        } else show = presetScript(roster, draft);
        shows.unshift(show); shows = shows.slice(0, 6); await SF.st.set("gala_shows", shows);
        view = "home"; draft = null; render();
        play(show, 0);
      }
      function detail(s) {
        var D = SF.layer(SF.appRoot, s.title, { k: "GALA", key: "galaDetail" }); if (!D) return;
        D.body.innerHTML = '<button class="sfb block" data-p="0" type="button">从头看</button><h4>节目单</h4><div class="sf-card">' + s.programs.map(function (p, k) {
          return '<div class="sfg-pc"><div class="sfg-pn"><b>' + (k + 1) + '</b></div><div class="sfg-pb"><strong>《' + SF.esc(p.name) + "》</strong><em>" + SF.esc(p.kind) + " · " + SF.esc(p.cast.map(function (id) { return nameIn(s.roster, id); }).join("、")) + "</em>" + (p.blurb ? "<p>" + SF.esc(p.blurb) + "</p>" : "") + '</div><div class="sfg-pa"><span data-p="' + k + '">从这开始</span></div></div>';
        }).join("") + "</div>";
        D.body.addEventListener("click", function (e) {
          var a = e.target.closest("[data-p]"); if (!a) return;
          SF.audio.unlock(); D.close(true); play(s, +a.dataset.p);
        });
      }

      L.body.addEventListener("click", async function (e) {
        var a = e.target.closest("[data-a],[data-c],[data-n],[data-m],[data-x],[data-u],[data-d],[data-r],[data-v],[data-del]"); if (!a) return;
        var d = a.dataset, k;
        if (d.c) { k = st.sel.indexOf(d.c); if (k >= 0) st.sel.splice(k, 1); else st.sel.push(d.c); render(); }
        else if (d.n) { st.n = +d.n; render(); }
        else if (d.m) { st.mode = d.m; render(); }
        else if (d.x != null) { st.pitch.splice(+d.x, 1); render(); }
        else if (d.u != null) { k = +d.u; if (k > 0) { var t = draft.programs[k]; draft.programs[k] = draft.programs[k - 1]; draft.programs[k - 1] = t; } render(); }
        else if (d.d != null) { k = +d.d; if (k < draft.programs.length - 1) { var t2 = draft.programs[k]; draft.programs[k] = draft.programs[k + 1]; draft.programs[k + 1] = t2; } render(); }
        else if (d.r != null) { draft.programs.splice(+d.r, 1); render(); }
        else if (d.v != null) { SF.audio.unlock(); detail(shows[+d.v]); }
        else if (d.del != null) {
          if (!(await SF.confirm("删除春晚", "确定删除这台春晚吗？"))) return;
          shows.splice(+d.del, 1); await SF.st.set("gala_shows", shows); render();
        }
        else if (d.a === "new" || d.a === "setup") { view = "setup"; render(); }
        else if (d.a === "home") { view = "home"; render(); }
        else if (d.a === "addpitch") {
          var v = clean(st.pitchText, 10); if (!v) return;
          if (st.pitch.length >= 3) { SF.toast("最多 3 个"); return; }
          st.pitch.push(v); st.pitchText = ""; render();
        }
        else if (d.a === "addprog") {
          var nmv = clean(st.addText, 10); if (!nmv) return;
          var ids = pickedRoster().map(function (c) { return c.id; }), c1 = SF.pick(ids), cast = [c1];
          if (ids.length > 1 && Math.random() < 0.5) { var c2 = SF.pick(ids.filter(function (x) { return x !== c1; })); cast.push(c2); }
          draft.programs.push({ name: nmv, kind: "小品", cast: cast, blurb: "观众点播的节目", pr: -1 }); st.addText = ""; render();
        }
        else if (d.a === "gen" || d.a === "regen") genOutline();
        else if (d.a === "make") makeShow();
      });

      chars = await SF.chars();
      shows = (await SF.st.get("gala_shows", [])) || [];
      var cfg = await SF.st.get("gala_cfg", null);
      if (cfg) { st.n = cfg.n || 5; st.mode = cfg.mode || "preset"; st.sel = (cfg.sel || []).filter(function (id) { return chars.some(function (c) { return c.id === id; }); }); }
      if (!st.sel.length) st.sel = chars.slice(0, 3).map(function (c) { return c.id; });
      render();
    }
  };

  SF.cssApp.push(`
.sfg-hero{margin:0 0 16px}.sfg-hero small{display:block;font-size:10px;letter-spacing:6px;color:var(--k)}
.sfg-hero b{display:block;margin-top:8px;font:200 40px/1.1 -apple-system,"PingFang SC",sans-serif;color:var(--big);letter-spacing:.12em}
.sfg-hero p{margin:8px 0 0;font-size:12.5px;color:var(--k)}
.sfg-pc{display:flex;gap:12px;align-items:flex-start;padding:12px 2px;border-bottom:1px solid var(--hair)}
.sf-card .sfg-pc:last-child{border-bottom:0}
.sfg-pn b{display:block;width:26px;height:26px;border-radius:50%;border:1px solid var(--cbd);text-align:center;font:600 13px/24px sans-serif;color:var(--ctx)}
.sfg-pb{flex:1;min-width:0}.sfg-pb strong{display:block;font-size:15px;font-weight:600;color:var(--tx)}
.sfg-pb em{display:block;margin-top:2px;font-style:normal;font-size:11.5px;color:var(--k)}
.sfg-pb p{margin:4px 0 0;font-size:12.5px;line-height:1.6;color:var(--tx)}
.sfg-pa{display:flex;flex-direction:column;gap:6px}
.sfg-pa span{padding:3px 9px;text-align:center;border-radius:8px;border:1px solid var(--cbd);font-size:12px;color:var(--ctx);white-space:nowrap}
.sfg-stg{margin:6px auto 10px;width:76%;padding:5px 0;text-align:center;border-radius:6px;font-size:11px;letter-spacing:.5em;color:var(--ctx);border:1px solid var(--cbd);background:var(--cbg)}
.sfg-sr{display:flex;align-items:center;justify-content:center;gap:4px;margin:4px 0}
.sfg-sr u{width:14px;margin-right:2px;text-decoration:none;font-size:10px;text-align:right;color:var(--k)}
.sfg-s{display:block;width:18px;height:18px;border-radius:6px 6px 4px 4px;border:1px solid var(--cbd);background:var(--cbg)}
.sfg-s.on{background:var(--btn);border-color:transparent;box-shadow:0 0 8px var(--acc)}
.sfg-gap{display:block;width:14px}
.sfg-g{position:absolute;inset:0;background:#07030a;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;color:#fff3dc}
.sfg-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.sfg-top{position:absolute;left:0;right:0;top:0;z-index:5;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 0 max(14px,env(safe-area-inset-left));pointer-events:none}
.sfg-x,.sfg-bt{pointer-events:auto;flex:0 0 auto;height:36px;min-width:36px;padding:0 12px;border-radius:18px;border:1px solid rgba(255,215,122,.55);background:rgba(36,10,20,.55);color:#ffd77a;font-size:13px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.sfg-x{padding:0;width:36px;font-size:14px}
.sfg-now{flex:1;min-width:0;text-align:center;padding:4px 10px;border-radius:14px;background:rgba(36,10,20,.45)}
.sfg-now small{display:block;font-size:10px;letter-spacing:.3em;color:rgba(255,243,220,.7)}
.sfg-now b{display:block;font:600 14px/1.3 "Songti SC","STSong",serif;color:#ffd77a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sfg-ban{position:absolute;left:0;right:0;top:38%;z-index:6;text-align:center;padding:0 20px;font:600 26px/1.3 "Songti SC","STSong",serif;letter-spacing:.24em;color:#ffe29a;text-shadow:0 0 18px rgba(255,150,80,.85);opacity:0;pointer-events:none}
.sfg-ban.on{animation:sfgBan 2.6s ease-out}
@keyframes sfgBan{0%{opacity:0;transform:scale(.75)}12%{opacity:1;transform:scale(1.04)}75%{opacity:1}100%{opacity:0;transform:scale(1)}}
.sfg-sub{position:absolute;left:5%;right:5%;bottom:calc(74px + env(safe-area-inset-bottom));z-index:6;padding:10px 14px;border-radius:14px;text-align:center;background:rgba(20,6,16,.78);border:1px solid rgba(255,215,122,.4);opacity:0;transition:opacity .25s,transform .25s;pointer-events:none}
.sfg-sub.on{opacity:1}
.sfg-sub.dim{opacity:.3;transform:scale(.94)}
.sfg-sub small{display:block;margin-bottom:3px;font-size:12px;color:#ffd77a}
.sfg-sub p{margin:0;font-size:15px;line-height:1.6}
.sfg-wait{position:absolute;left:0;right:0;bottom:calc(84px + env(safe-area-inset-bottom));z-index:6;text-align:center}
.sfg-wait .sfb{padding:13px 44px;letter-spacing:.3em}
.sfg-wait p{margin:10px 0 0;font-size:12px;color:rgba(255,243,220,.75)}
.sfg-bar{position:absolute;left:0;right:0;bottom:0;z-index:7;display:flex;gap:8px;align-items:center;padding:30px max(12px,env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:linear-gradient(transparent,rgba(7,3,10,.88))}
.sfg-bar input{flex:1;min-width:0;border:1px solid rgba(255,215,122,.4);background:rgba(20,8,16,.7);color:#fff3dc;border-radius:18px;padding:9px 14px;font-size:14px;outline:0}
.sfg-bar input::placeholder{color:rgba(255,243,220,.5)}
.sfg-pz{flex:0 0 36px;height:36px;padding:0;border-radius:50%;border:1px solid rgba(255,215,122,.55);background:rgba(36,10,20,.55);color:#ffd77a;font-size:14px}
.sfg-end{position:absolute;inset:0;z-index:9;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:rgba(10,4,12,.72)}
.sfg-end.on{display:flex}
.sfg-end small{font-size:10px;letter-spacing:.5em;color:#dca898}
.sfg-end h3{margin:10px 0 4px;font:600 28px/1.3 "Songti SC","STSong",serif;letter-spacing:.3em;color:#ffe29a}
.sfg-end p{margin:0;font-size:13px;color:rgba(255,243,220,.8)}
.sfg-eb{display:flex;gap:10px;margin-top:22px}
`);
})(window.__SF);

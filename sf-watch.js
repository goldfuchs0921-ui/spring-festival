/* 守岁：倒计时 + 愿望烟花 + 零点多角色语音（语音提前合成并保存，播放不再花钱） */
(function (SF) {
  "use strict";
  var busy = false, subEl = null;

  async function cfgGet() { return await SF.st.get("zero_cfg", { sel: [], mode: "preset" }); }

  function showSub(v, manual) {
    var root = SF.appRoot; if (!root) return Promise.resolve();
    if (subEl) subEl.remove();
    subEl = SF.h("div", "sfw-sub");
    subEl.innerHTML = (v.name ? "<small>" + SF.esc(v.name) + "</small>" : "") + "<p>" + SF.esc(v.text) + "</p>" + (v.zh ? "<p class=\"zh\">" + SF.esc(v.zh) + "</p>" : "") + (manual ? '<button class="sfb sm">点这里播放</button>' : "");
    root.appendChild(subEl);
    if (!manual) return Promise.resolve();
    return new Promise(function (res) {
      subEl.querySelector("button").onclick = function () { res(true); };
      setTimeout(function () { res(false); }, 30000);
    });
  }
  function hideSub() { if (subEl) { subEl.remove(); subEl = null; } }

  // 零点：大烟花 + 依次播放已保存的语音
  async function midnight() {
    if (busy) return; busy = true;
    try {
      SF.fx.stop(); SF.fx.finale(18000); SF.fx.text("新春快乐");
      var cfg = await cfgGet(), played = 0;
      for (var i = 0; i < cfg.sel.length; i++) {
        var v = await SF.st.get("zv_" + cfg.sel[i], null);
        if (!v || !v.audio) continue;
        showSub(v, false);
        var ok = await SF.audio.play(v.audio);
        if (!ok) { var tap = await showSub(v, true); if (tap) ok = await SF.audio.play(v.audio); }
        if (ok) played++;
        await SF.wait(800);
      }
      hideSub();
      if (!played) { showSub({ name: "", text: "新春快乐，万事胜意！" }, false); await SF.wait(3500); hideSub(); }
    } finally { busy = false; }
  }

  // 为一个角色合成并保存零点语音
  async function prepare(char, mode) {
    var lang = (char.tts && char.tts.language) || "Chinese", zh = SF.isZh(lang), text = "", tr = "";
    if (mode === "ai") {
      var me = await SF.userName();
      var q = zh
        ? "现在是除夕零点，请你用自己的口吻，对「" + me + "」说一段新年祝福，口语化，2到3句，总共不超过70字。只输出 JSON：{\"speech\":\"祝福正文\"}"
        : "现在是除夕零点，请你用自己的口吻，对「" + me + "」说一段新年祝福。用" + lang + "写 speech（口语化，2到3句），并在 zh 里给出中文翻译。只输出 JSON：{\"speech\":\"\",\"zh\":\"\"}";
      var raw = await SF.ai("你是" + SF.cname(char) + "。" + SF.persona(char), q, 0.9);
      var j = SF.parseJson(raw);
      text = String((j && j.speech) || raw).trim(); tr = zh ? "" : String((j && j.zh) || "").trim();
    } else { text = SF.pick(SF.data.zero); lang = "Chinese"; }
    if (!text) throw new Error("没有拿到祝福文字");
    var url = await SF.tts(char, text, lang);
    var data = await SF.toData(url);
    var rec = { id: char.id, name: SF.cname(char), text: text, zh: tr, lang: lang, audio: data || url, volatile: !data, ts: Date.now() };
    await SF.st.set("zv_" + char.id, rec);
    return rec;
  }

  SF.watch = {
    midnight: midnight,
    open: async function () {
      var L = SF.layer(SF.appRoot, "守岁", { half: true, onClose: function () { clearInterval(tk); } });
      var chars = await SF.chars(), cfg = await cfgGet(), voices = {}, tk = 0;
      L.body.innerHTML = '<div class="sfw-cd"><small>距新春零点</small><b>--</b></div>' +
        '<div class="sfrow"><input type="text" maxlength="16" placeholder="写一句愿望，变成烟花（16字内）"><button class="sfb sm" data-a="wish">放烟花</button></div>' +
        "<h4>零点祝福</h4>" +
        '<p class="tip">零点到来时，选中的角色会依次开口。语音提前合成并保存在本机，零点和预演都直接播放，不再花钱。</p>' +
        '<div class="sfw-src"></div><div class="sfw-list"></div>' +
        '<div class="sfrow" style="margin-top:10px;flex-wrap:wrap"><button class="sfb sm" data-a="make">合成选中角色的语音</button><button class="sfb sm ghost" data-a="rehearse">预演零点</button></div>';
      var cdEl = L.body.querySelector(".sfw-cd b"), input = L.body.querySelector("input");
      function tick() {
        var left = SF.TARGET - SF.now();
        cdEl.textContent = left > 0 ? SF.fmtLeft(left) : "新春快乐";
      }
      tick(); tk = setInterval(tick, 1000);

      async function render() {
        for (var i = 0; i < chars.length; i++) voices[chars[i].id] = await SF.st.get("zv_" + chars[i].id, null);
        var okv = {}; for (var k = 0; k < chars.length; k++) okv[chars[k].id] = await SF.hasVoice(chars[k]);
        L.body.querySelector(".sfw-src").innerHTML = '<span class="sfchip' + (cfg.mode === "preset" ? " on" : "") + '" data-m="preset">预设祝福（免费）</span><span class="sfchip' + (cfg.mode === "ai" ? " on" : "") + '" data-m="ai">角色自己写（每人 AI 1 次）</span>';
        L.body.querySelector(".sfw-list").innerHTML = chars.map(function (c) {
          var v = voices[c.id], on = cfg.sel.indexOf(c.id) >= 0;
          var st = !okv[c.id] ? "缺 Voice ID" : v ? (v.volatile ? "已合成（未能永久保存）" : "已合成") : "未合成";
          return '<div class="sfw-r"><span class="sfchip' + (on ? " on" : "") + '" data-s="' + SF.esc(c.id) + '">' + SF.esc(SF.cname(c)) + "</span><small>" + st + "</small>" +
            (v ? '<button class="sfb sm ghost" data-p="' + SF.esc(c.id) + '">试听</button><button class="sfb sm ghost" data-x="' + SF.esc(c.id) + '">清除</button>' : "") + "</div>";
        }).join("") || '<p class="tip">没有读取到角色</p>';
      }
      L.body.addEventListener("click", async function (e) {
        var a = e.target.closest("[data-a],[data-m],[data-s],[data-p],[data-x]"); if (!a) return;
        SF.audio.unlock();
        if (a.dataset.m) { cfg.mode = a.dataset.m; await SF.st.set("zero_cfg", cfg); render(); }
        else if (a.dataset.s) {
          var i = cfg.sel.indexOf(a.dataset.s); if (i >= 0) cfg.sel.splice(i, 1); else cfg.sel.push(a.dataset.s);
          await SF.st.set("zero_cfg", cfg); render();
        }
        else if (a.dataset.p) { var v = voices[a.dataset.p]; if (v) { showSub(v, false); await SF.audio.play(v.audio); hideSub(); } }
        else if (a.dataset.x) { await SF.st.del("zv_" + a.dataset.x); render(); }
        else if (a.dataset.a === "wish") {
          var t = input.value.trim(); if (!t) { SF.toast("先写一句愿望"); return; }
          SF.fx.text(t); input.value = ""; if (SF.fortune) SF.fortune.award("wish");
        }
        else if (a.dataset.a === "rehearse") { midnight(); }
        else if (a.dataset.a === "make") {
          var picks = chars.filter(function (c) { return cfg.sel.indexOf(c.id) >= 0; });
          if (!picks.length) { SF.toast("先点选至少一位角色"); return; }
          var n = picks.length, ai = cfg.mode === "ai";
          if (!(await SF.confirm("合成语音", "将为 " + n + " 位角色合成语音：语音合成 " + n + " 次" + (ai ? "，AI 写祝福 " + n + " 次" : "（使用预设祝福，不调 AI）") + "。已合成的会被覆盖。继续吗？"))) return;
          a.disabled = true;
          for (var j = 0; j < picks.length; j++) {
            a.textContent = "合成中 " + (j + 1) + "/" + n;
            try { await prepare(picks[j], cfg.mode); }
            catch (err) { SF.toast(SF.cname(picks[j]) + "：" + (err.message || err)); }
          }
          a.disabled = false; a.textContent = "合成选中角色的语音"; SF.toast("合成完成"); render();
        }
      });
      render();
    }
  };

  SF.cssApp.push([
    ".sfw-cd{text-align:center;margin:2px 0 12px}.sfw-cd small{display:block;font-size:11.5px;color:rgba(255,243,220,.65)}",
    '.sfw-cd b{font:700 26px/1.3 "STKaiti","KaiTi","Songti SC",serif;color:#ffd77a;letter-spacing:.08em;font-variant-numeric:tabular-nums}',
    ".sfw-r{display:flex;align-items:center;gap:8px;margin-bottom:6px}.sfw-r .sfchip{margin:0}.sfw-r small{flex:1;font-size:11.5px;color:rgba(255,243,220,.6)}",
    ".sfw-sub{position:absolute;left:5%;right:5%;bottom:calc(12% + env(safe-area-inset-bottom));z-index:60;padding:14px 16px;border-radius:14px;text-align:center;background:rgba(36,10,20,.82);border:1px solid rgba(255,215,122,.5);color:#fff3dc}",
    ".sfw-sub small{display:block;margin-bottom:4px;font-size:12px;color:#ffd77a}.sfw-sub p{margin:0;font-size:15px;line-height:1.7}.sfw-sub p.zh{margin-top:6px;font-size:12.5px;color:rgba(255,243,220,.75)}.sfw-sub .sfb{margin-top:10px}"
  ].join("\n"));
})(window.__SF);

/* 测试面板（左下角小棚）：不用等时间、不花额度就能测大部分功能 */
(function (SF) {
  "use strict";
  var PER = [["auto", "自动"], ["morning", "清晨"], ["noon", "正午"], ["dusk", "黄昏"], ["night", "夜晚"]];

  SF.test = {
    open: function () {
      var L = SF.layer(SF.appRoot, "测试面板", { full: true, k: "TEST" });
      L.body.innerHTML =
        '<h4>场景时段预览</h4><div data-g="per">' + PER.map(function (p) { return '<span class="sfchip" data-per="' + p[0] + '">' + p[1] + "</span>"; }).join("") + "</div>" +
        "<h4>时间</h4><p class=\"tip\">把时间拨到零点前 10 秒，回首页等倒计时走完，就能看到真实的零点效果。</p>" +
        '<div class="sfrow" style="flex-wrap:wrap"><button class="sfb sm" data-a="t10">拨到零点前10秒</button><button class="sfb sm ghost" data-a="treal">恢复真实时间</button><button class="sfb sm" data-a="mid">立刻预演零点</button></div>' +
        "<h4>福卡</h4>" +
        '<div class="sfrow" style="flex-wrap:wrap"><button class="sfb sm" data-a="extra">额外抽一张</button><button class="sfb sm" data-a="fill">发满五福</button><button class="sfb sm ghost" data-a="day">重置今日任务</button><button class="sfb sm ghost" data-a="fzero">福卡清零</button></div>' +
        "<h4>音效试听</h4>" +
        "<div>" + [["launch", "升空"], ["burst", "爆炸"], ["demo", "连放10次"], ["text", "文字烟花"], ["packet", "拆红包"], ["flip", "福卡"], ["snip", "剪纸"], ["save", "保存"]].map(function (s) { return '<span class="sfchip" data-a="snd_' + s[0] + '">' + s[1] + "</span>"; }).join("") + "</div>" +
        "<h4>清理数据</h4>" +
        '<div class="sfrow" style="flex-wrap:wrap"><button class="sfb sm ghost" data-a="cv">清空语音缓存</button><button class="sfb sm ghost" data-a="crp">清空红包记录</button><button class="sfb sm ghost" data-a="cpool">清空祝福池</button><button class="sfb sm ghost" data-a="ccut">清空作品墙</button></div>' +
        "<h4>存储自检</h4>" +
        '<p class="tip">检查存储是否正常。红包是在聊天里发的，如果发完回首页红包摊看不到记录，说明聊天和 App 的存储没有互通，请告诉我。</p>' +
        '<div class="sfrow"><button class="sfb sm" data-a="self">自检</button></div>' +
        '<p class="tip" style="margin-top:22px">新春年味 v' + SF.VER + "　GoldFuchs &amp; Claude</p>";

      function mark() {
        [].forEach.call(L.body.querySelectorAll("[data-per]"), function (n) {
          n.classList.toggle("on", (SF.forcePeriod || "auto") === n.dataset.per);
        });
      }
      mark();
      L.body.addEventListener("click", async function (e) {
        var n = e.target.closest("[data-per],[data-a]"); if (!n) return;
        SF.audio.unlock();
        if (n.dataset.per) {
          SF.forcePeriod = n.dataset.per === "auto" ? null : n.dataset.per; mark();
          if (SF.app) SF.app.refreshScene(); SF.toast("场景：" + n.textContent); return;
        }
        var a = n.dataset.a;
        if (a && a.indexOf("snd_") === 0) { if (SF.sfx && SF.sfx[a.slice(4)]) SF.sfx[a.slice(4)](); return; }
        if (a === "t10") { SF.offset = SF.TARGET - 10000 - Date.now(); SF.toast("已拨到零点前10秒，回首页看倒计时"); L.close(); if (SF.app) SF.app.refreshScene(); }
        else if (a === "treal") { SF.offset = 0; SF.toast("已恢复真实时间"); if (SF.app) SF.app.refreshScene(); }
        else if (a === "mid") { L.close(); SF.watch.midnight(); }
        else if (a === "extra") { await SF.fortune.testExtra(); }
        else if (a === "fill") { await SF.fortune.testFill(); SF.toast("五福已发满"); }
        else if (a === "day") { await SF.fortune.testDay(); SF.toast("今日任务已重置"); }
        else if (a === "fzero") { if (await SF.confirm("福卡清零", "确定清空所有福卡和新年大礼吗？")) { await SF.fortune.testReset(); SF.toast("已清零"); } }
        else if (a === "cv") {
          if (!(await SF.confirm("清空语音", "已保存的零点语音会被删除，再用就要重新合成（花一次语音费用）。继续吗？"))) return;
          var cs = await SF.chars(); for (var i = 0; i < cs.length; i++) await SF.st.del("zv_" + cs[i].id); SF.toast("语音缓存已清空");
        }
        else if (a === "crp") { await SF.st.del("rp_records"); SF.toast("红包记录已清空"); }
        else if (a === "cpool") { var c2 = await SF.chars(); for (var j = 0; j < c2.length; j++) await SF.st.del("rp_pool_" + c2[j].id); SF.toast("祝福池已清空"); }
        else if (a === "ccut") { if (await SF.confirm("清空作品墙", "所有窗花作品会被删除。继续吗？")) { await SF.st.del("cuts"); SF.toast("已清空"); } }
        else if (a === "self") {
          var ok = await SF.st.set("selftest", { t: Date.now() }), back = await SF.st.get("selftest", null);
          await SF.st.del("selftest");
          SF.toast(ok && back ? "存储正常" : "存储异常：写入或读取失败");
        }
      });
    }
  };
})(window.__SF);

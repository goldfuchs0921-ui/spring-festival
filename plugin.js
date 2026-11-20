/* 新春年味 · 入口文件（只负责加载模块 + 注册，很少需要改）
 * 改了任何模块文件：把下面 VER 加一，manifest.json 里的 version 也同步加一。
 * 仓库名/用户名不同：只改下面 BASE 这一行。 */
(function () {
  "use strict";
  var BASE = "https://raw.githubusercontent.com/goldfuchs0921-ui/spring-festival/main/";
  var VER = "1.0.0";
  var MODULES = [
    "sf-data.js", "sf-core.js", "sf-fireworks.js", "sf-fortune.js",
    "sf-redpacket.js", "sf-papercut.js", "sf-watch.js", "sf-test.js", "sf-app.js"
  ];

  var SF = (window.__SF = { BASE: BASE, VER: VER, loadError: null });

  function loadOne(name) {
    return fetch(BASE + name + "?v=" + VER)
      .then(function (r) {
        if (!r.ok) throw new Error(name + " 加载失败 (" + r.status + ")");
        return r.text();
      })
      .then(function (code) {
        return new Promise(function (resolve, reject) {
          var url = URL.createObjectURL(new Blob([code + "\n//# sourceURL=" + name], { type: "text/javascript" }));
          var s = document.createElement("script");
          s.onload = function () { URL.revokeObjectURL(url); s.remove(); resolve(); };
          s.onerror = function () {
            URL.revokeObjectURL(url); s.remove();
            try { (0, eval)(code); resolve(); } catch (e) { reject(e); }
          };
          s.src = url;
          document.head.appendChild(s);
        });
      });
  }

  var ready = MODULES.reduce(function (p, n) {
    return p.then(function () { return loadOne(n); });
  }, Promise.resolve()).catch(function (e) {
    SF.loadError = e;
    console.error("[spring-festival]", e);
  });

  function failBox(c) {
    c.innerHTML = '<div style="padding:40px 24px;color:#fff3dc;text-align:center;line-height:1.8">' +
      "模块加载失败，请检查网络后重新打开。<br><small>" + String((SF.loadError && SF.loadError.message) || "未知错误") +
      '</small><br><button id="sf-back" style="margin-top:18px;padding:8px 20px">返回</button></div>';
    var b = c.querySelector("#sf-back");
    if (b) b.onclick = function () { try { window.Roche.ui.closeApp(); } catch (e) {} };
  }

  var RP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M5 9c4 3 10 3 14 0"/><circle cx="12" cy="12.5" r="1.6"/></svg>';

  window.RochePlugin.register({
    id: "spring-festival",
    name: "新春年味",
    version: VER,
    apps: [{
      id: "spring-festival-home",
      name: "新春年味",
      icon: "redeem",
      iconImage: "",
      async mount(container, roche) {
        await ready;
        if (SF.loadError || !SF.app) return failBox(container);
        return SF.app.mount(container, roche);
      },
      async unmount(container, roche) {
        try { if (SF.app) SF.app.unmount(container, roche); } catch (e) {}
        container.replaceChildren();
      }
    }],
    chat: {
      messageTypes: [
        {
          id: "red-packet", name: "新春红包",
          mount: function (c, m, r) { c.textContent = ""; ready.then(function () { if (SF.rp) SF.rp.mountCard(c, m, r); }); },
          unmount: function () {}
        },
        {
          id: "paper-cut", name: "新春窗花",
          mount: function (c, m, r) { c.textContent = ""; ready.then(function () { if (SF.pc) SF.pc.mountCard(c, m, r); }); },
          unmount: function () {}
        }
      ],
      plusActions: [{
        id: "send-red-packet",
        label: "新春红包",
        iconSvg: RP_ICON,
        async open(ctx, roche) {
          await ready;
          if (SF.rp) return SF.rp.openSheet(ctx, roche);
        }
      }]
    }
  });
})();

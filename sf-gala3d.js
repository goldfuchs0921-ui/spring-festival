/* 春晚的 3D 剧院（three.js）：沿用 1.3.0 的建模（金绢横匾、台毯、帘幕、翼幕、八字墙、扇形看台）。
 * v1.9.1：光照重做——舞台由台口面光 / 顶光 / 追光照亮，观众席保持昏暗；去掉全场自发光和加色光晕，避免光污染。
 * 这里只负责“画面”。台上头像、观众、灯光、魔术箱等，由 sf-gala.js 每帧通过 create() 返回的接口告诉它。
 * 想改亮度：改下面 BRIGHT；想改灯笼数量：改 LANTERNS。 */
(function (SF) {
  "use strict";
  var CZ = -9.6, SY = 0.72, ROWS = 9;
  var COLS = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6], EXTRA = [-9, -8, -7, 7, 8, 9], ALL = COLS.concat(EXTRA);
  var BOX3 = { BL: [-11.6, 5.4, -0.5], BR: [11.6, 5.4, -0.5], UM: [0, 6.8, 12.4] };
  var BRIGHT = 1.0;                  // 整体亮度（越大越亮）；1.0 为喜庆但不过曝的基准
  var ACW = 320, ACH = 380;          // 台上头像牌子的画布大小；头像圆心在 (160,150)，半径 105
  var LANTERNS = [[-10, -3], [-5, -3], [5, -3], [10, -3], [-10, 2.5], [-5, 2.5], [5, 2.5], [10, 2.5], [-10, 8], [-5, 8], [5, 8], [10, 8], [-10, 13], [-5, 13], [5, 13], [10, 13], [0, 0], [0, 6], [0, 12]];

  // 游戏坐标（舞台地面 y=1.2、后台 z=-8）→ 3D 剧院坐标（台面 y=0.72、舞台中心 z≈-10）
  function g2t(x, y, z) { return [x, y - 0.48, z - 5.8]; }
  function seatPos(r, c) { var rho = 11 + r * 1.05, a = c / rho; return { x: rho * Math.sin(a), z: CZ + rho * Math.cos(a), yaw: a, T: 0.48 + r * 0.27 }; }
  function eye(key) {
    if (BOX3[key]) return BOX3[key].slice();
    var p = String(key).split(","), s = seatPos(+p[0], +p[1]);
    return [s.x, s.T + 1.35, s.z];
  }
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return n >>> 0; }

  function create(T, canvas, opt) {
    opt = opt || {};
    var W = 1, H = 1, k;
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(opt.dpr || 1, 1.45));
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92 + 0.12 * BRIGHT;
    var scene = new T.Scene();
    scene.background = new T.Color(0x26130f); scene.fog = new T.Fog(0x26130f, 40, 82);
    var camera = new T.PerspectiveCamera(60, 1, 0.1, 120);

    // ---------- 材质：颜色降一档，明暗交给真实灯光 ----------
    var matCache = {};
    function M(c, r, m) { var key = c + "/" + (r == null ? 0.82 : r) + "/" + (m || 0); if (!matCache[key]) matCache[key] = new T.MeshStandardMaterial({ color: c, roughness: r == null ? 0.82 : r, metalness: m || 0 }); return matCache[key]; }
    var wall = M(0x6e3c28), wallPanel = M(0x8c4a30), wood = M(0x6a4028), woodMid = M(0x8f5c34), woodLite = M(0xa87448), dark = M(0x332017);
    var gold = M(0xd8ad58, 0.5, 0.35), goldDark = M(0xa87e3c, 0.55, 0.3), stageFloor = M(0x625349);
    var red = new T.MeshStandardMaterial({ color: 0xb22230, roughness: 0.92, emissive: 0x2a060a, emissiveIntensity: 0.22, side: T.DoubleSide });
    var seatBlack = M(0x4a2822), seatRed = new T.MeshStandardMaterial({ color: 0xba2838, roughness: 0.88, emissive: 0x1c0508, emissiveIntensity: 0.18 }), seatRed2 = M(0xcf4858);
    var glowMat = new T.MeshBasicMaterial({ color: 0xb98a55 });
    var tierMat = new T.MeshStandardMaterial({ color: 0x684031, roughness: 0.92, emissive: 0x160b06, emissiveIntensity: 0.18, side: T.DoubleSide });
    var boxGeo = new T.BoxGeometry(1, 1, 1);
    function box(parent, material, pos, scale) { var o = new T.Mesh(boxGeo, material); o.position.set(pos[0], pos[1], pos[2]); o.scale.set(scale[0], scale[1], scale[2]); parent.add(o); return o; }
    function plane(parent, material, w, h, pos, ry) { var o = new T.Mesh(new T.PlaneGeometry(w, h), material); o.position.set(pos[0], pos[1], pos[2]); o.rotation.y = ry || 0; parent.add(o); return o; }

    // ---------- 程序化贴图（运行时画出来，没有图片请求） ----------
    function tex(w, h, fn) {
      var c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h);
      var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 2; return t;
    }
    var KAI = '"STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif SC",serif';
    var goldSilk = tex(512, 128, function (g, w, h) {
      g.fillStyle = "#b3893c"; g.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 3) { g.fillStyle = y % 6 ? "rgba(255,238,190,.06)" : "rgba(80,46,12,.06)"; g.fillRect(0, y, w, 1); }
      var l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, "rgba(60,30,8,.3)"); l.addColorStop(0.4, "rgba(255,230,160,.12)"); l.addColorStop(0.7, "rgba(255,240,180,.2)"); l.addColorStop(1, "rgba(60,30,8,.3)");
      g.fillStyle = l; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(255,226,150,.85)"; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = "#8f1420"; g.font = "700 76px " + KAI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("新春晚会", w / 2, h / 2 + 4);
    });
    var carpet = tex(512, 320, function (g, w, h) {
      g.fillStyle = "#8a1c27"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < w; i += 18) { g.fillStyle = "rgba(0,0,0,.04)"; g.fillRect(i, 0, 2, h); }
      var vg = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.6); vg.addColorStop(0, "rgba(255,200,160,.08)"); vg.addColorStop(1, "rgba(0,0,0,.2)"); g.fillStyle = vg; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#e6bd6a"; g.lineWidth = 4; g.strokeRect(18, 18, w - 36, h - 36);
      g.strokeStyle = "rgba(230,189,106,.65)"; g.lineWidth = 1.5; g.strokeRect(29, 29, w - 58, h - 58);
      g.strokeStyle = "rgba(240,200,120,.85)"; g.lineWidth = 2.5;
      [0, 1].forEach(function (sx) { [0, 1].forEach(function (sy) {
        var x = sx ? w : 0, y = sy ? h : 0, dx = sx ? -1 : 1, dy = sy ? -1 : 1;
        g.beginPath(); g.moveTo(x + dx * 34, y + dy * 34); g.lineTo(x + dx * 34, y + dy * 66); g.lineTo(x + dx * 66, y + dy * 66);
        g.moveTo(x + dx * 40, y + dy * 40); g.lineTo(x + dx * 56, y + dy * 40); g.lineTo(x + dx * 56, y + dy * 56); g.lineTo(x + dx * 46, y + dy * 56); g.stroke();
      }); });
      g.strokeStyle = "rgba(240,200,120,.95)"; g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2, h / 2, 78, 54, 0, 0, Math.PI * 2); g.stroke();
    });
    var clothTex = tex(512, 512, function (g, w, h) {
      g.fillStyle = "#9c2030"; g.fillRect(0, 0, w, h);
      var n = 20, step = w / n;
      for (var i = 0; i < n; i++) {
        var x = i * step, q = Math.sin((i + 0.5) / n * Math.PI * 2 - Math.PI / 2);
        g.fillStyle = "rgba(0,0,0," + (0.13 - q * 0.1).toFixed(3) + ")"; g.fillRect(x, 0, step * 0.55, h);
        g.fillStyle = "rgba(255,215,175," + (0.05 + q * 0.08).toFixed(3) + ")"; g.fillRect(x + step * 0.55, 0, step * 0.22, h);
      }
      var v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, "rgba(0,0,0,.22)"); v.addColorStop(0.16, "rgba(0,0,0,0)"); v.addColorStop(0.55, "rgba(255,215,175,.07)"); v.addColorStop(1, "rgba(0,0,0,.24)");
      g.fillStyle = v; g.fillRect(0, 0, w, h);
    });
    var valanceTex = tex(512, 128, function (g, w, h) {
      g.fillStyle = "#9c2030"; g.fillRect(0, 0, w, h);
      var n = 44, step = w / n;
      for (var i = 0; i < n; i++) { var x = i * step; g.fillStyle = "rgba(0,0,0,.05)"; g.fillRect(x, 0, step * 0.5, h); g.fillStyle = "rgba(255,215,180,.04)"; g.fillRect(x + step * 0.5, 0, step * 0.3, h); }
      var v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, "rgba(0,0,0,.16)"); v.addColorStop(0.3, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.14)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    });
    var medTex = tex(256, 256, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = "rgba(240,200,120,.95)"; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.arc(128, 128, 96, 0, Math.PI * 2); g.stroke(); g.lineWidth = 2;
      for (var i = 0; i < 24; i++) { var a = i * Math.PI / 12; g.beginPath(); g.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); g.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108); g.stroke(); }
      g.fillStyle = "#f0cc78"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 110px " + KAI; g.fillText("福", 128, 136);
    });
    function vertText(str, col) {
      return tex(128, 512, function (g, w, h) {
        g.fillStyle = "#1c1210"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(230,189,106,.8)"; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
        g.fillStyle = col; g.font = "bold 58px " + KAI; g.textAlign = "center"; g.textBaseline = "middle";
        for (var i = 0; i < str.length; i++) g.fillText(str.charAt(i), w / 2, 52 + i * 62);
      });
    }
    function shadowTexture() {
      return tex(128, 128, function (g, w, h) { var r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(0,0,0,.55)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    }
    function texMat(t) { return new T.MeshStandardMaterial({ map: t, roughness: 0.9, side: T.DoubleSide }); }
    var goldSilkMat = new T.MeshStandardMaterial({ map: goldSilk, roughness: 0.92, emissive: 0x3a280e, emissiveIntensity: 0.14, side: T.DoubleSide });
    var carpetMat = texMat(carpet);
    var valanceMat = new T.MeshStandardMaterial({ map: valanceTex, roughness: 0.95, emissive: 0x1a0305, emissiveIntensity: 0.1, side: T.DoubleSide });
    var curtainMat = new T.MeshStandardMaterial({ map: clothTex, roughness: 0.95, emissive: 0x220509, emissiveIntensity: 0.18, side: T.DoubleSide });
    var curtainDeep = new T.MeshStandardMaterial({ map: clothTex, color: 0xb0b0b0, roughness: 0.95, side: T.DoubleSide });
    var medMat = new T.MeshStandardMaterial({ map: medTex, transparent: true, depthWrite: false, roughness: 0.8, side: T.DoubleSide });

    function flatCloth(w, h) {
      var g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, -w / 2, -h, 0, w / 2, -h, 0], 3));
      g.setAttribute("uv", new T.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
      g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals(); return g;
    }
    function tierGeo(ri, ro, h, a0, a1, seg) {
      var pos = [], idx = [];
      function V(r, a, y) { return [r * Math.sin(a), y, CZ + r * Math.cos(a)]; }
      function quad(A, B, C, D) { var o = pos.length / 3; pos.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2], D[0], D[1], D[2]); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
      for (var i = 0; i < seg; i++) {
        var a = a0 + (a1 - a0) * i / seg, b = a0 + (a1 - a0) * (i + 1) / seg;
        quad(V(ri, a, h), V(ro, a, h), V(ro, b, h), V(ri, b, h)); quad(V(ro, a, 0), V(ro, a, h), V(ro, b, h), V(ro, b, 0)); quad(V(ri, a, 0), V(ri, b, 0), V(ri, b, h), V(ri, a, h));
      }
      quad(V(ri, a0, 0), V(ro, a0, 0), V(ro, a0, h), V(ri, a0, h)); quad(V(ri, a1, 0), V(ri, a1, h), V(ro, a1, h), V(ro, a1, 0));
      var g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }

    // ---------- 一、剧院外壳 ----------
    // 环境光只负责“还能看清轮廓”，亮度主要来自下面几盏有位置的舞台灯
    var lightsHemi = new T.HemisphereLight(0xf0cba8, 0x503324, 1.18), lightsAmb = new T.AmbientLight(0xffd9ae, 0.30);
    scene.add(lightsHemi, lightsAmb);
    box(scene, M(0x40281e), [0, -0.25, -3], [28, 0.5, 34]);
    box(scene, new T.MeshStandardMaterial({ color: 0x5c1820, roughness: 0.95, emissive: 0x180508, emissiveIntensity: 0.08 }), [0, 0.01, 4.5], [1.7, 0.02, 24]);   // 过道红地毯
    var ceiling = new T.Group(); scene.add(ceiling);
    // 天花板改为深棕哑光木，不再自发光：仰视时不会被灯打出大片白斑
    box(ceiling, new T.MeshStandardMaterial({ color: 0x523724, roughness: 0.97, emissive: 0x140c06, emissiveIntensity: 0.16 }), [0, 11, -3], [28, 0.45, 34]);
    box(scene, wall, [-14, 5.35, -3], [0.45, 11, 34]); box(scene, wall, [14, 5.35, -3], [0.45, 11, 34]);
    box(scene, wall, [0, 5.35, -20], [28, 11, 0.45]); box(scene, wall, [0, 5.35, 14], [28, 11, 0.45]);
    var s, z, x;
    for (s = -1; s <= 1; s += 2) {
      x = s * 13.72;
      box(scene, wood, [x, 1, -3], [0.16, 1.7, 33]); box(scene, woodMid, [x, 2.05, -3], [0.2, 0.12, 33]);
      for (z = -17; z <= 11; z += 3.5) { box(scene, wallPanel, [x - s * 0.04, 4.8, z], [0.12, 4.9, 2.45]); box(scene, woodLite, [x - s * 0.12, 4.8, z - 1.27], [0.12, 5.1, 0.09]); box(scene, woodLite, [x - s * 0.12, 4.8, z + 1.27], [0.12, 5.1, 0.09]); }
      [-13, -7, 0, 7, 12].forEach(function (zz) {
        box(scene, wood, [s * 13.35, 4.4, zz], [0.42, 1.15, 0.42]); box(scene, goldDark, [s * 13.35, 4.4, zz], [0.46, 0.07, 0.46]);
        box(scene, glowMat, [s * 13.35 - s * 0.24, 4.45, zz], [0.035, 0.66, 0.23]); box(scene, gold, [s * 13.35 - s * 0.29, 4.82, zz], [0.08, 0.08, 0.31]);
      });
    }
    var ceilBeam = M(0x7a5232);
    for (z = -18; z <= 12; z += 3.4) box(ceiling, ceilBeam, [0, 10.68, z], [27.4, 0.12, 0.22]);
    for (x = -13; x <= 13; x += 4.3) box(ceiling, ceilBeam, [x, 10.68, -3], [0.2, 0.12, 32.5]);
    for (x = -10; x <= 10; x += 2.5) { box(scene, wallPanel, [x, 5.2, -19.72], [2.25, 7.9, 0.08]); box(scene, woodLite, [x - 1.12, 5.2, -19.62], [0.07, 8, 0.1]); }
    box(scene, wood, [0, 9.2, -19.55], [16, 0.18, 0.22]); box(scene, gold, [0, 9.05, -19.52], [10, 0.035, 0.08]);
    var backWall = new T.MeshStandardMaterial({ color: 0x53321f, roughness: 0.94, emissive: 0x1c1008, emissiveIntensity: 0.14 });
    box(scene, backWall, [0, 5.4, 13.74], [27.4, 8.6, 0.16]);
    for (x = -12.4; x <= 12.4; x += 2.48) box(scene, woodMid, [x, 5.4, 13.62], [0.09, 8.2, 0.1]);
    box(scene, wood, [0, 2.4, 13.55], [27, 0.2, 0.24]); box(scene, woodMid, [0, 1.15, 13.6], [27, 2.1, 0.16]); box(scene, woodMid, [0, 9.4, 13.55], [27, 0.14, 0.18]);

    // ---------- 二、舞台 ----------
    var stageZ = -10.2;
    box(scene, dark, [0, 0.15, stageZ], [13.6, 0.85, 7]); box(scene, stageFloor, [0, 0.62, stageZ], [13.15, 0.18, 6.65]);
    box(scene, woodMid, [0, 0.3, -6.72], [13.5, 0.62, 0.34]); box(scene, gold, [0, 0.62, -6.52], [13.35, 0.09, 0.09]);
    for (k = 0; k < 3; k++) box(scene, woodMid, [0, 0.18 + k * 0.13, -5.95 + k * 0.48], [9.4 + k * 1.1, 0.25, 0.48]);
    [-6.65, 6.65].forEach(function (px) {
      box(scene, wood, [px, 4.45, -7.9], [0.72, 8.1, 1.05]); box(scene, woodLite, [px, 4.45, -7.34], [0.13, 7.75, 0.12]);
      box(scene, gold, [px, 8.35, -7.9], [0.95, 0.22, 1.25]); box(scene, gold, [px, 0.55, -7.9], [0.95, 0.18, 1.25]); box(scene, woodMid, [px, 4.45, -7.1], [0.22, 7.35, 0.15]);
    });
    box(scene, wood, [0, 8.35, -7.9], [14.1, 0.65, 1.15]); box(scene, gold, [0, 7.98, -7.25], [13.9, 0.12, 0.14]);
    box(scene, woodMid, [0, 7.75, -7.32], [13.2, 0.28, 0.25]); box(scene, wallPanel, [0, 7.45, -7.25], [12.9, 0.35, 0.18]); box(scene, goldDark, [0, 8.45, -7.28], [12.3, 0.035, 0.04]);
    box(scene, wallPanel, [0, 4.35, -13.35], [12.7, 7.6, 0.3]); box(scene, dark, [0, 4.35, -13.18], [11.9, 6.9, 0.1]);
    [-1, 1].forEach(function (sd) {
      box(scene, M(0x8a1c2a), [sd * 4.35, 3.85, -13.02], [2.05, 5.9, 0.08]); box(scene, goldDark, [sd * 4.35, 0.9, -12.97], [2.05, 0.06, 0.05]); box(scene, dark, [sd * 3.22, 4.0, -12.9], [0.34, 6.4, 0.12]);
    });
    box(scene, red, [0, 4.3, -12.86], [6.1, 6.7, 0.08]); box(scene, goldDark, [0, 7.66, -12.8], [6.15, 0.06, 0.05]); box(scene, goldDark, [0, 0.94, -12.8], [6.15, 0.06, 0.05]);
    box(scene, M(0x4a1c22), [0, 8.15, -13.0], [11.9, 1.5, 0.14]);
    var carpetPlane = new T.Mesh(new T.PlaneGeometry(9.4, 5.3), carpetMat); carpetPlane.rotation.x = -Math.PI / 2; carpetPlane.position.set(0, 0.718, -10.35); scene.add(carpetPlane);
    plane(scene, medMat, 1.55, 1.55, [0, 5.6, -12.78]);
    for (k = 0; k < 9; k++) box(scene, gold, [-5.8 + k * 1.45, 0.75, -6.53], [0.22, 0.06, 0.1]);
    plane(scene, goldSilkMat, 9.4, 2.0, [0, 8.75, -6.88]);
    box(scene, gold, [0, 7.72, -6.86], [9.7, 0.06, 0.08]); box(scene, gold, [0, 9.78, -6.86], [9.7, 0.06, 0.08]);

    // ---------- 三、侧台：翼幕 + 封墙 + 八字墙（八字墙上挂对联牌） ----------
    var plaqueR = new T.MeshBasicMaterial({ map: vertText("歌声笑语迎新岁", "#f2cc7a") }), plaqueL = new T.MeshBasicMaterial({ map: vertText("锣鼓烟花贺吉祥", "#f2cc7a") });
    [-1, 1].forEach(function (sd) {
      box(scene, wallPanel, [sd * 6.95, 4.3, -10.7], [0.42, 8.6, 6.4]); box(scene, curtainDeep, [sd * 6.7, 4.3, -10.7], [0.06, 8.0, 6.4]);
      box(scene, woodMid, [sd * 6.7, 8.05, -10.7], [0.34, 0.2, 6.4]); box(scene, woodMid, [sd * 6.7, 0.78, -10.7], [0.34, 0.2, 6.4]);
      [{ x: 6.05, z: -7.75, w: 1.1 }, { x: 5.35, z: -11.35, w: 1.25 }].forEach(function (d, i) {
        var px = sd * d.x, w = d.w, h = 6.5, top = 0.7 + h;
        box(scene, dark, [px, 3.9, d.z - 0.16], [w + 0.18, h, 0.22]);
        var m = new T.Mesh(flatCloth(w, h), i ? curtainDeep : curtainMat); m.position.set(px, top, d.z + 0.12); scene.add(m);
        box(scene, goldDark, [px, 0.85, d.z + 0.14], [w + 0.16, 0.06, 0.05]);
      });
      var ax = sd * 6.65, az = -7.9, bx = sd * 12.0, bz = -5.4, dxw = bx - ax, dzw = bz - az, len = Math.hypot(dxw, dzw), ang = Math.atan2(dxw, dzw);
      var wa = new T.Group(); wa.position.set((ax + bx) / 2, 4.3, (az + bz) / 2); wa.rotation.y = ang; scene.add(wa);
      box(wa, wallPanel, [0, 0, 0], [0.26, 8.6, len]); box(wa, wood, [0, 3.1, 0.14], [0.32, 0.12, len - 0.3]); box(wa, goldDark, [0, 3.18, 0.15], [0.34, 0.03, len - 0.35]);
      box(wa, woodMid, [0, -3.1, 0.14], [0.32, 0.14, len - 0.3]);
      for (k = -2; k <= 2; k++) box(wa, woodLite, [0, 0, k * len / 5.5], [0.3, 6.2, 0.08]);
      var pl = new T.Mesh(new T.PlaneGeometry(1.1, 4.6), sd > 0 ? plaqueR : plaqueL); pl.position.set(sd > 0 ? -0.16 : 0.16, 0.5, 0); pl.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2; wa.add(pl);
    });
    var valance = new T.Mesh(flatCloth(13.5, 0.95), valanceMat); valance.position.set(0, 8.02, -6.72); scene.add(valance);

    // ---------- 四、可开合主幕 ----------
    var left = new T.Group(), right = new T.Group(); scene.add(left, right);
    left.add(new T.Mesh(flatCloth(6.05, 6.45), curtainMat)); right.add(new T.Mesh(flatCloth(6.05, 6.45), curtainMat));
    [-1, 1].forEach(function (sd) { var m = new T.Mesh(flatCloth(0.62, 6.3), curtainMat); m.position.set(sd * 6.02, 7.15, -7.18); scene.add(m); });
    function setCurtain(p) {
      var w = 6.05 * (1 - p) + 0.62 * p; left.scale.x = w / 6.05; right.scale.x = w / 6.05;
      left.position.set(-6.05 + w / 2, 7.15, -7.18); right.position.set(6.05 - w / 2, 7.15, -7.18);
    }
    setCurtain(0);

    // ---------- 五、红灯笼（只靠环境光，不加光晕精灵） ----------
    var lanMat = new T.MeshStandardMaterial({ color: 0xc42c28, roughness: 0.88, emissive: 0x4a0a0a, emissiveIntensity: 0.28 });
    var lanGeo = new T.SphereGeometry(0.42, 10, 8), lanCap = M(0xc9a052, 0.55, 0.25), lanPole = M(0x5a3a22);
    LANTERNS.forEach(function (p) {
      var ly = 8.3, m = new T.Mesh(lanGeo, lanMat); m.position.set(p[0], ly, p[1]); m.scale.set(1, 1.15, 1); scene.add(m);
      box(scene, lanCap, [p[0], ly + 0.5, p[1]], [0.3, 0.1, 0.3]); box(scene, lanCap, [p[0], ly - 0.52, p[1]], [0.18, 0.08, 0.18]);
      box(scene, lanCap, [p[0], ly - 0.95, p[1]], [0.05, 0.5, 0.05]); box(scene, lanPole, [p[0], (10.7 + ly + 0.5) / 2, p[1]], [0.03, 10.7 - ly - 0.5, 0.03]);
    });

    // ---------- 六、观众席：扇形台阶 + 椅子 + 观众的头（实例化，调用次数很少） ----------
    var r, i;
    for (r = 0; r < ROWS; r++) {
      var rho = 11 + r * 1.05, h = 0.48 + r * 0.27;
      scene.add(new T.Mesh(tierGeo(rho - 0.525, rho + 0.525, h, -0.95, 0.95, 48), tierMat));
      var edge = new T.Mesh(new T.RingGeometry(rho - 0.525, rho - 0.46, 56, 1, Math.PI / 2 - 0.95, 1.9), goldDark);
      edge.rotation.x = -Math.PI / 2; edge.position.set(0, h + 0.008, CZ); scene.add(edge);
    }

    // ---------- 七、灯光：台口面光 / 舞台顶光 / 追光负责舞台，后墙洗光只给观众席一点轮廓 ----------
    var keyL = new T.SpotLight(0xffd6a6, 46, 22, Math.PI / 4.8, 0.96, 1.5); keyL.position.set(-3.2, 8.5, -7.62); keyL.target.position.set(-1.0, 1.3, -10.5);
    var keyR = new T.SpotLight(0xffd6a6, 46, 22, Math.PI / 4.8, 0.96, 1.5); keyR.position.set(3.2, 8.5, -7.62); keyR.target.position.set(1.0, 1.3, -10.5);
    var topLight = new T.PointLight(0xffd0a0, 11, 15, 1.7); topLight.position.set(0, 7.2, -10.6);
    var houseWash = new T.SpotLight(0xe8c49a, 12, 34, Math.PI / 3.2, 0.96, 1.4); houseWash.position.set(0, 8.8, 12.4); houseWash.target.position.set(0, 1.0, 2);
    var hallWarm = new T.PointLight(0xffc890, 6, 24, 1.6); hallWarm.position.set(0, 8.4, 4);
    var follow = new T.SpotLight(0xffe6b8, 52, 24, Math.PI / 7.5, 0.62, 1.5); follow.position.set(0, 9, -7.5); follow.target.position.set(0, 0.8, -9.8);
    scene.add(keyL, keyL.target, keyR, keyR.target, topLight, houseWash, houseWash.target, hallWarm, follow, follow.target);

    // ---------- 八、静态几何按材质合并，调用次数大幅减少 ----------
    function mergeGeos(geos) {
      var vc = 0, ic = 0, g, a;
      geos.forEach(function (gg) { vc += gg.attributes.position.count; ic += gg.index ? gg.index.count : gg.attributes.position.count; });
      var P = new Float32Array(vc * 3), N = new Float32Array(vc * 3), U = new Float32Array(vc * 2), I = vc > 65535 ? new Uint32Array(ic) : new Uint16Array(ic), vo = 0, io = 0, n, j;
      geos.forEach(function (gg) {
        n = gg.attributes.position.count; P.set(gg.attributes.position.array, vo * 3);
        if (gg.attributes.normal) N.set(gg.attributes.normal.array, vo * 3);
        if (gg.attributes.uv) U.set(gg.attributes.uv.array, vo * 2);
        if (gg.index) { a = gg.index.array; for (j = 0; j < a.length; j++) I[io + j] = a[j] + vo; io += a.length; }
        else { for (j = 0; j < n; j++) I[io + j] = vo + j; io += n; }
        vo += n;
      });
      g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(P, 3)); g.setAttribute("normal", new T.BufferAttribute(N, 3)); g.setAttribute("uv", new T.BufferAttribute(U, 2)); g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
    }
    function bake(node) {
      var buckets = [], mats = [], kill = [];
      node.children.slice().forEach(function (c) {
        if (c.userData && c.userData.keep) return;
        if (c.isMesh && !c.isInstancedMesh) {
          c.updateMatrix(); var g = c.geometry.clone(); g.applyMatrix4(c.matrix);
          var bi = mats.indexOf(c.material); if (bi < 0) { mats.push(c.material); buckets.push([]); bi = mats.length - 1; }
          buckets[bi].push(g); kill.push(c);
        } else if (c.children && c.children.length) bake(c);
      });
      kill.forEach(function (c) { c.parent.remove(c); });
      mats.forEach(function (mat, bi) { var m = new T.Mesh(mergeGeos(buckets[bi]), mat); m.userData.keep = true; node.add(m); });
    }
    bake(scene);

    // 观众席（烘焙之后再建，因为要实例化）
    var dummy = new T.Object3D(), ZERO = new T.Matrix4().makeScale(0, 0, 0);
    var shared = [
      { g: new T.BoxGeometry(0.92, 0.18, 0.82), m: seatBlack, o: [0, 0.54, 0] }, { g: new T.BoxGeometry(0.84, 0.22, 0.68), m: seatRed, o: [0, 0.69, -0.04] },
      { g: new T.BoxGeometry(0.14, 0.48, 0.78), m: seatBlack, o: [-0.49, 0.88, -0.02] }, { g: new T.BoxGeometry(0.14, 0.48, 0.78), m: seatBlack, o: [0.49, 0.88, -0.02] },
      { g: new T.BoxGeometry(0.9, 0.075, 0.13), m: seatRed2, o: [0, 1.66, 0.35] }
    ];
    var geoBack = new T.BoxGeometry(0.86, 0.92, 0.2), geoHead = new T.SphereGeometry(0.17, 10, 8);
    function place(cc, rr, o) {
      var sp = seatPos(rr, cc), base = sp.T - 0.45, yaw = sp.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
      dummy.position.set(sp.x + o[0] * cs + o[2] * sn, base + o[1], sp.z - o[0] * sn + o[2] * cs); dummy.rotation.set(0, yaw, 0); dummy.updateMatrix(); return dummy.matrix.clone();
    }
    var sharedMats = shared.map(function () { return []; });
    var rowBack = [], rowHead = [], backMats = [], headMats = [], headMx = [], occ = {}, hidden = {}, hair = [0x30201f, 0x45291f, 0x1c1618, 0x5a3a28], guestKeys = {};
    (opt.guestKeys || []).forEach(function (kk) { guestKeys[kk] = 1; });
    for (r = 0; r < ROWS; r++) {
      headMx[r] = [];
      for (i = 0; i < ALL.length; i++) {
        var cc = ALL[i], key = r + "," + cc;
        shared.forEach(function (p, pi) { sharedMats[pi].push(place(cc, r, p.o)); });
        occ[key] = guestKeys[key] ? true : (hash(r * 131 + cc * 17 + 7) % 100 < 62);
        headMx[r].push(place(cc, r, [0, 1.75, 0.0]));
      }
      var bm = new T.MeshStandardMaterial({ color: 0xb02434, roughness: 0.88, emissive: 0x1c0508, emissiveIntensity: 0.12 }), hm = new T.MeshStandardMaterial({ color: 0xe4cdb8, roughness: 0.9, emissive: 0x140b08, emissiveIntensity: 0.1 });
      backMats.push(bm); headMats.push(hm);
      var bb = new T.InstancedMesh(geoBack, bm, ALL.length), hh = new T.InstancedMesh(geoHead, hm, ALL.length);
      for (i = 0; i < ALL.length; i++) {
        bb.setMatrixAt(i, place(ALL[i], r, [0, 1.17, 0.31]));
        hh.setMatrixAt(i, occ[r + "," + ALL[i]] ? headMx[r][i] : ZERO); hh.setColorAt(i, new T.Color(hair[hash(r * 7 + ALL[i]) % hair.length]));
      }
      bb.instanceMatrix.needsUpdate = true; hh.instanceMatrix.needsUpdate = true; if (hh.instanceColor) hh.instanceColor.needsUpdate = true; scene.add(bb); scene.add(hh); rowBack.push(bb); rowHead.push(hh);
    }
    shared.forEach(function (p, pi) {
      var mesh = new T.InstancedMesh(p.g, p.m, sharedMats[pi].length);
      sharedMats[pi].forEach(function (m, mi) { mesh.setMatrixAt(mi, m); }); mesh.instanceMatrix.needsUpdate = true; scene.add(mesh);
    });

    // 标题牌（红幕上方的蓝金横带）
    if (opt.title) {
      var tt = tex(512, 96, function (g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = "#f6d684"; g.font = "bold 58px " + KAI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(opt.title).slice(0, 12), w / 2, h / 2 + 3); });
      var tm = new T.Mesh(new T.PlaneGeometry(6.4, 1.2), new T.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false })); tm.position.set(0, 7.0, -12.78); tm.userData.keep = true; scene.add(tm);
    }

    // ---------- 追光光柱 ----------
    var coneMats = [], cones = [], cg = new T.CylinderGeometry(0.12, 1, 1, 20, 1, true);
    for (i = 0; i < 3; i++) {
      var cm = new T.MeshBasicMaterial({ color: 0xc9a878, transparent: true, opacity: 0.02, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), cn = new T.Mesh(cg, cm); cn.userData.keep = true; scene.add(cn); cones.push(cn); coneMats.push(cm);
    }
    var UP = new T.Vector3(0, 1, 0), vFrom = new T.Vector3(), vTo = new T.Vector3(), vDir = new T.Vector3();
    function placeCone(m, from, to, rb) {
      vFrom.set(from[0], from[1], from[2]); vTo.set(to[0], to[1], to[2]); vDir.copy(vFrom).sub(vTo); var len = vDir.length(); vDir.normalize();
      m.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2); m.quaternion.setFromUnitVectors(UP, vDir); m.scale.set(rb, len, rb);
    }

    // ---------- 台上头像牌 / 影子 / 魔术箱 / 舞狮布 / 观众头像牌 ----------
    var actors = {}, shadowT = shadowTexture(), guests = {}, emptyState = {};
    function mkTexture(canvas2) { var t = new T.CanvasTexture(canvas2); t.colorSpace = T.SRGBColorSpace; return t; }
    function getActor(id, cv) {
      var A = actors[id]; if (A) return A;
      // depthTest 关掉：演员是台上主角，不能被幕布/翼幕/合并后的静态几何遮掉
      var t = mkTexture(cv), sp = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false })); sp.renderOrder = 6; scene.add(sp);
      var sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shadowT, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1; scene.add(sh);
      A = actors[id] = { sprite: sp, shadow: sh, tex: t, seen: false }; return A;
    }
    var boxGroup = new T.Group(), boxMesh = new T.Mesh(boxGeo, new T.MeshStandardMaterial({ color: 0x33203c, roughness: 0.65, emissive: 0x100818, emissiveIntensity: 0.15 }));
    var clothMesh = new T.Mesh(boxGeo, new T.MeshStandardMaterial({ color: 0xb82432, roughness: 0.85, emissive: 0x2a050a, emissiveIntensity: 0.15 }));
    var bandMesh = new T.Mesh(boxGeo, gold);
    boxGroup.visible = false; boxGroup.add(boxMesh); boxGroup.add(clothMesh); boxGroup.add(bandMesh); scene.add(boxGroup);
    var lionSprite = null, lionTex = null;

    var api = {
      g2t: g2t,
      resize: function (w, h, dpr) {
        W = w; H = h; renderer.setPixelRatio(Math.min(dpr || 1, 1.45)); renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.fov = camera.aspect < 0.95 ? 84 : 60; camera.updateProjectionMatrix();
      },
      // pos 是眼睛位置，yaw/pit 是在“看向舞台”基础上再转的角度，offY 把画面整体往上推（选座抽屉打开时用）
      setView: function (pos, yaw, pit, offY) {
        var dx = -pos[0], dy = 3.2 - pos[1], dz = -10.2 - pos[2], l = Math.hypot(dx, dy, dz) || 1;
        var y0 = Math.atan2(dx / l, -dz / l), p0 = Math.asin(dy / l), Y = y0 + yaw, P = Math.max(-1.5, Math.min(1.5, p0 + pit));
        camera.position.set(pos[0], pos[1], pos[2]);
        camera.lookAt(pos[0] + Math.sin(Y) * Math.cos(P), pos[1] + Math.sin(P), pos[2] - Math.cos(Y) * Math.cos(P));
        if (offY) camera.setViewOffset(W, H, 0, offY, W, H); else camera.clearViewOffset();
        camera.updateMatrixWorld(true); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      },
      setCurtain: setCurtain,
      // k：整体亮度（0.4~1.4）；mood：灯光颜色；spotX：追光跟着谁（游戏坐标 x）；narrow：单人追光
      setLights: function (kk, mood, spotX, narrow) {
        var f = Math.max(0.3, Math.min(1.5, kk)), sx = spotX * 0.8 + 0, rb = narrow ? 1.0 : 1.7;
        renderer.toneMappingExposure = (0.92 + 0.12 * BRIGHT) * (0.78 + 0.22 * f);
        lightsHemi.intensity = 1.18 * (0.62 + 0.38 * f); lightsAmb.intensity = 0.30 * (0.6 + 0.4 * f);
        keyL.intensity = 46 * f; keyR.intensity = 46 * f; topLight.intensity = 11 * f;
        hallWarm.intensity = 6 * (0.5 + 0.5 * f); houseWash.intensity = 12 * (0.6 + 0.4 * f);
        follow.intensity = 52 * f * (narrow ? 1.3 : 1); follow.angle = narrow ? Math.PI / 11 : Math.PI / 7.5;
        follow.position.set(sx * 0.4, 9, -7.5); follow.target.position.set(sx, 0.8, -9.8);
        follow.color.setRGB(Math.min(1, 0.55 + mood[0] / 580), Math.min(1, 0.55 + mood[1] / 580), Math.min(1, 0.55 + mood[2] / 580));
        var tops = [[-3.8, 8.6, -7.0], [0, 8.8, -7.0], [3.8, 8.6, -7.0]];
        for (i = 0; i < 3; i++) {
          var tx = tops[i][0] * 0.35 + sx * 0.65;
          placeCone(cones[i], tops[i], [tx, SY + 0.02, -9.8], rb + (i === 1 ? 0.3 : 0));
          // 光柱只留极淡的一层，不再叠出大片亮粉色三角
          coneMats[i].color.setRGB(mood[0] / 255 * 0.55, mood[1] / 255 * 0.55, mood[2] / 255 * 0.55);
          coneMats[i].opacity = 0.012 + 0.018 * Math.max(0, f - 0.3);
        }
      },
      beginActors: function () { for (var id in actors) actors[id].seen = false; },
      // o: {x,y,z(游戏坐标的头像圆心), R, sx, opacity, rot, canvas, shadow(0~1)}
      setActor: function (id, o) {
        var A = getActor(id, o.canvas), p = g2t(o.x, o.y, o.z), R = (typeof o.R === "number" && o.R > 0.01) ? o.R : 1;
        var op = (typeof o.opacity === "number" && isFinite(o.opacity)) ? Math.max(0, Math.min(1, o.opacity)) : 1;
        var sx = (typeof o.sx === "number" && isFinite(o.sx)) ? o.sx : 1;
        A.seen = true; A.tex.needsUpdate = true; A.sprite.visible = op > 0.01;
        A.sprite.position.set(p[0], p[1] - 0.381 * R, p[2]); A.sprite.scale.set(3.048 * R * Math.max(0.02, Math.abs(sx)), 3.619 * R, 1);
        A.sprite.material.rotation = o.rot || 0; A.sprite.material.opacity = op;
        A.shadow.visible = op > 0.01; A.shadow.position.set(p[0], SY + 0.006, p[2]); A.shadow.scale.set(R * 1.9, R * 0.8, 1); A.shadow.material.opacity = Math.min(1, op) * 0.7;
      },
      endActors: function () { for (var id in actors) if (!actors[id].seen) { actors[id].sprite.visible = false; actors[id].shadow.visible = false; } },
      setBox: function (rise, cloth, lift, xg) {
        var p = g2t(xg, 1.2, -3.0), vis = rise > 0.01; boxGroup.visible = vis; if (!vis) return;
        var hgt = 2.4 * rise; boxMesh.scale.set(2.2, hgt, 1.8); boxMesh.position.set(p[0], SY + hgt / 2, p[2]);
        bandMesh.scale.set(2.26, 0.12, 1.86); bandMesh.position.set(p[0], SY + hgt - 0.06, p[2]);
        var cl = Math.max(cloth, lift); clothMesh.visible = cl > 0.01;
        if (clothMesh.visible) { var ch = hgt * cl + 0.25 * cl; clothMesh.scale.set(2.5, ch, 2.1); clothMesh.position.set(p[0], SY + ch / 2 + lift * 3.2, p[2]); }
      },
      setLionCloth: function (on, canvas, xg, yg, zg, wd, ht) {
        if (!on) { if (lionSprite) lionSprite.visible = false; return; }
        if (!lionSprite) { lionTex = mkTexture(canvas); lionSprite = new T.Sprite(new T.SpriteMaterial({ map: lionTex, transparent: true, depthWrite: false })); lionSprite.renderOrder = 2; scene.add(lionSprite); }
        var p = g2t(xg, yg, zg - 0.01); lionTex.needsUpdate = true; lionSprite.visible = true; lionSprite.position.set(p[0], p[1], p[2]); lionSprite.scale.set(wd, ht, 1);
      },
      // 观众里的“客人”：头顶挂着头像牌；空位时把头隐藏
      setSeatEmpty: function (key, empty) {
        var pr = String(key).split(","), r2 = +pr[0], c2 = +pr[1], ci = ALL.indexOf(c2); if (ci < 0 || r2 < 0 || r2 >= ROWS) return;
        if (emptyState[key] === empty) return; emptyState[key] = empty;
        rowHead[r2].setMatrixAt(ci, empty || !occ[key] ? ZERO : headMx[r2][ci]); rowHead[r2].instanceMatrix.needsUpdate = true;
      },
      setGuest: function (key, o) {
        var G = guests[key];
        if (!G) { var t = mkTexture(o.canvas), sp = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.renderOrder = 4; sp.scale.set(0.56, 0.56, 1); scene.add(sp); G = guests[key] = { sp: sp, tex: t }; }
        G.sp.visible = !!o.visible; if (!o.visible) return;
        if (o.dirty) G.tex.needsUpdate = true;
        var pr = key.split(","), s2 = seatPos(+pr[0], +pr[1]);
        G.sp.position.set(s2.x + (o.dx || 0), s2.T + 1.3 + 0.55 + (o.dy || 0), s2.z);
      },
      // 前面两排观众半透明，不挡视线
      setSeatFade: function (row) {
        for (r = 0; r < ROWS; r++) {
          var op = row >= 0 && (r === row - 1 || r === row - 2) ? 0.3 : 1, tr = op < 1;
          [backMats[r], headMats[r]].forEach(function (mm) { if (mm.opacity !== op) { mm.opacity = op; mm.transparent = tr; mm.depthWrite = !tr; mm.needsUpdate = true; } });
        }
      },
      // 3D 坐标 → 屏幕 [x, y, 每米多少像素]；在镜头后面就返回 null
      project3: function (x, y, z) {
        var v = new T.Vector3(x, y, z); v.applyMatrix4(camera.matrixWorldInverse); if (v.z > -0.3) return null;
        var dist = -v.z; v.applyMatrix4(camera.projectionMatrix);
        return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H, (H * 0.5) / Math.tan(camera.fov * Math.PI / 360) / dist];
      },
      projectGame: function (x, y, z) { var p = g2t(x, y, z); return api.project3(p[0], p[1], p[2]); },
      render: function () { renderer.render(scene, camera); },
      dispose: function () {
        try {
          scene.traverse(function (o) {
            if (o.geometry && o.geometry.dispose) o.geometry.dispose();
            var mm = o.material; if (mm) { (Array.isArray(mm) ? mm : [mm]).forEach(function (m3) { if (m3.map && m3.map.dispose) m3.map.dispose(); if (m3.dispose) m3.dispose(); }); }
          });
          renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
        } catch (e) { /* 忽略 */ }
      },
      canvasSize: { aw: ACW, ah: ACH }
    };
    return api;
  }

  SF.gala3d = { create: create, g2t: g2t, eye: eye, seat: seatPos, AW: ACW, AH: ACH };
})(window.__SF);

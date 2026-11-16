/* trading-bg.js - decorative trading-themed animated background for BOTTY QUANTER.grok.
   Draws on its own fixed canvas, layered just above the starfield (#bg-canvas) and below
   all content: faint grid, scrolling ticker tape, drifting candlestick clusters and a thin
   price line. Ticker prices come from data/latest.json (Coinbase USD quotes) when available,
   otherwise symbols only. Candles and the price line are purely decorative (not market data).
   ~30fps cap, paused when the tab is hidden, one static frame for prefers-reduced-motion. */
(function () {
  "use strict";
  if (window.__tradingBg) return;
  window.__tradingBg = true;

  var SYMBOLS = ["BTC", "ETH", "SOL", "XRP", "DOGE", "AVAX", "LINK", "ADA", "SUI", "PEPE"];
  var FPS = 30, FRAME_MS = 1000 / FPS;

  function start() {
    var canvas = document.createElement("canvas");
    canvas.id = "trading-bg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    var s = canvas.style;
    s.position = "fixed"; s.top = "0"; s.left = "0"; s.right = "0"; s.bottom = "0";
    s.width = "100%"; s.height = "100%";
    s.zIndex = "0"; s.pointerEvents = "none";
    s.filter = "blur(2.5px)"; s.webkitFilter = "blur(2.5px)"; s.opacity = "0.75";
    var ctx = canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) { // no canvas: static SVG fallback
      document.body.style.backgroundImage = "url(bg.svg)";
      document.body.style.backgroundSize = "cover";
      return;
    }
    // Insert right after the starfield canvas so it paints above it but below content (z-index 1).
    var star = document.getElementById("bg-canvas");
    if (star) star.parentNode.insertBefore(canvas, star.nextSibling);
    else document.body.insertBefore(canvas, document.body.firstChild);

    var css = getComputedStyle(document.documentElement);
    function cv(name, fb) { var v = css.getPropertyValue(name); return v ? v.trim() || fb : fb; }
    var C = {
      grid: cv("--border", "#222b3d"), text: cv("--text-2", "#b4bfd0"), muted: cv("--muted", "#7a879c"),
      accent: cv("--accent", "#4f8cff"), accent2: cv("--accent-2", "#7aa7ff"),
      green: cv("--green", "#22c55e"), red: cv("--red", "#ef4444"),
      mono: cv("--mono", "ui-monospace,Menlo,Consolas,monospace")
    };

    var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var W = 0, H = 0, dpr = 1, t = 0, last = 0, acc = 0, raf = 0;
    var quotes = {}; // symbol -> {mid, chg}
    var tapes = [], clusters = [], line = [], lineStep = 6, lineOff = 0;

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function fmtPrice(p) {
      if (typeof p !== "number" || !isFinite(p)) return "";
      if (p >= 1000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (p >= 1) return p.toFixed(p >= 100 ? 2 : 4);
      return p.toPrecision(4);
    }

    function tapeItems() {
      var out = [];
      for (var i = 0; i < SYMBOLS.length; i++) {
        var sym = SYMBOLS[i], q = quotes[sym], label = sym + "-USD", chg = null;
        if (q) {
          var ps = fmtPrice(q.mid);
          if (ps) label += " $" + ps;
          if (typeof q.chg === "number" && isFinite(q.chg)) chg = q.chg;
        }
        out.push({ label: label, chg: chg });
      }
      return out;
    }

    function buildTapes() {
      tapes = [];
      var rows = Math.max(3, Math.min(6, Math.round(H / 170)));
      for (var r = 0; r < rows; r++) {
        tapes.push({
          y: Math.round((r + 0.6) * H / rows),
          speed: (r % 2 ? -1 : 1) * rnd(10, 18), // px/s, alternating direction
          off: rnd(0, 400), size: r % 2 ? 11 : 12
        });
      }
    }

    function makeCluster(x) {
      var n = Math.round(rnd(12, 22)), p = rnd(0.35, 0.65), candles = [];
      for (var i = 0; i < n; i++) {
        var o = p, c = o + rnd(-0.05, 0.05) + (0.5 - o) * 0.04;
        var hi = Math.max(o, c) + rnd(0, 0.025), lo = Math.min(o, c) - rnd(0, 0.025);
        candles.push({ o: o, c: c, h: hi, l: lo }); p = c;
      }
      return { x: x, y: rnd(0.08, 0.78) * H, h: rnd(90, 170), cw: Math.round(rnd(5, 8)),
               speed: rnd(5, 11), candles: candles };
    }

    function buildClusters() {
      clusters = [];
      var n = Math.max(3, Math.min(7, Math.round(W / 260)));
      for (var i = 0; i < n; i++) clusters.push(makeCluster(rnd(0, W)));
    }

    function nextLineY(prev) {
      var mid = H * 0.62;
      return Math.max(H * 0.3, Math.min(H * 0.92, prev + rnd(-9, 9) + (mid - prev) * 0.03));
    }

    function buildLine() {
      line = [];
      var n = Math.ceil(W / lineStep) + 3, y = H * 0.62;
      for (var i = 0; i < n; i++) { y = nextLineY(y); line.push(y); }
      lineOff = 0;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildTapes(); buildClusters(); buildLine();
    }

    function drawGrid() {
      var g = 48, ox = -((t * 4) % g), oy = -((t * 2) % g);
      ctx.strokeStyle = C.grid; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = ox; x < W; x += g) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
      for (var y = oy; y < H; y += g) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
      ctx.stroke();
    }

    function drawTapes() {
      var items = tapeItems();
      for (var r = 0; r < tapes.length; r++) {
        var tp = tapes[r];
        ctx.font = "600 " + tp.size + "px " + C.mono;
        ctx.textBaseline = "middle";
        // measure one full cycle of the tape
        var widths = [], total = 0, gap = 36, i;
        for (i = 0; i < items.length; i++) {
          var it = items[(i + r * 3) % items.length];
          var txt = it.label + (it.chg === null ? "" : "  " + (it.chg >= 0 ? "\u25B2" : "\u25BC") + Math.abs(it.chg).toFixed(2) + "%");
          var w = ctx.measureText(txt).width;
          widths.push({ it: it, txt: txt, w: w }); total += w + gap;
        }
        var off = ((tp.off + t * tp.speed) % total + total) % total;
        var x = -off;
        while (x < W) {
          for (i = 0; i < widths.length; i++) {
            var e = widths[i];
            if (x + e.w > 0 && x < W) {
              ctx.globalAlpha = 0.28;
              ctx.fillStyle = e.it.chg === null ? C.muted : (e.it.chg >= 0 ? C.green : C.red);
              ctx.fillText(e.txt, x, tp.y);
            }
            x += e.w + gap;
          }
        }
      }
    }

    function drawClusters(dt) {
      for (var k = 0; k < clusters.length; k++) {
        var cl = clusters[k];
        cl.x -= cl.speed * dt;
        var span = cl.candles.length * (cl.cw + 4);
        if (cl.x + span < -20) { clusters[k] = makeCluster(W + rnd(20, 200)); continue; }
        for (var i = 0; i < cl.candles.length; i++) {
          var c = cl.candles[i], cx = cl.x + i * (cl.cw + 4);
          if (cx < -20 || cx > W + 20) continue;
          var up = c.c >= c.o, col = up ? C.green : C.red;
          var yH = cl.y + (1 - c.h) * cl.h, yL = cl.y + (1 - c.l) * cl.h;
          var yO = cl.y + (1 - c.o) * cl.h, yC = cl.y + (1 - c.c) * cl.h;
          ctx.globalAlpha = 0.22; ctx.strokeStyle = col; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx + cl.cw / 2, yH); ctx.lineTo(cx + cl.cw / 2, yL); ctx.stroke();
          ctx.globalAlpha = 0.26; ctx.fillStyle = col;
          ctx.fillRect(cx, Math.min(yO, yC), cl.cw, Math.max(1.5, Math.abs(yC - yO)));
        }
      }
    }

    function drawLine(dt) {
      lineOff += 20 * dt;
      while (lineOff >= lineStep) { lineOff -= lineStep; line.shift(); line.push(nextLineY(line[line.length - 1])); }
      ctx.globalAlpha = 0.4; ctx.strokeStyle = C.accent; ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (var i = 0; i < line.length; i++) {
        var x = i * lineStep - lineOff;
        if (i === 0) ctx.moveTo(x, line[i]); else ctx.lineTo(x, line[i]);
      }
      ctx.stroke();
      // last-price marker at the right edge
      var ly = line[line.length - 1];
      ctx.globalAlpha = 0.18; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); ctx.setLineDash([]);
    }

    function frame(dt) {
      ctx.clearRect(0, 0, W, H);
      drawGrid(); drawLine(dt); drawClusters(dt); drawTapes();
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      raf = 0;
      if (document.hidden) return;
      raf = requestAnimationFrame(loop);
      if (!last) last = now;
      var el = now - last;
      if (el < FRAME_MS) return;
      last = now - (el % FRAME_MS);
      var dt = Math.min(el, 100) / 1000; t += dt;
      frame(dt);
    }

    function run() {
      if (reduce && reduce.matches) { if (raf) cancelAnimationFrame(raf); raf = 0; frame(0); return; }
      if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); }
    }

    function loadQuotes() {
      if (!window.fetch) return;
      fetch("data/latest.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (d) {
        var snap = d ? d.snapshot : null;
        if (!snap) return;
        for (var i = 0; i < SYMBOLS.length; i++) {
          var q = snap[SYMBOLS[i] + "-USD"];
          if (q) quotes[SYMBOLS[i]] = { mid: q.mid, chg: q.chg24_pct };
        }
        if (reduce && reduce.matches) frame(0);
      })["catch"](function () { /* symbols only */ });
    }

    var rt = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); if (reduce && reduce.matches) frame(0); }, 150);
    });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) run(); });
    if (reduce) {
      var onChange = function () { run(); };
      if (reduce.addEventListener) reduce.addEventListener("change", onChange);
      else if (reduce.addListener) reduce.addListener(onChange);
    }

    resize();
    loadQuotes();
    setInterval(loadQuotes, 300000);
    run();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

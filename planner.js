/* planner.js - signed-in-only TRADE PLANNER + TEAM ALLOCATION for BOTTY QUANTER.grok.
   PLANNING / SIMULATION ONLY: nothing here places, previews or sends orders, and nothing calls any external service.
   Inputs: window.BQ.account (real Coinbase free cash GBP estimate, FX rate) and window.BQ.payload.paper (latest BTC mid),
   both decrypted in the browser by bq-crypto.js. Allocation is saved only in this browser (localStorage "bq_alloc");
   the browser cannot write back to the engine, so "Copy allocation" gives text to send to the bot. */
(function () {
  "use strict";
  if (window.__planner) return;
  window.__planner = true;
  var KEY = "bq_alloc", EQUAL = { a: 33.33, b: 33.33, c: 33.34 };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "\x26amp;", "<": "\x26lt;", ">": "\x26gt;", '"': "\x26quot;", "'": "\x26#39;" }[c]; }); }
  function num(v) { return typeof v === "number" && isFinite(v); }
  function gbp(v) { return num(v) ? (v < 0 ? "-\u00a3" : "\u00a3") + Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "\u00a3\u2014"; }
  function usd(v) { return num(v) ? "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "$\u2014"; }
  function lon(iso) { try { return new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }); } catch (e) { return iso || "\u2014"; } }
  var CSS = [
    ".pl-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--r);padding:var(--s5);box-shadow:var(--shadow);margin-bottom:var(--s5);}",
    ".pl-card h2{font-size:12px;font-weight:700;color:var(--text-2);letter-spacing:.12em;margin-bottom:var(--s2);}",
    ".pl-tag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;padding:3px 8px;border-radius:999px;background:rgba(255,184,0,.16);color:#ffb800;border:1px solid rgba(255,184,0,.5);margin-left:8px;vertical-align:middle;}",
    ".pl-avail{font-family:var(--mono);font-size:20px;font-weight:700;color:var(--text);}",
    ".pl-sub{font-size:11.5px;color:var(--muted);margin:2px 0 var(--s4);line-height:1.45;}",
    ".pl-row{display:flex;flex-wrap:wrap;gap:var(--s3);align-items:center;margin-bottom:var(--s3);}",
    ".pl-row label{font-size:11px;letter-spacing:.08em;color:var(--muted);font-weight:600;}",
    ".pl-in{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--mono);font-size:15px;padding:8px 10px;width:150px;}",
    ".pl-btn{background:var(--panel-2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:12px;font-weight:700;letter-spacing:.08em;padding:8px 12px;cursor:pointer;}",
    ".pl-out{font-family:var(--mono);font-size:13px;color:var(--text-2);line-height:1.7;}",
    ".pl-warn{color:var(--red);font-weight:700;}",
    ".pl-ok{color:var(--green);}",
    ".pl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin-bottom:var(--s3);}",
    ".pl-team{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;min-width:0;}",
    ".pl-team b{display:block;font-size:10px;letter-spacing:.08em;color:var(--muted);margin-bottom:6px;}",
    ".pl-team .pl-in{width:100%;box-sizing:border-box;}",
    ".pl-team small{display:block;font-family:var(--mono);font-size:12px;color:var(--text-2);margin-top:6px;}",
    "@media(max-width:600px){.pl-grid{grid-template-columns:1fr;}.pl-in{width:100%;box-sizing:border-box;}.pl-row > *{flex:1 1 100%;}}"
  ].join("\n");
  var planBox = null, allocBox = null, amount = null, alloc = loadAlloc(), plan = null;

  function loadAlloc() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && num(s.a) && num(s.b) && num(s.c)) return { a: s.a, b: s.b, c: s.c }; } catch (e) { /* ignore */ }
    return { a: EQUAL.a, b: EQUAL.b, c: EQUAL.c };
  }
  function total() { return Math.round((alloc.a + alloc.b + alloc.c) * 100) / 100; }
  function valid() { return Math.abs(total() - 100) < 0.005 && alloc.a >= 0 && alloc.b >= 0 && alloc.c >= 0; }
  function allocText() { function f(v) { return String(+v.toFixed(2)); } return "A " + f(alloc.a) + "% / B " + f(alloc.b) + "% / C " + f(alloc.c) + "%"; }
  function syncAccountCard() {
    var el = document.getElementById("allocSummary"); if (el) el.textContent = allocText() + (valid() ? " (planned, next paper session)" : " (invalid: must total 100%)");
    if (typeof window.setAllocFromPlanner === "function") window.setAllocFromPlanner({ a: alloc.a, b: alloc.b, c: alloc.c });
  }
  function data() {
    var a = window.BQ && window.BQ.account, p = window.BQ && window.BQ.payload && window.BQ.payload.paper;
    var fc = a && a.free_cash && a.free_cash.total, fx = a && a.fx;
    var btc = null, btcSrc = "";
    if (p && num(p.last_mid)) { btc = p.last_mid; btcSrc = "paper engine BTC-USD mid, " + p.last_mark; }
    else if (a && a.holdings && a.holdings.rows) a.holdings.rows.forEach(function (r) { if (r.asset === "BTC" && num(r.price_usd)) { btc = r.price_usd; btcSrc = "Coinbase BTC-USD mid, " + a.generated_london; } });
    return { ok: !!a, avail: fc && num(fc.value_gbp_est) ? fc.value_gbp_est : null, asOf: a && a.generated_london, rate: fx && num(fx.rate) ? fx.rate : null, fx: fx, btc: btc, btcSrc: btcSrc };
  }

  function renderPlan() {
    if (!planBox) return;
    var d = data();
    if (!d.ok) { planBox.innerHTML = ""; return; }
    var h = "<div class='pl-card' id='plannerCard'><h2>TRADE PLANNER \u00b7 BTC-USD<span class='pl-tag'>PLANNER \u2014 NO REAL ORDERS</span></h2>";
    h += "<div class='pl-avail' id='plAvail'>Available: " + gbp(d.avail) + "</div>";
    h += "<div class='pl-sub'>Real Coinbase free cash (\u00a3 estimate) from the read-only account check \u00b7 as of " + esc(d.asOf) +
      (d.fx ? " \u00b7 GBP/USD " + d.rate.toFixed(4) + " (" + esc(d.fx.source) + ", " + esc(lon(d.fx.time)) + ")" : "") + "</div>";
    h += "<div class='pl-row'><label for='plAmount'>AMOUNT (\u00a3)</label><input class='pl-in' id='plAmount' type='number' inputmode='decimal' min='0' step='0.01' placeholder='e.g. 100' value='" + (num(amount) ? amount : "") + "'>" +
      "<button class='pl-btn' id='plBuy' type='button'>PLAN BUY</button><button class='pl-btn' id='plSell' type='button'>PLAN SELL</button></div>";
    h += "<div class='pl-out' id='plOut'></div>";
    h += "<div class='pl-sub' style='margin-top:8px'>Planning and simulation only. These buttons only show the plan on this page: they place no Coinbase order, send nothing anywhere and add nothing to the trade log.</div></div>";
    planBox.innerHTML = h;
    var inp = document.getElementById("plAmount");
    inp.addEventListener("input", function () { var v = parseFloat(inp.value); amount = num(v) && v >= 0 ? v : null; plan = null; updatePlan(); renderAllocOut(); });
    document.getElementById("plBuy").addEventListener("click", function () { plan = "BUY"; updatePlan(); });
    document.getElementById("plSell").addEventListener("click", function () { plan = "SELL"; updatePlan(); });
    updatePlan();
  }
  function updatePlan() {
    var out = document.getElementById("plOut"); if (!out) return;
    var d = data();
    if (!num(amount) || amount <= 0) { out.innerHTML = "Enter an amount in \u00a3 to plan a BTC-USD trade."; return; }
    var av = d.avail, h = "";
    var share = num(av) && av > 0 ? " (" + (amount / av * 100).toFixed(1) + "% of available)" : " (n/a: no free cash available)";
    h += "<div id='plLine'>" + gbp(amount) + " out of " + gbp(av) + " available" + share + "</div>";
    if (num(av) && amount > av) h += "<div class='pl-warn' id='plWarn'>\u26a0 Exceeds available free cash by " + gbp(amount - av) + " \u2014 planning only; add funds on Coinbase before any real trade.</div>";
    if (d.rate && d.btc) {
      var u = amount / d.rate;
      h += "<div id='plConv'>\u2248 " + usd(u) + " \u00b7 \u2248 " + (u / d.btc).toFixed(8) + " BTC at " + usd(d.btc) + " <small style='color:var(--muted)'>(" + esc(d.btcSrc) + ")</small></div>";
    } else h += "<div>USD/BTC conversion unavailable (no FX rate or BTC price in the data yet).</div>";
    if (plan) h += "<div class='pl-ok' id='plPlan'>PLAN ONLY: " + plan + " " + gbp(amount) + " of BTC-USD \u2014 not sent, no real order placed.</div>";
    out.innerHTML = h;
  }

  function renderAlloc() {
    if (!allocBox) return;
    if (!data().ok) { allocBox.innerHTML = ""; return; }
    var h = "<div class='section-label'>Team allocation (planning)</div><div class='pl-card' id='allocCard'><h2>TEAM ALLOCATION %<span class='pl-tag'>PLANNER \u2014 NO REAL ORDERS</span></h2>";
    h += "<div class='pl-sub'>How the planned trade amount would be split between the teams. Applies to the next paper session \u2014 the current 17:53\u201319:53 window keeps A $100 / B $100. Saved only in this browser; the dashboard cannot change the engine, so use Copy allocation and send it to the bot.</div><div class='pl-grid'>";
    [["a", "TEAM A \u00b7 HIGH RISK"], ["b", "TEAM B \u00b7 MID RISK"], ["c", "TEAM C \u00b7 LOW RISK"]].forEach(function (t) {
      h += "<div class='pl-team'><b>" + t[1] + "</b><input class='pl-in' type='number' inputmode='decimal' min='0' max='100' step='0.01' id='alloc_" + t[0] + "' value='" + alloc[t[0]] + "'><small id='allocAmt_" + t[0] + "'></small></div>";
    });
    h += "</div><div class='pl-row'><span class='pl-out' id='allocTotal'></span></div>";
    h += "<div class='pl-row'><button class='pl-btn' type='button' id='allocReset'>RESET TO EQUAL</button><button class='pl-btn' type='button' id='allocCopy'>COPY ALLOCATION</button>" +
      "<input class='pl-in' id='allocText' readonly style='width:auto;flex:1 1 220px;font-size:13px'></div><div class='pl-sub' id='allocMsg' style='margin:0'></div></div>";
    allocBox.innerHTML = h;
    ["a", "b", "c"].forEach(function (k) {
      document.getElementById("alloc_" + k).addEventListener("input", function (e) { var v = parseFloat(e.target.value); alloc[k] = num(v) ? v : 0; save(); renderAllocOut(); });
    });
    document.getElementById("allocReset").addEventListener("click", function () {
      alloc = { a: EQUAL.a, b: EQUAL.b, c: EQUAL.c }; ["a", "b", "c"].forEach(function (k) { document.getElementById("alloc_" + k).value = alloc[k]; }); save(); renderAllocOut();
    });
    document.getElementById("allocCopy").addEventListener("click", function () {
      var t = allocText(), msg = document.getElementById("allocMsg"), field = document.getElementById("allocText");
      if (!valid()) { msg.innerHTML = "<span class='pl-warn'>Fix the percentages first: they must total 100%.</span>"; return; }
      function done(ok) { msg.textContent = ok ? "Copied \u201c" + t + "\u201d \u2014 paste it to the bot to use it for the next paper session." : "Select the text above and copy it manually."; }
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { done(true); }, function () { field.select(); done(false); }); else { field.select(); done(document.execCommand && document.execCommand("copy")); } }
      catch (e) { field.select(); done(false); }
    });
    renderAllocOut();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ a: alloc.a, b: alloc.b, c: alloc.c, saved: new Date().toISOString() })); } catch (e) { /* no storage */ } syncAccountCard(); }
  function renderAllocOut() {
    var tEl = document.getElementById("allocTotal"); if (!tEl) return;
    var tot = total();
    tEl.innerHTML = "Total: <b class='" + (valid() ? "pl-ok" : "pl-warn") + "'>" + tot.toFixed(2) + "%</b>" + (valid() ? " \u2714" : " <span class='pl-warn' id='allocErr'>\u2014 must sum to 100% (currently " + (tot > 100 ? "over" : "under") + " by " + Math.abs(100 - tot).toFixed(2) + "%)</span>");
    ["a", "b", "c"].forEach(function (k) {
      var el = document.getElementById("allocAmt_" + k);
      el.textContent = num(amount) && amount > 0 ? "\u2248 " + gbp(amount * alloc[k] / 100) + " of " + gbp(amount) : "enter an amount in the planner";
    });
    var f = document.getElementById("allocText"); if (f) f.value = allocText();
    var m = document.getElementById("allocMsg"); if (m && m.querySelector(".pl-warn") && valid()) m.textContent = "";
  }

  function renderAll() { renderPlan(); renderAlloc(); syncAccountCard(); }
  function mount() {
    var app = document.getElementById("app"); if (!app) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    planBox = document.createElement("div"); planBox.id = "plannerSection";
    var sb = app.querySelector(".search-bar");
    if (sb && sb.parentNode) sb.parentNode.insertBefore(planBox, sb.nextSibling); else app.appendChild(planBox);
    allocBox = document.createElement("div"); allocBox.id = "allocSection"; app.appendChild(allocBox);
    window.addEventListener("bq:data", function () { if (document.getElementById("plannerCard")) { document.getElementById("plAvail").textContent = "Available: " + gbp(data().avail); updatePlan(); } else renderPlan(); if (!document.getElementById("allocCard")) renderAlloc(); else renderAllocOut(); syncAccountCard(); });
    window.addEventListener("bq:lock", function () { amount = null; plan = null; if (planBox) planBox.innerHTML = ""; if (allocBox) allocBox.innerHTML = ""; });
    renderAll();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

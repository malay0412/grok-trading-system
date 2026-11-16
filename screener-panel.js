/* screener-panel.js - signed-in-only SCREENER BOT card for BOTTY QUANTER.grok, placed directly above the trade planner.
   ANALYSIS ONLY: nothing here places, previews or sends orders, and nothing calls any external service.
   Data: window.BQ.payload.screener (decrypted in the browser by bq-crypto.js from data/latest.enc.json; written on the box by
   screener.py + chief_screener_review.py). All three classes are precomputed; the selector only switches the view.
   The selected class is remembered in this browser only (localStorage "bq_screener_class"). Prices: GBP first, USD small. */
(function () {
  "use strict";
  if (window.__screenerPanel) return;
  window.__screenerPanel = true;
  var KEY = "bq_screener_class", CLASSES = [["stocks", "STOCKS"], ["commodities", "COMMODITIES"], ["crypto", "CRYPTO"]];
  var box = null, sel = "stocks";
  try { var s0 = localStorage.getItem(KEY); if (s0 === "stocks" || s0 === "commodities" || s0 === "crypto") sel = s0; } catch (e) { /* ignore */ }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "\x26amp;", "<": "\x26lt;", ">": "\x26gt;", '"': "\x26quot;", "'": "\x26#39;" }[c]; }); }
  function num(v) { return typeof v === "number" && isFinite(v); }
  function dp(v) { var a = Math.abs(v); return a >= 1000 ? 2 : a >= 1 ? (a >= 100 ? 2 : 3) : (a >= 0.01 ? 4 : 6); }
  function fmt(v, sym, loc) { if (!num(v)) return sym + "\u2014"; var d = dp(v); return (v < 0 ? "-" : "") + sym + Math.abs(v).toLocaleString(loc, { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: d }); }
  function rate(sc) { var fx = (window.BQ && window.BQ.payload && window.BQ.payload.fx) || (sc && sc.fx); return fx && num(fx.rate) ? fx.rate : null; }
  function money(gbpV, usdV, sc) {
    var g = num(gbpV) ? gbpV : (num(usdV) && rate(sc) ? usdV * rate(sc) : null);
    return num(g) ? fmt(g, "\u00a3", "en-GB") + " <small class='sc-usd'>(" + fmt(usdV, "$", "en-US") + ")</small>" : fmt(usdV, "$", "en-US");
  }
  function lon(iso) { try { return new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }); } catch (e) { return iso || "\u2014"; } }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? u : null; }
  var CSS = [
    ".sc-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--r);padding:var(--s5);box-shadow:var(--shadow);margin-bottom:var(--s5);}",
    ".sc-card h2{font-size:12px;font-weight:700;color:var(--text-2);letter-spacing:.12em;margin-bottom:var(--s2);}",
    ".sc-tag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;padding:3px 8px;border-radius:999px;background:rgba(0,200,255,.14);color:#38c8ff;border:1px solid rgba(56,200,255,.5);margin-left:8px;vertical-align:middle;}",
    ".sc-sub{font-size:11.5px;color:var(--muted);margin:2px 0 var(--s3);line-height:1.45;}",
    ".sc-tabs{display:flex;gap:var(--s2);margin-bottom:var(--s3);}",
    ".sc-tab{flex:1;background:var(--panel-2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text-2);font-size:12px;font-weight:700;letter-spacing:.08em;padding:9px 6px;cursor:pointer;}",
    ".sc-tab.on{background:var(--bg-2);color:var(--text);border-color:var(--green);box-shadow:inset 0 -2px 0 var(--green);}",
    ".sc-list{display:grid;gap:var(--s3);}",
    ".sc-pick{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 12px;min-width:0;}",
    ".sc-top{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px;}",
    ".sc-rank{font-family:var(--mono);font-size:12px;color:var(--muted);font-weight:700;}",
    ".sc-sym{font-family:var(--mono);font-size:15px;font-weight:800;color:var(--text);}",
    ".sc-name{font-size:12px;color:var(--text-2);flex:1 1 120px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".sc-score{font-family:var(--mono);font-size:13px;font-weight:800;padding:2px 8px;border-radius:999px;background:var(--panel-2);border:1px solid var(--border);color:var(--text);}",
    ".sc-v{font-size:10px;font-weight:800;letter-spacing:.1em;padding:3px 8px;border-radius:999px;border:1px solid;}",
    ".sc-v.Candidate{color:var(--green);border-color:var(--green);background:rgba(0,255,140,.08);}",
    ".sc-v.Watch{color:#ffb800;border-color:rgba(255,184,0,.6);background:rgba(255,184,0,.1);}",
    ".sc-v.Avoid{color:var(--red);border-color:var(--red);background:rgba(255,60,60,.08);}",
    ".sc-row{font-family:var(--mono);font-size:12.5px;color:var(--text-2);line-height:1.6;margin-top:4px;}",
    ".sc-row b{color:var(--text);font-weight:700;}",
    ".sc-long{color:var(--green);font-weight:700;}.sc-short{color:var(--red);font-weight:700;}",
    ".sc-usd{opacity:.65;font-size:.85em;}",
    ".sc-why{font-size:12px;color:var(--text-2);line-height:1.45;margin-top:4px;}",
    ".sc-chief{font-size:12px;color:var(--muted);line-height:1.45;margin-top:3px;}",
    ".sc-news{font-size:12px;line-height:1.45;margin-top:4px;}.sc-news a{color:#38c8ff;text-decoration:none;}.sc-news a:hover{text-decoration:underline;}",
    ".sc-na{color:var(--red);font-weight:700;font-size:13px;}",
    "@media(max-width:600px){.sc-card{padding:var(--s4);}.sc-tab{font-size:11px;padding:9px 2px;letter-spacing:.04em;}.sc-name{white-space:normal;flex-basis:100%;order:5;}.sc-row{font-size:12px;}}"
  ].join("\n");
  function pickHtml(p, sc) {
    var long = String(p.bias || "").indexOf("long") === 0, c = p.chief || {};
    var h = "<div class='sc-pick' id='scPick_" + esc(p.rank) + "'><div class='sc-top'><span class='sc-rank'>#" + esc(p.rank) + "</span><span class='sc-sym'>" + esc(p.symbol) + "</span>" +
      "<span class='sc-name'>" + esc(p.name) + "</span><span class='sc-score' title='Screener score 0-100'>" + esc(num(p.score) ? p.score.toFixed(0) : "\u2014") + "</span>" +
      (c.verdict ? "<span class='sc-v " + esc(c.verdict) + "' title='Chief Bot verdict'>CHIEF: " + esc(String(c.verdict).toUpperCase()) + "</span>" : "") + "</div>";
    h += "<div class='sc-row'><b>" + money(p.price_gbp, p.price_usd, sc) + "</b> \u00b7 <span class='" + (long ? "sc-long" : "sc-short") + "'>" + (long ? "\u25b2 LONG BREAKOUT" : "\u25bc SHORT BREAKOUT") + "</span></div>";
    h += "<div class='sc-row'>Trigger " + money(p.trigger_gbp, p.trigger_usd, sc) + " \u00b7 Invalidation " + money(p.invalidation_gbp, p.invalidation_usd, sc) + "</div>";
    h += "<div class='sc-why'>" + esc(p.reason) + "</div>";
    if (c.verdict) h += "<div class='sc-chief'>Chief: " + esc(c.reason) + "</div>";
    var hs = (p.headlines || []).slice(0, 2);
    h += "<div class='sc-news'>" + (hs.length ? hs.map(function (n) { var u = safeUrl(n.url); return "\u2022 " + (u ? "<a href='" + esc(u) + "' target='_blank' rel='noopener noreferrer'>" + esc(n.title) + "</a>" : esc(n.title)); }).join("<br>") : "<span style='color:var(--muted)'>No relevant headlines in the last 48h</span>") + "</div>";
    return h + "</div>";
  }
  function render() {
    if (!box) return;
    var sc = window.BQ && window.BQ.payload && window.BQ.payload.screener;
    if (!window.BQ || !window.BQ.payload) { box.innerHTML = ""; return; }
    var h = "<div class='sc-card' id='screenerCard'><h2>SCREENER BOT<span class='sc-tag'>IDEAS \u2014 NO ORDERS</span></h2>";
    h += "<div class='sc-sub'>Top 5 for explosive moves, breakout potential and news sensitivity, reviewed by Chief Bot. " +
      (sc ? "Last screened: <b id='scTime'>" + esc(lon(sc.generated_utc)) + "</b>." : "") + "</div>";
    h += "<div class='sc-tabs' role='tablist'>" + CLASSES.map(function (c) { return "<button type='button' role='tab' class='sc-tab" + (c[0] === sel ? " on" : "") + "' id='scTab_" + c[0] + "' data-c='" + c[0] + "' aria-selected='" + (c[0] === sel) + "'>" + c[1] + "</button>"; }).join("") + "</div>";
    if (!sc) h += "<div class='sc-na' id='scNone'>No screener run published yet.</div>";
    else {
      var k = sc.classes && sc.classes[sel];
      if (!k || !k.available) h += "<div class='sc-na' id='scUnavail'>" + esc(sel.toUpperCase()) + " unavailable: " + esc(k ? k.reason : "not in this run") + "</div>";
      else {
        h += "<div class='sc-list' id='scList'>" + (k.picks || []).map(function (p) { return pickHtml(p, sc); }).join("") + "</div>";
        h += "<div class='sc-sub' style='margin:var(--s3) 0 0'>" + esc(k.scored) + " of " + esc(k.universe) + " screened \u00b7 source: " + esc(k.source) + ". Prices in \u00a3 first (display rate from Coinbase), USD small.</div>";
      }
    }
    box.innerHTML = h + "</div>";
    Array.prototype.forEach.call(box.querySelectorAll(".sc-tab"), function (b) {
      b.addEventListener("click", function () { sel = b.getAttribute("data-c"); try { localStorage.setItem(KEY, sel); } catch (e) { /* ignore */ } render(); });
    });
  }
  function mount() {
    var app = document.getElementById("app"); if (!app) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    box = document.createElement("div"); box.id = "screenerSection";
    var pl = document.getElementById("plannerSection"), sb = app.querySelector(".search-bar");
    if (pl && pl.parentNode) pl.parentNode.insertBefore(box, pl);
    else if (sb && sb.parentNode) sb.parentNode.insertBefore(box, sb.nextSibling);
    else app.appendChild(box);
    window.addEventListener("bq:data", render);
    window.addEventListener("bq:lock", function () { if (box) box.innerHTML = ""; });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

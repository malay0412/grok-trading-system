/* screener-panel.js - signed-in-only SCREENER BOT card for BOTTY QUANTER.grok, placed directly above the trade planner.
   ANALYSIS ONLY: nothing here places, previews or sends orders, and nothing calls any external service.
   Data: window.BQ.payload.screener (decrypted in the browser by bq-crypto.js from data/latest.enc.json; written on the box by
   screener.py + chief_screener_review.py). All three classes are precomputed; the selector only switches the view.
   The selected class is remembered in this browser only (localStorage "bq_screener_class"). Prices: GBP first, USD small.
   Refresh re-fetches data/latest.enc.json (cache-bust) and decrypts with the existing session key via BQ.restore(); no re-login.
   Picks render as one compact row each; tap/click a row to expand or collapse details.
   Auto-scan on/off comes from payload.screener_auto (Chief Bot flips it); the header light is display-only. */
(function () {
  "use strict";
  if (window.__screenerPanel) return;
  window.__screenerPanel = true;
  var KEY = "bq_screener_class", CLASSES = [["stocks", "STOCKS"], ["commodities", "COMMODITIES"], ["crypto", "CRYPTO"]];
  var box = null, sel = "stocks", openRank = null, loading = false, msg = "", msgKind = "", ageTimer = 0, autoTimer = 0;
  try { var s0 = localStorage.getItem(KEY); if (s0 === "stocks" || s0 === "commodities" || s0 === "crypto") sel = s0; } catch (e) { /* ignore */ }
  function esc(s) { return String(s == null ? "" : s).replace(/[\x26<>"']/g, function (c) { return { "\x26": "\x26amp;", "<": "\x26lt;", ">": "\x26gt;", '"': "\x26quot;", "'": "\x26#39;" }[c]; }); }
  function num(v) { return typeof v === "number" && isFinite(v); }
  function dp(v) { var a = Math.abs(v); return a >= 1000 ? 2 : a >= 1 ? (a >= 100 ? 2 : 3) : (a >= 0.01 ? 4 : 6); }
  function fmt(v, sym, loc) { if (!num(v)) return sym + "\u2014"; var d = dp(v); return (v < 0 ? "-" : "") + sym + Math.abs(v).toLocaleString(loc, { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: d }); }
  function rate(sc) { var fx = (window.BQ && window.BQ.payload && window.BQ.payload.fx) || (sc && sc.fx); return fx && num(fx.rate) ? fx.rate : null; }
  function gbpVal(gbpV, usdV, sc) { return num(gbpV) ? gbpV : (num(usdV) && rate(sc) ? usdV * rate(sc) : null); }
  function money(gbpV, usdV, sc) {
    var g = gbpVal(gbpV, usdV, sc);
    return num(g) ? fmt(g, "\u00a3", "en-GB") + " <small class='sc-usd'>(" + fmt(usdV, "$", "en-US") + ")</small>" : fmt(usdV, "$", "en-US");
  }
  function gbpOnly(gbpV, usdV, sc) { var g = gbpVal(gbpV, usdV, sc); return num(g) ? fmt(g, "\u00a3", "en-GB") : fmt(usdV, "$", "en-US"); }
  function lon(iso) { try { return new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }); } catch (e) { return iso || "\u2014"; } }
  function hm(iso) { try { return new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }); } catch (e) { return "\u2014"; } }
  function autoInfo() {
    var a = window.BQ && window.BQ.payload && window.BQ.payload.screener_auto;
    var iv = (a && typeof a.interval_min === "number" && isFinite(a.interval_min) && a.interval_min > 0) ? a.interval_min : 15;
    if (!a || a.auto_rescan === "unknown" || a.status === "unknown" || (a.auto_rescan !== true && a.auto_rescan !== false))
      return { state: "unknown", interval: iv };
    return { state: a.auto_rescan ? "on" : "off", interval: iv };
  }
  function nextHm(iso) {
    try {
      var step = autoInfo().interval * 60 * 1000, t = new Date(iso).getTime() + step, now = Date.now();
      if (!isFinite(t)) return "\u2014";
      while (t < now - 30000) t += step;
      return hm(new Date(t).toISOString());
    } catch (e) { return "\u2014"; }
  }
  function metaText(sc) {
    if (!sc || !sc.generated_utc) return "";
    var n = Math.max(0, Math.round((Date.now() - new Date(sc.generated_utc).getTime()) / 60000));
    var next = autoInfo().state === "off" ? "Auto-scan paused" : ("Next scan ~" + nextHm(sc.generated_utc));
    return "Last screened " + hm(sc.generated_utc) + " (London) \u00b7 " + n + " min ago \u00b7 " + next;
  }
  function autoHtml() {
    var info = autoInfo(), st = info.state;
    var label = st === "on" ? ("Auto-scan on \u00b7 every " + info.interval + " min") : (st === "off" ? "Auto-scan off" : "Auto-scan unknown");
    return "<span class='sc-auto " + st + "' id='scAuto' title='Ask Chief Bot to turn on/off' aria-label='" + esc(label) + ". Ask Chief Bot to turn on/off'><span class='sc-dot' aria-hidden='true'></span>" + esc(label) + "</span>";
  }
  function fingerprint(sc) { return sc ? String(sc.generated_utc || "") : ""; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? u : null; }
  var CSS = [
    ".sc-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--r);padding:12px 14px;box-shadow:var(--shadow);margin-bottom:var(--s5);}",
    ".sc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:4px;}",
    ".sc-card h2{font-size:12px;font-weight:700;color:var(--text-2);letter-spacing:.12em;margin:0;}",
    ".sc-tag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;padding:2px 7px;border-radius:999px;background:rgba(0,200,255,.14);color:#38c8ff;border:1px solid rgba(56,200,255,.5);margin-left:8px;vertical-align:middle;}",
    ".sc-refresh{flex:0 0 auto;background:var(--panel-2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:10px;font-weight:700;letter-spacing:.1em;padding:5px 9px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}",
    ".sc-refresh:disabled{opacity:.55;cursor:default;}",
    ".sc-refresh:not(:disabled):hover{border-color:var(--green);}",
    ".sc-head-right{display:flex;align-items:center;gap:8px;flex:0 1 auto;min-width:0;flex-wrap:wrap;justify-content:flex-end;}",
    ".sc-auto{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--muted);flex:0 0 auto;white-space:nowrap;cursor:help;line-height:1;}",
    ".sc-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:#8a8a8a;}",
    ".sc-auto.off .sc-dot{background:#d45454;box-shadow:0 0 0 1px rgba(212,84,84,.25);}",
    ".sc-auto.on .sc-dot{background:var(--green);box-shadow:0 0 6px var(--green);animation:sc-pulse 1.6s ease-in-out infinite;}",
    ".sc-auto.unknown .sc-dot{background:#8a8a8a;}",
    "@keyframes sc-pulse{0%,100%{opacity:1}50%{opacity:.4}}",
    ".sc-spin{width:10px;height:10px;border:2px solid var(--border);border-top-color:var(--green);border-radius:50%;animation:sc-spin .7s linear infinite;}",
    "@keyframes sc-spin{to{transform:rotate(360deg)}}",
    ".sc-sub{font-size:11.5px;color:var(--muted);margin:0 0 6px;line-height:1.4;}",
    ".sc-msg{font-size:11.5px;margin:0 0 6px;color:var(--text-2);}",
    ".sc-msg.err{color:var(--red);}.sc-msg.ok{color:var(--green);}",
    ".sc-tabs{display:flex;gap:var(--s2);margin-bottom:8px;}",
    ".sc-tab{flex:1;background:var(--panel-2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text-2);font-size:11px;font-weight:700;letter-spacing:.08em;padding:6px 4px;cursor:pointer;}",
    ".sc-tab.on{background:var(--bg-2);color:var(--text);border-color:var(--green);box-shadow:inset 0 -2px 0 var(--green);}",
    ".sc-list{display:grid;gap:6px;}",
    ".sc-pick{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-sm);padding:6px 10px;min-width:0;}",
    ".sc-pick.open{border-color:rgba(0,255,140,.45);}",
    ".sc-sum{display:flex;flex-wrap:nowrap;align-items:center;gap:7px;width:100%;background:transparent;border:0;color:inherit;font:inherit;text-align:left;padding:0;cursor:pointer;min-height:26px;}",
    ".sc-rank{font-family:var(--mono);font-size:11px;color:var(--muted);font-weight:700;flex:0 0 auto;}",
    ".sc-sym{font-family:var(--mono);font-size:13px;font-weight:800;color:var(--text);flex:0 0 auto;}",
    ".sc-px{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text);flex:1 1 auto;min-width:0;}",
    ".sc-name{font-size:12px;color:var(--text-2);min-width:0;}",
    ".sc-score{font-family:var(--mono);font-size:12px;font-weight:800;padding:1px 6px;border-radius:999px;background:var(--panel-2);border:1px solid var(--border);color:var(--text);flex:0 0 auto;}",
    ".sc-v{font-size:9px;font-weight:800;letter-spacing:.08em;padding:2px 6px;border-radius:999px;border:1px solid;flex:0 0 auto;}",
    ".sc-v.Candidate{color:var(--green);border-color:var(--green);background:rgba(0,255,140,.08);}",
    ".sc-v.Watch{color:#ffb800;border-color:rgba(255,184,0,.6);background:rgba(255,184,0,.1);}",
    ".sc-v.Avoid{color:var(--red);border-color:var(--red);background:rgba(255,60,60,.08);}",
    ".sc-row{font-family:var(--mono);font-size:12.5px;color:var(--text-2);line-height:1.55;margin-top:4px;}",
    ".sc-row b{color:var(--text);font-weight:700;}",
    ".sc-long{color:var(--green);font-weight:700;font-size:12px;flex:0 0 auto;}.sc-short{color:var(--red);font-weight:700;font-size:12px;flex:0 0 auto;}",
    ".sc-usd{opacity:.65;font-size:.85em;}",
    ".sc-det{display:none;margin-top:6px;padding-top:6px;border-top:1px solid var(--border);}",
    ".sc-pick.open .sc-det{display:block;}",
    ".sc-why{font-size:12px;color:var(--text-2);line-height:1.45;margin-top:4px;}",
    ".sc-chief{font-size:12px;color:var(--muted);line-height:1.45;margin-top:3px;}",
    ".sc-news{font-size:12px;line-height:1.45;margin-top:4px;}.sc-news a{color:#38c8ff;text-decoration:none;}.sc-news a:hover{text-decoration:underline;}",
    ".sc-na{color:var(--red);font-weight:700;font-size:13px;}",
    "@media(max-width:600px){.sc-card{padding:10px 10px;}.sc-tab{font-size:10px;padding:7px 2px;letter-spacing:.04em;}.sc-sum{flex-wrap:wrap;gap:4px 7px;min-height:32px;}.sc-px{flex-basis:auto;}.sc-refresh{padding:7px 10px;font-size:11px;}.sc-row{font-size:12px;}.sc-auto{font-size:9.5px;letter-spacing:0;}.sc-head-right{gap:6px;}}"
  ].join("\n");
  function pickHtml(p, sc) {
    var long = String(p.bias || "").indexOf("long") === 0, c = p.chief || {};
    var open = String(openRank) === String(p.rank);
    var h = "<div class='sc-pick" + (open ? " open" : "") + "' id='scPick_" + esc(p.rank) + "' data-rank='" + esc(p.rank) + "'>";
    h += "<button type='button' class='sc-sum' id='scSum_" + esc(p.rank) + "' aria-expanded='" + open + "' aria-controls='scDet_" + esc(p.rank) + "'>";
    h += "<span class='sc-rank'>#" + esc(p.rank) + "</span><span class='sc-sym'>" + esc(p.symbol) + "</span>";
    h += "<span class='sc-px'>" + esc(gbpOnly(p.price_gbp, p.price_usd, sc)) + "</span>";
    h += "<span class='sc-score' title='Screener score 0-100'>" + esc(num(p.score) ? p.score.toFixed(0) : "\u2014") + "</span>";
    h += "<span class='" + (long ? "sc-long" : "sc-short") + "' title='" + (long ? "Long breakout" : "Short breakout") + "'>" + (long ? "\u25b2" : "\u25bc") + "</span>";
    if (c.verdict) h += "<span class='sc-v " + esc(c.verdict) + "' title='Chief Bot verdict'>" + esc(String(c.verdict).toUpperCase()) + "</span>";
    h += "</button>";
    h += "<div class='sc-det' id='scDet_" + esc(p.rank) + "'" + (open ? "" : " hidden") + ">";
    h += "<div class='sc-name'>" + esc(p.name) + " <small class='sc-usd'>(" + fmt(p.price_usd, "$", "en-US") + ")</small></div>";
    h += "<div class='sc-row'>Trigger " + money(p.trigger_gbp, p.trigger_usd, sc) + " \u00b7 Invalidation " + money(p.invalidation_gbp, p.invalidation_usd, sc) + "</div>";
    h += "<div class='sc-why'>" + esc(p.reason) + "</div>";
    if (c.verdict) h += "<div class='sc-chief'>Chief: " + esc(c.reason) + "</div>";
    var hs = (p.headlines || []).slice(0, 2);
    h += "<div class='sc-news'>" + (hs.length ? hs.map(function (n) { var u = safeUrl(n.url); return "\u2022 " + (u ? "<a href='" + esc(u) + "' target='_blank' rel='noopener noreferrer'>" + esc(n.title) + "</a>" : esc(n.title)); }).join("<br>") : "<span style='color:var(--muted)'>No relevant headlines in the last 48h</span>") + "</div>";
    return h + "</div></div>";
  }
  function render() {
    if (!box) return;
    var sc = window.BQ && window.BQ.payload && window.BQ.payload.screener;
    if (!window.BQ || !window.BQ.payload) { box.innerHTML = ""; return; }
    var h = "<div class='sc-card' id='screenerCard'><div class='sc-head'><h2>SCREENER BOT<span class='sc-tag'>IDEAS \u2014 NO ORDERS</span></h2>";
    h += "<div class='sc-head-right'>" + autoHtml();
    h += "<button type='button' class='sc-refresh' id='scRefresh'" + (loading ? " disabled" : "") + " aria-busy='" + loading + "' aria-label='Refresh screener results'>";
    h += (loading ? "<span class='sc-spin' aria-hidden='true'></span>REFRESHING" : "REFRESH") + "</button></div></div>";
    if (sc && sc.generated_utc) h += "<div class='sc-sub' id='scMeta'>" + esc(metaText(sc)) + "</div>";
    if (msg) h += "<div class='sc-msg " + esc(msgKind) + "' id='scMsg'>" + esc(msg) + "</div>";
    h += "<div class='sc-tabs' role='tablist'>" + CLASSES.map(function (c) { return "<button type='button' role='tab' class='sc-tab" + (c[0] === sel ? " on" : "") + "' id='scTab_" + c[0] + "' data-c='" + c[0] + "' aria-selected='" + (c[0] === sel) + "'>" + c[1] + "</button>"; }).join("") + "</div>";
    if (!sc) h += "<div class='sc-na' id='scNone'>No screener run published yet.</div>";
    else {
      var k = sc.classes && sc.classes[sel];
      if (!k || !k.available) h += "<div class='sc-na' id='scUnavail'>" + esc(sel.toUpperCase()) + " unavailable: " + esc(k ? k.reason : "not in this run") + "</div>";
      else {
        h += "<div class='sc-list' id='scList'>" + (k.picks || []).map(function (p) { return pickHtml(p, sc); }).join("") + "</div>";
        h += "<div class='sc-sub' style='margin:6px 0 0'>" + esc(k.scored) + " of " + esc(k.universe) + " screened \u00b7 source: " + esc(k.source) + ". Prices in \u00a3 first, USD in the expanded row.</div>";
      }
    }
    box.innerHTML = h + "</div>";
    Array.prototype.forEach.call(box.querySelectorAll(".sc-tab"), function (b) {
      b.addEventListener("click", function () { sel = b.getAttribute("data-c"); openRank = null; try { localStorage.setItem(KEY, sel); } catch (e) { /* ignore */ } render(); });
    });
    Array.prototype.forEach.call(box.querySelectorAll(".sc-sum"), function (b) {
      b.addEventListener("click", function () {
        var r = b.parentNode && b.parentNode.getAttribute("data-rank");
        openRank = (r != null && String(openRank) === String(r)) ? null : r;
        render();
      });
    });
    var rb = document.getElementById("scRefresh");
    if (rb) rb.addEventListener("click", function () { pull(false); });
  }
  function pull(auto) {
    if (loading) return;
    if (!window.BQ || typeof window.BQ.restore !== "function") { msg = "Couldn't refresh. Sign in again."; msgKind = "err"; render(); return; }
    loading = true; if (!auto) msg = ""; render();
    var before = fingerprint(window.BQ.payload && window.BQ.payload.screener);
    window.BQ.restore().then(function () {
      loading = false;
      var after = fingerprint(window.BQ.payload && window.BQ.payload.screener);
      msg = (!auto && after === before) ? "Already up to date" : "";
      msgKind = "ok";
      render();
    }, function (e) {
      loading = false;
      var code = e && e.code;
      msg = (code === "no-session" || code === "bad-password") ? "Couldn't refresh. Sign in again." : "Couldn't refresh. Try again.";
      msgKind = "err";
      render();
    });
  }
  function startTimers() {
    if (!ageTimer) ageTimer = setInterval(function () {
      var el = document.getElementById("scMeta");
      var sc = window.BQ && window.BQ.payload && window.BQ.payload.screener;
      if (el && sc && !loading) el.textContent = metaText(sc);
    }, 30000);
    if (!autoTimer) autoTimer = setInterval(function () {
      if (document.hidden) return;
      if (!window.BQ || !window.BQ.payload) return;
      pull(true);
    }, 5 * 60 * 1000);
  }
  function stopTimers() {
    if (ageTimer) { clearInterval(ageTimer); ageTimer = 0; }
    if (autoTimer) { clearInterval(autoTimer); autoTimer = 0; }
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
    window.addEventListener("bq:lock", function () { stopTimers(); if (box) box.innerHTML = ""; });
    startTimers();
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

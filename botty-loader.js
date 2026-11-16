/* BOTTY QUANTER.grok dashboard data loader (self-contained). ANALYSIS ONLY - this script never places orders.
   Include AFTER the page's main <script>:  <script src="botty-loader.js"></script>
   It fetches data/latest.json (written by /workspace/botty-quanter/run_cycle.py) and:
   - calls the page's render(data) hook if present (chief status, team statuses, news, empty trade log),
   - replaces overlays.chief / a / b / c / news / trades / account content with real engine output,
   - falls back to writing element ids directly (#chiefStatus, #aStatus.., #newsList, #tradeList) if render() is absent.
   Currency: money figures display in GBP (£) first, with USD shown small, using the live Coinbase GBP/USD rate in the encrypted payload. Engine figures stay in USD. */
(function () {
  var URL_ = (window.BOTTY_DATA_URL || "data/latest.json");
  var REFRESH_MS = window.BOTTY_REFRESH_MS || 60000;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "\x26amp;", "<": "\x26lt;", ">": "\x26gt;", '"': "\x26quot;", "'": "\x26#39;" }[c]; }); }
  function usd(v) { return (typeof v === "number" && isFinite(v)) ? "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }
  function fxRate() { var fx = window.BQ && ((window.BQ.payload && window.BQ.payload.fx) || (window.BQ.account && window.BQ.account.fx)); return fx && typeof fx.rate === "number" && isFinite(fx.rate) ? fx.rate : null; }
  function toGbp(u) { var r = fxRate(); return (typeof u === "number" && isFinite(u) && r) ? u * r : null; }
  function gbp(v) { return (typeof v === "number" && isFinite(v)) ? (v < 0 ? "-\u00a3" : "\u00a3") + Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }
  function moneyText(u) { var g = toGbp(u); return (typeof g === "number") ? gbp(g) + " (\u2248 " + usd(u) + ")" : usd(u); }
  function moneyHtml(u) { var g = toGbp(u); return (typeof g === "number") ? gbp(g) + " <small style='opacity:.7'>(\u2248 " + usd(u) + ")</small>" : usd(u); }
  function callLine(c) {
    if (!c || !c.symbol) {
      var b = c && c.best_candidate;
      return "NO TRADE" + (b ? " · best: " + b.side + " " + b.symbol + " (" + b.agree + "/10) rejected" : "");
    }
    return c.decision + " " + c.symbol + " · entry " + moneyText(c.entry) + " · stop " + moneyText(c.stop) + " · T1 " + moneyText(c.targets[0]) +
      " · R:R " + c.rr[0] + " · " + c.confidence + " · " + c.agreement + " agree";
  }
  function callHtml(c) {
    if (!c || !c.symbol) {
      var b = c && c.best_candidate;
      return "<strong>NO TRADE</strong><br>" + esc(c ? c.reason : "no data") +
        (b ? "<br>Best candidate: " + esc(b.side + " " + b.symbol) + " (" + b.agree + "/10, net " + b.net_score + ")<br>Rejected: " + esc(b.reasons.join("; ")) : "") + "<br><br>";
    }
    var h = "<strong>" + esc(c.decision + " " + c.symbol) + "</strong> <em>(prices in \u00a3, USD alongside)</em><br>" +
      "Entry " + moneyHtml(c.entry) + " <small>(" + esc(c.entry_basis) + ")</small><br>" +
      "Stop " + moneyHtml(c.stop) + " (" + c.stop_pct + "%) <small>" + esc(c.stop_basis) + "</small><br>" +
      "Targets T1 " + moneyHtml(c.targets[0]) + " \u00b7 T2 " + moneyHtml(c.targets[1]) + " <small>" + esc(c.t1_basis) + "</small><br>" +
      "R:R " + c.rr[0] + "R / " + c.rr[1] + "R · Confidence " + esc(c.confidence) + " (" + c.confidence_score + ")<br>" +
      "Agreement " + esc(c.agreement) + ": " + esc(c.agree_bots.join(", ")) + "<br>" +
      "Dissent: " + esc(c.dissent_bots.join(", ") || "none") + " · Neutral: " + esc(c.neutral_bots.join(", ") || "none") + "<br>";
    if (c.sizing) h += "Sizing: " + c.sizing.risk_pct_of_equity + "% risk of " + esc(c.sizing.account_currency) + " equity → notional " + c.sizing.position_notional_pct_of_equity + "% of equity (max " + c.sizing.max_leverage + "x)<br>";
    if (c.correlation_note) h += esc(c.correlation_note) + "<br>";
    return h + "<br>";
  }
  function teamHtml(t) {
    var sym = (t.call && t.call.symbol) || (t.call && t.call.best_candidate && t.call.best_candidate.symbol);
    var h = "<em>" + esc(t.risk + " risk · " + t.style) + "</em><br><br>" + callHtml(t.call) + "<strong>Sub-bots (10)" + (sym ? " on " + esc(sym) : "") + "</strong><br>";
    t.subbots.forEach(function (b) {
      var o = sym ? b.outputs[sym] : null;
      h += "<div style='margin:6px 0'><strong>" + esc(b.name) + "</strong> · " + esc(b.element) +
        (o ? " · <b>" + esc(o.direction) + "</b> (" + (o.score >= 0 ? "+" : "") + o.score + ")<br><small>" + esc(o.reason) + "</small>" : "") +
        "<br><small style='opacity:.7'>" + esc(b.style) + "</small></div>";
    });
    if (t.ranking) h += "<br><strong>Ranking</strong><br><small>" + esc(t.ranking.map(function (r) { return r.side + " " + r.symbol + " " + r.net_score + " (" + r.agree + "/10)"; }).join(" · ")) + "</small>";
    return h;
  }
  function acctWealth() { var a = window.BQ && window.BQ.account; return a && (a.wealth || (a.holdings && a.holdings.total) || {}); }
  function acctGbp() { var t = acctWealth(); return t && typeof t.value_gbp === "number" ? t.value_gbp : (t && typeof t.value_gbp_est === "number" ? t.value_gbp_est : null); }
  function acctUsd() { var t = acctWealth(); return t && typeof t.value_usd === "number" ? t.value_usd : null; }
  function fillAccountCard() {
    var el = document.getElementById("balance"), g = acctGbp(), u = acctUsd();
    if (el && g !== null) el.innerHTML = gbp(g) + (u !== null ? " <small style='opacity:.7'>(\u2248 " + usd(u) + ")</small>" : "");
  }
  function apply(d) {
    var keys = { a: "A", b: "B", c: "C" };
    var payload = {
      chiefStatus: (d.chief.view[0] || "") + " · cycle " + d.generated_london,
      teams: {}, trades: [], balance: acctGbp(), totalPnl: null, totalPnlPct: null,
      news: d.news.map(function (n) { return { headline: n.title + " — " + n.source, tag: (n.symbols && n.symbols[0] ? n.symbols[0].replace("-USD", "") : (n.macro ? "MACRO" : "CRYPTO")) }; })
    };
    Object.keys(keys).forEach(function (k) { payload.teams[k] = { pnl: null, status: callLine(d.teams[keys[k]].call) }; });
    if (typeof window.render === "function") window.render(payload);
    fillAccountCard();
    if (typeof window.render !== "function") {
      var set = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
      set("chiefStatus", payload.chiefStatus); Object.keys(keys).forEach(function (k) { set(k + "Status", payload.teams[k].status); });
    }
    var tl = document.getElementById("tradeList"); if (tl) tl.innerHTML = "<div class='empty'>" + esc(d.trade_log.label) + "</div>";
    var ov = window.overlays || (typeof overlays !== "undefined" ? overlays : null);
    if (ov) {
      ov.chief = { title: "CHIEF BOT", content: "<em>" + esc(d.mode) + " · cycle " + esc(d.cycle_id) + " · " + esc(d.generated_london) + "</em><br><br><strong>Chief view</strong><br>" +
        d.chief.view.map(esc).join("<br>") + "<br><br>" + d.chief.calls.map(function (c) { return "<strong>Team " + esc(c.team) + "</strong><br>" + callHtml(c); }).join("") +
        (d.data_gaps.length ? "<strong>Data gaps</strong><br><small>" + d.data_gaps.map(esc).join("<br>") + "</small>" : "") };
      Object.keys(keys).forEach(function (k) { ov[k] = { title: "TEAM " + keys[k], content: teamHtml(d.teams[keys[k]]) }; });
      ov.news = { title: "HOT NEWS", content: d.news.map(function (n) {
        return "<strong>" + esc(n.title) + "</strong><br><small>" + esc(n.source) + " · " + esc(n.published_london || "time n/a") + " · sentiment " + n.sentiment +
          (n.url ? " · <a href='" + esc(n.url) + "' target='_blank' rel='noopener'>source</a>" : "") + "</small><br><br>"; }).join("") || "No headlines this cycle." };
      ov.trades = { title: "TRADE LOG", content: esc(d.trade_log.label) + ". No orders are placed by the engine." };
      ov.account = { title: "ACCOUNT", content: "Account currency: GBP (\u00a3) with USD alongside<br>Balance: " + (acctGbp() === null ? "—" : gbp(acctGbp()) + (acctUsd() !== null ? " <small style='opacity:.7'>(\u2248 " + usd(acctUsd()) + ")</small>" : "")) + " (holdings + free cash) \u00b7 P\x26amp;L: —<br><small>" + esc(d.account.note) + " " + esc(d.currency.note) + "</small>" };
    }
  }
  // Data now arrives decrypted from bq-crypto.js (window.BQ.data + "bq:data" event, re-fetched every 60s). No plaintext fetch.
  function load() { if (window.BQ && window.BQ.data) apply(window.BQ.data); }
  window.addEventListener("bq:data", function (e) { if (e.detail) apply(e.detail); });
  load();
})();

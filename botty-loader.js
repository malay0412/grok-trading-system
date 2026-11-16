/* BOTTY QUANTER.grok dashboard data loader (self-contained). ANALYSIS ONLY - this script never places orders.
   Include AFTER the page's main <script>:  <script src="botty-loader.js"></script>
   It fetches data/latest.json (written by /workspace/botty-quanter/run_cycle.py) and:
   - calls the page's render(data) hook if present (chief status, team statuses, news, empty trade log),
   - replaces overlays.chief / a / b / c / news / trades / account content with real engine output,
   - falls back to writing element ids directly (#chiefStatus, #aStatus.., #newsList, #tradeList) if render() is absent.
   Currency: account fields are GBP (£) and stay empty (no account data). Instrument prices are USD per Coinbase pair, never converted. */
(function () {
  var URL_ = (window.BOTTY_DATA_URL || "data/latest.json");
  var REFRESH_MS = window.BOTTY_REFRESH_MS || 60000;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "\x26amp;", "<": "\x26lt;", ">": "\x26gt;", '"': "\x26quot;", "'": "\x26#39;" }[c]; }); }
  function usd(v) { return (typeof v === "number" && isFinite(v)) ? "$" + (Math.abs(v) >= 1 ? v.toLocaleString("en-GB", { maximumFractionDigits: 4 }) : String(v)) : "—"; }
  function callLine(c) {
    if (!c || !c.symbol) {
      var b = c && c.best_candidate;
      return "NO TRADE" + (b ? " · best: " + b.side + " " + b.symbol + " (" + b.agree + "/10) rejected" : "");
    }
    return c.decision + " " + c.symbol + " · entry " + usd(c.entry) + " · stop " + usd(c.stop) + " · T1 " + usd(c.targets[0]) +
      " · R:R " + c.rr[0] + " · " + c.confidence + " · " + c.agreement + " agree";
  }
  function callHtml(c) {
    if (!c || !c.symbol) {
      var b = c && c.best_candidate;
      return "<strong>NO TRADE</strong><br>" + esc(c ? c.reason : "no data") +
        (b ? "<br>Best candidate: " + esc(b.side + " " + b.symbol) + " (" + b.agree + "/10, net " + b.net_score + ")<br>Rejected: " + esc(b.reasons.join("; ")) : "") + "<br><br>";
    }
    var h = "<strong>" + esc(c.decision + " " + c.symbol) + "</strong> <em>(prices in USD)</em><br>" +
      "Entry " + usd(c.entry) + " <small>(" + esc(c.entry_basis) + ")</small><br>" +
      "Stop " + usd(c.stop) + " (" + c.stop_pct + "%) <small>" + esc(c.stop_basis) + "</small><br>" +
      "Targets T1 " + usd(c.targets[0]) + " · T2 " + usd(c.targets[1]) + " <small>" + esc(c.t1_basis) + "</small><br>" +
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
  function apply(d) {
    var keys = { a: "A", b: "B", c: "C" };
    var payload = {
      chiefStatus: (d.chief.view[0] || "") + " · cycle " + d.generated_london,
      teams: {}, trades: [], balance: null, totalPnl: null, totalPnlPct: null,
      news: d.news.map(function (n) { return { headline: n.title + " — " + n.source, tag: (n.symbols && n.symbols[0] ? n.symbols[0].replace("-USD", "") : (n.macro ? "MACRO" : "CRYPTO")) }; })
    };
    Object.keys(keys).forEach(function (k) { payload.teams[k] = { pnl: null, status: callLine(d.teams[keys[k]].call) }; });
    if (typeof window.render === "function") window.render(payload);
    else {
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
      ov.account = { title: "ACCOUNT", content: "Account currency: " + esc(d.currency.account) + " (" + esc(d.currency.account_symbol) + ")<br>Balance: — · P\x26amp;L: —<br><small>" + esc(d.account.note) + " " + esc(d.currency.note) + "</small>" };
    }
  }
  function load() {
    fetch(URL_ + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(apply).catch(function (e) { var el = document.getElementById("chiefStatus"); if (el) el.textContent = "Engine data unavailable (" + e.message + ")"; });
  }
  load(); setInterval(load, REFRESH_MS);
})();

/* account-panel.js - signed-in-only Holdings + Performance sections for BOTTY QUANTER.grok. READ-ONLY, never places orders.
   Data: window.BQ.account (decrypted from data/latest.enc.json by bq-crypto.js; produced on the box by
   account_snapshot.py from read-only Coinbase connector calls). Nothing is rendered until the data is decrypted. */
(function () {
  "use strict";
  if (window.__acctPanel) return;
  window.__acctPanel = true;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "\x26amp;", "<": "\x26lt;", ">": "\x26gt;", '"': "\x26quot;", "'": "\x26#39;" }[c]; }); }
  function num(v) { return typeof v === "number" && isFinite(v); }
  function usd(v, dp) { return num(v) ? (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp == null ? 2 : dp, maximumFractionDigits: dp == null ? 2 : dp }) : "—"; }
  function gbp(v) { return num(v) ? (v < 0 ? "-\u00a3" : "\u00a3") + Math.abs(v).toFixed(2) : "—"; }
  function amt(v) { return num(v) ? (Math.abs(v) >= 1 ? v.toLocaleString("en-US", { maximumFractionDigits: 4 }) : String(+v.toPrecision(8))) : "—"; }
  function pct(v) { return num(v) ? (v >= 0 ? "+" : "") + v.toFixed(2) + "%" : "—"; }
  function cls(v) { return num(v) ? (v >= 0 ? "pos" : "neg") : ""; }
  function lon(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }); }
    catch (e) { return iso; }
  }

  var CSS = [
    ".ap-grid{display:grid;grid-template-columns:3fr 2fr;gap:var(--s4);margin-bottom:var(--s5);}",
    ".ap-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--r);padding:var(--s5);box-shadow:var(--shadow);min-width:0;}",
    ".ap-card h2{font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:var(--s2);letter-spacing:.12em;}",
    ".ap-sub{font-size:12px;color:var(--muted);margin-bottom:var(--s4);}",
    ".ap-tw{overflow-x:auto;-webkit-overflow-scrolling:touch;}",
    ".ap-t{width:100%;border-collapse:collapse;font-size:13px;min-width:460px;}",
    ".ap-t th{font-size:10px;letter-spacing:.08em;color:var(--muted);font-weight:600;text-align:right;padding:6px 8px;border-bottom:1px solid var(--border);white-space:nowrap;}",
    ".ap-t td{text-align:right;padding:8px;border-bottom:1px solid var(--border);font-family:var(--mono);color:var(--text);white-space:nowrap;}",
    ".ap-t th:first-child,.ap-t td:first-child{text-align:left;}",
    ".ap-t tr.tot td{font-weight:700;border-bottom:0;color:var(--text);}",
    ".ap-note{font-size:11.5px;color:var(--muted);margin-top:var(--s3);line-height:1.5;}",
    ".ap-status{font-size:13px;color:var(--text-2);background:var(--panel-2);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 10px;margin-bottom:var(--s4);}",
    ".ap-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin-bottom:var(--s4);}",
    ".ap-kpi{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;min-width:0;}",
    ".ap-kpi b{display:block;font-size:10px;letter-spacing:.08em;color:var(--muted);font-weight:600;margin-bottom:4px;}",
    ".ap-kpi span{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--text);}",
    ".ap-kpi small{display:block;font-size:11px;color:var(--muted);margin-top:3px;line-height:1.35;}",
    ".ap-kpi .pos{color:var(--green);} .ap-kpi .neg{color:var(--red);}",
    ".ap-list{font-size:12.5px;color:var(--text-2);}",
    ".ap-list div{padding:6px 0;border-bottom:1px solid var(--border);font-family:var(--mono);}",
    "@media(max-width:960px){.ap-grid{grid-template-columns:1fr;}}",
    "@media(max-width:480px){.ap-kpis{grid-template-columns:1fr;}.ap-card{padding:var(--s4);}}"
  ].join("\n");

  var box = null;

  function holdingsHtml(a) {
    var h = a.holdings || {}, fx = a.fx, rows = h.rows || [];
    var out = "<div class='ap-card'><h2>HOLDINGS</h2><div class='ap-sub'>Coinbase " + esc(h.portfolio || "") + " portfolio \u00b7 read-only \u00b7 as of " + esc(a.generated_london) + "</div>";
    if (!rows.length) return out + "<div class='empty'>No non-zero holdings reported by Coinbase.</div></div>";
    out += "<div class='ap-tw'><table class='ap-t'><thead><tr><th>ASSET</th><th>AMOUNT</th><th>PRICE (USD)</th><th>VALUE (USD)</th><th>VALUE (\u00a3 EST.)</th><th>STAKED</th></tr></thead><tbody>";
    rows.forEach(function (r) {
      out += "<tr><td>" + esc(r.asset) + (r.is_cash ? " <small>(cash)</small>" : "") + "</td><td>" + amt(r.amount) + "</td><td>" + usd(r.price_usd) +
        "</td><td>" + usd(r.value_usd) + "</td><td>" + gbp(r.value_gbp_est) + "</td><td>" + (r.staked ? esc(JSON.stringify(r.staked)) : "\u2014") + "</td></tr>";
    });
    var t = h.total || {};
    out += "<tr class='tot'><td>TOTAL</td><td></td><td></td><td>" + usd(t.value_usd) + "</td><td>" + gbp(t.value_gbp_est) + "</td><td></td></tr></tbody></table></div>";
    out += "<div class='ap-note'>" + (fx ? "\u00a3 values are estimates at " + fx.rate.toFixed(4) + " GBP per USD (" + esc(fx.source) + ", " + esc(lon(fx.time)) + ")." : "No live GBP/USD rate available; \u00a3 estimate omitted.") +
      (num(t.coinbase_reported_total_usd) ? " Coinbase-reported portfolio total " + usd(t.coinbase_reported_total_usd) + "." : "") + " Prices are Coinbase USD mids. " + esc(h.staking_note || "") + ".</div></div>";
    return out;
  }

  function cashHtml(a) {
    var fc = a.free_cash, rows = (fc && fc.rows) || [], t = (fc && fc.total) || {};
    var out = "<div class='ap-card'><h2>FREE CASH \u00b7 AVAILABLE BALANCE</h2><div class='ap-sub'>Cash available to trade or buy \u00b7 as of " + esc(a.generated_london) + "</div>";
    if (!fc) return out + "<div class='empty'>Free cash not in this snapshot yet.</div></div>";
    out += "<div class='ap-kpis' style='grid-template-columns:1fr 1fr'><div class='ap-kpi'><b>AVAILABLE (USD)</b><span>" + usd(t.value_usd) + "</span></div>" +
      "<div class='ap-kpi'><b>AVAILABLE (\u00a3 EST.)</b><span>" + gbp(t.value_gbp_est) + "</span></div></div>";
    if (rows.length) {
      out += "<div class='ap-tw'><table class='ap-t' style='min-width:300px'><thead><tr><th>CURRENCY</th><th>AVAILABLE</th><th>ON HOLD</th><th>VALUE (USD)</th></tr></thead><tbody>";
      rows.forEach(function (r) {
        out += "<tr><td>" + esc(r.currency) + "</td><td>" + (num(r.available) ? r.available.toFixed(2) : "\u2014") + "</td><td>" + (num(r.on_hold) ? r.on_hold.toFixed(2) : "\u2014") + "</td><td>" + usd(r.value_usd) + "</td></tr>";
      });
      out += "</tbody></table></div>";
    }
    return out + "<div class='ap-note'>" + esc(fc.note || "") + (num(t.coinbase_reported_cash_usd) ? ". Coinbase-reported cash total " + usd(t.coinbase_reported_cash_usd) + "." : ".") + "</div></div>";
  }

  function perfHtml(a) {
    var p = a.performance || {}, d = p.daily, lo = p.from_low, w = p.win_rate;
    var out = "<div class='ap-card'><h2>PERFORMANCE</h2><div class='ap-sub'>From Coinbase fills and balance snapshots \u00b7 " + esc(p.snapshots) + " snapshot(s)</div>";
    out += "<div class='ap-status'>" + esc(p.status || "") + "</div><div class='ap-kpis'>";
    out += "<div class='ap-kpi'><b>DAILY P\x26amp;L</b>" + (d ? "<span class='" + cls(d.pnl_usd) + "'>" + usd(d.pnl_usd) + "</span><small>" + gbp(d.pnl_gbp_est) + " est. \u00b7 " + pct(d.pct) + " since " + esc(d.since) + (d.net_flows_usd ? " \u00b7 excl. " + usd(d.net_flows_usd) + " probable deposits" : "") + "</small>" : "<span>\u2014</span><small>Needs 24h of snapshots</small>") + "</div>";
    out += "<div class='ap-kpi'><b>FROM PERIOD LOW</b>" + (lo ? "<span class='" + cls(lo.pct) + "'>" + pct(lo.pct) + "</span><small>low " + usd(lo.low_usd) + " at " + esc(lo.low_time) + " (" + esc(lo.note) + ")</small>" : "<span>\u2014</span><small>Needs 2+ snapshots</small>") + "</div>";
    out += "<div class='ap-kpi'><b>WIN RATE</b>" + (w ? "<span>" + w.pct.toFixed(0) + "%</span><small>" + w.wins + "/" + w.closed + " closed trades \u00b7 realised " + usd(w.realised_usd) + "</small>" : "<span>\u2014</span><small>No closed trades yet</small>") + "</div></div>";
    var tr = a.trades || [];
    out += "<h2 style='margin-top:4px'>TRADE HISTORY</h2><div class='ap-list'>" + (tr.length ? tr.slice(0, 15).map(function (x) {
      return "<div>" + esc(lon(x.time)) + " \u00b7 " + esc(x.side) + " " + esc(x.size) + " " + esc(x.product) + " @ " + esc(x.price) + (x.fee ? " \u00b7 fee " + esc(x.fee) : "") + "</div>";
    }).join("") : "<div class='empty' style='font-family:var(--sans)'>No fills on Coinbase yet \u00b7 " + esc(a.orders_total || 0) + " orders, " + esc((a.open_orders || []).length) + " open</div>") + "</div>";
    var fl = a.flows || [];
    if (fl.length) out += "<h2 style='margin-top:12px'>BALANCE CHANGES NOT FROM TRADES</h2><div class='ap-list'>" + fl.map(function (f) {
      return "<div>" + esc(lon(f.time)) + " \u00b7 " + esc(f.kind) + " " + amt(f.amount) + " " + esc(f.asset) + (num(f.value_usd) ? " (" + usd(f.value_usd) + ")" : "") + "</div>";
    }).join("") + "</div>";
    out += "<div class='ap-note'>" + esc(a.deposit_note || "") + "</div></div>";
    return out;
  }

  function render() {
    var a = window.BQ && window.BQ.account;
    if (!box) return;
    if (!a) { box.innerHTML = ""; return; }
    box.innerHTML = "<div class='section-label'>Holdings \x26amp; Free cash</div><div class='ap-grid'>" + holdingsHtml(a) + cashHtml(a) + "</div>" +
      "<div class='section-label'>Performance</div><div class='ap-grid' style='grid-template-columns:1fr'>" + perfHtml(a) + "</div>";
  }

  function mount() {
    var app = document.getElementById("app");
    if (!app) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    box = document.createElement("div"); box.id = "acctSections"; app.appendChild(box);
    window.addEventListener("bq:data", render);
    window.addEventListener("bq:lock", function () { if (box) box.innerHTML = ""; });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

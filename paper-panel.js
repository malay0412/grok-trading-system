/* paper-panel.js - signed-in-only PAPER TRADING section for BOTTY QUANTER.grok. SIMULATED ONLY, never places orders.
   Data: window.BQ.payload.paper (decrypted from data/latest.enc.json by bq-crypto.js; written on the box by paper_engine.py).
   Shows the Team paper balance (Team A slice + Team B slice + idle reserve), open paper positions, closed paper trades,
   daily P&L, % from low, win rate, per-team accuracy and Team C's untraded signal accuracy. Nothing renders before decryption. */
(function () {
  "use strict";
  if (window.__paperPanel) return;
  window.__paperPanel = true;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "\x26amp;", "<": "\x26lt;", ">": "\x26gt;", '"': "\x26quot;", "'": "\x26#39;" }[c]; }); }
  function num(v) { return typeof v === "number" && isFinite(v); }
  function usd(v, dp) { dp = dp == null ? 2 : dp; return num(v) ? (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : "\u2014"; }
  function sgn(v, dp) { return num(v) ? (v >= 0 ? "+" : "") + usd(v, dp) : "\u2014"; }
  function pct(v) { return num(v) ? (v >= 0 ? "+" : "") + v.toFixed(2) + "%" : "\u2014"; }
  function cls(v) { return num(v) ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : ""; }
  function wr(s) { return s && s.trades ? s.win_rate.toFixed(0) + "% (" + s.wins + "/" + s.trades + ")" : "no closed trades yet"; }
  var CSS = [
    ".pp-pill{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.14em;padding:3px 8px;border-radius:999px;background:rgba(255,184,0,.16);color:#ffb800;border:1px solid rgba(255,184,0,.5);margin-left:8px;vertical-align:middle;}",
    ".pp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s4);}",
    ".pp-sl{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s4);}",
    "@media(max-width:960px){.pp-kpis,.pp-sl{grid-template-columns:repeat(2,1fr);}}",
    "@media(max-width:480px){.pp-kpis,.pp-sl{grid-template-columns:1fr;}}"
  ].join("\n");
  var box = null;
  function kpi(t, v, c, small) { return "<div class='ap-kpi'><b>" + t + "</b><span class='" + (c || "") + "'>" + v + "</span><small>" + (small || "") + "</small></div>"; }
  function html(p) {
    var A = p.slices.A || {}, B = p.slices.B || {}, C = (p.signals || {}).C || {};
    var o = "<div class='ap-card' id='paperCard'><h2>PAPER TRADING \u00b7 BTC-USD<span class='pp-pill'>PAPER MODE</span></h2>";
    o += "<div class='ap-sub'>Simulated trades only \u00b7 no real orders are placed \u00b7 started " + esc(p.started) + " \u00b7 last mark " + esc(p.last_mark) +
      (num(p.last_mid) ? " @ " + usd(p.last_mid) : "") + (p.halted ? " \u00b7 <b>engine stopped " + esc(p.halted_at || "") + "</b>" : "") + "</div>";
    o += "<div class='pp-kpis'>" +
      kpi("TEAM PAPER BALANCE", usd(p.balance), "", "start " + usd(p.start_balance) + " = Team A " + usd(A.start, 0) + " + Team B " + usd(B.start, 0) + " + idle " + usd(p.idle_reserve, 0)) +
      kpi("TOTAL PAPER P\x26amp;L", sgn(p.total_pnl), cls(p.total_pnl), pct(p.total_pnl_pct) + " \u00b7 fees " + usd(p.fees)) +
      kpi("DAILY P\x26amp;L", sgn(p.daily && p.daily.pnl), cls(p.daily && p.daily.pnl), pct(p.daily && p.daily.pct) + " \u00b7 " + esc(p.daily && p.daily.note)) +
      kpi("FROM LOW / WIN RATE", p.from_low ? pct(p.from_low.pct) : "\u2014", cls(p.from_low && p.from_low.pct), "low " + (p.from_low ? usd(p.from_low.low) + " at " + esc(p.from_low.at) : "\u2014") + " \u00b7 win rate " + wr(p)) + "</div>";
    function slice(k, s) {
      return kpi("TEAM " + k + " SLICE", usd(s.equity), "", "<span class='" + cls(s.pnl) + "' style='font-size:11px'>" + sgn(s.pnl) + " (" + pct(s.pnl_pct) + ")</span> \u00b7 unrealised " + sgn(s.unrealised) +
        " \u00b7 realised " + sgn(s.realised) + "<br>accuracy " + wr(s) + (s.trades ? " \u00b7 avg " + s.avg_R + "R" : "") + " \u00b7 " + s.open + " open");
    }
    var co = (C.open || [])[0];
    o += "<div class='pp-sl'>" + slice("A", A) + slice("B", B) +
      kpi("TEAM C \u00b7 SIGNALS ONLY", C.trades ? C.win_rate.toFixed(0) + "%" : "\u2014", "", "untraded, no money \u00b7 hypothetical accuracy " + wr(C) + (C.trades ? " \u00b7 avg " + C.avg_R + "R" : "") +
        (co ? "<br>open signal: " + esc(co.side) + " @ " + usd(co.entry) + " (" + (co.unrealised_R >= 0 ? "+" : "") + co.unrealised_R + "R)" : "<br>no open signal")) +
      kpi("IDLE RESERVE", usd(p.idle_reserve), "", "never traded") + "</div>";
    var op = p.open_positions || [];
    o += "<h2>OPEN PAPER POSITIONS</h2><div class='ap-tw'><table class='ap-t'><thead><tr><th>TEAM</th><th>SIDE</th><th>ENTRY</th><th>STOP</th><th>T1 / T2</th><th>QTY BTC</th><th>NOTIONAL</th><th>RISK</th><th>UNREALISED</th></tr></thead><tbody>" +
      (op.length ? op.map(function (x) {
        return "<tr><td>Team " + esc(x.team) + "</td><td>" + esc(x.side) + "</td><td>" + usd(x.entry) + "</td><td>" + usd(x.stop_now) + (x.t1_done ? " (BE)" : "") + "</td><td>" + usd(x.t1, 0) + " / " + usd(x.t2, 0) +
          "</td><td>" + esc(x.qty_open) + "</td><td>" + usd(x.notional) + "</td><td>" + usd(x.risk_usd) + "</td><td class='" + cls(x.unrealised) + "'>" + sgn(x.unrealised, 4) + " (" + (x.unrealised_R >= 0 ? "+" : "") + x.unrealised_R + "R)</td></tr>";
      }).join("") : "<tr><td colspan='9' style='text-align:left;font-family:var(--sans);color:var(--muted)'>No open paper positions</td></tr>") + "</tbody></table></div>";
    var cl = (p.closed || []).slice().reverse();
    o += "<h2 style='margin-top:12px'>CLOSED PAPER TRADES</h2><div class='ap-list'>" + (cl.length ? cl.slice(0, 20).map(function (x) {
      return "<div>" + esc(x.closed) + " \u00b7 Team " + esc(x.team) + " " + esc(x.side) + " @ " + usd(x.entry) + " \u2192 " + esc((x.exits || []).map(function (e) { return e.reason + " " + usd(e.price); }).join(", ")) +
        " \u00b7 <span class='" + cls(x.pnl) + "'>" + sgn(x.pnl, 4) + " (" + x.R + "R)</span></div>";
    }).join("") : "<div style='font-family:var(--sans)'>No closed paper trades yet</div>") + "</div>";
    var cc = (C.closed || []).slice().reverse();
    if (cc.length) o += "<h2 style='margin-top:12px'>TEAM C SIGNALS (UNTRADED, HYPOTHETICAL)</h2><div class='ap-list'>" + cc.slice(0, 10).map(function (x) {
      return "<div>" + esc(x.closed) + " \u00b7 " + esc(x.side) + " @ " + usd(x.entry) + " \u00b7 " + (x.R >= 0 ? "+" : "") + x.R + "R (no money)</div>"; }).join("") + "</div>";
    o += "<div class='ap-note'>" + esc(p.rules) + "</div></div>";
    return o;
  }
  function render() {
    var p = window.BQ && window.BQ.payload && window.BQ.payload.paper;
    if (!box) return;
    box.innerHTML = p ? "<div class='section-label'>Paper trading (simulated)</div><div class='ap-grid' style='grid-template-columns:1fr'>" + html(p) + "</div>" : "";
  }
  function mount() {
    var app = document.getElementById("app"); if (!app) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    box = document.createElement("div"); box.id = "paperSections";
    var acct = document.getElementById("acctSections");
    if (acct) app.insertBefore(box, acct); else app.appendChild(box);
    window.addEventListener("bq:data", render);
    window.addEventListener("bq:lock", function () { if (box) box.innerHTML = ""; });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

/* bots-panel.js - team style banner + animated sub-bot roster for BOTTY QUANTER.grok. ANALYSIS ONLY, never places orders.
   - Team styles/rules mirror /workspace/botty-quanter/config.py (TEAMS).
   - Bot name, element and skill come from each sub-bot's META in data/latest.json (teams.X.subbots).
   - Status is truthful: Online = the bot produced a valid output in the latest published cycle AND that cycle
     is under 6 hours old; otherwise Offline with its last run time (Europe/London).
   Adds a "Sub-bot roster" section under the team cards and wraps openOverlay() so Team A/B/C views
   open with the team's style banner and roster at the top. */
(function () {
  "use strict";
  if (window.__botsPanel) return;
  window.__botsPanel = true;

  var DATA_URL = window.BOTTY_DATA_URL || "data/latest.json";
  var REFRESH_MS = 60000, MAX_AGE_MS = 6 * 3600 * 1000;

  // From config.py TEAMS (vote_threshold, min_agree, min_net, min_rr, stops, filters, sizing).
  var TEAMS = {
    A: { name: "Team A", risk: "High risk", color: "var(--team-a)",
         style: "Aggressive breakout / momentum, wider targets.",
         rules: "Needs \u22655/10 sub-bots agreeing (vote at |score| \u22650.15), net score \u22650.15, R:R \u22651.5. Stop 1.25\u00d7 4h ATR (1\u20132.5\u00d7), T2 1.5\u00d7 daily ATR. No RSI or extension filters; no fixed size rule." },
    B: { name: "Team B", risk: "Mid risk", color: "var(--team-b)",
         style: "Balanced, standard filters.",
         rules: "Needs \u22656/10 agreeing (vote at |score| \u22650.25), net score \u22650.25, R:R \u22652. Stop 1\u00d7 4h ATR (1\u20131.5\u00d7). No shorts if daily RSI <28, no longs if >72, max 2 daily ATR from EMA20. Sizing: 1% risk of equity, max 2\u00d7 leverage." },
    C: { name: "Team C", risk: "Low risk", color: "var(--team-c)",
         style: "Conservative, high-probability, tight stops, strong confluence.",
         rules: "Needs \u22657/10 agreeing (vote at |score| \u22650.35), net score \u22650.35, R:R \u22652. Tight stop 0.75\u00d7 4h ATR (0.5\u20131\u00d7). No shorts if daily RSI <30, no longs if >70, max 1.5 daily ATR from EMA20. No fixed size rule." }
  };
  var TASKS = {
    "price action": "Reads ranges, swing structure and key price levels",
    "momentum indicators": "Measures the speed and strength of moves",
    "trend indicators": "Tracks trend direction across timeframes",
    "volume": "Checks whether volume confirms the move",
    "volatility": "Gauges the volatility regime",
    "news and macro": "Scores headline and macro sentiment",
    "historical patterns": "Tests how similar past setups played out",
    "order flow and liquidity": "Reads the order book and taker flow",
    "risk metrics": "Grades risk and risk-adjusted quality",
    "trade style rules": "Applies the team's trading rulebook"
  };

  var data = null, team = "A", picked = false;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "\x26amp;", "<": "\x26lt;", ">": "\x26gt;", '"': "\x26quot;", "'": "\x26#39;" }[c]; }); }

  // "2026-11-16 16:34:06 GMT" / "... BST" -> Date
  function cycleDate(d) {
    var m = d && /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) (GMT|BST|UTC)$/.exec(d.generated_london || "");
    if (!m) return null;
    var off = m[7] === "BST" ? 1 : 0;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - off, +m[5], +m[6]));
  }
  function londonTime(dt) {
    try {
      return dt.toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
    } catch (e) { return dt.toUTCString(); }
  }
  function validOutputs(b) {
    var o = b && b.outputs, n = 0;
    if (!o) return 0;
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) {
      var v = o[k];
      if (v && typeof v.score === "number" && isFinite(v.score) && typeof v.direction === "string") n++;
    }
    return n;
  }
  function focusSymbol(t) {
    var c = t && t.call;
    return (c && c.symbol) || (c && c.best_candidate && c.best_candidate.symbol) || null;
  }

  var CSS = [
    ".bp-banner{display:flex;gap:10px;align-items:flex-start;background:var(--panel);border:1px solid var(--border);border-left:3px solid var(--bp-c,var(--accent));border-radius:var(--r-sm);padding:10px 12px;margin-bottom:12px;font-size:13px;color:var(--text-2);line-height:1.45;}",
    ".bp-banner b{color:var(--text);}",
    ".bp-banner small{display:block;color:var(--muted);font-size:12px;margin-top:2px;}",
    ".bp-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;}",
    ".bp-tab{background:var(--panel);border:1px solid var(--border);color:var(--text-2);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans);}",
    ".bp-tab.on{border-color:var(--bp-c);color:var(--text);box-shadow:inset 0 0 0 1px var(--bp-c);}",
    ".bp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin-bottom:20px;}",
    ".bp-bot{background:var(--panel);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;display:flex;gap:10px;min-width:0;}",
    ".bp-bot .bp-ico{flex:0 0 34px;height:40px;color:var(--bp-c,var(--accent));}",
    ".bp-bot .bp-body{min-width:0;flex:1;}",
    ".bp-bot .bp-name{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".bp-bot .bp-el{font-size:11px;color:var(--muted);}",
    ".bp-bot .bp-row{font-size:11.5px;color:var(--text-2);margin-top:4px;line-height:1.4;}",
    ".bp-bot .bp-row b{color:var(--muted);font-weight:600;font-size:10px;letter-spacing:.06em;margin-right:4px;}",
    ".bp-bot .bp-vote{font-family:var(--mono);font-size:11px;margin-top:4px;color:var(--text-2);}",
    ".bp-vote .long{color:var(--green);} .bp-vote .short{color:var(--red);} .bp-vote .neutral{color:var(--muted);}",
    ".bp-badge{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:999px;margin-top:6px;}",
    ".bp-badge i{width:7px;height:7px;border-radius:50%;display:inline-block;}",
    ".bp-on{color:var(--green);background:var(--green-soft);} .bp-on i{background:var(--green);animation:bpPulse 1.8s ease-in-out infinite;}",
    ".bp-off{color:var(--muted);background:rgba(122,135,156,.12);} .bp-off i{background:var(--muted);}",
    ".bp-last{font-size:10.5px;color:var(--muted);margin-left:6px;}",
    ".bp-robot{width:34px;height:40px;animation:bpBob 3.2s ease-in-out infinite;}",
    ".bp-robot .eye{transform-box:fill-box;transform-origin:center;animation:bpBlink 4.5s infinite;}",
    ".bp-bot.off .bp-robot{animation:none;opacity:.45;filter:grayscale(1);} .bp-bot.off .bp-robot .eye{animation:none;transform:scaleY(.2);}",
    "@keyframes bpBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}",
    "@keyframes bpBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}",
    "@keyframes bpPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}50%{box-shadow:0 0 0 4px rgba(34,197,94,0)}}",
    "@media (prefers-reduced-motion: reduce){.bp-robot,.bp-robot .eye,.bp-on i{animation:none !important;}}",
    "@media (max-width:480px){.bp-grid{grid-template-columns:1fr 1fr;gap:8px;}.bp-bot{flex-direction:column;gap:4px;padding:8px;}.bp-bot .bp-ico{height:34px;}.bp-robot{height:34px;}}"
  ].join("\n");

  function robot(i) {
    var d = (i % 5) * 0.37; // stagger the idle animations
    return "<svg class='bp-robot' viewBox='0 0 34 40' style='animation-delay:-" + d + "s' aria-hidden='true'>" +
      "<line x1='17' y1='2' x2='17' y2='8' stroke='currentColor' stroke-width='1.5'/><circle cx='17' cy='2.5' r='2' fill='currentColor'/>" +
      "<rect x='5' y='8' width='24' height='18' rx='5' fill='none' stroke='currentColor' stroke-width='1.6'/>" +
      "<circle class='eye' cx='12.5' cy='16.5' r='2.4' fill='currentColor' style='animation-delay:-" + (d * 2) + "s'/>" +
      "<circle class='eye' cx='21.5' cy='16.5' r='2.4' fill='currentColor' style='animation-delay:-" + (d * 2) + "s'/>" +
      "<line x1='12' y1='22' x2='22' y2='22' stroke='currentColor' stroke-width='1.4' stroke-linecap='round'/>" +
      "<rect x='9' y='28' width='16' height='10' rx='3' fill='currentColor' opacity='.35'/></svg>";
  }

  function bannerHtml(k, prompt) {
    var T = TEAMS[k];
    return "<div class='bp-banner' style='--bp-c:" + T.color + "'><div><b>" + esc(T.name) + " \u00b7 " + esc(T.risk) + ":</b> " + esc(T.style) +
      "<small>" + esc(T.rules) + "</small>" + (prompt ? "<small>" + esc(prompt) + "</small>" : "") + "</div></div>";
  }

  function rosterHtml(k) {
    var T = TEAMS[k];
    if (!data || !data.teams || !data.teams[k] || !data.teams[k].subbots) {
      return "<div class='bp-grid'><div class='bp-bot off' style='--bp-c:" + T.color + "'><div class='bp-body'><div class='bp-row'>Sub-bot data not loaded yet (data/latest.json). Status: Offline.</div></div></div></div>";
    }
    var t = data.teams[k], sym = focusSymbol(t), cd = cycleDate(data);
    var fresh = cd ? (Date.now() - cd.getTime()) < MAX_AGE_MS : false;
    var last = cd ? londonTime(cd) : "unknown";
    var h = "<div class='bp-grid' style='--bp-c:" + T.color + "'>";
    t.subbots.forEach(function (b, i) {
      var ok = validOutputs(b) > 0, on = ok && fresh;
      var o = sym ? b.outputs[sym] : null;
      var short = String(b.name || "").split("-")[0];
      h += "<div class='bp-bot " + (on ? "on" : "off") + "' title='" + esc(b.name) + "'>" +
        "<div class='bp-ico'>" + robot(i) + "</div><div class='bp-body'>" +
        "<div class='bp-name'>" + esc(b.name) + "</div>" +
        "<div class='bp-el'>" + esc(short + " \u00b7 " + b.element) + "</div>" +
        "<div class='bp-row'><b>TASK</b>" + esc(TASKS[b.element] || b.element) + "</div>" +
        "<div class='bp-row'><b>SKILL</b>" + esc(b.style) + "</div>" +
        (o ? "<div class='bp-vote'>" + esc(sym) + ": <span class='" + esc(o.direction) + "'>" + esc(o.direction) + "</span> (" + (o.score >= 0 ? "+" : "") + esc(o.score) + ")</div>" : "") +
        "<div><span class='bp-badge " + (on ? "bp-on" : "bp-off") + "'><i></i>" + (on ? "ONLINE" : "OFFLINE") + "</span>" +
        "<span class='bp-last'>" + (on ? "ran " : "last run ") + esc(last) + (ok ? "" : " \u00b7 no valid output") + "</span></div>" +
        "</div></div>";
    });
    return h + "</div>";
  }

  function renderPanel() {
    var box = document.getElementById("bpPanel");
    if (!box) return;
    var tabs = "<div class='bp-tabs'>" + ["A", "B", "C"].map(function (k) {
      return "<button type='button' class='bp-tab" + (k === team ? " on" : "") + "' style='--bp-c:" + TEAMS[k].color + "' data-team='" + k + "'>" + TEAMS[k].name + "</button>";
    }).join("") + "</div>";
    var t = data && data.teams && data.teams[team], sym = focusSymbol(t);
    var sub = sym ? "Votes shown on " + sym + " (this team's " + (t.call && t.call.symbol ? "call" : "best candidate") + "), latest cycle." : "";
    box.innerHTML = bannerHtml(team, picked ? sub : "Showing Team A by default \u2014 click a team card or tab to switch. " + sub) + tabs + rosterHtml(team);
  }

  function select(k) { if (TEAMS[k]) { team = k; picked = true; renderPanel(); } }

  function mount() {
    var st = document.createElement("style"); st.id = "bp-style"; st.textContent = CSS; document.head.appendChild(st);
    var teams = document.querySelector(".teams");
    // Main-page roster disabled (Malay: cards only inside Team A/B/C views). Set window.BP_MAIN_ROSTER = true to re-enable.
    if (window.BP_MAIN_ROSTER && teams && teams.parentNode) {
      var label = document.createElement("div"); label.className = "section-label"; label.textContent = "Sub-bot roster";
      var box = document.createElement("div"); box.id = "bpPanel";
      teams.parentNode.insertBefore(box, teams.nextSibling);
      teams.parentNode.insertBefore(label, box);
      box.addEventListener("click", function (e) {
        var b = e.target && e.target.closest ? e.target.closest(".bp-tab") : null;
        if (b) select(b.getAttribute("data-team"));
      });
    }
    // Wrap openOverlay: team views get the style banner + roster at the top.
    var orig = window.openOverlay;
    if (typeof orig === "function") {
      window.openOverlay = function (key) {
        var r = orig.apply(this, arguments);
        var k = String(key || "").toUpperCase();
        if (TEAMS[k]) {
          select(k);
          var oc = document.getElementById("overlayContent");
          if (oc) {
            var top = document.createElement("div"); top.id = "bpOverlayTop";
            top.innerHTML = bannerHtml(k) + rosterHtml(k);
            oc.insertBefore(top, oc.firstChild);
          }
        }
        return r;
      };
    }
    renderPanel();
    load();
    setInterval(load, REFRESH_MS);
  }

  function load() {
    if (!window.fetch) return;
    fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(r.status); return r.json();
    }).then(function (d) {
      data = d; renderPanel();
      var top = document.getElementById("bpOverlayTop"), ov = document.getElementById("overlay");
      if (top && ov && ov.classList.contains("open")) top.innerHTML = bannerHtml(team) + rosterHtml(team);
    })["catch"](function () { renderPanel(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

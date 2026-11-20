/* HOT NEWS panel. Self-contained; takes over the existing #newsList card and the news overlay.
   ANALYSIS ONLY — this script never places orders and never reads account data.
   "Why it matters" lines come from data/news.json (rule-based templates in scripts/fetch_news.py)
   or a matching client-side rule for payload fallback items. */
(function () {
  var CACHE_KEY = "bq_news_cache_v1";
  var INTERVAL_KEY = "bq_news_interval";
  var TICK_MS = 5000;
  var DEFAULT_MIN = 5;
  var ALLOWED = { 1: 1, 5: 1, 15: 1 };
  var NEWS_URL = "data/news.json";
  var MARKETS = [
    { id: "crypto", label: "Crypto" },
    { id: "stocks", label: "Stocks" },
    { id: "commodities", label: "Commodities" },
    { id: "macro", label: "Macro" }
  ];
  var SOURCE_COLORS = {
    coindesk: "#2563eb", cointelegraph: "#0891b2", decrypt: "#7c3aed",
    reuters: "#f97316", wsj: "#64748b", bloomberg: "#6366f1",
    ft: "#f59e0b", bbc: "#ef4444", yahoo: "#a855f7", fxstreet: "#10b981"
  };
  var SOURCE_MARKS = {
    coindesk: "CD", cointelegraph: "CT", decrypt: "DC", reuters: "RE",
    wsj: "WS", bloomberg: "BB", ft: "FT", bbc: "BBC", yahoo: "YF",
    fxstreet: "FX"
  };

  var state = {
    items: [],
    updated: null,
    source: "none", /* live | cache | payload | none */
    offline: false,
    filter: "all",
    tickIndex: 0,
    timer: null,
    poller: null,
    intervalMin: DEFAULT_MIN,
    mounted: false
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[\x26<>"']/g, function (c) {
      return { "\x26": "\x26amp;", "<": "\x26lt;", ">": "\x26gt;", '"': "\x26quot;", "'": "\x26#39;" }[c];
    });
  }
  function londonParts(d) {
    var fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    });
    var map = {};
    fmt.formatToParts(d).forEach(function (p) { map[p.type] = p.value; });
    return map;
  }
  function hhmm(d) {
    if (!(d instanceof Date) || isNaN(d)) return "--:--";
    var p = londonParts(d);
    return p.hour + ":" + p.minute;
  }
  function relTime(iso) {
    var t = new Date(iso);
    if (isNaN(t)) return "";
    var sec = Math.round((Date.now() - t.getTime()) / 1000);
    if (sec < 45) return "just now";
    if (sec < 3600) return Math.max(1, Math.round(sec / 60)) + "m ago";
    if (sec < 86400) return Math.max(1, Math.round(sec / 3600)) + "h ago";
    var days = Math.round(sec / 86400);
    if (days === 1) return "Yesterday " + hhmm(t);
    return days + "d ago";
  }
  function marketLabel(id) {
    var m = MARKETS.filter(function (x) { return x.id === id; })[0];
    return m ? m.label : id;
  }
  function initials(item) {
    if (item && SOURCE_MARKS[item.source_id]) return SOURCE_MARKS[item.source_id];
    var name = (item && item.source) || "";
    var parts = String(name).replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
    if (!parts[0]) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  function sourceMark(item) {
    var color = SOURCE_COLORS[item.source_id] || "#4f8cff";
    return '<span class="np-mark" style="background:' + color + '" title="' + esc(item.source) + '">' + esc(initials(item)) + "</span>";
  }
  function sentDot(s) {
    var lab = s === "bullish" ? "Bullish" : s === "bearish" ? "Bearish" : "Neutral";
    return '<span class="np-dot ' + esc(s || "neutral") + '" title="' + lab + '"></span>';
  }
  function chips(tickers) {
    return (tickers || []).map(function (t) { return '<span class="np-ticker-chip">' + esc(t) + "</span>"; }).join("");
  }

  function readInterval() {
    try {
      var v = parseInt(localStorage.getItem(INTERVAL_KEY) || "", 10);
      return ALLOWED[v] ? v : DEFAULT_MIN;
    } catch (e) { return DEFAULT_MIN; }
  }
  function writeInterval(v) {
    state.intervalMin = ALLOWED[v] ? v : DEFAULT_MIN;
    try { localStorage.setItem(INTERVAL_KEY, String(state.intervalMin)); } catch (e) {}
  }
  function saveCache(payload) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        saved_at: new Date().toISOString(),
        updated: payload.updated || payload.updated_london,
        updated_london: payload.updated_london,
        items: payload.items
      }));
    } catch (e) {}
  }
  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function mapSentiment(v) {
    if (v === "bullish" || v === "bearish" || v === "neutral") return v;
    var n = Number(v);
    if (n < 0) return "bearish";
    if (n > 0) return "bullish";
    return "neutral";
  }
  function ruleContext(title, market, sentiment, tickers) {
    var t = String(title || "").toLowerCase();
    if (/\b(federal reserve|fomc|rate hike|rate cut|interest rate)\b/.test(t))
      return "Fed-policy headlines often move the dollar, yields and risk assets together, so this is a macro input for today's tape.";
    if (/\b(inflation|cpi|pce)\b/.test(t))
      return "Inflation prints feed rate expectations, which then spill into yields, the dollar, gold and equities.";
    if (/\b(gold prices?|gold falls?|bullion|\bxau\b)\b/.test(t))
      return "Gold usually tracks real yields and the dollar; this may matter for XAU and related commodities.";
    if (/\b(wti|brent crude|crude oil|oil prices?)\b/.test(t))
      return "Crude supply or demand news can move WTI and Brent directly and also feed the inflation and rates debate.";
    if (/\b(bitcoin|btc)\b/.test(t))
      return "A bitcoin-focused headline can set the tone for the wider crypto complex, especially large-cap names.";
    var tagged = tickers && tickers.length ? " involving " + tickers.join(", ") : "";
    var sent = sentiment || "neutral";
    var mkt = market || "crypto";
    var fb = {
      "crypto|bearish": "A bearish crypto headline" + tagged + "; traders may treat it as near-term risk for the tagged names.",
      "crypto|bullish": "A constructive crypto headline" + tagged + "; it may support sentiment in the tagged names if the story holds.",
      "crypto|neutral": "A crypto development" + tagged + "; it is informational rather than a clear directional signal.",
      "stocks|bearish": "A bearish equity headline" + tagged + "; it may weigh on the tagged names and on risk appetite more broadly.",
      "stocks|bullish": "A constructive equity headline" + tagged + "; it may support the tagged names if the wider tape agrees.",
      "stocks|neutral": "An equity-market development" + tagged + "; useful context, but not a clear buy or sell signal on its own.",
      "commodities|bearish": "A bearish commodities headline" + tagged + "; this may pressure the tagged contracts in the near term.",
      "commodities|bullish": "A constructive commodities headline" + tagged + "; this may support the tagged contracts if the story holds.",
      "commodities|neutral": "A commodities-market development" + tagged + "; informational rather than a clear directional signal.",
      "macro|bearish": "A hawkish or risk-off macro headline" + tagged + "; this kind of news often tightens financial conditions.",
      "macro|bullish": "A dovish or risk-on macro headline" + tagged + "; this kind of news can ease financial conditions.",
      "macro|neutral": "A macro-policy development" + tagged + "; it is a background input for rates, the dollar and risk assets."
    };
    return fb[mkt + "|" + sent] || "A market headline worth noting; the note itself is a keyword rule, not an editorial view.";
  }
  function normalizeItems(items) {
    return (items || []).map(function (n) {
      var headline = n.headline || n.title || "";
      var tickers = n.tickers || n.symbols || [];
      if (typeof tickers === "string") tickers = [tickers];
      tickers = tickers.map(function (s) { return String(s).replace(/-USD$/, ""); }).filter(Boolean);
      var market = n.market;
      if (!market) market = n.macro ? "macro" : (tickers.length ? "crypto" : "crypto");
      var sentiment = mapSentiment(n.sentiment);
      var published = n.published || n.published_london || n.updated;
      return {
        id: n.id || n.url || headline,
        headline: headline,
        url: n.url || "",
        source: n.source || "Snapshot",
        source_id: n.source_id || String(n.source || "snapshot").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16),
        market: market,
        published: published,
        sentiment: sentiment,
        tickers: tickers,
        context: n.context || ruleContext(headline, market, sentiment, tickers),
        context_kind: n.context_kind || "rule"
      };
    }).filter(function (n) { return n.headline; }).sort(function (a, b) {
      return new Date(b.published) - new Date(a.published);
    });
  }
  function payloadNews() {
    var d = window.BQ && window.BQ.data;
    if (d && Array.isArray(d.news) && d.news.length) return normalizeItems(d.news);
    return [];
  }

  function apply(items, updated, source, offline) {
    state.items = items || [];
    state.updated = updated ? new Date(updated) : new Date();
    if (isNaN(state.updated)) state.updated = new Date();
    state.source = source;
    state.offline = !!offline;
    if (state.tickIndex >= state.items.length) state.tickIndex = 0;
    renderStatus();
    renderTicker();
    if ($("overlay") && $("overlay").classList.contains("news-desk") && $("overlay").classList.contains("open")) {
      renderDeskBody();
    }
  }

  function renderStatus() {
    var live = !state.offline && state.source === "live";
    var time = hhmm(state.updated);
    var html = live
      ? '<span class="dot"></span>Live · updated ' + time + " London"
      : '<span class="dot"></span>Offline · showing cached ' + time;
    document.querySelectorAll("[data-np-status]").forEach(function (el) {
      el.className = "np-status " + (live ? "live" : "offline");
      el.setAttribute("data-np-status", "");
      el.innerHTML = html;
    });
    var card = $("newsCard");
    if (card) card.classList.toggle("is-offline", !live);
    var banner = $("npOfflineBanner");
    if (banner) {
      banner.textContent = live ? "" : "Offline — showing the last headlines saved on this device.";
    }
  }

  function renderTicker() {
    var track = $("npTrack");
    var count = $("npCount");
    if (!track) return;
    if (!state.items.length) {
      track.innerHTML = '<div class="np-item active"><div class="np-headline" style="color:var(--muted);font-weight:500">Awaiting headlines</div></div>';
      if (count) count.textContent = "";
      return;
    }
    var html = state.items.map(function (item, i) {
      return '<article class="np-item' + (i === state.tickIndex ? " active" : "") + '" data-i="' + i + '">' +
        '<div class="np-meta">' + sourceMark(item) +
        '<span class="np-source">' + esc(item.source) + "</span>" +
        '<span class="np-chip ' + esc(item.market) + '">' + esc(marketLabel(item.market)) + "</span>" +
        sentDot(item.sentiment) +
        '<span class="np-rel">' + esc(relTime(item.published)) + "</span></div>" +
        '<div class="np-headline">' + esc(item.headline) + "</div></article>";
    }).join("") + '<div class="np-progress"><i></i></div>';
    track.innerHTML = html;
    if (count) count.textContent = (state.tickIndex + 1) + " / " + state.items.length;
  }

  function restartProgress() {
    var bar = document.querySelector(".np-progress > i");
    if (!bar) return;
    bar.style.animation = "none";
    void bar.offsetWidth;
    bar.style.animation = "";
  }
  function tick() {
    if (state.items.length < 2) return;
    var cur = document.querySelector(".np-item.active");
    state.tickIndex = (state.tickIndex + 1) % state.items.length;
    var next = document.querySelector('.np-item[data-i="' + state.tickIndex + '"]');
    if (cur) {
      cur.classList.remove("active");
      cur.classList.add("exit");
      setTimeout(function () { cur.classList.remove("exit"); }, 480);
    }
    if (next) next.classList.add("active");
    var count = $("npCount");
    if (count) count.textContent = (state.tickIndex + 1) + " / " + state.items.length;
    restartProgress();
  }
  function startTicker() {
    stopTicker();
    if (state.items.length >= 2) state.timer = setInterval(tick, TICK_MS);
  }
  function stopTicker() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  function filtered() {
    if (state.filter === "all") return state.items;
    return state.items.filter(function (x) { return x.market === state.filter; });
  }
  function storyHtml(item) {
    var when = relTime(item.published);
    var t = item.published ? hhmm(new Date(item.published)) : "";
    if (t) when += " · " + t + " London";
    var flag = item.context_kind === "rule" ? '<span class="np-flag">Rule-based note</span>' : "";
    var href = item.url ? ' href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer"' : "";
    var head = item.url ? "<a" + href + ">" + esc(item.headline) + "</a>" : esc(item.headline);
    return '<article class="np-story"><div class="np-story-top">' +
      sentDot(item.sentiment) + sourceMark(item) +
      '<span class="np-source">' + esc(item.source) + "</span>" +
      '<span class="np-chip ' + esc(item.market) + '">' + esc(marketLabel(item.market)) + "</span>" +
      '<span class="np-rel">' + esc(when) + "</span></div>" +
      "<h4>" + head + "</h4>" +
      '<p class="np-context">' + flag + esc(item.context) + "</p>" +
      '<div class="np-story-bot">' + chips(item.tickers) + "</div></article>";
  }
  function renderDeskBody() {
    var tabs = $("npTabs");
    var body = $("npDesk");
    if (!tabs || !body) return;
    var counts = { all: state.items.length };
    MARKETS.forEach(function (m) {
      counts[m.id] = state.items.filter(function (x) { return x.market === m.id; }).length;
    });
    var tabList = [{ id: "all", label: "All" }].concat(MARKETS);
    tabs.innerHTML = tabList.map(function (t) {
      return '<button type="button" class="np-tab' + (state.filter === t.id ? " on" : "") + '" data-filter="' + t.id + '">' +
        esc(t.label) + '<span class="n">' + (counts[t.id] || 0) + "</span></button>";
    }).join("");
    var items = filtered();
    if (!items.length) {
      body.innerHTML = '<div class="np-empty">No headlines in this category.</div>';
      return;
    }
    if (state.filter !== "all") {
      body.innerHTML = '<section class="np-group">' + items.map(storyHtml).join("") + "</section>";
      return;
    }
    body.innerHTML = MARKETS.map(function (m) {
      var group = items.filter(function (x) { return x.market === m.id; });
      if (!group.length) return "";
      return '<section class="np-group"><h3 class="np-group-title"><span class="np-chip ' + m.id + '">' +
        esc(m.label) + "</span> " + group.length + "</h3>" + group.map(storyHtml).join("") + "</section>";
    }).join("");
  }

  function openDesk() {
    var ov = $("overlay");
    if (!ov) return;
    $("overlayTitle").textContent = "HOT NEWS";
    $("overlayContent").innerHTML =
      '<div class="np-desk-flags"><span class="np-status live" data-np-status></span></div>' +
      '<p class="np-desk-sub">Grouped by market. “Why it matters” notes are rule-based templates, not editorial copy.</p>' +
      '<div class="np-tabs" id="npTabs"></div><div id="npDesk"></div>';
    ov.classList.add("open", "news-desk");
    renderStatus();
    renderDeskBody();
  }
  function onDeskClick(e) {
    var tab = e.target.closest && e.target.closest(".np-tab");
    if (!tab) return;
    e.preventDefault();
    e.stopPropagation();
    state.filter = tab.getAttribute("data-filter") || "all";
    renderDeskBody();
  }

  function startPoll() {
    if (state.poller) clearInterval(state.poller);
    state.poller = setInterval(function () { load("timer"); }, state.intervalMin * 60 * 1000);
  }

  function load(reason) {
    var online = typeof navigator === "undefined" || navigator.onLine !== false;
    if (!online) {
      var cached = loadCache();
      if (cached && cached.items && cached.items.length) {
        apply(normalizeItems(cached.items), cached.updated_london || cached.updated, "cache", true);
        return;
      }
      var pay = payloadNews();
      apply(pay, new Date().toISOString(), pay.length ? "payload" : "none", true);
      return;
    }
    var url = NEWS_URL + (NEWS_URL.indexOf("?") >= 0 ? "\x26" : "?") + "t=" + Date.now();
    fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      return res.json();
    }).then(function (data) {
      var items = normalizeItems(data && data.items);
      if (!items.length) throw new Error("empty");
      saveCache({ updated: data.updated, updated_london: data.updated_london, items: items });
      apply(items, data.updated_london || data.updated, "live", false);
      if (!state.timer) startTicker();
    }).catch(function () {
      var cached = loadCache();
      if (cached && cached.items && cached.items.length) {
        apply(normalizeItems(cached.items), cached.updated_london || cached.updated, "cache", true);
        return;
      }
      var pay = payloadNews();
      if (pay.length) {
        apply(pay, new Date().toISOString(), "payload", true);
        return;
      }
      apply([], new Date().toISOString(), "none", true);
    });
  }

  function mount(card) {
    if (!card || state.mounted) return;
    state.mounted = true;
    card.id = "newsCard";
    card.classList.add("news-card");
    card.removeAttribute("onclick");
    state.intervalMin = readInterval();
    card.innerHTML =
      '<div class="news-card-head">' +
        "<h2>HOT NEWS</h2>" +
        '<div class="news-head-right">' +
          '<label class="np-int">Every <select id="npInterval" aria-label="Headline refresh interval">' +
            '<option value="1">1 min</option><option value="5">5 min</option><option value="15">15 min</option>' +
          "</select></label>" +
          '<button type="button" class="np-refresh" id="npRefresh" title="Refresh headlines now">Refresh</button>' +
          '<span class="np-status live" data-np-status><span class="dot"></span>Live</span>' +
        "</div>" +
      "</div>" +
      '<div class="np-offline-banner" id="npOfflineBanner"></div>' +
      '<div class="np-ticker"><div class="np-track" id="npTrack"></div></div>' +
      '<div class="news-card-foot"><span class="np-count" id="npCount"></span><span class="hint">Click to enlarge →</span></div>' +
      '<div id="newsList" hidden></div>';
    var sel = $("npInterval");
    if (sel) {
      sel.value = String(state.intervalMin);
      sel.addEventListener("click", function (e) { e.stopPropagation(); });
      sel.addEventListener("change", function (e) {
        e.stopPropagation();
        writeInterval(parseInt(sel.value, 10));
        startPoll();
      });
    }
    var btn = $("npRefresh");
    if (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        btn.disabled = true;
        load("manual");
        setTimeout(function () { btn.disabled = false; }, 800);
      });
    }
    card.addEventListener("click", function (e) {
      if (e.target.closest && (e.target.closest("button") || e.target.closest("select") || e.target.closest("label") || e.target.closest("a"))) return;
      openDesk();
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDesk(); }
    });
    if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "0");
    document.addEventListener("click", onDeskClick);
  }

  function wrapHooks() {
    var _open = window.openOverlay;
    window.openOverlay = function (key) {
      if (key === "news") { openDesk(); return; }
      var ov = $("overlay");
      if (ov) ov.classList.remove("news-desk");
      if (typeof _open === "function") return _open.apply(this, arguments);
    };
    var _close = window.closeOverlay;
    window.closeOverlay = function () {
      var ov = $("overlay");
      if (ov) ov.classList.remove("news-desk");
      if (typeof _close === "function") return _close.apply(this, arguments);
    };
    /* Keep #newsList in the card so the existing render() hook does not throw. */
  }

  function boot() {
    var list = $("newsList");
    if (!list) return;
    var card = list.closest(".card");
    if (!card) return;
    mount(card);
    wrapHooks();
    load("init");
    startTicker();
    startPoll();
    window.addEventListener("offline", function () { load("offline"); });
    window.addEventListener("online", function () { load("online"); });
  }

  window.NewsPanel = {
    open: openDesk,
    refresh: function () { load("api"); },
    state: state
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

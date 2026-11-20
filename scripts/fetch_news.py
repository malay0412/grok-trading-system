#!/usr/bin/env python3
"""Fetch public RSS headlines and write data/news.json.

Headlines only — never Coinbase or account data.
"Why it matters" lines are deterministic keyword/template rules, not editorial or model-generated copy.
Stdlib only. Intended to run in GitHub Actions (zero Grok credits).
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "news.json"

UA = "BOTTY-QUANTER-news-bot/1.0 (public RSS; +https://malay0412.github.io/grok-trading-system/)"
TIMEOUT = 20
MAX_ITEMS = 40

FEEDS = [
    {"url": "https://www.coindesk.com/arc/outboundfeeds/rss/", "source": "CoinDesk", "source_id": "coindesk", "market": "crypto"},
    {"url": "https://cointelegraph.com/rss", "source": "Cointelegraph", "source_id": "cointelegraph", "market": "crypto"},
    {"url": "https://decrypt.co/feed", "source": "Decrypt", "source_id": "decrypt", "market": "crypto"},
    {
        "url": "https://news.google.com/rss/search?q=bitcoin+OR+ethereum+OR+crypto+when:1d&hl=en-GB&gl=GB&ceid=GB:en",
        "source": "Google News",
        "source_id": "gnews",
        "market": "crypto",
    },
    {
        "url": "https://news.google.com/rss/search?q=stock+market+OR+Wall+Street+OR+FTSE+OR+Nasdaq+when:1d&hl=en-GB&gl=GB&ceid=GB:en",
        "source": "Google News",
        "source_id": "gnews",
        "market": "stocks",
    },
    {
        "url": "https://news.google.com/rss/search?q=oil+OR+WTI+OR+Brent+OR+gold+OR+commodities+when:1d&hl=en-GB&gl=GB&ceid=GB:en",
        "source": "Google News",
        "source_id": "gnews",
        "market": "commodities",
    },
    {
        "url": "https://news.google.com/rss/search?q=federal+reserve+OR+%22Bank+of+England%22+OR+inflation+OR+interest+rates+when:1d&hl=en-GB&gl=GB&ceid=GB:en",
        "source": "Google News",
        "source_id": "gnews",
        "market": "macro",
    },
]

# Keyword rules: first market match in this order wins over the feed default when strong.
MARKET_RULES = [
    ("macro", r"\b(federal reserve|fomc|interest rate|rate hike|rate cut|inflation|ecb|bank of england|treasury yield|bond yield|cpi|pce|hawkish|dovish|goolsbee|powell)\b"),
    ("commodities", r"\b(wti|brent crude|brent oil|brent price|crude oil|crude prices|oil prices|oil price|gold prices|gold price|gold falls|gold fell|gold rally|bullion|\bxau\b|copper|natural gas|commodit|opec)\b"),
    ("crypto", r"\b(bitcoin|ethereum|crypto|blockchain|solana|xrp|spot etf|ibit|coinbase|binance|stablecoin|defi|token)\b"),
    ("stocks", r"\b(wall street|s&p|s & p|nasdaq|dow jones|ftse|ipo|equities|stock market|shares|nvidia|megacap)\b"),
]

TICKER_RULES = [
    (r"\b(bitcoin|btc)\b", "BTC"),
    (r"\b(ethereum|ether|eth)\b", "ETH"),
    (r"\b(solana|sol)\b", "SOL"),
    (r"\b\bxrp\b", "XRP"),
    (r"\bcoinbase\b", "COIN"),
    (r"\bibit\b", "IBIT"),
    (r"\b(nvidia|nvda)\b", "NVDA"),
    (r"\b(vix|fear gauge)\b", "VIX"),
    (r"\b(s&p|s & p|spx|wall street|nasdaq)\b", "SPX"),
    (r"\bftse\b", "UKX"),
    (r"\b(gold prices?|gold falls?|gold fell|gold rall(?:y|ies)|bullion|\bxau\b)\b", "XAU"),
    (r"\b(wti|brent crude|brent oil|crude oil|oil prices|oil price|oil futures|oil prices?)\b", "CL"),
    (r"\b(dollar index|dxy|strong dollar|us dollar)\b", "DXY"),
    (r"\b(yields?|treasury|tnx)\b", "TNX"),
    (r"\b(smh|semiconductor)\b", "SMH"),
]

BULLISH = re.compile(
    r"\b(rally|rallies|surge|surges|jump|jumps|soar|soars|gain|gains|boost|boosts|record high|breaks out|breakout|approve|approves|bullish|rebounds?|recover(?:s|y)?)\b",
    re.I,
)
BEARISH = re.compile(
    r"\b(fall|falls|fell|drop|drops|dropped|plunge|plunges|crash|sell-?off|selloff|tumble|tumbles|loses?|loss|fraud|hack|theft|warning|worst|low|lows|below|risks? breaking|hawkish|hike|hikes|charge[sd]?|probe)\b",
    re.I,
)

# More specific "why it matters" templates, then a market+sentiment fallback.
# These are rule-based, not editorial judgement.
SPECIAL_CONTEXT = [
    (r"\b(federal reserve|fomc|rate hike|rate cut|interest rate)\b",
     "Fed-policy headlines often move the dollar, yields and risk assets together, so this is a macro input for today's tape."),
    (r"\b(inflation|cpi|pce)\b",
     "Inflation prints feed rate expectations, which then spill into yields, the dollar, gold and equities."),
    (r"\b(gold prices?|gold falls?|gold fell|gold rall(?:y|ies)|bullion|\bxau\b)\b",
     "Gold usually tracks real yields and the dollar; this may matter for XAU and related commodities."),
    (r"\b(wti|brent crude|brent oil|crude oil|oil prices|oil price|oil futures)\b",
     "Crude supply or demand news can move WTI and Brent directly and also feed the inflation and rates debate."),
    (r"\b(opec)\b",
     "OPEC+ supply decisions are a direct input for crude balances and near-term oil prices."),
    (r"\b(bitcoin|btc)\b",
     "A bitcoin-focused headline can set the tone for the wider crypto complex, especially large-cap names."),
    (r"\b(ethereum|ether|eth)\b",
     "Ethereum-specific news tends to matter most for ETH and related tokens, with a smaller spillover to bitcoin."),
    (r"\bibit\b|\bspot bitcoin etf\b",
     "Flows or headlines around the large spot bitcoin ETFs are a useful read on institutional demand."),
    (r"\b(nvidia|nvda|ai chip|ai trade)\b",
     "AI-complex headlines can move NVDA and related semiconductor and megacap names, and sometimes risk appetite more broadly."),
    (r"\b(vix|fear gauge)\b",
     "A move in the VIX is a read on equity stress and can spill into other risk assets the same session."),
]


def utc_now():
    return datetime.now(timezone.utc)


def to_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def london_iso(dt: datetime) -> str:
    # Europe/London is UTC in late November (GMT). Avoid zoneinfo dependency issues by using a fixed offset when possible.
    try:
        from zoneinfo import ZoneInfo
        local = dt.astimezone(ZoneInfo("Europe/London"))
    except Exception:
        local = dt.astimezone(timezone.utc)
    return local.replace(microsecond=0).isoformat()


def norm_url(url: str) -> str:
    if not url:
        return ""
    p = urlparse(url.strip())
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if not k.lower().startswith("utm_")]
    return urlunparse((p.scheme, p.netloc, p.path, p.params, urlencode(q), ""))


def fetch(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.read()
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        print(f"WARN fetch failed {url}: {e}", file=sys.stderr)
        return None


def text(el, *names) -> str:
    if el is None:
        return ""
    for n in names:
        child = el.find(n)
        if child is not None and (child.text or "").strip():
            return unescape((child.text or "").strip())
    # namespaced
    for child in list(el):
        tag = child.tag.split("}")[-1]
        if tag in names and (child.text or "").strip():
            return unescape((child.text or "").strip())
    return ""


def parse_pub(item) -> datetime | None:
    raw = text(item, "pubDate", "published", "date", "updated")
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


def parse_source(item, feed) -> tuple[str, str]:
    src_el = item.find("source")
    if src_el is not None and (src_el.text or "").strip():
        name = unescape(src_el.text.strip())
        return name, slug(name)
    creator = text(item, "{http://purl.org/dc/elements/1.1/}creator")
    if creator:
        return creator, slug(creator)
    return feed["source"], feed["source_id"]


def slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "", name.lower())
    return s[:16] or "source"


def split_gnews_title(title: str, source: str) -> tuple[str, str]:
    if " - " in title:
        left, right = title.rsplit(" - ", 1)
        if 1 < len(right) < 48:
            return left.strip(), right.strip()
    return title, source


def classify_market(title: str, default: str, require_match: bool = False) -> str | None:
    t = title.lower()
    for market, pat in MARKET_RULES:
        if re.search(pat, t, re.I):
            return market
    return None if require_match else default


def classify_tickers(title: str) -> list[str]:
    t = title.lower()
    out = []
    for pat, ticker in TICKER_RULES:
        if re.search(pat, t, re.I) and ticker not in out:
            out.append(ticker)
    return out[:4]


def classify_sentiment(title: str) -> str:
    t = title
    b = len(BULLISH.findall(t))
    d = len(BEARISH.findall(t))
    if d > b:
        return "bearish"
    if b > d:
        return "bullish"
    return "neutral"


def context_line(title: str, market: str, sentiment: str, tickers: list[str]) -> str:
    t = title.lower()
    for pat, sentence in SPECIAL_CONTEXT:
        if re.search(pat, t, re.I):
            return sentence
    tagged = ""
    if tickers:
        tagged = " involving " + ", ".join(tickers)
    fallback = {
        ("crypto", "bearish"): f"A bearish crypto headline{tagged}; traders may treat it as near-term risk for the tagged names.",
        ("crypto", "bullish"): f"A constructive crypto headline{tagged}; it may support sentiment in the tagged names if the story holds.",
        ("crypto", "neutral"): f"A crypto development{tagged}; it is informational rather than a clear directional signal.",
        ("stocks", "bearish"): f"A bearish equity headline{tagged}; it may weigh on the tagged names and on risk appetite more broadly.",
        ("stocks", "bullish"): f"A constructive equity headline{tagged}; it may support the tagged names if the wider tape agrees.",
        ("stocks", "neutral"): f"An equity-market development{tagged}; useful context, but not a clear buy or sell signal on its own.",
        ("commodities", "bearish"): f"A bearish commodities headline{tagged}; this may pressure the tagged contracts in the near term.",
        ("commodities", "bullish"): f"A constructive commodities headline{tagged}; this may support the tagged contracts if the story holds.",
        ("commodities", "neutral"): f"A commodities-market development{tagged}; informational rather than a clear directional signal.",
        ("macro", "bearish"): f"A hawkish or risk-off macro headline{tagged}; this kind of news often tightens financial conditions.",
        ("macro", "bullish"): f"A dovish or risk-on macro headline{tagged}; this kind of news can ease financial conditions.",
        ("macro", "neutral"): f"A macro-policy development{tagged}; it is a background input for rates, the dollar and risk assets.",
    }
    return fallback.get((market, sentiment), "A market headline worth noting; the note itself is a keyword rule, not an editorial view.")


def parse_feed(feed, raw: bytes) -> list[dict]:
    items = []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        print(f"WARN parse failed {feed['url']}: {e}", file=sys.stderr)
        return items
    for item in root.findall(".//item"):
        title = text(item, "title")
        link = text(item, "link")
        if not title or not link:
            continue
        source, source_id = parse_source(item, feed)
        if feed["source_id"] == "gnews":
            title, source = split_gnews_title(title, source)
            source_id = slug(source)
        pub = parse_pub(item) or utc_now()
        url = norm_url(link)
        require = feed["source_id"] == "gnews"
        market = classify_market(title, feed["market"], require_match=require)
        if not market:
            continue
        tickers = classify_tickers(title)
        sentiment = classify_sentiment(title)
        items.append({
            "id": hashlib.sha1(url.encode()).hexdigest()[:12],
            "headline": re.sub(r"\s+", " ", title).strip(),
            "url": url,
            "source": source,
            "source_id": source_id,
            "market": market,
            "published": to_iso(pub),
            "sentiment": sentiment,
            "tickers": tickers,
            "context": context_line(title, market, sentiment, tickers),
            "context_kind": "rule",
        })
    return items


def main() -> int:
    collected = []
    seen = set()
    for feed in FEEDS:
        raw = fetch(feed["url"])
        if not raw:
            continue
        parsed = parse_feed(feed, raw)
        added = 0
        for item in parsed:
            key = item["url"] or item["id"]
            if key in seen:
                continue
            seen.add(key)
            collected.append(item)
            added += 1
        print(f"FEED {feed['source_id']} {feed['market']}: parsed {len(parsed)} added {added}")
    def take_balanced(items, cap=MAX_ITEMS):
        quotas = {"crypto": 12, "stocks": 10, "commodities": 10, "macro": 8}
        picked, used = [], set()
        items = sorted(items, key=lambda x: x["published"], reverse=True)
        for mkt, q in quotas.items():
            n = 0
            for it in items:
                if it["url"] in used:
                    continue
                if it["market"] == mkt:
                    picked.append(it)
                    used.add(it["url"])
                    n += 1
                    if n >= q:
                        break
        for it in items:
            if len(picked) >= cap:
                break
            if it["url"] in used:
                continue
            picked.append(it)
            used.add(it["url"])
        picked.sort(key=lambda x: x["published"], reverse=True)
        return picked[:cap]

    collected = take_balanced(collected)
    print("markets", {m: sum(1 for i in collected if i["market"]==m) for m in ("crypto","stocks","commodities","macro")})
    now = utc_now()
    payload = {
        "updated": to_iso(now),
        "updated_london": london_iso(now),
        "generated_by": "scripts/fetch_news.py",
        "context_note": "Why-it-matters lines are deterministic keyword/template rules, not editorial copy and not model-generated.",
        "count": len(collected),
        "items": collected,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    new = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    # Compare items + ignore exact timestamp if headlines are unchanged
    def fingerprint(text: str) -> str:
        try:
            data = json.loads(text)
            return json.dumps([(i.get("url"), i.get("headline"), i.get("published")) for i in data.get("items", [])], ensure_ascii=False)
        except Exception:
            return text
    changed = fingerprint(old) != fingerprint(new)
    if changed or not OUT.exists():
        OUT.write_text(new, encoding="utf-8")
        print(f"Wrote {OUT} ({len(collected)} items)")
        return 0
    print(f"Unchanged ({len(collected)} items); left {OUT} as-is")
    # still refresh the updated timestamp? No — keeps git quiet.
    return 0


if __name__ == "__main__":
    sys.exit(main())

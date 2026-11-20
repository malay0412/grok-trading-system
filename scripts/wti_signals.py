#!/usr/bin/env python3
"""WTI 15-minute close signal evaluator.

Analysis only: never places trades and does not use Coinbase.
Stdlib only. Intended for GitHub Actions (zero Grok credits).

Yahoo futures data may be delayed about 10-30 minutes.
GitHub cron can run several minutes late or skip under load.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "signals" / "wti_config.json"
OUT_PATH = ROOT / "data" / "wti_signals.json"

UA = "BOTTY-QUANTER-wti-signals/1.0 (analysis-only; +https://malay0412.github.io/grok-trading-system/)"
TIMEOUT = 20
YAHOO_HOSTS = (
    "https://query1.finance.yahoo.com/v8/finance/chart/",
    "https://query2.finance.yahoo.com/v8/finance/chart/",
)
GITHUB_API = "https://api.github.com"
DEFAULT_ARMED = {
    "short": True,
    "long": True,
    "bias_flip": True,
    "no_trade": True,
}


def load_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def london_tz(cfg: dict[str, Any]) -> ZoneInfo:
    return ZoneInfo(cfg.get("timezone") or "Europe/London")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_london(dt: datetime, tz: ZoneInfo) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(tz)


def fmt_clock(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def fmt_london_short(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M")


def fmt_iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def px(value: float) -> float:
    return round(float(value), 2)


def fmt_px(value: float) -> str:
    return f"{px(value):.2f}"


def classify_state(close: float, levels: dict[str, Any]) -> str:
    if close < levels["short_entry"]:
        return "short"
    if close > levels["long_entry"]:
        return "long"
    if levels["no_trade_low"] <= close <= levels["no_trade_high"]:
        return "no-trade"
    return "neutral"


def bias_for(close: float, levels: dict[str, Any], default_bias: str) -> str:
    if close > levels["bias_flip"]:
        return "neutral/long"
    return default_bias


def initial_armed() -> dict[str, bool]:
    return dict(DEFAULT_ARMED)


def evaluate_triggers(
    close: float,
    levels: dict[str, Any],
    armed: dict[str, bool],
    default_bias: str,
) -> dict[str, Any]:
    """Return new armed flags, state, bias, and any newly fired triggers.

    A trigger fires only when it is armed (first cross). It is re-armed
    once price closes back on the other side of the level.
    """
    armed = {
        "short": bool(armed.get("short", True)),
        "long": bool(armed.get("long", True)),
        "bias_flip": bool(armed.get("bias_flip", True)),
        "no_trade": bool(armed.get("no_trade", True)),
    }
    fired: list[str] = []
    state = classify_state(close, levels)
    bias = bias_for(close, levels, default_bias)

    short_level = levels["short_entry"]
    long_level = levels["long_entry"]
    flip_level = levels["bias_flip"]
    nt_low = levels["no_trade_low"]
    nt_high = levels["no_trade_high"]

    if close < short_level:
        if armed["short"]:
            fired.append("short")
            armed["short"] = False
    else:
        armed["short"] = True

    if close > long_level:
        if armed["long"]:
            fired.append("long")
            armed["long"] = False
    else:
        armed["long"] = True

    if close > flip_level:
        if armed["bias_flip"]:
            if "long" not in fired:
                fired.append("bias_flip")
            armed["bias_flip"] = False
    else:
        armed["bias_flip"] = True

    in_no_trade = nt_low <= close <= nt_high
    if in_no_trade:
        if armed["no_trade"]:
            fired.append("no_trade")
            armed["no_trade"] = False
    else:
        armed["no_trade"] = True

    return {
        "state": state,
        "bias": bias,
        "armed": armed,
        "fired": fired,
    }


def status_line(
    close: float,
    candle_close_local: datetime,
    result: dict[str, Any],
    levels: dict[str, Any],
    just_fired: bool,
) -> str:
    clock = fmt_clock(candle_close_local)
    price = fmt_px(close)
    state = result["state"]
    fired = result["fired"]
    if just_fired and "short" in fired:
        action = f"SHORT trigger · close below {fmt_px(levels['short_entry'])}"
    elif just_fired and "long" in fired:
        action = f"LONG trigger · close above {fmt_px(levels['long_entry'])}"
    elif just_fired and "bias_flip" in fired:
        action = f"bias flip · close above {fmt_px(levels['bias_flip'])}"
    elif just_fired and "no_trade" in fired:
        action = "in no-trade zone · warning"
    elif state == "short":
        action = "below short level · already signalled"
    elif state == "long":
        action = "above long level · already signalled"
    elif state == "no-trade":
        action = "in no-trade zone · no trigger"
    else:
        action = f"{result['bias']} · no trigger"
    return f"{clock} London · WTI {price} · {action}"


def signal_record(
    kind: str,
    close: float,
    candle_close_local: datetime,
    candle_start_utc: int,
    now: datetime,
    levels: dict[str, Any],
    bias: str,
) -> dict[str, Any]:
    rec: dict[str, Any] = {
        "type": kind,
        "close": px(close),
        "candle_start_utc": candle_start_utc,
        "candle_close_time": fmt_london_short(candle_close_local),
        "issued_at_utc": fmt_iso_z(now),
        "bias": bias,
    }
    if kind == "short":
        rec["entry"] = levels["short_entry"]
        rec["stop"] = levels["short_stop"]
        rec["target_1"] = levels["short_target_1"]
        rec["target_2"] = levels["short_target_2"]
        rec["break_even"] = levels["short_break_even"]
        rec["title"] = (
            f"WTI SHORT signal - 15m close {fmt_px(close)} below {fmt_px(levels['short_entry'])}"
        )
    elif kind == "long":
        rec["entry"] = levels["long_entry"]
        rec["stop"] = levels["long_stop"]
        rec["target_1"] = levels["long_target_1"]
        rec["target_2"] = levels["long_target_2"]
        rec["break_even"] = levels["long_break_even"]
        rec["title"] = (
            f"WTI LONG signal - 15m close {fmt_px(close)} above {fmt_px(levels['long_entry'])}"
        )
    elif kind == "bias_flip":
        rec["title"] = (
            f"WTI bias flip - 15m close {fmt_px(close)} above {fmt_px(levels['bias_flip'])}"
        )
    else:
        rec["title"] = (
            f"WTI no-trade warning - 15m close {fmt_px(close)} between "
            f"{fmt_px(levels['no_trade_low'])} and {fmt_px(levels['no_trade_high'])}"
        )
    rec["body"] = issue_body(kind, close, candle_close_local, levels, bias)
    return rec


def issue_body(
    kind: str,
    close: float,
    candle_close_local: datetime,
    levels: dict[str, Any],
    bias: str,
) -> str:
    when = candle_close_local.strftime("%H:%M London, %d %b %Y")
    close_s = fmt_px(close)
    lines = [
        "Analysis only. No orders are placed by this job. Not financial advice.",
        "",
    ]
    if kind == "short":
        lines += [
            "Setup: SHORT (breakdown)",
            f"Trigger: 15-minute close {close_s}, below {fmt_px(levels['short_entry'])}",
            f"Entry: {fmt_px(levels['short_entry'])}",
            f"Stop: {fmt_px(levels['short_stop'])}",
            f"Target 1: {fmt_px(levels['short_target_1'])}",
            f"Target 2: {fmt_px(levels['short_target_2'])}",
            f"Break-even: about {fmt_px(levels['short_break_even'])}",
        ]
    elif kind == "long":
        lines += [
            "Setup: LONG (breakout only)",
            f"Trigger: 15-minute close {close_s}, above {fmt_px(levels['long_entry'])}",
            f"Entry: {fmt_px(levels['long_entry'])}",
            f"Stop: {fmt_px(levels['long_stop'])}",
            f"Target 1: {fmt_px(levels['long_target_1'])}",
            f"Target 2: {fmt_px(levels['long_target_2'])}",
            f"Break-even: about {fmt_px(levels['long_break_even'])}",
            "Bias is now neutral/long.",
        ]
    elif kind == "bias_flip":
        lines += [
            "Setup: BIAS FLIP",
            f"Trigger: 15-minute close {close_s}, above {fmt_px(levels['bias_flip'])}",
            "Bias is now neutral/long.",
            f"No long entry until a 15-minute close above {fmt_px(levels['long_entry'])}.",
        ]
    else:
        lines += [
            "Setup: NO-TRADE warning",
            (
                f"Trigger: 15-minute close {close_s} is between "
                f"{fmt_px(levels['no_trade_low'])} and {fmt_px(levels['no_trade_high'])}."
            ),
            "Stay out. No entry.",
        ]
    lines += [
        f"Candle close: {when}",
        f"Bias: {bias}",
        "",
        "Yahoo futures prices may be delayed 10-30 minutes. "
        "GitHub cron can run late or skip under load. "
        "Confirm on a live chart before acting.",
    ]
    return "\n".join(lines) + "\n"


def parse_yahoo(payload: dict[str, Any], interval_seconds: int, now: datetime) -> list[dict[str, Any]]:
    chart = payload.get("chart") or {}
    if chart.get("error"):
        raise RuntimeError(f"Yahoo chart error: {chart['error']}")
    results = chart.get("result") or []
    if not results:
        raise RuntimeError("Yahoo chart returned no result")
    res = results[0]
    timestamps = res.get("timestamp") or []
    quotes = ((res.get("indicators") or {}).get("quote") or [{}])[0]
    closes = quotes.get("close") or []
    candles: list[dict[str, Any]] = []
    for i, raw_ts in enumerate(timestamps):
        if i >= len(closes):
            break
        raw_close = closes[i]
        if raw_ts is None or raw_close is None:
            continue
        start = int(raw_ts)
        # Drop the live quote tick Yahoo sometimes appends off the 15-minute grid.
        if start % interval_seconds != 0:
            continue
        close_ts = start + interval_seconds
        if now.timestamp() < close_ts:
            continue
        candles.append(
            {
                "start": start,
                "close_ts": close_ts,
                "close": px(raw_close),
            }
        )
    return candles


def fetch_yahoo(cfg: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    symbol = cfg["symbol"]
    interval = cfg["interval"]
    range_ = cfg["range"]
    interval_seconds = int(cfg.get("interval_seconds") or 900)
    query = urllib.parse.urlencode({"interval": interval, "range": range_})
    last_error: Exception | None = None
    for host in YAHOO_HOSTS:
        url = f"{host}{urllib.parse.quote(symbol, safe='=')}?{query}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": UA, "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            candles = parse_yahoo(payload, interval_seconds, now)
            if candles:
                return candles
            last_error = RuntimeError("Yahoo returned no fully closed 15-minute candles")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
            last_error = exc
    raise RuntimeError(f"Failed to fetch CL=F 15-minute candles: {last_error}")


def load_previous(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        with path.open(encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def build_payload(
    cfg: dict[str, Any],
    candle: dict[str, Any],
    result: dict[str, Any],
    new_signals: list[dict[str, Any]],
    previous: dict[str, Any],
    now: datetime,
    status: str,
    skipped_same_candle: bool,
) -> dict[str, Any]:
    tz = london_tz(cfg)
    close_local = to_london(datetime.fromtimestamp(candle["close_ts"], timezone.utc), tz)
    recent = list(previous.get("recent_signals") or [])
    if not skipped_same_candle:
        # Strip issue-draft fields that should not be public if posting failed mid-way.
        public_new = []
        for rec in new_signals:
            item = {k: v for k, v in rec.items() if k not in {"body", "title"}}
            public_new.append(item)
        recent = public_new + recent
        limit = int(cfg.get("recent_signals_limit") or 20)
        recent = recent[:limit]
    return {
        "updated_utc": fmt_iso_z(now),
        "updated_london": fmt_london_short(to_london(now, tz)),
        "symbol": cfg["symbol"],
        "last_close": px(candle["close"]),
        "candle_start_utc": candle["start"],
        "candle_close_time": fmt_london_short(close_local),
        "status_line": status,
        "state": result["state"],
        "bias": result["bias"],
        "armed": result["armed"],
        "last_processed_candle": candle["start"],
        "recent_signals": recent,
        "disclaimer": (
            "Analysis only. No orders are placed. Not financial advice. "
            "Yahoo futures data may be delayed 10-30 minutes."
        ),
    }


def github_request(method: str, url: str, token: str, body: dict[str, Any] | None = None) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": UA,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"message": raw}
        return exc.code, parsed


def ensure_signal_label(owner: str, repo: str, token: str) -> None:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/labels/signal"
    status, _ = github_request("GET", url, token)
    if status == 200:
        return
    create_url = f"{GITHUB_API}/repos/{owner}/{repo}/labels"
    status, payload = github_request(
        "POST",
        create_url,
        token,
        {
            "name": "signal",
            "color": "d73a4a",
            "description": "WTI 15-minute close signal (analysis only)",
        },
    )
    if status not in (200, 201) and status != 422:
        print(f"warning: could not create signal label ({status}): {payload}", file=sys.stderr)


def open_signal_issue(rec: dict[str, Any], owner: str, repo: str, token: str) -> str | None:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/issues"
    status, payload = github_request(
        "POST",
        url,
        token,
        {
            "title": rec["title"],
            "body": rec["body"],
            "labels": ["signal"],
        },
    )
    if status in (200, 201):
        return payload.get("html_url") or payload.get("url")
    print(f"warning: failed to open issue ({status}): {payload}", file=sys.stderr)
    return None


def post_issues(signals: list[dict[str, Any]]) -> None:
    token = os.environ.get("GITHUB_TOKEN") or ""
    repository = os.environ.get("GITHUB_REPOSITORY") or ""
    if not token or not repository or "/" not in repository:
        for rec in signals:
            print(f"dry-run issue: {rec['title']}")
        return
    owner, repo = repository.split("/", 1)
    ensure_signal_label(owner, repo, token)
    for rec in signals:
        # Heartbeats never open issues; only named triggers reach here.
        url = open_signal_issue(rec, owner, repo, token)
        if url:
            rec["issue_url"] = url
            print(f"opened issue: {url}")
        else:
            print(f"issue not opened: {rec['title']}", file=sys.stderr)


def write_output(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")
    print(f"Wrote {path}")
    print(payload["status_line"])


def run() -> int:
    cfg = load_config()
    now = utc_now()
    tz = london_tz(cfg)
    previous = load_previous(OUT_PATH)
    candles = fetch_yahoo(cfg, now)
    candle = candles[-1]
    close = candle["close"]
    levels = cfg["levels"]
    default_bias = cfg.get("default_bias") or "sell-side"
    close_local = to_london(datetime.fromtimestamp(candle["close_ts"], timezone.utc), tz)

    same_candle = previous.get("last_processed_candle") == candle["start"]
    if same_candle:
        result = {
            "state": previous.get("state") or classify_state(close, levels),
            "bias": previous.get("bias") or bias_for(close, levels, default_bias),
            "armed": previous.get("armed") or initial_armed(),
            "fired": [],
        }
        status = status_line(close, close_local, result, levels, just_fired=False)
        # Keep the heartbeat times fresh even when the candle has not changed.
        payload = build_payload(
            cfg, candle, result, [], previous, now, status, skipped_same_candle=True
        )
        write_output(OUT_PATH, payload)
        return 0

    armed = previous.get("armed") or initial_armed()
    result = evaluate_triggers(close, levels, armed, default_bias)
    new_signals = [
        signal_record(kind, close, close_local, candle["start"], now, levels, result["bias"])
        for kind in result["fired"]
    ]
    if new_signals:
        post_issues(new_signals)
    status = status_line(close, close_local, result, levels, just_fired=bool(new_signals))
    payload = build_payload(
        cfg, candle, result, new_signals, previous, now, status, skipped_same_candle=False
    )
    write_output(OUT_PATH, payload)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)

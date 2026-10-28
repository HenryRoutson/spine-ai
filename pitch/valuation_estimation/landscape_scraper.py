#!/usr/bin/env python3

# TODO you can put openrouter calls for higher accuracy here.
"""
landscape_scraper.py — build an ARR-vs-valuation dataset for N companies
from a fixed list of URLs, resolving each figure into either a point
estimate or an uncertainty band.

The band is the point of this tool. Private-company ARR and valuation are
almost never both cleanly observable at the same moment, so instead of
imputing a single fake point from a peer multiple, every figure resolves to
one of four states:

    point           two or more agreeing, recent, high-tier observations
    range_reported  sources disagree, or the company gave a range / target
    range_stale     one good observation, but old enough that "now" is a range
    range_modeled   nothing on this axis; band spans the peer-multiple IQR

Usage
-----
    python landscape_scraper.py --sources sources.json --out companies.json
    python landscape_scraper.py --sources sources.json --out companies.json --no-cache
    python landscape_scraper.py --selftest        # run extractor tests, no network

Dependencies: requests, beautifulsoup4.  (lxml optional, used if present.)
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import statistics
import sys
import time
import urllib.parse
import urllib.robotparser
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta
from typing import Iterable

try:
    import requests
except ImportError:  # keep --selftest runnable without network deps
    requests = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None


# --------------------------------------------------------------------------
# source tiers
# --------------------------------------------------------------------------
# Tier drives both which observations win and how wide a band gets. A figure
# from a company blog or an SEC/PR wire is treated as near-fact; an SEO
# content farm recycling a number from 14 months ago is treated as a rumour.

TIER_1 = {  # primary: the company itself, regulators, wire services
    "prnewswire.com", "businesswire.com", "globenewswire.com", "sec.gov",
    "bloomberg.com", "reuters.com", "ft.com", "wsj.com", "cnbc.com",
    "techcrunch.com", "forbes.com", "theinformation.com", "sifted.eu",
    "tech.eu", "calcalistech.com", "entrackr.com",
}
TIER_2 = {  # analyst shops and structured databases
    "sacra.com", "tracxn.com", "crunchbase.com", "dealroom.co",
    "pitchbook.com", "cbinsights.com", "arr.club", "growthindex.startupriders.com",
}
# everything else is tier 3


def domain_of(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def tier_of(url: str, company_domains: set[str]) -> int:
    d = domain_of(url)
    if d in company_domains or any(d.endswith("." + cd) for cd in company_domains):
        return 1  # the company's own blog / newsroom
    if d in TIER_1 or any(d.endswith("." + t) for t in TIER_1):
        return 1
    if d in TIER_2 or any(d.endswith("." + t) for t in TIER_2):
        return 2
    return 3


# --------------------------------------------------------------------------
# money + date parsing
# --------------------------------------------------------------------------

_MONEY = r"(?:US)?\$\s?([\d]+(?:[.,]\d+)?)\s*(million|billion|bn|m\b|b\b|M\b|B\b)"
_MONEY_EUR = r"€\s?([\d]+(?:[.,]\d+)?)\s*(million|billion|bn|m\b|b\b|M\b|B\b)"

EUR_USD = 1.09  # rough; override per-run if you care about precision


def parse_money_to_musd(num: str, unit: str, eur: bool = False) -> float:
    """Return a figure in millions of USD."""
    v = float(num.replace(",", ""))
    u = unit.lower().rstrip(".")
    if u in ("billion", "bn", "b"):
        v *= 1000.0
    if eur:
        v *= EUR_USD
    return round(v, 3)


# A money token is classified by whichever KEYWORD sits nearest to it, not by
# which regex happens to fire. Naive pattern matching reads "$180 million in
# Series C funding, reaching a valuation of $2.5 billion" as two valuations,
# and "last valuation of $350 million, ARR has grown beyond $40 million" as two
# ARR figures. Nearest-keyword assignment gets both right, and gives us a place
# to drop round sizes on the floor.

_MONEY_TOKEN = re.compile(r"(€)?" + _MONEY.replace("(?:US)?\\$", "(?:US)?\\$|€").replace(
    r"(?:US)?\$\s?", r"(?:(?:US)?\$|€)\s?"), re.I)
_MONEY_TOKEN = re.compile(
    r"(?P<cur>(?:US)?\$|€)\s?(?P<num>[\d]+(?:[.,]\d+)?)\s*"
    r"(?P<unit>million|billion|bn|[mMbB])\b", re.I)

_KEYWORDS = [
    ("arr", re.compile(
        r"\b(?:ARR|annual(?:ized)?\s+recurring\s+revenue|annualized\s+revenue|"
        r"annualised\s+revenue|revenue\s+run[-\s]?rate|run[-\s]?rate\s+revenue|"
        r"annualized\s+run[-\s]?rate)\b", re.I)),
    ("valuation", re.compile(
        r"\b(?:valuation|valued\s+at|valuing|post[-\s]?money|pre[-\s]?money|"
        r"price\s+mark|acquisition\s+price|acquire[sd]?\s+\w+\s+for)\b", re.I)),
    # not a metric — a magnet that steals money tokens away from valuation
    ("raise", re.compile(
        r"\b(?:raised|raising|raise|round|funding|investment|led\s+by|secured|"
        r"closed\s+a|Series\s+[A-F]\b|seed\b|total\s+funding|capital)\b", re.I)),
]

MAX_KEYWORD_DIST = 70   # chars; beyond this a money token is unattributed

# "target", "aiming for", "on track for" — a goal, not an observation
_ASPIRATIONAL = re.compile(
    r"\b(target|targeting|aims?|aiming|goal|hopes?|on track for|expects? to (?:hit|reach)|"
    r"forecast|projected|guidance|by year[- ]end|could reach)\b", re.I
)
# "in talks to raise at", "reportedly", "rumoured" — a rumour, widen the band
_RUMOURED = re.compile(
    r"\b(in talks|reportedly|rumou?red|sources? (?:said|told)|people familiar|"
    r"is said to|could raise|expected to)\b", re.I
)

_MONTHS = ("january february march april may june july august september "
           "october november december").split()
_DATE_NEAR = re.compile(
    r"\b(" + "|".join(_MONTHS) + r")\s+(\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b", re.I
)


def _sentence_window(text: str, start: int, end: int, pad: int = 260) -> str:
    return text[max(0, start - pad): min(len(text), end + pad)]


def _date_in(window: str, fallback: date | None) -> date | None:
    m = _DATE_NEAR.search(window)
    if m:
        if m.group(1):
            mon = _MONTHS.index(m.group(1).lower()) + 1
            return date(int(m.group(2)), mon, 1)
        return date(int(m.group(3)), int(m.group(4)), int(m.group(5)))
    return fallback


@dataclass
class Obs:
    """One extracted figure, with everything needed to judge it later."""
    company: str
    metric: str          # "arr" | "valuation"
    value_musd: float
    url: str
    tier: int
    obs_date: str | None
    aspirational: bool
    rumoured: bool
    snippet: str


def _keyword_hits(text: str) -> list[tuple[int, int, str]]:
    """Every metric keyword in the text as (start, end, label)."""
    hits = []
    for label, pat in _KEYWORDS:
        for m in pat.finditer(text):
            hits.append((m.start(), m.end(), label))
    return sorted(hits)


def _nearest(hits: list[tuple[int, int, str]], lo: int, hi: int) -> tuple[str | None, int]:
    """Label of the keyword closest to the span [lo, hi), and its distance."""
    best, best_d = None, 10 ** 9
    for s, e, label in hits:
        d = 0 if (s < hi and e > lo) else (lo - e if e <= lo else s - hi)
        # a keyword on the far side of a sentence break is much weaker
        if d < best_d:
            best, best_d = label, d
    return best, best_d


def extract(text: str, company: str, url: str, tier: int,
            page_date: date | None) -> list[Obs]:
    """Pull every ARR and valuation figure out of one page of text.

    Each money token is attributed to the nearest metric keyword. Tokens whose
    nearest keyword is a funding-round word are dropped: a Series C size is not
    a valuation, and conflating the two is the single most common way these
    datasets end up wrong.
    """
    hits = _keyword_hits(text)
    out: list[Obs] = []
    for m in _MONEY_TOKEN.finditer(text):
        label, dist = _nearest(hits, m.start(), m.end())
        if label is None or dist > MAX_KEYWORD_DIST or label == "raise":
            continue
        try:
            v = parse_money_to_musd(m.group("num"), m.group("unit"),
                                    eur=(m.group("cur") == "€"))
        except (ValueError, IndexError):
            continue
        if v <= 0 or v > 5_000_000:      # >$5T is a parse error, not a company
            continue
        win = _sentence_window(text, m.start(), m.end())
        d = _date_in(win, page_date)
        out.append(Obs(
            company=company, metric=label, value_musd=v, url=url, tier=tier,
            obs_date=d.isoformat() if d else None,
            aspirational=bool(_ASPIRATIONAL.search(win)),
            rumoured=bool(_RUMOURED.search(win)),
            snippet=" ".join(win.split())[:300],
        ))
    # de-dupe identical (metric, value) pairs from the same page
    seen, uniq = set(), []
    for o in out:
        k = (o.metric, o.value_musd)
        if k not in seen:
            seen.add(k)
            uniq.append(o)
    return uniq


# --------------------------------------------------------------------------
# fetching
# --------------------------------------------------------------------------

UA = "landscape-scraper/1.0 (+research; contact: you@example.com)"
CACHE_DIR = ".scrape_cache"
_robots: dict[str, urllib.robotparser.RobotFileParser] = {}
_last_hit: dict[str, float] = {}
CRAWL_DELAY = 1.5  # seconds between requests to the same host


def allowed(url: str) -> bool:
    host = urllib.parse.urlparse(url).netloc
    if host not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{urllib.parse.urlparse(url).scheme}://{host}/robots.txt")
        try:
            rp.read()
        except Exception:
            rp = None
        _robots[host] = rp
    rp = _robots[host]
    return True if rp is None else rp.can_fetch(UA, url)


def fetch(url: str, use_cache: bool = True, timeout: int = 25) -> tuple[str, date | None]:
    os.makedirs(CACHE_DIR, exist_ok=True)
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    path = os.path.join(CACHE_DIR, key + ".json")
    if use_cache and os.path.exists(path):
        blob = json.load(open(path))
        return blob["text"], (date.fromisoformat(blob["date"]) if blob.get("date") else None)

    if not allowed(url):
        raise PermissionError(f"robots.txt disallows {url}")

    host = urllib.parse.urlparse(url).netloc
    wait = CRAWL_DELAY - (time.time() - _last_hit.get(host, 0))
    if wait > 0:
        time.sleep(wait)
    _last_hit[host] = time.time()

    r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout)
    r.raise_for_status()
    text, pdate = html_to_text(r.text)
    json.dump({"text": text, "date": pdate.isoformat() if pdate else None},
              open(path, "w"))
    return text, pdate


def html_to_text(html: str) -> tuple[str, date | None]:
    if BeautifulSoup is None:
        return re.sub(r"<[^>]+>", " ", html), None
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "aside"]):
        tag.decompose()
    pdate = None
    for sel, attr in (({"property": "article:published_time"}, "content"),
                      ({"name": "publish_date"}, "content"),
                      ({"itemprop": "datePublished"}, "content")):
        t = soup.find("meta", attrs=sel)
        if t and t.get(attr):
            try:
                pdate = datetime.fromisoformat(t[attr].replace("Z", "+00:00")).date()
                break
            except ValueError:
                pass
    return soup.get_text(" ", strip=True), pdate


# --------------------------------------------------------------------------
# resolution: observations -> point or band
# --------------------------------------------------------------------------

FRESH_DAYS = 150          # inside this, one tier-1 observation is enough
STALE_DAYS = 240          # past this, "now" is a band, not a number
CATEGORY_GROWTH = 3.0     # median YoY ARR multiple for this cohort; tune per sector
AGREE_TOL = 0.15          # two figures within 15% count as the same figure


def _pct(xs: list[float], p: float) -> float:
    xs = sorted(xs)
    if not xs:
        return float("nan")
    i = (len(xs) - 1) * p
    lo, hi = int(i), min(int(i) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo)


@dataclass
class Resolved:
    lo: float | None = None
    hi: float | None = None
    point: float | None = None
    kind: str = "none"     # point | range_reported | range_stale | range_modeled | none
    note: str = ""
    as_of: str | None = None


def resolve(obs: list[Obs], today: date, growth: float = CATEGORY_GROWTH) -> Resolved:
    """Turn a pile of observations for one company+metric into a point or a band."""
    firm = [o for o in obs if not o.aspirational]
    goals = [o for o in obs if o.aspirational]
    if not firm and not goals:
        return Resolved(kind="none", note="no figure found on any source")

    # a disclosed floor plus a company target = an honest range between them
    if firm and goals:
        best = _best(firm)
        goal = max(g.value_musd for g in goals)
        if goal > best.value_musd * 1.4:
            return Resolved(
                lo=best.value_musd, hi=goal, kind="range_reported",
                as_of=best.obs_date,
                note=f"last disclosed ${best.value_musd:,.0f}M ({best.obs_date or 'undated'}); "
                     f"company target ${goal:,.0f}M",
            )

    if not firm:
        g = max(goals, key=lambda o: o.value_musd)
        return Resolved(lo=g.value_musd * 0.5, hi=g.value_musd, kind="range_reported",
                        as_of=g.obs_date, note="only a company target was found")

    best = _best(firm)
    age = (today - date.fromisoformat(best.obs_date)).days if best.obs_date else 999

    # do independent good sources agree?
    peers = [o.value_musd for o in firm
             if o.tier <= 2 and o.url != best.url
             and abs(o.value_musd - best.value_musd) <= best.value_musd * AGREE_TOL]
    spread = [o.value_musd for o in firm if o.tier <= 2]

    if len(spread) >= 2 and (max(spread) - min(spread)) > min(spread) * AGREE_TOL * 2:
        return Resolved(lo=min(spread), hi=max(spread), kind="range_reported",
                        as_of=best.obs_date,
                        note=f"{len(spread)} sources disagree "
                             f"(${min(spread):,.0f}M-${max(spread):,.0f}M)")

    if age <= FRESH_DAYS and (best.tier == 1 or peers) and not best.rumoured:
        return Resolved(point=best.value_musd, kind="point", as_of=best.obs_date,
                        note=f"tier-{best.tier} source, {age}d old"
                             + (f", corroborated by {len(peers)}" if peers else ""))

    if age >= STALE_DAYS:
        grown = best.value_musd * (growth ** (age / 365.0))
        return Resolved(lo=best.value_musd, hi=round(grown, 1), kind="range_stale",
                        as_of=best.obs_date,
                        note=f"last disclosed ${best.value_musd:,.0f}M {age}d ago; "
                             f"upper bound = cohort growth of {growth:.1f}x/yr")

    pad = 0.20 if best.rumoured else 0.12
    return Resolved(lo=best.value_musd * (1 - pad), hi=best.value_musd * (1 + pad),
                    kind="range_reported", as_of=best.obs_date,
                    note=("rumoured figure" if best.rumoured
                          else f"single tier-{best.tier} source, {age}d old"))


def _best(obs: list[Obs]) -> Obs:
    def key(o: Obs):
        d = date.fromisoformat(o.obs_date) if o.obs_date else date(1990, 1, 1)
        return (-o.tier, d)
    return max(obs, key=key)


def peer_multiples(rows: list[dict]) -> tuple[float, float, float]:
    """p25 / median / p75 of valuation:ARR across rows where BOTH axes are points."""
    ms = [r["valuation"]["point"] / r["arr"]["point"] for r in rows
          if r["arr"].get("kind") == "point" and r["valuation"].get("kind") == "point"
          and r["arr"].get("point")]
    if len(ms) < 3:
        return (10.0, 20.0, 35.0)
    return (_pct(ms, 0.25), statistics.median(ms), _pct(ms, 0.75))


def model_missing(rows: list[dict]) -> list[dict]:
    """Fill a fully-missing axis with a band spanning the peer-multiple IQR."""
    p25, med, p75 = peer_multiples(rows)
    for r in rows:
        a, v = r["arr"], r["valuation"]
        if v["kind"] == "none" and a["kind"] != "none":
            lo_a, hi_a = a.get("lo") or a["point"], a.get("hi") or a["point"]
            v.update(lo=round(lo_a * p25, 1), hi=round(hi_a * p75, 1),
                     kind="range_modeled",
                     note=f"no valuation disclosed; band = ARR x peer multiple "
                          f"IQR ({p25:.1f}x-{p75:.1f}x)")
        elif a["kind"] == "none" and v["kind"] != "none":
            lo_v, hi_v = v.get("lo") or v["point"], v.get("hi") or v["point"]
            a.update(lo=round(lo_v / p75, 2), hi=round(hi_v / p25, 2),
                     kind="range_modeled",
                     note=f"no ARR disclosed; band = valuation / peer multiple "
                          f"IQR ({p25:.1f}x-{p75:.1f}x)")
    return rows


def shape_of(row: dict) -> str:
    """What the chart should draw."""
    a, v = row["arr"]["kind"], row["valuation"]["kind"]
    if a == "none" or v == "none":
        return "omitted"
    if a == "point" and v == "point":
        return "point"
    if a == "point":
        return "vband"      # valuation uncertain -> vertical bar
    if v == "point":
        return "hband"      # ARR uncertain -> horizontal bar
    return "box"            # both uncertain -> 2D blob


# --------------------------------------------------------------------------
# fit
# --------------------------------------------------------------------------

def power_fit(rows: list[dict]) -> dict:
    """OLS of log10(valuation) on log10(ARR), weighting bands down by width."""
    import math
    X, Y, W = [], [], []
    for r in rows:
        if r["shape"] == "omitted":
            continue
        x, y = r["arr_mid"], r["val_mid"]
        if not x or not y:
            continue
        wx = (r["arr"].get("hi") or x) / (r["arr"].get("lo") or x)
        wy = (r["valuation"].get("hi") or y) / (r["valuation"].get("lo") or y)
        w = 1.0 / (1.0 + math.log10(max(wx, 1.0001)) + math.log10(max(wy, 1.0001)))
        X.append(math.log10(x)); Y.append(math.log10(y)); W.append(w)
    n = len(X)
    if n < 3:
        return {"a": None, "b": None, "r2": None, "n": n}
    sw = sum(W)
    mx = sum(w * x for w, x in zip(W, X)) / sw
    my = sum(w * y for w, y in zip(W, Y)) / sw
    sxy = sum(w * (x - mx) * (y - my) for w, x, y in zip(W, X, Y))
    sxx = sum(w * (x - mx) ** 2 for w, x in zip(W, X))
    b = sxy / sxx
    a0 = my - b * mx
    ss_res = sum(w * (y - (a0 + b * x)) ** 2 for w, x, y in zip(W, X, Y))
    ss_tot = sum(w * (y - my) ** 2 for w, y in zip(W, Y))
    return {"a": 10 ** a0, "b": b, "r2": 1 - ss_res / ss_tot if ss_tot else None, "n": n}


# --------------------------------------------------------------------------
# driver
# --------------------------------------------------------------------------

def run(sources: dict, use_cache: bool = True, workers: int = 6) -> dict:
    today = date.today()
    companies = sources["companies"]
    cdomains = {c["name"]: set(c.get("own_domains", [])) for c in companies}

    tasks = [(c["name"], u) for c in companies for u in c.get("urls", [])]
    all_obs: list[Obs] = []
    errors: list[dict] = []

    def work(t):
        name, url = t
        try:
            text, pdate = fetch(url, use_cache=use_cache)
            return extract(text, name, url, tier_of(url, cdomains[name]), pdate), None
        except Exception as e:
            return [], {"company": name, "url": url, "error": f"{type(e).__name__}: {e}"}

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for obs, err in pool.map(work, tasks):
            all_obs.extend(obs)
            if err:
                errors.append(err)

    rows = []
    for c in companies:
        mine = [o for o in all_obs if o.company == c["name"]]
        arr = resolve([o for o in mine if o.metric == "arr"], today,
                      growth=c.get("growth", CATEGORY_GROWTH))
        val = resolve([o for o in mine if o.metric == "valuation"], today,
                      growth=c.get("growth", CATEGORY_GROWTH))
        rows.append({
            "name": c["name"], "category": c.get("category", ""),
            "similarity": c.get("similarity"), "desc": c.get("desc", ""),
            "arr": asdict(arr), "valuation": asdict(val),
            "n_obs": len(mine),
        })

    rows = model_missing(rows)
    for r in rows:
        for k in ("arr", "valuation"):
            m = r[k]
            m["mid"] = (m["point"] if m["kind"] == "point"
                        else (((m["lo"] or 0) * (m["hi"] or 0)) ** 0.5
                              if m.get("lo") and m.get("hi") else None))
        r["arr_mid"], r["val_mid"] = r["arr"]["mid"], r["valuation"]["mid"]
        r["shape"] = shape_of(r)

    p25, med, p75 = peer_multiples(rows)
    return {
        "generated": today.isoformat(),
        "companies": rows,
        "fit": power_fit(rows),
        "peer_multiple": {"p25": round(p25, 2), "median": round(med, 2), "p75": round(p75, 2)},
        "errors": errors,
    }


# --------------------------------------------------------------------------
# selftest — proves the extractors work without touching the network
# --------------------------------------------------------------------------

FIXTURES = [
    # want, and must_not — the round size must not become a valuation, and the
    # prior valuation must not become an ARR figure.
    ("Berlin-based n8n has raised $180 million in Series C funding, reaching a "
     "valuation of $2.5 billion. Since its last valuation of $350 million, n8n's "
     "annual recurring revenue (ARR) has grown beyond $40 million.",
     {("valuation", 2500.0), ("valuation", 350.0), ("arr", 40.0)},
     {("valuation", 180.0), ("arr", 350.0), ("arr", 180.0)}),
    ("The company hit $500 million in annualized revenue run rate in June. Lovable "
     "is in talks to raise $300 million at a valuation of $13.2 billion.",
     {("arr", 500.0), ("valuation", 13200.0)},
     {("valuation", 300.0), ("arr", 300.0)}),
    ("Replit said it was on track for $150 million in annualized revenue, and hopes "
     "to hit annual recurring revenue of $1 billion by year-end.",
     {("arr", 150.0), ("arr", 1000.0)}, set()),
    ("n8n raised €55 million in Series B funding on a valuation of €250 million.",
     {("valuation", 272.5)}, {("valuation", 59.95), ("arr", 59.95)}),
    ("Wix acquired Base44 for an estimated $80 million; management says it reached "
     "roughly $100 million in ARR.",
     {("valuation", 80.0), ("arr", 100.0)}, set()),
]


def selftest() -> int:
    fails = 0
    for i, (text, want, forbid) in enumerate(FIXTURES, 1):
        got = {(o.metric, o.value_musd) for o in extract(text, "X", "https://e.com/a", 1, None)}
        missing, leaked = want - got, forbid & got
        ok = not missing and not leaked
        if not ok:
            fails += 1
        print(f"  [{'ok ' if ok else 'FAIL'}] fixture {i}: got {sorted(got)}")
        if missing:
            print(f"          missing {sorted(missing)}")
        if leaked:
            print(f"          false positive {sorted(leaked)}")

    # aspirational / rumour flags
    obs = extract(FIXTURES[2][0], "Replit", "https://e.com/a", 1, None)
    goal = [o for o in obs if o.value_musd == 1000.0]
    assert goal and goal[0].aspirational, "should flag '$1B by year-end' as a target"
    print("  [ok ] '$1B by year-end' flagged aspirational")

    obs = extract(FIXTURES[1][0], "Lovable", "https://e.com/a", 1, None)
    rum = [o for o in obs if o.metric == "valuation"]
    assert rum and rum[0].rumoured, "should flag 'in talks to raise' as rumoured"
    print("  [ok ] 'in talks to raise' flagged rumoured")

    # resolution: disclosed floor + target -> a reported range
    today = date(2026, 8, 13)
    r = resolve([
        Obs("R", "arr", 150.0, "https://techcrunch.com/x", 1, "2025-09-10", False, False, ""),
        Obs("R", "arr", 1000.0, "https://techcrunch.com/y", 1, "2026-03-11", True, False, ""),
    ], today)
    assert r.kind == "range_reported" and r.lo == 150.0 and r.hi == 1000.0, r
    print(f"  [ok ] floor+target -> band ${r.lo:,.0f}M-${r.hi:,.0f}M ({r.kind})")

    # resolution: one stale figure -> a growth band
    r = resolve([Obs("B", "arr", 40.0, "https://techcrunch.com/z", 1,
                     "2025-03-15", False, False, "")], today)
    assert r.kind == "range_stale" and r.hi > 100, r
    print(f"  [ok ] stale figure -> band ${r.lo:,.0f}M-${r.hi:,.0f}M ({r.kind})")

    # resolution: fresh corroborated figure -> a point
    r = resolve([
        Obs("L", "arr", 500.0, "https://techcrunch.com/a", 1, "2026-06-01", False, False, ""),
        Obs("L", "arr", 500.0, "https://sacra.com/b", 2, "2026-06-10", False, False, ""),
    ], today)
    assert r.kind == "point" and r.point == 500.0, r
    print(f"  [ok ] corroborated fresh figure -> point ${r.point:,.0f}M")

    # shape dispatch
    mk = lambda ak, vk: {"arr": {"kind": ak}, "valuation": {"kind": vk}}
    assert shape_of(mk("point", "point")) == "point"
    assert shape_of(mk("point", "range_modeled")) == "vband"
    assert shape_of(mk("range_stale", "point")) == "hband"
    assert shape_of(mk("range_stale", "range_modeled")) == "box"
    assert shape_of(mk("none", "point")) == "omitted"
    print("  [ok ] shape dispatch: point / vband / hband / box / omitted")

    print(f"\n{'FAILED' if fails else 'all extractor tests passed'}")
    return 1 if fails else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sources", default="sources.json")
    ap.add_argument("--out", default="companies.json")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()

    if a.selftest:
        return selftest()
    if requests is None or BeautifulSoup is None:
        print("need: pip install requests beautifulsoup4 lxml", file=sys.stderr)
        return 2

    data = run(json.load(open(a.sources)), use_cache=not a.no_cache, workers=a.workers)
    json.dump(data, open(a.out, "w"), indent=2)

    shapes: dict[str, int] = {}
    for r in data["companies"]:
        shapes[r["shape"]] = shapes.get(r["shape"], 0) + 1
    print(f"wrote {a.out}: {len(data['companies'])} companies, "
          f"{sum(r['n_obs'] for r in data['companies'])} raw observations")
    print(f"  shapes: {shapes}")
    print(f"  peer multiple p25/med/p75: {data['peer_multiple']}")
    if data["fit"]["a"]:
        f = data["fit"]
        print(f"  fit: valuation = {f['a']:.1f} x ARR^{f['b']:.2f} "
              f"(R2={f['r2']:.2f}, n={f['n']})")
    for e in data["errors"]:
        print(f"  ! {e['company']}: {e['url']} -> {e['error']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

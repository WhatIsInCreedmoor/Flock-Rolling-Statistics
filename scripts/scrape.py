#!/usr/bin/env python3
"""
Scraper for Flock Safety Transparency Portal.
Uses Chrome with stealth flags to execute JavaScript, navigate past Cloudflare challenges,
and extract 30-day rolling ALPR metrics.
"""

import csv
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import time

URL = os.environ.get("FLOCK_URL", "https://transparency.flocksafety.com/creedmoor-nc-pd")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
LATEST_JSON = os.path.join(DATA_DIR, "latest.json")
HISTORY_JSON = os.path.join(DATA_DIR, "history.json")
HISTORY_CSV = os.path.join(DATA_DIR, "history.csv")


def find_chrome():
    candidates = [
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ]
    for c in candidates:
        if shutil.which(c):
            return c
    return None


def fetch_rendered_html(url, timeout=40):
    chrome_bin = find_chrome()
    if not chrome_bin:
        raise RuntimeError(
            "Chrome/Chromium executable not found. Please install google-chrome or chromium."
        )

    # Use native browser flags without hardcoded user-agent mismatches to avoid triggering Cloudflare Turnstile
    cmd = [
        chrome_bin,
        "--headless=new",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
        "--virtual-time-budget=15000",
        "--dump-dom",
        url,
    ]

    # Try in standard sandbox first
    print(f"Executing: {' '.join(cmd[:5])} ... {url}")
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout,
    )

    # If sandbox failed due to container restrictions, retry with --no-sandbox
    if result.returncode != 0 and ("sandbox" in result.stderr.lower() or not result.stdout):
        print("Retrying with --no-sandbox --disable-dev-shm-usage...")
        cmd_fallback = [
            chrome_bin,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--window-size=1920,1080",
            "--virtual-time-budget=15000",
            "--dump-dom",
            url,
        ]
        result = subprocess.run(
            cmd_fallback,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
        )

    return result.stdout


def extract_metric(entry_type, html):
    """
    Extracts numeric metric from elements with data-tp-entry-type="{entry_type}".
    Structure inside Flock portal:
      <div data-tp-entry-type="..." ...>
        ...
        <div style="...">94,218</div>
      </div>
    """
    pattern = (
        rf'data-tp-entry-type=[\"\x27]{entry_type}[\"\x27].*?'
        r'>([\d,]+)\s*</div>\s*</div>\s*</div>'
    )
    match = re.search(pattern, html, re.DOTALL)
    if match:
        val_str = match.group(1).replace(",", "").strip()
        try:
            return int(val_str)
        except ValueError:
            pass

    broad_pattern = (
        rf'data-tp-entry-type=[\"\x27]{entry_type}[\"\x27][^>]*>(.*?)(?:<\/div>\s*){{3}}'
    )
    broad_match = re.search(broad_pattern, html, re.DOTALL)
    if broad_match:
        numbers = re.findall(r'>([0-9,]+)<', broad_match.group(1))
        for num in reversed(numbers):
            cleaned = num.replace(",", "").strip()
            if cleaned.isdigit():
                return int(cleaned)

    return None


def parse_flock_html(html):
    if "data-tp-entry-type" not in html:
        if "Just a moment..." in html or "cf_chl" in html:
            raise ValueError("Cloudflare challenge page was returned instead of rendered portal.")
        raise ValueError("Target data attributes not found in page HTML.")

    plates = extract_metric("plateReadsInLast30Days", html)
    searches = extract_metric("searchesInLast30Days", html)
    hotlist_hits = extract_metric("plateHitsInLast30Days", html)
    cameras = extract_metric("numberOfOwnedCameras", html)

    if plates is None or searches is None or hotlist_hits is None:
        raise ValueError(
            f"Failed to parse all metrics: plates={plates}, searches={searches}, hotlist_hits={hotlist_hits}"
        )

    agency_match = re.search(r"<title>Flock Safety - (.*?) Transparency Portal</title>", html, re.I)
    agency_name = agency_match.group(1).strip() if agency_match else "Creedmoor NC PD"

    return {
        "agency": agency_name,
        "plates_detected_30d": plates,
        "searches_30d": searches,
        "hotlist_hits_30d": hotlist_hits,
        "cameras": cameras if cameras is not None else 10,
    }


def update_data_files(metrics, now_utc=None):
    if now_utc is None:
        now_utc = datetime.datetime.now(datetime.timezone.utc)

    date_str = now_utc.strftime("%Y-%m-%d")
    iso_timestamp = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Update latest.json
    latest_record = {
        "date": date_str,
        "timestamp": iso_timestamp,
        **metrics,
    }

    with open(LATEST_JSON, "w", encoding="utf-8") as f:
        json.dump(latest_record, f, indent=2)
    print(f"Saved latest snapshot to: {LATEST_JSON}")

    # 2. Update history.json
    history = []
    if os.path.exists(HISTORY_JSON):
        try:
            with open(HISTORY_JSON, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception as e:
            print(f"Warning reading history.json: {e}")
            history = []

    existing_index = None
    for idx, item in enumerate(history):
        if item.get("date") == date_str:
            existing_index = idx
            break

    entry = {
        "date": date_str,
        "timestamp": iso_timestamp,
        "plates_detected_30d": metrics["plates_detected_30d"],
        "searches_30d": metrics["searches_30d"],
        "hotlist_hits_30d": metrics["hotlist_hits_30d"],
        "cameras": metrics.get("cameras", 10),
    }

    if existing_index is not None:
        history[existing_index] = entry
        print(f"Updated existing record for {date_str} in history.json")
    else:
        history.append(entry)
        print(f"Appended new record for {date_str} to history.json")

    history.sort(key=lambda x: x.get("date", ""))

    with open(HISTORY_JSON, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    # 3. Update history.csv
    fieldnames = ["date", "timestamp", "plates_detected_30d", "searches_30d", "hotlist_hits_30d", "cameras"]
    with open(HISTORY_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for item in history:
            writer.writerow({
                "date": item.get("date", ""),
                "timestamp": item.get("timestamp", ""),
                "plates_detected_30d": item.get("plates_detected_30d", ""),
                "searches_30d": item.get("searches_30d", ""),
                "hotlist_hits_30d": item.get("hotlist_hits_30d", ""),
                "cameras": item.get("cameras", 10),
            })
    print(f"Saved history CSV to: {HISTORY_CSV}")


def main():
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Scraping {URL}")

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            print(f"Attempt {attempt}/{max_attempts}...")
            html = fetch_rendered_html(URL)
            metrics = parse_flock_html(html)
            print(f"Successfully scraped: {metrics}")
            update_data_files(metrics)
            return 0
        except Exception as e:
            print(f"Attempt {attempt} failed: {e}", file=sys.stderr)
            if attempt < max_attempts:
                time.sleep(5)

    print("All scraping attempts failed.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())

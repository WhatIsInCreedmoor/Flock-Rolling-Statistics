#!/usr/bin/env bash
# Daily sync script to run from this machine (bypasses datacenter Cloudflare challenges)
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "=== [$(date)] Running Flock Scraper ==="
python3 scripts/scrape.py

if [ -n "$(git status --porcelain data/)" ]; then
    echo "New data detected, committing and pushing to GitHub..."
    git add data/history.json data/history.csv data/latest.json
    git commit -m "Update Flock rolling statistics: $(date +'%Y-%m-%d')"
    git push origin main
    echo "Successfully pushed to GitHub! GitHub Pages will auto-deploy."
else
    echo "No changes in data today."
fi

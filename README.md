# Creedmoor NC PD — Flock Safety Transparency Portal Statistics

[![Daily Scraper](https://github.com/WhatIsInCreedmoor/Flock-Rolling-Statistics/actions/workflows/daily-scrape.yml/badge.svg)](https://github.com/WhatIsInCreedmoor/Flock-Rolling-Statistics/actions/workflows/daily-scrape.yml)

Historical time-series tracker for the [Creedmoor Police Department Flock Safety Transparency Portal](https://transparency.flocksafety.com/creedmoor-nc-pd).

Because Flock Safety publishes rolling 30-day cumulative sums, this project records daily snapshots to chart trends over time.

---

## 📊 Live Dashboard

👉 **[View the Live Dashboard](https://whatisincreedmoor.github.io/Flock-Rolling-Statistics/)**

### Tracked Metrics (from Flock Safety Transparency Portal):
1. **Vehicles detected in the last 30 days:** Number of unique plate reads over the last 30 days.
2. **Number of Searches:** Total user search sessions over the last 30 days.
3. **Number of Hotlist Hits:** Total hotlist hits over the last 30 days.
4. **Cameras:** Number of LPR and other cameras.

---

## 📁 Repository Structure

```
.
├── .github/
│   └── workflows/
│       └── daily-scrape.yml    # Scraper & GitHub Pages deployer workflow
├── data/
│   ├── latest.json             # Most recent snapshot
│   ├── history.json            # Historical time-series (JSON)
│   └── history.csv             # Historical time-series (CSV)
├── scripts/
│   ├── scrape.py               # Scraper script
│   └── daily_sync.sh           # Local sync script
├── index.html                  # Dashboard
├── app.js                      # Chart rendering
└── style.css                   # Styles
```

---

## 🚀 Setting Up GitHub Pages

1. Go to **Settings** $\rightarrow$ **Pages** in the repository.
2. Under **Build and deployment $\rightarrow$ Source**, select **GitHub Actions**.

---

## 💻 Local Testing & Sync

```bash
# Run the sync script
./scripts/daily_sync.sh

# Run local web server
python3 -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 📥 Data Export
* **JSON:** [`data/history.json`](data/history.json)
* **CSV:** [`data/history.csv`](data/history.csv)

# Creedmoor NC PD — Flock Rolling Statistics

Tracks daily snapshots from the [Creedmoor Police Department Flock Safety Transparency Portal](https://transparency.flocksafety.com/creedmoor-nc-pd) and charts historical changes over time.

Because the portal only publishes rolling 30-day totals, this repo records daily snapshots so day-to-day shifts and 30-day period comparisons can be tracked.

Dashboard: https://whatisincreedmoor.github.io/Flock-Rolling-Statistics/

## Metrics Tracked

- **Vehicles detected in the last 30 days** (`plateReadsInLast30Days`)
- **Number of Searches** (`searchesInLast30Days`)
- **Number of Hotlist Hits** (`plateHitsInLast30Days`)
- **Cameras** (`numberOfOwnedCameras`)

## Data

- `data/latest.json` — most recent snapshot
- `data/history.json` — full snapshot history (JSON)
- `data/history.csv` — full snapshot history (CSV)

## Local Usage

Run a manual scrape and sync:

```bash
./scripts/daily_sync.sh
```

Preview the dashboard locally:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

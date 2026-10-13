# Lottery Intelligence Pro — simple web app

A lightweight app made with plain HTML, CSS, and JavaScript. No database, build step, API key, account system, or package installation is needed. This is the simplified version requested in chat, not the original full production platform.

## Run locally

With Node.js 22 or later:

```sh
npm start
```

Open http://127.0.0.1:4173. Use the server instead of opening index.html directly (the browser must fetch data files). Stop it with Ctrl+C.

## Features

- Powerball and Mega Millions dashboard with actual drawing history.
- Period, date range, current matrix, and historical matrix filters.
- Observed and expected frequency charts, heatmaps, hot/cold rankings, and gap statistics.
- Actual historical pairs, triplets, sums, spreads, odd/even distributions, and co-occurrences.
- Ten configurable number-generation strategies; cryptographically secure unbiased random selection.
- Locked/excluded white and special balls, weights, balanced constraints, duplicate-free batches.
- Searchable results archive with details and CSV export.
- Browser-local saved tickets, favorites, manual entry, historical matching, copy, print, and CSV export.
- Responsive layout, keyboard focus states, reduced-motion support, and a basic installable/offline app shell.

## Data

The included snapshot contains **2,359 Powerball draws** (October 4, 2006–October 12, 2026) and **2,090 Mega Millions draws** (October 3, 2006–October 9, 2026). There are no missing scheduled drawing dates within this coverage at retrieval on October 13, 2026, before that evening's Mega Millions drawing.

Sources:

- [Texas Powerball CSV](https://www.texaslottery.com/export/sites/lottery/Games/Powerball/Winning_Numbers/powerball.csv): starts February 3, 2010.
- [Texas Mega Millions CSV](https://www.texaslottery.com/export/sites/lottery/Games/Mega_Millions/Winning_Numbers/megamillions.csv): starts December 5, 2003; this app uses October 2006 onward.
- [Colorado official Powerball archive](https://www.coloradolottery.com/en/games/powerball/drawings/2006-10/): 348 records fill the earlier Powerball coverage gap.

Every imported result is validated for date, weekday, uniqueness, and its historical number matrix. Conflicting numbers for a duplicate game/date cause an error. Verification here means retrieval from the named official operator and validation, not independent multi-source certification. The provenance JSON records retrieval timestamps, URLs, and SHA-256 hashes. Texas raw CSVs are retained unchanged; early Colorado records are extracted from its monthly pages.

## Refresh the published snapshot

```sh
npm run data:refresh
npm test
```

Requires internet access. The script downloads official data, including the early Colorado archive, into `dist/data/`. Republish the app after refreshing. The browser's reload button only reloads the latest **published snapshot**; automatic background sync is not enabled in this simple version. The app flags snapshots older than three days. Offline results may be cached. No paid API is used.

## Mathematics

Expected appearances sum the per-drawing inclusion probability: **5 / white pool** or **1 / special pool**. A number contributes only when it exists in that drawing's historical pool. Hot/cold rankings use observed / expected counts. Frequencies use eligible draws as their denominator. Trend is the latest 25 draws' normalized ratio minus the selected period's ratio. All pair/triplet counts come from actual co-occurrences.

Current Powerball: 5 of 69 + 1 of 26. Current Mega Millions: 5 of 70 + 1 of 24. Historical records preserve earlier matrices. Matrix start dates in code are first drawing dates. October 1, 2006 is the app's coverage start for already-existing 2006 matrices.

Pure Random draws use `crypto.getRandomValues`, rejection sampling to remove modulo bias, and selection without replacement. Hot / long-term weights are observed/expected + 0.25; cold weights are its reciprocal; mix averages the two; recent uses its selected trailing window; ensemble sums component weights. Pairing seeds the ticket with an actual frequent pair. Balance rejects tickets outside constraints. No strategy improves a valid combination's jackpot probability in a fair draw.

## Tests

```sh
npm test
```

Tests cover full snapshot coverage, historical boundaries, invalid draws, deduplication conflicts, normalized frequency math, actual combinations and gaps, all strategies, locks/exclusions, batch uniqueness, statistical randomness sanity checks, filtering, matching, and export. Statistical smoke tests are not proof of randomness.

## Deployment

Host the `dist/` folder on any static host (including Vercel or Netlify). For Vercel, select framework “Other”, leave build command empty, and set output directory to `dist`. Sites hosting is configured in `.openai/hosting.json`. No environment variables are required.

## Intentional simplifications

Saved tickets persist in the current browser only, without account synchronization. No real ticket purchases, live jackpot feed, prize estimates, historical profit backtesting, PostgreSQL database, scheduled synchronization, or predictive claims. Draws are independent; hot/cold/overdue numbers do not become more likely. Chart tooltips use native SVG titles. A saved digital combination is not an official lottery entry.

## Source structure

- `dist/index.html`, `style.css`, `app.mjs`: interface.
- `dist/engine.mjs`: rules, statistics, generation, export.
- `dist/data/`: real results and provenance.
- `scripts/refresh-data.mjs`: official-source importer.
- `scripts/serve.mjs`: minimal local web server.
- `tests/engine.test.mjs`: meaningful engine/data checks.

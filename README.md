# sleeper-scores

Open-source fantasy football intelligence. Every number shows its math.

**Live site:** [chrbailey.github.io/sleeper-scores](https://chrbailey.github.io/sleeper-scores/)

---

## What It Does

Search any NFL player and get a full intelligence card: composite grade, dynasty value, weekly trend analysis, news buzz, ceiling/floor projections, and a scouting report. Drop players into the Trade Analyzer to compare dynasty values side by side.

**The differentiator:** Click any computed number to see exactly how it was calculated — the formula, the inputs, the benchmarks, and the caveats. No black boxes.

## What It Computes

| Metric | Method | Click to See |
|--------|--------|-------------|
| **Stat-Based Score (0-99)** | Percentile rank of per-game stats against position-specific benchmarks | Component breakdown, benchmark arrays, weights, weighted sum |
| **Dynasty Score (1-99)** | Production (40%) + youth (30%) + longevity (15%) + position premium (15%) - penalties | Age curve, peak window, touch cliff estimate, injury multiplier |
| **Trend** | Linear regression + coefficient of variation on 2-8 weeks of fantasy points | Slope, CV, consecutive streaks, recent vs season mean, signal thresholds |
| **News Buzz (-100 to +100)** | Keyword frequency scoring on Google News headlines | Keyword lists, match counts, articles scanned, scoring formula |
| **Ceiling / Floor** | Projected points x position variance multiplier | Multiplier per position, caveat that it's a heuristic not a CI |
| **Fantasy Points** | Standard scoring rules (PPR / Half / Standard) | Each stat x multiplier = contribution |

## Setup

1. Open the site (or run `python -m http.server` in this directory)
2. Click **Settings** and enter your Sleeper username
3. Search any player in **Scout** or compare trades in **Trade**

That's it. No accounts, no API keys, no build step.

## How It Works

Everything runs client-side in the browser. Zero backend.

- **Sleeper API** (free, no auth, CORS-friendly) provides player data, stats, and projections
- **Google News RSS** via rss2json.com provides headlines for the news buzz feature
- **IndexedDB** caches the 9MB player database for 24 hours — second visit loads instantly
- **localStorage** persists your configuration (username, leagues, scoring format)

## File Structure

```
sleeper-scores/
├── index.html              # Shell: loads ES modules, mounts React app
├── style.css               # Design tokens (CSS custom properties) + component styles
├── config.js               # localStorage persistence for user settings
├── engine/                 # Pure computation — zero DOM, zero React, zero side effects
│   ├── scoring.js          # Fantasy point calculation (PPR/half/standard)
│   ├── grades.js           # Composite grading: benchmarks, percentile scoring, weights
│   ├── dynasty.js          # Dynasty valuation: age curves, touch cliff, position premium
│   ├── trends.js           # Multi-week pattern analysis: regression, CV, buy/sell signals
│   └── sentiment.js        # News keyword buzz scoring (honestly labeled)
├── api/                    # Data fetching — zero engine or UI dependencies
│   ├── sleeper.js          # Sleeper API wrapper + IndexedDB cache
│   └── news.js             # Google News RSS fetch via rss2json.com
└── ui/                     # React components (ES modules + htm)
    ├── htm.js              # htm + React binding (shared by all UI modules)
    ├── app.js              # Root: data loading, routing, state management
    ├── scout.js            # Player search + results table
    ├── trade.js            # Trade analyzer with explainable verdict
    ├── card.js             # Player Intelligence Card (the core UI unit)
    ├── explain.js          # ExplainPanel — the "show your work" interaction
    ├── settings.js         # Configuration panel
    └── primitives.js       # GradeRing, Sparkline, SentimentMeter, badges
```

**Architecture rule:** `engine/` has zero imports from `api/` or `ui/`. `api/` has zero imports from `ui/`. Arrows only point downward. The engine is portable — import it into Node, a test harness, or a different UI.

## Forking This

**Change the design:** Edit CSS custom properties in `style.css` (lines 4-22).

**Change the grades:** Edit `BENCHMARKS` and `WEIGHTS` in `engine/grades.js`. These are exported constants at the top of the file.

**Change dynasty valuation:** Edit `AGE_CURVES` and `DYNASTY_WEIGHTS` in `engine/dynasty.js`.

**Change trend thresholds:** Edit `TREND_THRESHOLDS` in `engine/trends.js`.

**Change sentiment keywords:** Edit `POSITIVE_KEYWORDS` and `NEGATIVE_KEYWORDS` in `engine/sentiment.js`.

**Change scoring rules:** Edit `SCORING_RULES` in `engine/scoring.js`.

Every constant that drives a computation is exported, named, and at the top of its file.

## Tech Stack

- React 18 (via esm.sh CDN)
- [htm](https://github.com/developit/htm) — JSX alternative, 700 bytes, no build step
- ES modules via import maps — no bundler
- Sleeper API (free, no auth)
- Google News RSS via rss2json.com
- IndexedDB for player database caching
- CSS custom properties for theming
- GitHub Pages hosting

## Data Sources

| Data | Source |
|------|--------|
| Player database | Sleeper API `/players/nfl` |
| Per-game stats | Sleeper API `/stats/nfl/regular/{season}/{week}` |
| Projections | Sleeper API `/projections/nfl/regular/{season}/{week}` |
| Age curves | EPA 2014-2024 positional study |
| RB touch cliff | Historical research (2,500 career touches) |
| News headlines | Google News RSS via rss2json.com |

---

Built with Claude.

# sleeper-scores — Design Specification

> Open-source fantasy football intelligence. Every number shows its math.

## Problem

Fantasy football tools are black boxes. PFF grades, ESPN projections, FantasyPros rankings — none of them show the computation. You get a number and are expected to trust it. This is the opposite of how a serious analyst thinks.

The existing North County Beacon codebase contains a fantasy football engine with genuine analytical depth (composite grading, dynasty valuation, multi-week trend analysis, news sentiment) buried inside a bloated single-file app that also serves as a personalized news aggregator. The news half is the weak half — templated "analysis," fabricated engagement metrics, fake featured stories. The fantasy half has real math but dishonest labeling ("PFF-style," "research-backed") and a 800KB Babel dependency compiling 2,000+ lines of JSX on every page load.

## Solution

Kill the news aggregator. Extract and rebuild the fantasy football engine as a standalone open-source tool with one defining feature: **every computed number is expandable to show the exact formula, inputs, benchmarks, and caveats that produced it.** The engine doesn't just return values — it returns values with receipts.

## Audience

Developers and power-user fantasy football players who would fork a GitHub project. The code is the documentation. The README is the front door. The architecture should be clean enough that someone can read `engine/grades.js`, understand the methodology, disagree with the weights, change them, and have their fork working in minutes.

## Principles

These are non-negotiable. Every implementation decision should be tested against them.

1. **Zero build, zero backend.** ES modules loaded directly by the browser. No npm, no webpack, no transpilation step. `python -m http.server` or GitHub Pages — that's the deployment. If a dependency requires a build step, it's the wrong dependency.

2. **The engine is the product.** The `engine/` directory contains pure functions with zero DOM dependencies, zero React imports, zero side effects. You can import `grades.js` into Node, into a test harness, into a completely different UI. The engine is portable. The UI is one consumer of the engine.

3. **Computed explanations, not documentation.** The `explain` object returned by every engine function is not a static description — it contains the actual intermediate values from that specific computation. When the UI shows "how this grade was calculated," it renders the real inputs, the real benchmark comparisons, and the real weighted sum for that player. The explanation is a byproduct of the computation, not a separate artifact.

4. **Honest labels.** If it's keyword counting, call it keyword counting. If it's a percentile rank against season benchmarks, say that — don't call it "PFF-style." Every metric name must accurately describe the methodology. Overclaiming destroys trust; precise language builds it.

5. **Separation into testable units.** Each module has one purpose, communicates through well-defined interfaces, and can be understood without reading other modules. The grading engine doesn't know about React. The API layer doesn't know about grades. The UI doesn't know about HTTP.

6. **No fake data.** No fabricated engagement metrics, no hardcoded stories, no random numbers dressed up as social proof. Every number displayed comes from a real API or a real computation on real data.

---

## Architecture

### File Structure

```
sleeper-scores/
├── index.html              # Shell: loads modules, mounts React app
├── style.css               # Design tokens + component styles + one responsive breakpoint
├── engine/
│   ├── grades.js           # Composite grading engine
│   ├── dynasty.js          # Dynasty valuation engine
│   ├── trends.js           # Multi-week pattern analysis
│   ├── sentiment.js        # News keyword buzz scoring
│   └── scoring.js          # Fantasy point calculation
├── api/
│   ├── sleeper.js          # Sleeper API wrapper + IndexedDB cache
│   └── news.js             # Google News RSS fetch (for sentiment)
├── ui/
│   ├── app.js              # Root component, routing, data loading, state
│   ├── scout.js            # Player search + results table
│   ├── trade.js            # Trade analyzer (two-sided comparison)
│   ├── card.js             # Player intelligence card (surface + depth)
│   ├── explain.js          # ExplainPanel — the "show your work" interaction
│   ├── settings.js         # Configuration panel
│   └── primitives.js       # GradeRing, Sparkline, SentimentMeter, StatChip, badges
├── config.js               # localStorage persistence for user config
└── README.md
```

### Dependency Graph

```
index.html
  └── ui/app.js
        ├── ui/scout.js
        │     └── ui/card.js
        │           ├── ui/explain.js
        │           ├── ui/primitives.js
        │           ├── engine/grades.js
        │           ├── engine/dynasty.js
        │           ├── engine/trends.js
        │           └── engine/sentiment.js
        ├── ui/trade.js
        │     └── ui/card.js (compact mode)
        ├── ui/settings.js
        │     └── config.js
        ├── api/sleeper.js
        └── api/news.js

engine/* → zero imports from ui/*, api/*, or React
api/*    → zero imports from ui/* or engine/*
ui/*     → imports from engine/* and api/* (downward only)
```

**Critical constraint:** Arrows only point downward. `engine/` never imports from `api/` or `ui/`. `api/` never imports from `ui/`. This makes the engine portable and every layer independently testable.

---

## Engine Modules

### The Explainable Result Pattern

Every public engine function returns an object with this shape:

```javascript
{
  value: <number|string>,          // The computed result
  label: <string>,                 // Human-readable label (optional)
  components: { ... },             // Sub-scores or breakdown (optional)
  explain: {
    method: <string>,              // One-line description of the algorithm
    inputs: { ... },               // The raw values that went in
    formula: <string>,             // The math in readable form
    benchmarks: { ... },           // Reference points used (optional)
    weights: { ... },              // Weights applied (optional)
    source: <string>,              // Where the input data came from
    caveats: [<string>, ...],      // What this metric does NOT capture
  }
}
```

The `explain` object is populated during computation, not after. Intermediate values are captured as they're calculated. This guarantees the explanation matches the result — they're computed in the same pass.

### engine/grades.js — Composite Grading

**Purpose:** Score a player's per-game statistical production on a 0-99 scale relative to position-specific benchmarks.

**Label:** "Stat-Based Score" (not "PFF-style grade").

**Algorithm:**
1. Look up position-specific benchmarks: 5-tier arrays `[poor, below_avg, avg, good, elite]` for each relevant stat
2. For each stat, compute a percentile score (0-99) based on where the player's per-game value falls in the benchmark range
3. Apply position-specific weights to each component
4. Weighted average → composite grade

**Exported constants (forkable):**

```javascript
export const BENCHMARKS = {
  QB: { pass_yd: [140, 195, 245, 290, 340], pass_td: [0, 1, 1.8, 2.5, 3.5], ... },
  RB: { rush_yd: [25, 45, 65, 85, 110], rush_td: [0, 0.25, 0.55, 0.9, 1.3], ... },
  WR: { rec: [1.5, 3, 5, 6.5, 8.5], rec_yd: [25, 50, 72, 95, 120], ... },
  TE: { rec: [1, 2, 3.5, 5, 6.5], rec_yd: [10, 28, 48, 68, 88], ... },
};

export const WEIGHTS = {
  QB: { pass_yd: 0.28, pass_td: 0.25, pass_int: 0.18, rush_yd: 0.12, cmp_pct: 0.17 },
  RB: { rush_yd: 0.28, rush_td: 0.18, rec: 0.15, rec_yd: 0.12, fum_lost: 0.12, efficiency: 0.15 },
  WR: { rec: 0.20, rec_yd: 0.28, rec_td: 0.22, rec_tgt: 0.15, efficiency: 0.15 },
  TE: { rec: 0.25, rec_yd: 0.30, rec_td: 0.25, rec_tgt: 0.20 },
};
```

**Explain output includes:** Each component's raw value, the benchmark array it was scored against, the resulting percentile, the weight applied, and the final weighted sum as a readable formula string (e.g., `"(94×.28 + 89×.22 + 88×.20 + 82×.15 + 79×.15) = 91"`).

**Caveats included in every result:**
- "Stat-based only — does not capture play-by-play context like PFF grades"
- "Per-game stats penalize high-production players who missed games"
- "Benchmarks calibrated to 2025 season — may need re-calibration for future seasons"

**Public API:**

```javascript
export function computeCompositeGrade(stats, position) → ExplainableResult
export function percentileScore(value, benchmarkArray) → number
export { BENCHMARKS, WEIGHTS }
```

### engine/dynasty.js — Dynasty Valuation

**Purpose:** Score a player's long-term fantasy value (1-99) factoring production, age trajectory, career longevity, and position premium.

**Label:** "Composite Dynasty Score" (not "research-backed value").

**Formula:**

```
dynasty = production_score + youth_score + longevity_score + position_premium - workload_penalty

Where:
  production_score = projected_weekly_pts × 2.0           (weight: ~40%)
  youth_score      = peak_years_remaining × 3.0           (weight: ~30%)
  longevity_score  = total_years_to_cliff × 1.0           (weight: ~15%)
  position_premium = { QB: 12, WR: 4, TE: 2, RB: 0 }     (weight: ~15%)

RB workload penalties:
  career_touches > 2500 → ×0.65
  career_touches > 2000 → ×0.80
  career_touches > 1500 → ×0.90
  age >= 28             → ×0.70
  age >= 27             → ×0.85

Injury multipliers:
  Out/IR        → ×0.50
  Doubtful      → ×0.70
  Questionable  → ×0.90
```

**Exported constants (forkable):**

```javascript
export const AGE_CURVES = {
  QB: { peakStart: 28, peakEnd: 33, cliff: 40, avgCareer: 15 },
  RB: { peakStart: 23, peakEnd: 26, cliff: 30, avgCareer: 6, touchCliff: 2500 },
  WR: { peakStart: 25, peakEnd: 30, cliff: 33, avgCareer: 10 },
  TE: { peakStart: 26, peakEnd: 30, cliff: 34, avgCareer: 9 },
};
```

**Trajectory classification:**

| Age vs Curve | Label | Color |
|---|---|---|
| age < peakStart | ASCENDING | green |
| peakStart ≤ age ≤ peakEnd | PRIME | blue |
| peakEnd < age ≤ declineStart+1 | DECLINING | amber |
| age > declineStart+1 | LATE CAREER | red |

**Explain output includes:** The full formula with actual values substituted, which penalties applied and why, the age curve reference for the position, the estimated career touches (for RBs) with caveat that it's `years × 200` not actual data.

**Caveats:**
- "Career touches estimated from years of experience × 200 — actual touch data not available from Sleeper API"
- "Age curves based on EPA 2014-2024 positional study — individual players may deviate"
- "Injury multiplier uses current injury status, not injury history"

**Public API:**

```javascript
export function calcDynastyValue(projected, position, age, yearsExp, injuryStatus) → ExplainableResult
export function getTrajectory(age, position) → { label, color, yearsToCliff, yearsToPeak, phase }
export function estimateCareerTouches(yearsExp) → ExplainableResult
export { AGE_CURVES }
```

### engine/trends.js — Multi-Week Pattern Analysis

**Purpose:** Detect performance trends from weekly stat lines using linear regression and coefficient of variation.

**Algorithm:**
1. Fetch 2-8 weeks of historical stats for the player
2. Convert each week to fantasy points (using configured scoring format)
3. Compute: mean, standard deviation, coefficient of variation
4. Linear regression: slope of fantasy points over weeks
5. Normalized slope: `slope / mean` (trend strength relative to baseline)
6. Consecutive-week streaks (up/down)
7. Recent 3-week mean vs season mean
8. Classify: TRENDING UP, TRENDING DOWN, BOOM/BUST, CONSISTENT, STABLE
9. Signal: BUY LOW (underperforming baseline), SELL HIGH (surging), HOLD

**Thresholds (forkable):**

```javascript
export const TREND_THRESHOLDS = {
  slopeUp: 0.08,          // normalized slope above this = trending up
  slopeDown: -0.08,       // normalized slope below this = trending down
  boomBustCV: 0.5,        // CV above this = boom/bust
  consistentCV: 0.2,      // CV below this (with mean > 8) = consistent
  consecutiveStreak: 3,    // 3+ consecutive up/down weeks triggers trend
  buyLowDelta: -0.15,     // recent vs season mean below this = buy low
  sellHighDelta: 0.20,    // recent vs season mean above this = sell high
};
```

**Explain output includes:** Weekly point values, the regression slope and its normalization, CV calculation, which threshold triggered the classification, the buy/sell confidence percentage and how it was derived.

**This module is already the strongest analytical code in the current codebase.** The math is sound. Changes: add the explain pattern, export thresholds as constants, clean up the return shape.

**Public API:**

```javascript
export function analyzePatterns(weeklyData, position, scoring) → ExplainableResult
export { TREND_THRESHOLDS }
```

### engine/sentiment.js — News Keyword Buzz

**Purpose:** Score media narrative around a player by counting positive/negative keywords in recent Google News headlines.

**Label:** "News Buzz (keyword matching)" (not "Social Sentiment Engine").

**Algorithm:**
1. Fetch recent Google News RSS results for "{playerName} NFL"
2. For each headline, count matches against positive and negative keyword lists
3. Score: `(positiveCount - negativeCount) / totalCount × 100`
4. Classify narrative: strong positive, positive, neutral, negative, strong negative

**Exported constants (forkable):**

```javascript
export const POSITIVE_KEYWORDS = [
  "breakout", "elite", "dominant", "career high", "record", "star",
  "surge", "boom", "top", "best", "mvp", "pro bowl", "extension",
  "deal", "clutch", "explosive", "unstoppable", "rising"
];

export const NEGATIVE_KEYWORDS = [
  "injury", "injured", "bust", "decline", "drop", "worst", "benched",
  "cut", "suspend", "arrested", "questionable", "doubt", "concern",
  "struggle", "fumble", "interception", "hamstring", "acl",
  "concussion", "limited", "downgrade", "out for"
];
```

**Explain output includes:** The exact keyword lists used, which keywords matched and how many times, total articles scanned, article date range, the raw score calculation.

**Caveats (included in every result):**
- "Keyword counting only — no NLP, no negation detection ('not injured' scores as negative)"
- "Headline text only — does not read article bodies"
- "Limited to Google News RSS results (typically 8-10 articles)"
- "No source authority weighting — ESPN and a fan blog count equally"

**Public API:**

```javascript
export function fetchPlayerSentiment(playerName) → Promise<ExplainableResult>
export { POSITIVE_KEYWORDS, NEGATIVE_KEYWORDS }
```

### engine/scoring.js — Fantasy Point Calculation

**Purpose:** Convert raw stats to fantasy points under PPR, half-PPR, or standard scoring.

**Scoring rules:**

```javascript
export const SCORING_RULES = {
  ppr:      { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 1,   fum_lost: -2, fgm: 3, xpm: 1 },
  half_ppr: { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 0.5, fum_lost: -2, fgm: 3, xpm: 1 },
  standard: { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 0,   fum_lost: -2, fgm: 3, xpm: 1 },
};
```

**Explain output includes:** Each stat × its multiplier = contribution, listed as a breakdown table. Total is the sum.

**Public API:**

```javascript
export function calcFantasyPts(stats, format) → ExplainableResult
export { SCORING_RULES }
```

---

## API Layer

### api/sleeper.js — Sleeper API Wrapper

**Purpose:** Fetch player data, stats, projections, and league info from the Sleeper API. Cache the 9MB player database in IndexedDB.

**Caching strategy:**

| Data | Storage | TTL | Rationale |
|---|---|---|---|
| Player database (~9MB) | IndexedDB | 24 hours | Doesn't change intra-day. First visit fetches from network; subsequent visits load from IndexedDB instantly. |
| Season stats | In-memory Map | 1 hour | Changes during game day but stable otherwise. |
| Weekly stats (per week) | In-memory Map | 1 hour | Historical weeks are immutable after Tuesday waivers. |
| Projections | In-memory Map | 1 hour | Updated periodically by Sleeper. |
| NFL state (current week) | In-memory | 1 hour | Cheap call, changes once per week. |

**IndexedDB implementation:**

```javascript
const DB_NAME = 'sleeper-scores';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

async function getCached(key, ttlMs) {
  // Returns { data, timestamp } if exists and not expired
  // Returns null if missing or expired
}

async function setCache(key, data) {
  // Stores { data, timestamp: Date.now() }
}
```

**Public API:**

```javascript
export async function getPlayers() → object              // Full player DB (cached)
export async function getSeasonStats(week) → object       // Per-game stats for a week
export async function getProjections(week) → object       // Projections for a week
export async function getNFLState() → { week, season }    // Current NFL week
export async function getUser(username) → object           // Sleeper user lookup
export async function getUserLeagues(userId) → array       // User's leagues
export async function getLeague(leagueId) → object         // League details
export async function getRosters(leagueId) → array         // League rosters
export async function getLeagueUsers(leagueId) → array     // League members
```

All functions handle errors gracefully — return empty objects/arrays on failure, log warnings to console. The UI never crashes from an API failure.

### api/news.js — Google News RSS

**Purpose:** Fetch recent news headlines for a player name via Google News RSS → rss2json.com.

```javascript
export async function fetchHeadlines(query) → array<{ title, source, date, link }>
```

Single responsibility: fetch and parse headlines. Sentiment scoring is in `engine/sentiment.js`. This module just delivers raw headline data.

---

## UI Layer

### No JSX. No Babel. React.createElement with htm.

The current codebase loads 800KB of Babel Standalone to transpile JSX in the browser. This is eliminated entirely.

**Approach:** Use `htm` (by Jason Miller, creator of Preact) — a 700-byte tagged template literal library that provides JSX-like syntax without a compiler:

```javascript
import htm from 'https://esm.sh/htm@3.1.1';
const html = htm.bind(React.createElement);

// Instead of JSX:   <div className="card"><h3>{name}</h3></div>
// Write:            html`<div class="card"><h3>${name}</h3></div>`
```

**Why htm:**
- 700 bytes vs 800KB (Babel) — 1000x smaller
- No build step — runs directly in the browser as an ES module
- Near-identical readability to JSX
- Used by Preact's own documentation — battle-tested

### CDN Dependencies (3 total)

```html
<!-- index.html -->
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.2.0",
    "react-dom": "https://esm.sh/react-dom@18.2.0",
    "htm": "https://esm.sh/htm@3.1.1"
  }
}
</script>
```

Three dependencies. All from esm.sh (ES module CDN). No npm install. No node_modules.

### ui/app.js — Root Component

**Responsibilities:**
- Mount the React app
- Manage data layer state via `useReducer`
- Coordinate data loading on startup (NFL state → player DB → stats)
- Route between Scout, Trade, and Settings views
- Pass data downward via props (no context, no state library)

**State shape:**

```javascript
const initialState = {
  players: null,           // Full player DB from IndexedDB/API
  stats: {},               // Season stats keyed by player ID
  projections: {},         // Current week projections keyed by player ID
  weeklyStats: {},         // { [weekNum]: { [playerId]: stats } }
  currentWeek: 1,          // Current NFL week
  loading: true,           // Initial data load in progress
  error: null,             // Error message if data load fails
};
```

**Data loading sequence:**

```
1. getNFLState()           → currentWeek
2. getPlayers()            → players (from IndexedDB if cached, else API)
3. getSeasonStats(week)    → stats        } parallel
4. getProjections(week)    → projections   } parallel
```

Steps 3-4 run in parallel after step 2 completes (they don't depend on the player DB, but the UI needs players to render anything meaningful).

**View routing:** Simple string state — `"scout"` | `"trade"` | `"settings"`. No router library. Three nav buttons set the view string. Default: `"scout"`.

### ui/scout.js — Player Search + Results

**Layout:**
1. Search input + position filter buttons (ALL, QB, RB, WR, TE)
2. Results table: POS | NAME | TEAM | AGE | GRADE | PROJ | "Intel →"
3. Clicking a row expands the full `PlayerIntelligenceCard` inline below the table

**Search behavior:**
- Minimum 2 characters to trigger search
- Filters the cached player DB client-side (instant, no API call)
- Matches against: full name, team abbreviation, team city/name (via NFL_TEAMS lookup)
- Sorted by grade descending, then projected points descending
- Capped at 25 results

### ui/card.js — Player Intelligence Card

The core UI unit. Two modes: `full` (in Scout) and `compact` (in Trade Analyzer).

**Full mode layout:**

```
┌─────────────────────────────────────────────────┐
│ Name            Position Team Age Yr College     │  ← Header
│                                    [Grade Ring] [Dynasty] │
├─────────────────────────────────────────────────┤
│ ACTUAL │ PROJ │ CEILING │ FLOOR │ GRADE │ TRAJ  │  ← Stat grid (each cell clickable)
├─────────────────────────────────────────────────┤
│ ▼ HOW THIS GRADE WAS CALCULATED                 │  ← ExplainPanel (expanded)
│   method, components, formula, caveats           │
├─────────────────────────────────────────────────┤
│ Rec 7.1 | Yd 95.2 | TD 0.94 | Tgt 10.3 | Y/R  │  ← Raw stats bar
├─────────────────────────────────────────────────┤
│ TREND ↑ TRENDING UP    │ NEWS BUZZ        +44   │  ← Trend + Buzz (expandable)
│ ▁▂▁▃▂▅▇ Avg: 20.1      │ 6 articles · "breakout"│
├─────────────────────────────────────────────────┤
│ Scout Report: Elite-tier WR. Grade of 91...      │  ← Generated from all engine outputs
└─────────────────────────────────────────────────┘
```

**Compact mode layout (for Trade Analyzer):**

```
┌──────────────────────────────────────────────────┐
│ WR │ Ja'Marr Chase  CIN · 25yo │ [91] │ 19.8   │ ← One row: pos, name, grade ring, proj
└──────────────────────────────────────────────────┘
```

Click to expand full card inline.

**Data flow in card.js:**

```
Props: { player, stats, projections, currentWeek, compact }

On mount (full mode):
  1. engine/grades.computeCompositeGrade(stats, position) → grade result
  2. engine/dynasty.calcDynastyValue(...) → dynasty result
  3. engine/scoring.calcFantasyPts(stats, format) → actual result
  4. engine/scoring.calcFantasyPts(projections, format) → projected result
  5. Ceiling/floor: projected.value × position variance multiplier → with explain
  6. Async parallel:
     a. engine/trends: fetch multi-week stats → analyzePatterns → trend result
     b. engine/sentiment: fetchPlayerSentiment → buzz result
  7. Generate scout report from all results

Each result carries its own explain object → passed to ExplainPanel components
```

### ui/explain.js — The "Show Your Work" Component

The differentiating interaction. Wraps any computed value and makes it expandable.

**Behavior:**
- **Collapsed (default):** Renders `children` (the number/badge/ring). Shows a subtle cursor change and optional "?" indicator on hover to signal interactivity.
- **Expanded (on click):** Slides open a panel below showing:
  - Method description (one line)
  - Component breakdown (if applicable) with raw values, benchmarks, weights
  - Formula string with actual values substituted
  - Source attribution
  - Caveats list

**Implementation approach:**

```javascript
function ExplainPanel({ result, children }) {
  const [expanded, setExpanded] = useState(false);

  return html`
    <div class="explainable" onClick=${() => setExpanded(e => !e)}>
      ${children}
      ${expanded && result?.explain && html`
        <div class="explain-depth">
          <div class="explain-header">
            <span class="explain-title">HOW THIS WAS CALCULATED</span>
            <span class="explain-collapse">collapse ^</span>
          </div>
          <div class="explain-method">${result.explain.method}</div>
          ${result.components && html`<${ExplainComponents} components=${result.components} />`}
          ${result.explain.formula && html`<div class="explain-formula">${result.explain.formula}</div>`}
          <div class="explain-source">Source: ${result.explain.source}</div>
          ${result.explain.caveats?.length > 0 && html`
            <div class="explain-caveats">
              <strong>Caveats:</strong> ${result.explain.caveats.join(' · ')}
            </div>
          `}
        </div>
      `}
    </div>
  `;
}
```

**Only one panel open at a time per card.** When the user clicks a different metric, the previous one collapses. This prevents the card from becoming overwhelmingly tall.

### ui/trade.js — Trade Analyzer

**Layout:**

Two columns (Side A: "YOU GIVE", Side B: "YOU GET") with a verdict panel below.

**Behavior:**
1. Each side has a search bar that queries the cached player DB
2. Click a result to add to that side (renders compact card)
3. Verdict computed from dynasty value totals and projection totals
4. Verdict panel is an ExplainPanel — click "Show Math" to see the full breakdown

**Verdict logic:**

```
valDiff = sideB_dynasty_total - sideA_dynasty_total
projDiff = sideB_proj_total - sideA_proj_total

|valDiff| < 5 AND |projDiff| < 2       → FAIR TRADE
valDiff > 10 AND projDiff > 0          → STRONG WIN
valDiff > 5                            → YOU WIN
valDiff < -10 AND projDiff < 0         → STRONG LOSS
valDiff < -5                           → YOU LOSE
else                                   → MARGINAL
```

**Scoring format toggle:** Small toggle at top of trade view — PPR / Half / Standard. Recalculates all projections and dynasty values instantly when switched.

### ui/settings.js — Configuration Panel

Minimal. Three fields:

1. **Sleeper Username** — text input + "Auto-Detect Leagues" button
2. **Scoring Format** — radio group: PPR, Half-PPR, Standard
3. **Leagues** — auto-populated from username lookup, editable league IDs and names

Persists to `localStorage` via `config.js`.

### ui/primitives.js — Shared Visual Components

Pure presentational components. No state, no data fetching.

| Component | Purpose |
|---|---|
| `GradeRing` | SVG circular progress indicator. Props: grade (0-99), size, label |
| `Sparkline` | CSS-only bar chart from weekly point array. Props: data[], height, color |
| `SentimentMeter` | Horizontal bar showing -100 to +100. Props: score, width |
| `StatChip` | Compact stat display: label + value. Props: label, value, good/bad |
| `SignalBadge` | BUY LOW / SELL HIGH / HOLD badge. Props: signal, confidence |
| `TrendArrow` | ↑ / → / ↓ directional indicator. Props: direction |
| `PositionBadge` | Colored position tag (QB red, RB blue, WR amber, TE purple). Props: position |

All components are pure functions. No `useState`, no `useEffect`. They render from props and nothing else.

---

## Styling

### style.css

Single CSS file. Three sections:

**1. Design tokens (custom properties):**

```css
:root {
  --navy: #1a2744;
  --gold: #c8a951;
  --green: #16a34a;
  --blue: #2563eb;
  --red: #dc2626;
  --amber: #f59e0b;
  --purple: #8b5cf6;
  --bg: #f8f7f4;
  --card: #ffffff;
  --meta: #6b7280;
  --border: #e5e7eb;
  --border-light: #f3f4f6;
  --surface: #f9fafb;
  --font: 'Inter', system-ui, -apple-system, sans-serif;
  --mono: ui-monospace, 'SF Mono', 'Fira Code', monospace;
}
```

Forkers change colors in one place.

**2. Component classes:** `.grade-ring`, `.sparkline`, `.stat-grid`, `.explain-depth`, `.player-card`, `.trade-side`, `.verdict`, `.nav-tab`, etc. No utility-class framework — each class describes what it is, not what it looks like.

**3. One responsive breakpoint:**

```css
@media (max-width: 640px) {
  .stat-grid { grid-template-columns: repeat(3, 1fr); }
  .trade-sides { flex-direction: column; }
  .trend-buzz-row { grid-template-columns: 1fr; }
}
```

One breakpoint. Three rules. Enough to make it usable on a phone without over-engineering responsive design.

**Estimated size:** ~200-250 lines of CSS.

---

## Configuration

### config.js

```javascript
const STORAGE_KEY = 'sleeper-scores-config';

const DEFAULT_CONFIG = {
  sleeperUsername: '',
  scoringFormat: 'ppr',     // 'ppr' | 'half_ppr' | 'standard'
  leagues: [],               // [{ id, name, isCommissioner }]
};

export function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch { return { ...DEFAULT_CONFIG }; }
}

export function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export { DEFAULT_CONFIG };
```

No personal data in the source. No URL hash encoding. No profile fields (name, school, causes). Clean defaults.

---

## What Is Removed

Everything from the news aggregator side and all dishonest patterns:

- Entire news aggregator (RSS feeds, topic classification, story cards, thread view)
- `b.html` (PII in source)
- `generateRelevance()` and `generateConservativeAnalysis()` (templated "analysis")
- Fabricated points/comments (`Math.floor(Math.random() * 400 + 100)`)
- Hardcoded featured stories with fake citations
- Birthday banner, profile personalization fields (name, school, causes, etc.)
- Babel Standalone (800KB)
- All inline styles (moved to style.css)
- "PFF-style" labeling → "Stat-Based Score"
- "Social Sentiment Engine" → "News Buzz (keyword matching)"
- "research-backed" dynasty claim → explicit formula with weights
- League Dashboard (rosters/standings that duplicate Sleeper's own app)
- URL hash persistence → localStorage

---

## What Is Added

- `explain.js` — ExplainPanel component (the differentiating feature)
- Explainable Result pattern across all engine functions
- IndexedDB player cache (9MB player DB persists across sessions)
- `style.css` with CSS custom properties (forkable design tokens)
- One responsive breakpoint (mobile usability)
- `htm` tagged templates replacing JSX (700 bytes vs 800KB Babel)
- Import maps for clean ES module CDN imports
- Honest labels on every metric
- Exported constants (BENCHMARKS, WEIGHTS, AGE_CURVES, THRESHOLDS, KEYWORDS) — the fork points

---

## README Structure

1. **One-line description:** "Open-source fantasy football intelligence. Every number shows its math."
2. **Screenshot** of a Player Intelligence Card with an expanded explain panel
3. **What it computes:** methodology table (grade, dynasty, trend, sentiment, scoring)
4. **The differentiator:** "Click any number to see the formula, inputs, and caveats"
5. **Setup:** Open → enter Sleeper username → done
6. **Fork guide:** Which constants to change, where the design tokens are, how to add a metric
7. **File structure:** One line per file describing its purpose
8. **Data sources:** Sleeper API, Google News RSS, EPA age curves
9. **Tech:** React 18, htm, ES modules, IndexedDB, CSS custom properties. Zero build.
10. **Built with Claude.**

---

## Success Criteria

The redesign is complete when:

1. `python -m http.server` in the project directory → working app in browser
2. Player search returns results from Sleeper API with composite grades
3. Every grade, dynasty score, trend signal, and sentiment score has an expandable explanation showing the actual computation
4. Trade Analyzer produces verdicts with expandable math
5. Second page load is near-instant (player DB from IndexedDB, no Babel compilation)
6. The `engine/` directory has zero imports from `ui/` or `api/`
7. All exported constants (BENCHMARKS, WEIGHTS, AGE_CURVES, etc.) are at the top of their files, clearly labeled, and easy to modify
8. No fake data anywhere — every number comes from a real API or real computation
9. README explains the methodology and fork points clearly
10. Mobile layout is usable (stat grid wraps, trade panels stack)
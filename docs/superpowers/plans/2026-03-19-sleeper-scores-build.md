# sleeper-scores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `sleeper-scores` — an open-source fantasy football intelligence tool where every computed number is expandable to show the exact formula, inputs, and caveats that produced it.

**Architecture:** Zero-build ES modules (React 18 + htm from CDN). Three layers: `engine/` (pure computation returning explainable results), `api/` (Sleeper API + IndexedDB cache), `ui/` (React components with two-layer expand interaction). All state in root `useReducer`, config in `localStorage`.

**Tech Stack:** React 18, htm (JSX alternative, 700 bytes), ES modules via import maps, Sleeper API, Google News RSS via rss2json.com, IndexedDB, CSS custom properties.

**Working directory:** `/Users/christopherbailey/Desktop/north-county-beacon/`

**Spec:** `docs/superpowers/specs/2026-03-19-sleeper-scores-design.md`

---

## Dependency DAG (for parallel agent dispatch)

```
Wave 1 — zero dependencies, dispatch ALL in parallel:
  Task 1: scaffold (index.html + style.css + config.js)
  Task 2: engine/scoring.js
  Task 3: engine/dynasty.js
  Task 4: engine/sentiment.js + api/news.js

Wave 2 — depends on scoring.js existing:
  Task 5: engine/grades.js
  Task 6: engine/trends.js
  Task 7: api/sleeper.js

Wave 3 — depends on engine/* + api/*:
  Task 8: ui/primitives.js + ui/explain.js

Wave 4 — depends on Wave 3:
  Task 9: ui/card.js (the big one)

Wave 5 — depends on card.js:
  Task 10: ui/scout.js + ui/trade.js + ui/settings.js

Wave 6 — integration:
  Task 11: ui/app.js (wires everything together)

Wave 7 — cleanup + docs:
  Task 12: README.md + remove old files + verify
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `config.js`
- Create: `engine/` directory
- Create: `api/` directory
- Create: `ui/` directory

- [ ] **Step 1: Create directory structure**

```bash
cd /Users/christopherbailey/Desktop/north-county-beacon
mkdir -p engine api ui
```

- [ ] **Step 2: Write `config.js`**

```javascript
// config.js — User configuration persistence via localStorage

const STORAGE_KEY = 'sleeper-scores-config';

export const DEFAULT_CONFIG = {
  sleeperUsername: '',
  scoringFormat: 'ppr',
  leagues: [
    { id: '', name: 'League 1', isCommissioner: false },
    { id: '', name: 'League 2', isCommissioner: false },
    { id: '', name: 'League 3', isCommissioner: false },
    { id: '', name: 'League 4', isCommissioner: false },
  ],
};

export function loadConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_CONFIG, ...stored };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
```

- [ ] **Step 3: Write `style.css`**

Complete CSS file with design tokens, component classes, and responsive breakpoint:

```css
/* style.css — sleeper-scores design system */

/* ── Design Tokens ── */
:root {
  --navy: #1a2744;
  --gold: #c8a951;
  --green: #16a34a;
  --green-light: #22c55e;
  --green-bg: #f0fdf4;
  --green-border: #bbf7d0;
  --blue: #2563eb;
  --blue-bg: #eff6ff;
  --blue-border: #bfdbfe;
  --red: #dc2626;
  --red-bg: #fef2f2;
  --amber: #f59e0b;
  --purple: #8b5cf6;
  --bg: #f8f7f4;
  --card: #ffffff;
  --meta: #6b7280;
  --text: #1f2937;
  --text-light: #374151;
  --border: #e5e7eb;
  --border-light: #f3f4f6;
  --surface: #f9fafb;
  --font: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --mono: ui-monospace, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  --radius: 6px;
  --radius-sm: 4px;
}

/* ── Reset ── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--bg); font-family: var(--font); color: var(--text); }
#root { min-height: 100vh; }

/* ── Animations ── */
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
.fade-in { animation: fadeIn 0.25s ease-out; }
.loading-pulse { animation: pulse 1.5s ease-in-out infinite; }

/* ── Layout ── */
.app-container { max-width: 900px; margin: 0 auto; min-height: 100vh; }
.nav-bar { background: var(--navy); padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.nav-logo { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.nav-logo-mark { width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--gold); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; color: var(--navy); }
.nav-title { font-size: 15px; font-weight: 700; color: #fff; }
.nav-subtitle { font-size: 10px; color: #94a3b8; letter-spacing: 0.5px; }
.nav-tabs { display: flex; gap: 4px; }
.nav-tab { cursor: pointer; padding: 5px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; border: none; transition: all 0.15s; }
.nav-tab--active { background: var(--gold); color: var(--navy); font-weight: 700; }
.nav-tab--inactive { background: transparent; color: #cbd5e1; }
.nav-tab--inactive:hover { background: rgba(255,255,255,0.1); }

/* ── Cards ── */
.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 18px; margin-bottom: 8px; }
.card--compact { padding: 6px 10px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }

/* ── Stat Grid ── */
.stat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 10px; }
.stat-cell { text-align: center; padding: 6px 2px; background: var(--surface); border-radius: var(--radius-sm); border: 1px solid var(--border-light); cursor: pointer; transition: border-color 0.15s; }
.stat-cell:hover { border-color: var(--blue-border); }
.stat-cell__value { font-size: 14px; font-weight: 700; font-family: var(--mono); }
.stat-cell__label { font-size: 8px; color: var(--meta); font-weight: 600; letter-spacing: 0.3px; }

/* ── Explain Panel (depth layer) ── */
.explain-depth { background: var(--green-bg); border: 1px solid var(--green-border); border-radius: var(--radius); padding: 12px 14px; margin: 8px 0; border-left: 3px solid var(--green); animation: fadeIn 0.2s ease-out; }
.explain-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.explain-title { font-size: 10px; font-weight: 700; color: #065f46; letter-spacing: 0.5px; }
.explain-collapse { font-size: 10px; color: var(--meta); cursor: pointer; }
.explain-method { font-size: 11px; color: var(--text-light); margin-bottom: 8px; line-height: 1.5; }
.explain-components { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px; }
.explain-component { background: #fff; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 10px; }
.explain-component--total { border-left: 3px solid var(--green); }
.explain-formula { font-size: 10px; font-family: var(--mono); color: var(--text-light); background: #fff; padding: 6px 8px; border-radius: var(--radius-sm); margin-bottom: 6px; }
.explain-caveats { font-size: 9px; color: var(--meta); line-height: 1.5; border-top: 1px solid var(--green-border); padding-top: 6px; }

/* ── Raw Stats Bar ── */
.stats-bar { display: flex; gap: 4px; flex-wrap: wrap; padding: 6px 8px; background: var(--surface); border-radius: var(--radius-sm); border: 1px solid var(--border-light); font-size: 10px; margin-bottom: 10px; }
.stat-chip__label { color: var(--meta); font-size: 9px; }
.stat-chip__value { font-family: var(--mono); font-weight: 700; }
.stat-chip__value--good { color: var(--green); }
.stat-chip__value--bad { color: var(--red); }
.stat-chip__value--neutral { color: var(--navy); }
.stats-bar__sep { color: var(--border); }

/* ── Trend + Buzz Row ── */
.trend-buzz-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.panel { padding: 8px 10px; background: var(--surface); border-radius: var(--radius-sm); border: 1px solid var(--border-light); cursor: pointer; transition: border-color 0.15s; }
.panel:hover { border-color: var(--blue-border); }
.panel__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.panel__title { font-size: 10px; font-weight: 700; color: var(--navy); }

/* ── Scout Report ── */
.scout-report { padding: 8px 10px; background: var(--green-bg); border-radius: var(--radius-sm); font-size: 11px; color: #065f46; line-height: 1.6; border-left: 3px solid var(--blue); }

/* ── Sparkline ── */
.sparkline { display: flex; align-items: flex-end; gap: 1px; }
.sparkline__bar { border-radius: 1px; transition: height 0.3s; }

/* ── Sentiment Meter ── */
.sentiment-meter { height: 6px; background: var(--border-light); border-radius: 3px; overflow: hidden; position: relative; }
.sentiment-meter__center { position: absolute; left: 50%; top: 0; width: 1px; height: 100%; background: var(--border); }
.sentiment-meter__fill { height: 100%; border-radius: 3px; transition: width 0.4s; }

/* ── Grade Ring (SVG driven, sized via props) ── */
.grade-ring { text-align: center; position: relative; }
.grade-ring__value { font-weight: 800; font-family: var(--mono); line-height: 1; }
.grade-ring__label { font-size: 7px; color: var(--meta); font-weight: 600; }

/* ── Position Badge ── */
.pos-badge { display: inline-block; font-size: 10px; font-weight: 700; text-align: center; padding: 2px 0; border-radius: 3px; color: #fff; min-width: 28px; }
.pos-badge--QB { background: #ef4444; }
.pos-badge--RB { background: #3b82f6; }
.pos-badge--WR { background: #f59e0b; }
.pos-badge--TE { background: #8b5cf6; }
.pos-badge--K { background: #6b7280; }
.pos-badge--DEF { background: #059669; }

/* ── Signal Badge ── */
.signal-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--radius-sm); font-size: 10px; font-weight: 700; }

/* ── Search ── */
.search-input { width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--font); }
.search-input:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.search-results { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); max-height: 200px; overflow: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.search-result { padding: 6px 10px; font-size: 12px; cursor: pointer; border-bottom: 1px solid var(--border-light); display: flex; gap: 6px; align-items: center; }
.search-result:hover { background: var(--green-bg); }

/* ── Results Table ── */
.results-table { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.results-table__header { display: grid; grid-template-columns: 32px 1fr 40px 40px 44px 50px 50px; padding: 6px 10px; font-size: 9px; font-weight: 600; color: var(--meta); border-bottom: 1px solid var(--border); background: var(--surface); letter-spacing: 0.3px; }
.results-table__row { display: grid; grid-template-columns: 32px 1fr 40px 40px 44px 50px 50px; padding: 5px 10px; font-size: 12px; border-bottom: 1px solid var(--border-light); align-items: center; cursor: pointer; }
.results-table__row:hover { background: var(--green-bg); }

/* ── Trade Analyzer ── */
.trade-sides { display: flex; gap: 16px; flex-wrap: wrap; }
.trade-side { flex: 1; min-width: 220px; }
.trade-side__title { font-size: 11px; font-weight: 700; color: var(--navy); margin-bottom: 6px; }
.trade-swap { display: flex; align-items: center; font-size: 20px; color: var(--meta); padding: 0 4px; }
.verdict { margin-top: 14px; padding: 12px 14px; border-radius: var(--radius); text-align: center; }
.verdict__title { font-size: 18px; font-weight: 800; }
.verdict__detail { font-size: 11px; color: var(--text-light); margin-top: 4px; }
.verdict__stats { display: flex; justify-content: center; gap: 20px; margin-top: 8px; font-size: 10px; color: var(--meta); }

/* ── Settings ── */
.settings-panel { margin: 10px 16px; padding: 16px 20px; background: var(--card); border: 2px solid var(--green); border-radius: 8px; }
.settings-field { margin-bottom: 10px; }
.settings-label { font-size: 11px; font-weight: 600; color: var(--navy); display: block; margin-bottom: 3px; }
.settings-input { width: 100%; padding: 6px 10px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font); }
.settings-radio-group { display: flex; gap: 12px; margin-bottom: 10px; }
.btn { padding: 8px 20px; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--font); }
.btn--primary { background: var(--navy); color: #fff; }
.btn--secondary { background: var(--surface); color: var(--navy); border: 1px solid var(--border); }
.btn--green { background: var(--green); color: #fff; }

/* ── Footer ── */
.footer { border-top: 3px solid var(--gold); padding: 20px; text-align: center; background: var(--navy); margin-top: 20px; }
.footer__title { color: var(--gold); font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.footer__sub { color: #94a3b8; font-size: 12px; }
.footer__link { color: #64748b; font-size: 10px; margin-top: 6px; }

/* ── Utility ── */
.text-mono { font-family: var(--mono); }
.text-meta { color: var(--meta); }
.text-green { color: var(--green); }
.text-red { color: var(--red); }
.text-blue { color: var(--blue); }
.text-amber { color: var(--amber); }
.mt-2 { margin-top: 8px; }
.mb-2 { margin-bottom: 8px; }
.gap-2 { gap: 8px; }
.flex { display: flex; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-center { display: flex; align-items: center; }
.flex-wrap { flex-wrap: wrap; }
.hidden { display: none; }

/* ── Responsive ── */
@media (max-width: 640px) {
  .stat-grid { grid-template-columns: repeat(3, 1fr); }
  .trade-sides { flex-direction: column; }
  .trend-buzz-row { grid-template-columns: 1fr; }
  .explain-components { grid-template-columns: 1fr; }
  .results-table__header,
  .results-table__row { grid-template-columns: 28px 1fr 36px 36px 40px 44px; }
  .results-table__row > :last-child,
  .results-table__header > :last-child { display: none; }
}
```

- [ ] **Step 4: Write `index.html` shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>sleeper-scores — Fantasy Football Intelligence</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F3C8;</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.2.0",
      "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
      "htm": "https://esm.sh/htm@3.1.1"
    }
  }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="ui/app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Commit scaffold**

```bash
git add index.html style.css config.js
git commit -m "feat: project scaffold — index.html, style.css, config.js"
```

---

### Task 2: engine/scoring.js

**Files:**
- Create: `engine/scoring.js`

This is the foundation — other engine modules import `calcFantasyPts` from here.

- [ ] **Step 1: Write `engine/scoring.js`**

```javascript
// engine/scoring.js — Fantasy point calculation with explainable results

export const SCORING_RULES = {
  ppr:      { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 1,   fum_lost: -2, fgm: 3, xpm: 1 },
  half_ppr: { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 0.5, fum_lost: -2, fgm: 3, xpm: 1 },
  standard: { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 0,   fum_lost: -2, fgm: 3, xpm: 1 },
};

export const VARIANCE_MULTIPLIERS = {
  ceiling: { QB: 1.5, RB: 1.6, WR: 1.7, TE: 1.8, K: 1.3 },
  floor:   { QB: 0.5, RB: 0.3, WR: 0.3, TE: 0.2, K: 0.5 },
};

export function calcFantasyPts(stats, format = 'ppr') {
  if (!stats) return { value: 0, explain: { method: 'No stats available', inputs: {}, formula: '0', source: 'N/A', caveats: [] } };

  const rules = SCORING_RULES[format] || SCORING_RULES.ppr;
  const contributions = {};
  let total = 0;

  for (const [stat, multiplier] of Object.entries(rules)) {
    const raw = stats[stat] || 0;
    if (raw === 0 && multiplier >= 0) continue;
    const pts = raw * multiplier;
    contributions[stat] = { raw, multiplier, pts: Math.round(pts * 100) / 100 };
    total += pts;
  }

  const value = Math.round(total * 10) / 10;
  const formulaParts = Object.entries(contributions)
    .filter(([, c]) => c.pts !== 0)
    .map(([stat, c]) => `${c.raw} ${stat} x ${c.multiplier} = ${c.pts.toFixed(1)}`);

  return {
    value,
    explain: {
      method: `${format.toUpperCase()} fantasy point calculation`,
      inputs: contributions,
      formula: formulaParts.join(' + ') + ` = ${value}`,
      source: 'Sleeper API stats',
      caveats: format === 'ppr'
        ? ['Full PPR: each reception = 1 point']
        : format === 'half_ppr'
          ? ['Half PPR: each reception = 0.5 points']
          : ['Standard: receptions have no point value'],
    },
  };
}

export function calcCeilingFloor(projectedPts, position = 'WR') {
  const ceilMult = VARIANCE_MULTIPLIERS.ceiling[position] || 1.7;
  const floorMult = VARIANCE_MULTIPLIERS.floor[position] || 0.3;
  const ceiling = Math.round(projectedPts * ceilMult * 10) / 10;
  const floor = Math.round(projectedPts * floorMult * 10) / 10;

  return {
    ceiling: {
      value: ceiling,
      explain: {
        method: `Ceiling = projected pts x position variance multiplier`,
        inputs: { projected: projectedPts, multiplier: ceilMult, position },
        formula: `${projectedPts} x ${ceilMult} = ${ceiling}`,
        source: 'Sleeper projections x position-specific variance heuristic',
        caveats: ['Heuristic range, not a statistical confidence interval', `${position} ceiling multiplier: ${ceilMult}`],
      },
    },
    floor: {
      value: floor,
      explain: {
        method: `Floor = projected pts x position variance multiplier`,
        inputs: { projected: projectedPts, multiplier: floorMult, position },
        formula: `${projectedPts} x ${floorMult} = ${floor}`,
        source: 'Sleeper projections x position-specific variance heuristic',
        caveats: ['Heuristic range, not a statistical confidence interval', `${position} floor multiplier: ${floorMult}`],
      },
    },
  };
}
```

- [ ] **Step 2: Verify module loads**

```bash
cd /Users/christopherbailey/Desktop/north-county-beacon
node --input-type=module -e "import { calcFantasyPts, SCORING_RULES } from './engine/scoring.js'; const r = calcFantasyPts({ pass_yd: 300, pass_td: 3, pass_int: 1 }, 'ppr'); console.log('Value:', r.value, 'Formula:', r.explain.formula); console.assert(r.value === 22, 'Expected 22 got ' + r.value);"
```

Expected: `Value: 22 Formula: 300 pass_yd x 0.04 = 12.0 + 3 pass_td x 4 = 12.0 + 1 pass_int x -2 = -2.0 = 22`

- [ ] **Step 3: Commit**

```bash
git add engine/scoring.js && git commit -m "feat: engine/scoring.js — fantasy point calculation with explainable results"
```

---

### Task 3: engine/dynasty.js

**Files:**
- Create: `engine/dynasty.js`

- [ ] **Step 1: Write `engine/dynasty.js`**

```javascript
// engine/dynasty.js — Dynasty valuation with age curves and explainable results

export const AGE_CURVES = {
  QB: { peakStart: 28, peakEnd: 33, declineStart: 34, cliff: 40, avgCareer: 15, primeLabel: '28-33' },
  RB: { peakStart: 23, peakEnd: 26, declineStart: 27, cliff: 30, avgCareer: 6, primeLabel: '23-26', touchCliff: 2500, heavySeason: 370 },
  WR: { peakStart: 25, peakEnd: 30, declineStart: 31, cliff: 33, avgCareer: 10, primeLabel: '25-30' },
  TE: { peakStart: 26, peakEnd: 30, declineStart: 31, cliff: 34, avgCareer: 9, primeLabel: '26-30' },
  K:  { peakStart: 26, peakEnd: 36, declineStart: 37, cliff: 42, avgCareer: 12, primeLabel: '26-36' },
  DEF:{ peakStart: 25, peakEnd: 30, declineStart: 31, cliff: 34, avgCareer: 7, primeLabel: '25-30' },
};

export const DYNASTY_WEIGHTS = {
  production: 2.0,
  youthPerYear: 3.0,
  longevityPerYear: 1.0,
  positionPremium: { QB: 12, WR: 4, TE: 2, RB: 0, K: 0, DEF: 0 },
};

export function getTrajectory(age, position) {
  const curve = AGE_CURVES[position] || AGE_CURVES.WR;
  if (age < curve.peakStart) {
    return { label: 'ASCENDING', color: '#16a34a', yearsToCliff: curve.cliff - age, yearsToPeak: curve.peakStart - age, phase: 0.25 };
  }
  if (age <= curve.peakEnd) {
    return { label: 'PRIME', color: '#2563eb', yearsToCliff: curve.cliff - age, yearsToPeak: 0, phase: 0.5 };
  }
  if (age <= curve.declineStart + 1) {
    return { label: 'DECLINING', color: '#f59e0b', yearsToCliff: curve.cliff - age, yearsToPeak: 0, phase: 0.75 };
  }
  return { label: 'LATE CAREER', color: '#dc2626', yearsToCliff: Math.max(0, curve.cliff - age), yearsToPeak: 0, phase: 0.95 };
}

export function estimateCareerTouches(yearsExp, avgPerSeason = 200) {
  const touches = (yearsExp || 0) * avgPerSeason;
  return {
    value: touches,
    explain: {
      method: 'Career touches estimated from years of experience',
      inputs: { yearsExp, avgPerSeason },
      formula: `${yearsExp} years x ${avgPerSeason} avg touches/season = ${touches}`,
      source: 'Sleeper years_exp field',
      caveats: [
        'Estimated from years of experience x 200 avg touches/season',
        'Actual career touch data not available from Sleeper API',
        'Does not account for injury seasons or backup years',
      ],
    },
  };
}

export function calcDynastyValue(projected, position, age, yearsExp, injuryStatus) {
  const curve = AGE_CURVES[position] || AGE_CURVES.WR;
  const traj = getTrajectory(age, position);
  const yearsLeft = Math.max(0, curve.cliff - age);
  const peakYrsLeft = Math.max(0, curve.peakEnd - age);
  const posPremium = DYNASTY_WEIGHTS.positionPremium[position] || 0;

  const productionScore = projected * DYNASTY_WEIGHTS.production;
  const youthScore = peakYrsLeft * DYNASTY_WEIGHTS.youthPerYear;
  const longevityScore = yearsLeft * DYNASTY_WEIGHTS.longevityPerYear;

  let raw = productionScore + youthScore + longevityScore + posPremium;
  const penalties = [];

  // RB workload penalties
  if (position === 'RB') {
    const estTouches = estimateCareerTouches(yearsExp);
    if (estTouches.value > 2500) { raw *= 0.65; penalties.push(`Past touch cliff (~${estTouches.value} est. touches > 2500): x0.65`); }
    else if (estTouches.value > 2000) { raw *= 0.80; penalties.push(`Approaching touch cliff (~${estTouches.value} est. touches): x0.80`); }
    else if (estTouches.value > 1500) { raw *= 0.90; penalties.push(`Wear showing (~${estTouches.value} est. touches): x0.90`); }
    if (age >= 28) { raw *= 0.70; penalties.push(`Age ${age} >= 28 (RB steep decline): x0.70`); }
    else if (age >= 27) { raw *= 0.85; penalties.push(`Age ${age} >= 27 (RB decline zone): x0.85`); }
  }

  // Injury penalty
  if (injuryStatus) {
    if (injuryStatus === 'Out' || injuryStatus === 'IR') { raw *= 0.50; penalties.push(`Injury: ${injuryStatus}: x0.50`); }
    else if (injuryStatus === 'Doubtful') { raw *= 0.70; penalties.push(`Injury: Doubtful: x0.70`); }
    else if (injuryStatus === 'Questionable') { raw *= 0.90; penalties.push(`Injury: Questionable: x0.90`); }
  }

  const value = Math.min(99, Math.max(1, Math.round(raw)));

  const formulaParts = [
    `production: ${projected.toFixed(1)} x ${DYNASTY_WEIGHTS.production} = ${productionScore.toFixed(1)}`,
    `youth: ${peakYrsLeft}yr x ${DYNASTY_WEIGHTS.youthPerYear} = ${youthScore.toFixed(1)}`,
    `longevity: ${yearsLeft}yr x ${DYNASTY_WEIGHTS.longevityPerYear} = ${longevityScore.toFixed(1)}`,
    `position: +${posPremium}`,
  ];

  return {
    value,
    trajectory: traj,
    explain: {
      method: 'Composite dynasty score: production + youth + longevity + position premium - penalties',
      inputs: { projected, position, age, yearsExp, injuryStatus, peakYrsLeft, yearsLeft },
      formula: formulaParts.join(' + ') + ` = ${Math.round(productionScore + youthScore + longevityScore + posPremium)}` + (penalties.length ? ` then penalties: ${penalties.join(', ')} = ${value}` : ` = ${value}`),
      weights: DYNASTY_WEIGHTS,
      benchmarks: curve,
      source: 'Sleeper projections + player metadata',
      caveats: [
        'Age curves based on EPA 2014-2024 positional study — individual players may deviate',
        'Injury multiplier uses current injury status, not injury history',
        ...(position === 'RB' ? ['Career touches estimated, not actual — see touch estimate caveat'] : []),
      ],
    },
  };
}
```

- [ ] **Step 2: Verify**

```bash
node --input-type=module -e "import { calcDynastyValue, getTrajectory } from './engine/dynasty.js'; const r = calcDynastyValue(19.8, 'WR', 25, 4, null); console.log('Dynasty:', r.value, 'Trajectory:', r.trajectory.label); console.assert(r.value > 50, 'Expected > 50'); console.assert(r.trajectory.label === 'PRIME', 'Expected PRIME');"
```

- [ ] **Step 3: Commit**

```bash
git add engine/dynasty.js && git commit -m "feat: engine/dynasty.js — dynasty valuation with age curves and explainable results"
```

---

### Task 4: engine/sentiment.js + api/news.js

**Files:**
- Create: `engine/sentiment.js`
- Create: `api/news.js`

- [ ] **Step 1: Write `api/news.js`**

```javascript
// api/news.js — Google News RSS fetch via rss2json.com

export async function fetchHeadlines(query) {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok' || !data.items) return [];

    return data.items.map(item => {
      const title = (item.title || '').replace(/\s+-\s+[^-]+$/, '');
      const sourceMatch = (item.title || '').match(/\s+-\s+(.+)$/);
      const source = sourceMatch ? sourceMatch[1] : 'News';
      return { title, source, date: new Date(item.pubDate || 0), link: item.link };
    });
  } catch (e) {
    console.warn('fetchHeadlines failed:', e);
    return [];
  }
}
```

- [ ] **Step 2: Write `engine/sentiment.js`**

```javascript
// engine/sentiment.js — News keyword buzz scoring with explainable results
// Label: "News Buzz (keyword matching)" — NOT "sentiment engine"

import { fetchHeadlines } from '../api/news.js';

export const POSITIVE_KEYWORDS = [
  'breakout', 'elite', 'dominant', 'career high', 'record', 'star',
  'surge', 'boom', 'top', 'best', 'mvp', 'pro bowl', 'extension',
  'deal', 'clutch', 'explosive', 'unstoppable', 'rising',
];

export const NEGATIVE_KEYWORDS = [
  'injury', 'injured', 'bust', 'decline', 'drop', 'worst', 'benched',
  'cut', 'suspend', 'arrested', 'questionable', 'doubt', 'concern',
  'struggle', 'fumble', 'interception', 'hamstring', 'acl',
  'concussion', 'limited', 'downgrade', 'out for',
];

export async function fetchPlayerSentiment(playerName) {
  const headlines = await fetchHeadlines(playerName + ' NFL');

  if (headlines.length === 0) {
    return {
      value: 0,
      headlines: [],
      volume: 0,
      narrative: 'News feed unavailable',
      explain: {
        method: 'No headlines retrieved',
        inputs: { query: playerName + ' NFL', articlesScanned: 0 },
        formula: 'N/A',
        source: 'Google News RSS via rss2json.com',
        caveats: ['News feed unavailable — rss2json.com may be down or rate-limited'],
      },
    };
  }

  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const recentCount = headlines.filter(h => h.date.getTime() > weekAgo).length;

  let posCount = 0, negCount = 0;
  const posMatches = [], negMatches = [];

  headlines.forEach(h => {
    const t = h.title.toLowerCase();
    POSITIVE_KEYWORDS.forEach(kw => {
      if (t.includes(kw)) { posCount++; posMatches.push(kw); }
    });
    NEGATIVE_KEYWORDS.forEach(kw => {
      if (t.includes(kw)) { negCount++; negMatches.push(kw); }
    });
  });

  const total = posCount + negCount || 1;
  const score = Math.max(-100, Math.min(100, Math.round(((posCount - negCount) / total) * 100)));

  let narrative;
  if (posCount > negCount * 2) narrative = 'Strong positive buzz. Media narrative is overwhelmingly favorable.';
  else if (posCount > negCount) narrative = 'Positive sentiment. More upside mentions than concerns.';
  else if (negCount > posCount * 2) narrative = 'Significant negative buzz. Injury or performance concerns dominate.';
  else if (negCount > posCount) narrative = 'Negative sentiment. Concerns outweigh positive coverage.';
  else narrative = 'Neutral coverage. No strong directional narrative.';

  // Deduplicate match lists for display
  const posUnique = [...new Set(posMatches)];
  const negUnique = [...new Set(negMatches)];

  return {
    value: score,
    headlines: headlines.slice(0, 8),
    volume: recentCount,
    narrative,
    explain: {
      method: 'Keyword frequency scoring on Google News headlines',
      inputs: {
        query: playerName + ' NFL',
        articlesScanned: headlines.length,
        positiveMatches: posCount,
        negativeMatches: negCount,
        positiveKeywords: posUnique,
        negativeKeywords: negUnique,
      },
      formula: `(${posCount} positive - ${negCount} negative) / ${total} total x 100 = ${score}`,
      source: 'Google News RSS via rss2json.com',
      caveats: [
        'Keyword counting only — no NLP, no negation detection ("not injured" scores as negative)',
        'Headline text only — does not read article bodies',
        `Limited to ${headlines.length} articles from Google News RSS`,
        'No source authority weighting — ESPN and a fan blog count equally',
      ],
    },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add api/news.js engine/sentiment.js && git commit -m "feat: engine/sentiment.js + api/news.js — keyword buzz scoring with explainable results"
```

---

### Task 5: engine/grades.js

**Files:**
- Create: `engine/grades.js`

**Depends on:** `engine/scoring.js` (conceptually, but no import — grades uses its own benchmarks)

- [ ] **Step 1: Write `engine/grades.js`**

```javascript
// engine/grades.js — Composite stat-based grading with explainable results
// Label: "Stat-Based Score" — NOT "PFF-style grade"

export const BENCHMARKS = {
  QB: { pass_yd: [140, 195, 245, 290, 340], pass_td: [0, 1, 1.8, 2.5, 3.5], pass_int: [2, 1.5, 1, 0.5, 0], rush_yd: [0, 8, 20, 35, 55], cmp_pct: [56, 61, 65, 69, 73] },
  RB: { rush_yd: [25, 45, 65, 85, 110], rush_td: [0, 0.25, 0.55, 0.9, 1.3], rec: [0, 1.5, 3, 4.5, 6], rec_yd: [0, 12, 25, 40, 60], fum_lost: [1, 0.6, 0.3, 0.1, 0] },
  WR: { rec: [1.5, 3, 5, 6.5, 8.5], rec_yd: [25, 50, 72, 95, 120], rec_td: [0, 0.25, 0.5, 0.8, 1.1], rec_tgt: [3, 5, 7.5, 10, 13] },
  TE: { rec: [1, 2, 3.5, 5, 6.5], rec_yd: [10, 28, 48, 68, 88], rec_td: [0, 0.15, 0.4, 0.65, 1], rec_tgt: [1.5, 3, 5, 7, 9.5] },
};

export const WEIGHTS = {
  QB: { pass_yd: 0.28, pass_td: 0.25, pass_int: 0.18, rush_yd: 0.12, cmp_pct: 0.17 },
  RB: { rush_yd: 0.28, rush_td: 0.18, rec: 0.15, rec_yd: 0.12, fum_lost: 0.12, efficiency: 0.15 },
  WR: { rec: 0.20, rec_yd: 0.28, rec_td: 0.22, rec_tgt: 0.15, efficiency: 0.15 },
  TE: { rec: 0.25, rec_yd: 0.30, rec_td: 0.25, rec_tgt: 0.20 },
};

const GRADE_LABELS = [
  [85, 'ELITE'], [70, 'ABOVE AVG'], [55, 'AVERAGE'], [40, 'BELOW AVG'], [0, 'POOR'],
];

const GRADE_COLORS = {
  ELITE: '#16a34a', 'ABOVE AVG': '#22c55e', AVERAGE: '#f59e0b', 'BELOW AVG': '#f97316', POOR: '#dc2626',
};

export function gradeLabel(grade) {
  for (const [min, label] of GRADE_LABELS) {
    if (grade >= min) return label;
  }
  return 'POOR';
}

export function gradeColor(grade) {
  return GRADE_COLORS[gradeLabel(grade)] || '#6b7280';
}

export function percentileScore(val, benchmarks) {
  if (!benchmarks || benchmarks.length < 5) return 50;
  if (val <= benchmarks[0]) return 20;
  if (val >= benchmarks[4]) return 95;
  for (let i = 0; i < 4; i++) {
    if (val <= benchmarks[i + 1]) {
      const range = benchmarks[i + 1] - benchmarks[i];
      const pct = range > 0 ? (val - benchmarks[i]) / range : 0;
      return Math.round(20 + (i * 19) + pct * 19);
    }
  }
  return 50;
}

export function computeCompositeGrade(stats, position) {
  if (!stats || !position) {
    return { value: 50, label: 'N/A', components: {}, explain: { method: 'No stats available', inputs: {}, formula: 'N/A', source: 'N/A', caveats: [] } };
  }

  const b = BENCHMARKS[position];
  if (!b) {
    return { value: 50, label: 'N/A', components: {}, explain: { method: `No benchmarks defined for ${position}`, inputs: {}, formula: 'N/A', source: 'N/A', caveats: [] } };
  }

  const w = WEIGHTS[position];
  const components = {};
  let weightedSum = 0, totalWeight = 0;

  // Standard benchmark-based components
  for (const [stat, weight] of Object.entries(w)) {
    if (stat === 'efficiency') continue; // handled separately below
    const raw = stats[stat] || 0;
    // Special: completion percentage is derived
    let actualRaw = raw;
    if (stat === 'cmp_pct') {
      actualRaw = (stats.pass_att || 0) > 0 ? ((stats.pass_cmp || 0) / stats.pass_att) * 100 : 60;
    }
    const pct = percentileScore(actualRaw, b[stat]);
    components[stat] = { raw: actualRaw, percentile: pct, weight, benchmarks: b[stat] };
    weightedSum += pct * weight;
    totalWeight += weight;
  }

  // Efficiency component (derived stat, no benchmark array)
  if (w.efficiency) {
    let effRaw, effScore;
    if (position === 'RB') {
      effRaw = (stats.rush_att || 0) > 0 ? (stats.rush_yd || 0) / stats.rush_att : 0;
      effScore = Math.min(99, Math.max(20, Math.round(effRaw * 15)));
      components.efficiency = { raw: Math.round(effRaw * 10) / 10, percentile: effScore, weight: w.efficiency, benchmarks: 'YPC x 15 (capped 20-99)' };
    } else if (position === 'WR') {
      effRaw = (stats.rec || 0) > 0 ? (stats.rec_yd || 0) / stats.rec : 0;
      effScore = Math.min(99, Math.max(20, Math.round(effRaw * 5)));
      components.efficiency = { raw: Math.round(effRaw * 10) / 10, percentile: effScore, weight: w.efficiency, benchmarks: 'Y/R x 5 (capped 20-99)' };
    }
    if (components.efficiency) {
      weightedSum += components.efficiency.percentile * w.efficiency;
      totalWeight += w.efficiency;
    }
  }

  const overall = totalWeight > 0 ? Math.min(99, Math.max(1, Math.round(weightedSum / totalWeight))) : 50;
  const label = gradeLabel(overall);

  // Build formula string
  const formulaParts = Object.entries(components).map(([stat, c]) =>
    `${c.percentile} x ${c.weight}`
  );
  const formulaStr = `(${formulaParts.join(' + ')}) / ${totalWeight.toFixed(2)} = ${overall}`;

  return {
    value: overall,
    label,
    components,
    explain: {
      method: 'Weighted percentile scoring against position-specific per-game benchmarks',
      inputs: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, v.raw])),
      formula: formulaStr,
      benchmarks: b,
      weights: w,
      source: '2025 per-game stats via Sleeper API',
      caveats: [
        'Stat-based only — does not capture play-by-play context like PFF grades',
        'Per-game stats penalize high-production players who missed games',
        'Benchmarks calibrated to 2025 season — may need re-calibration for future seasons',
      ],
    },
  };
}
```

- [ ] **Step 2: Verify**

```bash
node --input-type=module -e "import { computeCompositeGrade } from './engine/grades.js'; const r = computeCompositeGrade({ rec: 7, rec_yd: 95, rec_td: 0.9, rec_tgt: 10 }, 'WR'); console.log('Grade:', r.value, r.label); console.log('Formula:', r.explain.formula); console.assert(r.value > 70, 'Expected > 70 for elite WR stats');"
```

- [ ] **Step 3: Commit**

```bash
git add engine/grades.js && git commit -m "feat: engine/grades.js — composite stat-based grading with explainable results"
```

---

### Task 6: engine/trends.js

**Files:**
- Create: `engine/trends.js`

**Depends on:** `engine/scoring.js` (imports `calcFantasyPts`)

- [ ] **Step 1: Write `engine/trends.js`**

```javascript
// engine/trends.js — Multi-week pattern analysis with explainable results

import { calcFantasyPts } from './scoring.js';

export const TREND_THRESHOLDS = {
  slopeUp: 0.08,
  slopeDown: -0.08,
  boomBustCV: 0.5,
  consistentCV: 0.2,
  consistentMinMean: 8,
  consecutiveStreak: 3,
  buyLowDelta: -0.15,
  sellHighDelta: 0.20,
};

export function analyzePatterns(weeklyData, position, scoring = 'ppr') {
  if (!weeklyData || weeklyData.length < 2) {
    return {
      value: 'INSUFFICIENT DATA', trendDir: 0, signal: 'HOLD', confidence: 30,
      weeklyPts: [], sparkline: [], mean: 0, recentMean: 0,
      explain: { method: 'Insufficient weekly data', inputs: { weeks: weeklyData?.length || 0 }, formula: 'N/A', source: 'Sleeper weekly stats', caveats: ['Need 2+ weeks of data for trend analysis'] },
    };
  }

  const pts = weeklyData.map(w => w.stats ? calcFantasyPts(w.stats, scoring).value : 0);
  const n = pts.length;
  const mean = pts.reduce((a, b) => a + b, 0) / n;
  const variance = pts.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;

  // Linear regression slope
  const xMean = (n - 1) / 2;
  let num = 0, den = 0;
  pts.forEach((y, x) => { num += (x - xMean) * (y - mean); den += (x - xMean) ** 2; });
  const slope = den > 0 ? num / den : 0;
  const slopeNorm = mean > 0 ? slope / mean : 0;

  // Consecutive streak detection
  let consUp = 0, consDown = 0, maxConsUp = 0, maxConsDown = 0;
  for (let i = 1; i < n; i++) {
    if (pts[i] > pts[i - 1] + 1) { consUp++; consDown = 0; }
    else if (pts[i] < pts[i - 1] - 1) { consDown++; consUp = 0; }
    else { consUp = 0; consDown = 0; }
    maxConsUp = Math.max(maxConsUp, consUp);
    maxConsDown = Math.max(maxConsDown, consDown);
  }

  // Recent vs season
  const recent = pts.slice(-3);
  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const recentVsSeason = mean > 0 ? (recentMean - mean) / mean : 0;

  // Classify trend
  const T = TREND_THRESHOLDS;
  let trend, trendDir;
  if (slopeNorm > T.slopeUp || maxConsUp >= T.consecutiveStreak) { trend = 'TRENDING UP'; trendDir = 1; }
  else if (slopeNorm < T.slopeDown || maxConsDown >= T.consecutiveStreak) { trend = 'TRENDING DOWN'; trendDir = -1; }
  else if (cv > T.boomBustCV) { trend = 'BOOM/BUST'; trendDir = 0; }
  else if (cv < T.consistentCV && mean > T.consistentMinMean) { trend = 'CONSISTENT'; trendDir = 0; }
  else { trend = 'STABLE'; trendDir = 0; }

  // Buy/sell/hold signal
  let signal, confidence;
  if (trendDir === -1 && recentVsSeason < T.buyLowDelta) { signal = 'BUY LOW'; confidence = Math.min(95, Math.round(Math.abs(recentVsSeason) * 200)); }
  else if (trendDir === 1 && recentVsSeason > T.sellHighDelta) { signal = 'SELL HIGH'; confidence = Math.min(95, Math.round(recentVsSeason * 200)); }
  else if (trendDir === 1) { signal = 'HOLD/BUY'; confidence = Math.min(80, 50 + Math.round(slopeNorm * 300)); }
  else if (trendDir === -1) { signal = 'HOLD/SELL'; confidence = Math.min(80, 50 + Math.round(Math.abs(slopeNorm) * 300)); }
  else { signal = 'HOLD'; confidence = 40 + Math.round((1 - cv) * 30); }
  confidence = Math.max(10, Math.min(99, confidence));

  const maxPt = Math.max(...pts, 1);
  const sparkline = pts.map(p => Math.round((p / maxPt) * 100));

  const rd = (v) => Math.round(v * 100) / 100;

  return {
    value: trend,
    trendDir,
    signal,
    confidence,
    weeklyPts: pts,
    sparkline,
    mean: rd(mean),
    recentMean: rd(recentMean),
    stdDev: rd(stdDev),
    cv: rd(cv),
    slope: rd(slope),
    explain: {
      method: 'Linear regression + coefficient of variation on multi-week fantasy point totals',
      inputs: {
        weeks: n,
        weeklyPts: pts.map(p => rd(p)),
        mean: rd(mean),
        stdDev: rd(stdDev),
        cv: rd(cv),
        slope: rd(slope),
        normalizedSlope: rd(slopeNorm),
        maxConsecutiveUp: maxConsUp,
        maxConsecutiveDown: maxConsDown,
        recentMean: rd(recentMean),
        recentVsSeason: rd(recentVsSeason),
      },
      formula: `slope=${rd(slope)} (norm=${rd(slopeNorm)}), CV=${rd(cv)}, recent/season=${rd(recentVsSeason)} => ${trend} / ${signal} (${confidence}%)`,
      thresholds: T,
      source: 'Sleeper weekly stats',
      caveats: [
        `Based on ${n} weeks of data — small sample size`,
        'Bye weeks and injuries show as 0-point weeks, which distort trends',
        `Thresholds are configurable: slope>${T.slopeUp} = up, CV>${T.boomBustCV} = boom/bust`,
      ],
    },
  };
}
```

- [ ] **Step 2: Verify**

```bash
node --input-type=module -e "
import { analyzePatterns } from './engine/trends.js';
const weeks = [{stats:{rec:5,rec_yd:60,rec_td:0}},{stats:{rec:6,rec_yd:70,rec_td:1}},{stats:{rec:7,rec_yd:80,rec_td:1}},{stats:{rec:8,rec_yd:95,rec_td:1}}];
const r = analyzePatterns(weeks, 'WR', 'ppr');
console.log('Trend:', r.value, 'Signal:', r.signal, r.confidence + '%');
console.log('Weekly:', r.weeklyPts);
console.assert(r.trendDir >= 0, 'Expected upward or stable trend');
"
```

- [ ] **Step 3: Commit**

```bash
git add engine/trends.js && git commit -m "feat: engine/trends.js — multi-week pattern analysis with explainable results"
```

---

### Task 7: api/sleeper.js

**Files:**
- Create: `api/sleeper.js`

- [ ] **Step 1: Write `api/sleeper.js`**

```javascript
// api/sleeper.js — Sleeper API wrapper with IndexedDB caching

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const NFL_SEASON = '2025';
const DB_NAME = 'sleeper-scores';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

// ── IndexedDB helpers ──

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCached(key, ttlMs) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (entry && (Date.now() - entry.timestamp) < ttlMs) resolve(entry.data);
        else resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function setCache(key, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ data, timestamp: Date.now() }, key);
  } catch { /* cache write failure is non-fatal */ }
}

// ── In-memory cache for stats (session-scoped) ──

const memCache = new Map();

function memGet(key, ttlMs) {
  const entry = memCache.get(key);
  if (entry && (Date.now() - entry.ts) < ttlMs) return entry.data;
  return null;
}

function memSet(key, data) {
  memCache.set(key, { data, ts: Date.now() });
}

// ── API fetch helper ──

async function sleeperGet(path) {
  const res = await fetch(`${SLEEPER_BASE}${path}`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Sleeper API ${res.status}: ${path}`);
  return res.json();
}

// ── Public API ──

const HOUR = 3600000;
const DAY = 86400000;

export async function getPlayers() {
  // Check IndexedDB first (24hr TTL)
  const cached = await getCached('players', DAY);
  if (cached) return cached;

  const data = await sleeperGet('/players/nfl');
  await setCache('players', data);
  return data;
}

export async function getSeasonStats(week) {
  const key = `stats_${NFL_SEASON}_${week}`;
  const cached = memGet(key, HOUR);
  if (cached) return cached;

  try {
    const data = await sleeperGet(`/stats/nfl/regular/${NFL_SEASON}/${week}`);
    memSet(key, data || {});
    return data || {};
  } catch { return {}; }
}

export async function getProjections(week) {
  const key = `proj_${NFL_SEASON}_${week}`;
  const cached = memGet(key, HOUR);
  if (cached) return cached;

  try {
    const data = await sleeperGet(`/projections/nfl/regular/${NFL_SEASON}/${week}`);
    memSet(key, data || {});
    return data || {};
  } catch { return {}; }
}

export async function getWeeklyStats(week) {
  const key = `weekly_${NFL_SEASON}_${week}`;
  const cached = memGet(key, HOUR);
  if (cached) return cached;

  try {
    const data = await sleeperGet(`/stats/nfl/regular/${NFL_SEASON}/${week}`);
    memSet(key, data || {});
    return data || {};
  } catch { return {}; }
}

export async function getNFLState() {
  const key = 'nfl_state';
  const cached = memGet(key, HOUR);
  if (cached) return cached;

  try {
    const data = await sleeperGet('/state/nfl');
    memSet(key, data);
    return data;
  } catch { return { week: 1, season: NFL_SEASON }; }
}

export async function getUser(username) {
  return sleeperGet(`/user/${username}`);
}

export async function getUserLeagues(userId) {
  return sleeperGet(`/user/${userId}/leagues/nfl/${NFL_SEASON}`);
}

export async function getLeague(leagueId) {
  return sleeperGet(`/league/${leagueId}`);
}

export async function getRosters(leagueId) {
  return sleeperGet(`/league/${leagueId}/rosters`);
}

export async function getLeagueUsers(leagueId) {
  return sleeperGet(`/league/${leagueId}/users`);
}

export async function fetchMultiWeekStats(playerId, currentWeek) {
  const fetchWeeks = Math.min(currentWeek, 8);
  const promises = [];
  for (let w = Math.max(1, currentWeek - fetchWeeks + 1); w <= currentWeek; w++) {
    promises.push(
      getWeeklyStats(w).then(data => ({ week: w, stats: data[playerId] || null }))
    );
  }
  const results = await Promise.allSettled(promises);
  const weeks = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)
    .sort((a, b) => a.week - b.week);
  return weeks;
}

export { NFL_SEASON };
```

- [ ] **Step 2: Commit**

```bash
git add api/sleeper.js && git commit -m "feat: api/sleeper.js — Sleeper API wrapper with IndexedDB + memory cache"
```

---

### Task 8: ui/primitives.js + ui/explain.js

**Files:**
- Create: `ui/primitives.js`
- Create: `ui/explain.js`

- [ ] **Step 1: Write `ui/primitives.js`**

```javascript
// ui/primitives.js — Pure presentational components. No state, no data fetching.

import { html } from './htm.js';
import { gradeColor, gradeLabel } from '../engine/grades.js';

// ── Grade Ring (SVG circular progress) ──
export function GradeRing({ grade, size = 52, label }) {
  const color = gradeColor(grade);
  const r = (size - 8) / 2;
  const circumference = Math.PI * 2 * r;
  const offset = circumference * (1 - grade / 100);
  return html`
    <div class="grade-ring" style=${{ width: size, height: size, position: 'relative' }}>
      <svg width=${size} height=${size} style="transform: rotate(-90deg)">
        <circle cx=${size/2} cy=${size/2} r=${r} fill="none" stroke="#e5e7eb" stroke-width="4" />
        <circle cx=${size/2} cy=${size/2} r=${r} fill="none" stroke=${color} stroke-width="4"
          stroke-dasharray=${circumference} stroke-dashoffset=${offset} stroke-linecap="round"
          style="transition: stroke-dashoffset 0.5s" />
      </svg>
      <div style=${{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <div class="grade-ring__value" style=${{ fontSize: size > 40 ? 16 : 12, color }}>${grade}</div>
        ${label && html`<div class="grade-ring__label">${label}</div>`}
      </div>
    </div>
  `;
}

// ── Sparkline (CSS bar chart) ──
export function Sparkline({ data, height = 28, color = '#16a34a' }) {
  if (!data || data.length < 2) return html`<span class="text-meta" style="font-size:10px">—</span>`;
  const max = Math.max(...data, 1);
  const barW = Math.max(3, Math.min(8, Math.floor(80 / data.length)));
  return html`
    <div class="sparkline" style=${{ height }}>
      ${data.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        const isLast = i === data.length - 1;
        const trend = i > 0 ? v - data[i - 1] : 0;
        const barColor = isLast ? color : trend > 2 ? '#22c55e' : trend < -2 ? '#ef4444' : '#94a3b8';
        return html`<div class="sparkline__bar" style=${{ width: barW, height: h, background: barColor }} />`;
      })}
    </div>
  `;
}

// ── Sentiment Meter ──
export function SentimentMeter({ score, width = 80 }) {
  const norm = (score + 100) / 200;
  const color = score > 30 ? '#16a34a' : score > 0 ? '#22c55e' : score > -30 ? '#f59e0b' : '#dc2626';
  return html`
    <div class="sentiment-meter" style=${{ width }}>
      <div class="sentiment-meter__center" />
      <div class="sentiment-meter__fill" style=${{ width: `${norm * 100}%`, background: color }} />
    </div>
  `;
}

// ── Stat Chip ──
export function StatChip({ label, value, variant = 'neutral' }) {
  const cls = `stat-chip__value stat-chip__value--${variant}`;
  return html`
    <span>
      <span class="stat-chip__label">${label}</span>
      ${' '}<strong class=${cls}>${value}</strong>
    </span>
  `;
}

// ── Signal Badge ──
export function SignalBadge({ signal, confidence }) {
  const colors = { 'BUY LOW': '#16a34a', 'SELL HIGH': '#dc2626', 'HOLD/BUY': '#22c55e', 'HOLD/SELL': '#f97316', 'HOLD': '#6b7280' };
  const bgs = { 'BUY LOW': '#f0fdf4', 'SELL HIGH': '#fef2f2', 'HOLD/BUY': '#f0fdf4', 'HOLD/SELL': '#fff7ed', 'HOLD': '#f9fafb' };
  return html`
    <span class="signal-badge" style=${{ color: colors[signal] || '#6b7280', background: bgs[signal] || '#f9fafb' }}>
      ${signal} <span style="font-weight:400;font-size:9px">${confidence}%</span>
    </span>
  `;
}

// ── Trend Arrow ──
export function TrendArrow({ dir, size = 14 }) {
  if (dir > 0) return html`<span style=${{ color: '#16a34a', fontSize: size, fontWeight: 800 }}>↑</span>`;
  if (dir < 0) return html`<span style=${{ color: '#dc2626', fontSize: size, fontWeight: 800 }}>↓</span>`;
  return html`<span style=${{ color: '#6b7280', fontSize: size }}>→</span>`;
}

// ── Position Badge ──
export function PositionBadge({ position }) {
  return html`<span class=${`pos-badge pos-badge--${position}`}>${position}</span>`;
}

// ── Position Colors (for inline use) ──
export const POS_COLORS = { QB: '#ef4444', RB: '#3b82f6', WR: '#f59e0b', TE: '#8b5cf6', K: '#6b7280', DEF: '#059669' };

// ── NFL Teams lookup ──
export const NFL_TEAMS = {
  ARI: 'arizona cardinals', ATL: 'atlanta falcons', BAL: 'baltimore ravens', BUF: 'buffalo bills',
  CAR: 'carolina panthers', CHI: 'chicago bears', CIN: 'cincinnati bengals', CLE: 'cleveland browns',
  DAL: 'dallas cowboys', DEN: 'denver broncos', DET: 'detroit lions', GB: 'green bay packers',
  HOU: 'houston texans', IND: 'indianapolis colts', JAX: 'jacksonville jaguars', KC: 'kansas city chiefs',
  LAC: 'los angeles chargers', LAR: 'los angeles rams', LV: 'las vegas raiders', MIA: 'miami dolphins',
  MIN: 'minnesota vikings', NE: 'new england patriots', NO: 'new orleans saints', NYG: 'new york giants',
  NYJ: 'new york jets', PHI: 'philadelphia eagles', PIT: 'pittsburgh steelers', SEA: 'seattle seahawks',
  SF: 'san francisco 49ers niners', TB: 'tampa bay buccaneers bucs', TEN: 'tennessee titans', WAS: 'washington commanders',
};
```

- [ ] **Step 2: Create htm helper module**

A tiny helper that other UI modules import to get the `html` tagged template:

```javascript
// ui/htm.js — htm + React binding (shared by all UI modules)
import React from 'react';
import htm from 'htm';

export const html = htm.bind(React.createElement);
export { React };
```

- [ ] **Step 3: Write `ui/explain.js`**

```javascript
// ui/explain.js — ExplainPanel: the "show your work" controlled component

import { React, html } from './htm.js';

export function ExplainPanel({ id, isOpen, onToggle, result, children }) {
  if (!result) return children;

  return html`
    <div class="explainable" onClick=${(e) => { e.stopPropagation(); onToggle(id); }}
         style=${{ cursor: 'pointer' }}>
      ${children}
      ${isOpen && result.explain && html`
        <div class="explain-depth" onClick=${(e) => e.stopPropagation()}>
          <div class="explain-header">
            <span class="explain-title">HOW THIS WAS CALCULATED</span>
            <span class="explain-collapse" onClick=${() => onToggle(id)}>collapse ^</span>
          </div>
          <div class="explain-method">${result.explain.method}</div>
          ${result.components && html`<${ExplainComponents} components=${result.components} />`}
          ${result.explain.formula && html`
            <div class="explain-formula">${result.explain.formula}</div>
          `}
          ${result.explain.source && html`
            <div style=${{ fontSize: 9, color: '#6b7280', marginBottom: 4 }}>
              Source: ${result.explain.source}
            </div>
          `}
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

function ExplainComponents({ components }) {
  const entries = Object.entries(components);
  if (entries.length === 0) return null;

  return html`
    <div class="explain-components">
      ${entries.map(([key, comp]) => {
        const isTotal = key === 'total';
        return html`
          <div class=${`explain-component ${isTotal ? 'explain-component--total' : ''}`}>
            <div class="flex-between">
              <span style=${{ color: '#6b7280' }}>${key}</span>
              <span style=${{ fontWeight: 700, fontFamily: 'var(--mono)', color: comp.percentile >= 70 ? '#16a34a' : comp.percentile >= 55 ? '#22c55e' : comp.percentile >= 40 ? '#f59e0b' : '#dc2626' }}>
                ${typeof comp.percentile === 'number' ? Math.round(comp.percentile) : comp.percentile}
              </span>
            </div>
            <div style=${{ color: '#9ca3af', fontSize: 9, marginTop: 2 }}>
              ${comp.raw !== undefined ? `${comp.raw}` : ''}
              ${Array.isArray(comp.benchmarks) ? ` vs [${comp.benchmarks.join(', ')}]` : comp.benchmarks ? ` (${comp.benchmarks})` : ''}
              ${comp.weight ? ` · wt ${comp.weight}` : ''}
            </div>
          </div>
        `;
      })}
    </div>
  `;
}
```

- [ ] **Step 4: Commit**

```bash
git add ui/htm.js ui/primitives.js ui/explain.js && git commit -m "feat: ui/primitives.js + ui/explain.js — shared visual components and ExplainPanel"
```

---

### Task 9: ui/card.js — Player Intelligence Card

**Files:**
- Create: `ui/card.js`

**Depends on:** All engine modules, primitives.js, explain.js

This is the core UI unit — the biggest single component.

- [ ] **Step 1: Write `ui/card.js`**

```javascript
// ui/card.js — Player Intelligence Card: surface layer + expandable depth

import { React, html } from './htm.js';
import { GradeRing, Sparkline, SentimentMeter, StatChip, SignalBadge, TrendArrow, PositionBadge, POS_COLORS } from './primitives.js';
import { ExplainPanel } from './explain.js';
import { computeCompositeGrade, gradeColor } from '../engine/grades.js';
import { calcDynastyValue, getTrajectory, AGE_CURVES } from '../engine/dynasty.js';
import { calcFantasyPts, calcCeilingFloor } from '../engine/scoring.js';
import { analyzePatterns } from '../engine/trends.js';
import { fetchPlayerSentiment } from '../engine/sentiment.js';
import { fetchMultiWeekStats } from '../api/sleeper.js';

const { useState, useEffect } = React;

export function PlayerIntelligenceCard({ player, stats, projections, currentWeek, scoringFormat, compact, onClose }) {
  const [openPanel, setOpenPanel] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loadingIntel, setLoadingIntel] = useState(true);

  const toggle = (id) => setOpenPanel(prev => prev === id ? null : id);

  const pos = player.position;
  const st = stats[player.id] || {};
  const proj = projections[player.id] || {};
  const format = scoringFormat || 'ppr';

  const actualResult = calcFantasyPts(st, format);
  const projResult = calcFantasyPts(proj, format);
  const gradeResult = computeCompositeGrade(st, pos);
  const { ceiling: ceilingResult, floor: floorResult } = calcCeilingFloor(projResult.value, pos);

  const age = player.age || 0;
  const yearsExp = player.years_exp || 0;
  const dynastyResult = calcDynastyValue(projResult.value, pos, age, yearsExp, player.injury_status);
  const traj = dynastyResult.trajectory;
  const curve = AGE_CURVES[pos] || AGE_CURVES.WR;
  const peakWindow = traj.yearsToPeak > 0 ? traj.yearsToPeak : Math.max(0, curve.peakEnd - age);

  // Async intelligence loading
  useEffect(() => {
    if (compact) return;
    setLoadingIntel(true);
    const name = `${player.first_name} ${player.last_name}`;
    Promise.all([
      fetchPlayerSentiment(name),
      fetchMultiWeekStats(player.id, currentWeek || 6).then(weeks => analyzePatterns(weeks, pos, format)),
    ]).then(([sent, pat]) => {
      setSentiment(sent);
      setPatterns(pat);
      setLoadingIntel(false);
    }).catch(() => setLoadingIntel(false));
  }, [player.id, compact]);

  // ── Compact mode: one row ──
  if (compact) {
    return html`
      <div class="card--compact">
        <${PositionBadge} position=${pos} />
        <span style=${{ flex: 1, fontSize: 12, fontWeight: 600 }}>
          ${player.first_name} ${player.last_name}
          <span class="text-meta" style=${{ fontSize: 10, marginLeft: 4 }}>${player.team || 'FA'} · ${age}yo</span>
        </span>
        <${GradeRing} grade=${gradeResult.value} size=${26} />
        <span class="text-mono text-blue" style=${{ fontSize: 11, minWidth: 30, textAlign: 'right' }}>${projResult.value.toFixed(1)}</span>
      </div>
    `;
  }

  // ── Full mode ──

  // Scout report generation
  const scoutParts = [];
  if (gradeResult.value >= 80) scoutParts.push(`Elite-tier ${pos}. Grade of ${gradeResult.value} ranks among the top producers at the position.`);
  else if (gradeResult.value >= 60) scoutParts.push(`Solid starter-level ${pos}. Stat-based score of ${gradeResult.value} shows reliable production.`);
  else scoutParts.push(`Below-average production for a ${pos}. Score of ${gradeResult.value} suggests limited fantasy upside.`);

  if (traj.label === 'ASCENDING') scoutParts.push(`At ${age}, still ${peakWindow} years from prime window (${curve.primeLabel}). ${traj.yearsToCliff}yr to career cliff.`);
  else if (traj.label === 'PRIME') scoutParts.push(`Peak production window NOW (prime: ${curve.primeLabel}). ${pos === 'RB' ? `RB shelf life is short — ~${traj.yearsToCliff}yr to cliff.` : `${traj.yearsToCliff}yr to cliff.`}`);
  else if (traj.label === 'DECLINING') scoutParts.push(`Past prime at ${age} (prime was ${curve.primeLabel}). ${traj.yearsToCliff}yr to cliff.`);
  else scoutParts.push(`Late career at ${age}. ${traj.yearsToCliff > 0 ? traj.yearsToCliff + 'yr max remaining.' : 'At or past typical career cliff.'}`);

  if (patterns?.signal === 'BUY LOW') scoutParts.push('PATTERN: Recent underperformance vs. baseline — buy-low window.');
  if (patterns?.signal === 'SELL HIGH') scoutParts.push('PATTERN: Recent surge above baseline — sell-high window.');
  if (sentiment?.value > 40) scoutParts.push('BUZZ: Overwhelmingly positive media narrative.');
  if (sentiment?.value < -40) scoutParts.push('BUZZ: Negative media narrative — investigate before buying.');

  return html`
    <div class="card fade-in">
      <!-- Header -->
      <div class="flex-between" style=${{ marginBottom: 12 }}>
        <div style=${{ flex: 1 }}>
          <div class="flex-center" style=${{ gap: 8 }}>
            <span style=${{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>${player.first_name} ${player.last_name}</span>
            ${onClose && html`<span onClick=${onClose} style=${{ cursor: 'pointer', color: 'var(--meta)', fontSize: 16 }}>×</span>`}
          </div>
          <div style=${{ fontSize: 11, color: 'var(--meta)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style=${{ color: POS_COLORS[pos], fontWeight: 700 }}>${pos}</span>
            <span>${player.team || 'FA'}</span>
            <span>Age ${age}</span>
            <span>Yr ${yearsExp}</span>
            ${player.college && html`<span>${player.college}</span>`}
            ${player.injury_status && html`<span style=${{ color: 'var(--red)', fontWeight: 600 }}>${player.injury_status}</span>`}
          </div>
        </div>
        <div style=${{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <${ExplainPanel} id="grade-ring" isOpen=${openPanel === 'grade-ring'} onToggle=${toggle} result=${gradeResult}>
            <${GradeRing} grade=${gradeResult.value} size=${52} label=${gradeResult.label} />
          <//>
          <${ExplainPanel} id="dynasty" isOpen=${openPanel === 'dynasty'} onToggle=${toggle} result=${dynastyResult}>
            <div style=${{ textAlign: 'center' }}>
              <div style=${{ fontSize: 22, fontWeight: 800, color: dynastyResult.value >= 70 ? 'var(--green)' : dynastyResult.value >= 45 ? 'var(--gold)' : 'var(--red)', lineHeight: 1 }}>${dynastyResult.value}</div>
              <div style=${{ fontSize: 8, fontWeight: 600, color: 'var(--meta)' }}>DYNASTY</div>
            </div>
          <//>
        </div>
      </div>

      <!-- Stat Grid -->
      <div class="stat-grid">
        ${[
          { id: 'actual', label: 'ACTUAL', result: actualResult, color: actualResult.value > 15 ? 'var(--green)' : 'var(--navy)' },
          { id: 'projected', label: 'PROJECTED', result: projResult, color: 'var(--blue)' },
          { id: 'ceiling', label: 'CEILING', result: ceilingResult, color: 'var(--green)' },
          { id: 'floor', label: 'FLOOR', result: floorResult, color: 'var(--red)' },
          { id: 'grade', label: 'GRADE', result: gradeResult, value: gradeResult.value, color: gradeColor(gradeResult.value) },
          { id: 'traj', label: traj.label, result: dynastyResult, value: traj.label === 'ASCENDING' ? `${peakWindow}yr→peak` : traj.label === 'PRIME' ? 'NOW' : traj.yearsToCliff > 0 ? `${traj.yearsToCliff}yr left` : '—', color: traj.color },
        ].map(cell => html`
          <${ExplainPanel} id=${cell.id} isOpen=${openPanel === cell.id} onToggle=${toggle} result=${cell.result} key=${cell.id}>
            <div class="stat-cell">
              <div class="stat-cell__value" style=${{ color: cell.color }}>${cell.value !== undefined ? cell.value : cell.result.value.toFixed ? cell.result.value.toFixed(1) : cell.result.value}</div>
              <div class="stat-cell__label">${cell.label}</div>
            </div>
          <//>
        `)}
      </div>

      <!-- Raw Stats Bar -->
      <div class="stats-bar">
        ${pos === 'QB' && html`
          <${StatChip} label="Pass" value=${`${st.pass_yd||0}yd`} />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="TD" value=${st.pass_td||0} variant="good" />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="INT" value=${st.pass_int||0} variant=${(st.pass_int||0) > 0 ? 'bad' : 'neutral'} />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="Rush" value=${`${st.rush_yd||0}yd`} />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="Cmp%" value=${st.pass_att > 0 ? `${Math.round(((st.pass_cmp||0)/st.pass_att)*100)}%` : '—'} />
        `}
        ${pos === 'RB' && html`
          <${StatChip} label="Rush" value=${`${st.rush_yd||0}yd`} />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="TD" value=${st.rush_td||0} variant="good" />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="YPC" value=${st.rush_att > 0 ? ((st.rush_yd||0)/st.rush_att).toFixed(1) : '—'} />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="Rec" value=${st.rec||0} />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="Fum" value=${st.fum_lost||0} variant=${(st.fum_lost||0) > 0 ? 'bad' : 'neutral'} />
        `}
        ${(pos === 'WR' || pos === 'TE') && html`
          <${StatChip} label="Rec" value=${st.rec||0} />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="Yd" value=${st.rec_yd||0} />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="TD" value=${st.rec_td||0} variant="good" />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="Tgt" value=${st.rec_tgt||'?'} />
          <span class="stats-bar__sep">|</span>
          <${StatChip} label="Y/R" value=${(st.rec||0) > 0 ? ((st.rec_yd||0)/st.rec).toFixed(1) : '—'} />
        `}
      </div>

      <!-- Trend + Buzz Row -->
      ${loadingIntel ? html`
        <div class="loading-pulse" style=${{ padding: 8, fontSize: 10, color: 'var(--meta)' }}>Loading intelligence (multi-week stats + news)...</div>
      ` : html`
        <div class="trend-buzz-row">
          <${ExplainPanel} id="trend" isOpen=${openPanel === 'trend'} onToggle=${toggle} result=${patterns}>
            <div class="panel">
              <div class="panel__header">
                <span class="panel__title">TREND</span>
                <div class="flex-center" style=${{ gap: 6 }}>
                  ${patterns && html`
                    <span style=${{ fontSize: 10, fontWeight: 700, color: patterns.trendDir > 0 ? 'var(--green)' : patterns.trendDir < 0 ? 'var(--red)' : 'var(--meta)', background: patterns.trendDir > 0 ? 'var(--green-bg)' : patterns.trendDir < 0 ? 'var(--red-bg)' : 'var(--surface)', padding: '1px 6px', borderRadius: 3 }}>${patterns.value}</span>
                    <${TrendArrow} dir=${patterns.trendDir} size=${12} />
                  `}
                </div>
              </div>
              ${patterns && html`
                <${Sparkline} data=${patterns.weeklyPts} height=${28} color=${patterns.trendDir > 0 ? '#16a34a' : patterns.trendDir < 0 ? '#dc2626' : '#6b7280'} />
                <div style=${{ fontSize: 9, color: 'var(--meta)', marginTop: 4 }}>
                  Avg: ${patterns.mean} · Recent: ${patterns.recentMean}
                  ${patterns.signal !== 'HOLD' ? html` · <${SignalBadge} signal=${patterns.signal} confidence=${patterns.confidence} />` : ''}
                </div>
              `}
            </div>
          <//>
          <${ExplainPanel} id="buzz" isOpen=${openPanel === 'buzz'} onToggle=${toggle} result=${sentiment}>
            <div class="panel">
              <div class="panel__header">
                <span class="panel__title">NEWS BUZZ</span>
                <div class="flex-center" style=${{ gap: 6 }}>
                  ${sentiment && html`
                    <${SentimentMeter} score=${sentiment.value} width=${60} />
                    <span class="text-mono" style=${{ fontSize: 10, fontWeight: 700, color: sentiment.value > 0 ? 'var(--green)' : sentiment.value < 0 ? 'var(--red)' : 'var(--meta)' }}>${sentiment.value > 0 ? '+' : ''}${sentiment.value}</span>
                  `}
                </div>
              </div>
              ${sentiment && html`
                <div style=${{ fontSize: 9, color: 'var(--meta)', lineHeight: 1.5 }}>
                  ${sentiment.volume} articles (7d) · ${sentiment.narrative}
                </div>
                ${sentiment.headlines.slice(0, 3).map((h, i) => html`
                  <div key=${i} style=${{ fontSize: 9, color: 'var(--text-light)', padding: '2px 0', borderTop: i > 0 ? '1px solid var(--border-light)' : 'none', marginTop: i === 0 ? 4 : 0 }}>
                    <a href=${h.link} target="_blank" rel="noopener" style=${{ color: 'var(--text-light)', textDecoration: 'none' }}>
                      ${h.title.slice(0, 70)}${h.title.length > 70 ? '...' : ''}
                    </a>
                  </div>
                `)}
              `}
            </div>
          <//>
        </div>
      `}

      <!-- Scout Report -->
      <div class="scout-report">
        <strong>Scout Report:</strong> ${scoutParts.join(' ')}
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/card.js && git commit -m "feat: ui/card.js — Player Intelligence Card with two-layer expand interaction"
```

---

### Task 10: ui/scout.js + ui/trade.js + ui/settings.js

**Files:**
- Create: `ui/scout.js`
- Create: `ui/trade.js`
- Create: `ui/settings.js`

**Depends on:** card.js, engine/*, config.js

- [ ] **Step 1: Write `ui/scout.js`**

```javascript
// ui/scout.js — Player search + results table + intelligence card expansion

import { React, html } from './htm.js';
import { PlayerIntelligenceCard } from './card.js';
import { computeCompositeGrade, gradeColor } from '../engine/grades.js';
import { calcFantasyPts } from '../engine/scoring.js';
import { PositionBadge, POS_COLORS, NFL_TEAMS } from './primitives.js';

const { useState, useEffect, useMemo } = React;

export function PlayerScout({ players, stats, projections, currentWeek, scoringFormat }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [posFilter, setPosFilter] = useState('ALL');

  const playerCount = useMemo(() => players ? Object.keys(players).length : 0, [players]);

  const results = useMemo(() => {
    if (!query || query.length < 2 || !players || playerCount === 0) return [];
    const q = query.toLowerCase();
    return Object.entries(players)
      .filter(([id, p]) => {
        const isActive = p.status === 'Active' || p.active === true || (p.team && p.team !== '');
        const validPos = p.position && ['QB','RB','WR','TE','K','DEF'].includes(p.position);
        const posMatch = posFilter === 'ALL' || p.position === posFilter;
        const teamFull = NFL_TEAMS[p.team] || '';
        const nameMatch = (`${p.first_name || ''} ${p.last_name || ''}`).toLowerCase().includes(q) || (p.team || '').toLowerCase().includes(q) || teamFull.includes(q);
        return isActive && validPos && posMatch && nameMatch;
      })
      .map(([id, p]) => {
        const grade = computeCompositeGrade(stats[id] || {}, p.position);
        const projected = calcFantasyPts(projections[id] || {}, scoringFormat || 'ppr');
        return { id, ...p, grade, projected: projected.value };
      })
      .sort((a, b) => b.grade.value - a.grade.value || b.projected - a.projected)
      .slice(0, 25);
  }, [query, players, playerCount, posFilter, stats, projections, scoringFormat]);

  return html`
    <div class="fade-in" style=${{ margin: '10px 16px' }}>
      <div style=${{ marginBottom: 4 }}>
        <div style=${{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Player Intelligence Scout</div>
        <div style=${{ fontSize: 11, color: 'var(--meta)' }}>Stat-based score + trend analysis + news buzz + scouting report. Click any number to see the math.</div>
      </div>

      <div style=${{ display: 'flex', gap: 6, marginBottom: 10, marginTop: 10 }}>
        <input class="search-input" value=${query}
          onInput=${e => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Search player name or NFL team..." />
        ${['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => html`
          <button key=${pos} onClick=${() => { setPosFilter(pos); setSelected(null); }}
            class="nav-tab" style=${{
              fontWeight: posFilter === pos ? 700 : 400, fontSize: 11,
              background: posFilter === pos ? (POS_COLORS[pos] || 'var(--navy)') : 'var(--surface)',
              color: posFilter === pos ? '#fff' : 'var(--meta)',
              border: posFilter === pos ? 'none' : '1px solid var(--border)',
            }}>${pos}</button>
        `)}
      </div>

      ${selected ? html`
        <div>
          <div onClick=${() => setSelected(null)} style=${{ fontSize: 12, color: 'var(--blue)', cursor: 'pointer', marginBottom: 8 }}>← Back to results</div>
          <${PlayerIntelligenceCard} player=${selected} stats=${stats} projections=${projections}
            currentWeek=${currentWeek} scoringFormat=${scoringFormat} onClose=${() => setSelected(null)} />
        </div>
      ` : results.length > 0 ? html`
        <div class="results-table">
          <div class="results-table__header">
            <span>POS</span><span>NAME</span><span>TEAM</span><span>AGE</span><span>GRADE</span><span>PROJ</span><span></span>
          </div>
          ${results.map(p => html`
            <div key=${p.id} class="results-table__row" onClick=${() => setSelected(p)}>
              <span style=${{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] || 'var(--meta)' }}>${p.position}</span>
              <span style=${{ fontWeight: 600 }}>
                ${p.first_name} ${p.last_name}
                ${p.injury_status && html`<span style=${{ fontSize: 9, color: 'var(--red)', marginLeft: 4 }}>${p.injury_status}</span>`}
              </span>
              <span class="text-meta" style=${{ fontSize: 10 }}>${p.team || 'FA'}</span>
              <span class="text-meta text-mono" style=${{ fontSize: 10 }}>${p.age || '?'}</span>
              <span class="text-mono" style=${{ fontSize: 11, fontWeight: 700, color: gradeColor(p.grade.value) }}>${p.grade.value}</span>
              <span class="text-mono" style=${{ fontSize: 11, color: p.projected > 10 ? 'var(--green)' : 'var(--meta)' }}>${p.projected.toFixed(1)}</span>
              <span style=${{ fontSize: 10, color: 'var(--blue)', fontWeight: 600 }}>Intel →</span>
            </div>
          `)}
        </div>
      ` : query.length >= 2 ? html`
        <div style=${{ padding: 20, textAlign: 'center', color: 'var(--meta)', fontSize: 13 }}>No active players found matching "${query}".</div>
      ` : html`
        <div style=${{ padding: 30, textAlign: 'center', color: 'var(--meta)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style=${{ fontSize: 24, marginBottom: 8 }}>🔬</div>
          <div style=${{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Player Intelligence Database</div>
          <div style=${{ fontSize: 12 }}>
            ${playerCount > 0 ? `${playerCount.toLocaleString()} players loaded. Search by name or NFL team.` : 'Loading player database...'}
          </div>
        </div>
      `}
    </div>
  `;
}
```

- [ ] **Step 2: Write `ui/trade.js`**

```javascript
// ui/trade.js — Trade Analyzer with explainable verdicts

import { React, html } from './htm.js';
import { PlayerIntelligenceCard } from './card.js';
import { computeCompositeGrade, gradeColor } from '../engine/grades.js';
import { calcDynastyValue } from '../engine/dynasty.js';
import { calcFantasyPts } from '../engine/scoring.js';
import { ExplainPanel } from './explain.js';
import { GradeRing, POS_COLORS, NFL_TEAMS } from './primitives.js';

const { useState, useEffect, useMemo } = React;

export function TradeAnalyzer({ players, stats, projections, currentWeek, scoringFormat }) {
  const [sideA, setSideA] = useState([]);
  const [sideB, setSideB] = useState([]);
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const format = scoringFormat || 'ppr';

  const searchPlayers = (query) => {
    if (!query || query.length < 2 || !players) return [];
    const q = query.toLowerCase();
    return Object.entries(players)
      .filter(([id, p]) => (p.status === 'Active' || p.active === true || (p.team && p.team !== '')) &&
        p.position && ['QB','RB','WR','TE','K'].includes(p.position) &&
        (`${p.first_name || ''} ${p.last_name || ''}`).toLowerCase().includes(q) || (NFL_TEAMS[p.team] || '').includes(q))
      .slice(0, 8)
      .map(([id, p]) => ({ id, ...p }));
  };

  const resultsA = useMemo(() => searchPlayers(searchA), [searchA, players]);
  const resultsB = useMemo(() => searchPlayers(searchB), [searchB, players]);

  const getPlayerValue = (p) => {
    const proj = projections[p.id] || {};
    const projected = calcFantasyPts(proj, format).value;
    const grade = computeCompositeGrade(stats[p.id] || {}, p.position);
    const dynasty = calcDynastyValue(projected, p.position, p.age || 0, p.years_exp || 0, p.injury_status);
    return { projected, grade, dynasty };
  };

  const totalVal = (side) => side.reduce((s, p) => s + getPlayerValue(p).dynasty.value, 0);
  const totalProj = (side) => side.reduce((s, p) => s + getPlayerValue(p).projected, 0);

  const addPlayer = (side, player) => {
    if (side === 'A') { setSideA(s => [...s, player]); setSearchA(''); }
    else { setSideB(s => [...s, player]); setSearchB(''); }
  };

  const valDiff = totalVal(sideB) - totalVal(sideA);
  const projDiff = totalProj(sideB) - totalProj(sideA);
  const hasPlayers = sideA.length > 0 || sideB.length > 0;

  let verdict = '', verdictColor = 'var(--meta)', verdictDetail = '';
  if (hasPlayers) {
    if (Math.abs(valDiff) < 5 && Math.abs(projDiff) < 2) { verdict = 'FAIR TRADE'; verdictColor = '#6b7280'; verdictDetail = 'Even value — comes down to team needs.'; }
    else if (valDiff > 10 && projDiff > 0) { verdict = 'STRONG WIN'; verdictColor = '#16a34a'; verdictDetail = `You gain ${projDiff.toFixed(1)} pts/wk AND superior long-term value (+${valDiff}).`; }
    else if (valDiff > 5) { verdict = 'YOU WIN'; verdictColor = '#22c55e'; verdictDetail = projDiff < 0 ? `Short-term loss (${projDiff.toFixed(1)} pts/wk) but long-term value gain (+${valDiff}). Dynasty play.` : `You gain both production (+${projDiff.toFixed(1)}) and value (+${valDiff}).`; }
    else if (valDiff < -10 && projDiff < 0) { verdict = 'STRONG LOSS'; verdictColor = '#dc2626'; verdictDetail = `You lose ${Math.abs(projDiff).toFixed(1)} pts/wk AND long-term value (${valDiff}). Avoid.`; }
    else if (valDiff < -5) { verdict = 'YOU LOSE'; verdictColor = '#f97316'; verdictDetail = projDiff > 0 ? `Short-term gain (+${projDiff.toFixed(1)} pts/wk) but selling low on long-term value (${valDiff}). Win-now move.` : `Negative on both axes. Reconsider.`; }
    else { verdict = 'MARGINAL'; verdictColor = '#f59e0b'; verdictDetail = 'Close call — consider your team\'s competitive window.'; }
  }

  // Build verdict explain result
  const verdictResult = hasPlayers ? {
    value: verdict,
    explain: {
      method: 'Dynasty value comparison: sum of dynasty scores for each side + weekly projection delta',
      inputs: {
        sideA_dynasty: totalVal(sideA), sideB_dynasty: totalVal(sideB),
        sideA_proj: Math.round(totalProj(sideA) * 10) / 10, sideB_proj: Math.round(totalProj(sideB) * 10) / 10,
      },
      formula: `Value delta: ${totalVal(sideB)} - ${totalVal(sideA)} = ${valDiff > 0 ? '+' : ''}${valDiff} | Proj delta: ${totalProj(sideB).toFixed(1)} - ${totalProj(sideA).toFixed(1)} = ${projDiff > 0 ? '+' : ''}${projDiff.toFixed(1)} pts/wk`,
      source: 'Dynasty values from engine/dynasty.js, projections from Sleeper API',
      caveats: ['Dynasty values are composite scores, not trade pick equivalents', 'Projections are rest-of-season estimates from Sleeper'],
    },
  } : null;

  const renderSide = (side, setSide, search, setSearch, results, label, sideKey) => html`
    <div class="trade-side">
      <div class="trade-side__title">${label}</div>
      <div style=${{ position: 'relative', marginBottom: 8 }}>
        <input class="search-input" style=${{ fontSize: 12 }} value=${search}
          onInput=${e => setSearch(e.target.value)} placeholder="Search player or team..." />
        ${results.length > 0 && html`
          <div class="search-results" style=${{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10 }}>
            ${results.map(p => html`
              <div key=${p.id} class="search-result" onClick=${() => addPlayer(sideKey, p)}>
                <span style=${{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] || 'var(--meta)' }}>${p.position}</span>
                <span>${p.first_name} ${p.last_name}</span>
                <span class="text-meta" style=${{ fontSize: 10 }}>${p.team}</span>
              </div>
            `)}
          </div>
        `}
      </div>
      ${side.map((p, i) => {
        const v = getPlayerValue(p);
        return html`
          <div key=${i} class="card--compact" style=${{ marginBottom: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', cursor: 'pointer' }}
            onClick=${() => setExpandedPlayer(expandedPlayer === p.id ? null : p.id)}>
            <span style=${{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] || 'var(--meta)', width: 22 }}>${p.position}</span>
            <span style=${{ flex: 1, fontSize: 11, fontWeight: 600 }}>
              ${p.first_name} ${p.last_name}
              <span class="text-meta" style=${{ fontSize: 9 }}> ${p.team || 'FA'} · ${p.age || '?'}yo</span>
            </span>
            <${GradeRing} grade=${v.grade.value} size=${26} />
            <span class="text-mono text-blue" style=${{ fontSize: 11, minWidth: 30, textAlign: 'right' }}>${v.projected.toFixed(1)}</span>
            <span onClick=${(e) => { e.stopPropagation(); setSide(s => s.filter((_, j) => j !== i)); }}
              style=${{ fontSize: 14, color: 'var(--red)', cursor: 'pointer' }}>×</span>
          </div>
        `;
      })}
      ${side.length > 0 && html`
        <div class="flex-between" style=${{ marginTop: 6, fontSize: 11, fontWeight: 700 }}>
          <span class="text-meta">Proj: <span class="text-mono text-blue">${totalProj(side).toFixed(1)}</span></span>
          <span style=${{ color: 'var(--navy)' }}>Value: <span class="text-mono">${totalVal(side)}</span></span>
        </div>
      `}
    </div>
  `;

  return html`
    <div class="fade-in" style=${{ margin: '10px 16px' }}>
      <div class="card" style=${{ padding: '16px 20px' }}>
        <div style=${{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>Trade Analyzer</div>
        <div style=${{ fontSize: 11, color: 'var(--meta)', marginBottom: 14 }}>Projections + stat-based score + age trajectory + dynasty value. Click "Show Math" on the verdict.</div>
        <div class="trade-sides">
          ${renderSide(sideA, setSideA, searchA, setSearchA, resultsA, 'YOU GIVE', 'A')}
          <div class="trade-swap">⇄</div>
          ${renderSide(sideB, setSideB, searchB, setSearchB, resultsB, 'YOU GET', 'B')}
        </div>
        ${hasPlayers && verdict && html`
          <${ExplainPanel} id="verdict" isOpen=${openPanel === 'verdict'} onToggle=${(id) => setOpenPanel(p => p === id ? null : id)} result=${verdictResult}>
            <div class="verdict" style=${{ background: verdictColor + '10', borderLeft: `4px solid ${verdictColor}` }}>
              <div class="verdict__title" style=${{ color: verdictColor }}>${verdict}</div>
              <div class="verdict__detail">${verdictDetail}</div>
              <div class="verdict__stats">
                <span>Proj Δ: <strong class="text-mono" style=${{ color: projDiff >= 0 ? 'var(--green)' : 'var(--red)' }}>${projDiff >= 0 ? '+' : ''}${projDiff.toFixed(1)}</strong> pts/wk</span>
                <span>Value Δ: <strong class="text-mono" style=${{ color: valDiff >= 0 ? 'var(--green)' : 'var(--red)' }}>${valDiff >= 0 ? '+' : ''}${valDiff}</strong></span>
              </div>
              <div style=${{ fontSize: 10, color: 'var(--blue)', marginTop: 6, fontWeight: 600 }}>Click to show math ▼</div>
            </div>
          <//>
        `}
      </div>
    </div>
  `;
}
```

- [ ] **Step 3: Write `ui/settings.js`**

```javascript
// ui/settings.js — Configuration panel

import { React, html } from './htm.js';
import { DEFAULT_CONFIG, saveConfig } from '../config.js';
import { getUser, getUserLeagues } from '../api/sleeper.js';

const { useState } = React;

export function Settings({ config, onSave }) {
  const [draft, setDraft] = useState({ ...config });
  const [username, setUsername] = useState(config.sleeperUsername || '');
  const [lookupStatus, setLookupStatus] = useState(null);

  const lookupUser = async () => {
    if (!username.trim()) return;
    setLookupStatus('Looking up...');
    try {
      const user = await getUser(username.trim());
      if (!user || !user.user_id) { setLookupStatus('User not found'); return; }
      setLookupStatus(`Found: ${user.display_name} (ID: ${user.user_id})`);
      const leagues = await getUserLeagues(user.user_id);
      if (leagues && leagues.length > 0) {
        const newLeagues = leagues.slice(0, 4).map((lg, i) => ({
          id: lg.league_id, name: lg.name || `League ${i + 1}`,
          isCommissioner: lg.owner_id === user.user_id,
        }));
        while (newLeagues.length < 4) newLeagues.push({ id: '', name: `League ${newLeagues.length + 1}`, isCommissioner: false });
        setDraft(d => ({ ...d, leagues: newLeagues }));
        setLookupStatus(`Found ${leagues.length} league(s) — showing first ${Math.min(4, leagues.length)}`);
      } else { setLookupStatus('No NFL leagues found for this season.'); }
    } catch (e) { setLookupStatus('Lookup failed: ' + e.message); }
  };

  const handleSave = () => {
    const updated = { ...draft, sleeperUsername: username };
    saveConfig(updated);
    onSave(updated);
  };

  return html`
    <div class="settings-panel fade-in">
      <div style=${{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Settings</div>
      <div style=${{ fontSize: 12, color: 'var(--meta)', marginBottom: 14, lineHeight: 1.5 }}>
        Enter your Sleeper username to auto-detect leagues. All data comes from the free Sleeper API.
      </div>

      <div style=${{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input class="settings-input" value=${username} onInput=${e => setUsername(e.target.value)}
          placeholder="Sleeper username" onKeyDown=${e => { if (e.key === 'Enter') lookupUser(); }} />
        <button class="btn btn--green" onClick=${lookupUser}>Auto-Detect Leagues</button>
      </div>
      ${lookupStatus && html`<div style=${{ fontSize: 11, color: lookupStatus.includes('Found') ? 'var(--green)' : 'var(--red)', marginBottom: 10 }}>${lookupStatus}</div>`}

      <div class="settings-field">
        <label class="settings-label">Scoring Format</label>
        <div class="settings-radio-group">
          ${['ppr', 'half_ppr', 'standard'].map(fmt => html`
            <label key=${fmt} style=${{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="radio" name="scoring" checked=${draft.scoringFormat === fmt}
                onChange=${() => setDraft(d => ({ ...d, scoringFormat: fmt }))} />
              ${fmt === 'ppr' ? 'PPR' : fmt === 'half_ppr' ? 'Half-PPR' : 'Standard'}
            </label>
          `)}
        </div>
      </div>

      <div class="settings-field">
        <label class="settings-label">Your Leagues</label>
        ${(draft.leagues || []).map((lg, i) => html`
          <div key=${i} style=${{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input class="settings-input" style=${{ width: 140 }} value=${lg.name}
              onInput=${e => { const v = e.target.value; setDraft(d => ({ ...d, leagues: d.leagues.map((l, j) => j === i ? { ...l, name: v } : l) })); }}
              placeholder=${`League ${i + 1}`} />
            <input class="settings-input" style=${{ flex: 1, fontFamily: 'var(--mono)' }} value=${lg.id}
              onInput=${e => { const v = e.target.value; setDraft(d => ({ ...d, leagues: d.leagues.map((l, j) => j === i ? { ...l, id: v } : l) })); }}
              placeholder="Sleeper League ID" />
          </div>
        `)}
      </div>

      <div style=${{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button class="btn btn--primary" onClick=${handleSave}>Save</button>
        <button class="btn btn--secondary" onClick=${() => { setDraft({ ...DEFAULT_CONFIG }); setUsername(''); }}>Reset to Defaults</button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 4: Commit**

```bash
git add ui/scout.js ui/trade.js ui/settings.js && git commit -m "feat: ui/scout.js, ui/trade.js, ui/settings.js — feature views"
```

---

### Task 11: ui/app.js — Root Component (Integration)

**Files:**
- Create: `ui/app.js`

**Depends on:** Everything. This wires it all together.

- [ ] **Step 1: Write `ui/app.js`**

```javascript
// ui/app.js — Root component: data loading, routing, state management

import React from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { loadConfig, saveConfig } from '../config.js';
import { getPlayers, getSeasonStats, getProjections, getNFLState } from '../api/sleeper.js';
import { PlayerScout } from './scout.js';
import { TradeAnalyzer } from './trade.js';
import { Settings } from './settings.js';

const html = htm.bind(React.createElement);
const { useState, useEffect, useReducer, useCallback } = React;

// ── State management ──

const initialState = {
  players: null,
  stats: {},
  projections: {},
  currentWeek: 1,
  loading: true,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PLAYERS': return { ...state, players: action.data };
    case 'SET_STATS': return { ...state, stats: action.data };
    case 'SET_PROJECTIONS': return { ...state, projections: action.data };
    case 'SET_WEEK': return { ...state, currentWeek: action.data };
    case 'SET_LOADING': return { ...state, loading: action.data };
    case 'SET_ERROR': return { ...state, error: action.data };
    default: return state;
  }
}

// ── App ──

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [view, setView] = useState('scout');
  const [config, setConfig] = useState(() => loadConfig());

  // Data loading sequence
  useEffect(() => {
    dispatch({ type: 'SET_LOADING', data: true });

    (async () => {
      try {
        const nflState = await getNFLState();
        const week = nflState.week || 1;
        dispatch({ type: 'SET_WEEK', data: week });

        const players = await getPlayers();
        dispatch({ type: 'SET_PLAYERS', data: players });

        const [stats, projections] = await Promise.all([
          getSeasonStats(week),
          getProjections(week),
        ]);
        dispatch({ type: 'SET_STATS', data: stats });
        dispatch({ type: 'SET_PROJECTIONS', data: projections });
      } catch (e) {
        console.error('Data load failed:', e);
        dispatch({ type: 'SET_ERROR', data: e.message });
      } finally {
        dispatch({ type: 'SET_LOADING', data: false });
      }
    })();
  }, []);

  const handleSaveConfig = useCallback((newConfig) => {
    setConfig(newConfig);
  }, []);

  const { players, stats, projections, currentWeek, loading, error } = state;

  return html`
    <div class="app-container">
      <!-- Nav Bar -->
      <div class="nav-bar">
        <div class="nav-logo" onClick=${() => setView('scout')}>
          <div class="nav-logo-mark">SS</div>
          <div>
            <div class="nav-title">sleeper-scores</div>
            <div class="nav-subtitle">FANTASY INTELLIGENCE · EVERY NUMBER SHOWS ITS MATH</div>
          </div>
        </div>
        <div class="nav-tabs">
          ${[
            { id: 'scout', label: '🔬 Scout' },
            { id: 'trade', label: '🔄 Trade' },
            { id: 'settings', label: '⚙️ Settings' },
          ].map(tab => html`
            <button key=${tab.id} class=${`nav-tab ${view === tab.id ? 'nav-tab--active' : 'nav-tab--inactive'}`}
              onClick=${() => setView(tab.id)}>
              ${tab.label}
            </button>
          `)}
        </div>
      </div>

      <!-- Content -->
      ${loading ? html`
        <div style=${{ padding: '60px 20px', textAlign: 'center' }}>
          <div class="loading-pulse" style=${{ fontSize: 14, color: 'var(--meta)', marginBottom: 12 }}>
            Loading player database from Sleeper API...
          </div>
          <div style=${{ fontSize: 11, color: 'var(--meta)' }}>
            First load fetches ~9MB of player data. Subsequent visits load from cache instantly.
          </div>
        </div>
      ` : error ? html`
        <div style=${{ padding: '40px 20px', textAlign: 'center', color: 'var(--red)' }}>
          <div style=${{ fontSize: 14, marginBottom: 8 }}>Failed to load data</div>
          <div style=${{ fontSize: 12 }}>${error}</div>
          <button class="btn btn--primary" style=${{ marginTop: 12 }} onClick=${() => location.reload()}>Retry</button>
        </div>
      ` : html`
        ${view === 'scout' && html`
          <${PlayerScout} players=${players} stats=${stats} projections=${projections}
            currentWeek=${currentWeek} scoringFormat=${config.scoringFormat} />
        `}
        ${view === 'trade' && html`
          <${TradeAnalyzer} players=${players} stats=${stats} projections=${projections}
            currentWeek=${currentWeek} scoringFormat=${config.scoringFormat} />
        `}
        ${view === 'settings' && html`
          <${Settings} config=${config} onSave=${handleSaveConfig} />
        `}
      `}

      <!-- Footer -->
      <div class="footer">
        <div class="footer__title">sleeper-scores</div>
        <div class="footer__sub">Every number shows its math. Fork it on GitHub.</div>
        <div class="footer__link" style=${{ marginTop: 6 }}>Built with Claude.</div>
      </div>
    </div>
  `;
}

// ── Mount ──
const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
```

- [ ] **Step 2: Verify the app loads**

```bash
cd /Users/christopherbailey/Desktop/north-county-beacon && python3 -m http.server 8080 &
sleep 1 && echo "Open http://localhost:8080 in browser"
```

Verify: page loads, nav bar visible, loading state appears, then Scout view renders after data loads.

- [ ] **Step 3: Commit**

```bash
git add ui/app.js && git commit -m "feat: ui/app.js — root component with data loading, routing, and state management"
```

---

### Task 12: README + Cleanup + Verify

**Files:**
- Create: `README.md` (overwrite existing)
- Remove: `b.html` (PII in source)
- Keep: old `index.html` is already overwritten by Task 1

- [ ] **Step 1: Remove old files**

```bash
cd /Users/christopherbailey/Desktop/north-county-beacon
rm -f b.html
```

- [ ] **Step 2: Write `README.md`**

Write a clean README following the spec's structure:
1. One-line description
2. What it computes (methodology table)
3. The differentiator ("Click any number")
4. Setup (3 steps)
5. Fork guide
6. File structure
7. Data sources
8. Tech stack
9. Built with Claude

- [ ] **Step 3: Full browser test**

```bash
cd /Users/christopherbailey/Desktop/north-county-beacon && python3 -m http.server 8080
```

Verification checklist:
- [ ] Page loads without console errors
- [ ] Player search works (type "Patrick Mahomes")
- [ ] Intelligence card renders with grade ring, dynasty score, stat grid
- [ ] Clicking GRADE cell expands the explain panel showing formula + benchmarks
- [ ] Clicking a different cell closes GRADE and opens the new one
- [ ] Trend sparkline and news buzz load asynchronously
- [ ] Trade Analyzer search works, players add to sides
- [ ] Verdict appears with "Click to show math"
- [ ] Settings saves to localStorage
- [ ] Mobile responsive (resize to 375px width) — stat grid wraps to 3-col

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: sleeper-scores complete — README, cleanup, remove old files"
```

- [ ] **Step 5: Verify git status is clean**

```bash
git status && git log --oneline -12
```

# North County Beacon

A personalized news aggregator and fantasy football intelligence platform — a single standalone HTML file you can host anywhere.

**Live site:** [chrbailey.github.io/north-county-beacon](https://chrbailey.github.io/north-county-beacon/)

---

## What It Does

### News Aggregator
- Pulls live Google News headlines via RSS, filtered to topics you care about
- Editable search queries — add, remove, or reorder your news feeds anytime
- Featured stories curated for North San Diego County (Carlsbad, Encinitas, Oceanside, Vista)
- Profile-driven personalization: your job, school, hobbies, and interests shape the feed

### Fantasy Football Intelligence Engine
Connect your Sleeper leagues and get tools that go way beyond the Sleeper app:

**Player Scout** — Search any active NFL player by name, team name, or city. Each player gets a full intelligence card with:
- **Composite Grade (0-99):** Built from actual 2025 per-game stats scored against position-specific benchmarks. QBs are graded on pass yards, TDs, completion %, rush yards, and interceptions. RBs on rush yards, TDs, receptions, receiving yards, and fumbles. Every position has its own scale — similar concept to PFF grades but computed from publicly available Sleeper data.
- **Dynasty Score (1-99):** A research-backed value score that factors in current production, age relative to position-specific prime windows, career longevity projections, and workload. The age curves come from EPA studies spanning 2014-2024: QBs peak at 28-33, RBs at 23-26 (with only ~6 year careers), WRs at 25-30, TEs at 26-30. For running backs, it estimates career touches and applies penalties as backs approach the well-documented 2,500-touch cliff where production drops sharply.
- **Trajectory Detection:** Each player is classified as ASCENDING, PRIME, DECLINING, or LATE CAREER based on their age relative to position norms. Ascending players show years until peak; declining players show years until the career cliff.
- **Ceiling/Floor Projections:** Best-case and worst-case weekly fantasy point estimates based on position variance patterns.
- **Media Sentiment:** Live news headlines are scored for positive/negative buzz to gauge the narrative around a player.
- **Multi-Week Trend Analysis:** Analyzes recent weekly stat lines against season baselines using linear regression and coefficient of variation to flag BUY LOW (underperforming recent weeks) and SELL HIGH (surging above baseline) windows.
- **Scout Report:** A written summary combining all signals — grade, trajectory, workload warnings, pattern detection, and sentiment — into actionable advice.

**Trade Analyzer** — Drop players on each side of a proposed trade. Both sides are valued using the same dynasty formula (production + youth + longevity + position premium - workload penalties) so you can instantly see if a deal is fair or lopsided.

**League Dashboard** — View rosters, standings, and weekly matchups for up to 4 connected Sleeper leagues.

## How It Works

Everything runs client-side in the browser. There are no servers, databases, accounts, or logins.

- **Sleeper API** (free, no auth, CORS-friendly) provides player data, league rosters, stats, projections, and matchup scores
- **Google News RSS** via rss2json.com provides live headlines for the news feed and player sentiment analysis
- **URL hash persistence** stores your profile and league configuration in the URL fragment (the part after `#`). This means your data never leaves your browser — it's encoded in the link itself. Bookmark your personalized URL and your settings persist across visits.

The entire app is a single HTML file with embedded React 18, Babel (for in-browser JSX), and CSS. No build step, no dependencies to install, no npm. Just open the file or host it anywhere static files are served.

## Setup

1. Open the site or the HTML file
2. Click the gear icon to open Settings
3. Enter your Sleeper username and league IDs (found in your Sleeper app under league settings)
4. Customize your news feeds, profile, and interests
5. Bookmark the URL — your settings are saved in it

## Forking / Using This Yourself

If you fork this repo, you'll get a clean generic template. All personal data (names, leagues, profile info) lives in the URL hash, not in the code. Just set up your own profile through the Settings panel and you're good to go.

To host your own copy: enable GitHub Pages on your fork (Settings > Pages > Source: main branch) and your site will be live at `https://yourusername.github.io/north-county-beacon/`.

## Tech Stack

- React 18 (via CDN)
- Babel Standalone (in-browser JSX transpilation)
- Sleeper API
- Google News RSS via rss2json.com
- Pure CSS visualizations (SVG grade rings, sparklines, sentiment meters)
- GitHub Pages hosting

## Data Sources & Methodology

| Signal | Source | Method |
|--------|--------|--------|
| Player stats | Sleeper API | 2025 per-game actuals |
| Projections | Sleeper API | Rest-of-season projections |
| Composite grade | Computed | Percentile scoring against position benchmarks |
| Age curves | EPA 2014-2024 study | Position-specific peak/decline/cliff ages |
| RB touch cliff | Historical research | Career touches > 2,500 = sharp decline |
| Dynasty value | Computed | Weighted: production (40%) + youth (30%) + longevity (15%) + position (15%) |
| Sentiment | Google News RSS | Keyword scoring on recent headlines |
| Trend analysis | Computed | Linear regression + coefficient of variation on multi-week stats |

---

Built with Claude.

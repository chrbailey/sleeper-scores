# What Actually Predicts NFL Fantasy Football Performance

> Research synthesis: 3 parallel agents, 72 web sources, covering predictive metrics, draft patterns, coordinator schemes, and market inefficiencies.

---

## Executive Summary

The fantasy football industry has a fundamental problem: **most analysis is descriptive, not predictive.** Touchdowns, yards per carry, and raw box score stats explain what happened last week but tell you almost nothing about next week. The research is unambiguous about what actually works — and the current sleeper-scores engine uses almost none of it.

**The three things that actually predict fantasy production:**

1. **Volume and opportunity** — Target share (R~0.73), weighted opportunities (R²=0.82 for RBs), and snap count percentage are far more predictive than any efficiency metric. The fantasy equivalent of Moneyball's "getting on base."

2. **Coordinator scheme fit** — The same quarterback produced a 102.5 passer rating under Kevin O'Connell and "saw ghosts" under Adam Gase. Scheme fit can swing a QB's production by an entire tier. Personnel groupings, PROE, and motion rate are stable coordinator tendencies that predict positional fantasy value.

3. **Process over results** — EPA per dropback (R~0.60), CPOE (R~0.51 filtered), and separation metrics predict future production. Touchdowns, YPC, and raw YAC do not. The distinction: process metrics capture repeatable skill; result metrics capture variance.

**What does NOT predict:**
- Touchdown rate at any position (high variance, low repeatability)
- Yards per carry / RYOE (essentially a coin flip year-to-year, R~0.21)
- Wonderlic/S2 cognitive scores (0.01% variance explained)
- Raw college passing stats (no significant correlation with NFL production)
- Single-game performance spikes or collapses

---

## Key Findings

### 1. The Predictive Tier List

Research across SumerSports, nfelo, PFF, 4for4, Football Outsiders, and academic sources converges on a clear hierarchy:

**Tier 1 — Highly Predictive (build your projections on these)**

| Metric | Year-to-Year R | Position | Why It Works |
|--------|---------------|----------|-------------|
| Target share | 0.70-0.73 | WR/TE | Volume is earned through scheme role, not luck |
| Weighted opportunities | R²=0.82 | RB | Targets weighted higher than carries — receiving RBs are more valuable and more predictable |
| Targets per game | Highest stability | WR | The single most predictable counting stat for receivers |
| Pass attempts per game | Strong | QB | Volume drives QB scoring more than efficiency |
| EPA per passing attempt | ~0.60 | QB | The stickiest QB efficiency metric since 2021 |

**Tier 2 — Predictive with caveats**

| Metric | Year-to-Year R | Notes |
|--------|---------------|-------|
| WOPR (air yards + target share) | ~0.63 | Blended opportunity metric |
| CPOE (filtered) | ~0.51 | Remove spikes/throwaways for best signal |
| EPA+CPOE composite | Strong | 2nd best QB predictor behind PFF grades |
| aDOT | >0.60 | Predicts role (deep threat vs slot), not points directly |
| RACR | Moderate-high | Receiving yards per air yard — efficiency that sticks |
| Separation (PASS) | 0.22 | Best non-counting predictive stat for WRs |
| PROE (coordinator tendency) | Stable | Coaching philosophy stripped of game script |

**Tier 3 — Descriptive only (do NOT project forward)**

| Metric | Why It Fails |
|--------|-------------|
| Touchdown rate | Pure variance — does not repeat |
| Yards per carry | ~0.21 correlation — coin flip |
| RYOE (rush yards over expected) | Skewed by big plays, doesn't predict |
| Raw YAC | Determined by pre-catch factors, not receiver skill |
| Time to throw | Explains style, doesn't predict points |
| EPA by down/distance splits | Sample sizes too small — falls apart in situational splits |

### 2. Coordinator Scheme Fit Is a Tier-Level Swing

The research shows scheme fit can move a player **one full production tier** — from replacement-level to Pro Bowl, or from Pro Bowl to MVP. This is the single biggest market inefficiency in fantasy.

**Case studies proving the magnitude:**

| Player | Bad Scheme | Good Scheme | Production Delta |
|--------|-----------|-------------|-----------------|
| Sam Darnold | Adam Gase (Jets): "saw ghosts" | Kevin O'Connell (MIN): 4,319yd, 35TD, 102.5 rating | Replacement → Franchise QB |
| Ryan Tannehill | Multiple (Miami): middle of pack | Arthur Smith (TEN): 2nd in NFL yards/game, 4.2 TD:INT | Average → Top-5 QB |
| Baker Mayfield | 5 OCs in 4 years (CLE): erratic | Liam Coen (TB): career bests across the board | Bust narrative → 2x Pro Bowl |
| Le'Veon Bell | Adam Gase (Jets): 3.2 YPC, worst in franchise history | Pittsburgh: perennial RB1 | Elite → Useless |
| Jared Goff | Jeff Fisher (Rams): dead last in NFL | Sean McVay (Rams): 2x Pro Bowl, Super Bowl | Bust → Star |

**Predictable coordinator tendencies:**

| Tendency | Stability | Fantasy Impact |
|----------|-----------|---------------|
| Personnel grouping preference | Very stable | Determines which positions see the field |
| PROE (pass rate over expected) | Stable | Pass-heavy OCs boost QB/WR; run-heavy boost RB |
| Motion rate | Growing across NFL (17%→34% in 6 years) | Higher motion = higher offensive efficiency |
| Run scheme type (zone vs gap) | Stable | Zone schemes manufacture RB production from lesser talent |
| Play-action rate | Moderately stable | High PA rate = "manufactured" production (scheme-dependent players) |

**The coaching tree matters:** The Shanahan tree (McVay, LaFleur, McDaniel, O'Connell, Coen) has consistently produced top offenses. Tracking coordinator lineage is more predictive than tracking individual coordinator stats.

### 3. The 2018 Draft Class Proves Everything

Five first-round QBs, five wildly different outcomes. The predictive signals were there — the industry just weighted the wrong things:

| QB | Pick | The Signal That Mattered | The Signal Everyone Watched |
|----|------|------------------------|---------------------------|
| Josh Allen | #7 | Improvement trajectory, physical tools, ability to grow with better coaching | 56.1% college completion (weak competition) — looked like a bust on paper |
| Lamar Jackson | #32 | Dual-threat rushing ability (50 college rushing TDs) — the strongest predictor of QB success per research | "Running QBs don't work in the NFL" — fell to pick 32 |
| Baker Mayfield | #1 | Needed scheme stability (5 OCs in 4 years destroyed him, stability in Tampa revived him) | "Johnny Manziel 2.0" narrative — character concerns |
| Sam Darnold | #3 | Needed the right system (O'Connell's scheme unlocked him 6 years later) | "Most NFL-ready passer" — which meant nothing |
| Josh Rosen | #10 | Character red flags + bad situation (fired coach after 1 year) | "Pro-style offense experience" — didn't transfer |

**The meta-lesson:** College rushing ability for QBs is a significant predictor of NFL success. College passing stats are NOT. The Wonderlic has zero predictive value (r²=0.0001). The S2 cognitive test already produced a false signal (Bryce Young 98th percentile → 2-14 starter; CJ Stroud 18th percentile → Offensive Rookie of the Year).

### 4. Market Inefficiencies (The Moneyball Angle)

The fantasy industry systematically misprices these:

**Overvalued:**
- QBs drafted in rounds 1-4 (the QB1-QB12 gap is only 6.8 PPR points/game — the smallest positional gap)
- RBs coming off career-high usage seasons (370+ touches = regression signal, not a buy signal)
- Tight ends priced on last year's TD production (TD rate is pure noise)
- "Name brand" players whose coordinator changed (Goff without McVay, Bell without Pittsburgh)

**Undervalued:**
- Target share and snap count percentage ("boring" volume stats that actually predict)
- Players in new coordinator situations where scheme fit improves (Darnold to O'Connell was a massive market inefficiency)
- Late-round QBs (replacement-level QBs outscore replacement-level RBs/WRs by a wide margin)
- Waiver wire pickups (projections are systematically too optimistic — reacting to actual production beats preseason rankings)
- Small, slow, late-round NFL draft picks who see high snap counts (the literal Moneyball players)

### 5. What the nflfastR Play-by-Play Data Can Tell Us

With 49,492 plays and 372 columns from the 2024 season, we can compute the predictive metrics that matter:

**Directly available:**
- EPA per play (by player, by down, by game situation)
- CPOE (completion probability over expected)
- Air yards, YAC, pass depth, pass location
- Down and distance context for every play
- Team matchups (posteam vs defteam)
- Weekly splits for consistency analysis

**Derivable:**
- Target share (player targets / team pass attempts)
- Air yards share (player air yards / team air yards)
- WOPR (weighted target share + air yard share)
- Weighted opportunities for RBs (targets weighted higher than carries)
- Throw complexity profile (deep vs short, left/middle/right distribution)
- Pressure performance (EPA when qb_hit = 1 vs 0)
- Consistency score (weekly EPA variance — low variance = reliable starter)
- System dependency score (how much of production comes from play-action, screens, RPOs)

**Not available (would need additional data):**
- Pre-snap motion rate per player (team-level only)
- Route-level separation data (Next Gen Stats, not in nflfastR)
- Defender coverage assignments

---

## Analysis: What This Means for sleeper-scores

The current dynasty engine weights youth at 3x, production at 2x, longevity at 1x. This is wrong for two reasons:

1. **Most fantasy leagues are single-season (redraft).** Dynasty value is irrelevant — THIS year's consistency is everything.
2. **Even for dynasty, youth without proven production is speculative.** A 22-year-old backup gets the same youth score as a 22-year-old starter.

The engine needs two modes:

**Redraft Mode (single season):**
- Weight: Target share/opportunity volume (40%), EPA efficiency (25%), scheme fit (20%), consistency (15%)
- No age curves, no dynasty value, no longevity
- Coordinator context: is this player in a system that elevates or depresses their skill set?
- Matchup awareness: which defenses give up production to this player's position/role?

**Dynasty Mode (multi-year):**
- Keep age curves but gate youth score by proven production (the fix we discussed)
- Add scheme stability factor (coordinator tenure, coaching tree stability)
- Weight coordinator fit alongside raw talent

---

## Recommendations

1. **Build the Python analysis pipeline on nflfastR data** to compute the Tier 1 and Tier 2 predictive metrics for every player.

2. **Create player "process profiles"** — not "how many points did they score?" but "how did they earn those points?" A QB who scored 25 points on screens and garbage time is fundamentally different from one who scored 25 on downfield throws in close games.

3. **Track coordinator tendencies as a first-class data entity.** When a coordinator changes, immediately flag all affected players and project impact based on the new coordinator's historical tendencies (PROE, personnel, motion rate, run scheme).

4. **Build a "system dependency score"** — how much of a player's production is manufactured by scheme (play action, screens, motion) vs created by the player independently? System-dependent players are volatile when coordinators change.

5. **Add a redraft mode** that ignores dynasty value entirely and focuses on this-season consistency prediction using the predictive metrics.

---

## Sources

72 sources across three research agents. Key references:

- SumerSports: Sticky Football Stats, CPOE stability, Shanahan schemes
- nfelo: EPA analysis, QB metrics comparison, team tendencies
- PFF: Draft hit rates, YAC pre-catch factors, scheme dependency, weighted opportunities
- 4for4: Most predictable stats by position, play-calling tendencies
- Football Outsiders: DVOA predictive evolution
- European Journal of Operational Research: College-to-NFL prediction models
- Fantasy Points: Average Separation Score, coaching change impacts
- FantasyPros, DraftSharks, PlayerProfiler: Coordinator change analysis
- ESPN, Yahoo Sports, Bleacher Report: 2018 draft class retrospectives
- Harvard Sports Analysis Collective: Wonderlic study
- Psychology Today: QB processing speed research

// engine/analytics.js — Convert play-by-play profile data into Explainable Results
// This replaces the box-score grading engine with actual predictive metrics.

export function analyzePlayer(profile, teamProfile) {
  if (!profile) return null;
  const type = profile.profileType;
  if (type === 'qb') return analyzeQB(profile, teamProfile);
  if (type === 'receiver') return analyzeReceiver(profile, teamProfile);
  if (type === 'rb') return analyzeRB(profile, teamProfile);
  return null;
}

// ── Rating: 0-99 scale from a raw metric using position-specific calibration ──
function rate(value, floor, ceiling) {
  if (value == null) return 50;
  const clamped = Math.max(floor, Math.min(ceiling, value));
  return Math.round(((clamped - floor) / (ceiling - floor)) * 99);
}

function rd(v, d) { return v != null ? Math.round(v * Math.pow(10, d || 2)) / Math.pow(10, d || 2) : null; }

// ══════════════════════════════════════
// QB Analysis
// ══════════════════════════════════════

function analyzeQB(p, team) {
  // Primary grade: EPA per dropback (THE stickiest QB metric)
  const epaRating = rate(p.epa_per_dropback, -0.15, 0.35);
  const cpoeRating = rate(p.cpoe, -5, 8);
  const pressureRating = rate(-1 * (p.pressure_delta || 0), -0.5, 0.1); // lower delta = better under pressure
  const consistencyRating = rate(p.consistency_score, 0, 0.15);
  const deepBallRating = rate(p.deep_ball_epa, -0.5, 0.3);

  // Composite: weighted by predictive research
  const composite = Math.round(
    epaRating * 0.35 +
    cpoeRating * 0.25 +
    consistencyRating * 0.20 +
    deepBallRating * 0.10 +
    pressureRating * 0.10
  );

  return {
    composite: buildResult(composite, 'QB Composite', `EPA(${epaRating}×.35) + CPOE(${cpoeRating}×.25) + Consistency(${consistencyRating}×.20) + DeepBall(${deepBallRating}×.10) + Pressure(${pressureRating}×.10)`, [
      'Weighted by year-to-year predictive power: EPA R~0.60, CPOE R~0.51',
      'Consistency = inverse coefficient of variation of weekly EPA',
    ]),
    epa: buildResult(rd(p.epa_per_dropback), 'EPA per Dropback', `${p.total_epa != null ? rd(p.total_epa, 1) : '?'} total EPA / ${p.pass_attempts || '?'} dropbacks = ${rd(p.epa_per_dropback)}`, [
      'Year-to-year correlation ~0.60 — the stickiest QB efficiency metric',
      'Median EPA is more predictive than mean — outlier plays add noise',
    ]),
    cpoe: buildResult(rd(p.cpoe, 1), 'CPOE (Completion Over Expected)', `Mean CPOE across ${p.pass_attempts || '?'} attempts = ${rd(p.cpoe, 1)}`, [
      'Filters out spike/throwaway noise for better signal (R~0.51 filtered)',
      'Measures actual accuracy vs expected — better than raw completion %',
    ]),
    deepBall: buildResult(rd(p.deep_ball_epa), 'Deep Ball EPA', `EPA on ${rd(p.deep_ball_rate * 100, 0)}% deep passes = ${rd(p.deep_ball_epa)}`, [
      'Deep ball ability is harder to scheme — more indicative of raw talent',
      `Short pass EPA: ${rd(p.short_pass_epa)} for comparison`,
    ]),
    pressure: buildResult(rd(p.pressure_delta), 'Pressure Performance', `Clean EPA: ${rd(p.clean_epa)} — Pressure EPA: ${rd(p.pressure_epa)} = delta ${rd(p.pressure_delta)}`, [
      `Sack rate: ${rd((p.sack_rate || 0) * 100, 1)}%`,
      'Lower delta = more resilient under pressure',
    ]),
    consistency: buildResult(rd(p.consistency_score, 3), 'Weekly Consistency', `Weekly EPA stdev: ${rd(p.weekly_epa_variance)} — Boom: ${rd((p.boom_rate || 0) * 100, 0)}% — Bust: ${rd((p.bust_rate || 0) * 100, 0)}%`, [
      'Consistency = 1/(1+CV) of weekly EPA — higher is more reliable',
      `${p.weekly_epa ? p.weekly_epa.length : '?'} weeks of data`,
    ]),
    fieldVision: buildFieldVision(p.pass_location_distribution),
    thirdDown: buildResult(rd(p.third_down_epa), '3rd Down EPA', `Conversion rate: ${rd((p.third_down_conversion_rate || 0) * 100, 0)}% — EPA: ${rd(p.third_down_epa)}`, [
      'Clutch metric — sustaining drives under pressure situations',
    ]),
    scheme: buildSchemeContext(team),
    stats: {
      pass_attempts: p.pass_attempts,
      epa_total: rd(p.total_epa, 1),
      deep_rate: rd((p.deep_ball_rate || 0) * 100, 0),
      shotgun_rate: rd((p.shotgun_rate || 0) * 100, 0),
      sack_rate: rd((p.sack_rate || 0) * 100, 1),
    },
    weeklyEpa: p.weekly_epa || [],
  };
}

// ══════════════════════════════════════
// WR/TE Analysis
// ══════════════════════════════════════

function analyzeReceiver(p, team) {
  const targetShareRating = rate(p.target_share, 0.05, 0.30);
  const woprRating = rate(p.wopr, 0.1, 0.6);
  const epaRating = rate(p.epa_per_target, -0.3, 0.5);
  const consistencyRating = rate(p.consistency_score, 0, 1);
  const adotRating = rate(p.adot, 4, 16);

  const composite = Math.round(
    targetShareRating * 0.30 +
    woprRating * 0.25 +
    epaRating * 0.20 +
    consistencyRating * 0.15 +
    adotRating * 0.10
  );

  return {
    composite: buildResult(composite, 'Receiver Composite', `TargetShare(${targetShareRating}×.30) + WOPR(${woprRating}×.25) + EPA(${epaRating}×.20) + Consistency(${consistencyRating}×.15) + aDOT(${adotRating}×.10)`, [
      'Target share (R~0.73) is the most predictive WR/TE metric year-to-year',
      'WOPR blends target share + air yards share — captures opportunity quality',
    ]),
    targetShare: buildResult(rd(p.target_share * 100, 1), 'Target Share', `${p.targets || '?'} targets / team pass attempts = ${rd(p.target_share * 100, 1)}%`, [
      'Year-to-year correlation ~0.73 — THE stickiest fantasy stat',
      'If a receiver demands targets one year, he almost certainly does the next',
    ]),
    wopr: buildResult(rd(p.wopr, 3), 'WOPR (Weighted Opportunity)', `(1.5 × ${rd(p.target_share, 3)} target share + 0.7 × ${rd(p.air_yards_share, 3)} air yards share) / 2.2 = ${rd(p.wopr, 3)}`, [
      'Year-to-year correlation ~0.63 — blends volume + depth',
      `Air yards share: ${rd((p.air_yards_share || 0) * 100, 1)}%`,
    ]),
    epa: buildResult(rd(p.epa_per_target), 'EPA per Target', `${p.targets || '?'} targets, mean EPA = ${rd(p.epa_per_target)}`, [
      'Efficiency metric — how much value each target generates',
    ]),
    adot: buildResult(rd(p.adot, 1), 'Average Depth of Target', `Mean air yards on ${p.targets || '?'} targets = ${rd(p.adot, 1)} yards`, [
      'Sticky year-to-year — reveals role (deep threat vs slot vs underneath)',
      `Deep target rate: ${rd((p.deep_target_rate || 0) * 100, 0)}%`,
    ]),
    yac: buildResult(rd(p.yac_per_reception, 1), 'YAC per Reception', `${rd(p.yac_per_reception, 1)} yards after catch per reception`, [
      'Raw YAC is NOT reliably repeatable — determined mostly by pre-catch factors',
      'Use for context, not prediction',
    ]),
    racr: buildResult(rd(p.racr, 2), 'RACR (Air Conversion Ratio)', `${p.receptions ? rd(p.yards_per_target * p.targets, 0) : '?'} rec yards / ${rd(p.air_yards_total, 0)} air yards = ${rd(p.racr, 2)}`, [
      'Receiving yards per air yard — efficiency of opportunity conversion',
      'Career RACR is nearly as sticky as volume metrics',
    ]),
    consistency: buildResult(rd(p.consistency_score, 2), 'Weekly Consistency', `Target stdev: ${rd(p.target_consistency, 1)} — weekly EPA variance drives score`, [
      'Low variance = scheme-integrated role, not matchup-dependent',
    ]),
    role: buildRoleProfile(p),
    scheme: buildSchemeContext(team),
    stats: {
      targets: p.targets,
      receptions: p.receptions,
      catch_rate: rd((p.catch_rate || 0) * 100, 0),
      deep_rate: rd((p.deep_target_rate || 0) * 100, 0),
      rz_targets: p.red_zone_targets,
      rz_share: rd((p.red_zone_target_share || 0) * 100, 0),
    },
    weeklyEpa: p.weekly_epa || [],
  };
}

// ══════════════════════════════════════
// RB Analysis
// ══════════════════════════════════════

function analyzeRB(p, team) {
  const weightedOppRating = rate(p.weighted_opportunities, 50, 400);
  const recWorkRating = rate(p.receiving_work_rate, 0, 0.30);
  const rushEpaRating = rate(p.rush_epa, -0.2, 0.1);
  const consistencyRating = rate(p.consistency_score, 0, 0.6);
  const goalLineRating = rate(p.goal_line_share, 0, 0.5);

  const composite = Math.round(
    weightedOppRating * 0.35 +
    recWorkRating * 0.25 +
    rushEpaRating * 0.15 +
    consistencyRating * 0.15 +
    goalLineRating * 0.10
  );

  return {
    composite: buildResult(composite, 'RB Composite', `WeightedOpp(${weightedOppRating}×.35) + RecWork(${recWorkRating}×.25) + RushEPA(${rushEpaRating}×.15) + Consistency(${consistencyRating}×.15) + GoalLine(${goalLineRating}×.10)`, [
      'Weighted opportunities (R²=0.82) is the most predictive RB metric',
      'Receiving work predicts RB fantasy success better than rushing efficiency',
    ]),
    weightedOpps: buildResult(rd(p.weighted_opportunities, 0), 'Weighted Opportunities', `${p.rush_attempts || '?'} carries + (${p.targets || '?'} targets × 1.5) = ${rd(p.weighted_opportunities, 0)}`, [
      'R² = 0.82 with fantasy points per game since 2017',
      'Targets weighted 1.5x because receiving work is more valuable and predictable',
    ]),
    receivingWork: buildResult(rd((p.receiving_work_rate || 0) * 100, 0), 'Receiving Work Rate', `${p.targets || '?'} targets / (${p.rush_attempts || '?'} carries + ${p.targets || '?'} targets) = ${rd((p.receiving_work_rate || 0) * 100, 0)}%`, [
      'Three-down back indicator — RBs with 20%+ receiving work are far more valuable',
      `${p.receptions || 0} receptions for ${rd(p.rec_yards, 0)} yards`,
    ]),
    rushEpa: buildResult(rd(p.rush_epa), 'Rush EPA per Carry', `${p.rush_attempts || '?'} carries, mean EPA = ${rd(p.rush_epa)}`, [
      'Yards per carry (R~0.21) is essentially a coin flip — EPA adds context',
      `YPC: ${rd(p.yards_per_carry, 1)} — negative play rate: ${rd((p.negative_play_rate || 0) * 100, 0)}%`,
    ]),
    goalLine: buildResult(rd((p.goal_line_share || 0) * 100, 0), 'Goal Line Share', `${p.goal_line_carries || 0} carries inside the 5 / team total = ${rd((p.goal_line_share || 0) * 100, 0)}%`, [
      'TD opportunity — the direct path to fantasy points',
      `Red zone touches: ${p.red_zone_touches || 0} (${rd((p.red_zone_share || 0) * 100, 0)}% share)`,
    ]),
    explosiveness: buildResult(rd((p.explosive_run_rate || 0) * 100, 0), 'Explosive Run Rate', `${rd((p.explosive_run_rate || 0) * 100, 0)}% of carries gained 10+ yards`, [
      `Negative play rate: ${rd((p.negative_play_rate || 0) * 100, 0)}%`,
      'High explosive + low negative = consistent chunk gains',
    ]),
    consistency: buildResult(rd(p.consistency_score, 2), 'Weekly Consistency', `Touch stdev: ${rd(p.touch_consistency, 1)} — EPA variance drives score`, [
      'Low variance = bellcow role, high variance = committee/game-script dependent',
    ]),
    scheme: buildSchemeContext(team),
    stats: {
      carries: p.rush_attempts,
      targets: p.targets,
      total_touches: p.total_touches,
      rush_yards: rd(p.total_rush_yards, 0),
      rec_yards: rd(p.rec_yards, 0),
      ypc: rd(p.yards_per_carry, 1),
      catch_rate: rd((p.catch_rate || 0) * 100, 0),
    },
    weeklyEpa: p.weekly_epa || [],
  };
}

// ══════════════════════════════════════
// Shared builders
// ══════════════════════════════════════

function buildResult(value, method, formula, caveats) {
  return {
    value: value,
    explain: {
      method: method,
      formula: formula,
      source: '2024-2025 nflfastR play-by-play data (98,263 plays)',
      caveats: caveats || [],
    },
  };
}

function buildFieldVision(dist) {
  if (!dist) return buildResult('N/A', 'Field Vision', 'No pass location data', []);
  const l = rd((dist.left || 0) * 100, 0);
  const m = rd((dist.middle || 0) * 100, 0);
  const r = rd((dist.right || 0) * 100, 0);
  const balance = 100 - Math.abs(l - r); // 100 = perfectly balanced
  return buildResult(balance, 'Field Vision Balance', `Left: ${l}% — Middle: ${m}% — Right: ${r}% — Balance: ${balance}`, [
    'Balanced field vision suggests the QB reads the full field',
    'Heavy one-side tendency may indicate locking onto first read',
  ]);
}

function buildRoleProfile(p) {
  const dist = p.location_distribution || {};
  const l = rd((dist.left || 0) * 100, 0);
  const m = rd((dist.middle || 0) * 100, 0);
  const r = rd((dist.right || 0) * 100, 0);
  let role = 'Unknown';
  if (m > 40) role = 'Slot / Middle';
  else if (p.adot > 12) role = 'Deep Threat';
  else if (p.adot > 8) role = 'Intermediate';
  else role = 'Underneath / Screen';

  return buildResult(role, 'Route Role', `Location: L${l}% M${m}% R${r}% — aDOT: ${rd(p.adot, 1)}`, [
    `Deep target rate: ${rd((p.deep_target_rate || 0) * 100, 0)}%`,
    `YAC/rec: ${rd(p.yac_per_reception, 1)} — high YAC suggests schemed touches`,
  ]);
}

function buildSchemeContext(team) {
  if (!team) return buildResult('Unknown', 'Team Scheme', 'No team profile available', ['Team profile data not loaded']);
  const scheme = team.scheme_classification || 'Unknown';
  const impact = team.fantasy_impact || {};
  const boosts = Object.entries(impact).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' '));
  return buildResult(scheme, 'Team Scheme', `${scheme} — PROE: ${rd(team.pass_rate_over_expected, 2)} — Pass rate: ${rd((team.pass_rate || 0) * 100, 0)}% — ${rd(team.plays_per_game, 0)} plays/game`, [
    boosts.length ? `Fantasy boosts: ${boosts.join(', ')}` : 'No strong positional boosts identified',
    `Team EPA/play: ${rd(team.team_epa_per_play)}`,
  ]);
}

// ══════════════════════════════════════
// Scout Report Generator
// ══════════════════════════════════════

export function generateScoutReport(analysis, playerName, position) {
  if (!analysis) return 'No analytical profile available for this player.';
  const parts = [];
  const comp = analysis.composite.value;
  const tier = comp >= 80 ? 'elite' : comp >= 65 ? 'strong' : comp >= 50 ? 'average' : comp >= 35 ? 'below average' : 'poor';

  if (analysis.composite.explain) {
    parts.push(`${playerName} grades as ${tier} (${comp}/99) among ${position}s based on play-by-play analysis of the 2024-2025 seasons.`);
  }

  // Position-specific insights
  if (position === 'QB') {
    const epa = analysis.epa.value;
    if (epa > 0.2) parts.push(`Elite efficiency: ${epa} EPA per dropback puts him among the top QBs in the league.`);
    else if (epa > 0.05) parts.push(`Solid efficiency at ${epa} EPA per dropback.`);
    else parts.push(`Concerning efficiency: ${epa} EPA per dropback is below average.`);

    if (analysis.deepBall.value > 0.1) parts.push(`Strong deep ball (${analysis.deepBall.value} EPA) — this is the hardest throw to scheme, suggesting real talent.`);
    if (analysis.pressure.value < -0.2) parts.push(`Significant pressure vulnerability (${analysis.pressure.value} delta) — production may be system-dependent.`);
    if (analysis.consistency.value > 0.08) parts.push('Unusually consistent weekly output — a reliable starter.');
    else parts.push('High weekly variance — boom/bust profile.');
  }

  if (position === 'WR' || position === 'TE') {
    const ts = analysis.targetShare.value;
    if (ts > 25) parts.push(`Dominant ${ts}% target share — the offense runs through him.`);
    else if (ts > 18) parts.push(`Strong ${ts}% target share — a primary option.`);
    else parts.push(`${ts}% target share — secondary or emerging role.`);

    if (analysis.role) parts.push(`Role: ${analysis.role.value}.`);
    if (analysis.adot && analysis.adot.value > 12) parts.push(`Deep threat profile (${analysis.adot.value} aDOT) — higher ceiling but more variance.`);
    if (analysis.racr && analysis.racr.value > 1.1) parts.push(`Exceptional air yards conversion (${analysis.racr.value} RACR) — maximizes every opportunity.`);
  }

  if (position === 'RB') {
    const wo = analysis.weightedOpps.value;
    parts.push(`${wo} weighted opportunities${wo > 250 ? ' — bellcow workload.' : wo > 150 ? ' — solid role.' : ' — limited or committee usage.'}`);

    const recRate = analysis.receivingWork.value;
    if (recRate > 20) parts.push(`Three-down back: ${recRate}% receiving work rate — the kind of usage that predicts elite fantasy output.`);
    else if (recRate > 10) parts.push(`Some receiving work (${recRate}%) — adds PPR floor.`);
    else parts.push(`Early-down specialist — limited receiving role hurts PPR value.`);

    if (analysis.goalLine && analysis.goalLine.value > 30) parts.push(`Controls the goal line (${analysis.goalLine.value}% share) — TD upside is real.`);
  }

  // Scheme context
  if (analysis.scheme && analysis.scheme.value !== 'Unknown') {
    parts.push(`Playing in a ${analysis.scheme.value} scheme.`);
  }

  return parts.join(' ');
}

// ══════════════════════════════════════
// Trade valuation (replaces dynasty engine for redraft)
// ══════════════════════════════════════

export function tradeValue(analysis) {
  if (!analysis) return { value: 0, explain: { method: 'No profile', formula: 'N/A', source: 'N/A', caveats: ['Player has no analytical profile'] } };
  return analysis.composite;
}

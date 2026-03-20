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

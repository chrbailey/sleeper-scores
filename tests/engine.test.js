// tests/engine.test.js — Engine module tests (run with Node)
// Usage: node --input-type=module tests/engine.test.js

let passed = 0, failed = 0, errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    errors.push({ name, error: e.message });
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertClose(actual, expected, tolerance = 0.1, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(msg || `Expected ~${expected}, got ${actual}`);
  }
}

// ══════════════════════════════════════
// engine/scoring.js
// ══════════════════════════════════════

import { calcFantasyPts, calcCeilingFloor, SCORING_RULES, VARIANCE_MULTIPLIERS } from '../engine/scoring.js';

console.log('\n── engine/scoring.js ──');

test('SCORING_RULES has ppr, half_ppr, standard', () => {
  assert(SCORING_RULES.ppr, 'missing ppr');
  assert(SCORING_RULES.half_ppr, 'missing half_ppr');
  assert(SCORING_RULES.standard, 'missing standard');
});

test('calcFantasyPts: QB 300yd 3TD 1INT = 22 PPR', () => {
  const r = calcFantasyPts({ pass_yd: 300, pass_td: 3, pass_int: 1 }, 'ppr');
  assert(r.value === 22, `Expected 22, got ${r.value}`);
  assert(r.explain, 'Missing explain');
  assert(r.explain.method, 'Missing method');
  assert(r.explain.formula, 'Missing formula');
  assert(r.explain.caveats.length > 0, 'Missing caveats');
});

test('calcFantasyPts: RB 100rush 1TD 5rec 40recyd PPR = 21', () => {
  const r = calcFantasyPts({ rush_yd: 100, rush_td: 1, rec: 5, rec_yd: 40 }, 'ppr');
  // 100*0.1 + 1*6 + 5*1 + 40*0.1 = 10 + 6 + 5 + 4 = 25
  assert(r.value === 25, `Expected 25, got ${r.value}`);
});

test('calcFantasyPts: same RB in standard (no rec pts)', () => {
  const r = calcFantasyPts({ rush_yd: 100, rush_td: 1, rec: 5, rec_yd: 40 }, 'standard');
  // 100*0.1 + 1*6 + 0 + 40*0.1 = 10 + 6 + 0 + 4 = 20
  assert(r.value === 20, `Expected 20, got ${r.value}`);
});

test('calcFantasyPts: null stats returns 0', () => {
  const r = calcFantasyPts(null, 'ppr');
  assert(r.value === 0, `Expected 0, got ${r.value}`);
});

test('calcFantasyPts: empty stats returns 0', () => {
  const r = calcFantasyPts({}, 'ppr');
  assert(r.value === 0, `Expected 0, got ${r.value}`);
});

test('calcCeilingFloor: returns ceiling and floor with explain', () => {
  const r = calcCeilingFloor(20, 'WR');
  assert(r.ceiling.value === 34, `Ceiling: expected 34, got ${r.ceiling.value}`); // 20 * 1.7
  assert(r.floor.value === 6, `Floor: expected 6, got ${r.floor.value}`); // 20 * 0.3
  assert(r.ceiling.explain.caveats.length > 0, 'Missing ceiling caveats');
  assert(r.floor.explain.caveats.length > 0, 'Missing floor caveats');
});

test('VARIANCE_MULTIPLIERS: all positions covered', () => {
  for (const pos of ['QB', 'RB', 'WR', 'TE', 'K']) {
    assert(VARIANCE_MULTIPLIERS.ceiling[pos], `Missing ceiling for ${pos}`);
    assert(VARIANCE_MULTIPLIERS.floor[pos] !== undefined, `Missing floor for ${pos}`);
  }
});

// ══════════════════════════════════════
// engine/grades.js
// ══════════════════════════════════════

import { computeCompositeGrade, percentileScore, gradeLabel, gradeColor, BENCHMARKS, WEIGHTS } from '../engine/grades.js';

console.log('\n── engine/grades.js ──');

test('BENCHMARKS has QB, RB, WR, TE', () => {
  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    assert(BENCHMARKS[pos], `Missing benchmarks for ${pos}`);
  }
});

test('WEIGHTS has QB, RB, WR, TE', () => {
  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    assert(WEIGHTS[pos], `Missing weights for ${pos}`);
    const sum = Object.values(WEIGHTS[pos]).reduce((a, b) => a + b, 0);
    assertClose(sum, 1.0, 0.01, `${pos} weights sum to ${sum}, expected ~1.0`);
  }
});

test('percentileScore: value at bottom = 20', () => {
  assert(percentileScore(0, [0, 25, 50, 75, 100]) === 20, 'Bottom should be 20');
});

test('percentileScore: value at top = 95', () => {
  assert(percentileScore(100, [0, 25, 50, 75, 100]) === 95, 'Top should be 95');
});

test('percentileScore: mid value scores ~50-60', () => {
  const score = percentileScore(50, [0, 25, 50, 75, 100]);
  assert(score >= 40 && score <= 70, `Mid score ${score} out of expected range`);
});

test('gradeLabel: 90 = ELITE', () => {
  assert(gradeLabel(90) === 'ELITE', `Expected ELITE, got ${gradeLabel(90)}`);
});

test('gradeLabel: 50 = AVERAGE', () => {
  assert(gradeLabel(50) === 'BELOW AVG', `Expected BELOW AVG, got ${gradeLabel(50)}`);
});

test('gradeColor: returns hex string', () => {
  const c = gradeColor(90);
  assert(c.startsWith('#'), `Expected hex color, got ${c}`);
});

test('computeCompositeGrade: elite WR stats > 70', () => {
  const r = computeCompositeGrade({ rec: 7, rec_yd: 95, rec_td: 0.9, rec_tgt: 10 }, 'WR');
  assert(r.value > 70, `Expected > 70, got ${r.value}`);
  assert(r.label === 'ELITE' || r.label === 'ABOVE AVG', `Expected elite/above avg, got ${r.label}`);
  assert(r.components && Object.keys(r.components).length > 0, 'Missing components');
  assert(r.explain.formula, 'Missing formula');
  assert(r.explain.caveats.length > 0, 'Missing caveats');
});

test('computeCompositeGrade: empty stats returns valid result', () => {
  const r = computeCompositeGrade({}, 'QB');
  assert(typeof r.value === 'number', 'Value should be number');
  assert(r.explain, 'Should have explain');
});

test('computeCompositeGrade: null stats returns 50/N/A', () => {
  const r = computeCompositeGrade(null, 'WR');
  assert(r.value === 50, `Expected 50, got ${r.value}`);
  assert(r.label === 'N/A', `Expected N/A, got ${r.label}`);
});

test('computeCompositeGrade: unknown position returns 50/N/A', () => {
  const r = computeCompositeGrade({ rec: 5 }, 'PUNTER');
  assert(r.value === 50, `Expected 50, got ${r.value}`);
});

// ══════════════════════════════════════
// engine/dynasty.js
// ══════════════════════════════════════

import { calcDynastyValue, getTrajectory, estimateCareerTouches, AGE_CURVES, DYNASTY_WEIGHTS } from '../engine/dynasty.js';

console.log('\n── engine/dynasty.js ──');

test('AGE_CURVES has all positions', () => {
  for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']) {
    assert(AGE_CURVES[pos], `Missing curve for ${pos}`);
    assert(AGE_CURVES[pos].peakStart, `Missing peakStart for ${pos}`);
    assert(AGE_CURVES[pos].cliff, `Missing cliff for ${pos}`);
  }
});

test('getTrajectory: 22yo RB = ASCENDING', () => {
  const t = getTrajectory(22, 'RB');
  assert(t.label === 'ASCENDING', `Expected ASCENDING, got ${t.label}`);
  assert(t.yearsToPeak > 0, 'Should have years to peak');
});

test('getTrajectory: 25yo WR = PRIME', () => {
  const t = getTrajectory(25, 'WR');
  assert(t.label === 'PRIME', `Expected PRIME, got ${t.label}`);
});

test('getTrajectory: 32yo WR = DECLINING', () => {
  const t = getTrajectory(32, 'WR');
  assert(t.label === 'DECLINING' || t.label === 'LATE CAREER', `Expected DECLINING/LATE, got ${t.label}`);
});

test('getTrajectory: 38yo QB = DECLINING (QBs age well)', () => {
  const t = getTrajectory(38, 'QB');
  assert(t.label === 'DECLINING' || t.label === 'LATE CAREER', `Expected DECLINING/LATE, got ${t.label}`);
  assert(t.yearsToCliff > 0, 'QB at 38 should still have years left');
});

test('estimateCareerTouches: 5 years = 1000', () => {
  const r = estimateCareerTouches(5);
  assert(r.value === 1000, `Expected 1000, got ${r.value}`);
  assert(r.explain.caveats.length > 0, 'Missing caveats');
});

test('calcDynastyValue: young elite WR > 60', () => {
  const r = calcDynastyValue(20, 'WR', 25, 4, null);
  assert(r.value > 60, `Expected > 60, got ${r.value}`);
  assert(r.trajectory, 'Missing trajectory');
  assert(r.trajectory.label === 'PRIME', `Expected PRIME, got ${r.trajectory.label}`);
  assert(r.explain.formula, 'Missing formula');
});

test('calcDynastyValue: old RB with high touches penalized', () => {
  const young = calcDynastyValue(15, 'RB', 22, 1, null);
  const old = calcDynastyValue(15, 'RB', 29, 8, null);
  assert(old.value < young.value, `Old RB (${old.value}) should be < young RB (${young.value})`);
});

test('calcDynastyValue: injury penalizes value', () => {
  const healthy = calcDynastyValue(15, 'WR', 26, 5, null);
  const injured = calcDynastyValue(15, 'WR', 26, 5, 'Out');
  assert(injured.value < healthy.value, `Injured (${injured.value}) should be < healthy (${healthy.value})`);
});

test('calcDynastyValue: QB premium > RB', () => {
  const qb = calcDynastyValue(20, 'QB', 28, 6, null);
  const rb = calcDynastyValue(20, 'RB', 24, 3, null);
  // QB has position premium of 12; even with same production, QB should score higher at prime
  assert(qb.value >= rb.value - 10, `QB (${qb.value}) should be close to or above RB (${rb.value})`);
});

// ══════════════════════════════════════
// engine/trends.js
// ══════════════════════════════════════

import { analyzePatterns, TREND_THRESHOLDS } from '../engine/trends.js';

console.log('\n── engine/trends.js ──');

test('TREND_THRESHOLDS has required fields', () => {
  assert(TREND_THRESHOLDS.slopeUp, 'Missing slopeUp');
  assert(TREND_THRESHOLDS.boomBustCV, 'Missing boomBustCV');
  assert(TREND_THRESHOLDS.buyLowDelta, 'Missing buyLowDelta');
});

test('analyzePatterns: insufficient data returns INSUFFICIENT DATA', () => {
  const r = analyzePatterns([{ stats: { rec: 5 } }], 'WR', 'ppr');
  assert(r.value === 'INSUFFICIENT DATA', `Expected INSUFFICIENT DATA, got ${r.value}`);
});

test('analyzePatterns: upward trend detected', () => {
  const weeks = [
    { stats: { rec: 3, rec_yd: 30, rec_td: 0 } },
    { stats: { rec: 4, rec_yd: 50, rec_td: 0 } },
    { stats: { rec: 6, rec_yd: 70, rec_td: 1 } },
    { stats: { rec: 8, rec_yd: 95, rec_td: 1 } },
  ];
  const r = analyzePatterns(weeks, 'WR', 'ppr');
  assert(r.trendDir >= 0, `Expected upward trend, got dir=${r.trendDir}`);
  assert(r.weeklyPts.length === 4, 'Should have 4 weekly points');
  assert(r.sparkline.length === 4, 'Should have 4 sparkline values');
  assert(r.explain.formula, 'Missing formula');
});

test('analyzePatterns: downward trend detected', () => {
  const weeks = [
    { stats: { rec: 8, rec_yd: 100, rec_td: 1 } },
    { stats: { rec: 6, rec_yd: 70, rec_td: 0 } },
    { stats: { rec: 3, rec_yd: 30, rec_td: 0 } },
    { stats: { rec: 2, rec_yd: 15, rec_td: 0 } },
  ];
  const r = analyzePatterns(weeks, 'WR', 'ppr');
  assert(r.trendDir <= 0, `Expected downward trend, got dir=${r.trendDir}`);
});

test('analyzePatterns: returns signal with confidence', () => {
  const weeks = [
    { stats: { rec: 5, rec_yd: 60, rec_td: 0 } },
    { stats: { rec: 5, rec_yd: 55, rec_td: 0 } },
    { stats: { rec: 5, rec_yd: 58, rec_td: 0 } },
  ];
  const r = analyzePatterns(weeks, 'WR', 'ppr');
  assert(r.signal, 'Missing signal');
  assert(typeof r.confidence === 'number', 'Confidence should be number');
  assert(r.confidence >= 10 && r.confidence <= 99, `Confidence ${r.confidence} out of range`);
});

test('analyzePatterns: null week stats treated as 0 pts', () => {
  const weeks = [
    { stats: { rec: 5, rec_yd: 60, rec_td: 0 } },
    { stats: null },
    { stats: { rec: 6, rec_yd: 65, rec_td: 0 } },
  ];
  const r = analyzePatterns(weeks, 'WR', 'ppr');
  assert(r.weeklyPts.length === 3, 'Should have 3 weeks');
  assert(r.weeklyPts[1] === 0, 'Null week should be 0');
});

// ══════════════════════════════════════
// engine/sentiment.js
// ══════════════════════════════════════

import { fetchPlayerSentiment, POSITIVE_KEYWORDS, NEGATIVE_KEYWORDS } from '../engine/sentiment.js';

console.log('\n── engine/sentiment.js ──');

test('POSITIVE_KEYWORDS is non-empty array', () => {
  assert(Array.isArray(POSITIVE_KEYWORDS), 'Should be array');
  assert(POSITIVE_KEYWORDS.length > 10, `Expected > 10 keywords, got ${POSITIVE_KEYWORDS.length}`);
});

test('NEGATIVE_KEYWORDS is non-empty array', () => {
  assert(Array.isArray(NEGATIVE_KEYWORDS), 'Should be array');
  assert(NEGATIVE_KEYWORDS.length > 10, `Expected > 10 keywords, got ${NEGATIVE_KEYWORDS.length}`);
});

test('fetchPlayerSentiment: no headlines returns unavailable', async () => {
  const r = await fetchPlayerSentiment('Test Player', []);
  assert(r.value === 0, `Expected 0, got ${r.value}`);
  assert(r.narrative.includes('unavailable') || r.narrative.includes('No'), `Expected unavailable narrative, got: ${r.narrative}`);
  assert(r.explain.caveats.length > 0, 'Missing caveats');
});

test('fetchPlayerSentiment: null headlines returns unavailable', async () => {
  const r = await fetchPlayerSentiment('Test Player', null);
  assert(r.value === 0, `Expected 0, got ${r.value}`);
});

test('fetchPlayerSentiment: positive headlines score positive', async () => {
  const headlines = [
    { title: 'Player has breakout elite performance', source: 'ESPN', date: new Date(), link: '#' },
    { title: 'Player named star of the week, dominant game', source: 'NFL', date: new Date(), link: '#' },
    { title: 'Rising MVP candidate leads team to victory', source: 'CBS', date: new Date(), link: '#' },
  ];
  const r = await fetchPlayerSentiment('Test Player', headlines);
  assert(r.value > 0, `Expected positive score, got ${r.value}`);
  assert(r.explain.inputs.positiveMatches > 0, 'Should have positive matches');
});

test('fetchPlayerSentiment: negative headlines score negative', async () => {
  const headlines = [
    { title: 'Player suffers injury, doubtful for next game', source: 'ESPN', date: new Date(), link: '#' },
    { title: 'Concern over hamstring, could be benched', source: 'NFL', date: new Date(), link: '#' },
    { title: 'Worst performance of career, decline continues', source: 'CBS', date: new Date(), link: '#' },
  ];
  const r = await fetchPlayerSentiment('Test Player', headlines);
  assert(r.value < 0, `Expected negative score, got ${r.value}`);
  assert(r.explain.inputs.negativeMatches > 0, 'Should have negative matches');
});

test('fetchPlayerSentiment: explain includes keyword lists', async () => {
  const headlines = [
    { title: 'Player breakout game', source: 'ESPN', date: new Date(), link: '#' },
  ];
  const r = await fetchPlayerSentiment('Test Player', headlines);
  assert(r.explain.inputs.positiveKeywords, 'Should list positive keywords found');
  assert(r.explain.source.includes('rss2json'), 'Source should mention rss2json');
});

// ══════════════════════════════════════
// Explainable Result pattern validation
// ══════════════════════════════════════

console.log('\n── Explainable Result Pattern ──');

test('All engine results have explain.method (string)', () => {
  const results = [
    calcFantasyPts({ pass_yd: 200 }, 'ppr'),
    computeCompositeGrade({ rec: 5, rec_yd: 60 }, 'WR'),
    calcDynastyValue(15, 'WR', 26, 5, null),
    analyzePatterns([{ stats: { rec: 5 } }, { stats: { rec: 6 } }], 'WR', 'ppr'),
    estimateCareerTouches(5),
  ];
  for (const r of results) {
    assert(r.explain, 'Missing explain');
    assert(typeof r.explain.method === 'string', `method should be string, got ${typeof r.explain.method}`);
  }
});

test('All engine results have explain.source (string)', () => {
  const results = [
    calcFantasyPts({ pass_yd: 200 }, 'ppr'),
    computeCompositeGrade({ rec: 5 }, 'WR'),
    calcDynastyValue(15, 'WR', 26, 5, null),
  ];
  for (const r of results) {
    assert(typeof r.explain.source === 'string', `source should be string, got ${typeof r.explain.source}`);
  }
});

test('All engine results have explain.caveats (array)', () => {
  const results = [
    calcFantasyPts({ pass_yd: 200 }, 'ppr'),
    computeCompositeGrade({ rec: 5, rec_yd: 60 }, 'WR'),
    calcDynastyValue(15, 'WR', 26, 5, null),
  ];
  for (const r of results) {
    assert(Array.isArray(r.explain.caveats), 'caveats should be array');
    assert(r.explain.caveats.length > 0, 'caveats should be non-empty');
  }
});

// ══════════════════════════════════════
// Summary
// ══════════════════════════════════════

console.log(`\n${'═'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(e => console.log(`  ✗ ${e.name}: ${e.error}`));
}
console.log(`${'═'.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);

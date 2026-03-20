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

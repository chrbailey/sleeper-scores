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

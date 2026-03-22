// ui/card.js — Player Intelligence Card: play-by-play analytics surface

import { React, html } from './htm.js';
import { GradeRing, Sparkline, SentimentMeter, StatChip, TrendArrow, PositionBadge } from './primitives.js';
import { ExplainPanel } from './explain.js';
import { gradeColor } from '../engine/grades.js';
import { generateScoutReport } from '../engine/analytics.js';
import { fetchPlayerSentiment } from '../engine/sentiment.js';
import { fetchHeadlines } from '../api/news.js';

const { useState, useEffect } = React;

// ── Metric definitions by position ──

const QB_METRICS = [
  { key: 'epa', label: 'EPA/db' },
  { key: 'cpoe', label: 'CPOE' },
  { key: 'deepBall', label: 'Deep Ball' },
  { key: 'pressure', label: 'Press Delta' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'thirdDown', label: '3rd Down' },
];

const WR_METRICS = [
  { key: 'targetShare', label: 'Tgt Share' },
  { key: 'wopr', label: 'WOPR' },
  { key: 'epa', label: 'EPA/tgt' },
  { key: 'adot', label: 'aDOT' },
  { key: 'racr', label: 'RACR' },
  { key: 'consistency', label: 'Consistency' },
];

const RB_METRICS = [
  { key: 'weightedOpps', label: 'Wtd Opps' },
  { key: 'receivingWork', label: 'Rec Work %' },
  { key: 'rushEpa', label: 'Rush EPA' },
  { key: 'goalLine', label: 'Goal Line %' },
  { key: 'explosiveness', label: 'Explosive %' },
  { key: 'consistency', label: 'Consistency' },
];

function metricsForPosition(pos) {
  if (pos === 'QB') return QB_METRICS;
  if (pos === 'RB') return RB_METRICS;
  return WR_METRICS; // WR + TE
}

// ── Compact key stat by position ──

function compactKeyStat(profile, pos) {
  if (!profile) return { label: '', value: '--' };
  if (pos === 'QB' && profile.epa) return { label: 'EPA', value: fmtVal(profile.epa.value) };
  if (pos === 'RB' && profile.weightedOpps) return { label: 'Opps', value: fmtVal(profile.weightedOpps.value) };
  if ((pos === 'WR' || pos === 'TE') && profile.targetShare) return { label: 'Tgt%', value: fmtVal(profile.targetShare.value) };
  return { label: '', value: '--' };
}

// ── Format a metric value for display ──

function fmtVal(v) {
  if (v == null) return '--';
  if (typeof v === 'string') return v;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed ? v.toFixed(2) : String(v);
}

// ── Metric value color ──

function metricColor(result) {
  if (!result || result.value == null) return 'var(--navy)';
  const explain = result.explain;
  if (!explain) return 'var(--navy)';
  // Use the composite-style rating if the value is 0-99 scale
  if (typeof result.value === 'number' && result.value >= 0 && result.value <= 99 && explain.method && explain.method.includes('Composite')) {
    return gradeColor(result.value);
  }
  return 'var(--navy)';
}

// ══════════════════════════════════════
// Main export
// ══════════════════════════════════════

export function PlayerIntelligenceCard({ player, stats, projections, currentWeek, scoringFormat, profile, compact, onClose }) {
  const [openPanel, setOpenPanel] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [loadingBuzz, setLoadingBuzz] = useState(true);

  const toggle = (id) => setOpenPanel(prev => prev === id ? null : id);

  const pos = player.position;
  const age = player.age || 0;

  // ── Async: news buzz (the one live data source) ──
  useEffect(() => {
    if (compact) return;
    setLoadingBuzz(true);
    const name = `${player.first_name} ${player.last_name}`;
    fetchHeadlines(name + ' NFL')
      .then(headlines => fetchPlayerSentiment(name, headlines))
      .then(sent => { setSentiment(sent); setLoadingBuzz(false); })
      .catch(() => setLoadingBuzz(false));
  }, [player.id, compact]);

  // ── Compact mode ──
  if (compact) {
    const keyStat = compactKeyStat(profile, pos);
    return html`
      <div class="card--compact">
        <${PositionBadge} position=${pos} />
        <span style=${{ flex: 1, fontSize: 12, fontWeight: 600 }}>
          ${player.first_name} ${player.last_name}
          <span class="text-meta" style=${{ fontSize: 10, marginLeft: 4 }}>${player.team || 'FA'}</span>
        </span>
        ${profile ? html`
          <${GradeRing} grade=${profile.composite.value} size=${26} />
          <span class="text-mono" style=${{ fontSize: 10, color: 'var(--meta)', minWidth: 44, textAlign: 'right' }}>
            ${keyStat.label} ${keyStat.value}
          </span>
        ` : html`
          <span class="text-meta" style=${{ fontSize: 10 }}>No profile</span>
        `}
      </div>
    `;
  }

  // ── Fallback: no analytical profile ──
  if (!profile) {
    return html`
      <div class="card fade-in">
        <div class="flex-between" style=${{ marginBottom: 12 }}>
          <div>
            <div class="flex-center" style=${{ gap: 8 }}>
              <${PositionBadge} position=${pos} />
              <span style=${{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>${player.first_name} ${player.last_name}</span>
              ${onClose && html`<span onClick=${onClose} style=${{ cursor: 'pointer', color: 'var(--meta)', fontSize: 16, marginLeft: 8 }}>x</span>`}
            </div>
            <div style=${{ fontSize: 11, color: 'var(--meta)', marginTop: 4 }}>
              ${player.team || 'FA'} · Age ${age}
            </div>
          </div>
        </div>
        <div style=${{ padding: '20px 12px', textAlign: 'center', color: 'var(--meta)', fontSize: 12, lineHeight: 1.6, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
          No play-by-play profile available. This player may be a rookie or had insufficient 2024-2025 data.
        </div>
      </div>
    `;
  }

  // ══════════════════════════════════════
  // Full mode
  // ══════════════════════════════════════

  const metrics = metricsForPosition(pos);
  const composite = profile.composite.value;
  const scheme = profile.scheme;
  const scoutReport = generateScoutReport(profile, `${player.first_name} ${player.last_name}`, pos);

  return html`
    <div class="card fade-in">

      ${renderHeader(player, pos, age, composite, scheme, openPanel, toggle, onClose)}

      ${renderMetricsGrid(profile, metrics, openPanel, toggle)}

      ${renderStatsBar(profile.stats, pos)}

      ${renderTrendRow(profile.weeklyEpa, openPanel, toggle)}

      ${renderNewsBuzz(sentiment, loadingBuzz, openPanel, toggle)}

      <div class="scout-report">
        <strong>Scout Report:</strong> ${scoutReport}
      </div>
    </div>
  `;
}

// ══════════════════════════════════════
// Header
// ══════════════════════════════════════

function renderHeader(player, pos, age, composite, scheme, openPanel, toggle, onClose) {
  const schemeName = scheme && scheme.value !== 'Unknown' ? scheme.value : null;

  return html`
    <div class="flex-between" style=${{ marginBottom: 12 }}>
      <div style=${{ flex: 1 }}>
        <div class="flex-center" style=${{ gap: 8 }}>
          <${PositionBadge} position=${pos} />
          <span style=${{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>${player.first_name} ${player.last_name}</span>
          ${onClose && html`<span onClick=${onClose} style=${{ cursor: 'pointer', color: 'var(--meta)', fontSize: 16, marginLeft: 4 }}>x</span>`}
        </div>
        <div style=${{ fontSize: 11, color: 'var(--meta)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>${player.team || 'FA'}</span>
          <span>Age ${age}</span>
          ${player.injury_status && html`<span style=${{ color: 'var(--red)', fontWeight: 600 }}>${player.injury_status}</span>`}
          ${schemeName && html`
            <span style=${{ fontSize: 9, fontWeight: 600, color: 'var(--blue)', background: 'var(--blue-bg)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--blue-border)' }}>${schemeName}</span>
          `}
        </div>
      </div>
      <${ExplainPanel} id="composite-ring" isOpen=${openPanel === 'composite-ring'} onToggle=${toggle} result=${scheme}>
        <${GradeRing} grade=${composite} size=${52} label="COMP" />
      <//>
    </div>
  `;
}

// ══════════════════════════════════════
// Primary Metrics Grid (6 cells)
// ══════════════════════════════════════

function renderMetricsGrid(profile, metrics, openPanel, toggle) {
  return html`
    <div class="stat-grid">
      ${metrics.map(m => {
        const result = profile[m.key];
        if (!result) return html`
          <div class="stat-cell" key=${m.key}>
            <div class="stat-cell__value" style=${{ color: 'var(--meta)' }}>--</div>
            <div class="stat-cell__label">${m.label}</div>
          </div>
        `;
        const val = fmtVal(result.value);
        return html`
          <${ExplainPanel} id=${m.key} isOpen=${openPanel === m.key} onToggle=${toggle} result=${result} key=${m.key}>
            <div class="stat-cell">
              <div class="stat-cell__value" style=${{ color: metricColor(result) }}>${val}</div>
              <div class="stat-cell__label">${m.label}</div>
            </div>
          <//>
        `;
      })}
    </div>
  `;
}

// ══════════════════════════════════════
// Stats Bar (position-specific raw stats)
// ══════════════════════════════════════

function renderStatsBar(profileStats, pos) {
  if (!profileStats) return null;
  const s = profileStats;

  const sep = html`<span class="stats-bar__sep">|</span>`;

  if (pos === 'QB') {
    return html`
      <div class="stats-bar">
        <${StatChip} label="Att" value=${s.pass_attempts || 0} />
        ${sep}
        <${StatChip} label="EPA" value=${s.epa_total != null ? s.epa_total : '--'} variant=${(s.epa_total || 0) > 0 ? 'good' : 'neutral'} />
        ${sep}
        <${StatChip} label="Deep%" value=${s.deep_rate != null ? s.deep_rate + '%' : '--'} />
        ${sep}
        <${StatChip} label="Sack%" value=${s.sack_rate != null ? s.sack_rate + '%' : '--'} variant=${(s.sack_rate || 0) > 6 ? 'bad' : 'neutral'} />
        ${sep}
        <${StatChip} label="Shotgun" value=${s.shotgun_rate != null ? s.shotgun_rate + '%' : '--'} />
      </div>
    `;
  }

  if (pos === 'RB') {
    return html`
      <div class="stats-bar">
        <${StatChip} label="Car" value=${s.carries || 0} />
        ${sep}
        <${StatChip} label="Tgt" value=${s.targets || 0} />
        ${sep}
        <${StatChip} label="Touch" value=${s.total_touches || 0} />
        ${sep}
        <${StatChip} label="RuYd" value=${s.rush_yards || 0} />
        ${sep}
        <${StatChip} label="RecYd" value=${s.rec_yards || 0} />
        ${sep}
        <${StatChip} label="YPC" value=${s.ypc || '--'} />
        ${sep}
        <${StatChip} label="Catch%" value=${s.catch_rate != null ? s.catch_rate + '%' : '--'} />
      </div>
    `;
  }

  // WR / TE
  return html`
    <div class="stats-bar">
      <${StatChip} label="Tgt" value=${s.targets || 0} />
      ${sep}
      <${StatChip} label="Rec" value=${s.receptions || 0} />
      ${sep}
      <${StatChip} label="Catch%" value=${s.catch_rate != null ? s.catch_rate + '%' : '--'} />
      ${sep}
      <${StatChip} label="Deep%" value=${s.deep_rate != null ? s.deep_rate + '%' : '--'} />
      ${sep}
      <${StatChip} label="RZ Tgt" value=${s.rz_targets || 0} variant="good" />
      ${sep}
      <${StatChip} label="RZ%" value=${s.rz_share != null ? s.rz_share + '%' : '--'} />
    </div>
  `;
}

// ══════════════════════════════════════
// Trend Row (pre-computed weeklyEpa sparkline)
// ══════════════════════════════════════

function renderTrendRow(weeklyEpa, openPanel, toggle) {
  if (!weeklyEpa || weeklyEpa.length < 2) return null;

  const recent = weeklyEpa.slice(-4);
  const earlier = weeklyEpa.slice(0, -4);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.length > 0 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : recentAvg;
  const trendDir = recentAvg > earlierAvg + 0.02 ? 1 : recentAvg < earlierAvg - 0.02 ? -1 : 0;
  const trendColor = trendDir > 0 ? '#16a34a' : trendDir < 0 ? '#dc2626' : '#6b7280';

  const trendResult = {
    value: Math.round(recentAvg * 100) / 100,
    explain: {
      method: 'Weekly EPA Trend',
      formula: `Recent 4-week avg: ${(recentAvg).toFixed(3)} vs earlier avg: ${(earlierAvg).toFixed(3)}`,
      source: '2024-2025 nflfastR play-by-play data (98,263 plays)',
      caveats: [
        `${weeklyEpa.length} weeks of EPA data`,
        'Trend direction based on 0.02 EPA threshold',
      ],
    },
  };

  return html`
    <div style=${{ marginBottom: 10 }}>
      <${ExplainPanel} id="trend" isOpen=${openPanel === 'trend'} onToggle=${toggle} result=${trendResult}>
        <div class="panel">
          <div class="panel__header">
            <span class="panel__title">EPA TREND</span>
            <div class="flex-center" style=${{ gap: 6 }}>
              <span class="text-mono" style=${{ fontSize: 10, fontWeight: 700, color: trendColor }}>${recentAvg.toFixed(2)}</span>
              <${TrendArrow} dir=${trendDir} size=${12} />
            </div>
          </div>
          <${Sparkline} data=${weeklyEpa} height=${28} color=${trendColor} />
          <div style=${{ fontSize: 9, color: 'var(--meta)', marginTop: 4 }}>
            ${weeklyEpa.length} weeks · Avg: ${(weeklyEpa.reduce((a, b) => a + b, 0) / weeklyEpa.length).toFixed(3)}
          </div>
        </div>
      <//>
    </div>
  `;
}

// ══════════════════════════════════════
// News Buzz (async live fetch)
// ══════════════════════════════════════

function renderNewsBuzz(sentiment, loadingBuzz, openPanel, toggle) {
  if (loadingBuzz) {
    return html`
      <div class="loading-pulse" style=${{ padding: 8, fontSize: 10, color: 'var(--meta)', marginBottom: 10 }}>Loading news buzz...</div>
    `;
  }

  if (!sentiment) return null;

  return html`
    <div style=${{ marginBottom: 10 }}>
      <${ExplainPanel} id="buzz" isOpen=${openPanel === 'buzz'} onToggle=${toggle} result=${sentiment}>
        <div class="panel">
          <div class="panel__header">
            <span class="panel__title">NEWS BUZZ</span>
            <div class="flex-center" style=${{ gap: 6 }}>
              <${SentimentMeter} score=${sentiment.value} width=${60} />
              <span class="text-mono" style=${{ fontSize: 10, fontWeight: 700, color: sentiment.value > 0 ? 'var(--green)' : sentiment.value < 0 ? 'var(--red)' : 'var(--meta)' }}>${sentiment.value > 0 ? '+' : ''}${sentiment.value}</span>
            </div>
          </div>
          <div style=${{ fontSize: 9, color: 'var(--meta)', lineHeight: 1.5 }}>
            ${sentiment.volume} articles (7d) · ${sentiment.narrative}
          </div>
          ${sentiment.headlines && sentiment.headlines.slice(0, 3).map((h, i) => html`
            <div key=${i} style=${{ fontSize: 9, color: 'var(--text-light)', padding: '2px 0', borderTop: i > 0 ? '1px solid var(--border-light)' : 'none', marginTop: i === 0 ? 4 : 0 }}>
              <a href=${h.link} target="_blank" rel="noopener" style=${{ color: 'var(--text-light)', textDecoration: 'none' }}>
                ${h.title.slice(0, 70)}${h.title.length > 70 ? '...' : ''}
              </a>
            </div>
          `)}
        </div>
      <//>
    </div>
  `;
}

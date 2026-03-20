// ui/card.js — Player Intelligence Card: surface layer + expandable depth

import { React, html } from './htm.js';
import { GradeRing, Sparkline, SentimentMeter, StatChip, SignalBadge, TrendArrow, PositionBadge, POS_COLORS } from './primitives.js';
import { ExplainPanel } from './explain.js';
import { computeCompositeGrade, gradeColor } from '../engine/grades.js';
import { calcDynastyValue, getTrajectory, AGE_CURVES } from '../engine/dynasty.js';
import { calcFantasyPts, calcCeilingFloor } from '../engine/scoring.js';
import { analyzePatterns } from '../engine/trends.js';
import { fetchPlayerSentiment } from '../engine/sentiment.js';
import { fetchHeadlines } from '../api/news.js';
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
      fetchHeadlines(name + ' NFL').then(headlines => fetchPlayerSentiment(name, headlines)),
      fetchMultiWeekStats(player.id, currentWeek || 6).then(weeks => analyzePatterns(weeks, pos, format)),
    ]).then(([sent, pat]) => {
      setSentiment(sent);
      setPatterns(pat);
      setLoadingIntel(false);
    }).catch(() => setLoadingIntel(false));
  }, [player.id, compact]);

  // -- Compact mode: one row --
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

  // -- Full mode --

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

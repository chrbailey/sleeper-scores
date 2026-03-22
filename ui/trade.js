// ui/trade.js — Trade Analyzer using pre-computed play-by-play analytics profiles

import { React, html } from './htm.js';
import { analyzePlayer, tradeValue } from '../engine/analytics.js';
import { getPlayerProfile, getTeamProfile } from '../api/profiles.js';
import { gradeColor } from '../engine/grades.js';
import { ExplainPanel } from './explain.js';
import { GradeRing, POS_COLORS, NFL_TEAMS } from './primitives.js';

const { useState, useMemo } = React;

function keyStat(analysis, position) {
  if (!analysis) return '\u2014';
  if (position === 'QB' && analysis.epa) {
    const v = analysis.epa.value;
    return v != null ? v.toFixed(2) + ' EPA/db' : '\u2014';
  }
  if ((position === 'WR' || position === 'TE') && analysis.targetShare) {
    const v = analysis.targetShare.value;
    return v != null ? v.toFixed(1) + '% ts' : '\u2014';
  }
  if (position === 'RB' && analysis.weightedOpps) {
    const v = analysis.weightedOpps.value;
    return v != null ? v + ' wOpp' : '\u2014';
  }
  return '\u2014';
}

export function TradeAnalyzer({ players, profiles }) {
  const [sideA, setSideA] = useState([]);
  const [sideB, setSideB] = useState([]);
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [openPanel, setOpenPanel] = useState(null);

  const searchPlayers = (query) => {
    if (!query || query.length < 2 || !players) return [];
    const q = query.toLowerCase();
    return Object.entries(players)
      .filter(([id, p]) =>
        (p.status === 'Active' || p.active === true || (p.team && p.team !== '')) &&
        p.position && ['QB', 'RB', 'WR', 'TE', 'K'].includes(p.position) &&
        ((`${p.first_name || ''} ${p.last_name || ''}`).toLowerCase().includes(q) ||
         (NFL_TEAMS[p.team] || '').includes(q)))
      .slice(0, 8)
      .map(([id, p]) => ({ id, ...p }));
  };

  const resultsA = useMemo(() => searchPlayers(searchA), [searchA, players]);
  const resultsB = useMemo(() => searchPlayers(searchB), [searchB, players]);

  const getAnalysis = (p) => {
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const profile = getPlayerProfile(profiles, fullName, p.position);
    const teamProfile = getTeamProfile(profiles, p.team);
    return analyzePlayer(profile, teamProfile);
  };

  const getComposite = (p) => {
    const analysis = getAnalysis(p);
    const tv = tradeValue(analysis);
    return tv.value || 0;
  };

  const totalComposite = (side) => side.reduce((s, p) => s + getComposite(p), 0);

  const addPlayer = (side, player) => {
    if (side === 'A') { setSideA(s => [...s, player]); setSearchA(''); }
    else { setSideB(s => [...s, player]); setSearchB(''); }
  };

  const compDiff = totalComposite(sideB) - totalComposite(sideA);
  const hasPlayers = sideA.length > 0 || sideB.length > 0;

  let verdict = '';
  let verdictColor = 'var(--meta)';
  let verdictDetail = '';

  if (hasPlayers) {
    if (Math.abs(compDiff) < 5) {
      verdict = 'FAIR TRADE';
      verdictColor = '#6b7280';
      verdictDetail = 'Even composite value \u2014 comes down to team needs.';
    } else if (compDiff > 20) {
      verdict = 'STRONG WIN';
      verdictColor = '#16a34a';
      verdictDetail = `You gain +${compDiff} composite points. Significant upgrade.`;
    } else if (compDiff > 5) {
      verdict = 'YOU WIN';
      verdictColor = '#22c55e';
      verdictDetail = `You gain +${compDiff} composite points. Favorable deal.`;
    } else if (compDiff < -20) {
      verdict = 'STRONG LOSS';
      verdictColor = '#dc2626';
      verdictDetail = `You lose ${Math.abs(compDiff)} composite points. Avoid.`;
    } else if (compDiff < -5) {
      verdict = 'YOU LOSE';
      verdictColor = '#f97316';
      verdictDetail = `You lose ${Math.abs(compDiff)} composite points. Reconsider.`;
    } else {
      verdict = 'MARGINAL';
      verdictColor = '#f59e0b';
      verdictDetail = 'Close call \u2014 consider your roster construction.';
    }
  }

  const verdictResult = hasPlayers ? {
    value: verdict,
    explain: {
      method: 'Composite value comparison: sum of analytics composite scores (0-99) for each side',
      formula: `Composite \u0394: ${totalComposite(sideB)} - ${totalComposite(sideA)} = ${compDiff > 0 ? '+' : ''}${compDiff}`,
      source: '2024-2025 nflfastR play-by-play analytics (98,263 plays)',
      caveats: [
        'Composite scores are weighted by year-to-year predictive research',
        'Players without profiles contribute 0 to the total',
      ],
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
        const analysis = getAnalysis(p);
        const composite = analysis ? analysis.composite.value : 0;
        const stat = keyStat(analysis, p.position);
        return html`
          <div key=${i} class="card--compact" style=${{
            marginBottom: 4, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style=${{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] || 'var(--meta)', width: 22 }}>${p.position}</span>
            <span style=${{ flex: 1, fontSize: 11, fontWeight: 600 }}>
              ${p.first_name} ${p.last_name}
              <span class="text-meta" style=${{ fontSize: 9 }}> ${p.team || 'FA'}</span>
            </span>
            <${GradeRing} grade=${composite} size=${26} />
            <span class="text-mono" style=${{ fontSize: 10, color: 'var(--text-light)', minWidth: 55, textAlign: 'right' }}>${stat}</span>
            <span onClick=${(e) => { e.stopPropagation(); setSide(s => s.filter((_, j) => j !== i)); }}
              style=${{ fontSize: 14, color: 'var(--red)', cursor: 'pointer', marginLeft: 4 }}>\u00d7</span>
          </div>
        `;
      })}
      ${side.length > 0 && html`
        <div class="flex-between" style=${{ marginTop: 6, fontSize: 11, fontWeight: 700 }}>
          <span style=${{ color: 'var(--navy)' }}>Composite Total: <span class="text-mono">${totalComposite(side)}</span></span>
        </div>
      `}
    </div>
  `;

  return html`
    <div class="fade-in" style=${{ margin: '10px 16px' }}>
      <div class="card" style=${{ padding: '16px 20px' }}>
        <div style=${{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>Trade Analyzer</div>
        <div style=${{ fontSize: 11, color: 'var(--meta)', marginBottom: 14 }}>Play-by-play composite scores (0-99). Click "Show Math" on the verdict.</div>
        <div class="trade-sides">
          ${renderSide(sideA, setSideA, searchA, setSearchA, resultsA, 'YOU GIVE', 'A')}
          <div class="trade-swap">${'\u21c4'}</div>
          ${renderSide(sideB, setSideB, searchB, setSearchB, resultsB, 'YOU GET', 'B')}
        </div>
        ${hasPlayers && verdict && html`
          <${ExplainPanel} id="verdict" isOpen=${openPanel === 'verdict'} onToggle=${(id) => setOpenPanel(p => p === id ? null : id)} result=${verdictResult}>
            <div class="verdict" style=${{ background: verdictColor + '10', borderLeft: `4px solid ${verdictColor}` }}>
              <div class="verdict__title" style=${{ color: verdictColor }}>${verdict}</div>
              <div class="verdict__detail">${verdictDetail}</div>
              <div class="verdict__stats">
                <span>Composite \u0394: <strong class="text-mono" style=${{ color: compDiff >= 0 ? 'var(--green)' : 'var(--red)' }}>${compDiff >= 0 ? '+' : ''}${compDiff}</strong></span>
              </div>
              <div style=${{ fontSize: 10, color: 'var(--blue)', marginTop: 6, fontWeight: 600 }}>Click to show math \u25bc</div>
            </div>
          <//>
        `}
      </div>
    </div>
  `;
}

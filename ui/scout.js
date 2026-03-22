// ui/scout.js — Player search + results table + intelligence card expansion
// Uses pre-computed play-by-play analytics profiles instead of box-score grading.

import { React, html } from './htm.js';
import { PlayerIntelligenceCard } from './card.js';
import { analyzePlayer } from '../engine/analytics.js';
import { getPlayerProfile, getTeamProfile } from '../api/profiles.js';
import { gradeColor } from '../engine/grades.js';
import { PositionBadge, POS_COLORS, NFL_TEAMS } from './primitives.js';

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

export function PlayerScout({ players, profiles }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [posFilter, setPosFilter] = useState('ALL');

  const playerCount = useMemo(() => players ? Object.keys(players).length : 0, [players]);

  const results = useMemo(() => {
    if (!query || query.length < 2 || !players || playerCount === 0) return [];
    const q = query.toLowerCase();

    const matched = Object.entries(players)
      .filter(([id, p]) => {
        const isActive = p.status === 'Active' || p.active === true || (p.team && p.team !== '');
        const validPos = p.position && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position);
        const posMatch = posFilter === 'ALL' || p.position === posFilter;
        const teamFull = NFL_TEAMS[p.team] || '';
        const nameMatch =
          (`${p.first_name || ''} ${p.last_name || ''}`).toLowerCase().includes(q) ||
          (p.team || '').toLowerCase().includes(q) ||
          teamFull.includes(q);
        return isActive && validPos && posMatch && nameMatch;
      })
      .map(([id, p]) => {
        const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
        const profile = getPlayerProfile(profiles, fullName, p.position);
        const teamProfile = getTeamProfile(profiles, p.team);
        const analysis = analyzePlayer(profile, teamProfile);
        const composite = analysis ? analysis.composite.value : null;
        return { id, ...p, analysis, composite };
      });

    // Sort: players with profiles by composite descending, then those without to the bottom
    matched.sort((a, b) => {
      if (a.composite != null && b.composite != null) return b.composite - a.composite;
      if (a.composite != null) return -1;
      if (b.composite != null) return 1;
      return 0;
    });

    return matched.slice(0, 25);
  }, [query, players, playerCount, posFilter, profiles]);

  if (selected) {
    return html`
      <div class="fade-in" style=${{ margin: '10px 16px' }}>
        <div onClick=${() => setSelected(null)}
          style=${{ fontSize: 12, color: 'var(--blue)', cursor: 'pointer', marginBottom: 8 }}>
          ${'<'}\u2014 Back to results
        </div>
        <${PlayerIntelligenceCard} player=${selected} profile=${selected.analysis} onClose=${() => setSelected(null)} />
      </div>
    `;
  }

  if (results.length > 0) {
    return html`
      <div class="fade-in" style=${{ margin: '10px 16px' }}>
        <div style=${{ marginBottom: 4 }}>
          <div style=${{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Player Intelligence Scout</div>
          <div style=${{ fontSize: 11, color: 'var(--meta)' }}>Play-by-play analytics profiles. Composite 0-99. Click Intel to see full breakdown.</div>
        </div>

        <div style=${{ display: 'flex', gap: 6, marginBottom: 10, marginTop: 10 }}>
          <input class="search-input" value=${query}
            onInput=${e => { setQuery(e.target.value); setSelected(null); }}
            placeholder="Search player name or NFL team..." />
          ${['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => html`
            <button key=${pos} onClick=${() => { setPosFilter(pos); setSelected(null); }}
              class="nav-tab" style=${{
                fontWeight: posFilter === pos ? 700 : 400, fontSize: 11,
                background: posFilter === pos ? (POS_COLORS[pos] || 'var(--navy)') : 'var(--surface)',
                color: posFilter === pos ? '#fff' : 'var(--meta)',
                border: posFilter === pos ? 'none' : '1px solid var(--border)',
              }}>${pos}</button>
          `)}
        </div>

        <div class="results-table">
          <div class="results-table__header">
            <span>POS</span><span>NAME</span><span>TEAM</span><span>COMPOSITE</span><span>KEY STAT</span><span></span>
          </div>
          ${results.map(p => {
            const compositeDisplay = p.composite != null ? String(p.composite) : '\u2014';
            const compositeColor = p.composite != null ? gradeColor(p.composite) : 'var(--meta)';
            const stat = keyStat(p.analysis, p.position);
            return html`
              <div key=${p.id} class="results-table__row" onClick=${() => setSelected(p)}>
                <span style=${{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] || 'var(--meta)' }}>${p.position}</span>
                <span style=${{ fontWeight: 600 }}>
                  ${p.first_name} ${p.last_name}
                  ${p.injury_status && html`<span style=${{ fontSize: 9, color: 'var(--red)', marginLeft: 4 }}>${p.injury_status}</span>`}
                </span>
                <span class="text-meta" style=${{ fontSize: 10 }}>${p.team || 'FA'}</span>
                <span class="text-mono" style=${{ fontSize: 11, fontWeight: 700, color: compositeColor }}>${compositeDisplay}</span>
                <span class="text-mono" style=${{ fontSize: 10, color: 'var(--text-light)' }}>${stat}</span>
                <span style=${{ fontSize: 10, color: 'var(--blue)', fontWeight: 600 }}>Intel \u2192</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  if (query.length >= 2) {
    return html`
      <div class="fade-in" style=${{ margin: '10px 16px' }}>
        <div style=${{ marginBottom: 4 }}>
          <div style=${{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Player Intelligence Scout</div>
          <div style=${{ fontSize: 11, color: 'var(--meta)' }}>Play-by-play analytics profiles. Composite 0-99. Click Intel to see full breakdown.</div>
        </div>

        <div style=${{ display: 'flex', gap: 6, marginBottom: 10, marginTop: 10 }}>
          <input class="search-input" value=${query}
            onInput=${e => { setQuery(e.target.value); setSelected(null); }}
            placeholder="Search player name or NFL team..." />
          ${['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => html`
            <button key=${pos} onClick=${() => { setPosFilter(pos); setSelected(null); }}
              class="nav-tab" style=${{
                fontWeight: posFilter === pos ? 700 : 400, fontSize: 11,
                background: posFilter === pos ? (POS_COLORS[pos] || 'var(--navy)') : 'var(--surface)',
                color: posFilter === pos ? '#fff' : 'var(--meta)',
                border: posFilter === pos ? 'none' : '1px solid var(--border)',
              }}>${pos}</button>
          `)}
        </div>

        <div style=${{ padding: 20, textAlign: 'center', color: 'var(--meta)', fontSize: 13 }}>
          No active players found matching "${query}".
        </div>
      </div>
    `;
  }

  // Default state: no query yet
  return html`
    <div class="fade-in" style=${{ margin: '10px 16px' }}>
      <div style=${{ marginBottom: 4 }}>
        <div style=${{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Player Intelligence Scout</div>
        <div style=${{ fontSize: 11, color: 'var(--meta)' }}>Play-by-play analytics profiles. Composite 0-99. Click Intel to see full breakdown.</div>
      </div>

      <div style=${{ display: 'flex', gap: 6, marginBottom: 10, marginTop: 10 }}>
        <input class="search-input" value=${query}
          onInput=${e => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Search player name or NFL team..." />
        ${['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => html`
          <button key=${pos} onClick=${() => { setPosFilter(pos); setSelected(null); }}
            class="nav-tab" style=${{
              fontWeight: posFilter === pos ? 700 : 400, fontSize: 11,
              background: posFilter === pos ? (POS_COLORS[pos] || 'var(--navy)') : 'var(--surface)',
              color: posFilter === pos ? '#fff' : 'var(--meta)',
              border: posFilter === pos ? 'none' : '1px solid var(--border)',
            }}>${pos}</button>
        `)}
      </div>

      <div style=${{ padding: 30, textAlign: 'center', color: 'var(--meta)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div style=${{ fontSize: 24, marginBottom: 8 }}>🔬</div>
        <div style=${{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Player Intelligence Database</div>
        <div style=${{ fontSize: 12 }}>
          ${playerCount > 0 ? `${playerCount.toLocaleString()} players loaded. Search by name or NFL team.` : 'Loading player database...'}
        </div>
      </div>
    </div>
  `;
}

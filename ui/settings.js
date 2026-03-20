// ui/settings.js — Configuration panel

import { React, html } from './htm.js';
import { DEFAULT_CONFIG, saveConfig } from '../config.js';
import { getUser, getUserLeagues } from '../api/sleeper.js';

const { useState } = React;

export function Settings({ config, onSave }) {
  const [draft, setDraft] = useState({ ...config });
  const [username, setUsername] = useState(config.sleeperUsername || '');
  const [lookupStatus, setLookupStatus] = useState(null);

  const lookupUser = async () => {
    if (!username.trim()) return;
    setLookupStatus('Looking up...');
    try {
      const user = await getUser(username.trim());
      if (!user || !user.user_id) { setLookupStatus('User not found'); return; }
      setLookupStatus(`Found: ${user.display_name} (ID: ${user.user_id})`);
      const leagues = await getUserLeagues(user.user_id);
      if (leagues && leagues.length > 0) {
        const newLeagues = leagues.slice(0, 4).map((lg, i) => ({
          id: lg.league_id, name: lg.name || `League ${i + 1}`,
          isCommissioner: lg.owner_id === user.user_id,
        }));
        while (newLeagues.length < 4) newLeagues.push({ id: '', name: `League ${newLeagues.length + 1}`, isCommissioner: false });
        setDraft(d => ({ ...d, leagues: newLeagues }));
        setLookupStatus(`Found ${leagues.length} league(s) — showing first ${Math.min(4, leagues.length)}`);
      } else { setLookupStatus('No NFL leagues found for this season.'); }
    } catch (e) { setLookupStatus('Lookup failed: ' + e.message); }
  };

  const handleSave = () => {
    const updated = { ...draft, sleeperUsername: username };
    saveConfig(updated);
    onSave(updated);
  };

  return html`
    <div class="settings-panel fade-in">
      <div style=${{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Settings</div>
      <div style=${{ fontSize: 12, color: 'var(--meta)', marginBottom: 14, lineHeight: 1.5 }}>
        Enter your Sleeper username to auto-detect leagues. All data comes from the free Sleeper API.
      </div>

      <div style=${{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input class="settings-input" value=${username} onInput=${e => setUsername(e.target.value)}
          placeholder="Sleeper username" onKeyDown=${e => { if (e.key === 'Enter') lookupUser(); }} />
        <button class="btn btn--green" onClick=${lookupUser}>Auto-Detect Leagues</button>
      </div>
      ${lookupStatus && html`<div style=${{ fontSize: 11, color: lookupStatus.includes('Found') ? 'var(--green)' : 'var(--red)', marginBottom: 10 }}>${lookupStatus}</div>`}

      <div class="settings-field">
        <label class="settings-label">Scoring Format</label>
        <div class="settings-radio-group">
          ${['ppr', 'half_ppr', 'standard'].map(fmt => html`
            <label key=${fmt} style=${{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="radio" name="scoring" checked=${draft.scoringFormat === fmt}
                onChange=${() => setDraft(d => ({ ...d, scoringFormat: fmt }))} />
              ${fmt === 'ppr' ? 'PPR' : fmt === 'half_ppr' ? 'Half-PPR' : 'Standard'}
            </label>
          `)}
        </div>
      </div>

      <div class="settings-field">
        <label class="settings-label">Your Leagues</label>
        ${(draft.leagues || []).map((lg, i) => html`
          <div key=${i} style=${{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input class="settings-input" style=${{ width: 140 }} value=${lg.name}
              onInput=${e => { const v = e.target.value; setDraft(d => ({ ...d, leagues: d.leagues.map((l, j) => j === i ? { ...l, name: v } : l) })); }}
              placeholder=${`League ${i + 1}`} />
            <input class="settings-input" style=${{ flex: 1, fontFamily: 'var(--mono)' }} value=${lg.id}
              onInput=${e => { const v = e.target.value; setDraft(d => ({ ...d, leagues: d.leagues.map((l, j) => j === i ? { ...l, id: v } : l) })); }}
              placeholder="Sleeper League ID" />
          </div>
        `)}
      </div>

      <div style=${{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button class="btn btn--primary" onClick=${handleSave}>Save</button>
        <button class="btn btn--secondary" onClick=${() => { setDraft({ ...DEFAULT_CONFIG }); setUsername(''); }}>Reset to Defaults</button>
      </div>
    </div>
  `;
}

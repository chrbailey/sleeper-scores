// ui/explain.js — ExplainPanel: the "show your work" controlled component

import { React, html } from './htm.js';

export function ExplainPanel({ id, isOpen, onToggle, result, children }) {
  if (!result) return children;

  return html`
    <div class="explainable" onClick=${(e) => { e.stopPropagation(); onToggle(id); }}
         style=${{ cursor: 'pointer' }}>
      ${children}
      ${isOpen && result.explain && html`
        <div class="explain-depth" onClick=${(e) => e.stopPropagation()}>
          <div class="explain-header">
            <span class="explain-title">HOW THIS WAS CALCULATED</span>
            <span class="explain-collapse" onClick=${() => onToggle(id)}>collapse ^</span>
          </div>
          <div class="explain-method">${result.explain.method}</div>
          ${result.components && html`<${ExplainComponents} components=${result.components} />`}
          ${result.explain.formula && html`
            <div class="explain-formula">${result.explain.formula}</div>
          `}
          ${result.explain.source && html`
            <div style=${{ fontSize: 9, color: '#6b7280', marginBottom: 4 }}>
              Source: ${result.explain.source}
            </div>
          `}
          ${result.explain.caveats?.length > 0 && html`
            <div class="explain-caveats">
              <strong>Caveats:</strong> ${result.explain.caveats.join(' · ')}
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

function ExplainComponents({ components }) {
  const entries = Object.entries(components);
  if (entries.length === 0) return null;

  return html`
    <div class="explain-components">
      ${entries.map(([key, comp]) => {
        const isTotal = key === 'total';
        return html`
          <div class=${`explain-component ${isTotal ? 'explain-component--total' : ''}`}>
            <div class="flex-between">
              <span style=${{ color: '#6b7280' }}>${key}</span>
              <span style=${{ fontWeight: 700, fontFamily: 'var(--mono)', color: comp.percentile >= 70 ? '#16a34a' : comp.percentile >= 55 ? '#22c55e' : comp.percentile >= 40 ? '#f59e0b' : '#dc2626' }}>
                ${typeof comp.percentile === 'number' ? Math.round(comp.percentile) : comp.percentile}
              </span>
            </div>
            <div style=${{ color: '#9ca3af', fontSize: 9, marginTop: 2 }}>
              ${comp.raw !== undefined ? `${comp.raw}` : ''}
              ${Array.isArray(comp.benchmarks) ? ` vs [${comp.benchmarks.join(', ')}]` : comp.benchmarks ? ` (${comp.benchmarks})` : ''}
              ${comp.weight ? ` · wt ${comp.weight}` : ''}
            </div>
          </div>
        `;
      })}
    </div>
  `;
}

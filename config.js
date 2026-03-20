// config.js — User configuration persistence via localStorage

const STORAGE_KEY = 'sleeper-scores-config';

export const DEFAULT_CONFIG = {
  sleeperUsername: '',
  scoringFormat: 'ppr',
  leagues: [
    { id: '', name: 'League 1', isCommissioner: false },
    { id: '', name: 'League 2', isCommissioner: false },
    { id: '', name: 'League 3', isCommissioner: false },
    { id: '', name: 'League 4', isCommissioner: false },
  ],
};

export function loadConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_CONFIG, ...stored };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

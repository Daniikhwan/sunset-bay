// Progress between visits: cash, finished jobs and the best haul. One key
// in localStorage; a missing or corrupt entry just means a fresh start.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { cash: 0, jobs: 0, best: 0 };
    const data = JSON.parse(raw);
    return {
      cash: Number(data.cash) || 0,
      jobs: Number(data.jobs) || 0,
      best: Number(data.best) || 0,
    };
  } catch {
    return { cash: 0, jobs: 0, best: 0 };
  }
}

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: data.cash || 0,
      jobs: data.jobs || 0,
      best: data.best || 0,
    }));
  } catch {
    // Storage can be off (private windows): the run still counts.
  }
}

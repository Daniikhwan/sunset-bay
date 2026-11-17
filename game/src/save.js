// Save and load for Sunset Bay: money earned, missions finished and the best
// haul, kept in this browser's localStorage. Every call is guarded, so a
// browser with storage off just plays without saving.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: Number.isFinite(data.money) ? data.money : 0,
      missionIndex: Number.isInteger(data.missionIndex) ? data.missionIndex : 0,
      best: Number.isFinite(data.best) ? data.best : 0,
      storyDone: data.storyDone === true,
    };
  } catch {
    return null;
  }
}

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: data.money | 0,
      missionIndex: data.missionIndex | 0,
      best: data.best | 0,
      storyDone: data.storyDone === true,
    }));
  } catch {
    // Storage off: the run still counts, it just is not kept.
  }
}

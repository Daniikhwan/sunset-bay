// Sunset Bay — save and load. Progress (money, missions finished, best
// wanted level survived) lives in localStorage and is restored on boot.
import { W } from './world.js';

const KEY = 'sunset-bay-save-v1';

export function saveGame() {
  try {
    const data = {
      money: W.money,
      missionIndex: W.missionIndex,
      missionDone: W.missionDone,
      storyDone: W.storyDone,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    W.money = data.money;
    W.missionIndex = data.missionIndex | 0;
    if (Array.isArray(data.missionDone)) W.missionDone = data.missionDone.slice(0, 4);
    W.storyDone = !!data.storyDone;
    if (W.missionIndex >= 4) W.storyDone = true;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable — the game still plays, it just cannot persist.
  }
}

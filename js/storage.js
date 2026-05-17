const SAVE_KEY = 'rail-empire-save';

export class GameStorage {
  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  saveGame(state) {
    try {
      const seen = new WeakSet();
      const json = JSON.stringify(state, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return undefined;
          seen.add(value);
        }
        if (typeof value === 'function') return undefined;
        if (value !== value) return null; // NaN
        if (value === Infinity || value === -Infinity) return null;
        return value;
      });
      localStorage.setItem(SAVE_KEY, json);
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Load failed:', e);
      return null;
    }
  }

  deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }
}

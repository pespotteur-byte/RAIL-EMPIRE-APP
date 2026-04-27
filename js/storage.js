const SAVE_KEY = 'rail-empire-save';

export class GameStorage {
  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  saveGame(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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

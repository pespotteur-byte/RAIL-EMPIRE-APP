const SAVE_KEY = 'rail-empire-save';

export class GameStorage {
  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  saveGame(state) {
    try {
      const json = JSON.stringify(state);
      localStorage.setItem(SAVE_KEY, json);
    } catch (e) {
      console.warn('Save failed:', e);
      if (e?.name === 'QuotaExceededError') {
        alert('Sauvegarde échouée : espace de stockage plein. Exportez votre sauvegarde JSON.');
      }
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

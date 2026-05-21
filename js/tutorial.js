/**
 * Tutorial — Interactive step-by-step guide for new players.
 * Overlay-based, does not modify any game state.
 */
export class Tutorial {
  constructor() {
    this.steps = [
      {
        title: 'Bienvenue dans Rail Empire !',
        text: 'Ce tutoriel va vous guider pas à pas pour créer votre première ligne ferroviaire. Vous pouvez le quitter à tout moment.',
        target: null,
        page: null,
      },
      {
        title: '1. Créer des gares',
        text: 'Cliquez sur <b>"+ Créer une gare"</b> en haut à gauche de la carte, puis cliquez sur la carte pour placer votre première gare. Répétez pour en créer au moins 2.',
        target: '#btn-create-station',
        page: 'map',
      },
      {
        title: '2. Matériel Roulant',
        text: 'Allez dans l\'onglet <b>"Matériel"</b> pour ajouter des engins (locomotives, voitures, wagons). Chaque engin a une vitesse max, un tonnage et une capacité.',
        target: '[data-page="rolling-stock"]',
        page: 'rolling-stock',
      },
      {
        title: '3. Composer une Rame',
        text: 'Allez dans <b>"Rames"</b> pour assembler vos engins en rames. Une rame = locomotive + voitures. C\'est la rame qui circulera sur vos lignes.',
        target: '[data-page="rames"]',
        page: 'rames',
      },
      {
        title: '4. Créer un Horaire',
        text: 'Dans <b>"Horaires"</b>, créez un nouveau service : choisissez une rame, ajoutez les gares de départ et d\'arrivée, définissez les heures. Le train partira automatiquement à l\'heure prévue.',
        target: '[data-page="schedules"]',
        page: 'schedules',
      },
      {
        title: '5. Créer une Ligne',
        text: 'Dans <b>"Lignes"</b>, vous pouvez regrouper vos services par ligne (ex: Ligne A Paris-Lyon). C\'est optionnel mais aide à organiser votre réseau.',
        target: '[data-page="lines"]',
        page: 'lines',
      },
      {
        title: '6. Dépôts & Maintenance',
        text: 'Les <b>"Dépôts"</b> permettent de réparer et entretenir vos rames. Quand l\'usure atteint un niveau élevé, envoyez la rame en maintenance préventive pour éviter les pannes.',
        target: '[data-page="depots"]',
        page: 'depots',
      },
      {
        title: '7. Finances',
        text: 'L\'onglet <b>"Finances"</b> montre vos revenus (passagers, fret) et dépenses (exploitation, maintenance, salaires). Gardez un œil sur votre solde !',
        target: '[data-page="economy"]',
        page: 'economy',
      },
      {
        title: '8. Dashboard',
        text: 'Le <b>"Dashboard"</b> donne une vue d\'ensemble en temps réel : ponctualité, trains en circulation, retard moyen, et des graphiques sur 24h.',
        target: '[data-page="dashboard"]',
        page: 'dashboard',
      },
      {
        title: '9. Personnel',
        text: 'Dans <b>"Personnel"</b>, embauchez des conducteurs et affectez-les à vos services. Chaque conducteur coûte 120€/jour en salaire.',
        target: '[data-page="staff"]',
        page: 'staff',
      },
      {
        title: '10. Sauvegarde',
        text: 'Le jeu sauvegarde automatiquement toutes les 10 secondes. Vous pouvez aussi exporter votre partie en fichier JSON avec le bouton 💾 en haut à droite.',
        target: '#btn-save-file',
        page: null,
      },
      {
        title: 'C\'est parti !',
        text: 'Vous êtes prêt à construire votre empire ferroviaire. Commencez par créer 2 gares sur la carte, puis ajoutez du matériel roulant. Bonne chance !',
        target: null,
        page: null,
      },
    ];
    this.currentStep = 0;
    this.active = false;
    this._overlay = null;
  }

  start(game) {
    this.currentStep = 0;
    this.active = true;
    this._game = game;
    this._createOverlay();
    this._renderStep();
  }

  stop() {
    this.active = false;
    this._removeOverlay();
  }

  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this._renderStep();
    } else {
      this.stop();
    }
  }

  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this._renderStep();
    }
  }

  _createOverlay() {
    this._removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-backdrop"></div>
      <div class="tutorial-box">
        <div class="tutorial-header">
          <span class="tutorial-step-counter"></span>
          <button class="tutorial-close">&times;</button>
        </div>
        <h3 class="tutorial-title"></h3>
        <p class="tutorial-text"></p>
        <div class="tutorial-nav">
          <button class="tutorial-prev">← Précédent</button>
          <button class="tutorial-next">Suivant →</button>
        </div>
      </div>
      <div class="tutorial-highlight"></div>
    `;
    document.body.appendChild(overlay);
    this._overlay = overlay;

    overlay.querySelector('.tutorial-close').addEventListener('click', () => this.stop());
    overlay.querySelector('.tutorial-prev').addEventListener('click', () => this.prev());
    overlay.querySelector('.tutorial-next').addEventListener('click', () => this.next());
  }

  _removeOverlay() {
    const el = document.getElementById('tutorial-overlay');
    if (el) el.remove();
    this._overlay = null;
  }

  _renderStep() {
    if (!this._overlay || !this.active) return;
    const step = this.steps[this.currentStep];

    // Navigate to correct page if needed
    if (step.page && this._game?.ui) {
      this._game.ui.switchPage(step.page);
    }

    // Update content
    this._overlay.querySelector('.tutorial-title').textContent = step.title;
    this._overlay.querySelector('.tutorial-text').innerHTML = step.text;
    this._overlay.querySelector('.tutorial-step-counter').textContent = `${this.currentStep + 1} / ${this.steps.length}`;

    // Navigation buttons
    const prevBtn = this._overlay.querySelector('.tutorial-prev');
    const nextBtn = this._overlay.querySelector('.tutorial-next');
    prevBtn.style.visibility = this.currentStep > 0 ? 'visible' : 'hidden';
    nextBtn.textContent = this.currentStep < this.steps.length - 1 ? 'Suivant →' : 'Terminer ✓';

    // Highlight target element
    const highlight = this._overlay.querySelector('.tutorial-highlight');
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        highlight.style.display = 'block';
        highlight.style.top = (rect.top - 4) + 'px';
        highlight.style.left = (rect.left - 4) + 'px';
        highlight.style.width = (rect.width + 8) + 'px';
        highlight.style.height = (rect.height + 8) + 'px';
      } else {
        highlight.style.display = 'none';
      }
    } else {
      highlight.style.display = 'none';
    }
  }
}

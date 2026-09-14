import { WindowedList } from './windowed-list.js';
import { clockText, trainStatus, safeSprite, setText } from './operations-view-model.js';
export class HeadquartersPage {
    constructor(root, data) {
        this.data = data;
        this.timer = null;
        this.compositions = new WeakMap();
        this.root = root;
        root.innerHTML = `<div class="page-content qg-content">
          <div class="page-header"><div><span class="re-eyebrow">RAIL EMPIRE · EXPLOITATION</span><h2>Quartier général</h2></div><span class="qg-clock"></span></div>
          <div class="qg-kpis">
            <section><span>Fret transporté</span><strong id="qg-freight">0 t</strong><small>Cumul livré / déchargé</small></section>
            <section><span>Voyageurs transportés</span><strong id="qg-passengers">0</strong><small>Cumul des voyageurs descendus</small></section>
            <section><span>Trains en exploitation</span><strong id="qg-active">0</strong><small class="qg-company"></small></section>
          </div>
          <p class="qg-total-note">Cumuls depuis la création de cette partie, conservés dans sa sauvegarde. Un voyageur est compté à la descente, le fret au déchargement — pas à partir des capacités.</p>
          <div class="qg-toolbar"><label>Rechercher un train, une rame ou une gare<input id="qg-search" type="search" placeholder="Numéro, nom, origine, destination…"></label><span id="qg-count" role="status"></span></div>
          <div id="qg-empty" class="re-empty" hidden>Aucun train en exploitation. Les trains apparaissent à leur préparation au départ.</div>
          <div id="qg-fleet" aria-label="Compositions des trains en exploitation"></div>
          <p class="qg-footnote">Toutes les compositions restent accessibles. Défilement vertical pour les trains, horizontal pour les longues rames. Aucune carte n’est chargée ici.</p>
        </div>`;
        this.search = root.querySelector('#qg-search');
        this.list = new WindowedList(root.querySelector('#qg-fleet'), 140, r => r.id, (r, old) => this.row(r, old));
        this.search.addEventListener('input', () => this.refresh(true));
        this.setActive(true);
    }
    row(row, old) {
        const node = old || document.createElement('article');
        if (!old) {
            node.className = 'qg-train';
            node.innerHTML = `<div class="qg-train-title"><strong></strong><span class="qg-state"></span></div><div class="qg-consist" tabindex="0" aria-label="Composition du train"></div><div class="qg-journey"></div><div class="qg-rame-caption"></div>`;
        }
        node.dataset.serviceId = row.id;
        setText(node, '.qg-train-title strong', `${row.name || 'Train'}${row.number && !row.name.includes(row.number) ? ' · ' + row.number : ''}`);
        setText(node, '.qg-state', trainStatus(row.state, row.delay, row.speed));
        setText(node, '.qg-journey', `${row.origin || 'Origine inconnue'} · ${clockText(row.departure)}  →  ${row.destination || 'Destination inconnue'} · ${clockText(row.arrival)}`);
        setText(node, '.qg-rame-caption', `${row.rameName || 'Composition'} · ${row.elements.length} engin${row.elements.length > 1 ? 's' : ''}`);
        const strip = node.querySelector('.qg-consist');
        // Compare references too: the imported livery can change without changing vehicle identity.
        const signature = row.elements.map(e => `${String(e.elementId || e.instanceName || e.name || '')}|${String(e.imageData || '')}|${e.flipped ? 1 : 0}`).join('\n');
        if (this.compositions.get(strip) !== signature) {
            const scroll = strip.scrollLeft, fragment = document.createDocumentFragment();
            for (const e of row.elements) {
                const src = safeSprite(e.imageData), label = String(e.instanceName || e.name || e.category || 'Engin');
                if (src) {
                    const img = document.createElement('img');
                    img.src = src;
                    img.alt = label;
                    img.title = label;
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    if (e.flipped)
                        img.style.transform = 'scaleX(-1)';
                    fragment.appendChild(img);
                }
                else {
                    const missing = document.createElement('span');
                    missing.className = 'qg-missing-sprite';
                    missing.textContent = label;
                    fragment.appendChild(missing);
                }
            }
            if (!row.elements.length) {
                const empty = document.createElement('span');
                empty.textContent = 'Composition non disponible';
                fragment.appendChild(empty);
            }
            strip.replaceChildren(fragment);
            this.compositions.set(strip, signature);
            strip.scrollLeft = scroll;
        }
        return node;
    }
    refresh(reset = false) {
        const d = this.data(), fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
        setText(this.root, '#qg-freight', fmt.format(d.freightTonnes) + ' t');
        setText(this.root, '#qg-passengers', new Intl.NumberFormat('fr-FR').format(d.passengers));
        setText(this.root, '#qg-active', String(d.rows.length));
        setText(this.root, '.qg-company', d.company);
        setText(this.root, '.qg-clock', d.clock);
        const needle = this.search.value.trim().toLocaleLowerCase('fr');
        const rows = needle ? d.rows.filter(r => `${r.name} ${r.number} ${r.origin} ${r.destination} ${r.rameName}`.toLocaleLowerCase('fr').includes(needle)) : d.rows;
        setText(this.root, '#qg-count', `${rows.length} / ${d.rows.length} train${d.rows.length > 1 ? 's' : ''}`);
        this.root.querySelector('#qg-empty').hidden = !!rows.length;
        this.list.setRows(rows, reset);
    }
    setActive(active) {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (active) {
            this.refresh();
            this.timer = setInterval(() => this.refresh(), 1000);
        }
    }
    dispose() { this.setActive(false); this.list.dispose(); }
}

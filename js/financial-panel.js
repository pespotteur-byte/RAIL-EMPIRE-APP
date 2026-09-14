function element(root, selector) {
    const found = root.querySelector(selector);
    if (!found)
        throw new Error('Élément financier absent : ' + selector);
    return found;
}
import { htmlText } from './html-text.js';
export function financePage(history, view, size = 100) {
    const query = view.query.trim().toLocaleLowerCase('fr-FR');
    const from = view.from ? Date.parse(view.from + 'T00:00:00Z') : -Infinity;
    const to = view.to ? Date.parse(view.to + 'T23:59:59.999Z') : Infinity;
    let count = 0;
    const rows = [], page = Math.max(0, Math.floor(view.page || 0));
    for (let i = history.length - 1; i >= 0; i--) {
        const row = history[i];
        if (!row)
            continue;
        const t = Number(row.time);
        if (view.type && row.type !== view.type)
            continue;
        if ((Number.isFinite(from) || Number.isFinite(to)) && (!Number.isFinite(t) || t < from || t > to))
            continue;
        if (query && !`${row.category ?? ''} ${row.description ?? ''}`.toLocaleLowerCase('fr-FR').includes(query))
            continue;
        if (count >= page * size && rows.length < size)
            rows.push(row);
        count++;
    }
    const last = Math.max(0, Math.ceil(count / size) - 1);
    if (page > last)
        return financePage(history, { ...view, page: last }, size);
    return { rows, count, page };
}
export function financialCSV(history) {
    const cell = (value) => { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s))
        s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = ['date_utc;type;categorie;montant;description'];
    for (const row of history) {
        const time = Number(row.time);
        rows.push([cell(Number.isFinite(time) && Number.isFinite(new Date(time).getTime()) ? new Date(time).toISOString() : ''), cell(row.type), cell(row.category), cell(row.amount), cell(row.description)].join(';'));
    }
    return '\uFEFF' + rows.join('\r\n');
}
export function renderFinancialPanel(host, economy, bank, view) {
    const euro = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    host.className = 're-financial-panel';
    host.innerHTML = `<h3>Récapitulatif financier complet</h3>
      <p>Journal et bilans conservés sans limite de nombre depuis RC19. La pagination ne supprime rien. ${economy.historyInheritedTruncation ? '<strong>Les anciennes versions ont pu effacer des écritures : elles ne peuvent pas être reconstruites.</strong>' : ''}</p>
      <div class="re-finance-totals"></div>
      <details><summary>Ventilation complète par catégorie et par ligne</summary><div class="re-finance-breakdown"></div></details>
      <details><summary>Bilans journaliers conservés (${economy.dailySnapshots.length})</summary><div class="re-finance-days"></div></details>
      <div class="re-finance-filters">
        <label>Rechercher <input type="search" data-finance="query" placeholder="Catégorie ou description"></label>
        <label>Type <select data-finance="type"><option value="">Tous</option><option value="revenue">Entrées</option><option value="expense">Sorties</option><option value="cargo_return">Restitutions</option></select></label>
        <label>Depuis (UTC) <input type="date" data-finance="from"></label><label>Jusqu'au (UTC) <input type="date" data-finance="to"></label>
        <button type="button" class="btn-secondary" data-finance="json">Tout exporter (JSON financier)</button>
        <button type="button" class="btn-secondary" data-finance="csv">Toutes les écritures (CSV)</button>
      </div>
      <div class="re-finance-pager"><button type="button" class="btn-secondary" data-finance="prev">← Plus récentes</button><output></output><button type="button" class="btn-secondary" data-finance="next">Plus anciennes →</button></div>
      <div class="re-finance-rows"></div><p class="re-chart-help">Les exports financiers ne remplacent pas une sauvegarde de partie. Les emprunts reçus sont des financements, pas des recettes d'exploitation.</p>`;
    const block = element(host, '.re-finance-totals');
    const totals = [['Solde', economy.balance], ['Recettes cumulées', economy.revenue], ['Dépenses cumulées', economy.expenses], ['Résultat cumulé', economy.revenue - economy.expenses], ['Pénalités (incluses dans les dépenses)', economy.penalties], ['Recettes du jour', economy._currentDayRevenue], ['Dépenses du jour', economy._currentDayExpenses], ['Dette bancaire restante', bank?.getTotalDebt() || 0]];
    block.innerHTML = totals.map(([label, value]) => `<div><span>${htmlText(label)}</span><strong>${htmlText(euro(value))}</strong></div>`).join('');
    const table = (heading, rows) => `<div class="re-finance-scroll"><table><thead><tr>${heading.map(h => '<th>' + htmlText(h) + '</th>').join('')}</tr></thead><tbody>${rows.map(row => '<tr>' + row.map(c => '<td>' + htmlText(c) + '</td>').join('') + '</tr>').join('')}</tbody></table></div>`;
    // Lazy details: opening a section renders its data, not every LiveMap frame.
    const details = host.querySelectorAll('details');
    const breakdownDetails = details[0], dailyDetails = details[1];
    if (!breakdownDetails || !dailyDetails)
        throw new Error('Panneaux financiers manquants');
    breakdownDetails.ontoggle = () => {
        if (!breakdownDetails.open)
            return;
        const keys = [...new Set([...Object.keys(economy.revenueByCategory), ...Object.keys(economy.expenseByCategory)])].sort();
        const lines = [...new Set([...Object.keys(economy.lineRevenue), ...Object.keys(economy.lineExpense)])].sort();
        element(host, '.re-finance-breakdown').innerHTML = table(['Catégorie', 'Recettes', 'Dépenses', 'Net'], keys.map(k => [k, euro(economy.revenueByCategory[k]), euro(economy.expenseByCategory[k]), euro((economy.revenueByCategory[k] || 0) - (economy.expenseByCategory[k] || 0))])) + table(['Ligne', 'Recettes', 'Dépenses', 'Net'], lines.map(k => [k, euro(economy.lineRevenue[k]), euro(economy.lineExpense[k]), euro((economy.lineRevenue[k] || 0) - (economy.lineExpense[k] || 0))]));
    };
    dailyDetails.ontoggle = () => {
        if (!dailyDetails.open)
            return;
        const body = element(host, '.re-finance-days');
        let dayPage = 0;
        const drawDays = () => {
            const pages = Math.max(1, Math.ceil(economy.dailySnapshots.length / 100));
            const slice = economy.dailySnapshots.slice(Math.max(0, economy.dailySnapshots.length - (dayPage + 1) * 100), economy.dailySnapshots.length - dayPage * 100).reverse();
            body.innerHTML = `<div class="re-finance-pager"><button type="button" class="btn-secondary" data-days="prev">←</button><span>Page ${dayPage + 1}/${pages}</span><button type="button" class="btn-secondary" data-days="next">→</button></div>` + table(['Date', 'Recettes', 'Dépenses', 'Résultat', 'Solde'], slice.map(d => [String(d.date || ''), euro(d.revenue), euro(d.expenses), euro(d.profit), euro(d.balance)]));
            const prev = element(body, '[data-days="prev"]'), next = element(body, '[data-days="next"]');
            prev.disabled = dayPage === 0;
            next.disabled = dayPage >= pages - 1;
            prev.onclick = () => { dayPage--; drawDays(); };
            next.onclick = () => { dayPage++; drawDays(); };
        };
        drawDays();
    };
    const redraw = () => {
        const page = financePage(economy.history, view);
        view.page = page.page;
        element(host, '.re-finance-rows').innerHTML = table(['Date / heure (Paris)', 'Type', 'Catégorie', 'Description', 'Montant'], page.rows.map(row => { const time = Number(row.time); return [Number.isFinite(time) && Number.isFinite(new Date(time).getTime()) ? new Date(time).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : 'Non enregistrée', { revenue: 'Recette', expense: 'Dépense', cargo_return: 'Restitution' }[String(row.type)] || String(row.type || ''), String(row.category || ''), String(row.description || ''), euro(row.amount)]; }));
        host.querySelector('output').textContent = `${page.count.toLocaleString('fr-FR')} écritures · page ${page.page + 1}/${Math.max(1, Math.ceil(page.count / 100))}`;
        element(host, '[data-finance="prev"]').disabled = page.page === 0;
        element(host, '[data-finance="next"]').disabled = (page.page + 1) * 100 >= page.count;
    };
    for (const name of ['query', 'type', 'from', 'to']) {
        const el = element(host, `[data-finance="${name}"]`);
        el.value = view[name];
        el.onchange = () => { view[name] = el.value; view.page = 0; redraw(); };
        if (name === 'query')
            el.oninput = el.onchange;
    }
    element(host, '[data-finance="prev"]').onclick = () => { view.page--; redraw(); };
    element(host, '[data-finance="next"]').onclick = () => { view.page++; redraw(); };
    const download = (content, mime, name) => { const url = URL.createObjectURL(new Blob([content], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); };
    element(host, '[data-finance="json"]').onclick = () => download(JSON.stringify({ schema: 'RE_FINANCE_1', generatedAt: Date.now(), economy: economy.toSave(), bank: bank?.toSave() || null }), 'application/json', 'Rail_Empire_finances_RC19.json');
    element(host, '[data-finance="csv"]').onclick = () => download(financialCSV(economy.history), 'text/csv;charset=utf-8', 'Rail_Empire_journal_RC19.csv');
    redraw();
}

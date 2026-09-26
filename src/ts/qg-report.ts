/**
 * Rapport d'exploitation du QG : 7 jours à 1 an, exporté en PDF via la boîte
 * d'impression du navigateur (fonctionne hors connexion et en file://).
 */

export const QG_REPORT_PERIODS: Array<{ days: number; label: string }> = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '3 mois' },
  { days: 180, label: '6 mois' },
  { days: 365, label: '1 an' },
];

export type QgHistoryEntry = { type?: unknown; amount?: unknown; category?: unknown; description?: unknown; time?: unknown };
export type QgRameRow = { name: string; serial: string; elements: string[]; totalKm: number; wearLevel: number; inMaintenance: boolean; defects: number; location: string };
export type QgTrainRow = { name: string; number: string; origin: string; destination: string; state: string; delay: number; rameName: string };
export type QgStaffRow = { role: string; count: number; onDuty: number };

export interface QgReportInput {
  company: string;
  generatedAt: string;
  days: number;
  nowMs: number;
  balance: number;
  history: QgHistoryEntry[];
  passengers: number;
  freightTonnes: number;
  rames: QgRameRow[];
  trains: QgTrainRow[];
  staff: QgStaffRow[];
  mode: 'facile' | 'expert';
}

export type QgFinanceSummary = {
  revenue: number; expenses: number; penalties: number; net: number;
  byCategory: Array<{ category: string; revenue: number; expenses: number }>;
  entries: number;
};

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const num = (n: number, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);

export function summarizeFinance(history: QgHistoryEntry[], nowMs: number, days: number): QgFinanceSummary {
  const from = nowMs - days * 86_400_000;
  const cats = new Map<string, { revenue: number; expenses: number }>();
  let revenue = 0, expenses = 0, penalties = 0, entries = 0;
  for (const h of history) {
    const t = Number(h.time);
    if (!Number.isFinite(t) || t < from || t > nowMs) continue;
    const amount = Number(h.amount) || 0;
    const cat = String(h.category || 'divers');
    const c = cats.get(cat) || { revenue: 0, expenses: 0 };
    entries++;
    if (h.type === 'revenue') { revenue += amount; c.revenue += amount; }
    else if (h.type === 'expense') { expenses += amount; c.expenses += amount; if (/p[eé]nal/i.test(cat) || /p[eé]nalit/i.test(String(h.description ?? ''))) penalties += amount; }
    cats.set(cat, c);
  }
  const byCategory = [...cats.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => (b.revenue + b.expenses) - (a.revenue + a.expenses));
  return { revenue, expenses, penalties, net: revenue - expenses, byCategory, entries };
}

export function buildQgReportHtml(input: QgReportInput): string {
  const fin = summarizeFinance(input.history, input.nowMs, input.days);
  const period = QG_REPORT_PERIODS.find((p) => p.days === input.days)?.label || `${input.days} jours`;
  const late = input.trains.filter((t) => t.delay >= 5).length;
  const avgWear = input.rames.length ? input.rames.reduce((a, r) => a + r.wearLevel, 0) / input.rames.length : 0;
  const rows = (cells: string[]) => `<tr>${cells.join('')}</tr>`;
  const td = (v: unknown, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${esc(v)}</td>`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${esc(input.company)} — Rapport ${esc(period)}</title>
<style>
  body{font:11pt/1.4 Arial,Helvetica,sans-serif;color:#111;margin:18mm 14mm}
  h1{font-size:20pt;margin:0 0 2mm}h2{font-size:13pt;margin:8mm 0 2mm;border-bottom:1px solid #999;padding-bottom:1mm;page-break-after:avoid}
  .meta{color:#555;font-size:9.5pt}
  .kpis{display:flex;flex-wrap:wrap;gap:4mm;margin:4mm 0}.kpi{flex:1 1 40mm;border:1px solid #bbb;border-radius:2mm;padding:2mm 3mm}
  .kpi span{display:block;font-size:8.5pt;color:#555}.kpi strong{font-size:14pt}
  table{width:100%;border-collapse:collapse;font-size:9pt;page-break-inside:auto}tr{page-break-inside:avoid}
  th,td{border:1px solid #ccc;padding:1mm 1.5mm;text-align:left;vertical-align:top}th{background:#eee}
  td.n{text-align:right;white-space:nowrap}.neg{color:#b00020}.pos{color:#0a7a2f}
  .note{font-size:8.5pt;color:#666;margin-top:6mm}
  @media print{.noprint{display:none}}
  .noprint{margin:0 0 6mm;padding:2mm;background:#fff6d6;border:1px solid #e0c060}
</style></head><body>
<div class="noprint">Utilisez <b>Imprimer → Enregistrer au format PDF</b> pour obtenir le fichier PDF. <button onclick="window.print()">Imprimer / PDF</button></div>
<h1>${esc(input.company)}</h1>
<div class="meta">Rapport d'exploitation sur ${esc(period)} · généré le ${esc(input.generatedAt)} · mode ${esc(input.mode)}</div>
<div class="kpis">
  <div class="kpi"><span>Trésorerie</span><strong class="${input.balance < 0 ? 'neg' : ''}">${esc(eur(input.balance))}</strong></div>
  <div class="kpi"><span>Résultat sur la période</span><strong class="${fin.net < 0 ? 'neg' : 'pos'}">${esc(eur(fin.net))}</strong></div>
  <div class="kpi"><span>Recettes</span><strong>${esc(eur(fin.revenue))}</strong></div>
  <div class="kpi"><span>Dépenses</span><strong>${esc(eur(fin.expenses))}</strong></div>
  <div class="kpi"><span>Pénalités</span><strong>${esc(eur(fin.penalties))}</strong></div>
  <div class="kpi"><span>Voyageurs transportés (cumul)</span><strong>${esc(num(input.passengers))}</strong></div>
  <div class="kpi"><span>Fret livré (cumul)</span><strong>${esc(num(input.freightTonnes, 1))} t</strong></div>
  <div class="kpi"><span>Trains en exploitation</span><strong>${input.trains.length}</strong><span>${late} en retard ≥ 5 min</span></div>
  <div class="kpi"><span>Rames</span><strong>${input.rames.length}</strong><span>usure moyenne ${esc(num(avgWear, 1))} %</span></div>
</div>

<h2>Finances par catégorie (${esc(period)}, ${fin.entries} écritures)</h2>
<table><thead><tr><th>Catégorie</th><th>Recettes</th><th>Dépenses</th><th>Solde</th></tr></thead><tbody>
${fin.byCategory.map((c) => rows([td(c.category), td(eur(c.revenue), 'n'), td(eur(c.expenses), 'n'), td(eur(c.revenue - c.expenses), 'n ' + (c.revenue - c.expenses < 0 ? 'neg' : 'pos'))])).join('') || '<tr><td colspan="4">Aucune écriture sur la période.</td></tr>'}
</tbody></table>

<h2>Parc de rames (${input.rames.length})</h2>
<table><thead><tr><th>Rame</th><th>N° série</th><th>Composition</th><th>Km total</th><th>Usure</th><th>État</th><th>Position</th></tr></thead><tbody>
${input.rames.map((r) => rows([td(r.name), td(r.serial), td(r.elements.join(' + ')), td(num(r.totalKm), 'n'), td(num(r.wearLevel, 1) + ' %', 'n'), td(r.inMaintenance ? 'En maintenance' : r.defects > 0 ? `${r.defects} défaut(s)` : 'Disponible'), td(r.location)])).join('') || '<tr><td colspan="7">Aucune rame.</td></tr>'}
</tbody></table>

<h2>Trains en exploitation (${input.trains.length})</h2>
<table><thead><tr><th>Train</th><th>N°</th><th>Origine</th><th>Destination</th><th>État</th><th>Retard</th><th>Rame</th></tr></thead><tbody>
${input.trains.map((t) => rows([td(t.name), td(t.number), td(t.origin), td(t.destination), td(t.state), td(t.delay > 0 ? `+${Math.round(t.delay)} min` : 'à l\u2019heure', 'n ' + (t.delay >= 5 ? 'neg' : '')), td(t.rameName)])).join('') || '<tr><td colspan="7">Aucun train en exploitation.</td></tr>'}
</tbody></table>

<h2>Personnel</h2>
<table><thead><tr><th>Poste</th><th>Effectif</th><th>En service</th></tr></thead><tbody>
${input.staff.map((s) => rows([td(s.role), td(s.count, 'n'), td(s.onDuty, 'n')])).join('') || '<tr><td colspan="3">Aucun personnel.</td></tr>'}
</tbody></table>
<p class="note">Cumuls voyageurs/fret depuis la création de la partie ; finances filtrées sur la période. Rail Empire — rapport généré localement, aucune donnée transmise.</p>
</body></html>`;
}

/** Ouvre le rapport dans une fenêtre dédiée et lance la boîte d'impression. */
export function openQgReport(html: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* fenêtre fermée */ } }, 400);
  return true;
}

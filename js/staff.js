/**
 * Staff Management — Multi-role personnel for Rail Empire.
 */
import { icon } from './icons.js';

let nextStaffId = 1;

const ROLES = {
  conducteur:           { label: 'Conducteur',              salary: 120, hiringCost: 2000, assignTo: 'service' },
  conducteur_manoeuvre:  { label: 'Conducteur de manœuvre',  salary: 100, hiringCost: 1500, assignTo: 'depot' },
  agent_gare:           { label: 'Agent en gare',           salary: 90,  hiringCost: 1000, assignTo: 'station' },
  agent_maintenance:    { label: 'Agent de maintenance',    salary: 110, hiringCost: 1800, assignTo: 'depot' },
  controleur:           { label: 'Contrôleur',              salary: 100, hiringCost: 1500, assignTo: 'zone' },
  regulateur:           { label: 'Régulateur',              salary: 150, hiringCost: 3000, assignTo: 'zone' },
  agent_circulation:    { label: 'Agent de circulation',    salary: 130, hiringCost: 2500, assignTo: 'signalbox' },
};

export { ROLES as STAFF_ROLES };

export class StaffManager {
  constructor() {
    this.staff = [];          // all personnel
    this.signalBoxes = [];    // { id, name, lat, lon, radiusKm, stationId? }
    this.zones = [];          // { id, name } for regulateurs/controleurs
    // Legacy compat
    this.conductors = [];
    this.baseSalary = 120;
    this.hiringCost = 2000;
  }

  // ── Hire ──
  hire(economy, name, role) {
    role = role || 'conducteur';
    const def = ROLES[role];
    if (!def) return null;
    if (!economy || economy.balance < def.hiringCost) return null;

    const member = {
      id: `staff-${nextStaffId++}`,
      name: name || `${def.label} ${this.getByRole(role).length + 1}`,
      role,
      assignedTo: null,
      available: true,
      hireDate: Date.now(),
      totalTrips: 0,
      totalFines: 0,
      totalFineRevenue: 0,
      shiftStartMin: -1,
      shiftWorkedMin: 0,
      resting: false,
    };

    economy.addExpense(def.hiringCost, 'personnel', `Embauche: ${member.name} (${def.label})`);
    this.staff.push(member);
    this._syncLegacy();
    return member;
  }

  // ── Fire ──
  fire(staffId) {
    const idx = this.staff.findIndex(s => s.id === staffId);
    if (idx === -1) return false;
    const s = this.staff[idx];
    if (s.assignedTo) return false;
    this.staff.splice(idx, 1);
    this._syncLegacy();
    return true;
  }

  // ── Assign ──
  assign(staffId, targetId) {
    const s = this.staff.find(s => s.id === staffId);
    if (!s || !s.available) return false;
    s.assignedTo = targetId;
    this._syncLegacy();
    return true;
  }

  unassignByTarget(targetId) {
    for (const s of this.staff) {
      if (s.assignedTo === targetId) {
        s.assignedTo = null;
        if (s.role === 'conducteur') s.totalTrips++;
      }
    }
    this._syncLegacy();
  }

  // ── Queries ──
  getByRole(role) { return this.staff.filter(s => s.role === role); }
  getAvailableByRole(role) { return this.staff.filter(s => s.role === role && !s.assignedTo); }
  getAssignedTo(targetId) { return this.staff.filter(s => s.assignedTo === targetId); }

  hasAssignedConductor(serviceId) {
    if (this.getByRole('conducteur').length === 0) return true;
    return this.staff.some(s => s.role === 'conducteur' && s.assignedTo === serviceId);
  }

  getAvailable() { return this.getAvailableByRole('conducteur'); }

  // ── Auto-assignment of conductors ──
  tickConductors(activeServices, timeOfDay) {
    const conducteurs = this.getByRole('conducteur');
    if (conducteurs.length === 0) return;

    const SHIFT_DURATION = 480; // 8h in minutes
    const REST_DURATION = 480;  // 8h rest

    for (const c of conducteurs) {
      // Handle resting conductors
      if (c.resting) {
        c.shiftWorkedMin++;
        if (c.shiftWorkedMin >= REST_DURATION) {
          c.resting = false;
          c.shiftWorkedMin = 0;
          c.shiftStartMin = -1;
        }
        continue;
      }

      // If assigned, track shift time
      if (c.assignedTo) {
        if (c.shiftStartMin < 0) c.shiftStartMin = timeOfDay;
        c.shiftWorkedMin++;

        // Check if shift exceeded 8h
        if (c.shiftWorkedMin >= SHIFT_DURATION) {
          // Check if the assigned service is still moving — wait for it to finish
          const svc = activeServices.find(s => s.id === c.assignedTo);
          if (!svc || svc.state !== 'moving') {
            c.assignedTo = null;
            c.resting = true;
            c.shiftWorkedMin = 0;
            c.totalTrips++;
          }
          // If still moving, let them finish this service before resting
        }

        // Check if the assigned service completed
        const svc = activeServices.find(s => s.id === c.assignedTo);
        if (svc && (svc.completed || svc.state === 'waiting') && c.shiftWorkedMin > 0) {
          c.assignedTo = null;
          c.totalTrips++;
          // Don't rest yet — try to take another service within the shift
        }
        continue;
      }

      // Available conductor: try to auto-assign to a service that needs one
      if (c.shiftWorkedMin < SHIFT_DURATION) {
        // Find services about to depart or currently without a conductor
        const needsConductor = activeServices.filter(svc => {
          if (!svc.active || svc.completed) return false;
          // Only passenger/freight services that are about to move or waiting
          if (svc.state !== 'waiting' && svc.state !== 'stopped_at_station') return false;
          // Check if already has a conductor
          return !conducteurs.some(cc => cc.assignedTo === svc.id);
        });

        if (needsConductor.length > 0) {
          // Pick a random service
          const pick = needsConductor[Math.floor(Math.random() * needsConductor.length)];
          c.assignedTo = pick.id;
          if (c.shiftStartMin < 0) c.shiftStartMin = timeOfDay;
        }
      }
    }
    this._syncLegacy();
  }

  // ── Signal Boxes ──
  addSignalBox(data) {
    const sb = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      name: data.name || `Poste ${this.signalBoxes.length + 1}`,
      lat: data.lat,
      lon: data.lon,
      radiusKm: data.radiusKm || 10,
      stationId: data.stationId || null,
    };
    this.signalBoxes.push(sb);
    return sb;
  }

  removeSignalBox(id) {
    // Unassign agents first
    for (const s of this.staff) {
      if (s.role === 'agent_circulation' && s.assignedTo === id) s.assignedTo = null;
    }
    this.signalBoxes = this.signalBoxes.filter(sb => sb.id !== id);
  }

  getSignalBoxById(id) { return this.signalBoxes.find(sb => sb.id === id); }

  // ── Zones ──
  addZone(name) {
    const z = { id: `zone-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name: name || `Zone ${this.zones.length + 1}` };
    this.zones.push(z);
    return z;
  }

  removeZone(id) {
    for (const s of this.staff) {
      if ((s.role === 'regulateur' || s.role === 'controleur') && s.assignedTo === id) s.assignedTo = null;
    }
    this.zones = this.zones.filter(z => z.id !== id);
  }

  // ── Contrôleur logic ──
  tickControleurs(economy, activeServices, gameTimeMin) {
    const controleurs = this.staff.filter(s => s.role === 'controleur' && s.assignedTo);
    if (controleurs.length === 0) return;

    const paxServices = activeServices.filter(s =>
      s.state === 'moving' && s.rame && s.rame.totalCapacity > 0
    );
    if (paxServices.length === 0) return;

    for (const ctrl of controleurs) {
      // Each contrôleur inspects one random train per ~30 min game time
      if (Math.random() > 0.033) continue; // ~1/30 chance per tick
      const svc = paxServices[Math.floor(Math.random() * paxServices.length)];
      const paxCount = svc._onboardPax || 0;
      if (paxCount <= 0) continue;
      // ~5% of passengers don't have a ticket
      const frauders = Math.floor(paxCount * 0.05);
      if (frauders <= 0) continue;
      const fineAmount = frauders * 50;
      ctrl.totalFines += frauders;
      ctrl.totalFineRevenue += fineAmount;
      economy.addRevenue(fineAmount, 'amendes', `Contrôle ${ctrl.name}: ${frauders} PV × 50€ (${svc.name})`);
    }
  }

  // ── Régulateur coverage check ──
  getZoneRegulatorCoverage(zoneId) {
    const regs = this.staff.filter(s => s.role === 'regulateur' && s.assignedTo === zoneId);
    // Need 3 regulators for 24/7 coverage (3 × 8h shifts)
    return { count: regs.length, needed: 3, covered: regs.length >= 3 };
  }

  // ── Daily salaries ──
  getDailySalaryExpense() {
    let total = 0;
    for (const s of this.staff) {
      const def = ROLES[s.role];
      total += def ? def.salary : 120;
    }
    return total;
  }

  processDailySalaries(economy) {
    const byRole = {};
    for (const s of this.staff) {
      const role = s.role || 'conducteur';
      if (!byRole[role]) byRole[role] = 0;
      byRole[role]++;
    }
    for (const [role, count] of Object.entries(byRole)) {
      const def = ROLES[role];
      if (!def) continue;
      const amount = count * def.salary;
      if (amount > 0) {
        economy.addExpense(amount, 'salaires', `Salaires: ${count} ${def.label}(s) × ${def.salary}€`);
      }
    }
  }

  // ── Render ──
  render(container, game) {
    if (!container) return;
    const eco = game.economy;
    const activeServices = game.scheduleCreator?.getActiveServices() || [];
    const stations = game.world?.getStations() || [];
    const depots = game.depotManager?.depots || [];

    // KPIs
    const totalStaff = this.staff.length;
    const assigned = this.staff.filter(s => s.assignedTo).length;
    const resting = this.staff.filter(s => s.resting).length;
    const available = totalStaff - assigned - resting;

    // Role tabs
    const roleKeys = Object.keys(ROLES);
    const roleCounts = {};
    for (const k of roleKeys) roleCounts[k] = this.getByRole(k).length;

    container.innerHTML = `
      <div class="dash-section">
        <h3>Gestion du Personnel</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Total</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${totalStaff}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Disponibles</div>
            <div class="dash-kpi-value" style="color:var(--green)">${available}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">En poste</div>
            <div class="dash-kpi-value" style="color:#f97316">${assigned}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Au repos</div>
            <div class="dash-kpi-value" style="color:#ef4444">${resting}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Salaires / jour</div>
            <div class="dash-kpi-value" style="color:#facc15">${this.getDailySalaryExpense().toLocaleString('fr-FR')} &euro;</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Embaucher</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="staff-hire-role" style="font-size:11px;padding:6px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
            ${roleKeys.map(k => `<option value="${k}">${ROLES[k].label} (${ROLES[k].hiringCost.toLocaleString('fr-FR')}€)</option>`).join('')}
          </select>
          <input type="text" id="staff-hire-name" placeholder="Nom (optionnel)" style="font-size:11px;padding:6px 10px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:160px">
          <button id="staff-hire-btn" class="btn-primary" style="font-size:11px;padding:6px 12px">Embaucher</button>
          <span style="font-size:10px;color:var(--text3)">Solde: ${eco.formatAmount(eco.balance)}</span>
        </div>
      </div>

      ${this._renderZonesSection(game)}
      ${this._renderSignalBoxSection(game)}

      ${roleKeys.map(role => this._renderRoleSection(role, activeServices, stations, depots, game)).join('')}
    `;

    this._bindEvents(container, game, eco);
  }

  _renderRoleSection(role, activeServices, stations, depots, game) {
    const def = ROLES[role];
    const members = this.getByRole(role);
    if (members.length === 0 && role !== 'conducteur') return '';

    let assignOptions = '';
    if (def.assignTo === 'service') {
      assignOptions = activeServices.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } else if (def.assignTo === 'station') {
      assignOptions = stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } else if (def.assignTo === 'depot') {
      assignOptions = depots.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    } else if (def.assignTo === 'zone') {
      assignOptions = this.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
    } else if (def.assignTo === 'signalbox') {
      assignOptions = this.signalBoxes.map(sb => `<option value="${sb.id}">${sb.name}</option>`).join('');
    }

    const extraCol = role === 'controleur' ? '<span>PV</span><span>Recettes</span>' : (role === 'conducteur' ? '<span>Trajets</span><span>Service</span>' : '');
    const colCount = role === 'controleur' ? 6 : (role === 'conducteur' ? 6 : 4);

    const roleNote = (role === 'conducteur')
      ? '<p style="font-size:10px;color:var(--text3);margin:0 0 6px">Affectation automatique aux services. Service de 8h puis repos obligatoire de 8h.</p>'
      : '';

    return `
      <div class="dash-section">
        <h3>${def.label}s (${members.length})</h3>
        ${roleNote}
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:repeat(${colCount},1fr)">
            <span>Nom</span><span>Statut</span><span>Affecté à</span>${extraCol}<span>Actions</span>
          </div>
          ${members.map(m => {
            const isAssigned = !!m.assignedTo;
            let assignedLabel = '-';
            if (isAssigned) {
              if (def.assignTo === 'service') {
                const svc = activeServices.find(s => s.id === m.assignedTo);
                assignedLabel = svc ? svc.name : m.assignedTo;
              } else if (def.assignTo === 'station') {
                const st = stations.find(s => s.id === m.assignedTo);
                assignedLabel = st ? st.name : m.assignedTo;
              } else if (def.assignTo === 'depot') {
                const dp = depots.find(d => d.id === m.assignedTo);
                assignedLabel = dp ? dp.name : m.assignedTo;
              } else if (def.assignTo === 'zone') {
                const z = this.zones.find(z => z.id === m.assignedTo);
                assignedLabel = z ? z.name : m.assignedTo;
              } else if (def.assignTo === 'signalbox') {
                const sb = this.signalBoxes.find(sb => sb.id === m.assignedTo);
                assignedLabel = sb ? sb.name : m.assignedTo;
              }
            }
            let statusStr;
            if (role === 'conducteur') {
              if (m.resting) statusStr = `${icon('dot_red', 10)} Repos`;
              else if (isAssigned) statusStr = `${icon('dot_green', 10)} En service`;
              else statusStr = `${icon('dot_yellow', 10)} Disponible`;
            } else {
              statusStr = isAssigned ? `${icon('dot_green', 10)} En poste` : `${icon('dot_yellow', 10)} Disponible`;
            }
            const shiftInfo = (role === 'conducteur')
              ? `<span>${Math.floor((m.shiftWorkedMin || 0) / 60)}h${String((m.shiftWorkedMin || 0) % 60).padStart(2,'0')}/${m.resting ? 'repos' : '8h00'}</span>`
              : '';
            const extraVals = role === 'controleur'
              ? `<span>${m.totalFines || 0}</span><span>${(m.totalFineRevenue || 0).toLocaleString('fr-FR')}€</span>`
              : (role === 'conducteur' ? `<span>${m.totalTrips || 0}</span>${shiftInfo}` : '');

            return `<div class="dash-train-row" style="grid-template-columns:repeat(${colCount},1fr)">
              <span style="font-weight:600">${m.name}</span>
              <span>${statusStr}</span>
              <span>${assignedLabel}</span>
              ${extraVals}
              <span>
                ${!isAssigned ? `
                  <select class="staff-assign-select" data-staff-id="${m.id}" style="font-size:9px;padding:2px 4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:3px;max-width:100px">
                    <option value="">Affecter...</option>
                    ${assignOptions}
                  </select>
                  <button class="staff-fire-btn btn-sm" data-staff-id="${m.id}" style="font-size:9px;background:#ef4444;margin-left:4px">Licencier</button>
                ` : `
                  <button class="staff-unassign-btn btn-sm" data-staff-id="${m.id}" style="font-size:9px;background:#6366f1">Désaffecter</button>
                `}
              </span>
            </div>`;
          }).join('') || '<div style="padding:8px;color:var(--text3)">Aucun personnel</div>'}
        </div>
      </div>`;
  }

  _renderZonesSection() {
    const regCoverage = this.zones.map(z => {
      const cov = this.getZoneRegulatorCoverage(z.id);
      const ctrlCount = this.staff.filter(s => s.role === 'controleur' && s.assignedTo === z.id).length;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:600">${z.name}</span>
        <span style="font-size:10px">
          Régulateurs: <b style="color:${cov.covered ? 'var(--green)' : '#ef4444'}">${cov.count}/3</b>
          ${cov.covered ? '(24/7)' : `(${cov.count * 8}h/24)`}
          | Contrôleurs: <b>${ctrlCount}</b>
        </span>
        <button class="zone-del-btn btn-sm" data-zone-id="${z.id}" style="font-size:9px;background:#ef4444">Suppr.</button>
      </div>`;
    }).join('');

    return `
      <div class="dash-section">
        <h3>Zones de régulation</h3>
        <p style="font-size:10px;color:var(--text3);margin:0 0 6px">Chaque zone nécessite 3 régulateurs (3 × 8h = 24/7). Les contrôleurs montent aléatoirement dans les trains de leur zone.</p>
        <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center">
          <input type="text" id="zone-name-input" placeholder="Nom de la zone" style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:160px">
          <button id="zone-add-btn" class="btn-primary" style="font-size:10px;padding:4px 10px">+ Zone</button>
        </div>
        ${regCoverage || '<div style="font-size:10px;color:var(--text3)">Aucune zone créée</div>'}
      </div>`;
  }

  _renderSignalBoxSection() {
    const sbList = this.signalBoxes.map(sb => {
      const agents = this.staff.filter(s => s.role === 'agent_circulation' && s.assignedTo === sb.id);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:600">${sb.name}</span>
        <span style="font-size:10px">Rayon: ${sb.radiusKm} km | Agents: <b>${agents.length}</b></span>
        <button class="sb-del-btn btn-sm" data-sb-id="${sb.id}" style="font-size:9px;background:#ef4444">Suppr.</button>
      </div>`;
    }).join('');

    return `
      <div class="dash-section">
        <h3>Postes d'aiguillage</h3>
        <p style="font-size:10px;color:var(--text3);margin:0 0 6px">Placez des postes sur la carte pour gérer les tronçons d'une zone. Chaque poste nécessite au moins 1 agent de circulation.</p>
        <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
          <input type="text" id="sb-name-input" placeholder="Nom du poste" style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:130px">
          <input type="number" id="sb-radius-input" value="10" min="1" max="100" style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:80px" title="Rayon (km)">
          <span style="font-size:9px;color:var(--text3)">km</span>
          <button id="sb-add-btn" class="btn-primary" style="font-size:10px;padding:4px 10px">+ Poste (clic carte)</button>
        </div>
        ${sbList || '<div style="font-size:10px;color:var(--text3)">Aucun poste</div>'}
      </div>`;
  }

  _bindEvents(container, game, eco) {
    // Hire
    document.getElementById('staff-hire-btn')?.addEventListener('click', () => {
      const role = document.getElementById('staff-hire-role')?.value || 'conducteur';
      const name = document.getElementById('staff-hire-name')?.value?.trim() || '';
      const result = this.hire(eco, name, role);
      if (result) {
        this.render(container, game);
        game.saveState();
      } else {
        alert('Fonds insuffisants.');
      }
    });

    // Assign
    container.querySelectorAll('.staff-assign-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const staffId = e.target.dataset.staffId;
        const targetId = e.target.value;
        if (targetId) {
          this.assign(staffId, targetId);
          this.render(container, game);
          game.saveState();
        }
      });
    });

    // Fire
    container.querySelectorAll('.staff-fire-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Licencier ?')) {
          this.fire(btn.dataset.staffId);
          this.render(container, game);
          game.saveState();
        }
      });
    });

    // Unassign
    container.querySelectorAll('.staff-unassign-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = this.staff.find(s => s.id === btn.dataset.staffId);
        if (s) { s.assignedTo = null; this._syncLegacy(); }
        this.render(container, game);
        game.saveState();
      });
    });

    // Add zone
    document.getElementById('zone-add-btn')?.addEventListener('click', () => {
      const name = document.getElementById('zone-name-input')?.value.trim();
      this.addZone(name);
      this.render(container, game);
      game.saveState();
    });

    // Delete zone
    container.querySelectorAll('.zone-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeZone(btn.dataset.zoneId);
        this.render(container, game);
        game.saveState();
      });
    });

    // Add signal box (enter placement mode)
    document.getElementById('sb-add-btn')?.addEventListener('click', () => {
      const name = document.getElementById('sb-name-input')?.value.trim() || '';
      const radius = parseFloat(document.getElementById('sb-radius-input')?.value) || 10;
      game._pendingSignalBox = { name, radiusKm: radius };
      alert('Cliquez sur la carte pour placer le poste d\'aiguillage.');
    });

    // Delete signal box
    container.querySelectorAll('.sb-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeSignalBox(btn.dataset.sbId);
        this.render(container, game);
        game.saveState();
      });
    });
  }

  // Keep legacy conductors array in sync for backward compat
  _syncLegacy() {
    this.conductors = this.staff.filter(s => s.role === 'conducteur').map(s => ({
      id: s.id,
      name: s.name,
      assignedServiceId: s.assignedTo,
      available: !s.assignedTo,
      hireDate: s.hireDate,
      totalTrips: s.totalTrips,
    }));
  }

  // Legacy API
  unassign(serviceId) { this.unassignByTarget(serviceId); }

  toSave() {
    return {
      staff: this.staff.map(s => ({
        id: s.id,
        name: s.name,
        role: s.role,
        assignedTo: s.assignedTo,
        available: !s.assignedTo,
        hireDate: s.hireDate,
        totalTrips: s.totalTrips || 0,
        totalFines: s.totalFines || 0,
        totalFineRevenue: s.totalFineRevenue || 0,
        shiftStartMin: s.shiftStartMin ?? -1,
        shiftWorkedMin: s.shiftWorkedMin || 0,
        resting: s.resting || false,
      })),
      signalBoxes: this.signalBoxes,
      zones: this.zones,
      nextStaffId,
      // Legacy fields for backward compat
      conductors: this.conductors,
      baseSalary: this.baseSalary,
      hiringCost: this.hiringCost,
    };
  }

  loadFromSave(s) {
    if (!s) return;

    if (s.staff && s.staff.length > 0) {
      // New format
      this.staff = s.staff.map(m => ({
        id: m.id,
        name: m.name,
        role: m.role || 'conducteur',
        assignedTo: m.assignedTo || m.assignedServiceId || null,
        available: !m.assignedTo,
        hireDate: m.hireDate || Date.now(),
        totalTrips: m.totalTrips || 0,
        totalFines: m.totalFines || 0,
        totalFineRevenue: m.totalFineRevenue || 0,
        shiftStartMin: m.shiftStartMin ?? -1,
        shiftWorkedMin: m.shiftWorkedMin || 0,
        resting: m.resting || false,
      }));
    } else if (s.conductors && s.conductors.length > 0) {
      // Migrate from old format
      this.staff = s.conductors.map(c => ({
        id: c.id,
        name: c.name,
        role: 'conducteur',
        assignedTo: c.assignedServiceId || null,
        available: !c.assignedServiceId,
        hireDate: c.hireDate || Date.now(),
        totalTrips: c.totalTrips || 0,
        totalFines: 0,
        totalFineRevenue: 0,
        shiftStartMin: -1,
        shiftWorkedMin: 0,
        resting: false,
      }));
    } else {
      this.staff = [];
    }

    this.signalBoxes = s.signalBoxes || [];
    this.zones = s.zones || [];
    this.baseSalary = s.baseSalary || 120;
    this.hiringCost = s.hiringCost || 2000;
    if (s.nextStaffId) nextStaffId = s.nextStaffId;
    this._syncLegacy();
  }
}

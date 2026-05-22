/**
 * Staff Management — Conductors and personnel for Rail Empire.
 * Additive module: adds hiring/salary/availability constraints.
 */
import { icon } from './icons.js';

let nextStaffId = 1;

export class StaffManager {
  constructor() {
    this.conductors = [];
    this.baseSalary = 120; // € per day per conductor
    this.hiringCost = 2000; // € per hire
  }

  /**
   * Hire a new conductor.
   * Returns the new conductor or null if can't afford.
   */
  hire(economy, name) {
    if (!economy || economy.balance < this.hiringCost) return null;

    const conductor = {
      id: `cond-${nextStaffId++}`,
      name: name || `Conducteur ${this.conductors.length + 1}`,
      assignedServiceId: null,
      available: true,
      hireDate: Date.now(),
      totalTrips: 0,
    };

    economy.addExpense(this.hiringCost, 'personnel', `Embauche: ${conductor.name}`);
    this.conductors.push(conductor);
    return conductor;
  }

  /**
   * Fire a conductor (only if not currently assigned to a moving service).
   */
  fire(conductorId) {
    const idx = this.conductors.findIndex(c => c.id === conductorId);
    if (idx === -1) return false;
    const c = this.conductors[idx];
    if (c.assignedServiceId) return false; // can't fire while assigned
    this.conductors.splice(idx, 1);
    return true;
  }

  /**
   * Assign a conductor to a service. Returns true if successful.
   */
  assign(conductorId, serviceId) {
    const c = this.conductors.find(c => c.id === conductorId);
    if (!c || !c.available) return false;
    // Unassign from previous service if any
    if (c.assignedServiceId) {
      c.assignedServiceId = null;
    }
    c.assignedServiceId = serviceId;
    return true;
  }

  /**
   * Unassign conductor from a service (when service completes).
   */
  unassign(serviceId) {
    for (const c of this.conductors) {
      if (c.assignedServiceId === serviceId) {
        c.assignedServiceId = null;
        c.totalTrips++;
      }
    }
  }

  /**
   * Check if a service has a conductor assigned.
   * If no staff module is active or no conductors exist, always returns true (graceful degradation).
   */
  hasAssignedConductor(serviceId) {
    if (this.conductors.length === 0) return true; // no staff system = no constraint
    return this.conductors.some(c => c.assignedServiceId === serviceId);
  }

  /**
   * Get available (unassigned) conductors.
   */
  getAvailable() {
    return this.conductors.filter(c => !c.assignedServiceId && c.available);
  }

  /**
   * Calculate daily salary expense for all conductors.
   */
  getDailySalaryExpense() {
    return this.conductors.length * this.baseSalary;
  }

  /**
   * Process daily salaries. Called from economy's processDailyCharges hook.
   */
  processDailySalaries(economy) {
    const total = this.getDailySalaryExpense();
    if (total > 0) {
      economy.addExpense(total, 'salaires', `Salaires: ${this.conductors.length} conducteur(s) × ${this.baseSalary}€`);
    }
  }

  /**
   * Render the staff management page.
   */
  render(container, game) {
    if (!container) return;
    const eco = game.economy;
    const activeServices = game.scheduleCreator.getActiveServices();

    // Build service list for assignment dropdown
    const serviceOptions = activeServices.map(s =>
      `<option value="${s.id}">${s.name}</option>`
    ).join('');

    container.innerHTML = `
      <div class="dash-section">
        <h3>Gestion du Personnel</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Conducteurs</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${this.conductors.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Disponibles</div>
            <div class="dash-kpi-value" style="color:var(--green)">${this.getAvailable().length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">En service</div>
            <div class="dash-kpi-value" style="color:#f97316">${this.conductors.filter(c => c.assignedServiceId).length}</div>
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
          <input type="text" id="staff-hire-name" placeholder="Nom du conducteur" style="font-size:11px;padding:6px 10px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:180px">
          <button id="staff-hire-btn" class="btn-primary" style="font-size:11px;padding:6px 12px">Embaucher (${this.hiringCost.toLocaleString('fr-FR')} &euro;)</button>
          <span style="font-size:10px;color:var(--text3)">Solde: ${eco.formatAmount(eco.balance)}</span>
        </div>
      </div>

      <div class="dash-section">
        <h3>Conducteurs</h3>
        <div class="dash-train-table">
          <div class="dash-train-header">
            <span>Nom</span><span>Statut</span><span>Affect&eacute; &agrave;</span><span>Trajets</span><span>Actions</span>
          </div>
          ${this.conductors.map(c => {
            const assignedSvc = activeServices.find(s => s.id === c.assignedServiceId);
            const statusStr = assignedSvc ? `${icon('dot_green', 10)} En service` : `${icon('dot_yellow', 10)} Disponible`;
            const assignedName = assignedSvc ? assignedSvc.name : '-';
            return `<div class="dash-train-row">
              <span style="font-weight:600">${c.name}</span>
              <span>${statusStr}</span>
              <span>${assignedName}</span>
              <span>${c.totalTrips}</span>
              <span>
                ${!assignedSvc ? `
                  <select class="staff-assign-select" data-conductor-id="${c.id}" style="font-size:9px;padding:2px 4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:3px;max-width:100px">
                    <option value="">Affecter...</option>
                    ${serviceOptions}
                  </select>
                  <button class="staff-fire-btn btn-sm" data-conductor-id="${c.id}" style="font-size:9px;background:#ef4444;margin-left:4px">Licencier</button>
                ` : `
                  <button class="staff-unassign-btn btn-sm" data-conductor-id="${c.id}" data-service-id="${c.assignedServiceId}" style="font-size:9px;background:#6366f1">Désaffecter</button>
                `}
              </span>
            </div>`;
          }).join('') || '<div style="padding:8px;color:var(--text3)">Aucun conducteur embauché</div>'}
        </div>
      </div>
    `;

    // Event: hire
    document.getElementById('staff-hire-btn')?.addEventListener('click', () => {
      const nameInput = document.getElementById('staff-hire-name');
      const name = nameInput?.value?.trim() || '';
      const result = this.hire(eco, name);
      if (result) {
        this.render(container, game);
      } else {
        alert('Fonds insuffisants pour embaucher un conducteur.');
      }
    });

    // Event: assign
    container.querySelectorAll('.staff-assign-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const conductorId = e.target.dataset.conductorId;
        const serviceId = e.target.value;
        if (serviceId) {
          this.assign(conductorId, serviceId);
          this.render(container, game);
        }
      });
    });

    // Event: fire
    container.querySelectorAll('.staff-fire-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.conductorId;
        if (confirm('Licencier ce conducteur ?')) {
          this.fire(id);
          this.render(container, game);
        }
      });
    });

    // Event: unassign
    container.querySelectorAll('.staff-unassign-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const serviceId = btn.dataset.serviceId;
        this.unassign(serviceId);
        this.render(container, game);
      });
    });
  }

  toSave() {
    return {
      conductors: this.conductors.map(c => ({
        id: c.id,
        name: c.name,
        assignedServiceId: c.assignedServiceId,
        available: c.available,
        hireDate: c.hireDate,
        totalTrips: c.totalTrips,
      })),
      baseSalary: this.baseSalary,
      hiringCost: this.hiringCost,
      nextStaffId: nextStaffId,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.conductors = s.conductors || [];
    this.baseSalary = s.baseSalary || 120;
    this.hiringCost = s.hiringCost || 2000;
    if (s.nextStaffId) nextStaffId = s.nextStaffId;
  }
}

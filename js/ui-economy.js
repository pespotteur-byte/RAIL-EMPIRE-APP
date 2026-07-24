import { haversineDistance } from './simulation.js?v=1784931680';
import { incrementTrailingNumber } from './schedule-logic.js?v=1784931680';
import { escapeHtml, jsString, alertToast } from './html-utils.js?v=1784931680';
import { LVM_CAT_COLORS, LVM_CAT_LABELS, LVM_CAT_ICONS, IG_IMAGE_LAYOUTS, PAGE_PARENT, PAGE_GROUPS } from './ui-constants.js?v=1784931680';

export const UIEconomy = {
  setupEconomyPage() {
      const ticketInput = document.getElementById('eco-ticket-price');
      const freightInput = document.getElementById('eco-freight-price');
      ticketInput?.addEventListener('change', () => {
        this.game.economy.ticketPricePerKm = parseFloat(ticketInput.value) || 0.12;
      });
      freightInput?.addEventListener('change', () => {
        this.game.economy.freightPricePerTKm = parseFloat(freightInput.value) || 0.08;
      });

      // Logo import
      const logoDrop = document.getElementById('logo-drop');
      const logoInput = document.getElementById('logo-input');
      logoDrop?.addEventListener('click', () => logoInput?.click());
      logoDrop?.addEventListener('dragover', e => { e.preventDefault(); logoDrop.style.borderColor = '#38bdf8'; });
      logoDrop?.addEventListener('dragleave', () => { logoDrop.style.borderColor = ''; });
      logoDrop?.addEventListener('drop', e => {
        e.preventDefault(); logoDrop.style.borderColor = '';
        const f = e.dataTransfer?.files[0]; if (f) this._loadLogo(f);
      });
      logoInput?.addEventListener('change', e => { const f = e.target.files[0]; if (f) this._loadLogo(f); });

      // Restore logo
      if (this.game.economy._companyLogo) this._applyLogo(this.game.economy._companyLogo);

      // Bulletin
      document.getElementById('btn-generate-bulletin')?.addEventListener('click', () => this._generateBulletin());
      // Fiche horaire de gare
      document.getElementById('btn-generate-fiche-horaire')?.addEventListener('click', () => this._openFicheHoraireModal());
    },

  _loadLogo(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target.result;
        this.game.economy._companyLogo = data;
        this._applyLogo(data);
      };
      reader.readAsDataURL(file);
    },

  _applyLogo(dataUrl) {
      const img = document.getElementById('company-logo');
      if (img) { img.src = dataUrl; img.style.display = 'inline-block'; }
      const drop = document.getElementById('logo-drop');
      if (drop) drop.innerHTML = `<img src="${escapeHtml(dataUrl)}" style="width:100%;height:100%;object-fit:contain">`;
    },

  _generateBulletin() {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) return alertToast('jsPDF non charge — verifiez votre connexion internet');
      try {
      const doc = new jsPDF();
      // Helper: strip accents for jsPDF default font compatibility
      const noAcc = (s) => typeof s === 'string' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : String(s);
      const eco = this.game.economy;
      const company = noAcc(this.game.account.companyName || 'Rail Empire');
      const now = new Date().toLocaleDateString('fr-FR');
      const lastBulletin = eco._lastBulletinDate || null;
      const pw = doc.internal.pageSize.getWidth();

      // Helper: draw line separator
      const drawLine = (yPos) => { doc.setDrawColor(180); doc.line(10, yPos, pw - 10, yPos); };
      // Helper: page footer
      const addFooter = () => {
        doc.setFontSize(8); doc.setTextColor(150); doc.setFont(undefined, 'italic');
        doc.text(`${company} -- Bulletin genere automatiquement -- ${now}`, pw / 2, 290, { align: 'center' });
        doc.setTextColor(0); doc.setFont(undefined, 'normal');
      };

      // ========== PAGE 1 : PAGE DE GARDE ==========
      // Logo en haut à droite + nom compagnie dessous
      if (eco._companyLogo) {
        try { doc.addImage(eco._companyLogo, 'PNG', pw - 50, 15, 35, 35); } catch(e) {}
      }
      doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(80);
      doc.text(company, pw - 32, eco._companyLogo ? 56 : 25, { align: 'center' });

      // Titre centré au milieu de la page
      doc.setTextColor(0);
      doc.setFontSize(28); doc.setFont(undefined, 'bold');
      doc.text('Bulletin', pw / 2, 100, { align: 'center' });
      doc.setFontSize(22);
      doc.text('recapitulatif', pw / 2, 115, { align: 'center' });
      doc.setFontSize(18); doc.setFont(undefined, 'normal');
      doc.text('de votre compagnie', pw / 2, 128, { align: 'center' });

      // Date + période
      drawLine(145);
      doc.setFontSize(11); doc.setTextColor(80);
      doc.text(`Genere le ${now}`, pw / 2, 155, { align: 'center' });
      if (lastBulletin) {
        doc.text(`Periode : depuis le ${lastBulletin}`, pw / 2, 163, { align: 'center' });
      } else {
        doc.text('Premier bulletin de la compagnie', pw / 2, 163, { align: 'center' });
      }
      doc.setTextColor(0);
      addFooter();

      // ========== PAGE 2 : SOMMAIRE ==========
      doc.addPage();
      doc.setFontSize(20); doc.setFont(undefined, 'bold');
      doc.text('Sommaire', pw / 2, 30, { align: 'center' });
      drawLine(36);

      const sections = [
        { num: '1', title: 'Finances', page: 3 },
        { num: '2', title: 'Transport & Reseau', page: 3 },
        { num: '3', title: 'Services actifs', page: 4 },
        { num: '4', title: lastBulletin ? 'Nouvelles rames' : 'Parc de rames', page: 5 },
        { num: '5', title: 'Incidents', page: 6 },
      ];
      let sy = 50;
      doc.setFontSize(13);
      for (const s of sections) {
        doc.setFont(undefined, 'bold');
        doc.text(`${s.num}.`, 20, sy);
        doc.setFont(undefined, 'normal');
        doc.text(s.title, 30, sy);
        doc.text(`p. ${s.page}`, pw - 25, sy, { align: 'right' });
        // Dotted line between title and page number
        doc.setLineDash([1, 1], 0);
        const titleW = doc.getTextWidth(s.title);
        doc.line(30 + titleW + 3, sy + 0.5, pw - 30, sy + 0.5);
        doc.setLineDash([], 0);
        sy += 10;
      }
      addFooter();

      // ========== PAGE 3 : FINANCES + TRANSPORT ==========
      doc.addPage();
      let y = 20;

      // Section 1: Finances
      doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text('1. Finances', 10, y); y += 2;
      drawLine(y); y += 8;
      doc.setFontSize(11); doc.setFont(undefined, 'normal');
      doc.text('Solde actuel :', 14, y);
      doc.setFont(undefined, 'bold'); doc.text(eco.formatAmount(eco.balance), 65, y); doc.setFont(undefined, 'normal'); y += 7;
      doc.text('Recettes totales :', 14, y);
      doc.setTextColor(34, 139, 34); doc.text(`+${eco.formatAmount(eco.revenue)}`, 65, y); doc.setTextColor(0); y += 7;
      doc.text('Depenses totales :', 14, y);
      doc.setTextColor(200, 0, 0); doc.text(`-${eco.formatAmount(eco.expenses)}`, 65, y); doc.setTextColor(0); y += 7;
      doc.text('Amendes :', 14, y);
      doc.setTextColor(200, 0, 0); doc.text(`-${eco.formatAmount(eco.penalties)}`, 65, y); doc.setTextColor(0); y += 12;

      // Section 2: Transport & Réseau
      doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text('2. Transport & Reseau', 10, y); y += 2;
      drawLine(y); y += 8;
      doc.setFontSize(11); doc.setFont(undefined, 'normal');
      doc.text('Passagers transportes :', 14, y);
      doc.setFont(undefined, 'bold'); doc.text(eco.totalPassengers.toLocaleString('fr-FR'), 75, y); doc.setFont(undefined, 'normal'); y += 7;
      doc.text('Fret transporte :', 14, y);
      doc.setFont(undefined, 'bold'); doc.text(`${eco.totalFreightTonnes.toLocaleString('fr-FR')} tonnes`, 75, y); doc.setFont(undefined, 'normal'); y += 7;
      const tracks = this.game.world.tracks || [];
      let trackKm = Math.round(tracks.reduce((s, t) => s + (t.distance || 0), 0));
      if (this.game.voiePointManager) {
        trackKm += Math.round(this.game.voiePointManager.getAllTroncons().reduce((s, t) => s + (t.distance || 0), 0));
      }
      doc.text('Km de voies possedes :', 14, y);
      doc.setFont(undefined, 'bold'); doc.text(`${trackKm.toLocaleString('fr-FR')} km`, 75, y); doc.setFont(undefined, 'normal'); y += 7;
      const rames = this.game.rameManager.getAll();
      const totalTrainKm = Math.round(rames.reduce((s, r) => s + (r.totalKmRun || 0), 0));
      doc.text('Kilometrage total trains :', 14, y);
      doc.setFont(undefined, 'bold'); doc.text(`${totalTrainKm.toLocaleString('fr-FR')} km`, 75, y); doc.setFont(undefined, 'normal'); y += 7;
      doc.text('Nombre de gares :', 14, y);
      const stations = this.game.world.stations || [];
      doc.setFont(undefined, 'bold'); doc.text(`${stations.length}`, 75, y); doc.setFont(undefined, 'normal'); y += 7;
      doc.text('Nombre de rames :', 14, y);
      doc.setFont(undefined, 'bold'); doc.text(`${rames.length}`, 75, y); doc.setFont(undefined, 'normal');
      addFooter();

      // ========== PAGE 4 : SERVICES ==========
      doc.addPage();
      y = 20;
      const services = this.game.scheduleCreator.getActiveServices();
      doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text(`3. Services actifs (${services.length})`, 10, y); y += 2;
      drawLine(y); y += 8;
      doc.setFontSize(10);
      for (const svc of services) {
        if (y > 265) { doc.addPage(); y = 15; }
        doc.setFont(undefined, 'bold');
        doc.text(noAcc(svc.name), 14, y); y += 5;
        doc.setFont(undefined, 'normal');
        const stopsStr = svc.stops.map(s => {
          const st = this.game.world.getStationById(s.stationId);
          return st ? st.name : '?';
        }).join('  >  ');
        // Word wrap long routes
        const lines = doc.splitTextToSize(noAcc(stopsStr), pw - 30);
        doc.text(lines, 18, y); y += lines.length * 4 + 1;
        doc.setFontSize(9); doc.setTextColor(100);
        doc.text(`Distance: ${Math.round(svc.totalDistance || 0)} km | Aller-retour: ${svc.roundTrip ? 'Oui' : 'Non'} | Multi: x${svc.multiDepartures || 1}`, 18, y);
        doc.setTextColor(0); doc.setFontSize(10); y += 8;
      }
      addFooter();

      // ========== PAGE 5 : RAMES ==========
      doc.addPage();
      y = 20;
      const newRames = lastBulletin ? rames.filter(r => r.createdDate >= lastBulletin) : rames;
      const rameTitle = lastBulletin ? `4. Nouvelles rames (${newRames.length})` : `4. Parc de rames (${rames.length})`;
      doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text(rameTitle, 10, y); y += 2;
      drawLine(y); y += 8;
      doc.setFontSize(10);
      for (const r of (newRames.length > 0 ? newRames : rames)) {
        if (y > 240) { doc.addPage(); y = 15; }
        doc.setFont(undefined, 'bold');
        doc.text(noAcc(r.name), 14, y); y += 5;
        doc.setFont(undefined, 'normal'); doc.setFontSize(9);
        doc.text(noAcc(`${r.totalLength.toFixed(0)}m | ${r.totalTonnage}t | ${r.totalCapacity} places | Fret: ${r.totalFreightCapacity}t | Vmax: ${r.maxSpeed} km/h`), 18, y); y += 4;
        doc.text(noAcc(`Mise en service: ${r.createdDate} | Km: ${Math.round(r.totalKmRun || 0).toLocaleString('fr-FR')} km | Traction: ${r.traction}`), 18, y); y += 5;
        // Images
        let imgX = 18;
        for (const e of r.elementDetails) {
          if (e.imageData && y < 255 && imgX < pw - 40) {
            try { doc.addImage(e.imageData, 'PNG', imgX, y, 25, 8); imgX += 28; } catch(err) {}
          }
        }
        if (imgX > 18) y += 11;
        doc.setFontSize(10);
        y += 4;
      }
      addFooter();

      // ========== PAGE 6 : INCIDENTS ==========
      doc.addPage();
      y = 20;
      const incidents = this.game.incidentManager?.getActiveIncidents?.() || [];
      doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.text(`5. Incidents (${incidents.length})`, 10, y); y += 2;
      drawLine(y); y += 8;
      if (incidents.length === 0) {
        doc.setFontSize(11); doc.setFont(undefined, 'italic'); doc.setTextColor(120);
        doc.text('Aucun incident actif.', 14, y);
        doc.setTextColor(0);
      } else {
        doc.setFontSize(10); doc.setFont(undefined, 'normal');
        for (const inc of incidents) {
          if (y > 270) { doc.addPage(); y = 15; }
          doc.setFont(undefined, 'bold');
          doc.text(noAcc(inc.name || 'Incident'), 14, y);
          doc.setFont(undefined, 'normal'); y += 5;
          doc.text(`Impact: ${inc.impact || '?'} | Rayon: ${inc.radius || '?'} km | Duree: ${inc.duration || '?'} min`, 18, y); y += 7;
        }
      }
      addFooter();

      eco._lastBulletinDate = now;
      doc.save(`bulletin_${company.replace(/\s/g, '_')}_${now.replace(/\//g, '-')}.pdf`);
      } catch (err) { console.error('Bulletin PDF error:', err); alertToast('Erreur generation PDF: ' + err.message); }
    },

  _openFicheHoraireModal() {
      const modal = document.getElementById('modal-fiche-horaire');
      const select = document.getElementById('fiche-horaire-station');
      if (!modal || !select) return;

      // Populate station list sorted alphabetically
      const stations = [...(this.game.world.stations || [])].sort((a, b) => a.name.localeCompare(b.name));
      select.innerHTML = stations.map(st => `<option value="${escapeHtml(st.id)}">${escapeHtml(st.name)}</option>`).join('');

      modal.classList.remove('hidden');

      // Bind generate button (replace handler to avoid duplicates)
      const btn = document.getElementById('btn-fiche-horaire-go');
      if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
          const stationId = select.value;
          if (!stationId) return;
          modal.classList.add('hidden');
          this._generateFicheHoraire(stationId);
        });
      }
    },

  _generateFicheHoraire(stationId) {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) return alertToast('jsPDF non charge');
      try {
      const noAcc = (s) => typeof s === 'string' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : String(s);
      const minToStr = (m) => { const h = Math.floor(m / 60) % 24; const mi = Math.round(m % 60); return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`; };

      const station = this.game.world.getStationById(stationId);
      if (!station) return alertToast('Gare introuvable');
      const stationName = noAcc(station.name);
      const company = noAcc(this.game.account.companyName || 'Rail Empire');
      const now = new Date().toLocaleDateString('fr-FR');

      // Collect all services that stop at this station (type 'arret')
      const allServices = this.game.scheduleCreator.services || [];
      const entries = [];

      for (const svc of allServices) {
        if (!svc.active) continue;
        const stops = svc.stops || [];

        // Find this station in the forward stops
        for (let i = 0; i < stops.length; i++) {
          if (stops[i].stationId !== stationId) continue;
          if (stops[i].type !== 'arret') continue;

          // Determine destination (last arret stop after this one)
          let destStop = null, destStation = null;
          for (let j = stops.length - 1; j > i; j--) {
            if (stops[j].type === 'arret' && stops[j].stationId) {
              destStop = stops[j];
              destStation = this.game.world.getStationById(stops[j].stationId);
              break;
            }
          }
          if (!destStation) continue; // Skip if this is the last stop (terminus)

          // Intermediate stops (between this station and destination, only 'arret' type)
          const intermediates = [];
          for (let j = i + 1; j < stops.length; j++) {
            if (stops[j] === destStop) break;
            if (stops[j].type !== 'arret' || !stops[j].stationId) continue;
            const intSt = this.game.world.getStationById(stops[j].stationId);
            if (intSt) {
              intermediates.push({
                name: noAcc(intSt.name),
                depTime: minToStr(stops[j].departureTime),
              });
            }
          }

          // Platform at this station
          const voie = stops[i].platform || '';

          entries.push({
            serviceName: noAcc(svc.name),
            depTime: stops[i].departureTime,
            depTimeStr: minToStr(stops[i].departureTime),
            destination: noAcc(destStation.name),
            destArrTime: minToStr(destStop.arrivalTime),
            intermediates,
            voie,
          });
        }

        // Also check return leg if round trip
        if (svc.roundTrip) {
          const retStops = svc.buildReturnStops();
          for (let i = 0; i < retStops.length; i++) {
            if (retStops[i].stationId !== stationId) continue;
            if (retStops[i].type !== 'arret') continue;

            let destStop = null, destStation = null;
            for (let j = retStops.length - 1; j > i; j--) {
              if (retStops[j].type === 'arret' && retStops[j].stationId) {
                destStop = retStops[j];
                destStation = this.game.world.getStationById(retStops[j].stationId);
                break;
              }
            }
            if (!destStation) continue;

            const intermediates = [];
            for (let j = i + 1; j < retStops.length; j++) {
              if (retStops[j] === destStop) break;
              if (retStops[j].type !== 'arret' || !retStops[j].stationId) continue;
              const intSt = this.game.world.getStationById(retStops[j].stationId);
              if (intSt) {
                intermediates.push({
                  name: noAcc(intSt.name),
                  depTime: minToStr(retStops[j].departureTime),
                });
              }
            }

            const voie = retStops[i].platform || '';
            const retName = svc.returnName ? noAcc(svc.returnName) : noAcc(svc.name) + ' (retour)';

            entries.push({
              serviceName: retName,
              depTime: retStops[i].departureTime,
              depTimeStr: minToStr(retStops[i].departureTime),
              destination: noAcc(destStation.name),
              destArrTime: minToStr(destStop.arrivalTime),
              intermediates,
              voie,
            });
          }
        }
      }

      // Sort by departure time
      entries.sort((a, b) => a.depTime - b.depTime);

      if (entries.length === 0) {
        return alertToast(`Aucun service ne dessert ${station.name}`);
      }

      // Generate PDF
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();

      // --- HEADER ---
      let y = 15;
      doc.setFillColor(0, 40, 85);
      doc.rect(0, 0, pw, 30, 'F');
      doc.setTextColor(255);
      doc.setFontSize(16); doc.setFont(undefined, 'bold');
      doc.text(stationName, pw / 2, 13, { align: 'center' });
      doc.setFontSize(10); doc.setFont(undefined, 'normal');
      doc.text(`Fiche horaire -- ${company} -- ${now}`, pw / 2, 21, { align: 'center' });
      doc.setFontSize(9);
      doc.text(`${entries.length} train(s)`, pw / 2, 27, { align: 'center' });
      doc.setTextColor(0);
      y = 36;

      // --- COLUMN HEADERS ---
      doc.setFillColor(230, 230, 230);
      doc.rect(10, y - 4, pw - 20, 8, 'F');
      doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(60);
      doc.text('Dep.', 12, y);
      doc.text('Service', 30, y);
      doc.text('Destination', 70, y);
      doc.text('Arr.', 140, y);
      doc.text('Voie', pw - 18, y, { align: 'center' });
      doc.setTextColor(0);
      y += 8;

      // --- ENTRIES ---
      for (const entry of entries) {
        // Check page overflow
        const neededHeight = 14 + entry.intermediates.length * 4;
        if (y + neededHeight > 275) {
          // Footer
          doc.setFontSize(7); doc.setTextColor(150); doc.setFont(undefined, 'italic');
          doc.text(`${stationName} -- ${company}`, pw / 2, 290, { align: 'center' });
          doc.setTextColor(0); doc.setFont(undefined, 'normal');
          doc.addPage();
          y = 15;
        }

        // Separator line
        doc.setDrawColor(200);
        doc.line(10, y - 2, pw - 10, y - 2);

        // Departure time (bold, large)
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text(entry.depTimeStr, 12, y + 2);

        // Service name
        doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(80);
        doc.text(entry.serviceName, 30, y + 2);
        doc.setTextColor(0);

        // Destination (bold, prominent)
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text(entry.destination, 70, y + 2);

        // Arrival time at destination
        doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(80);
        doc.text(entry.destArrTime, 140, y + 2);
        doc.setTextColor(0);

        // Voie (right column, highlighted)
        if (entry.voie) {
          doc.setFontSize(10); doc.setFont(undefined, 'bold');
          doc.text(String(entry.voie), pw - 18, y + 2, { align: 'center' });
        }

        y += 7;

        // Intermediate stations (smaller, grey)
        if (entry.intermediates.length > 0) {
          doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(120);
          const intText = entry.intermediates.map(s => `${s.name} (${s.depTime})`).join('  |  ');
          // Split long text across lines
          const lines = doc.splitTextToSize(intText, pw - 40);
          for (const line of lines) {
            doc.text(line, 30, y);
            y += 3.5;
          }
          doc.setTextColor(0);
        }

        y += 4;
      }

      // Final separator
      doc.setDrawColor(200);
      doc.line(10, y - 2, pw - 10, y - 2);

      // Footer
      doc.setFontSize(7); doc.setTextColor(150); doc.setFont(undefined, 'italic');
      doc.text(`${stationName} -- ${company} -- Genere automatiquement`, pw / 2, 290, { align: 'center' });
      doc.setTextColor(0);

      doc.save(`fiche_horaire_${stationName.replace(/\s/g, '_')}_${now.replace(/\//g, '-')}.pdf`);
      } catch (err) { console.error('Fiche horaire PDF error:', err); alertToast('Erreur generation PDF: ' + err.message); }
    },

  renderEconomyPage() {
      const eco = this.game.economy;
      const el = (id) => document.getElementById(id);
      if (el('eco-balance')) el('eco-balance').textContent = eco.formatAmount(eco.balance);
      if (el('eco-revenue')) el('eco-revenue').textContent = '+' + eco.formatAmount(eco.revenue);
      if (el('eco-expenses')) el('eco-expenses').textContent = '-' + eco.formatAmount(eco.expenses);
      if (el('eco-penalties')) el('eco-penalties').textContent = '-' + eco.formatAmount(eco.penalties);
      if (el('eco-passengers')) el('eco-passengers').textContent = eco.totalPassengers.toLocaleString('fr-FR');
      if (el('eco-freight-tonnes')) el('eco-freight-tonnes').textContent = eco.totalFreightTonnes.toLocaleString('fr-FR');

      // Km de voies possédés (tracks + tronçons)
      if (el('eco-track-km')) {
        const tracks = this.game.world.tracks || [];
        let totalTrackKm = tracks.reduce((s, t) => s + (t.distance || 0), 0);
        if (this.game.voiePointManager) {
          totalTrackKm += this.game.voiePointManager.getAllTroncons().reduce((s, t) => s + (t.distance || 0), 0);
        }
        el('eco-track-km').textContent = Math.round(totalTrackKm).toLocaleString('fr-FR');
      }
      // Total km parcourus par tous les trains (sum all services per rame)
      if (el('eco-total-train-km')) {
        const rameKm = new Map();
        for (const svc of this.game.scheduleCreator.getActiveServices()) {
          if (svc.rame && svc.train) {
            const rid = svc.rame.id;
            rameKm.set(rid, (rameKm.get(rid) || 0) + (svc.train.totalKmRun || 0));
          }
        }
        let totalKm = 0;
        for (const r of this.game.rameManager.getAll()) {
          totalKm += rameKm.get(r.id) || r.totalKmRun || 0;
        }
        el('eco-total-train-km').textContent = Math.round(totalKm).toLocaleString('fr-FR');
      }

      const histEl = el('eco-history');
      if (histEl) {
        histEl.innerHTML = eco.history.slice().reverse().slice(0, 40).map(e => `
          <div class="eco-entry ${e.type === 'revenue' ? 'revenue-entry' : 'expense-entry'}">
            <span>${e.description || e.category}</span>
            <span>${e.type === 'revenue' ? '+' : '-'}${eco.formatAmount(e.amount)}</span>
          </div>
        `).join('');
      }
    },

  updateTrainsList(services) {
      const container = document.getElementById('trains-list');
      if (!container) return;

      // Show only active trains (moving or stopped at station) + rescue services + breakdowns.
      // DEP-06 : trains en maintenance absents du bandeau train.
      const activeTrains = [];
      for (const svc of services) {
        if (!svc || !svc.train || svc.train.inMaintenance || (svc.rame && svc.rame.inMaintenance)) continue;
        const t = svc.train;
        if (
          svc.isRescue ||
          svc.state === 'moving' || svc.state === 'stopped_at_station' ||
          // LVM-04/Annexe 4 : trains en attente à quai (pré-départ) et trains visibles sur la carte
          (svc.state === 'waiting' && svc.position && t.stoppedAt) ||
          t.speed > 0 ||
          t.breakdown
        ) {
          activeTrains.push(svc);
        }
      }

      if (activeTrains.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:10px">Aucun train en service. Creez un trajet dans "Horaires".</p>';
        return;
      }

      const html = activeTrains.map(svc => {
        const t = svc.train;
        if (!t) return '';

        // S1.1: Delay status with ±0.5 min neutral zone to avoid flickering
        const rawDelay = Number.isFinite(t.delay) ? t.delay : 0;
        const delayVal = Math.abs(rawDelay) < 0.5 ? 0 : Math.round(rawDelay);
        let delayDisplay, delayClass;
        if (delayVal > 0) {
          delayDisplay = `Retard: +${delayVal} min`;
          delayClass = 'delay-late';
        } else if (delayVal < 0) {
          delayDisplay = `Avance: ${Math.abs(delayVal)} min`;
          delayClass = 'delay-early';
        } else {
          delayDisplay = 'À l\'heure';
          delayClass = 'delay-ok';
        }

        // Rescue services have simplified display
        if (svc.isRescue) {
          const stateLabels = { en_route: 'En route', recovering: 'Remorquage', returning: 'Retour depot' };
          const stateLabel = stateLabels[svc.rescueState] || '';
          return `
            <div class="train-card-fixed" style="border-color:#ef4444">
              <div class="tc-row1">
                <span class="train-color" style="background:#ef4444"></span>
                <span class="tc-name">${svc.name}</span>
                <span class="tc-speed">${Math.round(t.speed)} km/h</span>
              </div>
              <div class="tc-row2">
                <span style="color:#ef4444;font-weight:600;font-size:10px">SECOURS</span>
                <span style="color:var(--text2);font-size:10px">${stateLabel}</span>
              </div>
            </div>
          `;
        }

        // Helper: previous/next scheduled arret for "Prochain arrêt" / approach distance.
        const currentStops = typeof svc.getCurrentStops === 'function' ? svc.getCurrentStops() : [];
        const curIdx = svc.currentStopIndex || 0;
        const isArretStop = (s) => s && s.type === 'arret' && s.stationId;
        let prevArret = null, nextArret = null;
        if (svc.state === 'moving') {
          for (let i = curIdx - 1; i >= 0; i--) if (isArretStop(currentStops[i])) { prevArret = currentStops[i]; break; }
          for (let i = curIdx; i < currentStops.length; i++) if (isArretStop(currentStops[i])) { nextArret = currentStops[i]; break; }
        } else {
          const curStationIdx = curIdx > 0 ? curIdx - 1 : 0;
          for (let i = curStationIdx; i >= 0; i--) if (isArretStop(currentStops[i])) { prevArret = currentStops[i]; break; }
          for (let i = curStationIdx + 1; i < currentStops.length; i++) if (isArretStop(currentStops[i])) { nextArret = currentStops[i]; break; }
        }
        const prevArretStation = prevArret ? this.game.world?.getStationById(prevArret.stationId) : null;
        const nextArretStation = nextArret ? this.game.world?.getStationById(nextArret.stationId) : null;

        // Helper: nearest stations in both directions, including unserved ones, for "Se situe entre".
        let ctxPrevStation = null, ctxNextStation = null;
        if (svc.position && this.game.world?.stations?.length) {
          const heading = svc.train?.geoHeading ?? 0;
          const pos = svc.position;
          const cosLat = Math.cos(pos.lat * Math.PI / 180);
          let prevBestDist = Infinity, nextBestDist = Infinity;
          for (const st of this.game.world.stations) {
            if (st == null || !Number.isFinite(st.lat) || !Number.isFinite(st.lon)) continue;
            const dLat = (st.lat - pos.lat) * 111;
            const dLon = (st.lon - pos.lon) * 111 * cosLat;
            const dist = Math.sqrt(dLat * dLat + dLon * dLon);
            if (dist < 0.1) continue; // ignore the station we are standing on
            const bearing = Math.atan2(dLon, dLat);
            let diff = bearing - heading;
            while (diff <= -Math.PI) diff += 2 * Math.PI;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            if (Math.abs(diff) <= Math.PI / 2) {
              if (dist < nextBestDist) { nextBestDist = dist; ctxNextStation = st; }
            } else if (dist < prevBestDist) {
              prevBestDist = dist; ctxPrevStation = st;
            }
          }
        }
        const ctxPrevName = escapeHtml(ctxPrevStation?.name || prevArretStation?.name || '');
        const ctxNextName = escapeHtml(ctxNextStation?.name || nextArretStation?.name || '');

        // Distance to next scheduled arret for the approach label
        let nextDistKm = null;
        if (svc.state === 'moving' && nextArretStation && svc.position) {
          let tgtLat = nextArretStation.lat, tgtLon = nextArretStation.lon;
          if (nextArret?.voiePointId && this.game.voiePointManager) {
            const vp = this.game.voiePointManager.getVoiePointById(nextArret.voiePointId);
            if (vp) { tgtLat = vp.lat; tgtLon = vp.lon; }
          } else if (nextArret?.platform && this.game.voiePointManager) {
            const svp = this.game.voiePointManager.getStationVoiePoint(nextArret.stationId, nextArret.platform);
            if (svp) { tgtLat = svp.lat; tgtLon = svp.lon; }
          }
          const dLat = (tgtLat - svc.position.lat) * 111;
          const dLon = (tgtLon - svc.position.lon) * 111 * Math.cos(svc.position.lat * Math.PI / 180);
          nextDistKm = Math.sqrt(dLat * dLat + dLon * dLon);
        }

        // S3: Approach / platform / regulation status
        let contextLabel = '', contextClass = '';
        const currentStop = svc.state === 'moving'
          ? (curIdx < currentStops.length ? currentStops[curIdx] : null)
          : (curIdx > 0 ? currentStops[curIdx - 1] : currentStops[0]);
        const currentIsWaypoint = currentStop?.type === 'waypoint' || currentStop?.type === 'passage';
        if ((svc.state === 'stopped_at_station' || (svc.state === 'waiting' && t.stoppedAt)) && !currentIsWaypoint) {
          const stName = escapeHtml(t.stoppedAt?.name || '');
          const voie = t.platform ? ` Voie ${escapeHtml(t.platform)}` : '';
          if (svc._atTerminus) {
            contextLabel = stName ? `Terminus — ${stName}${voie}` : 'Terminus';
            contextClass = 'ctx-quai';
          } else if (svc.state === 'waiting') {
            const waitMin = this.game?.engine ? Math.max(0, Math.round(((svc.stops?.[0]?.departureTime ?? 0) - (this.game.engine.getParisTime().hours * 60 + this.game.engine.getParisTime().minutes)))) : 0;
            contextLabel = stName ? `En attente — ${stName}${voie} (${waitMin} min)` : 'En attente';
            contextClass = 'ctx-quai';
          } else {
            contextLabel = stName ? `À quai — ${stName}${voie}` : 'À quai';
            contextClass = 'ctx-quai';
          }
        } else if (t.signalAlert === 'closed') {
          contextLabel = 'Arrêt pour signal fermé';
          contextClass = 'ctx-signal-closed';
        } else if (t.blockedBy || t.signalAlert === 'caution') {
          contextLabel = 'Régulation du trafic';
          contextClass = 'ctx-regulation';
        } else if (svc.state === 'moving' && t.speed > 0) {
          if (nextArretStation && svc.position && nextDistKm != null) {
            if (nextDistKm < 0.3) {
              contextLabel = 'À l\'approche';
              contextClass = 'ctx-approach';
            } else if (ctxPrevName && ctxNextName && ctxPrevName !== ctxNextName) {
              contextLabel = `Se situe entre ${ctxPrevName} et ${ctxNextName}`;
              contextClass = 'ctx-between';
            } else if (ctxNextName) {
              contextLabel = `En route vers ${ctxNextName}`;
              contextClass = 'ctx-between';
            }
          }
        }

        // "Circule sur Voie X" — use the train's current voie from schedule data
        let circuleSurVoie = '';
        if (svc.state === 'moving' && svc.position && this.game.voiePointManager) {
          // Priority: 1) previous stop's voie, 2) nearest voie point
          const prevStopIdx = (svc.currentStopIndex || 1) - 1;
          const curStops = typeof svc.getCurrentStops === 'function' ? svc.getCurrentStops() : [];
          const prevStop = curStops[prevStopIdx];
          let voie = prevStop?.platform || null;
          if (!voie) {
            voie = this.game.voiePointManager.getVoieAtPosition(svc.position);
          }
          if (voie) {
            circuleSurVoie = `Circule sur Voie ${voie}`;
          }
        }

        // Next stop info — Annex 4: "Prochain arrêt : X - Arrivée prévue à XhX" (skip waypoints/passages)
        const nextStop = typeof svc.getNextStop === 'function' ? svc.getNextStop() : null;
        let nextInfo;
        if (svc._atTerminus && svc._nextDepartureTime != null) {
          const pt = this.game?.engine?.getParisTime?.();
          const currentMin = pt ? pt.hours * 60 + pt.minutes : 0;
          const waitMin = Math.max(0, Math.round(svc._nextDepartureTime - currentMin));
          nextInfo = `Terminus — départ dans ${waitMin} min`;
        } else if (svc.cancelled) {
          nextInfo = 'Service supprimé';
        } else if (svc.completed) {
          nextInfo = 'Service terminé';
        } else if (nextArret && nextArretStation) {
          const fmtTime = (m) => this.minToTimeStr(((Math.round(m) % 1440) + 1440) % 1440);
          const voie = (nextArret.platform && nextArret.stationId) ? ` Voie ${escapeHtml(nextArret.platform)}` : '';
          const plannedArr = nextArret.arrivalTime ?? 0;
          const actualArr = plannedArr + delayVal;
          const plannedStr = fmtTime(plannedArr);
          const actualStr = fmtTime(actualArr);
          const distStr = nextDistKm != null ? ` — ${Math.round(nextDistKm)} km` : '';
          const arrStr = delayVal !== 0
            ? `<span style="text-decoration:line-through;color:#888">${plannedStr}</span> <span style="color:#facc15;font-weight:600">${actualStr}</span>`
            : actualStr;
          nextInfo = `Prochain arrêt : ${escapeHtml(nextArretStation.name)}${voie} — Arrivée prévue à ${arrStr}${distStr}`;
        } else if (nextStop) {
          nextInfo = `→ ...`;
        } else {
          nextInfo = 'Termine';
        }

        // S4 + S12: Platform label with station name + "Voie X"
        let platformLabel = '';
        if (t.platform) {
          const stoppedStation = t.stoppedAt;
          let voieName;
          if (stoppedStation?.platformNames?.length >= t.platform) {
            voieName = stoppedStation.platformNames[t.platform - 1];
          } else {
            voieName = String(t.platform);
          }
          const stName = escapeHtml(stoppedStation?.name || '');
          const safeVoieName = escapeHtml(voieName);
          platformLabel = stName ? `${stName} Voie ${safeVoieName}` : `Voie ${safeVoieName}`;
        }

        // S12: Train identification (series + number)
        const displayName = t.seriesName ? escapeHtml(`${t.seriesName} ${t.number || ''}`.trim()) : escapeHtml(svc.name);

        // S2: Train images (scrollable zone) — absent pour les trains de travaux.
        let imageHtml = '';
        if (!svc.isWorkTrain && svc.serviceType !== 'work' && svc.rame && svc.rame.elementDetails) {
          const imgs = svc.rame.elementDetails
            .filter(e => e.imageData)
            .map(e => `<img src="${escapeHtml(e.imageData)}" class="tc-train-img"${e.flipped ? ' style="transform: scaleX(-1);"' : ''}>`)
            .join('');
          if (imgs) {
            imageHtml = `<div class="tc-images-scroll">${imgs}</div>`;
          }
        }

        // Annexes 4-5 — charge transportée dans le bandeau train (utilise les comptages réels).
        let payloadHtml = '';
        if (svc.rame && svc.serviceType !== 'work') {
          const rame = svc.rame;
          if (svc.category === 'fret' || rame.totalFreightCapacity > 0) {
            const load = Math.max(0, svc._onboardFreight != null ? Math.round(svc._onboardFreight) : Math.round(rame.totalFreightCapacity * 0.7));
            payloadHtml = `<div class="tc-line"><span style="color:var(--text2);font-size:10px">${load} tonnes de frets transportées</span></div>`;
          } else if (svc.category === 'voyageur' || rame.totalCapacity > 0) {
            const pax = Math.max(0, svc._onboardPax != null ? Math.round(svc._onboardPax) : Math.round(rame.totalCapacity * 0.7));
            payloadHtml = `<div class="tc-line"><span style="color:var(--text2);font-size:10px">${pax} passagers à bord</span></div>`;
          }
        }

        // Incident status
        let incidentHtml = '';
        if (t.incident) {
          const incColor = t.incident.effect === 'stop' ? '#f87171' : '#facc15';
          const incLabel = t.incident.effect === 'stop' ? 'Interruption' : `Ralentissement (${t.incident.speedLimit} km/h)`;
          const incIcon = t.incident.effect === 'stop' ? '<img src="img/interruption.png" style="height:12px;vertical-align:middle;margin-right:3px">' : '<img src="img/ralentissement.png" style="height:12px;vertical-align:middle;margin-right:3px">';
          incidentHtml = `<div class="tc-line"><span style="color:${incColor};font-weight:600;font-size:10px">${incIcon}${incLabel}${t.incident.name ? ' — ' + escapeHtml(t.incident.name) : ''}</span></div>`;
        }

        // Breakdown status
        let breakdownHtml = '';
        if (t.breakdown) {
          const repairInfo = this.game.depotManager.getRepairInfo(svc.id);
          const repairLabel = repairInfo ? ` — Reparation ${Math.ceil(repairInfo.remainingMin)} min` : '';
          breakdownHtml = `<div class="tc-line"><span style="color:#ef4444;font-weight:600;font-size:10px">EN PANNE${repairLabel}</span></div>`;
        }

        // Maintenance status (check rame)
        let maintenanceHtml = '';
        if (t.inMaintenance || (svc.rame && svc.rame.inMaintenance)) {
          const rameId = svc.rame?.id;
          const maintInfo = rameId ? this.game.depotManager.getRameMaintenanceInfo(rameId) : null;
          const maintLabel = maintInfo ? ` — ${Math.ceil(maintInfo.remainingMin)} min` : '';
          maintenanceHtml = `<div class="tc-line"><span style="color:#3b82f6;font-weight:600;font-size:10px">EN MAINTENANCE${maintLabel}</span></div>`;
        }

        // Wear info (use rame as source of truth)
        const rameWear = svc.rame ? (svc.rame.wearLevel || 0) : (t.wearLevel || 0);
        const rameKm = svc.rame ? (svc.rame.totalKmRun || 0) : (t.totalKmRun || 0);
        const wearHtml = rameKm > 0 ? `<div class="tc-line"><span style="color:var(--text3);font-size:9px">Usure: ${Math.round(rameWear)}% · Total: ${Math.round(rameKm)} km</span></div>` : '';

        const cat = svc.category || t.category || 'voyageur';
        const catColor = escapeHtml(LVM_CAT_COLORS[cat] || t.color);
        const selCls = this.selectedService?.id === svc.id ? ' tc-selected' : '';

        // LVM-04 — statut ligne / situation
        let statusText = 'En ligne', statusColor = '#22c55e';
        if (svc.cancelled) { statusText = 'Supprimé'; statusColor = '#ef4444'; }
        else if (svc.completed) { statusText = 'Terminé'; statusColor = '#16a34a'; }
        else if (svc.state === 'stopped_at_station' || (svc.state === 'waiting' && t.stoppedAt)) { statusText = 'À quai'; }
        else if (svc.state === 'waiting') { statusText = 'En attente'; statusColor = '#f59e0b'; }
        else if (t.speed === 0) { statusText = 'Arrêté'; statusColor = '#f59e0b'; }

        const statusBadge = svc.cancelled
          ? `<span style="color:#ef4444;font-weight:700;font-size:10px;margin-left:auto">✕ Supprimé</span>`
          : (svc.completed ? `<span style="color:#16a34a;font-weight:700;font-size:10px;margin-left:auto">Terminé</span>` : '');

        return `
          <div class="train-card-fixed${selCls}" style="cursor:pointer" onclick="game.ui.selectServiceById('${jsString(svc.id)}')">
            <div class="tc-line tc-header">
              <span class="tc-status-dot" style="background:${catColor}"></span>
              <div class="tc-scroll"><span class="tc-scroll-text tc-name">${displayName}</span></div>
              <span class="tc-speed" style="margin-left:auto">${Math.round(t.speed)} km/h</span>
            </div>
            ${imageHtml}
            <div class="tc-line" style="display:flex;gap:8px;align-items:center">
              <span class="tc-status" style="color:${statusColor}">${statusText}</span>
              <span class="tc-delay ${delayClass}">${delayDisplay}</span>
              ${statusBadge}
            </div>
            ${contextLabel ? `<div class="tc-line tc-scroll"><span class="tc-scroll-text ${contextClass}">${contextLabel}</span></div>` : ''}
            <div class="tc-line tc-scroll"><span class="tc-scroll-text tc-next" style="color:#22c55e">${nextInfo}</span></div>
            ${payloadHtml}
            ${incidentHtml}
            ${breakdownHtml}
            ${maintenanceHtml}
            ${wearHtml}
          </div>
        `;
      }).join('');
      // S10: Only update DOM if content actually changed to avoid flicker
      if (container.innerHTML !== html) container.innerHTML = html;

      // LVM-06 — le train sélectionné reste visible en haut du bandeau.
      if (this.selectedService && this._lastSelectedForScroll !== this.selectedService.id) {
        this._lastSelectedForScroll = this.selectedService.id;
        const selectedCard = container.querySelector('.tc-selected');
        if (selectedCard) selectedCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // LVM-06 — garde le panneau du train sélectionné à jour chaque frame.
      this._syncLivemapPanel();
    },

  garageService(svcId) {
      const svc = this.game.scheduleCreator.services.find(s => s.id === svcId);
      if (!svc) return;
      const sel = document.getElementById(`garage-vp-${svcId}`);
      if (!sel) return;
      svc.garageToVoiePoint(sel.value);
    },

  resumeFromGarage(svcId) {
      const svc = this.game.scheduleCreator.services.find(s => s.id === svcId);
      if (!svc) return;
      svc.resumeFromGarage();
    },

  updateFreightTab() {
      const container = document.getElementById('freight-list');
      if (!container) return;
      const contracts = this.game.freightManager.contracts;
      const active = contracts.filter(c => c.active);
      const completed = contracts.filter(c => !c.active);

      container.innerHTML = `
        <div class="section-title">Contrats actifs (${active.length})</div>
        ${active.map(c => `
          <div class="contract-item">
            <b>${c.cargoName}</b>: ${c.quantity} ${c.unit}<br>
            ${c.from} -> ${c.to}<br>
            ${this.game.economy.formatAmount(c.payment)}
            <div class="progress-bar"><div class="progress-fill" style="width:${c.progress || 0}%"></div></div>
          </div>
        `).join('')}
        <div class="section-title">Completes (${completed.length})</div>
      `;
    },

  renderDashboard() {
      try {
        const container = document.getElementById('dashboard-container');
        this.game.dashboard.render(container, this.game);
        // X — real-time refresh every 5s while Dashboard is visible
        if (this._dashboardInterval) clearInterval(this._dashboardInterval);
        this._dashboardInterval = setInterval(() => {
          if (this.activePage !== 'dashboard') { clearInterval(this._dashboardInterval); this._dashboardInterval = null; return; }
          this.renderDashboard();
        }, 5000);
      } catch(e) { console.warn('Dashboard render error:', e); }
    },

  renderGraphMarche() {
      try {
        const container = document.getElementById('graph-marche-container');
        this.game.graphMarche.render(container, this.game);
      } catch(e) { console.warn('GraphMarche render error:', e); }
    },

  renderStaffPage() {
      try {
        const container = document.getElementById('staff-container');
        this.game.staffManager.render(container, this.game);
      } catch(e) { console.warn('Staff render error:', e); }
    },

  renderWeatherPage() {
      try {
        const container = document.getElementById('weather-container');
        if (!container) return;
        container.innerHTML = '<div id="weather-content"></div><div id="weather-seasonal" style="margin-top:16px"></div>';
        this.game.weather.render(document.getElementById('weather-content'));
        this.game.seasonal.render(document.getElementById('weather-seasonal'), this.game);
      } catch(e) { console.warn('Weather render error:', e); }
    },

  renderSeasonalPage() {
      try {
        const container = document.getElementById('seasonal-container');
        this.game.seasonal.render(container, this.game);
      } catch(e) { console.warn('Seasonal render error:', e); }
    },

  renderConnectionsPage() {
      try {
        const container = document.getElementById('connections-container');
        this.game.connections.render(container, this.game);
      } catch(e) { console.warn('Connections render error:', e); }
    },

  renderStationUpgradesPage() {
      try {
        const container = document.getElementById('station-upgrades-container');
        this.game.stationUpgrades.render(container, this.game);
      } catch(e) { console.warn('StationUpgrades render error:', e); }
    },

  renderJunctionsPage() {
      try {
        const container = document.getElementById('junctions-container');
        this.game.junctionManager.render(container, this.game);
      } catch(e) { console.warn('Junctions render error:', e); }
    },

  renderCargoTypesPage() {
      try {
        const container = document.getElementById('cargo-types-container');
        this.game.cargoTypes.render(container, this.game);
        document.getElementById('btn-create-cargo-type')?.addEventListener('click', () => this.openCargoTypeModal());
      } catch(e) { console.warn('CargoTypes render error:', e); }
    },

  openCargoTypeModal() {
      const modal = document.getElementById('modal-cargo-type');
      if (!modal) return;
      const catSel = document.getElementById('cargo-type-category');
      if (catSel) {
        catSel.innerHTML = Object.entries(this.game.cargoTypes.categories)
          .map(([key, cat]) => `<option value="${key}">${cat.name}</option>`).join('')
          + `<option value="__new__">+ Nouvelle catégorie…</option>`;
      }
      const newcatGroup = document.getElementById('cargo-type-newcat-group');
      const toggleNewcat = () => { if (newcatGroup) newcatGroup.classList.toggle('hidden', catSel.value !== '__new__'); };
      if (catSel) catSel.onchange = toggleNewcat;
      toggleNewcat();
      this._setStockField('cargo-type-newcat', '');
      this._setStockField('cargo-type-name', '');
      this._setStockField('cargo-type-unit', 't');
      this._setStockField('cargo-type-price', '0');
      const hz = document.getElementById('cargo-type-hazard'); if (hz) hz.checked = false;
      const saveBtn = document.getElementById('btn-save-cargo-type');
      if (saveBtn) saveBtn.onclick = () => this.saveCargoType();
      modal.classList.remove('hidden');
    },

  saveCargoType() {
      const catSel = document.getElementById('cargo-type-category');
      const res = this.game.cargoTypes.addCustomType({
        categoryKey: catSel?.value,
        categoryName: document.getElementById('cargo-type-newcat')?.value,
        name: document.getElementById('cargo-type-name')?.value,
        unit: document.getElementById('cargo-type-unit')?.value || 't',
        pricePerUnit: document.getElementById('cargo-type-price')?.value,
        hazard: document.getElementById('cargo-type-hazard')?.checked,
      });
      if (!res.ok) { alertToast(res.error || 'Erreur'); return; }
      this.game.saveState();
      document.getElementById('modal-cargo-type')?.classList.add('hidden');
      this.renderCargoTypesPage();
    },

  renderITEModulesPage() {
      try {
        const container = document.getElementById('ite-modules-container');
        this.game.iteModules.render(container, this.game);
      } catch(e) { console.warn('ITEModules render error:', e); }
    },

  renderIndustrialClientsPage() {
      try {
        const container = document.getElementById('industrial-clients-container');
        this.game.industrialClients.render(container, this.game);
      } catch(e) { console.warn('IndustrialClients render error:', e); }
    }
};

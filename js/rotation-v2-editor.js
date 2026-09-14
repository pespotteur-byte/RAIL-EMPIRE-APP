import { htmlText } from './html-text.js';
import { FormationRole, RotationActionType, FormationMember, ActiveFormationSpec, } from './rotation-v2-model.js';
import { formatScheduleClock, ScheduleState } from './schedule-v2-model.js';
// HOTFIX62-ROULEMENTS-100PCT-READABILITY
// HOTFIX63-ROULEMENTS-CLARITY-FIRST-WORKFLOW
/* SAISON 3 / ALPHA15 — historical source-inspection compatibility only.
if(a==='select-line')this.activeView='line'
if(this.activeView==='line')this._renderRv63Line
selected?this._renderRv63ServiceDetails(rot,o):''
*/
// Vocabulary compatibility retained from the original player-facing Roulements UI:
// Toutes les lignes · Diagramme réel · Montage / opérations · Journée matériel · Tableau.
function esc(s) { const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }; return String(s ?? '').replace(/[&<>"']/g, (c) => entities[String(c)] || String(c)); }
function fmtDuration(sec) { sec = Math.max(0, Math.round(sec || 0)); const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60); return `${d ? `${d}j ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
function roleLabel(r) { return ({ LEAD: 'Tête', ACTIVE_MULTIPLE: 'UM active', PUSHER: 'Pousse', VEHICLE: 'CV / en véhicule', COACH: 'Voiture', WAGON: 'Wagon' })[String(r)] || r; }
function actionLabel(a) { return ({ ATTACH: 'Atteler', DETACH: 'Dételer', CHANGE_LOCOMOTIVE: 'Changer locomotive', SPLIT: 'Couper / séparer', MERGE: 'Réunir', ADD_PUSHER: 'Ajouter pousse', REMOVE_PUSHER: 'Retirer pousse', ADD_CV: 'Ajouter CV', REMOVE_CV: 'Retirer CV' })[String(a)] || a; }
function actionDisplay(a) { const row = (a && typeof a === 'object' ? a : {}); if (row.details?.operationKind === 'FORM_UM')
    return 'Former une UM'; if (row.details?.operationKind === 'SPLIT_UM')
    return 'Séparer l’UM'; return actionLabel(row.type ?? a); }
function parseElectricSystems(text) { return String(text || '').split(/[;,]+/).map((x) => x.trim()).filter(Boolean).map((x) => { const [v, f = '0'] = x.split('@'); return { voltage: Number(v) || 0, frequency: Number(f) || 0 }; }).filter((x) => x.voltage > 0); }
function parseGauges(text) { return String(text || '').split(/[;,\s]+/).map(Number).filter((x) => Number.isFinite(x) && x > 0); }
function roleForVehicle(v) { const c = String(v?.category || '').toLowerCase(); if (c.includes('wagon'))
    return FormationRole.WAGON; if (Number(v?.powerW || 0) > 0 || c.includes('locomotive') || c.includes('automotrice') || c.includes('autorail'))
    return FormationRole.ACTIVE_MULTIPLE; return FormationRole.COACH; }
const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
export class RotationV2Editor {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this.selectedRotationId = '';
        this.selectedOccurrenceId = '';
        this.selectedMaterialId = '';
        this.activeView = 'fleet';
        this.libraryTab = 'schedules';
        this.searchQuery = '';
        this.rotationSearchQuery = '';
        this.rotationStatusFilter = 'all';
        this.selectedDate = '';
        this.materialSort = 'number';
        this.sheetZoomIndex = -1;
        this.sheetLibraryCollapsed = false;
        this.sheetInspectorCollapsed = false;
        this._history = [];
        this._future = [];
        this._dragPayload = null;
        this._injectStyle();
    }
    _syncRuntimeNow() { if (this.game._forceV2RuntimeSyncNow)
        return this.game._forceV2RuntimeSyncNow(); const pt = this.game.engine?.getParisTime?.(); const fallback = pt ? (pt.hours * 60 + pt.minutes + (pt.seconds || 0) / 60) : 0; const t = Number.isFinite(Number(this.game.timeOfDay)) ? Number(this.game.timeOfDay) : Number.isFinite(Number(this.game._gameTime)) ? Number(this.game._gameTime) : fallback; const d = this.game._currentDate || this.game.engine?.getParisDate?.(); if (this.game.scheduleV2Runtime)
        this.game.scheduleV2Runtime._lastSyncKey = ''; this.game.scheduleV2Runtime?.forceSync?.(t, d) || this.game.scheduleV2Runtime?.sync(t, d); this.game._updateV2RuntimeStatus?.(); }
    _injectStyle() {
        if (document.getElementById('rot-v2-style'))
            return;
        const s = document.createElement('style');
        s.id = 'rot-v2-style';
        s.textContent = `
    #page-rotations{overflow:scroll!important;scrollbar-gutter:stable both-edges}.rv3-shell{height:calc(100vh - 70px);display:flex;flex-direction:column;min-height:680px;min-width:1220px}.rv3-head{display:flex;gap:8px;align-items:center;flex-wrap:nowrap;overflow-x:scroll;overflow-y:hidden;min-height:42px;padding:10px 12px;border-bottom:1px solid var(--border);background:var(--bg2)}.rv3-title{font-size:20px;font-weight:900;margin-right:8px}.rv3-head select,.rv3-head input,.rv3-library input{background:var(--input-bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:7px 9px}.rv3-spacer{flex:1}.rv3-viewtabs,.rv3-libtabs{display:flex;gap:4px}.rv3-viewtabs button.active,.rv3-libtabs button.active{background:#1e6eb8;border-color:#4aa3ff;color:#fff}.rv3-work{display:grid;grid-template-columns:minmax(250px,300px) minmax(620px,1fr) minmax(285px,350px);gap:0;min-height:0;min-width:1180px;flex:1;overflow:scroll;scrollbar-gutter:stable both-edges}.rv3-library,.rv3-inspector{background:var(--bg2);overflow:scroll;padding:10px;scrollbar-gutter:stable}.rv3-library{border-right:1px solid var(--border)}.rv3-inspector{border-left:1px solid var(--border)}.rv3-main{min-width:0;min-height:0;background:#08111d;display:flex;flex-direction:column}.rv3-search{width:100%;box-sizing:border-box;margin:8px 0}.rv3-card{border:1px solid var(--border);background:var(--bg3);border-radius:7px;padding:8px;margin:6px 0;cursor:pointer}.rv3-card:hover{border-color:#4c89c6}.rv3-card.selected{border-color:#60a5fa;box-shadow:0 0 0 1px #60a5fa55}.rv3-card small{color:var(--text3)}.rv3-cardrow{display:flex;gap:6px;align-items:flex-start}.rv3-cardrow>div{min-width:0;flex:1}.rv3-mini{font-size:9px;padding:3px 5px}.rv3-summary{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:7px 12px;border-top:1px solid var(--border);background:#0c1725;font-size:11px}.rv3-ok{color:#65d995}.rv3-warn{color:#fbbf24}.rv3-bad{color:#fb7185}.rv3-section{border-bottom:1px solid var(--border);padding:8px 0}.rv3-section h3{font-size:12px;margin:0 0 7px}.rv3-issue{padding:7px;border-radius:5px;background:#321b22;border-left:3px solid #fb7185;margin:5px 0;font-size:10px}.rv3-warning{padding:7px;border-radius:5px;background:#352814;border-left:3px solid #fbbf24;margin:5px 0;font-size:10px}.rv3-chip{display:inline-flex;gap:4px;align-items:center;padding:3px 6px;background:#20354c;border-radius:5px;margin:2px;font-size:9px}.rv3-material-line{display:flex;align-items:center;gap:6px;padding:6px;border:1px solid #26394f;border-radius:6px;margin:5px 0}.rv3-material-line img{width:86px;max-height:40px;object-fit:contain;background:#08111d}.rv3-mainhead{height:42px;display:flex;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid #26394f;background:#0d1928}.rv3-timeline{position:relative;overflow:auto;flex:1}.rv3-axis{position:relative;height:28px;margin-left:180px;border-bottom:1px solid #273b52}.rv3-axis span{position:absolute;top:6px;font-size:9px;color:#91a6be;transform:translateX(-50%)}.rv3-row{height:58px;display:grid;grid-template-columns:180px max-content;border-bottom:1px solid #1c2a3b}.rv3-row-label{position:sticky;left:0;z-index:6;background:#0e1a29;border-right:1px solid #26394f;padding:7px;overflow:hidden}.rv3-track{position:relative;background:repeating-linear-gradient(90deg,#0a1421 0,#0a1421 99px,#17273a 100px)}.rv3-block{position:absolute;top:8px;height:40px;border-radius:5px;background:#185da8;border:1px solid #4a9ded;padding:3px 6px;box-sizing:border-box;overflow:hidden;white-space:nowrap;color:#fff;font-size:9px;cursor:pointer}.rv3-block:hover,.rv3-block.selected{outline:2px solid #a8d6ff;z-index:4}.rv3-block.warn{background:#735019;border-color:#f59e0b}.rv3-block.cancel{background:#6b2631;border-color:#fb7185}.rv3-actionmark{position:absolute;top:0;width:2px;background:#f0b14c;z-index:3;pointer-events:none}.rv3-actionmark span{position:absolute;left:4px;top:1px;background:#332516;color:#ffd99b;border:1px solid #8b662c;border-radius:3px;padding:1px 4px;white-space:nowrap;font-size:8px}.rv3-empty{padding:40px;text-align:center;color:var(--text3)}.rv3-tablewrap{overflow:auto;flex:1;padding:10px}.rv3-table{width:100%;border-collapse:collapse;font-size:11px}.rv3-table th,.rv3-table td{border-bottom:1px solid #26394f;padding:7px;text-align:left}.rv3-table tr{cursor:pointer}.rv3-table tr:hover{background:#10243a}.rv3-materialview{padding:12px;overflow:auto;flex:1}.rv3-materialhero{display:flex;gap:12px;align-items:center;border:1px solid #29415c;background:#0d1928;border-radius:8px;padding:10px;margin-bottom:10px}.rv3-materialhero img{width:150px;max-height:70px;object-fit:contain}.rv3-duty{position:relative;height:62px;border:1px solid #26394f;background:repeating-linear-gradient(90deg,#091421 0,#091421 99px,#17273a 100px);overflow:auto;margin-top:8px}.rv3-dutyblock{position:absolute;top:12px;height:36px;border:1px solid #4a9ded;background:#185da8;border-radius:5px;padding:4px;box-sizing:border-box;font-size:9px;overflow:hidden;white-space:nowrap;cursor:pointer}.rv3-toolbar-mini{display:flex;gap:4px;flex-wrap:wrap}.rv3-toolbar-mini button{font-size:9px;padding:4px 6px}.rv3-rame-strip{display:flex;gap:4px;align-items:flex-end;overflow:auto;padding:8px;background:#07111d;border:1px solid #29415c;border-radius:6px}.rv3-rame-strip img{max-width:120px;max-height:48px;object-fit:contain}.rv3-op{border:1px solid #3a4859;border-radius:6px;padding:6px;margin:5px 0}.rv3-ophead{display:flex;gap:5px;align-items:center}.rv3-ophead b{flex:1}.rv2-search-results{max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:5px;margin-top:4px}.rv2-search-hit{padding:6px;cursor:pointer;border-bottom:1px solid var(--border)}.rv2-search-hit:hover{background:var(--bg3)}.rv2-coupon-builder{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rv2-drop{min-height:210px;border:1px dashed #49617c;border-radius:6px;padding:6px}.rv2-drag{padding:6px;margin:4px 0;border:1px solid #31475f;border-radius:5px;background:#102035;cursor:grab}.rv2-drag.chosen{display:grid;grid-template-columns:28px 1fr 28px;align-items:center;gap:4px}.rv2-rame-strip{display:flex;align-items:flex-end;gap:4px;overflow:auto;padding:10px 4px;border:1px solid #29415c;border-radius:7px;background:#08131f;min-height:112px}.rv2-rame-el{flex:0 0 auto;min-width:92px;max-width:150px;padding:6px;border:1px solid #334c68;border-radius:6px;background:#102035;cursor:pointer;text-align:center;position:relative}.rv2-rame-el.selected{outline:2px solid #38bdf8;background:#10314a}.rv2-rame-el.ready{border-color:#2f9e62}.rv2-rame-el img{display:block;max-width:138px;max-height:55px;object-fit:contain;margin:0 auto 5px}.rv2-rame-status{font-size:9px;color:#9ec6ee}.rv2-rame-status.ok{color:#65d995}.rv2-rame-help{padding:8px;border-left:3px solid #38bdf8;background:#10253a;border-radius:4px;margin:8px 0}.rv2-warning{padding:7px;border-left:4px solid #ff982a;background:#392817;margin:5px 0;border-radius:4px}
    .rv3-card[draggable="true"]{cursor:grab}.rv3-card[draggable="true"]:active{cursor:grabbing}.rv3-block.drag-over{outline:2px dashed #7dd3fc;background:#164e63}.rv3-drop-hint{padding:6px 8px;border:1px dashed #355b7c;border-radius:6px;color:#9ec6ee;margin:6px 0;font-size:10px}.rv3-recommend{border-left:3px solid #38bdf8;padding-left:7px;margin-bottom:10px}.rv3-recommend h4{margin:2px 0 6px;font-size:11px;color:#bde4ff}.rv3-blocknum{display:block;text-align:center;font-size:10px;line-height:14px;overflow:hidden;text-overflow:ellipsis}.rv3-blockends{display:flex;justify-content:space-between;gap:6px;font-size:8px;line-height:12px;color:#d9edff;overflow:hidden}.rv3-blockends span{overflow:hidden;text-overflow:ellipsis}.rv3-opbar{position:relative;height:34px;margin-left:180px;border-bottom:1px solid #273b52;background:#0b1725}.rv3-stopmark{position:absolute;top:4px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;z-index:7}.rv3-stopmark button{width:20px;height:20px;border-radius:50%;padding:0;font-size:13px;line-height:18px;border:1px solid #5f8eb8;background:#17324b;color:#dff1ff;cursor:pointer}.rv3-stopmark button:hover{background:#1e6eb8}.rv3-stopmark small{font-size:7px;color:#8fb3d4;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rv3-coupon-label{color:#d9b8ff}.rv3-materialstats{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0;padding:7px;background:#0b1725;border:1px solid #26394f;border-radius:6px;font-size:10px}.rv3-materialstats b{color:#d8efff}.rv3-action-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:7px 0 10px}.rv3-action-presets button{font-size:10px;text-align:left;padding:7px}.rv3-action-presets button.active{border-color:#60a5fa;background:#153a5b}.rv3-coupon-hero{display:flex;gap:3px;overflow:auto;max-width:320px}.rv3-coupon-hero img{width:90px;max-height:50px;object-fit:contain;background:#08111d}.rv3-row-label[draggable="true"]{cursor:grab}
    .rv3-codebtn{border:0;background:transparent;color:#8fb3d4;font-size:7px;padding:0 2px;cursor:pointer;font-weight:800}.rv3-codebtn:hover{color:#fff;text-decoration:underline}.rv3-real-sheet{background:#ededed;color:#111}.rv3-real-sheet .rv3-axis{background:#f7f7f7;border-color:#999}.rv3-real-sheet .rv3-axis span{color:#333}.rv3-real-sheet .rv3-opbar{background:#ddd;border-color:#aaa}.rv3-real-sheet .rv3-stopmark small,.rv3-real-sheet .rv3-codebtn{color:#111}.rv3-real-sheet .rv3-row{border-color:#aaa}.rv3-real-sheet .rv3-row:nth-child(even) .rv3-track{background:#e4e4e4}.rv3-real-sheet .rv3-row:nth-child(odd) .rv3-track{background:#f7f7f7}.rv3-real-sheet .rv3-row-label{background:#fafafa;color:#111;border-color:#999}.rv3-real-sheet .rv3-block{background:transparent!important;border:0!important;color:#111;overflow:visible;height:44px;top:6px;padding:0 4px}.rv3-real-sheet .rv3-block:hover,.rv3-real-sheet .rv3-block.selected{outline:1px dashed #111}.rv3-real-sheet .rv3-blocknum{position:absolute;top:0;left:0;right:0;color:#111;font-weight:900}.rv3-real-sheet .rv3-blockends{position:absolute;left:0;right:0;bottom:0;color:#111;font-weight:700}.rv3-real-trackline{display:none}.rv3-real-leadline{display:none}.rv3-real-sheet .rv3-real-trackline{display:block;position:absolute;left:2px;right:2px;top:22px;height:4px;background:#111}.rv3-real-sheet .rv3-real-leadline{display:block;position:absolute;left:2px;right:2px;top:15px;background:#111}.rv3-real-sheet .rv3-real-leadline.loco{height:5px}.rv3-real-sheet .rv3-real-leadline.pilot{height:2px}.rv3-real-sheet .rv3-actionmark{background:#111}.rv3-real-sheet .rv3-actionmark span{background:#fff;color:#111;border-color:#111}.rv3-rame-hero{display:flex;gap:3px;overflow:auto;max-width:420px}.rv3-rame-hero img{width:92px;max-height:52px;object-fit:contain}.rv3-date-label{display:inline-flex;align-items:center;gap:4px;font-size:10px}.rv3-date-label input{padding:4px 6px!important} 
    .rv4-line-assignment{padding:9px 10px;border-bottom:1px solid #26394f;background:#0b1624}.rv4-line-assignment.drop{outline:2px dashed #38bdf8;outline-offset:-4px;background:#0d2438}.rv4-assignment-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:7px}.rv4-assignment-strip{display:flex;align-items:center;gap:5px;overflow:auto;min-height:55px;padding:6px;border:1px dashed #45617f;border-radius:7px;background:#07111d}.rv4-assignment-el{display:grid;grid-template-columns:auto 1fr auto;gap:5px;align-items:center;min-width:150px;max-width:260px;padding:5px;border:1px solid #2d4865;border-radius:6px;background:#102035}.rv4-assignment-el img{width:70px;max-height:38px;object-fit:contain}.rv4-assignment-el small{color:#9eb5cc}.rv4-assignment-empty{color:#9eb5cc;font-size:10px;padding:8px}.rv4-chip-cv{color:#ffd166;font-weight:800}.rv4-fleet{overflow:auto;flex:1;background:#ededed;color:#111}.rv4-fleet-axis{position:sticky;top:0;z-index:8;height:30px;margin-left:220px;background:#f8f8f8;border-bottom:1px solid #999}.rv4-fleet-axis span{position:absolute;top:7px;transform:translateX(-50%);font-size:9px}.rv4-fleet-row{display:grid;grid-template-columns:220px max-content;height:62px;border-bottom:1px solid #aaa}.rv4-fleet-label{position:sticky;left:0;z-index:7;padding:7px;background:#fafafa;border-right:1px solid #999;overflow:hidden}.rv4-fleet-track{position:relative;background:repeating-linear-gradient(90deg,#f7f7f7 0,#f7f7f7 99px,#dedede 100px)}.rv4-fleet-service{position:absolute;top:13px;height:34px;border-top:5px solid #111;border-bottom:2px solid #111;color:#111;padding:1px 4px;box-sizing:border-box;font-size:9px;overflow:hidden;white-space:nowrap;cursor:pointer;background:#ffffffaa}.rv4-fleet-service:hover{outline:1px dashed #111}.rv4-fleet-service b{display:block;text-align:center}.rv4-fleet-ends{display:flex;justify-content:space-between;font-size:8px}.rv4-mandatory{padding:6px 9px;border-left:4px solid #38bdf8;background:#102a40;color:#dff1ff;border-radius:4px;margin:6px 0;font-size:10px}.rv4-sort{width:100%;margin:4px 0 7px;padding:6px;background:var(--input-bg);color:var(--text);border:1px solid var(--border);border-radius:5px}
    .rv4-material-sheet{margin-top:9px;border:1px solid #999;background:#ededed;color:#111;overflow:auto}.rv4-material-axis{position:relative;height:28px;margin-left:180px;background:#f7f7f7;border-bottom:1px solid #999}.rv4-material-axis span{position:absolute;top:6px;transform:translateX(-50%);font-size:9px;color:#333}.rv4-material-row{display:grid;grid-template-columns:180px max-content;min-height:62px}.rv4-material-label{position:sticky;left:0;z-index:5;background:#fafafa;border-right:1px solid #999;padding:7px;color:#111}.rv4-material-track{position:relative;height:62px;background:repeating-linear-gradient(90deg,#f7f7f7 0,#f7f7f7 99px,#dedede 100px)}.rv4-material-track .rv3-dutyblock{top:7px;height:48px;background:transparent;border:0;color:#111;padding:0 4px;overflow:visible}.rv4-material-track .rv3-dutyblock:hover{outline:1px dashed #111}.rv4-material-track .rv3-blocknum{position:absolute;top:0;left:0;right:0;color:#111;font-weight:900}.rv4-material-track .rv3-blockends{position:absolute;left:0;right:0;bottom:0;color:#111;font-weight:700}.rv4-material-track .rv3-real-trackline{display:block;position:absolute;left:2px;right:2px;top:24px;height:4px;background:#111}.rv4-material-track .rv3-real-leadline{display:block;position:absolute;left:2px;right:2px;top:16px;background:#111}.rv4-material-track .rv3-real-leadline.loco{height:5px}.rv4-material-track .rv3-real-leadline.pilot{height:2px}.rv4-material-caption{padding:6px 8px;background:#fff;border-top:1px solid #bbb;font-size:9px;color:#222}.rv4-material-caption b{font-weight:900}


    /* HOTFIX36 — diagramme de roulement lisible, inspiré des fiches réelles d'exploitation. */
    .rv5-sheet-work{grid-template-columns:minmax(250px,300px) minmax(620px,1fr) minmax(285px,350px)}
    .rv5-sheet-work.rv5-hide-library{grid-template-columns:minmax(620px,1fr) minmax(285px,350px)}
    .rv5-sheet-work.rv5-hide-library .rv3-library{display:none}
    .rv5-sheet-work.rv5-hide-inspector{grid-template-columns:minmax(250px,300px) minmax(620px,1fr)}
    .rv5-sheet-work.rv5-hide-inspector .rv3-inspector{display:none}
    .rv5-sheet-work.rv5-hide-library.rv5-hide-inspector{grid-template-columns:minmax(0,1fr)}
    .rv5-sheet-work .rv4-line-assignment{padding:6px 9px}
    .rv5-sheet-work .rv4-assignment-strip{min-height:38px;padding:4px}
    .rv5-sheet-work .rv4-assignment-el{min-width:130px;padding:3px}
    .rv5-sheet-work .rv4-assignment-el img{width:54px;max-height:30px}
    .rv5-sheet{display:flex;flex-direction:column;min-height:0;flex:1;background:#ececec;color:#111;overflow:hidden}
    .rv5-sheet-toolbar{min-height:42px;display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:5px 8px;background:#f6f6f6;border-bottom:1px solid #9ca3af;color:#111}
    .rv5-sheet-toolbar b{font-size:12px}.rv5-sheet-toolbar small{color:#4b5563}.rv5-sheet-toolbar .btn-secondary{font-size:9px;padding:4px 6px}
    .rv5-sheet-toolbar select{background:#fff;color:#111;border:1px solid #9ca3af;border-radius:4px;padding:4px 6px;font-size:10px}
    .rv5-paper-scroll{position:relative;overflow:auto;flex:1;background:#d8dde3}
    .rv5-paper{position:relative;min-height:210px;background:#f8f8f8;color:#111;box-shadow:inset 0 0 0 1px #9ca3af}
    .rv5-axis-row{display:grid;grid-template-columns:230px max-content;position:sticky;top:0;z-index:20;height:38px;border-bottom:1px solid #8f969d;background:#f7f7f7}
    .rv5-axis-corner{position:sticky;left:0;z-index:22;background:#f3f4f6;border-right:1px solid #8f969d;padding:5px 8px;font-size:9px;color:#4b5563;box-sizing:border-box}
    .rv5-axis{position:relative;height:38px;background:#fafafa}
    .rv5-axis .rv5-hourline{position:absolute;top:0;bottom:0;border-left:1px solid #c3c7cb}
    .rv5-axis .rv5-minorline{position:absolute;bottom:0;height:8px;border-left:1px solid #d5d8db}
    .rv5-axis .rv5-ticklabel{position:absolute;top:6px;transform:translateX(-50%);font-size:10px;font-weight:800;color:#3f4650;white-space:nowrap}
    .rv5-duty-row{display:grid;grid-template-columns:230px max-content;min-height:142px;border-bottom:1px solid #9da3aa;background:#f8f8f8}
    .rv5-duty-label{position:sticky;left:0;z-index:15;background:#f4f5f6;border-right:1px solid #8f969d;padding:10px 9px;box-sizing:border-box;color:#111}
    .rv5-duty-label .rv5-rid{font-size:14px;font-weight:950;line-height:1.1}.rv5-duty-label .rv5-rname{font-size:11px;font-weight:800;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rv5-duty-label .rv5-rmaterial{font-size:10px;margin-top:8px;font-weight:800;color:#374151}.rv5-duty-label .rv5-rstats{font-size:9px;color:#4b5563;margin-top:4px}
    .rv5-duty-track{position:relative;height:142px;overflow:visible;background-color:#fafafa;background-image:repeating-linear-gradient(90deg,transparent 0,transparent calc(var(--rv5-hour) - 1px),#cfd3d7 calc(var(--rv5-hour) - 1px),#cfd3d7 var(--rv5-hour))}
    .rv5-duty-track:after{content:'';position:absolute;left:0;right:0;top:78px;border-top:1px solid #d5d8db;pointer-events:none}
    .rv5-service{position:absolute;top:18px;height:94px;min-width:16px;color:#111;cursor:pointer;z-index:5;box-sizing:border-box}
    .rv5-service:hover,.rv5-service.selected{background:#dbeafe88;outline:1px dashed #111;z-index:9}
    .rv5-service.warn{background:#fff2bf88}.rv5-service.cancel{opacity:.45;text-decoration:line-through}
    .rv5-trainnum{position:absolute;top:0;left:0;right:0;text-align:center;font-size:12px;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rv5-materialtag{position:absolute;top:15px;left:2px;font-size:9px;font-weight:900;color:#4b5563;white-space:nowrap;max-width:80%;overflow:hidden;text-overflow:ellipsis}
    .rv5-leadline{position:absolute;left:2px;right:2px;top:39px;background:#111}.rv5-leadline.loco{height:6px}.rv5-leadline.pilot{height:2px;top:42px}
    .rv5-trainline{position:absolute;left:2px;right:2px;top:49px;height:5px;background:#111}
    .rv5-node{position:absolute;top:45px;width:8px;height:8px;border:2px solid #111;border-radius:50%;background:#fff;box-sizing:border-box}.rv5-node.start{left:-2px}.rv5-node.end{right:-2px}
    .rv5-time{position:absolute;top:58px;font-size:10px;font-weight:900;white-space:nowrap}.rv5-time.start{left:0}.rv5-time.end{right:0;text-align:right}
    .rv5-station{position:absolute;top:75px;font-size:10px;font-weight:950;white-space:nowrap}.rv5-station.start{left:0;transform-origin:left top;transform:rotate(-48deg)}.rv5-station.end{right:0;transform-origin:right top;transform:rotate(-48deg)}
    .rv5-gap{position:absolute;top:50px;height:2px;background:#777;z-index:2}.rv5-gap:before,.rv5-gap:after{content:'';position:absolute;top:-2px;width:1px;height:6px;background:#777}.rv5-gap:before{left:0}.rv5-gap:after{right:0}
    .rv5-gap-label{position:absolute;top:-19px;left:50%;transform:translateX(-50%);font-size:8px;font-weight:800;color:#5b6168;white-space:nowrap;background:#f8f8f8;padding:0 3px}
    .rv5-opmark{position:absolute;top:6px;bottom:7px;border-left:2px dashed #555;z-index:7;pointer-events:none}.rv5-opmark span{position:absolute;top:3px;left:4px;background:#fff;border:1px solid #555;border-radius:3px;padding:2px 4px;font-size:8px;font-weight:900;white-space:nowrap;color:#111}
    .rv5-sheet-caption{padding:6px 8px;background:#fff;border-top:1px solid #aaa;font-size:9px;color:#333}.rv5-sheet-caption b{font-weight:950}
    .rv5-panel-toggle.active{background:#1e6eb8!important;color:#fff!important;border-color:#4aa3ff!important}
    
    /* HOTFIX37 — SVG duty sheet: fixed geometry = no drifting/misaligned labels. */
    .rv6-sheet{display:flex;flex-direction:column;min-height:0;flex:1;background:#e5e7eb;color:#111;overflow:hidden}
    .rv6-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;overflow-x:scroll;min-height:46px;padding:6px 9px;background:#f8fafc;color:#111;border-bottom:1px solid #8d949c}
    .rv6-toolbar b{font-size:13px;white-space:nowrap}.rv6-toolbar small{font-size:10px;color:#4b5563;white-space:nowrap}.rv6-toolbar .btn-secondary{font-size:10px;padding:5px 7px;white-space:nowrap}
    .rv6-paper-scroll{position:relative;flex:1;min-height:0;overflow:scroll!important;scrollbar-gutter:stable both-edges;background:#cfd4da;border:1px solid #808790}
    .rv6-paper{display:grid;grid-template-columns:230px max-content;grid-template-rows:44px max-content;background:#f4f4f4;min-height:100%;width:max-content;min-width:100%}
    .rv6-corner{position:sticky;left:0;top:0;z-index:30;background:#e7e9ec;border-right:1px solid #8d949c;border-bottom:1px solid #8d949c;padding:7px 9px;box-sizing:border-box;color:#111}
    .rv6-corner b{font-size:11px}.rv6-corner small{display:block;font-size:9px;color:#4b5563;margin-top:2px}
    .rv6-axis-wrap{position:sticky;top:0;z-index:25;background:#fafafa;border-bottom:1px solid #8d949c;height:44px}
    .rv6-label{position:sticky;left:0;z-index:20;background:#eef0f2;border-right:1px solid #8d949c;padding:12px 10px;box-sizing:border-box;color:#111;min-height:250px}
    .rv6-label .rid{font-size:17px;font-weight:950;line-height:1}.rv6-label .rname{font-size:13px;font-weight:900;margin-top:5px}.rv6-label .rmat{font-size:11px;font-weight:800;margin-top:12px;line-height:1.3}.rv6-label .rstats{font-size:10px;color:#4b5563;margin-top:6px;line-height:1.45}.rv6-label .hint{font-size:9px;color:#6b7280;margin-top:14px;line-height:1.35}
    .rv6-svg-wrap{background:#f8f8f8;min-height:250px;position:relative}
    .rv6-svg{display:block;background:#f8f8f8;overflow:visible;font-family:Arial,Helvetica,sans-serif}
    .rv6-service-hit{cursor:pointer}.rv6-service-hit:hover .rv6-hitbox,.rv6-service-hit.selected .rv6-hitbox{fill:#dbeafe;fill-opacity:.65;stroke:#2563eb;stroke-width:1;stroke-dasharray:4 3}
    .rv6-hitbox{fill:transparent;stroke:transparent}.rv6-mainline{stroke:#111;stroke-width:6;stroke-linecap:square}.rv6-leadline.loco{stroke:#111;stroke-width:7}.rv6-leadline.pilot{stroke:#111;stroke-width:2.5}.rv6-node{fill:#fff;stroke:#111;stroke-width:2}
    .rv6-trainnum{font-size:15px;font-weight:950;fill:#111;text-anchor:middle}.rv6-material{font-size:11px;font-weight:800;fill:#4b5563;text-anchor:middle}.rv6-time{font-size:12px;font-weight:900;fill:#111}.rv6-station{font-size:12px;font-weight:950;fill:#111}.rv6-gapline{stroke:#70757b;stroke-width:2}.rv6-gaplabel{font-size:10px;font-weight:800;fill:#555;text-anchor:middle}.rv6-opbar{fill:#d8dce1;stroke:#222;stroke-width:1}.rv6-optext{font-size:10px;font-weight:850;fill:#111}.rv6-hourband-a{fill:#fafafa}.rv6-hourband-b{fill:#f0f0f0}.rv6-grid-major{stroke:#aeb4bb;stroke-width:1}.rv6-grid-minor{stroke:#d3d6da;stroke-width:1}.rv6-axistext{font-size:11px;font-weight:900;fill:#3f4650;text-anchor:middle}
    .rv6-caption{grid-column:1/-1;padding:7px 9px;background:#fff;border-top:1px solid #9ca3af;font-size:10px;color:#333;line-height:1.4}

    
    #page-rotations{height:calc(100vh - 58px);box-sizing:border-box}
    #page-rotations ::-webkit-scrollbar,#page-rotations::-webkit-scrollbar{width:14px;height:14px}
    #page-rotations ::-webkit-scrollbar-track,#page-rotations::-webkit-scrollbar-track{background:#101923}
    #page-rotations ::-webkit-scrollbar-thumb,#page-rotations::-webkit-scrollbar-thumb{background:#607083;border:2px solid #101923;border-radius:7px}
    #page-rotations ::-webkit-scrollbar-corner,#page-rotations::-webkit-scrollbar-corner{background:#101923}

    /* HOTFIX37 — do not hide menus on narrow/zoomed viewports. The whole workspace scrolls instead. */
    @media(max-width:1250px){#page-rotations .rv3-shell{min-width:1220px}#page-rotations .rv3-work{display:grid;min-width:1180px}.rv5-sheet-work{grid-template-columns:minmax(250px,300px) minmax(620px,1fr) minmax(285px,350px)}.rv5-sheet-work.rv5-hide-library{grid-template-columns:minmax(620px,1fr) minmax(285px,350px)}.rv5-sheet-work.rv5-hide-inspector{grid-template-columns:minmax(250px,300px) minmax(620px,1fr)}.rv5-sheet-work.rv5-hide-library.rv5-hide-inspector{grid-template-columns:minmax(900px,1fr)}.rv5-sheet-work:not(.rv5-hide-library) .rv3-library{display:block}.rv5-sheet-work:not(.rv5-hide-inspector) .rv3-inspector{display:block}}
    @media(max-width:850px){#page-rotations .rv3-shell{min-width:1220px}#page-rotations .rv3-main{min-height:560px}}

    /* HOTFIX61 — centre de contrôle Roulements : lisibilité avant densité. */
    .rv61-dashboard{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:7px;padding:8px 12px;background:#09131f;border-bottom:1px solid #26394f}
    .rv61-kpi{min-height:58px;border:1px solid #29415c;border-radius:8px;background:#0e1c2c;padding:8px 10px;box-sizing:border-box}.rv61-kpi span{display:block;color:#91a6be;font-size:9px;text-transform:uppercase;letter-spacing:.05em}.rv61-kpi b{display:block;font-size:20px;line-height:24px;color:#eef6ff}.rv61-kpi small{display:block;color:#9db0c8;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rv61-kpi.ok{border-color:#256b4a}.rv61-kpi.warn{border-color:#8b6826}.rv61-kpi.bad{border-color:#843849}.rv61-kpi.clickable{cursor:pointer}.rv61-kpi.clickable:hover{background:#14283d}
    .rv61-filterbar{display:flex;gap:7px;align-items:center;padding:7px 12px;background:#0c1725;border-bottom:1px solid #26394f}.rv61-filterbar input{min-width:300px;flex:1;max-width:520px;background:var(--input-bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:7px 9px}.rv61-filterbar select{background:var(--input-bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:7px 9px}.rv61-filterbar small{color:#91a6be}
    .rv61-status{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:850;white-space:nowrap}.rv61-status.ok{color:#8ef0b8;background:#113421;border:1px solid #256b4a}.rv61-status.warn{color:#ffd879;background:#3a2d12;border:1px solid #8b6826}.rv61-status.bad{color:#ff9cab;background:#401c25;border:1px solid #843849}.rv61-status.inactive{color:#bac4d0;background:#29313b;border:1px solid #53606e}
    .rv61-linecard{display:grid;grid-template-columns:minmax(220px,1.2fr) minmax(180px,1fr) 110px 110px 110px 150px;gap:8px;align-items:center;border:1px solid #26394f;border-radius:8px;background:#0d1928;padding:9px 11px;margin:7px 10px;cursor:pointer}.rv61-linecard:hover{border-color:#4a83b7;background:#10243a}.rv61-linecard.selected{outline:2px solid #60a5fa}.rv61-linecard .main b{font-size:12px}.rv61-linecard small{color:#91a6be}.rv61-linecard .metric span{display:block;color:#7f94aa;font-size:8px;text-transform:uppercase}.rv61-linecard .metric b{font-size:11px;color:#e7f1fa}.rv61-linecard .formation{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rv61-linecard .next{font-size:9px;color:#b9d7f2}.rv61-linecard .issues{font-size:9px;color:#ffd879;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rv61-line-overview{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:6px;padding:7px 10px;background:#0a1522;border-bottom:1px solid #26394f}.rv61-line-overview>div{border:1px solid #26394f;border-radius:6px;padding:6px 8px;background:#0d1928}.rv61-line-overview span{display:block;font-size:8px;color:#8096ad;text-transform:uppercase}.rv61-line-overview b{font-size:10px;color:#e7f1fa}.rv61-line-overview .wide{grid-column:span 2}
    .rv61-alertbox{margin:7px 10px;border:1px solid #6f3b45;background:#2b1720;border-radius:7px;padding:8px}.rv61-alertbox h4{margin:0 0 5px;font-size:10px;color:#ffb4bf}.rv61-alertbox .row{font-size:9px;color:#f5cbd1;padding:3px 0;border-top:1px solid #4c2730}.rv61-alertbox .row:first-of-type{border-top:0}.rv61-goodbox{margin:7px 10px;border:1px solid #286a4b;background:#112d20;border-radius:7px;padding:7px 9px;color:#8ee7b3;font-size:10px}
    .rv61-service-list{padding:8px 10px;overflow:auto;flex:1}.rv61-service-row{display:grid;grid-template-columns:90px minmax(150px,.8fr) minmax(210px,1.2fr) 90px 90px 110px minmax(170px,1fr);gap:7px;align-items:center;padding:8px;border-bottom:1px solid #26394f;cursor:pointer}.rv61-service-row:hover{background:#10243a}.rv61-service-row .train{font-size:13px;font-weight:900;color:#dff1ff}.rv61-service-row .route{font-weight:750}.rv61-service-row small{color:#8fa5bb}.rv61-service-row .formation{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rv61-service-row.header{position:sticky;top:0;z-index:3;background:#0d1928;color:#91a6be;font-size:8px;text-transform:uppercase;font-weight:850;cursor:default}.rv61-service-row.header:hover{background:#0d1928}
    .rv61-actionbar{display:flex;gap:6px;flex-wrap:wrap;padding:8px 10px;background:#0c1725;border-bottom:1px solid #26394f}.rv61-actionbar .primaryhint{margin-left:auto;color:#9db0c8;font-size:9px;align-self:center}.rv61-runtime{margin:7px 10px;padding:7px 9px;border:1px solid #31506e;background:#0c2135;border-radius:7px;font-size:9px;color:#b8d7f0}.rv61-runtime b{color:#e7f4ff}
    @media(max-width:1450px){.rv61-dashboard{grid-template-columns:repeat(3,minmax(140px,1fr))}.rv61-linecard{grid-template-columns:minmax(220px,1.3fr) minmax(170px,1fr) 90px 90px 130px}.rv61-linecard .hide-mid{display:none}}

    /* HOTFIX62 — 100% zoom readability: stop squeezing the control center. */
    #page-rotations{overflow:auto!important}
    #page-rotations .rv3-shell{height:auto;min-height:calc(100vh - 70px);min-width:0;width:100%}
    #page-rotations .rv3-head{flex-wrap:wrap;overflow:visible;min-height:48px;row-gap:8px;padding:10px 14px}
    #page-rotations .rv3-viewtabs{flex-wrap:wrap}
    #page-rotations .rv3-viewtabs .btn-secondary{font-size:11px;padding:7px 10px}
    #page-rotations .rv3-work{min-width:0;width:100%;grid-template-columns:minmax(255px,285px) minmax(0,1fr) minmax(275px,310px);overflow:visible}
    #page-rotations .rv3-library,#page-rotations .rv3-inspector{overflow:auto;min-width:0}
    #page-rotations .rv3-main{min-width:0;overflow:hidden}
    #page-rotations .rv3-card{padding:10px;margin:8px 0}
    #page-rotations .rv3-card small{font-size:11px;line-height:1.35}
    #page-rotations .rv3-mini{font-size:10px;padding:5px 7px}
    .rv61-dashboard{grid-template-columns:repeat(3,minmax(190px,1fr));gap:10px;padding:12px 14px}
    .rv61-kpi{min-height:78px;padding:11px 13px}.rv61-kpi span{font-size:10px}.rv61-kpi b{font-size:24px;line-height:29px}.rv61-kpi small{font-size:10px;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.35}
    .rv61-filterbar{flex-wrap:wrap;gap:9px;padding:10px 14px}.rv61-filterbar input{min-width:260px;max-width:none;flex:1 1 420px;font-size:12px}.rv61-filterbar select{font-size:12px}.rv61-filterbar small{flex:1 1 100%;font-size:10px}
    .rv61-status{font-size:10px;padding:4px 8px}
    .rv61-linecard{grid-template-columns:minmax(250px,1.45fr) minmax(210px,1.1fr) minmax(95px,.55fr) minmax(95px,.55fr);gap:11px;padding:12px 14px;margin:10px 12px;align-items:start}
    .rv61-linecard .hide-mid{display:block}.rv61-linecard .main b{font-size:14px}.rv61-linecard small{font-size:10px;line-height:1.4}.rv61-linecard .metric span{font-size:9px}.rv61-linecard .metric b{font-size:12px}.rv61-linecard .formation,.rv61-linecard .issues{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.35}.rv61-linecard .next{font-size:10px;line-height:1.4}
    .rv61-line-overview{grid-template-columns:repeat(3,minmax(160px,1fr));gap:9px;padding:11px 12px}.rv61-line-overview>div{padding:9px 10px}.rv61-line-overview span{font-size:9px}.rv61-line-overview b{font-size:11px;line-height:1.4}.rv61-line-overview .wide{grid-column:span 2}
    .rv61-service-list{padding:10px 12px}.rv61-service-row{grid-template-columns:88px minmax(145px,.8fr) minmax(220px,1.25fr) 90px 90px minmax(125px,.7fr);gap:10px;padding:10px 8px;font-size:11px}.rv61-service-row .train{font-size:14px}.rv61-service-row small{font-size:10px}.rv61-service-row .formation{white-space:normal;overflow:visible;text-overflow:clip}.rv61-service-row.header{font-size:9px}
    .rv61-actionbar{gap:8px;padding:10px 12px}.rv61-actionbar .primaryhint{font-size:10px}
    .rv61-alertbox,.rv61-goodbox,.rv61-runtime{margin:10px 12px;padding:10px 11px}.rv61-alertbox h4{font-size:11px}.rv61-alertbox .row,.rv61-runtime{font-size:10px;line-height:1.4}
    @media(max-width:1500px){
      #page-rotations .rv3-work{grid-template-columns:minmax(250px,280px) minmax(0,1fr);grid-template-areas:'library main' 'inspector main'}
      #page-rotations .rv3-library{grid-area:library;border-right:1px solid var(--border);max-height:52vh}
      #page-rotations .rv3-main{grid-area:main;min-height:650px}
      #page-rotations .rv3-inspector{grid-area:inspector;border-left:0;border-right:1px solid var(--border);border-top:1px solid var(--border);max-height:48vh}
      .rv61-linecard{grid-template-columns:minmax(235px,1.3fr) minmax(190px,1fr) minmax(110px,.65fr)}
      .rv61-linecard .hide-mid{display:none}
      .rv61-service-row{min-width:850px}
    }
    @media(max-width:1150px){
      #page-rotations .rv3-work{display:flex;flex-direction:column;min-width:0;overflow:visible}
      #page-rotations .rv3-main{order:1;min-height:600px}
      #page-rotations .rv3-library{order:2;max-height:none;border-right:0;border-top:1px solid var(--border)}
      #page-rotations .rv3-inspector{order:3;max-height:none;border-right:0}
      .rv61-dashboard{grid-template-columns:repeat(2,minmax(180px,1fr))}
      .rv61-linecard{grid-template-columns:1fr 1fr}.rv61-linecard .main{grid-column:1/-1}
      .rv61-line-overview{grid-template-columns:repeat(2,minmax(150px,1fr))}.rv61-line-overview .wide{grid-column:1/-1}
    }
    @media(max-width:760px){
      .rv61-dashboard{grid-template-columns:1fr}.rv61-linecard{grid-template-columns:1fr}.rv61-linecard .main{grid-column:auto}.rv61-line-overview{grid-template-columns:1fr}.rv61-line-overview .wide{grid-column:auto}
      .rv61-filterbar input{min-width:0;width:100%}
    }

    /* HOTFIX63 — clarity first. Default Roulements UI is a simple workflow, not a control-room wall. */
    .rv63-shell{max-width:1380px;margin:0 auto;padding:18px 22px 36px;color:var(--text);box-sizing:border-box}
    .rv63-topbar{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
    .rv63-titleblock{flex:1 1 420px}.rv63-titleblock h1{margin:0;font-size:28px;line-height:1.15;color:#f4f8fc}.rv63-titleblock p{margin:7px 0 0;color:#9fb0c2;font-size:13px;line-height:1.45}
    .rv63-topactions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.rv63-topactions .btn-primary,.rv63-topactions .btn-secondary{font-size:13px;padding:9px 12px}
    .rv63-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 14px;background:#0d1928;border:1px solid #26394f;border-radius:10px;margin-bottom:14px}.rv63-toolbar input{flex:1 1 420px;min-width:240px;background:var(--input-bg);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:10px 12px;font-size:13px}.rv63-toolbar select{background:var(--input-bg);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:10px 12px;font-size:13px}
    .rv63-counts{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.rv63-count{padding:7px 10px;border-radius:999px;background:#132438;border:1px solid #2b4662;color:#cfe2f5;font-size:12px}.rv63-count.bad{background:#351923;border-color:#7a3445;color:#ffc0ca}.rv63-count.warn{background:#352912;border-color:#806328;color:#ffe09a}.rv63-count.ok{background:#122d21;border-color:#286a4b;color:#9aefbd}
    .rv63-notice{border:1px solid #7b5d24;background:#2e2411;color:#ffe09b;border-radius:10px;padding:12px 14px;margin:0 0 14px;font-size:13px;line-height:1.45}
    .rv63-line-list{display:flex;flex-direction:column;gap:10px}.rv63-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;background:#0d1928;border:1px solid #26394f;border-radius:11px;padding:14px 16px;cursor:pointer}.rv63-line:hover{background:#10243a;border-color:#4b83b6}.rv63-line.selected{outline:2px solid #60a5fa}.rv63-line-main{min-width:0}.rv63-line-title{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.rv63-line-title b{font-size:16px;color:#edf6ff}.rv63-line-meta{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;color:#b2c3d4;font-size:12px}.rv63-line-next{margin-top:8px;color:#d7e8f7;font-size:13px}.rv63-line-problem{margin-top:9px;border-left:3px solid #e5b341;padding:5px 8px;background:#2a2416;color:#f7dda0;font-size:12px;line-height:1.4}.rv63-line-problem.bad{border-color:#fb7185;background:#2d1820;color:#ffc0ca}.rv63-open{font-size:13px;white-space:nowrap}
    .rv63-back{display:inline-flex;align-items:center;gap:5px;color:#9fc9ef;cursor:pointer;font-size:13px;margin-bottom:8px}.rv63-back:hover{color:#d9efff}
    .rv63-linehead{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}.rv63-linehead-main{flex:1 1 420px}.rv63-linehead h1{font-size:25px;margin:0 0 7px;color:#f4f8fc}.rv63-linehead-sub{color:#9fb0c2;font-size:13px;line-height:1.45}.rv63-linehead-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.rv63-linehead-actions select{background:var(--input-bg);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-size:12px}.rv63-linehead-actions .btn-secondary{font-size:12px;padding:8px 10px}
    .rv63-quick{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin:0 0 16px}.rv63-quick>div{background:#0d1928;border:1px solid #26394f;border-radius:9px;padding:11px 12px}.rv63-quick span{display:block;color:#8198ae;font-size:10px;text-transform:uppercase;letter-spacing:.04em}.rv63-quick b{display:block;margin-top:4px;color:#e9f3fc;font-size:14px;line-height:1.35}
    .rv63-steps{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}.rv63-stepchip{display:flex;align-items:center;gap:7px;padding:8px 11px;border-radius:8px;background:#101f30;border:1px solid #2a425c;color:#c7d9e9;font-size:12px;font-weight:700}.rv63-stepchip strong{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#1d5c92;color:white}
    .rv63-section{background:#0b1724;border:1px solid #26394f;border-radius:12px;margin:0 0 14px;overflow:hidden}.rv63-section-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 16px;border-bottom:1px solid #26394f;background:#0e1c2b}.rv63-num{display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:50%;background:#1c6aa7;color:white;font-weight:900;font-size:14px;flex:0 0 auto}.rv63-section-title{flex:1 1 320px}.rv63-section-title h2{font-size:17px;margin:0;color:#eef6ff}.rv63-section-title p{font-size:12px;color:#95a9bd;margin:4px 0 0;line-height:1.4}.rv63-section-actions{display:flex;gap:7px;flex-wrap:wrap}.rv63-section-actions .btn-primary,.rv63-section-actions .btn-secondary{font-size:12px;padding:8px 10px}.rv63-section-body{padding:14px 16px}
    .rv63-service-list{display:flex;flex-direction:column;gap:8px}.rv63-service{display:grid;grid-template-columns:54px 120px minmax(220px,1fr) 105px 115px;gap:10px;align-items:center;border:1px solid #29415c;background:#0d1928;border-radius:9px;padding:10px 12px;cursor:pointer}.rv63-service:hover{border-color:#4b83b6;background:#10243a}.rv63-service.selected{outline:2px solid #60a5fa}.rv63-service-index{font-size:12px;color:#7991aa;font-weight:800}.rv63-service-train b{font-size:15px;color:#eaf5ff}.rv63-service-train small,.rv63-service-route small,.rv63-service-stat small{display:block;color:#8fa5bb;font-size:11px;margin-top:2px}.rv63-service-route b{font-size:13px;color:#e1edf8}.rv63-service-stat span{display:block;color:#8198ae;font-size:9px;text-transform:uppercase}.rv63-service-stat b{font-size:12px;color:#e3eef8}.rv63-service-detail{border:1px solid #31506e;background:#0c2135;border-radius:9px;padding:12px 13px;margin-top:8px}.rv63-service-detail-top{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}.rv63-service-detail-main{flex:1 1 360px;font-size:12px;color:#c5d8e8;line-height:1.5}.rv63-service-detail-actions{display:flex;gap:6px;flex-wrap:wrap}.rv63-service-detail-actions .btn-secondary{font-size:11px;padding:6px 8px}
    .rv63-material-summary{font-size:13px;color:#c9d9e7;margin-bottom:10px}.rv63-material-strip{display:flex;gap:8px;flex-wrap:wrap}.rv63-material{display:flex;align-items:center;gap:8px;min-width:180px;max-width:320px;border:1px solid #29415c;background:#0d1928;border-radius:8px;padding:8px 10px}.rv63-material img{width:88px;max-height:42px;object-fit:contain;background:#08111d}.rv63-material b{font-size:12px;color:#e8f2fb}.rv63-material small{font-size:10px;color:#91a5b9}
    .rv63-oplist{display:flex;flex-direction:column;gap:8px}.rv63-op{display:grid;grid-template-columns:minmax(160px,.8fr) minmax(180px,1fr) 100px auto;gap:10px;align-items:center;border:1px solid #29415c;background:#0d1928;border-radius:8px;padding:9px 11px}.rv63-op b{font-size:12px}.rv63-op small{color:#91a5b9;font-size:10px}.rv63-op-actions{display:flex;gap:5px}.rv63-op-actions .btn-secondary{font-size:10px;padding:5px 7px}
    .rv63-valid-good{border:1px solid #286a4b;background:#112d20;color:#a2efc1;border-radius:9px;padding:12px 13px;font-size:13px;line-height:1.45}.rv63-valid-issue{border:1px solid #7a3445;background:#2d1820;color:#ffc5ce;border-radius:9px;padding:10px 12px;margin:7px 0;font-size:12px;line-height:1.45}.rv63-valid-warn{border-color:#806328;background:#302610;color:#ffe09b}
    .rv63-advanced{margin-top:16px;border-top:1px solid #26394f;padding-top:14px}.rv63-advanced h3{margin:0 0 6px;font-size:14px;color:#dceaf6}.rv63-advanced p{margin:0 0 10px;color:#91a5b9;font-size:12px}.rv63-advanced-buttons{display:flex;gap:7px;flex-wrap:wrap}.rv63-advanced-buttons .btn-secondary{font-size:11px;padding:7px 9px}
    .rv63-empty{padding:24px 16px;text-align:center;color:#9fb0c2;font-size:13px;line-height:1.5}.rv63-empty b{color:#e9f3fb;font-size:15px}
    @media(max-width:1050px){.rv63-quick{grid-template-columns:repeat(2,minmax(150px,1fr))}.rv63-service{grid-template-columns:48px 110px minmax(200px,1fr) 100px}.rv63-service .laststat{display:none}}
    @media(max-width:720px){.rv63-shell{padding:14px 12px 28px}.rv63-quick{grid-template-columns:1fr}.rv63-line{grid-template-columns:1fr}.rv63-service{grid-template-columns:42px 100px 1fr}.rv63-service-stat{display:none}.rv63-op{grid-template-columns:1fr}.rv63-linehead-actions{width:100%}}
  `;
        document.head.appendChild(s);
    }
    setup() { const page = document.getElementById('page-rotations'); if (!page)
        return; page.addEventListener('click', (e) => this._click(e)); page.addEventListener('change', (e) => this._change(e)); page.addEventListener('input', (e) => this._input(e)); page.addEventListener('dragstart', (e) => this._dragStart(e)); page.addEventListener('dragover', (e) => this._dragOver(e)); page.addEventListener('dragleave', (e) => this._dragLeave(e)); page.addEventListener('drop', (e) => this._drop(e)); }
    _snapshot() { return clone(this.game.rotationV2.toSave()); }
    _pushHistory() { this._history.push(this._snapshot()); if (this._history.length > 60)
        this._history.shift(); this._future = []; }
    _undo() { if (!this._history.length)
        return; this._future.push(this._snapshot()); const state = this._history.pop(); this.game.rotationV2.loadFromSave(state); if (!this.game.rotationV2.getRotation(this.selectedRotationId))
        this.selectedRotationId = this.game.rotationV2.rotations[0]?.id || ''; this._syncRuntimeNow(); this.game.saveState(); this.render(); }
    _redo() { if (!this._future.length)
        return; this._history.push(this._snapshot()); const state = this._future.pop(); this.game.rotationV2.loadFromSave(state); if (!this.game.rotationV2.getRotation(this.selectedRotationId))
        this.selectedRotationId = this.game.rotationV2.rotations[0]?.id || ''; this._syncRuntimeNow(); this.game.saveState(); this.render(); }
    _commit(fn) { this._pushHistory(); try {
        const out = fn();
        this._syncRuntimeNow();
        this.game.saveState();
        this.render();
        return out;
    }
    catch (err) {
        const prev = this._history.pop();
        if (prev)
            this.game.rotationV2.loadFromSave(prev);
        alert(err.message || String(err));
        this.render();
        return null;
    } }
    _distanceKm(occ) { const v = this.game.scheduleV2.getVersion(occ.scheduleId, occ.versionId); const p = v?.outboundPath || {}; const d = Number(p.distanceKm); if (Number.isFinite(d) && d > 0)
        return d; return (p.legs || []).reduce((n, l) => n + Math.max(0, Number(l.distanceKm || 0)), 0); }
    _rotationDistance(rot) { return (rot?.occurrences || []).reduce((n, o) => n + this._distanceKm(o), 0); }
    _abbr(name) { const words = String(name || '').replace(/[–—-]/g, ' ').split(/\s+/).filter(Boolean); if (!words.length)
        return '?'; if (words.length === 1)
        return words[0].slice(0, 4).toUpperCase(); return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase(); }
    _selectedDateValue() { return this.selectedDate || this.game?._currentDate || this.game?.engine?.getParisDate?.() || new Date().toISOString().slice(0, 10); }
    _rotationRunsOnDate(rot, date = this._selectedDateValue()) { if (!rot?.enabled)
        return false; if (!rot.calendarId)
        return true; const c = this.game.scheduleV2.calendars.find((x) => x.id === rot.calendarId); return !!c?.matchesDate?.(date); }
    _versionRunsOnDate(ver, date = this._selectedDateValue()) { if (!ver || ver.state !== ScheduleState.VALID)
        return false; if (!ver.calendarIds?.length)
        return true; return ver.calendarIds.some((id) => this.game.scheduleV2.calendars.find((c) => c.id === id)?.matchesDate?.(date)); }
    _stationCode(loc) { if (!loc)
        return '?'; const mgr = this.game.rotationV2, manual = mgr.getStationCode?.(loc); if (manual)
        return manual; const station = loc.stationId ? this.game.world?.getStationById?.(loc.stationId) : null; for (const raw of [loc.operationCode, loc.stationCode, loc.code, station?.ref, station?.shortCode, station?.code]) {
        const v = String(raw || '').trim().toUpperCase();
        if (v && /^[A-Z][A-Z0-9]{1,7}$/.test(v) && !/^[0-9]+$/.test(v))
            return v;
    } const key = String(loc.name || station?.name || '').trim().toLowerCase().replace(/[’']/g, "'"); const known = { "lyon part-dieu": 'LYD', "lyon-part-dieu": 'LYD', "dijon": 'DN' }; return known[key] || this._abbr(loc.name || station?.name); }
    _intervalDistanceKm(rawSlot) { const slot = rawSlot; const occ = slot?.occ || this.game.rotationV2.getRotation(slot?.rotationId)?.occurrences?.find((o) => o.id === slot?.occurrenceId); if (!occ)
        return 0; const canonical = this.game.rotationV2.materialIntervalDistanceKm?.(slot?.rotationId || this.selectedRotationId, occ.id, slot); if (Number.isFinite(Number(canonical)))
        return Math.max(0, Number(canonical)); const ver = this.game.scheduleV2.getVersion(occ.scheduleId, occ.versionId); if (!ver)
        return 0; const locs = ver.locations || [], phys = (l) => this._physicalLocationId(l), findIndex = (id) => locs.findIndex((l) => phys(l) === String(id) || String(l.id || '') === String(id)); let a = findIndex(slot.startLocationId), b = findIndex(slot.endLocationId); if (a >= 0 && b >= a) {
        let total = 0;
        for (let i = a; i < b; i++) {
            const leg = (ver.outboundPath?.legs || []).find((x) => x.fromLocationId === locs[i].id && x.toLocationId === locs[i + 1].id);
            total += Math.max(0, Number(leg?.distanceKm || 0));
        }
        if (total > 0 || a === b)
            return total;
    } const dur = Math.max(1, Number(occ.resolvedEndSec || ver.lastArrivalSec || 0) - Number(occ.resolvedStartSec || ver.firstDepartureSec || 0)), frac = Math.max(0, Math.min(1, (Number(slot.endSec || 0) - Number(slot.startSec || 0)) / dur)); return this._distanceKm(occ) * frac; }
    _leadingInfo(occ) { const mgr = this.game.rotationV2, members = [...(occ?.formation?.members || [])].sort((a, b) => a.order - b.order); if (occ?.reversed)
        members.reverse(); for (const m of members) {
        const v = mgr.getVehicle(m.vehicleId);
        if (!v)
            continue;
        if (v.isDrivingTrailer)
            return { type: 'pilot', vehicle: v, label: `Voiture-pilote ${v.number || v.name || ''}`.trim() };
        if (mgr._poweredVehicle?.(v))
            return { type: 'loco', vehicle: v, label: `${v.number || v.name || 'Engin moteur'} en tête` };
    } const v = members.length ? mgr.getVehicle(members[0].vehicleId) : null; return { type: 'loco', vehicle: v, label: v?.number || 'Tête de train' }; }
    _editStationCode(occId, locId) { const r = this.game.rotationV2.getRotation(this.selectedRotationId), o = r?.occurrences.find((x) => x.id === occId), ver = o && this.game.scheduleV2.getVersion(o.scheduleId, o.versionId), loc = ver?.locations.find((l) => l.id === locId); if (!loc)
        return; const current = this._stationCode(loc), value = prompt(`Code roulement pour ${loc.name} :`, current === '?' ? '' : current); if (value == null)
        return; this._commit(() => this.game.rotationV2.setStationCode(loc, value)); }
    _occMeta(o) { const rec = this.game.scheduleV2.getSchedule(o.scheduleId), ver = this.game.scheduleV2.getVersion(o.scheduleId, o.versionId); return { rec, ver, from: ver?.locations?.[0], to: ver?.locations?.at(-1) }; }
    _physicalLocationId(l) { return String(l?.stationId || l?.technicalLocationId || l?.id || ''); }
    _locationForPhysicalId(ver, id, fallback = null) { if (!id)
        return fallback; return (ver?.locations || []).find((l) => this._physicalLocationId(l) === String(id) || String(l.id || '') === String(id)) || fallback; }
    _intervalRaw(rot) { const mgr = this.game.rotationV2, out = []; mgr.recalculateRotation(rot.id); for (const o of rot.occurrences) {
        const ver = this.game.scheduleV2.getVersion(o.scheduleId, o.versionId);
        if (!ver)
            continue;
        for (const iv of mgr.materialIntervals(rot.id, o.id, null, o.resolvedStartSec))
            out.push({ ...iv, occurrenceId: String(o.id), vehicleId: String(iv.vehicleId || ''), startSec: Number(iv.startSec || 0), endSec: Number(iv.endSec || 0) });
    } return out; }
    _timelineSegments(rot) {
        const mgr = this.game.rotationV2, raw = this._intervalRaw(rot), segments = [], handled = new Set();
        const key = (iv) => `${iv.occurrenceId}|${iv.vehicleId}|${iv.startSec}|${iv.endSec}|${iv.startLocationId || ''}|${iv.endLocationId || ''}`;
        for (const c of mgr.coupons) {
            const vids = [...new Set(c.vehicleIds || [])].map(String).filter((id) => mgr.getVehicle(id));
            if (vids.length < 2)
                continue;
            const occIds = [...new Set(raw.filter((iv) => vids.includes(String(iv.vehicleId || ''))).map((iv) => iv.occurrenceId))];
            for (const occId of occIds) {
                const per = vids.map((id) => raw.filter((iv) => iv.occurrenceId === occId && iv.vehicleId === id).sort((a, b) => a.startSec - b.startSec));
                if (per.some((a) => !a.length))
                    continue;
                // Normal railway duty has one live interval per vehicle/occurrence. Use the
                // first overlapping interval of every vehicle and keep individual tails
                // visible after a real split or before a merge.
                const chosen = per.map((a) => a[0]);
                if (chosen.some((iv) => handled.has(key(iv))))
                    continue;
                const commonStart = Math.max(...chosen.map((x) => x.startSec)), commonEnd = Math.min(...chosen.map((x) => x.endSec));
                if (!(commonEnd > commonStart))
                    continue;
                const first = chosen[0];
                segments.push({ kind: 'coupon', entityId: `coupon:${c.id}`, couponId: c.id, vehicleIds: vids, occurrenceId: occId, startSec: commonStart, endSec: commonEnd, startLocationId: first.startLocationId, endLocationId: chosen.find((x) => x.endSec === commonEnd)?.endLocationId || first.endLocationId, role: 'COUPON', reason: 'COUPON_UNIFIED' });
                for (const iv of chosen) {
                    handled.add(key(iv));
                    if (iv.startSec < commonStart)
                        segments.push({ ...iv, kind: 'vehicle', entityId: `vehicle:${iv.vehicleId}`, vehicleIds: [String(iv.vehicleId || '')], endSec: commonStart });
                    if (iv.endSec > commonEnd)
                        segments.push({ ...iv, kind: 'vehicle', entityId: `vehicle:${iv.vehicleId}`, vehicleIds: [String(iv.vehicleId || '')], startSec: commonEnd });
                }
            }
        }
        for (const iv of raw)
            if (!handled.has(key(iv)))
                segments.push({ ...iv, kind: 'vehicle', entityId: `vehicle:${iv.vehicleId}`, vehicleIds: [String(iv.vehicleId || '')] });
        const entityMap = new Map();
        for (const seg of segments) {
            if (!entityMap.has(seg.entityId)) {
                if (seg.kind === 'coupon') {
                    const c = mgr.getCoupon(seg.couponId);
                    entityMap.set(seg.entityId, { id: seg.entityId, kind: 'coupon', coupon: c, vehicleIds: [...(c?.vehicleIds || [])].map(String), segments: [] });
                }
                else {
                    const v = mgr.getVehicle(String(seg.vehicleId || ''));
                    entityMap.set(seg.entityId, { id: seg.entityId, kind: 'vehicle', vehicle: v, vehicleIds: [String(seg.vehicleId || '')], segments: [] });
                }
            }
            entityMap.get(seg.entityId).segments.push(seg);
        }
        const entities = [...entityMap.values()].filter((e) => e.kind === 'coupon' || Boolean(e.vehicle)).sort((a, b) => { const as = Math.min(...a.segments.map((x) => Number(x.startSec || 0))), bs = Math.min(...b.segments.map((x) => Number(x.startSec || 0))); return as - bs || String(a.id).localeCompare(String(b.id)); });
        return { raw, segments, entities };
    }
    _globalCouponIntervals(couponId, date = this._selectedDateValue()) { const mgr = this.game.rotationV2, c = mgr.getCoupon(couponId); if (!c?.vehicleIds?.length)
        return []; const out = []; for (const r of mgr.rotations) {
        if (!this._rotationRunsOnDate(r, date))
            continue;
        const data = this._timelineSegments(r);
        for (const e of data.entities)
            if (e.id === `coupon:${couponId}`)
                for (const seg of e.segments) {
                    const occ = r.occurrences.find((o) => o.id === seg.occurrenceId), ver = occ && this.game.scheduleV2.getVersion(occ.scheduleId, occ.versionId);
                    if (occ && this._versionRunsOnDate(ver, date))
                        out.push({ ...seg, rotation: r, occ });
                }
    } return out.sort((a, b) => a.startSec - b.startSec); }
    _nextScheduleSuggestions(rot) { if (!rot?.occurrences?.length)
        return { anchor: null, rows: [] }; const sorted = [...rot.occurrences].filter((o) => Number.isFinite(Number(o.resolvedEndSec))).sort((a, b) => Number(a.resolvedEndSec) - Number(b.resolvedEndSec)); const anchor = (this.selectedOccurrenceId && rot.occurrences.find((o) => o.id === this.selectedOccurrenceId)) || sorted.at(-1); if (!anchor)
        return { anchor: null, rows: [] }; const meta = this._occMeta(anchor), terminal = meta.to, terminalId = this._physicalLocationId(terminal), after = Number(anchor.resolvedEndSec ?? meta.ver?.lastArrivalSec ?? 0), DAY = 86400, used = new Set(rot.occurrences.map((o) => `${o.scheduleId}|${o.versionId}`)); const rows = []; for (const rec of this.game.scheduleV2.schedules) {
        const v = rec.currentVersion;
        if (v?.state !== ScheduleState.VALID || used.has(`${rec.id}|${v.id}`))
            continue;
        const origin = v.locations?.[0];
        if (!terminalId || this._physicalLocationId(origin) !== terminalId)
            continue;
        let offset = 0, dep = Number(v.firstDepartureSec || 0);
        if (dep < after)
            offset = Math.ceil((after - dep) / DAY) * DAY;
        dep += offset;
        rows.push({ rec, ver: v, offsetSec: offset, departureSec: dep, waitSec: Math.max(0, dep - after), origin, destination: v.locations?.at(-1) });
    } rows.sort((a, b) => a.departureSec - b.departureSec); return { anchor, rows: rows.slice(0, 8) }; }
    _rotationUiState(rot, allConflicts = null) {
        const mgr = this.game.rotationV2;
        if (!rot)
            return { key: 'bad', label: 'À corriger', issues: [], conflicts: [], runtime: [] };
        try {
            mgr.recalculateRotation(rot.id);
        }
        catch { }
        const issues = (mgr.validateRotation(rot.id) || []), conflictSource = (Array.isArray(allConflicts) ? allConflicts : (mgr.validateMaterialConflicts?.() || [])), conflicts = conflictSource.filter((c) => c.first?.rotationId === rot.id || c.second?.rotationId === rot.id), runtime = (this.game.scheduleV2Runtime?.alerts || []).filter((a) => a.rotationId === rot.id);
        if (!rot.enabled)
            return { key: 'inactive', label: 'Inactive', issues, conflicts, runtime };
        if (!rot.occurrences?.length)
            return { key: 'bad', label: 'Vide', issues: [{ level: 'ERROR', code: 'ROTATION_EMPTY', message: 'Aucun horaire dans cette ligne.' }, ...issues], conflicts, runtime };
        const errors = issues.filter((i) => i.level === 'ERROR'), warnings = issues.filter((i) => i.level !== 'ERROR'), rtErrors = runtime.filter((a) => String(a.level || '').toUpperCase() === 'ERROR'), rtWarn = runtime.filter((a) => String(a.level || '').toUpperCase() !== 'ERROR');
        if (errors.length || conflicts.length || rtErrors.length)
            return { key: 'bad', label: 'À corriger', issues, conflicts, runtime };
        if (warnings.length || rtWarn.length)
            return { key: 'warn', label: 'À vérifier', issues, conflicts, runtime };
        return { key: 'ok', label: 'Exploitable', issues, conflicts, runtime };
    }
    _rotationNextService(rot) {
        const now = Number(this.game.timeOfDay ?? this.game._gameTime ?? 0) || 0, DAY = 86400, rows = (rot?.occurrences || []).filter((o) => Number.isFinite(Number(o.resolvedStartSec))).map((o) => { let start = Number(o.resolvedStartSec); while (start < now)
            start += DAY; return { o, start }; }).sort((a, b) => a.start - b.start);
        if (!rows.length)
            return null;
        const x = rows[0], m = this._occMeta(x.o);
        return { occ: x.o, start: x.start, meta: m };
    }
    _fleetMetrics() {
        const mgr = this.game.rotationV2, rots = (mgr.rotations || []), advanced = this.game.realismSettings?.rotationsRequired === true, allConflicts = (mgr.validateMaterialConflicts?.() || []), states = rots.map((r) => ({ r, state: this._rotationUiState(r, allConflicts) }));
        const validSchedules = (this.game.scheduleV2.schedules || []).filter((s) => s.currentVersion?.state === ScheduleState.VALID);
        const direct = advanced ? [] : (mgr.directAssignments || []).filter((a) => a.enabled !== false && !mgr.directAssignmentSuppressed?.(a)), directIds = new Set(direct.map((a) => a.scheduleId).filter((id) => typeof id === 'string'));
        const outside = validSchedules.filter((s) => !(mgr.findScheduleReferences?.(s.id) || []).length && (advanced || !directIds.has(s.id)));
        const activeServices = (this.game.scheduleCreator?.getActiveServices?.() || []), live = activeServices.filter((s) => s?._v2RotationId && ['moving', 'departing', 'stopped_at_station', 'waiting_departure', 'pre_departure'].includes(String(s.state || ''))).length;
        const used = new Set();
        for (const r of rots)
            for (const o of r.occurrences || [])
                for (const m of o.formation?.members || [])
                    if (m.vehicleId)
                        used.add(String(m.vehicleId));
        for (const a of direct)
            for (const m of a.formation?.members || [])
                if (m.vehicleId)
                    used.add(String(m.vehicleId));
        return { rots, states, allConflicts, advanced, simpleAssignments: direct.length, totalServices: rots.reduce((n, r) => n + (r.occurrences?.length || 0), 0), activeLines: rots.filter((r) => r.enabled).length, ok: states.filter((x) => x.state.key === 'ok').length, warn: states.filter((x) => x.state.key === 'warn').length, bad: states.filter((x) => x.state.key === 'bad').length, inactive: states.filter((x) => x.state.key === 'inactive').length, outsideSchedules: outside.length, validSchedules: validSchedules.length, live, usedMaterials: used.size };
    }
    _renderControlDashboard(metrics, rot) {
        const m = metrics || this._fleetMetrics(), problem = m.bad + m.warn;
        return `<div class="rv61-dashboard"><div class="rv61-kpi ${htmlText(m.bad ? 'bad' : m.warn ? 'warn' : 'ok')}"><span>Lignes exploitables</span><b>${m.ok}/${m.rots.length}</b><small>${m.bad} à corriger · ${m.warn} à vérifier</small></div><div class="rv61-kpi"><span>Services en roulement</span><b>${m.totalServices}</b><small>${m.live} circulation(s) V2 active(s)</small></div><div class="rv61-kpi ${htmlText(m.outsideSchedules ? 'warn' : 'ok')}"><span>${m.advanced ? 'Horaires hors roulement' : 'Horaires sans affectation'}</span><b>${m.outsideSchedules}</b><small>${m.advanced ? 'roulement requis' : 'rame directe ou roulement'} · sur ${m.validSchedules} valide(s)</small></div><div class="rv61-kpi"><span>Matériel physique utilisé</span><b>${m.usedMaterials}</b><small>locos, automotrices, voitures, wagons</small></div><div class="rv61-kpi ${htmlText(m.allConflicts.length ? 'bad' : 'ok')}"><span>Conflits matériels</span><b>${m.allConflicts.length}</b><small>chevauchement / continuité physique</small></div><div class="rv61-kpi clickable ${htmlText(problem ? 'warn' : 'ok')}" data-rv2="open-problems"><span>Contrôle exploitation</span><b>${problem || '✓'}</b><small>${problem ? 'ligne(s) à examiner' : 'aucune anomalie détectée'}</small></div></div><div class="rv61-filterbar"><input data-rv3-input="line-search" value="${esc(this.rotationSearchQuery || '')}" placeholder="Rechercher une ligne, un train, une gare, une loco, un coupon…"><select data-rv3-select="line-status"><option value="all" ${(this.rotationStatusFilter || 'all') === 'all' ? 'selected' : ''}>Tous les statuts</option><option value="ok" ${this.rotationStatusFilter === 'ok' ? 'selected' : ''}>✓ Exploitables</option><option value="problem" ${this.rotationStatusFilter === 'problem' ? 'selected' : ''}>⚠ À vérifier / corriger</option><option value="bad" ${this.rotationStatusFilter === 'bad' ? 'selected' : ''}>⛔ À corriger</option><option value="inactive" ${this.rotationStatusFilter === 'inactive' ? 'selected' : ''}>⏸ Inactives</option></select><small>${rot ? `Ligne ouverte : <b>${esc(rot.name)}</b>` : 'Cliquez une ligne pour ouvrir son diagramme.'}</small></div>`;
    }
    _renderLineOverview(rot, state) {
        if (!rot)
            return '';
        const calc = rot.assignedFormation?.calculate?.(this.game.rotationV2) || { lengthM: 0, massKg: 0, powerW: 0, maxSpeed: 0, passengerCapacity: 0, freightCapacity: 0 }, next = this._rotationNextService(rot), homeNames = [];
        const depotMgr = this.game.depotManager;
        for (const m of rot.assignedFormation?.members || []) {
            const v = this.game.rotationV2.getVehicle(m.vehicleId);
            if (v?.homeDepotId) {
                const d = depotMgr?.getDepotById?.(v.homeDepotId);
                homeNames.push(d?.name || v.homeDepotId);
            }
        }
        const homes = [...new Set(homeNames)];
        const firstIssue = [...(state?.issues || []), ...(state?.runtime || [])].find((x) => String(x.level || '').toUpperCase() === 'ERROR') || state?.conflicts?.[0] || state?.issues?.[0] || state?.runtime?.[0];
        return `<div class="rv61-line-overview"><div><span>État</span><b><span class="rv61-status ${htmlText(state?.key || 'ok')}">${state?.key === 'ok' ? '✓' : state?.key === 'warn' ? '⚠' : state?.key === 'inactive' ? '⏸' : '⛔'} ${esc(state?.label || '')}</span></b></div><div><span>Services</span><b>${rot.occurrences?.length || 0} · ${Math.round(this._rotationDistance(rot))} km</b></div><div><span>Formation</span><b>${Math.round(calc.lengthM || 0)} m · ${Math.round((calc.massKg || 0) / 1000)} t</b></div><div><span>Traction</span><b>${Math.round((calc.powerW || 0) / 1000)} kW · V${Math.round(calc.maxSpeed || 0)}</b></div><div><span>Prochain service</span><b>${htmlText(next ? `${formatScheduleClock(next.start)} · ${(next.meta?.rec?.number || '?')}` : '—')}</b></div><div class="wide"><span>Matériel</span><b>${esc(this._lineFormationText(rot) || 'Aucune formation affectée')}</b></div><div><span>Dépôt(s) d’affectation</span><b>${esc(homes.join(', ') || '—')}</b></div><div class="wide"><span>Diagnostic prioritaire</span><b>${firstIssue ? esc(firstIssue.message || firstIssue.status || 'Conflit matériel') : state?.key === 'ok' ? 'Aucune anomalie détectée' : '—'}</b></div></div>`;
    }
    _rv63FilteredRotations(metrics) {
        const m = metrics || this._fleetMetrics(), q = String(this.rotationSearchQuery || '').trim().toLowerCase(), filter = this.rotationStatusFilter || 'all', byId = new Map(m.states.map((x) => [x.r.id, x.state]));
        const searchable = (r) => { const services = (r.occurrences || []).map((o) => { const x = this._occMeta(o); return `${x.rec?.number || ''} ${x.rec?.name || ''} ${x.from?.name || ''} ${x.to?.name || ''}`; }).join(' '); return `${r.name} ${this._lineFormationText(r)} ${services}`.toLowerCase(); };
        return (m.rots || []).filter((r) => !q || searchable(r).includes(q)).filter((r) => { const k = byId.get(r.id)?.key || 'bad'; if (filter === 'all')
            return true; if (filter === 'problem')
            return k === 'bad' || k === 'warn'; return k === filter; });
    }
    _rv63StatusHtml(st, withLabel = true) { const k = st?.key || 'bad', icon = k === 'ok' ? '✓' : k === 'warn' ? '⚠' : k === 'inactive' ? '⏸' : '⛔', label = st?.label || (k === 'ok' ? 'Exploitable' : k === 'warn' ? 'À vérifier' : k === 'inactive' ? 'Inactive' : 'À corriger'); return `<span class="rv61-status ${htmlText(k)}">${icon}${htmlText(withLabel ? ` ${(label)}` : '')}</span>`; }
    _renderRv63Fleet(metrics) {
        const m = metrics || this._fleetMetrics(), rots = this._rv63FilteredRotations(m), byId = new Map(m.states.map((x) => [x.r.id, x.state]));
        const cards = rots.map((r) => { const st = byId.get(r.id) || this._rotationUiState(r, m.allConflicts), next = this._rotationNextService(r), first = [...(st.issues || []), ...(st.runtime || [])].find((x) => String(x.level || '').toUpperCase() === 'ERROR') || st.conflicts?.[0] || st.issues?.[0] || st.runtime?.[0], problemClass = st.key === 'bad' ? ' bad' : ''; return `<div class="rv63-line ${htmlText(r.id === this.selectedRotationId ? 'selected' : '')}" data-rv2="select-line" data-rotation="${htmlText(r.id)}"><div class="rv63-line-main"><div class="rv63-line-title"><b>${esc(r.name)}</b>${this._rv63StatusHtml(st)}</div><div class="rv63-line-meta"><span><b>${r.occurrences?.length || 0}</b> service(s)</span><span><b>${Math.round(this._rotationDistance(r))}</b> km</span><span>Matériel : <b>${esc(this._lineFormationText(r) || 'à affecter')}</b></span></div><div class="rv63-line-next">${next ? `Prochain service : <b>${formatScheduleClock(next.start)}</b> · ${esc(next.meta?.rec?.number || '?')} · ${esc(next.meta?.from?.name || '?')} → ${esc(next.meta?.to?.name || '?')}` : 'Aucun service planifié'}</div>${first ? `<div class="rv63-line-problem${htmlText(problemClass)}">${esc(first.message || first.status || 'Anomalie à examiner')}</div>` : ''}</div><button class="btn-secondary rv63-open" data-rv2="select-line" data-rotation="${htmlText(r.id)}">Ouvrir →</button></div>`; }).join('');
        const modeBanner = m.advanced ? `<div class="rv63-notice"><b>Mode avancé actif.</b> Les horaires doivent passer par un roulement exploitable pour circuler.</div>` : `<div class="rv61-goodbox"><b>Mode simplifié actif — Roulements facultatifs.</b> Vous pouvez faire circuler un horaire avec une rame affectée directement depuis la page Horaires. Les roulements restent disponibles si vous voulez enchaîner précisément plusieurs services. ${m.simpleAssignments ? `<b>${m.simpleAssignments}</b> affectation(s) directe(s) active(s).` : ''}</div>`;
        const uncovered = m.outsideSchedules ? (m.advanced ? `<div class="rv63-notice"><b>${m.outsideSchedules} horaire(s) valide(s) ne sont dans aucun roulement.</b> En mode avancé ils ne créent aucune circulation physique.</div>` : `<div class="rv63-notice"><b>${m.outsideSchedules} horaire(s) valide(s) n'ont ni roulement ni rame directe.</b> Affectez simplement une rame depuis Horaires, ou créez un roulement si vous voulez le mode détaillé.</div>`) : '';
        return `<div class="rv63-shell">${modeBanner}<div class="rv63-topbar"><div class="rv63-titleblock"><h1>Roulements</h1><p>Un roulement enchaîne des horaires avec une formation physique. Choisissez une ligne pour voir simplement ses services, son matériel, ses opérations puis sa validation.</p></div><div class="rv63-topactions"><button class="btn-secondary page-help-btn" data-page-help="rotations" type="button">❓ Aide</button><button class="btn-primary" data-rv2="new-rotation">+ Nouveau roulement</button></div></div><div class="rv63-toolbar"><input data-rv3-input="line-search" value="${esc(this.rotationSearchQuery || '')}" placeholder="Rechercher un roulement, un train, une gare ou du matériel…"><select data-rv3-select="line-status"><option value="all" ${(this.rotationStatusFilter || 'all') === 'all' ? 'selected' : ''}>Tous</option><option value="ok" ${this.rotationStatusFilter === 'ok' ? 'selected' : ''}>Exploitable</option><option value="problem" ${this.rotationStatusFilter === 'problem' ? 'selected' : ''}>À vérifier / corriger</option><option value="inactive" ${this.rotationStatusFilter === 'inactive' ? 'selected' : ''}>Inactive</option></select></div><div class="rv63-counts"><span class="rv63-count">${m.rots.length} roulement(s)</span><span class="rv63-count">${m.totalServices} service(s)</span><span class="rv63-count ok">${m.ok} exploitable(s)</span>${m.warn ? `<span class="rv63-count warn">${m.warn} à vérifier</span>` : ''}${m.bad ? `<span class="rv63-count bad">${m.bad} à corriger</span>` : ''}</div>${uncovered}<div class="rv63-line-list">${cards || '<div class="rv63-empty"><b>Aucun roulement à afficher.</b><br>Créez une ligne ou modifiez le filtre de recherche.</div>'}</div></div>`;
    }
    _renderRv63ServiceDetails(rot, o) {
        if (!o)
            return '';
        const m = this._occMeta(o), acts = rot.actions.filter((a) => a.occurrenceId === o.id), lead = this._leadingInfo(o), form = o.formation?.calculate?.(this.game.rotationV2) || {};
        return `<div class="rv63-service-detail"><div class="rv63-service-detail-top"><div class="rv63-service-detail-main"><b>${esc(m.rec?.number || '?')} · ${esc(m.rec?.name || '')}</b><br>${esc(m.from?.name || '?')} → ${esc(m.to?.name || '?')} · ${Math.round(this._distanceKm(o))} km<br>Conduite : ${esc(lead.label)} · Formation : ${Math.round(form.lengthM || 0)} m / ${Math.round((form.massKg || 0) / 1000)} t${o.usesAssignedFormation === false ? ' · <b>composition spécifique à ce service</b>' : ''}${acts.length ? `<br>Opérations : ${acts.map((a) => esc(actionDisplay(a))).join(' · ')}` : ''}</div><div class="rv63-service-detail-actions"><button class="btn-secondary" data-rv2="move-occ" data-occ="${htmlText(o.id)}" data-delta="-1">↑ Monter</button><button class="btn-secondary" data-rv2="move-occ" data-occ="${htmlText(o.id)}" data-delta="1">↓ Descendre</button><button class="btn-secondary" data-rv2="reverse-occ" data-occ="${htmlText(o.id)}">${o.reversed ? '◀ Sens inversé' : '▶ Sens normal'}</button><button class="btn-secondary" data-rv2="assign" data-occ="${htmlText(o.id)}">Matériel spécifique</button><button class="btn-secondary" data-rv2="action" data-occ="${htmlText(o.id)}">+ Opération</button><button class="btn-secondary" data-rv2="remove-occ" data-occ="${htmlText(o.id)}">Retirer</button></div></div></div>`;
    }
    _renderRv63Services(rot) {
        const rows = (rot.occurrences || []).map((o, i) => { const m = this._occMeta(o), next = rot.occurrences[i + 1], gap = next && Number.isFinite(Number(next.resolvedStartSec)) && Number.isFinite(Number(o.resolvedEndSec)) ? Math.max(0, Number(next.resolvedStartSec) - Number(o.resolvedEndSec)) : null, acts = rot.actions.filter((a) => a.occurrenceId === o.id), selected = o.id === this.selectedOccurrenceId; return `<div><div class="rv63-service ${htmlText(selected ? 'selected' : '')}" data-rv2="select-occ" data-occ="${htmlText(o.id)}"><div class="rv63-service-index">#${i + 1}</div><div class="rv63-service-train"><b>${esc(m.rec?.number || '?')}</b><small>${formatScheduleClock(o.resolvedStartSec ?? m.ver?.firstDepartureSec ?? 0)} → ${formatScheduleClock(o.resolvedEndSec ?? m.ver?.lastArrivalSec ?? 0)}</small></div><div class="rv63-service-route"><b>${esc(m.from?.name || '?')} → ${esc(m.to?.name || '?')}</b><small>${esc(m.rec?.name || '')}</small></div><div class="rv63-service-stat"><span>Distance</span><b>${Math.round(this._distanceKm(o))} km</b><small>${acts.length} opération(s)</small></div><div class="rv63-service-stat laststat"><span>Après</span><b>${gap == null ? 'Fin du roulement' : fmtDuration(gap)}</b><small>${gap == null ? 'matériel libéré' : 'battement'}</small></div></div>${selected ? this._renderRv63ServiceDetails(rot, o) : ''}</div>`; }).join('');
        return `<section class="rv63-section"><div class="rv63-section-head"><span class="rv63-num">1</span><div class="rv63-section-title"><h2>Services du roulement</h2><p>Ce sont les horaires réellement enchaînés par cette ligne, dans l’ordre d’utilisation du matériel.</p></div><div class="rv63-section-actions"><button class="btn-primary" data-rv2="add-schedule">+ Ajouter un horaire</button></div></div><div class="rv63-section-body"><div class="rv63-service-list">${rows || '<div class="rv63-empty"><b>Aucun service.</b><br>Ajoutez le premier horaire de ce roulement.</div>'}</div></div></section>`;
    }
    _renderRv63Material(rot) {
        const mgr = this.game.rotationV2, members = [...(rot.assignedFormation?.members || [])].sort((a, b) => a.order - b.order), items = [], seenCoupons = new Set();
        for (const m of members) {
            if (m.sourceCouponId) {
                if (seenCoupons.has(m.sourceCouponId))
                    continue;
                seenCoupons.add(m.sourceCouponId);
                const c = mgr.getCoupon(m.sourceCouponId), vs = (c?.vehicleIds || []).map((id) => mgr.getVehicle(id)).filter(Boolean), img = vs.find((v) => v.imageData)?.imageData || '';
                items.push(`<div class="rv63-material">${img ? `<img src="${htmlText(img)}">` : ''}<div><b>${esc(c?.name || 'Coupon')}</b><br><small>${vs.length} véhicule(s) · coupon</small></div></div>`);
                continue;
            }
            const v = mgr.getVehicle(m.vehicleId);
            if (!v)
                continue;
            items.push(`<div class="rv63-material">${v.imageData ? `<img src="${htmlText(v.imageData)}">` : ''}<div><b>${esc(v.number || v.name || '?')}</b><br><small>${esc(roleLabel(m.role))}</small></div></div>`);
        }
        const inherited = rot.occurrences.filter((o) => o.usesAssignedFormation !== false).length, exceptions = rot.occurrences.length - inherited;
        return `<section class="rv63-section"><div class="rv63-section-head"><span class="rv63-num">2</span><div class="rv63-section-title"><h2>Matériel affecté</h2><p>Cette formation est utilisée par défaut sur tous les services. Les exceptions restent visibles service par service.</p></div><div class="rv63-section-actions"><button class="btn-primary" data-rv2="assign-line">Composer / modifier</button>${rot.assignedFormation?.members?.length ? '<button class="btn-secondary" data-rv2="apply-line-all">Réappliquer à tous</button><button class="btn-secondary" data-rv2="clear-line">Vider</button>' : ''}</div></div><div class="rv63-section-body"><div class="rv63-material-summary"><b>${esc(this._lineFormationText(rot) || 'Aucune formation affectée')}</b> · ${inherited} service(s) standard${exceptions ? ` · ${exceptions} exception(s)` : ''}</div><div class="rv63-material-strip">${items.join('') || '<div class="rv63-empty"><b>Aucun matériel.</b><br>Choisissez une rame, une locomotive et/ou un coupon pour rendre le roulement exploitable.</div>'}</div></div></section>`;
    }
    _renderRv63Operations(rot) {
        const ops = [...(rot.actions || [])].map((a) => { const o = rot.occurrences.find((x) => x.id === a.occurrenceId), m = o ? this._occMeta(o) : {}, loc = m.ver?.locations?.find((l) => l.id === a.locationOccurrenceId); return `<div class="rv63-op"><div><b>${esc(m.rec?.number || 'Service ?')}</b><br><small>${esc(m.from?.name || '?')} → ${esc(m.to?.name || '?')}</small></div><div><b>${esc(actionDisplay(a))}</b><br><small>${esc(loc?.name || '?')}</small></div><div><b>${htmlText(Math.round(Number(a.durationSec || 0) / 60))} min</b><br><small>${esc(a.forcedExecutionMode || 'Auto')}</small></div><div class="rv63-op-actions"><button class="btn-secondary" data-rv2="edit-action" data-occ="${esc(a.occurrenceId)}" data-action="${esc(a.id)}">Éditer</button><button class="btn-secondary" data-rv2="remove-action" data-action="${esc(a.id)}">×</button></div></div>`; }).join('');
        const selected = rot.occurrences.find((o) => o.id === this.selectedOccurrenceId) || rot.occurrences[0];
        return `<section class="rv63-section"><div class="rv63-section-head"><span class="rv63-num">3</span><div class="rv63-section-title"><h2>Opérations particulières</h2><p>Changement de locomotive, UM, coupe, réunion, CV ou pousse. Si rien n’est nécessaire, laissez cette section vide.</p></div><div class="rv63-section-actions">${selected ? `<button class="btn-primary" data-rv2="action" data-occ="${htmlText(selected.id)}">+ Opération sur ${esc(this._occMeta(selected).rec?.number || 'le service')}</button>` : ''}</div></div><div class="rv63-section-body"><div class="rv63-oplist">${ops || '<div class="rv63-empty"><b>Aucune opération particulière.</b><br>La formation standard est conservée d’un service au suivant.</div>'}</div></div></section>`;
    }
    _renderRv63Validation(rot, state) {
        const problems = [], warns = [];
        for (const i of [...(state?.issues || []), ...(state?.runtime || [])]) {
            (String(i.level || '').toUpperCase() === 'ERROR' ? problems : warns).push(i);
        }
        for (const c of state?.conflicts || [])
            problems.push({ message: c.message || 'Conflit matériel' });
        const body = problems.length || warns.length ? `${problems.map((i) => `<div class="rv63-valid-issue"><b>⛔ À corriger</b><br>${esc(i.message || i.code || 'Erreur')}</div>`).join('')}${warns.map((i) => `<div class="rv63-valid-issue rv63-valid-warn"><b>⚠ À vérifier</b><br>${esc(i.message || i.code || 'Avertissement')}</div>`).join('')}` : `<div class="rv63-valid-good"><b>✓ Roulement exploitable</b><br>Aucune anomalie bloquante ou conflit matériel n’est détecté pour cette ligne.</div>`;
        return `<section class="rv63-section"><div class="rv63-section-head"><span class="rv63-num">4</span><div class="rv63-section-title"><h2>Validation</h2><p>Cette dernière étape vous dit clairement si le roulement peut réellement créer ses circulations.</p></div>${this._rv63StatusHtml(state)}</div><div class="rv63-section-body">${body}</div></section>`;
    }
    _renderRv63Line(rot, state) {
        const calc = rot.assignedFormation?.calculate?.(this.game.rotationV2) || {}, next = this._rotationNextService(rot), calendar = rot.calendarId ? this.game.scheduleV2.calendars.find((c) => c.id === rot.calendarId) : null;
        return `<div class="rv63-shell"><div class="rv63-back" data-rv2="view" data-view="fleet">← Tous les roulements</div><div class="rv63-linehead"><div class="rv63-linehead-main"><h1>${esc(rot.name)}</h1><div class="rv63-linehead-sub">${this._rv63StatusHtml(state)} · ${rot.enabled ? 'ligne active' : 'ligne inactive'}${htmlText(calendar ? ` · ${(calendar.name)}` : ' · circulation selon les horaires')}</div></div><div class="rv63-linehead-actions"><select data-rv3-select="calendar" title="Calendrier de circulation"><option value="">Calendrier : selon les horaires</option>${(this.game.scheduleV2.calendars || []).map((c, i) => `<option value="${htmlText(c.id)}" ${rot.calendarId === c.id ? 'selected' : ''}>Calendrier : ${esc(c.name)}</option>`).join('')}</select><button class="btn-secondary page-help-btn" data-page-help="rotations" type="button">❓ Aide</button><button class="btn-secondary" data-rv2="rename-rotation">Renommer</button><button class="btn-secondary" data-rv2="duplicate-rotation">Dupliquer</button><button class="btn-secondary" data-rv2="toggle-rotation">${rot.enabled ? '⏸ Désactiver' : '▶ Activer'}</button><button class="btn-secondary" data-rv2="delete-rotation">Supprimer</button></div></div><div class="rv63-quick"><div><span>Services</span><b>${rot.occurrences?.length || 0} · ${Math.round(this._rotationDistance(rot))} km</b></div><div><span>Matériel</span><b>${Math.round(calc.lengthM || 0)} m · ${Math.round((calc.massKg || 0) / 1000)} t</b></div><div><span>Formation</span><b>${esc(this._lineFormationText(rot) || 'À affecter')}</b></div><div><span>Prochain service</span><b>${htmlText(next ? `${formatScheduleClock(next.start)} · ${(next.meta?.rec?.number || '?')}` : '—')}</b></div></div><div class="rv63-steps"><span class="rv63-stepchip"><strong>1</strong> Services</span><span class="rv63-stepchip"><strong>2</strong> Matériel</span><span class="rv63-stepchip"><strong>3</strong> Opérations</span><span class="rv63-stepchip"><strong>4</strong> Validation</span></div>${this._renderRv63Services(rot)}${this._renderRv63Material(rot)}${this._renderRv63Operations(rot)}${this._renderRv63Validation(rot, state)}<div class="rv63-advanced"><h3>Outils avancés</h3><p>À ouvrir seulement si vous avez besoin du diagramme détaillé ou du suivi technique du matériel.</p><div class="rv63-advanced-buttons"><button class="btn-secondary" data-rv2="view" data-view="sheet">Feuille graphique</button><button class="btn-secondary" data-rv2="view" data-view="material">Journée matériel</button><button class="btn-secondary" data-rv2="view" data-view="table">Tableau technique</button><button class="btn-secondary" data-rv2="view" data-view="rotation">Montage avancé</button></div></div></div>`;
    }
    render() {
        const page = document.getElementById('page-rotations');
        if (!page)
            return;
        const mgr = this.game.rotationV2;
        if (!this.selectedRotationId && mgr.rotations.length)
            this.selectedRotationId = mgr.rotations[0].id;
        const rot = mgr.getRotation(this.selectedRotationId);
        if (rot && !rot.occurrences.some((o) => o.id === this.selectedOccurrenceId))
            this.selectedOccurrenceId = rot.occurrences[0]?.id || '';
        if (rot)
            mgr.recalculateRotation(rot.id);
        const cal = this.game.scheduleV2.calendars || [], metrics = this._fleetMetrics();
        this._lastFleetMetrics = metrics;
        const uiState = rot ? this._rotationUiState(rot, metrics.allConflicts) : null, issues = uiState?.issues || [], conflicts = uiState?.conflicts || [], state = uiState?.key || 'ok';
        if (this.activeView === 'fleet') {
            page.innerHTML = this._renderRv63Fleet(metrics);
            return;
        }
        if (this.activeView === 'line') {
            page.innerHTML = rot ? this._renderRv63Line(rot, uiState) : this._renderRv63Fleet(metrics);
            return;
        }
        const mainContent = rot ? `${this._renderLineOverview(rot, uiState)}${this._renderLineFormation(rot)}${this._renderMain(rot)}` : (metrics.advanced ? '<div class="rv3-empty"><b>Créez une ligne de roulement.</b><br><br>Le mode avancé impose un roulement exploitable pour chaque horaire.</div>' : '<div class="rv3-empty"><b>Aucun roulement sélectionné.</b><br><br>C’est parfaitement normal en mode simplifié : affectez une rame directement depuis Horaires. Créez un roulement uniquement si vous voulez enchaîner plusieurs services avec le même matériel.</div>');
        const sheetMode = this.activeView === 'sheet', workClass = `rv3-work${sheetMode ? ' rv5-sheet-work' : ''}${sheetMode && this.sheetLibraryCollapsed ? ' rv5-hide-library' : ''}${sheetMode && this.sheetInspectorCollapsed ? ' rv5-hide-inspector' : ''}`;
        const sheetPanels = sheetMode ? `<button class="btn-secondary rv3-mini rv5-panel-toggle ${htmlText(this.sheetLibraryCollapsed ? '' : 'active')}" data-rv2="toggle-sheet-library">${this.sheetLibraryCollapsed ? '☰ Bibliothèque' : '✕ Bibliothèque'}</button><button class="btn-secondary rv3-mini rv5-panel-toggle ${htmlText(this.sheetInspectorCollapsed ? '' : 'active')}" data-rv2="toggle-sheet-inspector">${this.sheetInspectorCollapsed ? '☷ Détails' : '✕ Détails'}</button>` : '';
        page.innerHTML = `<div class="rv3-shell"><div class="rv3-head"><button class="btn-secondary" data-rv2="view" data-view="line">← Retour au roulement</button><span class="rv3-title">Outils avancés</span><button class="btn-secondary page-help-btn" data-page-help="rotations" type="button">❓ Aide</button><select data-rv3-select="rotation"><option value="">— choisir une ligne —</option>${mgr.rotations.map((r, i) => `<option value="${htmlText(r.id)}" ${r.id === this.selectedRotationId ? 'selected' : ''}>R${String(i + 1).padStart(2, '0')} · ${esc(r.name)}</option>`).join('')}</select><button class="btn-primary" data-rv2="new-rotation">+ Nouvelle ligne</button>${rot ? `<button class="btn-secondary" data-rv2="rename-rotation">Renommer</button><button class="btn-secondary" data-rv2="duplicate-rotation">Dupliquer</button><button class="btn-secondary" data-rv2="toggle-rotation">${rot.enabled ? '✓ Active' : '⏸ Inactive'}</button><button class="btn-secondary" data-rv2="delete-rotation">Supprimer</button><select data-rv3-select="calendar"><option value="">Circulation selon horaires</option>${cal.map((c, i) => `<option value="${htmlText(c.id)}" ${rot.calendarId === c.id ? 'selected' : ''}>#${i + 1} ${esc(c.name)}</option>`).join('')}</select>` : ''}<span class="rv3-spacer"></span><button class="btn-secondary" data-rv2="undo" ${this._history.length ? '' : 'disabled'} title="Annuler">↶</button><button class="btn-secondary" data-rv2="redo" ${this._future.length ? '' : 'disabled'} title="Rétablir">↷</button></div><div class="rv3-head" style="padding-top:6px;padding-bottom:6px"><div class="rv3-viewtabs"><button class="btn-secondary ${htmlText(this.activeView === 'fleet' ? 'active' : '')}" data-rv2="view" data-view="fleet">Vue générale</button><button class="btn-secondary ${htmlText(this.activeView === 'sheet' ? 'active' : '')}" data-rv2="view" data-view="sheet">Feuille de roulement</button><button class="btn-secondary ${htmlText(this.activeView === 'rotation' ? 'active' : '')}" data-rv2="view" data-view="rotation">Montage & opérations</button><button class="btn-secondary ${htmlText(this.activeView === 'material' ? 'active' : '')}" data-rv2="view" data-view="material">Journée matériel</button><button class="btn-secondary ${htmlText(this.activeView === 'table' ? 'active' : '')}" data-rv2="view" data-view="table">Liste des services</button></div>${this.activeView === 'material' ? `<label class="rv3-date-label">Journée <input type="date" data-rv3-select="date" value="${esc(this._selectedDateValue())}"></label>` : ''}${sheetPanels}<span class="rv3-spacer"></span>${rot && this.activeView !== 'fleet' ? `<span class="rv61-status ${htmlText(state)}">${state === 'ok' ? '✓ Exploitable' : state === 'warn' ? '⚠ À vérifier' : state === 'inactive' ? '⏸ Inactive' : '⛔ À corriger'}</span>` : '<span class="rv3-ok">Vue compagnie · horaires + matériel + opérations</span>'}</div>${this._renderControlDashboard(metrics, rot)}<div class="${htmlText(workClass)}"><aside class="rv3-library">${this._renderLibrary(rot)}</aside><main class="rv3-main">${mainContent}</main><aside class="rv3-inspector">${rot && this.activeView !== 'fleet' ? this._renderInspector(rot, issues, conflicts) : this._renderFleetInspector(metrics)}</aside></div>${rot && this.activeView !== 'fleet' ? this._renderSummary(rot, issues, conflicts) : ''}</div>`;
    }
    _renderLibrary(rot) {
        const mgr = this.game.rotationV2, q = this.searchQuery.trim().toLowerCase();
        let body = '';
        const cached = this._lastFleetMetrics, states = new Map((cached?.states || []).map((x) => [x.r.id, x.state])), allConflicts = cached?.allConflicts || mgr.validateMaterialConflicts?.() || [];
        const lines = `<div class="rv3-section" style="padding-top:0"><h3>Lignes créées</h3>${mgr.rotations.map((r, i) => { const label = this._lineFormationText(r), st = states.get(r.id) || this._rotationUiState(r, allConflicts), next = this._rotationNextService(r); return `<div class="rv3-card ${htmlText(r.id === this.selectedRotationId ? 'selected' : '')}" data-rv2="select-line" data-rotation="${htmlText(r.id)}"><div class="rv3-cardrow"><div><b>R${String(i + 1).padStart(2, '0')} · ${esc(r.name)}</b><br><small>${r.occurrences?.length || 0} service(s) • ${esc(label || 'sans matériel')}</small><br><small>${htmlText(next ? `Prochain : ${formatScheduleClock(next.start)} · ${(next.meta?.rec?.number || '?')}` : 'Aucun service planifié')}</small></div><span class="rv61-status ${htmlText(st.key)}">${st.key === 'ok' ? '✓' : st.key === 'warn' ? '⚠' : st.key === 'inactive' ? '⏸' : '⛔'}</span></div></div>`; }).join('') || '<small>Aucune ligne de roulement.</small>'}</div>`;
        if (this.libraryTab === 'schedules') {
            const rows = (this.game.scheduleV2.schedules || []).filter((s) => s.currentVersion.state === ScheduleState.VALID).filter((s) => !q || `${s.number} ${s.name} ${(s.currentVersion.locations || []).map((l) => l.name).join(' ')}`.toLowerCase().includes(q)).slice(0, 300);
            const recs = rot && !q ? this._nextScheduleSuggestions(rot) : { anchor: null, rows: [] };
            const recommendation = recs.rows.length ? `<div class="rv3-recommend"><h4>Services suivants depuis ${esc(this._occMeta(recs.anchor).to?.name || '?')}</h4>${recs.rows.map((x) => `<div class="rv3-card" draggable="true" data-drag-kind="schedule" data-drag-id="${htmlText(x.rec.id)}" data-drag-offset="${htmlText(x.offsetSec)}"><div class="rv3-cardrow"><div><b>${esc(x.rec.number || '?')}</b> ${esc(x.rec.name || '')}<br><small>${formatScheduleClock(x.departureSec)} • ${esc(x.origin?.name || '?')} → ${esc(x.destination?.name || '?')} • battement ${fmtDuration(x.waitSec)}</small></div><button class="btn-secondary rv3-mini" data-rv2="add-schedule-id" data-schedule="${htmlText(x.rec.id)}" data-offset="${htmlText(x.offsetSec)}">Enchaîner</button></div></div>`).join('')}</div>` : '';
            const advanced = this.game.realismSettings?.rotationsRequired === true, modeHint = advanced ? `<div class="rv4-mandatory"><b>Mode avancé :</b> chaque horaire doit être placé dans une ligne de roulement active avec du matériel.</div>` : `<div class="rv61-goodbox"><b>Roulements facultatifs.</b> Les horaires avec une rame directe circulent sans passer par cette bibliothèque.</div>`;
            body = modeHint + recommendation + (rows.map((rec) => { const v = rec.currentVersion, f = v.locations?.[0], t = v.locations?.at(-1), refs = mgr.findScheduleReferences?.(rec.id) || [], direct = !advanced && (mgr.directAssignments || []).find((a) => a.scheduleId === rec.id && a.enabled !== false && !mgr.directAssignmentSuppressed?.(a)), usage = refs.length ? `${refs.length} ligne(s)` : direct ? 'RAME DIRECTE' : 'SANS AFFECTATION'; return `<div class="rv3-card" draggable="true" data-drag-kind="schedule" data-drag-id="${htmlText(rec.id)}" data-drag-offset="0"><div class="rv3-cardrow"><div><b>${esc(rec.number || '?')}</b> ${esc(rec.name || '')}<br><small>${formatScheduleClock(v.firstDepartureSec)} • ${esc(f?.name || '?')} → ${esc(t?.name || '?')} • ${usage}</small></div>${rot ? `<button class="btn-secondary rv3-mini" data-rv2="add-schedule-id" data-schedule="${htmlText(rec.id)}" data-offset="0">＋</button>` : ''}</div></div>`; }).join('') || '<small>Aucun horaire valide correspondant.</small>');
        }
        if (this.libraryTab === 'material') {
            let rows = mgr.vehicles.filter((v) => mgr._poweredVehicle?.(v) || v.isDrivingTrailer).filter((v) => !q || `${v.number} ${v.name} ${v.category}`.toLowerCase().includes(q));
            const sort = this.materialSort || 'number';
            rows = [...rows].sort((a, b) => sort === 'km' ? Number(b.odometerKm || 0) - Number(a.odometerKm || 0) : sort === 'type' ? String(a.category || '').localeCompare(String(b.category || ''), 'fr', { numeric: true }) : String(a.number || '').localeCompare(String(b.number || ''), 'fr', { numeric: true })).slice(0, 500);
            body = `<div class="rv3-drop-hint"><b>Engins moteurs / conduite.</b> Glissez une loco ou automotrice sur la <b>formation de ligne</b>. Une deuxième traction devient UM active. Le rôle <b>CV</b> garde la masse mais neutralise sa puissance.</div><select class="rv4-sort" data-rv3-select="material-sort"><option value="number" ${htmlText(sort === 'number' ? 'selected' : '')}>Trier : numéro</option><option value="type" ${sort === 'type' ? 'selected' : ''}>Trier : type</option><option value="km" ${sort === 'km' ? 'selected' : ''}>Trier : km décroissants</option></select>` + rows.map((v) => `<div class="rv3-card ${htmlText(this.selectedMaterialId === `vehicle:${v.id}` ? 'selected' : '')}" draggable="true" data-drag-kind="vehicle" data-drag-id="${htmlText(v.id)}" data-rv2="select-material" data-vehicle="${htmlText(v.id)}"><div class="rv3-cardrow"><div><b>${esc(v.number)}</b><br><small>${esc(v.name)} • ${esc(v.category)} • ${Math.round(v.massKg / 1000)} t • V${v.maxSpeed} • ${Math.round(v.odometerKm || 0)} km</small></div>${v.imageData ? `<img src="${htmlText(v.imageData)}" style="width:74px;max-height:34px;object-fit:contain">` : ''}</div></div>`).join('') || '<small>Aucun engin moteur correspondant.</small>';
        }
        if (this.libraryTab === 'coupons') {
            const rows = mgr.coupons.filter((c) => !q || `${c.name} ${c.vehicleIds.map((id) => mgr.getVehicle(id)?.number || '').join(' ')}`.toLowerCase().includes(q));
            body = `<div class="rv3-drop-hint"><b>Coupons physiques indépendants.</b> Exemple : Coupon Corail 301, Coupon Nice, Coupon Briançon. Ils peuvent être coupés, repris par une autre locomotive puis continuer sur une autre ligne.</div>` + rows.map((c) => `<div class="rv3-card ${htmlText(this.selectedMaterialId === `coupon:${c.id}` ? 'selected' : '')}" draggable="true" data-drag-kind="coupon" data-drag-id="${htmlText(c.id)}" data-rv2="select-coupon" data-coupon="${htmlText(c.id)}"><b>${esc(c.name)}</b><br><small>${c.vehicleIds.length} véhicule(s) • ${c.vehicleIds.map((id) => esc(mgr.getVehicle(id)?.number || '?')).join(' → ')}</small></div>`).join('') || '<small>Aucun coupon correspondant.</small>';
        }
        if (this.libraryTab === 'rames') {
            const all = this.game.rameManager?.getAll?.() || [], rows = all.filter((r) => !q || `${r.name || ''} ${r.serialNumber || ''}`.toLowerCase().includes(q));
            body = `<div class="rv3-drop-hint">Une automotrice ou une rame complète peut aussi être affectée d’un bloc à une ligne de roulement.</div>` + rows.map((r) => { const physical = mgr.getRameVehicles(r.id); return `<div class="rv3-card ${htmlText(this.selectedMaterialId === `rame:${r.id}` ? 'selected' : '')}" draggable="true" data-drag-kind="rame" data-drag-id="${htmlText(r.id)}" data-rv2="select-rame" data-rame="${htmlText(r.id)}"><b>${esc(r.name || r.serialNumber || 'Rame')}</b>${r.serialNumber ? `<br><small>${esc(r.serialNumber)} • ` : '<br><small>'}${r.elementDetails?.length || 0} élément(s) • ${physical.length}/${r.elementDetails?.length || 0} matérialisé(s)</small></div>`; }).join('') || '<small>Aucune rame correspondante.</small>';
        }
        return `${lines}<h3 style="margin:8px 0 7px">Bibliothèque</h3><div class="rv3-libtabs"><button class="btn-secondary ${htmlText(this.libraryTab === 'schedules' ? 'active' : '')}" data-rv2="libtab" data-tab="schedules">Horaires</button><button class="btn-secondary ${htmlText(this.libraryTab === 'material' ? 'active' : '')}" data-rv2="libtab" data-tab="material">Locs / EM</button><button class="btn-secondary ${htmlText(this.libraryTab === 'coupons' ? 'active' : '')}" data-rv2="libtab" data-tab="coupons">Coupons</button><button class="btn-secondary ${htmlText(this.libraryTab === 'rames' ? 'active' : '')}" data-rv2="libtab" data-tab="rames">Rames</button></div><input class="rv3-search" data-rv3-input="search" value="${esc(this.searchQuery)}" placeholder="Rechercher…"><div class="rv3-toolbar-mini"><button class="btn-secondary" data-rv2="from-rame">🚆 Rame → objets physiques</button><button class="btn-secondary" data-rv2="new-vehicle">+ Matériel</button><button class="btn-secondary" data-rv2="new-coupon">+ Coupon</button>${rot ? `<button class="btn-secondary" data-rv2="assign-line">Composer la ligne</button>` : ''}</div>${body}`;
    }
    _lineFormationText(rot) {
        if (!rot)
            return '';
        const mgr = this.game.rotationV2, members = [...(rot.assignedFormation?.members || [])].sort((a, b) => a.order - b.order), out = [], seenCoupons = new Set();
        for (const m of members) {
            if (m.sourceCouponId) {
                if (seenCoupons.has(m.sourceCouponId))
                    continue;
                seenCoupons.add(m.sourceCouponId);
                out.push(mgr.getCoupon(m.sourceCouponId)?.name || 'Coupon');
                continue;
            }
            const v = mgr.getVehicle(m.vehicleId);
            if (!v)
                continue;
            out.push(`${v.number || v.name || '?'}${m.role === FormationRole.VEHICLE ? ' (CV)' : ''}`);
        }
        return out.join(' + ');
    }
    _renderLineFormation(rot) {
        const mgr = this.game.rotationV2, members = [...(rot.assignedFormation?.members || [])].sort((a, b) => a.order - b.order), items = [], seenCoupons = new Set();
        for (const m of members) {
            if (m.sourceCouponId) {
                if (seenCoupons.has(m.sourceCouponId))
                    continue;
                seenCoupons.add(m.sourceCouponId);
                const c = mgr.getCoupon(m.sourceCouponId), vs = (c?.vehicleIds || []).map((id) => mgr.getVehicle(id)).filter(Boolean), img = vs.find((v) => v.imageData)?.imageData || '';
                items.push(`<div class="rv4-assignment-el" draggable="true" data-drag-kind="coupon" data-drag-id="${htmlText(m.sourceCouponId)}">${img ? `<img src="${htmlText(img)}">` : ''}<div><b>${esc(c?.name || 'Coupon')}</b><br><small>${vs.length} véhicule(s) • coupon</small></div><button class="btn-secondary rv3-mini" data-rv2="remove-line-material" data-kind="coupon" data-id="${htmlText(m.sourceCouponId)}" title="Retirer">×</button></div>`);
                continue;
            }
            const v = mgr.getVehicle(m.vehicleId);
            if (!v)
                continue;
            items.push(`<div class="rv4-assignment-el" draggable="true" data-drag-kind="vehicle" data-drag-id="${htmlText(v.id)}">${v.imageData ? `<img src="${htmlText(v.imageData)}">` : ''}<div><b>${esc(v.number || v.name || '?')}</b><br><small>${esc(roleLabel(m.role))}${m.role === FormationRole.VEHICLE ? ' • <span class="rv4-chip-cv">CV</span>' : ''}</small></div><button class="btn-secondary rv3-mini" data-rv2="remove-line-material" data-kind="vehicle" data-id="${htmlText(v.id)}" title="Retirer">×</button></div>`);
        }
        const inherited = rot.occurrences.filter((o) => o.usesAssignedFormation !== false).length, exceptions = rot.occurrences.length - inherited;
        return `<div class="rv4-line-assignment" data-line-assignment="${htmlText(rot.id)}"><div class="rv4-assignment-head"><b>Formation affectée à la ligne</b><span>${esc(this._lineFormationText(rot) || 'Aucune')}</span><span class="rv3-spacer"></span><small>${inherited} service(s) standard${exceptions ? ` • ${exceptions} exception(s)` : ''}</small><button class="btn-secondary rv3-mini" data-rv2="assign-line">Composer / modifier</button><button class="btn-secondary rv3-mini" data-rv2="apply-line-all">Réappliquer à tous</button><button class="btn-secondary rv3-mini" data-rv2="clear-line">Vider</button></div><div class="rv4-assignment-strip">${items.join('') || '<div class="rv4-assignment-empty"><b>Glissez ici :</b> BB22201 + Coupon 301, une automotrice, une UM…<br>L’horaire reste séparé : cette formation est celle de la <b>ligne de roulement</b>.</div>'}</div></div>`;
    }
    _renderAllLines(metrics = null) {
        const mgr = this.game.rotationV2, m = metrics || this._fleetMetrics(), q = String(this.rotationSearchQuery || '').trim().toLowerCase(), filter = this.rotationStatusFilter || 'all';
        const byId = new Map(m.states.map((x) => [x.r.id, x.state]));
        const searchable = (r) => { const services = (r.occurrences || []).map((o) => { const x = this._occMeta(o); return `${x.rec?.number || ''} ${x.rec?.name || ''} ${x.from?.name || ''} ${x.to?.name || ''}`; }).join(' '); return `${r.name} ${this._lineFormationText(r)} ${services}`.toLowerCase(); };
        const rots = (m.rots || []).filter((r) => !q || searchable(r).includes(q)).filter((r) => { const k = byId.get(r.id)?.key || 'bad'; if (filter === 'all')
            return true; if (filter === 'problem')
            return k === 'bad' || k === 'warn'; return k === filter; });
        if (!(m.rots || []).length)
            return '<div class="rv3-empty"><b>Aucune ligne de roulement.</b><br><br>Commencez par créer une ligne, ajoutez ses horaires puis affectez sa formation physique.</div>';
        const cards = rots.map((r, i) => { const st = byId.get(r.id) || this._rotationUiState(r, m.allConflicts), next = this._rotationNextService(r), calc = r.assignedFormation?.calculate?.(mgr) || {}, first = [...(st.issues || []), ...(st.runtime || [])].find((x) => String(x.level || '').toUpperCase() === 'ERROR') || st.conflicts?.[0] || st.issues?.[0] || st.runtime?.[0], selected = r.id === this.selectedRotationId; return `<div class="rv61-linecard ${htmlText(selected ? 'selected' : '')}" data-rv2="select-line" data-rotation="${htmlText(r.id)}"><div class="main"><b>R${String((m.rots || []).indexOf(r) + 1).padStart(2, '0')} · ${esc(r.name)}</b><div class="formation"><small>${esc(this._lineFormationText(r) || 'AUCUNE FORMATION')}</small></div><div class="next">${next ? `Prochain : <b>${formatScheduleClock(next.start)}</b> · ${esc(next.meta?.rec?.number || '?')} · ${esc(next.meta?.from?.name || '?')} → ${esc(next.meta?.to?.name || '?')}` : 'Aucun service planifié'}</div></div><div><span class="rv61-status ${htmlText(st.key)}">${st.key === 'ok' ? '✓' : st.key === 'warn' ? '⚠' : st.key === 'inactive' ? '⏸' : '⛔'} ${esc(st.label)}</span><div class="issues">${first ? esc(first.message || first.status || 'Conflit matériel') : 'Aucune anomalie'}</div></div><div class="metric"><span>Services</span><b>${r.occurrences?.length || 0}</b></div><div class="metric"><span>Distance</span><b>${Math.round(this._rotationDistance(r))} km</b></div><div class="metric hide-mid"><span>Formation</span><b>${Math.round(calc.lengthM || 0)} m · ${Math.round((calc.massKg || 0) / 1000)} t</b></div><div class="metric"><span>Actions</span><b>${r.actions?.length || 0} opération(s)</b></div></div>`; }).join('');
        if (!rots.length)
            return `<div class="rv3-mainhead"><b>Vue générale des roulements</b><span class="rv3-spacer"></span><small>Aucune ligne ne correspond aux filtres.</small></div><div class="rv3-empty">Aucun résultat. Modifiez la recherche ou le filtre de statut.</div>`;
        for (const r of rots)
            mgr.recalculateRotation(r.id);
        const occs = rots.flatMap((r) => (r.occurrences || []).map((o) => ({ r, o }))).filter((x) => Number.isFinite(Number(x.o.resolvedStartSec)) && Number.isFinite(Number(x.o.resolvedEndSec)));
        let min = occs.length ? Math.min(...occs.map((x) => Number(x.o.resolvedStartSec))) : 0, max = occs.length ? Math.max(...occs.map((x) => Number(x.o.resolvedEndSec))) : 86400;
        if (max - min < 12 * 3600)
            max = min + 12 * 3600;
        const span = Math.max(1, max - min), width = Math.max(1300, Math.min(9000, span / 30)), px = width / span, step = span > 86400 ? 21600 : 3600, ticks = [];
        for (let t = Math.floor(min / step) * step; t <= max; t += step)
            ticks.push(t);
        const axis = `<div class="rv4-fleet-axis" style="width:${htmlText(width)}px">${ticks.map((t) => `<span style="left:${htmlText((t - min) * px)}px">${formatScheduleClock(t)}</span>`).join('')}</div>`;
        const rows = rots.map((r) => { const st = byId.get(r.id) || this._rotationUiState(r, m.allConflicts), services = (r.occurrences || []).map((o) => { const meta = this._occMeta(o), left = (Number(o.resolvedStartSec || 0) - min) * px, w = Math.max(48, (Number(o.resolvedEndSec || 0) - Number(o.resolvedStartSec || 0)) * px), from = this._stationCode(meta.from), to = this._stationCode(meta.to); return `<div class="rv4-fleet-service ${htmlText(st.key === 'bad' ? 'cancel' : st.key === 'warn' ? 'warn' : '')}" data-rv2="select-occ-rotation" data-rotation="${htmlText(r.id)}" data-occ="${htmlText(o.id)}" style="left:${htmlText(left)}px;width:${htmlText(w)}px" title="${esc(meta.rec?.number || '?')} • ${esc(meta.from?.name || '?')} → ${esc(meta.to?.name || '?')}"><b>${esc(meta.rec?.number || '?')}</b><div class="rv4-fleet-ends"><span>${formatScheduleClock(o.resolvedStartSec || 0)} ${esc(from)}</span><span>${esc(to)} ${formatScheduleClock(o.resolvedEndSec || 0)}</span></div></div>`; }).join(''); return `<div class="rv4-fleet-row"><div class="rv4-fleet-label" data-rv2="select-line" data-rotation="${htmlText(r.id)}"><b>${esc(r.name)}</b> <span class="rv61-status ${htmlText(st.key)}">${st.key === 'ok' ? '✓' : st.key === 'warn' ? '⚠' : st.key === 'inactive' ? '⏸' : '⛔'}</span><br><small>${esc(this._lineFormationText(r) || 'SANS MATÉRIEL')} • ${r.occurrences.length} service(s)</small></div><div class="rv4-fleet-track" style="width:${htmlText(width)}px">${services}</div></div>`; }).join('');
        return `<div class="rv3-mainhead"><b>Vue générale — Toutes les lignes — journée d’exploitation</b><span>${rots.length}/${m.rots.length} ligne(s) affichée(s) • ${occs.length} service(s)</span><span class="rv3-spacer"></span><small>Cliquez une ligne ou un train pour ouvrir sa feuille détaillée.</small></div><div class="rv61-service-list" style="flex:none;max-height:38vh">${cards}</div><div class="rv3-mainhead"><b>Chronologie compagnie</b><span class="rv3-spacer"></span><small>Les trains simultanés apparaissent réellement en parallèle.</small></div><div class="rv4-fleet">${axis}${rows}</div>`;
    }
    _renderFleetInspector(metrics = null) {
        const m = metrics || this._fleetMetrics(), runtimeAlerts = this.game.scheduleV2Runtime?.alerts || [], errors = runtimeAlerts.filter((a) => String(a.level || '').toUpperCase() === 'ERROR'), warnings = runtimeAlerts.filter((a) => String(a.level || '').toUpperCase() !== 'ERROR'), mgr = this.game.rotationV2, advanced = m.advanced, directIds = new Set((advanced ? [] : (mgr.directAssignments || []).filter((a) => a.enabled !== false && !mgr.directAssignmentSuppressed?.(a))).map((a) => a.scheduleId)), outside = (this.game.scheduleV2.schedules || []).filter((s) => s.currentVersion?.state === ScheduleState.VALID && !(mgr.findScheduleReferences?.(s.id) || []).length && (advanced || !directIds.has(s.id))).slice(0, 8);
        const workflow = advanced ? `1. Créer/valider l'<b>horaire</b>.<br>2. L'ajouter à une <b>ligne de roulement</b>.<br>3. Affecter la <b>formation physique</b>.<br>4. Ajouter seulement les opérations nécessaires.<br>5. Corriger les voyants rouges avant exploitation.` : `1. Créer une <b>rame</b>.<br>2. Créer/valider l'<b>horaire</b>.<br>3. Depuis Horaires, cliquer <b>Affecter rame</b>.<br>4. Le train peut circuler. Le roulement n'est nécessaire que si vous voulez un enchaînement détaillé.`;
        const outsideTitle = advanced ? 'Horaires hors roulement' : 'Horaires sans matériel';
        const outsideText = advanced ? `${m.outsideSchedules} horaire(s) valide(s) ne créent actuellement aucune circulation physique.` : `${m.outsideSchedules} horaire(s) valide(s) n'ont ni roulement ni rame directe. Les ${m.simpleAssignments || 0} affectation(s) directe(s) actives circulent normalement sans roulement.`;
        return `<div class="rv3-section"><h3>Contrôle exploitation</h3><div class="${htmlText(advanced ? 'rv4-mandatory' : 'rv61-goodbox')}"><b>${advanced ? 'Mode avancé' : 'Mode simplifié'}</b><br>${advanced ? 'Les roulements sont contraignants.' : 'Les roulements sont facultatifs ; une rame directe suffit.'}</div><p><b>${m.activeLines}</b> ligne(s) active(s) · <b>${m.totalServices}</b> service(s) en roulement · <b>${m.live}</b> train(s) V2 actif(s).</p></div>${errors.length || warnings.length ? `<div class="rv3-section"><h3>Alertes runtime</h3>${errors.slice(0, 5).map((a) => `<div class="rv3-issue"><b>${esc(a.code || 'Erreur')}</b><br>${esc(a.message || '')}</div>`).join('')}${warnings.slice(0, 5).map((a) => `<div class="rv3-warning"><b>${esc(a.code || 'Alerte')}</b><br>${esc(a.message || '')}</div>`).join('')}</div>` : '<div class="rv61-goodbox">✓ Aucun problème runtime actuellement signalé.</div>'}<div class="rv3-section"><h3>${htmlText(outsideTitle)}</h3><p><b>${outsideText}</b></p>${outside.map((s) => { const v = s.currentVersion; return `<div class="rv3-card"><b>${esc(s.number || '?')}</b> ${esc(s.name || '')}<br><small>${formatScheduleClock(v.firstDepartureSec || 0)} · ${esc(v.locations?.[0]?.name || '?')} → ${esc(v.locations?.at(-1)?.name || '?')}</small></div>`; }).join('') || '<small>Aucun horaire non affecté.</small>'}</div><div class="rv3-section"><h3>Workflow</h3><div class="${htmlText(advanced ? 'rv4-mandatory' : 'rv61-goodbox')}">${workflow}</div></div>`;
    }
    _dropMaterialOnLine(kind, id) {
        const r = this.game.rotationV2.getRotation(this.selectedRotationId), mgr = this.game.rotationV2;
        if (!r)
            return;
        this._commit(() => { if (kind === 'vehicle')
            mgr.addAssignedVehicle(r.id, id);
        else if (kind === 'coupon')
            mgr.addAssignedCoupon(r.id, id);
        else if (kind === 'rame') {
            const rame = this.game.rameManager?.getById?.(id);
            if (!rame)
                throw new Error('Rame introuvable.');
            mgr.addAssignedRame(r.id, rame);
        }
        else
            throw new Error('Type de matériel invalide.'); const bad = mgr.validateMaterialConflicts().filter((c) => c.first?.rotationId === r.id || c.second?.rotationId === r.id); if (bad.length)
            throw new Error('Conflit matériel : formation déjà engagée ou continuité géographique impossible. Prévoir un HLP/CV si le matériel doit changer de ligne.'); });
    }
    _removeLineMaterial(kind, id) {
        const r = this.game.rotationV2.getRotation(this.selectedRotationId), mgr = this.game.rotationV2;
        if (!r)
            return;
        this._commit(() => { if (kind === 'coupon') {
            const c = mgr.getCoupon(id);
            const spec = new ActiveFormationSpec(r.assignedFormation?.toJSON?.() || {});
            spec.members = spec.members.filter((m) => !c?.vehicleIds?.includes(m.vehicleId) && m.sourceCouponId !== id);
            mgr.setAssignedFormation(r.id, spec, { rameId: '' });
        }
        else
            mgr.removeAssignedVehicle(r.id, id); });
    }
    _assignLineDialog() {
        const rot = this.game.rotationV2.getRotation(this.selectedRotationId), mgr = this.game.rotationV2;
        if (!rot)
            return;
        const current = new Map((rot.assignedFormation?.members || []).map((m) => [m.vehicleId, m]));
        const couponPart = mgr.coupons.length ? `<div class="sv2-field"><label>Coupons</label>${mgr.coupons.map((c) => `<label style="display:block"><input type="checkbox" data-line-coupon="${htmlText(c.id)}" ${c.vehicleIds.every((id) => current.has(String(id))) ? 'checked' : ''}> ${esc(c.name)} — ${c.vehicleIds.length} véhicules</label>`).join('')}</div>` : '';
        const rows = mgr.vehicles.map((v) => { const cur = current.get(v.id), powered = mgr._poweredVehicle?.(v), defaultRole = cur?.role || (powered ? FormationRole.ACTIVE_MULTIPLE : roleForVehicle(v)); return `<div data-line-row="${htmlText(v.id)}" data-text="${esc(`${v.number} ${v.name} ${v.category}`.toLowerCase())}" style="display:grid;grid-template-columns:24px 1fr 145px 70px;gap:5px;align-items:center;padding:4px;border-bottom:1px solid #24364a"><input type="checkbox" data-line-veh="${htmlText(v.id)}" ${cur && !cur.sourceCouponId ? 'checked' : ''}><span>${esc(v.number)} — ${esc(v.name)}</span><select data-line-role="${htmlText(v.id)}">${Object.values(FormationRole).map((role) => `<option value="${htmlText(role)}" ${defaultRole === role ? 'selected' : ''}>${htmlText(roleLabel(role))}</option>`).join('')}</select><label style="font-size:10px"><input type="checkbox" data-line-cv="${htmlText(v.id)}" ${cur?.role === FormationRole.VEHICLE ? 'checked' : ''}> CV</label></div>`; }).join('');
        const body = `<div class="rv2-rame-help"><b>Formation de la ligne de roulement</b><br>Exemple : <b>BB22201 + Coupon 301</b>. Tous les horaires de la ligne utilisent cette formation par défaut. Une coupe, un changement de loc, une UM ou une composition particulière devient ensuite une exception.</div><input id="rv4-line-filter" placeholder="Rechercher matériel…" style="width:100%;margin-bottom:7px">${couponPart}<div id="rv4-line-list">${rows}</div><label style="display:block;margin-top:8px"><input type="checkbox" id="rv4-force-all"> Réappliquer aussi aux services déjà personnalisés</label>`;
        const m = this._modal(`Composer ${rot.name}`, body, '<button class="btn-primary" id="rv4-line-ok">Affecter à la ligne</button>'), filter = m.querySelector('#rv4-line-filter');
        filter.oninput = () => { const q = filter.value.trim().toLowerCase(); m.querySelectorAll('[data-line-row]').forEach((row) => row.style.display = !q || row.dataset.text.includes(q) ? 'grid' : 'none'); };
        m.querySelectorAll('[data-line-cv]').forEach((cb) => cb.onchange = () => { const sel = m.querySelector(`[data-line-role="${cb.dataset.lineCv}"]`); if (cb.checked && sel)
            sel.value = FormationRole.VEHICLE; });
        m.querySelectorAll('[data-line-role]').forEach((sel) => sel.onchange = () => { const cb = m.querySelector(`[data-line-cv="${sel.dataset.lineRole}"]`); if (cb)
            cb.checked = sel.value === FormationRole.VEHICLE; });
        m.querySelector('#rv4-line-ok').onclick = () => { const members = [], seen = new Set(); for (const x of m.querySelectorAll('[data-line-veh]:checked')) {
            const id = x.dataset.lineVeh, cv = m.querySelector(`[data-line-cv="${id}"]`)?.checked, role = cv ? FormationRole.VEHICLE : m.querySelector(`[data-line-role="${id}"]`)?.value || roleForVehicle(mgr.getVehicle(id));
            if (seen.has(id))
                continue;
            seen.add(id);
            members.push(new FormationMember({ vehicleId: id, role, order: members.length }));
        } for (const cbox of m.querySelectorAll('[data-line-coupon]:checked')) {
            const c = mgr.getCoupon(cbox.dataset.lineCoupon);
            for (const cm of mgr.expandCoupon(c.id)) {
                if (seen.has(cm.vehicleId))
                    continue;
                seen.add(cm.vehicleId);
                const v = mgr.getVehicle(cm.vehicleId);
                cm.role = String(v?.category || '').toLowerCase().includes('wagon') ? FormationRole.WAGON : FormationRole.COACH;
                cm.order = members.length;
                members.push(cm);
            }
        } if (!members.some((mm) => [FormationRole.LEAD, FormationRole.ACTIVE_MULTIPLE, FormationRole.PUSHER].includes(mm.role))) {
            const first = members.find((mm) => mm.role !== FormationRole.VEHICLE && mgr._poweredVehicle?.(mgr.getVehicle(mm.vehicleId)));
            if (first)
                first.role = FormationRole.LEAD;
        }
        else if (!members.some((mm) => mm.role === FormationRole.LEAD)) {
            const first = members.find((mm) => mm.role === FormationRole.ACTIVE_MULTIPLE);
            if (first)
                first.role = FormationRole.LEAD;
        } const force = m.querySelector('#rv4-force-all').checked; const snapshot = this._snapshot(); this._pushHistory(); try {
            mgr.setAssignedFormation(rot.id, { members }, { applyAll: force });
            const bad = mgr.validateMaterialConflicts().filter((c) => c.first?.rotationId === rot.id || c.second?.rotationId === rot.id);
            if (bad.length)
                throw new Error('Conflit matériel : engin déjà engagé ou pas au bon lieu entre deux lignes. Prévoir un HLP/CV si nécessaire.');
            m.remove();
            this._syncRuntimeNow();
            this.game.saveState();
            this.render();
        }
        catch (err) {
            mgr.loadFromSave(snapshot);
            this._history.pop();
            alert(err.message);
            this.render();
        } };
    }
    _renderMain(rot) { if (this.activeView === 'material')
        return this._renderMaterialView(rot); if (this.activeView === 'sheet')
        return this._renderTimeline(rot, true); if (this.activeView === 'table')
        return this._renderTable(rot); return this._renderTimeline(rot, false); }
    _timeBounds(rot, intervals = null) { const mgr = this.game.rotationV2; mgr.recalculateRotation(rot.id); const slots = intervals || rot.occurrences.flatMap((o) => { const v = this.game.scheduleV2.getVersion(o.scheduleId, o.versionId); return v ? mgr.materialIntervals(rot.id, o.id, null, o.resolvedStartSec) : []; }); const starts = slots.map((x) => Number(x.startSec)).filter(Number.isFinite), ends = slots.map((x) => Number(x.endSec)).filter(Number.isFinite); if (!starts.length) {
        const os = rot.occurrences.map((o) => Number(o.resolvedStartSec)).filter(Number.isFinite), oe = rot.occurrences.map((o) => Number(o.resolvedEndSec)).filter(Number.isFinite);
        if (!os.length)
            return [0, 86400];
        starts.push(...os);
        ends.push(...oe);
    } let min = Math.min(...starts), max = Math.max(...ends); if (max - min < 21600)
        max = min + 21600; return [min, max]; }
    _renderTimeline(rot, realSheet = false) {
        if (realSheet)
            return this._renderDutySheet(rot);
        const mgr = this.game.rotationV2, data = this._timelineSegments(rot), intervalRows = data.segments, rows = data.entities;
        const [min, max] = this._timeBounds(rot, intervalRows), span = Math.max(1, max - min), width = Math.max(1200, Math.min(9000, span / 36)), px = width / span;
        const ticks = [], step = span > 7 * 86400 ? 86400 : span > 3 * 86400 ? 43200 : span > 86400 ? 21600 : span > 43200 ? 10800 : 3600;
        for (let t = Math.floor(min / step) * step; t <= max; t += step)
            ticks.push(t);
        const axis = `<div class="rv3-axis" style="width:${htmlText(width)}px">${ticks.map((t) => `<span style="left:${htmlText((t - min) * px)}px">${formatScheduleClock(t)}</span>`).join('')}</div>`;
        const blockHtml = rows.map((row) => {
            const blocks = row.segments.map((iv) => { const o = rot.occurrences.find((x) => x.id === iv.occurrenceId); if (!o)
                return ''; const m = this._occMeta(o), left = (Number(iv.startSec) - min) * px, w = Math.max(30, (Number(iv.endSec) - Number(iv.startSec)) * px), warn = (o?.warnings || []).some((x) => x.level === 'WARNING'), arrow = o?.reversed ? '◀' : '▶', fromLoc = this._locationForPhysicalId(m.ver, String(iv.startLocationId || ''), m.from), toLoc = this._locationForPhysicalId(m.ver, String(iv.endLocationId || ''), m.to), fromCode = this._stationCode(fromLoc), toCode = this._stationCode(toLoc), lead = this._leadingInfo(o); return `<div class="rv3-block ${htmlText(warn ? 'warn' : '')} ${htmlText(o?.cancelled ? 'cancel' : '')} ${htmlText(o?.id === this.selectedOccurrenceId ? 'selected' : '')}" draggable="false" data-rv2="select-occ" data-occ="${htmlText(o?.id || '')}" style="left:${htmlText(left)}px;width:${htmlText(w)}px" title="${esc(row.kind === 'coupon' ? row.coupon?.name : row.vehicle?.number)} • ${esc(m.rec?.number || '?')} • ${htmlText(formatScheduleClock(iv.startSec))} → ${htmlText(formatScheduleClock(iv.endSec))} • ${esc(fromLoc?.name || '?')} → ${esc(toLoc?.name || '?')} • ${esc(lead.label)}"><span class="rv3-blocknum"><b>${realSheet ? '' : arrow + ' '}${esc(m.rec?.number || '?')}</b></span><span class="rv3-real-leadline ${htmlText(lead.type)}" title="${esc(lead.label)}"></span><span class="rv3-real-trackline"></span><span class="rv3-blockends"><span>${formatScheduleClock(iv.startSec)} ${esc(fromCode)}</span><span>${esc(toCode)} ${formatScheduleClock(iv.endSec)}</span></span></div>`; }).join('');
            const km = row.segments.reduce((sum, iv) => { const o = rot.occurrences.find((x) => x.id === iv.occurrenceId); return sum + this._intervalDistanceKm({ ...iv, occ: o }); }, 0);
            if (row.kind === 'coupon') {
                const c = row.coupon;
                return `<div class="rv3-row"><div class="rv3-row-label rv3-coupon-label" draggable="true" data-drag-kind="coupon" data-drag-id="${htmlText(c?.id || '')}" data-rv2="select-coupon" data-coupon="${htmlText(c?.id || '')}"><b>${esc(c?.name || 'Coupon')}</b><br><small>${c?.vehicleIds?.length || 0} véhicule(s) • coupon uni • ${Math.round(km)} km</small></div><div class="rv3-track" style="width:${htmlText(width)}px">${blocks}</div></div>`;
            }
            const v = row.vehicle;
            return `<div class="rv3-row"><div class="rv3-row-label" draggable="true" data-drag-kind="vehicle" data-drag-id="${htmlText(v?.id || '')}" data-rv2="select-material" data-vehicle="${htmlText(v?.id || '')}"><b>${esc(v?.number || '?')}</b><br><small>${Math.round(km)} km roulement • odo ${Math.round(v?.odometerKm || 0)} km</small></div><div class="rv3-track" style="width:${htmlText(width)}px">${blocks}</div></div>`;
        }).join('');
        const selected = rot.occurrences.find((o) => o.id === this.selectedOccurrenceId), selMeta = selected ? this._occMeta(selected) : null;
        let opbar = '';
        if (selected && selMeta?.ver) {
            const marks = (selMeta.ver.locations || []).map((loc) => { const raw = loc.arrivalSec ?? loc.departureSec ?? selMeta.ver.firstDepartureSec, t = Number(selected.resolvedStartSec || 0) + (Number(raw || 0) - Number(selMeta.ver.firstDepartureSec || 0)); if (t < min || t > max)
                return ''; const code = this._stationCode(loc); return `<span class="rv3-stopmark" style="left:${htmlText((t - min) * px)}px"><button class="btn-secondary" data-rv2="action-at" data-occ="${htmlText(selected.id)}" data-loc="${htmlText(loc.id)}" title="Ajouter une opération à ${esc(loc.name)}">⊕</button><button class="rv3-codebtn" data-rv2="edit-station-code" data-occ="${htmlText(selected.id)}" data-loc="${htmlText(loc.id)}" title="Modifier le code roulement de ${esc(loc.name)}">${esc(code)}</button></span>`; }).join('');
            opbar = `<div class="rv3-opbar" style="width:${htmlText(width)}px">${marks}</div>`;
        }
        const actionMarks = [];
        for (const a of rot.actions) {
            const o = rot.occurrences.find((x) => x.id === a.occurrenceId), ver = o && this.game.scheduleV2.getVersion(o.scheduleId, o.versionId);
            if (!o || !ver)
                continue;
            const loc = ver.locations.find((l) => l.id === a.locationOccurrenceId);
            if (!loc)
                continue;
            const t = o.resolvedStartSec + ((loc.arrivalSec ?? loc.departureSec ?? ver.firstDepartureSec) - ver.firstDepartureSec), targets = new Set([...(a.vehicleIds || []), ...(a.couponIds || []).flatMap((cid) => mgr.getCoupon(cid)?.vehicleIds || [])]), indices = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (row.segments.some((seg) => seg.startSec <= t && seg.endSec >= t && seg.vehicleIds.some((id) => targets.has(id))))
                    indices.push(i);
            }
            if (!indices.length)
                continue;
            const lo = Math.min(...indices), hi = Math.max(...indices), left = 180 + (t - min) * px, top = 62 + lo * 58 + 5, height = Math.max(45, (hi - lo) * 58 + 45);
            actionMarks.push(`<div class="rv3-actionmark" style="left:${htmlText(left)}px;top:${htmlText(top)}px;height:${htmlText(height)}px"><span>${esc(actionDisplay(a))}</span></div>`);
        }
        return `<div class="rv3-mainhead"><b>${realSheet ? 'Diagramme réel — ' : ''}${esc(rot.name)}</b><span>${formatScheduleClock(min)} → ${formatScheduleClock(max)} • ${fmtDuration(max - min)}</span><span class="rv3-spacer"></span><span style="font-size:9px;color:${htmlText(realSheet ? '#333' : '#9ec6ee')}">${realSheet ? 'Trait supérieur épais = locomotive/engin moteur · fin = voiture-pilote' : 'Glisser horaire / matériel / coupon sur le graphique'}</span><button class="btn-secondary rv3-mini" data-rv2="add-schedule">+ Horaire</button></div><div class="rv3-timeline ${htmlText(realSheet ? 'rv3-real-sheet' : '')}">${axis}${opbar}${blockHtml || '<div class="rv3-empty">Ajoutez des horaires et affectez du matériel. Les coupes/attaches seront dessinées à leur heure réelle.</div>'}${actionMarks.join('')}</div>`;
    }
    _sheetFormationLabel(occ) {
        const mgr = this.game.rotationV2, members = [...(occ?.formation?.members || [])].sort((a, b) => a.order - b.order), seenCoupons = new Set(), parts = [];
        for (const m of members) {
            if (m.sourceCouponId) {
                if (seenCoupons.has(m.sourceCouponId))
                    continue;
                seenCoupons.add(m.sourceCouponId);
                const c = mgr.getCoupon(m.sourceCouponId);
                parts.push(c?.name || 'Coupon');
                continue;
            }
            const v = mgr.getVehicle(m.vehicleId);
            if (v)
                parts.push(v.number || v.name || '?');
        }
        return parts.join(' + ') || 'Sans matériel';
    }
    _sheetActionTime(rot, a) { const o = rot.occurrences.find((x) => x.id === a.occurrenceId), ver = o && this.game.scheduleV2.getVersion(o.scheduleId, o.versionId); if (!o || !ver)
        return null; const loc = ver.locations.find((l) => l.id === a.locationOccurrenceId); if (!loc)
        return null; const raw = loc.arrivalSec ?? loc.departureSec ?? ver.firstDepartureSec; return Number(o.resolvedStartSec || 0) + (Number(raw || 0) - Number(ver.firstDepartureSec || 0)); }
    _sheetBounds(rot) {
        this.game.rotationV2.recalculateRotation(rot.id);
        const occs = (rot.occurrences || []).filter((o) => Number.isFinite(Number(o.resolvedStartSec)) && Number.isFinite(Number(o.resolvedEndSec))).sort((a, b) => Number(a.resolvedStartSec) - Number(b.resolvedStartSec));
        if (!occs.length)
            return [0, 3600];
        let min = Math.min(...occs.map((o) => Number(o.resolvedStartSec))), max = Math.max(...occs.map((o) => Number(o.resolvedEndSec)));
        for (const a of rot.actions || []) {
            const t = this._sheetActionTime(rot, a);
            if (t != null && Number.isFinite(t))
                max = Math.max(max, t + Math.max(0, Number(a.durationSec || 0)));
        }
        const rawSpan = Math.max(1, max - min), pad = Math.max(300, Math.min(1800, rawSpan * .06));
        min -= pad;
        max += pad;
        if (max - min < 3600) {
            const mid = (min + max) / 2;
            min = mid - 1800;
            max = mid + 1800;
        }
        return [Math.floor(min / 60) * 60, Math.ceil(max / 60) * 60];
    }
    _renderDutySheet(rot) {
        const mgr = this.game.rotationV2;
        mgr.recalculateRotation(rot.id);
        const occs = [...(rot.occurrences || [])].filter((o) => Number.isFinite(Number(o.resolvedStartSec)) && Number.isFinite(Number(o.resolvedEndSec))).sort((a, b) => Number(a.resolvedStartSec) - Number(b.resolvedStartSec));
        const [min, max] = this._sheetBounds(rot), span = Math.max(1, max - min), spanHours = Math.max(1 / 60, span / 3600);
        const zoomLevels = [180, 260, 360, 520, 720, 960, 1280];
        const minServiceSec = occs.length ? Math.max(60, Math.min(...occs.map((o) => Math.max(60, Number(o.resolvedEndSec) - Number(o.resolvedStartSec))))) : 3600;
        const readablePxHour = Math.max(260, Math.min(960, 150 * 3600 / minServiceSec));
        const autoZi = zoomLevels.reduce((best, v, i) => Math.abs(v - readablePxHour) < Math.abs(zoomLevels[best] - readablePxHour) ? i : best, 0), autoMode = Number(this.sheetZoomIndex) < 0, zi = autoMode ? autoZi : Math.max(0, Math.min(zoomLevels.length - 1, Number(this.sheetZoomIndex) || 0)), pxHour = zoomLevels[zi];
        const width = Math.max(900, Math.ceil(spanHours * pxHour)), px = width / span;
        const serviceTop = 54, leadY = 93, mainY = 112, timeY = 139, stationY = 164, gapY = 184, opsStartY = 214;
        const actions = (rot.actions || []).map((a) => ({ a, t: this._sheetActionTime(rot, a) })).filter((x) => Number.isFinite(x.t) && x.t >= min && x.t <= max).sort((a, b) => Number(a.t) - Number(b.t));
        const opRows = actions.length, svgH = Math.max(250, opsStartY + Math.max(0, opRows) * 24 + 22);
        const grid = [];
        const firstHour = Math.floor(min / 3600) * 3600;
        for (let t = firstHour; t <= max + 3600; t += 3600) {
            const x = (t - min) * px;
            if (x + pxHour < 0 || x > width + pxHour)
                continue;
            const idx = Math.floor(t / 3600);
            grid.push(`<rect class="${htmlText(idx % 2 ? 'rv6-hourband-b' : 'rv6-hourband-a')}" x="${htmlText(Math.max(0, x))}" y="0" width="${htmlText(Math.min(pxHour, width - Math.max(0, x)))}" height="${htmlText(svgH)}"/>`);
            if (x >= 0 && x <= width)
                grid.push(`<line class="rv6-grid-major" x1="${htmlText(x)}" y1="0" x2="${htmlText(x)}" y2="${htmlText(svgH)}"/><text class="rv6-axistext" x="${htmlText(x)}" y="24">${formatScheduleClock(t)}</text>`);
            if (pxHour >= 520) {
                for (const f of [900, 1800, 2700]) {
                    const xx = x + f / 3600 * pxHour;
                    if (xx > 0 && xx < width)
                        grid.push(`<line class="rv6-grid-minor" x1="${htmlText(xx)}" y1="34" x2="${htmlText(xx)}" y2="${htmlText(svgH)}"/>`);
                }
            }
        }
        const svcSvg = occs.map((o) => { const m = this._occMeta(o), start = Number(o.resolvedStartSec), end = Number(o.resolvedEndSec), x1 = (start - min) * px, x2 = (end - min) * px, w = Math.max(8, x2 - x1), cx = (x1 + x2) / 2, from = m.from, to = m.to, fromCode = this._stationCode(from), toCode = this._stationCode(to), lead = this._leadingInfo(o), material = this._sheetFormationLabel(o), warn = (o.warnings || []).some((x) => x.level === 'WARNING'), selected = o.id === this.selectedOccurrenceId; const hitY = 42, hitH = 146; return `<g class="rv6-service-hit rv5-service ${htmlText(selected ? 'selected' : '')}" data-rv2="select-occ" data-occ="${esc(o.id)}"><title>${esc(m.rec?.number || '?')} • ${esc(from?.name || '?')} → ${esc(to?.name || '?')} • ${formatScheduleClock(start)} → ${formatScheduleClock(end)} • ${esc(material)}</title><rect class="rv6-hitbox" x="${htmlText(x1)}" y="${htmlText(hitY)}" width="${htmlText(Math.max(24, w))}" height="${htmlText(hitH)}" rx="3"/><text class="rv6-trainnum" x="${htmlText(cx)}" y="${htmlText(serviceTop)}">${esc(m.rec?.number || '?')}</text><text class="rv6-material" x="${htmlText(cx)}" y="${htmlText(serviceTop + 18)}">${esc(lead.vehicle?.number || material)}</text><line class="rv6-leadline rv3-real-leadline ${htmlText(lead.type)}" x1="${htmlText(x1 + 3)}" y1="${htmlText(leadY)}" x2="${htmlText(x2 - 3)}" y2="${htmlText(leadY)}"/><line class="rv6-mainline" x1="${htmlText(x1 + 3)}" y1="${htmlText(mainY)}" x2="${htmlText(x2 - 3)}" y2="${htmlText(mainY)}"/><circle class="rv6-node" cx="${htmlText(x1)}" cy="${htmlText(mainY)}" r="5"/><circle class="rv6-node" cx="${htmlText(x2)}" cy="${htmlText(mainY)}" r="5"/><text class="rv6-time" x="${htmlText(x1)}" y="${htmlText(timeY)}" text-anchor="start">${formatScheduleClock(start)}</text><text class="rv6-time" x="${htmlText(x2)}" y="${htmlText(timeY)}" text-anchor="end">${formatScheduleClock(end)}</text><text class="rv6-station" x="${htmlText(x1 + 3)}" y="${htmlText(stationY)}" text-anchor="start" transform="rotate(-42 ${htmlText(x1 + 3)} ${htmlText(stationY)})">${esc(fromCode)}</text><text class="rv6-station" x="${htmlText(x2 - 3)}" y="${htmlText(stationY)}" text-anchor="end" transform="rotate(-42 ${htmlText(x2 - 3)} ${htmlText(stationY)})">${esc(toCode)}</text>${warn ? `<text x="${htmlText(cx)}" y="${htmlText(stationY + 17)}" text-anchor="middle" font-size="10" font-weight="900" fill="#a16207">⚠ À vérifier</text>` : ''}</g>`; }).join('');
        const gapSvg = [];
        for (let i = 0; i < occs.length - 1; i++) {
            const a = occs[i], b = occs[i + 1], s = Number(a.resolvedEndSec), e = Number(b.resolvedStartSec);
            if (!(e > s))
                continue;
            const x1 = (s - min) * px, x2 = (e - min) * px, acts = (rot.actions || []).filter((x) => x.occurrenceId === a.id), txt = acts.length ? `MANŒUVRE · ${acts.map(actionDisplay).join(' / ')}` : `ATTENTE ${Math.round((e - s) / 60)} min`;
            gapSvg.push(`<line class="rv6-gapline" x1="${htmlText(x1)}" y1="${htmlText(gapY)}" x2="${htmlText(x2)}" y2="${htmlText(gapY)}"/><line class="rv6-gapline" x1="${htmlText(x1)}" y1="${htmlText(gapY - 4)}" x2="${htmlText(x1)}" y2="${htmlText(gapY + 4)}"/><line class="rv6-gapline" x1="${htmlText(x2)}" y1="${htmlText(gapY - 4)}" x2="${htmlText(x2)}" y2="${htmlText(gapY + 4)}"/><text class="rv6-gaplabel" x="${htmlText((x1 + x2) / 2)}" y="${htmlText(gapY - 7)}">${esc(txt)}</text>`);
        }
        const opSvg = actions.map((x, i) => { const start = x.t, end = start + Math.max(300, Number(x.a.durationSec || 300)), x1 = (start - min) * px, x2 = Math.min(width, (end - min) * px), y = opsStartY + i * 24, locOcc = rot.occurrences.find((o) => o.id === x.a.occurrenceId), m = locOcc && this._occMeta(locOcc), loc = m?.ver?.locations?.find((l) => l.id === x.a.locationOccurrenceId), name = loc?.name ? ` @ ${this._stationCode(loc)}` : ''; return `<rect class="rv6-opbar" x="${htmlText(x1)}" y="${htmlText(y - 12)}" width="${htmlText(Math.max(8, x2 - x1))}" height="16" rx="2"/><text class="rv6-optext" x="${htmlText(x1 + 5)}" y="${htmlText(y)}">${esc(actionDisplay(x.a))}${esc(name)} · ${htmlText(Math.round(Number(x.a.durationSec || 0) / 60))} min</text>`; }).join('');
        const index = Math.max(0, (mgr.rotations || []).findIndex((r) => r.id === rot.id)), km = Math.round(this._rotationDistance(rot)), baseFormation = this._lineFormationText(rot) || this._sheetFormationLabel(occs[0]), rid = `R${String(index + 1).padStart(2, '0')}`;
        const label = `<div class="rv6-label"><div class="rid">${rid}</div><div class="rname">${esc(rot.name)}</div><div class="rmat">${esc(baseFormation)}</div><div class="rstats">${occs.length} train(s)<br>${km} km / jour<br>${actions.length} opération(s)</div><div class="hint">Le panneau reste fixe pendant le défilement horizontal. Le diagramme se déplace avec les barres de défilement.</div></div>`;
        const axisSvg = `<svg class="rv6-svg" width="${htmlText(width)}" height="44" viewBox="0 0 ${htmlText(width)} 44" aria-label="Échelle horaire">${grid.filter((x) => x.includes('axistext') || x.includes('grid-major') || x.includes('grid-minor')).join('')}</svg>`;
        const bodySvg = `<svg class="rv6-svg" width="${htmlText(width)}" height="${htmlText(svgH)}" viewBox="0 0 ${htmlText(width)} ${htmlText(svgH)}" aria-label="Diagramme du roulement ${esc(rot.name)}">${grid.filter((x) => x.includes('hourband') || x.includes('grid-major') || x.includes('grid-minor')).join('')}${gapSvg.join('')}${svcSvg}${opSvg}</svg>`;
        const zoomLabel = `${autoMode ? 'Auto • ' : ''}${pxHour} px/h`;
        return `<div class="rv5-sheet rv6-sheet rv3-real-sheet"><div class="rv6-toolbar"><b>Diagramme réel — ${esc(rot.name)}</b><small>${formatScheduleClock(min)} → ${formatScheduleClock(max)} • ${fmtDuration(max - min)}</small><span class="rv3-spacer"></span><button class="btn-secondary" data-rv2="sheet-zoom" data-delta="-1" ${zi <= 0 ? 'disabled' : ''}>−</button><b>${htmlText(zoomLabel)}</b><button class="btn-secondary" data-rv2="sheet-zoom" data-delta="1" ${zi >= zoomLevels.length - 1 ? 'disabled' : ''}>+</button><button class="btn-secondary" data-rv2="sheet-fit">Auto</button><button class="btn-secondary" data-rv2="add-schedule">+ Horaire</button></div><div class="rv6-paper-scroll"><div class="rv6-paper" style="min-width:${htmlText(230 + width)}px"><div class="rv6-corner"><b>Journée du roulement</b><small>${formatScheduleClock(min)} → ${formatScheduleClock(max)}</small></div><div class="rv6-axis-wrap">${axisSvg}</div>${htmlText(label)}<div class="rv6-svg-wrap">${bodySvg}</div><div class="rv6-caption"><b>Lecture :</b> le temps reste proportionnel. Numéro du train au-dessus, matériel juste dessous, heures et codes gare aux extrémités, barres noires alignées sur une ligne fixe. Les opérations ont chacune leur propre ligne sous les circulations afin qu’aucun libellé ne se chevauche. Les barres de défilement horizontale et verticale restent disponibles.</div></div></div></div>`;
    }
    _globalMaterialIntervals(vehicleId, date = this._selectedDateValue()) { const mgr = this.game.rotationV2, out = []; for (const r of mgr.rotations) {
        if (!this._rotationRunsOnDate(r, date))
            continue;
        mgr.recalculateRotation(r.id);
        for (const o of r.occurrences) {
            const ver = this.game.scheduleV2.getVersion(o.scheduleId, o.versionId);
            if (!this._versionRunsOnDate(ver, date))
                continue;
            for (const iv of mgr.materialIntervals(r.id, o.id, null, o.resolvedStartSec))
                if (iv.vehicleId === vehicleId)
                    out.push({ ...iv, rotation: r, occ: o });
        }
    } return out.sort((a, b) => a.startSec - b.startSec); }
    _globalRameIntervals(rameId, date = this._selectedDateValue()) {
        const mgr = this.game.rotationV2, vehicleIds = mgr.getRameVehicles(rameId).map((v) => v.id), out = [];
        if (vehicleIds.length) {
            for (const r of mgr.rotations) {
                if (!this._rotationRunsOnDate(r, date))
                    continue;
                mgr.recalculateRotation(r.id);
                for (const o of r.occurrences) {
                    const ver = this.game.scheduleV2.getVersion(o.scheduleId, o.versionId);
                    if (!this._versionRunsOnDate(ver, date))
                        continue;
                    const ivs = mgr.materialIntervals(r.id, o.id, null, o.resolvedStartSec), per = vehicleIds.map((id) => ivs.filter((x) => x.vehicleId === id));
                    if (per.some((x) => !x.length))
                        continue;
                    const chosen = per.map((x) => x[0]), startSec = Math.max(...chosen.map((x) => x.startSec)), endSec = Math.min(...chosen.map((x) => x.endSec));
                    if (endSec > startSec) {
                        const first = chosen[0], end = chosen.find((x) => x.endSec === endSec) || first;
                        out.push({ kind: 'rame', rameId, vehicleIds: [...vehicleIds], occurrenceId: o.id, startSec, endSec, startLocationId: first.startLocationId, endLocationId: end.endLocationId, role: 'RAME', rotation: r, occ: o });
                    }
                }
            }
        }
        return out.sort((a, b) => a.startSec - b.startSec);
    }
    _renderMaterialView(rot) {
        const mgr = this.game.rotationV2, date = this._selectedDateValue();
        if (!this.selectedMaterialId) {
            const first = rot.occurrences.flatMap((o) => o.formation.members).find(Boolean);
            this.selectedMaterialId = first ? `vehicle:${first.vehicleId}` : (mgr.vehicles[0] ? `vehicle:${mgr.vehicles[0].id}` : '');
        }
        const [mode, ...rest] = this.selectedMaterialId.split(':'), id = rest.join(':'), vehicleMode = mode === 'vehicle', couponMode = mode === 'coupon', rameMode = mode === 'rame', v = vehicleMode ? mgr.getVehicle(id) : null, coupon = couponMode ? mgr.getCoupon(id) : null, rame = rameMode ? this.game.rameManager?.getById?.(id) : null;
        if (!v && !coupon && !rame)
            return '<div class="rv3-empty">Sélectionnez un matériel, un coupon ou une rame dans la bibliothèque.</div>';
        const slots = (couponMode ? this._globalCouponIntervals(id, date) : rameMode ? this._globalRameIntervals(id, date) : this._globalMaterialIntervals(id, date)).sort((a, b) => a.startSec - b.startSec);
        const plannedKm = slots.reduce((sum, x) => sum + this._intervalDistanceKm(x), 0);
        const starts = slots.map((x) => x.startSec), ends = slots.map((x) => x.endSec);
        let min = starts.length ? Math.min(...starts) : 0, max = ends.length ? Math.max(...ends) : 86400;
        if (max - min < 21600)
            max = min + 21600;
        const span = Math.max(1, max - min), width = Math.max(1000, Math.min(8000, span / 36)), px = width / span;
        const step = span > 86400 ? 21600 : span > 43200 ? 10800 : 3600, ticks = [];
        for (let t = Math.floor(min / step) * step; t <= max; t += step)
            ticks.push(t);
        const blocks = slots.map((x) => { const m = this._occMeta(x.occ), left = (x.startSec - min) * px, w = Math.max(30, (x.endSec - x.startSec) * px), fromLoc = this._locationForPhysicalId(m.ver, x.startLocationId, m.from), toLoc = this._locationForPhysicalId(m.ver, x.endLocationId, m.to), lead = this._leadingInfo(x.occ); return `<div class="rv3-dutyblock" ${x.rotation._direct ? '' : `data-rv2="select-occ-rotation" data-occ="${x.occ.id}" data-rotation="${x.rotation.id}"`} style="left:${htmlText(left)}px;width:${htmlText(w)}px" title="${htmlText(formatScheduleClock(x.startSec))} ${esc(fromLoc?.name || '?')} → ${htmlText(formatScheduleClock(x.endSec))} ${esc(toLoc?.name || '?')} • ${esc(lead.label)}"><span class="rv3-blocknum"><b>${esc(m.rec?.number || '?')}</b></span><span class="rv3-real-leadline ${htmlText(lead.type)}" title="${esc(lead.label)}"></span><span class="rv3-real-trackline"></span><span class="rv3-blockends"><span>${formatScheduleClock(x.startSec)} ${esc(this._stationCode(fromLoc))}</span><span>${esc(this._stationCode(toLoc))} ${formatScheduleClock(x.endSec)}</span></span></div>`; }).join('');
        let circulationSec = 0, waitingSec = 0;
        for (let i = 0; i < slots.length; i++) {
            circulationSec += Math.max(0, slots[i].endSec - slots[i].startSec);
            if (i > 0)
                waitingSec += Math.max(0, slots[i].startSec - slots[i - 1].endSec);
        }
        const firstSlot = slots[0], lastSlot = slots.at(-1), firstMeta = firstSlot ? this._occMeta(firstSlot.occ) : null, lastMeta = lastSlot ? this._occMeta(lastSlot.occ) : null, firstLoc = firstSlot ? this._locationForPhysicalId(firstMeta?.ver, firstSlot.startLocationId, firstMeta?.from) : null, lastLoc = lastSlot ? this._locationForPhysicalId(lastMeta?.ver, lastSlot.endLocationId, lastMeta?.to) : null;
        let hero, labelTitle, labelSub;
        if (couponMode) {
            const imgs = (coupon?.vehicleIds || []).map((vid) => mgr.getVehicle(vid)).filter(Boolean);
            hero = `<div class="rv3-materialhero"><div class="rv3-coupon-hero">${imgs.map((x) => x.imageData ? `<img src="${htmlText(x.imageData)}"${x.flipped ? ' style="transform:scaleX(-1)"' : ''}>` : '').join('')}</div><div><h3 style="margin:0">${esc(coupon?.name || 'Coupon')}</h3><div>${coupon?.vehicleIds?.length || 0} véhicule(s)</div><div><b>${Math.round(plannedKm)} km le ${esc(date)}</b></div><small>La ligne reste groupée tant que toutes les voitures du coupon restent ensemble.</small></div></div>`;
            labelTitle = coupon?.name || 'Coupon';
            labelSub = `${coupon?.vehicleIds?.length || 0} véhicule(s)`;
        }
        else if (rameMode) {
            const details = rame?.elementDetails || [];
            hero = `<div class="rv3-materialhero"><div class="rv3-rame-hero">${details.map((x) => x.imageData ? `<img src="${htmlText(x.imageData)}"${x.flipped ? ' style="transform:scaleX(-1)"' : ''} title="${esc(x.instanceName || x.name || '')}">` : '').join('')}</div><div><h3 style="margin:0">${esc(rame?.name || rame?.serialNumber || 'Rame')}</h3><div>${esc(rame?.serialNumber || '')} • ${details.length} élément(s)</div><div><b>${Math.round(plannedKm)} km le ${esc(date)}</b></div><small>Une rame complète n’est dessinée que pendant les périodes où tous ses éléments restent physiquement ensemble. Les branches après coupe restent consultables véhicule/coupon par véhicule/coupon.</small></div></div>`;
            labelTitle = rame?.serialNumber || rame?.name || 'Rame';
            labelSub = `${details.length} élément(s)`;
        }
        else {
            hero = `<div class="rv3-materialhero">${v.imageData ? `<img src="${htmlText(v.imageData)}"${v.flipped ? ' style="transform:scaleX(-1)"' : ''}>` : ''}<div><h3 style="margin:0">${esc(v.number)} — ${esc(v.name)}</h3><div>${esc(v.category)} • V${v.maxSpeed} • ${Math.round(v.massKg / 1000)} t</div><div><b>${Math.round(plannedKm)} km le ${esc(date)}</b> • odomètre ${Math.round(v.odometerKm || 0)} km</div><small>Position : ${esc(v.location?.id || v.location?.kind || 'inconnue')}</small></div></div>`;
            labelTitle = v.number || v.name || '?';
            labelSub = `${esc(v.category)} • odo ${Math.round(v.odometerKm || 0)} km`;
        }
        const stats = `<div class="rv3-materialstats"><span><b>${slots.length}</b> service(s)</span><span><b>${Math.round(plannedKm)}</b> km ce jour</span><span><b>${fmtDuration(circulationSec)}</b> en circulation</span><span><b>${fmtDuration(waitingSec)}</b> d’attente</span><span>Début : <b>${esc(firstLoc?.name || '—')}</b> ${firstSlot ? formatScheduleClock(firstSlot.startSec) : ''}</span><span>Fin : <b>${esc(lastLoc?.name || '—')}</b> ${lastSlot ? formatScheduleClock(lastSlot.endSec) : ''}</span></div>`;
        const axis = `<div class="rv4-material-axis" style="width:${htmlText(width)}px">${ticks.map((t) => `<span style="left:${htmlText((t - min) * px)}px">${formatScheduleClock(t)}</span>`).join('')}</div>`;
        const sheet = `<div class="rv4-material-sheet"><div style="min-width:${htmlText(180 + width)}px">${axis}<div class="rv4-material-row"><div class="rv4-material-label"><b>${esc(labelTitle)}</b><br><small>${htmlText(labelSub)} • ${Math.round(plannedKm)} km/j</small></div><div class="rv4-material-track" style="width:${htmlText(width)}px">${blocks || '<span style="padding:20px;display:block">Aucun service applicable à cette date.</span>'}</div></div></div><div class="rv4-material-caption"><b>Même schéma graphique que le roulement :</b> numéro du train au-dessus, heures + codes gare aux extrémités ; trait supérieur <b>épais</b> = locomotive/engin moteur en tête, trait <b>fin</b> = voiture-pilote/réversibilité en tête.</div></div>`;
        const cards = slots.map((x) => { const m = this._occMeta(x.occ), fromLoc = this._locationForPhysicalId(m.ver, x.startLocationId, m.from), toLoc = this._locationForPhysicalId(m.ver, x.endLocationId, m.to); return `<div class="rv3-card" ${x.rotation._direct ? '' : `data-rv2="select-occ-rotation" data-occ="${x.occ.id}" data-rotation="${x.rotation.id}"`}><b>${formatScheduleClock(x.startSec)} → ${formatScheduleClock(x.endSec)} • ${esc(m.rec?.number || '?')}</b><br><small>${esc(this._stationCode(fromLoc))} ${esc(fromLoc?.name || '?')} → ${esc(this._stationCode(toLoc))} ${esc(toLoc?.name || '?')} • ${esc(x.rotation.name)}${htmlText(couponMode ? ' • Coupon' : rameMode ? ' • Rame complète' : ` • ${(roleLabel(x.role))}`)} • ${Math.round(this._intervalDistanceKm(x))} km</small></div>`; }).join('');
        const viewTitle = couponMode ? 'Journée coupon' : rameMode ? 'Journée rame complète' : 'Journée matériel';
        return `<div class="rv3-mainhead"><b>${htmlText(viewTitle)}</b><span>${esc(date)}</span><span class="rv3-spacer"></span>${slots.length} service(s) • ${Math.round(plannedKm)} km</div><div class="rv3-materialview">${hero}${stats}${sheet}${cards}</div>`;
    }
    _renderTable(rot) { const sorted = [...rot.occurrences].sort((a, b) => (a.resolvedStartSec ?? 0) - (b.resolvedStartSec ?? 0)), rows = sorted.map((o, i) => { const m = this._occMeta(o), acts = rot.actions.filter((a) => a.occurrenceId === o.id), next = sorted[i + 1], gap = next && Number.isFinite(Number(next.resolvedStartSec)) && Number.isFinite(Number(o.resolvedEndSec)) ? Math.max(0, Number(next.resolvedStartSec) - Number(o.resolvedEndSec)) : null, form = o.formation?.calculate?.(this.game.rotationV2) || {}, lead = this._leadingInfo(o), custom = o.usesAssignedFormation === false; return `<div class="rv61-service-row" data-rv2="select-occ" data-occ="${htmlText(o.id)}"><div class="train">${esc(m.rec?.number || '?')}<br><small>${formatScheduleClock(o.resolvedStartSec ?? m.ver?.firstDepartureSec ?? 0)}</small></div><div><b>${esc(m.rec?.name || '')}</b><br><small>${esc(lead.label)}</small></div><div class="route">${esc(m.from?.name || '?')} → ${esc(m.to?.name || '?')}<br><small>${esc(this._stationCode(m.from))} → ${esc(this._stationCode(m.to))}</small></div><div><b>${formatScheduleClock(o.resolvedEndSec ?? m.ver?.lastArrivalSec ?? 0)}</b><br><small>fin matériel</small></div><div><b>${Math.round(this._distanceKm(o))} km</b><br><small>${gap == null ? 'fin ligne' : `battement ${fmtDuration(gap)}`}</small></div><div><b>${Math.round(form.lengthM || 0)} m</b><br><small>${Math.round((form.massKg || 0) / 1000)} t · ${o.formation.members.length} élément(s)</small></div><div class="formation"><b>${acts.length} opération(s)</b>${custom ? ' · <span class="rv61-status warn">exception</span>' : ''}<br><small>${acts.length ? acts.map((a) => actionDisplay(a)).join(' · ') : 'formation standard de la ligne'}</small></div></div>`; }).join(''); return `<div class="rv3-mainhead"><b>Tableau du roulement</b><span>${sorted.length} service(s) dans l’ordre réel</span><span class="rv3-spacer"></span><button class="btn-secondary rv3-mini" data-rv2="add-schedule">+ Ajouter un horaire</button></div><div class="rv61-service-list"><div class="rv61-service-row header"><div>Train / départ</div><div>Service / conduite</div><div>Parcours</div><div>Fin</div><div>Distance / battement</div><div>Formation</div><div>Opérations</div></div>${rows || '<div class="rv3-empty">Aucun service dans cette ligne.</div>'}</div>`; }
    _renderInspector(rot, issues, conflicts) { if (!rot)
        return this.game.realismSettings?.rotationsRequired === true ? '<h3>Lignes de roulement</h3><p>Mode avancé : un roulement exploitable est obligatoire.</p>' : '<h3>Lignes de roulement</h3><p>Module facultatif : en mode simplifié, une rame peut être affectée directement à un horaire.</p>'; const o = rot.occurrences.find((x) => x.id === this.selectedOccurrenceId); if (!o)
        return this._renderOverviewInspector(rot, issues, conflicts); const m = this._occMeta(o), acts = rot.actions.filter((a) => a.occurrenceId === o.id); return `<div class="rv3-section"><h3>${esc(m.rec?.number || '?')} ${esc(m.rec?.name || '')}</h3><b>${esc(m.from?.name || '?')} → ${esc(m.to?.name || '?')}</b><br><small>${formatScheduleClock(o.resolvedStartSec ?? 0)} → ${formatScheduleClock(o.resolvedEndSec ?? 0)} • ${Math.round(this._distanceKm(o))} km • ${esc(this._leadingInfo(o).label)}</small><div class="rv3-toolbar-mini" style="margin-top:7px"><button class="btn-secondary" data-rv2="move-occ" data-occ="${htmlText(o.id)}" data-delta="-1">↑</button><button class="btn-secondary" data-rv2="move-occ" data-occ="${htmlText(o.id)}" data-delta="1">↓</button><button class="btn-secondary" data-rv2="reverse-occ" data-occ="${htmlText(o.id)}">${o.reversed ? '◀ Sens inversé' : '▶ Sens normal'}</button><button class="btn-secondary" data-rv2="assign" data-occ="${htmlText(o.id)}">Matériel</button><button class="btn-secondary" data-rv2="action" data-occ="${htmlText(o.id)}">+ Opération</button><button class="btn-secondary" data-rv2="remove-occ" data-occ="${htmlText(o.id)}">Retirer</button></div>${o.usesAssignedFormation === false ? '<div class="rv3-warning">Composition personnalisée : les modifications de la rame de base ne l’écraseront pas.</div>' : ''}</div><div class="rv3-section"><h3>Composition</h3>${o.formation.members.map((mm) => { const v = this.game.rotationV2.getVehicle(mm.vehicleId); return `<div class="rv3-material-line">${v?.imageData ? `<img src="${htmlText(v.imageData)}"${(o.reversed ? !v.flipped : v.flipped) ? ' style="transform:scaleX(-1)"' : ''}>` : ''}<div><b>${esc(v?.number || '?')}</b><br><small>${esc(v?.name || '')} • ${esc(roleLabel(mm.role))}${htmlText(mm.sourceCouponId ? ` • ${(this.game.rotationV2.getCoupon(mm.sourceCouponId)?.name || 'coupon')}` : '')}</small></div></div>`; }).join('') || '<small>Aucun matériel.</small>'}</div><div class="rv3-section"><h3>Opérations</h3>${acts.map((a) => { const loc = m.ver?.locations.find((l) => l.id === a.locationOccurrenceId); return `<div class="rv3-op"><div class="rv3-ophead"><b>${esc(actionDisplay(a))}</b><button class="btn-secondary rv3-mini" data-rv2="edit-action" data-occ="${htmlText(o.id)}" data-action="${htmlText(a.id)}">Éditer</button><button class="btn-secondary rv3-mini" data-rv2="remove-action" data-action="${htmlText(a.id)}">×</button></div><small>${esc(loc?.name || '?')} • ${Math.round(a.durationSec / 60)} min • ${a.forcedExecutionMode || 'Auto'}</small></div>`; }).join('') || '<small>Aucune opération.</small>'}</div>${this._renderOverviewInspector(rot, issues.filter((i) => !i.occurrenceId || i.occurrenceId === o.id), conflicts, true)}`; }
    _renderOverviewInspector(rot, issues, conflicts, compact = false) { const mgr = this.game.rotationV2; return `<div class="rv3-section"><h3>${compact ? 'Diagnostic' : 'Vue générale'}</h3>${!compact ? `<b>${esc(rot.name)}</b><br><small>${rot.occurrences.length} train(s) • ${rot.actions.length} opération(s) • ${Math.round(this._rotationDistance(rot))} km horaires</small>` : ''}${issues.map((i) => `<div class="${htmlText(i.level === 'ERROR' ? 'rv3-issue' : 'rv3-warning')}"><b>${esc(i.code)}</b><br>${esc(i.message)}</div>`).join('')}${conflicts.map((c) => { const v = mgr.getVehicle(c.vehicleId); const a = rot.occurrences.find((o) => o.id === c.first?.occurrenceId), b = rot.occurrences.find((o) => o.id === c.second?.occurrenceId), geo = c.code === 'MATERIAL_LOCATION_GAP_GLOBAL'; return `<div class="rv3-issue"><b>${geo ? 'Continuité' : 'Conflit'} ${esc(v?.number || c.rameId || c.vehicleId || 'matériel')}</b><br>${esc(c.message || `${this._occMeta(a).rec?.number || c.first?.occurrenceId || '?'} ↔ ${this._occMeta(b).rec?.number || c.second?.occurrenceId || '?'}`)}<br><small>${formatScheduleClock(c.second?.start || 0)} → ${formatScheduleClock(c.second?.end || 0)}</small></div>`; }).join('')}${!issues.length && !conflicts.length ? '<div class="rv3-ok">✓ Aucun conflit ou anomalie bloquante.</div>' : ''}</div>`; }
    _renderSummary(rot, issues, conflicts) { const used = new Set(); for (const o of rot.occurrences)
        for (const m of o.formation.members)
            used.add(String(m.vehicleId)); return `<div class="rv3-summary"><b>${esc(rot.name)}</b><span>${rot.occurrences.length} trains</span><span>${Math.round(this._rotationDistance(rot))} km horaires</span><span>${used.size} matériels</span><span>${rot.actions.length} opérations</span><span class="${htmlText(conflicts.length || issues.some((i) => i.level === 'ERROR') ? 'rv3-bad' : 'rv3-ok')}">${conflicts.length || issues.some((i) => i.level === 'ERROR') ? '⛔ À corriger' : '✓ Aucun conflit'}</span><span class="rv3-spacer"></span><span>${this.game.realismSettings?.rotationsRequired === true ? 'Horaire hors roulement = aucune circulation' : 'Mode simple : rame directe ou roulement'}</span></div>`; }
    _dragStart(e) { const el = e.target.closest?.('[data-drag-kind]'); if (!el)
        return; const payload = { kind: el.dataset.dragKind, id: el.dataset.dragId || '', offsetSec: Number(el.dataset.dragOffset || 0) }; this._dragPayload = payload; try {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/x-rail-empire', JSON.stringify(payload));
        e.dataTransfer.setData('text/plain', `RE:${payload.kind}:${payload.id}:${payload.offsetSec}`);
    }
    catch { } }
    _dragOver(e) { const target = e.target.closest?.('.rv3-block,.rv3-timeline,.rv3-main,.rv4-line-assignment'); if (!target)
        return; e.preventDefault(); try {
        e.dataTransfer.dropEffect = 'copy';
    }
    catch { } const b = e.target.closest?.('.rv3-block'); if (b)
        b.classList.add('drag-over'); const line = e.target.closest?.('.rv4-line-assignment'); if (line)
        line.classList.add('drop'); }
    _dragLeave(e) { const b = e.target.closest?.('.rv3-block'); if (b && !(e.relatedTarget instanceof Node && b.contains(e.relatedTarget)))
        b.classList.remove('drag-over'); const line = e.target.closest?.('.rv4-line-assignment'); if (line && !(e.relatedTarget instanceof Node && line.contains(e.relatedTarget)))
        line.classList.remove('drop'); }
    _readDragPayload(e) { let raw = ''; try {
        raw = e.dataTransfer?.getData('application/x-rail-empire') || '';
    }
    catch { } if (raw)
        try {
            return JSON.parse(raw);
        }
        catch { } return this._dragPayload || null; }
    _drop(e) { const payload = this._readDragPayload(e); if (!payload)
        return; e.preventDefault(); document.querySelectorAll('#page-rotations .rv3-block.drag-over').forEach((x) => x.classList.remove('drag-over')); document.querySelectorAll('#page-rotations .rv4-line-assignment.drop').forEach((x) => x.classList.remove('drop')); const line = e.target.closest?.('.rv4-line-assignment'), block = e.target.closest?.('.rv3-block'); if (line && ['vehicle', 'coupon', 'rame'].includes(payload.kind)) {
        this._dropMaterialOnLine(payload.kind, payload.id);
        return;
    } if (payload.kind === 'schedule') {
        this._addScheduleById(payload.id, Number(payload.offsetSec || 0));
        return;
    } if (!block?.dataset.occ) {
        alert('Glissez le matériel sur la formation de ligne, ou sur un train pour créer une exception de composition.');
        return;
    } if (payload.kind === 'vehicle' || payload.kind === 'coupon' || payload.kind === 'rame')
        this._dropMaterialOnOccurrence(block.dataset.occ, payload.kind, payload.id); }
    _dropMaterialOnOccurrence(occId, kind, id) { const r = this.game.rotationV2.getRotation(this.selectedRotationId), o = r?.occurrences.find((x) => x.id === occId), mgr = this.game.rotationV2; if (!r || !o)
        return; this._commit(() => { const existing = new Set(o.formation.members.map((m) => m.vehicleId)); const addVehicle = (vid, sourceCouponId = '') => { if (existing.has(vid))
        return; const v = mgr.getVehicle(vid); if (!v)
        return; let role; if (mgr._poweredVehicle?.(v)) {
        const active = o.formation.members.some((m) => [FormationRole.LEAD, FormationRole.ACTIVE_MULTIPLE, FormationRole.PUSHER].some((role) => role === m.role));
        role = active ? FormationRole.ACTIVE_MULTIPLE : FormationRole.LEAD;
    }
    else
        role = String(v.category || '').toLowerCase().includes('wagon') ? FormationRole.WAGON : FormationRole.COACH; o.formation.members.push(new FormationMember({ vehicleId: vid, role, order: o.formation.members.length, sourceCouponId })); existing.add(vid); }; if (kind === 'coupon') {
        const c = mgr.getCoupon(id);
        if (!c)
            throw new Error('Coupon introuvable.');
        for (const vid of c.vehicleIds)
            addVehicle(vid, c.id);
    }
    else if (kind === 'rame') {
        const rame = this.game.rameManager?.getById?.(id);
        if (!rame)
            throw new Error('Rame introuvable.');
        const formation = mgr.formationForRame(rame);
        for (const mm of formation.members) {
            if (existing.has(mm.vehicleId))
                continue;
            o.formation.members.push(new FormationMember({ ...mm.toJSON(), order: o.formation.members.length }));
            existing.add(mm.vehicleId);
        }
    }
    else
        addVehicle(id, ''); o.formation.normalize(); o.usesAssignedFormation = false; o.timingMismatchApproved = false; o.timingMismatchSignature = ''; mgr.recalculateRotation(r.id); const bad = mgr.validateMaterialConflicts().filter((c) => c.first?.occurrenceId === o.id || c.second?.occurrenceId === o.id); if (bad.length)
        throw new Error('Conflit matériel : engin/coupon déjà engagé ou continuité géographique impossible avec sa circulation précédente.'); this.selectedOccurrenceId = o.id; }); }
    _input(e) { const key = e.target.dataset.rv3Input; if (!key || !['search', 'line-search'].includes(key))
        return; const prop = key === 'search' ? 'searchQuery' : 'rotationSearchQuery'; this[prop] = e.target.value; const pos = e.target.selectionStart; this.render(); const n = document.querySelector(`[data-rv3-input="${key}"]`); if (n) {
        n.focus();
        try {
            n.setSelectionRange(pos, pos);
        }
        catch { }
    } }
    _change(e) { if (e.target.dataset.rv3Select === 'rotation') {
        this.selectedRotationId = e.target.value;
        this.selectedOccurrenceId = '';
        this.render();
    } if (e.target.dataset.rv3Select === 'calendar') {
        const r = this.game.rotationV2.getRotation(this.selectedRotationId);
        if (r)
            this._commit(() => { r.calendarId = e.target.value; });
    } if (e.target.dataset.rv3Select === 'date') {
        this.selectedDate = e.target.value || '';
        this.render();
    } if (e.target.dataset.rv3Select === 'material-sort') {
        this.materialSort = e.target.value || 'number';
        this.render();
    } if (e.target.dataset.rv3Select === 'line-status') {
        this.rotationStatusFilter = e.target.value || 'all';
        this.activeView = 'fleet';
        this.render();
    } }
    _click(e) {
        const b = e.target.closest('[data-rv2]');
        if (!b)
            return;
        const a = b.dataset.rv2;
        if (a === 'open-problems') {
            this.rotationStatusFilter = 'problem';
            this.activeView = 'fleet';
            this.render();
            return;
        }
        if (a === 'toggle-sheet-library') {
            this.sheetLibraryCollapsed = !this.sheetLibraryCollapsed;
            this.render();
            return;
        }
        if (a === 'toggle-sheet-inspector') {
            this.sheetInspectorCollapsed = !this.sheetInspectorCollapsed;
            this.render();
            return;
        }
        if (a === 'sheet-zoom') {
            const base = Number(this.sheetZoomIndex) < 0 ? 3 : Number(this.sheetZoomIndex || 0);
            this.sheetZoomIndex = Math.max(0, Math.min(6, base + Number(b.dataset.delta || 0)));
            this.render();
            return;
        }
        if (a === 'sheet-fit') {
            this.sheetZoomIndex = -1;
            this.render();
            return;
        }
        if (a === 'select-line') {
            this.selectedRotationId = b.dataset.rotation || '';
            this.selectedOccurrenceId = '';
            this.activeView = 'line';
            this.render();
            return;
        }
        if (a === 'assign-line')
            return this._assignLineDialog();
        if (a === 'apply-line-all') {
            const r = this.game.rotationV2.getRotation(this.selectedRotationId);
            if (r)
                this._commit(() => this.game.rotationV2.setAssignedFormation(r.id, r.assignedFormation, { rameId: r.assignedRameId, applyAll: true }));
            return;
        }
        if (a === 'clear-line') {
            const r = this.game.rotationV2.getRotation(this.selectedRotationId);
            if (r && confirm('Vider la formation de base de cette ligne ?'))
                this._commit(() => this.game.rotationV2.clearAssignedFormation(r.id));
            return;
        }
        if (a === 'remove-line-material')
            return this._removeLineMaterial(b.dataset.kind, b.dataset.id);
        if (a === 'view') {
            this.activeView = b.dataset.view || 'rotation';
            this.render();
            return;
        }
        if (a === 'libtab') {
            this.libraryTab = b.dataset.tab || 'schedules';
            this.render();
            return;
        }
        if (a === 'select-occ') {
            this.selectedOccurrenceId = b.dataset.occ;
            this.render();
            return;
        }
        if (a === 'select-occ-rotation') {
            this.selectedRotationId = b.dataset.rotation;
            this.selectedOccurrenceId = b.dataset.occ;
            this.activeView = 'sheet';
            this.render();
            return;
        }
        if (a === 'select-material') {
            this.selectedMaterialId = `vehicle:${b.dataset.vehicle}`;
            this.activeView = 'material';
            this.render();
            return;
        }
        if (a === 'select-coupon') {
            this.selectedMaterialId = `coupon:${b.dataset.coupon}`;
            this.activeView = 'material';
            this.render();
            return;
        }
        if (a === 'select-rame') {
            this.selectedMaterialId = `rame:${b.dataset.rame}`;
            this.activeView = 'material';
            this.render();
            return;
        }
        if (a === 'edit-station-code')
            return this._editStationCode(b.dataset.occ, b.dataset.loc);
        if (a === 'undo')
            return this._undo();
        if (a === 'redo')
            return this._redo();
        if (a === 'new-rotation')
            return this._newRotation();
        if (a === 'rename-rotation')
            return this._renameRotation();
        if (a === 'duplicate-rotation')
            return this._duplicateRotation();
        if (a === 'toggle-rotation')
            return this._toggleRotation();
        if (a === 'delete-rotation')
            return this._deleteRotation();
        if (a === 'from-rame')
            return this._rameMaterialDialog();
        if (a === 'new-vehicle')
            return this._newVehicleDialog();
        if (a === 'new-coupon')
            return this._newCouponDialog();
        if (a === 'add-schedule')
            return this._addScheduleDialog();
        if (a === 'add-schedule-id')
            return this._addScheduleById(b.dataset.schedule, Number(b.dataset.offset || 0));
        if (a === 'assign-rame')
            return this._assignRameDialog();
        if (a === 'assign')
            return this._assignDialog(b.dataset.occ);
        if (a === 'action')
            return this._actionDialog(b.dataset.occ);
        if (a === 'action-at')
            return this._actionDialog(b.dataset.occ, '', b.dataset.loc);
        if (a === 'edit-action')
            return this._actionDialog(b.dataset.occ, b.dataset.action);
        if (a === 'remove-action')
            return this._removeAction(b.dataset.action);
        if (a === 'remove-occ')
            return this._removeOccurrence(b.dataset.occ);
        if (a === 'move-occ')
            return this._moveOccurrence(b.dataset.occ, Number(b.dataset.delta));
        if (a === 'reverse-occ')
            return this._reverseOccurrence(b.dataset.occ);
    }
    _newRotation() { const name = prompt('Nom de la ligne de roulement :', 'Ligne 1'); if (!name?.trim())
        return; this._commit(() => { const r = this.game.rotationV2.addRotation({ name: name.trim() }); this.selectedRotationId = r.id; this.selectedOccurrenceId = ''; this.activeView = 'line'; }); }
    _renameRotation() { const r = this.game.rotationV2.getRotation(this.selectedRotationId); if (!r)
        return; const name = prompt('Nouveau nom :', r.name); if (!name?.trim())
        return; this._commit(() => { r.name = name.trim(); }); }
    _duplicateRotation() { const r = this.game.rotationV2.getRotation(this.selectedRotationId); if (!r)
        return; const name = prompt('Nom de la copie :', `${r.name} — copie`); if (!name?.trim())
        return; this._commit(() => { const c = this.game.rotationV2.duplicateRotation(r.id, name.trim()); this.selectedRotationId = c.id; this.selectedOccurrenceId = c.occurrences[0]?.id || ''; }); }
    _toggleRotation() { const r = this.game.rotationV2.getRotation(this.selectedRotationId); if (!r)
        return; this._commit(() => { r.enabled = !r.enabled; }); }
    _deleteRotation() { const r = this.game.rotationV2.getRotation(this.selectedRotationId); if (!r || !confirm(`Supprimer le roulement « ${r.name} » ?\nLes horaires eux-mêmes ne seront pas supprimés.`))
        return; this._commit(() => { this.game.rotationV2.removeRotation(r.id); this.selectedRotationId = this.game.rotationV2.rotations[0]?.id || ''; this.selectedOccurrenceId = ''; }); }
    _addScheduleById(id, offsetSec = 0) { const rot = this.game.rotationV2.getRotation(this.selectedRotationId), rec = this.game.scheduleV2.getSchedule(id); if (!rot || !rec || rec.currentVersion.state !== ScheduleState.VALID)
        return; this._commit(() => { const o = this.game.rotationV2.addOccurrence(rot.id, { scheduleId: rec.id, versionId: rec.currentVersion.id, offsetSec: Number(offsetSec || 0) }); this.game.rotationV2.recalculateRotation(rot.id); this.selectedOccurrenceId = o.id; }); }
    _moveOccurrence(id, delta) { const r = this.game.rotationV2.getRotation(this.selectedRotationId), i = r?.occurrences.findIndex((o) => o.id === id); if (!r || i < 0)
        return; const j = i + delta; if (j < 0 || j >= r.occurrences.length)
        return; this._commit(() => { [r.occurrences[i], r.occurrences[j]] = [r.occurrences[j], r.occurrences[i]]; r.normalize(); this.game.rotationV2.recalculateRotation(r.id); }); }
    _reverseOccurrence(id) { const r = this.game.rotationV2.getRotation(this.selectedRotationId), o = r?.occurrences.find((x) => x.id === id); if (!o)
        return; this._commit(() => { o.reversed = !o.reversed; }); }
    _removeAction(id) { const r = this.game.rotationV2.getRotation(this.selectedRotationId), a = r?.actions.find((x) => x.id === id); if (!r || !a)
        return; if (!confirm(`Supprimer l’opération « ${actionDisplay(a)} » ?`))
        return; this._commit(() => { this.game.rotationV2.removeAction(r.id, id); this.game.rotationV2.recalculateRotation(r.id); }); }
    _modal(title, body, buttons = '') { let m = document.getElementById('rv2-modal'); if (m)
        m.remove(); m = document.createElement('div'); m.id = 'rv2-modal'; m.style.cssText = 'position:fixed;inset:0;z-index:9100;background:#0009;display:flex;align-items:center;justify-content:center'; m.innerHTML = `<div style="width:min(760px,94vw);max-height:86vh;overflow:auto;background:#0d1928;border:1px solid #38516d;border-radius:9px;padding:14px;color:#eef6ff"><h3 style="margin-top:0">${esc(title)}</h3>${body}<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:12px">${buttons}<button class="btn-secondary" data-rv2-modal-close>Annuler</button></div></div>`; document.body.appendChild(m); m.addEventListener('click', (e) => { const target = e.target; if (target?.dataset.rv2ModalClose != null || target === m)
        m.remove(); }); return m; }
    _catalogForRameElement(rame, index) { const id = rame?.elements?.[index] || ''; return id ? this.game.rollingStock?.getById?.(id) || null : null; }
    _rameElementPowered(rame, index) { const d = rame?.elementDetails?.[index] || {}, c = this._catalogForRameElement(rame, index); const cat = String(d.category || c?.category || '').toLowerCase(), traction = String(d.traction || c?.traction || 'none').toLowerCase(), power = Number(d.power ?? c?.power ?? 0); return cat.includes('locomotive') || cat.includes('locotracteur') || cat.includes('automotrice') || cat.includes('autorail') || power > 0 && traction !== 'none'; }
    _defaultCouponName(rame) { const mgr = this.game.rotationV2, base = `${rame?.name || 'Rame'} — coupon`; let name = base, n = 2; while (mgr.coupons.some((c) => c.name.toLowerCase() === name.toLowerCase()))
        name = `${base} ${n++}`; return name; }
    _rameElementCard(rame, index, selected = new Set(), interactive = true) { const mgr = this.game.rotationV2, d = rame?.elementDetails?.[index] || {}, cat = this._catalogForRameElement(rame, index), v = mgr.getRameElementVehicle(rame.id, index), powered = this._rameElementPowered(rame, index), coupon = v ? mgr.coupons.find((c) => c.sourceRameId === rame.id && c.vehicleIds.includes(v.id)) : null, label = d.instanceName || d.name || cat?.name || `Élément ${index + 1}`, img = d.imageData || cat?.imageData || '', flipped = !!d.flipped, status = v ? (powered ? '✓ Engin physique' : coupon ? `✓ ${coupon.name}` : '✓ Objet physique') : (powered ? 'Clic = créer engin' : 'Clic = sélectionner pour coupon'); return `<div class="rv2-rame-el ${htmlText(selected.has(index) ? 'selected' : '')} ${htmlText(v ? 'ready' : '')}" ${interactive ? `data-rame-el="${index}"` : ''} title="${esc(label)}"><div style="font-size:9px;color:#8fa9c5;margin-bottom:3px">#${index + 1} • ${esc(d.category || cat?.category || '')}</div>${img ? `<img src="${htmlText(img)}" alt="${esc(label)}"${flipped ? ' style="transform:scaleX(-1)"' : ''}>` : `<div style="height:48px;display:flex;align-items:center;justify-content:center;background:#09131f;border-radius:4px;margin-bottom:5px">${esc(label)}</div>`}<b style="font-size:10px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(label)}</b><div class="rv2-rame-status ${htmlText(v ? 'ok' : '')}">${esc(status)}</div></div>`; }
    _rameStrip(rame, selected = new Set(), interactive = true) { return `<div class="rv2-rame-strip">${(rame?.elementDetails || []).map((_, i) => this._rameElementCard(rame, i, selected, interactive)).join('') || '<small>Rame vide.</small>'}</div>`; }
    _rameMaterialDialog(preselectRameId = '') {
        const rames = this.game.rameManager?.getAll?.() || [];
        if (!rames.length)
            return alert('Créez d’abord une rame dans la page Rames.');
        const initial = rames.some((r) => r.id === preselectRameId) ? preselectRameId : rames[0].id;
        const body = `<div class="rv2-rame-help"><b>Rame → matériel V2</b><br>Cliquez directement sur une locomotive/automotrice pour créer son objet physique. Cliquez sur les voitures/wagons pour les sélectionner, puis créez le coupon : leur ordre réel dans la rame est conservé.</div><div class="sv2-field"><label>Rame source</label><select id="rv2-rame-source" style="width:100%">${rames.map((r) => `<option value="${htmlText(r.id)}" ${r.id === initial ? 'selected' : ''}>${esc(r.name)}${htmlText(r.serialNumber ? ` — ${(r.serialNumber)}` : '')}</option>`).join('')}</select></div><div id="rv2-rame-material-status"></div><div id="rv2-rame-material-strip"></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px"><button class="btn-secondary" id="rv2-rame-select-coaches">Sélectionner toutes les voitures/wagons</button><button class="btn-secondary" id="rv2-rame-clear-selection">Effacer sélection</button></div><div class="sv2-field" style="margin-top:9px"><label>Nom du coupon</label><input id="rv2-rame-coupon-name" style="width:100%"></div><button class="btn-primary" id="rv2-rame-create-coupon">Créer le coupon sélectionné</button>`;
        const m = this._modal('Créer locos et coupons depuis une rame', body);
        const select = m.querySelector('#rv2-rame-source'), strip = m.querySelector('#rv2-rame-material-strip'), status = m.querySelector('#rv2-rame-material-status'), couponName = m.querySelector('#rv2-rame-coupon-name');
        let selected = new Set();
        const current = () => this.game.rameManager.getById(select.value);
        const render = () => { const rame = current(); if (!rame)
            return; const created = this.game.rotationV2.getRameVehicles(rame.id).length, total = rame.elementDetails?.length || 0; status.innerHTML = `<div style="margin:7px 0;color:#b9cce1"><b>${esc(rame.name)}</b> — ${created}/${total} élément(s) matérialisé(s). <span style="color:#7dd3a7">Vert = déjà créé.</span></div>`; strip.innerHTML = this._rameStrip(rame, selected, true); if (!couponName.value || couponName.dataset.auto === '1') {
            couponName.value = this._defaultCouponName(rame);
            couponName.dataset.auto = '1';
        } strip.querySelectorAll('[data-rame-el]').forEach((el) => el.onclick = () => { const i = Number(el.dataset.rameEl), r = current(); if (this._rameElementPowered(r, i)) {
            try {
                this.game.rotationV2.materializeRameElement(r, i, this._catalogForRameElement(r, i));
                this.game.saveState();
                render();
            }
            catch (err) {
                alert(err.message);
            }
        }
        else {
            selected.has(i) ? selected.delete(i) : selected.add(i);
            render();
        } }); };
        select.onchange = () => { selected = new Set(); couponName.dataset.auto = '1'; render(); };
        couponName.oninput = () => { couponName.dataset.auto = '0'; };
        m.querySelector('#rv2-rame-select-coaches').onclick = () => { const r = current(); selected = new Set((r?.elementDetails || []).map((_, i) => i).filter((i) => !this._rameElementPowered(r, i))); render(); };
        m.querySelector('#rv2-rame-clear-selection').onclick = () => { selected.clear(); render(); };
        m.querySelector('#rv2-rame-create-coupon').onclick = () => { const rame = current(), indexes = [...selected].filter((i) => !this._rameElementPowered(rame, i)).sort((a, b) => a - b), name = couponName.value.trim(); if (!name)
            return alert('Nom de coupon requis.'); if (!indexes.length)
            return alert('Sélectionnez les voitures/wagons directement sur la rame.'); try {
            this.game.rotationV2.materializeRameCoupon(rame, indexes, name, (id) => this.game.rollingStock?.getById?.(id) || null);
            selected.clear();
            couponName.dataset.auto = '1';
            this.game.saveState();
            render();
            this.render();
        }
        catch (err) {
            alert(err.message);
        } };
        render();
    }
    _assignRameDialog() {
        const rot = this.game.rotationV2.getRotation(this.selectedRotationId);
        if (!rot)
            return;
        const rames = this.game.rameManager?.getAll?.() || [];
        if (!rames.length)
            return alert('Créez d’abord une rame dans la page Rames.');
        const initial = rames.some((r) => r.id === rot.assignedRameId) ? rot.assignedRameId : rames[0].id;
        const body = `<div class="rv2-rame-help"><b>Rame de base du roulement</b><br>La rame choisie alimente automatiquement les occurrences qui héritent de la formation de base. <b>Les trains personnalisés restent intacts</b> : changer la rame de base ne les écrase plus.</div><div class="sv2-field"><label>Rame</label><select id="rv2-assign-rame-select" style="width:100%">${rames.map((r) => `<option value="${htmlText(r.id)}" ${r.id === initial ? 'selected' : ''}>${esc(r.name)}${htmlText(r.serialNumber ? ` — ${(r.serialNumber)}` : '')}</option>`).join('')}</select></div><div id="rv2-assign-rame-status"></div><div id="rv2-assign-rame-strip"></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px"><button class="btn-secondary" id="rv2-assign-rame-prepare">Préparer locos/coupons depuis cette rame</button>${rot.assignedRameId ? '<button class="btn-secondary" id="rv2-assign-rame-remove">Retirer la rame de base (garder les compositions)</button>' : ''}</div>`;
        const m = this._modal('Affecter une rame de base', body, '<button class="btn-primary" id="rv2-assign-rame-ok">Affecter</button>'), sel = m.querySelector('#rv2-assign-rame-select'), status = m.querySelector('#rv2-assign-rame-status'), strip = m.querySelector('#rv2-assign-rame-strip'), ok = m.querySelector('#rv2-assign-rame-ok');
        const current = () => this.game.rameManager.getById(sel.value);
        const render = () => { const r = current(); if (!r)
            return; const total = r.elementDetails?.length || 0, created = this.game.rotationV2.getRameVehicles(r.id).length, missing = []; for (let i = 0; i < total; i++)
            if (!this.game.rotationV2.getRameElementVehicle(r.id, i))
                missing.push(r.elementDetails[i]?.instanceName || r.elementDetails[i]?.name || `#${i + 1}`); strip.innerHTML = this._rameStrip(r, new Set(), false); if (missing.length) {
            status.innerHTML = `<div class="rv2-warning"><b>Matériel physique incomplet : ${created}/${total}</b><br>Manque : ${esc(missing.slice(0, 8).join(', '))}${missing.length > 8 ? ' …' : ''}</div>`;
            ok.disabled = true;
        }
        else {
            const overrides = rot.occurrences.filter((o) => o.usesAssignedFormation === false).length;
            status.innerHTML = `<div style="padding:7px;color:#7dd3a7"><b>✓ ${total}/${total} éléments prêts.</b>${overrides ? ` ${overrides} occurrence(s) personnalisée(s) ne seront pas modifiées.` : ''}</div>`;
            ok.disabled = false;
        } };
        sel.onchange = render;
        m.querySelector('#rv2-assign-rame-prepare').onclick = () => this._rameMaterialDialog(sel.value);
        m.querySelector('#rv2-assign-rame-remove')?.addEventListener('click', () => { if (!confirm('Retirer la rame de base ? Les compositions actuellement présentes seront conservées.'))
            return; this._pushHistory(); this.game.rotationV2.clearRameFromRotation(rot.id, { keepFormation: true }); m.remove(); this._syncRuntimeNow(); this.game.saveState(); this.render(); });
        ok.onclick = () => { const rame = current(); if (!rame)
            return; const snapshot = this._snapshot(); this._pushHistory(); try {
            this.game.rotationV2.assignRameToRotation(rot.id, rame);
            const bad = this.game.rotationV2.validateMaterialConflicts().filter((c) => c.first?.rotationId === rot.id || c.second?.rotationId === rot.id);
            if (bad.length)
                throw new Error('Conflit matériel : un élément de cette rame est déjà engagé ou ne peut pas rejoindre physiquement cette ligne.');
            m.remove();
            this._syncRuntimeNow();
            this.game.saveState();
            this.render();
        }
        catch (err) {
            this.game.rotationV2.loadFromSave(snapshot);
            this._history.pop();
            alert(err.message);
            this.render();
        } };
        render();
    }
    _newVehicleDialog() {
        const body = `<div class="sv2-field"><label>Rechercher dans le catalogue</label><input id="rv2-cat-search" placeholder="BB 22200, Corail..."><div id="rv2-cat-results" class="rv2-search-results"></div></div><div id="rv2-selected-cat" style="margin:8px 0;color:#9ec6ee">Aucun modèle choisi</div><div class="sv2-field"><label>Numéro individuel unique</label><input id="rv2-vehicle-number" placeholder="BB 22201"></div><div class="sv2-grid"><div class="sv2-field"><label>Systèmes électriques connus</label><input id="rv2-electric" placeholder="1500@0;25000@50"></div><div class="sv2-field"><label>Écartement(s) mm</label><input id="rv2-gauges" value="1435" placeholder="1435"></div></div><div class="sv2-grid"><div class="sv2-field"><label>Gabarit requis</label><input id="rv2-loading-gauge" placeholder="GA, GB, GC…"></div><div class="sv2-field"><label>Charge essieu t</label><input id="rv2-axle-load" inputmode="decimal" placeholder="22.5"></div><div class="sv2-field"><label>Charge mètre t/m</label><input id="rv2-metre-load" inputmode="decimal" placeholder="8.0"></div></div><small style="color:#9db0c8">L’image et le statut voiture-pilote sont repris du catalogue lorsque disponibles.</small>`;
        const m = this._modal('Créer un objet matériel physique', body, '<button class="btn-primary" id="rv2-create-vehicle">Créer</button>');
        let selected = null;
        const input = m.querySelector('#rv2-cat-search'), res = m.querySelector('#rv2-cat-results');
        const search = () => { const q = input.value.trim().toLowerCase(); if (q.length < 2) {
            res.innerHTML = '';
            return;
        } const hits = this.game.rollingStock.getAll().filter((x) => (`${x.name || ''} ${x.seriesName || ''} ${x.realIdentitySeries || ''}`).toLowerCase().includes(q)).slice(0, 40); res.innerHTML = hits.map((x) => `<div class="rv2-search-hit" data-cat="${htmlText(x.id)}">${x.imageData ? `<img src="${htmlText(x.imageData)}" style="width:90px;max-height:38px;object-fit:contain;float:right">` : ''}<b>${esc(x.name)}</b><br><small>${esc(x.category)} • V${x.maxSpeed} • ${x.mass || x.tonnage || '?'} t • ${esc(x.traction || 'traction inconnue')}</small></div>`).join('') || '<div style="padding:7px">Aucun résultat</div>'; res.querySelectorAll('[data-cat]').forEach((el) => el.onclick = () => { selected = this.game.rollingStock.getById(el.dataset.cat); m.querySelector('#rv2-selected-cat').innerHTML = `<b>${esc(selected.name)}</b> • ${esc(selected.traction || 'traction inconnue')}${selected.imageData ? `<br><img src="${htmlText(selected.imageData)}" style="max-width:220px;max-height:70px;object-fit:contain;margin-top:5px">` : ''}`; }); };
        input.addEventListener('input', search);
        m.querySelector('#rv2-create-vehicle').onclick = () => { const number = m.querySelector('#rv2-vehicle-number').value.trim(); if (!selected || !number)
            return alert('Choisissez un modèle et un numéro individuel.'); this._pushHistory(); try {
            this.game.rotationV2.addVehicle({ catalogId: selected.id, number, name: selected.name, category: selected.category, traction: selected.traction, maxSpeed: selected.maxSpeed, massKg: (selected.mass || selected.tonnage || 80) * 1000, powerW: (selected.power || 0) * 1000, lengthM: selected.length || 20, passengerCapacity: Number(selected.passengerCapacity || 0), freightCapacity: Number(selected.freightCapacity || 0), electricSystems: parseElectricSystems(m.querySelector('#rv2-electric').value).length ? parseElectricSystems(m.querySelector('#rv2-electric').value) : (selected.electricSystems || []), gauges: parseGauges(m.querySelector('#rv2-gauges').value), brakeServiceMs2: Number(selected.brakeServiceMs2 || 0.9), loadingGauge: m.querySelector('#rv2-loading-gauge').value.trim() || String(selected.loadingGauge || ''), axleLoad: m.querySelector('#rv2-axle-load').value.trim() !== '' ? Number(m.querySelector('#rv2-axle-load').value) : (Number.isFinite(Number(selected.axleLoad)) ? Number(selected.axleLoad) : null), metreLoad: m.querySelector('#rv2-metre-load').value.trim() !== '' ? Number(m.querySelector('#rv2-metre-load').value) : (Number.isFinite(Number(selected.metreLoad)) ? Number(selected.metreLoad) : null), imageData: selected.imageData || '', isDrivingTrailer: !!selected.isDrivingTrailer });
            m.remove();
            this.game.saveState();
            this.render();
        }
        catch (err) {
            this._history.pop();
            alert(err.message);
        } };
    }
    _newCouponDialog() { const mgr = this.game.rotationV2; const candidates = mgr.vehicles.filter((v) => ['voiture', 'wagon', 'coach'].some((x) => String(v.category).toLowerCase().includes(x)) || !v.powerW); const body = `<div class="sv2-field"><label>Nom unique</label><input id="rv2-coupon-name" placeholder="Coupon 301"></div><div class="rv2-coupon-builder"><div><b>Matériel disponible</b><div id="rv2-coupon-source" class="rv2-drop">${candidates.map((v) => `<div class="rv2-drag" draggable="true" data-source-veh="${htmlText(v.id)}">${esc(v.number)} — ${esc(v.name)}</div>`).join('') || '<small>Créez d’abord les voitures/wagons comme objets matériels.</small>'}</div></div><div><b>Coupon — ordre réel</b><div id="rv2-coupon-chosen" class="rv2-drop"><small>Glissez les véhicules ici.</small></div></div></div>`; const m = this._modal('Créer un coupon voiture par voiture', body, '<button class="btn-primary" id="rv2-create-coupon">Créer</button>'); let ids = []; let dragged = ''; const chosen = m.querySelector('#rv2-coupon-chosen'); const redraw = () => { chosen.innerHTML = ids.length ? ids.map((id, i) => { const v = mgr.getVehicle(id); return `<div class="rv2-drag chosen" draggable="true" data-chosen="${htmlText(id)}"><button type="button" data-up="${htmlText(i)}">↑</button><span>${i + 1}. ${esc(v?.number || id)} — ${esc(v?.name || '')}</span><button type="button" data-remove="${htmlText(i)}">×</button></div>`; }).join('') : '<small>Glissez les véhicules ici.</small>'; chosen.querySelectorAll('[data-remove]').forEach((b) => b.onclick = () => { ids.splice(Number(b.dataset.remove), 1); redraw(); }); chosen.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => { const i = Number(b.dataset.up); if (i > 0) {
        [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
        redraw();
    } }); chosen.querySelectorAll('[data-chosen]').forEach((el) => { el.ondragstart = (e) => { dragged = el.dataset.chosen; e.dataTransfer.setData('text/plain', dragged); }; el.ondragover = (e) => e.preventDefault(); el.ondrop = (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragged; const from = ids.indexOf(id), to = ids.indexOf(el.dataset.chosen); if (from >= 0 && to >= 0 && from !== to) {
        ids.splice(from, 1);
        ids.splice(to, 0, id);
        redraw();
    } }; }); }; m.querySelectorAll('[data-source-veh]').forEach((el) => { el.ondragstart = (e) => e.dataTransfer.setData('text/plain', el.dataset.sourceVeh); el.ondblclick = () => { if (!ids.includes(el.dataset.sourceVeh)) {
        ids.push(el.dataset.sourceVeh);
        redraw();
    } }; }); chosen.ondragover = (e) => e.preventDefault(); chosen.ondrop = (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && !ids.includes(id)) {
        ids.push(id);
        redraw();
    } }; m.querySelector('#rv2-create-coupon').onclick = () => { const name = m.querySelector('#rv2-coupon-name').value.trim(); if (!name || !ids.length)
        return alert('Nom + au moins un véhicule.'); try {
        this._pushHistory();
        mgr.addCoupon({ name, vehicleIds: ids });
        m.remove();
        this.game.saveState();
        this.render();
    }
    catch (err) {
        alert(err.message);
    } }; }
    _addScheduleDialog() {
        const rot = this.game.rotationV2.getRotation(this.selectedRotationId);
        if (!rot)
            return;
        const schedules = this.game.scheduleV2.schedules.filter((s) => s.currentVersion.state === ScheduleState.VALID);
        const body = `<div class="sv2-field"><label>Horaire valide</label><input id="rv2-add-filter" placeholder="Numéro, gare, destination…" style="width:100%;margin-bottom:6px"><select id="rv2-add-schedule" size="12" style="width:100%"></select></div><div class="sv2-field"><label>Décalage de départ (min, optionnel)</label><input id="rv2-offset" type="number" value="0"></div>`;
        const m = this._modal('Ajouter un horaire au roulement', body, '<button class="btn-primary" id="rv2-add-schedule-ok">Ajouter</button>'), sel = m.querySelector('#rv2-add-schedule'), filter = m.querySelector('#rv2-add-filter');
        const draw = () => { const q = filter.value.trim().toLowerCase(), rows = schedules.filter((s) => !q || `${s.number} ${s.name} ${(s.currentVersion.locations || []).map((l) => l.name).join(' ')}`.toLowerCase().includes(q)).slice(0, 300); sel.innerHTML = rows.map((s) => { const v = s.currentVersion; return `<option value="${htmlText(s.id)}">${esc(s.number)} • ${esc(v.locations[0]?.name || '?')} → ${esc(v.locations.at(-1)?.name || '?')} • ${formatScheduleClock(v.firstDepartureSec)}</option>`; }).join(''); };
        filter.oninput = draw;
        draw();
        m.querySelector('#rv2-add-schedule-ok').onclick = () => { const id = sel.value, rec = this.game.scheduleV2.getSchedule(id); if (!rec)
            return; this._pushHistory(); const o = this.game.rotationV2.addOccurrence(rot.id, { scheduleId: id, versionId: rec.currentVersion.id, offsetSec: Number(m.querySelector('#rv2-offset').value || 0) * 60 }); this.game.rotationV2.recalculateRotation(rot.id); this.selectedOccurrenceId = o.id; this._syncRuntimeNow(); m.remove(); this.game.saveState(); this.render(); };
    }
    _assignDialog(occId) {
        const rot = this.game.rotationV2.getRotation(this.selectedRotationId), occ = rot?.occurrences.find((o) => o.id === occId);
        if (!occ)
            return;
        const mgr = this.game.rotationV2;
        const couponPart = mgr.coupons.length ? `<div class="sv2-field"><label>Coupons</label>${mgr.coupons.map((c) => `<label style="display:block"><input type="checkbox" data-coupon="${htmlText(c.id)}" ${c.vehicleIds.every((id) => occ.formation.members.some((m) => m.vehicleId === id)) ? 'checked' : ''}> ${esc(c.name)} — ${c.vehicleIds.length} véhicules</label>`).join('')}</div>` : '';
        const body = `<p>Composition de cette circulation. Une modification ici devient une <b>exception</b> et ne sera plus écrasée par la rame de base.</p><input id="rv2-assign-filter" placeholder="Rechercher matériel…" style="width:100%;margin-bottom:7px">${couponPart}<div id="rv2-assign-list">${mgr.vehicles.map((v) => { const cur = occ.formation.members.find((x) => x.vehicleId === v.id), powered = mgr._poweredVehicle?.(v), defaultRole = cur?.role || (powered ? FormationRole.ACTIVE_MULTIPLE : roleForVehicle(v)); return `<div data-assign-row="${htmlText(v.id)}" data-text="${esc(`${v.number} ${v.name} ${v.category}`.toLowerCase())}" style="display:grid;grid-template-columns:24px 1fr 145px 70px;gap:5px;align-items:center;padding:4px;border-bottom:1px solid #24364a"><input type="checkbox" data-veh="${htmlText(v.id)}" ${cur ? 'checked' : ''}><span>${esc(v.number)} — ${esc(v.name)}</span><select data-role="${htmlText(v.id)}">${Object.values(FormationRole).map((r) => `<option value="${htmlText(r)}" ${defaultRole === r ? 'selected' : ''}>${htmlText(roleLabel(r))}</option>`).join('')}</select><label style="font-size:10px"><input type="checkbox" data-cv="${htmlText(v.id)}" ${cur?.role === FormationRole.VEHICLE ? 'checked' : ''}> CV</label></div>`; }).join('')}</div>`;
        const m = this._modal('Affecter le matériel', body, '<button class="btn-primary" id="rv2-assign-ok">Affecter</button>');
        const filter = m.querySelector('#rv2-assign-filter');
        filter.oninput = () => { const q = filter.value.trim().toLowerCase(); m.querySelectorAll('[data-assign-row]').forEach((row) => row.style.display = !q || row.dataset.text.includes(q) ? 'grid' : 'none'); };
        m.querySelectorAll('[data-cv]').forEach((cb) => cb.onchange = () => { const id = cb.dataset.cv, sel = m.querySelector(`[data-role="${id}"]`); if (cb.checked)
            sel.value = FormationRole.VEHICLE; });
        m.querySelectorAll('[data-role]').forEach((sel) => sel.onchange = () => { const cb = m.querySelector(`[data-cv="${sel.dataset.role}"]`); if (cb)
            cb.checked = sel.value === FormationRole.VEHICLE; });
        m.querySelector('#rv2-assign-ok').onclick = () => { const snapshot = this._snapshot(); this._pushHistory(); try {
            const members = [], seen = new Set();
            [...m.querySelectorAll('[data-veh]:checked')].forEach((x) => { const id = x.dataset.veh, cv = m.querySelector(`[data-cv="${id}"]`)?.checked, role = cv ? FormationRole.VEHICLE : m.querySelector(`[data-role="${id}"]`).value; seen.add(id); members.push(new FormationMember({ vehicleId: id, role, order: members.length })); });
            for (const cbox of m.querySelectorAll('[data-coupon]:checked'))
                for (const cm of mgr.expandCoupon(cbox.dataset.coupon)) {
                    if (seen.has(cm.vehicleId))
                        continue;
                    seen.add(cm.vehicleId);
                    const v = mgr.getVehicle(cm.vehicleId);
                    cm.role = String(v?.category || '').toLowerCase().includes('wagon') ? FormationRole.WAGON : FormationRole.COACH;
                    cm.order = members.length;
                    members.push(cm);
                }
            if (!members.some((mm) => [FormationRole.LEAD, FormationRole.ACTIVE_MULTIPLE, FormationRole.PUSHER].includes(mm.role))) {
                const firstPowered = members.find((mm) => mm.role !== FormationRole.VEHICLE && mgr._poweredVehicle?.(mgr.getVehicle(mm.vehicleId)));
                if (firstPowered)
                    firstPowered.role = FormationRole.LEAD;
            }
            else if (!members.some((mm) => mm.role === FormationRole.LEAD)) {
                const first = members.find((mm) => mm.role === FormationRole.ACTIVE_MULTIPLE);
                if (first)
                    first.role = FormationRole.LEAD;
            }
            occ.formation.members = members;
            occ.formation.normalize();
            occ.usesAssignedFormation = false;
            occ.timingMismatchApproved = false;
            occ.timingMismatchSignature = '';
            mgr.recalculateRotation(rot.id);
            const bad = mgr.validateMaterialConflicts().filter((c) => c.first?.occurrenceId === occ.id || c.second?.occurrenceId === occ.id);
            if (bad.length)
                throw new Error('Conflit matériel : engin déjà engagé ou continuité géographique impossible entre les circulations.');
            m.remove();
            this._syncRuntimeNow();
            this.game.saveState();
            this.render();
        }
        catch (err) {
            mgr.loadFromSave(snapshot);
            this._history.pop();
            alert(err.message);
            this.render();
        } };
    }
    _actionDialog(occId, actionId = '', preselectLocationId = '') {
        const rot = this.game.rotationV2.getRotation(this.selectedRotationId), occ = rot?.occurrences.find((o) => o.id === occId);
        if (!occ)
            return;
        const ver = this.game.scheduleV2.getVersion(occ.scheduleId, occ.versionId), mgr = this.game.rotationV2, existing = actionId ? rot.actions.find((a) => a.id === actionId) : null, selectedLoc = existing?.locationOccurrenceId || preselectLocationId || ver?.locations?.[0]?.id || '';
        const couponBlock = mgr.coupons.length ? `<div class="sv2-field"><label>Coupons concernés</label>${mgr.coupons.map((c) => `<label style="display:block"><input type="checkbox" data-action-coupon="${htmlText(c.id)}" ${existing?.couponIds?.includes(c.id) ? 'checked' : ''}> ${esc(c.name)} — ${c.vehicleIds.length} véhicule(s)</label>`).join('')}</div>` : '';
        const presets = [{ type: RotationActionType.CHANGE_LOCOMOTIVE, label: '🚂 Changer locomotive', kind: '' }, { type: RotationActionType.SPLIT, label: '✂ Couper la rame', kind: '' }, { type: RotationActionType.ATTACH, label: '🔗 Accrocher matériel', kind: '' }, { type: RotationActionType.MERGE, label: '⇄ Réunir compositions', kind: '' }, { type: RotationActionType.ATTACH, label: '🔗 Former une UM', kind: 'FORM_UM' }, { type: RotationActionType.SPLIT, label: '✂ Séparer l’UM', kind: 'SPLIT_UM' }, { type: RotationActionType.ADD_CV, label: 'CV Ajouter en véhicule', kind: '' }, { type: RotationActionType.ADD_PUSHER, label: '↗ Ajouter pousse', kind: '' }];
        const body = `<div class="rv2-rame-help"><b>Opération physique</b><br>Choisissez d’abord l’action ferroviaire. La durée réserve réellement le matériel ; une coupe libère le coupon à la fin de l’opération pour qu’il puisse repartir sur une autre branche. Les commandes UM dédiées utilisent le même moteur physique, mais imposent une lecture ferroviaire explicite.</div><div class="rv3-action-presets">${presets.map((p) => `<button type="button" class="btn-secondary ${htmlText((existing?.details?.operationKind || '') === p.kind && existing?.type === p.type ? 'active' : '')}" data-action-preset="${htmlText(p.type)}" data-action-kind="${htmlText(p.kind)}">${htmlText(p.label)}</button>`).join('')}</div><div class="sv2-field"><label>Arrêt / point opérationnel</label><select id="rv2-action-loc">${(ver?.locations || []).map((l) => `<option value="${htmlText(l.id)}" ${selectedLoc === l.id ? 'selected' : ''}>${esc(l.name)} — ${esc(l.track.displayName)}</option>`).join('')}</select></div><div class="sv2-field"><label>Action détaillée</label><select id="rv2-action-type">${Object.values(RotationActionType).map((t) => `<option value="${htmlText(t)}" ${existing?.type === t ? 'selected' : ''}>${esc(actionLabel(t))}</option>`).join('')}</select></div><div class="sv2-grid"><div class="sv2-field"><label>Durée (min, ≥5)</label><input id="rv2-action-duration" type="number" min="5" value="${htmlText(Math.max(5, Math.round((existing?.durationSec || 300) / 60)))}"></div><div class="sv2-field"><label>Mode</label><select id="rv2-action-mode"><option value="" ${!existing?.forcedExecutionMode ? 'selected' : ''}>Auto</option><option value="PARALLEL" ${existing?.forcedExecutionMode === 'PARALLEL' ? 'selected' : ''}>Parallèle</option><option value="SEQUENTIAL" ${existing?.forcedExecutionMode === 'SEQUENTIAL' ? 'selected' : ''}>Séquentiel</option></select></div></div>${couponBlock}<div class="sv2-field"><label>Matériel concerné</label><input id="rv2-action-filter" placeholder="Rechercher…" style="width:100%;margin-bottom:5px">${mgr.vehicles.map((v) => `<label data-action-row="${htmlText(v.id)}" data-text="${esc(`${v.number} ${v.name}`.toLowerCase())}" style="display:block"><input type="checkbox" data-action-veh="${htmlText(v.id)}" ${existing?.vehicleIds?.includes(v.id) ? 'checked' : ''}> ${esc(v.number)} — ${esc(v.name)}</label>`).join('')}</div><small style="color:#9db0c8">ATTACH/MERGE détecte automatiquement une loco/automotrice comme UM active lorsqu’une traction existe déjà. « Ajouter CV » garde sa masse mais pas sa puissance.</small>`;
        const m = this._modal(existing ? 'Éditer l’opération' : 'Ajouter une opération de roulement', body, `<button class="btn-primary" id="rv2-action-ok">${existing ? 'Enregistrer' : 'Ajouter'}</button>`), filter = m.querySelector('#rv2-action-filter'), typeSel = m.querySelector('#rv2-action-type');
        filter.oninput = () => { const q = filter.value.trim().toLowerCase(); m.querySelectorAll('[data-action-row]').forEach((row) => row.style.display = !q || row.dataset.text.includes(q) ? 'block' : 'none'); };
        let operationKind = existing?.details?.operationKind || '';
        const syncPreset = () => m.querySelectorAll('[data-action-preset]').forEach((x) => x.classList.toggle('active', x.dataset.actionPreset === typeSel.value && (x.dataset.actionKind || '') === operationKind));
        m.querySelectorAll('[data-action-preset]').forEach((x) => x.onclick = () => { typeSel.value = x.dataset.actionPreset; operationKind = x.dataset.actionKind || ''; syncPreset(); });
        typeSel.onchange = () => { operationKind = ''; syncPreset(); };
        syncPreset();
        m.querySelector('#rv2-action-ok').onclick = () => { const duration = Number(m.querySelector('#rv2-action-duration').value || 0); if (duration < 5)
            return alert('Minimum 5 minutes par opération.'); const locId = m.querySelector('#rv2-action-loc').value, loc = ver.locations.find((l) => l.id === locId); if (!loc)
            return; const couponIds = [...m.querySelectorAll('[data-action-coupon]:checked')].map((x) => x.dataset.actionCoupon), vehicleIds = [...m.querySelectorAll('[data-action-veh]:checked')].map((x) => x.dataset.actionVeh); for (const cid of couponIds)
            for (const id of mgr.getCoupon(cid)?.vehicleIds || [])
                if (!vehicleIds.includes(id))
                    vehicleIds.push(id); if (!vehicleIds.length)
            return alert('Sélectionnez au moins un matériel ou coupon.'); if (['FORM_UM', 'SPLIT_UM'].includes(operationKind)) {
            const invalid = vehicleIds.map((id) => mgr.getVehicle(id)).filter((v) => !mgr._poweredVehicle?.(v));
            if (invalid.length)
                return alert('Une opération UM dédiée ne peut cibler que des locomotives/automotrices/autorails motorisés.');
        } const snapshot = this._snapshot(); this._pushHistory(); try {
            let a = existing;
            if (a) {
                a.type = typeSel.value;
                a.locationOccurrenceId = locId;
                a.vehicleIds = vehicleIds;
                a.couponIds = couponIds;
                a.durationSec = duration * 60;
                a.forcedExecutionMode = m.querySelector('#rv2-action-mode').value;
                a.details = { ...(a.details || {}), operationKind };
            }
            else
                a = mgr.addAction(rot.id, { type: typeSel.value, occurrenceId: occ.id, locationOccurrenceId: locId, vehicleIds, couponIds, durationSec: duration * 60, forcedExecutionMode: m.querySelector('#rv2-action-mode').value, details: { operationKind } });
            const idx = ver.locations.findIndex((l) => l.id === locId), required = mgr.operationWindowSec(rot.id, occ.id, locId);
            if (idx > 0 && (loc.dwellSec || 0) < required)
                throw new Error(`Temps d’arrêt insuffisant : ${Math.ceil(required / 60)} min nécessaires, ${Math.floor((loc.dwellSec || 0) / 60)} min prévues.`);
            mgr.recalculateRotation(rot.id);
            const issues = mgr.validateRotation(rot.id).filter((i) => i.level === 'ERROR' && i.occurrenceId === occ.id && i.code === 'OPERATION_DEPENDENCY_INVALID');
            if (issues.length)
                throw new Error(issues[0].message);
            m.remove();
            this._syncRuntimeNow();
            this.game.saveState();
            this.render();
        }
        catch (err) {
            mgr.loadFromSave(snapshot);
            this._history.pop();
            alert(err.message);
            this.render();
        } };
    }
    _removeOccurrence(id) { const r = this.game.rotationV2.getRotation(this.selectedRotationId), o = r?.occurrences.find((x) => x.id === id); if (!r || !o)
        return; const rec = this.game.scheduleV2.getSchedule(o.scheduleId); if (!confirm(`Retirer le train ${rec?.number || ''} de ce roulement ? L’horaire lui-même sera conservé.`))
        return; this._commit(() => { r.occurrences = r.occurrences.filter((x) => x.id !== id); r.actions = r.actions.filter((a) => a.occurrenceId !== id); r.normalize(); this.game.rotationV2.recalculateRotation(r.id); this.selectedOccurrenceId = r.occurrences[0]?.id || ''; }); }
}
export default RotationV2Editor;

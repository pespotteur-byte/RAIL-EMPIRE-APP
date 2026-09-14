import type { GameStorage } from './storage.js';
import { compactGeometryCaches, storageUsage, type CompactionResult } from './storage-maintenance.js';
import { cacheStorageStatus } from './storage-cache.js';
export interface StoragePanelActions { save:()=>Promise<boolean>; export:()=>Promise<void>; }
const mib=(v:number)=>v<1024?`${Math.round(v)} octets`:v<1048576?`${(v/1024).toLocaleString('fr-FR',{maximumFractionDigits:2})} Kio`:`${(v/1048576).toLocaleString('fr-FR',{maximumFractionDigits:2})} Mio`;
export function openStoragePanel(storage:GameStorage,actions:StoragePanelActions):void {
  if(document.getElementById('re-storage-panel'))return;
  const priorFocus=document.activeElement as HTMLElement|null;
  const overlay=document.createElement('div');overlay.id='re-storage-panel';
  Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'100000',background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:'12px',boxSizing:'border-box'});
  const panel=document.createElement('section');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','re-storage-title');
  Object.assign(panel.style,{background:'#18212b',color:'#edf2f7',border:'1px solid #526171',borderRadius:'12px',padding:'22px',width:'640px',maxWidth:'100%',maxHeight:'90vh',overflowY:'auto',boxSizing:'border-box',fontSize:'14px',lineHeight:'1.55',overflowWrap:'anywhere'});
  const heading=document.createElement('h2');heading.id='re-storage-title';heading.textContent='Stockage du navigateur';panel.append(heading);
  const intro=document.createElement('p');intro.textContent='Compression sans perte : aucun point de voie, horaire ou élément de partie supprimé. Colonnes identiques du SC partagées entre variantes ; aucune précision retirée. Les anciennes données restent lisibles. Exportez une copie avant la migration.';panel.append(intro);
  const stats=document.createElement('div');stats.id='re-storage-stats';stats.style.whiteSpace='pre-line';panel.append(stats);
  const note=document.createElement('p');note.textContent='La taille de la sauvegarde est celle du contenu écrit. L’espace total et le quota sont des estimations du navigateur, pas une mesure exacte des fichiers sur le disque. Le cache HTTP des images n’est pas purgé.';note.style.opacity='.8';panel.append(note);
  const status=document.createElement('p');status.id='re-storage-progress';status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);
  const comparison=document.createElement('p');comparison.id='re-storage-comparison';comparison.hidden=true;panel.append(comparison);
  const controls=document.createElement('div');Object.assign(controls.style,{display:'flex',gap:'8px',flexWrap:'wrap'});panel.append(controls);
  const makeButton=(id:string,text:string)=>{const b=document.createElement('button');b.id=id;b.textContent=text;b.type='button';Object.assign(b.style,{background:'#29485d',color:'white',border:'1px solid #71869a',borderRadius:'6px',padding:'9px 12px',cursor:'pointer'});controls.append(b);return b;};
  const exportBtn=makeButton('re-storage-export','Exporter la partie');
  const compactBtn=makeButton('re-storage-compact','Optimiser sans supprimer');
  const reportBtn=makeButton('re-storage-report','Exporter le bilan');
  const closeBtn=makeButton('re-storage-close','Fermer');
  type Measurement={startedAt:string;before:Awaited<ReturnType<typeof storageUsage>>;beforeSave:ReturnType<GameStorage['getSaveInfo']>;after?:Awaited<ReturnType<typeof storageUsage>>;afterSave?:ReturnType<GameStorage['getSaveInfo']>;finishedAt?:string};
  let measurement:Measurement|null=null;
  let controller:AbortController|null=null,lastResult:CompactionResult|null=null,working=false;
  const refresh=async()=>{const usage=await storageUsage(),save=storage.getSaveInfo();if(!overlay.isConnected)return;
    stats.textContent=[`Total de cette origine : ${usage.usage==null?'non disponible':mib(usage.usage)} / ${usage.quota==null?'quota inconnu':mib(usage.quota)}`,
      `Stockage persistant : ${usage.persistent==null?'indisponible':usage.persistent?'accordé':'non accordé (ne signifie pas illimité)'}`,
      `Sauvegarde : ${save?mib(save.sizeBytes)+' · '+save.backend:'aucune taille disponible'}`,
      save?.reductionRatio?`Réduction de la sauvegarde vs JSON brut : ×${save.reductionRatio.toFixed(2)} · ${save.references||0} blocs répétés dédupliqués`:'',
      `localStorage : ${mib(usage.localBytes)} (estimation UTF-16, toutes clés de cette origine)`,
      cacheStorageStatus.pausedForQuota?'Nouveaux caches disque suspendus : réserve protégée pour la sauvegarde.':'',
      storage.lastError?`Dernière erreur de sauvegarde : ${storage.lastError}`:''].filter(Boolean).join('\n');};
  const progress=(r:CompactionResult)=>{lastResult=r;if(!overlay.isConnected)return;status.textContent=`${r.scanned} caches examinés · ${r.compacted} compactés · ${r.failed} échecs · ${r.conflicts} modifications concurrentes conservées. Réduction du contenu traité : ${mib(Math.max(0,r.beforeBytes-r.afterBytes))}.`;};
  const keydown=(event:KeyboardEvent)=>{
    if(event.key==='Escape'){close();return;}
    if(event.key==='Tab'){
      const buttons=[exportBtn,compactBtn,reportBtn,closeBtn].filter(b=>!b.disabled);
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  };
  const close=()=>{controller?.abort();document.removeEventListener('keydown',keydown);overlay.remove();priorFocus?.focus();};
  closeBtn.onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close();});document.addEventListener('keydown',keydown);
  exportBtn.onclick=async()=>{exportBtn.disabled=true;try{await actions.export();}catch(e){status.textContent=String(e);}finally{exportBtn.disabled=false;}};
  compactBtn.onclick=async()=>{
    if(working)return;working=true;compactBtn.disabled=exportBtn.disabled=reportBtn.disabled=true;controller=new AbortController();closeBtn.textContent='Arrêter / fermer';
    try{
      measurement={startedAt:new Date().toISOString(),before:await storageUsage(),beforeSave:storage.getSaveInfo()};
      status.textContent='Compression de la sauvegarde courante…';let saved=await actions.save();
      const result=await compactGeometryCaches({signal:controller.signal,onProgress:progress});
      if(!saved&&!controller.signal.aborted)saved=await actions.save();
      progress(result);
      if(overlay.isConnected)status.textContent+=result.cancelled?' Opération interrompue sans effacer les caches restants.':saved?' Sauvegarde enregistrée.':' Sauvegarde non enregistrée : exportez la partie.';
    }catch(e){if(overlay.isConnected)status.textContent=`Optimisation interrompue : ${e instanceof Error?e.message:String(e)}. Les transactions non terminées ne remplacent pas les données.`;}
    finally{
      if(measurement){measurement.after=await storageUsage();measurement.afterSave=storage.getSaveInfo();measurement.finishedAt=new Date().toISOString();
        comparison.hidden=false;comparison.textContent=`Total de l’origine avant → après : ${measurement.before.usage==null?'indisponible':mib(measurement.before.usage)} → ${measurement.after.usage==null?'indisponible':mib(measurement.after.usage)}. Estimations ; leur actualisation peut être différée.`;}
      working=false;compactBtn.disabled=exportBtn.disabled=reportBtn.disabled=false;closeBtn.textContent='Fermer';await refresh();
    }
  };
  reportBtn.onclick=async()=>{
    const report={format:'RE13-STORAGE-DIAGNOSTIC',build:'RC14',date:new Date().toISOString(),usage:await storageUsage(),save:storage.getSaveInfo(),lastError:storage.lastError,cacheStatus:{...cacheStorageStatus},compaction:lastResult,measurement};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='rail-empire-stockage-rc14.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  };
  overlay.append(panel);document.body.append(overlay);void refresh();closeBtn.focus();
}

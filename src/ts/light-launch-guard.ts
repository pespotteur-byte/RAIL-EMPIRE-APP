/** RC14 LIGHT entry guard. No storage read/write, network request or extra dependency. */
(():void=>{
  if(typeof document==='undefined'||typeof location==='undefined'||location.protocol!=='file:')return;
  const show=():void=>{
    const panel=document.createElement('main'),title=document.createElement('h1'),text=document.createElement('p');
    title.textContent='Rail Empire — lancer l’édition légère';
    text.textContent='Fermez cette page et lancez LANCER_RE.cmd dans le dossier extrait. Les fichiers du jeu sont précompressés : le serveur local les ouvre sans perdre de données. Adresse habituelle : http://127.0.0.1:8765/. Ne supprimez pas les données du navigateur.';
    Object.assign(panel.style,{maxWidth:'700px',margin:'50px auto',padding:'24px',font:'18px/1.6 sans-serif',color:'#eef2f7',background:'#18212b'});
    panel.append(title,text);document.body.replaceChildren(panel);document.title='Rail Empire — lancement local requis';
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
})();

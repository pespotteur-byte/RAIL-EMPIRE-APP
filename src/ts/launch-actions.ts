/** Small launch actions authored in TypeScript, not executable HTML attributes. */
export interface LaunchActions {
  confirm(message: string): boolean;
  navigate(url: string): void;
}
const bound = new WeakSet<EventTarget>();
export function bindLaunchActions(doc: Document, actions: LaunchActions = {
  confirm: message => window.confirm(message),
  navigate: url => { window.location.href = url; },
}): void {
  const admin = doc.getElementById('btn-admin');
  if (admin && !bound.has(admin)) {
    bound.add(admin);
    admin.addEventListener('click', () => {
      if (actions.confirm('⚠️ ZONE DANGEREUSE !\n\nUNIQUEMENT autorisé au créateur du jeu.\nMERCI DE NE PAS ALLER DESSUS.\n\nContinuer ?')) actions.navigate('admin.html');
    });
  }
  const close = doc.getElementById('btn-close-fiche-horaire');
  if (close && !bound.has(close)) {
    bound.add(close);
    close.addEventListener('click', () => doc.getElementById('modal-fiche-horaire')?.classList.add('hidden'));
  }
}

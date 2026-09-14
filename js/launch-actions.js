const bound = new WeakSet();
export function bindLaunchActions(doc, actions = {
    confirm: message => window.confirm(message),
    navigate: url => { window.location.href = url; },
}) {
    const admin = doc.getElementById('btn-admin');
    if (admin && !bound.has(admin)) {
        bound.add(admin);
        admin.addEventListener('click', () => {
            if (actions.confirm('⚠️ ZONE DANGEREUSE !\n\nUNIQUEMENT autorisé au créateur du jeu.\nMERCI DE NE PAS ALLER DESSUS.\n\nContinuer ?'))
                actions.navigate('admin.html');
        });
    }
    const close = doc.getElementById('btn-close-fiche-horaire');
    if (close && !bound.has(close)) {
        bound.add(close);
        close.addEventListener('click', () => doc.getElementById('modal-fiche-horaire')?.classList.add('hidden'));
    }
}

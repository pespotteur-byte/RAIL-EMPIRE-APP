/** Prevent user edits while an imported world awaits durable storage.
 * Simulation/autosave are independently paused by the caller. */
export function acquireImportUiLock() {
    if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function')
        return () => { };
    const dialog = document.createElement('dialog');
    dialog.setAttribute('data-re-import-lock', 'true');
    dialog.setAttribute('aria-label', 'Import de la partie');
    dialog.setAttribute('aria-live', 'polite');
    dialog.textContent = 'Import de la partie — validation et enregistrement en cours…';
    dialog.style.cssText = 'max-width:min(34rem,90vw);padding:24px;border:1px solid var(--border,#555);border-radius:10px;background:var(--bg2,#171b24);color:var(--text,#fff);font:inherit;';
    const cancel = (event) => event.preventDefault();
    dialog.addEventListener('cancel', cancel);
    document.body.appendChild(dialog);
    let fallback = false;
    const blockKeys = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    try {
        dialog.showModal();
    }
    catch {
        // Legacy browser fallback: opaque interaction shield plus keyboard capture.
        fallback = true;
        dialog.setAttribute('open', '');
        dialog.style.cssText += 'position:fixed;inset:0;width:100vw;max-width:none;height:100vh;box-sizing:border-box;z-index:2147483647;pointer-events:auto;';
        document.addEventListener('keydown', blockKeys, true);
    }
    return () => {
        if (fallback)
            document.removeEventListener('keydown', blockKeys, true);
        dialog.removeEventListener('cancel', cancel);
        try {
            if (dialog.open)
                dialog.close();
        }
        catch { /* legacy dialog shim */ }
        dialog.remove();
    };
}

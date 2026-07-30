/**
 * html-utils — small escaping helpers for safe innerHTML/template usage.
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

export function escapeAttribute(value) {
  // Same as escapeHtml; intended for double-quoted HTML attributes.
  return escapeHtml(value);
}

export function jsString(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Non-blocking toast notification. Falls back to a console warning in Node.
 */
export function showToast(message, type = 'info', duration = 3000) {
  if (typeof document === 'undefined') {
    if (typeof console !== 'undefined' && console.warn) console.warn(message);
    return;
  }
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const bg = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';
  const toast = document.createElement('div');
  toast.style.cssText = `padding:10px 14px;border-radius:6px;background:${bg};color:#fff;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:320px;pointer-events:none;transition:opacity .3s;opacity:1;`;
  toast.textContent = message;
  container.appendChild(toast);
  const remove = () => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  };
  if (duration > 0) setTimeout(remove, duration);
  return toast;
}

/**
 * Replaces legacy alert() calls: non-blocking toast with type inferred from message.
 */
export function alertToast(message) {
  const text = String(message).toLowerCase();
  let type = 'warning';
  if (/erreur|impossible|invalide|insuffisant|atteinte|doit être|doivent être|fermee|fermée|failed/.test(text)) type = 'error';
  else if (/succès|succes|chargee|chargée|réussie|reussie|créée|creee|créé|cree|ajouté|ajoute|enregistré|enregistre/.test(text)) type = 'info';
  return showToast(message, type);
}

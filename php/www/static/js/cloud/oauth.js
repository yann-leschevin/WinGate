// Connexion OAuth 2.0 dans une petite fenêtre (pop-up), sans bibliothèque.
//
// La fenêtre de connexion revient sur « oauth.html » (même site), qui transmet
// le résultat à WinGate par BroadcastChannel ET par localStorage : les pages de
// connexion de Google / Microsoft coupent souvent le lien « window.opener »
// (en-tête Cross-Origin-Opener-Policy), on ne s'appuie donc pas dessus.

const CHANNEL = 'wingate-oauth';

export class AuthError extends Error {}

/** Adresse de retour à déclarer chez Google et Microsoft. */
export function redirectUri() {
  return new URL('../../../oauth.html', import.meta.url).href;
}

export function randomString(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(a);
}

function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PKCE (RFC 7636) : vérificateur et défi S256. */
export async function pkcePair() {
  const verifier = randomString(48);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/**
 * Ouvre la fenêtre de connexion. À appeler DIRECTEMENT dans le gestionnaire du
 * clic (sinon Safari et les autres bloquent la fenêtre) ; l'adresse de connexion
 * est fixée ensuite avec popup.go(url).
 */
export function openPopup() {
  const w = 520;
  const hgt = 680;
  const left = Math.max(0, Math.round((screen.width - w) / 2));
  const top = Math.max(0, Math.round((screen.height - hgt) / 2));
  const win = window.open('', 'wingate-oauth', `popup,width=${w},height=${hgt},left=${left},top=${top}`);
  if (!win) {
    throw new AuthError('La fenêtre de connexion a été bloquée : autorisez les fenêtres surgissantes (pop-up) pour ce site, puis réessayez.');
  }
  try {
    win.document.title = 'Connexion…';
    win.document.body.style.font = '15px system-ui, sans-serif';
    win.document.body.textContent = 'Ouverture de la page de connexion…';
  } catch { /* fenêtre déjà sur un autre site */ }
  return {
    go(url) { win.location.href = url; },
    close() { try { win.close(); } catch { /* déjà fermée */ } },
  };
}

/**
 * Attend le retour de oauth.html pour l'« état » donné (anti-falsification).
 * Renvoie { promise, cancel } ; la promesse donne les paramètres reçus.
 */
export function waitForRedirect(state, { timeout = 5 * 60 * 1000 } = {}) {
  let done;
  let fail;
  const promise = new Promise((resolve, reject) => { done = resolve; fail = reject; });
  let channel = null;
  const finish = () => {
    clearTimeout(timer);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('message', onMessage);
    try { channel?.close(); } catch { /* déjà fermé */ }
  };
  const handle = (raw) => {
    let data;
    try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
    if (!data || data.type !== CHANNEL || !data.params || data.params.state !== state) return;
    finish();
    try { localStorage.removeItem(CHANNEL); } catch { /* sans importance */ }
    const p = data.params;
    if (p.error) {
      const msg = p.error === 'access_denied' || p.error === 'consent_required'
        ? 'Connexion annulée.'
        : `Connexion refusée : ${p.error_description || p.error}`;
      fail(new AuthError(msg));
    } else {
      done(p);
    }
  };
  const onStorage = (e) => { if (e.key === CHANNEL && e.newValue) handle(e.newValue); };
  const onMessage = (e) => { if (e.origin === location.origin) handle(e.data); };
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => handle(e.data);
  } catch { /* navigateur ancien : localStorage suffit */ }
  window.addEventListener('storage', onStorage);
  window.addEventListener('message', onMessage);
  const timer = setTimeout(() => { finish(); fail(new AuthError('Délai de connexion dépassé.')); }, timeout);
  return {
    promise,
    cancel() { finish(); fail(new AuthError('Connexion annulée.')); },
  };
}

// ---------------------------------------------------------------- jetons
// Gardés dans le navigateur du visiteur uniquement (rien n'est envoyé à
// leschevin.com). Les pages .html / .wapp ouvertes dans WinGate tournent dans
// des bacs à sable sans accès à ce stockage.
const KEY = (id) => `wingate.cloud.${id}`;

export function loadSession(id) {
  try { return JSON.parse(localStorage.getItem(KEY(id)) || 'null'); } catch { return null; }
}

export function saveSession(id, session) {
  try {
    if (session) localStorage.setItem(KEY(id), JSON.stringify(session));
    else localStorage.removeItem(KEY(id));
  } catch { /* stockage indisponible : la session durera le temps de la page */ }
}

/** Appel HTTP avec message d'erreur lisible. */
export async function httpJson(url, options = {}) {
  let resp;
  try {
    resp = await fetch(url, options);
  } catch {
    throw new Error('Service injoignable : vérifiez la connexion à Internet.');
  }
  if (resp.status === 204) return null;
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!resp.ok) {
    const err = new Error(apiMessage(data) || `Erreur ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return data;
}

export function apiMessage(data) {
  if (!data) return '';
  if (typeof data.error === 'string') return data.error_description || data.error;
  return data.error?.message || '';
}

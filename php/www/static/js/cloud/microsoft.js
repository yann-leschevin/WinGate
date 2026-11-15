// Microsoft OneDrive (API Microsoft Graph) — accès « dossier d'application » :
// WinGate ne voit QUE son dossier « Applications › WinGate » du OneDrive.
// Connexion par code d'autorisation + PKCE (application monopage, sans secret).
import { CLOUD_CONFIG } from './config.js';
import {
  AuthError, apiMessage, httpJson, loadSession, pkcePair, randomString, redirectUri, saveSession, waitForRedirect,
} from './oauth.js';

const LOGIN = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPE = 'Files.ReadWrite.AppFolder User.Read offline_access';
const SIMPLE_MAX = 4 * 1024 * 1024;     // limite de l'envoi simple de Graph
const CHUNK = 10 * 320 * 1024;          // morceaux multiples de 320 Kio

let session = loadSession('microsoft');
let rootId = null;
let pending = null;
let refreshing = null;

const enc = (name) => encodeURIComponent(name);

function signOutLocal() {
  session = null;
  rootId = null;
  saveSession('microsoft', null);
}

async function tokenRequest(fields) {
  const body = new URLSearchParams({ client_id: CLOUD_CONFIG.microsoft.clientId, scope: SCOPE, ...fields });
  let data;
  try {
    data = await httpJson(`${LOGIN}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
  } catch (err) {
    if (err.status === 400 || err.status === 401) {
      signOutLocal();
      throw new AuthError('La session Microsoft a expiré : reconnectez-vous.');
    }
    throw err;
  }
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || session?.refresh_token || '',
    expires_at: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000,
    account: session?.account || '',
  };
  saveSession('microsoft', session);
  return session.access_token;
}

async function token() {
  if (!session?.access_token) throw new AuthError('Non connecté à OneDrive.');
  if (Date.now() < session.expires_at) return session.access_token;
  if (!session.refresh_token) { signOutLocal(); throw new AuthError('La session Microsoft a expiré : reconnectez-vous.'); }
  refreshing ||= tokenRequest({ grant_type: 'refresh_token', refresh_token: session.refresh_token })
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function call(path, options = {}, retry = true) {
  const url = path.startsWith('https://') ? path : `${GRAPH}${path}`;
  const headers = { Authorization: `Bearer ${await token()}`, ...(options.headers || {}) };
  try {
    return await httpJson(url, { ...options, headers });
  } catch (err) {
    if (err.status === 401 && retry && session?.refresh_token) {
      session.expires_at = 0; // jeton refusé : on en redemande un
      return call(path, options, false);
    }
    if (err.status === 401) { signOutLocal(); throw new AuthError('La session Microsoft a expiré : reconnectez-vous.'); }
    throw err;
  }
}

function toItem(f) {
  const dir = Boolean(f.folder);
  return {
    id: f.id,
    name: f.name,
    dir,
    size: dir ? null : Number(f.size || 0),
    modified: f.lastModifiedDateTime ? Date.parse(f.lastModifiedDateTime) : null,
    unsupported: !dir && !f.file,
  };
}

export const microsoft = {
  id: 'microsoft',
  name: 'OneDrive',
  folderLabel: 'OneDrive › Applications › WinGate',
  configured: () => Boolean(CLOUD_CONFIG.microsoft.clientId),
  connected: () => Boolean(session?.access_token && (Date.now() < session.expires_at || session.refresh_token)),
  account: () => session?.account || '',

  async signIn(popup) {
    const state = randomString(16);
    const { verifier, challenge } = await pkcePair();
    const params = new URLSearchParams({
      client_id: CLOUD_CONFIG.microsoft.clientId,
      response_type: 'code',
      redirect_uri: redirectUri(),
      response_mode: 'query',
      scope: SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    pending = waitForRedirect(state);
    popup.go(`${LOGIN}/authorize?${params}`);
    try {
      const p = await pending.promise;
      if (!p.code) throw new AuthError('Réponse de connexion incomplète.');
      session = null;
      rootId = null;
      await tokenRequest({ grant_type: 'authorization_code', code: p.code, redirect_uri: redirectUri(), code_verifier: verifier });
      try {
        const me = await call('/me?$select=displayName,userPrincipalName,mail');
        session.account = me.mail || me.userPrincipalName || me.displayName || '';
        saveSession('microsoft', session);
      } catch { /* nom du compte facultatif */ }
    } finally {
      pending = null;
      popup.close();
    }
  },
  cancelSignIn: () => pending?.cancel(),

  async signOut() { signOutLocal(); },

  /** Dossier d'application (Applications › WinGate), créé par OneDrive au besoin. */
  async root() {
    if (!rootId) rootId = (await call('/me/drive/special/approot?$select=id')).id;
    return rootId;
  },

  async list(folderId) {
    const items = [];
    let url = `/me/drive/items/${enc(folderId)}/children?$select=id,name,size,folder,file,lastModifiedDateTime&$top=200`;
    while (url) {
      const data = await call(url);
      items.push(...(data.value || []).map(toItem));
      url = data['@odata.nextLink'] || '';
    }
    return items.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'fr'));
  },

  async mkdir(parentId, name) {
    try {
      return (await call(`/me/drive/items/${enc(parentId)}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
      })).id;
    } catch (err) {
      if (err.status !== 409) throw err;
      return (await call(`/me/drive/items/${enc(parentId)}:/${enc(name)}?$select=id`)).id; // existe déjà
    }
  },

  /** Dépose un fichier ; un fichier du même nom est remplacé. */
  async upload(parentId, name, blob) {
    const target = `/me/drive/items/${enc(parentId)}:/${enc(name)}:`;
    if (blob.size <= SIMPLE_MAX) {
      return call(`${target}/content?@microsoft.graph.conflictBehavior=replace`, {
        method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: blob,
      });
    }
    const { uploadUrl } = await call(`${target}/createUploadSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    });
    let last = null;
    for (let start = 0; start < blob.size; start += CHUNK) {
      const end = Math.min(start + CHUNK, blob.size);
      // Pas d'en-tête Authorization vers l'adresse de session (exigence de Graph)
      const resp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes ${start}-${end - 1}/${blob.size}` },
        body: blob.slice(start, end),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(apiMessage(data) || `Envoi refusé par OneDrive (erreur ${resp.status}).`);
      }
      last = resp;
    }
    return last ? last.json().catch(() => null) : null;
  },

  async download(item) {
    // L'adresse de téléchargement est pré-signée : pas d'en-tête Authorization
    const info = await call(`/me/drive/items/${enc(item.id)}`);
    const url = info['@microsoft.graph.downloadUrl'];
    if (!url) throw new Error(`« ${item.name} » ne peut pas être téléchargé.`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Téléchargement refusé par OneDrive (erreur ${resp.status}).`);
    return resp.blob();
  },

  /** Mise à la corbeille de OneDrive (récupérable). */
  async remove(item) {
    await call(`/me/drive/items/${enc(item.id)}`, { method: 'DELETE' });
  },
};

// Google Drive (API v3) — accès « drive.file » : WinGate ne voit QUE les
// fichiers qu'il a lui-même déposés, rangés dans un dossier « WinGate » à la
// racine du Drive. Il n'a aucun accès au reste du Drive de l'utilisateur.
import { CLOUD_CONFIG } from './config.js';
import {
  AuthError, httpJson, loadSession, randomString, redirectUri, saveSession, waitForRedirect,
} from './oauth.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const ROOT_NAME = 'WinGate';
const SIMPLE_MAX = 5 * 1024 * 1024; // au-delà : envoi « reprenable »

let session = loadSession('google');
let rootId = null;
let pending = null;

const q = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function token() {
  if (!session?.access_token) throw new AuthError('Non connecté à Google Drive.');
  if (Date.now() > session.expires_at) {
    signOutLocal();
    throw new AuthError('La session Google a expiré : reconnectez-vous.');
  }
  return session.access_token;
}

function signOutLocal() {
  session = null;
  rootId = null;
  saveSession('google', null);
}

async function call(url, options = {}) {
  const headers = { Authorization: `Bearer ${token()}`, ...(options.headers || {}) };
  try {
    return await httpJson(url, { ...options, headers });
  } catch (err) {
    if (err.status === 401) {
      signOutLocal();
      throw new AuthError('La session Google a expiré : reconnectez-vous.');
    }
    throw err;
  }
}

function toItem(f) {
  const dir = f.mimeType === FOLDER;
  return {
    id: f.id,
    name: f.name,
    dir,
    size: dir ? null : Number(f.size || 0),
    modified: f.modifiedTime ? Date.parse(f.modifiedTime) : null,
    // Documents Google (Docs, Sheets…) : pas de contenu binaire à importer
    unsupported: !dir && f.mimeType.startsWith('application/vnd.google-apps.'),
  };
}

async function findChild(parentId, name, folder) {
  const query = `name='${q(name)}' and '${q(parentId)}' in parents and trashed=false and mimeType${folder ? '=' : '!='}'${FOLDER}'`;
  const data = await call(`${API}/files?${new URLSearchParams({ q: query, fields: 'files(id,name,mimeType,size,modifiedTime)', spaces: 'drive', pageSize: '10' })}`);
  return data.files?.[0] || null;
}

function multipartBody(metadata, blob) {
  const boundary = `wingate${randomString(12)}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  return { body, type: `multipart/related; boundary=${boundary}` };
}

async function resumable(method, url, metadata, blob) {
  const auth = { Authorization: `Bearer ${token()}` };
  const init = await fetch(url, {
    method,
    headers: { ...auth, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': blob.type || 'application/octet-stream' },
    body: JSON.stringify(metadata),
  });
  if (init.status === 401) { signOutLocal(); throw new AuthError('La session Google a expiré : reconnectez-vous.'); }
  if (!init.ok) throw new Error(`Envoi refusé par Google Drive (erreur ${init.status}).`);
  const location = init.headers.get('Location');
  if (!location) throw new Error('Google Drive n\'a pas fourni d\'adresse d\'envoi.');
  return httpJson(location, { method: 'PUT', body: blob });
}

export const google = {
  id: 'google',
  name: 'Google Drive',
  folderLabel: 'Mon Drive › WinGate',
  configured: () => Boolean(CLOUD_CONFIG.google.clientId),
  connected: () => Boolean(session?.access_token && Date.now() < session.expires_at),
  account: () => session?.account || '',

  /** popup : objet renvoyé par openPopup(), ouvert dans le clic. */
  async signIn(popup) {
    const state = randomString(16);
    const params = new URLSearchParams({
      client_id: CLOUD_CONFIG.google.clientId,
      redirect_uri: redirectUri(),
      response_type: 'token',
      scope: SCOPE,
      include_granted_scopes: 'true',
      state,
    });
    pending = waitForRedirect(state);
    popup.go(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    try {
      const p = await pending.promise;
      if (!p.access_token) throw new AuthError('Réponse de connexion incomplète.');
      session = { access_token: p.access_token, expires_at: Date.now() + (Number(p.expires_in || 3600) - 60) * 1000, account: '' };
      rootId = null;
      try {
        const about = await call(`${API}/about?fields=user(displayName,emailAddress)`);
        session.account = about.user?.emailAddress || about.user?.displayName || '';
      } catch { /* nom du compte facultatif */ }
      saveSession('google', session);
    } finally {
      pending = null;
      popup.close();
    }
  },
  cancelSignIn: () => pending?.cancel(),

  async signOut() {
    const t = session?.access_token;
    signOutLocal();
    if (t) {
      // Révocation côté Google (sans attendre ni échouer si hors ligne)
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, { method: 'POST' }).catch(() => {});
    }
  },

  /** Dossier « WinGate » à la racine du Drive (créé au besoin). */
  async root() {
    if (rootId) return rootId;
    const found = await findChild('root', ROOT_NAME, true);
    rootId = found ? found.id : (await call(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ROOT_NAME, mimeType: FOLDER, parents: ['root'] }),
    })).id;
    return rootId;
  },

  async list(folderId) {
    const items = [];
    let pageToken = '';
    do {
      const params = new URLSearchParams({
        q: `'${q(folderId)}' in parents and trashed=false`,
        fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
        orderBy: 'folder,name', pageSize: '1000', spaces: 'drive',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await call(`${API}/files?${params}`);
      items.push(...(data.files || []).map(toItem));
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    return items;
  },

  /** Dossier enfant (réutilisé s'il existe déjà). */
  async mkdir(parentId, name) {
    const found = await findChild(parentId, name, true);
    if (found) return found.id;
    return (await call(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
    })).id;
  },

  /** Dépose un fichier ; un fichier du même nom est remplacé (nouvelle version). */
  async upload(parentId, name, blob) {
    const existing = await findChild(parentId, name, false);
    if (blob.size <= SIMPLE_MAX) {
      if (existing) {
        return call(`${UPLOAD}/files/${encodeURIComponent(existing.id)}?uploadType=media&fields=id`, {
          method: 'PATCH', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob,
        });
      }
      const { body, type } = multipartBody({ name, parents: [parentId] }, blob);
      return call(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': type }, body });
    }
    return existing
      ? resumable('PATCH', `${UPLOAD}/files/${encodeURIComponent(existing.id)}?uploadType=resumable&fields=id`, {}, blob)
      : resumable('POST', `${UPLOAD}/files?uploadType=resumable&fields=id`, { name, parents: [parentId] }, blob);
  },

  async download(item) {
    if (item.unsupported) throw new Error(`« ${item.name} » est un document Google : ouvrez-le dans Google Drive pour l'exporter.`);
    const resp = await fetch(`${API}/files/${encodeURIComponent(item.id)}?alt=media`, { headers: { Authorization: `Bearer ${token()}` } });
    if (resp.status === 401) { signOutLocal(); throw new AuthError('La session Google a expiré : reconnectez-vous.'); }
    if (!resp.ok) throw new Error(`Téléchargement refusé par Google Drive (erreur ${resp.status}).`);
    return resp.blob();
  },

  /** Mise à la corbeille du Drive (récupérable pendant 30 jours). */
  async remove(item) {
    await call(`${API}/files/${encodeURIComponent(item.id)}?fields=id`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
    });
  },
};

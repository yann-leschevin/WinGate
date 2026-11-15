// Copies entre WinGate (fichiers du navigateur) et un stockage en ligne.
import { api } from '../api.js';
import { fsChanged } from '../bus.js';
import * as fs from '../localfs.js';
import { basename } from '../utils.js';

const MAX_IMPORT = fs.MAX_UPLOAD_MB * 1024 * 1024;

/** Liste récursive des fichiers d'une sélection WinGate : [{path, rel, size}] + dossiers. */
async function collectLocal(paths) {
  const files = [];
  const dirs = [];
  async function walk(path, rel) {
    const info = await api.stat(path);
    if (info.type === 'dir') {
      dirs.push(rel);
      for (const child of await api.list(path)) await walk(child.path, `${rel}/${child.name}`);
    } else {
      files.push({ path, rel, size: info.size || 0 });
    }
  }
  for (const p of paths) await walk(p, basename(p));
  return { files, dirs };
}

/**
 * Envoie des fichiers / dossiers WinGate dans le dossier `folderId` du service.
 * onProgress(texte, ratio)
 */
export async function sendLocal(provider, paths, folderId, onProgress = () => {}) {
  const { files, dirs } = await collectLocal(paths);
  const total = files.reduce((s, f) => s + f.size, 0) || 1;
  const ids = new Map([['', folderId]]);
  const folderOf = async (relDir) => {
    if (ids.has(relDir)) return ids.get(relDir);
    const cut = relDir.lastIndexOf('/');
    const parent = await folderOf(cut < 0 ? '' : relDir.slice(0, cut));
    const id = await provider.mkdir(parent, relDir.slice(cut + 1));
    ids.set(relDir, id);
    return id;
  };
  for (const d of dirs) await folderOf(d); // dossiers vides compris
  let sent = 0;
  for (const f of files) {
    onProgress(`Envoi de « ${basename(f.path)} »…`, sent / total);
    const cut = f.rel.lastIndexOf('/');
    const parent = await folderOf(cut < 0 ? '' : f.rel.slice(0, cut));
    await provider.upload(parent, f.rel.slice(cut + 1), await fs.readBlob(f.path));
    sent += f.size;
  }
  onProgress('Envoi terminé.', 1);
  return { files: files.length, bytes: sent };
}

/** Envoie des fichiers de l'appareil (sélecteur du système) dans le service. */
export async function sendDeviceFiles(provider, files, folderId, onProgress = () => {}) {
  const total = files.reduce((s, f) => s + f.size, 0) || 1;
  let sent = 0;
  for (const file of files) {
    onProgress(`Envoi de « ${file.name} »…`, sent / total);
    await provider.upload(folderId, file.name, file);
    sent += file.size;
  }
  onProgress('Envoi terminé.', 1);
  return { files: files.length, bytes: sent };
}

/** Télécharge des éléments du service (fichiers et dossiers) : [{file, relpath}]. */
export async function fetchRemote(provider, items, onProgress = () => {}) {
  const out = [];
  let bytes = 0;
  async function walk(item, rel) {
    if (item.dir) {
      for (const child of await provider.list(item.id)) await walk(child, `${rel}/${child.name}`);
      return;
    }
    if (item.unsupported) return;
    onProgress(`Téléchargement de « ${item.name} »…`);
    const blob = await provider.download(item);
    bytes += blob.size;
    if (bytes > MAX_IMPORT) throw new Error(`Import trop volumineux (maximum ${fs.MAX_UPLOAD_MB} Mo à la fois).`);
    out.push({ file: new File([blob], item.name, { type: blob.type }), relpath: rel });
  }
  for (const item of items) await walk(item, item.name);
  return out;
}

/** Importe des éléments du service dans un dossier WinGate. Renvoie les chemins créés. */
export async function importRemote(provider, items, dest = '/Téléchargements', onProgress = () => {}) {
  const files = await fetchRemote(provider, items, onProgress);
  if (!files.length) throw new Error('Rien à importer (dossier vide ou documents non téléchargeables).');
  onProgress('Enregistrement dans WinGate…');
  const paths = await api.upload(dest, files);
  fsChanged([dest]);
  return paths;
}

/** Importe des fichiers de l'appareil dans un dossier WinGate. */
export async function importDeviceFiles(files, dest = '/Téléchargements') {
  const paths = await api.upload(dest, files.map((file) => ({ file, relpath: file.name })));
  fsChanged([dest]);
  return paths;
}

/** Lit des fichiers WinGate (pas les dossiers) sous forme de File[], pour le partage. */
export async function readLocalFiles(paths) {
  const { files } = await collectLocal(paths);
  const out = [];
  for (const f of files) {
    const blob = await fs.readBlob(f.path);
    out.push(new File([blob], basename(f.path), { type: blob.type }));
  }
  return out;
}

// Stockage en ligne : Google Drive, OneDrive, et iCloud Drive / fichiers de
// l'appareil. Sert à faire passer des fichiers d'un appareil à l'autre
// (téléphone → ordinateur…) : on les dépose depuis l'un, on les reprend sur l'autre.
import { google } from '../cloud/google.js';
import { microsoft } from '../cloud/microsoft.js';
import { AuthError, openPopup, redirectUri } from '../cloud/oauth.js';
import { canShareFiles, pickDeviceFiles, saveFile, sendToDevice } from '../cloud/device.js';
import {
  importDeviceFiles, importRemote, readLocalFiles, sendDeviceFiles, sendLocal,
} from '../cloud/transfer.js';
import { showMenu } from '../contextMenu.js';
import { confirmDialog, fileDialog, promptDialog } from '../dialogs.js';
import { toast, toastError } from '../notify.js';
import { basename, formatSize, h, toWinPath } from '../utils.js';
import { createWindow, focusWindow } from '../windowManager.js';

const PROVIDERS = { google, microsoft };
const TABS = [
  ['google', 'Google Drive'],
  ['microsoft', 'OneDrive'],
  ['device', 'iCloud / appareil'],
];
const IMPORT_DIR = '/Téléchargements';

let current = null; // une seule fenêtre « Stockage en ligne »

function when(ms) {
  return ms ? new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}

function launch(args = {}) {
  if (current) {
    current.apply(args);
    focusWindow(current.win);
    return current.win;
  }
  const state = {
    tab: args.provider || localStorage.getItem('wingate.cloud.tab') || 'google',
    trail: {},        // provider -> [{id, name}] (chemin dans le dossier WinGate)
    pending: null,    // { paths: [...] } à envoyer, choisi depuis « Envoyer vers »
    prepared: null,   // File[] prêts à partager (iCloud / appareil)
    busy: false,
    signingIn: null,
  };
  const tabsBar = h('div', { class: 'cl-tabs', role: 'tablist' });
  const body = h('div', { class: 'cl-body' });
  const root = h('div', { class: 'cloud' }, tabsBar, body);
  const win = createWindow({
    appId: 'cloud', title: 'Stockage en ligne', icon: '☁️', width: 760, height: 560, minWidth: 360, minHeight: 360, content: root,
  });

  function setTab(id) {
    state.tab = id;
    try { localStorage.setItem('wingate.cloud.tab', id); } catch { /* sans importance */ }
    render();
  }

  function progressToast(title) {
    return toast(title, 'Préparation…', { icon: '☁️', timeout: 0, progress: true });
  }

  async function run(title, task) {
    if (state.busy) return null;
    state.busy = true;
    render();
    const t = progressToast(title);
    try {
      const result = await task((text, ratio) => t.update(text, ratio));
      t.later(3000);
      return result;
    } catch (err) {
      t.close();
      if (err instanceof AuthError) toastError(err.message, 'Connexion');
      else toastError(err.message || String(err), title);
      return null;
    } finally {
      state.busy = false;
      render();
    }
  }

  // ------------------------------------------------------------ rendu
  function render() {
    tabsBar.replaceChildren(...TABS.map(([id, label]) => h('button', {
      class: `cl-tab${state.tab === id ? ' active' : ''}`, type: 'button', role: 'tab',
      'aria-selected': state.tab === id ? 'true' : 'false',
      onclick: () => setTab(id),
    }, h('span', { class: `cl-dot cl-dot-${id}`, 'aria-hidden': 'true' }), label)));
    if (state.tab === 'device') renderDevice();
    else renderProvider(PROVIDERS[state.tab]);
  }

  function pendingBanner(provider) {
    if (!state.pending) return null;
    const n = state.pending.paths.length;
    const names = state.pending.paths.map(basename).join(', ');
    return h('div', { class: 'cl-banner' },
      h('div', { class: 'cl-banner-text' },
        h('strong', { text: `${n} élément${n > 1 ? 's' : ''} à envoyer` }),
        h('span', { text: names })),
      h('div', { class: 'cl-banner-actions' },
        provider ? h('button', {
          class: 'btn primary', type: 'button', disabled: state.busy || !provider.connected(),
          text: 'Envoyer ici', title: 'Envoyer dans le dossier affiché', onclick: () => sendPending(provider),
        }) : null,
        h('button', { class: 'btn', type: 'button', text: 'Annuler', onclick: () => { state.pending = null; state.prepared = null; render(); } })));
  }

  function renderProvider(p) {
    const parts = [pendingBanner(p)];
    if (!p.configured()) {
      parts.push(h('div', { class: 'cl-empty' },
        h('div', { class: 'cl-big', text: '🔧' }),
        h('h3', { text: `${p.name} n'est pas encore configuré` }),
        h('p', { text: `Le propriétaire du site doit déclarer WinGate auprès de ${p.id === 'google' ? 'Google' : 'Microsoft'} et inscrire l'identifiant obtenu dans static/js/cloud/config.js (voir le fichier README).` }),
        h('p', { class: 'cl-small', text: `Adresse de retour à déclarer : ${redirectUri()}` })));
      body.replaceChildren(...parts.filter(Boolean));
      return;
    }
    if (!p.connected()) {
      parts.push(h('div', { class: 'cl-empty' },
        h('div', { class: 'cl-big', text: '☁️' }),
        h('h3', { text: `Se connecter à ${p.name}` }),
        h('p', { text: `Déposez des fichiers depuis un appareil et reprenez-les sur un autre : votre téléphone et votre ordinateur, par exemple, connectés au même compte.` }),
        h('p', { class: 'cl-small', text: `WinGate n'a accès qu'à son propre dossier (${p.folderLabel}), jamais au reste de vos fichiers. La connexion reste dans ce navigateur.` }),
        state.signingIn === p.id
          ? h('div', { class: 'cl-row' },
            h('span', { class: 'cl-wait', text: 'Connexion en cours dans la fenêtre ouverte…' }),
            h('button', { class: 'btn', type: 'button', text: 'Annuler', onclick: () => p.cancelSignIn() }))
          : h('button', { class: 'btn primary cl-connect', type: 'button', text: `Se connecter à ${p.name}`, onclick: () => signIn(p) })));
      body.replaceChildren(...parts.filter(Boolean));
      return;
    }

    const trail = state.trail[p.id] || [];
    const crumbs = h('div', { class: 'cl-crumbs' },
      h('button', { class: 'cl-crumb', type: 'button', text: 'WinGate', onclick: () => { state.trail[p.id] = []; render(); } }),
      ...trail.flatMap((f, i) => ['›', h('button', {
        class: 'cl-crumb', type: 'button', text: f.name,
        onclick: () => { state.trail[p.id] = trail.slice(0, i + 1); render(); },
      })]));
    const list = h('div', { class: 'cl-list', role: 'list' }, h('div', { class: 'cl-note', text: 'Chargement…' }));
    parts.push(
      h('div', { class: 'cl-account' },
        h('span', { class: 'cl-who', text: `Connecté${p.account() ? ` : ${p.account()}` : ''}` }),
        h('button', { class: 'btn flat', type: 'button', text: 'Se déconnecter', onclick: () => signOut(p) })),
      h('div', { class: 'cl-toolbar' },
        h('button', { class: 'btn', type: 'button', disabled: state.busy, text: '⬆️ Depuis WinGate…', title: 'Envoyer un fichier de WinGate dans ce dossier', onclick: () => sendFromWinGate(p) }),
        h('button', { class: 'btn', type: 'button', disabled: state.busy, text: '📱 Depuis l\'appareil…', title: 'Envoyer des fichiers de ce téléphone / cet ordinateur', onclick: () => sendFromDevice(p) }),
        h('button', { class: 'btn', type: 'button', disabled: state.busy, text: '📁 Nouveau dossier', onclick: () => newFolder(p) }),
        h('button', { class: 'btn icon', type: 'button', title: 'Actualiser', text: '⟳', onclick: () => render() })),
      crumbs,
      list,
      h('div', { class: 'cl-note', text: `Cliquer (ou toucher) un fichier pour l'importer dans WinGate (dossier ${toWinPath(IMPORT_DIR)}) ou l'enregistrer sur cet appareil.` }));
    body.replaceChildren(...parts.filter(Boolean));
    fillList(p, list);
  }

  async function folderId(p) {
    const trail = state.trail[p.id] || [];
    return trail.length ? trail[trail.length - 1].id : p.root();
  }

  async function fillList(p, list) {
    const tab = state.tab;
    try {
      const items = await p.list(await folderId(p));
      if (state.tab !== tab || !list.isConnected) return;
      list.replaceChildren();
      if (!items.length) list.append(h('div', { class: 'cl-note', text: 'Ce dossier est vide. Envoyez-y des fichiers depuis un appareil pour les retrouver sur un autre.' }));
      for (const item of items) list.append(row(p, item));
    } catch (err) {
      if (!list.isConnected) return;
      if (err instanceof AuthError) { render(); toastError(err.message, 'Connexion'); return; }
      list.replaceChildren(h('div', { class: 'cl-note cl-error', text: err.message }));
    }
  }

  function row(p, item) {
    const menu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      showMenu(e.clientX || r.left, e.clientY || r.bottom, itemMenu(p, item));
    };
    const node = h('div', { class: `cl-item${item.unsupported ? ' unsupported' : ''}`, role: 'listitem', tabindex: '0' },
      h('span', { class: 'cl-ico', text: item.dir ? '📁' : '📄' }),
      h('span', { class: 'cl-name', text: item.name }),
      h('span', { class: 'cl-meta', text: item.dir ? '' : `${formatSize(item.size)} · ${when(item.modified)}` }),
      h('button', { class: 'cl-more', type: 'button', title: 'Actions', 'aria-label': `Actions pour ${item.name}`, text: '⋯', onclick: menu }));
    node.addEventListener('click', (e) => {
      if (item.dir) { state.trail[p.id] = [...(state.trail[p.id] || []), { id: item.id, name: item.name }]; render(); }
      else menu(e);
    });
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') node.click(); });
    node.addEventListener('contextmenu', menu);
    return node;
  }

  function itemMenu(p, item) {
    const items = [];
    if (item.dir) items.push({ label: 'Ouvrir', icon: '📂', action: () => { state.trail[p.id] = [...(state.trail[p.id] || []), { id: item.id, name: item.name }]; render(); } });
    items.push({
      label: item.dir ? 'Importer le dossier dans WinGate' : 'Importer dans WinGate', icon: '⬇️',
      disabled: item.unsupported || state.busy,
      action: () => run('Import dans WinGate', async (progress) => {
        const paths = await importRemote(p, [item], IMPORT_DIR, progress);
        progress(`Copié dans ${toWinPath(paths[0] || IMPORT_DIR)}`, 1);
      }),
    });
    if (!item.dir) {
      items.push({
        label: 'Enregistrer sur cet appareil', icon: '💾', disabled: item.unsupported || state.busy,
        action: () => run('Téléchargement', async (progress) => {
          progress(`Téléchargement de « ${item.name} »…`);
          saveFile(await p.download(item), item.name);
          progress('Fichier enregistré (dossier Téléchargements de l\'appareil).', 1);
        }),
      });
    }
    items.push({ separator: true }, {
      label: 'Supprimer', icon: '🗑️', disabled: state.busy,
      action: async () => {
        const ok = await confirmDialog(`Mettre « ${item.name} » à la corbeille de ${p.name} ?`, { title: 'Supprimer', icon: '🗑️', danger: true });
        if (ok) run('Suppression', async (progress) => { await p.remove(item); progress('Placé dans la corbeille du service.', 1); });
      },
    });
    return items;
  }

  // ------------------------------------------------------------ actions
  function signIn(p) {
    let popup;
    try {
      popup = openPopup(); // tout de suite, dans le clic
    } catch (err) {
      toastError(err.message, 'Connexion');
      return;
    }
    state.signingIn = p.id;
    render();
    p.signIn(popup).then(
      () => toast(`${p.name} connecté`, p.account(), { icon: '☁️' }),
      (err) => { if (err.message !== 'Connexion annulée.') toastError(err.message, 'Connexion'); },
    ).finally(() => {
      state.signingIn = null;
      if (current) render();
    });
  }

  async function signOut(p) {
    await p.signOut();
    state.trail[p.id] = [];
    render();
  }

  async function newFolder(p) {
    const name = await promptDialog('Nom du nouveau dossier :', 'Nouveau dossier', { title: p.name, icon: '📁' });
    if (!name || !name.trim()) return;
    run('Nouveau dossier', async (progress) => { await p.mkdir(await folderId(p), name.trim()); progress('Dossier créé.', 1); });
  }

  async function sendFromWinGate(p) {
    const path = await fileDialog({ mode: 'open', title: `Envoyer vers ${p.name}`, startDir: '/Documents' });
    if (!path) return;
    state.pending = { paths: [path] };
    sendPending(p);
  }

  function sendFromDevice(p) {
    const picked = pickDeviceFiles(); // dans le clic
    picked.then((files) => {
      if (!files.length) return;
      run(`Envoi vers ${p.name}`, async (progress) => {
        const r = await sendDeviceFiles(p, files, await folderId(p), progress);
        progress(`${r.files} fichier${r.files > 1 ? 's' : ''} envoyé${r.files > 1 ? 's' : ''} (${formatSize(r.bytes)}).`, 1);
      });
    });
  }

  function sendPending(p) {
    const { paths } = state.pending;
    run(`Envoi vers ${p.name}`, async (progress) => {
      const r = await sendLocal(p, paths, await folderId(p), progress);
      state.pending = null;
      progress(`${r.files} fichier${r.files > 1 ? 's' : ''} envoyé${r.files > 1 ? 's' : ''} (${formatSize(r.bytes)}).`, 1);
    });
  }

  // ------------------------------------------------------------ iCloud / appareil
  function renderDevice() {
    const shareOk = state.prepared && canShareFiles(state.prepared);
    body.replaceChildren(...[
      state.pending && !state.prepared ? h('div', { class: 'cl-note', text: 'Préparation des fichiers…' }) : null,
      h('div', { class: 'cl-device' },
        h('p', { class: 'cl-small', text: 'Apple ne permet pas aux sites web d\'accéder directement à iCloud Drive. WinGate passe donc par votre appareil : sur iPhone / iPad, l\'app « Fichiers » donne accès à iCloud Drive ; sur un PC, le dossier « iCloud Drive » d\'iCloud pour Windows.' }),
        h('section', { class: 'cl-card' },
          h('h3', { text: '📥 Importer dans WinGate' }),
          h('p', { text: `Choisissez des fichiers sur cet appareil (iCloud Drive, photos, dossiers…) : ils seront copiés dans ${toWinPath(IMPORT_DIR)}.` }),
          h('button', { class: 'btn primary', type: 'button', text: 'Choisir des fichiers…', onclick: importFromDevice })),
        h('section', { class: 'cl-card' },
          h('h3', { text: '📤 Envoyer depuis WinGate' }),
          state.prepared
            ? h('div', {},
              h('p', { text: `${state.prepared.length} fichier${state.prepared.length > 1 ? 's' : ''} prêt${state.prepared.length > 1 ? 's' : ''} : ${state.prepared.map((f) => f.name).join(', ')}` }),
              h('div', { class: 'cl-row' },
                h('button', { class: 'btn primary', type: 'button', text: shareOk ? 'Partager / Enregistrer dans Fichiers' : 'Télécharger sur cet appareil', onclick: shareNow }),
                h('button', { class: 'btn', type: 'button', text: 'Annuler', onclick: () => { state.prepared = null; state.pending = null; render(); } })))
            : h('div', {},
              h('p', { text: 'Sur iPhone, « Partager » propose « Enregistrer dans Fichiers » → iCloud Drive. Ailleurs, les fichiers sont téléchargés sur l\'appareil.' }),
              h('button', { class: 'btn', type: 'button', text: 'Choisir un fichier WinGate…', onclick: chooseToShare })))),
    ].filter(Boolean));
  }

  function importFromDevice() {
    pickDeviceFiles().then((files) => {
      if (!files.length) return;
      run('Import dans WinGate', async (progress) => {
        const paths = await importDeviceFiles(files, IMPORT_DIR);
        progress(`${paths.length} élément${paths.length > 1 ? 's' : ''} copié${paths.length > 1 ? 's' : ''} dans ${toWinPath(IMPORT_DIR)}.`, 1);
      });
    });
  }

  async function chooseToShare() {
    const path = await fileDialog({ mode: 'open', title: 'Fichier à envoyer vers l\'appareil', startDir: '/Documents' });
    if (path) prepare([path]);
  }

  /** Lit les fichiers à l'avance : le partage doit partir directement du clic suivant. */
  async function prepare(paths) {
    state.pending = { paths };
    state.prepared = null;
    render();
    try {
      const files = await readLocalFiles(paths);
      if (!files.length) throw new Error('Aucun fichier à envoyer (les dossiers vides sont ignorés).');
      state.prepared = files;
    } catch (err) {
      state.pending = null;
      toastError(err.message, 'Envoi vers l\'appareil');
    }
    render();
  }

  function shareNow() {
    const files = state.prepared;
    sendToDevice(files).then((how) => {
      if (how === 'cancelled') return;
      toast('Envoi vers l\'appareil', how === 'shared' ? 'Fichiers transmis au menu Partager.' : 'Fichiers téléchargés sur cet appareil.', { icon: '📤' });
      state.prepared = null;
      state.pending = null;
      render();
    });
  }

  // ------------------------------------------------------------ arguments
  function apply(a = {}) {
    if (a.provider) state.tab = a.provider;
    if (a.send?.length) {
      if (state.tab === 'device') { prepare(a.send); return; }
      state.pending = { paths: a.send };
    }
    render();
  }

  current = { win, apply };
  win.onDestroy = () => { current = null; };
  apply(args);
  return win;
}

export default {
  id: 'cloud', name: 'Stockage en ligne', icon: '☁️', launch,
  description: 'Google Drive, OneDrive, iCloud : copier des fichiers d\'un appareil à l\'autre',
};

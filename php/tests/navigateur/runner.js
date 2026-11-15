// Tests de la version « navigateur » de WinGate (IndexedDB, sql.js, .wapp, PE, service worker).
// Lancés par tests/test.sh dans Firefox sans fenêtre ; résultats envoyés à results.php.
import { api } from '../static/js/api.js';
import { srcdocForVfs, srcdocForWapp } from '../static/js/inline.js';

const results = [];
async function t(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: String(err?.message || err) });
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion'); };
const rejects = async (p, re) => {
  try { await p; } catch (err) {
    if (re && !re.test(err.message)) throw new Error(`message inattendu : ${err.message}`);
    return;
  }
  throw new Error('aurait dû échouer');
};

async function swReady() {
  const root = new URL('../', import.meta.url);
  await navigator.serviceWorker.register(new URL('sw.js', root), { scope: root.pathname });
  if (!navigator.serviceWorker.controller) {
    await new Promise((r) => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 5000); });
  }
  return Boolean(navigator.serviceWorker.controller);
}

// En-tête PE minimal : MZ + PE32+ x64, 1 section .text
function fakePe() {
  const b = new Uint8Array(1024);
  const v = new DataView(b.buffer);
  b[0] = 0x4d; b[1] = 0x5a; v.setUint32(0x3c, 0x80, true);
  b.set([0x50, 0x45, 0, 0], 0x80);
  const coff = 0x84;
  v.setUint16(coff, 0x8664, true); v.setUint16(coff + 2, 1, true); v.setUint32(coff + 4, 1700000000, true);
  v.setUint16(coff + 16, 240, true); v.setUint16(coff + 18, 0x0022, true);
  const opt = coff + 20;
  v.setUint16(opt, 0x20b, true); v.setUint32(opt + 16, 0x1234, true); v.setBigUint64(opt + 24, 0x140000000n, true);
  v.setUint16(opt + 68, 2, true); v.setUint16(opt + 70, 0x0160, true); v.setUint32(opt + 108, 16, true);
  const sec = opt + 240;
  b.set([0x2e, 0x74, 0x65, 0x78, 0x74], sec); v.setUint32(sec + 36, 0x60000020, true);
  return new Blob([b]);
}

(async () => {
  await t('dossiers par défaut', async () => {
    const names = (await api.list('/')).map((e) => e.name);
    for (const n of ['Bureau', 'Documents', 'Images', 'Téléchargements', 'Programmes', 'Corbeille']) assert(names.includes(n), n);
  });
  await t('fichier Bienvenue.txt', async () => {
    const r = await api.read('/Documents/Bienvenue.txt');
    assert(r.content.includes('Bienvenue dans WinGate') && r.encoding === 'utf-8');
  });
  await t('exemples installés', async () => {
    const names = (await api.list('/Programmes/Exemples')).map((e) => e.name).sort().join(',');
    assert(names === 'bonjour.html,demo.js,horloge.wapp,serpent.wapp', names);
  });
  await t('créer / écrire / relire (accents, taille en octets)', async () => {
    const e = await api.create('/Documents', 'Été.txt', 'file', 'çà');
    assert(e.path === '/Documents/Été.txt' && e.size === 4, JSON.stringify(e));
    await api.write('/Documents/Été.txt', 'Bonjour é');
    assert((await api.read('/Documents/Été.txt')).content === 'Bonjour é');
    assert((await api.stat('/Documents/Été.txt')).size === 10);
  });
  await t('nom en double -> (2)', async () => {
    const e = await api.create('/Documents', 'Été.txt');
    assert(e.name === 'Été (2).txt', e.name);
  });
  await t('noms interdits et « .. » refusés', async () => {
    await rejects(api.create('/Documents', 'a:b.txt'), /ne peut pas contenir/);
    await rejects(api.read('/Documents/../x'), /interdits/);
  });
  await t('dossiers système protégés', async () => {
    await rejects(api.rename('/Documents', 'Docs'), /système/);
    await rejects(api.remove(['/Bureau']), /système/);
  });
  await t('renommer (et collision)', async () => {
    const e = await api.rename('/Documents/Été (2).txt', 'Hiver.txt');
    assert(e.path === '/Documents/Hiver.txt');
    await rejects(api.rename('/Documents/Hiver.txt', 'Été.txt'), /existe déjà/);
  });
  await t('copier dans le même dossier -> « - Copie »', async () => {
    const [p] = await api.copy(['/Documents/Hiver.txt'], '/Documents');
    assert(p === '/Documents/Hiver - Copie.txt', p);
    assert((await api.read(p)).content === '');
  });
  await t('déplacer (fichier + dossier, pas dans lui-même)', async () => {
    const d = await api.create('/Documents', 'Classeur', 'dir');
    await api.create(d.path, 'note.txt', 'file', 'dedans');
    const [p] = await api.move(['/Documents/Hiver.txt'], d.path);
    assert(p === '/Documents/Classeur/Hiver.txt');
    await rejects(api.move([d.path], `${d.path}/`), /lui-même/);
    const [moved] = await api.move([d.path], '/Bureau');
    assert(moved === '/Bureau/Classeur');
    assert((await api.read('/Bureau/Classeur/note.txt')).content === 'dedans');
    const st = await api.stat('/Bureau/Classeur');
    assert(st.files === 2 && st.dirs === 0, JSON.stringify(st));
  });
  await t('corbeille : supprimer, restaurer, définitif, vider', async () => {
    const [del] = await api.remove(['/Bureau/Classeur']);
    assert(del === '/Bureau/Classeur');
    const trash = await api.list('/Corbeille');
    const item = trash.find((e) => e.name === 'Classeur');
    assert(item && item.original === '/Bureau/Classeur', JSON.stringify(trash));
    const [back] = await api.restore(['/Corbeille/Classeur']);
    assert(back === '/Bureau/Classeur');
    assert((await api.read('/Bureau/Classeur/note.txt')).content === 'dedans');
    await api.remove(['/Bureau/Classeur/note.txt']);
    await api.remove(['/Documents/Hiver - Copie.txt'], true);
    await rejects(api.stat('/Documents/Hiver - Copie.txt'), /introuvable/);
    const r = await api.emptyTrash();
    assert(r.count === 1 && (await api.list('/Corbeille')).length === 0, JSON.stringify(r));
  });
  await t('recherche (hors corbeille)', async () => {
    const res = await api.search('bienvenue');
    assert(res.length === 1 && res[0].path === '/Documents/Bienvenue.txt', JSON.stringify(res));
  });
  await t('dépôt d\'un dossier (chemins relatifs, nom unique)', async () => {
    const items = [
      { file: new File(['a'], 'a.txt'), relpath: 'Projet/a.txt' },
      { file: new File(['bb'], 'b.txt'), relpath: 'Projet/sous/b.txt' },
    ];
    let progress = 0;
    const paths = await api.upload('/Bureau', items, (p) => { progress = p; });
    assert(paths.length === 1 && paths[0] === '/Bureau/Projet' && progress === 1, JSON.stringify(paths));
    const again = await api.upload('/Bureau', [{ file: new File(['x'], 'a.txt'), relpath: 'Projet/a.txt' }]);
    assert(again[0] === '/Bureau/Projet (2)', again[0]);
    assert((await api.read('/Bureau/Projet/sous/b.txt')).content === 'bb');
  });
  await t('positions des icônes (bornées)', async () => {
    const pos = await api.savePositions({ '/Bureau/Projet': { x: 20000, y: -5 }, bad: { x: 'a' } });
    assert(pos['/Bureau/Projet'].x === 10000 && pos['/Bureau/Projet'].y === 0 && !pos.bad);
    await api.rename('/Bureau/Projet', 'Projet1');
    assert((await api.positions())['/Bureau/Projet1'], 'position suivie au renommage');
  });
  await t('analyse PE d\'un .exe', async () => {
    await api.upload('/Téléchargements', [{ file: fakePe(), relpath: 'app.exe' }]);
    const info = await api.pe('/Téléchargements/app.exe');
    assert(info.valid && info.format === 'PE32+' && info.machine.startsWith('x64'), JSON.stringify(info));
    assert(info.subsystem_kind === 'GUI' && info.image_base === '0x140000000' && info.sections[0].name === '.text');
    assert(info.dll_characteristics.includes('DEP / NX compatible'));
    const bad = await api.pe('/Documents/Bienvenue.txt');
    assert(bad.valid === false && /MZ/.test(bad.error));
  });
  await t('application .wapp (zip) + srcdoc autonome', async () => {
    const m = await api.openWapp('/Programmes/Exemples/horloge.wapp');
    assert(m.id.length === 32 && m.entry && m.name, JSON.stringify(m));
    const doc = await srcdocForWapp(m.id, m.entry);
    assert(doc.includes('<html') && doc.length > 500, 'srcdoc vide');
    const m2 = await api.openWapp('/Programmes/Exemples/horloge.wapp');
    assert(m2.id === m.id, 'cache par empreinte');
    await rejects(api.openWapp('/Documents/Bienvenue.txt'), /\.wapp/);
  });
  await t('page .html : srcdoc', async () => {
    const doc = await srcdocForVfs('/Programmes/Exemples/bonjour.html');
    assert(doc.includes('<html') && doc.length > 1000);
  });
  await t('SQLite : créer, insérer (paramètres), lire, schéma', async () => {
    await api.create('/Documents', 'test.wdb', 'file', '');
    await api.dbExec('/Documents/test.wdb', 'CREATE TABLE t(id INTEGER PRIMARY KEY, nom TEXT NOT NULL); CREATE VIEW v AS SELECT nom FROM t;');
    const [ins] = await api.dbExec('/Documents/test.wdb', 'INSERT INTO t(nom) VALUES (?)', ['Zoé']);
    assert(ins.changes === 1 && ins.lastrowid === 1, JSON.stringify(ins));
    const [sel] = await api.dbExec('/Documents/test.wdb', 'SELECT id, nom, x\'00ff\' AS b FROM t');
    assert(sel.columns.join() === 'id,nom,b' && sel.rows[0][1] === 'Zoé' && sel.rows[0][2] === '<BLOB 2 octets>', JSON.stringify(sel));
    const sch = await api.dbSchema('/Documents/test.wdb');
    const tbl = sch.objects.find((o) => o.name === 't');
    assert(tbl && tbl.count === 1 && tbl.columns[1].notnull && tbl.rowid && sch.objects.some((o) => o.type === 'view'), JSON.stringify(sch));
    assert((await api.stat('/Documents/test.wdb')).size > 0, 'base enregistrée');
  });
  await t('SQLite : protections', async () => {
    await rejects(api.dbExec('/Documents/test.wdb', "ATTACH 'x' AS y"), /not authorized/);
    await rejects(api.dbExec('/Documents/test.wdb', 'PRAGMA writable_schema=1'), /not authorized/);
    const [ok] = await api.dbExec('/Documents/test.wdb', 'PRAGMA table_info(t)');
    assert(ok.rows.length === 2);
    await rejects(api.dbExec('/Documents/test.wdb', 'SELECT ?; SELECT 2', [1]), /une seule instruction/);
    await rejects(api.dbExec('/Documents/Bienvenue.txt', 'SELECT 1'), /\.wdb/);
  });
  await t('SQLite : erreur après une écriture -> écriture conservée', async () => {
    await rejects(api.dbExec('/Documents/test.wdb', "INSERT INTO t(nom) VALUES ('B'); SELECT * FROM absente"), /no such table/);
    const [c] = await api.dbExec('/Documents/test.wdb', 'SELECT count(*) FROM t');
    assert(c.rows[0][0] === 2, JSON.stringify(c));
  });
  await t('SQLite : requête infinie coupée à 4 s', async () => {
    const t0 = performance.now();
    await rejects(api.dbExec('/Documents/test.wdb', 'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT count(*) FROM c'), /interrompue/);
    const dt = performance.now() - t0;
    assert(dt > 3500 && dt < 9000, `durée ${dt}`);
    const [after] = await api.dbExec('/Documents/test.wdb', 'SELECT 1');
    assert(after.rows[0][0] === 1, 'le worker redémarre');
  });
  await t('téléchargement web (même origine)', async () => {
    const r = await api.webDownload(new URL('../exemples/demo.js', import.meta.url).href);
    assert(r.paths[0] === '/Téléchargements/demo.js' && r.size > 100, JSON.stringify(r));
  });
  await t('service worker : vfs/ et wapp/', async () => {
    assert(await swReady(), 'service worker inactif');
    const root = new URL('../', import.meta.url);
    const r = await fetch(new URL('vfs/Documents/Bienvenue.txt', root));
    assert(r.ok && (await r.text()).includes('Bienvenue'), `vfs ${r.status}`);
    assert(/sandbox/.test(r.headers.get('content-security-policy') || ''), 'CSP sandbox');
    const dl = await fetch(new URL('vfs/Documents/Bienvenue.txt?download=1', root));
    assert(/attachment/.test(dl.headers.get('content-disposition') || ''), 'téléchargement');
    const miss = await fetch(new URL('vfs/Documents/absent.txt', root));
    assert(miss.status === 404);
  });
  await t('système', async () => {
    const s = await api.system();
    assert(s.web_proxy === false && s.max_upload_mb === 100);
  });

  await cloudTests();

  await fetch('results.php', { method: 'POST', body: JSON.stringify(results) });
  document.body.textContent = results.map((r) => `${r.ok ? 'OK' : 'KO'} ${r.name}${r.error ? ` : ${r.error}` : ''}`).join('\n');
})();

// ---------------------------------------------------------------- stockage en ligne
// Faux serveurs Google Drive et Microsoft Graph en mémoire (fetch intercepté) :
// vérifient les requêtes envoyées par WinGate, sans compte réel.
function fakeClouds() {
  const g = { files: new Map([['root', { id: 'root', name: 'root', mimeType: 'application/vnd.google-apps.folder', parents: [] }]]), n: 0, sessions: new Map(), calls: [] };
  const m = { items: new Map([['approot', { id: 'approot', name: 'WinGate', folder: {}, parent: null }]]), n: 0, sessions: new Map(), calls: [], token: 'ms-old', refreshed: 0 };
  const FOLDER = 'application/vnd.google-apps.folder';
  const json = (data, status = 200, headers = {}) => new Response(data === null ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  const gMeta = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.content ? String(f.content.size) : undefined, modifiedTime: '2026-11-15T10:00:00Z' });
  const gChildren = (pid) => [...g.files.values()].filter((f) => f.parents.includes(pid) && !f.trashed);
  async function google(url, opt) {
    const method = opt.method || 'GET';
    g.calls.push(`${method} ${url.pathname}${url.search.includes('uploadType=') ? ` ${url.searchParams.get('uploadType')}` : ''}`);
    if (opt.headers?.Authorization !== 'Bearer g-token' && url.host !== 'upload.fake') return json({ error: { message: 'Invalid Credentials' } }, 401);
    if (url.pathname === '/drive/v3/about') return json({ user: { emailAddress: 'test@gmail.com' } });
    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      const qs = url.searchParams.get('q');
      let m1 = qs.match(/^name='((?:[^'\\]|\\.)*)' and '([^']+)' in parents and trashed=false and mimeType(=|!=)'([^']+)'$/);
      if (m1) {
        const name = m1[1].replace(/\\(.)/g, '$1');
        const hit = gChildren(m1[2]).filter((f) => f.name === name && ((m1[3] === '=') === (f.mimeType === FOLDER)));
        return json({ files: hit.map(gMeta) });
      }
      m1 = qs.match(/^'([^']+)' in parents and trashed=false$/);
      if (m1) return json({ files: gChildren(m1[1]).map(gMeta) });
      return json({ error: { message: `q inconnue ${qs}` } }, 400);
    }
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(opt.body);
      const id = `g${++g.n}`;
      g.files.set(id, { id, name: meta.name, mimeType: meta.mimeType, parents: meta.parents });
      return json({ id });
    }
    let mm = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (mm && method === 'GET' && url.searchParams.get('alt') === 'media') return new Response(g.files.get(mm[1]).content);
    if (mm && method === 'PATCH') { Object.assign(g.files.get(mm[1]), JSON.parse(opt.body)); return json({ id: mm[1] }); }
    if (url.pathname === '/upload/drive/v3/files' && url.searchParams.get('uploadType') === 'multipart') {
      const text = await opt.body.text();
      const boundary = opt.headers['Content-Type'].split('boundary=')[1];
      const parts = text.split(`--${boundary}`);
      const meta = JSON.parse(parts[1].split('\r\n\r\n')[1]);
      const content = parts[2].slice(parts[2].indexOf('\r\n\r\n') + 4, -2);
      const id = `g${++g.n}`;
      g.files.set(id, { id, name: meta.name, mimeType: 'text/plain', parents: meta.parents, content: new Blob([content]) });
      return json({ id });
    }
    mm = url.pathname.match(/^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/);
    if (mm && url.searchParams.get('uploadType') === 'media') { g.files.get(mm[1]).content = opt.body; return json({ id: mm[1] }); }
    if (mm && url.searchParams.get('uploadType') === 'resumable') {
      const sid = `s${g.sessions.size + 1}`;
      g.sessions.set(sid, { id: mm[1], meta: JSON.parse(opt.body) });
      return json(null, 200, { Location: `https://upload.fake/google/${sid}` });
    }
    if (url.host === 'upload.fake') {
      const sess = g.sessions.get(url.pathname.split('/').pop());
      let id = sess.id;
      if (!id) { id = `g${++g.n}`; g.files.set(id, { id, name: sess.meta.name, mimeType: 'application/octet-stream', parents: sess.meta.parents }); }
      g.files.get(id).content = opt.body;
      return json({ id });
    }
    return json({ error: { message: `non géré ${method} ${url}` } }, 404);
  }

  const mMeta = (f) => (f.folder ? { id: f.id, name: f.name, folder: { childCount: 0 } } : { id: f.id, name: f.name, size: f.content.size, file: {}, lastModifiedDateTime: '2026-11-15T10:00:00Z' });
  const mChildren = (pid) => [...m.items.values()].filter((f) => f.parent === pid);
  const mFind = (pid, name) => mChildren(pid).find((f) => f.name === name);
  async function graph(url, opt) {
    const method = opt.method || 'GET';
    const path = decodeURIComponent(url.pathname);
    m.calls.push(`${method} ${path}`);
    if (url.host === 'login.microsoftonline.com') {
      const body = new URLSearchParams(opt.body);
      if (body.get('grant_type') === 'refresh_token' && body.get('refresh_token') === 'ms-refresh') { m.refreshed += 1; m.token = 'ms-new'; return json({ access_token: 'ms-new', refresh_token: 'ms-refresh2', expires_in: 3600 }); }
      return json({ error: 'invalid_grant' }, 400);
    }
    if (url.host === 'dl.fake') return new Response(m.items.get(path.slice(1)).content);
    if (url.host === 'upload.fake') {
      const sess = m.sessions.get(path.split('/').pop());
      const [, a, b, total] = opt.headers['Content-Range'].match(/bytes (\d+)-(\d+)\/(\d+)/).map(Number);
      sess.chunks.push(opt.body);
      sess.ranges.push([a, b]);
      if (b + 1 < total) return json({ nextExpectedRanges: [`${b + 1}-`] }, 202);
      let f = mFind(sess.parent, sess.name);
      if (!f) { f = { id: `m${++m.n}`, name: sess.name, parent: sess.parent }; m.items.set(f.id, f); }
      f.content = new Blob(sess.chunks);
      return json(mMeta(f), 201);
    }
    if (opt.headers?.Authorization !== `Bearer ${m.token}`) return json({ error: { message: 'expired' } }, 401);
    if (path === '/v1.0/me') return json({ mail: 'test@outlook.fr' });
    if (path === '/v1.0/me/drive/special/approot') return json({ id: 'approot' });
    let mm = path.match(/^\/v1\.0\/me\/drive\/items\/([^/:]+)\/children$/);
    if (mm && method === 'GET') return json({ value: mChildren(mm[1]).map(mMeta) });
    if (mm && method === 'POST') {
      const b = JSON.parse(opt.body);
      if (mFind(mm[1], b.name)) return json({ error: { code: 'nameAlreadyExists', message: 'exists' } }, 409);
      const f = { id: `m${++m.n}`, name: b.name, folder: {}, parent: mm[1] };
      m.items.set(f.id, f);
      return json(mMeta(f), 201);
    }
    mm = path.match(/^\/v1\.0\/me\/drive\/items\/([^/:]+):\/(.+?):\/(content|createUploadSession)$/);
    if (mm && mm[3] === 'content') {
      let f = mFind(mm[1], mm[2]);
      if (!f) { f = { id: `m${++m.n}`, name: mm[2], parent: mm[1] }; m.items.set(f.id, f); }
      f.content = opt.body;
      return json(mMeta(f), 201);
    }
    if (mm) { const sid = `u${m.sessions.size + 1}`; m.sessions.set(sid, { parent: mm[1], name: mm[2], chunks: [], ranges: [] }); return json({ uploadUrl: `https://upload.fake/ms/${sid}` }); }
    mm = path.match(/^\/v1\.0\/me\/drive\/items\/([^/:]+):\/(.+)$/);
    if (mm) { const f = mFind(mm[1], mm[2]); return f ? json({ id: f.id }) : json({ error: { message: 'not found' } }, 404); }
    mm = path.match(/^\/v1\.0\/me\/drive\/items\/([^/:]+)$/);
    if (mm && method === 'GET') return json({ ...mMeta(m.items.get(mm[1])), '@microsoft.graph.downloadUrl': `https://dl.fake/${mm[1]}` });
    if (mm && method === 'DELETE') { m.items.delete(mm[1]); return json(null, 204); }
    return json({ error: { message: `non géré ${method} ${path}` } }, 404);
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, opt = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (/googleapis\.com$/.test(url.host) || (url.host === 'upload.fake' && url.pathname.startsWith('/google/'))) return google(url, opt);
    if (['graph.microsoft.com', 'login.microsoftonline.com', 'dl.fake'].includes(url.host) || (url.host === 'upload.fake' && url.pathname.startsWith('/ms/'))) return graph(url, opt);
    return realFetch(input, opt);
  };
  return { g, m, restore: () => { window.fetch = realFetch; } };
}

async function cloudTests() {
  const { CLOUD_CONFIG } = await import('../static/js/cloud/config.js');
  CLOUD_CONFIG.google.clientId = 'test-google';
  CLOUD_CONFIG.microsoft.clientId = 'test-ms';
  localStorage.setItem('wingate.cloud.google', JSON.stringify({ access_token: 'g-token', expires_at: Date.now() + 3600e3, account: 'test@gmail.com' }));
  // Jeton OneDrive périmé : WinGate doit le renouveler tout seul
  localStorage.setItem('wingate.cloud.microsoft', JSON.stringify({ access_token: 'ms-old', refresh_token: 'ms-refresh', expires_at: Date.now() - 1000, account: 'test@outlook.fr' }));
  const fake = fakeClouds();
  const { google } = await import('../static/js/cloud/google.js');
  const { microsoft } = await import('../static/js/cloud/microsoft.js');
  const { AuthError, redirectUri, waitForRedirect } = await import('../static/js/cloud/oauth.js');
  const tr = await import('../static/js/cloud/transfer.js');

  // Données d'essai : un dossier avec sous-dossier, un fichier de 6 Mo et un dossier vide
  await api.create('/Documents', 'Partage', 'dir');
  await api.create('/Documents/Partage', 'note.txt', 'file', 'bonjour du téléphone');
  await api.create('/Documents/Partage', 'Photos', 'dir');
  await api.create('/Documents/Partage', 'Vide', 'dir');
  const big = new Uint8Array(6 * 1024 * 1024).map((_, i) => i % 251);
  await api.upload('/Documents/Partage/Photos', [{ file: new File([big], 'grande.bin'), relpath: 'grande.bin' }]);

  await t('cloud : adresse de retour oauth.html', async () => {
    assert(redirectUri() === new URL('../oauth.html', location.href).href, redirectUri());
    const r = await fetch(redirectUri());
    assert(r.ok && (await r.text()).includes('wingate-oauth'));
  });
  await t('cloud : retour de connexion transmis par oauth.html', async () => {
    const w = waitForRedirect('etat123', { timeout: 8000 });
    const frame = document.createElement('iframe');
    frame.src = `${redirectUri()}#state=etat123&access_token=abc&expires_in=3599`;
    document.body.append(frame);
    const p = await w.promise;
    frame.remove();
    assert(p.access_token === 'abc' && p.expires_in === '3599', JSON.stringify(p));
  });
  await t('cloud : état différent ignoré, erreur signalée', async () => {
    const w = waitForRedirect('bon', { timeout: 8000 });
    const f1 = document.createElement('iframe');
    f1.src = `${redirectUri()}#state=autre&access_token=pirate`;
    document.body.append(f1);
    await new Promise((r) => setTimeout(r, 600));
    const f2 = document.createElement('iframe');
    f2.src = `${redirectUri()}?state=bon&error=access_denied`;
    document.body.append(f2);
    await rejects(w.promise, /annulée/);
    f1.remove(); f2.remove();
  });

  await t('Google Drive : envoi d\'un dossier (sous-dossiers, 6 Mo, dossier vide)', async () => {
    assert(google.connected() && google.account() === 'test@gmail.com');
    const root = await google.root();
    const r = await tr.sendLocal(google, ['/Documents/Partage'], root);
    assert(r.files === 2 && r.bytes === big.length + 'bonjour du téléphone'.length * 0 + (await api.stat('/Documents/Partage/note.txt')).size, JSON.stringify(r));
    const top = await google.list(root);
    assert(top.length === 1 && top[0].name === 'Partage' && top[0].dir, JSON.stringify(top));
    const inside = (await google.list(top[0].id)).map((i) => `${i.dir ? 'd' : 'f'}:${i.name}`).sort().join(',');
    assert(inside === 'd:Photos,d:Vide,f:note.txt', inside);
    assert(fake.g.calls.some((c) => c.endsWith('resumable')), 'gros fichier : envoi reprenable');
    assert(fake.g.calls.some((c) => c.endsWith('multipart')), 'petit fichier : envoi multipart');
    const rootFolders = [...fake.g.files.values()].filter((f) => f.name === 'WinGate');
    assert(rootFolders.length === 1, 'un seul dossier WinGate');
  });
  await t('Google Drive : renvoi = remplacement, pas de doublon', async () => {
    await api.write('/Documents/Partage/note.txt', 'version 2');
    await tr.sendLocal(google, ['/Documents/Partage'], await google.root());
    const notes = [...fake.g.files.values()].filter((f) => f.name === 'note.txt' && !f.trashed);
    assert(notes.length === 1 && (await notes[0].content.text()) === 'version 2', `${notes.length}`);
    assert([...fake.g.files.values()].filter((f) => f.name === 'Partage').length === 1, 'dossier réutilisé');
  });
  await t('Google Drive : import d\'un dossier dans WinGate', async () => {
    const [folder] = await google.list(await google.root());
    const paths = await tr.importRemote(google, [folder], '/Téléchargements');
    assert(paths.length === 1 && paths[0] === '/Téléchargements/Partage', JSON.stringify(paths));
    assert((await api.read('/Téléchargements/Partage/note.txt')).content === 'version 2');
    const s = await api.stat('/Téléchargements/Partage/Photos/grande.bin');
    assert(s.size === big.length, `${s.size}`);
  });
  await t('Google Drive : nom avec apostrophe', async () => {
    const root = await google.root();
    await google.upload(root, "l'été.txt", new Blob(['a']));
    await google.upload(root, "l'été.txt", new Blob(['b']));
    const hits = (await google.list(root)).filter((i) => i.name === "l'été.txt");
    assert(hits.length === 1, `${hits.length}`);
  });
  await t('Google Drive : suppression = corbeille', async () => {
    const root = await google.root();
    const item = (await google.list(root)).find((i) => i.name === "l'été.txt");
    await google.remove(item);
    assert(!(await google.list(root)).some((i) => i.name === "l'été.txt"));
    assert(fake.g.files.get(item.id).trashed === true, 'récupérable');
  });

  await t('OneDrive : jeton périmé renouvelé automatiquement', async () => {
    assert(microsoft.connected(), 'session avec jeton de renouvellement');
    const root = await microsoft.root();
    assert(root === 'approot' && fake.m.refreshed === 1, `refresh ${fake.m.refreshed}`);
    const saved = JSON.parse(localStorage.getItem('wingate.cloud.microsoft'));
    assert(saved.access_token === 'ms-new' && saved.refresh_token === 'ms-refresh2', 'session enregistrée');
  });
  await t('OneDrive : envoi d\'un dossier (6 Mo en morceaux)', async () => {
    const r = await tr.sendLocal(microsoft, ['/Documents/Partage'], await microsoft.root());
    assert(r.files === 2, JSON.stringify(r));
    const sess = [...fake.m.sessions.values()][0];
    assert(sess && sess.ranges.length === 2 && sess.ranges.every(([a, b]) => a % (320 * 1024) === 0 && b > a), JSON.stringify(sess?.ranges));
    const f = [...fake.m.items.values()].find((i) => i.name === 'grande.bin');
    assert(f.content.size === big.length, 'contenu recomposé');
    const again = await tr.sendLocal(microsoft, ['/Documents/Partage'], await microsoft.root());
    assert(again.files === 2 && [...fake.m.items.values()].filter((i) => i.name === 'Partage').length === 1, 'dossier existant réutilisé (409)');
  });
  await t('OneDrive : import et téléchargement pré-signé', async () => {
    const [folder] = await microsoft.list(await microsoft.root());
    const paths = await tr.importRemote(microsoft, [folder], '/Bureau');
    assert(paths[0] === '/Bureau/Partage', JSON.stringify(paths));
    assert((await api.read('/Bureau/Partage/note.txt')).content === 'version 2');
    assert(fake.m.calls.some((c) => c.startsWith('GET /') && c.includes('dl.fake') === false), 'appel Graph');
  });
  await t('fichiers de l\'appareil : import et envoi', async () => {
    const paths = await tr.importDeviceFiles([new File(['photo'], 'IMG_0001.jpg')], '/Téléchargements');
    assert(paths[0] === '/Téléchargements/IMG_0001.jpg', JSON.stringify(paths));
    const r = await tr.sendDeviceFiles(google, [new File(['x'], 'depuis-tel.txt')], await google.root());
    assert(r.files === 1 && (await google.list(await google.root())).some((i) => i.name === 'depuis-tel.txt'));
    const files = await tr.readLocalFiles(['/Documents/Partage']);
    assert(files.map((f) => f.name).sort().join(',') === 'grande.bin,note.txt', 'fichiers du dossier');
  });
  await t('cloud : session expirée -> AuthError et déconnexion', async () => {
    localStorage.setItem('wingate.cloud.google', JSON.stringify({ access_token: 'faux', expires_at: Date.now() + 3600e3 }));
    const fresh = await import(`../static/js/cloud/google.js?x=${Date.now()}`);
    let err = null;
    try { await fresh.google.list('root'); } catch (e) { err = e; }
    assert(err instanceof AuthError && /expiré/.test(err.message), String(err));
    assert(!fresh.google.connected() && !localStorage.getItem('wingate.cloud.google'));
  });
  fake.restore();
  localStorage.removeItem('wingate.cloud.microsoft');
}

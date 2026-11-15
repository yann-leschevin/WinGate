# WinGate — version en ligne (OVH)

Bureau façon PC dans le navigateur, en ligne sur https://leschevin.com/projets/wingate/.

Portage de https://github.com/yann-leschevin/WinGate (Python/Flask, dossier `php/` = cette version).
L'interface (HTML/CSS/JS) est la même ; seul le « serveur » change.

> Le projet s'appelait **WinWeb** (ancienne adresse `projets/winweb/`, redirigée vers la nouvelle).
> Les identifiants techniques en minuscules (`winweb` : base IndexedDB, clés `localStorage`,
> formats `winweb-doc`…) ne changent pas, pour ne pas perdre les fichiers des visiteurs.

## Ce qui change par rapport à la version Python

| Python (Flask)                         | Version en ligne                                                    |
|----------------------------------------|---------------------------------------------------------------------|
| fichiers dans `data/fs/` sur le serveur, partagés | fichiers dans **le navigateur du visiteur** (IndexedDB) : chacun a son propre PC, rien n'est envoyé à OVH |
| API REST `/api/...` (`app.py`, `vfs.py`) | `static/js/api.js` (mêmes fonctions) + `localfs.js`                 |
| `/vfs/<chemin>` servi par Flask        | `vfs/<chemin>` servi par le service worker `sw.js`                   |
| `.wapp` décompressés avec `zipfile`    | `wapp.js` (DecompressionStream, mêmes limites)                       |
| `.html` / `.wapp` en iframe `src=`     | iframe sandbox en `srcdoc` avec ressources intégrées (`inline.js`)   |
| SQLite (`sqlite3`, `dbsql.py`)         | sql.js / WebAssembly dans un worker (`db.js`, `dbworker.js`), 4 s max |
| en-têtes PE (`pe_info.py`)             | `peinfo.js`                                                          |
| mandataire web `/web?url=`             | **désactivé** (pas de proxy ouvert sur OVH) : mode Direct uniquement |
| styles « Windows 10 / 11 »             | renommés « Classique / Moderne » (marques)                           |

PHP ne sert que la page (`index.php`, qui compte la visite pour `stats.php`). Les exemples
(`exemples/`) sont copiés dans *Programmes\Exemples* au premier lancement.

Bibliothèque tierce : **sql.js 1.14.2** (licence MIT), dans `www/static/vendor/sqljs/`.

## Arborescence
- `www/` : **seul dossier à envoyer** (son contenu va dans `www/projets/wingate/` chez OVH).
- `tests/test.sh` : tests locaux — pages servies (curl), syntaxe JS (node) et API complète
  exécutée dans Firefox sans fenêtre (`tests/navigateur/`). Ne pas envoyer.
- `exemples/` : sources des exemples (`make_wapp.py` recrée les `.wapp`).

## Tester en local
```bash
php -S 127.0.0.1:18765 -t www     # puis http://127.0.0.1:18765/
bash tests/test.sh
```
Le service worker exige `https` ou `localhost`/`127.0.0.1` (c'est le cas en local et sur leschevin.com).
En navigation privée, certains navigateurs bloquent IndexedDB ou le service worker : WinGate le signale.

## Stockage en ligne (Google Drive, OneDrive, iCloud)
Application **☁️ Stockage en ligne** (menu Démarrer, barre des tâches) et menu **Envoyer vers** (clic droit
ou appui long sur un fichier / dossier) : on dépose des fichiers depuis un appareil (téléphone…) et on les
reprend sur un autre (ordinateur…). Tout se passe entre le navigateur et le service : rien ne transite par OVH.

| Service | Accès demandé | Où sont les fichiers |
|---|---|---|
| Google Drive | `drive.file` : uniquement les fichiers déposés par WinGate | dossier **WinGate** à la racine du Drive |
| OneDrive | `Files.ReadWrite.AppFolder` : uniquement le dossier de l'application | **Applications › WinGate** |
| iCloud | aucun : Apple n'ouvre pas iCloud Drive aux sites web | via l'appareil : sélecteur de fichiers (app *Fichiers* sur iPhone, dossier *iCloud Drive* sur PC) et menu *Partager › Enregistrer dans Fichiers* |

Code : `www/static/js/cloud/` (`google.js`, `microsoft.js`, `device.js`, `transfer.js`, `oauth.js`, `config.js`),
application `www/static/js/apps/cloud.js`, page de retour de connexion `www/oauth.html`.
Testé dans `tests/navigateur/runner.js` avec de faux serveurs Google / Microsoft (pas de compte réel).

### Mise en service (une seule fois, par le propriétaire du site)
Tant que `www/static/js/cloud/config.js` est vide, les deux services s'affichent « non configuré ».
L'adresse de retour à déclarer est **https://leschevin.com/projets/wingate/oauth.html**
(et, pour tester en local, `http://localhost:18765/oauth.html`).

**Google Drive** — https://console.cloud.google.com
1. Créer un projet « WinGate » ; *API et services › Bibliothèque* : activer **Google Drive API**.
2. *Écran de consentement OAuth* : type **Externe**, nom « WinGate », adresse de contact ; ajouter le
   champ d'application `.../auth/drive.file` (non sensible : pas de validation Google requise) ;
   publier l'application (sinon seuls les « utilisateurs test » déclarés peuvent se connecter).
3. *Identifiants › Créer › ID client OAuth* : type **Application Web** ;
   origine JavaScript `https://leschevin.com` ; URI de redirection : l'adresse ci-dessus.
4. Copier l'**ID client** (`….apps.googleusercontent.com`) dans `config.js` → `google.clientId`.

**OneDrive** — https://portal.azure.com (*Microsoft Entra ID › Inscriptions d'applications*)
1. *Nouvelle inscription* : nom **WinGate** (c'est le nom du dossier créé dans OneDrive),
   comptes « **de tout annuaire organisationnel et comptes Microsoft personnels** ».
2. URI de redirection : plateforme **Application monopage (SPA)** + l'adresse ci-dessus.
3. *Autorisations d'API* : Microsoft Graph délégué `Files.ReadWrite.AppFolder`, `User.Read`, `offline_access`.
4. Copier l'**ID d'application (client)** dans `config.js` → `microsoft.clientId`.

Ces identifiants sont publics (ce ne sont pas des secrets). La connexion se fait dans une petite
fenêtre : le navigateur doit autoriser les fenêtres surgissantes pour le site. Les jetons restent dans
le navigateur du visiteur (Google : 1 h ; Microsoft : renouvelé automatiquement), « Se déconnecter » les efface.


// iCloud Drive et fichiers de l'appareil.
//
// Apple ne propose aucun accès à iCloud Drive pour les sites web. On passe donc
// par le système de l'appareil, qui, lui, connaît iCloud Drive :
//  - importer : le sélecteur de fichiers du navigateur (sur iPhone / iPad il
//    ouvre l'app « Fichiers », iCloud Drive compris ; sur un PC avec iCloud pour
//    Windows, le dossier « iCloud Drive » apparaît dans l'explorateur) ;
//  - exporter : le menu « Partager » du système (Web Share API) qui propose
//    « Enregistrer dans Fichiers » → iCloud Drive ; à défaut, un téléchargement.

/**
 * Ouvre le sélecteur de fichiers de l'appareil. À appeler DANS le clic.
 * Renvoie une promesse de File[] (vide si l'utilisateur annule).
 */
export function pickDeviceFiles({ multiple = true } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.style.display = 'none';
    let settled = false;
    const finish = (files) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish([...(input.files || [])]));
    input.addEventListener('cancel', () => finish([]));
    document.body.append(input);
    input.click();
  });
}

/** Le partage de fichiers du système est-il disponible ? */
export function canShareFiles(files) {
  try {
    return Boolean(navigator.canShare && navigator.share && navigator.canShare({ files }));
  } catch {
    return false;
  }
}

/**
 * Envoie des fichiers vers l'appareil : menu Partager du système si possible
 * (à appeler DANS le clic), sinon téléchargement de chaque fichier.
 * files : File[] déjà prêts (lus à l'avance : Safari exige un geste récent).
 * Renvoie 'shared' | 'downloaded' | 'cancelled'.
 */
export async function sendToDevice(files) {
  if (canShareFiles(files)) {
    try {
      await navigator.share({ files, title: files.length === 1 ? files[0].name : `${files.length} fichiers` });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Partage refusé (type de fichier, trop de fichiers…) : on télécharge
    }
  }
  files.forEach((file, i) => setTimeout(() => saveFile(file, file.name), i * 400));
  return 'downloaded';
}

/** Téléchargement classique d'un Blob sur l'appareil. */
export function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Icônes : SVG inline (dossiers, logo, fichiers) et emoji. Aucune ressource externe.
import { escapeHtml } from './utils.js';

// Logo WinGate : un anneau de métal qui tourne autour d'un « passage » lumineux
// (dessin original ; l'animation est dans taskbar.css, classes gate-ring / gate-waves).
export const LOGO_SVG = `<svg viewBox="0 0 48 48" class="logo-svg gate-logo" aria-hidden="true">
  <defs>
    <linearGradient id="lgm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset=".35" stop-color="#8d99a8"/><stop offset=".6" stop-color="#dfe5ec"/><stop offset="1" stop-color="#56616f"/></linearGradient>
    <linearGradient id="lgr" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d1da"/><stop offset=".5" stop-color="#6b7684"/><stop offset="1" stop-color="#aeb8c4"/></linearGradient>
    <radialGradient id="lgw" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#eaf8ff"/><stop offset=".3" stop-color="#6fc3ff"/><stop offset=".7" stop-color="#1668e3"/><stop offset="1" stop-color="#062a7a"/></radialGradient>
  </defs>
  <circle cx="24" cy="24" r="22.6" fill="url(#lgm)" stroke="#2c343f" stroke-width=".8"/>
  <g class="gate-ring">
    <circle cx="24" cy="24" r="16.1" fill="none" stroke="url(#lgr)" stroke-width="4.8"/>
    <g stroke="#2c343f" stroke-width=".9" stroke-linecap="round" opacity=".75"><path d="M24 5.6v4.6" transform="rotate(0 24 24)"/><path d="M24 5.6v4.6" transform="rotate(20 24 24)"/><path d="M24 5.6v4.6" transform="rotate(40 24 24)"/><path d="M24 5.6v4.6" transform="rotate(60 24 24)"/><path d="M24 5.6v4.6" transform="rotate(80 24 24)"/><path d="M24 5.6v4.6" transform="rotate(100 24 24)"/><path d="M24 5.6v4.6" transform="rotate(120 24 24)"/><path d="M24 5.6v4.6" transform="rotate(140 24 24)"/><path d="M24 5.6v4.6" transform="rotate(160 24 24)"/><path d="M24 5.6v4.6" transform="rotate(180 24 24)"/><path d="M24 5.6v4.6" transform="rotate(200 24 24)"/><path d="M24 5.6v4.6" transform="rotate(220 24 24)"/><path d="M24 5.6v4.6" transform="rotate(240 24 24)"/><path d="M24 5.6v4.6" transform="rotate(260 24 24)"/><path d="M24 5.6v4.6" transform="rotate(280 24 24)"/><path d="M24 5.6v4.6" transform="rotate(300 24 24)"/><path d="M24 5.6v4.6" transform="rotate(320 24 24)"/><path d="M24 5.6v4.6" transform="rotate(340 24 24)"/></g>
    <g fill="#eaf8ff"><circle cx="24" cy="7.9" r="1.15" transform="rotate(10 24 24)"/><circle cx="24" cy="7.9" r="1.15" transform="rotate(130 24 24)"/><circle cx="24" cy="7.9" r="1.15" transform="rotate(250 24 24)"/></g>
  </g>
  <g transform="rotate(0 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(60 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(120 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(180 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(240 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(300 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g>
  <circle cx="24" cy="24" r="13.4" fill="url(#lgw)" stroke="#1b2430" stroke-width=".9"/>
  <g class="gate-waves" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1">
    <path d="M16.5 21.5q3.5-3 7.5 0t7.5 0" opacity=".75"/><path d="M17.5 26.5q3.2 2.6 6.5 0t6.5 0" opacity=".5"/><path d="M21 31q3 1.6 6 0" opacity=".4"/>
  </g>
</svg>`;

export const FOLDER_SVG = `<svg viewBox="0 0 48 48" class="ico-svg" aria-hidden="true">
  <path d="M4 10a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v3H4z" fill="#e8a822"/>
  <path d="M4 15h40v22a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#ffc83d"/>
  <path d="M4 15h40v3H4z" fill="#ffd96a" opacity=".7"/></svg>`;

const FILE_SVG = (color, label) => `<svg viewBox="0 0 48 48" class="ico-svg" aria-hidden="true">
  <path d="M11 4h18l10 10v28a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#fff" stroke="#b9b9b9"/>
  <path d="M29 4v8a2 2 0 0 0 2 2h8" fill="#e6e6e6" stroke="#b9b9b9"/>
  ${label ? `<rect x="5" y="27" width="${Math.max(18, label.length * 6 + 8)}" height="12" rx="2" fill="${color}"/>
  <text x="${5 + Math.max(18, label.length * 6 + 8) / 2}" y="36" font-size="8" font-family="Segoe UI,Arial,sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${label}</text>` : ''}</svg>`;

export const TRASH_SVG = (full) => `<svg viewBox="0 0 48 48" class="ico-svg" aria-hidden="true">
  <path d="M12 14h24l-2.2 27a3 3 0 0 1-3 2.8H17.2a3 3 0 0 1-3-2.8z" fill="#d7e6f5" stroke="#6b8bb0" stroke-width="1.5"/>
  <path d="M19 19v19M24 19v19M29 19v19" stroke="#6b8bb0" stroke-width="1.5"/>
  <rect x="9" y="10" width="30" height="4" rx="1.5" fill="#9fb9d6" stroke="#6b8bb0"/>
  ${full ? '<path d="M15 10c2-6 8-7 10-3 3-5 9-3 9 3" fill="#fff6c4" stroke="#c9a640"/>' : ''}</svg>`;

export const PC_SVG = `<svg viewBox="0 0 48 48" class="ico-svg" aria-hidden="true">
  <rect x="5" y="8" width="38" height="25" rx="2" fill="#2b88d8" stroke="#1b5e99"/>
  <rect x="8" y="11" width="32" height="19" fill="#9fd4ff"/>
  <path d="M19 33h10l2 6H17z" fill="#8a8a8a"/><rect x="13" y="39" width="22" height="3" rx="1" fill="#6b6b6b"/></svg>`;

const EXT_STYLE = {
  txt: ['#5b6b7c', 'TXT'], md: ['#5b6b7c', 'MD'], log: ['#5b6b7c', 'LOG'], ini: ['#5b6b7c', 'INI'],
  csv: ['#107c41', 'CSV'], json: ['#8a6d00', 'JSON'], xml: ['#8a6d00', 'XML'],
  css: ['#264de4', 'CSS'], py: ['#3572a5', 'PY'], pdf: ['#c50f1f', 'PDF'],
  zip: ['#7a5c00', 'ZIP'], mp3: ['#8e3cbf', 'MP3'], wav: ['#8e3cbf', 'WAV'],
  mp4: ['#b4009e', 'MP4'], webm: ['#b4009e', 'WEBM'], doc: ['#185abd', 'DOC'], docx: ['#185abd', 'DOCX'],
  wdoc: ['#185abd', 'DOC'], wcalc: ['#107c41', 'XLS'], wpres: ['#c43e1c', 'PPT'], wdb: ['#a4373a', 'DB'], wnote: ['#7719aa', 'NOTE'],
  sql: ['#a4373a', 'SQL'], c: ['#555555', 'C'], cpp: ['#00599c', 'C++'], java: ['#b07219', 'JAVA'], ts: ['#3178c6', 'TS'],
  php: ['#4f5d95', 'PHP'], sh: ['#3e7a2e', 'SH'], bat: ['#3e7a2e', 'BAT'], yml: ['#cb171e', 'YML'], yaml: ['#cb171e', 'YAML'],
};

const EMOJI_BY_EXT = {
  wapp: '📦', exe: '⚙️', dll: '🧩', html: '🌐', htm: '🌐', js: '📜',
};
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);

export function isImageExt(ext) {
  return IMAGE_EXTS.has(ext);
}

const emoji = (char) => `<span class="ico-emoji" aria-hidden="true">${escapeHtml(char)}</span>`;
export { emoji as emojiIcon };

/** Retourne le HTML de l'icône d'une entrée du VFS. */
export function iconForEntry(entry, { trashFull = false } = {}) {
  if (entry.special === 'trash') return TRASH_SVG(trashFull);
  if (entry.type === 'dir') {
    const special = { '/Documents': '📄', '/Images': '🖼️', '/Téléchargements': '⬇️', '/Programmes': '🧰', '/Bureau': '🖥️' }[entry.path];
    return special ? `<span class="ico-stack">${FOLDER_SVG}<span class="ico-badge">${special}</span></span>` : FOLDER_SVG;
  }
  const ext = entry.ext || '';
  if (EMOJI_BY_EXT[ext]) {
    return `<span class="ico-stack">${FILE_SVG('#444', '')}<span class="ico-badge big">${EMOJI_BY_EXT[ext]}</span></span>`;
  }
  if (IMAGE_EXTS.has(ext)) {
    return `<span class="ico-stack">${FILE_SVG('#444', '')}<span class="ico-badge big">🖼️</span></span>`;
  }
  const [color, label] = EXT_STYLE[ext] || ['#6e6e6e', ext ? ext.slice(0, 4).toUpperCase() : ''];
  return FILE_SVG(color, escapeHtml(label));
}

/** Icône d'application (emoji ou HTML déjà sûr). */
export function appIcon(icon) {
  if (!icon) return emoji('🪟');
  if (icon.startsWith('<')) return icon;
  return emoji(icon);
}

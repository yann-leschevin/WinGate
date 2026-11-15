<?php // Compte la visite (voir leschevin.com/stats.php) — sans effet en local
if (is_file(__DIR__ . '/../compter_visite.php')) { require_once __DIR__ . '/../compter_visite.php'; compter_visite('winweb'); } // clé « winweb » gardée : suite de l'historique des statistiques ?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <!-- maximum-scale=1 : sur iPhone, évite le zoom automatique (et durable) dès qu'on touche un champ de saisie -->
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>WinGate</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='7.5' fill='%238d99a8'/%3E%3Ccircle cx='8' cy='8' r='6' fill='none' stroke='%2356616f' stroke-width='1.6' stroke-dasharray='1.2 .9'/%3E%3Ccircle cx='8' cy='8' r='4.6' fill='%231668e3'/%3E%3Ccircle cx='7.2' cy='7' r='2' fill='%239fd8ff'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="static/css/base.css">
  <link rel="stylesheet" href="static/css/desktop.css">
  <link rel="stylesheet" href="static/css/windows.css">
  <link rel="stylesheet" href="static/css/taskbar.css">
  <link rel="stylesheet" href="static/css/startmenu.css">
  <link rel="stylesheet" href="static/css/apps.css">
  <link rel="stylesheet" href="static/css/office.css">
</head>
<body class="theme-light style-win11 booting" data-max-upload="100">
  <!-- Démarrage -->
  <div id="boot-screen" class="screen">
    <div class="boot-logo" aria-hidden="true"><svg viewBox="0 0 48 48" class="gate-logo" aria-hidden="true">
      <defs>
        <linearGradient id="bgm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset=".35" stop-color="#8d99a8"/><stop offset=".6" stop-color="#dfe5ec"/><stop offset="1" stop-color="#56616f"/></linearGradient>
        <linearGradient id="bgr" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d1da"/><stop offset=".5" stop-color="#6b7684"/><stop offset="1" stop-color="#aeb8c4"/></linearGradient>
        <radialGradient id="bgw" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#eaf8ff"/><stop offset=".3" stop-color="#6fc3ff"/><stop offset=".7" stop-color="#1668e3"/><stop offset="1" stop-color="#062a7a"/></radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22.6" fill="url(#bgm)" stroke="#2c343f" stroke-width=".8"/>
      <g class="gate-ring">
        <circle cx="24" cy="24" r="16.1" fill="none" stroke="url(#bgr)" stroke-width="4.8"/>
        <g stroke="#2c343f" stroke-width=".9" stroke-linecap="round" opacity=".75"><path d="M24 5.6v4.6" transform="rotate(0 24 24)"/><path d="M24 5.6v4.6" transform="rotate(20 24 24)"/><path d="M24 5.6v4.6" transform="rotate(40 24 24)"/><path d="M24 5.6v4.6" transform="rotate(60 24 24)"/><path d="M24 5.6v4.6" transform="rotate(80 24 24)"/><path d="M24 5.6v4.6" transform="rotate(100 24 24)"/><path d="M24 5.6v4.6" transform="rotate(120 24 24)"/><path d="M24 5.6v4.6" transform="rotate(140 24 24)"/><path d="M24 5.6v4.6" transform="rotate(160 24 24)"/><path d="M24 5.6v4.6" transform="rotate(180 24 24)"/><path d="M24 5.6v4.6" transform="rotate(200 24 24)"/><path d="M24 5.6v4.6" transform="rotate(220 24 24)"/><path d="M24 5.6v4.6" transform="rotate(240 24 24)"/><path d="M24 5.6v4.6" transform="rotate(260 24 24)"/><path d="M24 5.6v4.6" transform="rotate(280 24 24)"/><path d="M24 5.6v4.6" transform="rotate(300 24 24)"/><path d="M24 5.6v4.6" transform="rotate(320 24 24)"/><path d="M24 5.6v4.6" transform="rotate(340 24 24)"/></g>
        <g fill="#eaf8ff"><circle cx="24" cy="7.9" r="1.15" transform="rotate(10 24 24)"/><circle cx="24" cy="7.9" r="1.15" transform="rotate(130 24 24)"/><circle cx="24" cy="7.9" r="1.15" transform="rotate(250 24 24)"/></g>
      </g>
      <g transform="rotate(0 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(60 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(120 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(180 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(240 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g><g transform="rotate(300 24 24)"><path d="M21.3 .9h5.4l-1.2 4.3h-3z" fill="#39424e"/><path d="M22.9 1.7h2.2l-.5 2h-1.2z" fill="#ffb347"/></g>
      <circle cx="24" cy="24" r="13.4" fill="url(#bgw)" stroke="#1b2430" stroke-width=".9"/>
      <g class="gate-waves" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1">
        <path d="M16.5 21.5q3.5-3 7.5 0t7.5 0" opacity=".75"/><path d="M17.5 26.5q3.2 2.6 6.5 0t6.5 0" opacity=".5"/><path d="M21 31q3 1.6 6 0" opacity=".4"/>
      </g>
    </svg></div>
    <div class="boot-spinner" aria-label="Démarrage"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="boot-text"></div>
  </div>

  <!-- Écran éteint -->
  <div id="off-screen" class="screen hidden">
    <p>WinGate est arrêté.</p>
    <button type="button" class="power-on">⏻ Allumer</button>
  </div>

  <!-- Verrouillage -->
  <div id="lock-screen" class="screen hidden" tabindex="-1">
    <div class="lock-clock">
      <div class="lock-time">00:00</div>
      <div class="lock-date"></div>
    </div>
    <div class="lock-login">
      <div class="lock-avatar">👤</div>
      <div class="lock-user">Utilisateur</div>
      <button type="button" class="lock-signin">Se connecter</button>
    </div>
    <div class="lock-hint">Cliquez ou appuyez sur une touche pour déverrouiller</div>
  </div>

  <!-- Session -->
  <div id="desktop-root">
    <div id="desktop" data-drop-path="/Bureau" data-drop-surface="desktop" tabindex="-1">
      <div id="desktop-icons"></div>
      <div id="lasso" class="hidden"></div>
    </div>
    <div id="window-layer"></div>
    <div id="snap-preview" class="hidden"></div>
    <div id="start-menu" class="hidden" aria-label="Menu Démarrer"></div>
    <div id="calendar-flyout" class="hidden"></div>
    <div id="taskbar"></div>
  </div>

  <div id="drop-overlay" class="hidden">
    <div class="drop-card">
      <div class="drop-icon">📥</div>
      <div class="drop-title">Déposez vos fichiers</div>
      <div class="drop-target-label">sur le Bureau</div>
    </div>
  </div>
  <div id="context-menu-layer"></div>
  <div id="toasts"></div>

  <noscript>WinGate nécessite JavaScript.</noscript>
  <script type="module" src="static/js/main.js"></script>
</body>
</html>

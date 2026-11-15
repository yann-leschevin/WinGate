// Identifiants des applications « WinGate » déclarées chez Google et Microsoft.
//
// Ces identifiants sont PUBLICS (ils figurent dans toute page qui se connecte à
// ces services) : ce ne sont pas des mots de passe. Tant qu'un identifiant est
// vide, le service correspondant est affiché comme « non configuré ».
//
// Marche à suivre détaillée : README.md, section « Stockage en ligne ».
//  - Google  : console.cloud.google.com → API « Google Drive API » activée →
//              écran de consentement → identifiant OAuth « Application Web »
//              avec l'URI de redirection  https://leschevin.com/projets/wingate/oauth.html
//  - Microsoft : portal.azure.com → « Inscriptions d'applications » → comptes
//              « de tout annuaire + comptes Microsoft personnels » → plateforme
//              « Application monopage (SPA) » avec la même URI de redirection.
export const CLOUD_CONFIG = {
  google: {
    clientId: '',
  },
  microsoft: {
    clientId: '',
  },
};

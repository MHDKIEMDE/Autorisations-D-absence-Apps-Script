// ============================================================
// Config.gs — Configuration complète du projet
// Système d'autorisation d'absence — Massaka SAS
// ============================================================
// ⚠️  Seul fichier à modifier pour configurer le système.
//     Tout est ici — plus besoin de toucher au Google Sheet.
// ============================================================

const CONFIG = {

  // ----------------------------------------------------------
  // 📋 Google Sheet des réponses formulaire
  // ----------------------------------------------------------
  SHEET_REPONSES_ID: 'REMPLACER_PAR_ID_DU_SHEET_REPONSES',
  ONGLET_REPONSES:   'Réponses au formulaire 1',

  // ----------------------------------------------------------
  // ⏱️  Délai minimum de préavis (toutes permissions sans exception)
  //     Le comptage exclut les samedis, dimanches et jours fériés.
  // ----------------------------------------------------------
  DELAI_MIN_JOURS_OUVRABLES: 3,
  DELAI_RELANCE_JOURS:       1,

  // ----------------------------------------------------------
  // 📅  Jours fériés locaux — format 'YYYY-MM-DD'
  // ----------------------------------------------------------
  JOURS_FERIES: [
    '2026-01-01',
    '2026-03-08',
    '2026-05-01',
    '2026-05-15',
    '2026-08-15',
    '2026-12-11',
    '2026-12-25',
    '2026-05-14',
    '2026-03-20',
    '2026-05-26',
    '2026-09-24'
  ],

  // ----------------------------------------------------------
  // ✉️  Présidence — 2 validateurs
  //     Le premier qui valide clôture le niveau.
  //     Le second reçoit une notification "X a déjà validé".
  // ----------------------------------------------------------
  EMAILS_PRESIDENCE: [
    'president1@massaka.com',   // ← à remplacer
    'president2@massaka.com'    // ← à remplacer
  ],
  NOMS_PRESIDENCE: [
    'Président Massaka SAS',    // ← à remplacer
    'Co-Président Massaka SAS'  // ← à remplacer
  ],

  // ----------------------------------------------------------
  // 🏛️  Thème visuel Massaka SAS
  // ----------------------------------------------------------
  PRESIDENCE_MAP: {
    'Massaka SAS': {
      emails:                    ['president1@massaka.com', 'president2@massaka.com'],
      noms:                      ['Président Massaka SAS', 'Co-Président Massaka SAS'],
      nomOrg:                    'Massaka SAS',
      couleur:                   '#000000',
      couleurBadge:              '#008080',
      couleurTexteBadge:         '#ffffff',
      couleurAccent:             '#005555',
      couleurTexte:              '#ffffff',
      couleurFondMotif:          '#f0f9fc',
      couleurFondDuree:          '#fff8e6',
      couleurLabelDuree:         '#856404',
      couleurBoutonRejet:          '#dc3545',
      couleurBoutonApprouver:      '#008080',
      couleurTexteBoutonApprouver: '#ffffff',
      couleurFondTableau:          '#f0f9fc',
      couleurTexteTableau:         '#000000',
      couleurLabelOption1:         '#000000',
      couleurBoutonTableau:        '#008080',
      couleurTexteBoutonTableau:   '#ffffff',
      police:                      "'Montserrat', 'Segoe UI', Arial, sans-serif"
    },
  },

  // ----------------------------------------------------------
  // 🏢  Mapping Service → Supérieur hiérarchique + Circuit
  //
  //     Circuits disponibles :
  //       'SUP_PRES' — Supérieur → Présidence
  //       'PRES'     — Présidence directement
  // ----------------------------------------------------------
  SERVICE_SUP_MAP: {
    'CpD (fadiilah@agence-mediaprod.com)':              { sup: 'fadiilah@agence-mediaprod.com',  workflow: 'SUP_PRES', nomOrg: 'Massaka SAS' },
    'Digitale (yann@agence-mediaprod.com)':             { sup: 'yann@agence-mediaprod.com',       workflow: 'SUP_PRES', nomOrg: 'Massaka SAS' },
    'Technique (eugene@agence-mediaprod.com)':          { sup: 'eugene@agence-mediaprod.com',     workflow: 'SUP_PRES', nomOrg: 'Massaka SAS' },
    'Administratif et financie (nawsheen@massaka.net)': { sup: null,                              workflow: 'PRES',     nomOrg: 'Massaka SAS' },
  },

  // ----------------------------------------------------------
  // 👤  Noms des supérieurs hiérarchiques
  // ----------------------------------------------------------
  SUP_NOMS: {
    'fadiilah@agence-mediaprod.com': 'Responsable CpD',          // ← à remplacer
    'yann@agence-mediaprod.com':     'Responsable Digitale',     // ← à remplacer
    'eugene@agence-mediaprod.com':   'Responsable Technique',    // ← à remplacer
  },

  // ----------------------------------------------------------
  // 📁  Google Drive
  // ----------------------------------------------------------
  DRIVE_DOSSIER_RACINE:   'REMPLACER_PAR_ID_DOSSIER_RACINE',
  DRIVE_DOSSIER_TEMPLATE: 'REMPLACER_PAR_ID_DOSSIER_TEMPLATE',

  // ----------------------------------------------------------
  // 🌐  URL de la Web App (à renseigner APRÈS déploiement)
  // ----------------------------------------------------------
  WEBAPP_URL: 'REMPLACER_APRES_DEPLOIEMENT',

  // ----------------------------------------------------------
  // 🏢  Organisation
  // ----------------------------------------------------------
  NOM_ORG: 'Massaka SAS',

  // ----------------------------------------------------------
  // 📊  Index des colonnes (base 1 — A=1)
  //     Matricule supprimé — SERVICE est maintenant en col C (3)
  // ----------------------------------------------------------
  COL: {
    HORODATEUR:    1,   // A  — Timestamp soumission
    EMAIL_EMPLOYE: 2,   // B  — Email employé
    NOM:           3,   // C  — Nom
    PRENOM:        4,   // D  — Prénom
    SERVICE:       5,   // E  — Service / Département
    TYPE_PERM:     6,   // F  — Type de permission
    TYPE_ABSENCE:  7,   // G  — Type d'absence (Permission exceptionnelle)
    DATE_DEBUT:    8,   // H  — Date de début
    HEURE_DEBUT:   9,   // I  — Heure de début
    DATE_FIN:      10,  // J  — Date de fin
    HEURE_FIN:     11,  // K  — Heure de fin
    MOTIF_LONG:    12,  // L  — Motif (Permission ordinaire)
    NB_JOURS:      13,  // M  — Nombre de jours
    DATE_DEBUT_ORD: 14, // N  — Date du début (Permission ordinaire)
    DATE_FIN_ORD:   15, // O  — Date du fin (Permission ordinaire)
    EMAIL_SUP:      16, // P  — Email supérieur (résolu automatiquement)
    AVIS_SUP:       17, // Q  — Avis supérieur
    AVIS_PRES:      18, // R  — Avis Présidence
    COMMENTAIRE:    19, // S  — Motif de rejet / commentaire
    ID_DEMANDE:     20, // T  — MSK-2026-0001
    TOKEN_SUP:      21, // U  — Token supérieur
    TOKEN_PRES:     22, // V  — Token Présidence
    STATUT_GLOBAL:  23, // W  — Statut global
    DATE_CLOTURE:   24, // X  — Date de clôture
    DRIVE_DOSSIER:  25, // Y  — ID dossier Drive
    DRIVE_DOC:      26, // Z  — ID Google Doc
    RELANCE:        27  // AA — Date dernière relance automatique
  }
};

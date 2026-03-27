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
  //     Pour toute urgence, contacter la RH directement.
  // ----------------------------------------------------------
  DELAI_MIN_JOURS_OUVRABLES: 3,   // 3 jours ouvrables minimum avant le début
  DELAI_RELANCE_JOURS:       1,   // Relance si pas de réponse après N jours

  // ----------------------------------------------------------
  // 📅  Jours fériés locaux — format 'YYYY-MM-DD'
  //     Ces jours sont exclus du comptage des jours ouvrables.
  //     Mettre à jour chaque année.
  // ----------------------------------------------------------
  JOURS_FERIES: [
    // — Fêtes fixes —
    '2026-01-01',  // Jour de l'An
    '2026-03-08',  // Journée internationale des droits de la femme
    '2026-05-01',  // Fête du Travail
    '2026-05-15',  // Journée des coutumes et traditions
    '2026-08-15',  // Assomption
    '2026-12-11',  // Fête nationale (Proclamation de la République)
    '2026-12-25',  // Noël
    // — Fêtes à dates mobiles 2026 (à confirmer selon croissant de lune pour les fêtes islamiques) —
    '2026-05-14',  // Ascension (40 jours après Pâques, 5 avril 2026)
    '2026-03-20',  // Aïd el-Fitr / Korité (1er Shawwal 1447)
    '2026-05-26',  // Aïd el-Kebir / Tabaski (10 Dhou al-Hijja 1447)
    '2026-09-24'   // Maouloud (12 Rabi' al-Awwal 1448 ≈ 24/09)
  ],

  // ----------------------------------------------------------
  // ✉️  Emails des validateurs — à renseigner ici
  // ----------------------------------------------------------
  EMAIL_RH:           'rh@massaka.com',
  NOM_RH:             'Responsable RH',

  // Présidence par défaut — utilisée si le superviseur n'est pas dans PRESIDENCE_MAP
  EMAIL_PRESIDENCE: 'president@massaka.com',
  NOM_PRESIDENCE:   'Président',

  // ----------------------------------------------------------
  // 🏛️  Mapping supérieur hiérarchique → Présidence compétente
  //
  //     Clé   = email exact du supérieur (identique à SUP_NOMS)
  //     Champs obligatoires :
  //       email          — email de la Présidence à notifier
  //       nom            — nom affiché dans les emails
  //     Champs visuels (personnalisation des emails) :
  //       couleur           — fond de l'entête email
  //       couleurBadge      — fond du badge
  //       couleurTexteBadge — texte du badge (#333333 par défaut)
  //       couleurAccent     — boutons Approuver, bordures, titres section
  //       couleurTexte      — texte sur l'entête (#ffffff ou #333333)
  //       couleurFondMotif  — fond de la card Motif (#f0f9fc par défaut)
  //       couleurFondDuree  — fond de la card Durée (#fff8e6 par défaut)
  //       couleurLabelDuree — label "Durée" dans la card (#856404 par défaut)
  //       couleurBoutonRejet — bouton Rejeter (#dc3545 par défaut)
  //       police            — font-family CSS
  //
  //     Deux types d'entrées possibles :
  //       1. Clé = email du supérieur  → thème spécifique + présidence compétente
  //       2. Clé = nom de l'org        → thème par défaut de l'organisation (fallback)
  //
  //     Si un supérieur n'est pas listé → fallback sur l'entrée dont nomOrg correspond,
  //     sinon EMAIL_PRESIDENCE et thème Massaka SAS par défaut.
  // ----------------------------------------------------------
  PRESIDENCE_MAP: {

    // ── Thèmes par défaut par organisation (fallback) ─────────────────────────
    'Massaka SAS': {
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
      couleurBoutonApprouver:      '#005555',
      couleurTexteBoutonApprouver: '#ffffff',
      couleurFondTableau:          '#f0f9fc',
      couleurTexteTableau:         '#555555',
      couleurLabelOption1:         '#005555',
      couleurBoutonTableau:        '#005555',
      couleurTexteBoutonTableau:   '#ffffff',
      police:                      "'Montserrat', 'Segoe UI', Arial, sans-serif"
    },
    'Agribusiness TV': {
      nomOrg:                    'Agribusiness TV',
      couleur:                   '#015438',
      couleurBadge:              '#7ED957',
      couleurTexteBadge:         '#1a3a1a',
      couleurAccent:             '#015438',
      couleurTexte:              '#ffffff',
      couleurFondMotif:          '#f0faf3',
      couleurFondDuree:          '#f5ffe8',
      couleurLabelDuree:         '#3a6604',
      couleurBoutonRejet:          '#dc3545',
      couleurBoutonApprouver:      '#7ED957',
      couleurTexteBoutonApprouver: '#ffffff',
      couleurFondTableau:          '#015438',
      couleurTexteTableau:       '#ffffff',
      couleurLabelOption1:       '#ffffff',
      couleurBoutonTableau:      '#7ED957',
      couleurTexteBoutonTableau: '#000000',
      police:                    "'Proxima Nova', 'Segoe UI', Arial, sans-serif"
    },

    // ── Supérieurs spécifiques (override — clé = email du supérieur) ──────────
    // 'sup@massaka.com': {
    //   email:              'president@massaka.com',
    //   nom:                'Président Massaka',
    //   nomOrg:             'Massaka SAS',
    //   couleur:            '#000000',
    //   couleurBadge:       '#f8c542',
    //   couleurTexteBadge:  '#333333',
    //   couleurAccent:      '#016579',
    //   couleurTexte:       '#ffffff',
    //   couleurFondMotif:   '#f0f9fc',
    //   couleurFondDuree:   '#fff8e6',
    //   couleurLabelDuree:  '#856404',
    //   couleurBoutonRejet: '#dc3545',
    //   police:             "'Montserrat', 'Segoe UI', Arial, sans-serif",
    // },

  },

  // ----------------------------------------------------------
  // 🏢  Mapping Service → Supérieur hiérarchique + Circuit de validation
  //
  //     Clé     = valeur EXACTE du champ "Service" dans le formulaire
  //     sup     = email du supérieur hiérarchique (null si sans supérieur)
  //     workflow = circuit de validation :
  //       'SUP_RH_PRES' — Supérieur → RH → Présidence  (circuit complet)
  //       'RH_PRES'     — RH → Présidence              (pas de supérieur)
  //       'PRES'        — Présidence directement        (validateur final unique)
  //       'PRES_RH'     — Présidence → RH              (RH est validateur final, ex : Administration)
  //
  //     À chaque soumission, le script lit le service, résout l'email
  //     du supérieur et initialise automatiquement les niveaux selon
  //     le workflow défini (les niveaux sautés sont marqués "Approuvé").
  //
  //     ⚠️  Supprimer la question "Supérieur hiérarchique" du Google Form.
  // ----------------------------------------------------------
  SERVICE_SUP_MAP: {

    // ── MEDIAPROD ─────────────────────────────────────────────────────────────
    'MEDIAPROD':                         { sup: 'sup.mediaprod@massaka.com',        workflow: 'SUP_RH_PRES', nomOrg: 'Massaka SAS'     },
    'Administration (Massaka SAS)':      { sup: null,                               workflow: 'PRES_RH',     nomOrg: 'Massaka SAS'     },
    'Chef de section — MEDIAPROD':       { sup: null,                               workflow: 'PRES_RH',     nomOrg: 'Massaka SAS'     },

    // ── Agribusiness TV ──────────────────────────────────────────────────────
    'Chef de section — AGRIBUSINESS TV': { sup: null,                               workflow: 'PRES_RH',     nomOrg: 'Agribusiness TV' },
    'Editoriale (Agribusiness TV)':      { sup: 'sup.editorial@agribusiness.com',   workflow: 'SUP_RH_PRES', nomOrg: 'Agribusiness TV' },
    'Techniciens Éditorial (Agribusiness TV)': { sup: 'sup.tech.edit@agribusiness.com', workflow: 'SUP_RH_PRES', nomOrg: 'Agribusiness TV' },

  },

  // ----------------------------------------------------------
  // 👤  Noms des supérieurs hiérarchiques
  //     Clé = email exact (identique aux champs sup de SERVICE_SUP_MAP)
  //     Valeur = nom affiché dans les emails
  // ----------------------------------------------------------
  SUP_NOMS: {

    // ── MEDIAPROD ─────────────────────────────────────────────────────────────
    'sup.mediaprod@massaka.com':       'Prénom Nom — Responsable MEDIAPROD',

    // ── Agribusiness TV ──────────────────────────────────────────────────────
    'sup.editorial@agribusiness.com':  'Prénom Nom — Responsable Éditorial',
    'sup.tech.edit@agribusiness.com':  'Prénom Nom — Responsable Technique (Éditorial)',

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
  // 📊  Index des colonnes (base 1 — A=1 ... AB=28)
  // ----------------------------------------------------------
  COL: {
    HORODATEUR:    1,   // A  — Timestamp soumission
    EMAIL_EMPLOYE: 2,   // B  — Email employé
    MATRICULE:     3,   // C  — Matricule
    NOM:           4,   // D  — Nom
    PRENOM:        5,   // E  — Prénom
    SERVICE:       6,   // F  — Service / Fonction
    TYPE_PERM:     7,   // G  — Type de permission
    TYPE_ABSENCE:  8,   // H  — Type d'absence (Permission exceptionnelle)
    DATE_DEBUT:    9,   // I  — Date de début
    HEURE_DEBUT:   10,  // J  — Heure de début
    DATE_FIN:      11,  // K  — Date de fin
    HEURE_FIN:     12,  // L  — Heure de fin
    MOTIF_LONG:     13,  // M  — Motif (Permission ordinaire)
    NB_JOURS:       14,  // N  — Nombre de jours
    DATE_DEBUT_ORD: 15,  // O  — Date du début (Permission ordinaire)
    DATE_FIN_ORD:   16,  // P  — Date du fin (Permission ordinaire)
    EMAIL_SUP:      17,  // Q  — Email supérieur (résolu automatiquement via SERVICE_SUP_MAP)
    AVIS_SUP:       18,  // R  — Avis supérieur
    AVIS_RH:        19,  // S  — Avis RH
    AVIS_PRES:      20,  // T  — Avis Présidence
    COMMENTAIRE:    21,  // U  — Motif de rejet / commentaire
    ID_DEMANDE:     22,  // V  — MSK-2026-0001
    TOKEN_SUP:      23,  // W  — Token supérieur
    TOKEN_RH:       24,  // X  — Token RH
    TOKEN_PRES:     25,  // Y  — Token Présidence
    STATUT_GLOBAL:  26,  // Z  — Statut global
    DATE_CLOTURE:   27,  // AA — Date de clôture
    DRIVE_DOSSIER:  28,  // AB — ID dossier Drive
    DRIVE_DOC:      29,  // AC — ID Google Doc
    RELANCE:        30   // AD — Date derniere relance automatique
  }
};

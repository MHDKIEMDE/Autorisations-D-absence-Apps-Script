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
    // — Fêtes civiles et chrétiennes —
    '2026-01-01',  // Jour de l'An
    '2026-04-03',  // Vendredi Saint
    '2026-04-04',  // Jour de l'Indépendance (Sénégal)
    '2026-04-06',  // Lundi de Pâques
    '2026-05-01',  // Fête du Travail
    '2026-05-14',  // Ascension
    '2026-05-25',  // Lundi de Pentecôte
    '2026-08-15',  // Assomption
    '2026-11-01',  // Toussaint
    '2026-12-25',  // Noël
    // — Fêtes islamiques 2026 (dates approximatives — à confirmer selon croissant de lune) —
    '2026-03-30',  // Korité / Aïd el-Fitr (fin du Ramadan 1447)
    '2026-06-06',  // Tabaski / Aïd el-Adha (10 Dhou al-Hijja 1447)
    '2026-07-26',  // Tamkharit / Achoura (10 Mouharram 1448)
    '2026-10-04'   // Maouloud (12 Rabi' al-Awwal 1448)
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
  //       couleur        — fond de l'entête email
  //       couleurBadge   — couleur du badge
  //       couleurAccent  — boutons et bordures
  //       couleurTexte   — texte sur l'entête (#ffffff ou #333333)
  //       police         — font-family CSS
  //
  //     Si un supérieur n'est pas listé ici → EMAIL_PRESIDENCE
  //     et le thème Massaka SAS sont utilisés par défaut.
  // ----------------------------------------------------------
  PRESIDENCE_MAP: {

    // ── Massaka SAS ──────────────────────────────────────────────────────────
    // 'sup1@massaka.com': {
    //   email:         'massaka@president.com',
    //   nom:           'REMPLACER — Président Massaka SAS',
    //   couleur:       '#016579',    // fond entête
    //   couleurBadge:  '#f8c542',   // badge
    //   couleurAccent: '#016579',   // boutons / bordures
    //   couleurTexte:  '#ffffff',   // texte sur entête
    //   police:        "'Segoe UI', Arial, sans-serif",
    // },

    // ── Agribusiness TV ──────────────────────────────────────────────────────
    // Couleurs secondaires : #B9EB57 (vert) · #F4EA37 (jaune) · #FF774D (orange)
    // Typographie : Proxima Nova
    // 'sup2@massaka.com': {
    //   email:         'agribusiness@president.info',
    //   nom:           'REMPLACER — Président Agribusiness TV',
    //   couleur:       '#FF774D',    // fond entête (orange)
    //   couleurBadge:  '#F4EA37',   // badge (jaune)
    //   couleurAccent: '#B9EB57',   // boutons / bordures (vert)
    //   couleurTexte:  '#ffffff',   // texte sur entête
    //   police:        "'Proxima Nova', 'Segoe UI', Arial, sans-serif",
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
  //       'PRES'        — Présidence directement        (ex : RH)
  //
  //     À chaque soumission, le script lit le service, résout l'email
  //     du supérieur et initialise automatiquement les niveaux selon
  //     le workflow défini (les niveaux sautés sont marqués "Approuvé").
  //
  //     ⚠️  Supprimer la question "Supérieur hiérarchique" du Google Form.
  // ----------------------------------------------------------
  SERVICE_SUP_MAP: {

    // ── Massaka SAS ───────────────────────────────────────────────────────────
    'CDP':                   { sup: 'REMPLACER_SUP_CDP',       workflow: 'SUP_RH_PRES' },  // Communication pour le Développement
    'CD':                    { sup: 'REMPLACER_SUP_CD',        workflow: 'SUP_RH_PRES' },  // Communication pour le Digital
    'Techniciens CDP':       { sup: 'REMPLACER_SUP_TECH_CDP',  workflow: 'SUP_RH_PRES' },  // Techniciens CDP — Massaka SAS
    'Comptabilité':          { sup: null,                      workflow: 'RH_PRES'     },  // Pas de supérieur → RH → Présidence
    'Marketing':             { sup: null,                      workflow: 'RH_PRES'     },  // Pas de supérieur → RH → Présidence
    'RH':                    { sup: null,                      workflow: 'PRES'        },  // Répond directement à la Présidence

    // ── Agribusiness TV ──────────────────────────────────────────────────────
    'Editoriale':            { sup: 'REMPLACER_SUP_EDITORIALE',  workflow: 'SUP_RH_PRES' },  // Service Éditorial
    'Techniciens Éditorial': { sup: 'REMPLACER_SUP_TECH_EDIT',   workflow: 'SUP_RH_PRES' },  // Techniciens Éditorial — Agribusiness TV

  },

  // ----------------------------------------------------------
  // 👤  Noms des supérieurs hiérarchiques
  //     Clé = email exact (identique aux champs sup de SERVICE_SUP_MAP)
  //     Valeur = nom affiché dans les emails
  // ----------------------------------------------------------
  SUP_NOMS: {

    // ── Massaka SAS ───────────────────────────────────────────────────────────
    'REMPLACER_SUP_CDP':        'Prénom Nom — Directeur CDP',
    'REMPLACER_SUP_CD':         'Prénom Nom — Directeur CD',
    'REMPLACER_SUP_TECH_CDP':   'Prénom Nom — Responsable Technique (CDP)',

    // ── Agribusiness TV ──────────────────────────────────────────────────────
    'REMPLACER_SUP_EDITORIALE': 'Prénom Nom — Responsable Éditorial',
    'REMPLACER_SUP_TECH_EDIT':  'Prénom Nom — Responsable Technique (Éditorial)',

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

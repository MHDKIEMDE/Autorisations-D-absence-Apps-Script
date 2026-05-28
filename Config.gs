// ============================================================
// Config.gs — Configuration complète du projet
// Système d'autorisation d'absence — Massaka SAS
// ============================================================
// ⚠️  Seul fichier à modifier pour configurer le système.
//     Toutes les informations personnel (noms, emails) sont
//     ici — aucun email n'est écrit en dur ailleurs.
// ============================================================

const CONFIG = {

  // ----------------------------------------------------------
  // 📋 Google Sheet des réponses formulaire
  // ----------------------------------------------------------
  SHEET_REPONSES_ID: 'REMPLACER_PAR_ID_DU_SHEET_REPONSES',
  ONGLET_REPONSES:   'Réponses au formulaire 1',

  // ----------------------------------------------------------
  // ⏱️  Délai minimum de préavis
  //     Le comptage exclut les samedis, dimanches et jours fériés.
  // ----------------------------------------------------------
  DELAI_MIN_JOURS_OUVRABLES: 3,
  DELAI_RELANCE_JOURS:       1,

  // ----------------------------------------------------------
  // 📅  Jours fériés locaux — format 'YYYY-MM-DD'
  // ----------------------------------------------------------
  JOURS_FERIES: [
    '2026-01-01',  // Jour de l'An
    '2026-03-08',  // Journée internationale des droits de la femme
    '2026-05-01',  // Fête du Travail
    '2026-05-15',  // Journée des coutumes et traditions
    '2026-08-15',  // Assomption
    '2026-12-11',  // Fête nationale
    '2026-12-25',  // Noël
    '2026-05-14',  // Ascension
    '2026-03-20',  // Aïd el-Fitr / Korité
    '2026-05-26',  // Aïd el-Kebir / Tabaski
    '2026-09-24'   // Maouloud
  ],

  // ----------------------------------------------------------
  // 👥  PERSONNEL — à modifier ici uniquement
  //
  //     PRESIDENCE : 2 co-validateurs.
  //       Le premier qui approuve/rejette clôture la demande.
  //       Le second reçoit un email "déjà validée".
  //
  //     SUPERIEURS : un objet par supérieur.
  //       clé  = identifiant interne (ex: 'SUP_CPD') — ne pas
  //              mettre l'email en clé, il est dans l'objet.
  //       email = adresse email du supérieur
  //       nom   = nom affiché dans les emails
  // ----------------------------------------------------------
  PERSONNEL: {

    presidence: [
      { email: 'president1@massaka.com',   nom: 'Président Massaka SAS'   },  // ← à remplacer
      { email: 'president2@massaka.com',   nom: 'Co-Président Massaka SAS' }  // ← à remplacer
    ],

    superieurs: {
      SUP_CPD:        { email: 'superieur.cpd@massaka.com',        nom: 'Responsable CpD'          },  // ← à remplacer
      SUP_DIGITALE:   { email: 'superieur.digitale@massaka.com',   nom: 'Responsable Digitale'     },  // ← à remplacer
      SUP_TECHNIQUE:  { email: 'superieur.technique@massaka.com',  nom: 'Responsable Technique'    },  // ← à remplacer
    }

  },

  // ----------------------------------------------------------
  // 🏢  Mapping Département → Supérieur + Circuit de validation
  //
  //     Clé = valeur EXACTE du champ "Département" dans le formulaire
  //           (noms simples, sans emails)
  //
  //     sup      = clé dans PERSONNEL.superieurs (ou null)
  //     workflow = 'SUP_PRES' | 'PRES'
  //       'SUP_PRES' — Supérieur → Présidence
  //       'PRES'     — Présidence directement
  // ----------------------------------------------------------
  SERVICE_SUP_MAP: {
    'CpD':                       { sup: 'SUP_CPD',       workflow: 'SUP_PRES', nomOrg: 'Massaka SAS' },
    'Digitale':                  { sup: 'SUP_DIGITALE',  workflow: 'SUP_PRES', nomOrg: 'Massaka SAS' },
    'Technique':                 { sup: 'SUP_TECHNIQUE', workflow: 'SUP_PRES', nomOrg: 'Massaka SAS' },
    'Administratif et financier':{ sup: null,            workflow: 'PRES',     nomOrg: 'Massaka SAS' },
  },

  // ----------------------------------------------------------
  // 🎨  Thème visuel Massaka SAS
  //     (couleurs des emails HTML — ne pas modifier sauf branding)
  // ----------------------------------------------------------
  THEME: {
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
  // ----------------------------------------------------------
  COL: {
    HORODATEUR:     1,   // A  — Timestamp soumission
    EMAIL_EMPLOYE:  2,   // B  — Email employé
    NOM:            3,   // C  — Nom
    PRENOM:         4,   // D  — Prénom
    SERVICE:        5,   // E  — Département
    TYPE_PERM:      6,   // F  — Type de permission
    TYPE_ABSENCE:   7,   // G  — Type d'absence (Permission exceptionnelle)
    DATE_DEBUT:     8,   // H  — Date de début
    HEURE_DEBUT:    9,   // I  — Heure de début
    DATE_FIN:       10,  // J  — Date de fin
    HEURE_FIN:      11,  // K  — Heure de fin
    MOTIF_LONG:     12,  // L  — Motif (Permission ordinaire)
    NB_JOURS:       13,  // M  — Nombre de jours
    DATE_DEBUT_ORD: 14,  // N  — Date début (Permission ordinaire)
    DATE_FIN_ORD:   15,  // O  — Date fin (Permission ordinaire)
    EMAIL_SUP:      16,  // P  — Email supérieur (résolu automatiquement)
    AVIS_SUP:       17,  // Q  — Avis supérieur
    AVIS_PRES:      18,  // R  — Avis Présidence
    COMMENTAIRE:    19,  // S  — Motif de rejet / commentaire
    ID_DEMANDE:     20,  // T  — MSK-2026-0001
    TOKEN_SUP:      21,  // U  — Token supérieur
    TOKEN_PRES:     22,  // V  — Token Présidence
    STATUT_GLOBAL:  23,  // W  — Statut global
    DATE_CLOTURE:   24,  // X  — Date de clôture
    DRIVE_DOSSIER:  25,  // Y  — ID dossier Drive
    DRIVE_DOC:      26,  // Z  — ID Google Doc
    RELANCE:        27   // AA — Date dernière relance automatique
  }
};

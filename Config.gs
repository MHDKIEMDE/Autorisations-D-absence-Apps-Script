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
  //
  //     sup      = clé dans PERSONNEL.superieurs (ou null)
  //     workflow = 'SUP_PRES' | 'PRES'
  //       'SUP_PRES' — Supérieur → Présidence
  //       'PRES'     — Présidence directement (chefs de section)
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
  //
  //     Colonnes A–L  : réponses du formulaire Google
  //     Colonnes M–X  : gérées automatiquement par le script
  // ----------------------------------------------------------
  COL: {
    HORODATEUR:     1,   // A  — Timestamp soumission
    EMAIL_EMPLOYE:  2,   // B  — Adresse e-mail
    NOM:            3,   // C  — Nom
    PRENOM:         4,   // D  — Prénom
    DEPARTEMENT:    5,   // E  — Département
    TYPE_ABSENCE:   6,   // F  — Type d'absence (Maladie / Famille / Activités syndicales / Activités judiciaires / Motif syndical / Autre)
    FAMILLE:        7,   // G  — Sous-type Famille (rempli uniquement si TYPE_ABSENCE = "Famille")
    HEURE_DEBUT:    8,   // H  — Heure de début
    HEURE_FIN:      9,   // I  — Heure de fin
    DATE_DEBUT:     10,  // J  — Date de début
    DATE_FIN:       11,  // K  — Date de fin
    MOTIF:          12,  // L  — Motif libre (rempli si TYPE_ABSENCE = "Autre" ou FAMILLE = "Autre")
    EMAIL_SUP:      13,  // M  — Email supérieur (résolu automatiquement)
    AVIS_SUP:       14,  // N  — Avis supérieur
    AVIS_PRES:      15,  // O  — Avis Présidence
    COMMENTAIRE:    16,  // P  — Motif de rejet / commentaire
    ID_DEMANDE:     17,  // Q  — MSK-2026-0001
    TOKEN_SUP:      18,  // R  — Token supérieur
    TOKEN_PRES:     19,  // S  — Token Présidence
    STATUT_GLOBAL:  20,  // T  — Statut global
    DATE_CLOTURE:   21,  // U  — Date de clôture
    DRIVE_DOSSIER:  22,  // V  — ID dossier Drive
    DRIVE_DOC:      23,  // W  — ID Google Doc
    RELANCE:        24   // X  — Date dernière relance automatique
  }
};

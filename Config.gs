// ============================================================
// Config.gs — Configuration complète du projet
// Système d'autorisation d'absence — Agribusiness TV
// ============================================================
// ⚠️  Seul fichier à modifier pour configurer le système.
//     Toutes les informations personnel (noms, emails) sont
//     ici — aucun email n'est écrit en dur ailleurs.
// ============================================================

const CONFIG = {

  // ----------------------------------------------------------
  // 📋 Google Sheet des réponses formulaire
  // ----------------------------------------------------------
  SHEET_REPONSES_ID: 'REMPLACER_PAR_ID_DU_SHEET_REPONSES',   // ← Sheet Agribusiness TV (⚠️ ne pas réutiliser celui de Massaka SAS)
  ONGLET_REPONSES:   'Autorisations',

  // ----------------------------------------------------------
  // ⏱️  Délai minimum de préavis
  //     Le comptage exclut les samedis, dimanches et jours fériés.
  // ----------------------------------------------------------
  DELAI_MIN_JOURS_OUVRABLES: 3,
  DELAI_RELANCE_JOURS:       1,

  // ----------------------------------------------------------
  // 🚨  Types d'absence EXEMPTÉS du contrôle de délai
  //     Ces types peuvent être soumis à l'instant t (pas de
  //     rejet automatique pour préavis insuffisant). Ils suivent
  //     ensuite le circuit de validation normal du département.
  //     La valeur doit correspondre EXACTEMENT au libellé du
  //     champ "Type d'absence" du formulaire.
  // ----------------------------------------------------------
  TYPES_SANS_DELAI: ['Urgence'],

  // ----------------------------------------------------------
  // 👨‍👩‍👧  Durées prédéfinies des sous-types "Famille"
  //     Quand l'employé choisit un de ces sous-types, le script
  //     calcule automatiquement la date de fin :
  //         date fin = date début + (N - 1) jours calendaires
  //     (N = durée totale ; ex: 3 jours du lundi → fin mercredi)
  //
  //     ⚠️  Les clés doivent correspondre EXACTEMENT au libellé
  //         du champ "Type d'absence (famille)" du formulaire.
  // ----------------------------------------------------------
  DUREES_FAMILLE: {
    'Mariage du travailleur (02 jours)':                                      2,
    'Naissance d\'un enfant (03 jours)':                                      3,
    'Mariage d\'un enfant, d\'un frère, ou d\'une sœur en ligne directe (02 jours)':   2,
    'Décès du conjoint ou d\'un ascendant en ligne directe (02 jours)':       2,
    'Décès d\'un ascendant, d\'un frère, ou d\'une sœur en ligne directe (02 jours)':  2,
    'Décès d\'un beau-père ou d\'une belle-mère en ligne directe (02 jours)': 2
  },

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
  //     PRESIDENTS : Agribusiness TV a UN président unique.
  //       La clé 'PRES_GENERAL' est référencée par
  //       SERVICE_SUP_MAP[département].presidence et sert aussi de
  //       fallback si un département ne pointe vers aucun président.
  //
  //     SUPERIEURS : un objet par supérieur.
  //       clé  = identifiant interne (ex: 'SUP_EDITORIAL') — ne pas
  //              mettre l'email en clé, il est dans l'objet.
  //       email = adresse email du supérieur
  //       nom   = nom affiché dans les emails
  // ----------------------------------------------------------
  PERSONNEL: {

    // Président unique Agribusiness TV — valide tous les départements.
    presidents: {
      PRES_GENERAL: { email: 'president@agribusinesstv.com', nom: 'Gérant d\'Agribusiness TV' }  // ← à remplacer
    },

    // Contrôle croisé entre présidents : sans objet ici (président
    // unique). Si le président soumet lui-même une demande, il reste
    // son propre validateur (un WARN est journalisé). Pour activer un
    // contrôle croisé, ajouter un second président ci-dessus puis :
    //   presidentCroise: { PRES_GENERAL: 'PRES_AUTRE', ... }
    presidentCroise: {},

    superieurs: {
      SUP_EDITORIAL: { email: 'superieur.editorial@agribusinesstv.com', nom: 'Responsable Éditorial' },  // ← à remplacer
      SUP_TECHNIQUE: { email: 'superieur.technique@agribusinesstv.com', nom: 'Responsable Technique' },  // ← à remplacer
    }

  },

  // ----------------------------------------------------------
  // 🛡️  Administrateurs — emails autorisés à éditer manuellement
  //     n'importe quelle colonne d'avis (P/Q), sans être le
  //     validateur désigné de la ligne. Pour maintenance / tests.
  // ----------------------------------------------------------
  ADMINS: [
    'officie9@gmail.com'   // ← propriétaire du Sheet
  ],

  // ----------------------------------------------------------
  // ✉️  Adresse expéditrice des emails (facultatif)
  //     Vide  → les emails partent du compte qui exécute le script.
  //     Sinon → doit être un ALIAS déjà validé sur ce compte
  //             (Gmail → Paramètres → Comptes → « Envoyer en tant que »).
  //     Une adresse non validée est ignorée par Gmail.
  // ----------------------------------------------------------
  EMAIL_EXPEDITEUR: '',

  // ----------------------------------------------------------
  // 🏢  Mapping Département → Supérieur + Circuit + Présidence
  //
  //     Clé = valeur EXACTE du champ "Département" dans le formulaire
  //
  //     sup        = clé dans PERSONNEL.superieurs (ou null)
  //     workflow   = 'SUP_PRES' | 'PRES'
  //       'SUP_PRES' — Supérieur → Présidence
  //       'PRES'     — Présidence directement (chefs de section)
  //     presidence = clé dans PERSONNEL.presidents — désigne QUEL
  //                  président valide ce département.
  //                  (fallback : PRES_GENERAL)
  // ----------------------------------------------------------
  SERVICE_SUP_MAP: {
    'Éditorial':      { sup: 'SUP_EDITORIAL', workflow: 'SUP_PRES', presidence: 'PRES_GENERAL', nomOrg: 'Agribusiness TV' },
    'Technique':      { sup: 'SUP_TECHNIQUE', workflow: 'SUP_PRES', presidence: 'PRES_GENERAL', nomOrg: 'Agribusiness TV' },
    'Administration': { sup: null,            workflow: 'PRES',     presidence: 'PRES_GENERAL', nomOrg: 'Agribusiness TV' },
  },

  // ----------------------------------------------------------
  // 🎨  Thème visuel Agribusiness TV
  //     (couleurs des emails HTML — ne pas modifier sauf branding)
  // ----------------------------------------------------------
  THEME: {
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
    couleurTexteBoutonApprouver: '#000000',
    couleurFondTableau:          '#015438',
    couleurTexteTableau:         '#ffffff',
    couleurLabelOption1:         '#ffffff',
    couleurBoutonTableau:        '#7ED957',
    couleurTexteBoutonTableau:   '#000000',
    police:                      "'Proxima Nova', 'Segoe UI', Arial, sans-serif"
  },

  // ----------------------------------------------------------
  // 📁  Google Drive
  // ----------------------------------------------------------
  DRIVE_DOSSIER_RACINE:   'REMPLACER_PAR_ID_DOSSIER_RACINE',
  DRIVE_DOSSIER_TEMPLATE: 'REMPLACER_PAR_ID_DOSSIER_TEMPLATE',

  // Dossier d'archive ADMIN — reçoit une copie PDF de chaque demande validée.
  // Partagez ce dossier dans Drive uniquement avec les admins choisis.
  DRIVE_DOSSIER_ARCHIVE:  'REMPLACER_PAR_ID_DOSSIER_ARCHIVE',

  // ----------------------------------------------------------
  // 🌐  URL de la Web App (à renseigner APRÈS déploiement)
  // ----------------------------------------------------------
  WEBAPP_URL: 'REMPLACER_APRES_DEPLOIEMENT',

  // ----------------------------------------------------------
  // 🏢  Organisation
  // ----------------------------------------------------------
  NOM_ORG: 'Agribusiness TV',

  // ----------------------------------------------------------
  // 📊  Index des colonnes (base 1 — A=1)
  //
  //     Colonnes A–N  : réponses du formulaire Google
  //     Colonnes O–Z  : gérées automatiquement par le script
  //
  //     ⚠️  L'ordre DOIT correspondre à l'ordre de création des
  //         questions dans CreerFormulaire.gs (Forms écrit une
  //         colonne par question, dans l'ordre de création).
  // ----------------------------------------------------------
  COL: {
    HORODATEUR:     1,   // A  — Timestamp soumission
    EMAIL_EMPLOYE:  2,   // B  — Adresse e-mail
    NOM:            3,   // C  — Nom
    PRENOM:         4,   // D  — Prénom
    DEPARTEMENT:    5,   // E  — Département
    TYPE_ABSENCE:   6,   // F  — Type d'absence (Maladie d'un proche / Famille / Administration / Activités judiciaires / Motif syndical / Urgence / Autre)
    FAMILLE:        7,   // G  — Sous-type Famille (rempli si TYPE_ABSENCE = "Famille")
    MOTIF_URGENCE:  8,   // H  — Motif de l'urgence (rempli si TYPE_ABSENCE = "Urgence")
    MOTIF:          9,   // I  — Motif libre (rempli si TYPE_ABSENCE = "Autre")
    DATE_DEBUT:     10,  // J  — Date de début
    DUREE:          11,  // K  — Durée ("Toute la journée" / "Personnaliser")
    HEURE_DEBUT:    12,  // L  — Heure de début (si "Personnaliser")
    HEURE_FIN:      13,  // M  — Heure de fin (si "Personnaliser")
    DATE_FIN:       14,  // N  — Date de fin (si "Personnaliser" ; sinon calculée)
    EMAIL_SUP:      15,  // O  — Email supérieur (résolu automatiquement)
    AVIS_SUP:       16,  // P  — Avis supérieur
    AVIS_PRES:      17,  // Q  — Avis Présidence
    COMMENTAIRE:    18,  // R  — Motif de rejet / commentaire
    ID_DEMANDE:     19,  // S  — ABT-2026-0001
    TOKEN_SUP:      20,  // T  — Token supérieur
    TOKEN_PRES:     21,  // U  — Token Présidence
    STATUT_GLOBAL:  22,  // V  — Statut global
    DATE_CLOTURE:   23,  // W  — Date de clôture
    DRIVE_DOSSIER:  24,  // X  — ID dossier Drive
    DRIVE_DOC:      25,  // Y  — ID Google Doc
    RELANCE:        26,  // Z  — Date dernière relance automatique
    TOKEN_PRECISION:  27, // AA — Token du lien de réponse employé (demande de précisions)
    NIVEAU_PRECISION: 28, // AB — Niveau ayant demandé les précisions (Superieur/Presidence)
    NB_PRECISIONS:    29  // AC — Compteur de demandes de précisions (max MAX_PRECISIONS)
  },

  // ----------------------------------------------------------
  // 💬  Demande de précisions — nombre maximum d'allers-retours
  //     qu'un validateur peut déclencher sur une même demande.
  // ----------------------------------------------------------
  MAX_PRECISIONS: 2
};

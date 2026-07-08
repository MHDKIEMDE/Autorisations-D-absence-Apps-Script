// ============================================================
// Setup.gs — Initialisation unique du projet
// A executer UNE SEULE FOIS apres avoir renseigne
// SHEET_REPONSES_ID dans Config.gs.
// ============================================================


// ============================================================
// Menu personnalise — apparait automatiquement a l'ouverture
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Absences')
    .addItem('Filtrer par mois / année',                'filtrerParMoisAnnee')
    .addItem('Tout afficher',                           'toutAfficher')
    .addSeparator()
    .addItem('⚙️ Activer validation manuelle (Sheet)',  'installerTriggerValidationManuelle')
    .addItem('Renvoyer une validation (manuel)',        'renvoyerValidationManuelle')
    .addItem('Reprendre un traitement échoué',         'reprendreTraitement')
    .addItem('Nettoyer les triggers en double',        'nettoyerTriggers')
    .addSeparator()
    .addItem('Reconfigurer les couleurs',               'colorerStatuts')
    .addItem('Reconfigurer les protections',            'configurerProtections')
    .addSeparator()
    .addItem('🚀 Initialiser le projet (1ère fois)',    'initialiserProjet')
    .addToUi();
}


// ============================================================
// Filtrage par mois / année (masque les lignes hors periode)
// ============================================================
function filtrerParMoisAnnee() {
  const ui  = SpreadsheetApp.getUi();
  const rep = ui.prompt(
    'Filtrer par période',
    'Entrez mois/année (ex: 3/2026) ou juste l\'année (ex: 2026) :',
    ui.ButtonSet.OK_CANCEL
  );
  if (rep.getSelectedButton() !== ui.Button.OK) return;

  const texte = rep.getResponseText().trim();
  if (!texte) { toutAfficher(); return; }

  let filtreAnnee = null, filtreMois = null;
  if (texte.includes('/')) {
    const parts = texte.split('/');
    filtreMois  = parseInt(parts[0], 10);
    filtreAnnee = parseInt(parts[1], 10);
  } else {
    filtreAnnee = parseInt(texte, 10);
  }

  if (isNaN(filtreAnnee)) {
    ui.alert('Format invalide. Exemples : 3/2026 ou 2026');
    return;
  }

  const sheet   = getSheetReponses();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Afficher toutes les lignes d'abord
  sheet.showRows(2, lastRow - 1);

  const dates = sheet.getRange(2, CONFIG.COL.HORODATEUR, lastRow - 1, 1).getValues();
  let visibles = 0;

  dates.forEach(([val], i) => {
    const d = new Date(val);
    if (!val || isNaN(d)) return;
    const anneeRow = d.getFullYear();
    const moisRow  = d.getMonth() + 1;
    const match = anneeRow === filtreAnnee && (filtreMois === null || moisRow === filtreMois);
    if (!match) sheet.hideRows(i + 2);
    else visibles++;
  });

  ui.alert(`Filtre appliqué — ${visibles} demande(s) affichée(s).`);
}

function toutAfficher() {
  const sheet   = getSheetReponses();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) sheet.showRows(2, lastRow - 1);
  SpreadsheetApp.getUi().alert('Toutes les demandes sont affichées.');
}


// ============================================================
// Couleurs conditionnelles sur les colonnes de statut
// En attente → jaune neutre
// Approuvé   → vert
// Rejeté     → rouge
// ============================================================
function colorerStatuts() {
  const ss    = SpreadsheetApp.openById(CONFIG.SHEET_REPONSES_ID);
  const sheet = ss.getSheetByName(CONFIG.ONGLET_REPONSES);
  if (!sheet) return;

  const lastRow = Math.max(sheet.getLastRow(), 100);

  const colonnes = [
    CONFIG.COL.AVIS_SUP,
    CONFIG.COL.AVIS_PRES,
    CONFIG.COL.STATUT_GLOBAL
  ];

  // Supprimer toutes les regles existantes puis reconstruire
  const nouvellesRegles = [];

  colonnes.forEach(col => {
    const range = sheet.getRange(2, col, lastRow - 1, 1);

    // Rouge — Rejeté (toutes variantes)
    nouvellesRegles.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('Rejeté')
        .setBackground('#FFCDD2')
        .setFontColor('#B71C1C')
        .setRanges([range])
        .build()
    );

    // Vert — Approuvé
    nouvellesRegles.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('Approuvé')
        .setBackground('#C8E6C9')
        .setFontColor('#1B5E20')
        .setRanges([range])
        .build()
    );

    // Jaune — En attente
    nouvellesRegles.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('En attente')
        .setBackground('#FFF9C4')
        .setFontColor('#827717')
        .setRanges([range])
        .build()
    );

    // Jaune — En cours (STATUT_GLOBAL)
    nouvellesRegles.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('En cours')
        .setBackground('#FFF9C4')
        .setFontColor('#827717')
        .setRanges([range])
        .build()
    );
  });

  sheet.setConditionalFormatRules(nouvellesRegles);
  Logger.log('[OK][Setup] Couleurs conditionnelles configurees sur ' + colonnes.length + ' colonnes.');
  SpreadsheetApp.getUi().alert('Couleurs mises à jour.');
}

function initialiserProjet() {
  const ss    = SpreadsheetApp.openById(CONFIG.SHEET_REPONSES_ID);
  const sheet = ss.getSheetByName(CONFIG.ONGLET_REPONSES);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      'Erreur — Onglet "' + CONFIG.ONGLET_REPONSES + '" introuvable.\n' +
      'Verifiez que SHEET_REPONSES_ID est correct dans Config.gs.'
    );
    return;
  }

  // ----------------------------------------------------------
  // 1. En-tetes des colonnes script O → Z (uniquement si vides)
  // ----------------------------------------------------------
  const headers = [
    { col: CONFIG.COL.EMAIL_SUP,     nom: 'Email_Superieur'  },
    { col: CONFIG.COL.AVIS_SUP,      nom: 'Avis_Superieur'   },
    { col: CONFIG.COL.AVIS_PRES,     nom: 'Avis_Presidence'  },
    { col: CONFIG.COL.COMMENTAIRE,   nom: 'Commentaires'     },
    { col: CONFIG.COL.ID_DEMANDE,    nom: 'ID_Demande'       },
    { col: CONFIG.COL.TOKEN_SUP,     nom: 'Token_Superieur'  },
    { col: CONFIG.COL.TOKEN_PRES,    nom: 'Token_Presidence' },
    { col: CONFIG.COL.STATUT_GLOBAL, nom: 'Statut_Global'    },
    { col: CONFIG.COL.DATE_CLOTURE,  nom: 'Date_Cloture'     },
    { col: CONFIG.COL.DRIVE_DOSSIER, nom: 'Drive_DossierID'  },
    { col: CONFIG.COL.DRIVE_DOC,     nom: 'Drive_DocID'      },
    { col: CONFIG.COL.RELANCE,       nom: 'Derniere_Relance' },
    { col: CONFIG.COL.TOKEN_PRECISION,  nom: 'Token_Precision'  },
    { col: CONFIG.COL.NIVEAU_PRECISION, nom: 'Niveau_Precision' },
    { col: CONFIG.COL.NB_PRECISIONS,    nom: 'Nb_Precisions'    }
  ];

  headers.forEach(({ col, nom }) => {
    const cell = sheet.getRange(1, col);
    if (!cell.getValue()) {
      cell.setValue(nom);
    }
  });

  // Style uniforme de la ligne d'en-tête (A → Z) : fond noir,
  // texte blanc, gras, centré. Couvre colonnes formulaire ET script.
  const dernCol = CONFIG.COL.NB_PRECISIONS;  // AC
  sheet.getRange(1, 1, 1, dernCol)
    .setBackground('#000000')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);  // figer la ligne d'en-tête
  Logger.log('[INFO][Setup] En-tetes O-Z crees + style noir/blanc applique sur A-Z.');

  // ----------------------------------------------------------
  // 1b. Forcer le format des colonnes Heure début / Heure fin
  //     Sinon, quand "Toute la journée" injecte 08h00/17h00,
  //     la cellule s'affiche en DATE (30/12/1899) au lieu de
  //     l'heure. On force "HH:mm:ss" pour afficher 17:00:00.
  // ----------------------------------------------------------
  const nbLignesData = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, CONFIG.COL.HEURE_DEBUT, nbLignesData, 1).setNumberFormat('HH:mm:ss');
  sheet.getRange(2, CONFIG.COL.HEURE_FIN,   nbLignesData, 1).setNumberFormat('HH:mm:ss');
  Logger.log('[INFO][Setup] Format HH:mm:ss applique sur les colonnes Heure debut/fin.');

  // ----------------------------------------------------------
  // 2. Installer le trigger onFormSubmit (si absent)
  // ----------------------------------------------------------
  const dejaTrigger = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'onFormSubmit');

  if (!dejaTrigger) {
    ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
    Logger.log('[INFO][Setup] Trigger onFormSubmit installe.');
  } else {
    Logger.log('[INFO][Setup] Trigger onFormSubmit deja present.');
  }

  // ----------------------------------------------------------
  // 2b. Trigger onEdit installable pour la validation manuelle via sheet
  // ----------------------------------------------------------
  const dejaTriggerEdit = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'traiterDecisionManuelle');

  if (!dejaTriggerEdit) {
    ScriptApp.newTrigger('traiterDecisionManuelle')
      .forSpreadsheet(ss)
      .onEdit()
      .create();
    Logger.log('[INFO][Setup] Trigger traiterDecisionManuelle installé.');
  } else {
    Logger.log('[INFO][Setup] Trigger traiterDecisionManuelle déjà présent.');
  }

  // ----------------------------------------------------------
  // 2c. Trigger quotidien pour les relances automatiques
  // ----------------------------------------------------------
  const dejaTriggerRelance = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'verifierEtRelancer');

  if (!dejaTriggerRelance) {
    ScriptApp.newTrigger('verifierEtRelancer')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();
    Logger.log('[INFO][Setup] Trigger verifierEtRelancer installe (quotidien 08h00).');
  } else {
    Logger.log('[INFO][Setup] Trigger verifierEtRelancer deja present.');
  }

  // ----------------------------------------------------------
  // 3. Protections des colonnes de validation
  // ----------------------------------------------------------
  configurerProtections(ss, sheet);

  // ----------------------------------------------------------
  // 4. Confirmation
  // ----------------------------------------------------------
  SpreadsheetApp.getUi().alert(
    'Initialisation réussie !\n\n' +
    'Prochaines étapes (tout dans Config.gs) :\n\n' +
    '1. Renseigner les vrais emails dans PERSONNEL :\n' +
    '   presidents.PRES_GENERAL (président unique Agribusiness TV)\n' +
    '   superieurs.SUP_EDITORIAL.email, etc.\n\n' +
    '2. Renseigner DRIVE_DOSSIER_RACINE et DRIVE_DOSSIER_TEMPLATE\n\n' +
    '3. Déployer la Web App puis copier l\'URL dans WEBAPP_URL\n\n' +
    '4. Tester avec une soumission formulaire.'
  );
}


// ============================================================
// Installation du trigger onEdit installable (validation manuelle)
// ============================================================
function installerTriggerValidationManuelle() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_REPONSES_ID);

  const dejaTrigger = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'traiterDecisionManuelle');

  if (dejaTrigger) {
    SpreadsheetApp.getUi().alert(
      '✅ Déjà installé\n\n' +
      'Le trigger "traiterDecisionManuelle" est déjà actif.\n' +
      'Les validateurs peuvent saisir Approuvé / Rejeté directement dans le sheet.'
    );
    return;
  }

  ScriptApp.newTrigger('traiterDecisionManuelle')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  log('OK', 'Setup', 'Trigger traiterDecisionManuelle installé.');

  SpreadsheetApp.getUi().alert(
    '✅ Trigger installé avec succès !\n\n' +
    'Les validateurs peuvent maintenant saisir directement dans le sheet :\n\n' +
    '• Colonne N (Avis Supérieur)\n' +
    '• Colonne O (Avis Présidence)\n\n' +
    'Valeurs acceptées : Approuvé  |  Rejeté\n\n' +
    '⚠️  Pour un rejet : saisir le motif en colonne P (Commentaire) AVANT\n' +
    '   de mettre "Rejeté" dans la colonne d\'avis.'
  );
}


// ============================================================
// Protection des colonnes + validation de données
//
// Carte des accès :
//   A–N  (données formulaire)  → avertissement seul (lecture conseillée)
//   P    AVIS_SUP              → PAR LIGNE : seul le supérieur de la
//                                demande de cette ligne (strict)
//   Q    AVIS_PRES             → PAR LIGNE : seul le président compétent
//                                pour cette demande (strict)
//   R    COMMENTAIRE           → libre (aucune protection)
//   S–AC (colonnes système)    → avertissement seul (réservé au script)
//
// Les protections P/Q sont posées cellule par cellule à la création
// de chaque demande (appliquerProtectionsLigne, Utils.gs) et mises à
// jour à chaque étape du circuit. Cette fonction les RECONSTRUIT pour
// toutes les lignes existantes (récupération / changement de config).
//
// Dropdown P et Q : En attente / En attente de précisions / Approuvé / Rejeté
// ============================================================
function configurerProtections(ss, sheet) {
  if (!ss)    ss    = SpreadsheetApp.openById(CONFIG.SHEET_REPONSES_ID);
  if (!sheet) sheet = ss.getSheetByName(CONFIG.ONGLET_REPONSES);
  if (!sheet) {
    Logger.log('[WARN][Setup] Onglet introuvable — protections ignorees');
    return;
  }

  const lastRow = Math.max(sheet.getLastRow(), 200); // anticiper les futures lignes

  // ----------------------------------------------------------
  // 0. Supprimer toutes les protections de plage existantes
  // ----------------------------------------------------------
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => p.remove());

  // ----------------------------------------------------------
  // 1. Colonnes A–N : données formulaire — avertissement seul
  // ----------------------------------------------------------
  const nbColsFormulaire = CONFIG.COL.DATE_FIN; // dernière colonne formulaire (N)
  const pForm = sheet.getRange(2, 1, lastRow - 1, nbColsFormulaire).protect();
  pForm.setDescription('Données formulaire — ne pas modifier manuellement');
  pForm.setWarningOnly(true);
  Logger.log('[OK][Setup] Protection avertissement colonnes A-N configuree');

  // ----------------------------------------------------------
  // 2. Colonnes P et Q — protection PAR LIGNE
  //    Pour chaque demande existante, la cellule d'avis n'est
  //    éditable que par SON validateur (sup de la ligne / président
  //    compétent). Les lignes clôturées sont verrouillées pour tous.
  // ----------------------------------------------------------
  const lastDataRow = sheet.getLastRow();
  let nbLignesProtegees = 0;
  if (lastDataRow >= 2) {
    const ids = sheet.getRange(2, CONFIG.COL.ID_DEMANDE, lastDataRow - 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (!ids[i][0].toString().trim()) continue;
      appliquerProtectionsLigne(sheet, i + 2);
      nbLignesProtegees++;
    }
  }
  Logger.log('[OK][Setup] Protections par ligne P/Q — ' +
             nbLignesProtegees + ' demande(s) traitée(s)');

  // ----------------------------------------------------------
  // 4. Colonne R — COMMENTAIRE : aucune protection (libre)
  // ----------------------------------------------------------
  Logger.log('[OK][Setup] Colonne R (Commentaire) — sans protection (libre)');

  // ----------------------------------------------------------
  // 5. Colonnes S–Z : colonnes système — avertissement seul
  //    (ID demande, tokens, statut global, dates, Drive IDs...)
  // ----------------------------------------------------------
  const colDebutSys = CONFIG.COL.ID_DEMANDE;
  const nbColsSys   = CONFIG.COL.NB_PRECISIONS - colDebutSys + 1;
  const pSys = sheet.getRange(2, colDebutSys, lastRow - 1, nbColsSys).protect();
  pSys.setDescription('Colonnes système — réservées au script');
  pSys.setWarningOnly(true);
  Logger.log('[OK][Setup] Protection avertissement colonnes système (S-Z) configuree');

  // ----------------------------------------------------------
  // 6. Validation de données (dropdown) sur P et Q
  // ----------------------------------------------------------
  // 'En attente de précisions' est une valeur écrite par le script
  // (pas un choix manuel) — elle doit figurer dans la liste pour ne pas
  // être marquée invalide par la validation de données.
  const regleAvis = SpreadsheetApp.newDataValidation()
    .requireValueInList(['En attente', 'En attente de précisions', 'Approuvé', 'Rejeté'], true)
    .setAllowInvalid(false)
    .setHelpText('Choisir : En attente, Approuvé ou Rejeté')
    .build();

  const nbLignesValidation = Math.max(lastRow - 1, 2000);
  sheet.getRange(2, CONFIG.COL.AVIS_SUP,  nbLignesValidation).setDataValidation(regleAvis);
  sheet.getRange(2, CONFIG.COL.AVIS_PRES, nbLignesValidation).setDataValidation(regleAvis);
  Logger.log('[OK][Setup] Validation de données (dropdown) configurée sur P et Q');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Protections configurées !\n\n' +
      '• Colonnes P/Q (Avis)         → protégées PAR LIGNE : seul le validateur\n' +
      '  de chaque demande peut éditer sa cellule (' + nbLignesProtegees + ' demande(s) traitée(s))\n' +
      '• Colonne R (Commentaire)     → libre (accessible à tous)\n' +
      '• Colonnes A–N et S–AC        → avertissement (réservé script/formulaire)\n\n' +
      'Un menu déroulant (En attente / Approuvé / Rejeté) a été ajouté sur P et Q.'
    );
  } catch (e) {
    Logger.log('[INFO][Setup] Alert ignorée (pas de contexte UI — normal si exécuté depuis l\'éditeur).');
  }
}



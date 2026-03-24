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
    CONFIG.COL.AVIS_RH,
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
  // 1. En-tetes des colonnes U → AB (uniquement si vides)
  // ----------------------------------------------------------
  const headers = [
    { col: CONFIG.COL.ID_DEMANDE,    nom: 'ID_Demande'       },
    { col: CONFIG.COL.TOKEN_SUP,     nom: 'Token_Superieur'  },
    { col: CONFIG.COL.TOKEN_RH,      nom: 'Token_RH'         },
    { col: CONFIG.COL.TOKEN_PRES,    nom: 'Token_Presidence' },
    { col: CONFIG.COL.STATUT_GLOBAL, nom: 'Statut_Global'    },
    { col: CONFIG.COL.DATE_CLOTURE,  nom: 'Date_Cloture'     },
    { col: CONFIG.COL.DRIVE_DOSSIER, nom: 'Drive_DossierID'  },
    { col: CONFIG.COL.DRIVE_DOC,     nom: 'Drive_DocID'      },
    { col: CONFIG.COL.RELANCE,       nom: 'Derniere_Relance' }
  ];

  headers.forEach(({ col, nom }) => {
    const cell = sheet.getRange(1, col);
    if (!cell.getValue()) {
      cell.setValue(nom)
        .setFontWeight('bold')
        .setBackground('#d9d9d9')
        .setFontColor('#333333');
    }
  });
  Logger.log('[INFO][Setup] En-tetes colonnes U-AB verifies/crees.');

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
    'Initialisation reussie !\n\n' +
    'Prochaines etapes (tout dans Config.gs) :\n\n' +
    '1. Renseigner les vrais emails :\n' +
    '   EMAIL_RH, EMAIL_PRESIDENCE_1, EMAIL_PRESIDENCE_2\n\n' +
    '2. Ajouter les superieurs dans SUP_NOMS :\n' +
    '   "email@massaka.com": "Prenom Nom"\n\n' +
    '3. Renseigner DRIVE_DOSSIER_RACINE et DRIVE_DOSSIER_TEMPLATE\n\n' +
    '4. Deployer la Web App puis copier l\'URL dans WEBAPP_URL\n\n' +
    '5. Tester avec une soumission formulaire.'
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
    '• Colonne R (Avis Supérieur)\n' +
    '• Colonne S (Avis RH)\n' +
    '• Colonne T (Avis Présidence)\n\n' +
    'Valeurs acceptées : Approuvé  |  Rejeté\n\n' +
    '⚠️  Pour un rejet : saisir le motif en colonne U (Commentaire) AVANT\n' +
    '   de mettre "Rejeté" dans la colonne d\'avis.'
  );
}


// ============================================================
// Protection des colonnes + validation de données
//
// Carte des accès :
//   A–Q  (données formulaire)  → avertissement seul (lecture conseillée)
//   R    AVIS_SUP              → supérieurs uniquement  (verrouillage strict)
//   S    AVIS_RH               → RH uniquement           (verrouillage strict)
//   T    AVIS_PRES             → Présidence uniquement   (verrouillage strict)
//   U    COMMENTAIRE           → libre (aucune protection)
//   V–AD (colonnes système)    → avertissement seul (réservé au script)
//
// Dropdowns R, S, T : En attente / Approuvé / Rejeté
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

  // Listes d'emails validateurs
  const emailsSup  = Object.keys(CONFIG.SUP_NOMS).filter(Boolean);
  const emailsRH   = [CONFIG.EMAIL_RH].filter(Boolean);
  const emailsPres = [CONFIG.EMAIL_PRESIDENCE].filter(Boolean);
  const tousValidateurs = [...emailsSup, ...emailsRH, ...emailsPres];

  // ----------------------------------------------------------
  // 1. Colonnes A–P : données formulaire — avertissement seul
  //    Le script peut écrire librement ; les humains voient un popup.
  // ----------------------------------------------------------
  const nbColsFormulaire = CONFIG.COL.EMAIL_SUP; // colonne P incluse
  const pForm = sheet.getRange(2, 1, lastRow - 1, nbColsFormulaire).protect();
  pForm.setDescription('Données formulaire — ne pas modifier manuellement');
  pForm.setWarningOnly(true);
  Logger.log('[OK][Setup] Protection avertissement colonnes A-P configuree');

  // ----------------------------------------------------------
  // 2. Colonne Q — AVIS_SUP : supérieurs uniquement
  //    Si SUP_NOMS est vide, la colonne est verrouillée pour tout
  //    le monde sauf le propriétaire du spreadsheet (le script peut
  //    toujours écrire car il tourne en tant que propriétaire).
  // ----------------------------------------------------------
  const pSup = sheet.getRange(2, CONFIG.COL.AVIS_SUP, lastRow - 1).protect();
  pSup.setDescription('Réservé : Supérieurs hiérarchiques');
  pSup.removeEditors(pSup.getEditors());
  if (emailsSup.length > 0) {
    pSup.addEditors(emailsSup);
    Logger.log('[OK][Setup] Protection AVIS_SUP — ' + emailsSup.length + ' éditeur(s)');
  } else {
    // Aucun supérieur défini — colonne accessible uniquement au propriétaire
    // Ajouter les supérieurs dans CONFIG.SUP_NOMS puis relancer cette fonction.
    Logger.log('[WARN][Setup] SUP_NOMS vide — col Q verrouillée (propriétaire seulement). ' +
               'Ajoutez les supérieurs dans Config.gs puis relancez "Reconfigurer les protections".');
  }

  // ----------------------------------------------------------
  // 3. Colonne R — AVIS_RH : RH uniquement
  // ----------------------------------------------------------
  const pRH = sheet.getRange(2, CONFIG.COL.AVIS_RH, lastRow - 1).protect();
  pRH.setDescription('Réservé : Responsable RH');
  pRH.removeEditors(pRH.getEditors());
  if (emailsRH.length > 0) {
    pRH.addEditors(emailsRH);
    Logger.log('[OK][Setup] Protection AVIS_RH — ' + CONFIG.EMAIL_RH);
  }

  // ----------------------------------------------------------
  // 4. Colonne S — AVIS_PRES : Présidence uniquement
  // ----------------------------------------------------------
  const pPres = sheet.getRange(2, CONFIG.COL.AVIS_PRES, lastRow - 1).protect();
  pPres.setDescription('Réservé : Présidence');
  pPres.removeEditors(pPres.getEditors());
  if (emailsPres.length > 0) {
    pPres.addEditors(emailsPres);
    Logger.log('[OK][Setup] Protection AVIS_PRES — ' + CONFIG.EMAIL_PRESIDENCE);
  }

  // ----------------------------------------------------------
  // 5. Colonne U — COMMENTAIRE : aucune protection (libre)
  //    Accessible à tous — le motif de rejet peut être saisi par n'importe qui.
  // ----------------------------------------------------------
  Logger.log('[OK][Setup] Colonne U (Commentaire) — sans protection (libre)');

  // ----------------------------------------------------------
  // 6. Colonnes V–AD : colonnes système — avertissement seul
  //    (ID demande, tokens, statut global, dates, Drive IDs...)
  // ----------------------------------------------------------
  const colDebutSys  = CONFIG.COL.ID_DEMANDE;
  const nbColsSys    = CONFIG.COL.RELANCE - colDebutSys + 1;
  const pSys = sheet.getRange(2, colDebutSys, lastRow - 1, nbColsSys).protect();
  pSys.setDescription('Colonnes système — réservées au script');
  pSys.setWarningOnly(true);
  Logger.log('[OK][Setup] Protection avertissement colonnes système (U-AC) configuree');

  // ----------------------------------------------------------
  // 7. Validation de données (dropdown) sur Q, R, S
  //    Empêche les fautes de frappe et guide les validateurs.
  // ----------------------------------------------------------
  const regleAvis = SpreadsheetApp.newDataValidation()
    .requireValueInList(['En attente', 'Approuvé', 'Rejeté'], true)
    .setAllowInvalid(false)
    .setHelpText('Choisir : En attente, Approuvé ou Rejeté')
    .build();

  // On couvre 2000 lignes pour inclure les futures demandes automatiquement.
  const nbLignesValidation = Math.max(lastRow - 1, 2000);
  sheet.getRange(2, CONFIG.COL.AVIS_SUP,  nbLignesValidation).setDataValidation(regleAvis);
  sheet.getRange(2, CONFIG.COL.AVIS_RH,   nbLignesValidation).setDataValidation(regleAvis);
  sheet.getRange(2, CONFIG.COL.AVIS_PRES, nbLignesValidation).setDataValidation(regleAvis);
  Logger.log('[OK][Setup] Validation de donnees (dropdown) configuree sur Q, R, S');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Protections configurées !\n\n' +
      '• Colonne R (Avis Supérieur) → ' + (emailsSup.length > 0 ? emailsSup.join(', ') : '⚠️ aucun supérieur défini') + '\n' +
      '• Colonne S (Avis RH)        → ' + (CONFIG.EMAIL_RH || '⚠️ non défini') + '\n' +
      '• Colonne T (Avis Présidence)→ ' + (CONFIG.EMAIL_PRESIDENCE || '⚠️ non défini') + '\n' +
      '• Colonne U (Commentaire)    → libre (accessible à tous)\n' +
      '• Colonnes A–Q et V–AD       → avertissement (réservé script/formulaire)\n\n' +
      'Un menu déroulant (En attente / Approuvé / Rejeté) a été ajouté sur R, S, T.'
    );
  } catch (e) {
    Logger.log('[INFO][Setup] Alert ignoree (pas de contexte UI — normal si execute depuis l\'editeur).');
  }
}
